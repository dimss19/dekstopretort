@extends('installer.layout', ['step' => 3])

@section('title', 'Aktivasi Berhasil')

@section('content')
    <div class="text-center py-2 space-y-5">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <i class="fa-solid fa-circle-check text-3xl"></i>
        </div>

        <div>
            <h2 class="text-xl font-bold text-white mb-1">Aplikasi SCADA Retort Siap Digunakan</h2>
            <p class="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                Konfigurasi akun dan aktivasi lisensi telah berhasil. Sistem siap memonitor proses sterilisasi retort secara realtime.
            </p>
        </div>

        <!-- License Summary Card -->
        @if(!empty($license))
            <div class="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-left max-w-md mx-auto text-xs space-y-2">
                <div class="font-semibold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span class="flex items-center gap-1.5">
                        <i class="fa-solid fa-shield-halved text-emerald-400"></i>
                        <span>Status Lisensi:</span>
                    </span>
                    <span class="text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px]">Aktif & Terverifikasi</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Perusahaan:</span>
                    <span class="text-white font-medium">{{ $license['company_name'] ?? 'Klien PT Indah Mesin' }}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Kode Lisensi:</span>
                    <span class="text-amber-300 font-mono font-medium">{{ $license['company_code'] ?? '-' }}</span>
                </div>
                <div class="flex justify-between text-slate-400">
                    <span>Masa Berlaku:</span>
                    <span class="text-white font-medium">{{ $license['expires_at'] ?? 'Lifetime' }}</span>
                </div>
            </div>
        @endif

        <!-- Hardware Driver Reminder Card -->
        <div class="p-3.5 bg-slate-950/70 rounded-xl border border-blue-500/30 text-left max-w-md mx-auto text-xs space-y-1.5">
            <div class="font-semibold text-blue-300 flex items-center gap-1.5">
                <i class="fa-solid fa-microchip text-blue-400"></i>
                <span>Driver Converter USB-RS485 Autonics:</span>
            </div>
            <p class="text-slate-400 text-[11px] leading-relaxed">
                Jika Anda menghubungkan kabel converter USB-RS485 (CH340/CH341) pertama kali di komputer ini, jalankan installer driver satu kali:
            </p>
            <div class="bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 flex items-center justify-between">
                <span>drivers/install_driver_ch340.bat</span>
            </div>
        </div>

        <!-- Launch Button -->
        <div class="pt-3">
            <a href="{{ url('/') }}"
                class="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-600/30 transition gap-2">
                <span>Buka Dashboard SCADA Retort</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
        </div>
    </div>
@endsection
