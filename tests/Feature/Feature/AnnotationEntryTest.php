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
        'symptom_labels' => ['FEVER', 'HEADACHE'],
        'suggested_otc' => ['Paracetamol'],
        'age_restriction_options' => ['yes'],
        'age_restrictions_details' => 'Avoid in children under 3 months unless advised by a doctor.',
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => ['no'],
        'requires_medical_referral_options' => ['yes'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Paracetamol' => [
                    'dosage_mg' => '500',
                    'times_per_day' => '3',
                    'notes' => 'Take after meals.',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertRedirect(route('annotations.index'));

    expect(AnnotationEntry::query()->count())->toBe(1);
    expect(AnnotationEntry::query()->first()?->annotated_by)->toBe($user->id);
});

test('duplicate inquiry cannot be annotated twice', function () {
    $user = User::factory()->create();

    AnnotationEntry::query()->create([
        'annotated_by' => $user->id,
        'symptom_name' => 'I have fever and headache',
        'assigned_symptom_label' => '',
        'validated_symptom_label' => json_encode(['FEVER', 'HEADACHE'], JSON_UNESCAPED_SLASHES),
        'is_misclassified' => false,
        'otc_applicable' => true,
        'otc_drug_name' => json_encode([
            'selected' => ['Paracetamol'],
            'other' => null,
        ], JSON_UNESCAPED_SLASHES),
        'age_restrictions' => null,
        'pregnancy_considerations' => null,
        'gender_specific_limitations' => json_encode(['no'], JSON_UNESCAPED_SLASHES),
        'known_contraindications' => null,
        'red_flag_symptoms' => null,
        'requires_medical_referral' => false,
        'medical_notes' => json_encode(['otc_dosage_guide' => new stdClass], JSON_UNESCAPED_SLASHES),
    ]);

    $response = $this->actingAs($user)->post(route('annotations.store'), [
        'user_inquiry' => 'I have fever and headache',
        'symptom_labels' => ['FEVER'],
        'suggested_otc' => ['Paracetamol'],
        'age_restriction_options' => ['yes'],
        'age_restrictions_details' => 'Adults only.',
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => ['no'],
        'requires_medical_referral_options' => ['no'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Paracetamol' => [
                    'dosage_mg' => '500',
                    'times_per_day' => '3',
                    'notes' => 'After meals',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertSessionHasErrors('user_inquiry');
    expect(AnnotationEntry::query()->count())->toBe(1);
});

test('symptom others requires custom value when selected', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('annotations.store'), [
        'user_inquiry' => 'Custom inquiry for symptom other',
        'symptom_labels' => ['OTHER'],
        'suggested_otc' => ['Paracetamol'],
        'age_restriction_options' => ['yes'],
        'age_restrictions_details' => 'Adults only.',
        'pregnancy_considerations_options' => ['no'],
        'known_contraindications_options' => ['no'],
        'gender_specific_limitations' => ['no'],
        'requires_medical_referral_options' => ['no'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Paracetamol' => [
                    'dosage_mg' => '500',
                    'times_per_day' => '3',
                    'notes' => 'After meals',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertSessionHasErrors('symptom_labels_other');
});

test('annotators can update an existing annotation entry', function () {
    $user = User::factory()->create();

    $entry = AnnotationEntry::query()->create([
        'annotated_by' => $user->id,
        'symptom_name' => 'Old inquiry text',
        'assigned_symptom_label' => '',
        'validated_symptom_label' => json_encode(['HEADACHE'], JSON_UNESCAPED_SLASHES),
        'is_misclassified' => false,
        'otc_applicable' => true,
        'otc_drug_name' => json_encode([
            'selected' => ['Paracetamol'],
            'other' => null,
        ], JSON_UNESCAPED_SLASHES),
        'age_restrictions' => null,
        'pregnancy_considerations' => null,
        'gender_specific_limitations' => json_encode(['no'], JSON_UNESCAPED_SLASHES),
        'known_contraindications' => null,
        'red_flag_symptoms' => null,
        'requires_medical_referral' => false,
        'medical_notes' => json_encode(['otc_dosage_guide' => new stdClass], JSON_UNESCAPED_SLASHES),
    ]);

    $response = $this->actingAs($user)->put(route('annotations.update', $entry), [
        'user_inquiry' => 'Updated inquiry text',
        'symptom_labels' => ['FEVER', 'OTHER'],
        'symptom_labels_other' => 'CUSTOM_LABEL',
        'suggested_otc' => ['Ibuprofen'],
        'age_restriction_options' => ['yes'],
        'age_restrictions_details' => 'Adults only',
        'pregnancy_considerations_options' => ['yes'],
        'pregnancy_considerations_details' => 'Not recommended in early pregnancy without doctor advice',
        'known_contraindications_options' => ['yes'],
        'known_contraindications_details' => 'Severe kidney disease',
        'gender_specific_limitations' => ['male'],
        'requires_medical_referral_options' => ['yes'],
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Ibuprofen' => [
                    'dosage_mg' => '400',
                    'times_per_day' => '3',
                    'notes' => 'After meals',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES),
    ]);

    $response->assertRedirect(route('annotations.entries'));

    $entry->refresh();
    expect($entry->symptom_name)->toBe('Updated inquiry text');
    expect($entry->assigned_symptom_label)->toBe('CUSTOM_LABEL');
});

test('users can export annotation entries as json', function () {
    $user = User::factory()->create(['is_admin' => true]);
    AnnotationEntry::query()->create([
        'annotated_by' => $user->id,
        'symptom_name' => 'I have severe headache',
        'assigned_symptom_label' => '',
        'validated_symptom_label' => json_encode(['HEADACHE'], JSON_UNESCAPED_SLASHES),
        'is_misclassified' => false,
        'otc_applicable' => true,
        'otc_drug_name' => json_encode([
            'selected' => ['Ibuprofen'],
            'other' => null,
        ], JSON_UNESCAPED_SLASHES),
        'age_restrictions' => 'Avoid in children under 12 years without clinician advice.',
        'pregnancy_considerations' => 'Avoid in the first trimester unless physician-approved.',
        'gender_specific_limitations' => json_encode(['female'], JSON_UNESCAPED_SLASHES),
        'known_contraindications' => 'Do not combine with anticoagulants.',
        'red_flag_symptoms' => null,
        'requires_medical_referral' => true,
        'medical_notes' => json_encode([
            'otc_dosage_guide' => [
                'Ibuprofen' => [
                    'dosage_mg' => '400',
                    'times_per_day' => '3',
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

    expect($payload)->toBeArray();
    expect($payload['total_entries'])->toBe(1);
    expect($payload['entries'])->toHaveCount(1);
    expect($payload['entries'][0])->toMatchArray([
        'user_inquiry' => 'I have severe headache',
        'symptom_labels' => ['HEADACHE'],
        'symptom_labels_other' => null,
        'suggested_otc' => [
            'selected' => ['Ibuprofen'],
            'other' => null,
        ],
        'age_restrictions' => 'Avoid in children under 12 years without clinician advice.',
        'has_age_restrictions' => true,
        'has_known_contraindications' => true,
        'known_contraindications_details' => 'Do not combine with anticoagulants.',
        'has_pregnancy_considerations' => true,
        'pregnancy_considerations_details' => 'Avoid in the first trimester unless physician-approved.',
        'gender_specific_limitations' => ['female'],
        'requires_medical_referral' => true,
    ]);
});

test('non-admin users cannot export annotation entries as json', function () {
    $user = User::factory()->create(['is_admin' => false]);

    $response = $this->actingAs($user)->get(route('annotations.export'));

    $response->assertForbidden();
});
