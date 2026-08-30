
# STATUS PROYEK (RINGKAS) — Zevanic/Gechoo ERP

> **Terakhir diperbarui: 30 Agustus 2026 (malam, lanjutan).** Fitur
> "Pesanan" (Kasir + pipeline, §45/§5.7) sudah di-push Guru ke GitHub,
> bug menu tidak muncul SUDAH DIPERBAIKI & DIKONFIRMASI live (dicek
> `git clone`, fix `auth.js` sudah ada di commit terbaru). Firestore
> Rules 2 koleksi baru Kasir (`transaksi_kasir`,
> `pengaturan_id_transaksi_kasir`) **masih WAJIB di-Publish manual** di
> Firebase Console — blocker keras terpisah, belum dikonfirmasi selesai.
>
> **BARU**: Guru sudah beri izin eksplisit mulai implementasi **redesain
> Beranda DESKTOP** (dari paket design handoff + mockup artefak "Zevanic
> Desktop Adaptasi") — **KODE SUDAH DITULIS** (index.html, css/gechoo-
> design.css, js/vue-home-desktop.js ditulis ulang total), **SUDAH
> DIKIRIM** ke folder `Code` di komputer Guru, **BELUM di-copy-paste
> Guru ke repo & di-push**, dan **BELUM DIUJI SAMA SEKALI** di
> browser+Firebase sungguhan (Claude tidak bisa menguji dari sandbox).
> Detail lengkap keputusan & apa yang dibangun/tidak dibangun: §5.9.
> Tampilan **mobile TIDAK disentuh sama sekali** di kerja ini.
>
> **REVISI LANJUTAN (30 Agt 2026, sesi lanjutan)** — permintaan Guru
> lihat topbar live via screenshot: badge shift countdown lama
> ("Shift 01:00 | Tepat Waktu...", hardcode salah, `dashboard.js`
> `mulaiHitungJamKerja()`) + h2 "ERP Portal" DICOPOT dari topbar,
> diganti breadcrumb statis gaya mockup; **kartu Absen REAL** (ambil
> dari kartu shift mobile) ditambah di kolom kanan; kartu **"Aktivitas
> Terbaru" & "Pintasan Papan Tik" DIBANGUN** (sebelumnya sengaja
> tidak, lihat §5.9 — Guru membalik keputusan itu secara eksplisit),
> isinya **statis/ilustratif**, bukan data live. 4 file dikirim ulang
> (`index.html`, `css/gechoo-design.css`, `js/vue-home-desktop.js`,
> `js/auth.js` — null-guard). Detail lengkap: §5.9b. **BELUM DI-PUSH
> GURU, BELUM DIUJI**, sama seperti sisa §5.9.
>
> **Riwayat detail lengkap** (semua koreksi, diskusi, bug-fix step-by-
> step) ada di `STATUS-PROYEK-ARSIP.md` (isi identik dengan versi asli
> dari Cowork, tidak diringkas sama sekali, TIDAK WAJIB dibaca tiap sesi).

---

## 1. Apa proyek ini

Sistem ERP internal untuk **Zevanic/Gechoo** — sudah berkembang JAUH
dari cuma "absensi karyawan" (awal proyek) jadi mencakup **konveksi
penuh**: produksi (BOM, SPK), stok bahan, pembelian, dan sekarang
sedang dibangun **Kasir/Pesanan** + **redesain dashboard desktop**.
Dipakai skala **~500 karyawan** (disebutkan di §44.17, lebih besar dari
perkiraan awal ~89-100).

- **Frontend**: Vue 3 CDN, tanpa build step.
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions di
  repo terpisah).
- **Hosting**: `gechoo.online` lewat GitHub Pages.
- **Repo**: `gechooco-ship-it/zevanic-erp-ui`.
- **Alur kerja kode**: file kode dikirim langsung ke folder
  **`F:\ZEVANIC HOUSE\FOUNDATION\Code`** di komputer Guru lewat koneksi
  perangkat (device bridge). Folder `Code` ini FLAT (semua file
  `.js`/`.html`/`.rules` langsung di root folder, TANPA subfolder `js/`)
  — beda dari struktur repo asli yang punya folder `js/`, jadi saat
  commit file ke sana namanya harus disesuaikan (buang prefix `js/`).
  Guru sendiri yang copy dari folder `Code` ke lokasi kerja repo asli
  lalu `git push`. Sapaan ke pengguna tetap **"Guru"**.
