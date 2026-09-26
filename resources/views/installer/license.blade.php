@extends('installer.layout', ['step' => 2])

@section('title', 'Aktivasi Lisensi Perusahaan')

@section('content')
    <form action="{{ route('installer.verify-license') }}" method="POST" class="space-y-5">
        @csrf

        <div class="text-left">
            <h2 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <i class="fa-solid fa-key text-amber-400"></i>
                <span>Langkah 2: Aktivasi Lisensi Perusahaan</span>
            </h2>
            <p class="text-xs sm:text-sm text-slate-400">
                Tahap akhir instalasi: Masukkan <strong>Kode Perusahaan (Purchase Code)</strong> resmi yang diterbitkan oleh PT Indah Mesin untuk mengaktifkan fitur SCADA Retort.
            </p>
        </div>

        <!-- Quick Demo Codes Box -->
        <div class="bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
            <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-amber-300 flex items-center gap-1.5">
                    <i class="fa-solid fa-bolt text-amber-400"></i>
                    <span>Kode Demo / Aktivasi Cepat (Klik untuk Mengisi):</span>
                </span>
                <span class="text-slate-500 text-[10px]">Siap pakai (Offline / Online)</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button type="button" onclick="fillCode('IM-CORP-77A1-88B2-99C3')"
                    class="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left rounded-lg transition flex items-center justify-between group">
                    <div>
                        <div class="font-mono font-bold text-emerald-400 text-xs">IM-CORP-77A1-88B2-99C3</div>
                        <div class="text-[10px] text-slate-400">PT Indah Pangan Makmur (Lifetime)</div>
                    </div>
                    <i class="fa-solid fa-arrow-turn-down text-slate-600 group-hover:text-amber-400 transition text-xs"></i>
                </button>
                <button type="button" onclick="fillCode('IM-CORP-44D4-55E5-66F6')"
                    class="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left rounded-lg transition flex items-center justify-between group">
                    <div>
                        <div class="font-mono font-bold text-blue-400 text-xs">IM-CORP-44D4-55E5-66F6</div>
                        <div class="text-[10px] text-slate-400">CV Agro Mesin Nusantara (Exp: 2027)</div>
                    </div>
                    <i class="fa-solid fa-arrow-turn-down text-slate-600 group-hover:text-amber-400 transition text-xs"></i>
                </button>
            </div>
        </div>

        <div class="space-y-2">
            <label for="company_code" class="block text-xs font-semibold text-slate-300">
                Kode Perusahaan / Purchase Code <span class="text-rose-400">*</span>
            </label>
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <i class="fa-solid fa-building-shield"></i>
                </div>
                <input type="text" name="company_code" id="company_code" required
                    value="{{ old('company_code', $activeLicense['company_code'] ?? '') }}"
                    placeholder="Contoh: IM-CORP-77A1-88B2-99C3"
                    class="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 uppercase font-mono tracking-wider text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent">
            </div>
            <p class="text-[11px] text-slate-500">
                Mendukung verifikasi lisensi langsung ke Licensing Server maupun kode offline pabrik.
            </p>
        </div>

        <!-- Buttons -->
        <div class="pt-4 flex items-center justify-between border-t border-slate-800">
            <a href="{{ route('installer.welcome') }}"
                class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs sm:text-sm transition flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-left text-xs"></i>
                <span>Kembali</span>
            </a>
            <button type="submit"
                class="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shadow-amber-600/30">
                <i class="fa-solid fa-shield-check"></i>
                <span>Aktivasi & Masuk ke Aplikasi</span>
            </button>
        </div>
    </form>

    <script>
        function fillCode(code) {
            document.getElementById('company_code').value = code;
        }
    </script>
@endsection
