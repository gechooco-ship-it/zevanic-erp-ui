# PETA STRUKTUR & DESAIN CSS — Zevanic/Gechoo ERP

> Referensi visual — warna, tipografi, dan class CSS yang SUDAH ADA dan
> WAJIB dipakai ulang. Tujuannya: supaya fitur baru terasa seperti
> BAGIAN aplikasi yang sama, bukan tempelan asing dengan warna/gaya
> reka-reka sendiri. Semua di bawah ini dicek langsung dari
> `css/gechoo-design.css` (448 baris per 30 Agt 2026, naik dari 248 baris
> — pertumbuhan dari kerja modul manufaktur Zevanic House/Persiapan
> Produksi dan redesain mobile "Gechoo Mobile Organic", satu-satunya
> file style).

---

## ⚠️ 3 hal PALING PENTING sebelum sentuh CSS apapun

1. **Tailwind CDN dan file ini AKTIF BERDAMPINGAN** — belum sepenuhnya
   dicabut. Class Tailwind lama (`flex`, `grid`, `md:hidden`, dst) masih
   dipakai di banyak file, SEBAGIAN sudah ditulis ulang manual di
   "UTILITY LAYER" (baris 279-364 file CSS per 30 Agt 2026 — nomor baris
   ini bergeser seiring file bertambah, cek ulang kalau meleset) karena
   Tailwind CDN kadang tidak reliable. Kalau nambah class utility baru yang belum ada,
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
| `--ivory` | `#FDFAF4` | **55%** | Warna dasar/background utama (diganti 29 Agt 2026 dari `#FAF4E7`, versi lebih muda/"clean" sesuai mockup "Gechoo Mobile Organic") |
| `--ivory-dim` | `#F7F1E6` | — | Background sekunder (kartu di dalam kartu, hover) (diganti 29 Agt 2026 dari `#F1E8D6`) |
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
| `--line` | `#EFE7DA` | — | SEMUA border (diganti 29 Agt 2026 dari `#E9DDCE`) |
| `--text` / `--text-muted` / `--text-faint` | `#3B2A1F` / `#8C7A6B` / `#B3A493` | — | 3 tingkat keabuan teks, dari paling gelap ke paling pudar |
| `--radius` | `16px` | — | Radius baku kartu (`.gc-card`) |

**Prinsip porsi**: Ivory dominan, Pink & Blue aksen sedang, Mahogany buat teks bukan blok, **Burgundy paling sedikit tapi paling penting** (tombol utama, hal yang harus diperhatikan). Kalau bikin tampilan baru dan terasa "kebanyakan burgundy", itu tanda perlu dikurangi.

> **PENGECUALIAN (BARU, 30 Agt 2026)** — layar **Beranda DESKTOP** (dashboard
> baru, lihat bagian "Redesain Desktop Beranda" di bawah) SENGAJA memakai
> gradien maroon (`.gc-kartu-gradien`) jauh lebih luas dari porsi 5% di
> atas — 4 kartu KPI + kartu Quote sekaligus, bukan cuma 1 tombol/kartu
> shift. Ini **permintaan eksplisit Guru** (30 Agt 2026, sesi mockup
> "Zevanic Desktop Adaptasi"), **KHUSUS Beranda desktop saja** — bukan
> preseden buat layar/modul lain, dan **TIDAK berlaku sama sekali di
> mobile** (kartu shift mobile tetap porsi lama, tidak berubah). Kalau
> bikin layar baru dan tergoda ikut pola ini, cek dulu apa ini benar-
> benar Beranda desktop atau bukan.

### 🌙 Mode gelap (BARU, 28 Agt 2026 — redesain "Gechoo Mobile Organic")

Toggle lewat atribut `[data-theme="dark"]` di `<html>` — BUKAN
`prefers-color-scheme`. Ini pilihan EKSPLISIT user lewat sakelar di
Bottom Sheet Profil/Profil Lengkap, disimpan di `localStorage`, logic-nya
di `window.aturTema()` (`index.html`, dijalankan sebelum cat pertama
biar tidak "kedip" terang dulu baru gelap).

**Token TAMBAHAN, cuma ada di `:root`** (dipakai lintas mode terang/gelap, nilainya beda tiap mode):