- **Folder `Mockup`** (`F:\ZEVANIC HOUSE\FOUNDATION\Mockup`, tersambung
  lewat device bridge) — berisi paket-paket design handoff (`.dc.html`
  + `README.md` + `github.md` + screenshot) DAN mockup artefak
  (`.html` link claude.ai/code/artifact), TERPISAH dari folder `Code`.
  Isinya referensi visual/spesifikasi, BUKAN kode produksi.

## 2. Cara kerja sebelum mengerjakan apapun (TIDAK BERUBAH dari versi awal)

1. Baca file ini dulu, lalu `STATUS-PROYEK-ARSIP.md` kalau butuh detail
   spesifik suatu fitur.
2. Baca `PRINSIP-HEMAT.md` + `PEDOMAN-GAYA-KERJA.md` — WAJIB diikuti.
3. **JANGAN PERCAYA** catatan "BELUM ditempel"/"BELUM dites" di section
   LAMA arsip tanpa cek dulu apakah ada section LEBIH BARU yang
   mengoreksi status itu — pola berulang di proyek ini, banyak fitur
   yang statusnya berubah beberapa kali (lihat §12 dst di Arsip).
4. **Kalau ada laporan bug**: JANGAN tebak-tebak — `git clone --depth 1
   https://github.com/gechooco-ship-it/zevanic-erp-ui.git` dulu ke
   sandbox buat baca kode LIVE yang sungguhan (lihat contoh nyata di
   §5.7 — bug "menu Pesanan tidak muncul" ketemu akar masalahnya dalam
   1 ronde `git clone` + `grep`, bukan dari tebakan). Sebelum menulis
   query Firestore baru, cek juga dulu POLA QUERY yang sudah terbukti
   jalan di modul terkait (lihat §5.9 — semua query dashboard Beranda
   desktop meniru pola yang SUDAH ada di layar aslinya masing-masing,
   bukan ditulis dari nol/tebakan).

## 3. Cara deploy

| Jenis file | Cara deploy |
|---|---|
| `.js`, `.html`, `.css`, `.md` (kode) | Folder `F:\ZEVANIC HOUSE\FOUNDATION\Code` di komputer Guru (lewat device bridge) — BUKAN Google Drive/upload manual GitHub |
| `firestore.rules` | Firebase Console → Firestore Database → Rules → Publish |
| `storage.rules` | Firebase Console → Storage → Rules → Publish (lokasi kerja: folder `Code` di komputer Guru, sama dengan `firestore.rules`) |

## 4. Alur Registrasi → Login — SUDAH DIREVISI LAGI (§12), beda dari desain awal

Desain SEBELUMNYA (dini hari 18 Agt, ada di Arsip §3.5): OTP dulu →
Admin buat akun dengan password sementara = NIK. **INI SUDAH DIGANTI**
di revisi ke-3 (§12): **password sekarang dibuat KARYAWAN SENDIRI**
saat registrasi (bukan lagi NIK yang di-generate Admin). Detail
lengkap alur revisi ke-3 ini ada di Arsip §12 — cek langsung ke situ
kalau perlu kerja di area ini.

OTP email (`vue-otp.js`) & instance Firebase kedua (Antrean Dakar)
kemungkinan besar KONSEPNYA masih dipakai, tapi ALUR PASTINYA mungkin
berubah menyesuaikan revisi password ini — **VERIFIKASI ke Arsip §12
sebelum sentuh alur ini**, jangan asumsi dari ringkasan ini saja.

## 5. Modul-modul BESAR yang sudah dibangun (18-30 Agt 2026) — per topik

