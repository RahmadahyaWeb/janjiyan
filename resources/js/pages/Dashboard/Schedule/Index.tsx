import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TimePicker } from '@/components/ui/time-picker';
import DashboardLayout from '@/layouts/DashboardLayout';
import { getBusinessTypeConfig } from '@/lib/businessType';
import { formatDateIndo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types';

interface OperatingHourRow {
    day_of_week: number;
    is_open: boolean;
    open_time: string;
    close_time: string;
    break_start: string | null;
    break_end: string | null;
}

interface HolidayRow {
    id: number;
    date: string;
    reason: string | null;
}

interface ScheduleIndexProps {
    operatingHours: OperatingHourRow[];
    holidays: HolidayRow[];
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function ScheduleIndex({ operatingHours, holidays }: ScheduleIndexProps) {
    const activeBusiness = usePage<PageProps>().props.activeBusiness;
    const config = getBusinessTypeConfig(activeBusiness?.business_type);
    const canManageStaff = activeBusiness?.can?.manage_staff ?? false;
    const [deletingHoliday, setDeletingHoliday] = useState<HolidayRow | null>(null);
    const hoursForm = useForm({
        hours: operatingHours.map((h) => ({
            day_of_week: h.day_of_week,
            is_open: h.is_open,
            open_time: h.open_time,
            close_time: h.close_time,
            break_start: h.break_start ?? '',
            break_end: h.break_end ?? '',
        })),
    });

    const holidayForm = useForm({
        date: '',
        reason: '',
    });

    const updateHour = (idx: number, field: string, value: string | boolean) => {
        const updated = [...hoursForm.data.hours];
        updated[idx] = { ...updated[idx], [field]: value };
        hoursForm.setData('hours', updated);
    };

    const submitHours = (e: FormEvent) => {
        e.preventDefault();
        hoursForm.put(route('dashboard.schedule.hours'));
    };

    const submitHoliday = (e: FormEvent) => {
        e.preventDefault();
        holidayForm.post(route('dashboard.schedule.holidays.store'), {
            onSuccess: () => holidayForm.reset(),
        });
    };

    return (
        <DashboardLayout title={config.schedule.pageTitle}>
            <Head title={config.schedule.pageTitle} />

            {/* Info banner adapted per business_type */}
            <div className="flex items-start gap-3 rounded-md border border-hairline-soft bg-bone/60 p-4 text-sm text-body">
                <Info className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                <p>
                    {config.schedule.infoBannerText}{' '}
                    {config.schedule.linkToStaffSchedules && (
                        <>
                            Atur jadwal pribadi atau cuti staff di{' '}
                            {canManageStaff ? (
                                <Link href={route('dashboard.staff')} className="font-semibold text-electric hover:underline">
                                    Tim &amp; Staff → Jadwal &amp; Cuti
                                </Link>
                            ) : (
                                <strong className="text-ink">Tim &amp; Staff → Jadwal &amp; Cuti</strong>
                            )}
                            .
                        </>
                    )}
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                {/* Operating Hours */}
                <form onSubmit={submitHours} className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <div>
                        <h2 className="text-lg font-semibold text-ink">Jam Operasional Mingguan</h2>
                        <p className="mt-1 text-xs text-mute">{config.schedule.breakTimeHint}</p>
                    </div>
                    <div className="space-y-3">
                        {hoursForm.data.hours.map((row, idx) => {
                            const dayName = DAY_NAMES[row.day_of_week];
                            const switchId = `day-open-${row.day_of_week}`;
                            const dayErrors = (Object.entries(hoursForm.errors) as Array<[string, string]>)
                                .filter(([key]) => key.startsWith(`hours.${idx}.`))
                                .map(([, message]) => message);
                            const errorId = dayErrors.length > 0 ? `day-hours-error-${row.day_of_week}` : undefined;

                            return (
                                <div
                                    key={row.day_of_week}
                                    className={cn(
                                        'space-y-3 rounded-sm border p-3.5 transition-colors sm:p-4',
                                        row.is_open
                                            ? 'border-hairline-soft bg-bone/70'
                                            : 'border-transparent bg-bone/45'
                                    )}
                                >
                                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                        <div className="flex min-w-0 items-center justify-between gap-3 sm:w-32 sm:justify-start">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <Switch
                                                    id={switchId}
                                                    aria-label={`Status buka hari ${dayName}`}
                                                    checked={row.is_open}
                                                    onCheckedChange={(val) => updateHour(idx, 'is_open', val)}
                                                />
                                                <Label htmlFor={switchId} className="cursor-pointer text-sm font-semibold text-ink">
                                                    {dayName}
                                                </Label>
                                            </div>
                                            {row.is_open ? (
                                                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success sm:hidden">
                                                    Buka
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ash sm:hidden">
                                                    Tutup
                                                </span>
                                            )}
                                        </div>

                                        {row.is_open ? (
                                            <div className="min-w-0 space-y-1.5 sm:space-y-0">
                                                <span className="block text-xs font-medium text-mute sm:hidden">Jam Buka</span>
                                                <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs sm:flex sm:w-auto">
                                                    <TimePicker
                                                        aria-label={`Jam buka hari ${dayName}`}
                                                        aria-invalid={Boolean(hoursForm.errors[`hours.${idx}.open_time` as keyof typeof hoursForm.errors])}
                                                        aria-describedby={errorId}
                                                        wrapperClassName="sm:w-28"
                                                        className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                        dialogTitle={`Jam Buka ${dayName}`}
                                                        value={row.open_time}
                                                        onChange={(val) => updateHour(idx, 'open_time', val)}
                                                    />
                                                    <span className="shrink-0 text-center text-xs font-medium text-mute">s/d</span>
                                                    <TimePicker
                                                        aria-label={`Jam tutup hari ${dayName}`}
                                                        aria-invalid={Boolean(hoursForm.errors[`hours.${idx}.close_time` as keyof typeof hoursForm.errors])}
                                                        aria-describedby={errorId}
                                                        align="end"
                                                        wrapperClassName="sm:w-28"
                                                        className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                        dialogTitle={`Jam Tutup ${dayName}`}
                                                        value={row.close_time}
                                                        onChange={(val) => updateHour(idx, 'close_time', val)}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="hidden rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ash sm:inline-flex">
                                                Tutup
                                            </span>
                                        )}
                                    </div>

                                    {row.is_open && (
                                        <div className="space-y-1.5 border-t border-divider pt-2.5 sm:flex sm:items-center sm:justify-between sm:gap-2 sm:space-y-0">
                                            <span className="block text-xs font-medium text-mute">Istirahat (opsional)</span>
                                            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs sm:flex sm:w-auto">
                                                <TimePicker
                                                    clearable
                                                    aria-label={`Mulai istirahat hari ${dayName}`}
                                                    aria-invalid={Boolean(hoursForm.errors[`hours.${idx}.break_start` as keyof typeof hoursForm.errors])}
                                                    aria-describedby={errorId}
                                                    wrapperClassName="sm:w-32"
                                                    className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                    dialogTitle={`Mulai Istirahat ${dayName}`}
                                                    value={row.break_start}
                                                    onChange={(val) => updateHour(idx, 'break_start', val)}
                                                />
                                                <span className="shrink-0 text-center text-xs font-medium text-mute">s/d</span>
                                                <TimePicker
                                                    clearable
                                                    align="end"
                                                    aria-label={`Selesai istirahat hari ${dayName}`}
                                                    aria-invalid={Boolean(hoursForm.errors[`hours.${idx}.break_end` as keyof typeof hoursForm.errors])}
                                                    aria-describedby={errorId}
                                                    wrapperClassName="sm:w-32"
                                                    className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                    dialogTitle={`Selesai Istirahat ${dayName}`}
                                                    value={row.break_end}
                                                    onChange={(val) => updateHour(idx, 'break_end', val)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {dayErrors.length > 0 && (
                                        <div id={errorId} role="alert" className="space-y-1">
                                            {dayErrors.map((err, i) => (
                                                <p key={i} className="text-xs text-destructive">
                                                    {err}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <Button type="submit" className="w-full sm:w-auto" disabled={hoursForm.processing}>
                        {hoursForm.processing ? 'Menyimpan…' : 'Simpan Jam Operasional'}
                    </Button>
                </form>

                {/* Holidays */}
                <div className="space-y-4 rounded-md border border-hairline-soft bg-canvas p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-ink">Tanggal Libur Khusus</h2>
                    <form onSubmit={submitHoliday} className="space-y-3">
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="holiday-date">Tanggal Libur</Label>
                            <DatePicker
                                id="holiday-date"
                                value={holidayForm.data.date}
                                onChange={(val) => holidayForm.setData('date', val)}
                                aria-invalid={Boolean(holidayForm.errors.date)}
                                dialogTitle="Tanggal Libur"
                                required
                            />
                            {holidayForm.errors.date && (
                                <p className="text-xs text-destructive">{holidayForm.errors.date}</p>
                            )}
                        </div>
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="holiday-reason">Keterangan (Opsional)</Label>
                            <Input
                                id="holiday-reason"
                                placeholder="Mis. Libur Lebaran"
                                value={holidayForm.data.reason}
                                onChange={(e) => holidayForm.setData('reason', e.target.value)}
                                aria-invalid={Boolean(holidayForm.errors.reason)}
                            />
                            {holidayForm.errors.reason && (
                                <p className="text-xs text-destructive">{holidayForm.errors.reason}</p>
                            )}
                        </div>
                        <Button type="submit" variant="outline" className="w-full" disabled={holidayForm.processing}>
                            <Plus className="size-4" aria-hidden="true" />
                            Tambah Tanggal Libur
                        </Button>
                    </form>

                    <div className="space-y-2 pt-2">
                        {holidays.length === 0 ? (
                            <p className="rounded-xl bg-bone/60 px-4 py-3 text-center text-xs text-mute">
                                Belum ada tanggal libur khusus yang ditambahkan.
                            </p>
                        ) : (
                            holidays.map((h) => (
                                <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl bg-bone px-3.5 py-2.5 text-sm">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-ink">{formatDateIndo(h.date)}</p>
                                        {h.reason && <p className="mt-0.5 break-words text-xs text-mute">{h.reason}</p>}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Hapus tanggal libur ${formatDateIndo(h.date)}`}
                                        className="shrink-0 text-destructive hover:bg-destructive-soft hover:text-destructive"
                                        onClick={() => setDeletingHoliday(h)}
                                    >
                                        <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={deletingHoliday !== null}
                onOpenChange={(open) => !open && setDeletingHoliday(null)}
                title={`Hapus tanggal libur ${deletingHoliday ? formatDateIndo(deletingHoliday.date) : ''}?`}
                description="Setelah dihapus, pelanggan dapat kembali memesan jadwal pada tanggal tersebut."
                confirmLabel="Hapus Tanggal Libur"
                onConfirm={() => {
                    if (!deletingHoliday) return;
                    router.delete(route('dashboard.schedule.holidays.destroy', deletingHoliday.id), {
                        onFinish: () => setDeletingHoliday(null),
                    });
                }}
            />
        </DashboardLayout>
    );
}
