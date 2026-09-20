<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use App\Services\LicenseService;
use PDO;
use Exception;

class InstallerController
{
    protected LicenseService $licenseService;

    public function __construct(LicenseService $licenseService)
    {
        $this->licenseService = $licenseService;
    }

    /**
     * Step 1: Welcome
     */
    public function welcome()
    {
        return view('installer.welcome');
    }

    /**
     * Step 2: Requirements
     */
    public function requirements()
    {
        $requirements = [
            'php' => [
                'name'    => 'PHP Version >= 8.2',
                'current' => PHP_VERSION,
                'status'  => version_compare(PHP_VERSION, '8.2.0', '>='),
            ],
            'pdo' => [
                'name'   => 'PDO Extension',
                'status' => extension_loaded('pdo'),
            ],
            'pdo_sqlite' => [
                'name'   => 'PDO SQLite Driver (Rekomendasi Lokal)',
                'status' => extension_loaded('pdo_sqlite') || extension_loaded('sqlite3'),
            ],
            'curl' => [
                'name'   => 'cURL Extension (Verifikasi Lisensi Online)',
                'status' => extension_loaded('curl'),
            ],
            'mbstring' => [
                'name'   => 'Mbstring Extension',
                'status' => extension_loaded('mbstring'),
            ],
            'openssl' => [
                'name'   => 'OpenSSL Extension',
                'status' => extension_loaded('openssl'),
            ],
            'fileinfo' => [
                'name'   => 'FileInfo Extension',
                'status' => extension_loaded('fileinfo'),
            ],
        ];

        $permissions = [
            'storage' => [
                'path'   => 'storage/',
                'status' => is_writable(storage_path()),
            ],
            'database' => [
                'path'   => 'database/ (Penyimpanan SQLite)',
                'status' => is_writable(database_path()),
            ],
            'bootstrap_cache' => [
                'path'   => 'bootstrap/cache/',
                'status' => is_writable(base_path('bootstrap/cache')),
            ],
            'env' => [
                'path'   => '.env (Konfigurasi Aplikasi)',
                'status' => file_exists(base_path('.env')) ? is_writable(base_path('.env')) : is_writable(base_path()),
            ],
        ];

        $allRequirementsMet = collect($requirements)->every(fn($r) => $r['status']) &&
                              collect($permissions)->every(fn($p) => $p['status']);

        return view('installer.requirements', compact('requirements', 'permissions', 'allRequirementsMet'));
    }

    /**
     * Step 3: License / Purchase Code Form
     */
    public function license()
    {
        $activeLicense = $this->licenseService->getActiveLicense();
        return view('installer.license', compact('activeLicense'));
    }

    /**
     * Step 3: Verifikasi License / Purchase Code
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
            session(['verified_license' => $result['data']]);
            return redirect()->route('installer.database')
                ->with('success', 'Kode Perusahaan terverifikasi: ' . $result['data']['company_name']);
        }

        return back()->withErrors(['company_code' => $result['message']])->withInput();
    }

    /**
     * Step 4: Database Configuration Form
     */
    public function database()
    {
        $defaultConfig = [
            'connection' => session('installer.db_connection', env('DB_CONNECTION', 'sqlite')),
            'host'       => session('installer.db_host', env('DB_HOST', '127.0.0.1')),
            'port'       => session('installer.db_port', env('DB_PORT', '3306')),
            'database'   => session('installer.db_name', env('DB_DATABASE', 'database/database.sqlite')),
            'username'   => session('installer.db_user', env('DB_USERNAME', 'root')),
            'password'   => session('installer.db_pass', env('DB_PASSWORD', '')),
        ];

        return view('installer.database', compact('defaultConfig'));
    }