### 5.1 Absensi lewat QR (HP Kiosk gudang) — §18, §19.x
Kiosk device khusus di gudang, karyawan scan QR + PIN buat Clock In/
Out tanpa perlu HP masing-masing. Banyak ronde bug-fix (PIN 2x,
Clock In/Out dobel, kartu sukses) — **berdasar catatan terakhir
semuanya FIXED & DIKONFIRMASI Guru**, tapi VERIFIKASI ke Arsip §19.11
untuk status paling akhir sebelum asumsi ini stabil.

### 5.2 Zevanic House — modul Konveksi (§20-§27, §33-§38)
Grup menu besar BARU, mencakup:
- **Master Bahan & Aksesoris** (§20) — data bahan baku, satuan/ukuran/warna.
- **Stock & Pembelian**: Alias Pembelian, List/Nota Order Belanja,
  Master Suplayer (§21), dengan banyak revisi lanjutan soal Konversi
  Banyak Tingkat, Harga Pembelian otomatis, dropdown nama+warna,
  Satuan bisa dipilih sesuai tingkat konversi (§25.7-§25.14).
- **Rak Penyimpanan** — awalnya 3 dropdown lepas (§24), DIROMBAK jadi
  menu tersendiri dengan Volume/kapasitas otomatis (§25.1, §25.3).
- **Lot/Roll & FIFO** — sempat 2 kali ganti pendekatan: FIFO OTOMATIS
  (§25.5) **DIGANTI** jadi FIFO SEBAGAI SARAN default + bisa pilih
  manual/scan (§25.6) — **§25.5 SUPERSEDED, jangan pakai sebagai
  acuan**. Termasuk fitur Scan Roll & Cetak Label Roll fisik.
- **Kartu Stok Bahan/Aksesoris** (§23.3) — ringkasan+detail per item.
- **Persiapan Masalah** (§21) — tempat "parkir" masalah stok kurang/
  belum diproses.
- **Config Data Komponen** (§33) — sumber data buat "Kelola Komponen"
  BOM Pola, GANTI dari cara lama (§34).
- **Import/Upload Massal Excel** untuk List Bahan & Aksesoris (§35) dan
  Data Komponen (§37), termasuk penyesuaian template (§36).

⚠️ **BANYAK bagian di 5.2 berlabel "BELUM DITES SAMA SEKALI" di
catatan aslinya** (terutama fitur fisik: scan kamera, cetak label —
Claude tidak bisa verifikasi ini dari sandbox). Jangan asumsi jalan
tanpa konfirmasi Guru.

### 5.3 Master Produk — Bill of Material/BOM (§28.x, §30-§32, §38, §45)
Sudah ada versi SUNGGUHAN (bukan cuma mockup):
- Entry Produk lengkap (BOM Jasa/Pola/Aksesoris/Vendor), file
  `vue-master-produk.js`.
- **SKU FULL OTOMATIS** (§32) — tidak perlu diketik manual lagi.
- Import/Export Excel (template + verifikasi + saran koreksi, §28.9).
- Config > Jenis Produk (§31), List Produk dengan checkbox + Hapus
  Massal (§30).
- Kode Webbing 2/3 di BOM Aksesoris: sempat dropdown, **DIGANTI** jadi
  input manual (§38).
- **Field `harga_jual`** (BARU §45, 30 Agt 2026) — dulu koleksi ini
  NOL field harga jual (murni data BOM/ongkos produksi), sekarang ada
  field harga jual polos buat kebutuhan Penjualan Kasir (lihat §5.7).

### 5.4 Persiapan Produksi V2 — pipeline SPK (§26, §43, §44.10-§44.25)
Fitur BESAR, paling banyak ronde pengerjaan: SPK Grouping, 5 jalur
paralel (Bahan/Sewing/Webbing/Finishing/Vendor), tiap jalur 5 tahap
(Scan Opname → Cetak Label → dst), driver Vendor (Scan Kirim/Sampai).
Dibangun bertahap Fase 1-5 (§44.13-§44.23), termasuk **audit besar
menemukan bug boros baca Firestore** (§44.15: Antrean Absensi tarik
SELURUH 942 dokumen `users` — sudah diperbaiki §44.17, plus bug N+1
lain §44.18). **Pelajaran ini yang dipakai acuan efisiensi query di
dashboard Beranda desktop baru, §5.9.**

