<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('dashboard');
});

Route::get('/login', function () {
    return redirect()->route('dashboard');
})->name('login');

Route::get('/dashboard', function () {
    $lastSeen = \Illuminate\Support\Facades\Cache::get('esp_last_seen_RT-001') ?? \Illuminate\Support\Facades\Cache::get('esp_last_seen');
    $espOnline = $lastSeen && (time() - (int)$lastSeen) < 25;
    $detectedIp = \Illuminate\Support\Facades\Cache::get('esp_ip_RT-001') ?? \Illuminate\Support\Facades\Cache::get('esp_ip');
    $espIp = $espOnline && $detectedIp ? $detectedIp : null;

    return Inertia::render('Dashboard', [
        'tnCount' => \App\Models\TnController::count(),
        'tnOnline' => \App\Models\TnController::where('is_online', true)->count(),
        'recipeCount' => \App\Models\TnRecipeTemplate::count(),
        'controllers' => \App\Models\TnController::all(),
        'espOnline' => (bool)$espOnline,
        'espIp' => $espIp,
    ]);
})->name('dashboard');

Route::get('/test-lock', function () {
    $lock = \Illuminate\Support\Facades\Cache::lock('modbus_port_' . md5('COM6'), 5);
    $acquired = $lock->block(3);
    if ($acquired) $lock->release();
    return response()->json(['acquired' => $acquired, 'driver' => config('cache.default')]);
});

