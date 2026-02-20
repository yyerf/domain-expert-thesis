import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { dashboard, login } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props as {
        auth: {
            user?: {
                id: number;
            };
        };
    };

    return (
        <>
            <Head title="Mendo v3" />

            <div className="relative min-h-screen overflow-hidden bg-white text-slate-800">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-100 via-teal-50 to-transparent blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-gradient-to-tr from-slate-100 via-emerald-50 to-transparent blur-3xl" />
                </div>

                <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-12">
                    <header className="mb-20 flex items-center justify-between">
                        <div className="inline-flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 shadow-sm ring-1 ring-emerald-200/80">
                                <Sparkles className="size-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium tracking-wide text-slate-500">Clinical Annotation Suite</p>
                                <h1 className="text-lg font-semibold tracking-tight text-slate-900">Mendo v3</h1>
                            </div>
                        </div>

                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-500"
                            >
                                Open workspace
                                <ArrowRight className="size-4" />
                            </Link>
                        ) : (
                            <Link
                                href={login()}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-4 py-2 text-sm font-medium shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                            >
                                Sign in
                                <ArrowRight className="size-4" />
                            </Link>
                        )}
                    </header>

                    <main className="grid gap-12 lg:grid-cols-2 lg:items-center">
                        <section className="space-y-6">
                            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700">
                                <ShieldCheck className="size-3.5 text-emerald-600" />
                                Thesis-ready expert workflow
                            </p>

                            <h2 className="text-4xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                                Structured, reliable annotations for safer OTC guidance.
                            </h2>

                            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                                Built for thesis research, Mendo v3 helps domain experts annotate high-quality datasets with a clean,
                                consistent workflow and export-ready JSON for downstream model training.
                            </p>

                            <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm shadow-slate-200/70">
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                    Checklist-first annotations
                                </div>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm shadow-slate-200/70">
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                    Queue + manual inquiry modes
                                </div>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm shadow-slate-200/70">
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                    Duplicate prevention safeguards
                                </div>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm shadow-slate-200/70">
                                    <CheckCircle2 className="size-4 text-emerald-600" />
                                    Export-ready training datasets
                                </div>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-2xl shadow-slate-200/70 ring-1 ring-white sm:p-8">
                            <h3 className="mb-2 text-xl font-semibold tracking-tight text-slate-900">Ready to continue?</h3>
                            <p className="mb-6 text-sm leading-relaxed text-slate-600">
                                Enter your workspace to review pending inquiries, annotate with confidence, and keep your thesis dataset consistent.
                            </p>

                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-500"
                                >
                                    Go to annotation workspace
                                    <ArrowRight className="size-4" />
                                </Link>
                            ) : (
                                <Link
                                    href={login()}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-500"
                                >
                                    Sign in to Mendo v3
                                    <ArrowRight className="size-4" />
                                </Link>
                            )}
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}
