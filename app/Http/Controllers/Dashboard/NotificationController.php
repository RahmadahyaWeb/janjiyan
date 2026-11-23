<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\InAppNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request, InAppNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $activeBusiness = $user->resolveActiveBusiness();

        $items = $notificationService
            ->recentForUser($user, $activeBusiness, 20)
            ->map(function (DatabaseNotification $item): array {
                $data = is_array($item->data) ? $item->data : [];

                return [
                    'id' => (string) $item->id,
                    'category' => (string) ($data['category'] ?? 'info'),
                    'business_id' => isset($data['business_id']) ? (int) $data['business_id'] : null,
                    'business_name' => isset($data['business_name']) ? (string) $data['business_name'] : null,
                    'title' => (string) ($data['title'] ?? 'Notifikasi'),
                    'message' => (string) ($data['message'] ?? ''),
                    'action_url' => isset($data['action_url']) ? (string) $data['action_url'] : null,
                    'read_at' => $item->read_at?->toIso8601String(),
                    'created_at' => $item->created_at?->toIso8601String(),
                ];
            })
            ->values();

        return response()->json([
            'unread_count' => $notificationService->unreadCountForUser($user, $activeBusiness),
            'items' => $items,
        ]);
    }

    public function markAsRead(
        Request $request,
        DatabaseNotification $notification,
        InAppNotificationService $notificationService
    ): JsonResponse {
        $user = $request->user();

        abort_unless(
            $notification->notifiable_type === User::class && (int) $notification->notifiable_id === (int) $user->id,
            403
        );

        if ($notification->read_at === null) {
            $notification->markAsRead();
        }

        $activeBusiness = $user->resolveActiveBusiness();

        return response()->json([
            'ok' => true,
            'unread_count' => $notificationService->unreadCountForUser($user, $activeBusiness),
        ]);
    }

    public function markAllAsRead(Request $request, InAppNotificationService $notificationService): JsonResponse
    {
        $user = $request->user();
        $activeBusiness = $user->resolveActiveBusiness();

        $notificationService->markAllReadForUser($user, $activeBusiness);

        return response()->json([
            'ok' => true,
            'unread_count' => 0,
        ]);
    }
}
