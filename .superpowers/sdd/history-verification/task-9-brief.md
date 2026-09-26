### Task 9: ESP reuse HistorianList + final gate

**Files:**
- Modify: `app/Http/Controllers/EspMonitorController.php` (tambah `groups` ke data Inertia)
- Modify: `resources/js/Pages/Esp/Monitor.tsx` (tab history render `<HistorianList histories={histories} groups={groups} />`; hapus state `period/customDate/selectedBatch/activeMenu`, `filteredHistories`, `handleDownload`, `handleDeleteHistory` lokal +-150 baris; tambah `groups` ke interface `Props`)
- Test: full suite + tsc + manual

**Interfaces:**
- Consumes: `HistorianList` final (Task 6), `groups` backend.
- Produces: selesai — satu historian untuk TN + ESP.

- [ ] **Step 1: Backend groups** — di `index()` tambah `'groups' => \App\Models\HistoryGroup::orderBy('id')->get(),` ke data Inertia.

- [ ] **Step 2: Ganti tab history** — blok `selectedBatch ? <ProcessDetailView/> : (Historian...)` diganti `<HistorianList histories={histories} groups={groups} />`; hapus duplikasi lokal. Aturan lock-detail-saat-running versi ESP ikut aturan bersama (running bisa dibuka, tanpa form).

- [ ] **Step 3: Final gate**

Run: `php artisan test`
Expected: PASS semua suite
Run: `npm test`
Expected: PASS semua suite
Run: `npx tsc --noEmit`
Expected: PASS
Manual: `/historian` dan `/esp/monitor` tab history menampilkan data, badge, filter, group, verifikasi yang sama.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/EspMonitorController.php resources/js/Pages/Esp/Monitor.tsx
git commit -m "refactor: history ESP pakai HistorianList bersama"
```

