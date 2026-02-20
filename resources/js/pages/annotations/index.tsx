import { Form, Head, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

type AnnotationEntry = {
    id: number;
    user_inquiry: string;
    symptom_labels: string[];
    symptom_labels_other: string | null;
    suggested_otc: string[];
    suggested_otc_other: string | null;
    age_restrictions: string | null;
    has_age_restrictions: boolean;
    has_known_contraindications: boolean;
    known_contraindications_details: string | null;
    has_pregnancy_considerations: boolean;
    pregnancy_considerations_details: string | null;
    gender_specific_limitations: string[];
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
    notes: string;
};

type PopulationStats = {
    total_lines: number;
    unique_lines: number;
    pending_lines: number;
};

const symptomLabels = [
    'ALLERGIC_RHINITIS',
    'BODY_ACHES',
    'CHEST_PAIN',
    'COUGH_DRY',
    'COUGH_GENERAL',
    'COUGH_PRODUCTIVE',
    'DIARRHEA',
    'DIZZINESS',
    'FATIGUE',
    'FEVER',
    'HEADACHE',
    'NAUSEA',
    'NASAL_CONGESTION',
    'RASHES',
    'RUNNY_NOSE',
    'SHORTNESS_OF_BREATH',
    'SORE_THROAT',
    'STOMACH_ACHE',
    'VOMITING',
] as const;

const otcOptions = [
    'Ascorbic Acid (Vitamin C)',
    'Aspirin',
    'Bismuth Subsalicylate',
    'Cetirizine',
    'Chlorpheniramine',
    'Dextromethorphan',
    'Diphenhydramine',
    'Guaifenesin',
    'Ibuprofen',
    'Loperamide',
    'Loratadine',
    'Paracetamol',
    'Phenylephrine',
] as const;

const genderOptions = [
    { value: 'no', label: 'No' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
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

    const [selectedSymptomLabels, setSelectedSymptomLabels] = useState<string[]>([]);
    const [symptomLabelsOther, setSymptomLabelsOther] = useState('');
    const [selectedOtc, setSelectedOtc] = useState<string[]>([]);
    const [suggestedOtcOther, setSuggestedOtcOther] = useState('');
    const [selectedGender, setSelectedGender] = useState<string[]>([]);
    const [ageRestrictionOptions, setAgeRestrictionOptions] = useState<string[]>([]);
    const [ageRestrictions, setAgeRestrictions] = useState('');
    const [contraindicationOptions, setContraindicationOptions] = useState<string[]>([]);
    const [knownContraindicationsDetails, setKnownContraindicationsDetails] = useState('');
    const [pregnancyOptions, setPregnancyOptions] = useState<string[]>([]);
    const [pregnancyConsiderationsDetails, setPregnancyConsiderationsDetails] = useState('');
    const [requiresMedicalReferralOptions, setRequiresMedicalReferralOptions] = useState<string[]>([]);
    const [otcDetails, setOtcDetails] = useState<Record<string, OtcDetail>>({});
    const [inquiryInputMode, setInquiryInputMode] = useState<'population' | 'manual'>(
        pendingPopulationInquiries.length > 0 ? 'population' : 'manual',
    );
    const [selectedPopulationInquiry, setSelectedPopulationInquiry] = useState(
        nextPopulationInquiry ?? pendingPopulationInquiries[0] ?? populationInquiries[0] ?? '',
    );
    const [manualUserInquiry, setManualUserInquiry] = useState('');

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
                notes: '',
            };
        });

        return JSON.stringify({ otc_dosage_guide: notes });
    }, [otcDetails, selectedOtcForNotes]);

    const handleOtcSelection = (otc: string, checked: boolean): void => {
        setSelectedOtc((previous) => {
            if (checked) {
                return previous.includes(otc) ? previous : [...previous, otc];
            }

            return previous.filter((item) => item !== otc);
        });
    };

    const handleSymptomSelection = (symptom: string, checked: boolean): void => {
        setSelectedSymptomLabels((previous) => {
            if (checked) {
                return previous.includes(symptom) ? previous : [...previous, symptom];
            }

            return previous.filter((item) => item !== symptom);
        });
    };

    const handleGenderSelection = (gender: string, checked: boolean): void => {
        setSelectedGender((previous) => {
            if (checked) {
                return previous.includes(gender) ? previous : [...previous, gender];
            }

            return previous.filter((item) => item !== gender);
        });
    };

    const handleContraindicationSelection = (option: 'yes' | 'no', checked: boolean): void => {
        if (!checked) {
            setContraindicationOptions([]);

            return;
        }

        setContraindicationOptions([option]);
    };

    const handleAgeRestrictionSelection = (option: 'yes' | 'no', checked: boolean): void => {
        if (!checked) {
            setAgeRestrictionOptions([]);

            return;
        }

        setAgeRestrictionOptions([option]);
    };

    const handleReferralSelection = (option: 'yes' | 'no', checked: boolean): void => {
        if (!checked) {
            setRequiresMedicalReferralOptions([]);

            return;
        }

        setRequiresMedicalReferralOptions([option]);
    };

    const handlePregnancySelection = (option: 'yes' | 'no', checked: boolean): void => {
        if (!checked) {
            setPregnancyOptions([]);

            return;
        }

        setPregnancyOptions([option]);
    };

    const updateOtcDetail = (otc: string, field: keyof OtcDetail, value: string): void => {
        setOtcDetails((previous) => ({
            ...previous,
            [otc]: {
                dosage_mg: previous[otc]?.dosage_mg ?? '',
                times_per_day: previous[otc]?.times_per_day ?? '',
                notes: previous[otc]?.notes ?? '',
                [field]: value,
            },
        }));
    };

    useEffect(() => {
        if (editingEntry) {
            setInquiryInputMode('manual');
            setManualUserInquiry(editingEntry.user_inquiry);
            setSelectedSymptomLabels(editingEntry.symptom_labels);
            setSymptomLabelsOther(editingEntry.symptom_labels_other ?? '');
            setSelectedOtc(editingEntry.suggested_otc);
            setSuggestedOtcOther(editingEntry.suggested_otc_other ?? '');
            setSelectedGender(editingEntry.gender_specific_limitations);
            setAgeRestrictionOptions([editingEntry.has_age_restrictions ? 'yes' : 'no']);
            setAgeRestrictions(editingEntry.age_restrictions ?? '');
            setContraindicationOptions([editingEntry.has_known_contraindications ? 'yes' : 'no']);
            setKnownContraindicationsDetails(editingEntry.known_contraindications_details ?? '');
            setPregnancyOptions([editingEntry.has_pregnancy_considerations ? 'yes' : 'no']);
            setPregnancyConsiderationsDetails(editingEntry.pregnancy_considerations_details ?? '');
            setRequiresMedicalReferralOptions([editingEntry.requires_medical_referral ? 'yes' : 'no']);

            const notes = editingEntry.medical_notes ? JSON.parse(editingEntry.medical_notes) : null;
            setOtcDetails(notes?.otc_dosage_guide ?? {});

            return;
        }

        if (hasValidationErrors) {
            return;
        }

        setSelectedSymptomLabels([]);
        setSymptomLabelsOther('');
        setSelectedOtc([]);
        setSuggestedOtcOther('');
        setSelectedGender([]);
        setAgeRestrictionOptions([]);
        setAgeRestrictions('');
        setContraindicationOptions([]);
        setKnownContraindicationsDetails('');
        setPregnancyOptions([]);
        setPregnancyConsiderationsDetails('');
        setRequiresMedicalReferralOptions([]);
        setOtcDetails({});
        setManualUserInquiry('');
        setInquiryInputMode(pendingPopulationInquiries.length > 0 ? 'population' : 'manual');
        setSelectedPopulationInquiry(nextPopulationInquiry ?? pendingPopulationInquiries[0] ?? populationInquiries[0] ?? '');
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
                                                        <option
                                                            key={inquiry}
                                                            value={inquiry}
                                                            disabled={isPopulationInquiryAnnotated(inquiry)}
                                                        >
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
                                            Already annotated by {activeInquiryStatus.annotated_by.name} (
                                            {activeInquiryStatus.annotated_by.email}).
                                            {isAnnotatedByCurrentUser ? ' You already answered this inquiry.' : ' Duplicate submission is blocked.'}
                                        </div>
                                    )}
                                </div>

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
                                        {selectedSymptomLabels.includes('OTHER') && (
                                            <div className="md:col-span-3">
                                                <Label htmlFor="symptom_labels_other">If Others, specify</Label>
                                                <Input
                                                    id="symptom_labels_other"
                                                    name="symptom_labels_other"
                                                    value={symptomLabelsOther}
                                                    onChange={(event) => setSymptomLabelsOther(event.target.value)}
                                                    placeholder="Enter symptom label"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <InputError message={errors.symptom_labels} />
                                    <InputError message={errors.symptom_labels_other} />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label>Suggested OTC (Checklist)</Label>
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
                                                <span>{otc}</span>
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

                                {selectedOtcForNotes.length > 0 && (
                                    <div className="space-y-2 md:col-span-2">
                                        <Label>Medical Notes (JSON-ready per selected OTC)</Label>
                                        <div className="space-y-3 rounded-md border p-3">
                                            {selectedOtcForNotes.map((otc) => (
                                                <div key={otc} className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`dosage-${otc}`}>{otc} dosage (mg)</Label>
                                                        <Input
                                                            id={`dosage-${otc}`}
                                                            value={otcDetails[otc]?.dosage_mg ?? ''}
                                                            onChange={(event) => updateOtcDetail(otc, 'dosage_mg', event.target.value)}
                                                            placeholder="e.g. 500"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`times-${otc}`}>Times per day</Label>
                                                        <Input
                                                            id={`times-${otc}`}
                                                            value={otcDetails[otc]?.times_per_day ?? ''}
                                                            onChange={(event) => updateOtcDetail(otc, 'times_per_day', event.target.value)}
                                                            placeholder="e.g. 3"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`notes-${otc}`}>Notes</Label>
                                                        <Input
                                                            id={`notes-${otc}`}
                                                            value={otcDetails[otc]?.notes ?? ''}
                                                            onChange={(event) => updateOtcDetail(otc, 'notes', event.target.value)}
                                                            placeholder="e.g. after meals"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <InputError message={errors.medical_notes} />
                                    </div>
                                )}

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
                                                placeholder="e.g. Not for children below 12 years old, Not for elderly above 65 years old"
                                            />
                                            <InputError message={errors.age_restrictions_details} />
                                        </div>
                                    )}
                                </div>

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
                                                placeholder="e.g. Isotretinoin in pregnancy, Decongestants in hypertension"
                                            />
                                            <InputError message={errors.known_contraindications_details} />
                                        </div>
                                    )}
                                </div>

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

                                <div className="space-y-2 md:col-span-2">
                                    <Label>Gender-specific limitation (Checklist)</Label>
                                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
                                        {genderOptions.map((option) => (
                                            <label
                                                key={option.value}
                                                className={cn(
                                                    'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                                    selectedGender.includes(option.value)
                                                        ? 'border-green-500 bg-green-100 text-green-900'
                                                        : 'border-transparent',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="gender_specific_limitations[]"
                                                    value={option.value}
                                                    className="size-4"
                                                    checked={selectedGender.includes(option.value)}
                                                    onChange={(event) => handleGenderSelection(option.value, event.target.checked)}
                                                />
                                                <span>{option.label}</span>
                                            </label>
                                        ))}
                                    </div>
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
