# PETA DATABASE & STORAGE — Zevanic/Gechoo ERP

> Referensi struktur data — koleksi Firestore apa saja yang ada, field
> apa isinya, dan struktur folder Storage. Semua field di bawah ini
> **DICEK LANGSUNG ke kode** (bukan dari ingatan), tapi bisa saja ada
> field TAMBAHAN yang jarang ditulis dan lewat dari penelusuran ini —
> kalau ragu, selalu cek juga langsung ke Firestore Console.

---

## 🔥 Firestore — 33 koleksi

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
| `nama_shift` | string | Nama shift yang ditugaskan (dicocokkan ke `master_shift`). **PENTING (dikoreksi 24 Agt 2026, lihat STATUS-PROYEK.md §23.1)**: field ini di PROFIL karyawan SELALU ada & benar — yang SEBELUMNYA bermasalah adalah field senama di dokumen `absensi` (lihat di bawah), BUKAN field ini |
| `jenis_akun` | string | **BARU (22 Agt 2026)**, opsional — `'kiosk'` menandai akun HP Kiosk gudang. `role` akun ini TETAP `'operator'` (nilai baku, WAJIB — lihat §6.2), dicek Firestore Rules lewat `isKiosk()`/`gudangKiosk()` (baca field ini via `get()`, BUKAN custom claim) |
| `pin_hash` | string | **BARU (22 Agt 2026)**, opsional — hash SHA-256 PIN 6 digit (di-salt email pemilik), dipasang lewat Profile > Keamanan > PIN. Dipakai verifikasi identitas karyawan saat "Absensi Melalui QR" (scan barcode HP Kiosk). PIN mentah TIDAK PERNAH tersimpan |
| `menu_favorit` | array\<string\> | **BARU (27 Agt 2026, §27 — Redesain Home Mobile)**, opsional, maks. 4 `menuId` (dari `DAFTAR_MENU`, `js/vue-config-akses.js`) — dipilih user sendiri lewat mode "Atur" di Home mobile > Favorit Saya. Ditulis SENDIRI oleh pemilik akun (`updateDoc` langsung ke dok miliknya sendiri), TIDAK butuh perubahan Firestore Rules (rule `users/{email}` yang ada sudah izinkan self-update selama `role`/`status_approval`/`gudang_penempatan` tidak ikut berubah). Kartu Clock In/Out TIDAK ikut disimpan di sini — itu SELALU tampil default, terlepas dari isi field ini |

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
| `nama_shift` | string | **BARU (24 Agt 2026, FIX BUG — lihat STATUS-PROYEK.md §23.1)** — nama shift karyawan SAAT presensi ini dibuat, diambil dari `users/{email}.nama_shift` di titik Clock In/Clock Out/Izin/Cuti/Lembur. **SEBELUM tanggal ini, field ini TIDAK PERNAH ditulis SAMA SEKALI** (bug lama, root cause BUKAN soal format jam `master_shift` seperti dugaan awal Guru) — dipakai `js/vue-antrean-absensi.js` (`muatJamShift()`) buat hitung otomatis "Status Kehadiran" (bandingkan jam Clock In/Out ke `master_shift.jam_masuk`/`jam_keluar`), yang berarti perhitungan itu JUGA tidak pernah jalan sejak dibangun (19 Agt 2026) sampai fix ini. Dokumen LAMA (sebelum fix) bisa dimigrasikan lewat tombol "Cek Data Belum Punya Shift"/"Jalankan Migrasi" di Riwayat All Absensi — TAPI nilai hasil migrasi = shift KARYAWAN SAAT MIGRASI DIJALANKAN, bukan shift yang berlaku di TANGGAL kejadian absensi itu (data itu tidak pernah tercatat, tidak bisa direkonstruksi 100% akurat) |
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

### `pengaturan_sistem/urutan_menu_home` — BARU (27 Agt 2026, §27 — Redesain Home Mobile)
1 dokumen tunggal (ID `urutan_menu_home`, di dalam koleksi umum `pengaturan_sistem/{docId}` — koleksi ini disiapkan buat pengaturan sistem lain ke depan, bukan cuma urutan menu). Diatur Owner lewat panel BARU "Urutan Menu di Home Mobile" di dalam layar Config Akses (`js/vue-config-akses.js`) — bukan menu terpisah. Dipakai `daftarMenuGroups()` (`js/vue-components.js`) buat menentukan urutan tampil menu per kategori di grid akordeon Home mobile (5 menu teratas per kategori yang tampil sebelum "Lihat Semua").

| Field | Tipe | Keterangan |
|---|---|---|
| `perKategori` | object | `{ [kategori]: [menuId, menuId, ...] } }` — key = nama kategori persis seperti di `KATEGORI_URUTAN` (`vue-config-akses.js`, mis. `"Zevanic House"`), value = array `menuId` terurut sesuai pilihan Owner (naik/turun lewat panah di panel). `menuId` yang BELUM disebut di array (menu baru yang belum pernah diatur) otomatis ditaruh di BELAKANG, urut sesuai posisi asli di `DAFTAR_MENU` (self-healing, dilakukan oleh `muatUrutanMenu()`) |
| `diupdate_pada`, `diupdate_oleh` | Timestamp, string | Diisi tiap kali tombol "Simpan Urutan" ditekan |

Dokumen ini boleh TIDAK ADA SAMA SEKALI (belum pernah diatur Owner) — Home mobile jatuh-aman ke urutan asli `DAFTAR_MENU` per kategori (baca `js/vue-home.js`, `ambilUrutanKustom()` — try/catch, kembalikan `{}` kalau dokumen tidak ada/gagal dibaca).

⚠️ **Firestore Rules SUDAH disiapkan** (`allow read: if login(); allow write: if isOwnerOnly();` — read HARUS terbuka semua user login karena Home mobile tiap role butuh baca urutan ini, write cuma Owner sama seperti `akses_config`) di file `firestore.rules` yang sudah dikirim ke Guru, **TAPI BELUM ditempel/di-publish Guru** ke Firebase Console per 27 Agt 2026 — WAJIB dilakukan dulu, kalau belum semua baca ke koleksi ini akan `permission-denied` dan fitur "Urutan Menu" diam-diam tidak berpengaruh (Home tetap jalan, fallback ke urutan `DAFTAR_MENU` asli). Detail lengkap: `STATUS-PROYEK.md` §27.

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
Dokumen ID = nama kategori (`jenis_pekerjaan`, `status_kerja`, `jabatan`, `status_karyawan`, `kabupaten`, `alasan_izin`, `alasan_cuti`, `status_kehadiran`, `kecamatan`, + **BARU (23 Agt 2026)** `jenis_bahan`, `jenis_aksesoris`, + **BARU (25 Agt 2026)** `kode_rak`, `baris_rak`, `kolom_rak`). Tiap dokumen isinya `{ items: [...] }` atau `{ map: {...} }` khusus kecamatan (bertingkat per kabupaten). **Catatan (25 Agt 2026, §25)**: `kode_rak`/`baris_rak`/`kolom_rak` di sini BUKAN lagi dipakai langsung sebagai field di `master_bahan_aksesoris` — sekarang jadi "bahan baku" isian saat bikin record Rak baru di menu Rak Penyimpanan (lihat `master_rak_penyimpanan` di bawah).

