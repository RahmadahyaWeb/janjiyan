import { Head, Link, usePage } from '@inertiajs/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
    Bell,
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Link as LinkIcon,
    MapPin,
    Package,
    ReceiptText,
    Scissors,
    Star,
    X,
} from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
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

// One booking, told from the customer's side only.
const JOURNEY = [
    {
        title: 'Buka link atau scan QR',
        desc: 'Dari bio Instagram, balasan chat, atau poster QR di meja kasir. Tanpa install aplikasi, tanpa bikin akun.',
        illustration: '/images/editorial-feature-qr.jpg',
        illustrationAlt: 'Ilustrasi pelanggan memindai poster QR booking di meja kasir studio',
    },
    {
        title: 'Pilih jadwal, bayar uang muka',
        desc: 'Pelanggan cuma melihat jam atau kuota yang masih kosong. Uang muka masuk langsung ke rekening atau QRIS kamu, tanpa potongan.',
        illustration: '/images/editorial-feature-dp.jpg',
        illustrationAlt: 'Ilustrasi pelanggan mengunci jadwal booking dengan pembayaran uang muka di smartphone',
    },
    {
        title: 'Jadwal terkunci, kamu dapat kabar',
        desc: 'Pesanan masuk ke kalender dan notifikasi kamu. Kalau uang muka tidak dibayar sampai batas waktu, slotnya terbuka lagi.',
        illustration: '/images/editorial-feature-calendar.jpg',
        illustrationAlt: 'Ilustrasi tim memantau papan jadwal harian dan menerima notifikasi booking di smartphone',
    },
];

// Three locked business types: one line each, detail lives in the FAQ.
const BUSINESS_TYPES = [
    {
        icon: Scissors,
        name: 'Janji Temu & Staff',
        contoh: 'Barbershop, salon, klinik, spa, pet grooming',
        desc: 'Pelanggan pilih staff dan jam. Shift, istirahat, dan cuti tiap staff ikut dihitung, dan komisi staff direkap otomatis.',
    },
    {
        icon: MapPin,
        name: 'Booking Tempat / Sesi',
        contoh: 'Lapangan padel, studio foto, kelas yoga, ruang meeting',
        desc: 'Pelanggan melihat sisa tempat di tiap sesi. Begitu terisi, sesinya tertutup, jadi tidak ada dua tim di jam yang sama.',
    },
    {
        icon: Package,
        name: 'Layanan Titip / Drop-off',
        contoh: 'Laundry, cuci sepatu, servis elektronik, bengkel',
        desc: 'Kuota harian membatasi titipan, dan pelanggan cek sendiri apakah titipannya sudah siap diambil.',
    },
];

const FEATURES = [
    {
        icon: Calendar,
        title: 'Kalender & antrean',
        desc: 'Lihat jadwal hari ini per staff, per sesi, atau per titipan dalam satu papan.',
    },
    {
        icon: ReceiptText,
        title: 'Kasir & struk',
        desc: 'Catat pelunasan lewat tunai, QRIS, transfer, atau EDC, lalu cetak struk atau kirim lewat WhatsApp.',
    },
    {
        icon: Bell,
        title: 'Notifikasi',
        desc: 'Pesanan baru dan bukti uang muka masuk ke dashboard, Telegram, dan email.',
    },
    {
        icon: Star,
        title: 'Ulasan Google',
        desc: 'Pelanggan puas diarahkan ke Google Maps. Yang kecewa memberi masukan ke kamu dulu.',
    },
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
            a: 'Tidak perlu aplikasi kasir tambahan. Kasir meja sudah ada di dalam Janjiyan untuk pelunasan, cicilan, dan tambah layanan di tempat (Tunai, QRIS, Transfer, atau EDC). Struk bisa dicetak ke printer termal 58mm atau 80mm, atau diunduh sebagai gambar PNG untuk WhatsApp. Usaha titip barang juga bisa mencetak tag barang 58mm supaya titipan tidak tertukar.',
        },
        {
            q: 'Bagaimana cara kerja ulasan Google Maps?',
            a: 'Pelanggan scan stiker QR di kasir, atau klik Beri Ulasan di invoice setelah pesanan selesai. Rating 4 bintang ke atas (batasnya bisa kamu atur) diarahkan ke halaman Google Maps Review usaha kamu. Rating rendah tersimpan sebagai masukan privat dan dikirim ke Telegram pemilik. Stiker QR bisa dicetak sebagai kotak PNG, tent card A6, atau lembar A4. Fitur ini tersedia mulai paket Professional.',
        },
        {
            q: 'Satu akun bisa dipakai untuk beberapa cabang?',
            a: `Bisa. Paket Professional mendukung hingga ${proBranches ?? 3} bisnis dalam satu akun, dan Enterprise hingga ${enterpriseBranches ?? 10}. Link toko, layanan, data pelanggan, kasir, dan rekening tiap cabang tetap terpisah.`,
        },
    ];
}

