import { Head, Link, usePage } from '@inertiajs/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    BadgePercent,
    Calendar,
    Check,
    ChevronDown,
    MapPin,
    Package,
    Pause,
    Play,
    QrCode,
    Scissors,
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
    'Klinik Gigi',
    'Klinik Kecantikan',
    'Pet Grooming',
    'Lapangan Padel',
    'Studio Foto',
    'Pilates & Yoga',
    'Ruang Meeting',
    'Laundry & Dry Clean',
    'Cuci Sepatu & Tas',
    'Servis Elektronik',
    'Bengkel & Detailing',
];

const BUSINESS_TYPE_SHOWCASE = [
    {
        icon: Scissors,
        badge: 'Barber · Salon · Klinik · Grooming',
        title: 'Janji Temu & Staff',
        desc: 'Pelanggan pilih layanan, pilih kapster atau terapis favorit, lalu ambil jam yang masih kosong.',
        points: [
            'Kalender per staff, lengkap dengan shift dan cuti',
            'Jeda antar tamu supaya jadwal tidak bentrok',
            'Komisi staff (% atau nominal tetap) langsung direkap tiap selesai',
        ],
        flow: 'Layanan → Pilih Staff → Jam Datang → Uang Muka',
    },
    {
        icon: MapPin,
        badge: 'Padel · Studio · Kelas · Meeting',
        title: 'Booking Tempat / Sesi',
        desc: 'Pelanggan langsung pilih lapangan, ruangan, atau kelas, lalu lihat jam main dan sisa tempatnya.',
        points: [
            'Atur kapasitas per sesi tanpa perlu pilih staff',
            'Jeda bersih-bersih atau persiapan di antara pemakaian',
            'Cocok buat sewa lapangan, studio foto, sampai kelas rutin',
        ],
        flow: 'Fasilitas / Paket → Tanggal & Jam → Uang Muka',
    },
    {
        icon: Package,
        badge: 'Laundry · Sepatu · Servis · Bengkel',
        title: 'Layanan Titip / Drop-off',
        desc: 'Pelanggan pilih layanan (item, pasang, kg, pcs, atau unit), pilih tanggal titip atau jemput, lalu cek statusnya di link invoice.',
        points: [
            'Batas terima barang harian biar kerjaan tidak numpuk',
            'Bisa antar langsung ke toko atau pilih jemput-antar',
            'Progres dari Dikerjakan sampai Siap Diambil terlihat di invoice',
        ],
        flow: 'Layanan & Jumlah → Tanggal Titip → Pantau Invoice',
    },
];

const OUTCOMES = [
    {
        icon: ShieldCheck,
        illustration: '/images/editorial-feature-dp.jpg',
        illustrationAlt: 'Ilustrasi pelanggan mengunci jadwal booking dengan pembayaran uang muka di smartphone',
        title: 'Lebih sedikit yang batal tanpa kabar',
        desc: 'Pelanggan transfer uang muka langsung ke rekening atau QRIS kamu, tanpa potongan dari Janjiyan. Kalau lewat batas waktu belum dibayar, jam kosong atau kuota harinya otomatis terbuka lagi. Khusus janji temu dan booking tempat, pelanggan yang sering batal tanpa kabar bisa otomatis diminta bayar penuh di awal.',
        highlights: ['Uang muka tanpa potongan', 'Jadwal dibuka lagi otomatis', 'Bayar penuh kalau sering batal', 'Pengingat email otomatis'],
    },
    {
        icon: QrCode,
        illustration: '/images/editorial-feature-qr.jpg',
        illustrationAlt: 'Ilustrasi pelanggan memindai poster QR booking di meja kasir studio',
        title: 'Satu link untuk Instagram dan meja kasir',
        desc: 'Taruh link halaman toko di bio Instagram, atau cetak poster QR dari dashboard buat meja kasir. Tampilannya pakai warna khas usaha kamu sendiri, lengkap dengan foto tempat dan galeri hasil kerja. Pelanggan bisa pesan sekaligus cek status invoice lewat browser, tanpa install aplikasi.',
        highlights: ['Link toko & warna merek sendiri', 'Poster QR siap cetak', 'Cek status di invoice', 'Tanpa install aplikasi'],
    },
    {
        icon: Calendar,
        illustration: '/images/editorial-feature-calendar.jpg',
        illustrationAlt: 'Ilustrasi tim memantau papan jadwal harian dan menerima notifikasi booking di smartphone',
        title: 'Semua jadwal dan titipan dalam satu layar',
        desc: 'Lihat jadwal harian tiap staff, sisa kapasitas sesi, sampai daftar titipan yang lagi dikerjakan. Begitu ada pesanan baru atau bukti transfer masuk, kabarnya langsung dikirim ke Telegram dan email—lengkap dengan tombol chat WhatsApp yang pesannya sudah terisi otomatis.',
        highlights: ['Kalender & daftar titipan', 'Kuota harian per satuan', 'Notif Telegram & email', 'Template chat WhatsApp'],
    },
    {
        icon: BadgePercent,
        illustration: '/images/editorial-feature-commission.jpg',
        illustrationAlt: 'Ilustrasi pemilik bisnis dan tim melihat grafik rekap komisi bulanan otomatis di laptop',
        title: 'Data pelanggan rapi, tim dan komisi gampang dicek',
        desc: 'Simpan riwayat order, catatan khusus pelanggan, sampai gabungkan profil ganda kalau ada nama yang sama atau nomornya ganti. Kamu bisa bikin akun kasir atau admin di semua tipe usaha, hitung komisi staff janji temu otomatis, dan pegang sampai 10 cabang (paket Enterprise).',
        highlights: ['Catatan & gabung profil ganda', 'Akun kasir & admin', 'Komisi staff otomatis', 'Multi-cabang (hingga 10)'],
    },
];

