import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgePercent,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Copy,
    CreditCard,
    ExternalLink,
    LayoutDashboard,
    LogOut,
    Menu,
    Package,
    Plus,
    QrCode,
    Scissors,
    Settings,
    Share2,
    ShieldAlert,
    Star,
    User as UserIcon,
    Users,
    UserSquare2,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { NotificationBell } from '@/components/NotificationBell';
import { QrPosterDialog } from '@/components/QrPosterDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { cn } from '@/lib/utils';
import type { BusinessPermission, PageProps } from '@/types';

interface DashboardLayoutProps {
    title: string;
    children: ReactNode;
    /** Back link shown above the title on sub-pages (forms, detail pages). */
    back?: { href: string; label: string };
    /** Primary page actions (e.g. "Tambah …"), shown right of the title. */
    actions?: ReactNode;
}

// `need` mirrors each page's server-side permission check; items the user can't open are hidden.
const NAV_ITEMS: {
    label: string;
    mobileLabel?: string;
    routeName: string;
    icon: typeof Settings;
    need?: BusinessPermission[];
}[] = [
    { label: 'Ringkasan', routeName: 'dashboard', icon: LayoutDashboard },
    { label: 'Reservasi', routeName: 'dashboard.bookings', icon: CalendarDays, need: ['manage_bookings', 'verify_payments'] },
    { label: 'Layanan', routeName: 'dashboard.services', icon: Scissors, need: ['manage_services'] },
    { label: 'Jadwal & Libur', mobileLabel: 'Jadwal', routeName: 'dashboard.schedule', icon: Clock, need: ['manage_settings'] },
    { label: 'Tim & Staff', mobileLabel: 'Tim', routeName: 'dashboard.staff', icon: UserSquare2, need: ['manage_staff'] },
    { label: 'Komisi Staff', mobileLabel: 'Komisi', routeName: 'dashboard.commissions', icon: BadgePercent, need: ['manage_staff'] },
    { label: 'Pelanggan', routeName: 'dashboard.customers', icon: Users, need: ['manage_bookings'] },
    { label: 'Ulasan', routeName: 'dashboard.reviews', icon: Star, need: ['manage_settings', 'manage_bookings'] },
    { label: 'Pengaturan', routeName: 'dashboard.settings', icon: Settings, need: ['manage_settings'] },
    { label: 'Paket & Billing', mobileLabel: 'Billing', routeName: 'dashboard.billing', icon: CreditCard, need: ['manage_settings'] },
];

// Mobile/tablet bottom bar shows these; the rest live in the "Lainnya" sheet.
const PRIMARY_NAV = ['dashboard', 'dashboard.bookings', 'dashboard.services', 'dashboard.customers'];

const CONFIG_ROUTES = new Set(['dashboard.settings', 'dashboard.billing']);

// Sub-pages (create/edit/show) keep their section active; 'dashboard.*' would match every page.
const isNavActive = (routeName: string) =>
    route().current(routeName) || (routeName !== 'dashboard' && route().current(`${routeName}.*`));

