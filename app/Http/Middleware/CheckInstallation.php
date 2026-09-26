<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckInstallation
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('testing')) {
            return $next($request);
        }

        $storagePaths = array_filter([
            storage_path('installed'),
            base_path('storage/installed'),
            config('nativephp-internal.storage_path') ? config('nativephp-internal.storage_path') . '/installed' : null,
        ]);

        $isInstalled = false;
        foreach ($storagePaths as $path) {
            if (file_exists($path)) {
                $isInstalled = true;
                break;
            }
        }

        // Jika file installed belum ada, cek apakah database sudah memiliki tabel users dan data user
        if (!$isInstalled) {
            try {
                if (\Illuminate\Support\Facades\Schema::hasTable('users') && \Illuminate\Support\Facades\DB::table('users')->count() > 0) {
                    $isInstalled = true;
                }
            } catch (\Throwable $e) {
                // Table belum dibuat, berarti belum terinstall
            }
        }

        // Sinkronisasi file installed ke seluruh storage path agar konsisten
        if ($isInstalled) {
            foreach ($storagePaths as $path) {
                if (!file_exists($path)) {
                    $dir = dirname($path);
                    if (!is_dir($dir)) {
                        @mkdir($dir, 0755, true);
                    }
                    @file_put_contents($path, now()->toDateTimeString());
                }
            }
        }

        $isInstallerRoute = $request->is('install*');

        // 1. Jika aplikasi BELUM diinstall dan user mencoba membuka route utama
        if (!$isInstalled && !$isInstallerRoute) {
            return redirect()->route('installer.welcome');
        }

        // 2. Jika aplikasi SUDAH diinstall dan user mencoba membuka route installer lagi
        if ($isInstalled && $isInstallerRoute) {
            return redirect('/');
        }

        return $next($request);
    }
}
