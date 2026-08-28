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

## Kapan menulis ke `STATUS-PROYEK.md` / `PETA-*.md` — 1x per FITUR SELESAI (BARU 27 Agt 2026, disepakati Guru)

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

## WAJIB dicek tiap bikin menu baru / edit sub-tab menu lama — riwayat browser (tombol back HP) — BARU malam 24 Agt 2026

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

## Cara kirim hasil kerja (file yang berubah) ke Guru — BARU malam 24 Agt 2026

Ada 2 folder di komputer Guru (`desktop-ftibv77`, tersambung lewat
device bridge), BEDA fungsi — jangan tertukar:

- **`F:\ZEVANIC HOUSE\FOUNDATION`** (folder induk) — CUMA buat dokumen
  "peta"/pengetahuan project: `STATUS-PROYEK.md`, `PETA-DATABASE.md`,
  `PETA-MENU.md`, `PETA-DESAIN.md`, `PETA-INFRASTRUKTUR.md`,
  `PRINSIP-HEMAT.md`, `PEDOMAN-GAYA-KERJA.md` (file ini sendiri),
  `firestore.rules`/`storage.rules` versi terakhir. Ditulis LANGSUNG ke
  sini (`device_commit_files`, bukan zip) SETIAP kali salah satu
  dokumen ini diperbarui (ikuti aturan "1x per fitur SELESAI" di atas
  — bukan tiap file kode berubah) — TIDAK PEDULI Guru sedang pakai
  komputer mana, lakukan begitu device bridge tersambung sekalinya.
- **`F:\ZEVANIC HOUSE\FOUNDATION\Data Yang Disiapkan`** (sub-folder,
  ditambahkan malam 24 Agt 2026) — CUMA buat file **KODE** yang nanti
  Guru push sendiri ke GitHub (`.js`, `index.html`, `dashboard.js`,
  `firestore.rules` versi kerja round ini, dst) — BUKAN dokumen peta
  (itu aturannya di atas, folder beda).

**Aturan pengiriman file KODE (bukan dokumen peta) tiap selesai 1
ronde kerja:**

1. **Device bridge ke komputer ini TERSAMBUNG** (Guru sedang pakai
   komputer `desktop-ftibv77` di rumah) — cek dengan coba
   `device_list_dir` ke folder Foundation, kalau sukses berarti
   tersambung: tulis file kode yang berubah **LANGSUNG (TANPA zip)**,
   pakai nama aslinya, ke folder `Data Yang Disiapkan`. TIDAK PERLU
   zip sama sekali dalam kondisi ini — Guru tinggal pindah/upload
   sendiri dari situ ke GitHub.
2. **Device bridge TIDAK tersambung** (Guru bilang lagi pakai laptop
   lain / lagi di luar rumah, atau `device_list_dir` gagal) — kirim
   sebagai **zip lewat chat** (`SendUserFile`), berisi CUMA file yang
   benar-benar berubah ronde itu (bukan bundel lengkap semua file) —
   pola yang sudah dipakai sejak permintaan Guru "kalau cukup yg
   tersentuh gurusu saja".

**Jangan asumsi** device tersambung atau tidak dari ingatan sesi
sebelumnya — device bridge bisa putus-nyambung kapan saja tergantung
Guru buka/tutup aplikasi desktop-nya. Coba `device_list_dir` dulu tiap
mau kirim, baru putuskan zip atau langsung taruh folder.

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
bukan ditebak/dikira-kira mirip.

**2. Jujur soal kesalahan sendiri, PERBAIKI SAAT ITU JUGA** — pernah
2x tidak sengaja menghapus bagian penting saat edit (fungsi di
`vue-camera.js`, judul bagian di file ini sendiri, DUA KALI). Ketahuan
lewat validasi SEBELUM dikirim, langsung diperbaiki, DAN diberitahu ke
pengguna apa yang sempat salah — bukan didiamkan seolah tidak terjadi.

**3. Pakai ulang pola yang sudah terbukti, jangan reka ulang tiap
kali** — paginasi (`vue-paginasi.js`), sistem izin (`window.cekIzinMenu`),
kartu bersama (`PengumumanCarousel`, `QuoteCard`) — sekali dibangun
benar, dipakai ULANG di banyak tempat, bukan didesain dari nol setiap
ada kebutuhan mirip.

**4. Berhenti & diskusi dulu untuk keputusan berisiko/mahal, JANGAN
langsung eksekusi** — soal biaya Security Rules per-menu (§6.5), soal
password sementara karyawan baru, soal model keamanan OTP — semuanya
dijelaskan trade-off-nya DULU, tunggu keputusan pengguna, baru
dikerjakan. Bukan asumsi sendiri lalu kerjakan.

**5. Telusuri AKAR masalah, bukan cuma tempelkan solusi ke gejalanya**
— waktu ada laporan "email nyangkut, tidak bisa daftar ulang", tidak
langsung tebak-tebak solusi. Ditelusuri dulu ALUR LENGKAPNYA sampai
ketemu SEBAB ASLINYA (rollback akun gagal, tidak diberitahu ke user) —
baru dirancang perbaikannya. Solusi yang tidak berdasar akar masalah
biasanya cuma menutupi gejala, bukan benar-benar menyelesaikan.

**6. Catat keputusan penting SAAT ITU JUGA (dalam arti: begitu
FITUR-nya selesai, bukan ditunda sampai "nanti"/sampai sesi mau
berakhir)** — `STATUS-PROYEK.md` diperbarui tiap kali 1 fitur/pekerjaan
rampung sepanjang pembangunan, bukan ditulis 1x saja di akhir SEMUA
project, dan bukan pula ditunda sampai context penuh/sesi mau
"dipadatkan" (lihat aturan "1x per fitur SELESAI" di atas). Keputusan
yang tidak dicatat segera gampang terlupa atau berubah tanpa disadari.

**Benang merahnya**: kecepatan itu penting (lihat semua bagian di
atas), TAPI kecepatan tanpa kebiasaan-kebiasaan ini cuma menghasilkan
kerja yang cepat SALAH. Tujuannya cepat DAN bisa dipercaya — dua-duanya,
bukan pilih salah satu.
