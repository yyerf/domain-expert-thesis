<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::query()->updateOrCreate([
            'email' => 'domain@expert.com',
        ], [
            'name' => 'Domain Expert',
            'password' => 'domainExpertS3cretP@ss!',
            'email_verified_at' => now(),
            'is_admin' => false,
        ]);

        User::query()->updateOrCreate([
            'email' => 'admin@expert.com',
        ], [
            'name' => 'Admin Expert',
            'password' => 'AdminP@ss0033!',
            'email_verified_at' => now(),
            'is_admin' => true,
        ]);
    }
}
