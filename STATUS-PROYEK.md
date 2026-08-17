# STATUS PROYEK — Zevanic/Gechoo ERP

> **Untuk sesi Claude manapun (baru atau lanjutan): BACA FILE INI DULU sebelum
> mengerjakan apapun.** Ini "titik mulai" tunggal — lebih bisa diandalkan
> daripada mengandalkan ingatan percakapan lama, yang bisa saja tidak
> terbawa ke chat baru. Update file ini di akhir sesi kerja yang cukup
> besar (bukan tiap perubahan kecil).

Terakhir diperbarui: **17 Agustus 2026, malam** (sesi sistem Hak Akses lengkap — Tahap 1/2/3 selesai)

---

## 1. Apa proyek ini

Sistem ERP internal (absensi, manajemen karyawan, WhatsApp Gateway) untuk
Zevanic/Gechoo — dipakai ±89-100 karyawan gudang.

- **Frontend**: Vue 3 via CDN (`unpkg.com`), **tanpa build step** — semua
  file `.js` langsung jalan di browser, tidak ada `npm run build`.
- **Backend**: Firebase — Firestore (database), Auth (login), Storage
  (file gambar/video, baru diaktifkan 17 Agt 2026), Cloud Functions
  (`zevanic-cloud-function/functions/index.js`, terpisah dari repo ini).
- **Hosting**: `gechoo.online`, lewat GitHub Pages.
- **Repo**: `gechooco-ship-it/zevanic-erp-ui` (GitHub, publik).
- **Desain**: warna Gechoo (Ivory/Baby Pink/Light Blue/Mahogany/Burgundy),
  font Poppins + Nunito Sans, style di `css/gechoo-design.css`.

## 2. Cara kerja sebelum mengerjakan apapun

1. **Baca file ini dulu.**
2. Baca `PRINSIP-HEMAT.md` — aturan baku soal hemat baca/tulis Firestore
   dan pola komponen bersama. **Wajib diikuti**, bukan opsional.
3. Kalau Claude punya akses `conversation_search`/`recent_chats` dan
   masih dalam Project yang sama, boleh dipakai buat cari detail spesifik
   dari sesi lama — tapi JANGAN jadi satu-satunya sumber, karena tidak
   selalu bisa diakses dari chat/context baru.
4. Kalau ragu soal keputusan desain/arsitektur yang sudah diambil, cek
   komentar di kode — banyak keputusan penting dijelaskan LANGSUNG di
   tempat kodenya (alasannya, bukan cuma apanya), sengaja ditulis begitu
   supaya tidak hilang kalau riwayat chat tidak terbawa.

## 3. Cara deploy — PENTING, sering jadi sumber bug kalau lupa

| Jenis file | Cara deploy |
|---|---|
| `.js`, `.html`, `.css`, `.md` | Upload biasa ke GitHub (repo `zevanic-erp-ui`) |
| `firestore.rules` | **Firebase Console → Firestore Database → Rules** → timpa isi → Publish. **BUKAN** upload ke GitHub. |
| `storage.rules` | **Firebase Console → Storage → Rules** → timpa isi → Publish. Beda tempat dari Firestore Rules. |

Kesalahan paling sering: user upload file `.js` yang benar tapi lupa
deploy `firestore.rules`/`storage.rules` yang menyertainya, lalu fitur
gagal dengan "Missing or insufficient permissions" — **selalu cek dulu
apakah ada file `.rules` yang menyertai sebelum menyimpulkan itu bug kode.**

## 4. Peta halaman & role

**Role**: `operator` (default, karyawan biasa) < `pic`/`admin` < `owner`/`superuser`
(setara, kecuali disebutkan beda) — role sekarang **dinamis**, tidak
cuma 5 nama baku ini (lihat poin 6, Config Akses).

**Struktur navigasi:**
- **Desktop**: sidebar kiri — Dashboard, Profile, Master Absensi (kalau
  pic/admin/owner/superuser), Master Karyawan (kalau owner/superuser),
  WhatsApp Gateway (kalau owner/superuser).
- **Mobile**: bottom nav 5 ikon — **Home** (hub menu, lihat poin 5),
  **Absensi** (Riwayat + Pengajuan pribadi), **Scan QR** (kamera baca QR,
  belum ada alur pemrosesan lanjutan), **Progress** (placeholder, belum
  dibangun), **Profile** (drawer geser dari kanan).

**Master Absensi** (`tab-admin-acc`): Config Absensi, Penjadwalan,
Antrean Absensi, Riwayat All Absensi.
**Master Karyawan** (`tab-superuser`): Antrean Dakar, Daftar Karyawan,
Slip Gaji (placeholder), Payroll (placeholder), Config Karyawan,
**Config Info** (baru, kelola Pengumuman), **Hak Akses** (owner-only),
**Config Akses** (owner-only).

