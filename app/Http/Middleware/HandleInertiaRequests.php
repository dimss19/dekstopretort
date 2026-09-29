<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $unverifiedCount = rescue(function () {
            if (!\Illuminate\Support\Facades\Schema::hasTable('tn_process_histories')) {
                return 0;
            }
            return \App\Models\TnProcessHistory::whereNotNull('end_time')
                ->where(function ($q) {
                    $q->whereNull('verification_status')
                      ->orWhere('verification_status', '!=', 'verified');
                })
                ->count();
        }, 0, false) ?: 0;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => rescue(fn () => $request->user() ?: \App\Models\User::first(), null, false) ?: (object)[
                    'id' => 1,
                    'name' => 'Operator SCADA',
                    'email' => 'operator@indahmesin.com',
                ],
            ],
            'ui' => [
                'active_mode' => $request->session()->get('active_mode'),
                'active_tn_id' => $request->session()->get('active_tn_id'),
                'active_tn_model' => $request->session()->get('active_tn_model'),
                'unverified_count' => $unverifiedCount,
            ],
        ];
    }
}