| Variable | Terang | Gelap | Dipakai untuk |
|---|---|---|---|
| `--aksen-ink` | `#6E1E2C` (= `--burgundy`) | `#F2D2CE` (pale pink) | Teks/ikon aksen DI ATAS `--surface`/`--ivory` (mis. item nav mobile aktif, label langkah aktif) — beda dari `--burgundy` yang tetap dipakai apa adanya untuk isi blok solid |
| `--aksen-lembut` | `#F7E2E0` | `#4A2530` | Latar lingkaran ikon, kartu aksi cepat, pil pilihan aktif |
| `--nav` | `rgba(255,255,255,.92)` | `rgba(31,22,17,.92)` | Latar nav bawah mobile (dengan blur) |
| `--lens` | `#6E4630` | `#241a14` | Latar bingkai kamera Absensi/Scan QR |
| `--grad-shift-a` / `--grad-shift-b` | `#5C1A28` / `#3A1017` | `#4A2530` / `#291319` | Gradien kartu shift Beranda & banner motivasi (JUGA dipakai kartu KPI/Quote Beranda desktop, lihat pengecualian di atas) |
| `--tinta-gradien` | `#FBEDEC` | `#F7E7E4` | Warna teks di atas kartu gradien maroon |
| `--grad-beranda-a` / `--grad-beranda-b` | `#FCEFED` / `#FDFAF4` | `#2E1B1B` / `#1F1611` | Gradien atas Beranda (belakang baris sapaan) |

**Token NETRAL** (`--ivory`, `--ivory-dim`, `--surface`, `--line`, `--text`,
`--text-muted`, `--text-faint`) juga di-override di mode gelap — nilainya
lihat langsung `[data-theme="dark"]` di CSS, tidak diulang di sini supaya
tidak dobel-sumber.

**KEPUTUSAN PENTING (dicatat juga di CSS + STATUS-PROYEK.md)**:
`--burgundy`/`--ok`/`--warn`/`--danger` **SENGAJA TIDAK** di-override di
mode gelap — itu warna SOLID untuk tombol/isi blok (mis. `.btn-primary`,
`.tag.ok`), bukan warna teks di atas permukaan yang berubah gelap-terang,
jadi tetap kontras di kedua mode apa adanya. Jangan "perbaiki" ini
dengan nambah override tanpa cek catatan ini dulu.

---

## ✍️ Tipografi

| Font | Dipakai untuk |
|---|---|
| **Poppins** (class `.gc-heading`, atau `font-family:'Poppins',sans-serif` manual) | Judul, label tombol, angka penting (KPI), nama menu |
| **Nunito Sans** (default `.gc-app`) | Semua teks isi/paragraf/deskripsi |

`.gc-num` — `font-variant-numeric:tabular-nums` — dipakai untuk ANGKA yang perlu rata (jam, uang, counter) supaya tidak "gemetar" saat berubah.

---

## 📐 Lebar area konten utama (dicek ulang 30 Agt 2026, masih berlaku)

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
  PER-TABEL (`.gc-table-scroll`, tabel sendiri punya `min-width:760px`
  — dicek ulang, masih sama) — BUKAN lewat pembatasan lebar halaman.
  Kalau ada tabel dengan banyak kolom, yang di-scroll horizontal cuma
  tabelnya, bukan seluruh halaman.
- **BARU (30 Agt 2026)**: `#tab-home` (Beranda) SEKARANG TIDAK ikut
  `max-width` mobile lagi di level ini — dulu satu wrapper `max-w-xl`
  membungkus versi desktop DAN mobile sekaligus (bug tersembunyi, bikin
  dashboard desktop kepaksa selebar mobile ~576px). `max-w-xl` sekarang
  cuma bungkus blok mobile-nya sendiri (`#vue-home`); dashboard desktop
  (`#vue-beranda-desktop`) ikut lebar penuh `<main>` seperti modul lain.

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

**Kartu-baris** (pola daftar item ala redesain "Gechoo Mobile Organic",
28 Agt 2026) — **bukan class CSS baru**, murni konvensi inline-style
yang diulang: `.gc-card` dengan `border-radius:20px` inline
(override manual per-kartu, BUKAN token `--radius` global — kartu lama
yang belum disentuh TETAP 16px) + `padding:13-14px`, isi tersusun
judul+subtitle di kiri/chip status di kanan-atas, baris meta ber-ikon
(warna `var(--aksen-ink)`), area aksi dipisah `border-top:1px solid
var(--line)`. Dipakai luas (12 file `js/*.js` per pengecekan 30 Agt
2026, a.l. `vue-persiapan-produksi.js`, `vue-order-spk.js`,
`vue-reimburse.js`, `vue-antrean-*.js`, `vue-config-absensi.js`,
`vue-camera.js`) — cek langsung salah satu file contoh kalau mau
menirunya persis.

