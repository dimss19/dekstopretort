<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Setup & Aktivasi') - SCADA Retort PT Indah Mesin</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            background: linear-gradient(135deg, #090d16 0%, #111827 50%, #0f172a 100%);
            min-height: 100vh;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
    </style>
</head>
<body class="text-slate-100 flex items-center justify-center p-4">

    <div class="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 backdrop-blur-md">
        
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 px-6 py-5 text-center relative overflow-hidden border-b border-blue-500/20">
            <div class="flex items-center justify-center gap-3 mb-2">
                <img src="/icon.png" alt="PT Indah Mesin Logo" class="w-10 h-10 object-contain drop-shadow">
                <div class="text-left">
                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">SCADA Retort</h1>
                    <p class="text-blue-200 text-xs font-medium">PT Indah Mesin — Desktop Control System</p>
                </div>
            </div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px]">
                <i class="fa-solid fa-bolt text-amber-400"></i>
                <span>Runtime PHP 8.3 & Database SQLite Siap Pakai (Standalone)</span>
            </div>
        </div>

        <!-- 3-Step Stepper Indicator -->
        <div class="bg-slate-950/80 px-6 py-3.5 border-b border-slate-800">
            <div class="flex items-center justify-between text-xs max-w-lg mx-auto">
                @php
                    $steps = [
                        1 => ['title' => 'Setup Akun', 'icon' => 'fa-user-shield'],
                        2 => ['title' => 'Aktivasi Lisensi', 'icon' => 'fa-key'],
                        3 => ['title' => 'Selesai', 'icon' => 'fa-circle-check'],
                    ];
                    $currentStep = $step ?? 1;
                @endphp

                @foreach($steps as $sNum => $sData)
                    <div class="flex items-center space-x-2 {{ $currentStep >= $sNum ? 'text-blue-400 font-semibold' : 'text-slate-500' }}">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center border text-xs transition {{ $currentStep >= $sNum ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-600/40' : 'border-slate-800 text-slate-500 bg-slate-900' }}">
                            <i class="fa-solid {{ $sData['icon'] }} text-[11px]"></i>
                        </div>
                        <span class="text-xs">{{ $sData['title'] }}</span>
                    </div>
                    @if(!$loop->last)
                        <div class="flex-1 h-[2px] mx-3 {{ $currentStep > $sNum ? 'bg-blue-500' : 'bg-slate-800' }}"></div>
                    @endif
                @endforeach
            </div>
        </div>

        <!-- Content Body -->
        <div class="p-6 sm:p-8">
            @if(session('success'))
                <div class="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm flex items-center space-x-2.5">
                    <i class="fa-solid fa-circle-check text-base"></i>
                    <span>{{ session('success') }}</span>
                </div>
            @endif

            @if($errors->any())
                <div class="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm">
                    <div class="flex items-center space-x-2 mb-1.5 font-semibold">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Perhatian:</span>
                    </div>
                    <ul class="list-disc pl-6 space-y-0.5">
                        @foreach($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            @yield('content')
        </div>

        <!-- Footer -->
        <div class="bg-slate-950/60 px-6 py-3.5 border-t border-slate-800 text-center text-[11px] text-slate-500">
            &copy; {{ date('Y') }} PT Indah Mesin. Sistem SCADA Retort Terintegrasi.
        </div>
    </div>

</body>
</html>
