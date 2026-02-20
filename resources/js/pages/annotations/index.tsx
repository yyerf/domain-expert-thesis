import { Form, Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

type AnnotationEntry = {
    id: number;
    user_inquiry: string;
    user_age: number | null;
    language: string | null;
    confidence: string | null;
    min_age: number;
    symptom_labels: string[];
    symptom_labels_other: string | null;
    suggested_otc: string[];
    suggested_otc_other: string | null;
    brand_examples: string[];
    age_restrictions: string | null;
    has_age_restrictions: boolean;
    has_known_contraindications: boolean;
    known_contraindications_details: string | null;
    has_pregnancy_considerations: boolean;
    pregnancy_considerations_details: string | null;
    gender_specific_limitations: string | null;
    requires_medical_referral: boolean;
    medical_notes: string | null;
    created_at: string | null;
    annotator: {
        id: number;
        name: string;
        email: string;
    };
};

type AnnotationInquiryStatus = {
    user_inquiry: string;
    annotated_by: {
        id: number;
        name: string;
        email: string;
    };
    annotated_at: string | null;
};

type OtcDetail = {
    dosage_mg: string;
    times_per_day: string;
    max_doses_per_day: string;
    notes: string;
};

type PopulationStats = {
    total_lines: number;
    unique_lines: number;
    pending_lines: number;
};

type FormState = {
    selectedSymptomLabels: string[];
    symptomLabelsOther: string;
    selectedOtc: string[];
    suggestedOtcOther: string;
    brandExamples: string[];
    genderLimitation: string;
    ageRestrictionOptions: string[];
    ageRestrictions: string;
    contraindicationOptions: string[];
    knownContraindicationsDetails: string;
    pregnancyOptions: string[];
    pregnancyConsiderationsDetails: string;
    requiresMedicalReferralOptions: string[];
    otcDetails: Record<string, OtcDetail>;
    userAge: string;
    language: string;
    confidence: string;
    minAge: string;
    inquiryInputMode: 'population' | 'manual';
    selectedPopulationInquiry: string;
    manualUserInquiry: string;
};

function buildFormState(
    entry: AnnotationEntry | null,
    pendingPopulationInquiries: string[],
    nextPopulationInquiry: string | null,
    populationInquiries: string[],
): FormState {
    if (entry) {
        const parsed = entry.medical_notes
            ? (JSON.parse(entry.medical_notes) as { otc_dosage_guide?: Record<string, OtcDetail> })
            : null;

        return {
            selectedSymptomLabels: entry.symptom_labels,
            symptomLabelsOther: entry.symptom_labels_other ?? '',
            selectedOtc: entry.suggested_otc,
            suggestedOtcOther: entry.suggested_otc_other ?? '',
            brandExamples: entry.brand_examples ?? [],
            genderLimitation: entry.gender_specific_limitations ?? 'null',
            ageRestrictionOptions: [entry.has_age_restrictions ? 'yes' : 'no'],
            ageRestrictions: entry.age_restrictions ?? '',
            contraindicationOptions: [entry.has_known_contraindications ? 'yes' : 'no'],
            knownContraindicationsDetails: entry.known_contraindications_details ?? '',
            pregnancyOptions: [entry.has_pregnancy_considerations ? 'yes' : 'no'],
            pregnancyConsiderationsDetails: entry.pregnancy_considerations_details ?? '',
            requiresMedicalReferralOptions: [entry.requires_medical_referral ? 'yes' : 'no'],
            otcDetails: parsed?.otc_dosage_guide ?? {},
            userAge: entry.user_age !== null ? String(entry.user_age) : '',
            language: entry.language ?? '',
            confidence: entry.confidence ?? '',
            minAge: String(entry.min_age ?? 0),
            inquiryInputMode: 'manual',
            selectedPopulationInquiry: nextPopulationInquiry ?? pendingPopulationInquiries[0] ?? populationInquiries[0] ?? '',
            manualUserInquiry: entry.user_inquiry,
        };
    }

    return {
        selectedSymptomLabels: [],
        symptomLabelsOther: '',
        selectedOtc: [],
        suggestedOtcOther: '',
        brandExamples: [],
        genderLimitation: 'null',
        ageRestrictionOptions: [],
        ageRestrictions: '',
        contraindicationOptions: [],
        knownContraindicationsDetails: '',
        pregnancyOptions: [],
        pregnancyConsiderationsDetails: '',
        requiresMedicalReferralOptions: [],
        otcDetails: {},
        userAge: '',
        language: '',
        confidence: '',
        minAge: '0',
        inquiryInputMode: pendingPopulationInquiries.length > 0 ? 'population' : 'manual',
        selectedPopulationInquiry: nextPopulationInquiry ?? pendingPopulationInquiries[0] ?? populationInquiries[0] ?? '',
        manualUserInquiry: '',
    };
}

// RULE 1 symptom labels — exactly from prompt.md
const symptomLabels = [
    'ALLERGIC_RHINITIS',
    'BODY_ACHES',
    'COUGH_DRY',
    'COUGH_GENERAL',
    'COUGH_PRODUCTIVE',
    'DIARRHEA',
    'DIZZINESS',
    'FEVER',
    'HEADACHE',
    'NASAL_CONGESTION',
    'NAUSEA',
    'RASHES',
    'RUNNY_NOSE',
    'SORE_THROAT',
    'STOMACH_ACHE_ACID',
    'UNKNOWN',
] as const;

// RULE 2 OTC drugs — generic names exactly as in prompt.md
const otcOptions = [
    'Paracetamol',
    'Paracetamol (pediatric)',
    'Ibuprofen',
    'Acetylsalicylic acid',
    'Paracetamol + Phenylephrine + Chlorphenamine (Bioflu)',
    'Paracetamol + Phenylephrine + Chlorphenamine (\u00b1 Zinc) (Neozep/Neozep Z+)',
    'Paracetamol + Phenylephrine + Chlorphenamine (Neozep pediatric)',
    'Paracetamol + Phenylephrine + Chlorphenamine (Decolgen)',
    'Paracetamol + Decongestant + Antihistamine (Symdex-D Syrup)',
    'Paracetamol + Decongestant + Antihistamine (Symdex-D Forte)',
    'Paracetamol + Phenylephrine (Sinutab)',
    'Dextromethorphan + Paracetamol + Phenylephrine + Chlorphenamine (Tuseran Forte)',
    'Butamirate citrate',
    'Lagundi leaf extract',
    'Carbocisteine',
    'Guaifenesin',
    'Cetirizine HCl',
    'Loratadine',
    'Diphenhydramine HCl',
    'Loperamide HCl',
    'Bacillus clausii',
    'Aluminum hydroxide + Magnesium hydroxide + Simethicone',
] as const;

const genderOptions = [
    { value: 'null', label: 'None (no restriction)' },
    { value: 'not_for_pregnant', label: 'Not for pregnant' },
    { value: 'female_only', label: 'Female only' },
    { value: 'male_only', label: 'Male only' },
] as const;

const languageOptions = [
    { value: 'english', label: 'English only' },
    { value: 'tagalog', label: 'Tagalog / Filipino only' },
    { value: 'bisaya', label: 'Bisaya / Cebuano only' },
    { value: 'code-switched', label: 'Mixed languages (Taglish, Bisaya + English, or any combo)' },
] as const;

const confidenceOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
] as const;

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Annotation Guide',
        href: '/annotations',
    },
];

