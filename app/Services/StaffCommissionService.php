<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingItem;
use App\Models\Business;
use App\Models\Staff;
use Illuminate\Support\Facades\DB;

class StaffCommissionService
{
    public function calculateForStaff(?Staff $staff, int $totalPrice): int
    {
        if (! $staff || $totalPrice <= 0) {
            return 0;
        }

        return $staff->calculateCommission($totalPrice);
    }

    /**
     * Sum commissionable subtotals from booking items (primary service + is_commissionable items only).
     *
     * @param  iterable<int, BookingItem>  $items
     */
    public function calculateCommissionBase(iterable $items, int $fallbackTotal = 0): int
    {
        $hasItems = false;
        $base = 0;

        foreach ($items as $item) {
            $hasItems = true;
            if ($item->item_type === BookingItem::TYPE_SERVICE || (bool) $item->is_commissionable) {
                $base += max(0, (int) $item->subtotal);
            }
        }

        return $hasItems ? $base : max(0, $fallbackTotal);
    }

    public function calculateForBooking(Booking $booking, ?Staff $staff = null): int
    {
        $booking->loadMissing(['business', 'staff', 'items']);
        if (! $booking->business?->supportsCommissions()) {
            return 0;
        }

        $targetStaff = $staff ?? $booking->staff;
        if (! $targetStaff) {
            return 0;
        }

        $base = $this->calculateCommissionBase($booking->items, (int) $booking->total_price);

        return $this->calculateForStaff($targetStaff, $base);
    }

    /**
     * Build aggregated staff commission & performance report using SQL GROUP BY for scalability.
     *
     * @return array{
     *     summary: array{
     *         total_bookings: int,
     *         total_revenue: int,
     *         total_commission: int,
     *         active_staff_count: int
     *     },
     *     rows: array<int, array{
     *         staff_id: int,
     *         staff_name: string,
     *         staff_title: string|null,
     *         is_active: bool,
     *         commission_type: string,
     *         commission_value: int,
     *         bookings_count: int,
     *         gross_revenue: int,
     *         total_commission: int,
     *         average_order_value: int
     *     }>
     * }
     */
    public function buildReport(
        Business $business,
        string $dateFrom,
        string $dateTo,
        bool $includeConfirmed = false
    ): array {
        $statuses = $includeConfirmed ? ['completed', 'confirmed'] : ['completed'];

        $isSqlite = DB::connection()->getDriverName() === 'sqlite';

        $aggregated = DB::table('bookings')
            ->select([
                'staff_id',
                DB::raw('COUNT(*) as bookings_count'),
                DB::raw('COALESCE(SUM(total_price), 0) as gross_revenue'),
                DB::raw('COALESCE(SUM(commission_amount), 0) as total_commission'),
            ])
            ->where('business_id', $business->id)
            ->whereNotNull('staff_id')
            ->whereIn('reservation_status', $statuses)
            ->when(
                $isSqlite,
                fn ($q) => $q->whereDate('booking_date', '>=', $dateFrom)->whereDate('booking_date', '<=', $dateTo),
                fn ($q) => $q->where('booking_date', '>=', $dateFrom)->where('booking_date', '<=', $dateTo)
            )
            ->groupBy('staff_id')
            ->get()
            ->keyBy('staff_id');

        $staffList = $business->staff()
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get(['id', 'name', 'title', 'is_active', 'commission_type', 'commission_value']);

        $totalBookings = 0;
        $totalRevenue = 0;
        $totalCommission = 0;

        $rows = $staffList->map(function (Staff $staff) use (
            $aggregated,
            &$totalBookings,
            &$totalRevenue,
            &$totalCommission
        ): array {
            $metric = $aggregated->get($staff->id);
            $bookingsCount = (int) ($metric->bookings_count ?? 0);
            $grossRevenue = (int) ($metric->gross_revenue ?? 0);
            $commission = (int) ($metric->total_commission ?? 0);

            $totalBookings += $bookingsCount;
            $totalRevenue += $grossRevenue;
            $totalCommission += $commission;

            return [
                'staff_id' => $staff->id,
                'staff_name' => $staff->name,
                'staff_title' => $staff->title,
                'is_active' => (bool) $staff->is_active,
                'commission_type' => $staff->commission_type ?: 'none',
                'commission_value' => (int) ($staff->commission_value ?? 0),
                'bookings_count' => $bookingsCount,
                'gross_revenue' => $grossRevenue,
                'total_commission' => $commission,
                'average_order_value' => $bookingsCount > 0 ? (int) round($grossRevenue / $bookingsCount) : 0,
            ];
        })->values()->all();

        return [
            'summary' => [
                'total_bookings' => $totalBookings,
                'total_revenue' => $totalRevenue,
                'total_commission' => $totalCommission,
                'active_staff_count' => $staffList->where('is_active', true)->count(),
            ],
            'rows' => $rows,
        ];
    }
}
