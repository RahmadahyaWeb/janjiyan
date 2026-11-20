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
        title: 'Jadwal terkunci, minim batal mendadak',
        desc: 'Kunci setiap booking dengan DP lewat transfer rekening atau QRIS bisnis kamu. Kalau lewat batas bayar, jam tersebut otomatis dibuka lagi untuk orang lain. Yang sering tidak datang bisa langsung diwajibkan DP penuh, dan pengingat terkirim otomatis di H-1 serta 2 jam sebelum jadwal.',
        highlights: ['Kunci jadwal dengan DP', 'Jam dibuka lagi otomatis', 'Aturan DP penuh', 'Pengingat H-1 & H-2 jam'],
    },
    {
        icon: QrCode,
        title: 'Satu link di bio, satu QR di kasir',
        desc: 'Bagikan link booking di Instagram atau cetak poster QR langsung dari dashboard untuk meja kasir. Pengunjung bisa lihat portofolio hasil kerjamu, pilih layanan dan staff favorit, lalu booking tanpa perlu download aplikasi atau bikin akun.',
        highlights: ['Link booking siap pakai', 'Poster QR siap cetak', 'Galeri portofolio', 'Tanpa install aplikasi'],
    },
    {
        icon: Calendar,
        title: 'Kalender semua staff dalam satu layar',
        desc: 'Pantau jadwal harian tiap staff, termasuk tamu walk-in, jeda antar sesi, shift, dan cuti. Setiap ada booking baru atau bukti transfer masuk, notif langsung muncul di Telegram. Mau follow up? Tinggal klik template WhatsApp yang sudah disiapkan.',
        highlights: ['Kalender per staff', 'Atur shift & cuti', 'Notif Telegram', 'Template WhatsApp'],
    },
    {
        icon: BadgePercent,
        title: 'Komisi staff beres tanpa hitung manual',
        desc: 'Atur komisi tiap staff sekali di awal, mau pakai persentase atau nominal tetap. Setiap sesi selesai, komisinya langsung tercatat rapi, jadi akhir bulan tidak perlu buka catatan lagi. Tersedia juga catatan khusus pelanggan setia dan dukungan hingga 10 cabang dalam satu akun.',
        highlights: ['Komisi persen / nominal', 'Export CSV (Professional+)', 'Catatan pelanggan', 'Hingga 10 cabang'],
    },
];

const INCLUDED_IN_ALL_PLANS = [
    'Pembayaran DP via rekening atau QRIS sendiri',
    'Aturan DP penuh untuk yang sering no-show',
    'Pengingat email H-1 dan 2 jam sebelumnya',
    'Poster QR booking siap cetak',
    'Template chat WhatsApp siap klik',
    'Notifikasi booking via Telegram',
    'Rekap komisi & performa staff',
    'Simpan ke Google & Apple Calendar',
];

const PLAN_TAGLINES: Record<string, string> = {
    basic: 'Pas untuk kamu yang masih turun tangan melayani sendiri.',
    professional: 'Pas untuk tim dengan beberapa staff dan butuh rekap komisi otomatis.',
    enterprise: 'Pas untuk bisnis yang sudah punya banyak cabang.',
};

const STEPS = [
    'Daftar dan lengkapi profil bisnis, lengkap dengan rekening atau QRIS tujuan pembayaran.',
    'Atur daftar layanan, harga, durasi, aturan DP, serta jadwal staff kamu.',
    'Pasang link di bio media sosial atau cetak poster QR untuk meja kasir.',
];

