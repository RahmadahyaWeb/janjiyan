import { Head, Link, usePage } from '@inertiajs/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    Bell,
    Calendar,
    Check,
    ChevronDown,
    Link as LinkIcon,
    MapPin,
    Package,
    ReceiptText,
    Scissors,
    Star,
    X,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
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

// Customer journey for one booking: the story the page tells in order.
const JOURNEY = [
    {
        title: 'Buka link atau scan QR',
        desc: 'Pelanggan buka link di bio Instagram atau scan poster QR di meja kasir. Tanpa install aplikasi, tanpa bikin akun.',
        illustration: '/images/editorial-feature-qr.jpg',
        illustrationAlt: 'Ilustrasi pelanggan memindai poster QR booking di meja kasir studio',
    },
    {
        title: 'Pilih jadwal, bayar uang muka',
        desc: 'Pilih layanan, jam, atau jumlah barang. Uang muka ditransfer langsung ke rekening atau QRIS kamu, tanpa potongan dari Janjiyan.',
        illustration: '/images/editorial-feature-dp.jpg',
        illustrationAlt: 'Ilustrasi pelanggan mengunci jadwal booking dengan pembayaran uang muka di smartphone',
    },
    {
        title: 'Jadwal terkunci otomatis',
        desc: 'Jam atau kuota harian langsung dipegang untuk pelanggan itu. Kalau uang muka belum masuk sampai batas waktu, slotnya terbuka lagi. Pengingat email terkirim sendiri sebelum jadwal.',
        illustration: '/images/editorial-feature-calendar.jpg',
        illustrationAlt: 'Ilustrasi tim memantau papan jadwal harian dan menerima notifikasi booking di smartphone',
    },
    {
        title: 'Lunas di kasir, lalu minta ulasan',
        desc: 'Saat tamu datang atau barang diambil, kasir catat pelunasan dan cetak struk atau tag barang. Invoice pelanggan lalu berisi link ulasan Google Maps.',
        illustration: '/images/editorial-feature-commission.jpg',
        illustrationAlt: 'Ilustrasi pemilik bisnis dan tim melihat grafik rekap komisi bulanan otomatis di laptop',
    },
];

// Rotating word in the hero, one per business type example.
const HERO_WORDS = ['barbershop', 'salon', 'klinik', 'lapangan', 'studio foto', 'laundry', 'cuci sepatu', 'bengkel'];

// Same pain (everything runs through chat), told once per business type.
const PAINS = [
    {
        icon: Scissors,
        type: 'Janji temu',
        contoh: 'Barbershop, salon, klinik',
        chat: '“Kak, jam 4 masih bisa?”',
        desc: 'Kamu balas di sela kerja. Lalu yang sudah janji malah tidak datang, padahal jamnya sudah kamu tolak untuk orang lain.',
    },
    {
        icon: MapPin,
        type: 'Sewa tempat',
        contoh: 'Lapangan, studio, kelas',
        chat: '“Sabtu sore lapangan 2 kosong?”',
        desc: 'Jadwal dicatat di grup atau buku. Sekali salah tulis, dua tim datang di jam yang sama.',
    },
    {
        icon: Package,
        type: 'Titip barang',
        contoh: 'Laundry, cuci sepatu, servis',
        chat: '“Sepatu saya sudah jadi belum?”',
        desc: 'Pertanyaan yang sama datang berkali-kali sehari, dan titipan bisa menumpuk melebihi kapasitas.',
    },
];

// Three locked business types, shown as one switchable panel instead of three stacked cards.
const BUSINESS_TYPES = [
    {
        key: 'staff',
        icon: Scissors,
        tab: 'Janji Temu & Staff',
        contoh: 'Barbershop, salon, klinik, spa, pet grooming',
        headline: 'Pelanggan pilih staff favoritnya, dan cuma melihat jam yang benar-benar bisa.',
        desc: 'Setiap staff punya jadwal, jam istirahat, dan cuti sendiri. Jam yang sudah dipesan atau sedang libur tidak muncul di link.',
        points: [
            'Kalender per staff dengan shift, istirahat, dan cuti',
            'Durasi add-on dan jeda antar tamu ikut dihitung, jadi jadwal tidak bentrok',
            'Komisi staff (persen atau nominal) direkap otomatis dari layanan dan add-on',
        ],
        flow: ['Layanan + add-on', 'Pilih staff', 'Pilih jam datang', 'Bayar uang muka'],
    },
    {
        key: 'space',
        icon: MapPin,
        tab: 'Booking Tempat / Sesi',
        contoh: 'Lapangan padel, studio foto, kelas yoga, ruang meeting',
        headline: 'Tidak ada lagi dua tim yang datang di jam yang sama.',
        desc: 'Pelanggan melihat sisa tempat di tiap sesi. Begitu pesanan masuk, kapasitasnya langsung terpakai, dan jeda bersih-bersih antar sesi ikut dihitung.',
        points: [
            'Kapasitas per sesi, tanpa perlu memilih staff',
            'Add-on seperti sewa raket atau perlengkapan, plus jeda bersih-bersih antar sesi',
            'Pelunasan dan cetak struk langsung di kasir saat tamu datang',
        ],
        flow: ['Fasilitas + add-on', 'Pilih tanggal & jam', 'Bayar uang muka'],
    },
    {
        key: 'dropoff',
        icon: Package,
        tab: 'Layanan Titip / Drop-off',
        contoh: 'Laundry, cuci sepatu, servis elektronik, bengkel',
        headline: 'Pelanggan cek sendiri titipannya sudah sampai mana.',
        desc: 'Status berjalan dari menunggu diantar, dikerjakan, siap diambil, sampai selesai. Kuota harian membatasi titipan supaya tidak melebihi kapasitas kamu.',
        points: [
            'Kuota harian per satuan: item, pasang, kg, pcs, atau unit',
            'Antar-jemput opsional, dan estimasi selesai ikut otomatis',
            'Paket Professional ke atas: beberapa layanan dalam satu invoice',
            'Tag barang 58mm supaya titipan tidak tertukar',
        ],
        flow: ['Layanan & jumlah', 'Tanggal titip / jemput', 'Tag barang & pantau progres'],
    },
];

