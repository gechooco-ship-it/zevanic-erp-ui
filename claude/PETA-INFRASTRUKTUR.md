# PETA INFRASTRUKTUR & LAYANAN LUAR — Zevanic/Gechoo ERP

> Beda dari 5 file "peta" lainnya (yang semuanya soal KODE), file ini
> soal LAYANAN DI LUAR kode — akun, project, servis pihak ketiga yang
> aplikasi ini bergantung. Berguna kalau ada error yang sumbernya BUKAN
> dari kode (misal: Extension mati, kuota habis, domain tidak konek).

---

## 🔥 Firebase

| Item | Nilai |
|---|---|
| Project ID | `zevanic-erp` |
| Auth domain | `zevanic-erp.firebaseapp.com` |
| Storage bucket | `zevanic-erp.firebasestorage.app` |
| Paket | Blaze (bayar-sesuai-pakai) |
| Lokasi Firestore | `asia-southeast2` (Jakarta) — **PENTING** kalau install Extension baru, harus pilih lokasi yang SAMA, kalau tidak instalasi gagal (pernah kejadian, lihat riwayat malam 17-18 Agt 2026) |

### Layanan Firebase yang dipakai
- **Firestore** — database utama (lihat `PETA-DATABASE.md`)
- **Authentication** — login email+password
- **Storage** — lampiran gambar/video Pengumuman (`storage.rules`)
- **Extension: Trigger Email** (`firebase/firestore-send-email`) — kirim
  email OTP & notifikasi. ⚠️ **Firebase Extensions (seluruh platform)
  akan DITUTUP 31 Maret 2027** — kalau masih pakai ini setelah tanggal
  itu, perlu pindah ke Cloud Function biasa. Catat ini di kalender kalau
  perlu.
- **Custom Claims** (`syncRoleClaim`) — Cloud Function yang sinkronkan
  field `role` di Firestore ke token Auth. **File-nya ada di REPO
  TERPISAH** (`zevanic-cloud-function`, bukan `zevanic-erp-ui`) — Claude
  TIDAK punya akses baca/edit ke situ dalam sesi chat biasa.

### 🔒 `firestore.rules` — TIDAK ADA di repo GitHub, TAPI ADA SNAPSHOT (BARU, 23 Agt 2026)

`firestore.rules` dideploy LANGSUNG dari Firebase Console (lihat tabel
"Cara deploy" di bawah), jadi TIDAK PERNAH otomatis kebaca sesi Claude
manapun lewat `git clone`/`WebFetch` GitHub seperti file `.js` lainnya.

**23 Agustus 2026** — Hilman PERNAH paste isi lengkapnya langsung ke
chat (dipakai buat mendiagnosis bug §19.9 di `STATUS-PROYEK.md`, soal
Kiosk gagal Clock Out gara-gara dokumen zombie gudang tidak cocok).
Isinya SUDAH disimpan sebagai snapshot di
**`claude/FIRESTORE-RULES-SNAPSHOT.md`** — baca file itu KALAU lagi
diagnosis error `permission-denied` atau butuh tahu persis siapa boleh
baca/tulis koleksi apa. **INGAT: itu snapshot SATU WAKTU, bisa BASI**
kalau rules production sudah berubah lagi sejak itu — kalau ragu/gejala
tidak cocok, minta Hilman paste ulang isi terbaru dari Firebase Console
(Firestore Database → Rules), JANGAN asumsikan snapshot lama masih akurat.

---

## 📧 Email (SMTP untuk Trigger Email)

| Item | Nilai |
|---|---|
| Akun Gmail pengirim | `system.zevanic@gmail.com` |
| Metode auth | App Password (BUKAN password akun biasa) — 2-Step Verification WAJIB aktif dulu di akun itu |
| Nama tampil pengirim | "Zevanic ERP" |
| Koleksi Firestore "kotak pos" | `mail` (Extension baca dari sini) |

⚠️ **Kalau App Password ini perlu diganti** (misal akun Gmail diganti,
atau App Password di-revoke): masuk ke Firebase Console → Extensions →
Trigger Email → Configuration → update field "SMTP password" di situ.
**JANGAN PERNAH** tempel App Password di chat manapun dengan Claude —
selalu masukkan LANGSUNG ke form Firebase Console.

---

## 🌐 Hosting & Domain

| Item | Nilai |
|---|---|
| Repo GitHub | `gechooco-ship-it/zevanic-erp-ui` (publik) |
| Metode deploy | GitHub Pages, otomatis lewat GitHub Actions tiap push ke branch utama |
| Domain custom | `gechoo.online` |
| ⚠️ Kendala yang pernah terjadi | GitHub Actions sempat gagal berkali-kali (17-18 Agt 2026) karena server GitHub sendiri sibuk (error 429 "Too Many Requests") — bukan salah kode, solusinya cuma "Re-run failed jobs" di tab Actions dan tunggu |

