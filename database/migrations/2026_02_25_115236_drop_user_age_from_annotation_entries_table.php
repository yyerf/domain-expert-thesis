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
            $table->dropColumn('user_age');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('annotation_entries', function (Blueprint $table) {
            $table->integer('user_age')->nullable()->after('medical_notes');
        });
    }
};
