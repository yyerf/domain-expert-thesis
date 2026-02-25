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
        Schema::table('annotation_entries', function (Blueprint $table): void {
            $table->dropColumn('red_flag_symptoms');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('annotation_entries', function (Blueprint $table): void {
            $table->text('red_flag_symptoms')->nullable()->after('known_contraindications');
        });
    }
};