Ada **checklist testing manual interaktif** (artifact HTML terpisah,
link di §44.25) — **BELUM ADA KONFIRMASI Guru bahwa testing ini
sudah dijalankan/lolos**.

⚠️ **Peringatan eksplisit dari catatan asli**: Firestore Rules untuk
`spk_track` **statusnya TIDAK SEJELAS** rules `spk_grouping` — WAJIB
dicek manual ke Firebase Console dulu sebelum asumsi sudah aktif. Ini
JUGA relevan buat dashboard Beranda desktop baru (§5.9) — KPI Pipeline
Persiapan baca `spk_track`, kalau rules-nya membatasi role tertentu,
KPI itu bisa tampil "–" (gagal baca) untuk role yang tidak diizinkan.

### 5.5 Redesign Mobile "Gechoo Mobile Organic" (§44.1-§44.9)
Gaya visual mobile baru (kartu/tombol/header), **pilot di Antrean
Absensi DISETUJUI Guru** (§44.5), lalu diterapkan ke 4 modul antrean
sekaligus (§44.8). Termasuk redesign Bottom Sheet Profil (beberapa
ronde koreksi, §44.6-§44.8) dengan toggle tema **Auto/Light/Dark**.
Home Mobile JUGA dirombak (§27, §27.1) — grid menu sekarang tarik
otomatis dari `DAFTAR_MENU` (bukan array terpisah yang gampang
ketinggalan update lagi), Shortcut lama diganti "Favorit Saya".
**Tampilan ini TIDAK ikut berubah sama sekali** oleh redesain desktop
di §5.9 — dua kerja yang sengaja dipisah total.

### 5.6 Role baru: PIC Owner (§29)
Untuk kelola keuangan LINTAS gudang per jenis usaha — belum sempat
saya baca detail lengkapnya, cek Arsip §29 kalau kerja di area Hak
Akses/Config Akses.

### 5.7 Menu "Pesanan" — Kasir & pipeline (§45) — **SUDAH DI-PUSH GURU, BUG MENU SUDAH DIPERBAIKI & DIKONFIRMASI LIVE**
Grup sidebar baru: Penjualan Kasir (POS, ganti nama dari "Order SPK"),
Menunggu Proses, Proses Persiapan, Proses Produksi, Proses Pengiriman.
File `vue-pesanan.js` (BARU), perubahan ke `vue-master-produk.js`
(tambah field `harga_jual`, lihat §5.3), `vue-config-akses.js`,
`index.html`, `dashboard.js`, `firestore.rules` (2 koleksi baru:
`transaksi_kasir`, `pengaturan_id_transaksi_kasir`).

**STATUS DEPLOY**: 6 file kode dikirim ke folder `Code`, dikonfirmasi
Guru sudah push ke GitHub (commit `004e592`). **Bug "menu Pesanan tidak
muncul"** (akar masalah: `#menu-pesanan` tidak pernah dicopot class
`hidden`-nya di `js/auth.js`/`aturTampilanBerdasarkanRole()`) **SUDAH
DIPERBAIKI, SUDAH DIKIRIM, DAN DIKONFIRMASI SUDAH LIVE** — dicek ulang
30 Agt 2026 malam via `git clone` fresh ke commit terbaru (`ad855fe`,
riwayat git di-squash Guru jadi 1 commit "dsfds" — isi file `auth.js`
byte-identik dengan fix yang dikirim, 52894 byte, jadi FIX INI SUDAH
AKTIF di `gechoo.online`).

**BLOCKER KERAS TERPISAH, BELUM DIKONFIRMASI SELESAI**: Firestore Rules
untuk 2 koleksi baru (`transaksi_kasir`, `pengaturan_id_transaksi_kasir`)
— sudah ada di `firestore.rules` yang dikirim, tapi **BELUM ADA
KONFIRMASI sudah di-Publish manual di Firebase Console**. Kasir tidak
akan bisa menulis transaksi sampai ini di-Publish. Fitur juga **BELUM
DIUJI SAMA SEKALI** ujung-ke-ujung di browser+Firebase sungguhan.

