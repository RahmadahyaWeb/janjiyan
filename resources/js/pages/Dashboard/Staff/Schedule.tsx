import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, CalendarOff, Clock, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DashboardLayout from '@/layouts/DashboardLayout';
import { formatDateIndo } from '@/lib/format';

interface StaffHourRow {
    day_of_week: number;
    is_working: boolean;
    start_time: string;
    end_time: string;
    break_start: string;
    break_end: string;
}

interface StaffTimeOffItem {
    id: number;
    start_date: string;
    end_date: string;
    reason: string | null;
}

interface StaffSchedulePageProps {
    staff_id: number;
    staff_name: string;
    uses_business_default: boolean;
    hours: Array<{
        day_of_week: number;
        is_working: boolean;
        start_time: string;
        end_time: string;
        break_start: string | null;
        break_end: string | null;
    }>;
    time_offs: StaffTimeOffItem[];
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function StaffSchedule({
    staff_id,
    staff_name,
    uses_business_default,
    hours,
    time_offs,
}: StaffSchedulePageProps) {
    const [activeTab, setActiveTab] = useState<'hours' | 'time_offs'>('hours');

    const hoursForm = useForm({
        use_business_default: uses_business_default,
        hours: hours.map((h) => ({
            day_of_week: h.day_of_week,
            is_working: h.is_working,
            start_time: h.start_time.slice(0, 5),
            end_time: h.end_time.slice(0, 5),
            break_start: h.break_start ? h.break_start.slice(0, 5) : '',
            break_end: h.break_end ? h.break_end.slice(0, 5) : '',
        })) as StaffHourRow[],
    });

    const today = new Date().toISOString().slice(0, 10);
    const timeOffForm = useForm({
        start_date: today,
        end_date: today,
        reason: '',
    });

    const updateDay = (idx: number, patch: Partial<StaffHourRow>) => {
        const next = [...hoursForm.data.hours];
        next[idx] = { ...next[idx], ...patch };
        hoursForm.setData('hours', next);
    };

    const handleSaveHours = (e: FormEvent) => {
        e.preventDefault();
        hoursForm.put(route('dashboard.staff.schedule.update', staff_id), {
            preserveScroll: true,
        });
    };

    const handleAddTimeOff = (e: FormEvent) => {
        e.preventDefault();
        timeOffForm.post(route('dashboard.staff.time-offs.store', staff_id), {
            preserveScroll: true,
            onSuccess: () => {
                timeOffForm.setData({ start_date: today, end_date: today, reason: '' });
            },
        });
    };

    const handleDeleteTimeOff = (timeOffId: number) => {
        router.delete(route('dashboard.staff.time-offs.destroy', { staff: staff_id, timeOff: timeOffId }), {
            preserveScroll: true,
        });
    };

    return (
        <DashboardLayout title={`Jadwal & Cuti — ${staff_name}`}>
            <Head title={`Jadwal & Cuti ${staff_name}`} />

            <div>
                <Button asChild variant="ghost" size="sm" className="-ml-2 text-mute hover:text-ink">
                    <Link href={route('dashboard.staff')}>
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        Kembali ke Tim &amp; Staff
                    </Link>
                </Button>
            </div>

            <div className="max-w-3xl space-y-5 rounded-[24px] border border-hairline-soft bg-canvas p-5 sm:p-6">
                <div className="inline-flex rounded-full bg-bone p-1" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'hours'}
                        onClick={() => setActiveTab('hours')}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                            activeTab === 'hours' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                        }`}
                    >
                        <Clock className="size-3.5" aria-hidden="true" />
                        Jam Shift Mingguan
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'time_offs'}
                        onClick={() => setActiveTab('time_offs')}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                            activeTab === 'time_offs' ? 'bg-ink text-canvas' : 'text-mute hover:text-ink'
                        }`}
                    >
                        <CalendarOff className="size-3.5" aria-hidden="true" />
                        Cuti / Libur ({time_offs.length})
                    </button>
                </div>

                {activeTab === 'hours' ? (
                    <form onSubmit={handleSaveHours} className="space-y-4">
                        <div className="flex items-center justify-between gap-4 rounded-[16px] bg-bone p-4">
                            <div>
                                <Label htmlFor="staff-use-default" className="text-sm font-semibold text-ink">
                                    Ikuti Jam Operasional Bisnis
                                </Label>
                                <p className="mt-0.5 text-xs text-mute">
                                    Nonaktifkan jika staff ini memiliki jam shift atau hari libur mingguan khusus.
                                </p>
                            </div>
                            <Switch
                                id="staff-use-default"
                                checked={hoursForm.data.use_business_default}
                                onCheckedChange={(val) => hoursForm.setData('use_business_default', val)}
                            />
                        </div>

                        {!hoursForm.data.use_business_default && (
                            <div className="space-y-2.5">
                                {hoursForm.data.hours.map((row, idx) => (
                                    <div
                                        key={row.day_of_week}
                                        className="rounded-[16px] border border-hairline-soft bg-canvas p-3"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <Switch
                                                    id={`staff-day-${row.day_of_week}`}
                                                    checked={row.is_working}
                                                    onCheckedChange={(val) => updateDay(idx, { is_working: val })}
                                                />
                                                <Label
                                                    htmlFor={`staff-day-${row.day_of_week}`}
                                                    className="w-16 text-sm font-semibold text-ink"
                                                >
                                                    {DAY_NAMES[row.day_of_week]}
                                                </Label>
                                            </div>

                                            {row.is_working ? (
                                                <div className="flex w-full flex-col gap-2 text-xs sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                                                    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto">
                                                        <Input
                                                            type="time"
                                                            aria-label={`Mulai shift ${DAY_NAMES[row.day_of_week]}`}
                                                            className="h-9 w-full rounded-[10px] px-2.5 text-base tabular-nums sm:w-28 md:text-sm"
                                                            value={row.start_time}
                                                            onChange={(e) => updateDay(idx, { start_time: e.target.value })}
                                                            required
                                                        />
                                                        <span className="text-mute">–</span>
                                                        <Input
                                                            type="time"
                                                            aria-label={`Selesai shift ${DAY_NAMES[row.day_of_week]}`}
                                                            className="h-9 w-full rounded-[10px] px-2.5 text-base tabular-nums sm:w-28 md:text-sm"
                                                            value={row.end_time}
                                                            onChange={(e) => updateDay(idx, { end_time: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="grid w-full grid-cols-[auto_1fr_auto_1fr] items-center gap-2 sm:flex sm:w-auto">
                                                        <span className="text-mute sm:ml-1">Istirahat:</span>
                                                        <Input
                                                            type="time"
                                                            aria-label={`Mulai istirahat ${DAY_NAMES[row.day_of_week]}`}
                                                            className="h-9 w-full rounded-[10px] px-2.5 text-base tabular-nums sm:w-28 md:text-sm"
                                                            value={row.break_start}
                                                            onChange={(e) => updateDay(idx, { break_start: e.target.value })}
                                                        />
                                                        <span className="text-mute">–</span>
                                                        <Input
                                                            type="time"
                                                            aria-label={`Selesai istirahat ${DAY_NAMES[row.day_of_week]}`}
                                                            className="h-9 w-full rounded-[10px] px-2.5 text-base tabular-nums sm:w-28 md:text-sm"
                                                            value={row.break_end}
                                                            onChange={(e) => updateDay(idx, { break_end: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-mute">Libur / Off</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {Object.values(hoursForm.errors).length > 0 && (
                            <div className="rounded-[14px] bg-destructive-soft p-3 text-xs text-destructive">
                                {Object.values(hoursForm.errors)[0]}
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                            <Button asChild type="button" variant="outline">
                                <Link href={route('dashboard.staff')}>Kembali</Link>
                            </Button>
                            <Button type="submit" disabled={hoursForm.processing}>
                                {hoursForm.processing ? 'Menyimpan…' : 'Simpan Jadwal Shift'}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-5">
                        <form onSubmit={handleAddTimeOff} className="space-y-3 rounded-[20px] bg-bone p-4">
                            <p className="text-sm font-semibold text-ink">Tambah Jadwal Cuti / Libur</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <Label htmlFor="timeoff-start">Tanggal Mulai</Label>
                                    <Input
                                        id="timeoff-start"
                                        type="date"
                                        value={timeOffForm.data.start_date}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            timeOffForm.setData({
                                                ...timeOffForm.data,
                                                start_date: next,
                                                end_date: timeOffForm.data.end_date < next ? next : timeOffForm.data.end_date,
                                            });
                                        }}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="timeoff-end">Tanggal Selesai</Label>
                                    <Input
                                        id="timeoff-end"
                                        type="date"
                                        min={timeOffForm.data.start_date}
                                        value={timeOffForm.data.end_date}
                                        onChange={(e) => timeOffForm.setData('end_date', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="timeoff-reason">Alasan (Opsional)</Label>
                                <Input
                                    id="timeoff-reason"
                                    placeholder="Mis. Cuti keluarga / sakit"
                                    value={timeOffForm.data.reason}
                                    onChange={(e) => timeOffForm.setData('reason', e.target.value)}
                                />
                            </div>
                            {Object.values(timeOffForm.errors).length > 0 && (
                                <p className="text-xs text-destructive">{Object.values(timeOffForm.errors)[0]}</p>
                            )}
                            <Button type="submit" size="sm" disabled={timeOffForm.processing}>
                                <Plus className="size-4" aria-hidden="true" />
                                {timeOffForm.processing ? 'Menambah…' : 'Tambah Cuti'}
                            </Button>
                        </form>

                        {time_offs.length === 0 ? (
                            <p className="rounded-[16px] border border-dashed border-hairline-soft py-6 text-center text-xs text-mute">
                                Belum ada jadwal cuti atau izin untuk {staff_name}.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {time_offs.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-3 rounded-[16px] border border-hairline-soft bg-canvas px-4 py-3 text-sm"
                                    >
                                        <div>
                                            <p className="font-semibold text-ink">
                                                {item.start_date === item.end_date
                                                    ? formatDateIndo(item.start_date)
                                                    : `${formatDateIndo(item.start_date)} – ${formatDateIndo(item.end_date)}`}
                                            </p>
                                            {item.reason && <p className="text-xs text-mute">{item.reason}</p>}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
                                            onClick={() => handleDeleteTimeOff(item.id)}
                                            aria-label={`Hapus cuti ${item.start_date}`}
                                        >
                                            <Trash2 className="size-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
