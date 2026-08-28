# PETA STRUKTUR & DESAIN CSS — Zevanic/Gechoo ERP

> Referensi visual — warna, tipografi, dan class CSS yang SUDAH ADA dan
> WAJIB dipakai ulang. Tujuannya: supaya fitur baru terasa seperti
> BAGIAN aplikasi yang sama, bukan tempelan asing dengan warna/gaya
> reka-reka sendiri. Semua di bawah ini dicek langsung dari
> `css/gechoo-design.css` (248 baris, satu-satunya file style).

---

## ⚠️ 3 hal PALING PENTING sebelum sentuh CSS apapun

1. **Tailwind CDN dan file ini AKTIF BERDAMPINGAN** — belum sepenuhnya
   dicabut. Class Tailwind lama (`flex`, `grid`, `md:hidden`, dst) masih
   dipakai di banyak file, SEBAGIAN sudah ditulis ulang manual di
   "UTILITY LAYER" (baris 169-245 file CSS) karena Tailwind CDN kadang
   tidak reliable. Kalau nambah class utility baru yang belum ada,
   tambahkan ke situ, JANGAN asumsikan Tailwind pasti tersedia.
2. **`.hidden` SENGAJA ditulis SETELAH `.flex`/`.block`/`.grid`** dalam
   urutan baris file (bukan sebelum) — ini bukan kebetulan. Kalau 1
   elemen punya class `hidden` DAN `flex` sekaligus (pola umum: JS
   cuma lepas-pasang `hidden`, sementara `flex` permanen di situ), CSS
   pilih aturan yang DITULIS PALING AKHIR kalau bobotnya sama. Pernah
   kejadian modal foto & beberapa elemen lain "tembus kelihatan" gara-
   gara urutan ini kebalik. **Kalau nambah utility class baru, JANGAN
   taruh sebelum `.hidden` di file ini.**
3. **Reset dasar** (`box-sizing`, gaya `button`/`input` bawaan browser)
   ada di baris 24-26 — ini DULU otomatis dari Tailwind Preflight, tapi
   kelupaan ikut ditulis ulang saat migrasi. Kalau ada elemen baru yang
   terasa "lebih lebar dari kotaknya" atau tombol tampil dengan gaya
   aneh bawaan browser, cek dulu apakah elemennya kena reset ini.

---

## 🎨 Palet warna (CSS variable, di `:root`)

| Variable | Hex | Porsi pemakaian | Catatan |
|---|---|---|---|
| `--ivory` | `#FAF4E7` | **55%** | Warna dasar/background utama |
| `--ivory-dim` | `#F1E8D6` | — | Background sekunder (kartu di dalam kartu, hover) |
| `--pink` | `#F2D2CE` | **20%** | Aksen — sidebar, header mobile, kartu highlight |
| `--pink-deep` | `#E3ADA6` | — | Border/garis di area pink |
| `--blue` | `#ABD1DE` | **10%** | Aksen kedua — badge info, ikon pengumuman |
| `--blue-deep` | `#82B7C8` | — | — |
| `--mahogany` | `#5B3826` | **10%** | **Teks/ikon**, BUKAN blok besar — judul besar, nama |
| `--mahogany-soft` | `#6E4630` | — | Teks sekunder di atas area pink |
| `--burgundy` | `#6E1E2C` | **5%, dijaga ketat** | **KHUSUS tombol utama & penekanan penting** — jangan dipakai berlebihan |
| `--burgundy-dark` | `#551521` | — | Hover state burgundy |
| `--burgundy-light` | `#F6E4E6` | — | Focus ring, background sangat muda |
| `--ok` / `--ok-light` | `#5E7C4F` / `#EAF0E3` | — | Status berhasil/aktif |
| `--warn` / `--warn-light` | `#B8863A` / `#F7EEDC` | — | Status peringatan/menunggu |
| `--danger` / `--danger-light` | `#B33A3A` / `#F8E5E2` | — | Status gagal/hapus |
| `--surface` | `#FFFFFF` | — | Background kartu/input |
| `--line` | `#E9DDCE` | — | SEMUA border |
| `--text` / `--text-muted` / `--text-faint` | `#3B2A1F` / `#8C7A6B` / `#B3A493` | — | 3 tingkat keabuan teks, dari paling gelap ke paling pudar |
| `--radius` | `16px` | — | Radius baku kartu (`.gc-card`) |

**Prinsip porsi**: Ivory dominan, Pink & Blue aksen sedang, Mahogany buat teks bukan blok, **Burgundy paling sedikit tapi paling penting** (tombol utama, hal yang harus diperhatikan). Kalau bikin tampilan baru dan terasa "kebanyakan burgundy", itu tanda perlu dikurangi.

---

## ✍️ Tipografi

| Font | Dipakai untuk |
|---|---|
| **Poppins** (class `.gc-heading`, atau `font-family:'Poppins',sans-serif` manual) | Judul, label tombol, angka penting (KPI), nama menu |
| **Nunito Sans** (default `.gc-app`) | Semua teks isi/paragraf/deskripsi |

`.gc-num` — `font-variant-numeric:tabular-nums` — dipakai untuk ANGKA yang perlu rata (jam, uang, counter) supaya tidak "gemetar" saat berubah.

---

## 📐 Lebar area konten utama (dicek 26 Agt 2026, atas pertanyaan Guru)

Dicek langsung ke `index.html` + `css/gechoo-design.css` (BUKAN tebak-tebak):

