# PELAJARAN — kelas bug & pola boros yang pernah terjadi

> **Dibaca sebelum menulis kode.** Tumbuh sangat lambat: tambah entri
> hanya kalau ketemu kelas bug BARU, bukan tiap kejadian. Batas 120 baris.
> Entri di sini jarang dihapus — dihapus hanya kalau kelas bugnya sudah
> tidak mungkin terjadi lagi (misal teknologinya diganti).

## Visibility / Vue

- **Grup sidebar top-level BARU wajib didaftarkan di `auth.js`**
  (`aturTampilanBerdasarkanRole`, di 2 tempat: array hide default + blok
  show admin-level). Lupa = menu tidak pernah muncul untuk role manapun,
  termasuk Owner. Menu *nested* di grup yang sudah ada tidak kena ini.
- **Komponen yang punya `v-if="prop"` di dalam templatenya sendiri wajib
  tetap dibind propnya dari pemanggil**, walau call site sudah menggerbang
  `v-if`. Kalau tidak: komponen ter-mount, popup tidak pernah terlihat,
  **tanpa error console**. Ditemukan di `PopupPratinjauCetakLabel`, 4 titik
  di `vue-pp-serie.js`. Tiap reuse komponen begini, grep semua pemanggilnya.
- **Inline `style="display:..."` selalu menang dari class CSS manapun**,
  termasuk `.hidden` proyek ini. Jangan campur di 1 elemen. Kelas yang sama
  muncul di atribut `[hidden]` vs `{display:flex}` author stylesheet.

## Waktu & tanggal

- **`toISOString()` itu UTC, bukan tanggal lokal.** WIB = UTC+7, jadi jam
  00:00–06:59 dapat tanggal KEMARIN. Untuk tanggal kalender pakai
  `toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'})`.
- **Apa pun yang dipakai untuk KEPUTUSAN** (status hadir, approval, gaji)
  wajib dari `_ts`/`serverTimestamp()`, **tidak pernah** dari jam device.
  Field teks jam device boleh untuk tampilan, tidak untuk perhitungan.

## Biaya Firestore (skala 500 karyawan)

- **Jangan fetch-semua lalu filter di JS.** Pernah **86.000 read dalam 1
  hari** dari pola yang tadinya "terasa aman". Pakai `getCountFromServer()`
  untuk angka, query bertarget untuk filter, paginasi cursor
  (`limit` + `startAfter`) untuk tabel, mount-on-demand untuk layar admin.
- **Field yang mau di-`where()` rentang wajib Timestamp asli, bukan teks.**
  Format teks lokal Indonesia tidak bisa di-orderBy/range di server.
- **Cek-sebelum-tulis**: bandingkan nilai baru vs lama sebelum `updateDoc`,
  skip kalau sama.
- Yang sengaja TIDAK dipakai (over-engineering di skala ini): distributed
  counters, virtual scrolling, Realtime DB untuk status online.

## Cara menilai klaim

- **Klaim "sudah ada penggantinya di modul lain" wajib dicek di level
  FUNGSI, bukan level file-ada.** Pernah nyaris menghapus fitur karena file
  penggantinya memang ada — tapi cuma menangani kasus sederhana, bukan
  seluruh cakupan yang mau dihapus.
- **Jawaban Guru sendiri bisa berbasis premis teknis yang salah.** Kalau
  menyentuh field yang kelihatannya milik mekanisme lain, baca kode live
  dulu, lapor balik sebagai temuan teknis, minta re-konfirmasi — jangan
  eksekusi mentah-mentah.
- **Dokumentasi internal sendiri juga bisa basi**, termasuk file ini.
  Untuk skema data, silangkan ke kode live sebelum jadi dasar keputusan.
- **Derivasi mekanis (`cp` + `sed`) bisa salah-rename referensi silang-pos.**
  `node --check` cuma cek sintaks, bukan makna string — wajib `grep`
  verifikasi manual tiap habis sed pass.