### `config/{docId}` — dokumen config macam-macam
- `config/mail_templates` — subjek+isi email OTP (Mail Gateway > Template Pesan)
- `config/whatsapp_gateway` — `otp_aktif` (toggle, SEKARANG kendalikan OTP Email, bukan WA lagi), setting API WA
- `config/whatsapp_templates` — template pesan WA

⚠️ Koleksi ini di `firestore.rules` cuma boleh ditulis `isOwnerLevel()`
(owner/superuser) — **JANGAN numpang di sini** buat fitur baru yang perlu
ditulis admin/pic juga (contoh nyata: `pengaturan_id_bahan_aksesoris` di
bawah SENGAJA dibuat koleksi terpisah karena alasan ini).

### `mail/{autoId}` — "kotak pos" buat Extension Trigger Email
`to` (array, 1 email), `message: { subject, text }`, `dikirim_pada` (Timestamp). Field `delivery` DITAMBAHKAN OTOMATIS oleh Extension setelah dicoba kirim (`delivery.state`: SUCCESS/ERROR).

### `wa_log/{autoId}`
`waktu`, `target` (nomor HP), `jenis`, `pesan`, `sukses` (boolean), `keterangan`.

### `master_bahan_aksesoris/{autoId}` — BARU (23 Agt 2026, modul Konveksi/Zevanic House)
Data katalog bahan & aksesoris konveksi. Dikelola lewat `vue-bahan-aksesoris.js`.

| Field | Tipe | Keterangan |
|---|---|---|
| `id_tampil` | string | ID sequential yang DITAMPILKAN ke user (mis. `BHN-0001`) — **BEDA dari ID dokumen Firestore** (auto-generated). Dibuat lewat `runTransaction()` atomik ke `pengaturan_id_bahan_aksesoris` (lihat di bawah) — TIDAK PERNAH dobel walau 2 admin submit bersamaan |
| `kategori_utama` | string | `"Bahan"` / `"Aksesoris"` — field BARU, TIDAK ADA di 13 field asli permintaan Hilman, ditambahkan karena secara struktur wajib ada (menentukan prefix ID & kategori Jenis mana yang dipakai). TIDAK BOLEH diubah lewat Edit (kalau salah pilih, hapus & entry ulang) |
| `jenis` | string | Dari `master_data/jenis_bahan` atau `master_data/jenis_aksesoris` (tergantung `kategori_utama`) |
| `foto` | string (base64) / null | Opsional, dikompres kecil (500px, kualitas 0.65) — beda dari foto absensi/reimburse karena ini katalog (banyak baris) |
| `nama`, `warna` | string | — |
| `harga_pembelian` | number | Harga per 1 `satuan_pembelian`. **Sejak malam 24 Agt 2026**: begitu ada pembelanjaan lewat **Nota** Order Belanja di-final-kan, field ini OTOMATIS ditimpa mengikuti aturan "tanggal terbaru, termahal per Satuan Pemakaian" — lihat `riwayat_harga_pembelian` di bawah. **Sejak 24 Agt 2026 (lanjutan, fix §23.2)**: List Order Belanja TIDAK LAGI memicu update ini (harga di List sekarang read-only, cuma ikut nilai master apa adanya) — HANYA Nota yang trigger. Isi manual di sini dianggap SETARA baris riwayat pertama, cuma berlaku sampai ada pembelanjaan nyata (Nota) yang tercatat |
| `satuan_pembelian`, `satuan_pemakaian` | string | Teks bebas (mis. "Dus", "Pcs") — SENGAJA bukan dropdown, satuan konveksi terlalu beragam |
| `isi_konversi_pembelian` | number | Berapa `satuan_pemakaian` dalam 1 `satuan_pembelian`. Bisa diisi manual ATAU dari popup konversi berjenjang |
| `konversi_bertingkat` | array\<{dari, jumlah, ke, harga}\> | **Disimpan PERMANEN** (bukan cuma kalkulator sekali pakai) — hasil popup "Bantu Hitung Konversi Berjenjang" (mis. 1 Dus = 12 Pack, 1 Pack = 12 Pcs). Tiap baris punya field `harga` sendiri (harga pembelian NYATA di nota untuk baris itu, dalam satuan `dari`-nya). **GANTI (27 Agt 2026, §25.14, SUPERSEDE keputusan §21.11/§21.13)** — SEBELUMNYA Harga Modal item TETAP dihitung dari `harga` baris PALING ATAS (`baris[0]`) saja, baris lain cuma tercatat tapi tidak menentukan Harga Modal. Guru merevisi: SEKARANG Harga Modal (`harga_modal`, per Satuan Pemakaian) dihitung dari harga TERMAHAL di antara implikasi per-satuan-akhir SEMUA baris yang harganya diisi (`hitungHargaPerSatuanAkhir()`, disalin identik di `vue-bahan-aksesoris.js` DAN `vue-stock-pembelian.js` — bukan diimpor silang, konvensi file ini) — misal baris Dus 900rb & baris Pack 100rb, kalau implikasi per-satuan-akhir dari Pack ternyata LEBIH MAHAL daripada dari Dus, yang dipakai itu (konservatif, supaya modal tidak "ketinggalan"). `harga_pembelian` (field terpisah, "harga per `satuan_pembelian`/tingkat teratas") DITURUNKAN dari Harga Modal itu (dikali `isi_konversi_pembelian`), BUKAN lagi selalu sama persis dengan `baris[0].harga` yang diketik admin — bisa lebih tinggi kalau tingkat lain implikasinya lebih mahal. **BARU (§25.14) — tiap baris di sini JUGA ikut ter-update OTOMATIS** kalau ada Nota Order Belanja di-final-kan dengan `items[].satuan_bahan` yang cocok `dari` baris itu dan harganya beda (lihat `perbaruiHargaMasterDariRiwayat()` — bukan cuma `harga_pembelian` tunggal yang ter-update seperti sebelumnya, tapi baris `konversi_bertingkat` yang cocok satuannya JUGA ditimpa ke harga TERMAHAL tanggal terbaru untuk satuan itu) |
| `harga_modal` | number | **DIHITUNG OTOMATIS** (readonly di UI) = `harga_pembelian / isi_konversi_pembelian` |
| `margin_modal` | number | Manual, NOMINAL RUPIAH (bukan persen — asumsi, belum eksplisit dikonfirmasi) |
| `harga_pemakaian` | number | **DIHITUNG OTOMATIS** (readonly di UI) = `harga_modal + margin_modal` |
| `harga_diupdate_dari_riwayat_pada` | Timestamp | Opsional — diisi tiap kali `harga_pembelian`/`harga_modal`/`harga_pemakaian` ditimpa otomatis oleh `perbaruiHargaMasterDariRiwayat()` (`vue-stock-pembelian.js`, dipicu HANYA dari Nota — lihat §23.2). Kosong kalau item belum pernah dibeli lewat Nota sama sekali (harga masih murni input manual awal) |
| `stok_akhir` | number | **BARU (24 Agt 2026, fitur Kartu Stok — lihat STATUS-PROYEK.md §23.3)** — saldo stok berjalan, satuan = `satuan_pemakaian` item ini. **HANYA BOLEH diubah lewat `catatPergerakanKartuStok()`** (`vue-stock-pembelian.js`, `runTransaction()` atomik) — JANGAN PERNAH ditulis manual langsung ke field ini dari titik lain, akan membuat saldo menyimpang dari total ledger `kartu_stok_bahan_aksesoris` di bawah. Item lama (belum pernah ada pergerakan stok) tidak punya field ini — UI (List Bahan & Aksesoris, Kartu Stok Ringkasan) menampilkan `0` sebagai fallback |
| `rak_id`, `rak_label` | string | **BARU (25 Agt 2026, §25 — GANTI dari `kode_rak`/`baris_rak`/`kolom_rak` lepas di §24, SEHARI sebelumnya, yang belum sempat dipakai data nyata)**. `rak_id` = ref ke 1 dokumen `master_rak_penyimpanan` (menu baru "Rak Penyimpanan", di bawah), `rak_label` = denormalisasi tampilan (mis. `"A-1-3"`). Dipilih lewat 1 dropdown "Pilih Rak" (`DropdownCari`, strict-select dari Rak yang SUDAH terdaftar) — BUKAN 3 dropdown Kode/Baris/Kolom lepas lagi. Opsional |
| `tinggi_barang`, `panjang_barang`, `lebar_barang` | number | **BARU (25 Agt 2026, §24)** — dimensi (cm) 1 SATUAN `satuan_pemakaian` dari BARANG itu sendiri (BUKAN dimensi rak fisik — itu ada di `master_rak_penyimpanan.tinggi_rak` dkk, lihat di bawah), semua opsional, default `0` |
| `volume_barang` | number | **BARU (25 Agt 2026, §24)** — **DIHITUNG OTOMATIS** (readonly di UI) = `tinggi_barang * panjang_barang * lebar_barang`, satuan cm³. Ini "Volume Barang" (dimensi 1 satuan item) — BEDA dari "Volume Rak"/kapasitas (`master_rak_penyimpanan.volume_rak`). Ronde ini CUMA disimpan & ditampilkan (List Bahan & Aksesoris, kolom "Rak / Volume") — BELUM ada logic peringatan overstok (direncanakan menyusul di List/Nota Order Belanja) |
| `pakai_lot_tracking` | boolean | **BARU (25 Agt 2026, §25.2)** — flag opsional (opt-in per item, default `false`), checkbox di form Entry/Edit ("Perlu Qty per Roll/Lot saat diterima"). SEMATA-MATA dipakai buat aktifkan/nonaktifkan tombol popup "Qty per Roll/Lot" di kolom paling kiri tabel Daftar Pesanan Pembelian (`vue-stock-pembelian.js`) — TIDAK ADA logic FIFO/pengurangan stok per-lot yang memakainya di ronde ini (lihat `pesanan_pembelian.items[].detail_lot` di bawah & STATUS-PROYEK.md §25.2) |
| `lot_counter` | number | **BARU (Tahap 2)** — counter naik terus (TIDAK PERNAH turun/reset walau lot habis/dihapus), dipakai generate `kode_lot` unik tiap roll baru item ini (lihat `lot_bahan_aksesoris.kode_lot` di bawah). Di-increment ATOMIK di `catatPergerakanKartuStok()`, DALAM transaksi yang SAMA dengan update `stok_akhir` — JANGAN diubah manual. Item yang belum pernah punya roll lot-nya tidak punya field ini (fallback `0`) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |
| `diedit_pada`, `diedit_oleh` | Timestamp, string | Cuma ada kalau sudah pernah diedit |