### Empty state
```html
<div class="gc-kosong gc-card">
  <div class="lingkaran"><i class="fas fa-ikon-relevan"></i></div>
  <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Teks kosongnya</h3>
</div>
```
`.lingkaran` pakai `var(--aksen-lembut)` (latar) + `var(--aksen-ink)`
(ikon) — otomatis kontras di mode gelap. Lihat `.gc-kosong` di daftar
"Class BARU" di bawah untuk daftar file pemakaiannya.

### KPI (angka besar + label)
`.kpi` dengan `.label`, `.val`, `.delta.up`/`.delta.down` — dipakai buat ringkasan angka. **BEDA** dari `.gc-kpi-card` (Beranda desktop, lihat bagian Redesain Desktop di bawah) — itu varian gradien maroon khusus dashboard, bukan pengganti `.kpi` biasa.

### Tabel (dengan dukungan kolom freeze/beku)
`.gc-table-scroll` (wrapper) → `table.gc-table` → `.freeze-left`/`.freeze-right` untuk kolom yang tetap terlihat saat scroll horizontal — dipakai luas (15 file `js/*.js` per 30 Agt 2026, a.l. `vue-kartu-stok.js`, `vue-bahan-aksesoris.js`, `vue-stock-pembelian.js`, `vue-riwayat-absensi.js`; **CATATAN**: `vue-daftar-karyawan.js` sendiri saat ini TIDAK memakainya, meski dulu jadi contoh acuan — cek ulang layar spesifik sebelum kutip sebagai contoh). Sel avatar+nama karyawan di tabel pakai `.gc-emp` (wrapper flex), `.gc-emp-av` (avatar inisial bulat), `.gc-cell-muted` (teks sekunder di sel) — didefinisikan di CSS tapi belum ketemu pemakaian aktifnya di `js/*.js` saat pengecekan ini, jangan asumsikan dipakai di layar tertentu tanpa cek ulang.

### Sidebar desktop
**REDESAIN WARNA (30 Agt 2026)** — dulu latar `.gc-sidebar` pink
(`var(--pink)`), SEKARANG putih (`var(--surface)`) dengan
`.gc-side-brand` (blok logo/nama app di atas) latar ivory (`var(--ivory)`,
tinggi disamakan 80px dengan topbar biar border-nya sejajar) — bagian
dari redesain tampilan DESKTOP (lihat "Redesain Desktop Beranda" di
bawah). Struktur class TIDAK berubah, cuma nilai warnanya: `.gc-nav-item`
(+ `.active` kalau sedang dibuka, `.gc-nav-ico` untuk ikonnya, item aktif
sekarang pakai `var(--aksen-lembut)`/`var(--aksen-ink)` bukan
`var(--surface)`/`var(--burgundy)`), `.gc-nav-section` (label kategori
kecil di atas grup menu), `.gc-nav-subgroup` (wrapper sub-menu nested,
tidak berubah). **Tampilan mobile (`.gc-mobile-nav` dst) SAMA SEKALI
TIDAK ikut berubah.**

### Sub-tab pill (dipakai Config Absensi, Penjadwalan, Antrean, WhatsApp/Mail Gateway, dst)
`.gc-sub-tab-btn` (+ `.active`).

### Navigasi bawah mobile
`.gc-mobile-nav`, `.gc-mnav-item` (+ `.active`, ikon pakai `.gc-mnav-ico`), `.gc-mnav-scan`/`.gc-mnav-scan-btn` (tombol tengah bulat besar, Scan QR). Latar nav pakai token `--nav` (translucent+blur, beda terang/gelap — lihat bagian Mode Gelap di atas), warna item aktif pakai `--aksen-ink` (bukan `--burgundy` langsung) biar tetap kontras di mode gelap.

