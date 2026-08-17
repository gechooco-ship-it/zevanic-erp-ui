# STATUS PROYEK — Zevanic/Gechoo ERP

> **Untuk sesi Claude manapun (baru atau lanjutan): BACA FILE INI DULU sebelum
> mengerjakan apapun.** Ini "titik mulai" tunggal — lebih bisa diandalkan
> daripada mengandalkan ingatan percakapan lama, yang bisa saja tidak
> terbawa ke chat baru. Update file ini di akhir sesi kerja yang cukup
> besar (bukan tiap perubahan kecil).

Terakhir diperbarui: **18 Agustus 2026, dini hari** (+ migrasi `waktu_ts` Timestamp asli untuk koleksi absensi)

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

## 3.5. Alur Registrasi -> Login DIROMBAK TOTAL (18 Agt 2026, dini hari)

**Kenapa**: data karyawan akan dipakai untuk pajak/asuransi/gaji ke depan
— makin penting diverifikasi manusia dulu sebelum jadi akun resmi.
Sekaligus menutup celah nyata: dulu kalau proses daftar gagal di tengah
jalan, email bisa "nyangkut" (akun Auth terlanjur dibuat, profil
Firestore gagal, tidak bisa dibersihkan otomatis — lihat riwayat masalah
ini di git log lama). Desain baru MENGHILANGKAN skenario itu sama sekali
— akun Auth baru dibuat SETELAH semuanya pasti valid.

### 3.5.1 Alur baru, singkatnya
1. **Registrasi** (`vue-registrasi.js`) — 3 tahap: (a) isi email → kirim
   OTP, (b) masukkan kode OTP → verifikasi, (c) BARU form data lengkap
   muncul (NIK, KTP, alamat, dst — **tanpa field password sama sekali**).
   Submit → tersimpan ke koleksi **`pendaftaran_pending/{email}`** —
   **BELUM ADA akun Firebase Auth sama sekali** di titik ini.
2. **Antrean Dakar** (`vue-antrean-dakar.js`) — Admin baca dari
   `pendaftaran_pending` (bukan `users` lagi), cek data & foto KTP.
   **Setujui** → akun Firebase Auth baru dibuat (password sementara =
   NIK), profil `users/{email}` dibuat lengkap (`role:operator`,
   `status_approval:APPROVED`, `wajib_ganti_password:true`), dokumen
   pending dihapus, email berisi cara login dikirim. **Tolak** → dokumen
   pending dihapus saja (tidak ada akun Auth yang perlu dibersihkan,
   karena memang belum pernah dibuat).
3. **Login pertama kali** (`vue-login.js`) — begitu password benar
   (NIK), sebelum lanjut kemanapun, muncul modal **wajib ganti password**
   (`wajib_ganti_password` di Firestore, `updatePassword()` Firebase
   Auth). Setelah diganti, `wajib_ganti_password` otomatis jadi `false`,
   alur normal lanjut (cek gudang, Clock In, dst — TIDAK berubah).
4. **Login dari perangkat baru** (kapanpun, bukan cuma pertama kali) —
   modal OTP muncul (deteksi murni `localStorage`, key
   `zevanic_device_verified_{email}` — perangkat yang PERNAH lolos OTP
   tidak akan diminta lagi SELAMA localStorage-nya tidak dihapus).
   Diaktifkan/nonaktifkan lewat toggle di WhatsApp Gateway > Config API
   ("Aktifkan verifikasi OTP saat login perangkat baru" — nama menu
   TIDAK diganti biar tidak perlu bikin toggle baru, tapi ISINYA sekarang
   kirim lewat EMAIL, BUKAN WhatsApp lagi — lihat 3.5.3).

