import { Head, Link, usePage } from '@inertiajs/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    BadgePercent,
    Calendar,
    Check,
    ChevronDown,
    Pause,
    Play,
    QrCode,
    ShieldCheck,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRupiah } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PageProps, SubscriptionPlan } from '@/types';

gsap.registerPlugin(ScrollTrigger);

interface LandingProps {
    plans: SubscriptionPlan[];
}

const VERTICALS = [
    'Barbershop',
    'Salon & Hair Studio',
    'Nail & Lash Studio',
    'Klinik Gigi',
    'Klinik Kecantikan',
    'Lapangan Padel',
    'Studio Foto',
    'Pilates & Yoga',
    'Pet Grooming',
    'Auto Detailing',
    'Ruang Meeting',
];

const OUTCOMES = [
    {
        icon: ShieldCheck,
        title: 'Lebih sedikit pelanggan yang tidak datang',
        desc: 'Setiap booking bisa dikunci dengan DP. Pelanggan transfer langsung ke rekening atau QRIS kamu. Kalau DP belum dibayar sampai batas waktunya, jam tersebut otomatis dibuka lagi untuk orang lain. Pelanggan yang sudah beberapa kali tidak datang bisa diwajibkan membayar DP penuh. Sehari sebelum jadwal dan dua jam sebelumnya, pelanggan mendapat email pengingat.',
        highlights: ['DP tanpa potongan', 'Jam dibuka lagi kalau DP tidak dibayar', 'DP penuh untuk yang sering tidak datang', 'Pengingat H-1 dan 2 jam sebelumnya'],
    },
    {
        icon: QrCode,
        title: 'Satu link untuk Instagram dan meja kasir',
        desc: 'Pasang link booking di bio, atau cetak Poster QR dari dashboard lalu tempel di meja kasir. Pelanggan bisa melihat foto hasil kerja kamu, memilih layanan dan staff, lalu booking. Mereka tidak perlu mengunduh aplikasi atau membuat akun.',
        highlights: ['Link booking sendiri', 'Poster QR siap cetak', 'Galeri foto hasil kerja', 'Pelanggan tidak perlu akun'],
    },
    {
        icon: Calendar,
        title: 'Jadwal semua staff dalam satu kalender',
        desc: 'Lihat booking hari ini untuk tiap staff, termasuk pelanggan walk-in, jeda antar sesi, shift, dan cuti. Setiap ada booking baru atau bukti DP masuk, kamu mendapat notifikasi di Telegram. Kalau perlu menghubungi pelanggan, sudah ada template pesan WhatsApp yang tinggal diklik.',
        highlights: ['Kalender per staff', 'Shift dan cuti', 'Template WhatsApp', 'Notifikasi Telegram'],
    },
    {
        icon: BadgePercent,
        title: 'Komisi staff dihitung otomatis',
        desc: 'Atur komisi tiap staff sekali saja, dalam persen atau nominal tetap. Setiap booking yang selesai langsung tercatat komisinya, jadi di akhir bulan kamu tidak perlu menghitung ulang dari catatan. Kamu juga bisa menandai pelanggan langganan, menyimpan catatan tentang mereka, dan mengelola sampai 10 cabang dari satu akun.',
        highlights: ['Komisi persen atau nominal', 'Laporan dan export CSV (paket Professional ke atas)', 'Catatan pelanggan', 'Sampai 10 cabang'],
    },
];

const INCLUDED_IN_ALL_PLANS = [
    'DP langsung ke rekening atau QRIS, tanpa potongan',
    'DP penuh otomatis untuk pelanggan yang sering tidak datang',
    'Email pengingat sehari dan dua jam sebelum jadwal',
    'Poster QR booking siap cetak',
    'Template pesan WhatsApp',
    'Notifikasi booking lewat Telegram',
    'Rekap komisi dan performa staff',
    'Simpan jadwal ke Google Calendar dan Apple Calendar',
];