### Drawer (Profile, geser dari kanan) — DEPRECATED, jangan pakai lagi
`.gc-drawer-backdrop`, `.gc-drawer` (+ `.open` buat munculkan), `.gc-drawer-link` — MASIH ADA di `css/gechoo-design.css` (dicek ulang 30 Agt 2026, kelasnya masih tertulis) tapi **0 pemakaian** di `js/*.js` maupun `*.html` sejak Profile pindah ke Bottom Sheet (`.gc-sheet`, lihat bagian "🆕 Class BARU" di bawah). Dibiarkan dulu di CSS (belum dihapus, jaga-jaga ada pemakaian tersembunyi yang belum kecek) — **JANGAN pakai buat fitur baru**, pakai `.gc-sheet` kalau butuh panel naik-dari-bawah serupa.

### Kamera (Clock In/Out, Scan QR)
`.gc-cam-wrap` (wrapper full-page, latar terang), `.gc-cam-close` (tombol X bulat pojok kiri-atas), `.gc-cam-top` (blok judul + label mode), `.gc-cam-view` (bingkai kamera bulat/rounded 3:4 — latar pakai token `--lens`), `.gc-cam-frame` (bingkai pink overlay viewfinder), `.gc-cam-scanline` (garis animasi scan, `@keyframes gxScanline`), `.gc-cam-caption` (teks instruksi di bawah viewfinder), `.gc-cam-btn`/`.gc-cam-btn-inner` (tombol jepret bulat), `.scan-result` (kartu hasil setelah QR terbaca). Dipakai di `vue-scan-qr.js`, `vue-camera.js`.

---

## 🆕 Redesain Desktop Beranda (BARU, 30 Agt 2026)

> Dashboard Beranda desktop sungguhan, ganti banner statis "Selamat
> datang" + PengumumanCarousel/QuoteCard lama. Diadaptasi dari paket
> design handoff `design_handoff_zevanic_desktop` + mockup artefak
> "Zevanic Desktop Adaptasi" (3 ronde revisi + 1 ronde AskUserQuestion
> keputusan arsitektur, 30 Agt 2026). Komponen: `js/vue-home-desktop.js`
> (`BerandaDesktop`), mount ke `#vue-beranda-desktop`. **Detail lengkap
> keputusan (Pipeline Produksi placeholder, arti "Serie", dll) ada di
> komentar besar atas file itu — WAJIB dibaca sebelum ubah.**

