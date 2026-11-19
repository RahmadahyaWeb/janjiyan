<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\PlanLimitService;
use App\Services\StaffCommissionService;
use App\Support\CsvHelper;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CommissionController extends Controller
{
    public function index(
        Request $request,
        StaffCommissionService $commissionService,
        PlanLimitService $planLimitService
    ): Response {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless(! $business || $user->hasBusinessPermission($business, 'manage_staff'), 403);
        $tz = $business?->timezone ?: 'Asia/Jakarta';
        $now = CarbonImmutable::now($tz);

        $dateFrom = $this->sanitizeDate($request->string('date_from')->toString())
            ?? $now->startOfMonth()->toDateString();
        $dateTo = $this->sanitizeDate($request->string('date_to')->toString())
            ?? $now->endOfMonth()->toDateString();

        if ($dateFrom > $dateTo) {
            [$dateFrom, $dateTo] = [$dateTo, $dateFrom];
        }

        $includeConfirmed = $request->boolean('include_confirmed');

        $report = $business
            ? $commissionService->buildReport($business, $dateFrom, $dateTo, $includeConfirmed)
            : [
                'summary' => [
                    'total_bookings' => 0,
                    'total_revenue' => 0,
                    'total_commission' => 0,
                    'active_staff_count' => 0,
                ],
                'rows' => [],
            ];

        return Inertia::render('Dashboard/Commissions/Index', [
            'report' => $report,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'include_confirmed' => $includeConfirmed,
            ],
            'canExportCsv' => $business ? $planLimitService->canExportCsv($business->owner) : false,
            'canManageStaff' => $business ? $user->hasBusinessPermission($business, 'manage_staff') : false,
        ]);
    }

    public function exportCsv(
        Request $request,
        StaffCommissionService $commissionService,
        PlanLimitService $planLimitService
    ): StreamedResponse|RedirectResponse {
        $user = $request->user();
        $business = $user->resolveActiveBusiness();
        abort_unless($business && $user->hasBusinessPermission($business, 'manage_staff'), 403);

        if (! $planLimitService->canExportCsv($business->owner)) {
            return back()->with('error', 'Export CSV hanya tersedia pada paket Professional dan Enterprise.');
        }

        $tz = $business->timezone ?: 'Asia/Jakarta';
        $now = CarbonImmutable::now($tz);
        $dateFrom = $this->sanitizeDate($request->string('date_from')->toString())
            ?? $now->startOfMonth()->toDateString();
        $dateTo = $this->sanitizeDate($request->string('date_to')->toString())
            ?? $now->endOfMonth()->toDateString();

        if ($dateFrom > $dateTo) {
            [$dateFrom, $dateTo] = [$dateTo, $dateFrom];
        }

        $includeConfirmed = $request->boolean('include_confirmed');
        $report = $commissionService->buildReport($business, $dateFrom, $dateTo, $includeConfirmed);

        return response()->streamDownload(function () use ($report, $dateFrom, $dateTo) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Periode',
                'Nama Staff',
                'Jabatan',
                'Status Staff',
                'Skema Komisi',
                'Nilai Komisi',
                'Jumlah Reservasi',
                'Total Omzet (Rp)',
                'Total Komisi (Rp)',
                'Rata-rata Transaksi (Rp)',
            ]);

            foreach ($report['rows'] as $row) {
                $schemeLabel = match ($row['commission_type']) {
                    'percentage' => 'Persentase (%)',
                    'fixed' => 'Nominal Tetap (Rp)',
                    default => 'Tidak Ada',
                };

                fputcsv($handle, CsvHelper::sanitizeRow([
                    "{$dateFrom} s/d {$dateTo}",
                    $row['staff_name'],
                    $row['staff_title'] ?? '-',
                    $row['is_active'] ? 'Aktif' : 'Nonaktif',
                    $schemeLabel,
                    $row['commission_type'] === 'percentage'
                        ? "{$row['commission_value']}%"
                        : $row['commission_value'],
                    $row['bookings_count'],
                    $row['gross_revenue'],
                    $row['total_commission'],
                    $row['average_order_value'],
                ]));
            }

            fclose($handle);
        }, "janjiyan-commissions-{$business->slug}-{$dateFrom}-to-{$dateTo}.csv");
    }

    private function sanitizeDate(string $value): ?string
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        $parsed = CarbonImmutable::createFromFormat('!Y-m-d', $value);

        return ($parsed && $parsed->format('Y-m-d') === $value) ? $value : null;
    }
}
