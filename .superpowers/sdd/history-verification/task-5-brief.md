### Task 5: Helper history + ekstrak HistorianList (tanpa ubah perilaku)

**Files:**
- Create: `resources/js/Components/History/historyHelpers.ts`
- Create: `resources/js/Components/History/__tests__/historyHelpers.test.ts`
- Create: `resources/js/Components/History/HistorianList.tsx` (pindahan komponen `Historian` dari `Operations.tsx`, props `{ histories?: any[] }` saja)
- Modify: `resources/js/Pages/Operations.tsx` (pakai `HistorianList`, hapus definisi lokal)

**Interfaces:**
- Consumes: bentuk item history existing (`id`, `start_time`, `end_time`, `log_data`, `controller`).
- Produces: `getHistoryStatus`, `compareF0`, `filterHistories`, komponen `HistorianList` untuk Task 6, 7, 9.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { compareF0, filterHistories, getHistoryStatus } from '../historyHelpers';

describe('historyHelpers', () => {
    it('marks null end_time as running', () => {
        expect(getHistoryStatus({ end_time: null })).toBe('running');
        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z', verification_status: 'verified' })).toBe('verified');
        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z' })).toBe('unverified');
    });

    it('compares F0 strictly without tolerance', () => {
        expect(compareF0(5.21, 4.5)).toBe('VALID');
        expect(compareF0(4.5, 4.5)).toBe('VALID');
        expect(compareF0(4.49, 4.5)).toBe('FAIL');
        expect(compareF0(1.0, null)).toBeNull();
    });

    it('filters by status, group and query', () => {
        const list = [
            { id: 1, end_time: null, product: 'Rendang', batch_code: 'B-1', group_id: null },
            { id: 2, end_time: '2026-09-26T10:00:00Z', verification_status: 'verified', product: 'Rendang', batch_code: 'B-2', group_id: 1 },
            { id: 3, end_time: '2026-09-26T10:00:00Z', product: 'Kari', batch_code: 'B-3', group_id: 2 },
        ];
        expect(filterHistories(list, { status: 'running', groupId: 'all', query: '' }).map((h) => h.id)).toEqual([1]);
        expect(filterHistories(list, { status: 'all', groupId: 2, query: '' }).map((h) => h.id)).toEqual([3]);
        expect(filterHistories(list, { status: 'all', groupId: 'all', query: 'rendang' }).map((h) => h.id)).toEqual([1, 2]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- historyHelpers`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
export type HistoryStatus = 'running' | 'unverified' | 'verified';

export function getHistoryStatus(h: { end_time?: string | null; verification_status?: string }): HistoryStatus {
    if (!h.end_time) return 'running';
    return h.verification_status === 'verified' ? 'verified' : 'unverified';
}

export function compareF0(systemF0: number, targetF0: number | null | undefined): 'VALID' | 'FAIL' | null {
    if (targetF0 === null || targetF0 === undefined || Number.isNaN(systemF0)) return null;
    return systemF0 < targetF0 ? 'FAIL' : 'VALID';
}

export interface HistoryFilter {
    status: 'all' | HistoryStatus;
    groupId: 'all' | number;
    query: string;
}

export function filterHistories<T extends { end_time?: string | null; verification_status?: string; group_id?: number | null; product?: string | null; batch_code?: string | null }>(list: T[], f: HistoryFilter): T[] {
    const q = f.query.trim().toLowerCase();
    return list.filter((h) => {
        if (f.status !== 'all' && getHistoryStatus(h) !== f.status) return false;
        if (f.groupId !== 'all' && h.group_id !== f.groupId) return false;
        if (q && !`${h.product ?? ''} ${h.batch_code ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
    });
}
```

- [ ] **Step 4: Ekstrak komponen** — pindahkan fungsi `Historian` dari `Operations.tsx` (baris 102-452: filter periode, card grid, modal detail, download, delete) apa adanya menjadi `HistorianList.tsx` (export default, props `{ histories?: any[] }`), lalu `Operations.tsx` cukup render `<HistorianList histories={histories} />`. TIDAK ada perubahan perilaku di task ini.

- [ ] **Step 5: Run tests to verify**

Run: `npm test -- historyHelpers` dan `npm test`
Expected: PASS semua

- [ ] **Step 6: Commit**

```bash
git add resources/js/Components/History/historyHelpers.ts resources/js/Components/History/__tests__/historyHelpers.test.ts resources/js/Components/History/HistorianList.tsx resources/js/Pages/Operations.tsx
git commit -m "refactor: ekstrak HistorianList + historyHelpers teruji"
```

---


