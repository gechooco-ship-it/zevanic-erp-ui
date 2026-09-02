# SNAPSHOT firestore.rules — Zevanic/Gechoo ERP

> **PENTING**: `firestore.rules` TIDAK ADA di repo GitHub (`zevanic-erp-ui`)
> — dideploy langsung dari Firebase Console → Firestore Database → Rules
> (lihat `PETA-INFRASTRUKTUR.md`). Sesi Claude manapun TIDAK PUNYA akses
> baca langsung ke rules yang benar-benar aktif di production.
>
> File ini adalah **SNAPSHOT** — isinya dipaste LANGSUNG oleh Hilman ke
> chat pada **23 Agustus 2026**, dipakai buat mendiagnosis bug §19.9
> (Clock Out lewat Kiosk gagal diam-diam gara-gara dokumen zombie gudang
> tidak cocok — lihat `STATUS-PROYEK.md` §19.9 untuk kronologi lengkap).
>
> ⚠️ **BISA BASI** — rules production bisa saja sudah berubah sejak
> tanggal di atas (misal ada penyesuaian lain yang tidak tercatat di
> sini). Kalau lagi diagnosis bug yang melibatkan `permission-denied`
> dan snapshot ini sudah terasa "lama"/tidak cocok dengan gejala yang
> dilaporkan, **minta Hilman paste ulang isi rules terbaru dari Firebase
> Console** — JANGAN asumsikan snapshot ini masih 100% akurat selamanya.

---

## Isi lengkap (per 23 Agustus 2026)

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

---

## Poin PALING RELEVAN buat debugging Kiosk/Absensi

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
