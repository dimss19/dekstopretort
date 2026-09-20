<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\InstallerController;

/*
|--------------------------------------------------------------------------
| Web Installer 7-Step Routes
|--------------------------------------------------------------------------
*/

Route::prefix('install')->name('installer.')->middleware(['web', 'check.installation'])->group(function () {
    // 1. Welcome
    Route::get('/', [InstallerController::class, 'welcome'])->name('welcome');

    // 2. Requirements
    Route::get('/requirements', [InstallerController::class, 'requirements'])->name('requirements');

    // 3. License / Purchase Code
    Route::get('/license', [InstallerController::class, 'license'])->name('license');
    Route::post('/license', [InstallerController::class, 'verifyLicense'])->name('verify-license');

    // 4. Database Configuration (SQLite default / MySQL)
    Route::get('/database', [InstallerController::class, 'database'])->name('database');
    Route::post('/database/test', [InstallerController::class, 'testDatabase'])->name('test-database');
    Route::post('/database', [InstallerController::class, 'saveDatabase'])->name('save-database');

    // 5. Application Configuration
    Route::get('/app-config', [InstallerController::class, 'appConfig'])->name('app-config');
    Route::post('/app-config', [InstallerController::class, 'saveAppConfig'])->name('save-app-config');

    // 6. Install (Process Execution)
    Route::get('/process', [InstallerController::class, 'installScreen'])->name('install');
    Route::post('/process/run', [InstallerController::class, 'processInstall'])->name('process-install');

    // 7. Installation Complete
    Route::get('/complete', [InstallerController::class, 'complete'])->name('complete');
});
