# PETA MENU KERJA — Zevanic/Gechoo ERP

> Referensi cepat "menu apa → file mana". Kalau `STATUS-PROYEK.md` itu
> cerita KENAPA sesuatu dibangun begitu, file ini jawab pertanyaan
> praktis: **"saya mau ubah menu/sub-menu X, file mana yang perlu
> di-upload?"**
>
> Setiap file di sini SUDAH DICEK LANGSUNG ke kode-nya (bukan dari
> ingatan) — kalau ada sub-tab di dalam satu file, itu ditulis rinci di
> baris "Sub-menu di dalamnya".

---

## 📱 Navigasi Bawah (Mobile, 5 ikon)

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Home** | `vue-home.js` | Kartu Shift, Pengumuman, Quote Harian, Shortcut (Clock In/Out, Izin, Cuti, Lembur), grup menu per role | Semua | ✅ Aktif |
| **Absensi** → **Profile** ("Absensi") | `vue-account-profile.js` | *lihat tabel Profile di bawah* | Semua | ✅ Aktif |
| **Scan QR** | `vue-scan-qr.js` | — | Semua | ⚠️ Bisa baca QR, BELUM ada yang memproses hasilnya |
| **Progress** | *(belum dibangun)* | — | Semua | ❌ Placeholder |
| **Profile** (drawer geser) | `vue-profile-drawer.js` | Link ke tab-tab di `vue-account-profile.js` (lihat di bawah) | Semua | ✅ Aktif |

**Header dinamis** (semua halaman mobile, di luar 5 ikon): `vue-header-mobile.js`

### Sub-menu di dalam Profile (`vue-account-profile.js`) — 6 tab internal
| Sub-tab | Isinya |
|---|---|
| **Account** | QR code pribadi, tombol Logout |
| **Data Karyawan** | Edit data diri sendiri |
| **Absensi** | Riwayat kehadiran pribadi + form pengajuan Izin/Cuti/Lembur |
| **Pencapaian** | *(belum banyak dikembangkan)* |
| **Estimasi Gaji** | Placeholder — TIDAK ada tombolnya di baris tab (cuma bisa dibuka lewat kode `tabAktif='gaji'`, belum ada jalur klik normal) |
| **Keamanan** | Ganti password |

---

## 🕐 Master Absensi (sidebar desktop / grup menu Home)

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Config Absensi** | `vue-config-absensi.js` | 2 bagian dalam 1 file: **Master Gudang & Titik Lokasi** (`MasterGudangManager`) + **Master Shift** (`MasterShiftManager`) | pic/admin/owner/superuser | ✅ Aktif |
| **Penjadwalan** | `vue-penjadwalan.js` | — | pic/admin/owner/superuser | ✅ Aktif (belum paginasi) |
| **Antrean Absensi** | `vue-antrean-absensi.js` | — | pic/admin/owner/superuser | ✅ Aktif |
| **Antrean Lembur** | `vue-antrean-lembur.js` | — | pic/admin/owner/superuser | ✅ Aktif — approve di sini pengaruh langsung ke hitungan gaji |
| **Riwayat All Absensi** | `vue-riwayat-absensi.js` | Termasuk alat migrasi `waktu_ts` (banner kuning, muncul otomatis kalau perlu) | pic/admin/owner/superuser | ✅ Aktif (belum paginasi) |

---