    /**
     * Step 4: AJAX Test Database Connection
     */
    public function testDatabase(Request $request)
    {
        $conn = $request->input('db_connection', 'sqlite');

        if ($conn === 'sqlite') {
            try {
                $dbPath = database_path('database.sqlite');
                if (!file_exists($dbPath)) {
                    touch($dbPath);
                }
                $pdo = new PDO("sqlite:{$dbPath}", null, null, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
                ]);
                return response()->json([
                    'success' => true,
                    'message' => 'Koneksi SQLite berhasil! File database siap digunakan: database/database.sqlite'
                ]);
            } catch (Exception $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal membuka SQLite: ' . $e->getMessage()
                ]);
            }
        }

        $host = $request->input('db_host', '127.0.0.1');
        $port = $request->input('db_port', $conn === 'mysql' ? '3306' : '5432');
        $name = $request->input('db_name', 'scada');
        $user = $request->input('db_user', 'root');
        $pass = $request->input('db_pass', '');

        try {
            $dsn = "{$conn}:host={$host};port={$port};dbname={$name};";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 4
            ]);

            return response()->json(['success' => true, 'message' => "Koneksi ke database {$conn} berhasil!"]);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => 'Koneksi gagal: ' . $e->getMessage()]);
        }
    }

    /**
     * Step 4: Simpan Data DB ke Session & Lanjut ke Step 5
     */
    public function saveDatabase(Request $request)
    {
        $conn = $request->input('db_connection', 'sqlite');

        if ($conn === 'sqlite') {
            session([
                'installer.db_connection' => 'sqlite',
                'installer.db_host'       => '',
                'installer.db_port'       => '',
                'installer.db_name'       => 'database/database.sqlite',
                'installer.db_user'       => '',
                'installer.db_pass'       => '',
            ]);
            return redirect()->route('installer.app-config');
        }

        $request->validate([
            'db_connection' => 'required|in:mysql,pgsql,sqlite',
            'db_host'       => 'required',
            'db_port'       => 'required|numeric',
            'db_name'       => 'required',
            'db_user'       => 'required',
        ]);

        session([
            'installer.db_connection' => $request->input('db_connection'),
            'installer.db_host'       => $request->input('db_host'),
            'installer.db_port'       => $request->input('db_port'),
            'installer.db_name'       => $request->input('db_name'),
            'installer.db_user'       => $request->input('db_user'),
            'installer.db_pass'       => $request->input('db_pass') ?? '',
        ]);

        return redirect()->route('installer.app-config');
    }

    /**
     * Step 5: Application Configuration Form (APP_URL, APP_NAME, Admin credentials)
     */
    public function appConfig()
    {
        $defaultAppUrl = request()->getSchemeAndHttpHost();
        $defaultAppName = env('APP_NAME', 'SCADA Retort - Indah Mesin');

        return view('installer.app_config', compact('defaultAppUrl', 'defaultAppName'));
    }

    /**
     * Step 5: Simpan App Config & Lanjut ke Step 6 (Install Execution)
     */
    public function saveAppConfig(Request $request)
    {
        $request->validate([
            'app_name'       => 'required|string|max:255',
            'app_url'        => 'required|url',
            'admin_name'     => 'required|string|max:255',
            'admin_email'    => 'required|email|max:255',
            'admin_password' => 'required|min:8|confirmed',
        ]);

        session([
            'installer.app_name'       => $request->input('app_name'),
            'installer.app_url'        => $request->input('app_url'),
            'installer.admin_name'     => $request->input('admin_name'),
            'installer.admin_email'    => $request->input('admin_email'),
            'installer.admin_password' => $request->input('admin_password'),
        ]);

        return redirect()->route('installer.install');
    }

    /**
     * Step 6: Install Screen
     */
    public function installScreen()
    {
        $summary = [
            'app_name'      => session('installer.app_name', 'SCADA Retort'),
            'app_url'       => session('installer.app_url', url('/')),
            'db_connection' => session('installer.db_connection', 'sqlite'),
            'db_name'       => session('installer.db_name', 'database/database.sqlite'),
            'admin_email'   => session('installer.admin_email', 'admin@indahmesin.com'),
        ];

        return view('installer.install', compact('summary'));
    }

    /**
     * Step 6: Proses Instalasi Lengkap (AJAX / POST)
     */
    public function processInstall(Request $request)
    {
        try {
            $dbConn = session('installer.db_connection', 'sqlite');
            $dbHost = session('installer.db_host', '');
            $dbPort = session('installer.db_port', '');
            $dbName = session('installer.db_name', 'database/database.sqlite');
            $dbUser = session('installer.db_user', '');
            $dbPass = session('installer.db_pass', '');

            $appName   = session('installer.app_name', 'SCADA Retort');
            $appUrl    = session('installer.app_url', url('/'));
            $adminName = session('installer.admin_name', 'Super Administrator');
            $adminMail = session('installer.admin_email', 'admin@indahmesin.com');
            $adminPass = session('installer.admin_password', 'password');

            // 1. Setup SQLite file jika menggunakan SQLite
            if ($dbConn === 'sqlite') {
                $sqliteFile = database_path('database.sqlite');
                if (!file_exists($sqliteFile)) {
                    touch($sqliteFile);
                }
                $envDbData = [
                    'DB_CONNECTION' => 'sqlite',
                    'DB_DATABASE'   => database_path('database.sqlite'),
                ];
            } else {
                $envDbData = [
                    'DB_CONNECTION' => $dbConn,
                    'DB_HOST'       => $dbHost,
                    'DB_PORT'       => $dbPort,
                    'DB_DATABASE'   => $dbName,
                    'DB_USERNAME'   => $dbUser,
                    'DB_PASSWORD'   => $dbPass,
                ];
            }

            // 2. Generate / Update .env file
            $this->updateEnvFile(array_merge([
                'APP_NAME'  => $appName,
                'APP_ENV'   => 'production',
                'APP_DEBUG' => 'false',
                'APP_URL'   => $appUrl,
            ], $envDbData));

            // 3. Set runtime database config
            config(['database.default' => $dbConn]);
            if ($dbConn === 'sqlite') {
                config(['database.connections.sqlite.database' => database_path('database.sqlite')]);
            } else {
                config([
                    "database.connections.{$dbConn}.host"     => $dbHost,
                    "database.connections.{$dbConn}.port"     => $dbPort,
                    "database.connections.{$dbConn}.database" => $dbName,
                    "database.connections.{$dbConn}.username" => $dbUser,
                    "database.connections.{$dbConn}.password" => $dbPass,
                ]);
            }

            DB::purge();

            // 4. Generate APP_KEY if empty
            if (empty(env('APP_KEY'))) {
                Artisan::call('key:generate', ['--force' => true]);
            }

            // 5. Run Migrations
            Artisan::call('migrate', ['--force' => true]);

            // 6. Run Seeders jika ada
            try {
                Artisan::call('db:seed', ['--force' => true]);
            } catch (Exception $e) {
                // Ignore jika tidak ada seeder
            }

            // 7. Create Super Admin user
            DB::table('users')->updateOrInsert(
                ['email' => $adminMail],
                [
                    'name'       => $adminName,
                    'password'   => Hash::make($adminPass),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            // 8. Lock installer
            File::put(storage_path('installed'), now()->toDateTimeString());

            try {
                Artisan::call('config:cache');
                Artisan::call('route:cache');
                Artisan::call('view:cache');
            } catch (Exception $e) {
                // Ignore cache warning
            }

            return response()->json([
                'success' => true,
                'message' => 'Instalasi berhasil diselesaikan!'
            ]);

        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal selama instalasi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Step 7: Installation Complete
     */
    public function complete()
    {
        $license = $this->licenseService->getActiveLicense();
        return view('installer.complete', compact('license'));
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
