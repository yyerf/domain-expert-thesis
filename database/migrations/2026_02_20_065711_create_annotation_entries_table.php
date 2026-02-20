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
        Schema::create('annotation_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('annotated_by')->constrained('users')->cascadeOnDelete();
            $table->string('symptom_name');
            $table->string('assigned_symptom_label');
            $table->string('validated_symptom_label');
            $table->boolean('is_misclassified')->default(false);
            $table->boolean('otc_applicable')->default(false);
            $table->string('otc_drug_name')->nullable();
            $table->text('age_restrictions')->nullable();
            $table->text('pregnancy_considerations')->nullable();
            $table->text('gender_specific_limitations')->nullable();
            $table->text('known_contraindications')->nullable();
            $table->text('red_flag_symptoms')->nullable();
            $table->boolean('requires_medical_referral')->default(false);
            $table->text('medical_notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('annotation_entries');
    }
};
