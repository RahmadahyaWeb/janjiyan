import type { WhatsappTemplateKey } from '@/lib/whatsappTemplates';
import type { BusinessType, ServiceUnitLabel } from '@/types';

export interface BusinessTypeOption {
    value: BusinessType;
    label: string;
    shortLabel: string;
    tagline: string;
    description: string;
    examples: string[];
    businessNamePlaceholder: string;
    categoryPresets: string[];
}

export interface UnitLabelOption {
    value: ServiceUnitLabel;
    label: string;
    hint: string;
}

export interface BusinessTypeConfig {
    type: BusinessType;
    label: string;
    shortLabel: string;
    nav: {
        bookingsLabel: string;
        bookingsMobileLabel: string;
        servicesLabel: string;
        servicesMobileLabel: string;
        teamLabel: string;
        showCommissions: boolean;
        bookingsIconKey: 'calendar' | 'package';
    };
    dashboard: {
        onboardingStepsIncludeStaff: boolean;
        serviceStepLabel: string;
        serviceStepCta: string;
        paymentStepLabel: string;
        todayMetricLabel: string;
        recentSectionTitle: string;
        emptyRecentText: string;
    };
    bookings: {
        pageTitle: string;
        createButtonLabel: string;
        itemSingular: string;
        itemPlural: string;
        supportsCalendar: boolean;
        supportsWorkStatusQueue: boolean;
        supportsStaffColumn: boolean;
        supportsNoShow: boolean;
        emptyStateText: string;
    };
    services: {
        pageTitle: string;
        createButtonLabel: string;
        formTitleCreate: string;
        formTitleEdit: string;
        namePlaceholder: string;
        usesDuration: boolean;
        usesStaffAssignment: boolean;
        usesCapacity: boolean;
        usesDropoffFields: boolean;
        capacityLabel: string;
        capacityHint: string;
        priceLabel: string;
    };
    schedule: {
        pageTitle: string;
        infoBannerText: string;
        linkToStaffSchedules: boolean;
        breakTimeHint: string;
    };
    settings: {
        showLeadTimeMinutes: boolean;
        showReminderH2: boolean;
        showNoShowDp: boolean;
        whatsappTemplateKeys: WhatsappTemplateKey[];
        whatsappPlaceholders: string[];
    };
    publicPortal: {
        ctaLabel: string;
        bookingPageTitle: string;
        steps: {
            serviceLabel: string;
            staffLabel?: string;
            scheduleLabel: string;
            detailsLabel: string;
        };
        capacityHintLabel: string;
        durationOrTurnaroundLabel: string;
    };
}

export const UNIT_LABELS = ['item', 'pasang', 'kg', 'pcs', 'unit'] as const satisfies readonly ServiceUnitLabel[];

export const UNIT_LABEL_OPTIONS: UnitLabelOption[] = [
    { value: 'item', label: 'item', hint: 'Umum untuk berbagai barang' },
    { value: 'pasang', label: 'pasang', hint: 'Cocok untuk cuci/perawatan sepatu' },
    { value: 'kg', label: 'kg', hint: 'Cocok untuk laundry kiloan' },
    { value: 'pcs', label: 'pcs', hint: 'Cocok untuk tas, topi, atau pakaian satuan' },
    { value: 'unit', label: 'unit', hint: 'Cocok untuk servis elektronik atau kendaraan' },
];

export const BUSINESS_TYPE_LOCK_NOTICE =
    'Tipe bisnis dikunci permanen setelah disimpan dan tidak dapat diubah di Pengaturan. Untuk menjalankan tipe operasional berbeda, Anda perlu membuat bisnis baru.';

