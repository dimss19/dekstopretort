<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Web Installer') - Indah Mesin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
        }
    </style>
</head>
<body class="text-slate-100 flex items-center justify-center p-4">

    <div class="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 px-6 py-5 text-center">
            <div class="inline-flex items-center justify-center w-11 h-11 bg-white/10 rounded-xl mb-2.5 backdrop-blur-sm border border-white/20">
                <i class="fa-solid fa-cube text-xl text-white"></i>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">Indah Mesin Software Installer</h1>
            <p class="text-blue-100 text-xs sm:text-sm mt-0.5">Panduan Instalasi Mandiri & Verifikasi Kode Perusahaan</p>
        </div>

        <!-- 7-Step Stepper Indicator -->
        <div class="bg-slate-950/70 px-4 sm:px-6 py-3.5 border-b border-slate-800">
            <div class="flex items-center justify-between text-xs">
                @php
                    $steps = [
                        1 => ['title' => 'Welcome', 'icon' => 'fa-door-open'],
                        2 => ['title' => 'Syarat', 'icon' => 'fa-list-check'],
                        3 => ['title' => 'Lisensi', 'icon' => 'fa-key'],
                        4 => ['title' => 'Database', 'icon' => 'fa-database'],
                        5 => ['title' => 'App Config', 'icon' => 'fa-sliders'],
                        6 => ['title' => 'Install', 'icon' => 'fa-play'],
                        7 => ['title' => 'Selesai', 'icon' => 'fa-circle-check'],
                    ];
                    $currentStep = $step ?? 1;
                @endphp

                @foreach($steps as $sNum => $sData)
                    <div class="flex items-center space-x-1.5 {{ $currentStep >= $sNum ? 'text-blue-400 font-semibold' : 'text-slate-500' }}">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center border text-[11px] {{ $currentStep >= $sNum ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'border-slate-800 text-slate-500 bg-slate-900' }}">
                            {{ $sNum }}
                        </div>
                        <span class="hidden md:inline text-[11px]">{{ $sData['title'] }}</span>
                    </div>
                    @if(!$loop->last)
                        <div class="flex-1 h-[2px] mx-1 sm:mx-1.5 {{ $currentStep > $sNum ? 'bg-blue-500' : 'bg-slate-800' }}"></div>
                    @endif
                @endforeach
            </div>
        </div>

        <!-- Content Body -->
        <div class="p-6 sm:p-8">
            @if(session('success'))
                <div class="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center space-x-3">
                    <i class="fa-solid fa-circle-check text-lg"></i>
                    <span>{{ session('success') }}</span>
                </div>
            @endif

            @if($errors->any())
                <div class="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
                    <div class="flex items-center space-x-3 mb-2 font-semibold">
                        <i class="fa-solid fa-triangle-exclamation text-lg"></i>
                        <span>Terjadi Kesalahan:</span>
                    </div>
                    <ul class="list-disc pl-8 space-y-1">
                        @foreach($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            @yield('content')
        </div>

        <!-- Footer -->
        <div class="bg-slate-950/40 px-6 py-4 border-t border-slate-800 text-center text-xs text-slate-500">
            &copy; {{ date('Y') }} PT Indah Mesin. CodeCanyon Standard 7-Step Web Installer.
        </div>
    </div>

</body>
</html>
