<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use App\Services\LicenseService;
use Exception;

class InstallerController
{
    protected LicenseService $licenseService;

    public function __construct(LicenseService $licenseService)
    {
        $this->licenseService = $licenseService;
    }

    /**
     * Langkah 1: Setup Akun Administrator & Profil Sistem
     */
    public function welcome()
    {
        return view('installer.welcome');
    }

    /**
     * Langkah 1: Proses Inisialisasi Otomatis (SQLite & Akun Admin)
     */
    public function processSetup(Request $request)
    {
        $request->validate([
            'admin_name'     => 'required|string|max:255',
            'admin_email'    => 'required|email|max:255',
            'admin_password' => 'required|min:6|confirmed',
        ], [
            'admin_name.required'     => 'Nama Administrator wajib diisi.',
            'admin_email.required'    => 'Email Administrator wajib diisi.',
            'admin_email.email'       => 'Format email tidak valid.',
            'admin_password.required' => 'Password wajib diisi.',
            'admin_password.min'      => 'Password minimal 6 karakter.',
            'admin_password.confirmed'=> 'Konfirmasi password tidak cocok.',
        ]);

        try {
            // 1. Tentukan path database yang aktif
            $sqliteFile = database_path('database.sqlite');
            if (!file_exists($sqliteFile)) {
                if (!is_dir(database_path())) {
                    mkdir(database_path(), 0755, true);
                }
                touch($sqliteFile);
            }

            // Pastikan nativephp.sqlite juga ada jika NativePHP aktif
            $nativeSqliteFile = database_path('nativephp.sqlite');
            if (!file_exists($nativeSqliteFile)) {
                touch($nativeSqliteFile);
            }

            // 2. Set environment SQLite
            $this->updateEnvFile([
                'DB_CONNECTION' => 'sqlite',
                'DB_DATABASE'   => database_path('database.sqlite'),
                'APP_ENV'       => 'production',
                'APP_DEBUG'     => 'false',
            ]);

            // 3. Generate APP_KEY jika belum ada
            if (empty(config('app.key')) || empty(env('APP_KEY'))) {
                Artisan::call('key:generate', ['--force' => true]);
            }

            // 4. Jalankan migrasi database
            Artisan::call('migrate', ['--force' => true]);

            // 5. Buat / Perbarui Akun Super Admin di koneksi aktif
            DB::table('users')->updateOrInsert(
                ['email' => $request->input('admin_email')],
                [
                    'name'       => $request->input('admin_name'),
                    'password'   => Hash::make($request->input('admin_password')),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            // Jalankan seeder mesin jika belum ada
            if (DB::table('machines')->count() === 0) {
                try {
                    Artisan::call('db:seed', ['--force' => true]);
                } catch (Exception $e) {
                    // Ignore
                }
            }

            // 6. Sinkronisasi file database SQLite ke seluruh lokasi (CLI, Dev, & Electron AppData)
            $sourceDb = DB::connection()->getDatabaseName();
            if (file_exists($sourceDb)) {
                $targetDbs = array_filter([
                    database_path('database.sqlite'),
                    database_path('nativephp.sqlite'),
                    config('nativephp-internal.database_path'),
                ]);
                foreach ($targetDbs as $target) {
                    if ($target !== $sourceDb) {
                        $targetDir = dirname($target);
                        if (!is_dir($targetDir)) {
                            @mkdir($targetDir, 0755, true);
                        }
                        @copy($sourceDb, $target);
                    }
                }
            }

            session([
                'installer.admin_name'  => $request->input('admin_name'),
                'installer.admin_email' => $request->input('admin_email'),
            ]);

            return redirect()->route('installer.license')
                ->with('success', 'Sistem & Database SQLite berhasil disiapkan. Silakan aktifkan lisensi resmi software Anda.');

        } catch (Exception $e) {
            return back()->withErrors(['error' => 'Gagal inisialisasi sistem: ' . $e->getMessage()])->withInput();
        }
    }

    /**
     * Langkah 2 (Tahap Akhir): Form Aktivasi Lisensi Perusahaan (Purchase Code)
     */
    public function license()
    {
        $activeLicense = $this->licenseService->getActiveLicense();
        return view('installer.license', compact('activeLicense'));
    }

    /**
     * Langkah 2 (Tahap Akhir): Verifikasi Aktivasi Lisensi
     */
    public function verifyLicense(Request $request)
    {
        $request->validate([
            'company_code' => 'required|string|min:6'
        ], [
            'company_code.required' => 'Silakan masukkan Kode Perusahaan / Purchase Code Anda.'
        ]);

        $result = $this->licenseService->verifyCompanyCode($request->input('company_code'));

        if ($result['success']) {
            // Kunci installer bahwa instalasi sudah selesai di semua lokasi storage
            $installedTime = now()->toDateTimeString();
            $storagePaths = array_filter([
                storage_path('installed'),
                base_path('storage/installed'),
                config('nativephp-internal.storage_path') ? config('nativephp-internal.storage_path') . '/installed' : null,
            ]);

            foreach ($storagePaths as $path) {
                $dir = dirname($path);
                if (!is_dir($dir)) {
                    @mkdir($dir, 0755, true);
                }
                @file_put_contents($path, $installedTime);
            }

            try {
                Artisan::call('config:clear');
            } catch (Exception $e) {
                // Ignore
            }

            return redirect()->route('installer.complete')
                ->with('success', 'Aktivasi Lisensi Berhasil: ' . ($result['data']['company_name'] ?? ''));
        }

        return back()->withErrors(['company_code' => $result['message']])->withInput();
    }

    /**
     * Selesai: Tampilan Rangkuman & Tombol Masuk ke Dashboard
     */
    public function complete()
    {
        $license = $this->licenseService->getActiveLicense();
        return view('installer.complete', compact('license'));
    }

    /**
     * Fallback redirects untuk kompatibilitas rute lama
     */
    public function requirements()
    {
        return redirect()->route('installer.welcome');
    }

    public function database()
    {
        return redirect()->route('installer.welcome');
    }

    public function appConfig()
    {
        return redirect()->route('installer.welcome');
    }

    public function installScreen()
    {
        return redirect()->route('installer.license');
    }

    /**
     * Helper menulis ke file .env
     */
    protected function updateEnvFile(array $data): void
    {
        $envPath = base_path('.env');
        if (!file_exists($envPath)) {
            if (file_exists(base_path('.env.example'))) {
                copy(base_path('.env.example'), $envPath);
            } else {
                touch($envPath);
            }
        }

        $content = file_get_contents($envPath);

        foreach ($data as $key => $value) {
            $formattedValue = (str_contains($value, ' ') || str_contains($value, '#')) ? "\"{$value}\"" : $value;

            if (preg_match("/^{$key}=.*/m", $content)) {
                $content = preg_replace("/^{$key}=.*/m", "{$key}={$formattedValue}", $content);
            } else {
                $content .= "\n{$key}={$formattedValue}";
            }
        }

        file_put_contents($envPath, $content);
    }
}