export const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = [
    {
        value: 'staff_appointment',
        label: 'Janji Temu & Staff',
        shortLabel: 'Janji Temu',
        tagline: 'Pelanggan memilih layanan, staff, dan jam kedatangan.',
        description:
            'Cocok untuk bisnis jasa yang bergantung pada jadwal tiap kapster, terapis, dokter, atau konsultan, lengkap dengan shift kerja dan komisi.',
        examples: ['Barbershop & Salon', 'Klinik & Kesehatan', 'Spa & Kecantikan', 'Pet Grooming'],
        businessNamePlaceholder: 'Contoh: Barber Rapi Studio',
        categoryPresets: [
            'Barbershop & Salon',
            'Klinik & Kesehatan',
            'Spa & Kecantikan',
            'Pet Grooming',
            'Konsultasi & Jasa',
        ],
    },
    {
        value: 'space_booking',
        label: 'Booking Tempat / Sesi',
        shortLabel: 'Tempat / Sesi',
        tagline: 'Pelanggan memesan slot jam untuk ruangan, lapangan, atau kelas.',
        description:
            'Cocok untuk sewa fasilitas dan kelas terjadwal dengan batas kapasitas per sesi tanpa perlu memilih staff.',
        examples: ['Lapangan Padel & Futsal', 'Studio Foto', 'Kelas Yoga & Workshop', 'Ruang Meeting'],
        businessNamePlaceholder: 'Contoh: Arena Padel Kemang',
        categoryPresets: [
            'Lapangan & Olahraga',
            'Studio Foto & Kreatif',
            'Kelas & Workshop',
            'Ruang Meeting & Event',
        ],
    },
    {
        value: 'dropoff',
        label: 'Layanan Titip / Drop-off',
        shortLabel: 'Drop-off',
        tagline: 'Pelanggan menitipkan barang sesuai kuota harian dan estimasi selesai.',
        description:
            'Cocok untuk layanan pengerjaan beberapa hari dengan satuan custom (pasang, kg, pcs, unit), antrean status kerja, dan opsi jemput-antar.',
        examples: ['Cuci Sepatu & Tas', 'Laundry & Dry Clean', 'Servis Elektronik', 'Bengkel & Detailing'],
        businessNamePlaceholder: 'Contoh: Soklenn Cuci Sepatu',
        categoryPresets: [
            'Cuci Sepatu & Tas',
            'Laundry & Dry Clean',
            'Servis Elektronik & Gadget',
            'Bengkel & Detailing',
            'Jahit & Permak',
        ],
    },
];

