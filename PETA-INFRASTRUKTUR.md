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

**Claude TIDAK punya akses otomatis ke repo ini** — sudah dicoba dicari
lewat pencarian web, tidak ketemu (kemungkinan tidak terindeks). Selalu
upload file `.js`/`.html` langsung ke chat kalau perlu diedit.

---

## 🔐 Cara deploy — ringkasan (detail lengkap di `STATUS-PROYEK.md` §3)

| Jenis file | Cara deploy |
|---|---|
| `.js`, `.html`, `.css`, `.md` | Upload ke GitHub repo |
| `firestore.rules` | Firebase Console → Firestore Database → Rules → Publish |
| `storage.rules` | Firebase Console → Storage → Rules → Publish (BEDA tempat dari Firestore Rules) |
| Konfigurasi SMTP/Extension | Firebase Console → Extensions → Trigger Email → Configuration |

---

## Yang SENGAJA TIDAK dicatat di sini (dan tidak boleh diminta ke Claude)

- Password akun apapun (Gmail, Firebase, GitHub)
- API key mentah, App Password, atau kredensial lain
- Kalau perlu ganti/atur kredensial, selalu lewat Console/Settings
  resminya langsung, bukan lewat chat dengan Claude.
