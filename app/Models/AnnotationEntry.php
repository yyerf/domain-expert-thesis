<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnnotationEntry extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'annotated_by',
        'symptom_name',
        'user_age',
        'language',
        'confidence',
        'min_age',
        'assigned_symptom_label',
        'validated_symptom_label',
        'is_misclassified',
        'otc_applicable',
        'otc_drug_name',
        'brand_examples',
        'age_restrictions',
        'pregnancy_considerations',
        'gender_specific_limitations',
        'known_contraindications',
        'red_flag_symptoms',
        'requires_medical_referral',
        'medical_notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_age' => 'integer',
            'min_age' => 'integer',
            'is_misclassified' => 'boolean',
            'otc_applicable' => 'boolean',
            'requires_medical_referral' => 'boolean',
        ];
    }

    /**
     * Get the annotator of the entry.
     */
    public function annotator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'annotated_by');
    }
}