| Class | Kegunaan |
|---|---|
| `.gc-topbar-desktop` | GANTI header 80px statis "ERP Portal" lama — latar ivory, isi breadcrumb (`.gc-crumb`, baris berikut) + `#teks-nama-user` (JANGAN ganti id, dipakai `auth.js`) + lonceng notifikasi. Badge `#label-badge-role` (countdown shift lama, hardcode salah "01:00" utk semua orang) SUDAH DICOPOT dari topbar desktop (30 Agt 2026, sesi lanjutan) — `auth.js` diberi null-guard kalau elemen ini dicari lagi |
| `.gc-crumb` (+ `.gc-crumb-mid`) | Breadcrumb topbar desktop (BARU, 30 Agt 2026, sesi lanjutan) — GANTI h2 "ERP Portal" + badge shift lama. Statis "Umum › Beranda" untuk sekarang, belum ada routing breadcrumb dinamis per-layar (baru Beranda yang punya versi desktop) |
| `.gc-notif-wrap`/`.gc-notif-btn`/`.gc-notif-backdrop`/`.gc-notif-panel`/`.gc-notif-item`/`.gc-notif-empty` | Lonceng Pengumuman di topbar desktop — pola SAMA PERSIS lonceng mobile (`js/vue-header-mobile.js`), termasuk key `localStorage` "sudah dibaca" (dishare, BUKAN duplikat state) |
| `.gc-dash-grid` | Grid 2 kolom Beranda desktop (`1fr 320px`) |
| `.gc-kpi-row`/`.gc-kpi-card`/`.gc-kpi-top`/`.gc-kpi-ico`/`.gc-kpi-chip`/`.gc-kpi-val`/`.gc-kpi-label` | 4 kartu KPI atas — `.gc-kpi-card` dipakai BARENG `.gc-kartu-gradien` (lihat pengecualian warna di atas) |
| `.gc-quote-desktop` | Kartu Quote kolom kanan — dipakai BARENG `.gc-kartu-gradien`, data SAMA seperti `QuoteCard` (`vue-components.js`) tapi warna beda (maroon, bukan pink-blue) — komponen terpisah, `QuoteCard` asli TIDAK diubah (mobile tetap pink-blue) |
| `.gc-pipeline-card`/`.gc-pipeline-head`/`.gc-pipeline-tot`/`.gc-pipeline-desc`/`.gc-pipeline-steps`/`.gc-pipeline-step`/`.gc-pipeline-bar`/`.gc-pipeline-n`/`.gc-pipeline-lbl`/`.gc-pipeline-segera` | Kartu Pipeline Persiapan (data REAL, `order_spk`+`spk_track`) & Pipeline Produksi (placeholder "Segera Hadir", BELUM ada skema data — lihat komentar `js/vue-home-desktop.js`) |
| `.gc-tindak-row`/`.gc-tindak-ico`/`.gc-tindak-txt`/`.gc-tindak-chip` | Daftar "Perlu Tindakan Anda" — 6 baris real dari Pipeline Persiapan saja (Pipeline Produksi placeholder TIDAK ikut, belum ada data asli) |
| `.gc-absen-desktop` | Kartu Absen kolom kanan, paling atas (BARU, 30 Agt 2026, sesi lanjutan) — **REAL** (bukan ilustratif), "diambil tempel" dari kartu shift mobile: dipakai BARENG `.gc-kartu-gradien`/`.gc-pil-status`/`.gc-deco-lingkaran` (class lama, TIDAK direka ulang), logic sama seperti `muatShift()`+`cekStatusClockInSaya()` di `vue-home.js`. Read-only, TANPA tombol Clock In/Out |
| `.gc-aktivitas-row`/`.gc-aktivitas-dot`/`.gc-aktivitas-txt`/`.gc-aktivitas-jam` | Kartu "Aktivitas Terbaru" kolom kanan (BARU, 30 Agt 2026, sesi lanjutan) — kartu pembungkus reuse `.gc-pipeline-card`/`.gc-pipeline-head`. **Isinya KONTEN STATIS/ILUSTRATIF**, bukan Firestore — lihat catatan di bawah |
| `.gc-pintasan-row` (+ `kbd`) | Kartu "Pintasan Papan Tik" kolom kanan (BARU, 30 Agt 2026, sesi lanjutan) — kartu pembungkus reuse `.gc-pipeline-card`/`.gc-pipeline-head`. **Isinya KONTEN STATIS/ILUSTRATIF** (Ctrl+K dkk — BELUM ada command palette sungguhan di app) — lihat catatan di bawah |