Route::group([], function () {
    Route::get('/scada', fn () => redirect()->route('tn.index'))->name('scada.index');
    Route::get('/historian', function () {
        $histories = \App\Models\TnProcessHistory::with('controller.machine')->orderBy('start_time')->get();
        $groups = \App\Models\HistoryGroup::orderBy('id')->get();
        return Inertia::render('Operations', ['module' => 'historian', 'histories' => $histories, 'groups' => $groups]);
    })->name('historian.index');
    Route::get('/database', fn () => Inertia::render('Operations', ['module' => 'database']))->name('database.index');
    Route::redirect('/trend', '/tn')->name('trend.index');
    Route::redirect('/communication', '/tn')->name('communication.index');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::resource('devices', \App\Http\Controllers\ControllerDeviceController::class)->except('show');

    // === Temperature Recipe CRUD ===
    Route::prefix('recipes')->name('tn.recipes.')->group(function () {
        Route::get('/', [\App\Http\Controllers\TnRecipeController::class, 'index'])->name('index');
        Route::get('/create', [\App\Http\Controllers\TnRecipeController::class, 'create'])->name('create');
        Route::post('/', [\App\Http\Controllers\TnRecipeController::class, 'store'])->name('store');
        Route::get('/{recipe}/edit', [\App\Http\Controllers\TnRecipeController::class, 'edit'])->name('edit');
        Route::put('/{recipe}', [\App\Http\Controllers\TnRecipeController::class, 'update'])->name('update');
        Route::post('/{recipe}/duplicate', [\App\Http\Controllers\TnRecipeController::class, 'duplicate'])->name('duplicate');
        Route::patch('/{recipe}/archive', [\App\Http\Controllers\TnRecipeController::class, 'archive'])->name('archive');
        Route::delete('/{recipe}', [\App\Http\Controllers\TnRecipeController::class, 'destroy'])->name('destroy');
        Route::post('/{recipe}/apply/{tn?}', [\App\Http\Controllers\TnRecipeController::class, 'apply'])->name('apply');
        Route::post('/scan-all', [\App\Http\Controllers\TnRecipeController::class, 'scanAllPatterns'])->name('scan-all');
        Route::post('/scan/{tn}', [\App\Http\Controllers\TnRecipeController::class, 'scanFromDevice'])->name('scan');
    });

    // === TN Controllers ===
    Route::prefix('tn')->group(function () {
        // CRUD
        Route::get('/', [\App\Http\Controllers\TnControllerController::class, 'index'])->name('tn.index');
        Route::match(['get', 'post'], '/quick-start/{model}', [\App\Http\Controllers\TnControllerController::class, 'quickStart'])->name('tn.quick-start');
        Route::get('/{tn}', [\App\Http\Controllers\TnControllerController::class, 'show'])->name('tn.show');
        Route::delete('/{tn}', [\App\Http\Controllers\TnControllerController::class, 'destroy'])->name('tn.destroy');
        Route::post('/{tn}/test', [\App\Http\Controllers\TnControllerController::class, 'testConnection'])->name('tn.test');

        // Monitor & Control
        Route::get('/{tn}/monitor', [\App\Http\Controllers\TnMonitorController::class, 'show'])->name('tn.monitor');
        Route::post('/{tn}/cmd/run-stop', [\App\Http\Controllers\TnMonitorController::class, 'toggleRunStop'])->name('tn.cmd.runstop');
        Route::post('/{tn}/cmd/set-sv', [\App\Http\Controllers\TnMonitorController::class, 'setSv'])->name('tn.cmd.setsv');
        Route::post('/{tn}/cmd/auto-tune', [\App\Http\Controllers\TnMonitorController::class, 'startAutoTune'])->name('tn.cmd.autotune');
        Route::post('/{tn}/cmd/alarm-reset', [\App\Http\Controllers\TnMonitorController::class, 'resetAlarm'])->name('tn.cmd.alarmreset');
        Route::post('/{tn}/cmd/set-mode', [\App\Http\Controllers\TnMonitorController::class, 'setMode'])->name('tn.cmd.setmode');
        Route::get('/{tn}/readings', [\App\Http\Controllers\TnMonitorController::class, 'readings'])->name('tn.readings');
        Route::post('/{tn}/history', [\App\Http\Controllers\TnMonitorController::class, 'saveHistory'])->name('tn.history.save');
        Route::delete('/history/{history}', [\App\Http\Controllers\TnMonitorController::class, 'destroyHistory'])->name('tn.history.destroy');
        Route::post('/history/{history}/verify', [\App\Http\Controllers\TnMonitorController::class, 'verifyHistory'])->name('tn.history.verify');
        Route::put('/history-groups/{group}', [\App\Http\Controllers\TnMonitorController::class, 'updateHistoryGroup'])->name('tn.history-groups.update');
        Route::post('/{tn}/ingest-reading', [\App\Http\Controllers\TnMonitorController::class, 'ingestReading'])->name('tn.ingest-reading');
        // Port Management
        Route::get('/{tn}/port/list', [\App\Http\Controllers\TnPortController::class, 'list'])->name('tn.port.list');
        Route::post('/{tn}/port/scan', [\App\Http\Controllers\TnPortController::class, 'scan'])->name('tn.port.scan');
        Route::post('/{tn}/port/test', [\App\Http\Controllers\TnPortController::class, 'test'])->name('tn.port.test');
        Route::post('/{tn}/port/toggle-pin', [\App\Http\Controllers\TnPortController::class, 'togglePin'])->name('tn.port.toggle-pin');
        Route::post('/{tn}/port/select', [\App\Http\Controllers\TnPortController::class, 'select'])->name('tn.port.select');
        Route::get('/{tn}/port/status', [\App\Http\Controllers\TnPortController::class, 'status'])->name('tn.port.status');
    });

    // === ESP32 Monitoring Logger ===
    Route::prefix('esp')->group(function () {
        Route::get('/status', [\App\Http\Controllers\EspMonitorController::class, 'status'])->name('esp.status');
        Route::get('/monitor', [\App\Http\Controllers\EspMonitorController::class, 'index'])->name('esp.monitor');
        Route::post('/pattern', [\App\Http\Controllers\EspMonitorController::class, 'savePattern'])->name('esp.pattern.save');
        Route::get('/live', [\App\Http\Controllers\EspMonitorController::class, 'liveData'])->name('esp.live');
        Route::get('/stream', [\App\Http\Controllers\EspMonitorController::class, 'stream'])->name('esp.stream');
    });

    // SCADA POV
    Route::prefix('tn')->group(function () {
        Route::get('/{tn}/scada/edit', [\App\Http\Controllers\ScadaController::class, 'edit'])->name('tn.scada.edit');
        Route::post('/{tn}/scada/save', [\App\Http\Controllers\ScadaController::class, 'save'])->name('tn.scada.save');
        Route::post('/{tn}/scada/canvas', [\App\Http\Controllers\ScadaController::class, 'updateCanvas'])->name('tn.scada.canvas');
        Route::post('/{tn}/scada/mappings', [\App\Http\Controllers\ScadaController::class, 'saveMappings'])->name('tn.scada.mappings');
        Route::post('/{tn}/scada/upload-bg', [\App\Http\Controllers\ScadaController::class, 'uploadBackground'])->name('tn.scada.upload-bg');
    });

});

require __DIR__.'/auth.php';
require __DIR__.'/installer.php';