const INCLUDED_IN_ALL_PLANS = [
    'Uang muka langsung ke rekening atau QRIS, tanpa potongan',
    'Wajib bayar penuh buat yang sering batal (Janji Temu & Tempat)',
    'Jadwal staff, sesi tempat, atau kuota drop-off',
    'Email pengingat H-1 (plus H-2 jam untuk jadwal/sesi)',
    'Halaman toko kustom & poster QR siap cetak',
    'Notifikasi Telegram & template chat WhatsApp',
    'Akun login tim kasir & admin (plus komisi staff)',
    'Simpan jadwal ke Google & Apple Calendar',
];

const PLAN_TAGLINES: Record<string, string> = {
    basic: 'Cocok kalau kamu baru mulai merapikan pesanan atau masih melayani sendiri.',
    professional: 'Cocok kalau kamu sudah punya admin, kasir, atau beberapa staff dengan rekap komisi.',
    enterprise: 'Cocok kalau kamu punya lebih dari satu cabang.',
};

const STEPS = [
    {
        title: 'Pilih tipe bisnis & lengkapi profil',
        desc: 'Daftar akun, pilih alur usaha kamu (Janji Temu, Booking Tempat, atau Drop-off), lalu isi rekening atau QRIS untuk terima pembayaran.',
        illustration: '/images/editorial-step-1.jpg',
        illustrationAlt: 'Ilustrasi pemilik bisnis menyiapkan profil bisnis dan rekening/QRIS di laptop',
    },
    {
        title: 'Atur layanan, tarif & kuota',
        desc: 'Masukkan daftar layanan atau paket beserta harga, nominal uang muka, durasi sesi atau kuota harian, dan jadwal tim.',
        illustration: '/images/editorial-step-2.jpg',
        illustrationAlt: 'Ilustrasi pengelola bisnis menyusun blok jadwal layanan dan kuota harian di papan kalender',
    },
    {
        title: 'Pasang link bio & QR kasir',
        desc: 'Taruh link di bio Instagram/TikTok atau cetak poster QR buat meja kasir supaya pelanggan bisa langsung pesan sendiri.',
        illustration: '/images/editorial-step-3.jpg',
        illustrationAlt: 'Ilustrasi pemilik bisnis meletakkan poster QR di meja kasir saat pelanggan datang membawa smartphone',
    },
];

interface TestimonialItem {
    name: string;
    role: string;
    quote: string;
    initials?: string;
}

const TESTIMONIALS: TestimonialItem[] = [
    {
        name: 'Soklenn Cuci Sepatu',
        initials: 'SK',
        role: 'Layanan Cuci Sepatu & Tas',
        quote: 'Pelanggan sekarang tinggal pilih layanan cuci per pasang atau tas, pilih tanggal antar atau jemput, lalu cek sendiri di link invoice kalau cuciannya sudah siap diambil.',
    },
];

