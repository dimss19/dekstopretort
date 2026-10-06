# Formula Perhitungan $F_0$ (Thermal Lethality)

Dokumen ini memuat formula standar perhitungan nilai letalitas termal ($F_0$) menggunakan **Metode Trapesium (*Trapezoidal Rule*)** berbasis **timestamp aktual**.

---

## 1. Formula Matematis

### A. Laju Letalitas Sesaat (*Instantaneous Lethality Rate*, $L$)
Laju inaktivasi mikroba pada suhu $T_i$:

$$L_i = \begin{cases} 
10^{\frac{T_i - T_{\text{ref}}}{z}}, & \text{jika } T_i \ge T_{\text{threshold}} \\ 
0, & \text{jika } T_i < T_{\text{threshold}} 
\end{cases}$$

### B. Interval Waktu Nyata ($\Delta t_i$)
Dihitung dari selisih timestamp aktual antar dua titik data berurutan:

$$\Delta t_i = \frac{t_i - t_{i-1}}{60} \quad (\text{menit})$$

dengan syarat:
- $t_i > t_{i-1}$
- Jika $\Delta t_i \le 0$ (duplikat waktu / urutan salah): $\Delta t_i = 0$
- Jika $(t_i - t_{i-1}) > \Delta t_{\text{max\_gap}}$ (gap koneksi terputus): $\Delta t_i = 0$

### C. Inkrementasi Letalitas Trapesium ($\Delta F_{0, i}$)
Luas area letalitas antara titik $(t_{i-1}, T_{i-1})$ dan $(t_i, T_i)$:

$$\Delta F_{0, i} = \left( \frac{L_{i-1} + L_i}{2} \right) \times \Delta t_i$$

### D. Total Nilai Sterilisasi ($F_0$)
Akumulasi letalitas dari awal hingga akhir siklus proses:

$$F_0 = \sum_{i=1}^{n-1} \Delta F_{0, i}$$

$$\text{Hasil Akhir} = \text{round}(F_0, 2)$$

*(Rounding 2 angka desimal hanya dilakukan pada hasil akhir).*

---

## 2. Parameter Perhitungan

| Parameter | Simbol | Nilai Standar | Keterangan |
| :--- | :---: | :---: | :--- |
| **Suhu Referensi** | $T_{\text{ref}}$ | $121.1^\circ\text{C}$ | Diambil dari parameter resep (`t_ref`), default $121.1^\circ\text{C}$ (*C. botulinum*). |
| **Nilai $z$ Termal** | $z$ | $10.0^\circ\text{C}$ | Diambil dari parameter resep (`z_value`), default $10.0^\circ\text{C}$. |
| **Threshold Suhu** | $T_{\text{threshold}}$ | $100.0^\circ\text{C}$ | Suhu batas bawah kontribusi letalitas inaktivasi spora. |
| **Batas Maksimum Gap** | $\Delta t_{\text{max\_gap}}$ | $120\text{ detik}$ | Batas interval terputus; selisih waktu di atas ini tidak dihitung letalitasnya. |

---

## 3. Aturan Kondisi Khusus (*Boundary Rules*)

1. **Titik Data Tunggal ($n < 2$):**
   $$F_0 = 0.00\text{ menit}$$

2. **Duplikat Timestamp ($t_i = t_{i-1}$):**
   $$\Delta t_i = 0 \implies \Delta F_{0, i} = 0$$

3. **Data Terbalik ($t_i < t_{i-1}$):**
   Urutkan array data secara kronologis (*ascending by timestamp*) sebelum kalkulasi.

4. **Suhu di Bawah Threshold ($T < 100^\circ\text{C}$):**
   $$L = 0$$
   *(Data tetap menjaga kontinuitas waktu $\Delta t$, nilai $L$ yang disetel ke nol).*

5. **Koneksi Terputus / Data Gap ($t_i - t_{i-1} > 120\text{ detik}$):**
   $$\Delta F_{0, i} = 0$$
   *(Mencegah akumulasi letalitas semu/fiktif saat sensor mati).*

---

## 4. Algoritma Perhitungan (Pseudocode)

```text
Fungsi Hitung_F0(logs, Tref = 121.1, z = 10.0, Threshold = 100.0, MaxGap = 120):
    Jika panjang(logs) < 2:
        Kembalikan 0.00

    Urutkan logs berdasarkan timestamp ascending
    f0_total = 0.0

    Untuk i dari 1 sampai panjang(logs) - 1:
        prev = logs[i - 1]
        curr = logs[i]

        dt_detik = curr.timestamp - prev.timestamp
        Jika dt_detik <= 0 atau dt_detik > MaxGap:
            Lanjutkan ke iterasi berikutnya

        dt_menit = dt_detik / 60.0

        L_prev = (prev.suhu >= Threshold) ? 10^((prev.suhu - Tref) / z) : 0.0
        L_curr = (curr.suhu >= Threshold) ? 10^((curr.suhu - Tref) / z) : 0.0

        f0_total += ((L_prev + L_curr) / 2.0) * dt_menit

    Kembalikan Bulatkan(f0_total, 2 desimal)
```
