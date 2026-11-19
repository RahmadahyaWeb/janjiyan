<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\BusinessHoliday;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Inertia\Response;

class ScheduleController extends Controller
{
    public function index(Request $request): Response
    {
        $business = $request->user()->resolveActiveBusiness();

        return Inertia::render('Dashboard/Schedule/Index', [
            'operatingHours' => $business ? $business->operatingHours()->get() : [],
            'holidays' => $business ? $business->holidays()->get()->map(fn ($h) => [
                'id' => $h->id,
                'date' => $h->date->toDateString(),
                'reason' => $h->reason,
            ]) : [],
        ]);
    }

    public function updateHours(Request $request): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_settings'), 403);

        $validator = Validator::make($request->all(), [
            'hours' => ['required', 'array', 'size:7'],
            'hours.*.day_of_week' => ['required', 'integer', 'between:0,6'],
            'hours.*.is_open' => ['required', 'boolean'],
            'hours.*.open_time' => ['required', 'date_format:H:i'],
            'hours.*.close_time' => ['required', 'date_format:H:i'],
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
                if (empty($row['is_open'])) {
                    continue;
                }

                $dayIndex = (int) ($row['day_of_week'] ?? $idx);
                $dayLabel = $dayNames[$dayIndex] ?? "Hari #{$idx}";
                $open = (string) ($row['open_time'] ?? '');
                $close = (string) ($row['close_time'] ?? '');
                $breakStart = (string) ($row['break_start'] ?? '');
                $breakEnd = (string) ($row['break_end'] ?? '');

                if ($open !== '' && $close !== '' && $close <= $open) {
                    $validator->errors()->add(
                        "hours.{$idx}.close_time",
                        "Jam tutup {$dayLabel} harus lebih akhir dari jam buka."
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
                    } elseif ($open !== '' && $close !== '' && ($breakStart < $open || $breakEnd > $close)) {
                        $validator->errors()->add(
                            "hours.{$idx}.break_start",
                            "Jam istirahat {$dayLabel} harus berada di antara jam buka dan jam tutup."
                        );
                    }
                }
            }
        });

        $validated = $validator->validate();

        foreach ($validated['hours'] as $row) {
            $business->operatingHours()->updateOrCreate(
                ['day_of_week' => $row['day_of_week']],
                [
                    'is_open' => $row['is_open'],
                    'open_time' => $row['open_time'],
                    'close_time' => $row['close_time'],
                    'break_start' => $row['break_start'] ?: null,
                    'break_end' => $row['break_end'] ?: null,
                ]
            );
        }

        return back()->with('success', 'Jam operasional berhasil disimpan.');
    }

    public function storeHoliday(Request $request): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_settings'), 403);

        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'reason' => ['nullable', 'string', 'max:120'],
        ]);

        $business->holidays()->updateOrCreate(
            ['date' => $validated['date']],
            ['reason' => $validated['reason'] ?? 'Hari Libur']
        );

        return back()->with('success', 'Tanggal libur ditambahkan.');
    }

    public function destroyHoliday(Request $request, BusinessHoliday $holiday): RedirectResponse
    {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $holiday->business_id === $business->id && $user->hasBusinessPermission($business, 'manage_settings'), 403);

        $holiday->delete();

        return back()->with('success', 'Tanggal libur dihapus.');
    }
}
