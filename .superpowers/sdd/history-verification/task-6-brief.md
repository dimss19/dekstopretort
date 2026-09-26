### Task 6: Badge + filter status + chip group + rename

**Files:**
- Modify: `resources/js/Components/History/HistorianList.tsx` (props tambah `groups?: { id: number; name: string; color: string }[]`)
- Modify: `routes/web.php` (closure `/historian` kirim `groups`)
- Test: tambah test `filterHistories` group di file test Task 5 bila belum mencakup (sudah mencakup groupId); tambah test rename viaPUT manual + full suite Task 3 hijau.

**Interfaces:**
- Consumes: `groups` dari backend, `getHistoryStatus`/`filterHistories` (Task 5), rute `tn.history-groups.update` (Task 3).
- Produces: `HistorianList` dengan filter lengkap untuk Task 9 (ESP reuse).

- [ ] **Step 1: Tambah state filter** di `HistorianList`: `statusFilter: 'all' | HistoryStatus` (default `'all'`), `groupFilter: 'all' | number` (default `'all'`), `query` string. Ganti `filteredHistories` memakai `filterHistories(histories, { status: statusFilter, groupId: groupFilter, query })` digabung filter periode existing.

- [ ] **Step 2: Badge 3 state** di tiap card: `running` -> "Proses Berjalan" (amber pulse, seperti existing); `unverified` -> "UNVERIFIED" (amber solid); `verified` -> "VERIFIED" (emerald + title `by {verified_by} · {verified_at}`).

- [ ] **Step 3: Chip group di atas list**: `[Semua | {group.name} ...]` dengan warna dot dari `group.color`; klik set `groupFilter`. Ikon pensil kecil per chip group membuka popover inline (input nama + input color) yang `router.put(route('tn.history-groups.update', group.id), { name, color })`. Teruskan `groups` ke `<ProcessDetailView>` pada tampilan detail (prop `groups`) untuk dropdown group di form Task 7.

- [ ] **Step 4: Toolbar status + search**: tombol `Semua / Verified / Unverified / Berjalan` dan input search placeholder "Cari product / batch...".

- [ ] **Step 5: Backend `groups`**: di closure `/historian` tambah `'groups' => \App\Models\HistoryGroup::orderBy('id')->get()`, teruskan ke `HistorianList` via props page (`Operations.tsx` terima `groups` dan teruskan).

- [ ] **Step 6: Run tests**

Run: `php artisan test --filter=HistoryVerificationTest` dan `npm test -- historyHelpers`
Expected: PASS (rename group sudah dicakup Task 3)

- [ ] **Step 7: Commit**

```bash
git add resources/js/Components/History/HistorianList.tsx resources/js/Pages/Operations.tsx routes/web.php
git commit -m "feat: badge verifikasi + filter status + chip group rename"
```

---