const TESTIMONIALS = [
    {
        name: 'Raka Pratama',
        role: 'Founder, Barber Rapi Studio',
        quote: 'Dulu admin sering kewalahan balas DM satu-satu. Sekarang orang tinggal pilih kapster dan jam kosong sendiri lewat link di bio, rekap komisi bulanan juga langsung beres.',
    },
    {
        name: 'drg. Nadia Kusuma',
        role: 'Klinik Gigi Senopati',
        quote: 'Jeda 15 menit antar pasien bikin jadwal dokter tidak pernah bentrok lagi. Email pengingat H-1 dan 2 jam sebelumnya juga terasa banget bikin pasien jarang lupa jadwal kontrol.',
    },
    {
        name: 'Bima Santoso',
        role: 'Pengelola Ruang Padel Club',
        quote: 'Begitu penyewa unggah bukti DP, notifnya langsung masuk ke grup Telegram admin. Tidak perlu cek chat dan mutasi satu per satu di WhatsApp lagi.',
    },
    {
        name: 'Sinta Larasati',
        role: 'Owner, Lumiere Nail & Lash',
        quote: 'Satu akun sudah cukup buat pantau tiga cabang sekaligus. Data tamu VIP, catatan preferensi, jadwal terapis, sampai rekening tiap cabang tetap terpisah rapi.',
    },
];

const FAQS = [
    {
        q: 'Bagaimana sistem pembayaran DP di Janjiyan?',
        a: 'Pembayaran DP dilakukan lewat transfer ke rekening atau QRIS yang kamu pasang di profil bisnis, lalu bukti bayarnya diunggah di halaman invoice untuk kamu konfirmasi.',
    },
    {
        q: 'Apakah orang yang mau booking harus download aplikasi dulu?',
        a: 'Tidak perlu. Cukup buka link atau scan poster QR, pilih layanan dan jam yang tersedia, lalu isi nama dan nomor WhatsApp.',
    },
    {
        q: 'Bagaimana cara Janjiyan mencegah orang batal mendadak atau tidak datang?',
        a: 'Pertama, setiap jadwal bisa dikunci dengan DP dan batas waktu bayar. Kalau lewat, jamnya otomatis terbuka lagi. Kedua, ada pengingat email di H-1 dan 2 jam sebelum jadwal, plus tombol simpan ke Google atau Apple Calendar. Ketiga, nomor yang tercatat sering tidak datang bisa otomatis diwajibkan DP penuh atau dibatasi.',
    },
    {
        q: 'Apakah komisi staff dihitung otomatis?',
        a: 'Ya. Kamu cukup atur tarif komisi tiap staff sekali, bisa persen atau nominal tetap. Setiap booking selesai, komisinya langsung masuk ke rekap. Export CSV tersedia mulai paket Professional.',
    },
    {
        q: 'Notifikasi booking baru dikirim ke mana?',
        a: 'Langsung ke Telegram dan email kamu atau tim setiap ada booking baru maupun bukti transfer yang masuk. Untuk follow up, sudah ada tombol template WhatsApp di daftar booking.',
    },
    {
        q: 'Bisa dipakai untuk lebih dari satu cabang?',
        a: 'Bisa, hingga 10 cabang dalam satu akun. Link booking, layanan, jadwal staff, data tamu, dan rekening tiap cabang tetap terpisah.',
    },
];