### 3.5.2 Teknis paling berisiko — instance Firebase KEDUA
`createUserWithEmailAndPassword()` BAWAANNYA otomatis login sebagai akun
yang BARU dibuat. Kalau dipanggil di instance Firebase yang SAMA dengan
sesi Admin, Admin akan "terlempar" logout dari akunnya sendiri, jadi
login sebagai karyawan baru itu. Solusinya (di `vue-antrean-dakar.js`,
fungsi `buatAkunTanpaGangguSesi`): bikin instance Firebase KEDUA
(`initializeApp(firebaseConfig, "nama-unik")`, config yang SAMA tapi
instance terpisah total), pakai instance itu KHUSUS buat bikin akun,
lalu buang instance itu. Sesi Admin di instance UTAMA sama sekali tidak
tersentuh. `firebaseConfig` (objek mentahnya, bukan cuma hasil
`initializeApp`) sekarang diekspor dari `firebase-config.js` khusus
untuk kebutuhan ini.

### 3.5.3 OTP lama (WhatsApp) DIGANTI TOTAL, bukan cuma dimatikan
Ditemukan saat mengerjakan ini: mekanisme OTP lama di `vue-login.js`
**tidak aman** — kode OTP dibuat & DIBANDINGKAN LANGSUNG di JS browser
(`otpState.kode`, variabel biasa) — siapapun buka DevTools bisa
lihat/lewati verifikasinya. Sekarang diganti total pakai
`window.kirimOtpEmail`/`verifikasiOtpEmail` (lihat 7.4/vue-otp.js) — kode
aslinya TIDAK PERNAH ada di browser, verifikasi murni lewat Firestore
Rules. Toggle aktivasinya TETAP di WhatsApp Gateway (field
`config/whatsapp_gateway.otp_aktif`, biar tidak bikin toggle baru lagi),
tapi pengirimannya sekarang email, bukan WA.

### 3.5.4 Security Rules yang berubah untuk alur ini
- `users/{email}` — CREATE dulu syaratnya "orangnya sendiri yang bikin"
  (`request.auth.token.email == email`). SEKARANG jadi
  `isAdminLevel() && role=='operator' && status_approval=='APPROVED'`
  — karena yang bikin sekarang ADMIN (instance kedua), bukan orangnya.
- `pendaftaran_pending/{email}` (BARU) — create CUMA boleh kalau
  `otp_email/{email}` sudah `terverifikasi:true`. Read/delete
  `isAdminLevel()` saja (dipakai Antrean Dakar).

### 3.5.5 PR — belum sempat dikerjakan malam ini
- **BELUM DITES SAMA SEKALI END-TO-END** (deploy GitHub Pages sempat
  error berkali-kali malam ini) — WAJIB coba alur penuh (daftar → OTP →
  Antrean Dakar setujui → login pertama → ganti password → login lagi
  dari "device" lain buat tes OTP perangkat baru) sebelum dipakai
  karyawan sungguhan.
- Field `wajib_ganti_password` & alur ganti password BELUM pernah
  diuji — `updatePassword()` Firebase bisa gagal kalau sesi dianggap
  "tidak baru login" (`auth/requires-recent-login`) — sudah dikasih
  pesan error yang menjelaskan, tapi belum terverifikasi kapan tepatnya
  ini muncul dalam praktik.
- Kalau nanti ada YANG PERNAH pakai flow REGISTRASI LAMA (akun Auth
  sudah ada dari SEBELUM perombakan ini) dan masih berstatus PENDING di
  `users` (bukan `pendaftaran_pending`) — Antrean Dakar YANG BARU TIDAK
  AKAN melihatnya lagi (beda koleksi!). Perlu dicek manual apakah ada
  data lama seperti ini yang perlu dipindahkan/diproses manual.



### 4.0 Registrasi karyawan baru — bug "email nyangkut" (ditemukan & diperbaiki 17 Agt 2026)
`js/vue-registrasi.js` — proses daftar itu 2 langkah: (1) buat akun
Firebase Auth, (2) simpan profil ke Firestore. Kalau langkah 2 gagal,
kode BERUSAHA membatalkan langkah 1 (`deleteUser`) — tapi pembatalan itu
sendiri bisa gagal juga (sebelumnya cuma dicatat diam-diam di Console,
TIDAK diberitahu ke siapapun) — hasilnya akun Auth "nyangkut" (ada login
tapi tidak ada profil Firestore), email itu jadi tidak bisa dipakai
daftar ulang ("email sudah digunakan") padahal registrasi aslinya gagal.