export const BUSINESS_TYPE_CONFIG: Record<BusinessType, BusinessTypeConfig> = {
    staff_appointment: {
        type: 'staff_appointment',
        label: 'Janji Temu & Staff',
        shortLabel: 'Janji Temu',
        nav: {
            bookingsLabel: 'Reservasi',
            bookingsMobileLabel: 'Reservasi',
            servicesLabel: 'Layanan',
            servicesMobileLabel: 'Layanan',
            teamLabel: 'Tim & Staff',
            showCommissions: true,
            bookingsIconKey: 'calendar',
        },
        dashboard: {
            onboardingStepsIncludeStaff: true,
            serviceStepLabel: 'Tambah Layanan',
            serviceStepCta: 'Tambah Layanan Pertama',
            paymentStepLabel: 'Atur Pembayaran DP',
            todayMetricLabel: 'Janji Temu Hari Ini',
            recentSectionTitle: 'Reservasi Terbaru',
            emptyRecentText: 'Belum ada reservasi masuk. Bagikan link toko Anda untuk mulai menerima janji temu.',
        },
        bookings: {
            pageTitle: 'Reservasi',
            createButtonLabel: 'Tambah Reservasi',
            itemSingular: 'Reservasi',
            itemPlural: 'Reservasi',
            supportsCalendar: true,
            supportsWorkStatusQueue: false,
            supportsStaffColumn: true,
            supportsNoShow: true,
            emptyStateText: 'Belum ada reservasi yang cocok dengan filter ini. Buat reservasi baru atau atur ulang filter.',
        },
        services: {
            pageTitle: 'Layanan',
            createButtonLabel: 'Tambah Layanan',
            formTitleCreate: 'Tambah Layanan Baru',
            formTitleEdit: 'Edit Layanan',
            namePlaceholder: 'Contoh: Signature Haircut & Wash',
            usesDuration: true,
            usesStaffAssignment: true,
            usesCapacity: false,
            usesDropoffFields: false,
            capacityLabel: 'Kapasitas',
            capacityHint: 'Satu staff melayani satu pelanggan pada setiap slot waktu.',
            priceLabel: 'Harga Layanan',
        },
        schedule: {
            pageTitle: 'Jam Buka & Hari Libur',
            infoBannerText:
                'Jam buka toko menjadi batas utama penjadwalan. Anda dapat mengatur shift pribadi atau cuti masing-masing staff di halaman Tim & Staff.',
            linkToStaffSchedules: true,
            breakTimeHint: 'Pelanggan tidak dapat memilih jam janji temu selama jam istirahat berlangsung.',
        },
        settings: {
            showLeadTimeMinutes: true,
            showReminderH2: true,
            showNoShowDp: true,
            whatsappTemplateKeys: ['reminder', 'dp_verified', 'confirmed', 'follow_up'],
            whatsappPlaceholders: [
                '{customer_name}',
                '{business_name}',
                '{service_name}',
                '{staff_name}',
                '{date}',
                '{time}',
                '{booking_code}',
                '{dp_amount}',
                '{total_price}',
                '{invoice_url}',
                '{business_address}',
            ],
        },
        publicPortal: {
            ctaLabel: 'Buat Janji Temu',
            bookingPageTitle: 'Buat Janji Temu',
            steps: {
                serviceLabel: 'Pilih Layanan',
                staffLabel: 'Pilih Staff',
                scheduleLabel: 'Pilih Tanggal & Jam',
                detailsLabel: 'Data & DP',
            },
            capacityHintLabel: 'Slot tersedia',
            durationOrTurnaroundLabel: 'Durasi layanan',
        },
    },
    space_booking: {
        type: 'space_booking',
        label: 'Booking Tempat / Sesi',
        shortLabel: 'Tempat / Sesi',
        nav: {
            bookingsLabel: 'Jadwal Booking',
            bookingsMobileLabel: 'Booking',
            servicesLabel: 'Fasilitas & Paket',
            servicesMobileLabel: 'Fasilitas',
            teamLabel: 'Tim & Admin',
            showCommissions: false,
            bookingsIconKey: 'calendar',
        },
        dashboard: {
            onboardingStepsIncludeStaff: false,
            serviceStepLabel: 'Tambah Fasilitas / Paket',
            serviceStepCta: 'Tambah Fasilitas Pertama',
            paymentStepLabel: 'Atur Pembayaran DP',
            todayMetricLabel: 'Sesi Hari Ini',
            recentSectionTitle: 'Jadwal Booking Terbaru',
            emptyRecentText: 'Belum ada jadwal booking masuk. Bagikan link portal agar pelanggan bisa memesan sesi.',
        },
        bookings: {
            pageTitle: 'Jadwal Booking',
            createButtonLabel: 'Tambah Booking',
            itemSingular: 'Booking',
            itemPlural: 'Jadwal Booking',
            supportsCalendar: true,
            supportsWorkStatusQueue: false,
            supportsStaffColumn: false,
            supportsNoShow: true,
            emptyStateText: 'Belum ada jadwal booking yang sesuai filter. Tambahkan booking manual atau ubah filter pencarian.',
        },
        services: {
            pageTitle: 'Fasilitas & Paket',
            createButtonLabel: 'Tambah Fasilitas/Paket',
            formTitleCreate: 'Tambah Fasilitas / Paket',
            formTitleEdit: 'Edit Fasilitas / Paket',
            namePlaceholder: 'Contoh: Sewa Lapangan Padel (1 Jam)',
            usesDuration: true,
            usesStaffAssignment: false,
            usesCapacity: true,
            usesDropoffFields: false,
            capacityLabel: 'Kapasitas Maks. per Sesi',
            capacityHint: 'Jumlah unit lapangan, ruangan, atau peserta maksimal yang dapat masuk di jam yang sama.',
            priceLabel: 'Tarif per Sesi',
        },
        schedule: {
            pageTitle: 'Jam Operasional & Hari Libur',
            infoBannerText:
                'Jam operasional menentukan slot sesi yang dibuka di portal booking. Hari libur menutup semua sesi pada tanggal terkait.',
            linkToStaffSchedules: false,
            breakTimeHint: 'Slot sesi tidak dibuka selama jam istirahat operasional berlangsung.',
        },
        settings: {
            showLeadTimeMinutes: true,
            showReminderH2: true,
            showNoShowDp: true,
            whatsappTemplateKeys: ['reminder', 'dp_verified', 'confirmed', 'follow_up'],
            whatsappPlaceholders: [
                '{customer_name}',
                '{business_name}',
                '{service_name}',
                '{date}',
                '{time}',
                '{booking_code}',
                '{dp_amount}',
                '{total_price}',
                '{invoice_url}',
                '{business_address}',
            ],
        },
        publicPortal: {
            ctaLabel: 'Booking Tempat / Sesi',
            bookingPageTitle: 'Booking Tempat / Sesi',
            steps: {
                serviceLabel: 'Pilih Fasilitas / Paket',
                scheduleLabel: 'Pilih Tanggal & Jam',
                detailsLabel: 'Data & DP',
            },
            capacityHintLabel: 'Sisa kapasitas sesi',
            durationOrTurnaroundLabel: 'Durasi sesi',
        },
    },
    dropoff: {
        type: 'dropoff',
        label: 'Layanan Titip / Drop-off',
        shortLabel: 'Drop-off',
        nav: {
            bookingsLabel: 'Pesanan',
            bookingsMobileLabel: 'Pesanan',
            servicesLabel: 'Layanan & Tarif',
            servicesMobileLabel: 'Layanan',
            teamLabel: 'Tim & Admin',
            showCommissions: false,
            bookingsIconKey: 'package',
        },
        dashboard: {
            onboardingStepsIncludeStaff: false,
            serviceStepLabel: 'Tambah Layanan & Tarif',
            serviceStepCta: 'Tambah Layanan Drop-off',
            paymentStepLabel: 'Atur Pembayaran DP',
            todayMetricLabel: 'Pesanan Masuk Hari Ini',
            recentSectionTitle: 'Pesanan Terbaru',
            emptyRecentText: 'Belum ada pesanan drop-off masuk. Bagikan link portal atau catat pesanan langsung dari kasir.',
        },
        bookings: {
            pageTitle: 'Pesanan',
            createButtonLabel: 'Tambah Pesanan',
            itemSingular: 'Pesanan',
            itemPlural: 'Pesanan',
            supportsCalendar: false,
            supportsWorkStatusQueue: true,
            supportsStaffColumn: false,
            supportsNoShow: false,
            emptyStateText: 'Belum ada pesanan pada status ini. Catat pesanan baru atau pilih tab status lainnya.',
        },
        services: {
            pageTitle: 'Layanan & Tarif',
            createButtonLabel: 'Tambah Layanan',
            formTitleCreate: 'Tambah Layanan Drop-off',
            formTitleEdit: 'Edit Layanan Drop-off',
            namePlaceholder: 'Contoh: Deep Clean Sepatu',
            usesDuration: false,
            usesStaffAssignment: false,
            usesCapacity: true,
            usesDropoffFields: true,
            capacityLabel: 'Kuota Harian Maksimal',
            capacityHint: 'Batas jumlah satuan yang sanggup diterima per hari agar pengerjaan tetap tepat waktu.',
            priceLabel: 'Tarif per Satuan',
        },
        schedule: {
            pageTitle: 'Jam Drop-off, Pengambilan & Libur',
            infoBannerText:
                'Jam operasional menentukan jadwal toko menerima barang drop-off, penjemputan, dan pengambilan pesanan. Hari libur tidak dihitung sebagai hari buka penerimaan.',
            linkToStaffSchedules: false,
            breakTimeHint: 'Opsional: tandai jam istirahat jika layanan antar-jemput atau loket penerimaan tutup sementara.',
        },
        settings: {
            showLeadTimeMinutes: false,
            showReminderH2: false,
            showNoShowDp: false,
            whatsappTemplateKeys: ['reminder', 'dp_verified', 'confirmed', 'ready_for_pickup', 'follow_up'],
            whatsappPlaceholders: [
                '{customer_name}',
                '{business_name}',
                '{service_name}',
                '{quantity}',
                '{unit_label}',
                '{date}',
                '{estimated_ready_date}',
                '{booking_code}',
                '{dp_amount}',
                '{total_price}',
                '{invoice_url}',
                '{business_address}',
            ],
        },
        publicPortal: {
            ctaLabel: 'Titip / Pesan Sekarang',
            bookingPageTitle: 'Titip / Pesan Layanan',
            steps: {
                serviceLabel: 'Pilih Layanan',
                scheduleLabel: 'Tanggal, Jumlah & Antar/Jemput',
                detailsLabel: 'Data & DP',
            },
            capacityHintLabel: 'Sisa kuota harian',
            durationOrTurnaroundLabel: 'Estimasi selesai',
        },
    },
};

export function resolveBusinessType(type?: BusinessType | string | null): BusinessType {
    if (type === 'staff_appointment' || type === 'space_booking' || type === 'dropoff') {
        return type;
    }

    return 'staff_appointment';
}

export function getBusinessTypeConfig(type?: BusinessType | string | null): BusinessTypeConfig {
    return BUSINESS_TYPE_CONFIG[resolveBusinessType(type)];
}

export function getBusinessTypeOption(type?: BusinessType | string | null): BusinessTypeOption {
    const resolved = resolveBusinessType(type);
    return BUSINESS_TYPE_OPTIONS.find((option) => option.value === resolved) ?? BUSINESS_TYPE_OPTIONS[0];
}
