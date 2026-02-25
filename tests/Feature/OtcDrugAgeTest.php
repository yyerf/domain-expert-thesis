<?php

use App\Models\OtcDrugAge;
use App\Models\User;

test('guests cannot store otc drug ages', function () {
    $this->post(route('annotations.otc-drug-ages.store'), [
        'drug_name' => 'Paracetamol',
        'min_age' => 0,
        'max_age' => 150,
    ])->assertRedirect(route('login'));
});

test('authenticated users can store a new otc drug age', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('annotations.otc-drug-ages.store'), [
            'drug_name' => 'Paracetamol',
            'min_age' => 6,
            'max_age' => 65,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('otc_drug_ages', [
        'drug_name' => 'Paracetamol',
        'min_age' => 6,
        'max_age' => 65,
        'updated_by' => $user->id,
    ]);
});

test('storing an existing drug name updates the record', function () {
    $user = User::factory()->create();

    OtcDrugAge::query()->create([
        'drug_name' => 'Ibuprofen',
        'min_age' => 12,
        'max_age' => 65,
        'updated_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->post(route('annotations.otc-drug-ages.store'), [
            'drug_name' => 'Ibuprofen',
            'min_age' => 6,
            'max_age' => 70,
        ])
        ->assertRedirect();

    expect(OtcDrugAge::query()->where('drug_name', 'Ibuprofen')->count())->toBe(1);

    $this->assertDatabaseHas('otc_drug_ages', [
        'drug_name' => 'Ibuprofen',
        'min_age' => 6,
        'max_age' => 70,
    ]);
});

test('validation rejects missing drug_name', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('annotations.otc-drug-ages.store'), [
            'min_age' => 0,
            'max_age' => 150,
        ])
        ->assertSessionHasErrors('drug_name');
});

test('validation rejects min_age greater than 150', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('annotations.otc-drug-ages.store'), [
            'drug_name' => 'Paracetamol',
            'min_age' => 200,
            'max_age' => 150,
        ])
        ->assertSessionHasErrors('min_age');
});

test('annotation index page loads with otc drug ages', function () {
    $user = User::factory()->create();

    OtcDrugAge::query()->create([
        'drug_name' => 'Cetirizine HCl',
        'min_age' => 2,
        'max_age' => 99,
        'updated_by' => $user->id,
    ]);

    $this->actingAs($user)
        ->get(route('annotations.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('annotations/index')
            ->has('otcDrugAges.Cetirizine HCl')
        );
});
