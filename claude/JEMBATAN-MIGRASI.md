# JEMBATAN MIGRASI — Zevanic/Gechoo ERP

> Titik masuk TUNGGAL untuk sesi Claude manapun (baru atau lanjutan)
> sebelum mengerjakan APAPUN di proyek ini. Gantikan kebiasaan "pelajari
> semuanya dari nol" yang lama — cukup ikuti urutan di bawah.

---

## Urutan baca WAJIB, sebelum kerja apapun

1. **`PEDOMAN-GAYA-KERJA.md`** — cara kerja & gaya bahasa (kerjakan
   dulu, jelaskan secukupnya; `str_replace` bukan tulis ulang; tebak →
   verifikasi lewat tool, bukan daftar kemungkinan di teks).
2. **`STATUS-PROYEK.md`** — arsitektur, keputusan yang sudah diambil
   (dan KENAPA), bug besar & pelajarannya, PR yang belum selesai.
3. **`PETA-HEMAT.md`** — aturan baku hemat baca/tulis Firestore. Wajib
   diikuti tiap bikin fitur/tabel baru, bukan opsional.
4. **`PETA-MENU.md`** — kalau tugasnya "ubah menu/sub-menu X", cek di
   sini dulu file mana yang perlu disentuh, sebelum grep sembarangan.
5. **`PETA-DATABASE.md`** — kalau tugasnya nyentuh field/koleksi
   Firestore, cek skema di sini dulu, jangan tanya ke pengguna.
6. **`PETA-DESAIN.md`** — kalau tugasnya bikin/ubah tampilan, cek
   warna/class yang SUDAH ADA di sini dulu, jangan reka warna baru.
7. **`PETA-INFRASTRUKTUR.md`** — kalau errornya kemungkinan BUKAN dari
   kode (akun, kuota, domain, cara deploy `.rules` vs `.js`).

**Prinsip**: dokumen di atas SUDAH DIRINGKAS supaya sesi baru tidak
perlu baca ulang riwayat chat lama atau seluruh kode dari nol. Kalau
`PETA-*.md` tidak punya jawabannya — BARU `grep` langsung ke kode, dan
SETELAH ketemu, pertimbangkan menambahkan temuan itu ke `PETA-*.md`
yang relevan supaya sesi berikutnya tidak perlu cari ulang.

---

## Checklist umum sebelum menyentuh kode (bukan cuma soal Registrasi)

Dipakai untuk fitur/perbaikan APAPUN, bukan cuma alur Registrasi.

### Sebelum mulai
- [ ] Baca 7 dokumen di atas yang relevan dengan tugas ini (tidak perlu
      semua kalau tugasnya kecil/rutin).
- [ ] Cek apakah pola serupa SUDAH ADA di kode (`vue-paginasi.js`,
      `vue-antrean-*.js`, `daftarMenuGroups()`, dst) — pakai ulang,
      jangan desain dari nol.
- [ ] Kalau nambah tab/sub-tab BARU: catat di kepala bahwa nanti WAJIB
      didaftarkan ke `petaMount` (`dashboard.js`) — lihat §10.5
      STATUS-PROYEK.md soal gejala kalau lupa (halaman kosong total).

### Saat mengerjakan
- [ ] `str_replace` untuk ubah sebagian file — jangan tulis ulang
      seluruh file kalau cuma beberapa baris yang berubah.
- [ ] Kalau nyentuh `users/{email}`: WAJIB isi `role` (5 nama baku)
      DAN `profil_akses` (nama profil) — jangan gabung jadi satu field.
- [ ] Kalau nyentuh Security Rules/password/OTP/penggajian/data
      sensitif karyawan: BOLEH lebih lambat dari biasanya, ini
      pengecualian resmi di `PEDOMAN-GAYA-KERJA.md`.

### Sebelum lapor selesai
- [ ] Validasi 1 kali menyeluruh: `node --check` (sintaks JS) + hitung
      tag `<div`/`</div>` kalau ada HTML/template — cukup, tidak perlu
      baca ulang berkali-kali.
- [ ] Kalau ubah `firestore.rules`/`storage.rules`: ingatkan pengguna
      itu di-deploy lewat Firebase Console, BUKAN upload ke GitHub.
- [ ] Ringkasan hasil 1-3 kalimat — bukan paragraf yang mengulang apa
      yang sudah jelas dari tool call.

---

## Kalau ada fitur besar yang BELUM PERNAH DITES end-to-end

Tulis eksplisit di `STATUS-PROYEK.md` bagian PR — jangan asumsikan
sesi berikutnya (atau pengguna) ingat itu belum dites. Contoh nyata:
alur Registrasi→Antrean Dakar→Login (§3.5) sempat 2 hari tidak
ketahuan belum pernah ter-*push* ke GitHub sama sekali karena tidak
ada penanda jelas di titik itu.
