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
            $table->unsignedInteger('user_age')->nullable()->after('symptom_name');
            $table->string('language')->nullable()->after('user_age');
            $table->string('confidence')->nullable()->after('language');
            $table->unsignedInteger('min_age')->default(0)->after('confidence');
            $table->text('brand_examples')->nullable()->after('otc_drug_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('annotation_entries', function (Blueprint $table) {
            $table->dropColumn(['user_age', 'language', 'confidence', 'min_age', 'brand_examples']);
        });
    }
};