**Perbaikan yang sudah masuk:**
1. Paksa refresh token (`getIdToken(true)`) sebelum `setDoc`, supaya
   Security Rules cek `request.auth.token.email` dengan token yang pasti
   segar — mengurangi kemungkinan `setDoc` gagal karena masalah timing.
2. Kalau pembatalan (`deleteUser`) SENDIRI gagal, sekarang pesan
   eksplisit muncul ke pengisi form: berhenti, jangan coba ulang, hubungi
   Admin — bukan diam-diam cuma log Console.
3. Pesan error "email sudah digunakan" diperjelas: mencakup 2
   kemungkinan (memang sudah daftar VS nyangkut dari kegagalan
   sebelumnya) — TIDAK bisa dibedakan otomatis dari sisi form, karena
   orang yang gagal daftar belum punya sesi login (Security Rules
   `users/{email}` wajib login dulu untuk dibaca, sengaja tidak dibuka
   supaya tidak ada celah keamanan baru).

⚠️ **Keterbatasan yang masih ada**: kalau email sampai benar-benar
nyangkut, SATU-SATUNYA cara membersihkannya adalah manual lewat
**Firebase Console → Authentication → cari email → Delete**. Tidak ada
alat di dalam app ini untuk mendeteksi/membersihkan otomatis — itu
butuh Admin SDK (server/Cloud Function), di luar jangkauan kode
client-side biasa yang dipakai di sini.

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
Antrean Absensi, **Antrean Lembur** (baru), Riwayat All Absensi.
**Master Karyawan** (`tab-superuser`): Antrean Dakar, Daftar Karyawan,
Slip Gaji (placeholder), Payroll (placeholder), Config Karyawan,
**Config Info** (kelola Pengumuman + Quote Harian), **Hak Akses**
(owner-only), **Config Akses** (owner-only).

### 4.1 Login komputer WAJIB Clock In dari HP dulu (aturan lama, bukan baru)
`js/vue-login.js` — sistem deteksi otomatis kalau login lewat browser
desktop (`isDesktopBrowser()`, cek `navigator.userAgent`, BUKAN pilihan
manual). Kalau desktop: kotak pilihan status (Hadir/Izin/Cuti)
disembunyikan sama sekali, diganti cek LANGSUNG ke Firestore
(`sudahClockInHariIniServer()`) — apakah email ini SUDAH ada catatan
Clock In hari ini. Kalau sudah → langsung masuk Dashboard. Kalau belum →
ditolak + logout otomatis, pesan minta Clock In dari HP dulu.

**Alasan**: foto selfie + validasi lokasi/radius cuma bisa lewat kamera
HP — desktop SENGAJA tidak punya jalur Clock In sendiri. Alur yang
benar: HP dulu untuk absen (dengan bukti foto), baru komputer boleh
dipakai untuk kerja administratif (Dashboard, dsb, layar lebih besar).

