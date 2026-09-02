# PEDOMAN GAYA KERJA — Zevanic/Gechoo ERP

> Bukan soal aturan teknis (itu di 7 file lainnya) — ini soal CARA
> KERJA & GAYA BAHASA supaya cepat, konsisten dengan sesi-sesi
> sebelumnya. Kalau terasa lambat membuat file, cek ini dulu.

---

## Prinsip utama: **kerjakan dulu, jelaskan secukupnya**

Yang bikin lambat biasanya BUKAN kecepatan menulis kode-nya, tapi
**terlalu banyak teks di SEKITAR kode** — penjelasan panjang sebelum
mulai, narasi "langkah yang akan saya ambil", atau ulasan panjang
setelah selesai yang mengulang apa yang baru saja dilakukan.

### ❌ Contoh gaya LAMBAT (jangan ditiru)
> "Baik, saya akan membantu Anda membuat fitur ini. Untuk melakukan ini
> dengan baik, saya perlu terlebih dahulu memahami konteks project
> secara menyeluruh. Pendekatan yang akan saya ambil adalah: (1)
> menganalisis struktur yang sudah ada, (2) mempertimbangkan beberapa
> alternatif desain, (3) memilih pendekatan terbaik berdasarkan
> prinsip-prinsip yang sudah ditetapkan, (4) mengimplementasikan dengan
> hati-hati sambil mempertimbangkan edge case, dan (5) memvalidasi hasil
> akhir. Mari kita mulai dengan langkah pertama..."

### ✅ Contoh gaya CEPAT (yang dipakai sepanjang project ini)
> "Baik, saya cek dulu strukturnya." *(langsung jalankan tool, bukan
> dijelaskan dulu)* → *(lihat hasil)* → *(langsung edit)* → "Selesai,
> sudah divalidasi." *(1-2 kalimat penutup, bukan paragraf)*

**Bedanya**: versi cepat LANGSUNG bertindak, penjelasan cuma muncul
kalau memang ada keputusan yang perlu diketahui pengguna (misal:
kenapa 1 pendekatan dipilih dibanding lainnya, atau ada risiko yang
perlu diketahui) — bukan menceritakan ULANG proses yang sudah jelas
dari tool call itu sendiri.

---

## Kapan BOLEH panjang, kapan HARUS singkat

**Boleh (bahkan harus) panjang:**
- Menjelaskan KEPUTUSAN ARSITEKTUR yang berdampak luas (seperti pemisahan `role`/`profil_akses` — itu butuh penjelasan supaya dipahami)
- Memberi PERINGATAN soal risiko keamanan/data
- Merangkum pekerjaan besar di akhir sesi panjang

**Harus singkat:**
- Konfirmasi "saya cek dulu" sebelum tool call — 1 kalimat, tidak perlu daftar langkah
- Validasi selesai — "Valid, sudah dites" cukup, tidak perlu jelaskan ULANG apa yang divalidasi
- Perubahan kecil/rutin (ubah 1 warna, ubah 1 teks) — langsung kerjakan, laporan 1 baris

---

## Soal TOOL CALL — ini yang paling memengaruhi kecepatan SUNGGUHAN

1. **Pakai `str_replace` untuk ubah SEBAGIAN file**, JANGAN hapus+tulis
   ulang seluruh file kalau cuma 1-2 bagian yang berubah. Menulis ulang
   file 300 baris cuma untuk ubah 5 baris itu boros waktu DAN boros
   risiko salah ketik ulang bagian yang seharusnya tidak berubah.
2. **Validasi 1 KALI yang menyeluruh**, jangan validasi berulang-ulang
   untuk hal yang sama. Pola yang dipakai sepanjang project ini:
   `node --check` (sintaks) + hitung `<div`/`</div>` (kalau ada HTML)
   — itu SUDAH CUKUP, tidak perlu baca ulang seluruh file berkali-kali
   "buat memastikan".
3. **Cek fakta lewat tool, jangan jelaskan rencana cek fakta.** Contoh:
   kalau ragu field apa yang ada di suatu collection, langsung `grep`
   file terkait — jangan tulis paragraf "saya akan memeriksa dulu
   struktur data yang relevan untuk memastikan...".

---

## Kapan menulis ke `STATUS-PROYEK.md` / `PETA-*.md` — 1x per FITUR SELESAI (disepakati Guru 27 Agt 2026)

Nulis ke dokumen `Claude/` (`STATUS-PROYEK.md`, `PETA-DATABASE.md`,
`PETA-MENU.md`, dst) itu ADA BIAYANYA — beda dari edit file kode biasa,
tool project docs TIDAK PUNYA mode "tempel di tengah" (`str_replace`),
jadi tiap nulis HARUS baca SELURUH isi file dulu, susun ulang, baru
tulis balik SELURUHNYA. Untuk file besar (`PETA-DATABASE.md`,
`STATUS-PROYEK.md`, ratusan-ribuan baris) ini beban token & waktu yang
nyata kalau dilakukan tiap 1 perubahan kecil.

**Aturan (disepakati Guru 27 Agt 2026)**: tulis dokumen `Claude/` **1x
per FITUR/PEKERJAAN yang BENAR-BENAR SUDAH SELESAI** dikerjakan
(semua file kode-nya sudah diedit & divalidasi) — BUKAN tiap 1 file
kode berubah, dan BUKAN pula ditunda sampai sesi mau berakhir/context
mau penuh ("dipadatkan"). 2 alasan kenapa BUKAN yang kedua:
1. Proses "memadatkan percakapan" (compaction) itu OTOMATIS dari
   sistem, dipicu sendiri kapan context hampir penuh — Claude TIDAK
   dapat sinyal "sebentar lagi dipadatkan, tulis dulu sekarang", baru
   tahu SETELAH kejadian. Jadi tidak bisa dijadikan pemicu yang
   diandalkan.
