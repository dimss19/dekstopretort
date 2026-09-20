@extends('installer.layout', ['step' => 4])

@section('title', 'Konfigurasi Database')

@section('content')
    <form action="{{ route('installer.save-database') }}" method="POST" class="space-y-6" id="db-form">
        @csrf

        <div>
            <h2 class="text-lg font-bold text-white mb-1">Langkah 4: Konfigurasi Database</h2>
            <p class="text-sm text-slate-400">Pilih jenis database untuk penyimpanan data monitoring & batch SCADA Retort.</p>
        </div>

        <!-- Quick Preset Buttons -->
        <div class="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-300 flex items-center gap-1.5">
                    <i class="fa-solid fa-wand-magic-sparkles text-amber-400"></i>
                    <span>Preset Cepat (Pilih Salah Satu):</span>
                </span>
                <span class="text-slate-500">Klik untuk isi otomatis</span>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
                <button type="button" onclick="applyPreset('sqlite')" class="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 rounded-lg transition font-medium flex items-center gap-1.5 shadow-sm">
                    <i class="fa-solid fa-bolt text-amber-400"></i> SQLite (1-Klik Otomatis)
                </button>
                <button type="button" onclick="applyPreset('xampp')" class="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-blue-300 rounded-lg transition flex items-center gap-1">
                    <i class="fa-brands fa-windows text-[11px]"></i> MySQL (XAMPP 3306)
                </button>
                <button type="button" onclick="applyPreset('herd')" class="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-purple-300 rounded-lg transition flex items-center gap-1">
                    <i class="fa-brands fa-apple text-[11px]"></i> MySQL (Herd/Valet)
                </button>
            </div>
        </div>

        <!-- Connection Type Radio Cards -->
        <div>
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pilih Tipe Database Engine</label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <!-- Option 1: SQLite (Recommended) -->
                <label class="flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition relative" id="card_sqlite" onclick="switchEngine('sqlite')">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-2">
                            <input type="radio" name="db_connection" id="radio_sqlite" value="sqlite" class="text-emerald-500 focus:ring-emerald-500" {{ old('db_connection', $defaultConfig['connection']) == 'sqlite' ? 'checked' : '' }}>
                            <span class="text-sm font-bold text-white">SQLite</span>
                        </div>
                        <span class="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">Rekomendasi</span>
                    </div>
                    <p class="text-[11px] text-slate-400 leading-relaxed">Tanpa perlu install/menjalankan MySQL. Sangat praktis untuk PC lokal.</p>
                </label>

                <!-- Option 2: MySQL -->
                <label class="flex flex-col p-3.5 rounded-xl border cursor-pointer transition relative" id="card_mysql" onclick="switchEngine('mysql')">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-2">
                            <input type="radio" name="db_connection" id="radio_mysql" value="mysql" class="text-blue-600 focus:ring-blue-500" {{ old('db_connection', $defaultConfig['connection']) == 'mysql' ? 'checked' : '' }}>
                            <span class="text-sm font-bold text-white">MySQL / MariaDB</span>
                        </div>
                    </div>
                    <p class="text-[11px] text-slate-400 leading-relaxed">Untuk server jaringan terpusat (Port 3306).</p>
                </label>

                <!-- Option 3: PostgreSQL -->
                <label class="flex flex-col p-3.5 rounded-xl border cursor-pointer transition relative" id="card_pgsql" onclick="switchEngine('pgsql')">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-2">
                            <input type="radio" name="db_connection" id="radio_pgsql" value="pgsql" class="text-purple-600 focus:ring-purple-500" {{ old('db_connection', $defaultConfig['connection']) == 'pgsql' ? 'checked' : '' }}>
                            <span class="text-sm font-bold text-white">PostgreSQL</span>
                        </div>
                    </div>
                    <p class="text-[11px] text-slate-400 leading-relaxed">Untuk database enterprise PostgreSQL (Port 5432).</p>
                </label>
            </div>
        </div>

        <!-- SQLite Information Box (Shown when SQLite selected) -->
        <div id="sqlite-info-box" class="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-xs space-y-2">
            <div class="flex items-center gap-2 text-emerald-400 font-bold">
                <i class="fa-solid fa-circle-check text-sm"></i>
                <span>Database SQLite Siap Digunakan Secara Otomatis</span>
            </div>
            <p class="text-slate-300 leading-relaxed">
                Database akan otomatis tersimpan dalam file: <code class="bg-slate-950 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500/30 font-mono">database/database.sqlite</code>.
                Anda tidak perlu menginput Host, Port, Username, ataupun Password!
            </p>
        </div>

        <!-- Client/Server DB Fields (Host, Port, Database, User, Pass) -->
        <div id="server-db-fields" class="space-y-4 hidden">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="sm:col-span-2 space-y-1">
                    <label class="block text-xs font-medium text-slate-300">DB_HOST</label>
                    <input type="text" name="db_host" id="db_host" value="{{ old('db_host', $defaultConfig['host']) }}"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">DB_PORT</label>
                    <input type="text" name="db_port" id="db_port" value="{{ old('db_port', $defaultConfig['port']) }}"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono">
                </div>
            </div>

            <div class="space-y-1">
                <label class="block text-xs font-medium text-slate-300">DB_DATABASE (Nama Database)</label>
                <input type="text" name="db_name" id="db_name" value="{{ old('db_name', $defaultConfig['database']) }}"
                    class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <p class="text-[11px] text-slate-500">Pastikan database ini sudah Anda buat sebelumnya di phpMyAdmin atau terminal (misal: <code>CREATE DATABASE scada;</code>).</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">DB_USERNAME</label>
                    <input type="text" name="db_user" id="db_user" value="{{ old('db_user', $defaultConfig['username']) }}"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>
                <div class="space-y-1">
                    <label class="block text-xs font-medium text-slate-300">DB_PASSWORD</label>
                    <input type="password" name="db_pass" id="db_pass" value="{{ old('db_pass', $defaultConfig['password']) }}"
                        placeholder="Kosongkan jika default root tanpa password"
                        class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>
            </div>
        </div>

        <!-- Connection Test Result Box -->
        <div id="test-result" class="hidden p-3.5 rounded-xl text-xs flex items-center space-x-2"></div>

        <!-- Buttons -->
        <div class="pt-4 flex items-center justify-between border-t border-slate-800">
            <div class="flex items-center space-x-2">
                <a href="{{ route('installer.license') }}" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition flex items-center space-x-1.5">
                    <i class="fa-solid fa-arrow-left text-xs"></i>
                    <span>Kembali</span>
                </a>
                <button type="button" onclick="testConnection()" id="btn-test"
                    class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-sm transition flex items-center space-x-2">
                    <i class="fa-solid fa-plug-circle-check text-xs"></i>
                    <span>Test Koneksi</span>
                </button>
            </div>

            <button type="submit" id="btn-submit"
                class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition flex items-center space-x-2 shadow-lg shadow-emerald-900/30">
                <span>Lanjut ke App Config</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
            </button>
        </div>
    </form>

    <script>
        function switchEngine(engine) {
            const sqliteBox = document.getElementById('sqlite-info-box');
            const serverFields = document.getElementById('server-db-fields');

            const cardSqlite = document.getElementById('card_sqlite');
            const cardMysql = document.getElementById('card_mysql');
            const cardPgsql = document.getElementById('card_pgsql');

            // Reset border styling
            [cardSqlite, cardMysql, cardPgsql].forEach(c => {
                c.className = "flex flex-col p-3.5 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer transition relative";
            });

            if (engine === 'sqlite') {
                document.getElementById('radio_sqlite').checked = true;
                cardSqlite.className = "flex flex-col p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-950/20 cursor-pointer transition relative";
                sqliteBox.classList.remove('hidden');
                serverFields.classList.add('hidden');
            } else {
                sqliteBox.classList.add('hidden');
                serverFields.classList.remove('hidden');

                if (engine === 'mysql') {
                    document.getElementById('radio_mysql').checked = true;
                    cardMysql.className = "flex flex-col p-3.5 rounded-xl border-2 border-blue-500 bg-blue-950/20 cursor-pointer transition relative";
                    document.getElementById('db_port').value = '3306';
                } else if (engine === 'pgsql') {
                    document.getElementById('radio_pgsql').checked = true;
                    cardPgsql.className = "flex flex-col p-3.5 rounded-xl border-2 border-purple-500 bg-purple-950/20 cursor-pointer transition relative";
                    document.getElementById('db_port').value = '5432';
                }
            }
        }

        function applyPreset(type) {
            if (type === 'sqlite') {
                switchEngine('sqlite');
                testConnection();
                return;
            }

            switchEngine('mysql');
            document.getElementById('db_host').value = '127.0.0.1';
            document.getElementById('db_name').value = 'scada';
            document.getElementById('db_port').value = '3306';
            document.getElementById('db_user').value = 'root';
            document.getElementById('db_pass').value = (type === 'mamp') ? 'root' : '';

            testConnection();
        }

        function testConnection() {
            const btn = document.getElementById('btn-test');
            const resultBox = document.getElementById('test-result');
            const conn = document.querySelector('input[name="db_connection"]:checked')?.value || 'sqlite';
            const host = document.getElementById('db_host').value;
            const port = document.getElementById('db_port').value;
            const name = document.getElementById('db_name').value;
            const user = document.getElementById('db_user').value;
            const pass = document.getElementById('db_pass').value;

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span> Menguji...</span>';
            resultBox.className = 'hidden';

            fetch("{{ route('installer.test-database') }}", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN": "{{ csrf_token() }}"
                },
                body: JSON.stringify({
                    db_connection: conn,
                    db_host: host,
                    db_port: port,
                    db_name: name,
                    db_user: user,
                    db_pass: pass
                })
            })
            .then(res => res.json())
            .then(data => {
                resultBox.classList.remove('hidden');
                if (data.success) {
                    resultBox.className = 'p-3.5 rounded-xl text-xs flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400';
                    resultBox.innerHTML = '<i class="fa-solid fa-circle-check text-sm"></i><span>' + data.message + '</span>';
                } else {
                    resultBox.className = 'p-3.5 rounded-xl text-xs flex items-center space-x-2 bg-rose-500/10 border border-rose-500/30 text-rose-400';
                    resultBox.innerHTML = '<i class="fa-solid fa-circle-xmark text-sm"></i><span>' + data.message + '</span>';
                }
            })
            .catch(err => {
                resultBox.classList.remove('hidden');
                resultBox.className = 'p-3.5 rounded-xl text-xs flex items-center space-x-2 bg-rose-500/10 border border-rose-500/30 text-rose-400';
                resultBox.innerHTML = '<i class="fa-solid fa-circle-xmark text-sm"></i><span>Gagal mengirim permintaan pengujian.</span>';
            })
            .finally(() => {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-plug-circle-check text-xs"></i><span> Test Koneksi</span>';
            });
        }

        // Init on page load
        document.addEventListener('DOMContentLoaded', function() {
            const currentConn = document.querySelector('input[name="db_connection"]:checked')?.value || 'sqlite';
            switchEngine(currentConn);
        });
    </script>
@endsection
