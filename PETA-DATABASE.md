# PETA DATABASE & STORAGE — Zevanic/Gechoo ERP

> Referensi struktur data — koleksi Firestore apa saja yang ada, field
> apa isinya, dan struktur folder Storage. Semua field di bawah ini
> **DICEK LANGSUNG ke kode** (bukan dari ingatan), tapi bisa saja ada
> field TAMBAHAN yang jarang ditulis dan lewat dari penelusuran ini —
> kalau ragu, selalu cek juga langsung ke Firestore Console.

---

## 🔥 Firestore — 13 koleksi

### `users/{email}` — profil karyawan resmi (SUDAH disetujui)
Dokumen ID = email karyawan.

| Field | Tipe | Keterangan |
|---|---|---|
| `role` | string | Tingkat keamanan BAKU (operator/pic/admin/owner/superuser) — dipakai Firestore Rules & custom claim. **JANGAN PERNAH** isi ini dengan nama profil kustom |
| `profil_akses` | string | Nama profil Config Akses (bisa custom, mis. `admin_finance`) — dipakai cari izin tampilan |
| `status_approval` | string | `PENDING` / `APPROVED` — untuk akun baru (dari Antrean Dakar) langsung `APPROVED` |
| `wajib_ganti_password` | boolean | `true` kalau baru disetujui, password masih NIK — dicek `vue-login.js` |
| `gudang_penempatan` | array\<string\> | Nama-nama gudang |
| `status_kerja`, `jenis_pekerjaan`, `jabatan`, `status_karyawan` | string | Dari Master Data (`master_data` koleksi) |
| `nama`, `nik`, `email`, `hp`, `gender`, `tempatLahir`, `tglLahir`, `foto_ktp` | — | Data identitas (dari pendaftaran) |
| `tinggalKab`, `tinggalKec`, `tinggalDetail`, `ktpKab`, `ktpKec`, `ktpDetail` | string | Alamat (domisili + KTP, bisa beda) |
| `statusNikah`, `tanggungan` | string | — |
| `pendidikan`, `sekolah`, `jurusan` | string | — |
| `bank`, `noRek`, `atasNamaRek` | string | — |
| `daruratNama`, `daruratHp`, `daruratHub` | string | Kontak darurat |
| `id_karyawan`, `id_app`, `qr_code` | string | ID internal (`ZVN-xxxx`, `ZMS-xxxx`) |
| `nama_shift` | string | Nama shift yang ditugaskan (dicocokkan ke `master_shift`) |

### `pendaftaran_pending/{email}` — form Registrasi SEBELUM diverifikasi Admin
Field-nya SAMA PERSIS dengan bagian identitas di atas (`nama`, `nik`, `jenis_pekerjaan`, dst) — TAPI **belum ada** `role`/`profil_akses`/`status_approval`/`gudang_penempatan` sama sekali (itu baru ditambahkan pas Antrean Dakar approve). **REVISI KE-3 (18 Agt 2026)**: begitu Admin klik "Setujui", field kerja (`status_kerja`/`jabatan`/`status_karyawan`/`nama_shift`/`gudang_penempatan`) DITULIS DI SINI DULU, plus `token_buat_password` (string acak), `token_kadaluarsa` (Timestamp, 30 menit), `token_terverifikasi` (boolean, awalnya `false`) — BUKAN langsung bikin akun. Karyawan verifikasi token lewat TULIS `tebakan_token` (pola sama `otp_email`, lihat `js/vue-buat-password.js`), begitu cocok baru boleh baca dokumen ini & bikin password sendiri. Field `token_*` DIBUANG (tidak ikut) saat akhirnya ditulis ke `users`. Dihapus SENDIRI oleh karyawan (setelah akun jadi) ATAU oleh Admin (Tolak).

### `absensi/{autoId}` — SEMUA catatan (Hadir/Izin/Cuti/Lembur/Clock Out)
1 koleksi buat SEMUA jenis pengajuan, dibedakan field `status`.

| Field | Tipe | Keterangan |
|---|---|---|
| `status` | string | `"HADIR (CLOCK IN)"` / `"CLOCK OUT"` / `"IZIN"` / `"CUTI"` / `"LEMBUR (CLOCK IN)"` |
| `status_acc` | string | `PENDING` / `ACC` / `REJECT` — dipakai Antrean Absensi/Lembur |
| `waktu` | string | Teks lokal Indonesia (`"17/8/2026, 08.15.32"`) — LAMA, dipertahankan buat tampilan |
| `waktu_ts` | Timestamp | **BARU (18 Agt 2026)** — Timestamp asli, `serverTimestamp()`. Dokumen SEBELUM tanggal itu mungkin belum punya, lihat alat migrasi di Riwayat All Absensi |
| `nama_pegawai`, `email`, `role` | — | Identitas pengaju |
| `foto_selfie` | string (base64) | Foto bukti kehadiran |
| `gudang`, `koordinat`, `jarak_meter`, `radius_izin_meter`, `status_radius` | — | Hanya kalau `perluLokasi` (Hadir/Clock Out) |
| `jam_keluar_untuk_gaji` | string | **Hanya di dokumen CLOCK OUT** — jam yang sudah dibatasi jadwal shift (lihat `PRINSIP-HEMAT.md`) |
| `tanggal_pengajuan`, `keterangan` | — | Hanya IZIN/CUTI |
| `lembur_mulai`, `lembur_selesai`, `lembur_instruksi`, `keterangan` | — | Hanya LEMBUR |
| `seragam` | string | `Sesuai` / lainnya, dicek Admin |
| `validated_at`, `validated_by` | — | Diisi saat Admin ACC/Reject |