export default function Landing({ plans }: LandingProps) {
    const { auth } = usePage<PageProps>().props;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [marqueePaused, setMarqueePaused] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [servicePrice, setServicePrice] = useState(75000);
    const [noShowsPerMonth, setNoShowsPerMonth] = useState(26);
    const pageRef = useRef<HTMLDivElement>(null);

    const monthlyLoss = servicePrice * noShowsPerMonth;
    const breakEvenBookings = Math.max(1, Math.ceil(49000 / servicePrice));

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
                    content="Atur janji temu lebih pasti lewat link di bio Instagram atau poster QR di meja kasir. Kelola booking, DP, pengingat otomatis, dan jadwal staff dalam satu tempat. Gratis 14 hari."
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
                        Janji temu lebih pasti.
                        <br />
                        Kelola bisnis lebih rapi.
                    </h1>

                    <p
                        data-hero-item
                        className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-mute sm:mt-6 sm:text-xl text-pretty"
                    >
                        Taruh link Janjiyan di bio Instagram atau tempel poster QR di meja kasir. Pengunjung tinggal pilih layanan, cek jam kosong, dan booking sendiri tanpa perlu repot balas chat satu per satu.
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
                        Coba gratis 14 hari. Bisa dibatalkan kapan saja.
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
                <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Satu orang tidak jadi datang, satu jadwal ikut terbuang.
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-mute sm:text-lg text-pretty">
                            Geser sesuai tarif rata-rata layananmu untuk lihat berapa pemasukan yang hilang tiap bulan saat jadwal batal tanpa kabar.
                        </p>
                    </div>

                    <div className="mt-10 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-8">
                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <label htmlFor="calc-service-price" className="text-sm font-medium text-body">
                                        Tarif rata-rata layanan
                                    </label>
                                    <span className="text-base font-semibold tabular-nums text-ink">
                                        {formatRupiah(servicePrice)}
                                    </span>
                                </div>
                                <div className="relative mt-1 flex h-11 items-center">
                                    <div aria-hidden="true" className="pointer-events-none h-2 w-full rounded-full bg-bone" />
                                    <input
                                        id="calc-service-price"
                                        type="range"
                                        min={25000}
                                        max={500000}
                                        step={5000}
                                        value={servicePrice}
                                        onChange={(e) => setServicePrice(Number(e.target.value))}
                                        className="absolute inset-0 h-11 w-full cursor-pointer rounded-full bg-transparent accent-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                                    />
                                </div>
                                <div className="flex justify-between text-xs tabular-nums text-mute">
                                    <span>Rp25.000</span>
                                    <span>Rp500.000</span>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <label htmlFor="calc-no-shows" className="text-sm font-medium text-body">
                                        Batal tanpa kabar per bulan
                                    </label>
                                    <span className="text-base font-semibold tabular-nums text-ink">
                                        {noShowsPerMonth} kali
                                    </span>
                                </div>
                                <div className="relative mt-1 flex h-11 items-center">
                                    <div aria-hidden="true" className="pointer-events-none h-2 w-full rounded-full bg-bone" />
                                    <input
                                        id="calc-no-shows"
                                        type="range"
                                        min={2}
                                        max={40}
                                        step={1}
                                        value={noShowsPerMonth}
                                        onChange={(e) => setNoShowsPerMonth(Number(e.target.value))}
                                        className="absolute inset-0 h-11 w-full cursor-pointer rounded-full bg-transparent accent-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                                    />
                                </div>
                                <div className="flex justify-between text-xs tabular-nums text-mute">
                                    <span>2 kali</span>
                                    <span>40 kali</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <div className="flex min-w-0 flex-col justify-between rounded-sm bg-bone p-4 sm:p-6">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                                        Potensi pendapatan hilang
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className="text-2xl font-semibold tabular-nums text-ink sm:text-4xl">
                                            {formatRupiah(monthlyLoss)}
                                        </span>
                                        <span className="text-sm text-mute">/ bulan</span>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs leading-relaxed text-body">
                                    Hitungan dari {noShowsPerMonth} jadwal × {formatRupiah(servicePrice)}, belum termasuk tamu lain yang sempat ditolak karena jamnya terisi.
                                </p>
                            </div>

                            <div className="flex min-w-0 flex-col justify-between rounded-sm bg-dark p-4 text-on-dark sm:p-6">
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-on-dark-mute">
                                            Paket Basic Janjiyan
                                        </p>
                                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-on-dark">
                                            Balik modal dari {breakEvenBookings} booking
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className="text-2xl font-semibold tabular-nums text-on-dark sm:text-4xl">
                                            Rp49.000
                                        </span>
                                        <span className="text-sm text-on-dark-mute">/ bulan</span>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs leading-relaxed text-on-dark-mute">
                                    Kunci jadwal dengan DP dan kirim pengingat otomatis sebelum tamu datang.
                                </p>
                            </div>
                        </div>

                        <p className="mt-5 text-center text-xs text-mute">
                            Angka di atas hanya simulasi. Hitungannya tentu berbeda di tiap bisnis.
                        </p>
                    </div>
                </section>

                {/* 4 Outcome Cards (Grid 2x2) */}
                <section id="fitur" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto mb-14 max-w-2xl text-center">
                        <h2 className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Yang beres otomatis pakai Janjiyan
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-mute text-pretty">
                            Dari pilih jadwal, kunci DP, pengingat otomatis, sampai hitung komisi staff di akhir bulan.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {OUTCOMES.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.title}
                                    data-outcome-card
                                    className="flex min-w-0 flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-5 transition-colors hover:border-hairline sm:p-8"
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
                <section id="cara-mulai" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                    <h2 className="text-center text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                        Tiga langkah, langsung jalan
                    </h2>
                    <ol className="mt-10 space-y-4">
                        {STEPS.map((step, idx) => (
                            <li key={step} className="flex items-start gap-4 rounded-sm border border-hairline-soft bg-canvas p-5">
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
                <section id="harga" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
                    <div className="text-center">
                        <h2 className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Pilih paket yang pas buat bisnismu
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-mute text-pretty">
                            Coba gratis 14 hari untuk semua paket. Fitur DP, pengingat otomatis, dan proteksi no-show sudah aktif sejak paket Basic.
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
                                        'flex min-w-0 flex-col justify-between rounded-md p-5 transition-colors sm:p-6',
                                        isPopular ? 'bg-bone' : 'border border-hairline-soft bg-canvas hover:border-hairline'
                                    )}
                                >
                                    <div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="text-2xl font-semibold text-charcoal">{plan.name}</h3>
                                            {isPopular && <Badge variant="popular">Rekomendasi</Badge>}
                                        </div>
                                        {PLAN_TAGLINES[plan.slug] && (
                                            <p className="mt-2 text-sm leading-relaxed text-mute text-pretty">{PLAN_TAGLINES[plan.slug]}</p>
                                        )}

                                        <div className="mt-5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                            <span className="text-3xl font-semibold tabular-nums text-ink sm:text-4xl">{formatRupiah(price)}</span>
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
                    <div className="mt-8 rounded-md bg-bone p-6 sm:p-8">
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
                <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mb-12 text-center">
                        <h2 className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Kata mereka yang sudah pakai Janjiyan
                        </h2>
                    </div>

                    <div data-testimonials-grid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {TESTIMONIALS.map((t) => (
                            <div
                                key={t.name}
                                data-testimonial-card
                                className="flex min-w-0 flex-col justify-between rounded-sm border border-hairline-soft bg-canvas p-5 transition-colors hover:border-hairline sm:p-6"
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
                <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                    <h2 className="mb-10 text-center text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                        Yang sering ditanyakan
                    </h2>

                    <div className="space-y-3">
                        {FAQS.map((item, idx) => {
                            const isOpen = openFaq === idx;
                            const buttonId = `faq-trigger-${idx}`;
                            const panelId = `faq-panel-${idx}`;
                            return (
                                <div key={item.q} className="rounded-sm bg-bone p-4">
                                    <h3>
                                        <button
                                            id={buttonId}
                                            type="button"
                                            aria-expanded={isOpen}
                                            aria-controls={panelId}
                                            onClick={() => setOpenFaq(isOpen ? null : idx)}
                                            className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xs text-start text-base font-semibold text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
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
            <footer className="mt-16 rounded-t-md bg-dark px-6 py-16 text-on-dark sm:px-12 sm:py-20">
                <div className="mx-auto max-w-6xl">
                    {/* Closing CTA Band */}
                    <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-14 md:flex-row md:items-center">
                        <div>
                            <h2 className="text-3xl font-semibold leading-tight text-on-dark sm:text-4xl text-balance">
                                Cobain dulu 14 hari, gratis.
                            </h2>
                            <p className="mt-2.5 max-w-xl text-base text-on-dark-mute text-pretty">
                                Buat link booking pertamamu hari ini, lalu lihat sendiri apakah cocok untuk jadwal harianmu.
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
                        <span>© {new Date().getFullYear()} Janjiyan.</span>
                        <span>Dibuat untuk bisnis jasa di Indonesia.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
