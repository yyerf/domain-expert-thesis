import { Head } from '@inertiajs/react';
import TextLink from '@/components/text-link';
import AuthLayout from '@/layouts/auth-layout';
import { login } from '@/routes';

export default function Register() {
    return (
        <AuthLayout
            title="Registration disabled"
            description="Account creation is managed by administrators."
        >
            <Head title="Register" />

            <div className="text-center text-sm text-muted-foreground">
                Please contact an administrator to create your account.{' '}
                <TextLink href={login()} tabIndex={1}>
                    Back to login
                </TextLink>
            </div>
        </AuthLayout>
    );
}