export default function AnnotationGuide({
    entries,
    editingEntry,
    populationInquiries,
    pendingPopulationInquiries,
    nextPopulationInquiry,
    annotationStatusByInquiry,
    currentAnnotatorId,
    isAdmin,
    populationStats,
}: {
    entries: AnnotationEntry[];
    editingEntry: AnnotationEntry | null;
    populationInquiries: string[];
    pendingPopulationInquiries: string[];
    nextPopulationInquiry: string | null;
    annotationStatusByInquiry: AnnotationInquiryStatus[];
    currentAnnotatorId: number | null;
    isAdmin: boolean;
    populationStats: PopulationStats;
}) {
    const page = usePage<{ errors: Record<string, string> }>();
    const hasValidationErrors = Object.keys(page.props.errors ?? {}).length > 0;

    const [formState, setFormState] = useState<FormState>(() =>
        buildFormState(editingEntry, pendingPopulationInquiries, nextPopulationInquiry, populationInquiries),
    );

    const {
        selectedSymptomLabels,
        symptomLabelsOther,
        selectedOtc,
        suggestedOtcOther,
        brandExamples,
        genderLimitation,
        ageRestrictionOptions,
        ageRestrictions,
        contraindicationOptions,
        knownContraindicationsDetails,
        pregnancyOptions,
        pregnancyConsiderationsDetails,
        requiresMedicalReferralOptions,
        otcDetails,
        userAge,
        language,
        confidence,
        minAge,
        inquiryInputMode,
        selectedPopulationInquiry,
        manualUserInquiry,
    } = formState;

    const setInquiryInputMode = (mode: 'population' | 'manual'): void =>
        setFormState((prev) => ({ ...prev, inquiryInputMode: mode }));
    const setSelectedPopulationInquiry = (value: string): void =>
        setFormState((prev) => ({ ...prev, selectedPopulationInquiry: value }));
    const setManualUserInquiry = (value: string): void =>
        setFormState((prev) => ({ ...prev, manualUserInquiry: value }));
    const setSymptomLabelsOther = (value: string): void =>
        setFormState((prev) => ({ ...prev, symptomLabelsOther: value }));
    const setSuggestedOtcOther = (value: string): void =>
        setFormState((prev) => ({ ...prev, suggestedOtcOther: value }));
    const setAgeRestrictions = (value: string): void =>
        setFormState((prev) => ({ ...prev, ageRestrictions: value }));
    const setKnownContraindicationsDetails = (value: string): void =>
        setFormState((prev) => ({ ...prev, knownContraindicationsDetails: value }));
    const setPregnancyConsiderationsDetails = (value: string): void =>
        setFormState((prev) => ({ ...prev, pregnancyConsiderationsDetails: value }));
    const setUserAge = (value: string): void =>
        setFormState((prev) => ({ ...prev, userAge: value }));
    const setLanguage = (value: string): void =>
        setFormState((prev) => ({ ...prev, language: value }));
    const setConfidence = (value: string): void =>
        setFormState((prev) => ({ ...prev, confidence: value }));
    const setMinAge = (value: string): void =>
        setFormState((prev) => ({ ...prev, minAge: value }));
    const setGenderLimitation = (value: string): void =>
        setFormState((prev) => ({ ...prev, genderLimitation: value }));

    const updateBrandExample = (index: number, value: string): void => {
        setFormState((prev) => {
            const next = [...prev.brandExamples];
            next[index] = value;
            return { ...prev, brandExamples: next };
        });
    };

    const addBrandExample = (): void =>
        setFormState((prev) => ({ ...prev, brandExamples: [...prev.brandExamples, ''] }));

    const removeBrandExample = (index: number): void =>
        setFormState((prev) => ({
            ...prev,
            brandExamples: prev.brandExamples.filter((_, i) => i !== index),
        }));

    const resolvedUserInquiry = useMemo(() => {
        return inquiryInputMode === 'manual' ? manualUserInquiry : selectedPopulationInquiry;
    }, [inquiryInputMode, manualUserInquiry, selectedPopulationInquiry]);

    const annotationStatusLookup = useMemo(() => {
        const lookup: Record<string, AnnotationInquiryStatus> = {};
        annotationStatusByInquiry.forEach((status) => {
            lookup[status.user_inquiry.trim().toLowerCase()] = status;
        });
        return lookup;
    }, [annotationStatusByInquiry]);

    const activeInquiryStatus = useMemo(() => {
        return annotationStatusLookup[resolvedUserInquiry.trim().toLowerCase()] ?? null;
    }, [annotationStatusLookup, resolvedUserInquiry]);

    const isEditingMode = editingEntry !== null;
    const isDuplicateInquiry = activeInquiryStatus !== null && (!isEditingMode || activeInquiryStatus.user_inquiry !== editingEntry.user_inquiry);

    const isAnnotatedByCurrentUser = activeInquiryStatus?.annotated_by.id === currentAnnotatorId;

    const isPopulationInquiryAnnotated = (inquiry: string): boolean => {
        return annotationStatusLookup[inquiry.trim().toLowerCase()] !== undefined;
    };

    const getPopulationInquiryLabel = (inquiry: string): string => {
        const status = annotationStatusLookup[inquiry.trim().toLowerCase()];
        if (!status) {
            return `[ ] ${inquiry}`;
        }
        if (status.annotated_by.id === currentAnnotatorId) {
            return `[✓ You] ${inquiry}`;
        }
        return `[✓ ${status.annotated_by.name}] ${inquiry}`;
    };

    const selectedOtcForNotes = useMemo(() => {
        return selectedOtc.map((otc) => (otc === 'OTHER' ? suggestedOtcOther.trim() || 'OTHER' : otc));
    }, [selectedOtc, suggestedOtcOther]);

    const medicalNotesJson = useMemo(() => {
        const notes: Record<string, OtcDetail> = {};
        selectedOtcForNotes.forEach((otc) => {
            notes[otc] = otcDetails[otc] ?? {
                dosage_mg: '',
                times_per_day: '',
                max_doses_per_day: '',
                notes: '',
            };
        });
        return JSON.stringify({ otc_dosage_guide: notes });
    }, [otcDetails, selectedOtcForNotes]);

    const handleOtcSelection = (otc: string, checked: boolean): void => {
        setFormState((prev) => ({
            ...prev,
            selectedOtc: checked
                ? prev.selectedOtc.includes(otc) ? prev.selectedOtc : [...prev.selectedOtc, otc]
                : prev.selectedOtc.filter((item) => item !== otc),
        }));
    };

    const handleSymptomSelection = (symptom: string, checked: boolean): void => {
        setFormState((prev) => ({
            ...prev,
            selectedSymptomLabels: checked
                ? prev.selectedSymptomLabels.includes(symptom) ? prev.selectedSymptomLabels : [...prev.selectedSymptomLabels, symptom]
                : prev.selectedSymptomLabels.filter((item) => item !== symptom),
        }));
    };

    const handleContraindicationSelection = (option: 'yes' | 'no', checked: boolean): void => {
        setFormState((prev) => ({ ...prev, contraindicationOptions: checked ? [option] : [] }));
    };

    const handleAgeRestrictionSelection = (option: 'yes' | 'no', checked: boolean): void => {
        setFormState((prev) => ({ ...prev, ageRestrictionOptions: checked ? [option] : [] }));
    };

    const handleReferralSelection = (option: 'yes' | 'no', checked: boolean): void => {
        setFormState((prev) => ({ ...prev, requiresMedicalReferralOptions: checked ? [option] : [] }));
    };

    const handlePregnancySelection = (option: 'yes' | 'no', checked: boolean): void => {
        setFormState((prev) => ({ ...prev, pregnancyOptions: checked ? [option] : [] }));
    };

    const updateOtcDetail = (otc: string, field: keyof OtcDetail, value: string): void => {
        setFormState((prev) => ({
            ...prev,
            otcDetails: {
                ...prev.otcDetails,
                [otc]: {
                    dosage_mg: prev.otcDetails[otc]?.dosage_mg ?? '',
                    times_per_day: prev.otcDetails[otc]?.times_per_day ?? '',
                    max_doses_per_day: prev.otcDetails[otc]?.max_doses_per_day ?? '',
                    notes: prev.otcDetails[otc]?.notes ?? '',
                    [field]: value,
                },
            },
        }));
    };

    useEffect(() => {
        if (editingEntry) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: single atomic form population from server-provided editingEntry; no cascade risk as formState is not in deps
            setFormState(buildFormState(editingEntry, pendingPopulationInquiries, nextPopulationInquiry, populationInquiries));
            return;
        }

        if (hasValidationErrors) {
            return;
        }

        setFormState(buildFormState(null, pendingPopulationInquiries, nextPopulationInquiry, populationInquiries));
    }, [editingEntry, entries.length, hasValidationErrors, nextPopulationInquiry, pendingPopulationInquiries, populationInquiries]);

    const formAction = editingEntry ? `/annotations/${editingEntry.id}` : '/annotations';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Annotation Guide" />

            <div className="space-y-8 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Heading
                        title="Domain Expert Annotation Guide"
                        description="Validate symptom labels and attach safety-first OTC guidance."
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <a href="/annotations/entries">Entries Dashboard</a>
                        </Button>
                        {isAdmin && (
                            <Button asChild variant="outline">
                                <a href="/annotations/export" target="_blank" rel="noreferrer">
                                    Live JSON Export
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border p-3 text-sm text-muted-foreground">
                    Population stats: {populationStats.total_lines} lines in file, {populationStats.unique_lines} unique inquiries,
                    {` `}{populationStats.pending_lines} pending.
                </div>

                <Form action={formAction} method="post" className="space-y-6 rounded-xl border p-6">
                    {({ errors, processing }) => (
                        <>
                            {editingEntry && <input type="hidden" name="_method" value="put" />}
                            <input type="hidden" name="medical_notes" value={medicalNotesJson} />
                            <input type="hidden" name="user_inquiry" value={resolvedUserInquiry} />

                            <div className="grid gap-4 md:grid-cols-2">
                                {/* ── Inquiry Source ── */}
                                <div className="space-y-3 md:col-span-2">
                                    <Label>Inquiry Source</Label>
                                    <div className="space-y-3 rounded-md border p-3">
                                        <label className="flex items-start gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="inquiry_input_mode"
                                                value="population"
                                                checked={inquiryInputMode === 'population'}
                                                onChange={() => setInquiryInputMode('population')}
                                                className="mt-0.5 size-4"
                                            />
                                            <span>
                                                Use populated inquiry list (default): {pendingPopulationInquiries.length} pending /{' '}
                                                {populationInquiries.length} total.
                                            </span>
                                        </label>

                                        <label className="flex items-start gap-2 text-sm">
                                            <input
                                                type="radio"
                                                name="inquiry_input_mode"
                                                value="manual"
                                                checked={inquiryInputMode === 'manual'}
                                                onChange={() => setInquiryInputMode('manual')}
                                                className="mt-0.5 size-4"
                                            />
                                            <span>Manual inquiry input</span>
                                        </label>

                                        {inquiryInputMode === 'population' && populationInquiries.length > 0 && (
                                            <div className="space-y-2">
                                                <Label htmlFor="population_user_inquiry">Select inquiry from populated list</Label>
                                                <select
                                                    id="population_user_inquiry"
                                                    value={selectedPopulationInquiry}
                                                    onChange={(event) => setSelectedPopulationInquiry(event.target.value)}
                                                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                                >
                                                    {populationInquiries.map((inquiry) => (
                                                        <option key={inquiry} value={inquiry} disabled={isPopulationInquiryAnnotated(inquiry)}>
                                                            {getPopulationInquiryLabel(inquiry)}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-muted-foreground">
                                                    Already annotated inquiries are shown as checked and disabled.
                                                </p>
                                            </div>
                                        )}

                                        {inquiryInputMode === 'manual' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="manual_user_inquiry">Type manual inquiry</Label>
                                                <Input
                                                    id="manual_user_inquiry"
                                                    value={manualUserInquiry}
                                                    onChange={(event) => setManualUserInquiry(event.target.value)}
                                                    placeholder="Enter inquiry manually"
                                                />
                                            </div>
                                        )}

                                        {populationInquiries.length === 0 && (
                                            <p className="text-sm text-amber-700">
                                                No inquiry population found. Add lines to userInquiry.txt to start queue-based annotation.
                                            </p>
                                        )}
                                    </div>
                                    <InputError message={errors.user_inquiry} />

                                    {activeInquiryStatus && (
                                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                            Already annotated by {activeInquiryStatus.annotated_by.name} ({activeInquiryStatus.annotated_by.email}).
                                            {isAnnotatedByCurrentUser ? ' You already answered this inquiry.' : ' Duplicate submission is blocked.'}
                                        </div>
                                    )}
                                </div>

                                {/* ── Meta: user age + language ── */}
                                <div className="space-y-2">
                                    <Label htmlFor="user_age">Patient Age (if stated in inquiry)</Label>
                                    <Input
                                        id="user_age"
                                        name="user_age"
                                        type="number"
                                        min={0}
                                        max={150}
                                        value={userAge}
                                        onChange={(e) => setUserAge(e.target.value)}
                                        placeholder="e.g. 14 — leave blank if not mentioned"
                                    />
                                    <InputError message={errors.user_age} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="language">Inquiry Language</Label>
                                    <select
                                        id="language"
                                        name="language"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                    >
                                        <option value="">— select language —</option>
                                        {languageOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.language} />
                                </div>

                                {/* ── Confidence + Min Age ── */}
                                <div className="space-y-2">
                                    <Label htmlFor="confidence">Annotation Confidence</Label>
                                    <select
                                        id="confidence"
                                        name="confidence"
                                        value={confidence}
                                        onChange={(e) => setConfidence(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                    >
                                        <option value="">— select confidence —</option>
                                        {confidenceOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.confidence} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="min_age">
                                        Min Age for Most Restrictive Drug (years, 0 = no restriction)
                                    </Label>
                                    <Input
                                        id="min_age"
                                        name="min_age"
                                        type="number"
                                        min={0}
                                        max={150}
                                        value={minAge}
                                        onChange={(e) => setMinAge(e.target.value)}
                                        placeholder="e.g. 12"
                                    />
                                    <InputError message={errors.min_age} />
                                </div>

                                {/* ── Symptom Labels ── */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Symptom Labels (Checklist)</Label>
                                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 md:grid-cols-3">
                                        {symptomLabels.map((label) => (
                                            <label
                                                key={label}
                                                className={cn(
                                                    'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                    selectedSymptomLabels.includes(label)
                                                        ? 'border-green-500 bg-green-100 text-green-900'
                                                        : 'border-transparent',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="symptom_labels[]"
                                                    value={label}
                                                    className="size-4"
                                                    checked={selectedSymptomLabels.includes(label)}
                                                    onChange={(event) => handleSymptomSelection(label, event.target.checked)}
                                                />
                                                <span>{label}</span>
                                            </label>
                                        ))}
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                selectedSymptomLabels.includes('OTHER')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="symptom_labels[]"
                                                value="OTHER"
                                                className="size-4"
                                                checked={selectedSymptomLabels.includes('OTHER')}
                                                onChange={(event) => handleSymptomSelection('OTHER', event.target.checked)}
                                            />
                                            <span className="font-semibold">Others</span>
                                        </label>
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="symptom_labels_other">Describe symptom in your own words (optional — only if the symptom is not in the list above)</Label>
                                        <Input
                                            id="symptom_labels_other"
                                            name="symptom_labels_other"
                                            value={symptomLabelsOther}
                                            onChange={(event) => setSymptomLabelsOther(event.target.value)}
                                            placeholder="e.g. eye redness, ear pain, swollen gums..."
                                        />
                                        <InputError message={errors.symptom_labels_other} />
                                    </div>
                                    <InputError message={errors.symptom_labels} />
                                </div>

                                {/* ── Suggested OTC ── */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Suggested OTC (Checklist — Generic Names)</Label>
                                    <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                                        {otcOptions.map((otc) => (
                                            <label
                                                key={otc}
                                                className={cn(
                                                    'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                    selectedOtc.includes(otc)
                                                        ? 'border-green-500 bg-green-100 text-green-900'
                                                        : 'border-transparent',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="suggested_otc[]"
                                                    value={otc}
                                                    className="size-4"
                                                    checked={selectedOtc.includes(otc)}
                                                    onChange={(event) => handleOtcSelection(otc, event.target.checked)}
                                                />
                                                <span className="leading-snug">{otc}</span>
                                            </label>
                                        ))}
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                selectedOtc.includes('OTHER')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="suggested_otc[]"
                                                value="OTHER"
                                                className="size-4"
                                                checked={selectedOtc.includes('OTHER')}
                                                onChange={(event) => handleOtcSelection('OTHER', event.target.checked)}
                                            />
                                            <span className="font-semibold">Others</span>
                                        </label>
                                        {selectedOtc.includes('OTHER') && (
                                            <div className="md:col-span-2">
                                                <Label htmlFor="suggested_otc_other">If Others, specify</Label>
                                                <Input
                                                    id="suggested_otc_other"
                                                    name="suggested_otc_other"
                                                    value={suggestedOtcOther}
                                                    onChange={(event) => setSuggestedOtcOther(event.target.value)}
                                                    placeholder="Enter OTC name"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <InputError message={errors.suggested_otc} />
                                    <InputError message={errors.suggested_otc_other} />
                                </div>

                                {/* ── Brand Examples ── */}
                                {selectedOtcForNotes.length > 0 && (
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Brand Examples (from vending machine)</Label>
                                        <div className="space-y-2 rounded-md border p-3">
                                            {brandExamples.map((brand, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <Input
                                                        name="brand_examples[]"
                                                        value={brand}
                                                        onChange={(e) => updateBrandExample(i, e.target.value)}
                                                        placeholder="e.g. Biogesic, Tempra"
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => removeBrandExample(i)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button type="button" variant="outline" size="sm" onClick={addBrandExample}>
                                                + Add brand example
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* ── Medical Notes (dosage guide per OTC) ── */}
                                {selectedOtcForNotes.length > 0 && (
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Medical Notes (dosage guide per selected OTC)</Label>
                                        <div className="space-y-3 rounded-md border p-3">
                                            {selectedOtcForNotes.map((otc) => (
                                                <div key={otc} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
                                                    <div className="space-y-1 md:col-span-4">
                                                        <p className="text-sm font-medium">{otc}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`dosage-${otc}`}>Dosage (mg)</Label>
                                                        <Input
                                                            id={`dosage-${otc}`}
                                                            value={otcDetails[otc]?.dosage_mg ?? ''}
                                                            onChange={(event) => updateOtcDetail(otc, 'dosage_mg', event.target.value)}
                                                            placeholder="e.g. 500"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`times-${otc}`}>Times/day</Label>
                                                        <Input
                                                            id={`times-${otc}`}
                                                            value={otcDetails[otc]?.times_per_day ?? ''}
                                                            onChange={(event) => updateOtcDetail(otc, 'times_per_day', event.target.value)}
                                                            placeholder="e.g. 3"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`maxdoses-${otc}`}>Max doses/day</Label>
                                                        <Input
                                                            id={`maxdoses-${otc}`}
                                                            value={otcDetails[otc]?.max_doses_per_day ?? ''}
                                                            onChange={(event) => updateOtcDetail(otc, 'max_doses_per_day', event.target.value)}
                                                            placeholder="e.g. 4"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`notes-${otc}`}>Notes</Label>
                                                        <Input
                                                            id={`notes-${otc}`}
                                                            value={otcDetails[otc]?.notes ?? ''}
                                                            onChange={(event) => updateOtcDetail(otc, 'notes', event.target.value)}
                                                            placeholder="e.g. Take after meals"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <InputError message={errors.medical_notes} />
                                    </div>
                                )}

                                {/* ── Age Restriction ── */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Age Restriction</Label>
                                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                ageRestrictionOptions.includes('yes')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="age_restriction_options[]"
                                                value="yes"
                                                className="size-4"
                                                checked={ageRestrictionOptions.includes('yes')}
                                                onChange={(event) => handleAgeRestrictionSelection('yes', event.target.checked)}
                                            />
                                            <span>Yes</span>
                                        </label>
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                ageRestrictionOptions.includes('no')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="age_restriction_options[]"
                                                value="no"
                                                className="size-4"
                                                checked={ageRestrictionOptions.includes('no')}
                                                onChange={(event) => handleAgeRestrictionSelection('no', event.target.checked)}
                                            />
                                            <span>No</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.age_restriction_options} />

                                    {ageRestrictionOptions.includes('yes') && (
                                        <div className="space-y-2">
                                            <Label htmlFor="age_restrictions_details">If yes, specify age restriction</Label>
                                            <Input
                                                id="age_restrictions_details"
                                                name="age_restrictions_details"
                                                required
                                                value={ageRestrictions}
                                                onChange={(event) => setAgeRestrictions(event.target.value)}
                                                placeholder="e.g. Not for children below 12 years old"
                                            />
                                            <InputError message={errors.age_restrictions_details} />
                                        </div>
                                    )}
                                </div>

                                {/* ── Contraindications ── */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Possible Drug Contraindication</Label>
                                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                contraindicationOptions.includes('yes')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="known_contraindications_options[]"
                                                value="yes"
                                                className="size-4"
                                                checked={contraindicationOptions.includes('yes')}
                                                onChange={(event) => handleContraindicationSelection('yes', event.target.checked)}
                                            />
                                            <span>Yes</span>
                                        </label>
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                contraindicationOptions.includes('no')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="known_contraindications_options[]"
                                                value="no"
                                                className="size-4"
                                                checked={contraindicationOptions.includes('no')}
                                                onChange={(event) => handleContraindicationSelection('no', event.target.checked)}
                                            />
                                            <span>No</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.known_contraindications_options} />

                                    {contraindicationOptions.includes('yes') && (
                                        <div className="space-y-2">
                                            <Label htmlFor="known_contraindications_details">If yes, specify contradictions</Label>
                                            <Input
                                                id="known_contraindications_details"
                                                name="known_contraindications_details"
                                                required
                                                value={knownContraindicationsDetails}
                                                onChange={(event) => setKnownContraindicationsDetails(event.target.value)}
                                                placeholder="e.g. Ibuprofen contraindicated in peptic ulcer disease"
                                            />
                                            <InputError message={errors.known_contraindications_details} />
                                        </div>
                                    )}
                                </div>

                                {/* ── Pregnancy Considerations ── */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Pregnancy Considerations</Label>
                                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                pregnancyOptions.includes('yes')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="pregnancy_considerations_options[]"
                                                value="yes"
                                                className="size-4"
                                                checked={pregnancyOptions.includes('yes')}
                                                onChange={(event) => handlePregnancySelection('yes', event.target.checked)}
                                            />
                                            <span>Yes</span>
                                        </label>
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                pregnancyOptions.includes('no')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="pregnancy_considerations_options[]"
                                                value="no"
                                                className="size-4"
                                                checked={pregnancyOptions.includes('no')}
                                                onChange={(event) => handlePregnancySelection('no', event.target.checked)}
                                            />
                                            <span>No</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.pregnancy_considerations_options} />

                                    {pregnancyOptions.includes('yes') && (
                                        <div className="space-y-2">
                                            <Label htmlFor="pregnancy_considerations_details">If yes, specify pregnancy considerations</Label>
                                            <Input
                                                id="pregnancy_considerations_details"
                                                name="pregnancy_considerations_details"
                                                required
                                                value={pregnancyConsiderationsDetails}
                                                onChange={(event) => setPregnancyConsiderationsDetails(event.target.value)}
                                                placeholder="e.g. Avoid in first trimester unless advised by a doctor"
                                            />
                                            <InputError message={errors.pregnancy_considerations_details} />
                                        </div>
                                    )}
                                </div>

                                {/* ── Requires Medical Referral ── */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Requires Medical Referral</Label>
                                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                requiresMedicalReferralOptions.includes('yes')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="requires_medical_referral_options[]"
                                                value="yes"
                                                className="size-4"
                                                checked={requiresMedicalReferralOptions.includes('yes')}
                                                onChange={(event) => handleReferralSelection('yes', event.target.checked)}
                                            />
                                            <span>Yes</span>
                                        </label>
                                        <label
                                            className={cn(
                                                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                requiresMedicalReferralOptions.includes('no')
                                                    ? 'border-green-500 bg-green-100 text-green-900'
                                                    : 'border-transparent',
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                name="requires_medical_referral_options[]"
                                                value="no"
                                                className="size-4"
                                                checked={requiresMedicalReferralOptions.includes('no')}
                                                onChange={(event) => handleReferralSelection('no', event.target.checked)}
                                            />
                                            <span>No</span>
                                        </label>
                                    </div>
                                    <InputError message={errors.requires_medical_referral_options} />
                                </div>

                                {/* ── Gender-specific Limitation ── */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="gender_specific_limitations">Gender-specific Limitation</Label>
                                    <select
                                        id="gender_specific_limitations"
                                        name="gender_specific_limitations"
                                        value={genderLimitation}
                                        onChange={(e) => setGenderLimitation(e.target.value)}
                                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                    >
                                        <option value="">— select —</option>
                                        {genderOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <InputError message={errors.gender_specific_limitations} />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" disabled={processing || isDuplicateInquiry || resolvedUserInquiry.trim() === ''}>
                                    {editingEntry ? 'Update annotation' : 'Save annotation and load next'}
                                </Button>
                                {editingEntry && (
                                    <Button asChild type="button" variant="outline">
                                        <a href="/annotations">Cancel edit</a>
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </AppLayout>
    );
}
