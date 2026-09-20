@extends('installer.layout', ['step' => 5])

@section('title', 'Konfigurasi Aplikasi')

@section('content')
    <form action="{{ route('installer.save-app-config') }}" method="POST" class="space-y-6">
        @csrf

        <div>
            <h2 class="text-lg font-bold text-white mb-1">Langkah 5: Application Configuration</h2>
            <p class="text-sm text-slate-400">Atur parameter dasar aplikasi dan kredensial akun Super Administrator lokal.</p>
        </div>

        <div class="space-y-4">
            <!-- App Details -->
            <div class="space-y-3 pb-3 border-b border-slate-800">
                <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pengaturan Web & URL</h3>
                
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">APP_NAME (Nama Aplikasi) <span class="text-rose-500">*</span></label>
                    <input type="text" name="app_name" id="app_name" required value="{{ old('app_name', $defaultAppName) }}"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">APP_URL (URL Akses Lokal) <span class="text-rose-500">*</span></label>
                    <input type="url" name="app_url" id="app_url" required value="{{ old('app_url', $defaultAppUrl) }}"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-xs">
                </div>
            </div>

            <!-- Admin Credentials -->
            <div class="space-y-3">
                <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Akun Super Administrator</h3>

                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">Nama Admin <span class="text-rose-500">*</span></label>
                    <input type="text" name="admin_name" id="admin_name" required value="{{ old('admin_name', 'Super Administrator') }}"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">Email Login Admin <span class="text-rose-500">*</span></label>
                    <input type="email" name="admin_email" id="admin_email" required value="{{ old('admin_email', 'admin@indahmesin.com') }}"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="block text-xs font-medium text-slate-300">Password Baru <span class="text-rose-500">*</span></label>
                        <input type="password" name="admin_password" id="admin_password" required minlength="8"
                            class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Minimal 8 karakter">
                    </div>
                    <div class="space-y-1">
                        <label class="block text-xs font-medium text-slate-300">Konfirmasi Password <span class="text-rose-500">*</span></label>
                        <input type="password" name="admin_password_confirmation" id="admin_password_confirmation" required minlength="8"
                            class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="Ulangi password">
                    </div>
                </div>
            </div>
        </div>

        <!-- Buttons -->
        <div class="pt-4 flex items-center justify-between border-t border-slate-800">
            <a href="{{ route('installer.database') }}" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition flex items-center space-x-2">
                <i class="fa-solid fa-arrow-left text-xs"></i>
                <span>Kembali</span>
            </a>
            <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition flex items-center space-x-2">
                <span>Lanjut ke Proses Eksekusi</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </button>
        </div>
    </form>
@endsection
