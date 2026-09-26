<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\InstallerController;

/*
|--------------------------------------------------------------------------
| Desktop App Setup & Activation Routes
|--------------------------------------------------------------------------
*/

Route::prefix('install')->name('installer.')->middleware(['web', 'check.installation'])->group(function () {
    // 1. Setup Akun Administrator & Inisialisasi Otomatis (SQLite pre-configured)
    Route::get('/', [InstallerController::class, 'welcome'])->name('welcome');
    Route::post('/setup', [InstallerController::class, 'processSetup'])->name('process-setup');

    // 2. Aktivasi Lisensi Perusahaan (Final Step)
    Route::get('/license', [InstallerController::class, 'license'])->name('license');
    Route::post('/license', [InstallerController::class, 'verifyLicense'])->name('verify-license');

    // 3. Selesai
    Route::get('/complete', [InstallerController::class, 'complete'])->name('complete');

    // Fallbacks untuk rute lawas
    Route::get('/requirements', [InstallerController::class, 'requirements'])->name('requirements');
    Route::get('/database', [InstallerController::class, 'database'])->name('database');
    Route::get('/app-config', [InstallerController::class, 'appConfig'])->name('app-config');
    Route::get('/process', [InstallerController::class, 'installScreen'])->name('install');
});
