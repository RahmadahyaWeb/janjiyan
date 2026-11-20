<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\Staff;
use App\Models\StaffTimeOff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

class StaffScheduleController extends Controller
{
    public function edit(Request $request, Staff $staff): Response
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $staff->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        return Inertia::render('Dashboard/Staff/Schedule', $this->buildSchedulePayload($business, $staff));
    }

    public function show(Request $request, Staff $staff): JsonResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $staff->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        return response()->json($this->buildSchedulePayload($business, $staff));
    }

    /**
     * Build the staff working hours and time-offs payload shared between the page and JSON endpoint.
     */
    private function buildSchedulePayload(Business $business, Staff $staff): array
    {
        $customHours = $staff->operatingHours()->orderBy('day_of_week')->get();
        $usesBusinessDefault = $customHours->isEmpty();

        if ($usesBusinessDefault) {
            $businessHours = $business->operatingHours()->orderBy('day_of_week')->get()->keyBy('day_of_week');
            $hoursPayload = [];
            for ($day = 0; $day <= 6; $day++) {
                $bh = $businessHours->get($day);
                $hoursPayload[] = [
                    'day_of_week' => $day,
                    'is_working' => $bh ? (bool) $bh->is_open : $day !== 0,
                    'start_time' => $bh?->open_time ?? '09:00',
                    'end_time' => $bh?->close_time ?? '18:00',
                    'break_start' => $bh?->break_start,
                    'break_end' => $bh?->break_end,
                ];
            }
        } else {
            $byDay = $customHours->keyBy('day_of_week');
            $hoursPayload = [];
            for ($day = 0; $day <= 6; $day++) {
                $sh = $byDay->get($day);
                $hoursPayload[] = [
                    'day_of_week' => $day,
                    'is_working' => $sh ? (bool) $sh->is_working : false,
                    'start_time' => $sh?->start_time ?? '09:00',
                    'end_time' => $sh?->end_time ?? '18:00',
                    'break_start' => $sh?->break_start,
                    'break_end' => $sh?->break_end,
                ];
            }
        }

        $timeOffs = $staff->timeOffs()
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (StaffTimeOff $t) => [
                'id' => $t->id,
                'start_date' => $t->start_date->toDateString(),
                'end_date' => $t->end_date->toDateString(),
                'reason' => $t->reason,
            ])
            ->values();

        return [
            'staff_id' => $staff->id,
            'staff_name' => $staff->name,
            'uses_business_default' => $usesBusinessDefault,
            'hours' => $hoursPayload,
            'time_offs' => $timeOffs,
        ];
    }

    public function updateHours(Request $request, Staff $staff): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $staff->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        if ($request->boolean('use_business_default')) {
            $staff->operatingHours()->delete();

            return back()->with('success', "Jadwal {$staff->name} diatur mengikuti jam operasional bisnis.");
        }

        $validator = Validator::make($request->all(), [
            'hours' => ['required', 'array', 'size:7'],
            'hours.*.day_of_week' => ['required', 'integer', 'between:0,6'],
            'hours.*.is_working' => ['required', 'boolean'],
            'hours.*.start_time' => ['required', 'date_format:H:i'],
            'hours.*.end_time' => ['required', 'date_format:H:i'],
            'hours.*.break_start' => ['nullable', 'date_format:H:i'],
            'hours.*.break_end' => ['nullable', 'date_format:H:i'],
        ]);

        $dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        $validator->after(function ($validator) use ($request, $dayNames): void {
            $hours = $request->input('hours', []);
            if (! is_array($hours)) {
                return;
            }

            foreach ($hours as $idx => $row) {
                if (empty($row['is_working'])) {
                    continue;
                }

                $dayIndex = (int) ($row['day_of_week'] ?? $idx);
                $dayLabel = $dayNames[$dayIndex] ?? "Hari #{$idx}";
                $start = (string) ($row['start_time'] ?? '');
                $end = (string) ($row['end_time'] ?? '');
                $breakStart = (string) ($row['break_start'] ?? '');
                $breakEnd = (string) ($row['break_end'] ?? '');

                if ($start !== '' && $end !== '' && $end <= $start) {
                    $validator->errors()->add(
                        "hours.{$idx}.end_time",
                        "Jam selesai shift {$dayLabel} harus lebih akhir dari jam mulai."
                    );
                }

                if (($breakStart !== '') !== ($breakEnd !== '')) {
                    $validator->errors()->add(
                        "hours.{$idx}.break_start",
                        "Jam mulai dan selesai istirahat {$dayLabel} harus diisi keduanya atau dikosongkan."
                    );
                } elseif ($breakStart !== '' && $breakEnd !== '') {
                    if ($breakEnd <= $breakStart) {
                        $validator->errors()->add(
                            "hours.{$idx}.break_end",
                            "Jam selesai istirahat {$dayLabel} harus lebih akhir dari jam mulai istirahat."
                        );
                    } elseif ($start !== '' && $end !== '' && ($breakStart < $start || $breakEnd > $end)) {
                        $validator->errors()->add(
                            "hours.{$idx}.break_start",
                            "Jam istirahat {$dayLabel} harus berada di antara jam mulai dan selesai shift."
                        );
                    }
                }
            }
        });

        $validated = $validator->validate();

        DB::transaction(function () use ($staff, $validated): void {
            foreach ($validated['hours'] as $row) {
                $staff->operatingHours()->updateOrCreate(
                    ['day_of_week' => $row['day_of_week']],
                    [
                        'is_working' => $row['is_working'],
                        'start_time' => $row['start_time'],
                        'end_time' => $row['end_time'],
                        'break_start' => $row['break_start'] ?: null,
                        'break_end' => $row['break_end'] ?: null,
                    ]
                );
            }
        });

        return back()->with('success', "Jadwal shift {$staff->name} berhasil disimpan.");
    }

    public function storeTimeOff(Request $request, Staff $staff): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless($business && $staff->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        $validated = $request->validate([
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:120'],
        ]);

        $staff->timeOffs()->create([
            'business_id' => $business->id,
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'],
            'reason' => $validated['reason'] ?: null,
        ]);

        return back()->with('success', "Cuti / libur untuk {$staff->name} berhasil ditambahkan.");
    }

    public function destroyTimeOff(Request $request, Staff $staff, StaffTimeOff $timeOff): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();

        abort_unless(
            $business
            && $staff->business_id === $business->id
            && $timeOff->staff_id === $staff->id
            && $timeOff->business_id === $business->id
            && $user->hasBusinessPermission($business, 'manage_staff'),
            403
        );

        $timeOff->delete();

        return back()->with('success', 'Jadwal cuti staff berhasil dihapus.');
    }
}
