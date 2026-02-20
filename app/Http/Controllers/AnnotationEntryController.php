<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAnnotationEntryRequest;
use App\Models\AnnotationEntry;
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
     * Export all annotation entries as JSON matching the prompt.md schema.
     */
    public function export(): StreamedResponse
    {
        $entries = AnnotationEntry::query()
            ->with('annotator:id,name,email')
            ->oldest()
            ->get();

        $filename = 'domain-expert-annotation-guide-'.now()->format('Ymd-His').'.json';

        return response()->streamDownload(function () use ($entries): void {
            echo json_encode([
                '_schema_version' => '1.0',
                'generated_at' => now()->toIso8601String(),
                'total_entries' => $entries->count(),
                'entries' => $entries->values()->map(function (AnnotationEntry $entry, int $index): array {
                    $otcPayload = json_decode($entry->otc_drug_name ?? '[]', true);
                    $medicalNotes = json_decode($entry->medical_notes ?? 'null', true);
                    $brandExamples = json_decode($entry->brand_examples ?? '[]', true);

                    $selectedOtc = is_array($otcPayload) ? ($otcPayload['selected'] ?? []) : [];

                    // Cast numeric dosage fields to int as required by schema
                    $castDosageGuide = null;
                    if (is_array($medicalNotes) && isset($medicalNotes['otc_dosage_guide']) && is_array($medicalNotes['otc_dosage_guide'])) {
                        $castDosageGuide = [];
                        foreach ($medicalNotes['otc_dosage_guide'] as $drug => $details) {
                            $castDosageGuide[$drug] = [
                                'dosage_mg' => isset($details['dosage_mg']) ? (int) $details['dosage_mg'] : null,
                                'times_per_day' => isset($details['times_per_day']) ? (int) $details['times_per_day'] : null,
                                'max_doses_per_day' => isset($details['max_doses_per_day']) ? (int) $details['max_doses_per_day'] : null,
                                'notes' => $details['notes'] ?? null,
                            ];
                        }
                    }

                    return [
                        'entry_id' => 'de_'.str_pad((string) $entry->id, 3, '0', STR_PAD_LEFT),
                        'user_inquiry' => $entry->symptom_name,
                        'user_age' => $entry->user_age,
                        'language' => $entry->language,
                        'symptom_labels' => array_values(array_filter(
                            $this->decodeJsonArray($entry->validated_symptom_label),
                            fn (string $label): bool => $label !== 'OTHER',
                        )),
                        'symptom_labels_other' => $entry->assigned_symptom_label !== '' ? $entry->assigned_symptom_label : null,
                        'suggested_otc' => [
                            'selected' => $selectedOtc,
                            'brand_examples' => is_array($brandExamples) ? $brandExamples : [],
                            'other' => is_array($otcPayload) ? ($otcPayload['other'] ?? null) : null,
                        ],
                        'min_age' => $entry->min_age ?? 0,
                        'has_age_restrictions' => $entry->age_restrictions !== null
                            && $entry->age_restrictions !== ''
                            && $entry->age_restrictions !== 'NONE',
                        'has_known_contraindications' => $entry->known_contraindications !== null
                            && $entry->known_contraindications !== ''
                            && $entry->known_contraindications !== 'NONE',
                        'known_contraindications_details' => $entry->known_contraindications !== 'NONE'
                            ? $entry->known_contraindications
                            : null,
                        'has_pregnancy_considerations' => $entry->pregnancy_considerations !== null
                            && $entry->pregnancy_considerations !== ''
                            && $entry->pregnancy_considerations !== 'NONE',
                        'pregnancy_considerations_details' => $entry->pregnancy_considerations !== 'NONE'
                            ? $entry->pregnancy_considerations
                            : null,
                        'gender_specific_limitations' => $entry->gender_specific_limitations !== 'null'
                            ? $entry->gender_specific_limitations
                            : null,
                        'requires_medical_referral' => $entry->requires_medical_referral,
                        'confidence' => $entry->confidence,
                        'annotated_by' => $entry->annotator?->name ?? 'AI-annotator',
                        'medical_notes' => count($selectedOtc) > 0 && $castDosageGuide !== null
                            ? ['otc_dosage_guide' => $castDosageGuide]
                            : null,
                        'annotated_at' => $entry->created_at?->toIso8601String(),
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
            'user_age' => isset($validated['user_age']) && $validated['user_age'] !== '' ? (int) $validated['user_age'] : null,
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
            'brand_examples' => json_encode(array_values(array_filter($validated['brand_examples'] ?? [], fn (mixed $v): bool => is_string($v) && trim($v) !== '')), JSON_UNESCAPED_SLASHES),
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
            'red_flag_symptoms' => null,
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
        $brandExamples = json_decode($entry->brand_examples ?? '[]', true);

        return [
            'id' => $entry->id,
            'user_inquiry' => $entry->symptom_name,
            'user_age' => $entry->user_age,
            'language' => $entry->language,
            'confidence' => $entry->confidence,
            'min_age' => $entry->min_age ?? 0,
            'symptom_labels' => $this->decodeJsonArray($entry->validated_symptom_label),
            'symptom_labels_other' => $entry->assigned_symptom_label !== '' ? $entry->assigned_symptom_label : null,
            'suggested_otc' => is_array($otcPayload) ? ($otcPayload['selected'] ?? []) : [],
            'suggested_otc_other' => is_array($otcPayload) ? ($otcPayload['other'] ?? null) : null,
            'brand_examples' => is_array($brandExamples) ? $brandExamples : [],
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