**REVISI (30 Agt 2026, sesi lanjutan)** — sebelumnya "Aktivitas Terbaru"
dan "Pintasan Papan Tik" SENGAJA TIDAK dibangun (keputusan sendiri, bukan
instruksi Guru, supaya tidak ada data palsu di produksi). **Guru secara
eksplisit membalik keputusan ini** ("aktifitas terbaru tampilkan mockup
dan pintasan keyboard juga, anggap mockup yg dilivekan") — sekarang KEDUA
kartu ini DIBANGUN di kolom kanan (`js/vue-home-desktop.js`, konstanta
`AKTIVITAS_ILUSTRATIF`/`PINTASAN_ILUSTRATIF`), TAPI isinya tetap **konten
statis/ilustratif** (persis isi mockup, dinyatakan jujur di komentar kode)
— BUKAN data live, karena memang tidak ada koleksi log aktivitas
lintas-modul di skema data sungguhan (`PETA-DATABASE.md`) dan tidak ada
command palette Ctrl+K sungguhan di app ini. Kalau nanti mau versi live
beneran, itu kerjaan terpisah (perlu koleksi log baru), belum diminta.

**⚠️ Firestore index**: query Pipeline Persiapan per-jalur SENGAJA 4×
`where(jalur=='x').where(status=='y')` terpisah (bukan 1 query
`where(status,'in',[...])`) — pola equality-only yang SUDAH ke-index
otomatis, hindari resiko "query requires an index" yang butuh index
composite baru. Lihat STATUS-PROYEK.md untuk status deploy lengkap.

---

## 🆕 Class BARU sejak 248 → 448 baris (belum tercatat sebelumnya)

> Dikumpulkan 30 Agt 2026 dengan baca ulang penuh `css/gechoo-design.css`
> (448 baris) lalu grep tiap nama class ke `js/*.js` — bukan tebakan.
> Kalau sebuah class disebut "belum ketemu pemakaian aktif", artinya
> memang nol hasil grep di `js/*.js` maupun `*.html` repo ini saat
> pengecekan — kemungkinan disiapkan duluan untuk fitur yang menyusul
> (pola form bertahap/step, filter bar) tapi belum dipasang di layar
> manapun. Cek ulang sebelum diandalkan sebagai "sudah dipakai di X".

### Approve row 3-tombol (Sesuai / Tidak Sesuai / Reject)
`.approve-row` (wrapper flex) → `.appr-btn` (+ `.ok`/`.warn`/`.danger`). Gabungan 2 langkah lama (dropdown Seragam + tombol Accept terpisah) jadi 3 tombol sejajar. Dipakai di 4 modul Antrean: `vue-antrean-absensi.js`, `vue-antrean-lembur.js`, `vue-antrean-dakar.js`, `vue-reimburse.js`.

### Tombol tutup oval (X)
`.gc-x-tutup`. Dipakai di Bottom Sheet Profil (`vue-sheet-profil.js`). Di mode gelap otomatis ganti jadi burgundy+pink (override khusus `[data-theme="dark"] .gc-x-tutup`) supaya tidak kepucatan/kekontrasan — jangan disamakan gaya warnanya secara manual di tempat lain, pakai class ini.

### Menu "lainnya" oval (titik-tiga)
`.gc-overflow-btn` (tombol trigger oval), `.gc-overflow-dot` (indikator titik merah di pojok kalau ada info baru), `.gc-overflow-backdrop` + `.gc-overflow-panel` (dropdown-nya, pola trigger+backdrop+panel absolute SAMA seperti lonceng notifikasi `vue-header-mobile.js`), `.gc-overflow-label` (label kategori kecil di panel), `.gc-overflow-item` (baris menu), `.gc-overflow-sep` (garis pemisah). Gantikan ikon filter bulat lama; nampung Filter Owner + aksi sekunder (Cek Data Sangat Lama, Refresh). Dipakai di 4 modul Antrean yang sama seperti approve-row.

### Badge angka kecil
`.gc-badge-count`. Pil angka kecil (burgundy solid) nempel di teks banner ringkas antrean. Dipakai di 4 modul Antrean yang sama seperti approve-row.

### Halaman login
`.login-wrap` — grid 2 kolom (form | brand) di desktop, jadi 1 kolom di bawah 860px. **Breakpoint 860px ini KHUSUS milik `.login-wrap`**, beda dari breakpoint standar `sm`/`md` di tabel bawah — jangan disamakan. Dipakai `vue-login.js`.

### Baris grid responsif untuk form berulang
`.gc-row-nq` (kolom `2fr 1fr 30px` desktop), `.gc-row-konversi` (kolom `1fr 1fr 64px 1fr 30px` desktop) — keduanya 1 kolom penuh di HP (<768px). `.gc-row-label` — label per-field yang HANYA tampil di HP (di desktop header kolom sudah cukup jelas, label dobel jadi berantakan). **Beda dari `.grid-cols-1`/`.md:grid-cols-N` biasa** — ini khusus baris form yang kolomnya TIDAK rata/campur lebar fixed-px (mis. ada kolom tombol hapus 30px), bukan pengganti utility grid section biasa. Dipakai di: Kelola Komponen & BOM Jasa (`vue-master-produk.js`), Konversi Berjenjang (`vue-bahan-aksesoris.js`), baris qty pembelian (`vue-stock-pembelian.js`).

### Filter bar & checkbox (belum ketemu pemakaian aktif)
`.gc-filter-bar` (wrapper baris cari+dropdown+checkbox), `.gc-chk` (checkbox dengan `accent-color:var(--burgundy)`). Terdefinisi di CSS tapi grep `js/*.js` dan `*.html` repo ini nol hasil saat pengecekan 30 Agt 2026 — jangan sebut "dipakai di layar X" tanpa cek ulang lebih dulu.

### Utilitas: aman dari bottom nav mobile
`.gc-safe-bottom` — `padding-bottom:90px`, mencegah konten paling bawah ketutupan `.gc-mobile-nav`. Sama seperti di atas: belum ketemu pemakaian aktif di `js/*.js` saat pengecekan ini.

### Redesain Mobile "Gechoo Mobile Organic" — kelas bersama (BARU 28 Agt 2026)
Dipakai lintas Beranda, Bottom Sheet Profil, dialog Akses Terbatas, Form bertahap. Semua prefix `gc-*` (bukan `gx-*` yang dipakai di prototipe/mockup — README mockup eksplisit minta jangan dibawa ke repo; nama animasi `gx*` sengaja dipertahankan cuma di `@keyframes` biar gampang dicari lintas dokumen).

| Class | Kegunaan | Dipakai di |
|---|---|---|
| `.gc-kartu-gradien` (+ `.gc-deco-lingkaran`) | Kartu gradien maroon (token `--grad-shift-a/b`, teks `--tinta-gradien`) | Kartu shift & banner motivasi (`vue-home.js`), JUGA kartu KPI/Quote Beranda desktop (`js/vue-home-desktop.js`, lihat bagian Redesain Desktop di atas) |
| `.gc-gradien-atas` | Gradien lembut di belakang baris sapaan | `vue-home.js` |
| `.gc-pil-status` | Pil status kaca/glassmorphism (mis. "Sudah absen masuk") di atas kartu gradien | `vue-home.js` |
| `.gc-kartu-statistik` | Kartu 3-kolom dengan garis pemisah vertikal antar kolom | `vue-home.js` |
| `.gc-sheet-backdrop` + `.gc-sheet` (+ `.gc-sheet-gagang`/`.gc-sheet-gagang-area`) | Bottom sheet slide-up dari bawah (`@keyframes gxSheet`) | `vue-sheet-profil.js` |
| `.gc-dialog-backdrop` + `.gc-dialog` | Dialog tengah layar (`@keyframes gxPop`) | Akses Terbatas, `vue-components.js` |
| `.gc-bar-langkah` (+ `.langkah`, `.garis`, `.nama-langkah`) | Bar progress form bertahap (step indicator) | Belum ketemu pemakaian aktif saat pengecekan ini |
| `.gc-pil-pilihan` (+ `.aktif`) | Pil pilihan form (mis. jenis pengajuan) | Belum ketemu pemakaian aktif saat pengecekan ini |
| `.gc-kosong` (+ `.lingkaran`) | Placeholder kartu kosong / empty state (search-x, ikon di lingkaran) | Dipakai luas: `vue-persiapan-produksi-v2.js`, `vue-persiapan-produksi.js`, `vue-order-spk.js`, `vue-account-profile.js`, `vue-menu-lengkap.js` |

`.gc-kartu-statistik` saat ini masih tampil `"–"` (placeholder) di
`vue-home.js` — rumus/isi angkanya belum ditentukan, jangan anggap
sudah menghitung sesuatu kalau lihat "–" di layar Beranda.

**Markup Bottom Sheet:**
```html
<div class="gc-sheet-backdrop" @click="tutup"></div>
<div class="gc-sheet">
  <div class="gc-sheet-gagang-area" @click="tutup"><div class="gc-sheet-gagang"></div></div>
  <!-- isi -->
</div>
```
Naik dari bawah (animasi `gxSheet`), GANTI TOTAL drawer geser-dari-kanan lama (lihat catatan DEPRECATED `.gc-drawer` di atas).

**Markup Dialog tengah:**
```html
<div class="gc-dialog-backdrop" @click="tutup">
  <div class="gc-dialog" @click.stop><!-- isi --></div>
</div>
```
Kotak konfirmasi/info di tengah layar (animasi `gxPop`).

Semua animasi (`gxFade`/`gxSheet`/`gxPop`/`gxScanline`/`gxPulse`) otomatis nonaktif kalau browser diset `prefers-reduced-motion:reduce`.

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
tambahkan sebagai CSS variable baru di `:root` **DAN** blok
`[data-theme="dark"]` (supaya ikut mode gelap, lihat bagian Mode Gelap
di atas) — jangan hardcode hex langsung di file Vue, supaya tetap 1
sumber kebenaran warna. **Kalau warnanya PASTI SAMA di kedua mode**
(mis. `--burgundy`, warna status), boleh cukup di `:root` saja tanpa
override di blok gelap — tapi catat alasannya (SOLID color, bukan
token permukaan) biar sesi berikutnya tidak menganggapnya lupa.