const DASHBOARD_TILES = [
    {
        icon: Calendar,
        title: 'Kalender & antrean',
        desc: 'Papan jadwal per staff, sesi, atau antrean titipan lengkap dengan peringatan jatuh tempo.',
    },
    {
        icon: Bell,
        title: 'Notifikasi langsung',
        desc: 'Pesanan baru, bukti uang muka, dan ulasan masuk ke lonceng dashboard, Telegram, dan email.',
    },
];

const CASHIER_POINTS = [
    'Cetak struk termal 58mm atau 80mm, lengkap dengan QR invoice',
    'Tag barang 58mm untuk ditempel di sepatu, laundry, atau barang servis',
    'Unduh struk jadi gambar PNG 1-klik untuk dikirim lewat WhatsApp',
    'Ringkasan kasir harian per metode bayar dan export CSV (paket Professional ke atas)',
];

const REVIEW_POINTS = [
    'Batas bintang bisa kamu atur (default 4 ke atas), lengkap dengan tombol salin komentar untuk Google',
    'Rating rendah masuk sebagai masukan privat di dashboard, plus notifikasi Telegram ke pemilik',
    'Cetak stiker QR meja: kotak PNG, tent card A6, atau lembar A4 (2×2 dan 3×3)',
];

const INCLUDED_IN_ALL_PLANS = [
    'Uang muka langsung ke rekening atau QRIS, tanpa potongan',
    'Aturan bayar penuh untuk pelanggan yang sering batal (janji temu & tempat)',
    'Kasir meja dengan pelunasan, cicilan, dan kembalian otomatis',
    'Cetak struk termal 58/80mm dan tag barang 58mm',
    'Halaman toko dengan link sendiri, poster QR, dan cek invoice mandiri',
    'Pengingat email H-1, plus H-2 jam untuk janji temu dan booking tempat',
];

const PLAN_TAGLINES: Record<string, string> = {
    basic: 'Untuk usaha yang baru pindah dari catatan chat ke link booking dan kasir sendiri.',
    professional: 'Untuk usaha dengan tim yang butuh rekap komisi, keranjang multi-layanan, dan ulasan Google Maps.',
    enterprise: 'Untuk usaha dengan banyak cabang dan pesanan bulanan yang tinggi.',
};

const START_STEPS = [
    {
        title: 'Lengkapi profil dan rekening',
        desc: 'Pilih tipe usaha, isi nama, lalu masukkan rekening atau QRIS untuk terima uang muka.',
    },
    {
        title: 'Atur layanan dan kuota',
        desc: 'Isi daftar layanan beserta harga, nominal uang muka, durasi atau kuota harian, dan jadwal tim.',
    },
    {
        title: 'Pasang link dan poster QR',
        desc: 'Taruh link di bio Instagram atau TikTok, balas chat dengan link itu, dan cetak poster QR untuk meja kasir.',
    },
];

const TESTIMONIALS = [
    {
        name: 'Soklenn Cuci Sepatu',
        initials: 'SK',
        role: 'Layanan Cuci Sepatu & Tas',
        quote: 'Pelanggan sekarang tinggal pilih layanan cuci per pasang atau tas, pilih tanggal antar atau jemput, lalu cek sendiri di link invoice kalau cuciannya sudah siap diambil.',
    },
];

