<?php

namespace App\Providers;

use Native\Desktop\Facades\Window;
use Native\Desktop\Facades\Menu;
use Native\Desktop\Facades\ChildProcess;
use Native\Desktop\Contracts\ProvidesPhpIni;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class NativeAppServiceProvider implements ProvidesPhpIni
{
    /**
     * Executed once the native application has been booted.
     * Use this method to open windows, register global shortcuts, etc.
     */
    public function boot(): void
    {
        Menu::default();

        // Pastikan koneksi database SQLite di NativePHP memiliki WAL mode dan data master siap
        if (config('nativephp-internal.running')) {
            $this->ensureDatabaseReady();
        }

        Window::open()
            ->title('SCADA Retort - PT Indah Mesin')
            ->url(route('tn.index'))
            ->width(1400)
            ->height(900)
            ->minWidth(1024)
            ->minHeight(768)
            ->rememberState();

        // Otomatis jalankan tn:poll di background desktop app untuk polling serial port USB RS-485
        if (config('nativephp-internal.running')) {
            try {
                ChildProcess::artisan(['tn:poll', '--interval=1'], 'tn_poll', persistent: true);
            } catch (\Throwable $e) {
                Log::warning('Native ChildProcess tn:poll failed to start: ' . $e->getMessage());
            }
        }
    }

    /**
     * Inisialisasi dan verifikasi kestabilan database NativePHP.
     */
    protected function ensureDatabaseReady(): void
    {
        try {
            // Aktifkan WAL mode dan busy timeout untuk mencegah database disk image is malformed
            DB::statement('PRAGMA journal_mode=WAL;');
            DB::statement('PRAGMA busy_timeout=10000;');
            DB::statement('PRAGMA synchronous=NORMAL;');

            // Verifikasi apakah tabel utama sudah ada dan termigrasi
            $needsMigration = !Schema::hasTable('tn_controllers') || !Schema::hasTable('users');
            if ($needsMigration) {
                Artisan::call('migrate', ['--force' => true]);
            }

            // Jika tabel kosong, jalankan seeder agar data awal (Admin, Controller, Recipe) terisi
            if (Schema::hasTable('tn_controllers') && \App\Models\TnController::count() === 0) {
                Artisan::call('db:seed', ['--force' => true]);
            }
        } catch (\Throwable $e) {
            Log::error('NativeAppServiceProvider ensureDatabaseReady error: ' . $e->getMessage());
        }
    }

    /**
     * Return an array of php.ini directives to be set.
     */
    public function phpIni(): array
    {
        return [
            'memory_limit' => '512M',
            'max_execution_time' => '300',
            'date.timezone' => 'Asia/Jakarta',
            'upload_max_filesize' => '64M',
            'post_max_size' => '64M',
        ];
    }
}
