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
        Schema::table('annotation_entries', function (Blueprint $table) {
            // VARCHAR(255) can overflow when many OTC drugs or symptom labels are selected as JSON
            $table->text('otc_drug_name')->nullable()->change();
            $table->text('validated_symptom_label')->change();
            $table->text('assigned_symptom_label')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('annotation_entries', function (Blueprint $table) {
            $table->string('otc_drug_name')->nullable()->change();
            $table->string('validated_symptom_label')->change();
            $table->string('assigned_symptom_label')->change();
        });
    }
};