function buildFaqs(plans: SubscriptionPlan[]) {
    const proBranches = plans.find((plan) => plan.slug === 'professional')?.max_businesses;
    const enterpriseBranches = plans.find((plan) => plan.slug === 'enterprise')?.max_businesses;

    return [
        {
            q: 'Apa itu Janjiyan?',
            a: 'Janjiyan adalah link booking untuk usaha jasa. Pelanggan pilih layanan dan jadwal sendiri, bayar uang muka langsung ke rekening atau QRIS kamu, dan kasir, struk, serta ulasan Google ikut ada di satu tempat.',
        },
        {
            q: 'Pelanggan saya terbiasa pesan lewat WhatsApp. Masih bisa?',
            a: 'Masih. Pesanan dari chat atau tamu yang datang langsung bisa kamu masukkan sendiri lewat dashboard, jadi semua jadwal tetap di satu kalender. Lama-lama cukup balas chat dengan link toko, biar pelanggan pesan sendiri.',
        },
        {
            q: 'Apakah Janjiyan mengambil potongan dari uang muka pelanggan?',
            a: 'Tidak. Pelanggan transfer uang muka langsung ke rekening atau QRIS usaha kamu, lalu kirim bukti bayar di halaman invoice. Uangnya tidak lewat Janjiyan.',
        },
        {
            q: 'Usaha apa saja yang cocok memakai Janjiyan?',
            a: 'Usaha jasa yang memakai jadwal, sewa tempat, atau titipan barang. Pilih satu tipe saat daftar: Janji Temu & Staff (barbershop, salon, klinik), Booking Tempat / Sesi (lapangan, studio, kelas, ruang meeting), atau Layanan Titip / Drop-off (laundry, cuci sepatu, servis, bengkel). Tipe ini dikunci permanen.',
        },
        {
            q: 'Apakah pelanggan harus install aplikasi atau bikin akun dulu?',
            a: 'Tidak perlu. Pelanggan cukup buka link di bio atau scan poster QR, pilih layanan dan jadwal, lalu isi nama dan nomor WhatsApp. Email hanya diisi kalau mau menerima pengingat otomatis.',
        },
        {
            q: 'Bagaimana cara mencegah pelanggan batal mendadak?',
            a: 'Setiap pesanan bisa dikunci dengan uang muka dan batas waktu bayar. Kalau lewat batas waktu, jam atau kuota harinya terbuka lagi. Untuk janji temu dan booking tempat, pelanggan yang sering tidak datang bisa otomatis diminta bayar penuh di awal.',
        },
        {
            q: 'Perlu aplikasi kasir atau printer khusus?',
            a: 'Tidak perlu aplikasi kasir tambahan. Kasir meja sudah ada di dalam Janjiyan untuk pelunasan, cicilan, dan tambah layanan di tempat (Tunai, QRIS, Transfer, atau EDC). Struk bisa dicetak ke printer termal 58mm atau 80mm, atau diunduh sebagai gambar PNG untuk WhatsApp.',
        },
        {
            q: 'Bagaimana cara kerja ulasan Google Maps?',
            a: 'Pelanggan scan stiker QR di kasir, atau klik Beri Ulasan di invoice setelah pesanan selesai. Rating tinggi diarahkan ke halaman Google Maps Review usaha kamu. Rating rendah tersimpan sebagai masukan privat untuk kamu tindaklanjuti. Fitur ini tersedia mulai paket Professional.',
        },
        {
            q: 'Satu akun bisa dipakai untuk beberapa cabang?',
            a: `Bisa. Paket Professional mendukung hingga ${proBranches ?? 3} bisnis dalam satu akun, dan Enterprise hingga ${enterpriseBranches ?? 10}. Link toko, layanan, data pelanggan, kasir, dan rekening tiap cabang tetap terpisah.`,
        },
    ];
}

// Splits a heading into word spans so GSAP can reveal them one by one on scroll.
function WordReveal({ children }: { children: string }) {
    return (
        <span data-word-reveal className="inline">
            {children.split(' ').map((word, idx) => (
                <Fragment key={idx}>
                    {idx > 0 && ' '}
                    <span data-word className="inline-block">{word}</span>
                </Fragment>
            ))}
        </span>
    );
}