2. Kalau 1 sesi selesai tugasnya SEBELUM context penuh (compaction
   TIDAK PERNAH terjadi sepanjang sesi itu) — dokumen jadi TIDAK
   PERNAH tertulis sama sekali. Sesi berikutnya (atau Guru sendiri)
   akan baca dokumen yang ketinggalan, padahal kode sudah berubah.

**Contoh pola yang BENAR** (dipakai redesain Home mobile §27): 5 file
kode (`vue-config-akses.js`, `vue-components.js`, `vue-home.js`,
`vue-header-mobile.js`, `index.html`) diedit & divalidasi SEMUA dulu
sampai fitur itu utuh selesai dikirim ke Guru — BARU SETELAH ITU, 1x
tulis ke `STATUS-PROYEK.md` + `PETA-DATABASE.md` + `PETA-MENU.md`
(masing-masing 1x tulis, isinya rangkuman fitur yang sudah selesai).
BUKAN nulis dokumen di tengah-tengah tiap 1 file kode kelar diedit.

**Kalau fitur MASIH separuh jalan/belum final** (misal Guru minta
jeda dulu, atau sesi terputus di tengah sebelum semua file kode
selesai) — dokumen `Claude/` BOLEH BELUM ditulis, TAPI begitu sesi mau
berhenti/pekerjaan mau dianggap "selesai" (dikirim ke Guru), WAJIB
sudah tertulis SEBELUM sesi itu berakhir — jangan mengandalkan
compaction atau sesi berikutnya buat menuliskannya.

---

## CARA menulis ke `STATUS-PROYEK.md` — GANTI bagian lama, JANGAN TUMPUK

Ini pelajaran nyata dari kejadian: `STATUS-PROYEK.md` sempat membengkak
jadi **11.170 baris** (dari 72 "Riwayat sebelumnya" yang terus
ditambahkan, bukan diganti) — sampai titik dokumen itu sendiri
menuliskan peringatan ke dirinya sendiri: *"JANGAN percaya catatan
'BELUM ditempel' di riwayat manapun di bawah — SEMUANYA SUDAH BASI"*.
Itu tanda dokumennya sudah gagal fungsi (harusnya jadi rujukan cepat,
malah jadi harus dibaca ekstra hati-hati karena isinya saling
bertentangan).

**Akar masalahnya BUKAN cuma kebiasaan** — seperti dijelaskan di atas,
tool penulisan dokumen ini HARUS baca+tulis ulang SELURUH file tiap
kali (tidak ada `str_replace`). Karena itu, godaannya jadi: "sudah
terlanjur baca semua, tinggal tambah 1 paragraf baru di paling atas,
tidak usah repot-repot cari & ubah bagian lama yang relevan". Padahal
selisih usahanya KECIL — karena SELURUH isi file SUDAH ada di
tangan (baru dibaca), mengubah bagian yang relevan sama sekali TIDAK
menambah biaya baca lagi, cuma menambah sedikit usaha SAAT MENULIS.

**Aturan konkretnya**:
1. **Kalau status/keputusan yang DITULIS SEBELUMNYA berubah** — cari
   section LAMA yang membahas itu, **EDIT LANGSUNG isinya** jadi status
   terbaru. JANGAN tulis section/paragraf BARU yang isinya "dulu X,
   sekarang Y" ditumpuk di tempat lain — itu yang bikin 1 topik punya
   BANYAK versi cerita tersebar di banyak tempat, saling
   membingungkan.
2. **"Terakhir diperbarui" di paling atas: GANTI isinya, bukan ditambah
   DI ATAS yang lama.** Isinya cukup: tanggal + 1-3 kalimat apa yang
   baru saja selesai. Kalau baris itu mulai lebih dari ~5 kalimat, itu
   pertanda sedang "menumpuk" bukan "mengganti" — berhenti, cek lagi.
3. **Proses/diskusi step-by-step (ronde koreksi, bolak-balik keputusan,
   detail teknis SANGAT rinci) TIDAK perlu masuk `STATUS-PROYEK.md`
   sama sekali** — itu levelnya "arsip", bukan "status". Kalau memang
   ingin disimpan buat jaga-jaga, taruh di file `STATUS-PROYEK-ARSIP.md`
   terpisah (dokumen INI TIDAK WAJIB dibaca tiap sesi, beda dari
   `STATUS-PROYEK.md`).
4. **Test cepat sebelum menyimpan**: kalau 1 topik/fitur muncul di
   LEBIH DARI 1 tempat di `STATUS-PROYEK.md` dengan status yang BEDA
   (satu bilang "belum", satu lagi bilang "sudah") — itu SALAH, gabung
   jadi 1 tempat saja dengan status TERBARU sebelum menyimpan.
5. **Kalau `STATUS-PROYEK.md` mulai kerasa berat/panjang** (jadi ratusan
   baris ke atas) — itu sinyal sudah waktunya pisahkan bagian yang
   sifatnya SEJARAH/SUDAH SELESAI TOTAL ke `STATUS-PROYEK-ARSIP.md`,
   sisakan yang MASIH aktif relevan saja di file utama. Jangan tunggu
   sampai sesi 11 ribu baris seperti yang sudah terjadi.

---

## Batas "sudah divalidasi" — JANGAN OVERCLAIM

Sandbox yang tersedia **TIDAK BISA menjalankan aplikasi Vue+Firebase
ini sungguhan** (butuh browser asli + koneksi Firebase project yang
hidup, dua-duanya tidak ada di sini). Supaya tidak salah bilang
"sudah teruji" padahal cuma sebagian kecil yang benar-benar teruji,
pahami 3 tingkatnya:

**✅ PASTI bisa, WAJIB dilakukan tiap edit**: cek sintaks (`node
--check` buat JS, Babel buat JSX), hitung kurung/tag seimbang
(`{}`/`()`/`<div>`), cek ID HTML tidak dobel. Ini cuma BUKTIKAN "tidak
ada typo/kepotong" — SAMA SEKALI BELUM membuktikan logikanya benar.

**✅ Bisa, dan SEBAIKNYA dilakukan buat fungsi logic PENTING**: kalau
ada fungsi yang murni "input → proses → output" TANPA butuh
Firebase/browser (contoh nyata di project ini: `hitungJamKeluarUntukGaji`
di `vue-camera.js`, `parseWaktuIndo`, logic paginasi) — bisa benar-benar
DIJALANKAN pakai Node dengan beberapa contoh input, dicek hasilnya
sesuai harapan atau tidak. Ini BEDA dari sekadar cek sintaks — ini
benar-benar membuktikan LOGIKANYA jalan benar. **Utamakan cara ini
untuk logic yang menyangkut uang/keamanan** (lihat "1 pengecualian
penting" di bawah).

**❌ TIDAK BISA sama sekali** — jangan pernah klaim ini "sudah
dites": tampilan sungguhan di browser, baca/tulis Firestore beneran,
email OTP benar-benar terkirim, klik tombol/isi form sungguhan,
keamanan Security Rules SESUNGGUHNYA (butuh Firebase Emulator, tidak
tersedia). **Ini yang WAJIB diserahkan ke pengguna untuk dites manual**
— jangan pernah bilang "sudah saya pastikan berfungsi" untuk hal-hal
ini, bilang jujur "ini perlu dites langsung, saya cuma bisa pastikan
sintaksnya benar".

---

## Contoh nyata dari project ini (pola yang TERBUKTI cepat)

Sepanjang malam pembangunan fitur ini, pola yang konsisten dipakai:

```
[baca kode terkait pakai grep/view — cepat, tanpa penjelasan panjang]
[1 kalimat: apa yang ditemukan/mau dilakukan]
[str_replace langsung — edit yang presisi, bukan tulis ulang]
[validasi: node --check + hitung tag]
[1-3 kalimat: ringkasan hasil + file yang perlu diperhatikan]
```

Bandingkan dengan pola LAMBAT yang harus dihindari:
```
[paragraf panjang menjelaskan rencana]
[paragraf lagi menjelaskan pertimbangan]
[baru mulai kerja]
[paragraf panjang menjelaskan apa yang baru dikerjakan]
[paragraf lagi merangkum ulang]
```

---

## PENEGASAN KHUSUS: mengurai masalah, cari solusi, cari data — 3 hal yang PALING SERING bikin lambat

Ini bukan cuma "usahakan cepat" — ini ATURAN KONKRET yang harus diikuti.

### 1. Mengurai masalah (diagnosa) — JANGAN mikir dulu, CEK dulu

❌ **Pola LAMBAT**: "Ada beberapa kemungkinan penyebab masalah ini.
Pertama, bisa jadi karena X. Kedua, mungkin juga Y. Ketiga, tidak
menutup kemungkinan Z. Mari kita telusuri satu-satu untuk memastikan
mana yang benar..." *(baru setelah itu mulai cek)*

✅ **Pola CEPAT (WAJIB)**: Begitu ada masalah, **langsung tebak
KEMUNGKINAN PALING BESAR** berdasarkan gejalanya (bukan didaftar
panjang di teks) → **1 tool call buat verifikasi tebakan itu** (grep,
view, node --check) → kalau BENAR, langsung perbaiki. Kalau SALAH,
langsung tebakan berikutnya, TANPA menulis paragraf "kemungkinan lain
adalah..." — cukup coba lagi dengan tool.

**Prinsip**: teks penjelasan ditulis SETELAH ketemu jawabannya (buat
laporan ke pengguna), BUKAN SEBELUM (buat "mikir keras-keras" di
depan pengguna). Proses coba-coba itu terjadi lewat tool call yang
CEPAT beruntun, bukan lewat paragraf yang panjang.

### 2. Cari solusi — PAKAI POLA YANG SUDAH ADA, jangan didesain ulang

❌ **Pola LAMBAT**: Setiap ada kebutuhan baru, mempertimbangkan dari
nol beberapa pendekatan berbeda, menimbang plus-minus tiap pendekatan
secara tertulis, baru memutuskan.

✅ **Pola CEPAT (WAJIB)**: **Cek dulu apakah pola serupa SUDAH ADA**
di project ini (lihat `PETA-MENU.md`/`PETA-DATABASE.md`/kode yang
sudah ada) — kalau ada, **PAKAI ULANG pola itu langsung**, jangan
didesain ulang dari nol. Contoh: kalau bikin tabel baru, sudah ada
pola paginasi (`vue-paginasi.js`) — TIDAK PERLU mikir ulang cara
paginasi dari awal, tinggal pakai. Kalau bikin tombol approve/reject
baru, sudah ada pola di `vue-antrean-*.js` — contek pola yang sama.

**Cuma boleh berhenti dan pertimbangkan beberapa opsi** kalau memang
BENAR-BENAR belum ada pola serupa DAN keputusannya berdampak luas
(structural, keamanan, biaya) — bukan untuk hal kecil/rutin.

**Pengecualian khusus keputusan MENU yang kompleks (disepakati Guru
31 Agt 2026, DITEGASKAN LAGI oleh Guru hari yang sama: "kalau menurut
kamu komplek langsung interupsi saya yah guru")**: kalau kebutuhannya
soal **desain/susunan menu yang kompleks dan ambigu** (contoh nyata:
berapa banyak grup menu yang tampil di Beranda, urutan/posisi tombol
navigasi) — **JANGAN tebak-tebak sendiri lalu langsung eksekusi**, dan
JANGAN pula diam-diam mengerjakan dulu baru nanya belakangan. Begitu
Claude MENILAI SENDIRI suatu keputusan menu itu kompleks/ambigu,
**LANGSUNG INTERUPSI Guru saat itu juga** — tanyakan (via
`AskUserQuestion` atau langsung di chat) apakah Guru mau kirim
wireframe dulu, JANGAN tunggu Guru yang harus ingat duluan menyiapkan
wireframe. Penilaian "kompleks atau tidak" itu keputusan Claude
sendiri (bukan cuma nunggu Guru bilang "ini kompleks") — begitu ada
tanda ambigu (bisa ditafsirkan lebih dari 1 cara masuk akal, dampaknya
ke banyak layar/komponen sekaligus, atau riwayat sebelumnya
menunjukkan tebakan Claude soal ini sering meleset), itu sudah cukup
jadi alasan untuk interupsi — TIDAK PERLU menunggu lebih yakin lagi
sebelum bertanya. Untuk perubahan menu yang KECIL/jelas (ubah 1 label,
pindah 1 tombol ke posisi yang sudah jelas diminta) — aturan ini TIDAK
berlaku, langsung kerjakan seperti biasa tanpa interupsi.

### 3. Cari data — TOOL DULU, BACA SELURUHNYA BELAKANGAN (kalau perlu)

❌ **Pola LAMBAT**: Buka & baca seluruh isi file besar dari atas ke
bawah untuk mencari 1 informasi kecil. Atau: tanya ke pengguna hal
yang sebenarnya bisa langsung dicari sendiri lewat grep.

✅ **Pola CEPAT (WAJIB)**:
- Butuh tahu 1 hal spesifik di 1 file besar? **`grep` dengan kata
  kunci spesifik dulu**, BUKAN `view` seluruh file.
- Butuh tahu struktur project/keputusan lama? **Cek `PETA-*.md` dulu**
  (sudah diringkas), BUKAN baca ulang seluruh riwayat percakapan lama.
- Butuh tahu isi database/field? **Cek `PETA-DATABASE.md` dulu**,
  BUKAN tanya ke pengguna "field apa yang ada di collection ini?"
- Kalau `PETA-*.md` TIDAK punya jawabannya (informasinya memang
  belum tercatat) — BARU grep langsung ke kode, dan SETELAH ketemu,
  pertimbangkan menambahkan ke `PETA-*.md` yang relevan supaya tidak
  perlu dicari ulang lagi nanti oleh sesi berikutnya.

---

## WAJIB dicek tiap bikin menu baru / edit sub-tab menu lama — riwayat browser (tombol back HP)

Keputusan Guru (lihat `STATUS-PROYEK.md` §22 buat rencana desain teknis
lengkapnya — bagian ini cuma CHECKLIST ringkas):

- **Menu BARU** yang dibangun mulai sekarang → WAJIB langsung pakai
  sistem riwayat browser (`pindahSubTab(..., {catatRiwayat:true})` +
  atribut `data-target` di tiap tombol sub-tab/child-tab-nya) dari awal
  dibangun, BUKAN ditunda ke ronde revisi terpisah.
- **Menu LAMA yang KEBETULAN sedang disentuh/diedit** (alasan apapun —
  bug fix, revisi tampilan, tambah fitur di layar itu) → SEKALIAN
  ditambahkan sistem ini SAAT ITU JUGA, jangan ditunda.
- **JANGAN retrofit massal** ke SEMUA menu lama sekaligus dalam 1 ronde
  — itu TIDAK diminta Guru, cuma bertahap ikut 2 pemicu di atas.
- Cakupannya WAJIB sampai level **Child-tab** (bukan cuma Sub-menu
  sidebar) — Guru pilih opsi yang lebih dalam, bukan opsi minimal.
- Ikuti PERSIS desain teknis di `STATUS-PROYEK.md` §22.3 (opt-in lewat
  parameter ke-4 `pindahSubTab`, snapshot state gabungan, listener
  `popstate` yang diperluas) — supaya konsisten antar menu, tidak
  didesain ulang beda-beda tiap kali menyentuh menu berbeda.
- Menu yang SUDAH dibangun sebelum keputusan ini (termasuk semua
  Zevanic House yang ada sekarang, Riwayat Harga Pembelian yang baru
  saja jadi) **SENGAJA TIDAK diubah** kecuali nanti memang disentuh
  lagi untuk alasan lain.

---

## WAJIB dicek tiap bikin/edit menu DESKTOP — kartu ivory kontras dari latar putih (`.gc-card-menonjol`, disepakati Guru 31 Agt 2026)

Sejak "Redesain Desktop Beranda" (30 Agt 2026), area `<main>` desktop
(`.gc-main-desktop`, ≥768px) punya latar **PUTIH** (`var(--surface)`)
— TERPISAH dari latar `<body>`/`.gc-app` yang tetap ivory (dipakai
MOBILE). Tujuannya supaya kartu di dalamnya (ivory) kelihatan
MENONJOL dari latar konten, bukan menyatu jadi 1 warna. Guru sempat
mengira ini "belum diimplementasikan" (31 Agt 2026) — dicek ulang,
TERNYATA sudah benar di Beranda, tapi **belum diterapkan ke submenu
lain** yang masih pakai `.gc-card` polos (latar `var(--surface)`,
SAMA PUTIH dengan `<main>` desktop) — jadi kartunya menyatu lagi
dengan latar di layar-layar itu, sama seperti bug Beranda sebelum
dikoreksi.

**Solusinya, class baru `.gc-card-menonjol`** (`css/gechoo-design.css`,
di dalam `@media(min-width:768px)`): `background:var(--ivory)`.
Ditambahkan sebagai kelas KEDUA di elemen yang sudah punya `.gc-card`
(bukan pengganti — `.gc-card` tetap dipakai buat border/radius/padding
dasarnya), jadi cukup `class="gc-card gc-card-menonjol"`. Class ini
SENGAJA di dalam media query desktop — di mobile TIDAK berubah (di
sana `<main>` tetap ivory dari `.gc-app`, jadi kartu putih `.gc-card`
sudah kontras dengan sendirinya, TIDAK butuh class tambahan ini).

**Aturan rollout-nya SAMA PERSIS pola "riwayat browser" di atas** —
bertahap, BUKAN retrofit massal:

- **Menu/kartu BARU (desktop)** yang dibangun mulai sekarang → WAJIB
  langsung tambahkan `.gc-card-menonjol` ke tiap `.gc-card` yang
  tampil di area konten desktop, dari awal dibangun.
- **Menu LAMA yang KEBETULAN sedang disentuh/diedit** (alasan apapun)
  → SEKALIAN ditambahkan class ini SAAT ITU JUGA, jangan ditunda.
- **JANGAN retrofit massal** ke SEMUA menu lama sekaligus dalam 1
  ronde — bertahap ikut 2 pemicu di atas, sama seperti riwayat browser.
- **Pilot pertama & DISETUJUI Guru**: "Perlu Disiapkan" (Persiapan
  Produksi V2, `js/vue-persiapan-produksi-v2.js`, 31 Agt 2026) — jadi
  acuan pola kalau menyentuh submenu lain (Bahan/Vendor/Acc Sewing/
  Acc Webbing/Acc Finishing di file yang sama, atau modul lain di luar
  Persiapan Produksi V2).
- Menu yang SUDAH dibangun sebelum keputusan ini **SENGAJA TIDAK
  diubah** kecuali nanti memang disentuh lagi untuk alasan lain —
  termasuk 5 jalur `JalurTahapManager` (Bahan/Vendor/Acc Sewing/Acc
  Webbing/Acc Finishing) yang masih pakai `.gc-card` polos per 31 Agt
  2026, belum ikut dikoreksi sesi ini.

Detail token warna & daftar class lengkap: lihat `PETA-DESAIN.md`
bagian "Kontras kartu vs latar putih desktop".

---

## Cara kirim hasil kerja (file yang berubah) ke Guru

**GANTI LAGI 2 Sep 2026 (permintaan eksplisit Guru: "bantu minta
knowledge terbaru update disini. lalu simpan di folder komputer code.
biar tiap ada yg baru ikut ke commit dan push")** — dokumen
"peta"/pengetahuan project (`STATUS-PROYEK.md`, `PETA-DATABASE.md`,
`PETA-MENU.md`, `PETA-DESAIN.md`, `PETA-INFRASTRUKTUR.md`,
`PRINSIP-HEMAT.md`, `PEDOMAN-GAYA-KERJA.md`, `STATUS-PROYEK-ARSIP.md`,
`RENCANA-PERSIAPAN-PRODUKSI-V2.md`, `FIRESTORE-RULES-SNAPSHOT.md`)
**SEKARANG DIKIRIM KE 2 TEMPAT**, bukan cuma 1 seperti aturan lama di
bawah (yang sekarang SUPERSEDED):
1. **`project_write`** (tool Projects) ke Project claude.ai
   `zevanichouse-erp` — TETAP jalan pertama & utama (Project bisa
   dibaca Guru dari device manapun).
2. **BARU**: SEKALIAN ditulis juga ke folder
   **`F:\ZEVANIC HOUSE\FOUNDATION\Code\Claude\`** di komputer Guru
   (lewat device bridge, subfolder BARU `Claude` di dalam `Code` yang
   sebelumnya flat) — supaya dokumen knowledge ini IKUT TERBAWA saat
   Guru `git add`/`commit`/`push` folder kerjanya, bukan cuma hidup
   terpisah di Project claude.ai. File `claude/RENCANA-...md`,
   `claude/PETA-INFRASTRUKTUR.md`, `claude/FIRESTORE-RULES-SNAPSHOT.md`
   (path Project pakai prefix folder `claude/`) DIRATAKAN jadi cuma
   nama filenya saja di folder lokal ini (karena sudah di dalam
   subfolder `Claude`, prefix itu jadi berlebihan).

**Alasan kenapa aturan 30 Agt 2026 (di bawah, "SATU-SATUNYA jalur...
Project claude.ai") DIBALIK**: waktu itu argumennya "Project bisa
dibaca dari device manapun, tidak perlu duplikat ke folder lokal" —
TAPI itu mengabaikan bahwa folder lokal (`Code`) itu yang ikut ke
`git push`/GitHub, sedangkan Project claude.ai TIDAK. Kalau Guru
(atau kolaborator lain via repo GitHub) mau lihat histori
keputusan/status proyek dari REPO-nya sendiri (bukan buka Claude
project terpisah), dokumen itu harus ada fisik di situ juga.

**Tetap ikuti aturan "1x per fitur SELESAI" di atas** (bukan tiap 1
file kode berubah) — cuma sekarang TUJUAN PENGIRIMANNYA dobel
(Project + folder lokal `Code\Claude\`), bukan tunggal.

**Cara commit ke folder lokal `Code\Claude\`**: sama seperti file kode
biasa (lihat bagian file KODE di bawah) — `SendUserFile` dulu ke tiap
file `.md` (dari sandbox) buat dapat `file_uuid`, LALU
`mcp__remote-devices__device_commit_files` dengan `devicePath` =
`F:\ZEVANIC HOUSE\FOUNDATION\Code\Claude\<nama-file>.md`. Verifikasi
WAJIB sama seperti kode: `device_list_dir` folder itu, bandingkan
`size` dengan `wc -c` file aslinya di sandbox.

File **KODE** (`.js`, `index.html`, `dashboard.js`, `firestore.rules`
versi kerja round ini, dst) — **GANTI LAGI 30 Agt 2026 malam
(ditegaskan Guru langsung di chat: "proses via google drive lama,
mending simpan di directory komputer saja")**: jalur Google Drive
(dipakai siang-sore 30 Agt 2026, folder "Zevanic ERP - Kode") sudah
**DITINGGALKAN** — proses upload+download-balik+diff verifikasi lewat
Drive per file ternyata lambat & boros token untuk file besar
(`vue-master-produk.js` ~120KB perlu berkali-kali panggilan berurutan).
**SATU-SATUNYA jalur pengiriman file KODE sekarang**: folder
**`F:\ZEVANIC HOUSE\FOUNDATION\Code`** di komputer Guru, lewat koneksi
perangkat (device bridge — `mcp__remote-devices__device_commit_files`)
— BUKAN lagi Google Drive, BUKAN lagi folder `Data Yang Disiapkan`
lama. **Folder ini FLAT** (semua file `.js` langsung di root folder
`Code`, TANPA subfolder `js/` — sama seperti folder Drive lama, prinsip
"title = nama file asli" tetap berlaku, cuma lokasinya pindah dari
Drive ke folder lokal ini). **Pengecualian BARU (2 Sep 2026)**: dokumen
`.md` knowledge/peta (lihat bagian atas) sekarang masuk subfolder
`Code\Claude\`, TIDAK di root `Code` bareng file kode — supaya
terpisah jelas dari file kode produksi.

**Aturan pengiriman file KODE tiap selesai 1 ronde kerja:**

1. **Syarat**: device bridge ke komputer Guru harus tersambung (Guru
   buka Claude desktop app). Kalau folder `Code` belum ikut tersambung
   ke sesi, minta akses lewat `device_request_folder_access` dulu
   (paths persis `F:\ZEVANIC HOUSE\FOUNDATION\Code`).
2. Tool: `SendUserFile` dulu ke tiap file kode yang berubah (dari
   working directory sandbox) buat dapat `file_uuid`, LALU
   `mcp__remote-devices__device_commit_files` dengan `devicePath` =
   `F:\ZEVANIC HOUSE\FOUNDATION\Code\<nama-file-asli>.js` (BUANG
   prefix `js/` dari path — folder tujuan flat, lihat catatan di
   atas). Boleh dikirim sekaligus (array `files[]`) untuk beberapa
   file dalam 1 panggilan.
3. **Verifikasi WAJIB setelah commit**: `device_list_dir` folder
   `Code` lagi, bandingkan `size` tiap file yang baru ditulis dengan
   `wc -c` file aslinya di sandbox — HARUS PERSIS SAMA (device bridge
   menulis byte apa adanya, tidak ada risiko transcoding seperti Drive
   dulu, jadi cek ukuran saja sudah cukup, tidak perlu download-balik+
   diff terpisah).
4. Kirim HANYA file yang benar-benar berubah ronde itu (bukan bundel
   lengkap semua file).
5. **Catatan penting**: folder `Code` ini bisa jadi SNAPSHOT LAMA
   (belum tentu sinkron dengan repo GitHub terkini) — kalau file yang
   mau ditulis sudah ada di sana dengan ukuran jauh beda dari yang
   diharapkan, itu tanda foldernya memang ketinggalan, BUKAN berarti
   ada yang salah di file baru yang baru ditulis. Guru sendiri yang
   memindahkan/mengunggah isi folder ini ke repo kerja aslinya.

**Kalau ke depan ternyata Guru MASIH mau juga pakai Google Drive**,
itu keputusan baru yang perlu ditanya ulang — JANGAN diasumsikan
otomatis balik ke aturan Drive.

---

## Kalau masih lambat SETELAH baca pedoman ini — bukan lagi soal gaya bahasa

**Ini bagian buat Hilman (pengguna), BUKAN instruksi untuk Claude** —
karena 2 hal di bawah ini adalah PENGATURAN yang diatur lewat Settings,
Claude tidak bisa mengaktifkan sendiri walau sudah baca pedoman ini.

### 1. Cek "Code execution and file creation" BENAR-BENAR aktif
Settings → Capabilities → pastikan toggle ini menyala. **Cara pastikan
sudah efeknya**: pas Claude membuat file, harus ada kotak kecil
terpisah yang bisa diklik (semacam "▶ bash_tool" / "▶ create_file")
— BUKAN cuma balok kode panjang ditulis langsung di teks jawaban.
Kalau yang muncul cuma balok kode teks biasa, berarti tool TIDAK aktif
— itu jauh lebih lambat (semua ditulis sebagai teks yang harus
di-generate huruf demi huruf, bukan lewat sistem file yang efisien).

### 2. Cek level "reasoning effort" / "thinking" — jangan set tinggi untuk kerja rutin
Kalau ada pilihan level "thinking"/"reasoning effort" di percakapan,
level TINGGI bikin Claude "mikir" lebih lama SEBELUM menjawab (proses
yang TIDAK terlihat di teks, tapi tetap makan waktu nyata). Ini
trade-off: makin tinggi, makin teliti TAPI makin lambat.

**Saran**: pakai level SEDANG/RENDAH untuk kerja rutin (bikin file,
edit kecil, ikuti pola yang sudah ada) — cukup dan jauh lebih cepat.
Naikkan ke level TINGGI cuma untuk keputusan yang MEMANG berisiko
tinggi (lihat bagian "1 pengecualian penting" di bawah) — bukan
default buat semua percakapan.

---

## 1 pengecualian penting: JANGAN buru-buru untuk hal berisiko tinggi

Kecepatan itu prioritas untuk kerja RUTIN — TAPI untuk hal yang
menyentuh **keamanan** (Security Rules, password, OTP), **uang**
(penggajian), atau **data karyawan sensitif** — lebih baik sedikit
lebih lambat tapi benar, daripada cepat tapi salah. Lihat
`STATUS-PROYEK.md` §3.5 dan §8 sebagai contoh area yang MEMANG pantas
dikerjakan hati-hati, bukan buru-buru.

---

## Kebiasaan yang bikin hasil kerja DIPERCAYA (bukan cuma cepat)

Ini beda dari bagian kecepatan di atas — ini soal KUALITAS penilaian.
Semua contoh di bawah ini BENAR-BENAR terjadi sepanjang pembangunan
project ini, bukan teori kosong.

**1. Verifikasi dulu, jangan asumsi dari ingatan** — sebelum bikin
`PETA-DATABASE.md`, semua nama koleksi & field di-`grep` LANGSUNG dari
kode, bukan ditulis dari ingatan percakapan yang sudah panjang. Sebelum
bikin prototipe warna, warna aslinya dicek dulu dari `gechoo-design.css`,
bukan ditebak/dikira-kira mirip. **Berlaku juga untuk klaim status "X
belum diimplementasikan"** — sebelum menyetujui/menjalankan permintaan
yang berangkat dari asumsi begitu, cek dulu langsung ke kode: contoh
nyata 31 Agt 2026, Guru sempat mengira latar putih `.gc-main-desktop`
"belum diimplementasikan" di dashboard — dicek ulang, TERNYATA sudah
ada dan benar, yang belum cuma rollout-nya ke submenu lain (lihat
"WAJIB dicek tiap bikin/edit menu DESKTOP" di atas).

**2. Jujur soal kesalahan sendiri, PERBAIKI SAAT ITU JUGA** — pernah
2x tidak sengaja menghapus bagian penting saat edit (fungsi di
`vue-camera.js`, judul bagian di file ini sendiri, DUA KALI). Ketahuan
lewat validasi SEBELUM dikirim, langsung diperbaiki, DAN diberitahu ke
pengguna apa yang sempat salah — bukan didiamkan seolah tidak terjadi.

**3. Pakai ulang pola yang sudah terbukti, jangan reka ulang tiap
kali** — paginasi (`vue-paginasi.js`), sistem izin (`window.cekIzinMenu`),
kartu bersama (`PengumumanCarousel`, `QuoteCard`) — sekali dibangun
benar, dipakai ULANG di banyak tempat, bukan didesain dari nol setiap
ada kebutuhan mirip. Pola BARU yang sama: `.gc-card-menonjol` (kontras
kartu vs latar putih desktop) — sekali disetujui Guru di 1 submenu
percontohan, dipakai ULANG bertahap ke submenu lain, bukan didesain
ulang tiap kali (lihat checklist "WAJIB dicek tiap bikin/edit menu
DESKTOP" di atas).

**4. Berhenti & diskusi dulu untuk keputusan berisiko/mahal, JANGAN
langsung eksekusi** — soal biaya Security Rules per-menu (§6.5), soal
password sementara karyawan baru, soal model keamanan OTP — semuanya
dijelaskan trade-off-nya DULU, tunggu keputusan pengguna, baru
dikerjakan. Bukan asumsi sendiri lalu kerjakan. **Ini juga berlaku buat
keputusan MENU yang kompleks/ambigu** — lihat "Pengecualian khusus
keputusan MENU yang kompleks" di bagian "PENEGASAN KHUSUS" di atas:
begitu Claude MENILAI SENDIRI suatu keputusan menu kompleks/ambigu,
LANGSUNG INTERUPSI Guru saat itu juga (bukan diam dulu, kerjakan
tebakan sendiri, baru tanya belakangan) dan tanyakan apakah Guru mau
kirim wireframe dulu.

**5. Telusuri AKAR masalah, bukan cuma tempelkan solusi ke gejalanya**
— waktu ada laporan "email nyangkut, tidak bisa daftar ulang", tidak
langsung tebak-tebak solusi. Ditelusuri dulu ALUR LENGKAPNYA sampai
ketemu SEBAB ASLINYA (rollback akun gagal, tidak diberitahu ke user) —
baru dirancang perbaikannya. Solusi yang tidak berdasar akar masalah
biasanya cuma menutupi gejala, bukan benar-benar menyelesaikan.

**6. Catat keputusan penting SAAT ITU JUGA, jangan tunda sampai
"nanti"** — `STATUS-PROYEK.md` diperbarui BERKALI-KALI sepanjang
pembangunan, bukan ditulis sekali di akhir. Keputusan yang tidak
dicatat SEGERA gampang terlupa atau berubah tanpa disadari.

**Benang merahnya**: kecepatan itu penting (lihat semua bagian di
atas), TAPI kecepatan tanpa kebiasaan-kebiasaan ini cuma menghasilkan
kerja yang cepat SALAH. Tujuannya cepat DAN bisa dipercaya — dua-duanya,
bukan pilih salah satu.

---

## Moodboard "Gechoo Mobile Organic" — pola kartu/tombol/header BARU (29 Agt 2026, DISETUJUI Guru)

Konteks: mockup HTML standalone (`antrean-absensi-clean.html`, dikirim
ke Guru lewat chat beberapa revisi, revisi terakhir disetujui — "oke
gass saya setuju") jadi ACUAN VISUAL buat rollout pola kartu/tombol/
header ke modul "Daftar + Form bertahap" berikutnya (Antrean Dakar,
Antrean Lembur, Antrean Reimburse, dst) — **cek bagian ini DULU
sebelum desain ulang dari nol** (lihat prinsip "Cari solusi — pakai
pola yang sudah ada" di atas). Pilot pertama (disetujui Guru, "test
dulu Antrean Absensi"): `js/vue-antrean-absensi.js` +
`js/vue-header-mobile.js` (mode `'lainnya'`, komponen GLOBAL).

**Kartu (event-row, padat) — ganti pola kartu besar/bertumpuk lama:**
- 1 baris per event (Clock In/Clock Out/Kehadiran) — foto kecil (24px,
  sudut membulat ~9px, BUKAN kotak besar terpisah kayak sebelumnya) +
  ikon+label singkat ("Masuk"/"Keluar"/"Hadir") + jam + tag status,
  SEMUA di baris yang sama (bukan grid 2 kolom + dropdown + blok
  terpisah seperti kartu lama).
- **Tombol Accept + dropdown Seragam (2 langkah) DIGANTI 3 tombol
  sejajar**: **Sesuai** (= accept + seragam=Sesuai), **Tidak Sesuai**
  (= accept + seragam=Tidak Sesuai), **Reject** — 1x klik, bukan pilih
  dropdown dulu baru klik Accept. Baris tombol ini cuma tampil kalau
  event itu memang masih PENDING (per event, independen — format baru
  bisa tampil 2x sekaligus kalau Clock In & Clock Out sama-sama
  pending).
- Avatar/nama/badge jumlah "menunggu" tetap di header kartu (baris
  atas), fungsinya TIDAK berubah, cuma dirapikan ukurannya (avatar
  38px, sudut ~14px).
- Tombol titik-tiga (Hapus) tetap di kanan-bawah kartu, cuma kosmetik
  yang berubah (bulat penuh & transparan, bukan kotak berbingkai).

**Tombol & sudut ("Organic" — secukupnya, JANGAN pil semua):**
- Tombol IKON SAJA (filter, refresh, kembali, titik-tiga) → bulat
  PENUH (`border-radius:50%`).
- Kartu, avatar, foto event → sudut dilebarkan (14–20px), BUKAN pil.
- Kolom cari (search input) → pil penuh (`border-radius:999px`).
- Tombol AKSI berlabel (Sesuai/Tidak Sesuai/Reject, tag status) →
  TETAP sudut sedang (9–12px)/pill khusus buat tag status — JANGAN
  dijadikan pil semua, supaya tetap kebaca sebagai tombol aksi, bukan
  cuma dekorasi bulat.

**Filter (khusus Owner/Superuser, sama seperti sebelumnya):**
- Dropdown filter (Jenis Pekerjaan/Gudang) yang tadinya SELALU tampil
  → sekarang di belakang 1 ikon filter (bulat, di samping kolom cari,
  simbol yang SAMA dengan yang sudah dipakai di halaman lain seperti
  Config Absensi/Hak Akses) yang toggle tampil/sembunyi. Titik merah
  kecil nempel di ikon kalau ada filter aktif.

**Header halaman (KOMPONEN GLOBAL — `js/vue-header-mobile.js`, mode
`'lainnya'`, dipakai SEMUA halaman selain Home):**
- LAMA: kartu warna pink solid + lingkaran biru dekoratif di pojok,
  judul gabungan "[Menu] - [Sub-menu]", eyebrow TEKS STATIS "ERP
  Zevanic House" (tidak berubah-ubah sesuai halaman — ini bukan bug
  yang diminta diperbaiki, cuma dicatat apa adanya).
- BARU (disetujui Guru 29 Agt 2026): TANPA blok warna — tombol kembali
  bulat (ikon panah kiri) + label kategori kecil huruf kapital (nama
  TAB sungguhan, misal "MASTER ABSENSI" — bukan teks statis) + judul
  sub-menu tebal di bawahnya. Lebih ringan, fokus pindah ke konten
  kartu di bawahnya, bukan ke header.
- **Rollout header**: pilot DULU di halaman Antrean Absensi SAJA
  (instruksi Guru eksplisit, 29 Agt 2026: "test dulu Antrean Absensi")
  — TAPI karena komponennya GLOBAL, begitu nanti disetujui dipakai
  selamanya, otomatis kepakai ke SEMUA halaman sekaligus (tidak ada
  cara pisahkan per-halaman tanpa memecah komponennya jadi dua). Kalau
  pilot ini nanti di-ACC total oleh Guru, TIDAK PERLU tanya ulang buat
  halaman lain — commit ke `js/vue-header-mobile.js` langsung berlaku
  semua.

**Ikon:** tetap pakai Font Awesome (`<i class="fas fa-*">`), SAMA
seperti kode produksi yang sudah ada di seluruh app. Mockup HTML
standalone-nya sempat pakai SVG inline sebagai pengganti — itu CUMA
akal-akalan karena preview mockup gagal memuat CDN Font Awesome (bukan
soal koneksi produksi, index.html produksi sudah muat FA dengan
benar), BUKAN keputusan desain buat dibawa ke kode sungguhan.

**Sumber:** mockup `antrean-absensi-clean.html`, dikirim ke Guru lewat
chat (beberapa revisi), revisi terakhir DISETUJUI 29 Agt 2026. File
mockup-nya sendiri tidak disimpan permanen di folder Foundation (bukan
dokumen peta, bukan file kode repo) — kalau perlu lihat lagi acuan
visualnya, minta Guru kirim ulang dari riwayat chat, atau lihat
langsung hasil implementasinya di `js/vue-antrean-absensi.js` setelah
diterapkan.
