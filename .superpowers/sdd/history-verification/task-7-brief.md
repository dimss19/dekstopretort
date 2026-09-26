### Task 7: Detail F0 + VALID/FAIL + form inline

**Files:**
- Modify: `resources/js/Components/History/ProcessDetailView.tsx` (props tambah `groups?: { id: number; name: string; color: string }[]`; `HistorianList` teruskan `groups` ke sini)
- Test: manual checklist + `npx tsc --noEmit` (tidak ada error baru)

**Interfaces:**
- Consumes: `calculateF0` (Task 4), `compareF0` (Task 5), rute `tn.history.verify` (Task 3), `groups`.
- Produces: form tersubmit -> backend verify; tidak ada kontrak baru.

- [ ] **Step 1: Stat F0 sistem** — di header card tambah baris "F0 sistem (otomatis): X.XX min" dihitung dari `logs` (mapping pv/dp seperti `statsData` existing) via `calculateF0(temps, 1)`.

- [ ] **Step 2: Indikator VALID/FAIL live** — jika batch `unverified`: baca input Target F0 yang sedang diketik, tampilkan badge hijau "VALID" bila `compareF0(systemF0, target) === 'VALID'`, merah "FAIL" bila `'FAIL'`, sembunyikan bila target kosong. Jika `verified`: badge dari `sterility_criterion` + F0 tersimpan.

- [ ] **Step 3: Form inline** (hanya bila `end_time` terisi + `unverified`): 8 field sesuai spec — Product text, Batch text, Scheduled Process text, Minimum F0 number step 0.01, Target F0 number step 0.01, Process deviation select (None/Minor/Major default None), Sterility criterion select (PASS/FAIL), Thermal record select (VERIFIED/REJECTED), Group select (opsi dari `groups`, default id pertama). Semua required. Bila live-compare FAIL: select criterion terkunci `FAIL` (disabled) + teks peringatan. Submit `router.post(route('tn.history.verify', batch.id), payload)`; bila `verified`: blok read-only 8 field + `verified_by/at`.

- [ ] **Step 4: Verifikasi**

Run: `npx tsc --noEmit`
Expected: PASS (nol error)
Manual: buka history selesai -> F0 tampil -> isi Target di atas F0 -> VALID hijau; isi Target di bawah -> FAIL merah + criterion terkunci; submit -> badge card jadi VERIFIED; submit ulang via API -> 422.

- [ ] **Step 5: Commit**

```bash
git add resources/js/Components/History/ProcessDetailView.tsx resources/js/Components/History/HistorianList.tsx
git commit -m "feat: F0 otomatis + VALID/FAIL + form verifikasi inline"
```

---


