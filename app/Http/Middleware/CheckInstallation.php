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

        $isInstalled = file_exists(storage_path('installed'));
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
