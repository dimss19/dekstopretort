@extends('installer.layout', ['step' => 2])

@section('title', 'Pemeriksaan Sistem')

@section('content')
    <div class="space-y-6">
        <div>
            <h2 class="text-lg font-bold text-white mb-1">Langkah 2: Pemeriksaan Persyaratan Sistem</h2>
            <p class="text-sm text-slate-400">Pastikan lingkungan server lokal Anda memenuhi ekstensi PHP dan izin direktori.</p>
        </div>

        <!-- PHP & Extensions -->
        <div class="space-y-2">
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ekstensi PHP</h3>
            <div class="bg-slate-950/40 rounded-xl border border-slate-800 divide-y divide-slate-800/60 overflow-hidden">
                @foreach($requirements as $req)
                    <div class="px-4 py-3 flex items-center justify-between text-sm">
                        <span class="text-slate-300">{{ $req['name'] }}</span>
                        @if($req['status'])
                            <span class="inline-flex items-center text-xs font-medium text-emerald-400">
                                <i class="fa-solid fa-check-circle mr-1.5"></i> Memenuhi
                            </span>
                        @else
                            <span class="inline-flex items-center text-xs font-medium text-rose-400">
                                <i class="fa-solid fa-times-circle mr-1.5"></i> Kurang
                            </span>
                        @endif
                    </div>
                @endforeach
            </div>
        </div>

        <!-- Folder Permissions -->
        <div class="space-y-2">
            <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Izin Tulis Direktori (Folder Writable)</h3>
            <div class="bg-slate-950/40 rounded-xl border border-slate-800 divide-y divide-slate-800/60 overflow-hidden">
                @foreach($permissions as $perm)
                    <div class="px-4 py-3 flex items-center justify-between text-sm">
                        <span class="text-slate-300 font-mono text-xs">{{ $perm['path'] }}</span>
                        @if($perm['status'])
                            <span class="inline-flex items-center text-xs font-medium text-emerald-400">
                                <i class="fa-solid fa-check-circle mr-1.5"></i> Writable
                            </span>
                        @else
                            <span class="inline-flex items-center text-xs font-medium text-rose-400">
                                <i class="fa-solid fa-times-circle mr-1.5"></i> Not Writable
                            </span>
                        @endif
                    </div>
                @endforeach
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="pt-4 flex items-center justify-between border-t border-slate-800">
            <a href="{{ route('installer.welcome') }}" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition flex items-center space-x-2">
                <i class="fa-solid fa-arrow-left text-xs"></i>
                <span>Kembali</span>
            </a>
            @if($allRequirementsMet)
                <a href="{{ route('installer.license') }}" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition flex items-center space-x-2">
                    <span>Lanjut ke Lisensi</span>
                    <i class="fa-solid fa-arrow-right text-xs"></i>
                </a>
            @else
                <button disabled class="px-6 py-2.5 bg-slate-800 text-slate-500 rounded-xl font-medium text-sm cursor-not-allowed">
                    Perbaiki Persyaratan untuk Lanjut
                </button>
            @endif
        </div>
    </div>
@endsection
