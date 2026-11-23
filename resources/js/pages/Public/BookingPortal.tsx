import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, FileText, MessageCircle } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BusinessHeader, headerActionClass } from '@/components/BusinessHeader';
import { JanjiyanLogo } from '@/components/JanjiyanLogo';
import {
    BookingProgressNav,
    type BookingStepKey,
    type ProgressStepItem,
} from '@/components/booking/BookingProgressNav';
import { BookingSummaryCard } from '@/components/booking/BookingSummaryCard';
import { CustomerDetailsStep } from '@/components/booking/CustomerDetailsStep';
import { MobileBookingBar } from '@/components/booking/MobileBookingBar';
import { ScheduleSelectionStep } from '@/components/booking/ScheduleSelectionStep';
import { ServiceSelectionStep } from '@/components/booking/ServiceSelectionStep';
import { StaffSelectionStep } from '@/components/booking/StaffSelectionStep';
import type {
    BusinessData,
    OperatingHourItem,
    QuickDateItem,
    ServiceItem,
} from '@/components/booking/types';
import { Button } from '@/components/ui/button';
import { type DropoffAvailability, type SlotItem, useSlotFetcher } from '@/hooks/useSlotFetcher';
import { getBusinessTypeConfig, resolveBusinessType } from '@/lib/businessType';
import {
    buildWhatsAppUrl,
    formatDateShortIndo,
    formatRupiah,
    getLocalDayOfWeek,
    getTodayInTimezone,
} from '@/lib/format';
import { cn, scrollToFirstInvalid } from '@/lib/utils';
import type { PageProps, ServiceAddon } from '@/types';

interface BookingPortalProps {
    business: BusinessData;
    services: ServiceItem[];
    addons?: ServiceAddon[];
    canUseMultiServiceDropoff?: boolean;
    operatingHours?: OperatingHourItem[];
    holidays: string[];
    selectedServiceId?: number | null;
    bookingDisabledReason?: string | null;
}