**BARU (28 Agt 2026, §35) — jalur tulis KEDUA ke koleksi ini: Import/Upload
Massal Excel.** List Bahan & Aksesoris (`vue-bahan-aksesoris.js`) sekarang
punya tombol "Import / Template Excel" — Template Excel HANYA berisi 9
field WAJIB (`kategori_utama`, `jenis`, `nama`, `warna`,
`harga_pembelian`, `satuan_pembelian`, `isi_konversi_pembelian`,
`satuan_pemakaian`, `margin_modal`); field lain di tabel di atas (`foto`,
`rak_id`/`rak_label`, dimensi barang, `pakai_lot_tracking`) TIDAK ada di
Template — dokumen baru hasil import punya field-field itu kosong/
default, HARUS diisi manual lewat Edit kalau diperlukan. ID (`id_tampil`)
tetap digenerate lewat `generateIdBerurutan()`/`pengaturan_id_bahan_aksesoris`
yang SAMA dengan jalur form manual (dipanggil berurutan per baris, bukan
paralel). **Baris yang kombinasi `kategori_utama`+`nama`+`warna`-nya SUDAH
ADA di database DILEWATI (skip), TIDAK ditimpa** — beda dari pola Import
Master Produk (§28.9) yang defaultnya "Ganti Total"/upsert; ini pilihan
eksplisit Guru khusus fitur ini. Detail lengkap: STATUS-PROYEK.md §35.

### `pengaturan_id_bahan_aksesoris/{bahan\|aksesoris}` — BARU (23 Agt 2026)
2 dokumen tetap (`bahan` dan `aksesoris`), dipakai `runTransaction()` buat generate `id_tampil` sequential di atas.

| Field | Tipe | Keterangan |
|---|---|---|
| `prefix` | string | Diatur lewat panel Pengaturan di menu Entry (mis. `BHN`, `AKS`) |
| `counter` | number | Naik otomatis tiap 1 data baru tersimpan — JANGAN pernah diubah manual (bisa bikin ID dobel) |

### `master_satuan/{autoId}`, `master_ukuran/{autoId}`, `master_warna/{autoId}` — BARU (23 Agt 2026, ronde 2)
3 koleksi kembar, dikelola lewat komponen generik `MasterDataTabelManager`
(`vue-components.js`) dipanggil dari panel Pengaturan di menu Bahan/
Aksesoris. Skema sama persis buat ketiganya — cuma 2 kolom "sementara"
(bisa ditambah field lain nanti kalau perlu):

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Nama Satuan/Ukuran/Warna, WAJIB unik (dicek di client sebelum simpan) |
| `keterangan` | string | Opsional, bebas |
| `dibuat_pada` | Timestamp | — |

`master_satuan` dipakai jadi opsi dropdown "Satuan Pembelian" & "Satuan
Pemakaian" (list yang SAMA dipakai buat keduanya, **+ BARU §28 "Satuan"
di BOM Aksesoris Master Produk**). `master_warna` dipakai jadi opsi
dropdown "Warna" (sebelumnya teks bebas, sekarang WAJIB pilih dari
daftar) — **+ BARU §28: JUGA dipakai field Warna/Warna Bahan di Master
Produk** (produk, baris BOM Pola/Vendor, baris BOM Aksesoris). `master_ukuran`
**BELUM DIPAKAI di field manapun** di form Bahan/Aksesoris (tidak ada
field "Ukuran" di 13 field asli) — disiapkan duluan buat dipakai menu
lain nanti (Field "Size" di Master Produk TIDAK pakai koleksi ini,
tetap teks bebas — lihat catatan di `master_produk` di bawah).

⚠️ **Firestore Rules BELUM otomatis kepasang** untuk `master_bahan_aksesoris`,
`pengaturan_id_bahan_aksesoris`, `master_satuan`, `master_ukuran`, dan
`master_warna` — lihat catatan di `STATUS-PROYEK.md` §20 (§20.4 & §20.6)
dan file `firestore-rules-tambahan-zevanic-house.txt`, WAJIB ditempel
manual di Firebase Console dulu sebelum fitur ini bisa dipakai (kalau
belum, semua baca/tulis akan `permission-denied`).

