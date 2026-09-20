@extends('installer.layout', ['step' => 4])

@section('title', 'Pembuatan Akun Admin')

@section('content')
    <form action="{{ route('installer.create-admin') }}" method="POST" class="space-y-6">
        @csrf

        <div>
            <h2 class="text-lg font-bold text-white mb-1">Langkah 4: Pembuatan Akun Super Admin</h2>
            <p class="text-sm text-slate-400">Buat kredensial akun administrator pertama untuk mengelola sistem aplikasi ini.</p>
        </div>

        <div class="space-y-4">
            <div class="space-y-1">
                <label class="block text-xs font-medium text-slate-300">Nama Lengkap Admin <span class="text-rose-500">*</span></label>
                <input type="text" name="name" id="name" required value="{{ old('name', 'Super Administrator') }}"
                    class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>

            <div class="space-y-1">
                <label class="block text-xs font-medium text-slate-300">Alamat Email Login <span class="text-rose-500">*</span></label>
                <input type="email" name="email" id="email" required value="{{ old('email', 'admin@indahmesin.com') }}"
                    class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">Password Baru <span class="text-rose-500">*</span></label>
                    <input type="password" name="password" id="password" required minlength="8"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Minimal 8 karakter">
                </div>
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">Konfirmasi Password <span class="text-rose-500">*</span></label>
                    <input type="password" name="password_confirmation" id="password_confirmation" required minlength="8"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Ketik ulang password">
                </div>
            </div>
        </div>

        <div class="pt-4 flex justify-end border-t border-slate-800">
            <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition flex items-center space-x-2">
                <span>Simpan Admin & Selesaikan</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </button>
        </div>
    </form>
@endsection
