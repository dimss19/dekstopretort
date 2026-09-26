### Task 8: Export ikut verifikasi

**Files:**
- Modify: `resources/js/Components/History/ProcessDetailView.tsx` (3 builder: `handleDownloadPDF`, `handleDownloadExcel`, `handleDownloadCSV`)
- Test: `php artisan test --filter=EspMonitorAndCsvTest` (tidak regresi) + manual checklist

**Interfaces:**
- Consumes: field verifikasi + `groups` + F0 dari Task 7.
- Produces: tidak ada kontrak baru.

- [ ] **Step 1: PDF** — di summary table tambah baris Status (VERIFIED/UNVERIFIED/Berjalan), Product, Batch, Group, F0 sistem, VALID/FAIL, Diverifikasi oleh/tanggal; bila unverified tulis "Belum diverifikasi".

- [ ] **Step 2: Excel** — baris KPI yang sama di tabel ringkasan.

- [ ] **Step 3: CSV** — blok meta tambah Status, Product, Batch, Group, F0 sistem, VALID/FAIL, Diverifikasi oleh/tanggal.

- [ ] **Step 4: Run test**

Run: `php artisan test --filter=EspMonitorAndCsvTest`
Expected: PASS
Manual: export 1 batch verified (cek blok verifikasi) + 1 unverified (cek tulisan "Belum diverifikasi").

- [ ] **Step 5: Commit**

```bash
git add resources/js/Components/History/ProcessDetailView.tsx
git commit -m "feat: export PDF/Excel/CSV ikut blok verifikasi"
```

---