## 5. Home mobile — hub menu (dibangun 17 Agt 2026)

`js/vue-home.js` — bukan lagi cuma sapaan+shortcut, sekarang "hub menu"
lengkap: Pengumuman (carousel, di atas) → Shortcut (Clock In/Out
dinamis, Izin, Cuti, Lembur) → grup menu per role (Absensi/Master
Karyawan/Whatsapp), semua tampil kotak grid 5 kolom.

**Penting**: SEMUA menu grup sekarang **selalu tampil ke siapapun**
(operator termasuk) — yang tidak berhak cuma ditandai kunci (redup +
ikon gembok), klik-nya munculkan pesan "Akses terkunci, silahkan hubungi
Owner / PIC Owner!", BUKAN navigasi. Pengecekan izinnya pakai
`window.currentUser.role` yang sudah ada di memori, TIDAK baca Firestore
lagi. Logic-nya ada di `daftarMenuGroups()` (vue-components.js) — 1
registry terpusat, kalau mau ubah/tambah menu, ubah di SATU tempat itu.

Desktop TIDAK pakai hub menu ini — cuma banner sambutan sederhana +
Pengumuman (komponen `PengumumanCarousel` yang SAMA, di-mount terpisah
lewat `js/vue-home-desktop.js`).

## 6. Sistem Hak Akses (dirombak total 17 Agt 2026, beberapa tahap)

**SEBELUMNYA**: role cuma 5 nama baku (operator/pic/admin/owner/superuser),
hardcode di banyak tempat.

**SEKARANG**: role BEBAS dibuat (profil kustom seperti `admin_finance`),
satu sumber kebenaran = koleksi Firestore `akses_config`. Dikerjakan
bertahap malam ini — semua tahap SUDAH selesai:

### 6.1 Data & tampilan (tahap awal)
- **Config Akses** (`vue-config-akses.js`) — bikin/edit "profil akses"
  bebas namanya, atur izin View/Add/Edit/Delete/Print per menu +
  kontrol granular opsional (`fiturList`, misal kunci dropdown Jenis
  Lokasi di Master Gudang — lihat 6.4). Owner SENGAJA tidak muncul di
  sini (wajib akses penuh selalu, tidak bisa dikonfigurasi).
- **Hak Akses** (`vue-hak-akses.js`) — hubungkan karyawan ke profil.
  Dropdown-nya baca langsung dari `akses_config`.
- **Modal Edit Karyawan** (Daftar Karyawan) — dropdown role sinkron sama.

### 6.2 PENTING — dua field terpisah di `users/{email}` (jangan disatukan lagi!)
Supaya profil kustom TETAP BISA menulis data (lihat 6.3), tiap karyawan
sekarang punya **2 field role**, jangan pernah gabung jadi satu lagi:

| Field | Isi | Dipakai untuk |
|---|---|---|
| `role` | SELALU salah satu dari 5 nama baku (operator/pic/admin/owner/superuser) | Firestore Rules, custom claim (`syncRoleClaim` Cloud Function) — inilah gerbang keamanan SUNGGUHAN |
| `profil_akses` | Bebas — nama profil aslinya (bisa sama dengan role, bisa custom) | Cari izin tampilan (`window.cekIzinMenu`), lookup `akses_config` |

Tiap profil di `akses_config` (termasuk 5 yang baku) punya field
`tingkatKeamanan` — INI yang menentukan nilai `role` yang ditulis kalau
profil itu dipasangkan ke karyawan. Diatur lewat kartu "Tingkat Keamanan
Dasar" di Config Akses. **Kalau nulis ke `users/{email}` secara manual
dari kode manapun ke depan, WAJIB isi keduanya** — cari nilai
`tingkatKeamanan` dari `akses_config/{profil}`, jangan taruh nama profil
langsung ke field `role`.

Fungsi bantu `profilEfektif(d)` (Hak Akses) = `d.profil_akses || d.role`
— dipakai baca yang mana saja terisi, backward-compatible sama data lama.

### 6.3 Penerapan NYATA — client-side (Tahap 1 & 2, selesai)
`window.cekIzinMenu(menuId, jenis)` dan `window.cekFiturAkses(menuId,
fiturKey)` (keduanya di `auth.js`) — data-nya (`window.aksesConfigSaya`)
diambil SEKALI saat login berdasarkan `profil_akses`, bukan baca
Firestore tiap dicek.

**Aturan jatuh-aman**: kalau izin belum diatur (null), DIANGGAP BOLEH —
supaya tidak ada yang tiba-tiba terkunci keluar cuma karena Config Akses
belum lengkap untuk profil itu.