### 5.8 Paket design handoff Desktop — REFERENSI (implementasi asli lihat §5.9)
Lokasi: `F:\ZEVANIC HOUSE\FOUNDATION\Mockup\zevanic erp v1\design_handoff_zevanic_desktop\`
(komputer Guru, lewat device bridge). Berisi: `Zevanic Desktop.dc.html`
(varian A — dashboard operasional, YANG DIPAKAI), `Zevanic Desktop
Alternatif.dc.html` (varian B, TIDAK dipakai), `Zevanic Mobile
Organic.dc.html` (acuan bahasa visual mobile), `README.md` (spesifikasi
1440×900, design token, 7 layar), `github.md` (tabel padanan
menuId→file repo), `gechoo-seed.js`, 13 screenshot PNG. Sifatnya
referensi desain HIGH-FIDELITY (HTML/CSS/ikon Lucide di luar repo),
BUKAN kode produksi.

**Alur dari referensi ini ke kode asli**: paket handoff di atas → mockup
artefak interaktif "Zevanic Desktop Adaptasi" (vanilla JS, 3 ronde
revisi konten+warna, izin Guru "gass lanjut koding" 30 Agt 2026 malam)
→ **implementasi kode produksi sungguhan, lihat §5.9 di bawah**. Paket
handoff ini SEKARANG murni arsip referensi, bukan lagi "belum
diimplementasikan" — sebagian (Beranda) SUDAH.

### 5.9 Implementasi Redesain Desktop — Beranda (BARU, 30 Agt 2026 malam) — **KODE DITULIS & DIKIRIM, BELUM DI-PUSH GURU, BELUM DIUJI**

**Izin & keputusan Guru** (AskUserQuestion, 30 Agt 2026): (1) cakupan
sesi ini = Beranda dashboard PENUH (bukan cuma shell kosong, bukan
juga sekalian Kasir desktop); (2) Pipeline Produksi (jalur Cutting/
Serie/Sewing/Finishing) UI-only dulu, placeholder "Segera Hadir", BELUM
ada skema data — jangan bikin skema baru dulu; (3) "Serie" = proses
PENGGABUNGAN dari Bahan + Acc Sewing + Acc Webbing + Acc Vendor (kalau
ada) — dicatat buat referensi kalau nanti skema aslinya dibangun; (4)
warna kartu KPI & Quote pakai gradien maroon (`.gc-kartu-gradien`,
sama seperti kartu shift), KHUSUS Beranda desktop — lihat pengecualian
di `PETA-DESAIN.md`. Mobile TIDAK BOLEH ikut berubah.

**File yang diubah** (dikirim ke folder `Code`, 30 Agt 2026 malam):
- `index.html` — sidebar (`.gc-sidebar`) & header lama diganti topbar
  baru (`.gc-topbar-desktop` + lonceng notifikasi Pengumuman); `#tab-home`
  tidak lagi ke-max-width mobile di level atas (bug lama, dashboard
  desktop kepaksa selebar mobile — sudah diperbaiki); mount lama
  `#vue-pengumuman-desktop`/`#vue-quote-desktop` DICOPOT, ganti
  `#vue-beranda-desktop`.
- `css/gechoo-design.css` — `.gc-sidebar`/`.gc-side-brand` ganti warna
  (pink→ivory/putih, lihat `PETA-DESAIN.md`), + class baru topbar/notif/
  dashboard (`.gc-topbar-desktop`, `.gc-notif-*`, `.gc-dash-grid`,
  `.gc-kpi-*`, `.gc-pipeline-*`, `.gc-tindak-*`, `.gc-quote-desktop`).
