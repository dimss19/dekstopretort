@extends('installer.layout', ['step' => 3])

@section('title', 'Verifikasi Kode Perusahaan')

@section('content')
    <form action="{{ route('installer.verify-license') }}" method="POST" class="space-y-6">
        @csrf

        <div>
            <h2 class="text-lg font-bold text-white mb-1">Langkah 3: Lisensi Perusahaan (Purchase Code)</h2>
            <p class="text-sm text-slate-400">Masukkan <strong>Kode Perusahaan</strong> resmi yang diterbitkan oleh PT Indah Mesin sebagai kunci lisensi pembelian.</p>
        </div>

        <!-- Quick Demo Codes Box -->
        <div class="bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
            <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-amber-300 flex items-center gap-1.5">
                    <i class="fa-solid fa-key text-amber-400"></i>
                    <span>Kode Demo / Uji Coba Cepat (Klik untuk Mengisi):</span>
                </span>
                <span class="text-slate-500">Siap pakai</span>
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

        <div class="space-y-3">
            <label for="company_code" class="block text-sm font-medium text-slate-300">
                Kode Perusahaan / Purchase Code <span class="text-rose-500">*</span>
            </label>
            <div class="relative rounded-xl shadow-sm">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <i class="fa-solid fa-building-shield"></i>
                </div>
                <input type="text" name="company_code" id="company_code" required
                    value="{{ old('company_code', $activeLicense['company_code'] ?? '') }}"
                    placeholder="Contoh: IM-CORP-77A1-88B2-99C3"
                    class="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono tracking-wider text-sm">
            </div>
            <p class="text-xs text-slate-500">
                Kode lisensi divalidasi ke Central Licensing Server (<code class="text-blue-300">license.indahmesin.com</code>).
            </p>
        </div>

        <!-- Info Box -->
        <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
            <div class="font-semibold flex items-center space-x-1.5">
                <i class="fa-solid fa-circle-info"></i>
                <span>Informasi Lisensi Online & Offline:</span>
            </div>
            <p>Untuk aktivasi lisensi resmi perusahaan Anda, pastikan PC memiliki koneksi internet. Jika komputer pabrik sedang offline, Anda dapat menggunakan salah satu <strong>Kode Demo</strong> di atas.</p>
        </div>

        <!-- Buttons -->
        <div class="pt-4 flex items-center justify-between border-t border-slate-800">
            <a href="{{ route('installer.requirements') }}" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition flex items-center space-x-2">
                <i class="fa-solid fa-arrow-left text-xs"></i>
                <span>Kembali</span>
            </a>
            <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition flex items-center space-x-2 shadow-lg shadow-blue-900/30">
                <span>Verifikasi & Lanjut</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </button>
        </div>
    </form>

    <script>
        function fillCode(code) {
            const input = document.getElementById('company_code');
            input.value = code;
            input.focus();
        }
    </script>
@endsection
