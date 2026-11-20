import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    BadgePercent,
    CalendarDays,
    Check,
    ChevronDown,
    Clock,
    Copy,
    CreditCard,
    ExternalLink,
    LayoutDashboard,
    LogOut,
    Menu,
    Plus,
    QrCode,
    Scissors,
    Settings,
    Share2,
    ShieldAlert,
    User as UserIcon,
    Users,
    UserSquare2,
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
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
const NAV_ITEMS: { label: string; routeName: string; icon: typeof Settings; need?: BusinessPermission[] }[] = [
    { label: 'Ringkasan', routeName: 'dashboard', icon: LayoutDashboard },
    { label: 'Reservasi', routeName: 'dashboard.bookings', icon: CalendarDays },
    { label: 'Layanan', routeName: 'dashboard.services', icon: Scissors, need: ['manage_services'] },
    { label: 'Jadwal & Libur', routeName: 'dashboard.schedule', icon: Clock, need: ['manage_settings'] },
    { label: 'Tim & Staff', routeName: 'dashboard.staff', icon: UserSquare2, need: ['manage_staff'] },
    { label: 'Komisi Staff', routeName: 'dashboard.commissions', icon: BadgePercent, need: ['manage_staff'] },
    { label: 'Pelanggan', routeName: 'dashboard.customers', icon: Users, need: ['manage_bookings'] },
    { label: 'Pengaturan', routeName: 'dashboard.settings', icon: Settings, need: ['manage_settings'] },
    { label: 'Paket & Billing', routeName: 'dashboard.billing', icon: CreditCard, need: ['manage_settings'] },
];

// Mobile/tablet bottom bar shows these; the rest live in the "Lainnya" sheet.
const PRIMARY_NAV = ['dashboard', 'dashboard.bookings', 'dashboard.services', 'dashboard.customers'];

// Sub-pages (create/edit/show) keep their section active; 'dashboard.*' would match every page.
const isNavActive = (routeName: string) =>
    route().current(routeName) || (routeName !== 'dashboard' && route().current(`${routeName}.*`));

