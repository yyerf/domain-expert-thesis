import { Form, Head, router, usePage } from '@inertiajs/react';
import { Check, ChevronLeft, ChevronRight, Pill, ShieldCheck, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type AnnotationEntry = {
    id: number;
    user_inquiry: string;
    language: string | null;
    confidence: string | null;
    min_age: number;
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
    gender_specific_limitations: string | null;
    requires_medical_referral: boolean;
    medical_notes: string | null;
    created_at: string | null;
    annotator: { id: number; name: string; email: string };
};

type AnnotationInquiryStatus = {
    user_inquiry: string;
    annotated_by: { id: number; name: string; email: string };
    annotated_at: string | null;
};

type OtcDetail = {
    dosage_mg: string;
    times_per_day: string;
    max_doses_per_day: string;
    notes: string;
    min_age?: string;
    max_age?: string;
};

type DrugAgeRecord = {
    drug_name: string;
    min_age: number;
    max_age: number;
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
    genderLimitation: string;
    ageRestrictionOptions: string[];
    ageRestrictions: string;
    contraindicationOptions: string[];
    knownContraindicationsDetails: string;
    pregnancyOptions: string[];
    pregnancyConsiderationsDetails: string;
    requiresMedicalReferralOptions: string[];
    otcDetails: Record<string, OtcDetail>;
    language: string;
    confidence: string;
    inquiryInputMode: 'population' | 'manual';
    selectedPopulationInquiry: string;
    manualUserInquiry: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function RequiredDot() {
    return <span className="text-destructive">*</span>;
}

const selectClass =
    'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/50';

// ─── Form State Builder ───────────────────────────────────────────────────────

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
            genderLimitation: entry.gender_specific_limitations ?? 'null',
            ageRestrictionOptions: [entry.has_age_restrictions ? 'yes' : 'no'],
            ageRestrictions: entry.age_restrictions ?? '',
            contraindicationOptions: [entry.has_known_contraindications ? 'yes' : 'no'],
            knownContraindicationsDetails: entry.known_contraindications_details ?? '',
            pregnancyOptions: [entry.has_pregnancy_considerations ? 'yes' : 'no'],
            pregnancyConsiderationsDetails: entry.pregnancy_considerations_details ?? '',
            requiresMedicalReferralOptions: [entry.requires_medical_referral ? 'yes' : 'no'],
            otcDetails: parsed?.otc_dosage_guide
                ? Object.fromEntries(
                      Object.entries(parsed.otc_dosage_guide).map(([drug, d]) => {
                          const raw = d as OtcDetail & { min_age?: number | null; max_age?: number | null };
                          return [
                              drug,
                              {
                                  dosage_mg: raw.dosage_mg ?? '',
                                  times_per_day: raw.times_per_day ?? '',
                                  max_doses_per_day: raw.max_doses_per_day ?? '',
                                  notes: raw.notes ?? '',
                                  min_age: raw.min_age != null ? String(raw.min_age) : undefined,
                                  max_age: raw.max_age != null ? String(raw.max_age) : undefined,
                              } satisfies OtcDetail,
                          ];
                      }),
                  )
                : {},
            language: entry.language ?? '',
            confidence: entry.confidence ?? '',
            inquiryInputMode: 'manual',
            selectedPopulationInquiry:
                nextPopulationInquiry ?? pendingPopulationInquiries[0] ?? populationInquiries[0] ?? '',
            manualUserInquiry: entry.user_inquiry,
        };
    }

    return {
        selectedSymptomLabels: [],
        symptomLabelsOther: '',
        selectedOtc: [],
        suggestedOtcOther: '',
        genderLimitation: 'null',
        ageRestrictionOptions: [],
        ageRestrictions: '',
        contraindicationOptions: [],
        knownContraindicationsDetails: '',
        pregnancyOptions: [],
        pregnancyConsiderationsDetails: '',
        requiresMedicalReferralOptions: [],
        otcDetails: {},
        language: '',
        confidence: '',
        inquiryInputMode: pendingPopulationInquiries.length > 0 ? 'population' : 'manual',
        selectedPopulationInquiry:
            nextPopulationInquiry ?? pendingPopulationInquiries[0] ?? populationInquiries[0] ?? '',
        manualUserInquiry: '',
    };
}

// ─── Constant Data ────────────────────────────────────────────────────────────

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

const otcOptions = [
    'Paracetamol',
    'Paracetamol (pediatric)',
    'Ibuprofen',
    'Acetylsalicylic acid',
    'Paracetamol + Phenylephrine + Chlorphenamine (Bioflu)',
    'Paracetamol + Phenylephrine + Chlorphenamine (± Zinc) (Neozep/Neozep Z+)',
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
    { value: 'female_only', label: 'Female only' },
    { value: 'male_only', label: 'Male only' },
] as const;

const languageOptions = [
    { value: 'english', label: 'English only' },
    { value: 'tagalog', label: 'Tagalog / Filipino only' },
    { value: 'bisaya', label: 'Bisaya / Cebuano only' },
    { value: 'code-switched', label: 'Mixed (Taglish, Bisaya + English, etc.)' },
] as const;

const confidenceOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
] as const;

const DRAFT_KEY = 'annotation-form-draft';
const breadcrumbs: BreadcrumbItem[] = [{ title: 'Annotation Guide', href: '/annotations' }];