### 4.2 Aturan khusus Owner
- **Cara ditentukan**: murni field `role: "owner"` di Firestore. TIDAK
  ADA lagi deteksi dari pola email (versi lama yang cek "email
  mengandung kata owner" sudah dihapus total).
- **Login**: Owner (dan Superuser) dikecualikan dari wajib tautan
  gudang — role lain ditolak login kalau belum ditautkan ke gudang
  manapun, Owner tidak (perannya manajerial, bukan operasional
  lapangan). Tetap kena aturan `status_approval` yang sama seperti
  role lain.
- **Akses**: dapat semua menu Master Absensi + Master Karyawan +
  WhatsApp Gateway, DITAMBAH Config Akses & Hak Akses (2 menu ini
  KHUSUS Owner, Superuser tidak dapat).
- **Bypass Config Akses**: Owner SELALU dianggap akses penuh
  (`window.aksesConfigSaya = 'OWNER_PENUH'` di auth.js), dicek PALING
  AWAL sebelum baca Firestore apapun — jadi Owner tidak pernah baca
  `akses_config` sama sekali (hemat), dan tidak bisa dibatasi lewat
  Config Akses walau dicoba. Sengaja begini — Owner tidak boleh
  terkunci sendiri oleh kesalahan pengaturan.
- **Cara menjadikan seseorang Owner**: lewat Hak Akses (pilih role
  "owner" di dropdown). Untuk Owner PERTAMA KALI (belum ada Owner sama
  sekali di sistem) harus diatur manual di Firestore Console
  (`users/{email}.role = "owner"`), karena tidak ada Owner lain yang
  bisa memasangkannya lewat Hak Akses.

## 5. Home mobile — hub menu + header dinamis (dibangun 17 Agt 2026)

`js/vue-home.js` — bukan lagi cuma sapaan+shortcut, sekarang "hub menu"
lengkap: Kartu shift (melayang, lihat 5.2) → Pengumuman (carousel) →
Quote Harian (lihat poin 7.2, cuma tampil kalau ada jadwal hari itu) →
Shortcut (Clock In/Out dinamis, Izin, Cuti, Lembur) → grup menu per role
(Absensi/Master Karyawan/Whatsapp), semua tampil kotak grid 5 kolom.

**Penting**: SEMUA menu grup sekarang **selalu tampil ke siapapun**
(operator termasuk) — yang tidak berhak cuma ditandai kunci (redup +
ikon gembok), klik-nya munculkan pesan "Akses terkunci, silahkan hubungi
Owner / PIC Owner!", BUKAN navigasi. Pengecekan izinnya lewat
`window.cekIzinMenu()` (lihat 6.3), fallback ke role kalau belum diatur.
Logic-nya ada di `daftarMenuGroups()` (vue-components.js) — 1 registry
terpusat, kalau mau ubah/tambah menu, ubah di SATU tempat itu.

Desktop TIDAK pakai hub menu ini — cuma banner sambutan sederhana +
Pengumuman + Quote (komponen SAMA, di-mount terpisah lewat
`js/vue-home-desktop.js`).

### 5.1 Header mobile dinamis (`js/vue-header-mobile.js`, baru)
SATU komponen, dipasang di `<main>` (di atas SEMUA tab, bukan cuma
Home), isinya berubah otomatis:
- **Di Home**: "Selamat [pagi/siang/sore/malam], [Nama]" — kartu pink.
- **Di halaman lain**: "ERP Zevanic House" / "[Menu] - [Sub-menu]" —
  supaya orang tetap tahu sedang di mana walau baris tombol sub-tab
  disembunyikan di mobile (lihat 5.3).

Diaktifkan lewat `window.aturHeaderKonteks(tabId, subTabId)`, dipanggil
dari `pindahTab`/`pindahSubTab` (dashboard.js) — murni cocokkan ID ke
tabel label (`LABEL_TAB`/`LABEL_SUBTAB` di file itu sendiri), TIDAK baca
Firestore. **Kalau nambah tab/sub-tab baru, WAJIB tambahkan label-nya di
kedua tabel itu juga**, atau header-nya bakal kosong pas dibuka.

Header lama (`label-badge-role` + `teks-nama-user`, dengan countdown
"Terlambat +HH:MM:SS") sekarang **desktop-only** (`hidden md:flex`) —
mobile TIDAK pakai lagi, sengaja dihapus dari mobile sesuai permintaan
(fungsi `mulaiHitungJamKerja` di dashboard.js masih ada, cuma untuk
desktop sekarang).

### 5.2 Kartu shift melayang
Kartu putih dengan `margin-top:-26px` supaya visual overlap ke kartu
header pink di atasnya (gaya "melayang"). Isinya sekarang juga:
- Nama gudang di sebelah "Shift hari ini"
- Kalau sudah absen: jam Clock In asli + **durasi kerja berjalan
  real-time** (format `09:00 – 02:14:37`, update tiap detik pakai
  `setInterval`) — murni baca `localStorage` (key
  `zevanic_jam_masuk_{email}`, diisi `js/vue-camera.js` saat Clock In,
  dihapus saat Clock Out), TIDAK ada baca Firestore tambahan.

### 5.3 Baris tombol sub-tab disembunyikan di mobile
Master Absensi & Master Karyawan tadinya punya baris tombol horizontal
(Config Absensi | Penjadwalan | ... ) yang tampil di SEMUA ukuran layar
— sekarang `hidden md:flex`, cuma tampil desktop. Alasan: di mobile,
navigasi SEHARUSNYA lewat Home (atau header dinamis di 5.1), bukan
loncat-loncat sub-tab yang bisa kepencet tidak sengaja + boros baca
(tiap sub-tab dibuka = mount baru = fetch baru). Profile (`vue-account-
profile.js`) SUDAH lebih dulu begini (`hidden md:block`) — drawer profil
di mobile yang jadi navigasinya, bukan baris tombol.

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

### 6.8 ATURAN TETAP (18 Agt 2026): menu BARU defaultnya Owner-only
**Permintaan eksplisit Hilman, WAJIB diikuti setiap kali menambah menu
baru ke depan** — jangan otomatis kasih akses ke role lain, biar Owner
yang atur manual lewat Config Akses/Hak Akses kalau memang mau dibagikan.

**Yang SUDAH diubah (otomatis)**: `bikinDefaultProfil()` di
`vue-config-akses.js` — dulu Superuser = Owner untuk SEMUA menu (ikut
`DAFTAR_MENU` apapun isinya, otomatis dapat menu baru). SEKARANG
daftar Superuser itu FIXED/snapshot (menu yang sudah ada per tanggal
ini) — menu baru TIDAK otomatis masuk situ lagi. **JANGAN tambahkan
menu baru ke daftar itu secara otomatis** kapanpun menambah menu —
biarkan kosong, biar Owner yang putuskan sendiri.

**Nuansa PENTING yang perlu dipahami** (supaya tidak salah kira "sudah
otomatis aman"): `bikinDefaultProfil()` itu CUMA memengaruhi checkbox
apa yang tampil TERCENTANG saat Owner PERTAMA KALI buka profil yang
BELUM PERNAH disimpan di Config Akses. Itu BUKAN gerbang keamanan
runtime. Gerbang sungguhan (`window.cekIzinMenu`, dipakai di seluruh
app) baca LANGSUNG dari `akses_config/{profil}` di Firestore — kalau
dokumen itu SUDAH PERNAH disimpan sebelumnya (dari sesi kerja
sebelumnya), field menu yang baru ditambahkan TIDAK ADA di situ, dan
sesuai prinsip "jatuh-aman" yang dipegang sejak awal (lihat 6.3),
menu yang belum diatur DIANGGAP BOLEH oleh sebagian besar komponen —
**bertentangan dengan maksud "Owner-only" ini**.

**Solusi praktis** (sampai ada cara yang lebih otomatis): setiap kali
ada menu baru ditambahkan, Owner perlu buka Config Akses → buka tiap
profil yang SUDAH ADA (pic, admin, superuser, profil kustom lain) →
klik "Update profil akses" (simpan ulang, walau menu barunya
dibiarkan tidak dicentang) — supaya menu baru itu TERCATAT EKSPLISIT
sebagai "tidak boleh" di Firestore untuk profil itu, bukan cuma
"belum diatur" (yang jatuh-amannya ke arah BOLEH, bukan TIDAK BOLEH).



## 7. Config Info, Pengumuman, Quote & Emoji Picker (17 Agt 2026)

### 7.1 Pengumuman
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

### 7.2 Quote Harian (Kotak 3, baru)
Beda konsep dari Pengumuman — koleksi Firestore TERPISAH (`quotes`), 1
quote tampil PER TANGGAL yang dijadwalkan di muka (field
`tanggalTampil`, format `YYYY-MM-DD`), bukan "N terbaru". Kalau tidak
ada quote dijadwalkan untuk hari ini, kartunya (`QuoteCard`,
vue-components.js) TIDAK render apapun — bukan kartu kosong.

Diatur di Config Info juga (section terpisah "Quote Harian"). Batas
karakter SENGAJA diberlakukan: **judul maks 20, isi maks 60** — supaya
muat rapi di kartu kecil (gradasi pink-ke-biru, gaya kartu "Giveaway").
Query-nya `where(tanggalTampil==hariIni), limit(1)` — paling murah, 0
atau 1 baca.

### 7.3 Emoji Picker
`EmojiPicker` (vue-components.js) — komponen bersama, tombol kecil +
popup grid emoji, emit karakter terpilih lewat `@pilih`. Dipasang di
judul+isi Pengumuman DAN judul+isi Quote (4 field total). Kalau nanti
butuh di field lain, tinggal pakai `<emoji-picker @pilih="targetRef += $event">`
— tidak perlu bikin mekanisme baru.

## 8. Antrean Lembur & pembatas jam kerja untuk penggajian (17 Agt 2026)

### 8.1 Antrean Lembur (menu baru, terpisah dari Antrean Absensi)
`js/vue-antrean-lembur.js` — dulu pengajuan Lembur TERCAMPUR di Antrean
Absensi, tapi tampilannya dirancang untuk absensi Hadir biasa (radius/
koordinat/seragam) — info yang PALING PENTING buat Lembur (jam mulai/
selesai diajukan, alasan, instruksi kerja) tidak kelihatan jelas.
Sekarang punya layar sendiri, field yang relevan, Approve/Reject sendiri.
`vue-antrean-absensi.js` sekarang MENGECUALIKAN dokumen berstatus
`"LEMBUR (CLOCK IN)"` — supaya tidak dobel tampil di 2 tempat.

### 8.2 Pembatas jam kerja untuk penggajian
`js/vue-camera.js`, fungsi `hitungJamKeluarUntukGaji()` — dipanggil
SAAT Clock Out. Tujuan: jam pulang TERLAMBAT dari jadwal shift TIDAK
otomatis dihitung sebagai jam kerja tambahan untuk gaji, KECUALI ada
pengajuan Lembur yang **sudah di-ACC** (lihat 8.1) untuk hari itu.

Contoh: shift 08:00–16:00, Clock Out jam 17:00 tanpa Lembur disetujui
→ yang dipakai gaji TETAP 16:00. Kalau ADA Lembur disetujui sampai jam
17:30 → yang dipakai gaji jadi 17:00 (jam Clock Out asli, karena masih
dalam batas lembur yang disetujui).

**Field disimpan DUA-DUANYA** — `waktu` (jam Clock Out ASLI, tidak
pernah diubah, buat transparansi/audit) dan `jam_keluar_untuk_gaji`
(jam yang sudah dibatasi). ⚠️ **Belum ada mesin Payroll sungguhan** yang
membaca field `jam_keluar_untuk_gaji` ini (Slip Gaji/Payroll masih
placeholder) — ini menyiapkan datanya duluan, siap dipakai kapanpun
fitur itu dibangun. Admin tetap bisa koreksi manual dari Antrean/Riwayat
Absensi kalau perhitungan otomatis meleset.

⚠️ **Perlu dicek saat testing**: query di `hitungJamKeluarUntukGaji()`
pakai 3 filter sekaligus (`email` + `status` + `status_acc`) — Firestore
MUNGKIN minta index khusus untuk kombinasi ini. Kalau muncul error
"index diperlukan" di Console, klik link yang Firestore berikan di
pesan error itu (otomatis bikinkan index-nya).

## 9. Prinsip hemat Firestore — WAJIB baca `PRINSIP-HEMAT.md`

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

## 10. Bug besar yang pernah terjadi & pelajarannya (baca kalau nav/klik terasa aneh)

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

## 11. Yang belum dikerjakan (kalau lanjut sesi baru, ini kandidat berikutnya)

- Paginasi + `getCountFromServer()` untuk Hak Akses, Antrean Dakar,
  Penjadwalan.
- ~~Field tanggal Firestore asli untuk Riwayat All Absensi~~ — **SELESAI
  18 Agt 2026** (`waktu_ts`, lihat `PRINSIP-HEMAT.md`). Yang MASIH
  belum: Riwayat All Absensi sendiri BELUM pakai `waktu_ts` ini untuk
  filter rentang tanggal di server (`muat()`-nya masih `getDocs` ambil
  semua) — field-nya sudah siap, tinggal query-nya yang perlu diubah
  (dan UI filter tanggal ditambahkan) kalau mau benar-benar hemat.
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
