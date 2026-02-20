<?php

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Hash;

test('only admins can view create account page', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $standardUser = User::factory()->create(['is_admin' => false]);

    $this->actingAs($admin)
        ->get(route('admin.users.create'))
        ->assertOk();

    $this->actingAs($standardUser)
        ->get(route('admin.users.create'))
        ->assertForbidden();
});

test('admins can create non admin accounts with a custom password', function () {
    $admin = User::factory()->create(['is_admin' => true]);

    $response = $this->actingAs($admin)->post(route('admin.users.store'), [
        'name' => 'Domain Expert Two',
        'email' => 'domain2@expert.com',
        'password' => 'domainExpert2S3cret!',
        'password_confirmation' => 'domainExpert2S3cret!',
    ]);

    $response->assertRedirect(route('admin.users.create'));

    $createdUser = User::query()->where('email', 'domain2@expert.com')->first();

    expect($createdUser)->not->toBeNull();
    expect($createdUser?->is_admin)->toBeFalse();
    expect(Hash::check('domainExpert2S3cret!', $createdUser?->password ?? ''))->toBeTrue();
});

test('database seeder provisions required default accounts', function () {
    $this->seed(DatabaseSeeder::class);

    $domainUser = User::query()->where('email', 'domain@expert.com')->first();
    $adminUser = User::query()->where('email', 'admin@expert.com')->first();

    expect($domainUser)->not->toBeNull();
    expect($adminUser)->not->toBeNull();
    expect($domainUser?->is_admin)->toBeFalse();
    expect($adminUser?->is_admin)->toBeTrue();
    expect(Hash::check('domainExpertS3cretP@ss!', $domainUser?->password ?? ''))->toBeTrue();
    expect(Hash::check('AdminP@33!', $adminUser?->password ?? ''))->toBeTrue();
});
