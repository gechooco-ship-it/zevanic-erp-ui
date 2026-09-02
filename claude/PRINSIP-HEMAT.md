# Prinsip Hemat & Konsistensi — Zevanic/Gechoo ERP

Dokumen acuan supaya setiap fitur baru (terutama yang melibatkan tabel,
foto, atau data yang bakal tumbuh terus) dibangun dengan pola yang benar
dari awal — bukan diperbaiki belakangan setelah kena masalah baca/tulis
boros. Dibuat 17 Agustus 2026 setelah insiden "boros read" dari komponen
admin yang ter-mount otomatis di setiap pemuatan halaman.

## Sudah diterapkan ✅

- **Custom Claims untuk role** (bukan baca `users/{email}` tiap cek akses) —
  role disimpan di token Auth lewat Cloud Function `syncRoleClaim`.
  Pengecekan role di Security Rules & client GRATIS, tidak dihitung read.
- **State klien**: `window.currentUser` dibaca SEKALI pas login, dipakai
  ulang di semua layar — tidak pernah query ulang cuma buat nama/foto/role
  yang sama.
- **Tidak menulis apapun ke Firestore di setiap login** — cuma baca.
- **Batched writes** (`writeBatch`) dipakai untuk Update Massal & Config
  Akses — banyak perubahan jadi 1 operasi jaringan, bukan 1 per baris.
- **Mount-on-demand untuk semua layar admin** (Master Absensi, Master
  Karyawan, WhatsApp Gateway): komponen Vue-nya BARU `createApp().mount()`
  saat sub-tab-nya benar-benar diklik pertama kali — bukan otomatis dari
  awal halaman dibuka. Kalau orang tidak pernah buka menu itu, komponennya
  tidak pernah lahir, tidak pernah coba baca Firestore. Pola:
  `window.pastikanMountXxx()` (idempoten) dipanggil dari
  `dashboard.js` `pindahSubTab`/`pindahTab`.
- **Komponen bersama** untuk pola yang dipakai berkali-kali — lihat daftar
  di bawah. **Prinsip baku ke depan: kalau ada tampilan/logic yang
  berpotensi dipakai >1 tempat, langsung jadi komponen bersama dari awal,
  jangan tunggu ketahuan dipakai ulang baru ditarik.**
- **Offline Persistence** (IndexedDB, `persistentLocalCache` +
  `persistentMultipleTabManager`) aktif di `firebase-config.js` sejak
  17 Agt 2026 — data yang pernah dibaca tersimpan lokal, mengurangi
  round-trip baca berulang untuk data yang sama.
- **`waktu_ts` (Timestamp asli, BUKAN teks) — 18 Agt 2026**. Dulu
  koleksi `absensi` cuma simpan `waktu` sebagai teks lokal Indonesia
  (`"17/8/2026, 08.15.32"`) — Firestore TIDAK BISA query rentang tanggal
  atau `orderBy` yang benar-benar andal di server pakai format teks
  begitu. Sekarang tiap dokumen baru (`vue-camera.js`) JUGA menulis
  `waktu_ts: serverTimestamp()` (jam SERVER, bukan jam HP orang — praktik
  baku Firestore, supaya tidak bisa dimanipulasi). Field `waktu` (teks)
  TETAP dipertahankan buat tampilan/kode lama, tidak dihapus. Dokumen
  LAMA (dari sebelum tanggal ini) dimigrasi lewat alat 1x-jalan di
  **Riwayat All Absensi** (banner kuning, muncul otomatis kalau masih
  ada data belum bermigrasi, pakai `writeBatch` per 400 dokumen — aman
  diulang kalau terputus). `hitungJamKeluarUntukGaji()` (vue-camera.js)
  sudah pakai `waktu_ts` buat cocokkan "lembur disetujui hari ini",
  dengan fallback ke cara lama (cocokkan teks) buat dokumen yang belum
  sempat dimigrasi.
