<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        $this->ensureDatabaseHealth();
    }

    /**
     * Pastikan database siap, tabel users memiliki admin, dan data awal SCADA tersedia.
     */
    protected function ensureDatabaseHealth(): void
    {
        try {
            // Hindari eksekusi di lingkungan testing atau CLI migration
            if (app()->environment('testing')) {
                return;
            }

            if (app()->runningInConsole() && !empty($_SERVER['argv'][1]) && in_array($_SERVER['argv'][1], ['migrate', 'migrate:fresh', 'migrate:rollback', 'db:seed'])) {
                return;
            }

            if (\Illuminate\Support\Facades\Schema::hasTable('users')) {
                $userCount = \Illuminate\Support\Facades\DB::table('users')->count();

                if ($userCount === 0) {
                    \Illuminate\Support\Facades\DB::table('users')->insert([
                        [
                            'name'       => 'Admin Operator',
                            'email'      => 'admin@scada.local',
                            'password'   => \Illuminate\Support\Facades\Hash::make('password123'),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ],
                        [
                            'name'       => 'Super Administrator',
                            'email'      => 'admin@admin.com',
                            'password'   => \Illuminate\Support\Facades\Hash::make('password'),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]
                    ]);
                }
            }

            // Pastikan mesin default tersedia tanpa memanggil artisan console runner
            if (\Illuminate\Support\Facades\Schema::hasTable('machines') && \Illuminate\Support\Facades\DB::table('machines')->count() === 0) {
                \Illuminate\Support\Facades\DB::table('machines')->insert([
                    ['machine_code' => 'RT-01', 'machine_name' => 'Retort TNS', 'description' => 'Production retort machine', 'location' => 'Production Area', 'status' => 'Active', 'created_at' => now(), 'updated_at' => now()],
                    ['machine_code' => 'RT-02', 'machine_name' => 'Retort TNH', 'description' => 'Production retort machine', 'location' => 'Production Area', 'status' => 'Active', 'created_at' => now(), 'updated_at' => now()],
                    ['machine_code' => 'RT-03', 'machine_name' => 'Retort TNL', 'description' => 'Production retort machine', 'location' => 'Production Area', 'status' => 'Active', 'created_at' => now(), 'updated_at' => now()],
                ]);
            }

        } catch (\Throwable $e) {
            // Abaikan jika database belum siap/belum migrasi
        }
    }
}