### `master_jenis_produk/{autoId}` — BARU (28 Agt 2026, §31)
Koleksi KEMBAR `master_satuan`/`master_ukuran`/`master_warna` di atas —
skema & komponen SAMA PERSIS (`MasterDataTabelManager`), permintaan Guru
eksplisit "buat seperti Data Ukuran". Dikelola lewat tab **Zevanic
House > Config > Jenis Produk** (`js/vue-config.js`, `AppConfigJenisProduk`).

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Nama Jenis Produk (mis. "Kaos", "Celana", "Tas"), WAJIB unik (dicek di client sebelum simpan) |
| `keterangan` | string | Opsional, bebas |
| `dibuat_pada` | Timestamp | — |

Dipakai jadi opsi dropdown **"Jenis Produk"** (WAJIB pilih dari daftar,
`DropdownCari` strict-select — sama pola Warna) di `master_produk.jenis_produk`
(Data Produk Utama, Master Produk > Entry Produk) — lihat field itu di
bawah, dan kolom "Jenis Produk" di Template/Import Excel Produk Utama.

⚠️ **Firestore Rules BELUM ditempel Guru** — koleksi BARU, PERLU 1 match
block baru (pola SAMA `master_ukuran` dkk: `allow read: if login();
allow write: if isAdminLevel();`), dikirim terpisah sebagai
`firestore-rules-tambahan-jenis-produk.txt`. WAJIB ditempel & di-Publish
dulu di Firebase Console sebelum tab Config > Jenis Produk atau field
Jenis Produk di Entry Produk bisa dipakai (kalau belum,
`permission-denied` — BUKAN bug kode, lihat STATUS-PROYEK.md §31).

### `master_komponen/{autoId}` — BARU (28 Agt 2026, §33)
Koleksi KEMBAR `master_ukuran`/`master_jenis_produk` di atas — skema &
komponen SAMA PERSIS (`MasterDataTabelManager`), permintaan Guru
eksplisit "tambah tab data komponen mirip seperti data warna". Dikelola
lewat tab **Zevanic House > Config > Data Komponen** (`js/vue-config.js`,
`AppConfigKomponen`).

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Nama Komponen, WAJIB unik (dicek di client sebelum simpan) |
| `keterangan` | string | Opsional, bebas |
| `dibuat_pada` | Timestamp | — |