## 👥 Master Karyawan (sidebar desktop / grup menu Home)

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Antrean Dakar** | `vue-antrean-dakar.js` | — | owner/superuser | ⚠️ Baru dirombak total, **BELUM DITES** |
| **Daftar Karyawan** | `vue-daftar-karyawan.js` | Modal Edit Karyawan (`EditKaryawanModal`, di file yang sama) | owner/superuser | ✅ Aktif, sudah paginasi |
| **Slip Gaji** | *(belum dibangun)* | — | owner/superuser | ❌ Placeholder |
| **Payroll** | *(belum dibangun)* | — | owner/superuser | ❌ Placeholder — tapi `jam_keluar_untuk_gaji` (vue-camera.js) sudah siap dipakai nanti |
| **Config Karyawan** | `vue-config-karyawan.js` | **8 kategori Master Data**: Jenis Pekerjaan, Status Kerja, Jabatan, Status Karyawan, Kabupaten/Kota, Alasan Izin, Alasan Cuti, Status Kehadiran (+ Kecamatan, dikelola terpisah karena bertingkat per Kabupaten) | owner/superuser | ✅ Aktif |
| **Config Info** | `vue-config-info.js` | 2 bagian: **Pengumuman** (dengan lampiran gambar/video) + **Quote Harian** (jadwal per tanggal) | owner/superuser | ✅ Aktif |
| **Hak Akses** | `vue-hak-akses.js` | — | **owner saja** | ✅ Aktif |
| **Config Akses** | `vue-config-akses.js` | Termasuk kartu "Tingkat Keamanan Dasar" per profil | **owner saja** | ✅ Aktif (baru "cetak biru" sebagian — lihat STATUS-PROYEK.md §6.3) |

---

## 🔌 Integrasi (sidebar desktop / grup menu Home)

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **WhatsApp Gateway** | `vue-whatsapp-gateway.js` | 3 tab: **Config API**, **Template Pesan**, **Monitoring Respon** | owner/superuser | ✅ Aktif (toggle OTP di tab Config API, tapi sekarang kirim lewat Email) |
| **Mail Gateway** | `vue-mail-gateway.js` | 3 tab: **Config & Tes OTP**, **Template Pesan**, **Monitoring** | owner/superuser | ✅ Aktif |

---

## 🔑 Alur Login & Registrasi (bukan menu, tapi sering ditanya)

| Bagian | File Utama | Sub-tahap di dalamnya |
|---|---|---|
| **Registrasi karyawan baru** | `vue-registrasi.js` | 4 tahap: Email → OTP → Form data lengkap → Selesai |
| **Login** | `vue-login.js` | Termasuk modal OTP perangkat baru + modal wajib ganti password (2 modal terpisah, muncul kondisional) |
| **Sesi & role saat login** | `auth.js` | `window.cekIzinMenu`, `window.cekFiturAkses`, `window.muatAksesConfigSaya` |
| **Navigasi antar-tab** | `dashboard.js` | `pindahTab`/`pindahSubTab`, peta mount tiap layar |
| **Kamera & submit absensi** | `vue-camera.js` | Hadir/Izin/Cuti/Lembur/Clock Out — 1 komponen, banyak mode lewat `window.statusPilihanGlobal` |

---

## 🧩 File "tak kasat mata" (bukan 1 menu spesifik, dipakai di mana-mana)

| File | Isinya |
|---|---|
| `vue-components.js` | Komponen bersama: `DuaBaris`, `GudangRingkas`, `GudangCheckboxSelect`, `MasterDataCategory`, `PengumumanCarousel`, `QuoteCard`, `EmojiPicker`, `daftarMenuGroups()` (registry menu Home) |
| `vue-paginasi.js` | Composable paginasi Firestore — dipakai Daftar Karyawan, belum dipasang di layar lain |
| `vue-otp.js` | `window.kirimOtpEmail`/`verifikasiOtpEmail` — fondasi OTP, dipakai Registrasi & Login |
| `firebase-config.js` | Inisialisasi Firebase, termasuk `firebaseConfig` mentah (dipakai Antrean Dakar buat instance kedua) |
| `css/gechoo-design.css` | Semua warna/style — kalau soal tampilan (warna, jarak, ukuran font) tapi bukan soal 1 menu spesifik, ini filenya |
| `index.html` | Kerangka halaman, semua mount point (`<div id="vue-...">`), tombol sidebar/sub-tab |

---

## Aturan lain yang mungkin perlu (bukan `.js`)

| File | Kapan dibutuhkan |
|---|---|
| `firestore.rules` | Error "permission denied", atau menambah koleksi Firestore baru |
| `storage.rules` | Masalah upload gambar/video (Config Info) |
