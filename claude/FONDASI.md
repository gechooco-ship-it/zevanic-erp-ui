# FONDASI — stack, deploy, batas kerja

> Dibaca saat akan mengirim file, deploy, atau ragu cara kerja.
> Isinya nyaris tidak pernah berubah — kalau sering diedit, berarti ada
> yang salah tempat. Bukan tempat status, bukan tempat riwayat.

## Proyek

ERP konveksi penuh (HRD, keuangan, stok, produksi) dalam satu sistem,
dipakai skala **~500 karyawan**.

- **Frontend**: Vue 3 lewat CDN, **tanpa build step**.
- **Backend**: Firebase — Firestore, Auth, Storage.
- **Cloud Functions**: repo terpisah `zevanic-cloud-function` —
  **tidak bisa diakses sesi Claude manapun**.
- **Hosting**: `gechoo.online` via GitHub Pages, repo
  `gechooco-ship-it/zevanic-erp-ui`.

## Deploy — tidak ada yang otomatis

| Jenis | Cara |
|---|---|
| `.js` `.html` `.css` | kirim ke `F:\ZEVANIC HOUSE\FOUNDATION\Code` (flat, tanpa subfolder `js/`) → **Guru drag ke GitHub lewat web** |
| dokumen `.md` | folder `Code\Claude\` + `project_write` ke Knowledge |
| `firestore.rules` / `storage.rules` | Firebase Console → Rules → **Publish manual** |

**Guru tidak memakai git di komputer** — file diunggah dengan drag &
drop ke GitHub web. Artinya: upload tidak pernah menghapus file (hapus
harus manual lewat tampilan GitHub), dan jangan menyuruh Guru "cek
status `git push`". Selalu pastikan Guru sudah mengunggah sebelum
menganggap sebuah fitur "sudah live".
Folder `Code` bisa jadi snapshot lama — kalau ukuran file di sana jauh
beda dari yang diharapkan, itu tanda foldernya ketinggalan.

## Membaca kode terkini

`git clone` lewat Bash — **terbukti paling andal**. WebFetch ke github.com
pernah gagal tergantung sesi. Wajib dipakai untuk memverifikasi klaim
"sudah/belum dikerjakan", bukan menebak dari dokumen manapun.

## Batas sandbox — jangan overclaim "sudah dites"

Sandbox **tidak bisa** menjalankan app ini (butuh browser asli + Firebase
project hidup).

- **Bisa & wajib tiap edit**: `node --check`, hitung tag/kurung seimbang,
  cek ID HTML tidak dobel. Ini cuma membuktikan tidak ada typo — **belum**
  membuktikan logikanya benar.
- **Bisa, sebaiknya untuk logic penting**: fungsi murni input→output tanpa
  Firebase/browser bisa benar-benar dijalankan lewat Node dengan contoh
  input. Utamakan untuk logic yang menyangkut uang/keamanan.
- **Tidak bisa sama sekali**: tampilan browser, baca/tulis Firestore
  sungguhan, Security Rules, klik tombol, kirim OTP. Jangan pernah bilang
  "sudah saya pastikan berfungsi" untuk ini — serahkan ke Guru.

## Cara kerja

- Kerja rutin: **langsung bertindak**, laporan 1–3 kalimat. Penjelasan
  ditulis setelah ketemu jawabannya, bukan sebelum.
- Pakai ulang pola yang sudah ada di kode, jangan desain ulang dari nol.
- **Keputusan menu yang kompleks/ambigu → interupsi Guru saat itu juga**
  (AskUserQuestion), jangan tebak-jalan-dulu-tanya-belakangan. Penilaian
  "ini kompleks" adalah keputusan Claude sendiri, tidak perlu menunggu
  Guru bilang duluan. Instruksi Guru yang sudah eksplisit tidak perlu
  dikonfirmasi ulang.
- Pelan dan hati-hati **hanya** untuk yang menyentuh uang, keamanan, atau
  data karyawan. Sisanya cepat.