export default function DashboardLayout({ title, children, back, actions }: DashboardLayoutProps) {
    const {
        auth,
        activeBusiness,
        businesses,
        tenantBaseDomain = 'janjiyan.web.id',
        subscription,
        pendingBookingsCount = 0,
        unreadNotificationsCount = 0,
    } = usePage<PageProps>().props;
    const [qrOpen, setQrOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const can = activeBusiness?.can;
    const businessConfig = getBusinessTypeConfig(activeBusiness?.business_type);
    const bookingsNounLower = businessConfig.bookings.itemSingular.toLowerCase();
    // No active business yet (new account): nothing to restrict.
    const navItems = NAV_ITEMS.filter((item) => {
        if (item.routeName === 'dashboard.commissions' && !businessConfig.nav.showCommissions) {
            return false;
        }
        return !can || !item.need || item.need.some((p) => can[p]);
    }).map((item) => {
        if (item.routeName === 'dashboard.bookings') {
            return {
                ...item,
                label: businessConfig.nav.bookingsLabel,
                mobileLabel: businessConfig.nav.bookingsMobileLabel,
                icon: businessConfig.nav.bookingsIconKey === 'package' ? Package : CalendarDays,
            };
        }
        if (item.routeName === 'dashboard.services') {
            return {
                ...item,
                label: businessConfig.nav.servicesLabel,
                mobileLabel: businessConfig.nav.servicesMobileLabel,
            };
        }
        if (item.routeName === 'dashboard.staff') {
            return { ...item, label: businessConfig.nav.teamLabel, mobileLabel: 'Tim' };
        }
        return item;
    });
    // Bottom bar holds 5 slots: show everything when it fits, else 4 items plus "Lainnya".
    const orderedNav = [
        ...navItems.filter((item) => PRIMARY_NAV.includes(item.routeName)),
        ...navItems.filter((item) => !PRIMARY_NAV.includes(item.routeName)),
    ];
    const bottomNav = orderedNav.length <= 5 ? orderedNav : orderedNav.slice(0, 4);
    const secondaryNav = orderedNav.length <= 5 ? [] : orderedNav.slice(4);
    const moreActive = secondaryNav.some((item) => isNavActive(item.routeName));
    const [copiedLink, setCopiedLink] = useState(false);
    const activePublicUrl = activeBusiness
        ? activeBusiness.public_url || route('public.booking', activeBusiness.slug)
        : '';

    const copyPublicBookingLink = () => {
        if (!activePublicUrl || typeof window === 'undefined') return;
        navigator.clipboard?.writeText(activePublicUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleSwitch = (businessId: number) => {
        router.post(route('dashboard.businesses.switch'), { business_id: businessId });
    };

    const operationalNav = navItems.filter((item) => !CONFIG_ROUTES.has(item.routeName));
    const configNav = navItems.filter((item) => CONFIG_ROUTES.has(item.routeName));

    const renderBusinessSwitcher = (triggerClassName: string) =>
        activeBusiness ? (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={`Pilih bisnis aktif: ${activeBusiness.name}`}
                        className={triggerClassName}
                    >
                        <span className="truncate">{activeBusiness.name}</span>
                        <ChevronDown className="size-3.5 shrink-0 text-mute sm:size-4" aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] rounded-md border-hairline-soft p-2 shadow-none">
                    {businesses.map((b) => (
                        <DropdownMenuItem
                            key={b.id}
                            onClick={() => handleSwitch(b.id)}
                            className={cn(
                                'min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm',
                                b.id === activeBusiness.id && 'bg-bone font-semibold'
                            )}
                        >
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate">{b.name}</span>
                                <span className="truncate text-xs text-mute">
                                    {`${b.slug}.${tenantBaseDomain}`}
                                </span>
                            </div>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        asChild
                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold text-electric"
                    >
                        <Link href={route('dashboard.businesses.create')}>
                            <Plus className="mr-1.5 size-4" />
                            Tambah Bisnis Baru
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ) : null;

    const renderPortalShareDropdown = (trigger: ReactNode) =>
        activeBusiness ? (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)] rounded-md border-hairline-soft p-2 shadow-none">
                    <DropdownMenuItem
                        onClick={copyPublicBookingLink}
                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                    >
                        {copiedLink ? (
                            <Check className="mr-2 size-4 text-success" aria-hidden="true" />
                        ) : (
                            <Copy className="mr-2 size-4" aria-hidden="true" />
                        )}
                        {copiedLink ? 'Link Tersalin' : 'Salin Link Booking'}
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink">
                        <a href={activePublicUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 size-4" aria-hidden="true" />
                            Buka Link Booking
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setQrOpen(true)}
                        className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink"
                    >
                        <QrCode className="mr-2 size-4" aria-hidden="true" />
                        QR Poster
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ) : null;

    const renderAccountMenu = (triggerClassName: string) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Menu akun ${auth.user?.name ?? ''}`}
                    className={triggerClassName}
                >
                    {auth.user?.name.slice(0, 2).toUpperCase()}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)] rounded-md border-hairline-soft p-2 shadow-none">
                <div className="px-3 py-2">
                    <p className="text-sm font-semibold text-ink">{auth.user?.name}</p>
                    <p className="truncate text-xs text-mute">{auth.user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-ink">
                    <Link href={route('dashboard.profile')}>
                        <UserIcon className="mr-2 size-4" aria-hidden="true" />
                        Profil & Kata Sandi
                    </Link>
                </DropdownMenuItem>
                {auth.user?.is_superadmin && (
                    <DropdownMenuItem asChild className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold text-electric">
                        <Link href={route('admin.index')}>
                            <ShieldAlert className="mr-2 size-4" aria-hidden="true" />
                            Panel Superadmin
                        </Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    onClick={() => router.post(route('logout'))}
                    className="min-h-10 cursor-pointer rounded-xl px-3 py-2.5 text-sm text-destructive focus:bg-destructive-soft focus:text-destructive"
                >
                    <LogOut className="mr-2 size-4" aria-hidden="true" />
                    Keluar
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const renderSidebarNavItem = (item: (typeof navItems)[number]) => {
        const Icon = item.icon;
        const isActive = isNavActive(item.routeName);
        const showQueueCount = item.routeName === 'dashboard.bookings' && pendingBookingsCount > 0;

        return (
            <Link
                key={item.routeName}
                href={route(item.routeName)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                    'flex shrink-0 items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                    isActive ? 'bg-ink text-canvas' : 'text-mute hover:bg-bone hover:text-ink'
                )}
            >
                <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                </span>
                {showQueueCount && (
                    <>
                        <span
                            aria-hidden="true"
                            className={cn(
                                'inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                                isActive ? 'bg-canvas text-ink' : 'bg-electric text-canvas'
                            )}
                        >
                            {pendingBookingsCount}
                        </span>
                        <span className="sr-only">
                            {` (${pendingBookingsCount} ${bookingsNounLower} menunggu tindak lanjut)`}
                        </span>
                    </>
                )}
            </Link>
        );
    };

    const subscriptionBadge =
        subscription && (!can || can.manage_settings) ? (
            <Link href={route('dashboard.billing')} className="inline-flex">
                <Badge variant={subscription.is_expired ? 'destructive' : subscription.is_trial ? 'popular' : 'secondary'}>
                    {subscription.is_expired
                        ? 'Paket Berakhir'
                        : subscription.is_trial
                            ? `Trial · ${subscription.days_remaining} hari`
                            : subscription.plan.name}
                </Badge>
            </Link>
        ) : null;

    return (
        <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke konten utama
            </a>

            {/* Desktop Full-Bleed Sidebar (lg+) */}
            <aside
                aria-label="Navigasi Dashboard"
                className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:bg-canvas"
            >
                <div className="flex h-16 shrink-0 items-center border-b border-divider px-5">
                    <Link
                        href={route('dashboard')}
                        aria-label="Beranda Dashboard Janjiyan"
                        className="inline-flex items-center rounded-full px-1 py-1 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                        <JanjiyanLogo size="sm" />
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                    <div className="space-y-1">{operationalNav.map(renderSidebarNavItem)}</div>

                    {configNav.length > 0 && (
                        <>
                            <div className="my-3 border-t border-divider" />
                            <div className="space-y-1">{configNav.map(renderSidebarNavItem)}</div>
                        </>
                    )}
                </div>
            </aside>

            {/* Mobile / Tablet Top Bar (< lg) */}
            <header className="sticky top-0 z-40 border-b border-divider bg-canvas/95 pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:backdrop-blur-md lg:hidden">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
                        <Link
                            href={route('dashboard')}
                            aria-label="Beranda Dashboard Janjiyan"
                            className="-ml-1.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none sm:ml-0 sm:w-auto sm:px-1"
                        >
                            <JanjiyanLogo size="sm" compactMobile />
                        </Link>

                        {renderBusinessSwitcher(
                            'inline-flex h-10 max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-bone px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none sm:max-w-[260px] sm:gap-2 sm:px-4'
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                        {activeBusiness && (
                            <>
                                {renderPortalShareDropdown(
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        aria-label={
                                            copiedLink
                                                ? 'Link booking tersalin ke clipboard'
                                                : `Bagikan link booking ${activeBusiness.name}`
                                        }
                                        className="sm:hidden"
                                    >
                                        {copiedLink ? (
                                            <Check className="size-4 text-success" aria-hidden="true" />
                                        ) : (
                                            <Share2 className="size-4" aria-hidden="true" />
                                        )}
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setQrOpen(true)}
                                    aria-label={`Tampilkan QR Poster booking ${activeBusiness.name}`}
                                    className="hidden h-10 px-3.5 sm:inline-flex"
                                >
                                    <QrCode className="size-3.5" aria-hidden="true" />
                                </Button>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={copyPublicBookingLink}
                                    aria-label={
                                        copiedLink
                                            ? 'Link booking tersalin ke clipboard'
                                            : `Salin link booking ${activeBusiness.name}`
                                    }
                                    className="hidden h-10 px-3.5 sm:inline-flex"
                                >
                                    {copiedLink ? (
                                        <Check className="size-3.5 text-success" aria-hidden="true" />
                                    ) : (
                                        <Copy className="size-3.5" aria-hidden="true" />
                                    )}
                                </Button>

                                <Button asChild variant="outline" size="sm" className="hidden h-10 px-4 sm:inline-flex">
                                    <a
                                        href={activePublicUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label={`Buka link booking ${activeBusiness.name} di tab baru`}
                                    >
                                        <span>Link Booking</span>
                                        <ExternalLink className="size-3.5" aria-hidden="true" />
                                    </a>
                                </Button>
                            </>
                        )}

                        <NotificationBell
                            initialUnreadCount={unreadNotificationsCount}
                            activeBusinessId={activeBusiness?.id ?? null}
                            triggerClassName="size-10"
                        />

                        {renderAccountMenu(
                            'inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-bone text-xs font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none'
                        )}
                    </div>
                </div>
            </header>

            <div className="flex min-w-0 flex-col lg:border-l lg:border-divider">
                {/* Desktop Topbar (lg+) */}
                <header className="sticky top-0 z-40 hidden h-16 shrink-0 items-center justify-between gap-4 border-b border-divider bg-canvas/95 px-6 supports-[backdrop-filter]:backdrop-blur-md lg:flex">
                    <div className="flex min-w-0 items-center gap-3">
                        {renderBusinessSwitcher(
                            'inline-flex h-9 max-w-[300px] min-w-0 cursor-pointer items-center gap-2 rounded-full bg-bone px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none'
                        )}
                        {subscriptionBadge}
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                        {activeBusiness &&
                            renderPortalShareDropdown(
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    aria-label={
                                        copiedLink
                                            ? 'Link booking tersalin ke clipboard'
                                            : `Menu portal booking ${activeBusiness.name}`
                                    }
                                    className="h-9 gap-1.5 border-hairline px-3.5 text-xs font-semibold"
                                >
                                    {copiedLink ? (
                                        <Check className="size-3.5 text-success" aria-hidden="true" />
                                    ) : (
                                        <Share2 className="size-3.5 text-mute" aria-hidden="true" />
                                    )}
                                    <span>{copiedLink ? 'Link Tersalin' : 'Portal Booking'}</span>
                                    <ChevronDown className="size-3.5 text-mute" aria-hidden="true" />
                                </Button>
                            )}

                        <NotificationBell
                            initialUnreadCount={unreadNotificationsCount}
                            activeBusinessId={activeBusiness?.id ?? null}
                            triggerClassName="size-9"
                        />

                        {renderAccountMenu(
                            'inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-bone text-xs font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none'
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <main
                    id="main-content"
                    tabIndex={-1}
                    className="mx-auto w-full max-w-7xl min-w-0 flex-1 space-y-4 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none sm:space-y-6 sm:px-6 sm:pt-6 lg:max-w-[1360px] lg:px-6 lg:py-7 lg:pb-12"
                >
                    <div role="status" aria-live="polite" className="sr-only">
                        {copiedLink ? 'Link booking bisnis berhasil disalin ke clipboard.' : ''}
                    </div>
                    <div>
                        {back && (
                            <Link
                                href={back.href}
                                className="-ml-2 mb-1 inline-flex min-h-10 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-mute transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <ArrowLeft className="size-4" aria-hidden="true" />
                                {back.label}
                            </Link>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
                            <h1 className="min-w-0 text-2xl leading-tight font-semibold text-balance text-ink sm:text-[26px] lg:text-3xl">{title}</h1>
                            {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
                        </div>
                    </div>

                    {activeBusiness?.is_suspended && (
                        <div
                            role="alert"
                            className="flex flex-col justify-between gap-3 rounded-md border border-destructive/20 bg-destructive-soft px-4 py-3.5 text-sm text-destructive sm:flex-row sm:items-center sm:px-5 sm:py-4"
                        >
                            <div>
                                <p className="font-semibold">Bisnis ini sedang ditangguhkan oleh administrator.</p>
                                {activeBusiness.suspension_reason && (
                                    <p className="mt-0.5 text-xs">Alasan: {activeBusiness.suspension_reason}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {subscription?.is_expired && (
                        <div
                            role="alert"
                            className="flex flex-col justify-between gap-3 rounded-md border border-destructive/20 bg-destructive-soft px-4 py-3.5 text-sm text-destructive sm:flex-row sm:items-center sm:px-5 sm:py-4"
                        >
                            <div>
                                <p className="font-semibold">Masa trial atau paket langganan Anda telah berakhir.</p>
                                <p className="mt-0.5 text-xs">
                                    Data tetap dapat dilihat, namun pembuatan booking baru, layanan, staff, dan export dinonaktifkan hingga paket diperpanjang.
                                </p>
                            </div>
                            {!can || can.manage_settings ? (
                                <Button asChild size="sm" className="shrink-0">
                                    <Link href={route('dashboard.billing')}>Perpanjang Sekarang</Link>
                                </Button>
                            ) : (
                                <p className="shrink-0 text-xs font-semibold">Hubungi pemilik bisnis untuk memperpanjang.</p>
                            )}
                        </div>
                    )}

                    {children}
                </main>
            </div>

            {/* Mobile/tablet bottom navigation */}
            <nav
                aria-label="Navigasi Dashboard"
                className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-canvas/95 pb-[env(safe-area-inset-bottom)] supports-[backdrop-filter]:backdrop-blur-md lg:hidden"
            >
                <div
                    className="mx-auto grid max-w-xl px-1"
                    style={{ gridTemplateColumns: `repeat(${bottomNav.length + (secondaryNav.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}
                >
                    {bottomNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = isNavActive(item.routeName);
                        const showQueueCount = item.routeName === 'dashboard.bookings' && pendingBookingsCount > 0;
                        const mobileLabel = item.mobileLabel ?? item.label;
                        const queueBadgeText = pendingBookingsCount > 99 ? '99+' : pendingBookingsCount;

                        return (
                            <Link
                                key={item.routeName}
                                href={route(item.routeName)}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'relative flex min-h-16 min-w-0 flex-col items-center justify-start gap-1 pt-2 pb-1.5 text-[10px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-inset min-[360px]:text-[11px]',
                                    isActive ? 'text-ink' : 'text-mute hover:text-ink'
                                )}
                            >
                                <span
                                    className={cn(
                                        'relative inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
                                        isActive && 'bg-ink text-canvas'
                                    )}
                                >
                                    <Icon className="size-[18px]" aria-hidden="true" />
                                    {showQueueCount && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute -top-1 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-electric px-1 text-[10px] leading-4 font-semibold text-canvas ring-2 ring-canvas tabular-nums"
                                        >
                                            {queueBadgeText}
                                        </span>
                                    )}
                                </span>
                                {mobileLabel !== item.label ? (
                                    <>
                                        <span aria-hidden="true" className="max-w-full truncate px-0.5 text-center leading-tight min-[360px]:px-1">
                                            {mobileLabel}
                                        </span>
                                        <span className="sr-only">{item.label}</span>
                                    </>
                                ) : (
                                    <span className="max-w-full truncate px-0.5 text-center leading-tight min-[360px]:px-1">{mobileLabel}</span>
                                )}
                                {showQueueCount && (
                                    <span className="sr-only">
                                        {` (${pendingBookingsCount} ${bookingsNounLower} menunggu tindak lanjut)`}
                                    </span>
                                )}
                            </Link>
                        );
                    })}

                    {secondaryNav.length > 0 && (
                        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
                            <SheetTrigger asChild>
                                <button
                                    type="button"
                                    aria-current={moreActive ? 'page' : undefined}
                                    className={cn(
                                        'flex min-h-16 min-w-0 cursor-pointer flex-col items-center justify-start gap-1 pt-2 pb-1.5 text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-inset',
                                        moreActive ? 'text-ink' : 'text-mute hover:text-ink'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
                                            moreActive && 'bg-ink text-canvas'
                                        )}
                                    >
                                        <Menu className="size-[18px]" aria-hidden="true" />
                                    </span>
                                    <span className="max-w-full truncate px-1 text-center leading-tight">Lainnya</span>
                                </button>
                            </SheetTrigger>
                            <SheetContent
                                side="bottom"
                                className="max-h-[85dvh] gap-2 overflow-y-auto overscroll-contain rounded-t-md border-t border-divider px-0 pt-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
                            >
                                <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-hairline" />
                                <SheetHeader className="pt-2 pr-12 pb-1 pl-5 text-left">
                                    <SheetTitle className="text-base font-semibold text-ink">Menu lainnya</SheetTitle>
                                    <SheetDescription className="sr-only">Halaman dashboard lainnya</SheetDescription>
                                </SheetHeader>
                                <div className="grid gap-1 px-3">
                                    {secondaryNav.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = isNavActive(item.routeName);
                                        const showPlanBadge = item.routeName === 'dashboard.billing' && Boolean(subscription);

                                        return (
                                            <Link
                                                key={item.routeName}
                                                href={route(item.routeName)}
                                                aria-current={isActive ? 'page' : undefined}
                                                onClick={() => setMoreOpen(false)}
                                                className={cn(
                                                    'flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                    isActive ? 'bg-ink text-canvas' : 'text-ink hover:bg-bone'
                                                )}
                                            >
                                                <span className="flex min-w-0 items-center gap-3">
                                                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                                                    <span className="truncate">{item.label}</span>
                                                </span>
                                                {showPlanBadge && subscription ? (
                                                    <Badge
                                                        variant={
                                                            subscription.is_expired
                                                                ? 'destructive'
                                                                : subscription.is_trial
                                                                  ? 'popular'
                                                                  : 'secondary'
                                                        }
                                                        className="shrink-0"
                                                    >
                                                        {subscription.is_expired
                                                            ? 'Berakhir'
                                                            : subscription.is_trial
                                                              ? `Trial · ${subscription.days_remaining}h`
                                                              : subscription.plan.name}
                                                    </Badge>
                                                ) : (
                                                    <ChevronRight
                                                        className={cn('size-4 shrink-0', isActive ? 'text-canvas/80' : 'text-stone')}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}
                </div>
            </nav>

            {activeBusiness && (
                <QrPosterDialog
                    open={qrOpen}
                    onOpenChange={setQrOpen}
                    businessName={activeBusiness.name}
                    businessCategory={activeBusiness.category}
                    businessSlug={activeBusiness.slug}
                    publicUrl={activePublicUrl}
                    businessType={activeBusiness.business_type}
                    qrSubtitle={activeBusiness.qr_poster_subtitle}
                    canSaveSubtitle={
                        !!activeBusiness.can?.manage_settings
                    }
                />
            )}
        </div>
    );
}