- **`<main>` (area konten utama, tempat semua menu di-render) TIDAK
  punya `max-width` sama sekali** — lebarnya FLUID, mengisi seluruh
  sisa ruang horizontal setelah dikurangi sidebar & padding.
- **Sidebar desktop** (`.gc-sidebar`, class `w-64`) — lebar TETAP
  `256px`, HANYA tampil di layar `md:` ke atas (≥768px), disembunyikan
  total di mobile (`hidden md:flex`).
- **Padding `<main>`**: class `p-4 md:p-8` — `16px` di semua sisi pada
  mobile, `32px` di semua sisi pada desktop (≥768px).
- **Jadi**: lebar efektif konten desktop = lebar browser − 256px
  (sidebar) − 64px (32px×2 padding). Mobile = lebar layar − 32px
  (16px×2 padding), tanpa sidebar.
- **Tabel lebar** (banyak kolom) diatasi lewat scroll horizontal
  PER-TABEL (`.gc-table-scroll`/inline `overflow-x:auto;`, tabel
  sendiri punya `min-width:760px`) — BUKAN lewat pembatasan lebar
  halaman. Jadi kalau ada tabel dengan banyak kolom (mis. Daftar
  Pesanan Pembelian di Order Belanja, 14 kolom per 26 Agt 2026, §25.11
  STATUS-PROYEK.md), yang di-scroll horizontal cuma tabelnya, bukan
  seluruh halaman.

---

## 🧩 Komponen CSS siap pakai (JANGAN reka ulang, pakai ini)

### Tag/badge (pil bulat + titik kecil)
```html
<span class="tag ok"><span class="tag-dot"></span>Sudah absen</span>
<span class="tag warn">...</span>   <!-- kuning, peringatan -->
<span class="tag danger">...</span> <!-- merah, gagal/hapus -->
<span class="tag neutral">...</span> <!-- abu, netral -->
<span class="tag pink">...</span>   <!-- pink, label/kategori -->
<span class="tag blue">...</span>   <!-- biru, info -->
```

### Tombol
| Class | Kegunaan |
|---|---|
| `.btn-primary` (+ `.block` buat lebar penuh) | Aksi utama (Simpan, Kirim) |
| `.btn-outline` (+ `.filled` buat versi solid) | Aksi sekunder |
| `.btn-ghost` | Aksi paling ringan (Batal) |
| `.btn-acc` | Setuju/Terima (hijau) |
| `.btn-rej` | Tolak (merah muda) |
| `.icon-btn` | Tombol ikon kecil (30×30px) — Edit, Refresh, dst |

### Form
```html
<div class="gc-field">
  <label>Nama Field</label>
  <input type="text">
</div>
```
Semua `input`/`select`/`textarea` di dalam `.gc-field` otomatis dapat
style seragam (border, padding, focus ring burgundy).

### Kartu
`.gc-card` — kartu dasar (putih, border tipis, radius 16px, padding 20px). Header kartu pakai `.gc-card-head` (judul + subjudul + area kanan buat tombol).

### KPI (angka besar + label)
`.kpi` dengan `.label`, `.val`, `.delta.up`/`.delta.down` — dipakai buat ringkasan angka.

### Tabel (dengan dukungan kolom freeze/beku)
`.gc-table-scroll` (wrapper) → `table.gc-table` → `.freeze-left`/`.freeze-right` untuk kolom yang tetap terlihat saat scroll horizontal (dipakai tabel lebar seperti Daftar Karyawan).

### Sidebar desktop
`.gc-sidebar`, `.gc-nav-item` (+ `.active` kalau sedang dibuka), `.gc-nav-section` (label kategori kecil di atas grup menu).

### Sub-tab pill (dipakai Config Absensi, Penjadwalan, Antrean, WhatsApp/Mail Gateway, dst)
`.gc-sub-tab-btn` (+ `.active`).

### Navigasi bawah mobile
`.gc-mobile-nav`, `.gc-mnav-item` (+ `.active`), `.gc-mnav-scan`/`.gc-mnav-scan-btn` (tombol tengah bulat besar, Scan QR).

### Drawer (Profile, geser dari kanan)
`.gc-drawer-backdrop`, `.gc-drawer` (+ `.open` buat munculkan), `.gc-drawer-link`.

### Kamera (Clock In/Out, dsb)
`.gc-cam-view` (bingkai kamera bulat/rounded), `.gc-cam-btn`/`.gc-cam-btn-inner` (tombol jepret bulat).

---

## 📱 Breakpoint (disamakan PERSIS dengan default Tailwind)

| Breakpoint | Lebar | Prefix class |
|---|---|---|
| `sm` | 640px | `sm:` |
| `md` | 768px | `md:` — **paling sering dipakai**, pemisah utama mobile vs desktop |

Pola baku: `hidden md:block` (desktop-only), `md:hidden` (mobile-only) — dipakai konsisten di seluruh app buat pisahkan tampilan Home, Profile, header, baris sub-tab, dst.

---

## Kalau butuh warna/gaya yang BELUM ada di daftar ini

**Jangan bikin warna baru sembarangan.** Kombinasikan dulu dari variable
yang sudah ada (misalnya `--pink` + opacity, seperti dipakai prototipe
tabel/antrean sebelumnya). Kalau memang butuh warna benar-benar baru,
tambahkan sebagai CSS variable baru di `:root` (jangan hardcode hex
langsung di file Vue), supaya tetap 1 sumber kebenaran warna.
