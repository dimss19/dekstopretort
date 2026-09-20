@extends('installer.layout', ['step' => 6])

@section('title', 'Proses Instalasi')

@section('content')
    <div class="space-y-6">
        <div>
            <h2 class="text-lg font-bold text-white mb-1">Langkah 6: Eksekusi Instalasi</h2>
            <p class="text-sm text-slate-400">Sistem siap mengeksekusi konfigurasi ke mesin lokal Anda.</p>
        </div>

        <!-- Task Checklist Card -->
        <div class="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-3">
            <h3 class="text-xs font-semibold text-slate-300 uppercase tracking-wider">Tugas yang Akan Dijalankan:</h3>
            <ul class="space-y-2.5 text-xs text-slate-300 font-mono">
                <li class="flex items-center space-x-2.5" id="task-env">
                    <span class="text-blue-400"><i class="fa-solid fa-file-code"></i></span>
                    <span>1. Generate file konfigurasi .env</span>
                </li>
                <li class="flex items-center space-x-2.5" id="task-key">
                    <span class="text-blue-400"><i class="fa-solid fa-key"></i></span>
                    <span>2. Generate Application Encryption Key (APP_KEY)</span>
                </li>
                <li class="flex items-center space-x-2.5" id="task-mig">
                    <span class="text-blue-400"><i class="fa-solid fa-database"></i></span>
                    <span>3. Eksekusi migrasi skema tabel database (migrate)</span>
                </li>
                <li class="flex items-center space-x-2.5" id="task-seed">
                    <span class="text-blue-400"><i class="fa-solid fa-seedling"></i></span>
                    <span>4. Masukkan data referensi awal (seed database)</span>
                </li>
                <li class="flex items-center space-x-2.5" id="task-admin">
                    <span class="text-blue-400"><i class="fa-solid fa-user-shield"></i></span>
                    <span>5. Buat akun Super Administrator (create admin)</span>
                </li>
                <li class="flex items-center space-x-2.5" id="task-cache">
                    <span class="text-blue-400"><i class="fa-solid fa-shield-halved"></i></span>
                    <span>6. Cache konfigurasi & kunci rute installer (lock)</span>
                </li>
            </ul>
        </div>

        <!-- Installation Summary -->
        <div class="p-4 bg-slate-950/30 rounded-xl border border-slate-800 text-xs text-slate-400 grid grid-cols-2 gap-2">
            <div><strong>Database:</strong> <span class="text-slate-200">{{ $summary['db_connection'] }} ({{ $summary['db_name'] }})</span></div>
            <div><strong>Admin Email:</strong> <span class="text-slate-200">{{ $summary['admin_email'] }}</span></div>
            <div><strong>App Name:</strong> <span class="text-slate-200">{{ $summary['app_name'] }}</span></div>
            <div><strong>App URL:</strong> <span class="text-slate-200 font-mono">{{ $summary['app_url'] }}</span></div>
        </div>

        <!-- Status / Error Banner -->
        <div id="status-box" class="hidden p-4 rounded-xl text-xs space-y-2"></div>

        <!-- Buttons -->
        <div class="pt-4 flex items-center justify-between border-t border-slate-800">
            <a href="{{ route('installer.app-config') }}" id="btn-back" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition flex items-center space-x-2">
                <i class="fa-solid fa-arrow-left text-xs"></i>
                <span>Kembali</span>
            </a>
            <button type="button" onclick="startInstallation()" id="btn-install" class="px-7 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/20 transition flex items-center space-x-2">
                <i class="fa-solid fa-play text-xs"></i>
                <span>Jalankan Instalasi Sekarang</span>
            </button>
        </div>
    </div>

    <script>
        function startInstallation() {
            const btn = document.getElementById('btn-install');
            const btnBack = document.getElementById('btn-back');
            const statusBox = document.getElementById('status-box');

            btn.disabled = true;
            btnBack.classList.add('hidden');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i><span>Memproses Instalasi... Mohon tunggu</span>';

            statusBox.classList.remove('hidden');
            statusBox.className = 'p-4 rounded-xl text-xs bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center space-x-3';
            statusBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-lg"></i><span>Sedang mengeksekusi migrasi database dan konfigurasi sistem...</span>';

            fetch("{{ route('installer.process-install') }}", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": "{{ csrf_token() }}"
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    statusBox.className = 'p-4 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center space-x-3';
                    statusBox.innerHTML = '<i class="fa-solid fa-circle-check text-lg"></i><span>' + data.message + ' Mengalihkan ke halaman selesai...</span>';
                    setTimeout(() => {
                        window.location.href = "{{ route('installer.complete') }}";
                    }, 1500);
                } else {
                    throw new Error(data.message || 'Terjadi kesalahan tidak terduga.');
                }
            })
            .catch(err => {
                btn.disabled = false;
                btnBack.classList.remove('hidden');
                btn.innerHTML = '<i class="fa-solid fa-rotate-right text-xs"></i><span> Coba Lagi</span>';
                statusBox.className = 'p-4 rounded-xl text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 space-y-1';
                statusBox.innerHTML = '<div class="font-semibold flex items-center gap-2"><i class="fa-solid fa-circle-xmark text-sm"></i><span>Instalasi Gagal:</span></div><p>' + err.message + '</p>';
            });
        }
    </script>
@endsection
