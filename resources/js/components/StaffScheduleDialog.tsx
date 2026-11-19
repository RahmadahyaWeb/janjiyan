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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
            <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain rounded-[24px] border-hairline-soft bg-canvas p-6 shadow-none sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-ink">
                        Jadwal Shift & Cuti — {staffName}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 border-b border-divider pb-3">
                    <Button
                        type="button"
                        variant={activeTab === 'hours' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('hours')}
                    >
                        <Clock className="size-3.5" aria-hidden="true" />
                        Jam Kerja (Shift)
                    </Button>
                    <Button
                        type="button"
                        variant={activeTab === 'time_offs' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTab('time_offs')}
                    >
                        <CalendarOff className="size-3.5" aria-hidden="true" />
                        Cuti / Libur ({timeOffs.length})
                    </Button>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-sm text-mute">Memuat jadwal staff…</div>
                ) : activeTab === 'hours' ? (
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
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    <Input
                                                        type="time"
                                                        aria-label={`Mulai shift ${DAY_NAMES[row.day_of_week]}`}
                                                        className="h-9 w-28 rounded-[10px] px-2.5 text-xs"
                                                        value={row.start_time}
                                                        onChange={(e) => updateDay(idx, { start_time: e.target.value })}
                                                        required
                                                    />
                                                    <span className="text-mute">–</span>
                                                    <Input
                                                        type="time"
                                                        aria-label={`Selesai shift ${DAY_NAMES[row.day_of_week]}`}
                                                        className="h-9 w-28 rounded-[10px] px-2.5 text-xs"
                                                        value={row.end_time}
                                                        onChange={(e) => updateDay(idx, { end_time: e.target.value })}
                                                        required
                                                    />
                                                    <span className="ml-1 text-mute">Istirahat:</span>
                                                    <Input
                                                        type="time"
                                                        aria-label={`Mulai istirahat ${DAY_NAMES[row.day_of_week]}`}
                                                        className="h-9 w-28 rounded-[10px] px-2.5 text-xs"
                                                        value={row.break_start}
                                                        onChange={(e) => updateDay(idx, { break_start: e.target.value })}
                                                    />
                                                    <span className="text-mute">–</span>
                                                    <Input
                                                        type="time"
                                                        aria-label={`Selesai istirahat ${DAY_NAMES[row.day_of_week]}`}
                                                        className="h-9 w-28 rounded-[10px] px-2.5 text-xs"
                                                        value={row.break_end}
                                                        onChange={(e) => updateDay(idx, { break_end: e.target.value })}
                                                    />
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

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Tutup
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
                                            timeOffForm.setData('start_date', e.target.value);
                                            if (timeOffForm.data.end_date < e.target.value) {
                                                timeOffForm.setData('end_date', e.target.value);
                                            }
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
                                    placeholder="Contoh: Cuti tahunan, sakit, pelatihan…"
                                    value={timeOffForm.data.reason}
                                    onChange={(e) => timeOffForm.setData('reason', e.target.value)}
                                />
                            </div>
                            <Button type="submit" size="sm" disabled={timeOffForm.processing}>
                                <Plus className="size-3.5" aria-hidden="true" />
                                {timeOffForm.processing ? 'Menambahkan…' : 'Tambah Cuti'}
                            </Button>
                        </form>

                        {timeOffs.length === 0 ? (
                            <p className="py-6 text-center text-sm text-mute">
                                Belum ada jadwal cuti atau libur untuk staff ini.
                            </p>
                        ) : (
                            <div className="divide-y divide-divider rounded-[20px] border border-hairline-soft bg-canvas">
                                {timeOffs.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                        <div>
                                            <p className="text-sm font-semibold text-ink">
                                                {item.start_date === item.end_date
                                                    ? formatDateIndo(item.start_date)
                                                    : `${formatDateIndo(item.start_date)} – ${formatDateIndo(item.end_date)}`}
                                            </p>
                                            {item.reason && <p className="text-xs text-mute">{item.reason}</p>}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Hapus cuti"
                                            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
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
