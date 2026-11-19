<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\SubscriptionPlan;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class LandingController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Landing', [
            'plans' => SubscriptionPlan::orderBy('price_monthly')->get(),
        ]);
    }

    public function sitemap(): HttpResponse
    {
        $xml = Cache::remember('sitemap.xml', 3600, function (): string {
            $urls = [
                [
                    'loc' => route('home'),
                    'lastmod' => now()->toAtomString(),
                    'changefreq' => 'weekly',
                    'priority' => '1.0',
                ],
                [
                    'loc' => route('legal.terms'),
                    'lastmod' => now()->toAtomString(),
                    'changefreq' => 'monthly',
                    'priority' => '0.4',
                ],
                [
                    'loc' => route('legal.privacy'),
                    'lastmod' => now()->toAtomString(),
                    'changefreq' => 'monthly',
                    'priority' => '0.4',
                ],
            ];

            $businesses = Business::query()
                ->where('is_active', true)
                ->whereNull('suspended_at')
                ->orderByDesc('updated_at')
                ->limit(1000)
                ->get(['slug', 'updated_at']);

            foreach ($businesses as $business) {
                $urls[] = [
                    'loc' => route('public.booking', ['slug' => $business->slug]),
                    'lastmod' => ($business->updated_at ?? now())->toAtomString(),
                    'changefreq' => 'daily',
                    'priority' => '0.8',
                ];
            }

            $entries = array_map(static function (array $item): string {
                $loc = htmlspecialchars($item['loc'], ENT_XML1 | ENT_QUOTES, 'UTF-8');
                $lastmod = htmlspecialchars($item['lastmod'], ENT_XML1 | ENT_QUOTES, 'UTF-8');

                return "  <url>\n"
                    ."    <loc>{$loc}</loc>\n"
                    ."    <lastmod>{$lastmod}</lastmod>\n"
                    ."    <changefreq>{$item['changefreq']}</changefreq>\n"
                    ."    <priority>{$item['priority']}</priority>\n"
                    .'  </url>';
            }, $urls);

            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                ."<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n"
                .implode("\n", $entries)
                ."\n</urlset>\n";
        });

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
        ]);
    }
}