export default function DashboardLayout({ title, children, back, actions }: DashboardLayoutProps) {
    const { auth, activeBusiness, businesses, subscription, pendingBookingsCount = 0, flash } =
        usePage<PageProps>().props;
    const [qrOpen, setQrOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const can = activeBusiness?.can;
    // No active business yet (new account): nothing to restrict.
    const navItems = NAV_ITEMS.filter((item) => !can || !item.need || item.need.some((p) => can[p]));
    // Bottom bar holds 5 slots: show everything when it fits, else 4 items plus "Lainnya".
    const orderedNav = [
        ...navItems.filter((item) => PRIMARY_NAV.includes(item.routeName)),
        ...navItems.filter((item) => !PRIMARY_NAV.includes(item.routeName)),
    ];
    const bottomNav = orderedNav.length <= 5 ? orderedNav : orderedNav.slice(0, 4);
    const secondaryNav = orderedNav.length <= 5 ? [] : orderedNav.slice(4);
    const moreActive = secondaryNav.some((item) => isNavActive(item.routeName));
    const [copiedLink, setCopiedLink] = useState(false);

    const copyPublicBookingLink = () => {
        if (!activeBusiness || typeof window === 'undefined') return;
        const url = `${window.location.origin}/b/${activeBusiness.slug}`;
        navigator.clipboard?.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleSwitch = (businessId: number) => {
        router.post(route('dashboard.businesses.switch'), { business_id: businessId });
    };

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke konten utama
            </a>

            {/* Top Bar */}
            <header className="sticky top-0 z-40 border-b border-divider bg-canvas">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                        <Link
                            href={route('dashboard')}
                            aria-label="Beranda Dashboard Janjiyan"
                            className="inline-flex min-h-9 shrink-0 items-center rounded-full px-1 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            <JanjiyanLogo size="sm" compactMobile />
                        </Link>

                        {/* Multi-Business Switcher */}
                        {activeBusiness && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`Pilih bisnis aktif: ${activeBusiness.name}`}
                                        className="inline-flex h-9 max-w-[220px] min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-bone px-3 text-xs font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none sm:h-10 sm:max-w-[260px] sm:gap-2 sm:px-4 sm:text-sm lg:max-w-[320px]"
                                    >
                                        <span className="truncate">{activeBusiness.name}</span>
                                        <ChevronDown className="size-3.5 shrink-0 text-mute sm:size-4" aria-hidden="true" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-64 rounded-md border-hairline-soft p-2 shadow-none">
                                    {businesses.map((b) => (
                                        <DropdownMenuItem
                                            key={b.id}
                                            onClick={() => handleSwitch(b.id)}
                                            className={cn(
                                                'cursor-pointer rounded-xl px-3 py-2 text-sm',
                                                b.id === activeBusiness.id && 'bg-bone font-semibold'
                                            )}
                                        >
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate">{b.name}</span>
                                                <span className="truncate text-xs text-mute">/b/{b.slug}</span>
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        asChild
                                        className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-electric"
                                    >
                                        <Link href={route('dashboard.businesses.create')}>
                                            <Plus className="mr-1.5 size-4" />
                                            Tambah Bisnis Baru
                                        </Link>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
                        {/* Plan status is billing info: only owners/managers can open or need it. */}
                        {subscription && (!can || can.manage_settings) && (
                            <Link href={route('dashboard.billing')} className="hidden lg:inline-flex">
                                <Badge variant={subscription.is_expired ? 'destructive' : subscription.is_trial ? 'popular' : 'secondary'}>
                                    {subscription.is_expired
                                        ? 'Paket Berakhir'
                                        : subscription.is_trial
                                            ? `Trial · ${subscription.days_remaining} hari`
                                            : subscription.plan.name}
                                </Badge>
                            </Link>
                        )}

                        {activeBusiness && (
                            <>
                                {/* Mobile: one share menu instead of three icon buttons, so the business name has room */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            aria-label={`Bagikan link booking ${activeBusiness.name}`}
                                            className="size-9 px-0 sm:hidden"
                                        >
                                            <Share2 className="size-4" aria-hidden="true" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 rounded-md border-hairline-soft p-2 shadow-none">
                                        <DropdownMenuItem
                                            onClick={copyPublicBookingLink}
                                            className="cursor-pointer rounded-xl px-3 py-2 text-sm text-ink"
                                        >
                                            <Copy className="mr-2 size-4" aria-hidden="true" />
                                            Salin Link Booking
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2 text-sm text-ink">
                                            <a href={`/b/${activeBusiness.slug}`} target="_blank" rel="noreferrer">
                                                <ExternalLink className="mr-2 size-4" aria-hidden="true" />
                                                Buka Link Booking
                                            </a>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setQrOpen(true)}
                                            className="cursor-pointer rounded-xl px-3 py-2 text-sm text-ink"
                                        >
                                            <QrCode className="mr-2 size-4" aria-hidden="true" />
                                            QR Poster
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setQrOpen(true)}
                                    aria-label={`Tampilkan QR Poster booking ${activeBusiness.name}`}
                                    className="hidden h-10 px-3.5 sm:inline-flex"
                                >
                                    <QrCode className="size-3.5" aria-hidden="true" />
                                    <span className="hidden lg:inline">QR Poster</span>
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
                                    <span className="hidden lg:inline">
                                        {copiedLink ? 'Tersalin' : 'Salin Link'}
                                    </span>
                                </Button>

                                <Button asChild variant="outline" size="sm" className="hidden h-10 px-4 sm:inline-flex">
                                    <a
                                        href={`/b/${activeBusiness.slug}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        aria-label={`Buka link booking ${activeBusiness.name} di tab baru`}
                                    >
                                        <span className="hidden sm:inline">Link Booking</span>
                                        <ExternalLink className="size-3.5" aria-hidden="true" />
                                    </a>
                                </Button>
                            </>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={`Menu akun ${auth.user?.name ?? ''}`}
                                    className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-bone text-xs font-semibold text-ink transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none sm:size-10"
                                >
                                    {auth.user?.name.slice(0, 2).toUpperCase()}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-md border-hairline-soft p-2 shadow-none">
                                <div className="px-3 py-2">
                                    <p className="text-sm font-semibold text-ink">{auth.user?.name}</p>
                                    <p className="truncate text-xs text-mute">{auth.user?.email}</p>
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2 text-sm text-ink">
                                    <Link href={route('dashboard.profile')}>
                                        <UserIcon className="mr-2 size-4" aria-hidden="true" />
                                        Profil & Kata Sandi
                                    </Link>
                                </DropdownMenuItem>
                                {auth.user?.is_superadmin && (
                                    <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-electric">
                                        <Link href={route('admin.index')}>
                                            <ShieldAlert className="mr-2 size-4" aria-hidden="true" />
                                            Panel Superadmin
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={() => router.post(route('logout'))}
                                    className="cursor-pointer rounded-xl px-3 py-2 text-sm text-destructive focus:bg-destructive-soft focus:text-destructive"
                                >
                                    <LogOut className="mr-2 size-4" aria-hidden="true" />
                                    Keluar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-4 pt-4 pb-28 sm:gap-6 sm:px-6 sm:pt-6 lg:grid-cols-[220px_1fr] lg:gap-8 lg:py-8">
                {/* Sidebar Nav */}
                <aside aria-label="Navigasi Dashboard" className="hidden flex-col gap-1.5 lg:flex">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = isNavActive(item.routeName);
                        const showQueueCount = item.routeName === 'dashboard.bookings' && pendingBookingsCount > 0;

                        return (
                            <Link
                                key={item.routeName}
                                href={route(item.routeName)}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'inline-flex shrink-0 items-center justify-between gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none',
                                    isActive
                                        ? 'bg-ink text-canvas'
                                        : 'text-mute hover:bg-bone hover:text-ink'
                                )}
                            >
                                <span className="inline-flex items-center gap-2.5">
                                    <Icon className="size-4" aria-hidden="true" />
                                    <span>{item.label}</span>
                                </span>
                                {showQueueCount && (
                                    <span
                                        aria-label={`${pendingBookingsCount} reservasi menunggu tindak lanjut`}
                                        className={cn(
                                            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                                            isActive ? 'bg-canvas text-ink' : 'bg-electric text-canvas'
                                        )}
                                    >
                                        {pendingBookingsCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </aside>

                {/* Main Content */}
                <main id="main-content" tabIndex={-1} className="min-w-0 space-y-4 outline-none sm:space-y-6">
                    <div role="status" aria-live="polite" className="sr-only">
                        {copiedLink ? 'Link booking bisnis berhasil disalin ke clipboard.' : ''}
                    </div>
                    <div>
                        {back && (
                            <Link
                                href={back.href}
                                className="-ml-1 mb-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-mute transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                            >
                                <ArrowLeft className="size-4" aria-hidden="true" />
                                {back.label}
                            </Link>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="min-w-0 text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
                            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                        </div>
                    </div>

                    {activeBusiness?.is_suspended && (
                        <div
                            role="alert"
                            className="flex flex-col justify-between gap-3 rounded-md border border-destructive/20 bg-destructive-soft px-5 py-4 text-sm text-destructive sm:flex-row sm:items-center"
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
                            className="flex flex-col justify-between gap-3 rounded-md border border-destructive/20 bg-destructive-soft px-5 py-4 text-sm text-destructive sm:flex-row sm:items-center"
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

                    {flash.success && (
                        <div role="status" className="rounded-sm bg-bone px-4 py-3 text-sm font-semibold text-ink">
                            {flash.success}
                        </div>
                    )}
                    {flash.error && (
                        <div role="alert" className="rounded-sm bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
                            {flash.error}
                        </div>
                    )}

                    {children}
                </main>
            </div>

            {/* Mobile/tablet bottom navigation */}
            <nav
                aria-label="Navigasi Dashboard"
                className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-canvas pb-[env(safe-area-inset-bottom)] lg:hidden"
            >
                <div
                    className="mx-auto grid max-w-xl"
                    style={{ gridTemplateColumns: `repeat(${bottomNav.length + (secondaryNav.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}
                >
                    {bottomNav.map((item) => {
                        const Icon = item.icon;
                        const isActive = isNavActive(item.routeName);
                        const showQueueCount = item.routeName === 'dashboard.bookings' && pendingBookingsCount > 0;

                        return (
                            <Link
                                key={item.routeName}
                                href={route(item.routeName)}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-inset',
                                    isActive ? 'text-ink' : 'text-mute hover:text-ink'
                                )}
                            >
                                <span
                                    className={cn(
                                        'relative inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                                        isActive && 'bg-ink text-canvas'
                                    )}
                                >
                                    <Icon className="size-[18px]" aria-hidden="true" />
                                    {showQueueCount && (
                                        <span
                                            aria-label={`${pendingBookingsCount} reservasi menunggu tindak lanjut`}
                                            className="absolute -top-1 right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-electric px-1 text-[10px] leading-4 font-semibold text-canvas tabular-nums"
                                        >
                                            {pendingBookingsCount}
                                        </span>
                                    )}
                                </span>
                                {item.label}
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
                                        'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-inset',
                                        moreActive ? 'text-ink' : 'text-mute hover:text-ink'
                                )}
                            >
                                <span
                                    className={cn(
                                        'inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                                        moreActive && 'bg-ink text-canvas'
                                    )}
                                >
                                    <Menu className="size-[18px]" aria-hidden="true" />
                                </span>
                                Lainnya
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-md pb-[calc(1rem+env(safe-area-inset-bottom))]">
                            <SheetHeader className="pb-0">
                                <SheetTitle>Menu lainnya</SheetTitle>
                                <SheetDescription className="sr-only">Halaman dashboard lainnya</SheetDescription>
                            </SheetHeader>
                            <div className="grid gap-1 px-3">
                                {secondaryNav.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = isNavActive(item.routeName);
                                    return (
                                        <Link
                                            key={item.routeName}
                                            href={route(item.routeName)}
                                            aria-current={isActive ? 'page' : undefined}
                                            onClick={() => setMoreOpen(false)}
                                            className={cn(
                                                'flex min-h-12 items-center gap-3 rounded-sm px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none',
                                                isActive ? 'bg-ink text-canvas' : 'text-ink hover:bg-bone'
                                            )}
                                        >
                                            <Icon className="size-4" aria-hidden="true" />
                                            {item.label}
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
                    qrSubtitle={activeBusiness.qr_poster_subtitle}
                    canSaveSubtitle={
                        !!activeBusiness.can?.manage_settings
                    }
                />
            )}
        </div>
    );
}