export default function BookingPortal({
    business,
    services,
    addons = [],
    canUseMultiServiceDropoff = false,
    operatingHours = [],
    holidays,
    selectedServiceId = null,
    bookingDisabledReason = null,
}: BookingPortalProps) {
    const { errors = {} } = usePage<PageProps & { errors?: Record<string, string> }>().props;

    const tz = business.timezone || 'Asia/Jakarta';
    const todayLocal = useMemo(() => getTodayInTimezone(tz), [tz]);
    const maxAdvanceDays = Math.max(0, business.max_booking_advance_days ?? 60);
    const maxDateLocal = useMemo(() => {
        const d = new Date(`${todayLocal}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + maxAdvanceDays);
        return d.toISOString().slice(0, 10);
    }, [todayLocal, maxAdvanceDays]);

    const hoursByDay = useMemo(() => {
        const map = new Map<number, OperatingHourItem>();
        for (const h of operatingHours) {
            map.set(h.day_of_week, h);
        }
        return map;
    }, [operatingHours]);

    // Quick-pick strip for the next 14 days; the native date input stays for dates further out.
    const quickDates = useMemo<QuickDateItem[]>(() => {
        const days: QuickDateItem[] = [];
        const d = new Date(`${todayLocal}T00:00:00Z`);
        for (let i = 0; i < 14; i++) {
            const date = d.toISOString().slice(0, 10);
            if (date > maxDateLocal) break;
            const schedule = hoursByDay.get(d.getUTCDay());
            days.push({
                date,
                closed: Boolean(schedule && !schedule.is_open) || holidays.includes(date),
            });
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return days;
    }, [todayLocal, maxDateLocal, hoursByDay, holidays]);

    // Default to the nearest open date so users do not land on a "closed today" message.
    const defaultOpenDate = useMemo(
        () => quickDates.find((q) => !q.closed)?.date ?? todayLocal,
        [quickDates, todayLocal]
    );

    const businessType = resolveBusinessType(business.business_type);
    const typeConfig = getBusinessTypeConfig(businessType);
    const isStaffAppointment = businessType === 'staff_appointment';
    const isMultiDropoffMode = Boolean(businessType === 'dropoff' && canUseMultiServiceDropoff);

    // Auto-select only when navigated with ?layanan= or when there is a single service.
    const initialSelectedService = useMemo(() => {
        if (selectedServiceId) {
            return services.find((s) => s.id === selectedServiceId) ?? null;
        }
        return services.length === 1 ? services[0] : null;
    }, [services, selectedServiceId]);

    const [selectedService, setSelectedService] = useState<ServiceItem | null>(initialSelectedService);
    const [dropoffCart, setDropoffCart] = useState<Array<{ service_id: number; quantity: number }>>(() =>
        initialSelectedService ? [{ service_id: initialSelectedService.id, quantity: 1 }] : []
    );
    const [addonQuantities, setAddonQuantities] = useState<Record<number, number>>({});
    const [multiDropoffMap, setMultiDropoffMap] = useState<Record<number, DropoffAvailability>>({});
    const [multiDropoffLoading, setMultiDropoffLoading] = useState(false);
    const [multiDropoffLoaded, setMultiDropoffLoaded] = useState(false);

    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(defaultOpenDate);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [slotClearedMessage, setSlotClearedMessage] = useState<string>('');
    const [scheduleGateError, setScheduleGateError] = useState<string>('');
    const [quantity, setQuantity] = useState<number>(1);
    const [fulfillmentType, setFulfillmentType] = useState<'dropoff' | 'pickup'>('dropoff');
    const [pickupSession, setPickupSession] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('anytime');
    const [pickupAddress, setPickupAddress] = useState('');
    const [pickupAddressError, setPickupAddressError] = useState('');

    // Start directly on Step 2 only when a single/linked time-slot service has no add-ons to configure.
    const [activeStep, setActiveStep] = useState<BookingStepKey>(() => {
        if (!initialSelectedService) return 'service';
        const isInitialDropoff =
            businessType === 'dropoff' || initialSelectedService.booking_mode === 'dropoff';
        const hasAddonsForInitial = addons.some(
            (addon) =>
                addon.is_active &&
                (addon.service_ids && addon.service_ids.length > 0
                    ? addon.service_ids.includes(initialSelectedService.id)
                    : Boolean(addon.applies_to_all_services))
        );
        if (!isInitialDropoff && !hasAddonsForInitial) {
            return 'schedule';
        }
        return 'service';
    });

    // Arrived from a service on the shop home while staying on Step 1: scroll that card into view.
    useEffect(() => {
        if (selectedServiceId && activeStep === 'service') {
            document.getElementById(`service-${selectedServiceId}`)?.scrollIntoView({ block: 'center' });
        }
    }, [selectedServiceId, activeStep]);

    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerNotes, setCustomerNotes] = useState('');
    const [dpMode, setDpMode] = useState<'now' | 'later'>('now');
    const [dpProof, setDpProof] = useState<File | null>(null);
    const [dpProofError, setDpProofError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    const selectedDateDayOfWeek = getLocalDayOfWeek(selectedDate);
    const selectedDateSchedule = hoursByDay.get(selectedDateDayOfWeek);
    const isSelectedDateClosed = Boolean(selectedDateSchedule && !selectedDateSchedule.is_open);

    const selectedStaffObj = useMemo(() => {
        if (!selectedService || selectedStaffId === null) return null;
        return selectedService.staff.find((s) => s.id === selectedStaffId) ?? null;
    }, [selectedService, selectedStaffId]);

    const isSelectedHoliday = holidays.includes(selectedDate);
    const isCustomDate = !quickDates.some((q) => q.date === selectedDate);
    const isDropoffService = businessType === 'dropoff' || selectedService?.booking_mode === 'dropoff';

    const activeServiceLines = useMemo(() => {
        if (isMultiDropoffMode) {
            return dropoffCart
                .map((entry) => {
                    const svc = services.find((s) => s.id === entry.service_id);
                    return svc ? { service: svc, quantity: Math.max(1, entry.quantity) } : null;
                })
                .filter((x): x is { service: ServiceItem; quantity: number } => x !== null);
        }

        if (!selectedService) return [];
        const qty = isDropoffService ? Math.max(1, quantity) : 1;
        return [{ service: selectedService, quantity: qty }];
    }, [isMultiDropoffMode, dropoffCart, services, selectedService, isDropoffService, quantity]);

    const hasSelectedService = activeServiceLines.length > 0;
    const showMobileBottomBar = hasSelectedService || activeStep !== 'service';

    // Keep focused fields and scroll targets clear of the mobile bottom bar (WCAG 2.4.11).
    useEffect(() => {
        const padding = ['scroll-pt-4', 'scroll-pb-32', 'lg:scroll-pb-0'];
        if (showMobileBottomBar) {
            document.documentElement.classList.add(...padding);
        } else {
            document.documentElement.classList.remove(...padding);
        }
        return () => document.documentElement.classList.remove(...padding);
    }, [showMobileBottomBar]);

    const selectedServiceIds = useMemo(
        () => activeServiceLines.map((l) => l.service.id),
        [activeServiceLines]
    );

    const applicableAddons = useMemo(
        () =>
            addons.filter((addon) => {
                if (!addon.is_active || selectedServiceIds.length === 0) return false;
                if (addon.service_ids && addon.service_ids.length > 0) {
                    return selectedServiceIds.some((id) => addon.service_ids.includes(id));
                }
                return Boolean(addon.applies_to_all_services);
            }),
        [addons, selectedServiceIds]
    );

    const selectedAddonLines = useMemo(
        () =>
            applicableAddons
                .map((addon) => ({
                    addon,
                    quantity: addonQuantities[addon.id] ?? 0,
                }))
                .filter((line) => line.quantity > 0),
        [applicableAddons, addonQuantities]
    );

    const extraAddonDuration = useMemo(
        () =>
            isDropoffService
                ? 0
                : selectedAddonLines.reduce(
                      (sum, line) => sum + Math.max(0, line.addon.duration_minutes) * line.quantity,
                      0
                  ),
        [isDropoffService, selectedAddonLines]
    );

    const anyPickupSupported = activeServiceLines.some((l) => Boolean(l.service.supports_pickup));

    const slotUrl = useMemo(() => {
        if (
            isMultiDropoffMode ||
            !selectedService ||
            !selectedDate ||
            isSelectedHoliday ||
            isSelectedDateClosed
        ) {
            return null;
        }
        const params = new URLSearchParams({
            service_id: String(selectedService.id),
            date: selectedDate,
        });
        if (selectedService.assignment_mode === 'staff' && selectedStaffId !== null) {
            params.set('staff_id', String(selectedStaffId));
        }
        if (!isDropoffService) {
            selectedAddonLines.forEach((line, idx) => {
                params.set(`addons[${idx}][service_addon_id]`, String(line.addon.id));
                params.set(`addons[${idx}][quantity]`, String(line.quantity));
            });
        }
        return `${route('public.booking.slots', business.slug)}?${params.toString()}`;
    }, [
        isMultiDropoffMode,
        business.slug,
        selectedService,
        selectedStaffId,
        selectedDate,
        isSelectedHoliday,
        isSelectedDateClosed,
        isDropoffService,
        selectedAddonLines,
    ]);

    const selectedUnitLabel = selectedService?.unit_label ?? 'item';
    const showStaffStep = Boolean(
        isStaffAppointment &&
            !isDropoffService &&
            selectedService?.assignment_mode === 'staff' &&
            selectedService.staff.length > 0
    );
    const bookingNoun =
        businessType === 'dropoff' ? 'pesanan' : businessType === 'space_booking' ? 'booking' : 'reservasi';
    const lookupLabel =
        businessType === 'dropoff'
            ? 'Cek pesanan'
            : businessType === 'space_booking'
              ? 'Cek booking'
              : 'Cek reservasi';
    const submitLabel =
        businessType === 'dropoff'
            ? 'Buat pesanan'
            : businessType === 'space_booking'
              ? 'Buat booking'
              : 'Buat reservasi';

    const selectedTimeRef = useRef(selectedTime);
    selectedTimeRef.current = selectedTime;

    const { slots, dropoff, hasLoaded: slotsLoaded, showInitialLoading, showRefreshing } = useSlotFetcher({
        url: slotUrl,
        enabled: slotUrl !== null,
        onResolved: (nextSlots: SlotItem[], nextDropoff) => {
            if (isDropoffService) {
                setSelectedTime('');
                setSlotClearedMessage('');
                if (nextDropoff && nextDropoff.remaining_capacity > 0) {
                    setQuantity((prev) => Math.min(prev, nextDropoff.remaining_capacity));
                }
                return;
            }
            const prevTime = selectedTimeRef.current;
            if (prevTime && !nextSlots.some((s) => s.time === prevTime)) {
                setSelectedTime('');
                setSlotClearedMessage('Jam yang dipilih sebelumnya tidak tersedia untuk pilihan ini. Silakan pilih jam baru.');
            }
        },
    });

    const multiDropoffIdsKey = selectedServiceIds.join(',');
    useEffect(() => {
        if (
            !isMultiDropoffMode ||
            !selectedDate ||
            isSelectedHoliday ||
            isSelectedDateClosed ||
            selectedServiceIds.length === 0
        ) {
            setMultiDropoffMap({});
            setMultiDropoffLoading(false);
            setMultiDropoffLoaded(false);
            return;
        }

        const controller = new AbortController();
        setMultiDropoffLoading(true);
        Promise.all(
            selectedServiceIds.map((id) => {
                const params = new URLSearchParams({
                    service_id: String(id),
                    date: selectedDate,
                });
                return fetch(`${route('public.booking.slots', business.slug)}?${params.toString()}`, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((data: { dropoff?: DropoffAvailability | null } | null) => ({
                        id,
                        dropoff: data?.dropoff ?? null,
                    }));
            })
        )
            .then((results) => {
                if (controller.signal.aborted) return;
                const nextMap: Record<number, DropoffAvailability> = {};
                for (const r of results) {
                    if (r.dropoff) {
                        nextMap[r.id] = r.dropoff;
                    }
                }
                setMultiDropoffMap(nextMap);
                setMultiDropoffLoaded(true);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setMultiDropoffMap({});
                    setMultiDropoffLoaded(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setMultiDropoffLoading(false);
                }
            });

        return () => controller.abort();
    }, [
        isMultiDropoffMode,
        business.slug,
        selectedDate,
        isSelectedHoliday,
        isSelectedDateClosed,
        multiDropoffIdsKey,
    ]);

    useEffect(() => {
        if (isSelectedHoliday || isSelectedDateClosed) {
            setSelectedTime('');
        }
    }, [isSelectedHoliday, isSelectedDateClosed]);

    // Route back to the relevant step automatically if backend validation fails on submit.
    useEffect(() => {
        const errorKeys = Object.keys(errors);
        if (errorKeys.length === 0) return;
        if (errorKeys.some((k) => ['pickup_address', 'date', 'time'].includes(k))) {
            setActiveStep('schedule');
        } else if (
            errorKeys.some((k) =>
                ['customer_name', 'customer_phone', 'customer_email', 'customer_notes', 'dp_proof'].includes(k)
            )
        ) {
            setActiveStep('details');
        }
    }, [errors]);

    const effectiveQuantity = isDropoffService ? Math.max(1, quantity) : 1;
    const servicesSubtotal = activeServiceLines.reduce(
        (sum, line) => sum + line.service.price * line.quantity,
        0
    );
    const addonsSubtotal = selectedAddonLines.reduce(
        (sum, line) => sum + line.addon.price * line.quantity,
        0
    );
    const computedTotalPrice = servicesSubtotal + addonsSubtotal;
    const rawDpTotal = activeServiceLines.reduce(
        (sum, line) => sum + (line.service.dp_amount ?? 0) * line.quantity,
        0
    );
    const computedDpAmount = Math.min(computedTotalPrice, rawDpTotal);
    const requiresDp = computedDpAmount > 0;

    const multiEstimatedReadyDate = useMemo(() => {
        if (!isMultiDropoffMode) return dropoff?.estimated_ready_date ?? null;
        let maxDate: string | null = null;
        for (const line of activeServiceLines) {
            const d = multiDropoffMap[line.service.id]?.estimated_ready_date;
            if (d && (!maxDate || d > maxDate)) {
                maxDate = d;
            }
        }
        return maxDate;
    }, [isMultiDropoffMode, dropoff, activeServiceLines, multiDropoffMap]);

    const multiWindowInfo = useMemo(() => {
        if (!isMultiDropoffMode) {
            return dropoff?.available ? { open_time: dropoff.open_time, close_time: dropoff.close_time } : null;
        }
        for (const line of activeServiceLines) {
            const info = multiDropoffMap[line.service.id];
            if (info?.available) {
                return { open_time: info.open_time, close_time: info.close_time };
            }
        }
        return null;
    }, [isMultiDropoffMode, dropoff, activeServiceLines, multiDropoffMap]);

    const isDropoffReady = Boolean(
        isDropoffService &&
            hasSelectedService &&
            !isSelectedHoliday &&
            !isSelectedDateClosed &&
            (isMultiDropoffMode
                ? !multiDropoffLoading &&
                  multiDropoffLoaded &&
                  activeServiceLines.every((line) => {
                      const info = multiDropoffMap[line.service.id];
                      return Boolean(info?.available && info.remaining_capacity >= line.quantity);
                  })
                : dropoff?.available && dropoff.remaining_capacity >= effectiveQuantity)
    );

    const isScheduleReady = isDropoffService
        ? isDropoffReady
        : Boolean(hasSelectedService && selectedTime);

    useEffect(() => {
        if (isScheduleReady) {
            setScheduleGateError('');
        }
    }, [isScheduleReady]);

    const toggleDropoffCartService = (service: ServiceItem) => {
        setPickupAddressError('');
        setScheduleGateError('');
        setDropoffCart((prev) => {
            const exists = prev.some((item) => item.service_id === service.id);
            if (exists) {
                const next = prev.filter((item) => item.service_id !== service.id);
                const firstSvc = services.find((s) => s.id === next[0]?.service_id) ?? null;
                setSelectedService(firstSvc);
                return next;
            }
            const next = [...prev, { service_id: service.id, quantity: 1 }];
            if (!selectedService) {
                setSelectedService(service);
            }
            return next;
        });
    };

    const updateDropoffCartQty = (serviceId: number, nextQty: number) => {
        const clamped = Math.max(1, Math.min(50, nextQty));
        setDropoffCart((prev) =>
            prev.map((item) => (item.service_id === serviceId ? { ...item, quantity: clamped } : item))
        );
    };

    const updateSingleDropoffQty = (nextQty: number) => {
        setQuantity(Math.max(1, Math.min(50, nextQty)));
    };

    const updateAddonQty = (addonId: number, nextQty: number) => {
        const clamped = Math.max(0, Math.min(50, nextQty));
        setAddonQuantities((prev) => ({
            ...prev,
            [addonId]: clamped,
        }));
    };

    const handleSelectSingleService = (service: ServiceItem) => {
        setSelectedService(service);
        setSelectedStaffId(null);
        setQuantity(1);
        setFulfillmentType('dropoff');
        setPickupSession('anytime');
        setPickupAddressError('');
        setSlotClearedMessage('');
        setScheduleGateError('');
    };

    const scrollToBookingTop = () => {
        const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById('main-content')?.scrollIntoView({
            behavior: prefersReduced ? 'auto' : 'smooth',
            block: 'start',
        });
    };

    const goToStep = (nextStep: BookingStepKey) => {
        setScheduleGateError('');
        setActiveStep(nextStep);
        scrollToBookingTop();
    };

    const isCheckingAvailability = isDropoffService
        ? isMultiDropoffMode
            ? multiDropoffLoading || !multiDropoffLoaded
            : showInitialLoading || !slotsLoaded
        : showInitialLoading || !slotsLoaded;

    const handleAdvanceToDetails = () => {
        if (!hasSelectedService) {
            goToStep('service');
            return;
        }
        if (isDropoffService && isCheckingAvailability && !isSelectedHoliday && !isSelectedDateClosed) {
            setScheduleGateError('Sedang memeriksa kuota harian, mohon tunggu sebentar.');
            return;
        }
        if (isDropoffService && !isDropoffReady) {
            setScheduleGateError('Pilih tanggal dengan kuota tersedia terlebih dahulu.');
            return;
        }
        if (!isDropoffService && !selectedTime) {
            setScheduleGateError('Pilih salah satu jam yang tersedia terlebih dahulu.');
            return;
        }
        if (isDropoffService && anyPickupSupported && fulfillmentType === 'pickup' && pickupAddress.trim() === '') {
            setPickupAddressError('Alamat penjemputan wajib diisi untuk layanan jemput & antar.');
            document.getElementById('pickup-address')?.focus();
            return;
        }
        setPickupAddressError('');
        goToStep('details');
    };

    const progressSteps = useMemo<ProgressStepItem[]>(() => {
        return [
            {
                key: 'service',
                number: '1',
                label: 'Layanan',
                completed: hasSelectedService && activeStep !== 'service',
                active: activeStep === 'service',
                reachable: true,
            },
            {
                key: 'schedule',
                number: '2',
                label: 'Jadwal',
                completed: isScheduleReady && activeStep === 'details',
                active: activeStep === 'schedule',
                reachable: hasSelectedService,
            },
            {
                key: 'details',
                number: '3',
                label: requiresDp ? 'Data & DP' : 'Data',
                completed: false,
                active: activeStep === 'details',
                reachable: hasSelectedService && isScheduleReady,
            },
        ];
    }, [activeStep, hasSelectedService, isScheduleReady, requiresDp]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const primaryService = activeServiceLines[0]?.service ?? selectedService;
        if (!primaryService) return;
        if (!isDropoffService && !selectedTime) return;
        if (isDropoffService && !isDropoffReady) return;

        if (isDropoffService && anyPickupSupported && fulfillmentType === 'pickup' && pickupAddress.trim() === '') {
            setPickupAddressError('Alamat penjemputan wajib diisi untuk layanan jemput & antar.');
            setActiveStep('schedule');
            return;
        }
        setPickupAddressError('');

        if (requiresDp && dpMode === 'now' && !dpProof) {
            setDpProofError('Unggah bukti transfer uang muka terlebih dahulu, atau pilih opsi Bayar nanti.');
            document.getElementById('dp-proof-upload')?.focus();
            return;
        }
        setDpProofError('');

        setSubmitting(true);
        router.post(
            route('public.booking.store', business.slug),
            {
                service_id: primaryService.id,
                date: selectedDate,
                time: isDropoffService ? null : selectedTime,
                quantity: isMultiDropoffMode ? (activeServiceLines[0]?.quantity ?? 1) : effectiveQuantity,
                ...(isMultiDropoffMode
                    ? {
                          services: activeServiceLines.map((line) => ({
                              service_id: line.service.id,
                              quantity: line.quantity,
                          })),
                      }
                    : {}),
                ...(selectedAddonLines.length > 0
                    ? {
                          addons: selectedAddonLines.map((line) => ({
                              service_addon_id: line.addon.id,
                              quantity: line.quantity,
                          })),
                      }
                    : {}),
                fulfillment_type: isDropoffService && anyPickupSupported ? fulfillmentType : 'dropoff',
                pickup_session: isDropoffService && anyPickupSupported && fulfillmentType === 'pickup' ? pickupSession : null,
                pickup_address:
                    isDropoffService && anyPickupSupported && fulfillmentType === 'pickup' ? pickupAddress.trim() : null,
                staff_id: showStaffStep ? selectedStaffId : null,
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_email: customerEmail || null,
                customer_notes: customerNotes || null,
                dp_proof: dpMode === 'now' ? dpProof : null,
            },
            {
                forceFormData: true,
                onError: () => scrollToFirstInvalid(),
                onFinish: () => setSubmitting(false),
            }
        );
    };

    const waTopic =
        businessType === 'dropoff'
            ? 'layanan dan jadwal drop-off'
            : businessType === 'space_booking'
              ? 'fasilitas dan jadwal booking'
              : 'layanan dan jadwal janji temu';
    const whatsappChatUrl = business.phone
        ? buildWhatsAppUrl(business.phone, `Halo ${business.name}, saya ingin bertanya tentang ${waTopic}.`)
        : null;

    const selectedServiceSummaryText = isMultiDropoffMode
        ? activeServiceLines.map((l) => `${l.service.name} (${l.quantity})`).join(', ')
        : `${selectedService?.name ?? ''}${isDropoffService ? ` × ${effectiveQuantity} ${selectedUnitLabel}` : ''}`;

    return (
        <div
            className={cn(
                'min-h-screen bg-canvas text-ink',
                services.length > 0 && showMobileBottomBar && 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0'
            )}
        >
            <Head title={`${typeConfig.publicPortal.bookingPageTitle} — ${business.name}`} />

            <a
                href="#main-content"
                className="sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:not-sr-only focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-canvas focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas focus:outline-none"
            >
                Lewati ke daftar layanan
            </a>

            <BusinessHeader business={business} label={typeConfig.publicPortal.bookingPageTitle}>
                <Link href={route('public.booking.invoices', business.slug)} className={headerActionClass}>
                    <FileText className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{lookupLabel}</span>
                    <span className="sr-only sm:hidden">{lookupLabel}</span>
                </Link>
                {whatsappChatUrl && (
                    <a href={whatsappChatUrl} target="_blank" rel="noreferrer" className={headerActionClass}>
                        <MessageCircle className="size-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Chat WhatsApp</span>
                        <span className="sr-only sm:hidden">WhatsApp</span>
                    </a>
                )}
            </BusinessHeader>

            <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-6 outline-none sm:px-6 sm:py-10">
                {bookingDisabledReason && (
                    <div role="alert" className="mb-6 rounded-sm bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
                        {bookingDisabledReason}
                    </div>
                )}

                {services.length === 0 ? (
                    <div className="rounded-md bg-bone p-10 text-center">
                        <p className="text-lg font-semibold text-ink">Belum ada layanan tersedia.</p>
                        <p className="mt-1 text-sm text-mute">Toko sedang menyiapkan daftar layanan.</p>
                    </div>
                ) : (
                    <>
                        <BookingProgressNav steps={progressSteps} onSelectStep={goToStep} />

                        <form
                            onSubmit={handleSubmit}
                            className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
                        >
                            {/* Left Column: Active Booking Step */}
                            <div className="min-w-0 space-y-6">
                                {activeStep === 'service' && (
                                    <>
                                        <ServiceSelectionStep
                                            headingLabel={typeConfig.publicPortal.steps.serviceLabel}
                                            businessType={businessType}
                                            services={services}
                                            isMultiDropoffMode={isMultiDropoffMode}
                                            selectedService={selectedService}
                                            dropoffCart={dropoffCart}
                                            singleDropoffQuantity={quantity}
                                            activeServiceCount={activeServiceLines.length}
                                            applicableAddons={applicableAddons}
                                            addonQuantities={addonQuantities}
                                            selectedAddonLines={selectedAddonLines}
                                            addonsSubtotal={addonsSubtotal}
                                            isDropoffModeForSelected={isDropoffService}
                                            onSelectSingleService={handleSelectSingleService}
                                            onToggleMultiService={toggleDropoffCartService}
                                            onUpdateMultiQty={updateDropoffCartQty}
                                            onUpdateSingleQty={updateSingleDropoffQty}
                                            onUpdateAddonQty={updateAddonQty}
                                        />

                                        {hasSelectedService && (
                                            <div className="hidden justify-end pt-2 lg:flex">
                                                <Button
                                                    type="button"
                                                    size="lg"
                                                    disabled={Boolean(bookingDisabledReason)}
                                                    onClick={() => goToStep('schedule')}
                                                >
                                                    <span>Lanjut ke Jadwal</span>
                                                    <ArrowRight className="size-4" aria-hidden="true" />
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeStep === 'schedule' && (
                                    <>
                                        {/* Compact selected-service context bar */}
                                        <div className="flex items-center justify-between gap-3 rounded-md bg-bone px-4 py-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-mute">Layanan dipilih</p>
                                                <p className="truncate text-sm font-semibold text-ink">
                                                    {selectedServiceSummaryText}
                                                    {selectedAddonLines.length > 0 && ` + ${selectedAddonLines.length} add-on`}
                                                    {' · '}
                                                    <span className="tabular-nums">{formatRupiah(computedTotalPrice)}</span>
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => goToStep('service')}
                                                className="inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full bg-canvas px-3.5 text-xs font-semibold text-ink ring-1 ring-hairline transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                            >
                                                Ubah
                                            </button>
                                        </div>

                                        {showStaffStep && selectedService && (
                                            <StaffSelectionStep
                                                label={typeConfig.publicPortal.steps.staffLabel ?? 'Pilih Staff'}
                                                staffList={selectedService.staff}
                                                selectedStaffId={selectedStaffId}
                                                onSelectStaff={(id) => {
                                                    setSelectedStaffId(id);
                                                    setSlotClearedMessage('');
                                                    setScheduleGateError('');
                                                }}
                                            />
                                        )}

                                        <ScheduleSelectionStep
                                            stepNumber="02"
                                            headingLabel={typeConfig.publicPortal.steps.scheduleLabel}
                                            businessType={businessType}
                                            timezone={tz}
                                            todayLocal={todayLocal}
                                            maxDateLocal={maxDateLocal}
                                            quickDates={quickDates}
                                            selectedDate={selectedDate}
                                            isCustomDate={isCustomDate}
                                            isSelectedHoliday={isSelectedHoliday}
                                            isSelectedDateClosed={isSelectedDateClosed}
                                            hasSelectedService={hasSelectedService}
                                            selectedService={selectedService}
                                            isDropoffService={isDropoffService}
                                            isMultiDropoffMode={isMultiDropoffMode}
                                            activeServiceLines={activeServiceLines}
                                            singleQuantity={effectiveQuantity}
                                            dropoff={dropoff}
                                            multiDropoffMap={multiDropoffMap}
                                            multiDropoffLoading={multiDropoffLoading}
                                            multiDropoffLoaded={multiDropoffLoaded}
                                            isDropoffReady={isDropoffReady}
                                            multiEstimatedReadyDate={multiEstimatedReadyDate}
                                            multiWindowInfo={multiWindowInfo}
                                            anyPickupSupported={anyPickupSupported}
                                            fulfillmentType={fulfillmentType}
                                            pickupSession={pickupSession}
                                            pickupAddress={pickupAddress}
                                            pickupAddressError={pickupAddressError}
                                            slots={slots}
                                            slotsLoaded={slotsLoaded}
                                            showInitialLoading={showInitialLoading}
                                            showRefreshing={showRefreshing}
                                            selectedTime={selectedTime}
                                            slotClearedMessage={slotClearedMessage}
                                            serverPickupAddressError={errors.pickup_address}
                                            onSelectDate={(date) => {
                                                setSelectedDate(date);
                                                setSlotClearedMessage('');
                                                setScheduleGateError('');
                                            }}
                                            onSelectTime={(time) => {
                                                setSelectedTime(time);
                                                setSlotClearedMessage('');
                                                setScheduleGateError('');
                                            }}
                                            onAdjustMultiQty={updateDropoffCartQty}
                                            onAdjustSingleQty={updateSingleDropoffQty}
                                            onChangeFulfillmentType={(type) => {
                                                setFulfillmentType(type);
                                                if (type === 'dropoff') setPickupAddressError('');
                                            }}
                                            onChangePickupSession={setPickupSession}
                                            onChangePickupAddress={(addr) => {
                                                setPickupAddress(addr);
                                                setPickupAddressError('');
                                            }}
                                        />

                                        {scheduleGateError && (
                                            <p
                                                role="alert"
                                                className="rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-xs font-medium text-destructive"
                                            >
                                                {scheduleGateError}
                                            </p>
                                        )}

                                        <div className="hidden items-center justify-between gap-3 pt-2 lg:flex">
                                            <Button type="button" variant="outline" size="lg" onClick={() => goToStep('service')}>
                                                <ArrowLeft className="size-4" aria-hidden="true" />
                                                Kembali
                                            </Button>
                                            <Button
                                                type="button"
                                                size="lg"
                                                className="flex-1"
                                                disabled={Boolean(bookingDisabledReason)}
                                                onClick={handleAdvanceToDetails}
                                            >
                                                <span>Lanjut Isi Data</span>
                                                <ArrowRight className="size-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </>
                                )}

                                {activeStep === 'details' && (
                                    <>
                                        {/* Compact selected service + schedule context bar */}
                                        <div className="flex items-center justify-between gap-3 rounded-md bg-bone px-4 py-3">
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-mute">
                                                    {selectedServiceSummaryText}
                                                </p>
                                                <p className="truncate text-sm font-semibold text-ink">
                                                    {formatDateShortIndo(selectedDate)}
                                                    {!isDropoffService && selectedTime ? ` · ${selectedTime}` : ''}
                                                    {showStaffStep && selectedStaffObj ? ` · ${selectedStaffObj.name}` : ''}
                                                    {' · '}
                                                    <span className="tabular-nums">{formatRupiah(computedTotalPrice)}</span>
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => goToStep('schedule')}
                                                className="inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-full bg-canvas px-3.5 text-xs font-semibold text-ink ring-1 ring-hairline transition-colors hover:bg-hairline-soft focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                                            >
                                                Ubah
                                            </button>
                                        </div>

                                        <CustomerDetailsStep
                                            isDropoffService={isDropoffService}
                                            businessType={businessType}
                                            businessName={business.name}
                                            bookingNoun={bookingNoun}
                                            detailsLabel={typeConfig.publicPortal.steps.detailsLabel}
                                            submitLabel={submitLabel}
                                            requiresDp={requiresDp}
                                            computedDpAmount={computedDpAmount}
                                            dpExpiryMinutes={business.dp_expiry_minutes}
                                            bankAccounts={business.bank_accounts}
                                            qrisUrl={business.qris_url}
                                            dpMode={dpMode}
                                            dpProof={dpProof}
                                            dpProofError={dpProofError}
                                            customerName={customerName}
                                            customerPhone={customerPhone}
                                            customerEmail={customerEmail}
                                            customerNotes={customerNotes}
                                            errors={errors}
                                            submitting={submitting}
                                            bookingDisabledReason={bookingDisabledReason}
                                            onBackToSchedule={() => goToStep('schedule')}
                                            onChangeName={setCustomerName}
                                            onChangePhone={setCustomerPhone}
                                            onChangeEmail={setCustomerEmail}
                                            onChangeNotes={setCustomerNotes}
                                            onChangeDpMode={(mode) => {
                                                setDpMode(mode);
                                                if (mode === 'later') {
                                                    setDpProof(null);
                                                    setDpProofError('');
                                                }
                                            }}
                                            onChangeDpProof={(file) => {
                                                setDpProof(file);
                                                setDpProofError('');
                                            }}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Right Column: Sticky Booking Summary (Desktop) */}
                            <aside aria-label={`Ringkasan ${bookingNoun}`} className="hidden lg:sticky lg:top-6 lg:block">
                                <BookingSummaryCard
                                    businessName={business.name}
                                    businessType={businessType}
                                    bookingNoun={bookingNoun}
                                    isMultiDropoffMode={isMultiDropoffMode}
                                    isDropoffService={isDropoffService}
                                    selectedService={selectedService}
                                    activeServiceLines={activeServiceLines}
                                    selectedAddonLines={selectedAddonLines}
                                    extraAddonDuration={extraAddonDuration}
                                    effectiveQuantity={effectiveQuantity}
                                    selectedUnitLabel={selectedUnitLabel}
                                    showStaffStep={showStaffStep}
                                    selectedStaffObj={selectedStaffObj}
                                    selectedDate={selectedDate}
                                    selectedTime={selectedTime}
                                    anyPickupSupported={anyPickupSupported}
                                    fulfillmentType={fulfillmentType}
                                    pickupSession={pickupSession}
                                    multiEstimatedReadyDate={multiEstimatedReadyDate}
                                    computedTotalPrice={computedTotalPrice}
                                    requiresDp={requiresDp}
                                    computedDpAmount={computedDpAmount}
                                />
                            </aside>

                            {/* Mobile/Tablet Sticky Bar + Bottom Sheet Summary */}
                            <MobileBookingBar
                                activeStep={activeStep}
                                businessName={business.name}
                                businessType={businessType}
                                bookingNoun={bookingNoun}
                                isMultiDropoffMode={isMultiDropoffMode}
                                isDropoffService={isDropoffService}
                                hasSelectedService={hasSelectedService}
                                selectedService={selectedService}
                                activeServiceLines={activeServiceLines}
                                selectedAddonLines={selectedAddonLines}
                                extraAddonDuration={extraAddonDuration}
                                effectiveQuantity={effectiveQuantity}
                                selectedUnitLabel={selectedUnitLabel}
                                showStaffStep={showStaffStep}
                                selectedStaffObj={selectedStaffObj}
                                selectedDate={selectedDate}
                                selectedTime={selectedTime}
                                anyPickupSupported={anyPickupSupported}
                                fulfillmentType={fulfillmentType}
                                pickupSession={pickupSession}
                                multiEstimatedReadyDate={multiEstimatedReadyDate}
                                computedTotalPrice={computedTotalPrice}
                                requiresDp={requiresDp}
                                computedDpAmount={computedDpAmount}
                                submitting={submitting}
                                submitLabel={submitLabel}
                                bookingDisabledReason={bookingDisabledReason}
                                onGoToSchedule={() => goToStep('schedule')}
                                onGoToDetails={handleAdvanceToDetails}
                            />
                        </form>
                    </>
                )}
            </main>

            <footer className="border-t border-divider py-10 text-center text-xs text-mute">
                <span className="inline-flex items-center gap-1.5">
                    Ditenagai oleh <JanjiyanLogo size="sm" />
                </span>
            </footer>
        </div>
    );
}
