<?php

use App\Models\AnnotationEntry;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('authenticated users can view the annotation guide page', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('annotations.index'));

    $response->assertOk();

    $response->assertInertia(fn (Assert $page) => $page
        ->component('annotations/index')
        ->has('editingEntry')
        ->has('populationInquiries')
        ->has('pendingPopulationInquiries')
        ->has('nextPopulationInquiry')
        ->has('populationStats')
        ->has('annotationStatusByInquiry')
        ->has('currentAnnotatorId')
    );
});

test('authenticated users can view entries dashboard', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('annotations.entries'));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('annotations/entries')
        ->has('entries')
        ->has('availableLabels')
        ->has('availableAnnotators')
    );
});

test('authenticated users can create annotation entries', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('annotations.store'), [
        'user_inquiry' => 'I have fever and headache',
        'user_age' => null,
        'language' => 'english',
        'confidence' => 'high',
        'min_age' => 12,
        'symptom_labels' => ['FEVER', 'HEADACHE'],
        'suggested_otc' => ['Paracetamol'],
        'brand_examples' => ['Biogesic', 'Tempra'],
        'age_restriction_options' => ['yes'],
        'age_restrictions_details' => 'Avoid in children under 3 months unless advised by a doctor.',
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => 'null',
        'requires_medical_referral_options' => ['yes'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Paracetamol' => [
                    'dosage_mg' => '500',
                    'times_per_day' => '3',
                    'max_doses_per_day' => '4',
                    'notes' => 'Take after meals.',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertRedirect(route('annotations.index'));

    expect(AnnotationEntry::query()->count())->toBe(1);

    $entry = AnnotationEntry::query()->first();
    expect($entry->annotated_by)->toBe($user->id);
    expect($entry->language)->toBe('english');
    expect($entry->confidence)->toBe('high');
    expect($entry->min_age)->toBe(12);
});

test('duplicate inquiry cannot be annotated twice', function () {
    $user = User::factory()->create();

    AnnotationEntry::query()->create([
        'annotated_by' => $user->id,
        'symptom_name' => 'I have fever and headache',
        'user_age' => null,
        'language' => 'english',
        'confidence' => 'high',
        'min_age' => 12,
        'assigned_symptom_label' => '',
        'validated_symptom_label' => json_encode(['FEVER', 'HEADACHE'], JSON_UNESCAPED_SLASHES),
        'is_misclassified' => false,
        'otc_applicable' => true,
        'otc_drug_name' => json_encode([
            'selected' => ['Paracetamol'],
            'other' => null,
        ], JSON_UNESCAPED_SLASHES),
        'brand_examples' => json_encode(['Biogesic'], JSON_UNESCAPED_SLASHES),
        'age_restrictions' => null,
        'pregnancy_considerations' => 'NONE',
        'gender_specific_limitations' => 'null',
        'known_contraindications' => 'NONE',
        'red_flag_symptoms' => null,
        'requires_medical_referral' => false,
        'medical_notes' => json_encode(['otc_dosage_guide' => new stdClass], JSON_UNESCAPED_SLASHES),
    ]);

    $response = $this->actingAs($user)->post(route('annotations.store'), [
        'user_inquiry' => 'I have fever and headache',
        'user_age' => null,
        'language' => 'english',
        'confidence' => 'high',
        'min_age' => 12,
        'symptom_labels' => ['FEVER'],
        'suggested_otc' => ['Paracetamol'],
        'age_restriction_options' => ['yes'],
        'age_restrictions_details' => 'Adults only.',
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => 'null',
        'requires_medical_referral_options' => ['no'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Paracetamol' => [
                    'dosage_mg' => '500',
                    'times_per_day' => '3',
                    'max_doses_per_day' => '4',
                    'notes' => 'After meals',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertSessionHasErrors('user_inquiry');
    expect(AnnotationEntry::query()->count())->toBe(1);
});

test('UNKNOWN symptom label is accepted without symptom labels other', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('annotations.store'), [
        'user_inquiry' => 'Dili ko alam kung ano ang problema ko',
        'user_age' => null,
        'language' => 'bisaya',
        'confidence' => 'low',
        'min_age' => 0,
        'symptom_labels' => ['UNKNOWN'],
        'suggested_otc' => [],
        'brand_examples' => [],
        'age_restriction_options' => ['no'],
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => 'null',
        'requires_medical_referral_options' => ['yes'],
        'medical_notes' => json_encode(['otc_dosage_guide' => new stdClass], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertRedirect(route('annotations.index'));
    expect(AnnotationEntry::query()->count())->toBe(1);

    $entry = AnnotationEntry::query()->first();
    expect(json_decode($entry->validated_symptom_label, true))->toBe(['UNKNOWN']);
    expect($entry->requires_medical_referral)->toBeTrue();
});

test('suggested otc others requires custom value when selected', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('annotations.store'), [
        'user_inquiry' => 'Custom inquiry for otc other',
        'user_age' => null,
        'language' => 'english',
        'confidence' => 'high',
        'min_age' => 0,
        'symptom_labels' => ['HEADACHE'],
        'suggested_otc' => ['OTHER'],
        'age_restriction_options' => ['no'],
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => 'null',
        'requires_medical_referral_options' => ['no'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'OTHER' => [
                    'dosage_mg' => '500',
                    'times_per_day' => '3',
                    'max_doses_per_day' => '4',
                    'notes' => 'After meals',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertSessionHasErrors('suggested_otc_other');
});

test('annotators can update an existing annotation entry', function () {
    $user = User::factory()->create();

    $entry = AnnotationEntry::query()->create([
        'annotated_by' => $user->id,
        'symptom_name' => 'Old inquiry text',
        'user_age' => null,
        'language' => 'english',
        'confidence' => 'medium',
        'min_age' => 0,
        'assigned_symptom_label' => '',
        'validated_symptom_label' => json_encode(['HEADACHE'], JSON_UNESCAPED_SLASHES),
        'is_misclassified' => false,
        'otc_applicable' => true,
        'otc_drug_name' => json_encode([
            'selected' => ['Paracetamol'],
            'other' => null,
        ], JSON_UNESCAPED_SLASHES),
        'brand_examples' => json_encode([], JSON_UNESCAPED_SLASHES),
        'age_restrictions' => 'NONE',
        'pregnancy_considerations' => 'NONE',
        'gender_specific_limitations' => 'null',
        'known_contraindications' => 'NONE',
        'red_flag_symptoms' => null,
        'requires_medical_referral' => false,
        'medical_notes' => json_encode(['otc_dosage_guide' => new stdClass], JSON_UNESCAPED_SLASHES),
    ]);

    $response = $this->actingAs($user)->put(route('annotations.update', $entry), [
        'user_inquiry' => 'Updated inquiry text',
        'user_age' => 25,
        'language' => 'code-switched',
        'confidence' => 'high',
        'min_age' => 18,
        'symptom_labels' => ['FEVER', 'OTHER'],
        'symptom_labels_other' => 'CUSTOM_LABEL',
        'suggested_otc' => ['Ibuprofen'],
        'brand_examples' => ['Advil'],
        'age_restriction_options' => ['yes'],
        'age_restrictions_details' => 'Adults only',
        'pregnancy_considerations_options' => ['yes'],
        'pregnancy_considerations_details' => 'Not recommended in early pregnancy without doctor advice',
        'known_contraindications_options' => ['yes'],
        'known_contraindications_details' => 'Severe kidney disease',
        'gender_specific_limitations' => 'male_only',
        'requires_medical_referral_options' => ['yes'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Ibuprofen' => [
                    'dosage_mg' => '400',
                    'times_per_day' => '3',
                    'max_doses_per_day' => '3',
                    'notes' => 'After meals',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertRedirect(route('annotations.entries'));

    $entry->refresh();
    expect($entry->symptom_name)->toBe('Updated inquiry text');
    expect($entry->assigned_symptom_label)->toBe('CUSTOM_LABEL');
    expect($entry->language)->toBe('code-switched');
    expect($entry->confidence)->toBe('high');
    expect($entry->min_age)->toBe(18);
    expect($entry->user_age)->toBe(25);
    expect($entry->gender_specific_limitations)->toBe('male_only');
});

test('users can export annotation entries as json', function () {
    $user = User::factory()->create(['is_admin' => true]);

    AnnotationEntry::query()->create([
        'annotated_by' => $user->id,
        'symptom_name' => 'I have severe headache',
        'user_age' => 30,
        'language' => 'english',
        'confidence' => 'high',
        'min_age' => 12,
        'assigned_symptom_label' => '',
        'validated_symptom_label' => json_encode(['HEADACHE'], JSON_UNESCAPED_SLASHES),
        'is_misclassified' => false,
        'otc_applicable' => true,
        'otc_drug_name' => json_encode([
            'selected' => ['Ibuprofen'],
            'other' => null,
        ], JSON_UNESCAPED_SLASHES),
        'brand_examples' => json_encode(['Advil'], JSON_UNESCAPED_SLASHES),
        'age_restrictions' => 'Avoid in children under 12 years without clinician advice.',
        'pregnancy_considerations' => 'Avoid in the first trimester unless physician-approved.',
        'gender_specific_limitations' => 'null',
        'known_contraindications' => 'Do not combine with anticoagulants.',
        'red_flag_symptoms' => null,
        'requires_medical_referral' => true,
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Ibuprofen' => [
                    'dosage_mg' => '400',
                    'times_per_day' => '3',
                    'max_doses_per_day' => '3',
                    'notes' => 'Take with food.',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response = $this->actingAs($user)->get(route('annotations.export'));

    $response->assertStatus(200);
    $response->assertHeader('content-type', 'application/json');
    $response->assertHeader('content-disposition');

    $content = $response->streamedContent();
    $payload = json_decode($content, true);

    expect($content)->toContain('user_inquiry');
    expect($content)->toContain('I have severe headache');
    expect($content)->toContain('otc_dosage_guide');
    expect($content)->toContain('generated_at');
    expect($content)->toContain('total_entries');
    expect($content)->toContain('_schema_version');
    expect($content)->toContain('entry_id');
    expect($content)->toContain('max_doses_per_day');

    expect($payload)->toBeArray();
    expect($payload['_schema_version'])->toBe('1.0');
    expect($payload['total_entries'])->toBe(1);
    expect($payload['entries'])->toHaveCount(1);

    $entry = $payload['entries'][0];
    expect($entry['entry_id'])->toBe('de_001');
    expect($entry['user_inquiry'])->toBe('I have severe headache');
    expect($entry['user_age'])->toBe(30);
    expect($entry['language'])->toBe('english');
    expect($entry['confidence'])->toBe('high');
    expect($entry['min_age'])->toBe(12);
    expect($entry['symptom_labels'])->toBe(['HEADACHE']);
    expect($entry['symptom_labels_other'])->toBeNull();
    expect($entry['suggested_otc']['selected'])->toBe(['Ibuprofen']);
    expect($entry['suggested_otc']['brand_examples'])->toBe(['Advil']);
    expect($entry['suggested_otc']['other'])->toBeNull();
    expect($entry['has_age_restrictions'])->toBeTrue();
    expect($entry['has_known_contraindications'])->toBeTrue();
    expect($entry['known_contraindications_details'])->toBe('Do not combine with anticoagulants.');
    expect($entry['has_pregnancy_considerations'])->toBeTrue();
    expect($entry['pregnancy_considerations_details'])->toBe('Avoid in the first trimester unless physician-approved.');
    expect($entry['gender_specific_limitations'])->toBeNull();
    expect($entry['requires_medical_referral'])->toBeTrue();
    expect($entry['annotated_by'])->toBe($user->name);
    expect($entry['medical_notes']['otc_dosage_guide']['Ibuprofen']['dosage_mg'])->toBe(400);
    expect($entry['medical_notes']['otc_dosage_guide']['Ibuprofen']['times_per_day'])->toBe(3);
    expect($entry['medical_notes']['otc_dosage_guide']['Ibuprofen']['max_doses_per_day'])->toBe(3);
    expect($entry['medical_notes']['otc_dosage_guide']['Ibuprofen']['notes'])->toBe('Take with food.');
});

test('annotators can submit with empty otc when referral is required', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('annotations.store'), [
        'user_inquiry' => 'Grabe ang sakit ng dibdib ko, hirap huminga',
        'user_age' => null,
        'language' => 'code-switched',
        'confidence' => 'high',
        'min_age' => 0,
        'symptom_labels' => ['UNKNOWN'],
        'symptom_labels_other' => 'chest pain with difficulty breathing — possible cardiac emergency',
        'suggested_otc' => [],
        'brand_examples' => [],
        'age_restriction_options' => ['no'],
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => 'null',
        'requires_medical_referral_options' => ['yes'],
        'medical_notes' => json_encode(['otc_dosage_guide' => new stdClass], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertRedirect(route('annotations.index'));
    expect(AnnotationEntry::query()->count())->toBe(1);

    $entry = AnnotationEntry::query()->first();
    expect($entry->requires_medical_referral)->toBeTrue();
    expect($entry->otc_applicable)->toBeFalse();
    expect($entry->assigned_symptom_label)->toBe('chest pain with difficulty breathing — possible cardiac emergency');
});

test('non-admin users cannot export annotation entries as json', function () {
    $user = User::factory()->create(['is_admin' => false]);

    $response = $this->actingAs($user)->get(route('annotations.export'));

    $response->assertForbidden();
});