### `akses_config/{namaProfil}` — profil Config Akses (izin per menu)
Dokumen ID = nama profil (`operator`, `admin_finance`, dst — TIDAK termasuk `owner`, sengaja dikecualikan).

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Sama dengan ID dokumen |
| `tingkatKeamanan` | string | 1 dari 5 tingkat baku — INI yang jadi `role` kalau profil ini dipasangkan ke karyawan |
| `menus` | object | `{ [menuId]: { view, add, edit, delete, print, fitur? } }` — lihat `DAFTAR_MENU` di `vue-config-akses.js` buat daftar `menuId` lengkap |

### `otp_email/{email}` — kode OTP sementara
⚠️ **Field `kode` TIDAK PERNAH bisa dibaca client** (Security Rules blokir `get` total) — lihat model keamanan lengkap di `vue-otp.js`.

| Field | Tipe | Keterangan |
|---|---|---|
| `kode` | string | 6 digit, TIDAK BISA dibaca balik |
| `terverifikasi` | boolean | — |
| `kadaluarsa` | Timestamp | 10 menit dari dibuat |
| `dibuat_pada` | Timestamp | Dipakai jeda 60 detik anti-spam kirim ulang |

### `pengumuman/{autoId}`
| Field | Tipe | Keterangan |
|---|---|---|
| `judul` (maks 35 karakter), `isi` (maks 145 karakter) | string | — |
| `rolesTampil` | array\<string\> | Kosong = tampil semua role |
| `mediaUrl`, `mediaType` | string | Link Storage + `'image'`/`'video'` (opsional) |
| `dibuat_pada` | Timestamp | — |

### `quotes/{tanggalTampil_timestamp}`
| Field | Tipe | Keterangan |
|---|---|---|
| `judul` (maks 20 karakter), `isi` (maks 60 karakter) | string | — |
| `tanggalTampil` | string | Format `YYYY-MM-DD` — 1 quote tampil PER TANGGAL ini |

### `master_gudang/{autoId}`
`nama_gudang`, `tipe_lokasi` (`Tetap`/`Dinamis`), `latitude`, `longitude`, `radius` (meter — kosong kalau Dinamis). **BARU (18 Agt 2026)**: `jenis_pekerjaan` (array\<string\>, opsional) — 1 gudang boleh dipakai lebih dari 1 jenis pekerjaan. Dokumen lama tanpa field ini dianggap "boleh dilihat semua" (jatuh-aman, lihat `window.bolehLihatJenisPekerjaan` di `auth.js`), diisi belakangan lewat tombol Edit di Config Absensi > Master Gudang.

### `master_shift/{autoId}`
`nama_shift`, `jam_masuk`, `jam_keluar` (format `"HH:MM"`). **BARU (18 Agt 2026)**: `jenis_pekerjaan` (array\<string\>, opsional) — sama pola seperti `master_gudang` di atas.

### `master_data/{kategori}`
Dokumen ID = nama kategori (`jenis_pekerjaan`, `status_kerja`, `jabatan`, `status_karyawan`, `kabupaten`, `alasan_izin`, `alasan_cuti`, `status_kehadiran`, `kecamatan`). Tiap dokumen isinya `{ items: [...] }` atau `{ map: {...} }` khusus kecamatan (bertingkat per kabupaten).

### `config/{docId}` — dokumen config macam-macam
- `config/mail_templates` — subjek+isi email OTP (Mail Gateway > Template Pesan)
- `config/whatsapp_gateway` — `otp_aktif` (toggle, SEKARANG kendalikan OTP Email, bukan WA lagi), setting API WA
- `config/whatsapp_templates` — template pesan WA

### `mail/{autoId}` — "kotak pos" buat Extension Trigger Email
`to` (array, 1 email), `message: { subject, text }`, `dikirim_pada` (Timestamp). Field `delivery` DITAMBAHKAN OTOMATIS oleh Extension setelah dicoba kirim (`delivery.state`: SUCCESS/ERROR).

### `wa_log/{autoId}`
`waktu`, `target` (nomor HP), `jenis`, `pesan`, `sukses` (boolean), `keterangan`.

---

## 🗄️ Firebase Storage

| Path | Isinya |
|---|---|
| `pengumuman/{idPengumuman}/media_{timestamp}.{ext}` | Lampiran gambar/video Pengumuman (Config Info) — maks 1MB, divalidasi client + Storage Rules |

*(Cuma 1 folder yang dipakai per 18 Agt 2026 — foto selfie/KTP TIDAK di Storage, masih base64 langsung di field Firestore `foto_selfie`/`foto_ktp`, dengan segala konsekuensi ukuran dokumennya.)*

---

## ⚠️ Hal penting yang perlu diingat soal skema ini

1. **`role` vs `profil_akses`** (di `users`) — JANGAN PERNAH disatukan lagi. `role` cuma boleh 5 nilai baku, `profil_akses` boleh bebas. Lihat `STATUS-PROYEK.md` §6.2 untuk kronologi kenapa ini dipisah.
2. **`waktu` vs `waktu_ts`** (di `absensi`) — dua-duanya ada buat sementara (masa transisi). `waktu` jangan dihapus dulu (masih dipakai tampilan lama), `waktu_ts` yang dipakai buat query hemat ke depan.
3. **`foto_selfie`/`foto_ktp` base64 langsung di Firestore** — ini POTENSI RISIKO ke depan (dekati batas 1MB/dokumen Firestore kalau foto besar). Belum dipindah ke Storage seperti lampiran Pengumuman — kandidat perbaikan kalau ada masalah ukuran dokumen nanti.
