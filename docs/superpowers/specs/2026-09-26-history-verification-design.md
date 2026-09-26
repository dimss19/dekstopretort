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

1. F0 fase-1: dihitung + ditampilkan otomatis sebagai info (bukan syarat verified).
   Metode 1-titik: `F0 = Σ L(Ti) x (1/60)`, `L = 10^((T-121.1)/10)`, hanya T >= 100°C.
   Input Min-F0/Target-F0 di form tetap catatan. Perbandingan F0 masuk fase-2.
2. Toleransi F0 fase-2: selisih absolut <= 0.01 setelah round 2 desimal (disetujui, belum dipakai).
3. 8 field verifikasi: SEMUA wajib, campuran text + dropdown.
4. Otorisasi: semua user boleh verifikasi; wajib catat `verified_by` + `verified_at`.
   Tanpa revert/edit di fase-1.
5. Group: 2 slot tetap (`Group 1`, `Group 2`), nama + warna bebas;
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

## 4b. F0 Otomatis — Hitung + Tampil Saja (DISETUJUI)

- Fungsi `calculateF0` dipertahankan metode 1-titik (rectangle, sesuai arahan user),
  diselaraskan ke rumus: Tref `121.1`, z `10`, `dt = 1/60` menit, threshold `T >= 100°C`.
  `F0 = Σ 10^((Ti-121.1)/10) x (1/60)`, round 2 desimal.
- Perubahan kode vs sekarang: hanya Tref `121.11 -> 121.1` (selisih ~0.2%,
  3 unit test existing tetap hijau karena memakai suhu konstan).
- Tampil sebagai info (bukan syarat): stat "F0 sistem (otomatis)" di
  `ProcessDetailView` + ikut export. Tanpa prefill, tanpa perbandingan ke input form.
- Perbandingan sebagai syarat verified (toleransi +-0.01) tetap fase-2.

## 5. Bagian 2 — Form Verifikasi (DISETUJUI)

- Klik history yang selesai + `unverified` -> masuk `ProcessDetailView`
  (tabel + chart seperti sebelumnya) dengan form verifikasi inline di bawahnya.
  Tombol "Simpan Verifikasi" di ujung form. Tanpa popup/modal.
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
- `ProcessDetailView`: header badge status + blok "Verifikasi Batch" inline
  (form jika unverified, read-only jika verified).

## 6b. Bagian 3b — Group Custom (DISETUJUI)

- Tabel `history_groups` (id, name, color), seed tepat 2 baris
  (`Group 1`, `Group 2`). Tanpa tambah/hapus: hanya rename + ganti warna.
- Atas halaman history: chip `[Semua | Group 1 | Group 2]` merangkap filter
  + ikon edit kecil untuk rename/warna (`PUT /tn/history-groups/{id}`).
- Dropdown group wajib di form inline (default Group 1), opsi ikut nama terkini.
- Export mencantumkan nama group.
- History running/belum verifikasi tanpa group tetap terlihat di `Semua`
  + filter status; group wajib dipilih saat verifikasi.

## 7. Bagian 4 — Export + Audit (DISETUJUI)

- PDF/Excel/CSV: kop "Status: VERIFIED/UNVERIFIED" + tabel 8 field +
  "Diverifikasi oleh / tanggal". Jika `unverified`: tulis "Belum diverifikasi",
  export tetap jalan.
- Audit minimal: `verified_by` + `verified_at`. Tanpa tabel audit terpisah.

## 8. Catatan Fase-2 (tidak dikerjakan sekarang)

1. F0 sebagai penentu: `calculateF0(log_data)` sudah tampil otomatis (lihat 4b);
   tersisa mengaktifkan perbandingan + toleransi +-0.01 (2 desimal);
   kunci final rule Min-F0-sama vs F0 >= Target.
2. Group: NAIK ke fase-1, lihat 6b (desain selesai, tinggal implementasi).

## 9. Yang Sengaja Di-skip (YAGNI)

- Tabel verifikasi/audit terpisah, tombol revert/edit, role khusus verifikator,
  perbandingan F0 di fase-1.
  Tambah saat ada kebutuhan nyata yang terukur.
