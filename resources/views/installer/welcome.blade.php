@extends('installer.layout', ['step' => 1])

@section('title', 'Setup Akun Administrator')

@section('content')
    <form action="{{ route('installer.process-setup') }}" method="POST" class="space-y-5">
        @csrf

        <div class="text-left">
            <h2 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <i class="fa-solid fa-user-shield text-blue-400"></i>
                <span>Langkah 1: Setup Akun Administrator</span>
            </h2>
            <p class="text-xs sm:text-sm text-slate-400">
                Aplikasi desktop ini berjalan mandiri. Buat akun administrator utama untuk mengelola resep sterilisasi dan monitoring SCADA.
            </p>
        </div>

        <!-- Integrated Info Banner -->
        <div class="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/25 text-xs text-slate-300 space-y-1.5">
            <div class="font-semibold text-blue-300 flex items-center gap-2">
                <i class="fa-solid fa-circle-check text-emerald-400"></i>
                <span>Komponen Sistem Siap Pakai (Plug & Play):</span>
            </div>
            <ul class="space-y-1 text-slate-400 pl-5 list-disc text-[11px]">
                <li><strong class="text-slate-200">Runtime PHP 8.3 & Dependensi:</strong> Sudah terintegrasi langsung di dalam aplikasi (tidak perlu install PHP, Composer, atau Node.js).</li>
                <li><strong class="text-slate-200">Database Lokal SQLite:</strong> Dikonfigurasi otomatis tanpa memerlukan instalasi server database (MySQL/PostgreSQL) terpisah.</li>
            </ul>
        </div>

        <!-- Form Fields -->
        <div class="space-y-4">
            <div>
                <label for="admin_name" class="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Administrator / Operator <span class="text-rose-400">*</span>
                </label>
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <input type="text" name="admin_name" id="admin_name" required
                        value="{{ old('admin_name', 'Administrator') }}"
                        placeholder="Contoh: Administrator Retort"
                        class="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
            </div>

            <div>
                <label for="admin_email" class="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Administrator (Untuk Login) <span class="text-rose-400">*</span>
                </label>
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                        <i class="fa-solid fa-envelope"></i>
                    </div>
                    <input type="email" name="admin_email" id="admin_email" required
                        value="{{ old('admin_email', 'admin@scadaretort.local') }}"
                        placeholder="Contoh: admin@scadaretort.local"
                        class="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                    <label for="admin_password" class="block text-xs font-semibold text-slate-300 mb-1.5">
                        Password <span class="text-rose-400">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <input type="password" name="admin_password" id="admin_password" required minlength="6"
                            placeholder="Minimal 6 karakter"
                            class="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                </div>

                <div>
                    <label for="admin_password_confirmation" class="block text-xs font-semibold text-slate-300 mb-1.5">
                        Konfirmasi Password <span class="text-rose-400">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                            <i class="fa-solid fa-lock-check"></i>
                        </div>
                        <input type="password" name="admin_password_confirmation" id="admin_password_confirmation" required minlength="6"
                            placeholder="Ketik ulang password"
                            class="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                </div>
            </div>
        </div>

        <!-- Action Button -->
        <div class="pt-4 flex items-center justify-end border-t border-slate-800">
            <button type="submit"
                class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-blue-600/30">
                <span>Inisialisasi & Lanjut ke Aktivasi Lisensi</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </button>
        </div>
    </form>
@endsection
