import { router, useForm } from '@inertiajs/react';
import { CalendarOff, Clock, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TimePicker } from '@/components/ui/time-picker';
import { formatDateIndo } from '@/lib/format';
import { cn } from '@/lib/utils';

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

interface StaffSchedulePayload {
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

interface StaffScheduleDialogProps {
    staffId: number | null;
    staffName: string;
    onClose: () => void;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function StaffScheduleDialog({ staffId, staffName, onClose }: StaffScheduleDialogProps) {
    const [activeTab, setActiveTab] = useState<'hours' | 'time_offs'>('hours');
    const [loading, setLoading] = useState(false);
    const [timeOffs, setTimeOffs] = useState<StaffTimeOffItem[]>([]);

    const hoursForm = useForm({
        use_business_default: true,
        hours: [] as StaffHourRow[],
    });

    const today = new Date().toISOString().slice(0, 10);
    const timeOffForm = useForm({
        start_date: today,
        end_date: today,
        reason: '',
    });

    const loadSchedule = useCallback(async (id: number, silent = false) => {
        if (!silent) {
            setLoading(true);
        }
        try {
            const response = await fetch(route('dashboard.staff.schedule.show', id), {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) return;
            const data = (await response.json()) as StaffSchedulePayload;
            hoursForm.setData({
                use_business_default: data.uses_business_default,
                hours: data.hours.map((h) => ({
                    day_of_week: h.day_of_week,
                    is_working: h.is_working,
                    start_time: h.start_time.slice(0, 5),
                    end_time: h.end_time.slice(0, 5),
                    break_start: h.break_start ? h.break_start.slice(0, 5) : '',
                    break_end: h.break_end ? h.break_end.slice(0, 5) : '',
                })),
            });
            setTimeOffs(data.time_offs);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        if (staffId !== null) {
            setActiveTab('hours');
            void loadSchedule(staffId);
        }
    }, [staffId, loadSchedule]);

    const updateDay = (idx: number, patch: Partial<StaffHourRow>) => {
        const next = [...hoursForm.data.hours];
        next[idx] = { ...next[idx], ...patch };
        hoursForm.setData('hours', next);
    };

    const handleSaveHours = (e: FormEvent) => {
        e.preventDefault();
        if (staffId === null) return;
        hoursForm.put(route('dashboard.staff.schedule.update', staffId), {
            preserveScroll: true,
            onSuccess: () => {
                void loadSchedule(staffId, true);
            },
        });
    };

    const handleAddTimeOff = (e: FormEvent) => {
        e.preventDefault();
        if (staffId === null) return;
        timeOffForm.post(route('dashboard.staff.time-offs.store', staffId), {
            preserveScroll: true,
            onSuccess: () => {
                timeOffForm.reset('reason');
                void loadSchedule(staffId, true);
            },
        });
    };

    const handleDeleteTimeOff = (timeOffId: number) => {
        if (staffId === null) return;
        router.delete(route('dashboard.staff.time-offs.destroy', { staff: staffId, timeOff: timeOffId }), {
            preserveScroll: true,
            onSuccess: () => {
                void loadSchedule(staffId, true);
            },
        });
    };

    return (
        <Dialog open={staffId !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="rounded-md border-hairline-soft bg-canvas p-4 shadow-none sm:max-w-2xl sm:p-6">
                <DialogHeader>
                    <DialogTitle className="break-words text-lg font-semibold text-ink sm:text-xl">
                        Jadwal Shift &amp; Cuti — {staffName}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-wrap gap-2 border-b border-divider pb-3">
                    <Button
                        type="button"
                        variant={activeTab === 'hours' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        onClick={() => setActiveTab('hours')}
                    >
                        <Clock className="size-3.5" aria-hidden="true" />
                        Jam Kerja (Shift)
                    </Button>
                    <Button
                        type="button"
                        variant={activeTab === 'time_offs' ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1 sm:flex-initial"
                        onClick={() => setActiveTab('time_offs')}
                    >
                        <CalendarOff className="size-3.5" aria-hidden="true" />
                        <span className="tabular-nums">Cuti / Libur ({timeOffs.length})</span>
                    </Button>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-sm text-mute">Memuat jadwal staff…</div>
                ) : activeTab === 'hours' ? (
                    <form onSubmit={handleSaveHours} className="space-y-4">
                        <div className="flex items-center justify-between gap-4 rounded-sm bg-bone p-3.5 sm:p-4">
                            <div className="min-w-0">
                                <Label htmlFor="staff-use-default" className="cursor-pointer text-sm font-semibold text-ink">
                                    Ikuti Jam Operasional Bisnis
                                </Label>
                                <p className="mt-0.5 text-xs text-mute">
                                    Nonaktifkan jika staff ini memiliki jam shift atau hari libur mingguan khusus.
                                </p>
                            </div>
                            <Switch
                                id="staff-use-default"
                                className="shrink-0"
                                checked={hoursForm.data.use_business_default}
                                onCheckedChange={(val) => hoursForm.setData('use_business_default', val)}
                            />
                        </div>

                        {!hoursForm.data.use_business_default && (
                            <div className="space-y-2.5">
                                {hoursForm.data.hours.map((row, idx) => {
                                    const dayName = DAY_NAMES[row.day_of_week];
                                    return (
                                        <div
                                            key={row.day_of_week}
                                            className={cn(
                                                'space-y-3 rounded-sm border p-3.5 transition-colors',
                                                row.is_working
                                                    ? 'border-hairline-soft bg-bone/70'
                                                    : 'border-transparent bg-bone/45'
                                            )}
                                        >
                                            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                                <div className="flex min-w-0 items-center justify-between gap-3 sm:w-32 sm:justify-start">
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <Switch
                                                            id={`staff-day-${row.day_of_week}`}
                                                            aria-label={`Status kerja hari ${dayName}`}
                                                            checked={row.is_working}
                                                            onCheckedChange={(val) => updateDay(idx, { is_working: val })}
                                                        />
                                                        <Label
                                                            htmlFor={`staff-day-${row.day_of_week}`}
                                                            className="cursor-pointer text-sm font-semibold text-ink"
                                                        >
                                                            {dayName}
                                                        </Label>
                                                    </div>
                                                    {row.is_working ? (
                                                        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success sm:hidden">
                                                            Kerja
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ash sm:hidden">
                                                            Libur / Off
                                                        </span>
                                                    )}
                                                </div>

                                                {row.is_working ? (
                                                    <div className="min-w-0 space-y-1.5 sm:space-y-0">
                                                        <span className="block text-xs font-medium text-mute sm:hidden">Jam Shift</span>
                                                        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs sm:flex sm:w-auto">
                                                            <TimePicker
                                                                aria-label={`Mulai shift ${dayName}`}
                                                                wrapperClassName="sm:w-28"
                                                                className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                                dialogTitle={`Mulai Shift ${dayName}`}
                                                                value={row.start_time}
                                                                onChange={(val) => updateDay(idx, { start_time: val })}
                                                                required
                                                            />
                                                            <span className="shrink-0 text-center text-xs font-medium text-mute">s/d</span>
                                                            <TimePicker
                                                                align="end"
                                                                aria-label={`Selesai shift ${dayName}`}
                                                                wrapperClassName="sm:w-28"
                                                                className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                                dialogTitle={`Selesai Shift ${dayName}`}
                                                                value={row.end_time}
                                                                onChange={(val) => updateDay(idx, { end_time: val })}
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="hidden rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-ash sm:inline-flex">
                                                        Libur / Off
                                                    </span>
                                                )}
                                            </div>

                                            {row.is_working && (
                                                <div className="space-y-1.5 border-t border-divider pt-2.5 sm:flex sm:items-center sm:justify-between sm:gap-2 sm:space-y-0">
                                                    <span className="block text-xs font-medium text-mute">Istirahat (opsional)</span>
                                                    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs sm:flex sm:w-auto">
                                                        <TimePicker
                                                            clearable
                                                            aria-label={`Mulai istirahat ${dayName}`}
                                                            wrapperClassName="sm:w-32"
                                                            className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                            dialogTitle={`Mulai Istirahat ${dayName}`}
                                                            value={row.break_start}
                                                            onChange={(val) => updateDay(idx, { break_start: val })}
                                                        />
                                                        <span className="shrink-0 text-center text-xs font-medium text-mute">s/d</span>
                                                        <TimePicker
                                                            clearable
                                                            align="end"
                                                            aria-label={`Selesai istirahat ${dayName}`}
                                                            wrapperClassName="sm:w-32"
                                                            className="h-11 rounded-xl bg-canvas px-2.5 py-2 text-base sm:h-10 sm:py-1.5 md:text-sm"
                                                            dialogTitle={`Selesai Istirahat ${dayName}`}
                                                            value={row.break_end}
                                                            onChange={(val) => updateDay(idx, { break_end: val })}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {Object.values(hoursForm.errors).length > 0 && (
                            <div role="alert" className="rounded-xl bg-destructive-soft p-3 text-xs text-destructive">
                                {Object.values(hoursForm.errors)[0]}
                            </div>
                        )}

                        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                                Tutup
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto" disabled={hoursForm.processing}>
                                {hoursForm.processing ? 'Menyimpan…' : 'Simpan Jadwal Shift'}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-5">
                        <form onSubmit={handleAddTimeOff} className="space-y-3 rounded-sm bg-bone p-3.5 sm:p-4">
                            <p className="text-sm font-semibold text-ink">Tambah Jadwal Cuti / Libur</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="min-w-0 space-y-1">
                                    <Label htmlFor="timeoff-start">Tanggal Mulai</Label>
                                    <DatePicker
                                        id="timeoff-start"
                                        className="bg-canvas"
                                        value={timeOffForm.data.start_date}
                                        onChange={(next) => {
                                            timeOffForm.setData({
                                                ...timeOffForm.data,
                                                start_date: next,
                                                end_date: timeOffForm.data.end_date < next ? next : timeOffForm.data.end_date,
                                            });
                                        }}
                                        dialogTitle="Tanggal Mulai Cuti"
                                        required
                                    />
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <Label htmlFor="timeoff-end">Tanggal Selesai</Label>
                                    <DatePicker
                                        id="timeoff-end"
                                        className="bg-canvas"
                                        min={timeOffForm.data.start_date}
                                        value={timeOffForm.data.end_date}
                                        onChange={(val) => timeOffForm.setData('end_date', val)}
                                        dialogTitle="Tanggal Selesai Cuti"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <Label htmlFor="timeoff-reason">Alasan (Opsional)</Label>
                                <Input
                                    id="timeoff-reason"
                                    className="bg-canvas"
                                    placeholder="Contoh: Cuti tahunan, sakit, pelatihan…"
                                    value={timeOffForm.data.reason}
                                    onChange={(e) => timeOffForm.setData('reason', e.target.value)}
                                />
                            </div>
                            <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={timeOffForm.processing}>
                                <Plus className="size-3.5" aria-hidden="true" />
                                {timeOffForm.processing ? 'Menambahkan…' : 'Tambah Cuti'}
                            </Button>
                        </form>

                        {timeOffs.length === 0 ? (
                            <p className="py-6 text-center text-sm text-mute">
                                Belum ada jadwal cuti atau libur untuk staff ini.
                            </p>
                        ) : (
                            <div className="divide-y divide-divider rounded-sm border border-hairline-soft bg-canvas">
                                {timeOffs.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-ink">
                                                {item.start_date === item.end_date
                                                    ? formatDateIndo(item.start_date)
                                                    : `${formatDateIndo(item.start_date)} – ${formatDateIndo(item.end_date)}`}
                                            </p>
                                            {item.reason && <p className="mt-0.5 break-words text-xs text-mute">{item.reason}</p>}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Hapus cuti ${formatDateIndo(item.start_date)}`}
                                            className="shrink-0 text-destructive hover:bg-destructive-soft hover:text-destructive"
                                            onClick={() => handleDeleteTimeOff(item.id)}
                                        >
                                            <Trash2 className="size-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
