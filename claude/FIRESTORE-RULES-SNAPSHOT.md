# SNAPSHOT firestore.rules — Zevanic/Gechoo ERP

> **PENTING**: `firestore.rules` TIDAK ADA di repo GitHub (`zevanic-erp-ui`)
> — dideploy langsung dari Firebase Console → Firestore Database → Rules
> (lihat `PETA-INFRASTRUKTUR.md`). Sesi Claude manapun TIDAK PUNYA akses
> baca langsung ke rules yang benar-benar aktif di production.
>
> File ini adalah **SNAPSHOT**. Sumber isi "Isi lengkap" di bawah:
> - **Bukan** paste manual dari Firebase Console lagi (beda dari revisi
>   sebelumnya, 23 Agustus 2026).
> - Diambil dari file lokal `firestore.rules` yang Hilman simpan di
>   `F:\ZEVANIC HOUSE\FOUNDATION\Code\` (di-stage & dibaca langsung oleh
>   Claude, 7 September 2026 siang) — asumsinya file lokal ini adalah
>   copy kerja yang dijaga sinkron dengan production, TAPI **tetap bukan
>   pembacaan langsung ke Firebase Console**, jadi bisa saja sudah
>   berbeda dari yang benar-benar live kalau ada perubahan yang belum
>   disalin balik ke file lokal itu.
> - **DITAMBAH 2 blok baru** (`piutang_pembayaran` dari §5.15, DAN
>   `riwayat_pin` dari §5.13 — sempat KELEWATAN di revisi pertama tadi
>   siang, baru ditambahkan belakangan setelah dicek ulang isi §5.13,
>   lihat bagian "Perubahan di revisi ini" di bawah) yang **DISIAPKAN
>   Claude, BELUM TENTU SUDAH DIPUBLISH** ke Firebase Console saat file
>   ini ditulis — file lengkap sudah dikirim ke Guru (`Code\firestore.
>   rules`, siap copy-paste seluruhnya ke Firebase Console → Publish).
>   **JANGAN anggap kedua blok ini sudah aktif di production sampai
>   Guru konfirmasi sudah publish** — cek `STATUS-PROYEK.md` §5.13/
>   §5.15 / poin blocker masing-masing untuk status terkini.
>
> ⚠️ **BISA BASI** — sama seperti revisi sebelumnya, kalau lagi diagnosis
> bug `permission-denied` dan snapshot ini terasa tidak cocok dengan
> gejala yang dilaporkan, **minta Hilman paste ulang isi rules yang
> BENAR-BENAR aktif dari Firebase Console** — jangan asumsikan file
> lokal `Code\firestore.rules` maupun snapshot ini 100% akurat selamanya.

---

## Perubahan di revisi ini (7 September 2026 malam, §5.18)

1. **BARU ditambahkan**: `match /permintaan_bahan_manual/{docId}` — koleksi
   BARU, hasil PEMINDAHAN data papan manual "Persiapan Masalah" lama
   (`js/vue-persiapan-masalah.js` + 2 penulis lain: `vue-scan-persiapan.js`
   fungsi kekurangan roll/lot, `vue-stock-pembelian.js` Daftar Permintaan,
   dan KPI `vue-home-desktop.js`) — SEBELUMNYA menulis ke `persiapan_masalah`,
   nama itu sekarang DIBEBASKAN untuk skema baru pos Masalah (lihat poin 2).
   Pola rule disalin PERSIS dari rule `persiapan_masalah` yang lama (baris di
   bawah, TIDAK berubah): `read: login()`, `write: isAdminLevel()` — fungsi
   & wewenang board manual ini TIDAK berubah, cuma nama koleksinya.
   **DRAFT — BELUM DIPUBLISH ke Firebase Console**, Guru perlu tempel blok
   ini (lihat "Isi lengkap" di bawah, sudah disisipkan di posisi yang benar)
   sebelum fitur board manual bisa dipakai lagi setelah update ini di-deploy.
2. **Rule `persiapan_masalah` yang SUDAH ADA (baris di bawah, TIDAK diubah
   sama sekali)** sekarang dipakai untuk SKEMA BARU: pos "Masalah" 7 tahap
   di Persiapan Produksi (`js/vue-pp-masalah.js`, langkah 6 rencana
   rekonstruksi). Rule generik `read: login()` / `write: isAdminLevel()`
   sudah cukup menaungi skema baru ini TANPA perlu diubah — modul ini tidak
   menambah rule field-level apapun (tombol Setujui/Tolak/Ajukan Belanja di
   6.2 digerbang di SISI KLIEN lewat `tierOwnerKeAtas()`, konsisten dengan
   pola approval QO/pembayaran piutang lain di app ini yang juga tidak punya
   rule Firestore field-level, cuma gerbang `isAdminLevel()` per koleksi).

---

## Perubahan di revisi sebelumnya (7 September 2026)

1. **Revisi 23 Agustus sebelumnya SUDAH SANGAT BASI** — cuma berisi
   rules "inti" (users, pendaftaran_pending, absensi, reimburse, master
   generik, otp_email, mail) dan TIDAK menyertakan seluruh blok
   "tambahan Zevanic House" (`master_bahan_aksesoris`,
   `master_pelanggan`, `pesanan_pembelian`, `order_spk`,
   `transaksi_kasir`, `spk_track`, `bagging`, `tugas_kirim`, dst. —
   sekitar 30 koleksi) yang ternyata **SUDAH ADA rules-nya di
   production** sejak 23 Agustus s.d. 5 September 2026. Klaim di
   berbagai `SERAH-TERIMA.md` modul yang bilang rules koleksi-koleksi
   itu "belum dipublish" sudah BASI — sudah dikoreksi di
   `PETA-DATABASE.md` poin 17.
2. **BARU ditambahkan di revisi ini**: `match /piutang_pembayaran/{docId}`
   — koleksi baru dari rekonstruksi §5.15 (`/design-terapkan-handoff`
   "Pesanan dan Transaksi"). Pola: append-only (`read: login()`,
   `create: isAdminLevel()`, `update`/`delete` SELALU `false`) — sama
   seperti pola `cetak_ulang_log`, supaya riwayat pembayaran piutang
   tidak bisa diubah/dihapus lewat client siapa pun (termasuk owner)
   setelah dicatat. **Ini draft yang dikirim ke Guru untuk dipublish —
   field `update, delete: if false` berarti kalau ternyata Guru butuh
   jalur koreksi salah input, itu WAJIB didesain sebagai dokumen koreksi
   baru, bukan edit dokumen lama** (lihat `PETA-DATABASE.md` untuk
   alternatif pola yang lebih longgar kalau ini bukan yang diinginkan).
3. **BARU ditambahkan (susulan, sempat kelewatan)**: `match
   /riwayat_pin/{docId}` — koleksi baru dari §5.13 (tab "Riwayat PIN"
   di Config, `AppConfigRiwayatPin`). Blok ini sempat TIDAK ikut
   ditambahkan waktu revisi pertama dokumen ini ditulis (fokusnya waktu
   itu cuma ke blocker `piutang_pembayaran` dari §5.15) — padahal
   §5.13 sudah lebih dulu mencatat koleksi ini juga belum ada rule-nya.
   Pola: `read: isAdminLevel()` (lebih ketat dari `piutang_pembayaran`
   karena ini riwayat PIN, bukan cuma riwayat pembayaran), `create:
   login()`, `update`/`delete` SELALU `false` — draft dari §5.13,
   BELUM divalidasi Guru.

---

## Isi lengkap (per 7 September 2026 malam, TERMASUK draft `piutang_pembayaran` + `riwayat_pin` + `permintaan_bahan_manual`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function role() {
      return request.auth != null ? request.auth.token.role : null;
    }
    function isAdminLevel() {
      return role() in ['admin', 'pic', 'owner', 'superuser'];
    }
    function isOwnerLevel() {
      return role() in ['owner', 'superuser'];
    }
    function isOwnerOnly() {
      return role() == 'owner';
    }
    function login() {
      return request.auth != null;
    }
    function isKiosk() {
      return login() && get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.jenis_akun == 'kiosk';
    }
    function gudangKiosk() {
      return get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.gudang_penempatan;
    }
    match /users/{email} {
      allow read: if login() && (
        request.auth.token.email == email
        || isAdminLevel()
        || isKiosk()
      );
      allow create: if
        (isAdminLevel()
          && request.resource.data.role == 'operator'
          && request.resource.data.status_approval == 'APPROVED')
        || (request.auth.token.email == email
          && get(/databases/$(database)/documents/pendaftaran_pending/$(email)).data.token_terverifikasi == true
          && request.resource.data.role == 'operator'
          && request.resource.data.status_approval == 'APPROVED')
        || (isOwnerOnly()
          && request.resource.data.role == 'operator'
          && request.resource.data.jenis_akun == 'kiosk'
          && request.resource.data.status_approval == 'APPROVED');
      allow update: if isAdminLevel()
        || (request.auth.token.email == email
            && request.resource.data.get('role', null) == resource.data.get('role', null)
            && request.resource.data.get('status_approval', null) == resource.data.get('status_approval', null)
            && request.resource.data.get('gudang_penempatan', null) == resource.data.get('gudang_penempatan', null));
      allow delete: if isOwnerLevel();
    }
    match /pendaftaran_pending/{email} {
      allow read: if isAdminLevel() || resource.data.token_terverifikasi == true;
      allow create: if isAdminLevel() || get(/databases/$(database)/documents/otp_email/$(email)).data.terverifikasi == true;
      allow update: if
        isAdminLevel()
        ||
        (
          'tebakan_token' in request.resource.data
          && resource.data.token_kadaluarsa > request.time
          && request.resource.data.tebakan_token == resource.data.token_buat_password
          && request.resource.data.token_terverifikasi == true
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['tebakan_token', 'token_terverifikasi'])
        );
      allow delete: if isAdminLevel()
        || (request.auth != null && request.auth.token.email == email && resource.data.token_terverifikasi == true);
    }
    match /absensi/{docId} {
      allow read: if login();
      allow create: if login() && (
        request.resource.data.email == request.auth.token.email
        || (isKiosk() && request.resource.data.gudang in gudangKiosk())
      );
      allow update: if isAdminLevel()
        || request.auth.token.email == resource.data.email
        || (isKiosk() && resource.data.gudang in gudangKiosk());
      allow delete: if isAdminLevel();
    }
    match /reimburse/{docId} {
      allow read: if login();
      allow create: if login()
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.tahap == 'menunggu_admin_finance'
        && request.resource.data.jumlah is number
        && request.resource.data.jumlah > 0;
      allow update: if
        resource.data.email != request.auth.token.email
        && (
          (role() in ['admin', 'owner', 'superuser'] && resource.data.tahap == 'menunggu_admin_finance')
          || (role() in ['pic', 'owner', 'superuser'] && resource.data.tahap == 'menunggu_pic')
          || (role() in ['owner', 'superuser'] && resource.data.tahap == 'menunggu_owner')
        );
      allow delete: if isOwnerLevel();
    }
    match /master_gudang/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_kendaraan/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_shift/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    // ===== BARU (23 Agt 2026) — Zevanic House > Master Bahan & Aksesoris =====
    match /master_bahan_aksesoris/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /pengaturan_id_bahan_aksesoris/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_satuan/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_ukuran/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_jenis_produk/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_komponen/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_warna/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_rak_penyimpanan/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /persiapan_masalah/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    // ===== BARU (7 Sep 2026 malam, §5.18) — board manual "Persiapan
    // Masalah" lama DIPINDAH ke sini (nama persiapan_masalah di atas
    // sekarang dipakai skema BARU pos Masalah Persiapan Produksi) =====
    match /permintaan_bahan_manual/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_suplayer/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    // ===== BARU (5 Sep 2026) — Zevanic House > Master Pelanggan =====
    match /master_pelanggan/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /alias_pembelian/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /pesanan_pembelian/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /riwayat_harga_pembelian/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /kartu_stok_bahan_aksesoris/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /lot_bahan_aksesoris/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /pengaturan_id_pembelian/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /order_spk/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /log_cetak_label/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_produk/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_tahap_persiapan/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /persiapan_produksi/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /persiapan_komponen/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /spk_grouping/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /pengaturan_id_spk_grouping/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /spk_track/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /transaksi_kasir/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /pengaturan_id_transaksi_kasir/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    // ===== BARU (7 Sep 2026, §5.15) — Zevanic House > Pesanan (piutang) =====
    match /piutang_pembayaran/{docId} {
      allow read: if login();
      allow create: if isAdminLevel();
      allow update, delete: if false;
    }
    match /bagging/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /tugas_kirim/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /master_tlc/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /cetak_ulang_log/{docId} {
      allow read: if isAdminLevel();
      allow create: if isAdminLevel();
      allow update, delete: if false;
    }
    match /pengaturan_id_bagging/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /pengaturan_id_tugas_kirim/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    // ===== BARU (7 Sep 2026, §5.13) — Zevanic House > Config > Riwayat PIN =====
    match /riwayat_pin/{docId} {
      allow read: if isAdminLevel();
      allow create: if login();
      allow update, delete: if false;
    }
    // ===== akhir tambahan Zevanic House =====
    match /master_data/{docId} {
      allow read: if true;
      allow write: if isAdminLevel();
    }
    match /config/{docId} {
      allow read: if login();
      allow write: if isOwnerLevel();
    }
    match /wa_log/{docId} {
      allow read: if isAdminLevel();
      allow create: if login();
    }
    match /akses_config/{docId} {
      allow read: if isOwnerOnly();
      allow write: if isOwnerOnly();
    }
    match /pengaturan_sistem/{docId} {
      allow read: if login();
      allow write: if isOwnerOnly();
    }
    match /pengumuman/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /quotes/{docId} {
      allow read: if login();
      allow write: if isAdminLevel();
    }
    match /otp_email/{email} {
      allow get: if false;
      allow list: if false;
      allow write: if
        (
          !('tebakan' in request.resource.data)
          && request.resource.data.terverifikasi == false
          && (
            !exists(/databases/$(database)/documents/otp_email/$(email))
            || get(/databases/$(database)/documents/otp_email/$(email)).data.dibuat_pada < request.time - duration.value(60, 's')
          )
        )
        ||
        (
          'tebakan' in request.resource.data
          && (request.auth == null || request.auth.token.email == email || isAdminLevel())
          && resource.data.kadaluarsa > request.time
          && request.resource.data.tebakan == resource.data.kode
          && request.resource.data.terverifikasi == true
        );
    }
    match /mail/{docId} {
      allow read: if isAdminLevel();
      allow create: if request.resource.data.to is list
        && request.resource.data.to.size() == 1
        && request.resource.data.message.subject is string
        && request.resource.data.message.subject.size() > 0;
      allow update, delete: if false;
    }
  }
}
```

