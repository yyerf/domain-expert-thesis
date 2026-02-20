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
                Rule::unique('annotation_entries', 'symptom_name')->ignore($currentAnnotationId),
                function (string $attribute, mixed $value, \Closure $fail) use ($currentAnnotationId): void {
                    if (! is_string($value)) {
                        return;
                    }

                    $query = AnnotationEntry::query()
                        ->whereRaw('LOWER(symptom_name) = ?', [mb_strtolower(trim($value))]);

                    if ($currentAnnotationId !== null) {
                        $query->whereKeyNot($currentAnnotationId);
                    }

                    $exists = $query->exists();

                    if ($exists) {
                        $fail('This inquiry is already annotated. Please pick another one.');
                    }
                },
            ],
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
                    'DIARRHEA',
                    'STOMACH_ACHE',
                    'SORE_THROAT',
                    'DIZZINESS',
                    'NAUSEA',
                    'VOMITING',
                    'FATIGUE',
                    'SHORTNESS_OF_BREATH',
                    'CHEST_PAIN',
                    'OTHER',
                ]),
            ],
            'symptom_labels_other' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn (): bool => in_array('OTHER', $this->input('symptom_labels', []), true)),
            ],
            'suggested_otc' => ['required', 'array', 'min:1'],
            'suggested_otc.*' => [
                'required',
                'string',
                Rule::in([
                    'Paracetamol',
                    'Ibuprofen',
                    'Aspirin',
                    'Dextromethorphan',
                    'Guaifenesin',
                    'Phenylephrine',
                    'Diphenhydramine',
                    'Chlorpheniramine',
                    'Loratadine',
                    'Cetirizine',
                    'Loperamide',
                    'Bismuth Subsalicylate',
                    'Ascorbic Acid (Vitamin C)',
                    'OTHER',
                ]),
            ],
            'suggested_otc_other' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn (): bool => in_array('OTHER', $this->input('suggested_otc', []), true)),
            ],
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
            'gender_specific_limitations' => ['required', 'array', 'min:1'],
            'gender_specific_limitations.*' => ['required', 'string', Rule::in(['no', 'male', 'female'])],
            'requires_medical_referral_options' => ['required', 'array', 'min:1', 'max:1'],
            'requires_medical_referral_options.*' => ['required', 'string', Rule::in(['yes', 'no'])],
            'medical_notes' => [
                'required',
                'json',
                'max:4000',
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

                        $requiredFields = ['dosage_mg', 'times_per_day', 'notes'];

                        foreach ($requiredFields as $field) {
                            $fieldValue = $details[$field] ?? null;

                            if (! is_string($fieldValue) || trim($fieldValue) === '') {
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
            'symptom_labels.required' => 'Please select at least one symptom label.',
            'suggested_otc.required' => 'Please select at least one suggested OTC.',
            'symptom_labels_other.required' => 'Please provide the symptom name when selecting Others.',
            'suggested_otc_other.required' => 'Please provide the OTC name when selecting Others.',
            'age_restriction_options.required' => 'Please answer age restriction.',
            'age_restrictions_details.required' => 'Please provide age restriction details.',
            'known_contraindications_options.required' => 'Please answer possible drug contraindication.',
            'known_contraindications_details.required' => 'Please provide the drug contraindication details.',
            'pregnancy_considerations_options.required' => 'Please answer pregnancy considerations.',
            'pregnancy_considerations_details.required' => 'Please provide pregnancy considerations details.',
            'gender_specific_limitations.required' => 'Please select at least one gender-specific limitation option.',
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
            'gender_specific_limitations' => $this->input('gender_specific_limitations', []),
            'requires_medical_referral_options' => $this->input('requires_medical_referral_options', []),
        ]);
    }
}
