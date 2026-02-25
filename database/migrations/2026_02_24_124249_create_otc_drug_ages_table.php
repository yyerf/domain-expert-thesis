<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('otc_drug_ages', function (Blueprint $table) {
            $table->id();
            $table->string('drug_name')->unique();
            $table->unsignedInteger('min_age')->default(0);
            $table->unsignedInteger('max_age')->default(150);
            $table->foreignId('updated_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('otc_drug_ages');
    }
};