const PLAN_TAGLINES: Record<string, string> = {
    basic: 'Cocok kalau kamu pemilik sekaligus yang melayani pelanggan.',
    professional: 'Cocok kalau kamu sudah punya beberapa staff dan perlu menghitung komisi mereka.',
    enterprise: 'Cocok kalau kamu punya lebih dari satu cabang.',
};

const STEPS = [
    'Daftar, lalu isi data bisnis kamu, termasuk rekening atau QRIS untuk menerima DP.',
    'Masukkan layanan, harga, durasi, besaran DP, dan staff yang melayani.',
    'Bagikan link booking kamu, atau cetak Poster QR dan tempel di meja kasir.',
];

const TESTIMONIALS = [
    {
        name: 'Raka Pratama',
        role: 'Founder, Barber Rapi Studio',
        quote: 'Dulu admin kami kewalahan membalas DM satu per satu. Sekarang pelanggan langsung pilih kapster dan jam kosong sendiri lewat link booking, dan rekap komisi staff tiap bulan jauh lebih cepat.',
    },
    {
        name: 'drg. Nadia Kusuma',
        role: 'Klinik Gigi Senopati',
        quote: 'Jeda 15 menit antar pasien membuat jadwal dokter tidak pernah bentrok lagi. Email pengingat H-1 dan H-2 jam juga terasa menurunkan pasien yang lupa jadwal kontrol.',
    },
    {
        name: 'Bima Santoso',
        role: 'Pengelola Ruang Padel Club',
        quote: 'DP lapangan langsung masuk ke rekening kami tanpa potongan perantara. Begitu ada bukti transfer masuk, notifikasi langsung muncul di grup Telegram admin.',
    },
    {
        name: 'Sinta Larasati',
        role: 'Owner, Lumiere Nail & Lash',
        quote: 'Satu akun cukup untuk memantau tiga cabang sekaligus. Data pelanggan VIP, catatan preferensi, jadwal staff, sampai rekening tiap cabang tetap tersimpan rapi dan terpisah.',
    },
];

const FAQS = [
    {
        q: 'Apakah Janjiyan mengambil potongan dari DP pelanggan?',
        a: 'Tidak. Pelanggan mentransfer DP langsung ke rekening atau QRIS bisnis kamu, lalu mengunggah bukti transfer di halaman invoice. Uangnya tidak melewati Janjiyan.',
    },
    {
        q: 'Apakah pelanggan harus mengunduh aplikasi atau membuat akun?',
        a: 'Tidak. Pelanggan cukup membuka link atau memindai Poster QR, memilih layanan dan jam, lalu mengisi nama dan nomor WhatsApp.',
    },
    {
        q: 'Bagaimana Janjiyan mengurangi pelanggan yang tidak datang?',
        a: 'Pertama, booking dikunci dengan DP dan ada batas waktu pembayaran. Kalau lewat, jamnya dibuka lagi. Kedua, pelanggan mendapat email pengingat sehari dan dua jam sebelum jadwal, dan bisa menyimpan jadwalnya ke Google Calendar atau Apple Calendar. Ketiga, nomor yang sudah beberapa kali tidak datang bisa otomatis diwajibkan membayar DP penuh, atau dibatasi untuk booking online.',
    },
    {
        q: 'Apakah komisi staff dihitung otomatis?',
        a: 'Ya. Kamu mengatur tarif komisi tiap staff sekali, dalam persen atau nominal tetap. Setiap booking mencatat komisinya dan semuanya terkumpul di halaman Komisi Staff. Export ke CSV tersedia di paket Professional dan Enterprise.',
    },
    {
        q: 'Notifikasi booking baru masuk ke mana?',
        a: 'Ke Telegram dan email kamu serta tim, setiap ada booking baru atau bukti DP yang diunggah. Untuk menghubungi pelanggan, ada tombol template WhatsApp di daftar booking.',
    },
    {
        q: 'Apakah satu akun bisa dipakai untuk beberapa cabang?',
        a: 'Bisa, sampai 10 cabang. Link booking, layanan, jadwal staff, data pelanggan, dan rekening tiap cabang tetap terpisah.',
    },
];