// Real phone captures of the demo shop, in booking order (re-capture when the portal UI changes).
const FLOW_SLIDES = [
    {
        src: '/images/flow-1-toko.jpg',
        title: 'Pelanggan buka halaman toko kamu',
        alt: 'Halaman toko Rapi Studio Barbershop: foto, jam buka, galeri, tombol Buat Janji Temu, dan daftar layanan',
    },
    {
        src: '/images/flow-2-layanan.jpg',
        title: 'Pilih layanan',
        alt: 'Langkah pilih layanan: Signature Haircut & Wash terpilih, Rp 85.000 dengan uang muka Rp 25.000',
    },
    {
        src: '/images/flow-3-jadwal.jpg',
        title: 'Pilih tanggal dan jam yang kosong',
        alt: 'Langkah pilih tanggal dan jam: Rabu 25 November, jam 10:30 terpilih di antara slot yang masih kosong',
    },
    {
        src: '/images/flow-4-data.jpg',
        title: 'Isi nama dan WhatsApp, lalu bayar uang muka',
        alt: 'Langkah data pemesan: nama dan nomor WhatsApp terisi, uang muka Rp 25.000 ditransfer ke rekening BCA toko',
    },
    {
        src: '/images/flow-5-konfirmasi.jpg',
        title: 'Pesanan dikonfirmasi, invoice langsung jadi',
        alt: 'Invoice berstatus Dikonfirmasi dengan uang muka terverifikasi, lengkap dengan layanan, staff, dan jadwal',
    },
];

