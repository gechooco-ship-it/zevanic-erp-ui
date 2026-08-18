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
