import { Link, usePage } from '@inertiajs/react';
import { ClipboardCheck, UserPlus } from 'lucide-react';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';
import AppLogo from './app-logo';

const baseMainNavItems: NavItem[] = [
    {
        title: 'Annotation Guide',
        href: '/annotations',
        icon: ClipboardCheck,
    },
    {
        title: 'Recent Entries',
        href: '/annotations/entries',
        icon: ClipboardCheck,
    },
];

export function AppSidebar() {
    const { auth } = usePage().props as {
        auth: {
            user: {
                is_admin?: boolean;
            };
        };
    };

    const mainNavItems: NavItem[] = auth.user?.is_admin
        ? [
              ...baseMainNavItems,
              {
                  title: 'Admin: Accounts',
                  href: '/admin/users/create',
                                    icon: UserPlus,
              },
          ]
        : baseMainNavItems;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/annotations" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