- `js/vue-home-desktop.js` — DITULIS ULANG TOTAL. Dulu cuma mount
  `PengumumanCarousel`+`QuoteCard` (masih dipakai MOBILE, `vue-home.js`,
  TIDAK diubah), sekarang komponen `BerandaDesktop` penuh: 4 KPI
  (Persiapan Masalah/Antrean Dakar/Antrean Absensi/Antrean Reimburse),
  Pipeline Persiapan (6 kartu, data REAL dari `order_spk`+`spk_track`),
  Pipeline Produksi (placeholder, TIDAK baca Firestore), Perlu Tindakan
  Anda, kartu Quote (data sama `QuoteCard`, warna beda), lonceng
  notifikasi (pola sama `vue-header-mobile.js`, share key `localStorage`
  "sudah dibaca" dengan mobile). **Baca komentar besar di atas file itu
  — daftar lengkap keputusan & aproksimasi query, jangan diulang di sini.**

**Efisiensi Firestore (sesuai pelajaran §5.4/§6)**: SEMUA KPI pakai
`getCountFromServer()` (1 baca per query, bukan tarik dokumen), KECUALI
"Perlu Disiapkan" (tetap `getDocs()`, meniru persis query layar aslinya
yang butuh filter client-side). Query per-jalur Pipeline Persiapan
SENGAJA 4× `where(jalur=='x').where(status=='y')` terpisah per jalur
(bukan 1 query pakai `where('status','in',[...])`) — supaya PASTI
kompatibel dengan index Firestore yang SUDAH ada (pola equality-only,
sama seperti `JalurTahapManager`), tanpa perlu Guru bikin composite
index baru.

**~~SENGAJA TIDAK dibangun~~ — DIBALIK di §5.9b** (histori keputusan,
DIPERTAHANKAN buat konteks): awalnya kartu "Aktivitas Terbaru" & 
"Pintasan Papan Tik" sengaja tidak dibangun (keputusan sendiri, supaya
tidak ada data palsu di produksi — tidak ada koleksi log lintas-modul
di skema data sungguhan, dan command palette Ctrl+K sendiri belum ada
di app). **Guru secara eksplisit minta dibangun** di sesi lanjutan
(lihat §5.9b) — sekarang KEDUA kartu itu ADA di kolom kanan, isinya
tetap konten statis/ilustratif (dinyatakan jujur di komentar kode),
BUKAN diam-diam dianggap data live.

**BELUM DILAKUKAN / BELUM DIVERIFIKASI (WAJIB dicek sesi berikutnya)**:
1. Guru belum copy file-file di atas (3 file ronde pertama + 4 file
   ronde lanjutan §5.9b, ada overlap `index.html`/`css`/`vue-home-
   desktop.js` — total tetap 4 file unik + `js/auth.js`) dari folder
   `Code` ke repo kerja & `git push` — sama seperti fitur Pesanan,
   deploy BUKAN otomatis.
2. **BELUM DIUJI SAMA SEKALI** di browser+Firebase sungguhan — Claude
   tidak bisa menguji ini dari sandbox. Yang PALING perlu dicek Guru:
   apakah KPI/Pipeline tampil angka benar (bukan "–" terus, tanda gagal
   baca — kemungkinan besar karena role user yang login tidak diizinkan
   `firestore.rules` baca salah satu koleksi `persiapan_masalah`/
   `pendaftaran_pending`/`absensi`/`reimburse`/`order_spk`/`spk_track` —
   lihat peringatan §5.4 soal rules `spk_track`), apakah lonceng
   notifikasi jalan (buka/tutup, badge, tandai dibaca), apakah layout
   sidebar+topbar+dashboard terlihat rapi di lebar layar sungguhan
   (bukan cuma di preview mockup).
3. TIDAK ADA perubahan `firestore.rules` di kerja ini (semua koleksi
   yang dibaca dashboard sudah ada rules-nya dari fitur lain) — tapi
   BELUM diverifikasi apakah rules yang ada mengizinkan SEMUA role baca
   cukup buat KPI tampil untuk semua orang (lihat poin 2 di atas).
4. Firestore index: TIDAK butuh index composite baru (lihat penjelasan
   efisiensi di atas) — tapi ini asumsi berdasar baca kode, bukan
   dites langsung ke Firebase Console sungguhan.