Sudah diterapkan di: Home mobile (visibilitas menu + kunci per-item),
Master Data (9 kategori sekaligus lewat `MasterDataCategory`), Daftar
Karyawan (Edit/Hapus), Config Absensi (Hapus Gudang/Shift), Antrean
Absensi (Accept/Reject/Hapus), Antrean Dakar (Setujui/Tolak).

**Belum diterapkan**: Penjadwalan, tombol Print/Export di manapun,
sidebar desktop (masih pakai gerbang role lama, bukan akses_config).

### 6.4 Kontrol granular per-field (`fiturList`)
Bukan cuma View/Add/Edit/Delete/Print — ada juga kunci SPESIFIK per
field/dropdown di dalam sebuah form. Contoh yang sudah jalan: dropdown
Jenis Lokasi di Master Gudang (`vue-config-absensi.js`), default
terkunci "Tetap" untuk Admin/PIC, Owner selalu bebas. Kalau ke depan
butuh kunci field lain yang serupa: daftarkan `fiturKey` baru di
`fiturList` menu terkait (`DAFTAR_MENU`, vue-config-akses.js), JANGAN
bikin mekanisme baru — panggil `window.cekFiturAkses(menuId, fiturKey)`
di titik yang mau dikunci.

### 6.5 Firestore Security Rules — KEPUTUSAN SADAR: tetap di level role
Diskusikan trade-off-nya dengan Hilman (17 Agt 2026 malam): opsi
"rules baca akses_config per-menu" DITOLAK karena nambah 1 baca
Firestore di HAMPIR SETIAP operasi tulis di seluruh app — biaya
berkelanjutan yang tidak sepadan. **Rules TETAP di 4 tingkat baku**
(`isAdminLevel()`, `isOwnerLevel()`, gratis, tidak baca dokumen
tambahan) — ini genap kenapa 6.2 (pemisahan role/profil_akses) krusial:
tanpa itu, profil kustom akan LOLOS tampilan tapi GAGAL setiap kali
coba menyimpan data (Rules tolak, karena nama profil kustom tidak ada
di daftar baku).

Kalau nanti mau tinjau ulang keputusan ini (misal butuh keamanan lebih
presisi per-menu), diskusikan dulu trade-off biayanya sebelum
implementasi — jangan asumsikan langsung "lebih detail = lebih baik".

### 6.6 Bersih-bersih terkait
"Status Pengguna (Role Akses)" di Config Karyawan Master Data **sudah
dihapus** (17 Agt 2026) — dulu daftar role terpisah yang tidak sinkron,
berisiko bentrok. Sekarang 1 sumber saja (`akses_config`).

### 6.7 PR — karyawan lama yang mungkin masih perlu disesuaikan
Kalau ada karyawan yang SEBELUM perbaikan 6.2 sempat dipasangkan ke
profil KUSTOM (jarang terjadi, karena fitur profil kustom + perbaikan
ini dibangun di sesi yang sama) — field `profil_akses`-nya mungkin
belum terisi. Solusinya: buka lagi lewat Hak Akses, pilih ulang
profilnya, simpan — otomatis dapat `role`+`profil_akses` yang benar.
Karyawan dengan role baku (operator/pic/admin/owner/superuser) TIDAK
terdampak sama sekali, tidak perlu tindakan apapun.



## 7. Config Info & Pengumuman (baru 17 Agt 2026)

`js/vue-config-info.js` — kelola Pengumuman yang tampil di Home (desktop
& mobile). Bisa lampirkan gambar/video (maks 1MB, disimpan di **Firebase
Storage**, BUKAN base64 di Firestore — Firestore batas 1MB/dokumen,
base64 membengkakkan ~33%, jadi tidak muat). Ditampilkan rasio tetap
16:9 (`object-fit:cover`), proporsional otomatis di layar manapun tanpa
perlu upload 2 versi file berbeda.

Tiap pengumuman bisa diatur tampil untuk role tertentu saja (checkbox,
field `rolesTampil`, kosong = semua). Filternya dilakukan LOKAL di
`PengumumanCarousel` (vue-components.js) pakai `window.currentUser.role`
yang sudah ada di memori — bukan query `where()` baru ke server.

## 8. Prinsip hemat Firestore — WAJIB baca `PRINSIP-HEMAT.md`

Ringkasan super singkat (detail lengkap di file itu):
- Komponen admin **tidak mount sama sekali** sampai tab-nya benar-benar
  diklik (`window.pastikanMountXxx()`, dipanggil dari `pindahSubTab`/
  `pindahTab` di `dashboard.js`) — bukan cuma disembunyikan CSS.
