<?php

namespace App\Http\Requests;

use App\Models\AnnotationEntry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAnnotationEntryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $routeAnnotation = $this->route('annotation');
        $currentAnnotationId = is_object($routeAnnotation) && isset($routeAnnotation->id)
            ? $routeAnnotation->id
            : (is_numeric($routeAnnotation) ? (int) $routeAnnotation : null);

        return [
            'user_inquiry' => [
                'required',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) use ($currentAnnotationId): void {
                    if (! is_string($value)) {
                        return;
                    }

                    $query = AnnotationEntry::query()
                        ->whereRaw('LOWER(symptom_name) = ?', [mb_strtolower(trim($value))]);

                    if ($currentAnnotationId !== null) {
                        $query->whereKeyNot($currentAnnotationId);
                    }

                    if ($query->exists()) {
                        $fail('This inquiry is already annotated. Please pick another one.');
                    }
                },
            ],
            'user_age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'language' => [
                'required',
                'string',
                Rule::in(['english', 'tagalog', 'bisaya', 'code-switched']),
            ],
            'confidence' => [
                'required',
                'string',
                Rule::in(['high', 'medium', 'low']),
            ],
            'min_age' => ['required', 'integer', 'min:0', 'max:150'],
            'symptom_labels' => ['required', 'array', 'min:1'],
            'symptom_labels.*' => [
                'required',
                'string',
                Rule::in([
                    'HEADACHE',
                    'COUGH_DRY',
                    'COUGH_PRODUCTIVE',
                    'COUGH_GENERAL',
                    'FEVER',
                    'BODY_ACHES',
                    'NASAL_CONGESTION',
                    'RUNNY_NOSE',
                    'ALLERGIC_RHINITIS',
                    'RASHES',
                    'STOMACH_ACHE_ACID',
                    'DIARRHEA',
                    'NAUSEA',
                    'DIZZINESS',
                    'SORE_THROAT',
                    'UNKNOWN',
                    'OTHER',
                ]),
            ],
            'symptom_labels_other' => ['nullable', 'string', 'max:255'],
            'suggested_otc' => [
                'array',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! is_array($value) || count($value) === 0) {
                        if (! in_array('yes', (array) $this->input('requires_medical_referral_options', []), true)) {
                            $fail('Please select at least one OTC drug, or mark "Requires Medical Referral" as Yes.');
                        }
                    }
                },
            ],
            'suggested_otc.*' => [
                'required',
                'string',
                Rule::in([
                    'Paracetamol',
                    'Paracetamol (pediatric)',
                    'Ibuprofen',
                    'Acetylsalicylic acid',
                    'Paracetamol + Phenylephrine + Chlorphenamine (Bioflu)',
                    'Paracetamol + Phenylephrine + Chlorphenamine (\u00b1 Zinc) (Neozep/Neozep Z+)',
                    'Paracetamol + Phenylephrine + Chlorphenamine (Neozep pediatric)',
                    'Paracetamol + Phenylephrine + Chlorphenamine (Decolgen)',
                    'Paracetamol + Decongestant + Antihistamine (Symdex-D Syrup)',
                    'Paracetamol + Decongestant + Antihistamine (Symdex-D Forte)',
                    'Paracetamol + Phenylephrine (Sinutab)',
                    'Dextromethorphan + Paracetamol + Phenylephrine + Chlorphenamine (Tuseran Forte)',
                    'Butamirate citrate',
                    'Lagundi leaf extract',
                    'Carbocisteine',
                    'Guaifenesin',
                    'Cetirizine HCl',
                    'Loratadine',
                    'Diphenhydramine HCl',
                    'Loperamide HCl',
                    'Bacillus clausii',
                    'Aluminum hydroxide + Magnesium hydroxide + Simethicone',
                    'OTHER',
                ]),
            ],
            'suggested_otc_other' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn (): bool => in_array('OTHER', $this->input('suggested_otc', []), true)),
            ],
            'brand_examples' => ['nullable', 'array'],
            'brand_examples.*' => ['nullable', 'string', 'max:255'],
            'age_restriction_options' => ['required', 'array', 'min:1', 'max:1'],
            'age_restriction_options.*' => ['required', 'string', Rule::in(['yes', 'no'])],
            'age_restrictions_details' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf(fn (): bool => in_array('yes', $this->input('age_restriction_options', []), true)),
            ],
            'known_contraindications_options' => ['required', 'array', 'min:1', 'max:1'],
            'known_contraindications_options.*' => ['required', 'string', Rule::in(['yes', 'no'])],
            'known_contraindications_details' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf(fn (): bool => in_array('yes', $this->input('known_contraindications_options', []), true)),
            ],
            'pregnancy_considerations_options' => ['required', 'array', 'min:1', 'max:1'],
            'pregnancy_considerations_options.*' => ['required', 'string', Rule::in(['yes', 'no'])],
            'pregnancy_considerations_details' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf(fn (): bool => in_array('yes', $this->input('pregnancy_considerations_options', []), true)),
            ],
            'gender_specific_limitations' => ['required', 'string', Rule::in(['null', 'not_for_pregnant', 'female_only', 'male_only'])],
            'requires_medical_referral_options' => ['required', 'array', 'min:1', 'max:1'],
            'requires_medical_referral_options.*' => ['required', 'string', Rule::in(['yes', 'no'])],
            'medical_notes' => [
                'required',
                'json',
                'max:8000',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! is_string($value)) {
                        return;
                    }

                    $decoded = json_decode($value, true);

                    if (! is_array($decoded) || ! isset($decoded['otc_dosage_guide']) || ! is_array($decoded['otc_dosage_guide'])) {
                        $fail('Medical notes must include an otc_dosage_guide object.');

                        return;
                    }

                    foreach ($decoded['otc_dosage_guide'] as $otcName => $details) {
                        if (! is_array($details)) {
                            $fail("Medical notes for {$otcName} must be an object.");

                            continue;
                        }

                        $requiredFields = ['dosage_mg', 'times_per_day', 'max_doses_per_day', 'notes'];

                        foreach ($requiredFields as $field) {
                            $fieldValue = $details[$field] ?? null;

                            if ($fieldValue === null || trim((string) $fieldValue) === '') {
                                $fail("Medical notes for {$otcName} must include {$field}.");
                            }
                        }
                    }
                },
            ],
        ];
    }

    /**
     * Get custom validation error messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'language.required' => 'Please select the inquiry language.',
            'symptom_labels.required' => 'Please select at least one symptom label.',
            'symptom_labels.min' => 'Please select at least one symptom label.',
            'suggested_otc_other.required' => 'Please provide the OTC name when selecting Others.',
            'confidence.required' => 'Please select a confidence level.',
            'min_age.required' => 'Please enter the minimum age.',
            'age_restriction_options.required' => 'Please answer age restriction.',
            'age_restrictions_details.required' => 'Please provide age restriction details.',
            'known_contraindications_options.required' => 'Please answer possible drug contraindication.',
            'known_contraindications_details.required' => 'Please provide the drug contraindication details.',
            'pregnancy_considerations_options.required' => 'Please answer pregnancy considerations.',
            'pregnancy_considerations_details.required' => 'Please provide pregnancy considerations details.',
            'gender_specific_limitations.required' => 'Please select a gender-specific limitation.',
            'requires_medical_referral_options.required' => 'Please answer requires medical referral.',
            'medical_notes.required' => 'Medical notes are required.',
            'user_inquiry.unique' => 'This inquiry is already annotated. Please pick another one.',
        ];
    }

    /**
     * Prepare data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'user_inquiry' => is_string($this->input('user_inquiry')) ? trim($this->input('user_inquiry')) : $this->input('user_inquiry'),
            'symptom_labels' => $this->input('symptom_labels', []),
            'symptom_labels_other' => is_string($this->input('symptom_labels_other'))
                ? trim($this->input('symptom_labels_other'))
                : $this->input('symptom_labels_other'),
            'suggested_otc' => $this->input('suggested_otc', []),
            'age_restriction_options' => $this->input('age_restriction_options', []),
            'age_restrictions_details' => is_string($this->input('age_restrictions_details'))
                ? trim($this->input('age_restrictions_details'))
                : $this->input('age_restrictions_details'),
            'known_contraindications_options' => $this->input('known_contraindications_options', []),
            'known_contraindications_details' => is_string($this->input('known_contraindications_details'))
                ? trim($this->input('known_contraindications_details'))
                : $this->input('known_contraindications_details'),
            'pregnancy_considerations_options' => $this->input('pregnancy_considerations_options', []),
            'pregnancy_considerations_details' => is_string($this->input('pregnancy_considerations_details'))
                ? trim($this->input('pregnancy_considerations_details'))
                : $this->input('pregnancy_considerations_details'),
            'requires_medical_referral_options' => $this->input('requires_medical_referral_options', []),
        ]);
    }
}