export default function Landing({ plans }: LandingProps) {
    const { auth, activeBusiness } = usePage<PageProps>().props;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [activeType, setActiveType] = useState(0);
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [scrolled, setScrolled] = useState(false);
    const [servicePrice, setServicePrice] = useState(75000);
    const [noShowsPerMonth, setNoShowsPerMonth] = useState(26);
    const [heroWord, setHeroWord] = useState(0);
    const pageRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const heroWordRef = useRef<HTMLSpanElement>(null);

    const faqs = buildFaqs(plans);
    const basicPlan = plans.find((plan) => plan.slug === 'basic') ?? plans[0];
    const basicMonthlyPrice = basicPlan?.price_monthly ?? 49000;
    const monthlyLoss = servicePrice * noShowsPerMonth;
    const breakEvenBookings = Math.max(1, Math.ceil(basicMonthlyPrice / servicePrice));
    const currentType = BUSINESS_TYPES[activeType];

    const dashboardHref = auth.user
        ? (auth.user.is_superadmin ? route('admin.index') : route('dashboard'))
        : route('register');
    const primaryCtaLabel = auth.user
        ? (auth.user.is_superadmin ? 'Buka Panel Superadmin' : 'Buka Dashboard')
        : 'Coba gratis 14 hari';
    const pricingCtaHref = !auth.user
        ? route('register')
        : auth.user.is_superadmin
            ? route('admin.index')
            : activeBusiness?.can?.manage_settings
                ? route('dashboard.billing')
                : route('dashboard');
    const pricingCtaLabel = !auth.user
        ? 'Coba gratis'
        : auth.user.is_superadmin
            ? 'Buka Panel Superadmin'
            : activeBusiness?.can?.manage_settings
                ? 'Lihat langganan'
                : 'Buka Dashboard';

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
            // Section headings: each word fades up as its heading scrolls into view.
            root.querySelectorAll<HTMLElement>('[data-word-reveal]').forEach((heading) => {
                gsap.from(heading.querySelectorAll('[data-word]'), {
                    yPercent: 60,
                    opacity: 0,
                    duration: 0.6,
                    stagger: 0.04,
                    ease: 'power3.out',
                    clearProps: 'transform,opacity',
                    scrollTrigger: {
                        trigger: heading,
                        start: 'top 85%',
                        once: true,
                    },
                });
            });
            gsap.from('[data-hero-item]', {
                y: 12,
                opacity: 0,
                duration: 0.45,
                stagger: 0.06,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
            });

            const staggerGroups = [
                { selector: '[data-pain-card]', trigger: '#masalah' },
                { selector: '[data-journey-card]', trigger: '#alur' },
                { selector: '[data-dashboard-tile]', trigger: '#setelah-pesan' },
                { selector: '[data-start-step]', trigger: '#mulai' },
                { selector: '[data-pricing-card]', trigger: '#harga' },
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

    useEffect(() => {
        const panel = panelRef.current;
        if (!panel || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

        // Swap content of the business-type card: fade and rise in on each tab change.
        gsap.killTweensOf(panel);
        gsap.fromTo(
            panel,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' }
        );
    }, [activeType]);

    useEffect(() => {
        if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
        const id = window.setInterval(() => setHeroWord((i) => (i + 1) % HERO_WORDS.length), 2200);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        const word = heroWordRef.current;
        if (!word || heroWord === 0 || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
        gsap.fromTo(
            word,
            { yPercent: 40, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity' }
        );
    }, [heroWord]);

    const navLinkClass =
        'inline-flex min-h-8 items-center rounded-full px-1 whitespace-nowrap text-ink transition-colors hover:text-mute focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none';
    const footerLinkClass =
        'inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none';

    return (
        <div ref={pageRef} className="min-h-screen bg-canvas text-ink">
            <Head title="Janjiyan: link booking, uang muka langsung ke rekening kamu">
                <meta
                    head-key="description"
                    name="description"
                    content="Link booking untuk barbershop, salon, studio, lapangan, dan laundry. Pelanggan pilih jadwal sendiri dan bayar uang muka langsung ke rekening atau QRIS kamu, tanpa potongan. Ada kasir meja, struk termal, dan ulasan Google Maps. Coba gratis 14 hari."
                />
            </Head>

            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke konten utama
            </a>

            {/* Floating centered nav pill */}
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

                    <div className="hidden items-center gap-4 text-sm font-semibold md:flex lg:gap-6">
                        <a href="#alur" className={navLinkClass}>Alurnya</a>
                        <a href="#tipe-usaha" className={navLinkClass}>Tipe usaha</a>
                        <a href="#harga" className={navLinkClass}>Harga</a>
                        <a href="#faq" className={navLinkClass}>FAQ</a>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {auth.user ? (
                            <Button asChild size="sm">
                                <Link href={dashboardHref}>
                                    {auth.user.is_superadmin ? 'Panel Superadmin' : 'Dashboard'}
                                </Link>
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
                {/* 1. Hero: the promise, the link, the one CTA */}
                <section className="mx-auto max-w-6xl px-5 pt-8 pb-4 text-center sm:px-6 sm:pt-12 sm:pb-8">
                    <div className="mx-auto max-w-4xl">
                        <p
                            data-hero-item
                            className="mb-5 inline-flex max-w-full items-center justify-center rounded-full bg-bone px-4 py-1.5 text-center text-xs font-semibold text-ink"
                        >
                            Untuk usaha jasa: janji temu, sewa tempat, dan titip barang
                        </p>

                        <h1
                            data-hero-item
                            className="text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-6xl md:text-[68px] text-balance"
                        >
                            <span className="sr-only">Pesanan barbershop, salon, lapangan, studio, laundry, dan bengkel kamu masuk sendiri lewat link.</span>
                            <span aria-hidden="true" className="block">
                                Pesanan{' '}
                                {/* Own line on phones so a longer word never rewraps the headline. */}
                                <span
                                    ref={heroWordRef}
                                    className="block whitespace-nowrap underline decoration-hairline decoration-[0.08em] underline-offset-[0.12em] sm:inline-block"
                                >
                                    {HERO_WORDS[heroWord]}
                                </span>
                            </span>
                            <span aria-hidden="true" className="block">masuk sendiri lewat link.</span>
                        </h1>

                        <p
                            data-hero-item
                            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-mute sm:mt-5 sm:text-lg text-pretty"
                        >
                            Pelanggan pilih jadwal atau kuota yang masih kosong, bayar uang muka langsung ke rekening atau QRIS kamu, lalu cek status pesanannya sendiri. Kamu tinggal kerja.
                        </p>

                        <div
                            data-hero-item
                            className="mx-auto mt-6 inline-flex max-w-full items-center gap-2.5 rounded-full bg-bone py-2 pr-2 pl-4 text-sm"
                        >
                            <LinkIcon className="size-4 shrink-0 text-mute" aria-hidden="true" />
                            <span className="truncate font-medium text-ink">namausaha.janjiyan.web.id</span>
                            <span className="hidden shrink-0 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-mute sm:inline">
                                Taruh di bio
                            </span>
                        </div>

                        <div
                            data-hero-item
                            className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
                        >
                            <Button asChild size="lg" className="min-h-14 h-auto w-full max-w-[260px] py-3 whitespace-normal text-center sm:w-auto sm:max-w-none">
                                <Link href={dashboardHref}>{primaryCtaLabel}</Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="min-h-14 h-auto w-full max-w-[260px] py-3 sm:w-auto sm:max-w-none">
                                <a href="#alur">Lihat cara kerjanya</a>
                            </Button>
                        </div>

                        <ul data-hero-item className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-mute">
                            <li className="flex items-center gap-1.5"><Check className="size-3.5 text-ink" aria-hidden="true" />Gratis 14 hari</li>
                            <li className="flex items-center gap-1.5"><Check className="size-3.5 text-ink" aria-hidden="true" />0% potongan uang muka</li>
                            <li className="flex items-center gap-1.5"><Check className="size-3.5 text-ink" aria-hidden="true" />Pelanggan tanpa install aplikasi</li>
                        </ul>
                    </div>

                    <div data-hero-item className="mx-auto mt-6 max-w-4xl sm:mt-8">
                        <img
                            src="/images/hero-editorial-panorama.jpg"
                            alt="Ilustrasi pelanggan scan QR di meja kasir, kapster barbershop memangkas rambut, pelanggan cek jadwal booking lewat HP, layanan nail studio, dan pemilik studio memantau jadwal harian"
                            fetchPriority="high"
                            width={1376}
                            height={459}
                            className="h-auto w-full select-none mix-blend-multiply"
                        />
                    </div>
                </section>

                {/* 2. Problem: same chat pain across the three business types, then the no-show cost */}
                <section id="masalah" aria-labelledby="heading-masalah" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto mb-12 max-w-2xl text-center">
                        <span className="inline-flex rounded-full bg-bone px-3.5 py-1 text-xs font-semibold text-ink">
                            Kedengarannya akrab?
                        </span>
                        <h2 id="heading-masalah" className="mt-4 text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            <WordReveal>Usahanya beda, capeknya sama: semua pesanan lewat chat</WordReveal>
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-mute sm:text-lg text-pretty">
                            Selama jadwal diatur lewat chat, kamu jadi admin dulu, baru bisa kerja.
                        </p>
                    </div>

                    <ul className="grid gap-4 md:grid-cols-3">
                        {PAINS.map((pain) => {
                            const Icon = pain.icon;
                            return (
                                <li key={pain.type} data-pain-card className="flex min-w-0 flex-col rounded-md bg-bone p-5 sm:p-6">
                                    <p className="flex items-center gap-2 text-xs font-semibold text-mute">
                                        <Icon className="size-4 shrink-0 text-ink" aria-hidden="true" />
                                        <span>{pain.type} · {pain.contoh}</span>
                                    </p>
                                    <p className="mt-4 self-start rounded-2xl rounded-bl-sm bg-canvas px-4 py-2.5 text-base font-medium text-ink">
                                        {pain.chat}
                                    </p>
                                    <p className="mt-4 text-sm leading-relaxed text-body text-pretty">{pain.desc}</p>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="mx-auto mt-10 max-w-5xl rounded-md border border-hairline-soft bg-canvas p-5 sm:p-10">
                        <div className="border-b border-divider pb-8 text-center md:text-start">
                            <h3 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl text-balance">
                                Yang paling mahal: pelanggan batal tanpa kabar
                            </h3>
                            <p className="mt-3 max-w-2xl text-base leading-relaxed text-mute text-pretty md:max-w-none">
                                Janji lewat chat tidak mengikat. Pelanggan bilang “oke, besok ya”, lalu tidak datang, padahal jadwal atau kuota itu sudah kamu tolak untuk orang lain. Geser angka di bawah sesuai usaha kamu.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-6 sm:grid-cols-2">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <label htmlFor="calc-service-price" className="text-sm font-medium text-body">
                                        Tarif rata-rata layanan
                                    </label>
                                    <span className="text-base font-semibold tabular-nums text-ink">{formatRupiah(servicePrice)}</span>
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
                                        aria-valuetext={formatRupiah(servicePrice)}
                                        onChange={(e) => setServicePrice(Number(e.target.value))}
                                        className="absolute inset-0 h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
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
                                    <span className="text-base font-semibold tabular-nums text-ink">{noShowsPerMonth} kali</span>
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
                                        aria-valuetext={`${noShowsPerMonth} kali`}
                                        onChange={(e) => setNoShowsPerMonth(Number(e.target.value))}
                                        className="absolute inset-0 h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
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
                                    <p className="text-sm font-semibold text-mute">Perkiraan pendapatan hilang</p>
                                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className="text-2xl font-semibold tabular-nums text-ink sm:text-4xl">{formatRupiah(monthlyLoss)}</span>
                                        <span className="text-sm text-mute">/ bulan</span>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs leading-relaxed text-body">
                                    Dari {noShowsPerMonth} pesanan × {formatRupiah(servicePrice)}, belum termasuk pelanggan lain yang ditolak karena jadwalnya sudah penuh.
                                </p>
                            </div>

                            <div className="flex min-w-0 flex-col justify-between rounded-sm bg-dark p-4 text-on-dark sm:p-6">
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-on-dark-mute">Paket Basic Janjiyan</p>
                                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-on-dark">
                                            Balik modal: {breakEvenBookings} pesanan
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className="text-2xl font-semibold tabular-nums text-on-dark sm:text-4xl">{formatRupiah(basicMonthlyPrice)}</span>
                                        <span className="text-sm text-on-dark-mute">/ bulan</span>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs leading-relaxed text-on-dark-mute">
                                    Uang muka mengikat jadwal dan pengingat terkirim otomatis. Untuk janji temu dan booking tempat, pelanggan yang sering tidak datang bisa diminta bayar penuh di awal.
                                </p>
                            </div>
                        </div>

                        <p className="mt-5 text-center text-xs text-mute">
                            Angka di atas hanya simulasi. Hasil di tiap usaha berbeda.
                        </p>
                    </div>
                </section>

                {/* 3. Journey: one customer, from bio link to finished order */}
                <section id="alur" aria-labelledby="heading-alur" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto mb-14 max-w-2xl text-center">
                        <span className="inline-flex rounded-full bg-bone px-3.5 py-1 text-xs font-semibold text-ink">
                            Cara kerjanya
                        </span>
                        <h2 id="heading-alur" className="mt-4 text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            <WordReveal>Pindahkan semua itu ke satu link</WordReveal>
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-mute sm:text-lg text-pretty">
                            Empat langkah ini berjalan sendiri, apa pun tipe usaha kamu.
                        </p>
                    </div>

                    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {JOURNEY.map((step, idx) => (
                            <li
                                key={step.title}
                                data-journey-card
                                className="flex min-w-0 flex-col rounded-md border border-hairline-soft bg-canvas p-5 transition-[translate,border-color] duration-300 ease-out group motion-safe:hover:-translate-y-1 hover:border-hairline sm:p-6"
                            >
                                <div className="flex h-36 items-end justify-center overflow-hidden rounded-sm bg-bone px-4 pt-3">
                                    <img
                                        src={step.illustration}
                                        alt={step.illustrationAlt}
                                        loading="lazy"
                                        className="max-h-32 w-auto object-contain select-none mix-blend-multiply transition-transform duration-500 ease-out motion-safe:group-hover:scale-105"
                                    />
                                </div>

                                <div className="mt-5 flex items-center gap-3">
                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold tabular-nums text-canvas">
                                        {idx + 1}
                                    </span>
                                    <h3 className="text-lg font-semibold leading-snug text-ink">{step.title}</h3>
                                </div>
                                <p className="mt-2.5 text-sm leading-relaxed text-mute text-pretty">{step.desc}</p>
                            </li>
                        ))}
                    </ol>

                    {/* Social proof sits right after the story, before the feature detail */}
                    <div className="mt-12">
                        <div className="grid gap-4">
                            {TESTIMONIALS.map((t) => (
                                <figure
                                    key={t.name}
                                    data-testimonial-card
                                    className="mx-auto flex max-w-3xl flex-col gap-6 rounded-md border border-hairline-soft bg-canvas p-6 text-center transition-[translate,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 hover:border-hairline sm:p-10"
                                >
                                    <blockquote className="text-lg leading-relaxed text-ink text-balance sm:text-xl">
                                        “{t.quote}”
                                    </blockquote>
                                    <figcaption className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bone text-xs font-semibold text-ink">
                                            {t.initials}
                                        </span>
                                        <span className="text-sm">
                                            <span className="block font-semibold text-ink">{t.name}</span>
                                            <span className="block text-xs text-mute">{t.role}</span>
                                        </span>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 4. Business types: one switchable panel */}
                <section id="tipe-usaha" aria-labelledby="heading-tipe-usaha" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 id="heading-tipe-usaha" className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            <WordReveal>Satu aplikasi, tiga cara kerja</WordReveal>
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-mute sm:text-lg text-pretty">
                            Pilih tipe yang sama dengan usaha kamu saat daftar. Halaman pesan, menu dashboard, dan istilahnya ikut menyesuaikan.
                        </p>
                    </div>

                    <div
                        role="tablist"
                        aria-label="Pilih tipe usaha"
                        className="mx-auto mt-10 grid max-w-full gap-2 sm:inline-flex sm:flex-wrap sm:justify-center sm:gap-1 sm:rounded-full sm:bg-bone sm:p-1"
                    >
                        {BUSINESS_TYPES.map((item, idx) => {
                            const Icon = item.icon;
                            const isActive = idx === activeType;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    id={`tab-${item.key}`}
                                    aria-selected={isActive}
                                    aria-controls="panel-tipe-usaha"
                                    tabIndex={isActive ? 0 : -1}
                                    onClick={() => setActiveType(idx)}
                                    className={cn(
                                        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:w-auto',
                                        isActive
                                            ? 'bg-ink text-canvas sm:bg-canvas sm:text-ink'
                                            : 'bg-bone text-mute hover:text-ink sm:bg-transparent'
                                    )}
                                >
                                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                                    {item.tab}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        role="tabpanel"
                        ref={panelRef}
                        id="panel-tipe-usaha"
                        aria-labelledby={`tab-${currentType.key}`}
                        className="mt-6 grid gap-8 rounded-md bg-bone p-6 sm:p-10 lg:grid-cols-2 lg:gap-12"
                    >
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-mute">Cocok untuk: {currentType.contoh}</p>
                            <h3 className="mt-3 text-2xl font-semibold leading-tight text-ink sm:text-3xl text-balance">
                                {currentType.headline}
                            </h3>
                            <p className="mt-3 text-sm leading-relaxed text-body sm:text-base text-pretty">{currentType.desc}</p>

                            <ul className="mt-6 space-y-3 text-sm text-body">
                                {currentType.points.map((point) => (
                                    <li key={point} className="flex items-start gap-2.5">
                                        <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex min-w-0 flex-col justify-center">
                            <p className="mb-3 text-xs font-semibold text-mute">Yang dilihat pelanggan</p>
                            <ol className="space-y-2">
                                {currentType.flow.map((step, idx) => (
                                    <li
                                        key={step}
                                        className="flex items-center gap-3 rounded-sm bg-canvas px-4 py-3 text-sm font-medium text-ink transition-transform duration-300 ease-out motion-safe:hover:translate-x-1"
                                    >
                                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold tabular-nums text-canvas">
                                            {idx + 1}
                                        </span>
                                        {step}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                </section>

                {/* 5. After the order: counter, reviews, dashboard in one place */}
                <section id="setelah-pesan" aria-labelledby="heading-setelah-pesan" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto mb-14 max-w-2xl text-center">
                        <h2 id="heading-setelah-pesan" className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            <WordReveal>Dari pelunasan sampai ulasan Google, tanpa aplikasi lain</WordReveal>
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-mute sm:text-lg text-pretty">
                            Pesanan dari link langsung masuk ke kasir dan kalender yang sama. Tidak ada catatan yang perlu disalin ulang.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div data-dashboard-tile className="flex min-w-0 flex-col rounded-md bg-bone p-5 transition-transform duration-300 ease-out motion-safe:hover:-translate-y-1 sm:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
                                    <ReceiptText className="size-4" aria-hidden="true" />
                                </div>
                                <span className="max-w-full rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-mute">Mulai paket Basic</span>
                            </div>
                            <h3 className="mt-5 text-xl font-semibold leading-snug text-ink sm:text-2xl text-balance">
                                Kasir meja: pelunasan, cicilan, dan struk termal
                            </h3>
                            <p className="mt-2.5 text-sm leading-relaxed text-mute sm:text-base text-pretty">
                                Saat tamu datang atau barang diambil, kasir catat sisa bayar lewat Tunai, QRIS, Transfer, atau EDC. Kembalian dihitung otomatis, dan layanan tambahan bisa dimasukkan di tempat.
                            </p>
                            <ul className="mt-5 space-y-2.5 border-t border-divider pt-5 text-sm text-body">
                                {CASHIER_POINTS.map((point) => (
                                    <li key={point} className="flex items-start gap-2.5">
                                        <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div data-dashboard-tile className="flex min-w-0 flex-col rounded-md bg-bone p-5 transition-transform duration-300 ease-out motion-safe:hover:-translate-y-1 sm:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
                                    <Star className="size-4" aria-hidden="true" />
                                </div>
                                <span className="max-w-full rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-mute">Mulai paket Professional</span>
                            </div>
                            <h3 className="mt-5 text-xl font-semibold leading-snug text-ink sm:text-2xl text-balance">
                                Pelanggan puas ke Google Maps. Yang kecewa bicara ke kamu dulu.
                            </h3>
                            <p className="mt-2.5 text-sm leading-relaxed text-mute sm:text-base text-pretty">
                                Link ulasan muncul di invoice setelah pesanan selesai dan bisa disisipkan ke pesan WhatsApp. Bintang tinggi diarahkan ke Google Maps, bintang rendah masuk ke dashboard sebagai masukan privat.
                            </p>
                            <ul className="mt-5 space-y-2.5 border-t border-divider pt-5 text-sm text-body">
                                {REVIEW_POINTS.map((point) => (
                                    <li key={point} className="flex items-start gap-2.5">
                                        <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        {DASHBOARD_TILES.map((tile) => {
                            const Icon = tile.icon;
                            return (
                                <div
                                    key={tile.title}
                                    data-dashboard-tile
                                    className="flex min-w-0 flex-col rounded-sm border border-hairline-soft bg-canvas p-5 transition-[translate,border-color] duration-300 ease-out motion-safe:hover:-translate-y-1 hover:border-hairline"
                                >
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bone text-ink">
                                        <Icon className="size-4" aria-hidden="true" />
                                    </div>
                                    <h3 className="mt-4 text-base font-semibold text-ink">{tile.title}</h3>
                                    <p className="mt-1.5 text-sm leading-relaxed text-mute text-pretty">{tile.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 6. Start: three short steps, then pricing */}
                <section id="mulai" aria-labelledby="heading-mulai" className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
                    <div className="rounded-md bg-bone p-6 sm:p-10">
                        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
                            <h2 id="heading-mulai" className="max-w-md text-2xl font-semibold leading-tight text-ink sm:text-3xl text-balance">
                                <WordReveal>Tiga langkah, lalu link toko kamu siap dibagikan.</WordReveal>
                            </h2>
                            <Button asChild size="lg" className="min-h-12 h-auto w-full py-3 whitespace-normal text-center sm:w-auto">
                                <Link href={dashboardHref}>{primaryCtaLabel}</Link>
                            </Button>
                        </div>

                        <ol className="mt-8 grid gap-4 md:grid-cols-3">
                            {START_STEPS.map((step, idx) => (
                                <li key={step.title} data-start-step className="flex min-w-0 gap-4 rounded-sm bg-canvas p-5 transition-transform duration-300 ease-out motion-safe:hover:-translate-y-1">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold tabular-nums text-canvas">
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-semibold text-ink">{step.title}</h3>
                                        <p className="mt-1.5 text-sm leading-relaxed text-mute text-pretty">{step.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* 7. Pricing */}
                <section id="harga" aria-labelledby="heading-harga" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
                    <div className="text-center">
                        <h2 id="heading-harga" className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            <WordReveal>Mulai gratis, pilih paket saat sudah cocok</WordReveal>
                        </h2>
                        <p className="mx-auto mt-4 max-w-2xl text-lg text-mute text-pretty">
                            14 hari pertama gratis dengan fitur paket Professional. Setelah itu pilih paket sesuai ukuran usaha. Uang muka tanpa potongan dan kasir meja ada di semua paket.
                        </p>

                        <div className="mt-8 inline-flex min-h-12 max-w-full flex-wrap items-center justify-center rounded-full bg-bone p-1" role="group" aria-label="Siklus penagihan">
                            <button
                                type="button"
                                aria-pressed={billingCycle === 'monthly'}
                                onClick={() => setBillingCycle('monthly')}
                                className={cn(
                                    'min-h-10 cursor-pointer rounded-full px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-5',
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
                                    'flex min-h-10 cursor-pointer flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none sm:px-5',
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
                                        'flex min-w-0 flex-col justify-between rounded-md p-5 transition-[translate,border-color,background-color] duration-300 ease-out motion-safe:hover:-translate-y-1 sm:p-6',
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
                                            <li className="flex items-start gap-2.5">
                                                <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_businesses ?? 'Unlimited'} Bisnis / cabang</span>
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_services_per_business ?? 'Unlimited'} Layanan per bisnis</span>
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>
                                                    {plan.max_addons_per_business != null
                                                        ? `Maks. ${plan.max_addons_per_business} add-on layanan`
                                                        : 'Add-on layanan unlimited'}
                                                </span>
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_staff_per_business ?? 'Unlimited'} Akun tim / staff</span>
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_bookings_per_month ?? 'Unlimited'} Pesanan per bulan</span>
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                <span>{plan.max_customers_per_business?.toLocaleString('id-ID') ?? 'Unlimited'} Data pelanggan</span>
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                {plan.slug !== 'basic' || plan.can_export_csv ? (
                                                    <>
                                                        <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                        <span className="text-body">Keranjang multi-layanan Drop-off &amp; rincian kasir harian</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                                                        <span className="text-mute line-through">Keranjang multi-layanan Drop-off &amp; rincian kasir harian</span>
                                                        <span className="sr-only">(Tidak tersedia di paket ini)</span>
                                                    </>
                                                )}
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                {plan.can_export_csv ? (
                                                    <>
                                                        <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                        <span className="text-body">Export CSV (Pesanan, Pelanggan, Kasir &amp; Komisi)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                                                        <span className="text-mute line-through">Export CSV (Pesanan, Pelanggan, Kasir &amp; Komisi)</span>
                                                        <span className="sr-only">(Tidak tersedia di paket ini)</span>
                                                    </>
                                                )}
                                            </li>
                                            <li className="flex items-start gap-2.5">
                                                {plan.can_use_google_review ? (
                                                    <>
                                                        <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                        <span className="text-body">Google Maps Review &amp; Stiker QR</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                                                        <span className="text-mute line-through">Google Maps Review &amp; Stiker QR</span>
                                                        <span className="sr-only">(Tidak tersedia di paket ini)</span>
                                                    </>
                                                )}
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="mt-8">
                                        <Button asChild variant={isPopular ? 'default' : 'outline'} className="w-full">
                                            <Link href={pricingCtaHref}>
                                                {pricingCtaLabel}
                                                {!auth.user && <span className="sr-only"> paket {plan.name}</span>}
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 rounded-md border border-hairline-soft p-6 sm:p-8">
                        <p className="text-sm font-semibold text-ink">Sudah termasuk di semua paket</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {INCLUDED_IN_ALL_PLANS.map((feature) => (
                                <div key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-body">
                                    <Check className="mt-0.5 size-3.5 shrink-0 text-ink" aria-hidden="true" />
                                    <span>{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 8. FAQ */}
                <section id="faq" aria-labelledby="heading-faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                    <h2 id="heading-faq" className="mb-10 text-center text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                        <WordReveal>Yang sering ditanyakan</WordReveal>
                    </h2>

                    <div className="space-y-3">
                        {faqs.map((item, idx) => {
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
                                            className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-xs text-start text-base font-semibold text-ink focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none"
                                        >
                                            <span>{item.q}</span>
                                            <ChevronDown
                                                aria-hidden="true"
                                                className={cn(
                                                    'mt-1 size-4 shrink-0 text-mute motion-safe:transition-transform',
                                                    isOpen && 'rotate-180'
                                                )}
                                            />
                                        </button>
                                    </h3>
                                    <div
                                        id={panelId}
                                        aria-labelledby={buttonId}
                                        aria-hidden={!isOpen}
                                        className={cn(
                                            'grid duration-200 ease-out motion-safe:transition-[grid-template-rows,opacity] motion-reduce:transition-opacity',
                                            isOpen ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
                                        )}
                                    >
                                        <div className="overflow-hidden">
                                            <p className="pt-3 text-sm leading-relaxed text-mute text-pretty">{item.a}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* Closing CTA + inverse footer */}
            <footer className="mt-16 rounded-t-md bg-dark px-6 pt-16 pb-[calc(4rem+env(safe-area-inset-bottom))] text-on-dark sm:px-12 sm:pt-20 sm:pb-[calc(5rem+env(safe-area-inset-bottom))]">
                <div className="mx-auto max-w-6xl">
                    <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-14 md:flex-row md:items-center">
                        <div className="min-w-0">
                            <h2 className="text-3xl font-semibold leading-tight text-on-dark sm:text-4xl text-balance">
                                <WordReveal>Coba dulu 14 hari, gratis.</WordReveal>
                            </h2>
                            <p className="mt-2.5 max-w-xl text-base text-on-dark-mute text-pretty">
                                Pasang link di bio minggu ini dan lihat sendiri berapa chat yang berkurang. Kalau cocok, baru pilih paket.
                            </p>
                        </div>
                        <Button
                            asChild
                            size="lg"
                            className="min-h-14 h-auto w-full shrink-0 py-3 whitespace-normal bg-canvas text-center text-ink hover:bg-bone focus-visible:ring-on-dark focus-visible:ring-offset-dark sm:w-auto"
                        >
                            <Link href={dashboardHref}>{primaryCtaLabel}</Link>
                        </Button>
                    </div>

                    <div className="mt-14 flex flex-col justify-between gap-12 md:flex-row md:items-end">
                        <div>
                            <JanjiyanLogo dark size="lg" />
                            <p className="mt-4 max-w-md text-lg text-on-dark-mute">
                                Link booking dengan uang muka, kasir, dan ulasan dalam satu tempat.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-12 text-sm text-on-dark-mute">
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Produk</p>
                                <ul className="space-y-1">
                                    <li><a href="#alur" className={footerLinkClass}>Alurnya</a></li>
                                    <li><a href="#tipe-usaha" className={footerLinkClass}>Tipe usaha</a></li>
                                    <li><a href="#harga" className={footerLinkClass}>Harga</a></li>
                                    <li><a href="#faq" className={footerLinkClass}>FAQ</a></li>
                                </ul>
                            </div>
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Akun</p>
                                <ul className="space-y-1">
                                    {auth.user ? (
                                        <li>
                                            <Link href={dashboardHref} className={footerLinkClass}>
                                                {auth.user.is_superadmin ? 'Panel Superadmin' : 'Dashboard'}
                                            </Link>
                                        </li>
                                    ) : (
                                        <>
                                            <li><Link href={route('login')} className={footerLinkClass}>Masuk</Link></li>
                                            <li><Link href={route('register')} className={footerLinkClass}>Coba gratis</Link></li>
                                        </>
                                    )}
                                </ul>
                            </div>
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Legal</p>
                                <ul className="space-y-1">
                                    <li><Link href={route('legal.terms')} className={footerLinkClass}>Syarat &amp; Ketentuan</Link></li>
                                    <li><Link href={route('legal.privacy')} className={footerLinkClass}>Kebijakan Privasi</Link></li>
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