// Swipeable phone mockup: native scroll-snap for touch/trackpad, buttons and dots for mouse and keyboard.
function FlowCarousel() {
    const trackRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const last = FLOW_SLIDES.length - 1;

    const goTo = (idx: number) => {
        const track = trackRef.current;
        if (!track) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        track.scrollTo({ left: idx * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    };

    const onScroll = () => {
        const track = trackRef.current;
        if (track) setActive(Math.round(track.scrollLeft / track.clientWidth));
    };

    const arrowClass =
        'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bone text-ink transition-colors hover:bg-hairline disabled:cursor-default disabled:opacity-40 disabled:hover:bg-bone focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none';

    return (
        <section aria-roledescription="carousel" aria-label="Alur pesan dari sisi pelanggan">
            <div className="rounded-[40px] bg-ink p-2.5">
                <div className="relative overflow-hidden rounded-[28px]">
                    <div
                        ref={trackRef}
                        onScroll={onScroll}
                        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {FLOW_SLIDES.map((slide, idx) => (
                            <div
                                key={slide.src}
                                role="group"
                                aria-roledescription="slide"
                                aria-label={`${idx + 1} dari ${FLOW_SLIDES.length}: ${slide.title}`}
                                className="w-full shrink-0 snap-center"
                            >
                                <img
                                    src={slide.src}
                                    alt={slide.alt}
                                    width={780}
                                    height={1560}
                                    loading={idx === 0 ? 'eager' : 'lazy'}
                                    fetchPriority={idx === 0 ? 'high' : 'auto'}
                                    draggable={false}
                                    className="aspect-[39/62] h-auto w-full select-none object-cover object-top"
                                />
                            </div>
                        ))}
                    </div>
                    {/* Fade the cropped screen so it reads as "keeps scrolling" */}
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-canvas to-transparent" />
                </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
                <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Langkah sebelumnya" className={arrowClass}>
                    <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <p aria-live="polite" className="min-w-0 flex-1 text-center text-sm leading-snug text-body">
                    <span className="font-mono text-xs tabular-nums text-mute">{active + 1}/{FLOW_SLIDES.length}</span>{' '}
                    <span className="font-medium text-ink">{FLOW_SLIDES[active].title}</span>
                </p>
                <button type="button" onClick={() => goTo(active + 1)} disabled={active === last} aria-label="Langkah berikutnya" className={arrowClass}>
                    <ChevronRight className="size-4" aria-hidden="true" />
                </button>
            </div>

            <div className="mt-3 flex justify-center gap-1">
                {FLOW_SLIDES.map((slide, idx) => (
                    <button
                        key={slide.src}
                        type="button"
                        onClick={() => goTo(idx)}
                        aria-label={`Ke langkah ${idx + 1}: ${slide.title}`}
                        aria-current={idx === active ? 'step' : undefined}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                    >
                        <span className={cn('block h-1.5 rounded-full transition-all', idx === active ? 'w-5 bg-ink' : 'w-1.5 bg-stone')} />
                    </button>
                ))}
            </div>
        </section>
    );
}

// One container for nav, every section and the footer, so all edges line up.
const CONTAINER = 'mx-auto w-full max-w-6xl px-4 sm:px-6';
const SECTION = `${CONTAINER} py-16 sm:py-20`;

// One heading style for every section: left-aligned, optional eyebrow, optional right-side slot.
function SectionHeading({ id, eyebrow, title, desc, children }: { id: string; eyebrow?: string; title: string; desc?: string; children?: ReactNode }) {
    return (
        <div className="mb-10 flex flex-col gap-6 sm:mb-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
                {eyebrow && (
                    <span className="mb-4 inline-flex rounded-full bg-bone px-3.5 py-1 text-xs font-semibold text-ink">{eyebrow}</span>
                )}
                <h2 id={id} className="text-3xl font-semibold leading-tight text-ink sm:text-[44px] text-balance">
                    <WordReveal>{title}</WordReveal>
                </h2>
                {desc && <p className="mt-4 max-w-xl text-base text-mute sm:text-lg text-pretty">{desc}</p>}
            </div>
            {children}
        </div>
    );
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
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [scrolled, setScrolled] = useState(false);
    const [servicePrice, setServicePrice] = useState(75000);
    const [noShowsPerMonth, setNoShowsPerMonth] = useState(26);
    const pageRef = useRef<HTMLDivElement>(null);

    const faqs = buildFaqs(plans);
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
                { selector: '[data-type-card]', trigger: '#tipe-usaha' },
                { selector: '[data-feature-tile]', trigger: '#fitur' },
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

            {/* Floating nav pill, same width as the page content */}
            <header className="sticky top-4 z-50">
                <div className={CONTAINER}>
                    <nav
                        aria-label="Navigasi utama"
                        className={cn(
                            'flex h-14 w-full items-center justify-between gap-2 rounded-full border border-transparent bg-bone px-3 transition-shadow duration-200 sm:px-5',
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
                            <a href="#alur" className={navLinkClass}>Cara kerja</a>
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
                </div>
            </header>

            <main id="main-content" tabIndex={-1} className="outline-none">
                {/* 1. Hero: promise on the left, the real booking flow on the right */}
                <section className={cn(CONTAINER, 'grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 lg:pt-20 lg:pb-20')}>
                    <div className="min-w-0">
                        <p
                            data-hero-item
                            className="mb-5 inline-flex max-w-full items-center rounded-full bg-bone px-4 py-1.5 text-xs font-semibold text-ink"
                        >
                            Untuk barbershop, salon, lapangan, studio, laundry, dan bengkel
                        </p>

                        <h1
                            data-hero-item
                            className="text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-6xl lg:text-[64px] text-balance"
                        >
                            Pelanggan pesan sendiri lewat satu link.
                        </h1>

                        <p
                            data-hero-item
                            className="mt-5 max-w-xl text-base leading-relaxed text-mute sm:text-lg text-pretty"
                        >
                            Mereka pilih layanan dan jadwal yang masih kosong, lalu bayar uang muka langsung ke rekening atau QRIS kamu. Kamu tidak perlu balas chat satu per satu.
                        </p>

                        <div
                            data-hero-item
                            className="mt-6 inline-flex max-w-full items-center gap-2.5 rounded-full bg-bone py-2 pr-2 pl-4 text-sm"
                        >
                            <LinkIcon className="size-4 shrink-0 text-mute" aria-hidden="true" />
                            <span className="truncate font-medium text-ink">namausaha.janjiyan.web.id</span>
                            <span className="hidden shrink-0 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-mute sm:inline">
                                Taruh di bio
                            </span>
                        </div>

                        <div data-hero-item className="mt-7 flex flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg" className="min-h-14 h-auto w-full py-3 whitespace-normal text-center sm:w-auto">
                                <Link href={dashboardHref}>{primaryCtaLabel}</Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="min-h-14 h-auto w-full py-3 sm:w-auto">
                                <a href="#alur">Lihat cara kerjanya</a>
                            </Button>
                        </div>

                        <ul data-hero-item className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-mute">
                            <li className="flex items-center gap-1.5"><Check className="size-3.5 text-ink" aria-hidden="true" />Gratis 14 hari</li>
                            <li className="flex items-center gap-1.5"><Check className="size-3.5 text-ink" aria-hidden="true" />0% potongan uang muka</li>
                            <li className="flex items-center gap-1.5"><Check className="size-3.5 text-ink" aria-hidden="true" />Pelanggan tanpa install aplikasi</li>
                        </ul>
                    </div>

                    <div data-hero-item className="mx-auto w-full max-w-[320px] lg:max-w-none">
                        <FlowCarousel />
                    </div>
                </section>

                {/* 2. Problem: same chat pain across the three business types */}
                <section id="masalah" aria-labelledby="heading-masalah" className={SECTION}>
                    <SectionHeading
                        id="heading-masalah"
                        title="Masih atur jadwal lewat chat?"
                        desc="Usahanya beda, capeknya sama: kamu jadi admin dulu, baru bisa kerja."
                    />

                    <ul className="grid gap-4 md:grid-cols-3 lg:gap-6">
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
                </section>

                {/* 3. Journey: one customer, three steps */}
                <section id="alur" aria-labelledby="heading-alur" className={SECTION}>
                    <SectionHeading
                        id="heading-alur"
                        eyebrow="Cara kerjanya"
                        title="Begini pelanggan memesan"
                        desc="Tiga langkah ini berjalan sendiri. Kamu tinggal melayani saat mereka datang."
                    />

                    <ol className="grid gap-4 md:grid-cols-3 lg:gap-6">
                        {JOURNEY.map((step, idx) => (
                            <li
                                key={step.title}
                                data-journey-card
                                className="flex min-w-0 flex-col rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6"
                            >
                                <div className="flex h-36 items-end justify-center overflow-hidden rounded-sm bg-bone px-4 pt-3">
                                    <img
                                        src={step.illustration}
                                        alt={step.illustrationAlt}
                                        loading="lazy"
                                        className="max-h-32 w-auto object-contain select-none mix-blend-multiply"
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

                    {TESTIMONIALS.map((t) => (
                        <figure
                            key={t.name}
                            data-testimonial-card
                            className="mt-4 flex flex-col gap-6 rounded-md bg-bone p-6 sm:p-10 lg:mt-6"
                        >
                            <blockquote className="max-w-3xl text-lg leading-relaxed text-ink text-pretty sm:text-2xl">
                                “{t.quote}”
                            </blockquote>
                            <figcaption className="flex items-center gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-semibold text-ink">
                                    {t.initials}
                                </span>
                                <span className="text-sm">
                                    <span className="block font-semibold text-ink">{t.name}</span>
                                    <span className="block text-xs text-mute">{t.role}</span>
                                </span>
                            </figcaption>
                        </figure>
                    ))}
                </section>

                {/* 4. Business types: three short cards, no second step list */}
                <section id="tipe-usaha" aria-labelledby="heading-tipe-usaha" className={SECTION}>
                    <SectionHeading
                        id="heading-tipe-usaha"
                        title="Cocok untuk tiga jenis usaha jasa"
                        desc="Pilih satu saat daftar. Halaman pesan dan dashboard ikut menyesuaikan."
                    />

                    <ul className="grid gap-4 md:grid-cols-3 lg:gap-6">
                        {BUSINESS_TYPES.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.name} data-type-card className="flex min-w-0 flex-col rounded-md border border-hairline-soft bg-canvas p-5 sm:p-6">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bone text-ink">
                                        <Icon className="size-5" aria-hidden="true" />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-ink">{item.name}</h3>
                                    <p className="mt-1 text-xs font-medium text-mute">{item.contoh}</p>
                                    <p className="mt-3 text-sm leading-relaxed text-body text-pretty">{item.desc}</p>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {/* 5. After the order: four plain tiles, spec detail lives in pricing and FAQ */}
                <section id="fitur" aria-labelledby="heading-fitur" className={SECTION}>
                    <SectionHeading
                        id="heading-fitur"
                        title="Setelah pesanan masuk, semua ada di satu tempat"
                        desc="Tidak perlu aplikasi kasir atau catatan terpisah."
                    />

                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                        {FEATURES.map((tile) => {
                            const Icon = tile.icon;
                            return (
                                <li key={tile.title} data-feature-tile className="flex min-w-0 flex-col rounded-md bg-bone p-5 sm:p-6">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink">
                                        <Icon className="size-4" aria-hidden="true" />
                                    </div>
                                    <h3 className="mt-4 text-base font-semibold text-ink">{tile.title}</h3>
                                    <p className="mt-1.5 text-sm leading-relaxed text-mute text-pretty">{tile.desc}</p>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {/* 6. Pricing, then the no-show calculator for the undecided */}
                <section id="harga" aria-labelledby="heading-harga" className={SECTION}>
                    <SectionHeading
                        id="heading-harga"
                        title="Mulai gratis, pilih paket saat sudah cocok"
                        desc="14 hari pertama gratis dengan fitur paket Professional. Setelah itu pilih paket sesuai ukuran usaha."
                    >
                        <div className="inline-flex min-h-12 max-w-full shrink-0 flex-wrap items-center self-start rounded-full bg-bone p-1 lg:self-auto" role="group" aria-label="Siklus penagihan">
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
                    </SectionHeading>

                    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
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

                    <div className="mt-4 rounded-md border border-hairline-soft p-5 sm:p-6 lg:mt-6">
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

                    <div className="mt-4 rounded-md border border-hairline-soft bg-canvas p-5 sm:p-10 lg:mt-6">
                        <div className="border-b border-divider pb-8">
                            <h3 className="text-2xl font-semibold leading-tight text-ink sm:text-3xl text-balance">
                                Masih ragu? Hitung rugi dari pelanggan yang batal tanpa kabar
                            </h3>
                            <p className="mt-3 max-w-2xl text-base leading-relaxed text-mute text-pretty">
                                Janji lewat chat tidak mengikat. Geser angka di bawah sesuai usaha kamu.
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

                        <p className="mt-5 text-xs text-mute">
                            Angka di atas hanya simulasi. Hasil di tiap usaha berbeda.
                        </p>
                    </div>
                </section>

                {/* 8. FAQ */}
                <section id="faq" aria-labelledby="heading-faq" className={cn(SECTION, 'grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]')}>
                    <div className="lg:sticky lg:top-28 lg:self-start">
                        <SectionHeading
                            id="heading-faq"
                            title="Yang sering ditanyakan"
                            desc="Tentang uang muka, kasir, ulasan Google, dan cabang."
                        />
                    </div>

                    <div className="min-w-0 space-y-3">
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
            <footer className="mt-8 rounded-t-md bg-dark pt-16 pb-[calc(4rem+env(safe-area-inset-bottom))] text-on-dark sm:pt-20 sm:pb-[calc(5rem+env(safe-area-inset-bottom))]">
                <div className={CONTAINER}>
                    <div className="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-14 md:flex-row md:items-center">
                        <div className="min-w-0">
                            <h2 className="text-3xl font-semibold leading-tight text-on-dark sm:text-4xl text-balance">
                                <WordReveal>Coba dulu 14 hari, gratis.</WordReveal>
                            </h2>
                            <p className="mt-2.5 max-w-xl text-base text-on-dark-mute text-pretty">
                                Daftar, isi layanan dan rekening, lalu pasang link di bio. Lihat sendiri berapa chat yang berkurang. Kalau cocok, baru pilih paket.
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
                                    <li><a href="#alur" className={footerLinkClass}>Cara kerja</a></li>
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