**File siap-tempel juga tersedia terpisah**: `Code\firestore.rules` (file
lengkap sama persis dengan blok di atas) — Guru bisa langsung buka
Firebase Console → Firestore Database → Rules → select all → paste isi
file itu → Publish, tanpa perlu edit manual/cari-sisip baris.

---

## Poin PALING RELEVAN buat debugging Kiosk/Absensi

*(Bagian ini masih dari analisis 23 Agustus 2026, dipertahankan karena
tetap relevan — rules `absensi` tidak berubah di revisi ini.)*

**`match /absensi/{docId}` → `allow update`**:
```
allow update: if isAdminLevel()
  || request.auth.token.email == resource.data.email
  || (isKiosk() && resource.data.gudang in gudangKiosk());
```

Ini yang JADI AKAR MASALAH bug §19.9 ("sudah Clock Out lewat Kiosk,
discan ulang malah diminta Clock Out lagi"): update dokumen `absensi`
lewat Kiosk (`request.auth.token.email` = email AKUN KIOSK-nya sendiri,
BUKAN email karyawan yang di-scan — override `window.currentUser` di
client itu TIDAK mengubah identitas Firebase Auth yang sebenarnya) CUMA
diizinkan kalau **`resource.data.gudang` — gudang yang TERSIMPAN DI
DOKUMEN itu sendiri — ada di `gudang_penempatan` milik akun Kiosk-nya**.
Dokumen absensi LAMA (dibuat sebelum ada pembatasan gudang-irisan §19.6,
atau dibuat dari device/kiosk lain dengan gudang berbeda) bisa punya
`gudang` yang TIDAK cocok dengan Kiosk yang dipakai sekarang — update-nya
DITOLAK, TANPA peduli siapa nama karyawannya atau device Kiosk yang mana.

**Implikasi penting buat kode `vue-camera.js` (JALUR 2, Clock Out)**:
kalau query "tutup SEMUA dokumen `sedang_aktif:true`" (§19.7)
menyertakan dokumen lama yang gudangnya tidak cocok dengan Kiosk yang
sedang dipakai, `updateDoc()` ke dokumen itu SPESIFIK akan ditolak —
KODE WAJIB pakai `Promise.allSettled` (bukan `Promise.all`) supaya
dokumen LAIN yang memang boleh ditutup tetap berhasil, TIDAK ikut gagal
gara-gara satu dokumen yang ditolak Rules.

**Solusi buat dokumen zombie yang gudangnya SUDAH TIDAK COCOK dengan
Kiosk manapun**: WAJIB ditutup lewat jalur **BUKAN Kiosk** — orang yang
bersangkutan login pakai akun sendiri (`request.auth.token.email ==
resource.data.email` — klausa ini TIDAK ADA syarat gudang sama sekali)
dan Clock Out dari situ. Kiosk MANA PUN, SELAMANYA, tidak akan pernah
bisa menutup dokumen yang gudangnya sudah tidak cocok — ini batasan
Rules yang DISENGAJA (mencegah Kiosk gudang A menulis absensi atas nama
gudang B), bukan sesuatu yang bisa "diperbaiki" dari sisi kode Kiosk.