### 🔑 Cara Claude membaca kode repo ini — WAJIB dibaca (ditemukan 23 Agt 2026)

Project claude.ai ini ("zevanichouse-erp") punya **GitHub sync** yang
menarik isi repo ke knowledge base Project, dicari lewat `project_search`.
**Sync ini TERBUKTI BISA BASI/KETINGGALAN** — pernah kejadian nyata
(23 Agt 2026) `project_search` menampilkan versi LAMA dari `vue-login.js`
(masih OTP client-side via WhatsApp, sudah tidak dipakai) dan
`vue-registrasi.js` (alur lama, bukan `pendaftaran_pending`), bahkan
mengesankan `vue-buat-password.js` **tidak ada sama sekali** — padahal
semuanya SUDAH ada & benar di GitHub asli. Akibatnya sempat muncul
laporan "bug" yang sebenarnya cuma bacaan dari data basi, bukan kondisi
kode sungguhan.

⚠️ **Tambahan (23 Agt 2026, kejadian sama hari)**: dokumen project INI
SENDIRI (`PETA-INFRASTRUKTUR.md`) pernah HILANG dari daftar dokumen
Project — kemungkinan besar tabrakan antara proses tulis dokumen dan
proses resync GitHub yang berjalan bersamaan (saat itu setting sync
project juga baru diubah dari "cuma folder js/" jadi "seluruh repo").
Kalau ada dokumen `PETA-*.md`/`STATUS-PROYEK.md` yang tiba-tiba tidak
bisa dibuka/hilang dari daftar — coba dulu cek ulang beberapa saat
kemudian (mungkin masih proses sync), baru simpulkan hilang beneran.

**Cara yang TERBUKTI akurat buat cek kondisi KODE repo**: Claude PUNYA
akses baca repo publik ini lewat `WebFetch` ke URL `github.com` biasa
(BUKAN `raw.githubusercontent.com`, lihat §18.5 `STATUS-PROYEK.md` soal
itu juga bisa basi), format:
`https://github.com/gechooco-ship-it/zevanic-erp-ui/blob/main/<path-file>`
— contoh: `.../blob/main/js/vue-login.js`. Ini sudah dites berkali-kali
23 Agt 2026, hasilnya selalu cocok dengan kondisi repo terkini. Selain
`WebFetch`, `git clone --depth 1 https://github.com/gechooco-ship-it/zevanic-erp-ui.git`
lewat Bash JUGA terbukti jalan dan lebih praktis buat baca banyak file
sekaligus (lihat `STATUS-PROYEK.md` §19.0 buat detail lengkap metode ini).

**Aturan baku ke depan**: kalau butuh MEMASTIKAN kondisi kode SEKARANG
(bukan sekadar cari konteks umum) — terutama sebelum menyimpulkan "ini
bug" atau "ini belum dikerjakan" — Claude WAJIB verifikasi lewat
`git clone`/`WebFetch` ke repo GitHub asli dulu, JANGAN cuma andalkan
`project_search` Project ini (yang cuma cocok buat cari konteks/pola
umum, bukan bukti kondisi terkini).

---

## 🔐 Cara deploy — ringkasan (detail lengkap di `STATUS-PROYEK.md` §3)

| Jenis file | Cara deploy |
|---|---|
| `.js`, `.html`, `.css`, `.md` (KODE, ke repo) | Upload ke GitHub repo |
| `.md` (dokumen knowledge/peta — BARU 2 Sep 2026) | `project_write` ke Project claude.ai `zevanichouse-erp` **DAN** folder lokal `F:\ZEVANIC HOUSE\FOUNDATION\Code\Claude\` di komputer Guru (lewat device bridge) — dobel, lihat `PEDOMAN-GAYA-KERJA.md` bagian "Cara kirim hasil kerja" |
| `firestore.rules` | Firebase Console → Firestore Database → Rules → Publish (lihat snapshot terakhir di `claude/FIRESTORE-RULES-SNAPSHOT.md`) |
| `storage.rules` | Firebase Console → Storage → Rules → Publish (BEDA tempat dari Firestore Rules) |
| Konfigurasi SMTP/Extension | Firebase Console → Extensions → Trigger Email → Configuration |

---

## Yang SENGAJA TIDAK dicatat di sini (dan tidak boleh diminta ke Claude)

- Password akun apapun (Gmail, Firebase, GitHub)
- API key mentah, App Password, atau kredensial lain
- Kalau perlu ganti/atur kredensial, selalu lewat Console/Settings
  resminya langsung, bukan lewat chat dengan Claude.
