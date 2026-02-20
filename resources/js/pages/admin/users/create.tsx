import { Form, Head } from '@inertiajs/react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Admin: Accounts',
        href: '/admin/users/create',
    },
];

export default function CreateUser({ status }: { status?: string }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Account" />

            <div className="space-y-6 p-4">
                <Heading
                    title="Create user account"
                    description="Admins can create non-admin user accounts."
                />

                {status && (
                    <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                        {status}
                    </p>
                )}

                <Form action="/admin/users" method="post" className="max-w-xl space-y-4 rounded-xl border p-6">
                    {({ processing, errors }) => (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" name="name" required />
                                <InputError message={errors.name} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" required />
                                <InputError message={errors.email} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" name="password" type="password" required minLength={12} />
                                <InputError message={errors.password} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation">Confirm password</Label>
                                <Input
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    type="password"
                                    required
                                    minLength={12}
                                />
                            </div>

                            <Button type="submit" disabled={processing}>
                                Create account
                            </Button>
                        </>
                    )}
                </Form>
            </div>
        </AppLayout>
    );
}
