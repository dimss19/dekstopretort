### Task 4: calculateF0 TS ke Tref 121.1

**Files:**
- Modify: `resources/js/Pages/Tn/retortTelemetry.ts` (baris 239: `121.11` -> `121.1`, update komentar rumus)
- Modify: `resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts` (tambah test diskriminator)

**Interfaces:**
- Consumes: tidak ada (pure function).
- Produces: `calculateF0` akurat Tref 121.1 untuk Task 7 (tampilan F0 + VALID/FAIL live).

- [ ] **Step 1: Write the failing test** (tambah di file test existing)

```ts
it('uses Tref 121.1 (suhu pattern 121.0, bukan terpaku 121.11)', () => {
    expect(calculateF0(Array(600).fill(121.0), 1)).toBe(9.77);
});
```

Test existing (60x121.11 -> 1, dst) tetap hijau. Suhu test memakai 121.0
(Kode lama memberi 9.75 untuk input ini, jadi benar-benar gagal dulu.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- retortTelemetry`
Expected: FAIL pada test baru (kode lama memberi 9.75, bukan 9.77)

- [ ] **Step 3: Write minimal implementation**

```ts
export function calculateF0(temperatures: number[], intervalSeconds: number = 1): number {
    let f0 = 0;
    const dtMinutes = intervalSeconds / 60;
    for (const temp of temperatures) {
        if (temp >= 100) {
            f0 += dtMinutes * Math.pow(10, (temp - 121.1) / 10);
        }
    }
    return Math.round(f0 * 100) / 100;
}
```

Hanya konstanta `121.11` -> `121.1`; struktur loop 1-titik dipertahankan.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- retortTelemetry`
Expected: PASS (semua testincl. 3 test lama)

- [ ] **Step 5: Commit**

```bash
git add resources/js/Pages/Tn/retortTelemetry.ts resources/js/Pages/Tn/__tests__/retortTelemetry.test.ts
git commit -m "fix: calculateF0 Tref 121.1 metode 1-titik + test"
```

---


