# Desain: Label Verifikasi History + Form Batch Sterilisasi (Fase-1)

Tanggal: 2026-09-26
Status: Disetujui user (4 bagian, via brainstorming)

## 1. Latar & Temuan Lapangan

- Logger 1-detik sudah berjalan via `PollTnControllers` (`app/Console/Commands/PollTnControllers.php`):
  MV > 0 = buka `tn_process_histories` baru, MV = 0 = tutup (`end_time` + isi `log_data`).
  Endpoint manual `saveHistory` (`TnMonitorController`) tetap ada sebagai jalur kedua.
- F0 sistem sudah ada (`calculateF0` di `resources/js/Pages/Tn/retortTelemetry.ts`:
  Tref 121.11, z = 10, threshold >= 100 C, interval 1 detik).
- `EspMonitorController@index` membaca `TnProcessHistory` yang SAMA dengan historian TN.
  Jadi TN + ESP satu sumber data; yang duplikat hanya UI
  (`Pages/Operations.tsx` Historian vs tab history `Pages/Esp/Monitor.tsx`).
- Tabel `tn_process_histories` saat ini belum punya kolom status/verifikasi/group.

## 2. Keputusan Kunci (jawaban user)

1. F0 DIABAIKAN di fase-1; hanya disimpan sebagai catatan. Perbandingan F0 masuk fase-2.
2. Toleransi F0 fase-2: selisih absolut <= 0.01 setelah round 2 desimal (disetujui, belum dipakai).
3. 8 field verifikasi: SEMUA wajib, campuran text + dropdown.
4. Otorisasi: semua user boleh verifikasi; wajib catat `verified_by` + `verified_at`.
   Tanpa revert/edit di fase-1.
5. Group (2 grup custom): SKIP fase-1, jadi catatan fase-2.
6. Scope: historian DISATUKAN (satu komponen dipakai dua rute).
7. Status: `end_time` terisi = UNVERIFIED otomatis; `end_time` null = "Proses Berjalan".

## 3. Pendekatan Dipilih: A

Kolom verifikasi langsung di `tn_process_histories` (1 migration, 1 endpoint verify).
Ditolak: B (tabel terpisah = overkill untuk 1 verifikasi per batch),
C (JSON blob = tidak bisa query/filter, hutang teknis langsung).

## 4. Bagian 1 — Data & Aturan Status (DISETUJUI)

Migration tambah ke `tn_process_histories`:

- `verification_status` enum(`unverified`, `verified`), default `unverified`
- `product` string
- `batch_code` string unique
- `scheduled_process` string
- `min_f0_achieved` decimal(8,2) nullable (catatan fase-2, tanpa validasi)
- `target_f0` decimal(8,2) nullable (catatan fase-2, tanpa validasi)
- `process_deviation` enum(`None`, `Minor`, `Major`)
- `sterility_criterion` enum(`PASS`, `FAIL`)
- `thermal_record` enum(`VERIFIED`, `REJECTED`)
- `verified_by` string nullable, `verified_at` timestamp nullable

Aturan:

- `end_time = null` -> label "Proses Berjalan", tanpa badge verifikasi.
- `end_time` terisi (via poller MV tutup maupun `saveHistory`) -> `unverified` otomatis.
- Form verifikasi hanya jika selesai + `unverified`. Submit sukses ->
  `verified` + `verified_by` (nama user login) + `verified_at`.
- History lama (selesai sebelum migration): backfill `unverified` via default,
  tanpa fake `verified_by/at`.

## 5. Bagian 2 — Form Verifikasi (DISETUJUI)

- Tombol "Verifikasi Batch" di card history + dalam `ProcessDetailView`,
  visible hanya jika selesai + `unverified`. Klik -> modal.
- 8 field, semua `required`:
  text: Product (cth `Rendang pouch 250 g`), Batch (cth `20260926-01`, unique),
  Scheduled Process (cth `121.1°C / 25 min`);
  number 2 desimal: Minimum F0 (cth `5.21`), Target F0 (cth `4.50`, tampil `>= X.XX`);
  dropdown: Process deviation (`None` default/`Minor`/`Major`),
  Sterility criterion (`PASS`/`FAIL`), Thermal record (`VERIFIED`/`REJECTED`).
- Backend `POST /tn/history/{history}/verify` (sejajar route history existing): 422 jika masih berjalan atau sudah `verified`
  (idempotent guard). Sukses -> set `verified` + auditor.
- Frontend: badge card `UNVERIFIED` (amber) -> `VERIFIED` (emerald) via Inertia reload props.

## 6. Bagian 3 — Historian Disatukan + Badge/Filter (DISETUJUI)

- Ekstrak komponen shared `HistorianList` dari Historian `Operations.tsx`
  (filter periode + tanggal kustom + grid card + modal `ProcessDetailView`).
  Tab history `Esp/Monitor.tsx` memakai komponen yang sama; hapus duplikasi
  +-150 baris (filter + card + download handler kembar).
  Rute tetap dua (`/historian`, `/esp/monitor?tab=history`), satu komponen.
  Tanpa migrasi URL, bookmark aman.
- Badge per card: Proses Berjalan (amber pulse) / UNVERIFIED (amber solid) /
  VERIFIED (emerald + tooltip `by X, tanggal`).
- Filter toolbar baru: Semua / Verified / Unverified / Berjalan (client-side,
  gabung filter periode existing). Search `batch_code`/`product`
  (contains, case-insensitive), tanpa query baru.
- `ProcessDetailView`: header badge status + blok "Verifikasi Batch"
  (read-only jika verified, tombol verifikasi jika unverified).

## 7. Bagian 4 — Export + Audit (DISETUJUI)

- PDF/Excel/CSV: kop "Status: VERIFIED/UNVERIFIED" + tabel 8 field +
  "Diverifikasi oleh / tanggal". Jika `unverified`: tulis "Belum diverifikasi",
  export tetap jalan.
- Audit minimal: `verified_by` + `verified_at`. Tanpa tabel audit terpisah.

## 8. Catatan Fase-2 (tidak dikerjakan sekarang)

1. F0 sebagai penentu: aktifkan `calculateF0(log_data)` sebagai pembanding +
   toleransi +-0.01 (2 desimal); kunci final rule Min-F0-sama vs F0 >= Target.
2. Group (2 grup custom): model `history_groups` (id, name, color) seed 2 baris +
   `group_id` nullable di history; UI rename di settings + assign saat verifikasi +
   filter tab Group 1/2.

## 9. Yang Sengaja Di-skip (YAGNI)

- Tabel verifikasi/audit terpisah, tombol revert/edit, role khusus verifikator,
  group di fase-1, perbandingan F0 di fase-1.
  Tambah saat ada kebutuhan nyata yang terukur.