**GANTI (28 Agt 2026, §34)**: SEKARANG SUDAH dipakai — jadi sumber
dropdown "Kelola Komponen" (BOM Pola, Master Produk > Entry Produk),
GANTI dari Data Bahan & Aksesoris. **SUPERSEDE (§36)**: sejak §36, Excel
Import BOM sheet Komponen JUGA ikut sumber dari sini — format
`nama_komponen` SEKARANG KONSISTEN di semua jalur (catatan "2 sumber
beda" versi lama sudah tidak berlaku). Lihat field `master_produk.
bom_pola[].komponen[].nama_komponen` di bawah untuk detail.

**BARU (28 Agt 2026, §37) — jalur tulis KEDUA ke koleksi ini: Import/
Upload Massal Excel.** Tab Data Komponen (Config) sekarang punya tombol
"Import / Template Excel" (di sebelah searchbox) — Template Excel 2
kolom: `Nama` (wajib) + `Keterangan` (opsional), persis field yang ada.
Baris yang `nama`-nya SUDAH ADA (case-insensitive) atau dobel di dalam
file yang sama DILEWATI (skip), TIDAK ditimpa — konsisten dengan
`tambah()` manual yang dari awal sudah menolak nama dobel. Fitur ini
ditulis GENERIK di `MasterDataTabelManager` (`vue-components.js`, prop
opt-in `izinkanImportExcel`) — dipakai bareng 7 koleksi Nama+Keterangan
lain (`master_satuan`/`master_ukuran`/`master_warna`/dst), TAPI cuma
DINYALAKAN untuk `master_komponen` saat ini. Detail: STATUS-PROYEK.md
§37.

⚠️ **Firestore Rules BELUM ditempel Guru** — koleksi BARU, PERLU 1 match
block baru (pola SAMA persis di atas), dikirim terpisah sebagai
`firestore-rules-tambahan-data-komponen.txt`. WAJIB ditempel &
di-Publish dulu di Firebase Console sebelum tab Config > Data Komponen
bisa dipakai (kalau belum, `permission-denied` — BUKAN bug kode, lihat
STATUS-PROYEK.md §33).

### `master_tahap_persiapan/{autoId}` — BARU (28 Agt 2026, §43)
Koleksi KEMBAR `master_ukuran`/`master_jenis_produk`/`master_komponen` di
atas — skema & komponen SAMA PERSIS (`MasterDataTabelManager`), dulu
bernama "Tahap Proses" di permintaan Guru, di-rename jadi **"Persiapan
Untuk Tahap"**. Dikelola lewat tab **Zevanic House > Config > Persiapan
Untuk Tahap** (`js/vue-config.js`, `AppConfigTahapPersiapan`).

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Nama Tahap, WAJIB unik (dicek di client sebelum simpan). **Guru WAJIB isi persis 3 entry: "Sewing", "Webbing", "Finishing"** (boleh beda kapitalisasi) — dicocokkan case-insensitive saat Approve di menu Persiapan Produksi (lihat `persiapan_komponen` di bawah), entry lain BOLEH ditambah tapi baris BOM Aksesoris yang tahapnya bukan 3 kata itu TIDAK IKUT ke kartu manapun |
| `keterangan` | string | Opsional, bebas |
| `dibuat_pada` | Timestamp | — |

Dipakai jadi opsi `DropdownCari` (SARAN, BUKAN strict-select — beda dari
`master_jenis_produk`/`master_warna`) field **"Tahap Proses"** di BOM
Aksesoris (`master_produk.bom_aksesoris[].tahap_proses`, SUDAH ADA
sebelumnya sebagai teks bebas, field Firestore-nya TIDAK berubah nama) —
lihat `js/vue-master-produk.js`.

✅ **Firestore Rules SUDAH DIGABUNG & DIKIRIM** (`firestore.rules` versi
lengkap, siap-timpa, dikirim ke `Data Yang DIsiapkan` 28 Agt 2026 malam —
juga masih ada versi tempel-manual `firestore-rules-tambahan-persiapan-
produksi.txt`, SEKALIGUS dengan `persiapan_produksi`/`persiapan_komponen`
di bawah, 1 file sama) — **BELUM dikonfirmasi di-Publish** oleh Guru di
Firebase Console, WAJIB dicek/dilakukan dulu.

### `persiapan_produksi/{spkId}` — BARU (28 Agt 2026, §43)
Menu **Zevanic House > Persiapan Produksi > Perlu Disiapkan** (tab 1,
`PersiapanQueueManager`, `js/vue-persiapan-produksi.js`). 1 dokumen per
SPK — **doc id SENGAJA DISAMAKAN dengan doc id `order_spk`-nya sendiri**
(pasangan 1:1, idempoten). Ditulis OTOMATIS oleh `js/vue-order-spk.js`
(`buatAntreanPersiapanProduksi()`) begitu 1 SPK BARU disimpan (BUKAN saat
SPK lama diedit).

| Field | Tipe | Keterangan |
|---|---|---|
| `spk_id` | string | = ID dokumen ini sendiri (redundan sengaja, buat referensi balik dari `persiapan_komponen`) |
| `no_spk`, `nama_produk`, `sku_produk`, `qty_order` | — | Snapshot dari `order_spk` SAAT SPK disimpan (TIDAK auto-sync kalau SPK diedit belakangan) |
| `status` | string | `'perlu_disiapkan'` (awal) → `'approved'` (setelah tombol Approve diklik & kartu `persiapan_komponen` digenerate — SEKALI JALAN, tidak bisa Approve ulang lewat UI) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |
| `disetujui_pada`, `disetujui_oleh` | Timestamp, string | Diisi saat Approve |

✅ **Firestore Rules SUDAH DIGABUNG & DIKIRIM** — lihat catatan
`master_tahap_persiapan` di atas, file yang sama. ⚠️ **Query tabel ini
(`usePaginasiFirestore`, where `status`+orderBy `no_spk`) BUTUH 1 index
Firestore gabungan BARU** (`status` ASC + `no_spk` ASC) — BELUM ada,
WAJIB dibuat manual di Firebase Console (panduan:
`firestore-index-tambahan-persiapan-produksi.txt`), TANPA ini tab "Perlu
Disiapkan" gagal muat data WALAUPUN rules sudah di-Publish.

### `persiapan_komponen/{no_spk}-BHN\|-SEW\|-WEB\|-FIN` — BARU (28 Agt 2026, §43)
Menu **Zevanic House > Persiapan Produksi > Persiapan Bahan / Acc
Sewing / Acc Webbing / Acc Finishing** (tab 2-5, 1 komponen reusable
`PersiapanKomponenListManager` prop `tipe`, `js/vue-persiapan-produksi.js`).
1 dokumen = 1 KOMPONEN (Bahan/Acc per tahap) per SPK — digenerate
SEKALIGUS saat Approve (tab 1), HANYA untuk komponen yang BENERAN ada
isinya di BOM produk yang terhubung (`sku_produk`) — kalau BOM Aksesoris
SPK itu cuma ada tahap "Sewing", CUMA dokumen `-SEW` yang dibuat.

| Field | Tipe | Keterangan |
|---|---|---|
| `spk_id`, `no_spk`, `nama_produk`, `sku_produk`, `qty_order` | — | Snapshot dari `persiapan_produksi` saat Approve |
| `tipe` | string | `'bahan'` / `'sewing'` / `'webbing'` / `'finishing'` — dipakai filter tiap tab (`where('tipe','==',...)`) |
| `status` | string | `'proses'` (awal) → `'selesai'` OTOMATIS begitu SEMUA `baris[].selesai` jadi `true` |
| `baris` | array\<object\> | 1 baris = 1 item Bahan/Acc dari BOM. `{nama, warna, qty_dibutuhkan, satuan, qty_disiapkan, selesai, bahan_aksesoris_id, [webbing2, webbing3 — khusus tipe Acc]}`. `qty_dibutuhkan` = qty per pcs di BOM (`bom_pola[].panjang` untuk Bahan, `bom_aksesoris[].qty` untuk Acc) DIKALI `qty_order` SPK ("BOM explosion", logic dasarnya sama `master_produk.kelipatan`). `qty_disiapkan`/`selesai` **DIUPDATE OTOMATIS lewat scan** di menu Scan Persiapan (`js/vue-scan-persiapan.js`, `tandaiPersiapanDariScan()`) — BUKAN tombol manual di kartu Persiapan Produksi. `qty_disiapkan` bertambah tiap scan, `selesai:true` begitu `qty_disiapkan >= qty_dibutuhkan` |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |

⚠️ **Keputusan sepihak (belum eksplisit ditanya ke Guru, lihat
STATUS-PROYEK.md §43 untuk daftar lengkap)**: pencocokan `tipe` acc
murni cocok teks `bom_aksesoris[].tahap_proses` (case-insensitive)
terhadap persis "sewing"/"webbing"/"finishing"; formula `qty_dibutuhkan`
belum eksplisit dikonfirmasi (bisa saja ada faktor susut/waste % yang
belum masuk hitungan); Approve sekali jalan per SPK (progres checklist
TIDAK PERNAH ke-reset Approve ulang, tapi juga TIDAK ikut update kalau
BOM produk berubah setelah Approve).

✅ **Firestore Rules SUDAH DIGABUNG & DIKIRIM** — lihat catatan
`master_tahap_persiapan` di atas, file yang sama
(`firestore-rules-tambahan-persiapan-produksi.txt`). ⚠️ **Query tabel ini
BUTUH 1 index Firestore gabungan BARU** (`tipe` ASC + `no_spk` ASC, 1
index menutup SEMUA 4 tab sekaligus) — BELUM ada, WAJIB dibuat manual di
Firebase Console (panduan sama: `firestore-index-tambahan-persiapan-
produksi.txt`), TANPA ini SEMUA 4 tab Bahan/Sewing/Webbing/Finishing
gagal muat data WALAUPUN rules sudah di-Publish.

### `master_rak_penyimpanan/{autoId}` — BARU (25 Agt 2026, §25)
Menu **Zevanic House > Data Bahan & Aksesoris > Rak Penyimpanan**
(`RakPenyimpananManager`, `js/vue-rak-penyimpanan.js`, file TERPISAH) — 1
dokumen = 1 rak fisik NYATA yang sudah didaftarkan (input manual/
intensional, BUKAN generate semua kombinasi Kode×Baris×Kolom — ini
sengaja menghindari masalah kombinatorial yang jadi alasan pendekatan
§24, sehari sebelumnya, ditolak).

| Field | Tipe | Keterangan |
|---|---|---|
| `kode_rak`, `baris_rak`, `kolom_rak` | string | Identitas rak, tiap-tiap dipilih dari `master_data/kode_rak`/`baris_rak`/`kolom_rak` (3 kategori master data, dikelola lewat panel Pengaturan di menu Entry Bahan & Aksesoris — TETAP dipertahankan dari §24). Kombinasi ke-3 field ini WAJIB unik (dicek query sebelum simpan) |
| `rak_label` | string | Denormalisasi tampilan, format `"{kode_rak}-{baris_rak}-{kolom_rak}"` (mis. `"A-1-3"`) — INI yang jadi opsi dropdown "Pilih Rak" di `master_bahan_aksesoris.rak_label` |
| `tinggi_rak`, `panjang_rak`, `lebar_rak` | number | Dimensi FISIK rak itu sendiri (cm) — WAJIB diisi (beda dari `tinggi_barang` dkk di `master_bahan_aksesoris` yang opsional) |
| `volume_rak` | number | **DIHITUNG OTOMATIS** (readonly di UI) = `tinggi_rak * panjang_rak * lebar_rak`, cm³ — "estimasi kapasitas rak" yang diminta Guru. BELUM ada logic overstok yang memakai angka ini (direncanakan menyusul, bandingkan dengan total `volume_barang × qty` yang ditaruh di rak itu) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |
| `diedit_pada`, `diedit_oleh` | Timestamp, string | Cuma ada kalau sudah pernah diedit |

Menu ini punya tabel sendiri (paginasi cursor-based) yang menampilkan
semua Rak terdaftar — beda dari cara `vue-bahan-aksesoris.js` membaca
koleksi ini (fetch SEMUA tanpa paginasi, khusus buat jadi opsi dropdown,
pola sama seperti `master_satuan`/`master_warna`).

⚠️ **Firestore Rules BELUM ditempel Guru** — block baru
(`allow read: if login(); allow write: if isAdminLevel();`) sudah ada di
`firestore.rules` yang dikirim, WAJIB dipublish manual di Firebase
Console dulu.

### `persiapan_masalah/{autoId}` — BARU (24 Agt 2026, "versi sederhana")
Catatan kebutuhan/kekurangan bahan-aksesoris. Dikelola lewat
`vue-persiapan-masalah.js`, jadi sumber tabel "Daftar Permintaan/Pesanan
Bahan & Aksesoris" di menu Stock & Pembelian.

| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id` | string | ID dokumen `master_bahan_aksesoris` — field Nama WAJIB pilih dari daftar ini (bukan teks bebas) |
| `kategori_utama`, `nama_bahan` | string | Denormalisasi dari item yang dipilih, buat tampilan cepat tanpa join |
| `qty` | number | — |
| `satuan` | string | Auto-isi dari `satuan_pemakaian` item, bisa diedit manual |
| `keterangan` | string | Opsional |
| `status` | string | `"menunggu"` (baru dicatat) / `"sudah_dipesan"` (OTOMATIS diubah oleh `vue-stock-pembelian.js` begitu item ini dipakai lewat tombol (+) di Nota Order Belanja) |
| `diminta_oleh` | string | Email (`window.currentUser?.email`) |
| `dibuat_pada` | Timestamp | — |

**BARU (25 Agt 2026, §25.3) — dipakai ULANG apa adanya (TIDAK ADA field/skema baru) buat kasus "kekurangan stok roll/lot saat Catat Pemakaian"**: kalau `vue-kartu-stok.js` (baca `ambilLotAktif()`, `vue-stock-pembelian.js`) mendeteksi total `lot_bahan_aksesoris` aktif < qty yang diminta, ditampilkan popup 3 opsi keputusan — opsi "Proses sebagian, order sisanya" & "Tunggu dulu" SAMA-SAMA menulis 1 entri BIASA ke sini (`qty` = kekurangan, `keterangan` otomatis berisi konteks "Kekurangan stok roll/lot saat Catat Pemakaian tanggal ..."), langsung ikut alur "perlu dibeli" yang sudah ada (muncul di List/Nota Order Belanja seperti permintaan biasa). Cara membedakan entri ini dari permintaan manual biasa: lihat isi `keterangan`-nya (diawali "Kekurangan stok roll/lot...") — TIDAK ada field `jenis` terpisah, sengaja dibuat sesederhana mungkin. **GANTI (Tahap 2)**: fungsi yang benar-benar memotong stok di 2 dari 3 opsi tadi SEKARANG `catatPemakaianDariAlokasi()` (dulu `catatPemakaianDenganFifo()`) — alurnya sendiri (kapan popup ini muncul) TIDAK berubah.

### `master_suplayer/{autoId}` — BARU (24 Agt 2026)
Dikelola lewat `MasterDataTabelManager` yang sama seperti Satuan/Ukuran/
Warna (§ di atas), TAPI diperluas 1 kolom (props `field3Key`/`field3Label`
BARU di komponennya, opsional & backward-compatible — Satuan/Ukuran/Warna
TIDAK terpengaruh).

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Nama Suplayer, WAJIB unik |
| `kontak` | string | Kolom ke-3 BARU (Kontak/Alamat), opsional |
| `keterangan` | string | Opsional |
| `dibuat_pada` | Timestamp | — |

### `alias_pembelian/{autoId}` — BARU (24 Agt 2026)
Pemetaan nama barang di nota Suplayer (bisa beda-beda tiap Suplayer) ke 1
item internal di `master_bahan_aksesoris`. Dikelola lewat
`AliasPembelianManager` (`vue-stock-pembelian.js`).

| Field | Tipe | Keterangan |
|---|---|---|
| `suplayer_id`, `suplayer_nama` | string | Ref + denormalisasi dari `master_suplayer` |
| `bahan_aksesoris_id`, `bahan_aksesoris_nama` | string | Ref + denormalisasi dari `master_bahan_aksesoris` |
| `nama_di_nota` | string | Nama persis seperti tertulis di nota Suplayer ini |
| `dibuat_pada` | Timestamp | — |

### `pesanan_pembelian/{autoId}` — BARU (24 Agt 2026), diperbarui lagi 24 Agt malam (harga Nota per-baris) dan 24 Agt lanjutan (Harga List jadi read-only)
1 dokumen = 1 "No. Pembelian" (mis. `NP001`). Dikelola lewat
`OrderBelanjaScreen` (`vue-stock-pembelian.js`, dipakai BARENG oleh menu
List Order Belanja `modeNota=false` & Nota Order Belanja `modeNota=true`).
Item disimpan sebagai ARRAY DI DALAM dokumen (bukan sub-koleksi) — lihat
`STATUS-PROYEK.md` §21.2 untuk alasannya.

| Field | Tipe | Keterangan |
|---|---|---|
| `no_pembelian` | string | Sequential, mis. `NP001` — dari `pengaturan_id_pembelian` (di bawah), pola SAMA seperti ID Bahan/Aksesoris |
| `tanggal` | string (YYYY-MM-DD) | — |
| `items` | array\<object\> | Tiap item: `{ suplayer_id, suplayer_nama, bahan_aksesoris_id, sku, nama, nama_alias, qty, satuan_bahan, qty_s, satuan, isi_konversi, harga, jumlah, keterangan, pakai_lot_tracking, detail_lot }`. (lihat STATUS-PROYEK.md untuk riwayat lengkap perubahan tiap sub-field) |
| `estimasi_biaya_belanja` | number | Jumlah semua `items[].jumlah` |
| `status` | string | `"draft"` (tombol Pending) / `"final"` (tombol Simpan, order dianggap resmi/jadi) |
| `sumber_permintaan_ids` | array\<string\> | ID dokumen `persiapan_masalah` yang ditarik masuk lewat Nota Order Belanja (link balik, informasional) |
| `dibuat_oleh` | string | Email |
| `dibuat_pada`, `diupdate_pada` | Timestamp | — |

### `riwayat_harga_pembelian/{autoId}` — BARU (malam 24 Agt 2026), sumbernya dipersempit ke Nota SAJA (24 Agt lanjutan, §23.2)
Menu **Zevanic House > Stock & Pembelian > Riwayat Harga Pembelian**
(`RiwayatHargaPembelianManager`, `vue-stock-pembelian.js`) — tabel
READ-ONLY, paginasi cursor-based (`usePaginasiFirestore`). 1 dokumen = 1
baris item yang BENAR-BENAR dibeli — dicatat OTOMATIS oleh
`catatRiwayatHargaDanUpdateMaster()` tiap kali 1 Pesanan Pembelian
di-final-kan **DAN `modeNota=true`** (§23.2).

| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id` | string | Ref ke `master_bahan_aksesoris` |
| `nama_bahan` | string | Denormalisasi |
| `tanggal` | string (YYYY-MM-DD) | Diambil dari `tanggal` Pesanan Pembelian-nya |
| `satuan` | string | Satuan pembelian NYATA baris ini |
| `harga` | number | Harga Aktual NYATA yang diinput admin untuk 1 `satuan` di atas |
| `isi_konversi` | number | Snapshot `isi_konversi_pembelian` item SAAT dibeli |
| `satuan_pemakaian` | string | Satuan pemakaian item |
| `harga_per_satuan_pemakaian` | number | **DIHITUNG** = `harga / isi_konversi` |
| `no_pembelian`, `suplayer_nama` | string | Denormalisasi |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |

### `kartu_stok_bahan_aksesoris/{autoId}` — BARU (24 Agt 2026, §23.3)
Menu **Zevanic House > Stock & Pembelian > Kartu Stok**
(`KartuStokManager`, `js/vue-kartu-stok.js`) — ledger pergerakan stok, 1
dokumen = 1 pergerakan (masuk ATAU keluar). Ditulis SATU-SATUNYA lewat
`catatPergerakanKartuStok()` (`export`ed dari `vue-stock-pembelian.js`).

| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id` | string | Ref ke `master_bahan_aksesoris` |
| `nama_bahan` | string | Denormalisasi |
| `tanggal` | string (YYYY-MM-DD) | — |
| `jenis` | string | `"masuk"` / `"keluar"` |
| `qty` | number | Dalam satuan `satuan_pemakaian` item |
| `satuan` | string | — |
| `sumber` | string | `"Nota Order Belanja"` / `"Pemakaian Manual"` / `"Pemakaian Manual (Pilih Roll/Lot)"` / `"Penyesuaian (Scan Opname)"` / `"Penyesuaian (Scan Opname per Roll)"` / `"Pemakaian (Scan Persiapan)"` (dari menu Scan Persiapan, terhubung No. SPK) |
| `no_pembelian` | string | Diisi kalau `sumber` = Nota |
| `keterangan` | string | Opsional, baris `sumber="Pemakaian (Scan Persiapan)"` selalu menambahkan "No SPK: {no_spk} — {nama_produk}" di depan |
| `rincian_lot` | array\<{lot_id, kode_lot, tanggal_masuk?, dipotong?, sisa_setelah}\> | Khusus baris ber-roll |
| `saldo_setelah` | number | Snapshot `stok_akhir` SETELAH pergerakan ini ditulis |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |

⚠️ **Firestore Rules BELUM ditempel Guru** — block baru
(`allow read: if login(); allow write: if isAdminLevel();`) WAJIB
dipublish manual di Firebase Console dulu.

### `lot_bahan_aksesoris/{autoId}` — BARU (25 Agt 2026, §25.3), field `kode_lot` ditambah Tahap 2
1 dokumen = 1 roll/lot/kones FISIK individual untuk item yang ditandai
`pakai_lot_tracking` di `master_bahan_aksesoris`.

| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id`, `nama_bahan` | string | Ref + denormalisasi |
| `kode_lot` | string | Kode unik & manusia-terbaca per roll, mis. `"BHN-0001-L003"` |
| `qty_awal` | number | Qty roll ini SAAT diterima, TIDAK PERNAH berubah |
| `qty_sisa` | number | Qty roll ini yang MASIH TERSISA |
| `satuan` | string | Snapshot `satuan_pemakaian` item SAAT lot ini dibuat |
| `tanggal_masuk` | string (YYYY-MM-DD) | — |
| `no_pembelian` | string | Ref ke `pesanan_pembelian.no_pembelian` sumbernya |
| `keterangan` | string | Dari `detail_lot[].keterangan` |
| `status` | string | `"aktif"` / `"habis"` |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |

⚠️ **Firestore Rules BELUM ditempel Guru** — block baru sudah ada di
`firestore.rules` yang dikirim, WAJIB dipublish manual di Firebase
Console dulu.

### `order_spk/{autoId}` — BARU (27 Agt 2026, §26.2)
Master data minimal SPK (Surat Perintah Kerja), langkah awal migrasi
bertahap dari spreadsheet yang sekarang jalan di perusahaan. Menu
Zevanic House > Order SPK (`vue-order-spk.js`), 1 halaman langsung
(bukan child tab), format entry+searchbox+table.

| Field | Tipe | Keterangan |
|---|---|---|
| `no_spk` | string | No. SPK — WAJIB UNIK, dicek dobel sebelum simpan |
| `sku_produk` | string | **BARU (28 Agt 2026)** — FK opsional ke `master_produk.sku` (dipilih lewat dropdown "Pilih Produk (SKU)"). Kalau terisi: `nama_produk` otomatis terisi dari produk itu, hint "Rekomendasi Kelipatan Order" muncul, DAN Approve di menu Persiapan Produksi (§43) bisa jalan (baca BOM produk ini) |
| `nama_produk` | string | Nama Produk/Keterangan |
| `qty_order` | number | **GANTI NAMA (28 Agt 2026, §42.3)** dari `qty_target` — harus > 0. Dokumen LAMA yang masih `qty_target` tetap kebaca lewat fallback `d.qty_order ?? d.qty_target` di `petakan` paginasi, otomatis pindah field baru begitu diedit+disimpan ulang |
| `tanggal` | string | Format `YYYY-MM-DD` |
| `status` | string | `"Aktif"` atau `"Selesai"` |
| `dibuat_pada`, `dibuat_oleh` | timestamp, string | — |
| `diedit_pada`, `diedit_oleh` | timestamp, string | Terisi kalau pernah diedit |

✅ **Firestore Rules SUDAH ditempel Guru**. **BARU (28 Agt 2026, §43)**:
begitu 1 SPK BARU disimpan (BUKAN diedit), OTOMATIS bikin 1 dokumen
`persiapan_produksi` (lihat di atas) — lihat `buatAntreanPersiapanProduksi()`
di `vue-order-spk.js`.

### `log_cetak_label/{autoId}` — BARU (27 Agt 2026, §26.3)
Log tiap kali tombol "Cetak" ditekan di menu Stock & Pembelian > Cetak
Label. 1 dokumen per AKSI cetak.

| Field | Tipe | Keterangan |
|---|---|---|
| `tanggal` | timestamp | `serverTimestamp()` saat tombol Cetak ditekan |
| `nama_barang` | string | Item yang dicetak (nama+warna) |
| `jumlah_label` | number | Berapa label tercetak di 1 aksi ini |
| `jenis` | string | `"roll"` / `"item"` |
| `dicetak_oleh` | string | Email akun yang menekan tombol Cetak |

### `pengaturan_id_pembelian/{pembelian}` — BARU (24 Agt 2026)
1 dokumen tetap (key `"pembelian"`), dipakai `runTransaction()` buat
generate `no_pembelian` sequential.

| Field | Tipe | Keterangan |
|---|---|---|
| `prefix` | string | Diatur lewat panel Pengaturan, mis. `NP` |
| `counter` | number | Naik otomatis — JANGAN diubah manual |

### `master_produk/{autoId}` — BARU (27 Agt 2026, §28)
Bill of Material (BOM) produk konveksi. Menu **Zevanic House > Master
Produk > Entry Produk / List Produk** (`vue-master-produk.js`).

| Field | Tipe | Keterangan |
|---|---|---|
| `sku` | string | Kode utama produk, FULL OTOMATIS (§32) dari kombinasi Nama+Warna+Size (`kunciProduk()`), read-only di form, dedup akhiran `-2`/`-3` otomatis |
| `nama`, `size` | string | Data Produk Utama. `size` teks bebas |
| `jenis_produk` | string | Via `DropdownCari` ke `master_jenis_produk` (WAJIB pilih dari daftar) |
| `warna` | string | Via `DropdownCari` ke `master_warna` (WAJIB pilih dari daftar) |
| `foto` | string (URL Storage) / `''` | Path `master_produk/{idProduk}/foto_{timestamp}.jpg` |
| `bom_jasa` | array\<{nama, harga}\> | — |
| `bom_pola` | array\<object\> | `{tipe, foto, nama_pola, bahan_aksesoris_id, nama_bahan, warna_bahan, panjang, isi_pola_pcs, jasa_cutting, jasa_serie, jenis_vendor, komponen}` |
| `bom_aksesoris` | array\<object\> | `{tahap_proses, bahan_aksesoris_id, nama_aksesoris, warna, qty, satuan, webbing2, webbing3}`. **`tahap_proses`** — **GANTI (28 Agt 2026, §43)**: SEKARANG dipilih lewat `DropdownCari` bersumber `master_tahap_persiapan` (opsi SARAN, bukan strict-select) — nilai teks bebas SAMA seperti sebelumnya, field Firestore tidak berubah nama. Dipakai filter kartu Persiapan Acc Sewing/Webbing/Finishing (menu Persiapan Produksi, §43) |
| `kelipatan` | number | **BARU (28 Agt 2026, §42.2)** — DIHITUNG OTOMATIS = KPK (LCM) dari semua `bom_pola[].isi_pola_pcs` > 0. Dipakai tampilkan "Rekomendasi Kelipatan Order" di Order SPK (field `qty_order`) — angka acuan kelipatan order minimal biar tidak boros pola. Cuma kehitung ulang & tersimpan pas produk DI-SIMPAN (produk lama perlu backfill — tombol "Hitung Ulang Kelipatan Semua Produk" di List Produk) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | — |
| `diedit_pada`, `diedit_oleh` | Timestamp, string | Cuma ada kalau sudah pernah diedit |

✅ Firestore Rules untuk koleksi ini SUDAH ditempel & di-Publish Guru
(dikonfirmasi 28 Agt 2026). Detail histori lengkap field ini (SKU lama,
Import Excel, dst): lihat STATUS-PROYEK.md §28-§42.

---

## 🗄️ Firebase Storage

| Path | Isinya |
|---|---|
| `pengumuman/{idPengumuman}/media_{timestamp}.{ext}` | Lampiran gambar/video Pengumuman (Config Info) — maks 1MB, divalidasi client + Storage Rules |
| `master_produk/{idProduk}/foto_{timestamp}.jpg` | Foto Data Produk Utama, Master Produk |
| `master_produk/{idProduk}/pola{index}_{timestamp}.jpg` | Foto (atau "Foto Proses" kalau `tipe==='vendor'`) tiap baris BOM Pola/Vendor, Master Produk |

*(Sebelum 27 Agt 2026 cuma 1 folder yang dipakai — foto selfie/KTP/
bahan-aksesoris TETAP base64 langsung di field Firestore.)*

---

## ⚠️ Hal penting yang perlu diingat soal skema ini

1. **`role` vs `profil_akses`** (di `users`) — JANGAN PERNAH disatukan lagi. `role` cuma boleh 5 nilai baku, `profil_akses` boleh bebas. Lihat `STATUS-PROYEK.md` §6.2 untuk kronologi kenapa ini dipisah.
2. **`waktu` vs `waktu_ts`** (di `absensi`) — dua-duanya ada buat sementara (masa transisi). `waktu` jangan dihapus dulu (masih dipakai tampilan lama), `waktu_ts` yang dipakai buat query hemat ke depan.
3. **`foto_selfie`/`foto_ktp`/`foto` (bahan-aksesoris) base64 langsung di Firestore** — ini POTENSI RISIKO ke depan (dekati batas 1MB/dokumen Firestore kalau foto besar). Belum dipindah ke Storage seperti lampiran Pengumuman. **`master_produk.foto`/`bom_pola[].foto` SUDAH pakai Storage sejak awal**, TIDAK punya risiko ini.
4. **`config` (owner/superuser only) vs koleksi baru admin-level** — koleksi `config` SENGAJA dikunci `isOwnerLevel()` di rules. Fitur baru yang perlu ditulis admin/pic WAJIB pakai koleksi terpisah dengan rule `isAdminLevel()` sendiri.
5. **`harga_pembelian` di `master_bahan_aksesoris` BUKAN LAGI murni field manual** — bisa ketimpa OTOMATIS begitu ada **Nota** Order Belanja di-final-kan.
6. **`absensi.nama_shift` BEDA dari `users.nama_shift`** — snapshot vs profil saat ini.
7. **`master_bahan_aksesoris.stok_akhir` & `kartu_stok_bahan_aksesoris`** — JANGAN PERNAH ditulis manual dari titik kode lain selain `catatPergerakanKartuStok()`.
8. **"Volume Barang" vs "Volume Rak"** — dua hal beda, jangan tertukar.
9. **`pesanan_pembelian.items[].detail_lot` vs `lot_bahan_aksesoris`** — snapshot arsip vs data lot hidup.
10. **`pengaturan_sistem/urutan_menu_home` boleh tidak ada / belum diisi** — jangan anggap wajib ada.
11. **`master_produk.sku` full otomatis** sejak §32 — identitas produk = kombinasi Nama+Warna+Size.
12. **`master_jenis_produk` koleksi TERPISAH dari `master_produk`.**
13. **`master_komponen` SUDAH dipakai sejak §34** — sumber dropdown "Kelola Komponen" BOM Pola.
14. **`master_produk.bom_pola[].komponen[].nama_komponen` formatnya KONSISTEN sejak §36** — teks polos dari `master_komponen` di SEMUA jalur (form manual maupun Excel Import).
15. **`master_tahap_persiapan`/`persiapan_produksi`/`persiapan_komponen` (BARU §43) — 3 koleksi BARU, saling terhubung**: `master_tahap_persiapan` (referensi Config) → dipilih di `master_produk.bom_aksesoris[].tahap_proses` → dipakai Approve (`persiapan_produksi` → `persiapan_komponen`) buat mengelompokkan baris BOM Aksesoris ke kartu Sewing/Webbing/Finishing yang benar. **Kalau Guru laporkan "kartu Persiapan Acc kosong padahal BOM-nya ada isinya"**, kemungkinan besar penyebabnya `tahap_proses` baris itu TIDAK cocok persis kata "Sewing"/"Webbing"/"Finishing" (typo/kosong/istilah lain) — BUKAN bug, cek dulu isi field itu di BOM Aksesoris produk terkait sebelum menyimpulkan ada yang salah di kode. `persiapan_produksi` doc id = doc id `order_spk`-nya sendiri (pasangan 1:1) — `persiapan_komponen` doc id = `{no_spk}-BHN/-SEW/-WEB/-FIN`.
16. **`persiapan_produksi`/`persiapan_komponen` (§43) BUTUH 2 INDEX FIRESTORE GABUNGAN** (`status`+`no_spk` & `tipe`+`no_spk`) — ini TERPISAH dari kebutuhan Rules. Rules sudah dipublish TIDAK CUKUP kalau index belum dibuat — gejalanya "Gagal memuat data" (bukan permission-denied) di SEMUA 5 tab Persiapan Produksi. Panduan: `firestore-index-tambahan-persiapan-produksi.txt`.