const FAQS = [
    {
        q: 'Apakah Janjiyan mengambil potongan dari uang muka pelanggan?',
        a: 'Tidak sama sekali. Pelanggan transfer uang muka langsung ke rekening atau QRIS usaha kamu, lalu kirim bukti bayar di halaman invoice untuk kamu verifikasi. Uangnya tidak melewati Janjiyan.',
    },
    {
        q: 'Usaha apa saja yang cocok memakai Janjiyan?',
        a: 'Usaha jasa yang pakai jadwal, sewa tempat, atau titipan barang bisa pakai. Kamu tinggal pilih alurnya saat daftar: Janji Temu & Staff (barbershop, salon, klinik), Booking Tempat / Sesi (lapangan olahraga, studio foto, kelas, ruang meeting), atau Layanan Titip / Drop-off (laundry, cuci sepatu, servis elektronik, bengkel).',
    },
    {
        q: 'Apakah pelanggan harus install aplikasi atau bikin akun dulu?',
        a: 'Tidak perlu. Pelanggan cukup buka link di bio atau scan poster QR di kasir, pilih layanan dan jadwal atau jumlah pesanannya, lalu isi nama serta nomor WhatsApp (dan email jika ingin menerima pengingat otomatis).',
    },
    {
        q: 'Bagaimana cara Janjiyan mencegah pelanggan batal mendadak atau kerjaan menumpuk?',
        a: 'Setiap pesanan bisa dikunci dengan uang muka dan batas waktu bayar. Kalau lewat batas waktu, jam kosong atau kuota harinya otomatis terbuka lagi. Untuk janji temu dan booking tempat, pelanggan yang sudah beberapa kali tidak datang bisa otomatis diminta bayar penuh di awal. Di layanan drop-off, kamu juga bisa membatasi kuota harian per satuan.',
    },
    {
        q: 'Bisa bikin akun login buat admin, kasir, dan hitung komisi staff?',
        a: 'Bisa. Semua tipe usaha bisa bikin akun login terpisah untuk admin atau kasir sesuai hak akses menu yang kamu pilih. Khusus tipe Janji Temu & Staff, tersedia juga pengaturan shift kerja, cuti, dan rekap komisi otomatis per staff dalam persen atau nominal tetap.',
    },
    {
        q: 'Notifikasi pesanan baru dikirim ke mana?',
        a: 'Langsung ke email dan grup/chat Telegram kamu lewat bot Telegram yang kamu hubungkan di Pengaturan, setiap ada pesanan baru atau bukti transfer masuk. Untuk follow up ke pelanggan, sudah tersedia tombol chat WhatsApp yang pesannya terisi otomatis.',
    },
    {
        q: 'Satu akun bisa dipakai untuk beberapa cabang?',
        a: 'Bisa—paket Professional mendukung hingga 3 cabang, dan paket Enterprise hingga 10 cabang dalam satu akun. Link halaman toko, daftar layanan, data pelanggan, dan rekening tiap cabang tetap terpisah rapi.',
    },
];

