<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Business;
use App\Models\Staff;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class IcsCalendarService
{
    public function generateBookingIcs(Booking $booking): string
    {
        $booking->loadMissing(['business', 'service', 'staff', 'customer']);
        $business = $booking->business;
        $businessType = $business?->resolvedBusinessType() ?? Business::TYPE_STAFF_APPOINTMENT;

        $summaryPrefix = $booking->isDropoff()
            ? ($booking->fulfillment_type === 'pickup' ? 'Jemput ' : 'Drop-off ')
            : '';

        $defaultNoun = match ($businessType) {
            Business::TYPE_DROPOFF => 'Pesanan',
            Business::TYPE_SPACE_BOOKING => 'Booking Sesi',
            default => 'Reservasi',
        };

        $summary = sprintf(
            '%s%s — %s',
            $summaryPrefix,
            $booking->service?->name ?? $defaultNoun,
            $business?->name ?? 'Janjiyan'
        );

        $unitLabel = $booking->resolvedUnitLabel();
        $descriptionLines = array_filter([
            'Kode Booking: '.$booking->booking_code,
            $booking->invoice_number ? 'No. Invoice: '.$booking->invoice_number : null,
            'Layanan: '.($booking->service?->name ?? '-').($booking->isDropoff() ? " ({$booking->quantity} {$unitLabel})" : ''),
            $booking->isDropoff() && $booking->estimated_ready_date
                ? 'Estimasi Selesai: '.$booking->estimated_ready_date->format('d M Y')
                : null,
            $booking->isDropoff() && $booking->fulfillment_type === 'pickup' && $booking->pickup_address
                ? 'Alamat Jemput: '.$booking->pickup_address
                : null,
            ($businessType === Business::TYPE_STAFF_APPOINTMENT && $booking->staff?->name)
                ? 'Staff: '.$booking->staff->name
                : null,
            'Total: Rp '.number_format((int) $booking->total_price, 0, ',', '.'),
            $booking->dp_amount > 0 ? 'Uang Muka: Rp '.number_format((int) $booking->dp_amount, 0, ',', '.') : null,
            ($business && $booking->invoice_token)
                ? 'Detail & Status: '.route('public.booking.invoice', ['slug' => $business->slug, 'token' => $booking->invoice_token])
                : null,
        ]);

        $events = [
            $this->buildEventBlock(
                uid: "booking-{$booking->booking_code}@janjiyan.id",
                startUtc: CarbonImmutable::instance($booking->start_at)->utc(),
                endUtc: CarbonImmutable::instance($booking->end_at)->utc(),
                summary: $summary,
                description: implode("\n", $descriptionLines),
                location: $business?->address ?: ($business?->name ?? ''),
                status: $booking->reservation_status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'
            ),
        ];

        $calNoun = match ($businessType) {
            Business::TYPE_DROPOFF => 'Pesanan',
            Business::TYPE_SPACE_BOOKING => 'Booking',
            default => 'Reservasi',
        };

        return $this->wrapCalendar(
            calName: ($business?->name ?? 'Janjiyan')." — {$calNoun} ".$booking->booking_code,
            events: $events
        );
    }

    /**
     * @param  Collection<int, Booking>  $bookings
     */
    public function generateStaffScheduleIcs(Business $business, Staff $staff, Collection $bookings): string
    {
        $events = [];

        foreach ($bookings as $booking) {
            $summary = sprintf(
                '%s (%s)',
                $booking->service?->name ?? 'Layanan',
                $booking->customer?->name ?? 'Pelanggan'
            );

            $descriptionLines = array_filter([
                'Kode: '.$booking->booking_code,
                'Pelanggan: '.($booking->customer?->name ?? '-'),
                $booking->customer?->phone ? 'Telepon: +'.$booking->customer->phone : null,
                'Status: '.strtoupper((string) $booking->reservation_status),
                $booking->customer_notes ? 'Catatan: '.$booking->customer_notes : null,
            ]);

            $events[] = $this->buildEventBlock(
                uid: "staff-{$staff->id}-booking-{$booking->booking_code}@janjiyan.id",
                startUtc: CarbonImmutable::instance($booking->start_at)->utc(),
                endUtc: CarbonImmutable::instance($booking->end_at)->utc(),
                summary: $summary,
                description: implode("\n", $descriptionLines),
                location: $business->address ?: $business->name,
                status: $booking->reservation_status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'
            );
        }

        return $this->wrapCalendar(
            calName: "Jadwal {$staff->name} — {$business->name}",
            events: $events
        );
    }

    /**
     * @param  array<int, string>  $events
     */
    private function wrapCalendar(string $calName, array $events): string
    {
        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Janjiyan//Booking Calendar//ID',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:'.$this->escapeText($calName),
            ...$events,
            'END:VCALENDAR',
        ];

        return implode("\r\n", $lines)."\r\n";
    }

    private function buildEventBlock(
        string $uid,
        CarbonImmutable $startUtc,
        CarbonImmutable $endUtc,
        string $summary,
        string $description,
        string $location,
        string $status
    ): string {
        $dtStamp = CarbonImmutable::now('UTC')->format('Ymd\THis\Z');

        $lines = [
            'BEGIN:VEVENT',
            'UID:'.$this->escapeText($uid),
            'DTSTAMP:'.$dtStamp,
            'DTSTART:'.$startUtc->format('Ymd\THis\Z'),
            'DTEND:'.$endUtc->format('Ymd\THis\Z'),
            'SUMMARY:'.$this->escapeText($summary),
            'DESCRIPTION:'.$this->escapeText($description),
            'LOCATION:'.$this->escapeText($location),
            'STATUS:'.$status,
            'END:VEVENT',
        ];

        return implode("\r\n", $lines);
    }

    private function escapeText(string $value): string
    {
        $clean = str_replace(["\r\n", "\r"], "\n", $value);
        $clean = str_replace('\\', '\\\\', $clean);
        $clean = str_replace(';', '\;', $clean);
        $clean = str_replace(',', '\,', $clean);

        return str_replace("\n", '\n', $clean);
    }
}
