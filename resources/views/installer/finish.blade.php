@extends('installer.layout', ['step' => 5])

@section('title', 'Instalasi Berhasil')

@section('content')
    <div class="text-center py-4 space-y-6">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <i class="fa-solid fa-check text-3xl"></i>
        </div>

        <div>
            <h2 class="text-2xl font-bold text-white mb-2">Selamat! Instalasi Berhasil</h2>
            <p class="text-sm text-slate-400 max-w-md mx-auto">
                Aplikasi telah berhasil dikonfigurasi, skema database terpasang, dan lisensi perusahaan Anda telah aktif.
            </p>
        </div>

        <!-- License Summary Card -->
        @if(!empty($license))
            <div class="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-left max-w-md mx-auto text-xs space-y-2">
                <div class="font-semibold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>Detail Lisensi Aktif:</span>
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

        <div class="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 max-w-md mx-auto">
            <i class="fa-solid fa-lock mr-1"></i> Rute installer ini telah otomatis dikunci demi keamanan sistem.
        </div>

        <!-- Launch Button -->
        <div class="pt-4">
            <a href="{{ url('/') }}" class="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-500/20 transition space-x-2">
                <span>Buka Aplikasi Sekarang</span>
                <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            </a>
        </div>
    </div>
@endsection