- **Pola "filter rentang tanggal jadi query" untuk laporan/riwayat —
  dipakai ulang 3x sekarang**: Riwayat All Absensi (19 Agt),
  Riwayat Reimburse/Bensin/Servis (29 Agt, §44.17). Default rentang
  BEDA per konteks (Absensi = Hari Ini karena harian; Reimburse = 30
  Hari Terakhir karena jauh lebih jarang diajukan) — preset Hari Ini/
  Kemarin/7 Hari/30 Hari/(90 Hari)/Custom, field tanggal WAJIB
  Timestamp asli (bukan teks) supaya bisa di-`where()` rentang.
- **`wa_log.waktu_ts` (Timestamp asli) — 29 Agt 2026, §44.17**. Sama
  motivasi seperti `absensi.waktu_ts` — Monitoring Respon WhatsApp
  Gateway dulu fetch SELURUH `wa_log` (paling boros dari semua temuan
  §44.16: baca ribuan demi tampilkan 50 terbaru) karena field `waktu`
  cuma teks. Sekarang `orderBy("waktu_ts","desc")+limit(50)` sungguhan
  + tombol "Muat Lagi" (cursor `startAfter`, MENAMBAH ke daftar —
  pola "load more", bukan ganti halaman). Log SEBELUM perbaikan ini
  (belum punya `waktu_ts`) tidak ikut orderBy ini — ada tombol manual
  terpisah "Lihat Log Sebelum Pembaruan" (fetch-semua sekali klik,
  BUKAN otomatis) buat tetap bisa dilihat.

## Komponen bersama yang sudah ada (vue-components.js)

| Komponen | Fungsi |
|---|---|
| `GudangCheckboxSelect` | Dropdown multi-pilih gudang, bisa Select All/Clear All |
| `GudangRingkas` | Tampilan gudang dipersingkat + popup "lihat semua" kalau banyak |
| `DuaBaris` | Tampilan 2 baris (judul tebal + sub-teks) di sel tabel |
| `MasterDataCategory` | 1 kategori master data (tambah/lihat/hapus item) |
| `KecamatanManager` | Kelola Kabupaten→Kecamatan bertingkat |
| `daftarMenuGroups(role)` | Registry terpusat menu Home, per-role, siap dipakai ulang desktop |

**Sebelum bikin UI/logic baru: cek dulu apakah polanya sudah ada di sini.**
Kalau belum ada tapi kira-kira bakal dipakai lagi (misal: tampilan foto
karyawan dengan badge status, atau kartu ringkasan berskala/berklik) —
buat sebagai komponen bersama dari awal, bukan ditulis lokal dulu.

## Aturan baku tabel (mulai 17 Agt 2026, malam)

Semua tabel BARU (dan tabel lama yang direfaktor) mengikuti 1 pola seragam
ini — composable-nya ada di `js/vue-paginasi.js`:

| Kondisi | Cara ambil data |
|---|---|
| Browsing polos (tanpa cari/filter) | Paginasi cursor (`.limit()`+`.startAfter()`), hemat |
| 1 filter dropdown pilihan tetap aktif (Role/Gudang/dst) | Paginasi + `where()`, masih hemat |
| Kotak cari nama diisi | Paginasi + prefix-match (`>=`/`<=`), masih hemat |
| Filter dropdown + cari AKTIF BERSAMAAN | Balik ke fetch-semua + filter di JS (satu-satunya kondisi boros yang disisakan — index gabungan Firestore untuk semua kombinasi filter itu tidak praktis) |

**Keterbatasan pencarian yang wajib diketahui:**
- Cuma bisa cari AWALAN ("nama yang DIAWALI teks ini"), bukan cari
  teks di tengah kata.
- Peka huruf besar/kecil — field yang mau dicari harus konsisten
  kapitalisasinya, atau siapkan field tambahan huruf-kecil-semua.

**Kalau tabelnya juga punya kartu ringkasan berisi TOTAL/hitungan**
(seperti kartu Role di Hak Akses) — paginasi TIDAK CUKUP, karena cuma
punya sebagian data di memori. Kartu itu perlu query terpisah pakai
`getCountFromServer()` (aggregation query — hitung jumlah tanpa baca
seluruh isi dokumennya). Ini pekerjaan TAMBAHAN di luar paginasi tabelnya
sendiri, belum dikerjakan per 17 Agt 2026.