### 5.9b Revisi lanjutan Beranda desktop — topbar breadcrumb, Kartu Absen, Aktivitas Terbaru, Pintasan Papan Tik (BARU, 30 Agt 2026, sesi lanjutan) — **KODE DITULIS & DIKIRIM, BELUM DI-PUSH GURU, BELUM DIUJI**

Guru kirim screenshot topbar live (`gechoo.online`), minta 4 hal
eksplisit: "jam shift dan erp portal hapus ganti dengan yg sesuai
mockup, lalu kartu absen dari mobil bisa diambil tempel di dashboard.
aktifitas terbaru tampilkan mockup dan pintasan keyboard juga. anggap
mockup yg dilivekan."

**Yang diubah**:
1. **Topbar** (`index.html`) — h2 "ERP Portal" + badge `#label-badge-
   role` (diisi `dashboard.js` `mulaiHitungJamKerja()`, countdown
   shift HARDCODE "01:00" utk SEMUA orang — tidak akurat) DICOPOT.
   Diganti breadcrumb statis `.gc-crumb` ("Umum › Beranda", persis
   gaya mockup) — statis karena baru Beranda yang punya versi
   desktop, belum ada routing breadcrumb dinamis per-layar.
2. **Kartu Absen** (kolom kanan, paling atas, `js/vue-home-
   desktop.js`) — **REAL**, bukan ilustratif. "Diambil tempel" dari
   kartu shift mobile: logic sama persis `muatShift()`+
   `window.cekStatusClockInSaya()` (`js/vue-home.js`), style reuse
   `.gc-kartu-gradien`/`.gc-pil-status`/`.gc-deco-lingkaran` (class
   lama, TIDAK direka ulang). Read-only, TANPA tombol Clock In/Out
   (clock in/scan QR tetap di app mobile — sesuai teks keterangan di
   kartu itu sendiri).
3. **Aktivitas Terbaru** & **Pintasan Papan Tik** (kolom kanan,
   bawah Quote) — **DIBANGUN**, membalik keputusan §5.9 yang tadinya
   sengaja tidak. **Isinya KONTEN STATIS/ILUSTRATIF** (persis isi
   mockup, konstanta `AKTIVITAS_ILUSTRATIF`/`PINTASAN_ILUSTRATIF` di
   `js/vue-home-desktop.js`), BUKAN data live — tidak ada koleksi log
   aktivitas lintas-modul di skema data sungguhan (`PETA-DATABASE.md`)
   dan tidak ada command palette Ctrl+K sungguhan di app ini. Kalau
   nanti mau versi live beneran, itu kerjaan terpisah (perlu koleksi
   log baru), belum diminta.
4. **`js/auth.js`** — baris pengisi `#label-badge-role`.innerHTML
   (`aturTampilanBerdasarkanRole()`) diberi **null-guard** (dulu
   unconditional, akan crash begitu elemen itu dicopot dari DOM).
   `js/dashboard.js` `mulaiHitungJamKerja()` TIDAK perlu diubah — sudah
   null-guard dari awal, sekarang otomatis no-op karena elemennya
   sudah tidak ada.

**File yang dikirim ulang ke folder `Code`**: `index.html`,
`css/gechoo-design.css` (tambah `.gc-crumb`, `.gc-absen-desktop`,
`.gc-aktivitas-*`, `.gc-pintasan-*`), `js/vue-home-desktop.js`,
`js/auth.js`. Ukuran byte dikonfirmasi cocok persis antara yang
dikirim & yang tertulis di folder `Code` (`device_list_dir`).

**BELUM DILAKUKAN / BELUM DIVERIFIKASI** — SAMA seperti §5.9: belum
di-push Guru ke repo, belum diuji sama sekali di browser+Firebase
sungguhan. Yang PALING perlu dicek Guru kali ini: breadcrumb tampil
benar (bukan kosong/error), Kartu Absen tampil jam shift+status
absen yang BENAR (bukan kartu kosong — kartu ini `v-if="shiftAbsen.
nama"`, jadi kalau `master_shift`/`nama_shift` user tidak ketemu,
kartu ini TIDAK tampil sama sekali, bukan error diam-diam), dan
Aktivitas Terbaru/Pintasan Papan Tik jangan disalahsangka data asli
oleh siapapun yang lihat (isinya memang statis).

