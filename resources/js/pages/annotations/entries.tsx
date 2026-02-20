import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type AnnotatorOption = {
    id: number;
    name: string;
    email: string;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Annotation Guide', href: '/annotations' },
    { title: 'Entries Dashboard', href: '/annotations/entries' },
];

export default function AnnotationEntriesDashboard({
    entries,
    availableLabels,
    availableAnnotators,
    currentAnnotatorId,
}: {
    entries: AnnotationEntry[];
    availableLabels: string[];
    availableAnnotators: AnnotatorOption[];
    currentAnnotatorId: number | null;
}) {
    const [search, setSearch] = useState('');
    const [selectedLabel, setSelectedLabel] = useState('all');
    const [selectedAnnotator, setSelectedAnnotator] = useState('all');
    const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'inquiry'>('latest');

    const filteredEntries = useMemo(() => {
        const filtered = entries.filter((entry) => {
            const inquiryMatch = entry.user_inquiry.toLowerCase().includes(search.toLowerCase());
            const labelMatch =
                selectedLabel === 'all' ||
                entry.symptom_labels.includes(selectedLabel) ||
                (selectedLabel === 'OTHER' && entry.symptom_labels_other !== null);
            const annotatorMatch = selectedAnnotator === 'all' || String(entry.annotator.id) === selectedAnnotator;

            return inquiryMatch && labelMatch && annotatorMatch;
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'inquiry') {
                return a.user_inquiry.localeCompare(b.user_inquiry);
            }

            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

            return sortBy === 'oldest' ? aTime - bTime : bTime - aTime;
        });
    }, [entries, search, selectedLabel, selectedAnnotator, sortBy]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Entries Dashboard" />

            <div className="space-y-6 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Heading
                        title="Recent Entries Dashboard"
                        description="Professional view for browsing, filtering, and re-editing annotated entries."
                    />
                    <Button asChild variant="outline">
                        <a href="/annotations">Back to annotation form</a>
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border p-4">
                        <p className="text-xs text-muted-foreground">Total entries</p>
                        <p className="text-2xl font-semibold">{entries.length}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <p className="text-xs text-muted-foreground">Filtered entries</p>
                        <p className="text-2xl font-semibold">{filteredEntries.length}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <p className="text-xs text-muted-foreground">Labels available</p>
                        <p className="text-2xl font-semibold">{availableLabels.length}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                        <p className="text-xs text-muted-foreground">Annotators</p>
                        <p className="text-2xl font-semibold">{availableAnnotators.length}</p>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                    <aside className="space-y-4 rounded-xl border p-4">
                        <div className="space-y-2">
                            <Label htmlFor="search">Search inquiry</Label>
                            <Input id="search" value={search} onChange={(event) => setSearch(event.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="filter-label">Filter by symptom label</Label>
                            <select
                                id="filter-label"
                                value={selectedLabel}
                                onChange={(event) => setSelectedLabel(event.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            >
                                <option value="all">All labels</option>
                                {availableLabels.map((label) => (
                                    <option key={label} value={label}>
                                        {label}
                                    </option>
                                ))}
                                <option value="OTHER">OTHER</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="filter-annotator">Filter by annotator</Label>
                            <select
                                id="filter-annotator"
                                value={selectedAnnotator}
                                onChange={(event) => setSelectedAnnotator(event.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            >
                                <option value="all">All annotators</option>
                                {availableAnnotators.map((annotator) => (
                                    <option key={annotator.id} value={annotator.id}>
                                        {annotator.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sort-by">Sort by</Label>
                            <select
                                id="sort-by"
                                value={sortBy}
                                onChange={(event) => setSortBy(event.target.value as 'latest' | 'oldest' | 'inquiry')}
                                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            >
                                <option value="latest">Latest</option>
                                <option value="oldest">Oldest</option>
                                <option value="inquiry">Inquiry A-Z</option>
                            </select>
                        </div>
                    </aside>

                    <section className="space-y-3">
                        {filteredEntries.length === 0 ? (
                            <p className="rounded-xl border p-4 text-sm text-muted-foreground">No entries match your filters.</p>
                        ) : (
                            filteredEntries.map((entry) => (
                                <article key={entry.id} className="space-y-3 rounded-xl border p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-medium">{entry.user_inquiry}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Annotated by {entry.annotator.name} ({entry.annotator.email})
                                                {currentAnnotatorId === entry.annotator.id ? ' - You' : ''}
                                            </p>
                                        </div>
                                        <Button asChild size="sm" variant="outline">
                                            <a href={`/annotations?edit=${entry.id}`}>Re-edit</a>
                                        </Button>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {entry.symptom_labels.map((label) => (
                                            <Badge key={`${entry.id}-${label}`} variant="secondary">
                                                {label}
                                            </Badge>
                                        ))}
                                        {entry.symptom_labels_other && <Badge variant="outline">Other: {entry.symptom_labels_other}</Badge>}
                                    </div>

                                    <p className="text-sm text-muted-foreground">
                                        OTC: {entry.suggested_otc.join(', ') || 'None selected'}
                                        {entry.suggested_otc_other ? ` (Other: ${entry.suggested_otc_other})` : ''}
                                    </p>
                                </article>
                            ))
                        )}
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}