const STEPS = [
    { id: 'inquiry', label: 'Inquiry', icon: Stethoscope },
    { id: 'symptoms_otc', label: 'Symptoms & OTC', icon: Pill },
    { id: 'safety', label: 'Safety', icon: ShieldCheck },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function YesNoToggle({
    name,
    value,
    onChange,
    yesColor = 'amber',
}: {
    name: string;
    value: string[];
    onChange: (option: 'yes' | 'no', checked: boolean) => void;
    yesColor?: 'amber' | 'red';
}) {
    return (
        <div className="flex gap-2">
            {(['yes', 'no'] as const).map((option) => {
                const selected = value.includes(option);
                return (
                    <label
                        key={option}
                        className={cn(
                            'relative flex flex-1 cursor-pointer select-none items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all sm:flex-none sm:px-5 sm:py-2',
                            selected &&
                                option === 'yes' &&
                                yesColor === 'amber' &&
                                'border-amber-300 bg-amber-50 text-amber-800',
                            selected &&
                                option === 'yes' &&
                                yesColor === 'red' &&
                                'border-red-300 bg-red-50 text-red-800',
                            selected &&
                                option === 'no' &&
                                'border-emerald-300 bg-emerald-50 text-emerald-800',
                            !selected &&
                                'border-input bg-background text-muted-foreground hover:bg-muted/60',
                        )}
                    >
                        <input
                            type="checkbox"
                            name={`${name}[]`}
                            value={option}
                            checked={selected}
                            onChange={(e) => onChange(option, e.target.checked)}
                            className="sr-only"
                        />
                        {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {option === 'yes' ? 'Yes' : 'No'}
                    </label>
                );
            })}
        </div>
    );
}

function DrugAgePromptDialog({
    drugsNeedingAges,
    otcDrugAges,
    onAllComplete,
    onSkip,
    open,
    isPageLoad,
    isAdmin,
}: {
    drugsNeedingAges: string[];
    otcDrugAges: Record<string, DrugAgeRecord>;
    onAllComplete: (ages: Record<string, { min_age: number; max_age: number }>) => void;
    onSkip: () => void;
    open: boolean;
    isPageLoad: boolean;
    isAdmin: boolean;
}) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [collectedAges, setCollectedAges] = useState<
        Record<string, { min_age: string; max_age: string }>
    >({});
    const [error, setError] = useState('');

    const currentDrug = drugsNeedingAges[currentIndex] ?? '';
    const currentMinAge = collectedAges[currentDrug]?.min_age ?? '';
    const currentMaxAge = collectedAges[currentDrug]?.max_age ?? '';
    const total = drugsNeedingAges.length;

    useEffect(() => {
        if (open) {
            setCurrentIndex(0);
            setCollectedAges({});
            setError('');
        }
    }, [open]);

    const handleNext = useCallback(() => {
        const minVal = parseInt(currentMinAge, 10);
        const maxVal = parseInt(currentMaxAge, 10);

        if (isNaN(minVal) || isNaN(maxVal)) {
            setError('Please enter both minimum and maximum age.');
            return;
        }
        if (minVal < 0 || maxVal < 0) {
            setError('Ages cannot be negative.');
            return;
        }
        if (minVal > maxVal) {
            setError('Minimum age cannot be greater than maximum age.');
            return;
        }

        setError('');

        router.post(
            '/annotations/otc-drug-ages',
            { drug_name: currentDrug, min_age: minVal, max_age: maxVal },
            { preserveState: true, preserveScroll: true },
        );

        if (currentIndex < total - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else {
            const result: Record<string, { min_age: number; max_age: number }> = {};
            const allAges = {
                ...collectedAges,
                [currentDrug]: { min_age: currentMinAge, max_age: currentMaxAge },
            };
            for (const [drug, ages] of Object.entries(allAges)) {
                result[drug] = {
                    min_age: parseInt(ages.min_age, 10),
                    max_age: parseInt(ages.max_age, 10),
                };
            }
            onAllComplete(result);
        }
    }, [
        currentMinAge,
        currentMaxAge,
        currentDrug,
        currentIndex,
        total,
        collectedAges,
        onAllComplete,
    ]);

    const setAge = (field: 'min_age' | 'max_age', value: string) => {
        setCollectedAges((prev) => ({
            ...prev,
            [currentDrug]: {
                min_age: prev[currentDrug]?.min_age ?? '',
                max_age: prev[currentDrug]?.max_age ?? '',
                [field]: value,
            },
        }));
        setError('');
    };

    if (!open || total === 0) return null;

    return (
        <Dialog open={open}>
            <DialogContent
                className="sm:max-w-md"
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pill className="h-5 w-5 text-primary" />
                        {isPageLoad
                            ? 'OTC Drug Age Setup'
                            : 'Set Age Range for OTC Drug'}
                    </DialogTitle>
                    <DialogDescription>
                        {isPageLoad
                            ? `Set the ideal min/max age for every OTC drug before annotating. Drug ${currentIndex + 1} of ${total}.`
                            : `Drug ${currentIndex + 1} of ${total} — Set the age range for all selected drugs.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-center gap-1.5 py-1">
                    {drugsNeedingAges.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                'h-2 rounded-full transition-all',
                                i === currentIndex
                                    ? 'w-6 bg-primary'
                                    : i < currentIndex
                                      ? 'w-2 bg-primary/60'
                                      : 'w-2 bg-muted',
                            )}
                        />
                    ))}
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4">
                        <p className="break-words text-sm font-semibold">
                            {currentDrug}
                        </p>
                        {otcDrugAges[currentDrug] && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                Previously: {otcDrugAges[currentDrug].min_age}–
                                {otcDrugAges[currentDrug].max_age} years
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="prompt_min_age">Min age (years)</Label>
                            <Input
                                id="prompt_min_age"
                                type="number"
                                min={0}
                                max={150}
                                value={currentMinAge}
                                onChange={(e) => setAge('min_age', e.target.value)}
                                placeholder="0"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="prompt_max_age">Max age (years)</Label>
                            <Input
                                id="prompt_max_age"
                                type="number"
                                min={0}
                                max={150}
                                value={currentMaxAge}
                                onChange={(e) => setAge('max_age', e.target.value)}
                                placeholder="65"
                            />
                        </div>
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            onClick={onSkip}
                            className="w-full sm:w-auto"
                        >
                            Skip for now
                        </Button>
                    )}
                    <Button onClick={handleNext} className="w-full sm:w-auto">
                        {currentIndex < total - 1 ? (
                            <>
                                Next drug{' '}
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </>
                        ) : (
                            <>
                                Confirm all{' '}
                                <Check className="ml-1 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
    otcDrugAges: initialOtcDrugAges,
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
    otcDrugAges: Record<string, DrugAgeRecord>;
}) {
    const page = usePage<{ errors: Record<string, string> }>();
    const pageErrors = page.props.errors ?? {};
    const hasValidationErrors = Object.keys(pageErrors).length > 0;

    // Error keys grouped by step for auto-navigation
    const STEP_ERROR_KEYS: string[][] = [
        ['user_inquiry', 'language', 'confidence'],
        [
            'symptom_labels',
            'symptom_labels_other',
            'suggested_otc',
            'suggested_otc_other',
            'medical_notes',
        ],
        [
            'age_restriction_options',
            'age_restrictions_details',
            'known_contraindications_options',
            'known_contraindications_details',
            'pregnancy_considerations_options',
            'pregnancy_considerations_details',
            'requires_medical_referral_options',
            'gender_specific_limitations',
            'min_age',
        ],
    ];

    // Auto-navigate to the first step that has a validation error
    useEffect(() => {
        if (!hasValidationErrors) return;
        const errorKeys = Object.keys(pageErrors);
        for (let step = 0; step < STEP_ERROR_KEYS.length; step++) {
            if (
                errorKeys.some((key) => STEP_ERROR_KEYS[step].includes(key))
            ) {
                setCurrentStep(step);
                return;
            }
        }
    }, [hasValidationErrors, pageErrors]);

    // ── State ──

    const [currentStep, setCurrentStep] = useState<number>(() => {
        if (!editingEntry) {
            try {
                const cached = localStorage.getItem(DRAFT_KEY);
                if (cached) {
                    return (
                        (JSON.parse(cached) as { step?: number }).step ?? 0
                    );
                }
            } catch {
                /* ignore */
            }
        }
        return 0;
    });

    const [otcDrugAges, setOtcDrugAges] =
        useState<Record<string, DrugAgeRecord>>(initialOtcDrugAges);

    const [promptSource, setPromptSource] = useState<'load' | 'step'>('load');

    const [showAgePrompt, setShowAgePrompt] = useState(() =>
        (otcOptions as readonly string[]).some(
            (otc) => !initialOtcDrugAges[otc],
        ),
    );

    const allMissingDrugs = useMemo(
        () =>
            (otcOptions as readonly string[]).filter(
                (otc) => !otcDrugAges[otc],
            ),
        [otcDrugAges],
    );

    const [formState, setFormState] = useState<FormState>(() => {
        if (!editingEntry) {
            try {
                const cached = localStorage.getItem(DRAFT_KEY);
                if (cached) {
                    const parsed = (
                        JSON.parse(cached) as { formState?: FormState }
                    ).formState;
                    if (parsed) return parsed;
                }
            } catch {
                /* ignore */
            }
        }
        return buildFormState(
            editingEntry,
            pendingPopulationInquiries,
            nextPopulationInquiry,
            populationInquiries,
        );
    });

    const {
        selectedSymptomLabels,
        symptomLabelsOther,
        selectedOtc,
        suggestedOtcOther,
        genderLimitation,
        ageRestrictionOptions,
        ageRestrictions,
        contraindicationOptions,
        knownContraindicationsDetails,
        pregnancyOptions,
        pregnancyConsiderationsDetails,
        requiresMedicalReferralOptions,
        otcDetails,
        language,
        confidence,
        inquiryInputMode,
        selectedPopulationInquiry,
        manualUserInquiry,
    } = formState;

    // ── Setters ──

    const set = <K extends keyof FormState>(
        key: K,
        value: FormState[K],
    ): void => setFormState((prev) => ({ ...prev, [key]: value }));

    const updateOtcDetail = (
        otc: string,
        field: keyof OtcDetail,
        value: string,
    ): void =>
        setFormState((prev) => ({
            ...prev,
            otcDetails: {
                ...prev.otcDetails,
                [otc]: {
                    dosage_mg: prev.otcDetails[otc]?.dosage_mg ?? '',
                    times_per_day: prev.otcDetails[otc]?.times_per_day ?? '',
                    max_doses_per_day:
                        prev.otcDetails[otc]?.max_doses_per_day ?? '',
                    notes: prev.otcDetails[otc]?.notes ?? '',
                    min_age: prev.otcDetails[otc]?.min_age,
                    max_age: prev.otcDetails[otc]?.max_age,
                    [field]: value,
                },
            },
        }));

    const handleSymptomSelection = (
        symptom: string,
        checked: boolean,
    ): void =>
        setFormState((prev) => ({
            ...prev,
            selectedSymptomLabels: checked
                ? prev.selectedSymptomLabels.includes(symptom)
                    ? prev.selectedSymptomLabels
                    : [...prev.selectedSymptomLabels, symptom]
                : prev.selectedSymptomLabels.filter((s) => s !== symptom),
        }));

    const handleOtcSelection = (otc: string, checked: boolean): void =>
        setFormState((prev) => ({
            ...prev,
            selectedOtc: checked
                ? prev.selectedOtc.includes(otc)
                    ? prev.selectedOtc
                    : [...prev.selectedOtc, otc]
                : prev.selectedOtc.filter((item) => item !== otc),
        }));

    const toggleYesNo =
        (key: keyof FormState) =>
        (option: 'yes' | 'no', checked: boolean): void =>
            setFormState((prev) => ({
                ...prev,
                [key]: checked ? [option] : [],
            }));

    // ── Derived ──

    const resolvedUserInquiry = useMemo(
        () =>
            inquiryInputMode === 'manual'
                ? manualUserInquiry
                : selectedPopulationInquiry,
        [inquiryInputMode, manualUserInquiry, selectedPopulationInquiry],
    );

    const annotationStatusLookup = useMemo(() => {
        const lookup: Record<string, AnnotationInquiryStatus> = {};
        annotationStatusByInquiry.forEach((s) => {
            lookup[s.user_inquiry.trim().toLowerCase()] = s;
        });
        return lookup;
    }, [annotationStatusByInquiry]);

    const activeInquiryStatus = useMemo(
        () =>
            annotationStatusLookup[
                resolvedUserInquiry.trim().toLowerCase()
            ] ?? null,
        [annotationStatusLookup, resolvedUserInquiry],
    );

    const isEditingMode = editingEntry !== null;
    const isDuplicateInquiry =
        activeInquiryStatus !== null &&
        (!isEditingMode ||
            activeInquiryStatus.user_inquiry !== editingEntry.user_inquiry);
    const isAnnotatedByCurrentUser =
        activeInquiryStatus?.annotated_by.id === currentAnnotatorId;

    const isPopulationInquiryAnnotated = (inquiry: string): boolean =>
        annotationStatusLookup[inquiry.trim().toLowerCase()] !== undefined;

    const getPopulationInquiryLabel = (inquiry: string): string => {
        const status =
            annotationStatusLookup[inquiry.trim().toLowerCase()];
        if (!status) return `[ ] ${inquiry}`;
        if (status.annotated_by.id === currentAnnotatorId)
            return `[✓ You] ${inquiry}`;
        return `[✓ ${status.annotated_by.name}] ${inquiry}`;
    };

    const selectedOtcForNotes = useMemo(
        () =>
            selectedOtc.map((otc) =>
                otc === 'OTHER'
                    ? suggestedOtcOther.trim() || 'OTHER'
                    : otc,
            ),
        [selectedOtc, suggestedOtcOther],
    );

    const medicalNotesJson = useMemo(() => {
        const notes: Record<
            string,
            {
                dosage_mg: string;
                times_per_day: string;
                max_doses_per_day: string;
                notes: string;
                min_age: number | null;
                max_age: number | null;
            }
        > = {};
        selectedOtcForNotes.forEach((otc) => {
            const detail = otcDetails[otc];
            const dbAge = otcDrugAges[otc];
            const parsedMin =
                detail?.min_age !== undefined && detail.min_age !== ''
                    ? parseInt(detail.min_age, 10)
                    : null;
            const parsedMax =
                detail?.max_age !== undefined && detail.max_age !== ''
                    ? parseInt(detail.max_age, 10)
                    : null;
            notes[otc] = {
                dosage_mg: detail?.dosage_mg ?? '',
                times_per_day: detail?.times_per_day ?? '',
                max_doses_per_day: detail?.max_doses_per_day ?? '',
                notes: detail?.notes ?? '',
                min_age:
                    parsedMin !== null && !isNaN(parsedMin)
                        ? parsedMin
                        : (dbAge?.min_age ?? null),
                max_age:
                    parsedMax !== null && !isNaN(parsedMax)
                        ? parsedMax
                        : (dbAge?.max_age ?? null),
            };
        });
        return JSON.stringify({ otc_dosage_guide: notes });
    }, [otcDetails, selectedOtcForNotes, otcDrugAges]);

    const computedMinAge = useMemo(() => {
        const ages = selectedOtcForNotes
            .map((otc) => otcDrugAges[otc]?.min_age ?? 0)
            .filter((age) => age > 0);
        return ages.length > 0 ? Math.max(...ages) : 0;
    }, [selectedOtcForNotes, otcDrugAges]);

    const selectedDrugsNeedingAges = useMemo(
        () =>
            selectedOtcForNotes.filter(
                (otc) => otc !== 'OTHER' && !otcDrugAges[otc],
            ),
        [selectedOtcForNotes, otcDrugAges],
    );

    const dialogDrugs =
        promptSource === 'load' ? allMissingDrugs : selectedDrugsNeedingAges;

    // ── Effects ──

    useEffect(() => {
        if (editingEntry) {
            setFormState(
                buildFormState(
                    editingEntry,
                    pendingPopulationInquiries,
                    nextPopulationInquiry,
                    populationInquiries,
                ),
            );
            return;
        }
        if (hasValidationErrors) return;
        setFormState(
            buildFormState(
                null,
                pendingPopulationInquiries,
                nextPopulationInquiry,
                populationInquiries,
            ),
        );
        setCurrentStep(0);
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch {
            /* ignore */
        }
    }, [
        editingEntry,
        entries.length,
        hasValidationErrors,
        nextPopulationInquiry,
        pendingPopulationInquiries,
        populationInquiries,
    ]);

    useEffect(() => {
        if (editingEntry) return;
        try {
            localStorage.setItem(
                DRAFT_KEY,
                JSON.stringify({ formState, step: currentStep }),
            );
        } catch {
            /* ignore */
        }
    }, [formState, currentStep, editingEntry]);

    // ── Navigation ──

    const formAction = editingEntry
        ? `/annotations/${editingEntry.id}`
        : '/annotations';

    const progressPct = Math.round(
        ((populationStats.unique_lines - populationStats.pending_lines) /
            Math.max(populationStats.unique_lines, 1)) *
            100,
    );

    const goToStep = (index: number) => {
        if (index < 0 || index >= STEPS.length) return;
        if (
            currentStep === 1 &&
            index > 1 &&
            selectedDrugsNeedingAges.length > 0
        ) {
            setPromptSource('step');
            setShowAgePrompt(true);
            return;
        }
        setCurrentStep(index);
    };

    const handleAgePromptComplete = useCallback(
        (ages: Record<string, { min_age: number; max_age: number }>) => {
            setOtcDrugAges((prev) => {
                const next = { ...prev };
                for (const [drug, range] of Object.entries(ages)) {
                    next[drug] = { drug_name: drug, ...range };
                }
                return next;
            });
            setShowAgePrompt(false);
            if (promptSource === 'step') setCurrentStep(2);
        },
        [promptSource],
    );

    const handleAgePromptSkip = useCallback(() => {
        setShowAgePrompt(false);
        if (promptSource === 'step') setCurrentStep(2);
    }, [promptSource]);

    // ── Render ──

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Annotation Guide" />

            <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
                {/* ── Header ── */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <Heading
                        title="Domain Expert Annotation Guide"
                        description="Validate symptom labels and attach safety-first OTC guidance."
                    />
                    <div className="flex shrink-0 flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <a href="/annotations/entries">Entries</a>
                        </Button>
                        {isAdmin && (
                            <>
                                <Button asChild variant="outline" size="sm">
                                    <a
                                        href="/annotations/export"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Export JSON
                                    </a>
                                </Button>
                                <Button asChild variant="outline" size="sm">
                                    <a
                                        href="/annotations/otc-drug-ages/export"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Export OTC Ages
                                    </a>
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Progress ── */}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-y-1 text-sm">
                        <span className="font-medium">
                            Annotation Progress
                        </span>
                        <span className="text-muted-foreground">
                            {populationStats.unique_lines -
                                populationStats.pending_lines}{' '}
                            / {populationStats.unique_lines}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        {populationStats.pending_lines} pending ·{' '}
                        {populationStats.total_lines} total lines ·{' '}
                        {progressPct}%
                    </p>
                </div>

                {/* ── Stepper ── */}
                <nav className="flex items-center justify-between rounded-xl border bg-card px-2 py-3 shadow-sm sm:px-4">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const active = index === currentStep;
                        const done = index < currentStep;
                        return (
                            <button
                                key={step.id}
                                type="button"
                                onClick={() => goToStep(index)}
                                className={cn(
                                    'group flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition-all sm:flex-row sm:gap-2 sm:px-3 sm:text-sm',
                                    active && 'text-primary',
                                    done && 'text-emerald-600',
                                    !active &&
                                        !done &&
                                        'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <div
                                    className={cn(
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all sm:h-9 sm:w-9',
                                        active &&
                                            'border-primary bg-primary/10',
                                        done &&
                                            'border-emerald-500 bg-emerald-50',
                                        !active &&
                                            !done &&
                                            'border-muted-foreground/30 group-hover:border-muted-foreground/60',
                                    )}
                                >
                                    {done ? (
                                        <Check className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                        <Icon className="h-4 w-4" />
                                    )}
                                </div>
                                <span className="text-center leading-tight">
                                    {step.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>

                {/* ── OTC Age Prompt Dialog ── */}
                <DrugAgePromptDialog
                    drugsNeedingAges={dialogDrugs}
                    otcDrugAges={otcDrugAges}
                    onAllComplete={handleAgePromptComplete}
                    onSkip={handleAgePromptSkip}
                    open={showAgePrompt}
                    isPageLoad={promptSource === 'load'}
                    isAdmin={isAdmin}
                />

                {/* ── Form ── */}
                <Form action={formAction} method="post" className="space-y-5">
                    {({ errors, processing }) => (
                        <>
                            {editingEntry && (
                                <input
                                    type="hidden"
                                    name="_method"
                                    value="put"
                                />
                            )}
                            <input
                                type="hidden"
                                name="medical_notes"
                                value={medicalNotesJson}
                            />
                            <input
                                type="hidden"
                                name="user_inquiry"
                                value={resolvedUserInquiry}
                            />
                            <input
                                type="hidden"
                                name="min_age"
                                value={computedMinAge}
                            />

                            {/* ════════ STEP 1 — Inquiry + Patient Meta ════════ */}
                            <div
                                className={cn(
                                    'space-y-5',
                                    currentStep !== 0 && 'hidden',
                                )}
                            >
                                {/* Inquiry Source */}
                                <Card className="gap-0 py-0 shadow-sm">
                                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <Stethoscope className="h-5 w-5 text-primary" />
                                            <div>
                                                <CardTitle className="text-sm font-semibold">
                                                    Inquiry Source{' '}
                                                    <RequiredDot />
                                                </CardTitle>
                                                <CardDescription className="mt-0.5 text-xs">
                                                    Select or type the patient
                                                    inquiry to annotate.
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 px-4 py-5 sm:px-6">
                                        {/* Mode toggle */}
                                        <div className="flex flex-wrap gap-2">
                                            {(
                                                [
                                                    'population',
                                                    'manual',
                                                ] as const
                                            ).map((mode) => (
                                                <label
                                                    key={mode}
                                                    className={cn(
                                                        'flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                                                        inquiryInputMode ===
                                                            mode
                                                            ? 'border-primary bg-primary/5 text-primary'
                                                            : 'border-input bg-background text-muted-foreground hover:bg-muted/60',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="inquiry_input_mode"
                                                        value={mode}
                                                        checked={
                                                            inquiryInputMode ===
                                                            mode
                                                        }
                                                        onChange={() =>
                                                            set(
                                                                'inquiryInputMode',
                                                                mode,
                                                            )
                                                        }
                                                        className="sr-only"
                                                    />
                                                    {mode === 'population' ? (
                                                        <>
                                                            <span>Queue</span>
                                                            <Badge variant="secondary">
                                                                {
                                                                    pendingPopulationInquiries.length
                                                                }{' '}
                                                                pending
                                                            </Badge>
                                                        </>
                                                    ) : (
                                                        <span>
                                                            Manual input
                                                        </span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>

                                        {/* Population select */}
                                        {inquiryInputMode === 'population' &&
                                            populationInquiries.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <Label
                                                        htmlFor="population_user_inquiry"
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Select from queue
                                                    </Label>
                                                    <select
                                                        id="population_user_inquiry"
                                                        value={
                                                            selectedPopulationInquiry
                                                        }
                                                        onChange={(e) =>
                                                            set(
                                                                'selectedPopulationInquiry',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className={selectClass}
                                                    >
                                                        {populationInquiries.map(
                                                            (inquiry) => (
                                                                <option
                                                                    key={
                                                                        inquiry
                                                                    }
                                                                    value={
                                                                        inquiry
                                                                    }
                                                                    disabled={isPopulationInquiryAnnotated(
                                                                        inquiry,
                                                                    )}
                                                                >
                                                                    {getPopulationInquiryLabel(
                                                                        inquiry,
                                                                    )}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </div>
                                            )}

                                        {/* Manual input */}
                                        {inquiryInputMode === 'manual' && (
                                            <div className="space-y-1.5">
                                                <Label
                                                    htmlFor="manual_user_inquiry"
                                                    className="text-xs text-muted-foreground"
                                                >
                                                    Type inquiry
                                                </Label>
                                                <Input
                                                    id="manual_user_inquiry"
                                                    value={manualUserInquiry}
                                                    onChange={(e) =>
                                                        set(
                                                            'manualUserInquiry',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Enter the patient inquiry…"
                                                />
                                            </div>
                                        )}

                                        {/* No population file */}
                                        {populationInquiries.length === 0 && (
                                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                                No inquiry population found.
                                                Add lines to{' '}
                                                <code className="font-mono text-xs">
                                                    userInquiry.txt
                                                </code>
                                                .
                                            </p>
                                        )}

                                        <InputError
                                            message={errors.user_inquiry}
                                        />

                                        {/* Duplicate warning */}
                                        {activeInquiryStatus && (
                                            <div
                                                className={cn(
                                                    'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
                                                    isAnnotatedByCurrentUser
                                                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                                                        : 'border-red-200 bg-red-50 text-red-800',
                                                )}
                                            >
                                                <span>
                                                    Already annotated by{' '}
                                                    <strong>
                                                        {
                                                            activeInquiryStatus
                                                                .annotated_by
                                                                .name
                                                        }
                                                    </strong>
                                                    .{' '}
                                                    {isAnnotatedByCurrentUser
                                                        ? 'You submitted this.'
                                                        : 'Duplicate blocked.'}
                                                </span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Patient Meta */}
                                <Card className="gap-0 py-0 shadow-sm">
                                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <Stethoscope className="h-5 w-5 text-primary" />
                                            <div>
                                                <CardTitle className="text-sm font-semibold">
                                                    Patient Meta{' '}
                                                    <RequiredDot />
                                                </CardTitle>
                                                <CardDescription className="mt-0.5 text-xs">
                                                    Contextual details from the
                                                    inquiry.
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-4 py-5 sm:px-6">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="language">
                                                    Language <RequiredDot />
                                                </Label>
                                                <select
                                                    id="language"
                                                    name="language"
                                                    value={language}
                                                    onChange={(e) =>
                                                        set(
                                                            'language',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">
                                                        — select —
                                                    </option>
                                                    {languageOptions.map(
                                                        (opt) => (
                                                            <option
                                                                key={opt.value}
                                                                value={
                                                                    opt.value
                                                                }
                                                            >
                                                                {opt.label}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                                <InputError
                                                    message={errors.language}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="confidence">
                                                    Confidence <RequiredDot />
                                                </Label>
                                                <select
                                                    id="confidence"
                                                    name="confidence"
                                                    value={confidence}
                                                    onChange={(e) =>
                                                        set(
                                                            'confidence',
                                                            e.target.value,
                                                        )
                                                    }
                                                    className={selectClass}
                                                >
                                                    <option value="">
                                                        — select —
                                                    </option>
                                                    {confidenceOptions.map(
                                                        (opt) => (
                                                            <option
                                                                key={opt.value}
                                                                value={
                                                                    opt.value
                                                                }
                                                            >
                                                                {opt.label}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                                <InputError
                                                    message={errors.confidence}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* ════════ STEP 2 — Symptoms + OTC Drugs ════════ */}
                            <div
                                className={cn(
                                    'space-y-5',
                                    currentStep !== 1 && 'hidden',
                                )}
                            >
                                {/* Symptom Labels */}
                                <Card className="gap-0 py-0 shadow-sm">
                                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <Stethoscope className="h-5 w-5 text-primary" />
                                            <div>
                                                <CardTitle className="text-sm font-semibold">
                                                    Symptom Labels{' '}
                                                    <RequiredDot />
                                                </CardTitle>
                                                <CardDescription className="mt-0.5 text-xs">
                                                    Select all applicable
                                                    symptom categories.
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 px-4 py-5 sm:px-6">
                                        <div className="flex flex-wrap gap-2">
                                            {symptomLabels.map((label) => {
                                                const selected =
                                                    selectedSymptomLabels.includes(
                                                        label,
                                                    );
                                                return (
                                                    <label
                                                        key={label}
                                                        className={cn(
                                                            'flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                                                            selected
                                                                ? 'border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm'
                                                                : 'border-input bg-background text-muted-foreground hover:bg-muted/60',
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            name="symptom_labels[]"
                                                            value={label}
                                                            checked={selected}
                                                            onChange={(e) =>
                                                                handleSymptomSelection(
                                                                    label,
                                                                    e.target
                                                                        .checked,
                                                                )
                                                            }
                                                            className="sr-only"
                                                        />
                                                        {selected && (
                                                            <Check className="h-3 w-3 shrink-0" />
                                                        )}
                                                        {label}
                                                    </label>
                                                );
                                            })}
                                            {/* Other symptom */}
                                            <label
                                                className={cn(
                                                    'flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                                                    selectedSymptomLabels.includes(
                                                        'OTHER',
                                                    )
                                                        ? 'border-violet-400 bg-violet-50 text-violet-800 shadow-sm'
                                                        : 'border-dashed border-input bg-background text-muted-foreground hover:bg-muted/60',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="symptom_labels[]"
                                                    value="OTHER"
                                                    checked={selectedSymptomLabels.includes(
                                                        'OTHER',
                                                    )}
                                                    onChange={(e) =>
                                                        handleSymptomSelection(
                                                            'OTHER',
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className="sr-only"
                                                />
                                                + Other
                                            </label>
                                        </div>

                                        {selectedSymptomLabels.includes(
                                            'OTHER',
                                        ) && (
                                            <div className="space-y-1.5">
                                                <Label
                                                    htmlFor="symptom_labels_other"
                                                    className="text-xs text-muted-foreground"
                                                >
                                                    Describe the symptom{' '}
                                                    <RequiredDot />
                                                </Label>
                                                <Input
                                                    id="symptom_labels_other"
                                                    name="symptom_labels_other"
                                                    value={symptomLabelsOther}
                                                    onChange={(e) =>
                                                        set(
                                                            'symptomLabelsOther',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="e.g. eye redness, ear pain…"
                                                />
                                                <InputError
                                                    message={
                                                        errors.symptom_labels_other
                                                    }
                                                />
                                            </div>
                                        )}
                                        <InputError
                                            message={errors.symptom_labels}
                                        />
                                    </CardContent>
                                </Card>

                                {/* OTC Drugs */}
                                <Card className="gap-0 py-0 shadow-sm">
                                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <Pill className="h-5 w-5 text-primary" />
                                            <div>
                                                <CardTitle className="text-sm font-semibold">
                                                    Suggested OTC Drugs{' '}
                                                    <RequiredDot />
                                                </CardTitle>
                                                <CardDescription className="mt-0.5 text-xs">
                                                    Select drugs and fill in
                                                    dosage details for each.
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 px-4 py-5 sm:px-6">
                                        <div className="flex flex-wrap gap-2">
                                            {otcOptions.map((otc) => {
                                                const selected =
                                                    selectedOtc.includes(otc);
                                                return (
                                                    <label
                                                        key={otc}
                                                        className={cn(
                                                            'relative flex max-w-full cursor-pointer select-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium leading-snug transition-all',
                                                            selected
                                                                ? 'border-primary/50 bg-primary/5 text-primary shadow-sm'
                                                                : 'border-input bg-background text-muted-foreground hover:bg-muted/60',
                                                        )}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            name="suggested_otc[]"
                                                            value={otc}
                                                            checked={selected}
                                                            onChange={(e) =>
                                                                handleOtcSelection(
                                                                    otc,
                                                                    e.target
                                                                        .checked,
                                                                )
                                                            }
                                                            className="sr-only"
                                                        />
                                                        {selected && (
                                                            <Check className="h-3 w-3 shrink-0" />
                                                        )}
                                                        <span>{otc}</span>
                                                    </label>
                                                );
                                            })}
                                            {/* Other drug */}
                                            <label
                                                className={cn(
                                                    'flex cursor-pointer select-none items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                                                    selectedOtc.includes(
                                                        'OTHER',
                                                    )
                                                        ? 'border-violet-400 bg-violet-50 text-violet-800 shadow-sm'
                                                        : 'border-dashed border-input bg-background text-muted-foreground hover:bg-muted/60',
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    name="suggested_otc[]"
                                                    value="OTHER"
                                                    checked={selectedOtc.includes(
                                                        'OTHER',
                                                    )}
                                                    onChange={(e) =>
                                                        handleOtcSelection(
                                                            'OTHER',
                                                            e.target.checked,
                                                        )
                                                    }
                                                    className="sr-only"
                                                />
                                                + Other drug
                                            </label>
                                        </div>

                                        {selectedOtc.includes('OTHER') && (
                                            <div className="space-y-1.5">
                                                <Label
                                                    htmlFor="suggested_otc_other"
                                                    className="text-xs text-muted-foreground"
                                                >
                                                    Specify drug name{' '}
                                                    <RequiredDot />
                                                </Label>
                                                <Input
                                                    id="suggested_otc_other"
                                                    name="suggested_otc_other"
                                                    value={suggestedOtcOther}
                                                    onChange={(e) =>
                                                        set(
                                                            'suggestedOtcOther',
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Enter OTC drug name…"
                                                />
                                                <InputError
                                                    message={
                                                        errors.suggested_otc_other
                                                    }
                                                />
                                            </div>
                                        )}
                                        <InputError
                                            message={errors.suggested_otc}
                                        />

                                        {/* Dosage Guide */}
                                        {selectedOtcForNotes.length > 0 && (
                                            <div className="space-y-3 border-t pt-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                    Dosage Guide —{' '}
                                                    {
                                                        selectedOtcForNotes.length
                                                    }{' '}
                                                    drug
                                                    {selectedOtcForNotes.length >
                                                    1
                                                        ? 's'
                                                        : ''}{' '}
                                                    <RequiredDot />
                                                </p>
                                                {selectedOtcForNotes.map(
                                                    (otc) => {
                                                        const detail =
                                                            otcDetails[otc];
                                                        const dbAge =
                                                            otcDrugAges[otc];
                                                        return (
                                                            <div
                                                                key={otc}
                                                                className="space-y-3 rounded-xl border bg-muted/20 p-4"
                                                            >
                                                                <p className="min-w-0 break-words text-sm font-semibold">
                                                                    {otc}
                                                                </p>

                                                                {/* Dosage fields */}
                                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                                    <div className="space-y-1">
                                                                        <Label
                                                                            htmlFor={`dosage-${otc}`}
                                                                            className="text-xs text-muted-foreground"
                                                                        >
                                                                            Dosage
                                                                            (mg){' '}
                                                                            <RequiredDot />
                                                                        </Label>
                                                                        <Input
                                                                            id={`dosage-${otc}`}
                                                                            value={
                                                                                detail?.dosage_mg ??
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateOtcDetail(
                                                                                    otc,
                                                                                    'dosage_mg',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder="500"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label
                                                                            htmlFor={`times-${otc}`}
                                                                            className="text-xs text-muted-foreground"
                                                                        >
                                                                            Times
                                                                            /
                                                                            day{' '}
                                                                            <RequiredDot />
                                                                        </Label>
                                                                        <Input
                                                                            id={`times-${otc}`}
                                                                            value={
                                                                                detail?.times_per_day ??
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateOtcDetail(
                                                                                    otc,
                                                                                    'times_per_day',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder="3"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label
                                                                            htmlFor={`maxdoses-${otc}`}
                                                                            className="text-xs text-muted-foreground"
                                                                        >
                                                                            Max
                                                                            doses
                                                                            /
                                                                            day{' '}
                                                                            <RequiredDot />
                                                                        </Label>
                                                                        <Input
                                                                            id={`maxdoses-${otc}`}
                                                                            value={
                                                                                detail?.max_doses_per_day ??
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateOtcDetail(
                                                                                    otc,
                                                                                    'max_doses_per_day',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder="4"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label
                                                                            htmlFor={`notes-${otc}`}
                                                                            className="text-xs text-muted-foreground"
                                                                        >
                                                                            Notes{' '}
                                                                            <RequiredDot />
                                                                        </Label>
                                                                        <Input
                                                                            id={`notes-${otc}`}
                                                                            value={
                                                                                detail?.notes ??
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateOtcDetail(
                                                                                    otc,
                                                                                    'notes',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder="After meals"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Per-entry age overrides */}
                                                                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                                                                    <div className="space-y-1">
                                                                        <Label
                                                                            htmlFor={`min-age-${otc}`}
                                                                            className="text-xs text-muted-foreground"
                                                                        >
                                                                            Min
                                                                            age
                                                                            (this
                                                                            entry)
                                                                        </Label>
                                                                        <Input
                                                                            id={`min-age-${otc}`}
                                                                            type="number"
                                                                            min={
                                                                                0
                                                                            }
                                                                            max={
                                                                                150
                                                                            }
                                                                            value={
                                                                                detail?.min_age ??
                                                                                (dbAge?.min_age !=
                                                                                null
                                                                                    ? String(
                                                                                          dbAge.min_age,
                                                                                      )
                                                                                    : '')
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateOtcDetail(
                                                                                    otc,
                                                                                    'min_age',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder={
                                                                                dbAge
                                                                                    ? String(
                                                                                          dbAge.min_age,
                                                                                      )
                                                                                    : '0'
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label
                                                                            htmlFor={`max-age-${otc}`}
                                                                            className="text-xs text-muted-foreground"
                                                                        >
                                                                            Max
                                                                            age
                                                                            (this
                                                                            entry)
                                                                        </Label>
                                                                        <Input
                                                                            id={`max-age-${otc}`}
                                                                            type="number"
                                                                            min={
                                                                                0
                                                                            }
                                                                            max={
                                                                                150
                                                                            }
                                                                            value={
                                                                                detail?.max_age ??
                                                                                (dbAge?.max_age !=
                                                                                null
                                                                                    ? String(
                                                                                          dbAge.max_age,
                                                                                      )
                                                                                    : '')
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateOtcDetail(
                                                                                    otc,
                                                                                    'max_age',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                            placeholder={
                                                                                dbAge
                                                                                    ? String(
                                                                                          dbAge.max_age,
                                                                                      )
                                                                                    : '65'
                                                                            }
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    },
                                                )}
                                                <InputError
                                                    message={
                                                        errors.medical_notes
                                                    }
                                                />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* ════════ STEP 3 — Safety Profile ════════ */}
                            <div
                                className={cn(
                                    currentStep !== 2 && 'hidden',
                                )}
                            >
                                <Card className="gap-0 py-0 shadow-sm">
                                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <ShieldCheck className="h-5 w-5 text-primary" />
                                            <div>
                                                <CardTitle className="text-sm font-semibold">
                                                    Safety Profile{' '}
                                                    <RequiredDot />
                                                </CardTitle>
                                                <CardDescription className="mt-0.5 text-xs">
                                                    Clinical safety information
                                                    for the selected OTC drugs.
                                                </CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6 px-4 py-5 sm:px-6">
                                        {/* Age Restriction */}
                                        <fieldset className="space-y-2">
                                            <Label className="text-sm font-medium">
                                                Age Restriction <RequiredDot />
                                            </Label>
                                            <YesNoToggle
                                                name="age_restriction_options"
                                                value={ageRestrictionOptions}
                                                onChange={toggleYesNo(
                                                    'ageRestrictionOptions',
                                                )}
                                            />
                                            <InputError
                                                message={
                                                    errors.age_restriction_options
                                                }
                                            />
                                            {ageRestrictionOptions.includes(
                                                'yes',
                                            ) && (
                                                <div className="mt-2 space-y-1.5">
                                                    <Label
                                                        htmlFor="age_restrictions_details"
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Specify restriction{' '}
                                                        <RequiredDot />
                                                    </Label>
                                                    <Input
                                                        id="age_restrictions_details"
                                                        name="age_restrictions_details"
                                                        required
                                                        value={ageRestrictions}
                                                        onChange={(e) =>
                                                            set(
                                                                'ageRestrictions',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="e.g. Not for children below 12 years old"
                                                    />
                                                    <InputError
                                                        message={
                                                            errors.age_restrictions_details
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </fieldset>

                                        <hr className="border-border" />

                                        {/* Contraindications */}
                                        <fieldset className="space-y-2">
                                            <Label className="text-sm font-medium">
                                                Possible Drug Contraindication{' '}
                                                <RequiredDot />
                                            </Label>
                                            <YesNoToggle
                                                name="known_contraindications_options"
                                                value={contraindicationOptions}
                                                onChange={toggleYesNo(
                                                    'contraindicationOptions',
                                                )}
                                                yesColor="red"
                                            />
                                            <InputError
                                                message={
                                                    errors.known_contraindications_options
                                                }
                                            />
                                            {contraindicationOptions.includes(
                                                'yes',
                                            ) && (
                                                <div className="mt-2 space-y-1.5">
                                                    <Label
                                                        htmlFor="known_contraindications_details"
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Specify
                                                        contraindication{' '}
                                                        <RequiredDot />
                                                    </Label>
                                                    <Input
                                                        id="known_contraindications_details"
                                                        name="known_contraindications_details"
                                                        required
                                                        value={
                                                            knownContraindicationsDetails
                                                        }
                                                        onChange={(e) =>
                                                            set(
                                                                'knownContraindicationsDetails',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="e.g. Ibuprofen contraindicated in peptic ulcer disease"
                                                    />
                                                    <InputError
                                                        message={
                                                            errors.known_contraindications_details
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </fieldset>

                                        <hr className="border-border" />

                                        {/* Pregnancy */}
                                        <fieldset className="space-y-2">
                                            <Label className="text-sm font-medium">
                                                Pregnancy Considerations{' '}
                                                <RequiredDot />
                                            </Label>
                                            <YesNoToggle
                                                name="pregnancy_considerations_options"
                                                value={pregnancyOptions}
                                                onChange={toggleYesNo(
                                                    'pregnancyOptions',
                                                )}
                                            />
                                            <InputError
                                                message={
                                                    errors.pregnancy_considerations_options
                                                }
                                            />
                                            {pregnancyOptions.includes(
                                                'yes',
                                            ) && (
                                                <div className="mt-2 space-y-1.5">
                                                    <Label
                                                        htmlFor="pregnancy_considerations_details"
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Specify
                                                        considerations{' '}
                                                        <RequiredDot />
                                                    </Label>
                                                    <Input
                                                        id="pregnancy_considerations_details"
                                                        name="pregnancy_considerations_details"
                                                        required
                                                        value={
                                                            pregnancyConsiderationsDetails
                                                        }
                                                        onChange={(e) =>
                                                            set(
                                                                'pregnancyConsiderationsDetails',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="e.g. Avoid in first trimester"
                                                    />
                                                    <InputError
                                                        message={
                                                            errors.pregnancy_considerations_details
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </fieldset>

                                        <hr className="border-border" />

                                        {/* Medical Referral */}
                                        <fieldset className="space-y-2">
                                            <Label className="text-sm font-medium">
                                                Requires Medical Referral{' '}
                                                <RequiredDot />
                                            </Label>
                                            <YesNoToggle
                                                name="requires_medical_referral_options"
                                                value={
                                                    requiresMedicalReferralOptions
                                                }
                                                onChange={toggleYesNo(
                                                    'requiresMedicalReferralOptions',
                                                )}
                                                yesColor="red"
                                            />
                                            <InputError
                                                message={
                                                    errors.requires_medical_referral_options
                                                }
                                            />
                                        </fieldset>

                                        <hr className="border-border" />

                                        {/* Gender limitation */}
                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="gender_specific_limitations"
                                                className="text-sm font-medium"
                                            >
                                                Gender-specific Limitation{' '}
                                                <RequiredDot />
                                            </Label>
                                            <select
                                                id="gender_specific_limitations"
                                                name="gender_specific_limitations"
                                                value={genderLimitation}
                                                onChange={(e) =>
                                                    set(
                                                        'genderLimitation',
                                                        e.target.value,
                                                    )
                                                }
                                                className={selectClass}
                                            >
                                                <option value="">
                                                    — select —
                                                </option>
                                                {genderOptions.map((opt) => (
                                                    <option
                                                        key={opt.value}
                                                        value={opt.value}
                                                    >
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <InputError
                                                message={
                                                    errors.gender_specific_limitations
                                                }
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* ── Navigation + Submit ── */}
                            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-4 shadow-sm sm:px-6">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        goToStep(currentStep - 1)
                                    }
                                    disabled={currentStep === 0}
                                >
                                    <ChevronLeft className="mr-1 h-4 w-4" />{' '}
                                    Back
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    Step {currentStep + 1} / {STEPS.length}
                                </span>
                                {currentStep < STEPS.length - 1 ? (
                                    <Button
                                        type="button"
                                        onClick={() =>
                                            goToStep(currentStep + 1)
                                        }
                                    >
                                        Next{' '}
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        {editingEntry && (
                                            <Button
                                                asChild
                                                type="button"
                                                variant="outline"
                                            >
                                                <a href="/annotations">
                                                    Cancel
                                                </a>
                                            </Button>
                                        )}
                                        <Button
                                            type="submit"
                                            disabled={
                                                processing ||
                                                isDuplicateInquiry ||
                                                resolvedUserInquiry.trim() ===
                                                    ''
                                            }
                                        >
                                            {processing
                                                ? 'Saving…'
                                                : editingEntry
                                                  ? 'Update'
                                                  : 'Save & Next'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </AppLayout>
    );
}
