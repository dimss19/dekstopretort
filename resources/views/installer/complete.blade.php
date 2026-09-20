@extends('installer.layout', ['step' => 7])

@section('title', 'Instalasi Selesai')

@section('content')
    <div class="text-center py-4 space-y-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <i class="fa-solid fa-circle-check text-3xl"></i>
        </div>

        <div>
            <h2 class="text-2xl font-bold text-white mb-2">Selamat! Instalasi Selesai</h2>
            <p class="text-sm text-slate-400 max-w-md mx-auto">
                Aplikasi SCADA Retort telah berhasil dipasang secara lokal. Kunci enkripsi dibuat, database telah termigrasi, dan akun admin siap digunakan.
            </p>
        </div>

        <!-- License Summary Card -->
        @if(!empty($license))
            <div class="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-left max-w-md mx-auto text-xs space-y-2">
                <div class="font-semibold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>Detail Lisensi Perusahaan:</span>
                    <span class="text-emerald-400 font-normal">Active & Verified</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Perusahaan:</span>
                    <span class="text-white font-medium">{{ $license['company_name'] ?? 'Klien Indah Mesin' }}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Kode Perusahaan:</span>
                    <span class="text-white font-mono font-medium">{{ $license['company_code'] ?? '-' }}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Masa Aktif:</span>
                    <span class="text-white font-medium">{{ $license['expires_at'] ?? 'Lifetime' }}</span>
                </div>
            </div>
        @endif

        <!-- Hardware Driver Reminder Card -->
        <div class="p-4 bg-slate-950/60 rounded-xl border border-cyan-500/30 text-left max-w-md mx-auto text-xs space-y-2.5">
            <div class="font-bold text-cyan-300 flex items-center gap-1.5">
                <i class="fa-solid fa-microchip"></i>
                <span>Driver Converter USB-to-RS485 (CH340/CH341):</span>
            </div>
            <p class="text-slate-300 text-[11px] leading-relaxed">
                Pastikan driver converter kabel USB sudah terpasang di PC ini agar temperatur & tekanan Autonics dapat terbaca di SCADA.
            </p>
            <div class="bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono text-[10px] text-cyan-300">
                Folder: drivers/install_driver_ch340.bat
            </div>
        </div>

        <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 max-w-md mx-auto">
            <i class="fa-solid fa-lock mr-1"></i> Rute installer ini telah otomatis dikunci demi keamanan sistem (file penanda <code>storage/installed</code> telah dibuat).
        </div>

        <!-- Launch Button -->
        <div class="pt-4">
            <a href="{{ url('/') }}" class="inline-flex items-center px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-600/30 transition space-x-2">
                <span>Buka Dashboard SCADA</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            </a>
        </div>
    </div>
@endsection