- Paginasi Firestore SUNGGUHAN (`js/vue-paginasi.js`, composable bersama)
  untuk tabel yang datanya bisa banyak — sudah dipasang di Daftar
  Karyawan, BELUM di Antrean Dakar/Penjadwalan/Hak Akses (yang terakhir
  ini juga punya kartu ringkasan hitung total, butuh `getCountFromServer()`
  terpisah, belum dikerjakan).
- Riwayat Absensi pribadi (dipakai SEMUA karyawan) sudah query
  `where(email==...)`, bukan ambil semua lalu filter JS — ini yang paling
  penting sudah beres duluan karena dampaknya ke SEMUA orang.
- Riwayat All Absensi & Antrean Absensi (versi ADMIN, laporan/rekap)
  MASIH baca semua koleksi `absensi` — belum dioptimasi (butuh field
  tanggal format Firestore asli dulu, bukan cuma teks Indonesia, biar
  bisa query rentang tanggal di server).

## 9. Bug besar yang pernah terjadi & pelajarannya (baca kalau nav/klik terasa aneh)

1. **`window.xxx` langsung di template Vue itu TIDAK JALAN** — Vue
   anggap `window` properti komponen, bukan objek global browser. HARUS
   dibungkus fungsi biasa di `setup()` dulu, baru dipanggil dari
   template. Sudah kejadian 3x malam ini di file berbeda (vue-hak-akses,
   vue-penjadwalan, vue-profile-drawer, vue-account-profile) — kalau ada
   tombol yang "diam saja" padahal Vue, CEK INI DULU.
2. **`position:fixed` di dalam elemen yang punya animasi `transform` +
   `overflow:hidden`** — elemen fixed di dalamnya terlihat normal tapi
   area sentuhnya ikut terpotong. Nav bawah mobile sempat kena ini karena
   ada di dalam `#screen-dashboard` (yang punya `fade-in` + `overflow-
   hidden`) — solusinya pindahkan elemen fixed itu jadi SIBLING di luar,
   bukan child.
3. **Field Firestore yang "kadang ada kadang tidak"** (misal `status_acc`
   cuma keisi SAAT admin approve, bukan saat data dibuat) — bikin query
   `where()` yang kelihatannya benar justru MENYEMBUNYIKAN data yang
   belum diproses. Selalu cek dulu field itu KONSISTEN diisi di titik
   PENULISAN data, sebelum bikin query berdasarkan field itu.
4. **Auth/`window.currentUser` timing** — kalau sebuah komponen baca
   `window.currentUser` SEBELUM data user asli terisi (baru login/reload),
   dapat data kosong/fallback. Selalu `await window.authReady` di
   `onMounted`, DAN untuk layar yang harus fresh SEGERA setelah login
   (seperti Home), tambahkan pemanggilan `window.refreshXxx()` eksplisit
   di titik SETELAH `window.currentUser` dipastikan terisi (lihat
   `auth.js`/`vue-login.js`, cari `refreshHome`).

## 10. Yang belum dikerjakan (kalau lanjut sesi baru, ini kandidat berikutnya)

- Paginasi + `getCountFromServer()` untuk Hak Akses, Antrean Dakar,
  Penjadwalan.
- Field tanggal Firestore asli (bukan teks) untuk Riwayat All Absensi,
  supaya bisa dioptimasi juga.
- Penerapan izin Config Akses (View/Add/Edit/Delete/Print) — SUDAH jalan
  nyata di client-side untuk sebagian layar (lihat 6.3 buat daftar
  lengkap mana yang sudah/belum). Security Rules SENGAJA tetap di level
  role baku, bukan per-menu (keputusan sadar soal biaya, lihat 6.5).
- Halaman "Progress" (mobile) — masih placeholder, nunggu skema data
  produksi/SPK dirancang.
- "Scan QR" bisa baca kode QR sungguhan, tapi belum ada yang MEMPROSES
  hasilnya (belum nyambung ke alur kerja apapun).
- Slip Gaji, Payroll, Estimasi Gaji — semua masih placeholder "segera hadir".

**Soal fondasi kerja (bukan fitur, cara kerja) — belum jadi masalah di
skala sekarang, tapi relevan kalau nanti dipakai ratusan orang:**
- Belum ada testing otomatis — semua perubahan diverifikasi manual
  (screenshot, cek Console). Risiko "perbaiki A, rusak B tanpa ketahuan"
  makin besar seiring fitur bertambah.
- Belum ada lingkungan staging — semua perubahan langsung ke
  `gechoo.online`, langsung dipakai semua orang begitu di-deploy.
- Belum ada pemantauan error produksi — bug yang cuma muncul di
  perangkat orang lain (bukan yang sedang testing) tidak akan ketahuan
  kecuali dilaporkan manual.