export default function Landing({ plans }: LandingProps) {
    const { auth, activeBusiness } = usePage<PageProps>().props;
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [marqueePaused, setMarqueePaused] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [servicePrice, setServicePrice] = useState(75000);
    const [noShowsPerMonth, setNoShowsPerMonth] = useState(26);
    const pageRef = useRef<HTMLDivElement>(null);

    const basicPlan = plans.find((plan) => plan.slug === 'basic') ?? plans[0];
    const basicMonthlyPrice = basicPlan?.price_monthly ?? 49000;
    const monthlyLoss = servicePrice * noShowsPerMonth;
    const breakEvenBookings = Math.max(1, Math.ceil(basicMonthlyPrice / servicePrice));
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
            gsap.from('[data-hero-item]', {
                y: 12,
                opacity: 0,
                duration: 0.45,
                stagger: 0.06,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
            });

            const staggerGroups = [
                { selector: '[data-business-type-card]', trigger: '#tipe-bisnis' },
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
            <Head title="Sistem booking, uang muka, dan pesanan untuk bisnis jasa">
                <meta
                    head-key="description"
                    name="description"
                    content="Kelola janji temu, sewa lapangan atau studio, sampai titipan laundry lewat satu link. Uang muka langsung masuk ke rekening kamu tanpa potongan, plus pengingat sebelum jadwal. Coba gratis 14 hari."
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
                        <a href="#tipe-bisnis" className="inline-flex min-h-8 items-center rounded-full px-1 text-ink transition-colors hover:text-mute focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none">
                            Tipe bisnis
                        </a>
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
                {/* Centered Hero Section with Monochrome Editorial Character Panorama */}
                <section className="mx-auto max-w-6xl px-5 pt-8 pb-4 text-center sm:px-6 sm:pt-12 sm:pb-8">
                    <div className="mx-auto max-w-4xl">
                        <div
                            data-hero-item
                            className="mb-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full bg-bone px-4 py-1.5 text-center text-xs font-semibold text-ink"
                        >
                            <span>Untuk barbershop, salon, klinik, lapangan, sampai laundry</span>
                        </div>

                        <h1
                            data-hero-item
                            className="text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-6xl md:text-[68px] text-balance"
                        >
                            Jadwal lebih pasti.
                            <br />
                            Pesanan lebih rapi.
                        </h1>

                        <p
                            data-hero-item
                            className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-mute sm:mt-5 sm:text-lg text-pretty"
                        >
                            Taruh link Janjiyan di bio Instagram atau tempel poster QR di meja kasir. Pelanggan bisa lihat jam kosong atau kuota harian, lalu transfer uang muka langsung ke rekening kamu tanpa potongan.
                        </p>

                        <div
                            data-hero-item
                            className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row"
                        >
                            <Button asChild size="lg" className="min-h-14 h-auto w-full max-w-[260px] py-3 whitespace-normal text-center sm:w-auto sm:max-w-none">
                                <Link href={dashboardHref}>
                                    {primaryCtaLabel}
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="min-h-14 h-auto w-full max-w-[260px] py-3 sm:w-auto sm:max-w-none">
                                <a href="#fitur">
                                    Lihat fiturnya
                                </a>
                            </Button>
                        </div>

                        <p
                            data-hero-item
                            className="mt-3 text-xs font-medium text-mute"
                        >
                            Gratis 14 hari. Uang muka masuk utuh ke rekening kamu.
                        </p>
                    </div>

                    {/* Monochrome Editorial Line-Art Panorama below CTA */}
                    <div
                        data-hero-item
                        className="mx-auto mt-4 max-w-4xl sm:mt-6"
                    >
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

                {/* Clean Monochrome Verticals Marquee */}
                <section aria-label="Kategori bisnis yang didukung" className="overflow-hidden py-8">
                    <div className="marquee-mask overflow-hidden">
                        <ul className="animate-marquee flex gap-3" data-paused={marqueePaused ? 'true' : 'false'}>
                            {[...VERTICALS, ...VERTICALS].map((name, idx) => (
                                <li
                                    key={`${name}-${idx}`}
                                    aria-hidden={idx >= VERTICALS.length}
                                    className={cn(
                                        'rounded-full border border-hairline-soft bg-canvas px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-ink',
                                        idx >= VERTICALS.length && 'motion-reduce:hidden'
                                    )}
                                >
                                    {name}
                                </li>
                            ))}
                        </ul>
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

                {/* 3 Locked Business Types Showcase */}
                <section id="tipe-bisnis" aria-labelledby="heading-tipe-bisnis" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto mb-12 max-w-2xl text-center">
                        <span className="inline-flex rounded-full bg-bone px-3.5 py-1 text-xs font-semibold text-ink">
                            Tiga alur usaha
                        </span>
                        <h2 id="heading-tipe-bisnis" className="mt-4 text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Beda usaha, beda cara terima pesanannya
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-base text-mute sm:text-lg text-pretty">
                            Pilih sekali saat daftar. Menu dashboard sampai halaman pesan pelanggan otomatis ikut alur usaha kamu.
                        </p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        {BUSINESS_TYPE_SHOWCASE.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.title}
                                    data-business-type-card
                                    className="flex min-w-0 flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-5 transition-colors hover:border-hairline sm:p-7"
                                >
                                    <div>
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bone text-ink">
                                                <Icon className="size-4" aria-hidden="true" />
                                            </div>
                                            <span className="max-w-full rounded-full bg-bone px-3 py-1 text-start text-xs font-semibold text-mute">
                                                {item.badge}
                                            </span>
                                        </div>

                                        <h3 className="mt-5 text-xl font-semibold leading-snug text-ink sm:text-2xl">
                                            {item.title}
                                        </h3>

                                        <p className="mt-2.5 text-sm leading-relaxed text-mute sm:text-base text-pretty">
                                            {item.desc}
                                        </p>

                                        <ul className="mt-5 space-y-2.5 border-t border-divider pt-5 text-sm text-body">
                                            {item.points.map((point) => (
                                                <li key={point} className="flex items-start gap-2.5">
                                                    <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="mt-6 rounded-sm bg-bone px-3.5 py-2.5 text-xs text-body">
                                        <span className="font-semibold text-ink">Alur tamu: </span>
                                        <span>{item.flow}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Cost of no-show — 2-Column Editorial Story Banner + Simulator */}
                <section aria-labelledby="heading-simulasi-bayar" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="rounded-md border border-hairline-soft bg-canvas p-5 sm:p-10">
                        {/* Editorial 2-Column Header */}
                        <div className="grid items-start gap-8 border-b border-divider pb-8 md:grid-cols-12 md:gap-10">
                            <div className="min-w-0 text-center md:col-span-7 md:text-start">
                                <span className="inline-flex rounded-full bg-bone px-3.5 py-1 text-xs font-semibold text-ink">
                                    Kenapa pesanan perlu uang muka?
                                </span>
                                <h2 id="heading-simulasi-bayar" className="mt-4 text-3xl font-semibold leading-tight text-ink sm:text-[40px] text-balance">
                                    Satu orang batal tanpa kabar, satu jadwal terbuang.
                                </h2>
                                <p className="mt-3.5 max-w-xl text-base leading-relaxed text-mute sm:text-lg text-pretty">
                                    Misalnya tarif layanan kamu Rp75.000, lalu ada pelanggan yang pesan tapi tidak datang padahal orang lain sudah terlanjur ditolak. Geser angka di bawah untuk hitung perkiraan ruginya tiap bulan.
                                </p>
                            </div>

                            <div className="md:col-span-5">
                                <img
                                    src="/images/editorial-noshow.jpg"
                                    alt="Ilustrasi kapster menunggu di samping kursi barber yang kosong sambil melihat jam tangan ditemani kucing"
                                    loading="lazy"
                                    width={867}
                                    height={530}
                                    className="mx-auto h-auto w-full max-w-[360px] select-none mix-blend-multiply"
                                />
                            </div>
                        </div>

                        {/* Interactive Sliders */}
                        <div className="mt-8 grid gap-6 sm:grid-cols-2">
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
                                    <p className="text-xs font-semibold uppercase tracking-wide text-mute">
                                        Perkiraan pendapatan hilang
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className="text-2xl font-semibold tabular-nums text-ink sm:text-4xl">
                                            {formatRupiah(monthlyLoss)}
                                        </span>
                                        <span className="text-sm text-mute">/ bulan</span>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs leading-relaxed text-body">
                                    Hitungan dari {noShowsPerMonth} pesanan × {formatRupiah(servicePrice)}, belum termasuk pelanggan lain yang sempat ditolak karena jadwalnya penuh.
                                </p>
                            </div>

                            <div className="flex min-w-0 flex-col justify-between rounded-sm bg-dark p-4 text-on-dark sm:p-6">
                                <div>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-on-dark-mute">
                                            Paket Basic Janjiyan
                                        </p>
                                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-on-dark">
                                            Balik modal: {breakEvenBookings} pesanan
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className="text-2xl font-semibold tabular-nums text-on-dark sm:text-4xl">
                                            {formatRupiah(basicMonthlyPrice)}
                                        </span>
                                        <span className="text-sm text-on-dark-mute">/ bulan</span>
                                    </div>
                                </div>
                                <p className="mt-4 text-xs leading-relaxed text-on-dark-mute">
                                    Kunci pesanan dengan uang muka langsung ke rekening kamu dan kirim pengingat otomatis sebelum jadwal.
                                </p>
                            </div>
                        </div>

                        <p className="mt-5 text-center text-xs text-mute">
                            Angka di atas hanya simulasi. Hitungan aslinya beda di tiap usaha.
                        </p>
                    </div>
                </section>

                {/* 4 Outcome Cards (Grid 2x2 with Editorial Character Scenes) */}
                <section id="fitur" aria-labelledby="heading-fitur" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto mb-14 max-w-2xl text-center">
                        <h2 id="heading-fitur" className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Yang dikerjakan Janjiyan untuk usaha kamu
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-mute text-pretty">
                            Mulai dari pelanggan pesan, transfer uang muka ke rekening kamu, diingatkan sebelum datang, sampai rekap tim di akhir bulan.
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
                                        {/* Monochrome Editorial Scene Header inside Card */}
                                        <div className="mb-6 flex h-44 items-end justify-center overflow-hidden rounded-sm bg-canvas px-4 pt-2">
                                            <img
                                                src={item.illustration}
                                                alt={item.illustrationAlt}
                                                loading="lazy"
                                                className="max-h-40 w-auto object-contain select-none mix-blend-multiply"
                                            />
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-bone text-ink">
                                                <Icon className="size-4" aria-hidden="true" />
                                            </div>
                                            <h3 className="text-xl font-semibold leading-snug text-ink sm:text-2xl text-balance">
                                                {item.title}
                                            </h3>
                                        </div>

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

                {/* How to start — 3 Editorial Story Cards */}
                <section id="cara-mulai" aria-labelledby="heading-cara-mulai" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 id="heading-cara-mulai" className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Tiga langkah, langsung jalan
                        </h2>
                        <p className="mx-auto mt-3 max-w-xl text-base text-mute sm:text-lg text-pretty">
                            Sekali isi layanan dan rekening pembayaran di awal, link toko kamu langsung siap dipakai terima pesanan.
                        </p>
                    </div>

                    <ol className="mt-12 grid gap-6 md:grid-cols-3">
                        {STEPS.map((step, idx) => (
                            <li
                                key={step.title}
                                className="flex min-w-0 flex-col justify-between rounded-md border border-hairline-soft bg-canvas p-6 transition-colors hover:border-hairline"
                            >
                                <div>
                                    <div className="flex h-44 items-end justify-center overflow-hidden pb-2">
                                        <img
                                            src={step.illustration}
                                            alt={step.illustrationAlt}
                                            loading="lazy"
                                            className="max-h-40 w-auto object-contain select-none mix-blend-multiply"
                                        />
                                    </div>

                                    <div className="mt-4 flex items-start gap-3">
                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold tabular-nums text-canvas">
                                            {idx + 1}
                                        </span>
                                        <h3 className="text-lg font-semibold leading-snug text-ink">
                                            {step.title}
                                        </h3>
                                    </div>

                                    <p className="mt-2.5 text-sm leading-relaxed text-mute sm:text-base text-pretty">
                                        {step.desc}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-10 flex justify-center">
                        <Button asChild size="lg" className="min-h-14 h-auto py-3 whitespace-normal text-center">
                            <Link href={dashboardHref}>{primaryCtaLabel}</Link>
                        </Button>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="harga" aria-labelledby="heading-harga" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
                    <div className="text-center">
                        <h2 id="heading-harga" className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Pilih paket sesuai ukuran usaha kamu
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-mute text-pretty">
                            Semua paket bisa dicoba gratis 14 hari. Fitur uang muka tanpa potongan, pengingat email, dan aturan bayar penuh buat yang sering batal sudah aktif sejak paket Basic.
                        </p>

                        {/* Segmented Control */}
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
                                        'flex min-w-0 flex-col justify-between rounded-md p-5 transition-colors sm:p-6',
                                        isPopular ? 'bg-bone' : 'border border-hairline-soft bg-canvas hover:border-hairline'
                                    )}
                                >
                                    <div>
                                        <div className="flex flex-wrap items-start justify-between gap-2">
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
                                                {plan.can_export_csv ? (
                                                    <>
                                                        <Check className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
                                                        <span className="text-body">Export CSV (Pesanan, Pelanggan &amp; Komisi)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                                                        <span className="text-mute line-through">
                                                            Export CSV (Pesanan, Pelanggan &amp; Komisi)
                                                        </span>
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
                <section aria-labelledby="heading-testimoni" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
                    <div className="mb-12 text-center">
                        <h2 id="heading-testimoni" className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                            Cerita dari pengguna Janjiyan
                        </h2>
                    </div>

                    <div
                        data-testimonials-grid
                        className={cn(
                            'grid gap-4',
                            TESTIMONIALS.length === 1 && 'mx-auto max-w-2xl grid-cols-1',
                            TESTIMONIALS.length === 2 && 'mx-auto max-w-4xl sm:grid-cols-2',
                            TESTIMONIALS.length === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
                            TESTIMONIALS.length >= 4 && 'sm:grid-cols-2 lg:grid-cols-4'
                        )}
                    >
                        {TESTIMONIALS.map((t) => (
                            <div
                                key={t.name}
                                data-testimonial-card
                                className={cn(
                                    'flex min-w-0 flex-col justify-between rounded-sm border border-hairline-soft bg-canvas transition-colors hover:border-hairline',
                                    TESTIMONIALS.length === 1 ? 'p-6 sm:p-8' : 'p-5 sm:p-6'
                                )}
                            >
                                <p
                                    className={cn(
                                        'leading-relaxed text-ink text-pretty',
                                        TESTIMONIALS.length === 1 ? 'text-base sm:text-lg' : 'text-sm'
                                    )}
                                >
                                    “{t.quote}”
                                </p>
                                <div className="mt-6 flex items-start gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bone text-xs font-semibold text-ink">
                                        {t.initials ?? t.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-ink">{t.name}</p>
                                        <p className="text-xs text-mute">{t.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* FAQ */}
                <section id="faq" aria-labelledby="heading-faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
                    <h2 id="heading-faq" className="mb-10 text-center text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
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
                    <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-14 md:flex-row md:items-start">
                        <div className="min-w-0">
                            <h2 className="text-3xl font-semibold leading-tight text-on-dark sm:text-4xl text-balance">
                                Coba dulu 14 hari, gratis.
                            </h2>
                            <p className="mt-2.5 max-w-xl text-base text-on-dark-mute text-pretty">
                                Buat halaman toko pertama kamu hari ini, lalu lihat sendiri apakah cocok untuk kerja harian tim kamu.
                            </p>
                        </div>
                        <Button
                            asChild
                            size="lg"
                            className="min-h-14 h-auto shrink-0 py-3 whitespace-normal bg-canvas text-center text-ink hover:bg-bone focus-visible:ring-on-dark focus-visible:ring-offset-dark"
                        >
                            <Link href={dashboardHref}>
                                {primaryCtaLabel}
                            </Link>
                        </Button>
                    </div>

                    {/* Footer Links */}
                    <div className="mt-14 flex flex-col justify-between gap-12 md:flex-row md:items-end">
                        <div>
                            <JanjiyanLogo dark size="lg" />
                            <p className="mt-4 max-w-md text-lg text-on-dark-mute">
                                Untuk janji temu dan pesanan yang ditepati.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-12 text-sm text-on-dark-mute">
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Produk</p>
                                <ul className="space-y-1">
                                    <li><a href="#tipe-bisnis" className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Tipe bisnis</a></li>
                                    <li><a href="#fitur" className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Fitur</a></li>
                                    <li><a href="#harga" className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Harga</a></li>
                                    <li><a href="#faq" className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">FAQ</a></li>
                                </ul>
                            </div>
                            <div className="space-y-2.5">
                                <p className="font-semibold text-on-dark">Akun</p>
                                <ul className="space-y-1">
                                    {auth.user ? (
                                        <li>
                                            <Link href={dashboardHref} className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">
                                                {auth.user.is_superadmin ? 'Panel Superadmin' : 'Dashboard'}
                                            </Link>
                                        </li>
                                    ) : (
                                        <>
                                            <li><Link href={route('login')} className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Masuk</Link></li>
                                            <li><Link href={route('register')} className="inline-flex min-h-7 items-center rounded-sm hover:text-on-dark focus-visible:ring-2 focus-visible:ring-on-dark focus-visible:outline-none">Coba gratis</Link></li>
                                        </>
                                    )}
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