## 6. Bug besar & pelajaran BARU (selain yang sudah ada di versi awal)

- **Sidebar desktop minimize/maximize tidak jalan** (§44.26) — akar
  masalah: elemen HTML punya `style="display:flex"` inline SEKALIGUS
  class `hidden` — inline style SELALU menang mutlak dari CSS
  eksternal manapun. **Akibat sampingan yang baru ketahuan**: SEMUA
  tombol parent grup sidebar (termasuk yang harusnya cuma Owner/
  Superuser) ternyata SELALU tampil ke SEMUA role dari sisi tampilan
  (walau kemungkinan tetap ke-block di lapisan lain). Kalau nambah
  elemen yang mau disembunyikan pakai `hidden`, JANGAN kasih inline
  `style="display:..."` di elemen yang sama.
- **Bug boros N+1 & full-collection-scan** (§44.15-§44.18) — di skala
  ~500 karyawan sungguhan, pola "ambil semua lalu saring di JS" yang
  dulu terasa "cukup aman" di skala kecil, ternyata jadi **86 ribu
  baca/hari**. Pelajaran: prinsip hemat di `PRINSIP-HEMAT.md` BUKAN
  cuma teori, terbukti jadi masalah nyata begitu skala pengguna naik.
  **Diterapkan langsung di dashboard Beranda desktop baru (§5.9)** —
  semua KPI pakai `getCountFromServer()`, bukan tarik dokumen penuh.
- **Menu grup top-level baru lupa didaftarkan ke gerbang role di
  `auth.js`** (§45, 30 Agt 2026) — begitu bikin grup sidebar top-level
  BARU (sejajar Zevanic House/Persiapan Produksi), WAJIB SEKALIAN
  tambahkan elemen tombolnya ke `window.aturTampilanBerdasarkanRole()`
  di `js/auth.js` (masuk daftar reset `hidden` + dicopot untuk role
  yang berhak) — kalau lupa, class `hidden` bawaan di `index.html`
  TIDAK PERNAH tercopot untuk role manapun, menu jadi tidak pernah
  muncul walau semua file lain (routing, mount, Vue component) sudah
  benar. Ini KELAS BUG YANG SAMA POTENSInya terulang lagi kalau bikin
  grup top-level baru lagi ke depan — cek checklist ini SETIAP kali.

## 7. Yang PALING PENTING diverifikasi sesi berikutnya

1. **Tanya Guru**: apakah file redesain Beranda desktop (§5.9 + revisi
   lanjutan §5.9b — topbar breadcrumb, Kartu Absen, Aktivitas Terbaru,
   Pintasan Papan Tik) sudah di-copy ke repo & di-push? Kalau sudah,
   MINTA Guru tes langsung di `gechoo.online` (KPI/Pipeline/lonceng/
   layout/breadcrumb/Kartu Absen) — ini prioritas verifikasi
   TERTINGGI sekarang, belum ada satupun konfirmasi visual.
2. **Publish Firestore Rules fitur Pesanan** (`transaksi_kasir`,
   `pengaturan_id_transaksi_kasir`) di Firebase Console — masih belum
   dikonfirmasi selesai (lihat §5.7).
3. **Cek Arsip §12** untuk alur Registrasi/Login yang BENAR (bukan
   §3.5 yang sudah superseded).
4. Banyak fitur di §5.2/§5.4 berlabel "BELUM DITES" — jangan asumsikan
   stabil tanpa tanya konfirmasi testing terbaru ke Guru.
5. Kalau Guru mau lanjut redesain desktop ke layar LAIN (Kasir, dst)
   setelah Beranda dikonfirmasi jalan — itu sesi terpisah, belum mulai.

---

*File ini TIDAK mencakup detail teknis penuh (field-per-field,
kode-per-kode) untuk topik di atas — itu semua ada lengkap di
`STATUS-PROYEK-ARSIP.md`, cari pakai nomor section (§) yang dirujuk
di atas.*
