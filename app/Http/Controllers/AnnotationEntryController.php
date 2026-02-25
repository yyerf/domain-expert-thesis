<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAnnotationEntryRequest;
use App\Models\AnnotationEntry;
use App\Models\OtcDrugAge;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AnnotationEntryController extends Controller
{
    /**
     * Show the annotation guide workspace.
     */
    public function index(Request $request): Response
    {
        $allRawLines = $this->loadPopulationInquiries(raw: true);
        $populationInquiries = array_values(array_unique($allRawLines));
        $annotatedEntries = AnnotationEntry::query()
            ->with('annotator:id,name,email')
            ->latest()
            ->get();

        $editingEntryId = (int) $request->integer('edit');
        $editingEntry = $editingEntryId > 0 ? $annotatedEntries->firstWhere('id', $editingEntryId) : null;

        $annotationStatusByInquiry = [];

        foreach ($annotatedEntries as $entry) {
            $normalizedInquiry = mb_strtolower(trim($entry->symptom_name));

            if ($normalizedInquiry === '' || isset($annotationStatusByInquiry[$normalizedInquiry])) {
                continue;
            }

            $annotationStatusByInquiry[$normalizedInquiry] = [
                'user_inquiry' => $entry->symptom_name,
                'annotated_by' => [
                    'id' => $entry->annotator->id,
                    'name' => $entry->annotator->name,
                    'email' => $entry->annotator->email,
                ],
                'annotated_at' => $entry->created_at?->toIso8601String(),
            ];
        }

        $pendingPopulationInquiries = array_values(array_filter(
            $populationInquiries,
            fn (string $inquiry): bool => ! isset($annotationStatusByInquiry[mb_strtolower(trim($inquiry))]),
        ));

        return Inertia::render('annotations/index', [
            'entries' => $annotatedEntries
                ->map(fn (AnnotationEntry $entry): array => $this->transformEntry($entry)),
            'editingEntry' => $editingEntry ? $this->transformEntry($editingEntry) : null,
            'populationInquiries' => $populationInquiries,
            'pendingPopulationInquiries' => $pendingPopulationInquiries,
            'nextPopulationInquiry' => $pendingPopulationInquiries[0] ?? null,
            'annotationStatusByInquiry' => array_values($annotationStatusByInquiry),
            'currentAnnotatorId' => auth()->id(),
            'isAdmin' => (bool) auth()->user()?->is_admin,
            'populationStats' => [
                'total_lines' => count($allRawLines),
                'unique_lines' => count($populationInquiries),
                'pending_lines' => count($pendingPopulationInquiries),
            ],
            'otcDrugAges' => OtcDrugAge::query()
                ->get()
                ->keyBy('drug_name')
                ->map(fn (OtcDrugAge $record): array => [
                    'drug_name' => $record->drug_name,
                    'min_age' => $record->min_age,
                    'max_age' => $record->max_age,
                ]),
        ]);
    }

    /**
     * Store a new domain expert annotation entry.
     */
    public function store(StoreAnnotationEntryRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        AnnotationEntry::query()->create($this->mapValidatedPayload($validated, (int) $request->user()->id));

        return to_route('annotations.index');
    }

    /**
     * Update an annotation entry.
     */
    public function update(StoreAnnotationEntryRequest $request, AnnotationEntry $annotation): RedirectResponse
    {
        $validated = $request->validated();

        $payload = $this->mapValidatedPayload($validated, $annotation->annotated_by);
        unset($payload['is_misclassified']); // preserve existing value; only admin can toggle this
        $annotation->update($payload);

        return to_route('annotations.entries');
    }

    /**
     * Store or update min/max age for an OTC drug.
     */
    public function storeOtcDrugAge(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'drug_name' => ['required', 'string', 'max:255'],
            'min_age' => ['required', 'integer', 'min:0', 'max:150'],
            'max_age' => ['required', 'integer', 'min:0', 'max:150'],
        ]);

        OtcDrugAge::query()->updateOrCreate(
            ['drug_name' => $validated['drug_name']],
            [
                'min_age' => (int) $validated['min_age'],
                'max_age' => (int) $validated['max_age'],
                'updated_by' => (int) $request->user()->id,
            ],
        );

        return back();
    }

    /**
     * Show the dedicated entries dashboard.
     */
    public function entries(): Response
    {
        $entries = AnnotationEntry::query()
            ->with('annotator:id,name,email')
            ->latest()
            ->get();

        $labels = $entries
            ->flatMap(fn (AnnotationEntry $entry): array => $this->decodeJsonArray($entry->validated_symptom_label))
            ->filter(fn (string $label): bool => $label !== 'OTHER')
            ->unique()
            ->values();

        $annotators = $entries
            ->map(fn (AnnotationEntry $entry): array => [
                'id' => $entry->annotator->id,
                'name' => $entry->annotator->name,
                'email' => $entry->annotator->email,
            ])
            ->unique('id')
            ->values();

        return Inertia::render('annotations/entries', [
            'entries' => $entries->map(fn (AnnotationEntry $entry): array => $this->transformEntry($entry)),
            'availableLabels' => $labels,
            'availableAnnotators' => $annotators,
            'currentAnnotatorId' => auth()->id(),
        ]);
    }

    /**
     * Export all annotation entries as a lean JSON dataset for model fine-tuning.
     *
     * Removed redundant boolean flags (has_age_restrictions, has_known_contraindications,
     * has_pregnancy_considerations) — derivable from their detail fields being non-null.
     * Removed audit metadata (annotated_by, annotated_at, _schema_version, generated_at)
     * as they do not contribute to fine-tuning knowledge.
     * Flattened suggested_otc from {selected, other} to a plain string array.
     * Flattened medical_notes wrapper — dosage guide is now a top-level key.
     */
    public function export(): StreamedResponse
    {
        $entries = AnnotationEntry::query()
            ->oldest()
            ->get();

        $filename = 'domain-expert-annotation-guide-'.now()->format('Ymd-His').'.json';

        return response()->streamDownload(function () use ($entries): void {
            echo json_encode([
                'total_entries' => $entries->count(),
                'entries' => $entries->values()->map(function (AnnotationEntry $entry): array {
                    $otcPayload = json_decode($entry->otc_drug_name ?? '[]', true);
                    $medicalNotes = json_decode($entry->medical_notes ?? 'null', true);

                    $selectedOtc = is_array($otcPayload) ? ($otcPayload['selected'] ?? []) : [];
                    $otcOther = is_array($otcPayload) ? ($otcPayload['other'] ?? null) : null;

                    // Merge "other" custom drug into the flat OTC list
                    $flatOtc = $selectedOtc;
                    if (is_string($otcOther) && $otcOther !== '') {
                        $flatOtc[] = $otcOther;
                    }

                    // Cast numeric dosage fields to int
                    $dosageGuide = null;
                    if (is_array($medicalNotes) && isset($medicalNotes['otc_dosage_guide']) && is_array($medicalNotes['otc_dosage_guide'])) {
                        $dosageGuide = [];
                        foreach ($medicalNotes['otc_dosage_guide'] as $drug => $details) {
                            $dosageGuide[$drug] = [
                                'dosage_mg' => isset($details['dosage_mg']) ? (int) $details['dosage_mg'] : null,
                                'times_per_day' => isset($details['times_per_day']) ? (int) $details['times_per_day'] : null,
                                'max_doses_per_day' => isset($details['max_doses_per_day']) ? (int) $details['max_doses_per_day'] : null,
                                'notes' => $details['notes'] ?? null,
                                'min_age' => isset($details['min_age']) ? (int) $details['min_age'] : null,
                                'max_age' => isset($details['max_age']) ? (int) $details['max_age'] : null,
                            ];
                        }
                    }

                    return [
                        'entry_id' => 'de_'.str_pad((string) $entry->id, 3, '0', STR_PAD_LEFT),
                        'user_inquiry' => $entry->symptom_name,
                        'language' => $entry->language,
                        'symptom_labels' => array_values(array_filter(
                            $this->decodeJsonArray($entry->validated_symptom_label),
                            fn (string $label): bool => $label !== 'OTHER',
                        )),
                        'symptom_labels_other' => $entry->assigned_symptom_label !== '' ? $entry->assigned_symptom_label : null,
                        'suggested_otc' => $flatOtc,
                        'age_restrictions' => $entry->age_restrictions !== 'NONE' && $entry->age_restrictions !== ''
                            ? $entry->age_restrictions
                            : null,
                        'known_contraindications' => $entry->known_contraindications !== 'NONE' && $entry->known_contraindications !== ''
                            ? $entry->known_contraindications
                            : null,
                        'pregnancy_considerations' => $entry->pregnancy_considerations !== 'NONE' && $entry->pregnancy_considerations !== ''
                            ? $entry->pregnancy_considerations
                            : null,
                        'gender_specific_limitations' => $entry->gender_specific_limitations !== 'null'
                            ? $entry->gender_specific_limitations
                            : null,
                        'requires_medical_referral' => $entry->requires_medical_referral,
                        'confidence' => $entry->confidence,
                        'otc_dosage_guide' => count($flatOtc) > 0 && $dosageGuide !== null
                            ? $dosageGuide
                            : null,
                    ];
                }),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }, $filename, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Export all OTC drug age records as JSON.
     */
    public function exportOtcDrugAges(): StreamedResponse
    {
        $ages = OtcDrugAge::query()->orderBy('drug_name')->get();
        $filename = 'otc-drug-ages-'.now()->format('Ymd-His').'.json';

        return response()->streamDownload(function () use ($ages): void {
            echo json_encode([
                '_schema_version' => '1.0',
                'generated_at' => now()->toIso8601String(),
                'total_drugs' => $ages->count(),
                'otc_drug_ages' => $ages->map(fn (OtcDrugAge $record): array => [
                    'drug_name' => $record->drug_name,
                    'min_age' => $record->min_age,
                    'max_age' => $record->max_age,
                    'updated_at' => $record->updated_at?->toIso8601String(),
                ])->values(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }, $filename, [
            'Content-Type' => 'application/json',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }

    /**
     * Decode a JSON list field and always return a list of strings.
     *
     * @return list<string>
     */
    protected function decodeJsonArray(?string $value): array
    {
        $decoded = json_decode($value ?? '[]', true);

        if (! is_array($decoded)) {
            return [];
        }

        return array_values(array_filter($decoded, fn (mixed $item): bool => is_string($item) && $item !== ''));
    }

    /**
     * Normalize validated payload to model columns.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    protected function mapValidatedPayload(array $validated, int $annotatedBy): array
    {
        return [
            'symptom_name' => $validated['user_inquiry'],
            'language' => $validated['language'] ?? null,
            'confidence' => $validated['confidence'],
            'min_age' => (int) ($validated['min_age'] ?? 0),
            'assigned_symptom_label' => $validated['symptom_labels_other'] ?? '',
            'validated_symptom_label' => json_encode($validated['symptom_labels'], JSON_UNESCAPED_SLASHES),
            'is_misclassified' => false,
            'otc_applicable' => count($validated['suggested_otc'] ?? []) > 0,
            'otc_drug_name' => json_encode([
                'selected' => $validated['suggested_otc'] ?? [],
                'other' => $validated['suggested_otc_other'] ?? null,
            ], JSON_UNESCAPED_SLASHES),
            'age_restrictions' => in_array('yes', $validated['age_restriction_options'] ?? [], true)
                ? ($validated['age_restrictions_details'] ?? null)
                : 'NONE',
            'pregnancy_considerations' => in_array('yes', $validated['pregnancy_considerations_options'] ?? [], true)
                ? ($validated['pregnancy_considerations_details'] ?? null)
                : 'NONE',
            'gender_specific_limitations' => $validated['gender_specific_limitations'] ?? 'null',
            'known_contraindications' => in_array('yes', $validated['known_contraindications_options'] ?? [], true)
                ? ($validated['known_contraindications_details'] ?? null)
                : 'NONE',
            'requires_medical_referral' => in_array('yes', $validated['requires_medical_referral_options'] ?? [], true),
            'medical_notes' => $validated['medical_notes'] ?? null,
            'annotated_by' => $annotatedBy,
        ];
    }

    /**
     * Transform an annotation entry for UI/export consumption.
     *
     * @return array<string, mixed>
     */
    protected function transformEntry(AnnotationEntry $entry): array
    {
        $otcPayload = json_decode($entry->otc_drug_name ?? '[]', true);

        return [
            'id' => $entry->id,
            'user_inquiry' => $entry->symptom_name,
            'language' => $entry->language,
            'confidence' => $entry->confidence,
            'min_age' => $entry->min_age ?? 0,
            'symptom_labels' => $this->decodeJsonArray($entry->validated_symptom_label),
            'symptom_labels_other' => $entry->assigned_symptom_label !== '' ? $entry->assigned_symptom_label : null,
            'suggested_otc' => is_array($otcPayload) ? ($otcPayload['selected'] ?? []) : [],
            'suggested_otc_other' => is_array($otcPayload) ? ($otcPayload['other'] ?? null) : null,
            'age_restrictions' => $entry->age_restrictions !== 'NONE' ? $entry->age_restrictions : null,
            'has_age_restrictions' => $entry->age_restrictions !== null
                && $entry->age_restrictions !== ''
                && $entry->age_restrictions !== 'NONE',
            'has_known_contraindications' => $entry->known_contraindications !== null
                && $entry->known_contraindications !== ''
                && $entry->known_contraindications !== 'NONE',
            'known_contraindications_details' => $entry->known_contraindications !== 'NONE' ? $entry->known_contraindications : null,
            'has_pregnancy_considerations' => $entry->pregnancy_considerations !== null
                && $entry->pregnancy_considerations !== ''
                && $entry->pregnancy_considerations !== 'NONE',
            'pregnancy_considerations_details' => $entry->pregnancy_considerations !== 'NONE' ? $entry->pregnancy_considerations : null,
            'gender_specific_limitations' => $entry->gender_specific_limitations !== 'null' ? $entry->gender_specific_limitations : null,
            'requires_medical_referral' => $entry->requires_medical_referral,
            'medical_notes' => $entry->medical_notes,
            'created_at' => $entry->created_at?->toIso8601String(),
            'annotator' => [
                'id' => $entry->annotator->id,
                'name' => $entry->annotator->name,
                'email' => $entry->annotator->email,
            ],
        ];
    }

    /**
     * Load user inquiry population from local text file.
     *
     * @return list<string>
     */
    protected function loadPopulationInquiries(bool $raw = false): array
    {
        $filePath = base_path('userInquiry.txt');

        if (! File::exists($filePath)) {
            return [];
        }

        $lines = preg_split('/\r\n|\r|\n/', File::get($filePath)) ?: [];
        $inquiries = array_values(array_filter(array_map('trim', $lines), fn (string $line): bool => $line !== ''));

        if ($raw) {
            return $inquiries;
        }

        return array_values(array_unique($inquiries));
    }
}
