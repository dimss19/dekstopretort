@extends('installer.layout', ['step' => 1])

@section('title', 'Selamat Datang')

@section('content')
    <div class="space-y-6 text-center py-2">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <i class="fa-solid fa-hand-sparkles text-3xl"></i>
        </div>

        <div class="space-y-2">
            <h2 class="text-2xl font-bold text-white">Selamat Datang di Web Installer</h2>
            <p class="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                Wizard ini memandu Anda memasang sistem secara lokal di lingkungan <strong>Windows (XAMPP)</strong> maupun <strong>macOS</strong> dalam 7 langkah mudah.
            </p>
        </div>

        <!-- OS Specific Instructions Accordion / Tabs -->
        <div class="bg-slate-950/60 p-5 rounded-2xl border border-slate-800 text-left text-xs space-y-4 max-w-xl mx-auto">
            <div class="font-bold text-slate-200 flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span class="flex items-center gap-2 text-sm">
                    <i class="fa-solid fa-laptop-code text-blue-400"></i>
                    <span>Panduan Pengujian Lokal (OS)</span>
                </span>
                <span class="text-[11px] text-slate-500 font-normal">Pilih panduan sesuai OS Anda</span>
            </div>

            <!-- Tab Buttons -->
            <div class="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-center">
                <button type="button" onclick="switchOsTab('windows')" id="tab-btn-windows" class="py-1.5 px-3 rounded-lg font-medium transition bg-blue-600 text-white flex items-center justify-center gap-1.5">
                    <i class="fa-brands fa-windows"></i>
                    <span>Windows (XAMPP)</span>
                </button>
                <button type="button" onclick="switchOsTab('mac')" id="tab-btn-mac" class="py-1.5 px-3 rounded-lg font-medium transition text-slate-400 hover:text-white flex items-center justify-center gap-1.5">
                    <i class="fa-brands fa-apple"></i>
                    <span>macOS (Valet / MAMP)</span>
                </button>
            </div>

            <!-- Tab Content: Windows -->
            <div id="tab-content-windows" class="space-y-2 text-slate-300">
                <p class="font-semibold text-blue-300 flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-info"></i> Petunjuk untuk Windows (XAMPP):
                </p>
                <ol class="list-decimal pl-5 space-y-1.5 text-slate-400">
                    <li>Buka <strong>XAMPP Control Panel</strong>, klik <span class="text-emerald-400 font-semibold">Start</span> pada <em>Apache</em> dan <em>MySQL</em>.</li>
                    <li>Ekstrak folder proyek ke direktori <code class="text-blue-300 bg-slate-900 px-1 py-0.5 rounded">C:\xampp\htdocs\scada</code>.</li>
                    <li>Default database XAMPP: User: <code class="text-white">root</code>, Password: <em>(kosongkan)</em>, Port: <code class="text-white">3306</code>.</li>
                    <li>Jika ekstensi PHP kurang, aktifkan di file <code class="text-slate-300">php.ini</code> XAMPP: hilangkan tanda titik koma <code>;</code> pada <code>extension=pdo_mysql</code>, <code>extension=curl</code>, <code>extension=fileinfo</code>.</li>
                </ol>
            </div>

            <!-- Tab Content: macOS -->
            <div id="tab-content-mac" class="space-y-2 text-slate-300 hidden">
                <p class="font-semibold text-purple-300 flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-info"></i> Petunjuk untuk macOS (Terminal / Valet / MAMP):
                </p>
                <ol class="list-decimal pl-5 space-y-1.5 text-slate-400">
                    <li>Buka Terminal, masuk ke folder proyek dan berikan izin tulis folder:<br>
                        <code class="text-purple-300 bg-slate-900 px-2 py-0.5 rounded block my-1">chmod -R 775 storage bootstrap/cache</code>
                    </li>
                    <li>Jika menggunakan <strong>MAMP</strong>: Port default MySQL biasanya <code class="text-white">8889</code> dengan User: <code class="text-white">root</code>, Password: <code class="text-white">root</code>.</li>
                    <li>Jika menggunakan <strong>Laravel Herd / Valet</strong>: MySQL port <code class="text-white">3306</code>, User: <code class="text-white">root</code>, Password: <em>(kosongkan)</em>.</li>
                </ol>
            </div>
        </div>

        <div class="pt-2">
            <a href="{{ route('installer.requirements') }}" class="inline-flex items-center px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition space-x-2 shadow-lg shadow-blue-600/25">
                <span>Lanjut ke Pemeriksaan Sistem</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
        </div>
    </div>

    <script>
        function switchOsTab(os) {
            const btnWin = document.getElementById('tab-btn-windows');
            const btnMac = document.getElementById('tab-btn-mac');
            const contentWin = document.getElementById('tab-content-windows');
            const contentMac = document.getElementById('tab-content-mac');

            if (os === 'windows') {
                btnWin.className = 'py-1.5 px-3 rounded-lg font-medium transition bg-blue-600 text-white flex items-center justify-center gap-1.5';
                btnMac.className = 'py-1.5 px-3 rounded-lg font-medium transition text-slate-400 hover:text-white flex items-center justify-center gap-1.5';
                contentWin.classList.remove('hidden');
                contentMac.classList.add('hidden');
            } else {
                btnMac.className = 'py-1.5 px-3 rounded-lg font-medium transition bg-purple-600 text-white flex items-center justify-center gap-1.5';
                btnWin.className = 'py-1.5 px-3 rounded-lg font-medium transition text-slate-400 hover:text-white flex items-center justify-center gap-1.5';
                contentMac.classList.remove('hidden');
                contentWin.classList.add('hidden');
            }
        }
    </script>
@endsection