export default function Landing({ plans }: LandingProps) {
    const { auth } = usePage<PageProps>().props;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [marqueePaused, setMarqueePaused] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const pageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const root = pageRef.current;
        if (!root) return;

        const mm = gsap.matchMedia();

        mm.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.from('[data-hero-item]', {
                y: 12,
                opacity: 0,
                duration: 0.45,
                stagger: 0.06,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
            });

            const staggerGroups = [
                { selector: '[data-outcome-card]', trigger: '#fitur' },
                { selector: '[data-pricing-card]', trigger: '#harga' },
                { selector: '[data-testimonial-card]', trigger: '[data-testimonials-grid]' },
            ];

            for (const group of staggerGroups) {
                gsap.from(group.selector, {
                    y: 16,
                    opacity: 0,
                    duration: 0.5,
                    stagger: 0.07,
                    ease: 'power3.out',
                    clearProps: 'transform,opacity',
                    scrollTrigger: {
                        trigger: group.trigger,
                        start: 'top 82%',
                        once: true,
                    },
                });
            }
        });

        return () => mm.revert();
    }, []);

    return (
        <div ref={pageRef} className="min-h-screen bg-canvas text-ink">
            <Head title="Sistem booking dan DP untuk bisnis jasa">
                <meta
                    head-key="description"
                    name="description"
                    content="Pelanggan booking sendiri lewat link di bio Instagram atau Poster QR di meja kasir. DP masuk langsung ke rekening kamu tanpa potongan, dan pelanggan diingatkan sebelum datang. Gratis 14 hari."
                />
            </Head>

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke konten utama
            </a>

            {/* Floating Centered Nav Pill */}
            <header className="sticky top-4 z-50 px-3 sm:px-4">
                <nav
                    aria-label="Navigasi utama"
                    className={cn(
                        'mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 rounded-full border border-transparent bg-bone px-3 transition-shadow duration-200 sm:px-6',
                        scrolled && 'ring-1 ring-hairline'
                    )}
                >
                    <Link
                        href={route('home')}
                        className="inline-flex min-h-9 shrink-0 items-center rounded-full px-1 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                        aria-label="Beranda Janjiyan"
                    >
                        <JanjiyanLogo size="sm" compactMobile />
                    </Link>

                    <div className="hidden items-center gap-6 text-sm font-semibold md:flex">
                        <a href="#fitur" className="inline-flex min-h-8 items-center rounded-full px-1 text-ink transition-colors hover:text-mute focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none">
                            Fitur
                        </a>
                        <a href="#harga" className="inline-flex min-h-8 items-center rounded-full px-1 text-ink transition-colors hover:text-mute focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none">
                            Harga
                        </a>
                        <a href="#cara-mulai" className="inline-flex min-h-8 items-center rounded-full px-1 text-ink transition-colors hover:text-mute focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none">
                            Cara mulai
                        </a>
                        <a href="#faq" className="inline-flex min-h-8 items-center rounded-full px-1 text-ink transition-colors hover:text-mute focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none">
                            FAQ
                        </a>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {auth.user ? (
                            <Button asChild size="sm">
                                <Link href={route('dashboard')}>Dashboard</Link>
                            </Button>
                        ) : (
                            <>
                                <Button asChild variant="ghost" size="sm" className="px-3 sm:px-4">
                                    <Link href={route('login')}>Masuk</Link>
                                </Button>
                                <Button asChild size="sm" className="px-3.5 sm:px-4">
                                    <Link href={route('register')}>Coba gratis</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </nav>
            </header>

            <main id="main-content" tabIndex={-1} className="outline-none">
                {/* Hero Section */}
                <section className="mx-auto max-w-4xl px-5 pt-10 pb-12 text-center sm:px-6 sm:pt-20 sm:pb-20">
                    <div
                        data-hero-item
                        className="mb-6 inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-bone px-4 py-1.5 text-center text-xs font-semibold text-ink"
                    >
                        <span>Untuk barbershop, salon, klinik, dan studio</span>
                    </div>

                    <h1
                        data-hero-item
                        className="text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-6xl md:text-[72px] text-balance"
                    >
                        Pelanggan booking sendiri, kamu tidak perlu balas chat sampai malam.
                    </h1>

                    <p
                        data-hero-item
                        className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-mute sm:mt-6 sm:text-xl text-pretty"
                    >
                        Taruh link Janjiyan di bio Instagram atau tempel Poster QR di meja kasir. Pelanggan bisa lihat jam yang masih kosong, bayar DP ke rekening kamu, lalu dapat pengingat sebelum datang. Janjiyan tidak mengambil potongan dari DP itu.
                    </p>

                    <div
                        data-hero-item
                        className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
                    >
                        <Button asChild size="lg" className="w-full max-w-[240px] sm:w-auto">
                            <Link href={auth.user ? route('dashboard') : route('register')}>
                                Coba gratis 14 hari
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="lg" className="w-full max-w-[240px] sm:w-auto">
                            <a href="#fitur">
                                Lihat fiturnya
                            </a>
                        </Button>
                    </div>

                    <p
                        data-hero-item
                        className="mt-4 text-xs font-medium text-mute"
                    >
                        Gratis 14 hari. DP masuk utuh ke rekening kamu.
                    </p>
                </section>

                {/* Clean Monochrome Verticals Marquee */}
                <section aria-label="Kategori bisnis yang didukung" className="overflow-hidden py-8">
                    <div className="marquee-mask overflow-hidden">
                        <div className="animate-marquee flex gap-3" data-paused={marqueePaused ? 'true' : 'false'}>
                            {[...VERTICALS, ...VERTICALS].map((name, idx) => (
                                <div
                                    key={`${name}-${idx}`}
                                    aria-hidden={idx >= VERTICALS.length}
                                    className={cn(
                                        'rounded-full border border-hairline-soft bg-canvas px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-ink',
                                        idx >= VERTICALS.length && 'motion-reduce:hidden'
                                    )}
                                >
                                    {name}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-3 flex justify-center motion-reduce:hidden">
                        <button
                            type="button"
                            onClick={() => setMarqueePaused((p) => !p)}
                            aria-pressed={marqueePaused}
                            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-bone px-3 py-1 text-xs font-semibold text-mute transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            {marqueePaused ? (
                                <>
                                    <Play className="size-3" aria-hidden="true" />
                                    Putar daftar industri
                                </>
                            ) : (
                                <>
                                    <Pause className="size-3" aria-hidden="true" />
                                    Jeda daftar industri
                                </>
                            )}
                        </button>
                    </div>
                </section>

                {/* Cost of no-show */}
                <section className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
                    <h2 className="text-center text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                        Pelanggan yang tidak datang itu ada harganya.
                    </h2>
                    <div className="mt-8 rounded-[24px] bg-bone p-6 sm:p-8">
                        <p className="text-base leading-relaxed text-body sm:text-lg text-pretty">
                            Misalnya harga layanan kamu Rp75.000, dan dalam sehari ada satu pelanggan yang sudah booking tapi tidak datang. Dalam sebulan dengan 26 hari kerja, itu sekitar <strong className="font-semibold text-ink">Rp1.950.000</strong> yang hilang. Belum lagi pelanggan lain yang sempat kamu tolak karena jam itu sudah dipesan.
                        </p>
                        <p className="mt-4 text-base leading-relaxed text-body sm:text-lg text-pretty">
                            Sebagai perbandingan, paket Basic Janjiyan <strong className="font-semibold text-ink">Rp49.000 per bulan</strong>.
                        </p>
                        <p className="mt-4 text-xs text-mute">
                            Angka di atas hanya contoh. Hitungannya akan berbeda di tiap bisnis.
                        </p>
                    </div>
                </section>

                {/* 4 Outcome Cards (Grid 2x2) */}
                <section id="fitur" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
                    <div className="mx-auto mb-14 max-w-2xl text-center">
                        <h2 className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Apa saja yang dikerjakan Janjiyan
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-mute text-pretty">
                            Mulai dari pelanggan booking, bayar DP, diingatkan, sampai komisi staff dihitung di akhir bulan.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {OUTCOMES.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.title}
                                    data-outcome-card
                                    className="flex flex-col justify-between rounded-[24px] border border-hairline-soft bg-canvas p-6 transition-colors hover:border-hairline sm:p-8"
                                >
                                    <div>
                                        <div className="flex size-10 items-center justify-center rounded-[30%] bg-bone text-ink">
                                            <Icon className="size-5" aria-hidden="true" />
                                        </div>
                                        <h3 className="mt-5 text-2xl font-semibold leading-snug text-ink text-balance">
                                            {item.title}
                                        </h3>
                                        <p className="mt-3 text-sm leading-relaxed text-mute sm:text-base text-pretty">
                                            {item.desc}
                                        </p>
                                    </div>

                                    <div className="mt-6 flex flex-wrap gap-2 border-t border-divider pt-5">
                                        {item.highlights.map((chip) => (
                                            <span
                                                key={chip}
                                                className="rounded-full bg-bone px-3 py-1 text-xs font-medium text-ink"
                                            >
                                                {chip}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* How to start */}
                <section id="cara-mulai" className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
                    <h2 className="text-center text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                        Cara mulai pakai Janjiyan
                    </h2>
                    <ol className="mt-10 space-y-4">
                        {STEPS.map((step, idx) => (
                            <li key={step} className="flex items-start gap-4 rounded-[16px] border border-hairline-soft bg-canvas p-5">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bone text-sm font-semibold tabular-nums text-ink">
                                    {idx + 1}
                                </span>
                                <p className="pt-1 text-base leading-relaxed text-body text-pretty">{step}</p>
                            </li>
                        ))}
                    </ol>
                    <div className="mt-8 flex justify-center">
                        <Button asChild size="lg">
                            <Link href={auth.user ? route('dashboard') : route('register')}>Coba gratis 14 hari</Link>
                        </Button>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="harga" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
                    <div className="text-center">
                        <h2 className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Pilih paket sesuai ukuran bisnis kamu
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-mute text-pretty">
                            Semua paket bisa dicoba gratis selama 14 hari. Fitur DP, pengingat, dan perlindungan dari pelanggan yang tidak datang sudah ada sejak paket Basic.
                        </p>

                        {/* Segmented Control */}
                        <div className="mt-8 inline-flex min-h-12 max-w-full flex-wrap items-center justify-center rounded-full bg-bone p-1" role="group" aria-label="Siklus penagihan">
                            <button
                                type="button"
                                aria-pressed={billingCycle === 'monthly'}
                                onClick={() => setBillingCycle('monthly')}
                                className={cn(
                                    'min-h-10 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-5',
                                    billingCycle === 'monthly' ? 'bg-canvas text-ink' : 'text-mute hover:text-ink'
                                )}
                            >
                                Bulanan
                            </button>
                            <button
                                type="button"
                                aria-pressed={billingCycle === 'yearly'}
                                onClick={() => setBillingCycle('yearly')}
                                className={cn(
                                    'flex min-h-10 cursor-pointer flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-5',
                                    billingCycle === 'yearly' ? 'bg-canvas text-ink' : 'text-mute hover:text-ink'
                                )}
                            >
                                <span>Tahunan</span>
                                <span className="text-xs font-semibold text-electric">Gratis 2 bulan</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-12 grid gap-6 lg:grid-cols-3">
                        {plans.map((plan) => {
                            const isPopular = plan.slug === 'professional';
                            const price = billingCycle === 'monthly' ? plan.price_monthly : Math.round(plan.price_yearly / 12);

                            return (
                                <div
                                    key={plan.id}
                                    data-pricing-card
                                    className={cn(
                                        'flex flex-col justify-between rounded-[24px] p-6 transition-colors',
                                        isPopular ? 'bg-bone' : 'border border-hairline-soft bg-canvas hover:border-hairline'
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-2xl font-semibold text-charcoal">{plan.name}</h3>
                                            {isPopular && <Badge variant="popular">Rekomendasi</Badge>}
                                        </div>
                                        {PLAN_TAGLINES[plan.slug] && (
                                            <p className="mt-2 text-sm leading-relaxed text-mute text-pretty">{PLAN_TAGLINES[plan.slug]}</p>
                                        )}

                                        <div className="mt-5 flex items-baseline gap-1.5">
                                            <span className="text-4xl font-semibold tabular-nums text-ink">{formatRupiah(price)}</span>
                                            <span className="text-sm text-mute">/ bulan</span>
                                        </div>
                                        {billingCycle === 'yearly' && (
                                            <p className="mt-1 text-xs tabular-nums text-electric">
                                                Ditagih {formatRupiah(plan.price_yearly)} per tahun
                                            </p>
                                        )}

                                        <ul className="mt-6 space-y-3 text-sm text-body">
                                            <li className="flex items-center gap-2.5">
                                                <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_businesses ?? 'Unlimited'} Bisnis / cabang</span>
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_services_per_business ?? 'Unlimited'} Layanan per bisnis</span>
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_staff_per_business ?? 'Unlimited'} Staff</span>
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_bookings_per_month ?? 'Unlimited'} Booking per bulan</span>
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_customers_per_business?.toLocaleString('id-ID') ?? 'Unlimited'} Data pelanggan</span>
                                            </li>
                                            <li className="flex items-center gap-2.5">
                                                {plan.can_export_csv ? (
                                                    <>
                                                        <Check className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                                        <span className="text-body">Export CSV (Booking, CRM &amp; Komisi)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="size-4 shrink-0 text-mute" aria-hidden="true" />
                                                        <span className="text-mute line-through">
                                                            Export CSV (Booking, CRM &amp; Komisi)
                                                        </span>
                                                        <span className="sr-only">(Tidak tersedia di paket ini)</span>
                                                    </>
                                                )}
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="mt-8">
                                        <Button asChild variant={isPopular ? 'default' : 'outline'} className="w-full">
                                            <Link href={auth.user ? route('dashboard.billing') : route('register')}>
                                                Coba gratis
                                                <span className="sr-only"> paket {plan.name}</span>
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Included in All Plans Summary */}
                    <div className="mt-8 rounded-[24px] bg-bone p-6 sm:p-8">
                        <p className="text-sm font-semibold text-ink">
                            Sudah termasuk di semua paket
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {INCLUDED_IN_ALL_PLANS.map((feature) => (
                                <div key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-body">
                                    <Check className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden="true" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
                    <div className="mb-12 text-center">
                        <h2 className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Cerita dari pemilik usaha yang sudah memakai Janjiyan
                        </h2>
                    </div>

                    <div data-testimonials-grid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {TESTIMONIALS.map((t) => (
                            <div
                                key={t.name}
                                data-testimonial-card
                                className="flex flex-col justify-between rounded-[16px] border border-hairline-soft bg-canvas p-6 transition-colors hover:border-hairline"
                            >
                                <p className="text-sm leading-relaxed text-ink text-pretty">“{t.quote}”</p>
                                <div className="mt-6 flex items-center gap-3">
                                    <div className="flex size-9 items-center justify-center rounded-full bg-bone text-xs font-semibold text-ink">
                                        {t.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-ink">{t.name}</p>
                                        <p className="text-xs text-mute">{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* FAQ */}
                <section id="faq" className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
                    <h2 className="mb-10 text-center text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                        Pertanyaan yang sering ditanyakan
                    </h2>

                    <div className="space-y-3">
                        {FAQS.map((item, idx) => {
                            const isOpen = openFaq === idx;
                            const buttonId = `faq-trigger-${idx}`;
                            const panelId = `faq-panel-${idx}`;
                            return (
                                <div key={item.q} className="rounded-[16px] bg-bone p-4">
                                    <h3>
                                        <button
                                            id={buttonId}
                                            type="button"
                                            aria-expanded={isOpen}
                                            aria-controls={panelId}
                                            onClick={() => setOpenFaq(isOpen ? null : idx)}
                                            className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-[8px] text-start text-base font-semibold text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                                        >
                                            <span>{item.q}</span>
                                            <ChevronDown
                                                aria-hidden="true"
                                                className={cn(
                                                    'size-4 shrink-0 text-mute motion-safe:transition-transform',
                                                    isOpen && 'rotate-180'
                                                )}
                                            />
                                        </button>
                                    </h3>
                                    <div
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={buttonId}
                                        aria-hidden={!isOpen}
                                        className={cn(
                                            'grid duration-200 ease-out motion-safe:transition-[grid-template-rows,opacity] motion-reduce:transition-opacity',
                                            isOpen ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
                                        )}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="pt-3 text-sm leading-relaxed text-mute text-pretty">
                                                {item.a}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* Unified Closing CTA + Inverse Dark Footer */}
            <footer className="mt-16 rounded-t-[24px] bg-dark px-6 py-16 text-on-dark sm:px-12 sm:py-20">
                <div className="mx-auto max-w-6xl">
                    {/* Closing CTA Band */}
                    <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-14 md:flex-row md:items-center">
                        <div>
                            <h2 className="text-3xl font-semibold leading-tight text-on-dark sm:text-4xl text-balance">
                                Coba dulu 14 hari, gratis.
                            </h2>
                            <p className="mt-2.5 max-w-xl text-base text-on-dark-mute text-pretty">
                                Buat link booking pertama kamu hari ini, lalu lihat sendiri apakah Janjiyan cocok untuk bisnis kamu.
                            </p>
                        </div>
                        <Button
                            asChild
                            size="lg"
                            className="shrink-0 bg-canvas text-ink hover:bg-bone focus-visible:ring-on-dark focus-visible:ring-offset-dark"
                        >
                            <Link href={auth.user ? route('dashboard') : route('register')}>
                                Coba gratis 14 hari
                            </Link>
                        </Button>
                    </div>

                    {/* Footer Links */}
                    <div className="mt-14 flex flex-col justify-between gap-12 md:flex-row md:items-end">
                        <div>
                            <JanjiyanLogo dark size="lg" />
                            <p className="mt-4 max-w-md text-lg text-on-dark-mute">
                                Untuk janji temu yang ditepati.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-12 text-sm text-on-dark-mute">
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Produk</p>
                                <ul className="space-y-1">
                                    <li><a href="#fitur" className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Fitur</a></li>
                                    <li><a href="#harga" className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Harga</a></li>
                                    <li><a href="#faq" className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">FAQ</a></li>
                                </ul>
                            </div>
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Akun</p>
                                <ul className="space-y-1">
                                    <li><Link href={route('login')} className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Masuk</Link></li>
                                    <li><Link href={route('register')} className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Coba gratis</Link></li>
                                </ul>
                            </div>
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Legal</p>
                                <ul className="space-y-1">
                                    <li><Link href={route('legal.terms')} className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Syarat &amp; Ketentuan</Link></li>
                                    <li><Link href={route('legal.privacy')} className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Kebijakan Privasi</Link></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="mt-14 flex flex-col justify-between gap-4 border-t border-white/10 pt-8 text-xs text-on-dark-mute sm:flex-row">
                        <span>© {new Date().getFullYear()} Janjiyan. Seluruh hak cipta dilindungi.</span>
                        <span>Dibuat untuk pelaku usaha jasa di Indonesia.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