**Status penerapan per 17 Agt 2026 malam:**
- ✅ Daftar Karyawan — paginasi dasar (belum ada cari/filter di layar ini)
- ⏳ Antrean Dakar, Penjadwalan, Hak Akses — belum, masing-masing beda
  tingkat kerumitan (Hak Akses paling rumit karena ada kartu ringkasan)



**KOREKSI SKALA (29 Agt 2026, §44.17)**: asumsi "~90-100 karyawan" di
bawah ini SALAH — skala SUNGGUHAN adalah **500 karyawan aktif**
(dikonfirmasi Guru setelah insiden 86.000 read Firestore dalam 1 hari).
Poin 1-3 di bawah jadi JAUH LEBIH MENDESAK daripada tertulis
sebelumnya — bukan lagi "belum genting", beberapa sudah mulai
dikerjakan (lihat STATUS-PROYEK.md §44.15-44.17: Antrean Absensi,
Antrean Lembur, Riwayat Reimburse, WhatsApp Log Monitoring sudah
dibenahi; Penjadwalan sebagian; Hak Akses/Antrean Dakar/Device Kiosk
masih belum).

Ini BUKAN lagi "tugas nanti" di skala 500 karyawan (koreksi dari
tulisan asli di bawah, yang mengasumsikan ~90-100 karyawan), WAJIB
terus dikerjakan bertahap untuk layar yang masih fetch-semua tanpa
batas:

1. **Paginasi Firestore sungguhan** (bukan cuma potong array di JS).
   Layar SAAT INI (Penjadwalan, Hak Akses, Daftar Karyawan, dst) masih
   ambil SEMUA dokumen dulu baru dipotong tampilannya per halaman — itu
   TIDAK menghemat read sama sekali. Ganti ke `.limit(N)` + cursor
   `startAfter(dokumenTerakhir)` supaya cuma dokumen di halaman itu yang
   ditarik dari server.
2. **Filter/pencarian server-side**, bukan filter array di JS setelah
   ambil semua. Terutama penting untuk koleksi `absensi` yang terus
   bertambah — jangan pernah `getDocs(collection(db,"absensi"))` tanpa
   `where()`/`limit()` begitu datanya sudah besar.
3. **Aggregation queries** (`getCountFromServer()`) untuk kartu ringkasan
   ("Total Hadir", "ACC Valid", dst) — sekarang masih hitung `.length` dari
   dokumen yang sudah ditarik penuh, padahal cuma butuh angkanya saja.
4. **Cek-sebelum-tulis**: sebelum `updateDoc`, bandingkan dulu nilai baru
   vs lama — skip kalau sama, supaya tidak menulis hal yang tidak berubah.
5. Kalau nanti ada fitur galeri/riwayat foto absensi yang menampilkan
   BANYAK foto sekaligus — pertimbangkan lazy-load per-scroll (bukan muat
   semua foto base64 sekaligus, yang juga berat untuk paket data
   karyawan lapangan).

## Yang SENGAJA belum dikerjakan (jangan diusulkan dulu di skala sekarang)

Supaya tidak over-engineering — ini teknik yang valid tapi solusi untuk
skala yang jauh lebih besar dari kondisi app ini sekarang:

- **Distributed counters** — buat ribuan tulis bersamaan per detik ke 1
  dokumen; kita jauh dari skala itu.
- **Virtual scrolling/windowing** — baru relevan kalau 1 tabel render
  ratusan+ baris SEKALIGUS tanpa paginasi. Selama paginasi (poin PR #1)
  jalan, jumlah baris yang di-render selalu kecil, tidak butuh ini.
- **Realtime Database untuk status online** — tidak ada fitur "siapa
  sedang online" di app ini.
- **Koleksi "sessions" manual** — Custom Claims sudah menutupi kebutuhan
  cek sesi/role, tidak perlu koleksi terpisah.
