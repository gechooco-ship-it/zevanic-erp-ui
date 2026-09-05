# PETA DATABASE & STORAGE — Zevanic/Gechoo ERP

> Referensi struktur data — koleksi Firestore apa saja yang ada, field
> apa isinya, dan struktur folder Storage. Semua field di bawah ini
> **DICEK LANGSUNG ke kode** (bukan dari ingatan), tapi bisa saja ada
> field TAMBAHAN yang jarang ditulis dan lewat dari penelusuran ini —
> kalau ragu, selalu cek juga langsung ke Firestore Console.

---

## 🔥 Firestore — 45 koleksi

> **UPDATE (30 Agt 2026)**: 13 koleksi awal (HR/Absensi/Keuangan, di
> bawah) + 23 koleksi dari modul Zevanic House/Persiapan Produksi V2
> (bagian "🏭 Zevanic House" & "🧵 Persiapan Produksi V2" di bawah, SEMUA
> DICEK LANGSUNG ke kode yang sedang dimuat — bukan dari file lama yang
> ditinggalkan) + 1 koleksi `pengaturan_sistem` (redesain mobile "Gechoo
> Mobile Organic", §27→§44 — sempat terlewat dari update sebelumnya,
> digabung balik dari `docs-local/PETA-MENU.md` & `PETA-DATABASE-live.md`,
> field-nya DICEK ULANG ke kode saat digabung, 30 Agt 2026) + **2 koleksi
> BARU fitur "Pesanan"** (`transaksi_kasir`, `pengaturan_id_transaksi_kasir`
> — bagian "🛒 Pesanan" di bawah, **BELUM DIPUBLISH rules-nya ke Firebase
> Console**, lihat `STATUS-PROYEK.md` §45).
>
> **UPDATE (31 Agt 2026)**: TIDAK ADA koleksi baru. Modul **Persiapan
> Produksi V2 > "Perlu Disiapkan"** dibangun ULANG TOTAL (ganti wireframe
> handoff dari Guru, "Ganti total" atas versi lama — lihat
> `STATUS-PROYEK.md`), menambah field BARU di `order_spk`
> (`qty_tergrouping`, `grouping_ids`) dan `spk_grouping` (`size`), plus
> `order_spk.status_grouping` yang SEKARANG TRI-STATE (dulu biner) supaya
> 1 SPK bisa dipecah ke lebih dari 1 `spk_grouping` (partial qty). Detail
> lengkap di bagian `order_spk` & `spk_grouping` masing-masing di bawah.
>
> **UPDATE LAGI (31 Agt 2026, lanjutan)**: modul **Persiapan Produksi >
> Bahan** (jalur `bahan`, sebelumnya generik lewat `JalurTahapManager`)
> dibangun ULANG TOTAL dari wireframe handoff ke-2 (`js/vue-persiapan-
> bahan.js`, BARU). Menambah **6 koleksi baru** (`bagging`, `tugas_kirim`,
> `master_tlc`, `cetak_ulang_log`, `pengaturan_id_bagging`,
> `pengaturan_id_tugas_kirim` — lihat bagian "🧵 Persiapan Produksi V2" di
> bawah) dan **1 field baru** `spk_track.bahan_rincian[]` (array rincian
> per-bahan×anak-SPK, HANYA diisi untuk `spk_track.jalur === 'bahan'`,
> dokumen jalur lain array-nya kosong). **Total koleksi jadi 45** (39 + 6
> baru). Sumber data dikoreksi dari spek wireframe: BUKAN koleksi
> `persiapan_komponen` (sudah ditinggalkan Guru 29 Agt 2026) dan BUKAN
> `master_produk.bom_aksesoris[]` (itu buat Acc Sewing/Webbing/Finishing)
> — yang benar `spk_grouping.breakdown[]` + `master_produk.bom_pola[]`
> (khusus baris `tipe==='internal'`) + `master_bahan_aksesoris`. **KODE
> SUDAH DITULIS & DIKIRIM, BELUM di-push Guru, BELUM DIUJI SAMA SEKALI**
> — detail keputusan lengkap: `STATUS-PROYEK.md` §5.11.
>
> **UPDATE LAGI (1 Sep 2026)**: TIDAK ADA koleksi baru. **2 field baru**
> di `spk_track.bahan_rincian[]` (khusus jalur `bahan`): `tlc_tujuan`
> (snapshot tujuan TLC saat Scan Kirim) dan `sampai_pada` (jam divisi
> penerima Scan Sampai — **BELUM ADA PENULISNYA**, layar itu di luar
> lingkup modul Bahan & belum dibangun di manapun, lihat catatan di
> field `bahan_rincian` di bawah). Tab "Selesai" (Bahan) yang tadinya
> placeholder sekarang dibangun penuh tapi akan tampil kosong sampai
> penulis `sampai_pada` itu ada. Detail: `STATUS-PROYEK.md` §5.11b.
>
> **UPDATE LAGI (1 Sep 2026, sesi lanjutan)**: TIDAK ADA koleksi baru
> (semua koleksi yang dipakai SUDAH ada, dibagikan dengan modul Bahan —
> lihat catatan di bagian koleksi bersama di bawah). Modul **Persiapan
> Produksi > Acc Sewing/Webbing/Finishing** (jalur `sewing`/`webbing`/
> `finishing`, sebelumnya generik lewat `JalurTahapManager`, sekarang
> dikerjakan SEKALIGUS dalam 1 sesi atas instruksi eksplisit Guru)
> dibangun ULANG TOTAL, pola SAMA seperti Bahan tapi kartu = **1
> `spk_track`** (BUKAN gabungan lintas dokumen seperti Bahan). Menambah
> **3 field baru** di `spk_track` (`sewing_rincian[]`, `webbing_rincian[]`,
> `finishing_rincian[]` — field TERPISAH per jalur, pola sama seperti
> `bahan_rincian[]`) dan **1 field baru** `master_bahan_aksesoris.
> panjang_roll` (basis hitung roll Acc Webbing). **KODE SUDAH DITULIS &
> DIKIRIM (1 file zip gabungan), BELUM di-push Guru, BELUM DIUJI SAMA
> SEKALI** — detail keputusan lengkap: `STATUS-PROYEK.md` §5.11d.
>
> **UPDATE LAGI (5 Sep 2026, §5.12)**: **1 koleksi BARU** `master_tlc`
> (koleksi ini sebetulnya SUDAH ditulis-baca sejak §5.11/§5.11d oleh
> modul Bahan/Acc — TAPI skema-nya SEMPAT salah terdokumentasi di file
> ini sebagai `{nama, keterangan}`; **DIKOREKSI sesi ini** jadi skema
> REAL `{kode, nama, tipe}`, dikonfirmasi identik dari 4 `SERAH-TERIMA.md`
> berbeda — implementasinya sendiri SUDAH benar sejak awal, cuma
> dokumentasi ini yang telat menyusul). **Field BARU** di `alias_pembelian`
> (`moq`, `moq_satuan`, `lead_time_hari`, `is_default_order`) dan
> `master_suplayer` (`kontak`, `bank`, `nama_rek`, `no_rek`, `no_wa`) —
> ke-2 koleksi ini SEKARANG dikelola lewat modul BARU "Master Suplayer"
> (`js/vue-master-suplayer.js`), BUKAN lagi lewat `MasterDataTabelManager`
> generic (`master_suplayer`) atau `AliasPembelianManager` (kode lama,
> sekarang dead code, lihat `PETA-MENU.md`). **Total koleksi TETAP 45**
> (koleksi `master_tlc` sudah dihitung sejak §5.11, cuma dokumentasinya
> yang dikoreksi di sini). **KODE DITULIS, BELUM DIKIRIM ke folder
> `Code`, BELUM di-push Guru, BELUM DIUJI SAMA SEKALI** — detail
> keputusan lengkap: `STATUS-PROYEK.md` §5.12.

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
| `menu_favorit` | array\<string\> | Maks. 4 `menuId` (dari `DAFTAR_MENU`, `vue-config-akses.js`) — dipilih user sendiri lewat layar **Atur Favorit** (`vue-atur-favorit.js`), ditampilkan sebagai kartu "Favorit Saya" di Home mobile (`vue-home.js`). Kartu Clock In/Out TIDAK ikut disimpan di sini — selalu tampil default terlepas isi field ini |
| `beranda_grup` | string \| null | **BARU (redesain mobile "Gechoo Mobile Organic", §44)** — nama 1 kategori (dari `KATEGORI_URUTAN`) yang ditampilkan sebagai grup menu di Home mobile (`grupTampil`, `vue-home.js`). Diisi = `beranda_grup_urutan[0]`, ditulis lewat layar Atur Favorit |
| `beranda_grup_urutan` | array\<string\> | **BARU (§44)** — urutan preferensi kategori pilihan user (diatur di Atur Favorit), dipakai turunkan `beranda_grup` |
| `beranda_batas_kartu` | number | **BARU (§44)** — jumlah kartu menu yang tampil per grup di Home mobile, 2-8, default 4 |

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

### `pengaturan_sistem/urutan_menu_home` — BARU (redesain mobile "Gechoo Mobile Organic", §27→§27.2)
1 dokumen tunggal di koleksi umum `pengaturan_sistem/{docId}` (disiapkan buat pengaturan sistem lain ke depan, bukan cuma urutan menu). Diatur Owner lewat panel "Urutan Menu di Home Mobile & Sidebar Desktop" di layar Config Akses (`vue-config-akses.js`). Dipakai `daftarMenuGroups()` (`vue-components.js`, Home mobile) DAN `window.terapkanUrutanMenuDesktop()` (`auth.js`, sidebar desktop) buat urutan tampil menu per kategori.

| Field | Tipe | Keterangan |
|---|---|---|
| `perKategori` | object | `{ [kategori]: [menuId, menuId, ...] } }` — key = nama kategori persis seperti `KATEGORI_URUTAN` (`vue-config-akses.js`). `menuId` yang belum disebut (menu baru yang belum pernah diatur) otomatis ditaruh di belakang, urut sesuai posisi asli `DAFTAR_MENU` |
| `urutanKategori` | array\<string\> | Urutan tampil KATEGORI itu sendiri (bukan cuma urutan menu di dalamnya) |
| `diupdate_pada`, `diupdate_oleh` | Timestamp, string | Diisi tiap kali tombol "Simpan Urutan" ditekan |

Dokumen ini boleh TIDAK ADA SAMA SEKALI (belum pernah diatur Owner) — Home mobile & sidebar desktop jatuh-aman ke urutan asli `DAFTAR_MENU`/`KATEGORI_URUTAN`. **CATATAN**: preferensi grup-tampil-di-Beranda per-user (`users/{email}.beranda_grup` dkk, lihat di atas) SENGAJA TIDAK memakai dokumen global ini — 2 mekanisme terpisah, jangan disatukan.

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

## 🏭 Zevanic House — koleksi

> Semua field di bawah DICEK LANGSUNG ke `addDoc`/`setDoc`/`updateDoc` di
> kode (`js/vue-bahan-aksesoris.js`, `js/vue-stock-pembelian.js`, `js/vue-
> rak-penyimpanan.js`, `js/vue-master-produk.js`, `js/vue-persiapan-
> masalah.js`, `js/vue-order-spk.js` [DITINGGALKAN, lihat "🛒 Pesanan" di
> bawah], `js/vue-config.js`, `js/vue-master-suplayer.js` [BARU, 5 Sep
> 2026]) — bukan dari ingatan. Lihat `PETA-MENU.md` bagian "🏭 Zevanic
> House" untuk menu → file-nya.

### `master_bahan_aksesoris/{autoId}` — item bahan & aksesoris (stok)
| Field | Tipe | Keterangan |
|---|---|---|
| `id_tampil` | string | ID manusia-terbaca (mis. `BHN-0001`/`AKS-0001`), prefix diatur di `pengaturan_id_bahan_aksesoris` — BEDA dari ID dokumen Firestore-nya sendiri (auto-generated) |
| `kategori_utama` | string | `bahan` / `aksesoris` |
| `jenis`, `nama`, `warna` | string | Dari Config > Jenis Bahan/Jenis Aksesoris (`master_data`) & Data Warna |
| `foto` | string (base64) atau `null` | — |
| `harga_pembelian`, `satuan_pembelian`, `isi_konversi_pembelian`, `satuan_pemakaian` | — | Harga & konversi 1 tingkat (dasar) |
| `konversi_bertingkat` | array\<{dari, jumlah, ke, harga}\> | Opsional — kalau diisi, konversi berjenjang (mis. 1 Dus = 12 Roll = ...), tiap tingkat punya harga sendiri yang ikut di-update otomatis oleh Nota Order Belanja |
| `harga_modal`, `margin_modal`, `harga_pemakaian` | number | Dihitung dari harga_pembelian + margin |
| `pakai_lot_tracking` | boolean | `true` = stok item ini dilacak PER ROLL/LOT (lihat `lot_bahan_aksesoris`), `false` = cuma 1 angka `stok_akhir` |
| `panjang_roll` | number | **BARU (1 Sep 2026, §5.11d)** — opsional, meter, panjang 1 roll/gulung item ini. Basis hitung kolom "roll" di Acc Webbing (`roll = ceil(butuh_meter / panjang_roll)`) — TIDAK dibatasi ke `jenis` tertentu (field generik, boleh diisi item apa pun yang butuh basis hitung roll). Item tanpa field ini (0/kosong) → kolom roll di Acc Webbing tampil null-safe (tidak dihitung/error) |
| `stok_akhir` | number | **JANGAN PERNAH ditulis langsung dari luar** — SATU-SATUNYA jalur resmi lewat `catatPergerakanKartuStok()`/`catatPemakaianDariAlokasi()`/`catatPenyesuaianOpname*()` (semua di `vue-stock-pembelian.js`), **DITAMBAH (31 Agt 2026)**: `konfirmasiEntry()` di `js/vue-persiapan-bahan.js` (dan padanannya di `vue-persiapan-sewing.js`/`vue-persiapan-webbing.js`/`vue-persiapan-finishing.js`, §5.11d) juga mengurangi `stok_akhir` lewat `runTransaction` (lihat catatan `spk_track.bahan_rincian[]`/`sewing_rincian[]`/dst di bawah) — supaya selalu konsisten dengan ledger `kartu_stok_bahan_aksesoris` |
| `lot_counter` | number | Counter pembuat `kode_lot` berikutnya (increment di transaksi yang sama dengan `stok_akhir`), cuma ada kalau `pakai_lot_tracking` |
| `rak_id`, `rak_label` | string | Opsional, link ke `master_rak_penyimpanan` |
| `tinggi_barang`, `panjang_barang`, `lebar_barang`, `volume_barang` | number | Opsional, dimensi satuan barang |
| `dibuat_pada`, `dibuat_oleh` | Timestamp / string | — |

### `kartu_stok_bahan_aksesoris/{autoId}` — ledger pergerakan stok (SEMUA jenis: masuk/keluar/penyesuaian)
Ditulis SATU-SATUNYA lewat fungsi di `vue-stock-pembelian.js` (`catatPergerakanKartuStok`, `catatPemakaianDariAlokasi`, `catatPenyesuaianOpnameItem`).

| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id`, `nama_bahan` | string | — |
| `tanggal` | string | `YYYY-MM-DD` |
| `jenis` | string | `masuk` / `keluar` |
| `qty`, `satuan` | — | Dalam satuan_pemakaian |
| `sumber` | string | Mis. `"Nota Order Belanja"`, `"Pemakaian (Scan Persiapan)"`, `"Penyesuaian (Scan Opname)"` |
| `no_pembelian` | string | Isi kalau `sumber` dari pembelian, kosong kalau bukan |
| `keterangan` | string | — |
| `saldo_setelah` | number | Snapshot `stok_akhir` SETELAH baris ini (buat tampilan riwayat tanpa hitung ulang) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp / string | — |

### `lot_bahan_aksesoris/{autoId}` — roll/lot individual (item `pakai_lot_tracking=true`)
| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id`, `nama_bahan` | string | — |
| `kode_lot` | string | `{id_tampil bahan}-L{counter 3 digit}`, mis. `BHN-0001-L003` — DICETAK di label fisik (QR), discan ulang saat pemakaian/opname |
| `qty_awal`, `qty_sisa`, `satuan` | — | `qty_sisa` yang berubah tiap pemakaian/opname, `qty_awal` beku |
| `tanggal_masuk`, `no_pembelian` | string | — |
| `keterangan` | string | — |
| `status` | string | `aktif` / `habis` (`habis` otomatis kalau `qty_sisa` disesuaikan opname jadi ≤0) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp / string | — |

### `master_rak_penyimpanan/{autoId}`
| Field | Tipe | Keterangan |
|---|---|---|
| `kode_rak`, `baris_rak`, `kolom_rak` | string | Kombinasi 3 ini WAJIB unik (dicek `cekKombinasiDobel()`) |
| `rak_label` | string | Gabungan tampilan dari kode+baris+kolom |
| `tinggi_rak`, `panjang_rak`, `lebar_rak`, `volume_rak` | number | — |
| `dibuat_pada`/`dibuat_oleh`, `diedit_pada`/`diedit_oleh` | Timestamp / string | — |

### `master_satuan/{autoId}`, `master_warna/{autoId}`, `master_ukuran/{autoId}`, `master_jenis_produk/{autoId}`, `master_komponen/{autoId}`, `master_tahap_persiapan/{autoId}`
6 koleksi POLA SAMA — lewat komponen generic `MasterDataTabelManager` (`vue-components.js`), semua dari tab **Config**:

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Wajib, dicek dobel (case-insensitive) sebelum tambah |
| `keterangan` | string | Opsional |
| `dibuat_pada` | Timestamp | — |

Dipakai sebagai sumber `DropdownCari` di tempat lain: `master_jenis_produk` (Entry Produk, JUGA sumber tab kategori di Pesanan > Penjualan Kasir), `master_tahap_persiapan` (BOM Aksesoris di Entry Produk, DAN filter kartu Acc Sewing/Webbing/Finishing di Persiapan Produksi V2), `master_komponen` (BELUM disambungkan ke field manapun per 28 Agt 2026). `master_satuan`/`master_warna`/`master_ukuran` dipakai Data Bahan & Aksesoris / Stock & Pembelian.

> Kategori **Jenis Bahan** & **Jenis Aksesoris** (2 tab pertama di Config)
> BUKAN koleksi terpisah — keduanya kategori BARU di koleksi `master_data`
> yang SUDAH didokumentasikan di atas (`master_data/{kategori}`, kategori
> `jenis_bahan`/`jenis_aksesoris`), lewat komponen `MasterDataCategory`
> yang sama dengan Config Karyawan.
>
> **CATATAN (5 Sep 2026, §5.12)**: `master_suplayer` DIKELUARKAN dari
> daftar "7 koleksi pola sama" di atas (SEBELUMNYA 7, SEKARANG 6) — field
> aslinya (`nama`/`kontak`) TERNYATA sudah dilewati sama komponen BESPOKE
> `SuplayerEntryList` (`js/vue-master-suplayer.js`, ganti dari
> `MasterDataTabelManager`) supaya bisa nambah field kontak lengkap
> (bank/rekening/WA). Lihat entri `master_suplayer` tersendiri di bawah.

### `master_suplayer/{autoId}` — data suplayer (kontak & pembayaran)
> **UPDATE (5 Sep 2026, §5.12)**: DIKELUARKAN dari `MasterDataTabelManager`
> generic ke komponen BESPOKE `SuplayerEntryList` (`js/vue-master-
> suplayer.js`, sub-tab "Entry Suplayer" di menu BARU "Master Suplayer")
> — field `kontak` generic lama DIPECAH jadi beberapa field spesifik di
> bawah. Dokumen LAMA yang cuma punya `nama`/`kontak`/`keterangan` tetap
> terbaca (field baru kosong/undefined, ditampilkan null-safe), belum
> ada migrasi otomatis.

| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Wajib, dicek dobel (case-insensitive), sama seperti sebelumnya |
| `kontak` | string | **LAMA** — field generic bebas (alamat/kontak umum), TETAP ADA untuk kompatibilitas dokumen lama, BUKAN lagi field utama isi kontak |
| `bank`, `nama_rek`, `no_rek` | string | **BARU (5 Sep 2026)** — opsional, info rekening bank suplayer |
| `no_wa` | string | **BARU (5 Sep 2026)** — opsional, nomor WhatsApp suplayer |
| `dibuat_pada` | Timestamp | — |

### `master_produk/{autoId}` — Master Produk (BOM)
| Field | Tipe | Keterangan |
|---|---|---|
| `sku` | string | Unik (dicek dobel) |
| `nama`, `jenis_produk`, `warna`, `size` | string | `jenis_produk` dari `master_jenis_produk` |
| `foto` | string (URL Storage) | — |
| `harga_jual` | number | **BARU (30 Agt 2026, fitur "Pesanan")** — opsional, default 0. Sebelumnya `master_produk` 100% data BOM/ongkos produksi, TIDAK ADA field harga jual sama sekali. Dipakai isi harga di grid produk Pesanan > Penjualan Kasir; produk lama tanpa field ini tampil dengan harga 0/"Harga belum diisi" |
| `bom_jasa` | array\<{nama, harga}\> | — |
| `bom_pola` | array | Tiap baris: `tipe` (`'internal'`/`'vendor'`), `foto`, `nama_pola`, `bahan_aksesoris_id`+`nama_bahan`+`warna_bahan` (resolve dari `master_bahan_aksesoris`), `panjang`, `isi_pola_pcs`, `jasa_cutting`, `jasa_serie`, `jenis_vendor` (kalau `tipe==='vendor'`), `komponen` (array\<{nama_komponen, qty}\>, teks bebas dari `master_komponen`, TANPA FK ke stok). **Catatan (31 Agt 2026, §5.11)**: ini SUMBER kebutuhan kain untuk pos Bahan (`spk_track.bahan_rincian[]`, hanya baris `tipe==='internal'` yang dipakai — baris `'vendor'` di luar cakupan pos Bahan internal) |
| `bom_aksesoris` | array | Tiap baris: `tahap_proses` (teks bebas, cocok longgar ke `master_tahap_persiapan` Sewing/Webbing/Finishing — dicocokkan via `.trim().toLowerCase().includes('sewing'\|'webbing'\|'finishing')`, sama pola dengan `jalurOtomatisProduk()`), `bahan_aksesoris_id`+`nama_aksesoris`+`warna` (resolve dari `master_bahan_aksesoris`), `qty`, `satuan`, `webbing2`, `webbing3` (teks bebas). **BEDA dari `bom_pola` — JANGAN TERTUKAR**: ini dipakai pos Acc Sewing/Webbing/Finishing (trim/aksesoris) lewat `hitungSewingRincian()`/`hitungWebbingRincian()`/`hitungFinishingRincian()` (BARU 1 Sep 2026, §5.11d), BUKAN sumber kebutuhan kain pos Bahan |
| `kelipatan` | number | KPK semua `isi_pola_pcs` di `bom_pola` — dihitung ulang tiap simpan |
| `moq_serie` | number | **BARU (5 Sep 2026, §5.13)** — "MOQ Pesanan Produk", opsional (default 0), input MANUAL (bukan auto-hitung). JANGAN TERTUKAR dengan MOQ pembelian bahan/aksesoris di `alias_pembelian.moq` (§5.12, beda jalur — lihat catatan poin 10 di bawah). Data-layer saja: modul konsumennya ("Proses Produksi > Serie") belum dibangun |
| `kelipatan_isi_pola` | number | **BARU (5 Sep 2026, §5.13)** — opsional (default 0), input MANUAL. JANGAN TERTUKAR dengan field `kelipatan` di atas (itu auto-KPK dari `isi_pola_pcs`, konsep LAMA yang tetap dipakai apa adanya) — ini field BARU terpisah untuk modul Serie nanti |
| `dibuat_pada`/`dibuat_oleh`, `diedit_pada`/`diedit_oleh` | Timestamp / string | — |

### `persiapan_masalah/{autoId}` — permintaan bahan/aksesoris kosong
| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id`, `kategori_utama`, `nama_bahan` | — | Resolve dari `master_bahan_aksesoris` |
| `qty`, `satuan`, `keterangan` | — | — |
| `status` | string | `menunggu` → `sudah_dipesan` (diubah otomatis begitu masuk Nota/List Order Belanja) |
| `diminta_oleh`, `dibuat_pada` | string / Timestamp | — |

### `alias_pembelian/{autoId}` — mapping nama di nota suplayer ↔ item internal
> **UPDATE (5 Sep 2026, §5.12)**: SEKARANG dikelola lewat komponen
> `AliasMoqManager` (`js/vue-master-suplayer.js`, sub-tab "Alias & MOQ"
> di menu BARU "Master Suplayer") — GANTI dari `AliasPembelianManager`
> lama (`vue-stock-pembelian.js`, sekarang dead code, TIDAK dihapus dari
> disk). 4 field BARU ditambah — ini yang dimaksud Guru sebagai
> "kelipatan kunci" (interpretasi, lihat `STATUS-PROYEK.md` §5.12).

| Field | Tipe | Keterangan |
|---|---|---|
| `suplayer_id`, `suplayer_nama` | — | Dari `master_suplayer` |
| `bahan_aksesoris_id`, `bahan_aksesoris_nama` | — | `bahan_aksesoris_nama` cuma FALLBACK ARSIP (tampilan utama baca LIVE dari `master_bahan_aksesoris`) |
| `nama_di_nota` | string | Persis seperti tertulis di nota fisik suplayer — unik per suplayer |
| `moq` | number | **BARU (5 Sep 2026)** — opsional, Minimum Order Quantity dari suplayer ini untuk item ini |
| `moq_satuan` | string | **BARU (5 Sep 2026)** — opsional, satuan `moq` (boleh beda dari `satuan_pemakaian` item) |
| `lead_time_hari` | number | **BARU (5 Sep 2026)** — opsional, estimasi hari pengiriman suplayer ini untuk item ini |
| `is_default_order` | boolean | **BARU (5 Sep 2026)** — `true` kalau alias ini jadi suplayer DEFAULT untuk kelompok item ini. Dijaga SUPAYA cuma 1 `true` per kelompok item lewat `writeBatch` di `PetakanOrderManager` (`js/vue-master-suplayer.js`, sub-tab "Petakan Order") — bukan divalidasi di sisi rules |
| `dibuat_pada` | Timestamp | — |

### `pesanan_pembelian/{autoId}` — Order Belanja (List = estimasi, Nota = pembelian nyata)
1 koleksi dipakai KEDUA menu "List Order Belanja" (`modeNota=false`) & "Nota Order Belanja" (`modeNota=true`) — beda cuma di UI (List harga read-only dari Data Bahan, Nota harga aktual sesuai nota fisik) & efek samping saat `status:'final'` (cuma Nota yang tulis Riwayat Harga + Kartu Stok + Lot). **⚠️ Nama koleksi ini `pesanan_pembelian` (Order BELANJA/pembelian bahan) — JANGAN TERTUKAR** dengan koleksi BARU `transaksi_kasir` (Order PENJUALAN/Kasir ke pelanggan, lihat bagian "🛒 Pesanan" di bawah), 2 hal yang sama sekali berbeda walau sama-sama mulai kata "pesanan"/"Pesanan".

| Field | Tipe | Keterangan |
|---|---|---|
| `no_pembelian` | string | Prefix diatur `pengaturan_id_pembelian/pembelian` |
| `tanggal` | string | `YYYY-MM-DD` |
| `items` | array | Tiap baris: bahan+qty+harga+`jumlah` (qty×harga, dihitung ULANG saat simpan) + (kalau `pakai_lot_tracking`) `detail_lot` (array qty per roll) |
| `estimasi_biaya_belanja` | number | Total semua `items[].jumlah` |
| `status` | string | `draft` (tombol "Pending") / `final` (tombol "Simpan") |
| `sumber_permintaan_ids` | array\<string\> | ID dokumen `persiapan_masalah` yang ikut dimasukkan (kalau ada) |
| `dibuat_pada`/`dibuat_oleh`, `diupdate_pada` | Timestamp / string | — |

### `riwayat_harga_pembelian/{autoId}` — 1 baris per item yang BENAR-BENAR dibeli
Ditulis otomatis begitu Nota Order Belanja di-final-kan (`catatRiwayatHargaDanUpdateMaster()`), lalu ikut meng-update `harga_pembelian`/`konversi_bertingkat` di `master_bahan_aksesoris` (aturan: tanggal terbaru, termahal per satuan kalau ada beberapa harga di tanggal yang sama).

| Field | Tipe | Keterangan |
|---|---|---|
| `bahan_aksesoris_id`, `nama_bahan` | — | — |
| `tanggal`, `satuan`, `harga`, `isi_konversi` | — | Sesuai satuan pembelian NYATA di nota (bisa beda-beda tiap pembelian) |
| `satuan_pemakaian`, `harga_per_satuan_pemakaian` | — | Dinormalisasi supaya apple-to-apple lintas satuan beli |
| `no_pembelian`, `suplayer_nama` | string | — |
| `dibuat_pada`, `dibuat_oleh` | Timestamp / string | — |

### `log_cetak_label/{autoId}`
| Field | Tipe | Keterangan |
|---|---|---|
| `tanggal` | Timestamp | `serverTimestamp()` |
| `nama_barang`, `jumlah_label`, `jenis` | — | `jenis` bebas string (mis. asal cetak: dari List Bahan & Aksesoris atau dari Nota Order Belanja) |
| `dicetak_oleh` | string | — |

### `order_spk/{autoId}`
> **Catatan (30 Agt 2026)**: koleksi ini TIDAK BERUBAH skemanya sama
> sekali oleh fitur "Pesanan" — dokumen di sini SEKARANG ditulis dari
> **2 sumber**: (a) form manual di menu **Pesanan > Menunggu Proses**
> (dulu menu "Order SPK" berdiri sendiri, sekarang pindah lokasi —
> lihat `PETA-MENU.md`), dan (b) OTOMATIS oleh **Pesanan > Penjualan
> Kasir** (1 dokumen per item keranjang saat "Buat Order" ditekan,
> `no_spk = "{no_transaksi}-{urutan item}"`). Pipeline Persiapan
> Produksi V2 (`spk_grouping`/`spk_track`) membaca koleksi ini TANPA
> tahu/peduli asalnya dari mana.
>
> **UPDATE (31 Agt 2026 — rebuild "Perlu Disiapkan")**: 1 SPK SEKARANG
> BOLEH dipecah qty-nya ke LEBIH DARI 1 `spk_grouping` (partial
> grouping) — sebelumnya SPK yang sudah punya `id_spk_grouping`
> langsung hilang total dari antrean, sekarang yang dicek adalah SISA
> qty (`qty_order - qty_tergrouping`); SPK baru hilang dari antrean
> "Perlu Disiapkan" begitu sisa qty-nya 0. Kunci penggabungan klaster
> otomatis juga DIPERBAIKI: sebelumnya cuma `nama_produk + kunci_pola`
> (TIDAK ikut `size` — bug, ditemukan & diverifikasi langsung ke kode
> saat sesi ini), SEKARANG `nama_produk + size + kunci_pola` (fungsi
> `kunciGrupProduk()` di `vue-persiapan-produksi-v2.js`).

| Field | Tipe | Keterangan |
|---|---|---|
| `no_spk` | string | Unik (dicek dobel). Format dari Kasir: `TRX{yymmdd}{counter 3 digit}-{urutan item}` |
| `sku_produk` | string | Opsional — link ke `master_produk.sku`; kosong kalau migrasi lama dari spreadsheet (tidak bisa ikut auto-grouping Persiapan Produksi V2) |
| `nama_produk` | string | Teks gabungan "Nama Warna Size" (BUKAN nama dasar produk — lihat `master_produk.nama` buat itu) |
| `qty_order` | number | GANTI NAMA dari `qty_target` (dokumen lama masih bisa punya `qty_target`, otomatis pindah ke `qty_order` begitu diedit+disimpan ulang) |
| `tanggal`, `status` | — | `status`: `Aktif` dst. |
| `qty_tergrouping` | number | **BARU (31 Agt 2026)** — total qty SPK ini yang SUDAH masuk ke `spk_grouping` manapun (bisa lebih dari 1, akumulatif). Sisa yang masih bisa digrouping = `qty_order - qty_tergrouping`. Dokumen lama tanpa field ini dianggap `0` |
| `grouping_ids` | array\<string\> | **BARU (31 Agt 2026)** — daftar ID SEMUA `spk_grouping` yang pernah menyertakan SPK ini (via `arrayUnion`, bisa lebih dari 1 kalau qty-nya dipecah). Menggantikan asumsi lama "1 SPK cuma bisa ikut 1 grouping" |
| `id_spk_grouping`, `kode_spk_grouping` | string | **DIPERTAHANKAN (kompatibilitas)** — sekarang isinya grouping PALING BARU yang menyertakan SPK ini (bukan satu-satunya lagi), buat tampilan lama yang masih baca 2 field ini |
| `status_grouping` | string | **BERUBAH JADI TRI-STATE (31 Agt 2026)** — `''` (belum digrouping sama sekali) / `'sebagian'` (BARU, sisa qty masih >0 tapi sudah ada yang digrouping) / `'tergrouping'` (sisa qty = 0, lunas). Sebelumnya biner kosong/`tergrouping` saja |
| `dibuat_pada`/`dibuat_oleh`, `diedit_pada`/`diedit_oleh` | Timestamp / string | — |

### Koleksi counter (dokumen tunggal, bukan daftar)
| Koleksi/dokumen | Isinya |
|---|---|
| `pengaturan_id_bahan_aksesoris/{bahan\|aksesoris}` | `{ prefix }` — prefix ID Data Bahan & Aksesoris, diatur lewat gear di Entry Bahan & Aksesoris |
| `pengaturan_id_pembelian/pembelian` | `{ prefix }` — prefix No. Pembelian, diatur lewat gear di List/Nota Order Belanja |

---

## 🛒 Pesanan — koleksi

> **BARU (30 Agt 2026)**. Semua field DICEK LANGSUNG ke
> `js/vue-pesanan.js`. Lihat `PETA-MENU.md` bagian "🛒 Pesanan" &
> `STATUS-PROYEK.md` §45 untuk latar belakang & keputusan arsitektur
> lengkap. **⚠️ `firestore.rules` 2 koleksi di bawah BELUM DIPUBLISH ke
> Firebase Console** — WAJIB Guru tempel manual sebelum "Penjualan
> Kasir" bisa menulis data.

### `transaksi_kasir/{autoId}` — transaksi Penjualan Kasir
| Field | Tipe | Keterangan |
|---|---|---|
| `no_transaksi` | string | Format `TRX{yymmdd}{counter 3 digit}`, GLOBAL per hari (counter di `pengaturan_id_transaksi_kasir/{yymmdd}`) — pola SAMA PERSIS seperti `spk_grouping.kode_spk` |
| `nama_pelanggan` | string | Opsional, boleh kosong |
| `metode_pembayaran` | string | `Tunai` / `Transfer` / `QRIS` / `Lainnya` |
| `items` | array\<{sku_produk, nama_produk, qty, harga_satuan, subtotal}\> | Isi keranjang saat "Buat Order" ditekan — snapshot harga saat itu (BUKAN link live ke `master_produk.harga_jual`, jadi perubahan harga produk sesudahnya TIDAK mengubah transaksi lama) |
| `total` | number | Jumlah semua `items[].subtotal` |
| `status` | string | `Aktif` (belum ada alur ubah status lain per 30 Agt 2026 — field disiapkan buat kebutuhan nanti, mis. pembatalan) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp / string | — |

**Efek samping penting**: begitu 1 `transaksi_kasir` tersimpan, SISTEM OTOMATIS bikin **N dokumen `order_spk`** (1 per baris `items`, lihat bagian `order_spk` di atas) — supaya pesanan dari Kasir mengalir tanpa hambatan ke pipeline Persiapan Produksi V2 yang sudah ada.

### Koleksi counter (dokumen tunggal, bukan daftar)
| Koleksi/dokumen | Isinya |
|---|---|
| `pengaturan_id_transaksi_kasir/{yymmdd}` | `{ counter, dibuat_pada }` — counter `no_transaksi` Kasir, key per tanggal (auto "reset" tiap hari ganti), pola SAMA seperti `pengaturan_id_spk_grouping` |

---

## 🧵 Persiapan Produksi V2 — koleksi

> Semua field DICEK LANGSUNG ke `js/vue-persiapan-produksi-v2.js` (SATU
> file untuk jalur generik SISA + Grouping, lewat `JalurTahapManager` +
> `buatAppJalurTahap()`). Lihat `PETA-MENU.md` bagian "🧵 Persiapan
> Produksi V2" & `claude/RENCANA-PERSIAPAN-PRODUKSI-V2.md` untuk desain
> lengkap. **BARU (30 Agt 2026)**: koleksi `spk_track` di bawah SEKARANG
> JUGA dibaca (read-only) oleh Pesanan > Proses Persiapan/Produksi/
> Pengiriman (`js/vue-pesanan.js`, `RingkasanSpkTrackManager`) — TIDAK
> ADA field baru, TIDAK ADA penulis baru, cuma pembaca tambahan.
>
> **UPDATE (31 Agt 2026 — rebuild "Perlu Disiapkan")**: sub-menu "Perlu
> Disiapkan" dibangun ULANG TOTAL dari wireframe handoff Guru ("Ganti
> total" atas versi lama, belum ada data live jadi aman tanpa migrasi).
> `spk_track`/`JalurTahapManager`/5 jalur×5 tahap di bawah TIDAK
> DISENTUH SAMA SEKALI — cuma cara `spk_grouping` DIBUAT yang berubah
> (sekarang lewat panel pilih+qty per klaster, mendukung partial qty,
> lihat `order_spk` di atas). Fitur "batalkan grouping" SENGAJA belum
> dibuat versi ini (ditunda, disepakati Guru).
>
> **UPDATE LAGI (31 Agt 2026, lanjutan — modul Bahan)**: jalur **`bahan`**
> DIKELUARKAN dari `JalurTahapManager` generik, dibangun ULANG TOTAL di
> file BARU `js/vue-persiapan-bahan.js` (5 komponen sub-tab sendiri,
> lihat `PETA-MENU.md`). Field baru & koleksi baru untuk jalur Bahan
> dijelaskan di `spk_track.bahan_rincian[]` dan bagian koleksi baru, di
> bawah ini.
>
> **UPDATE LAGI (1 Sep 2026, sesi lanjutan — modul Acc Sewing/Webbing/
> Finishing sekaligus)**: jalur **`sewing`**/**`webbing`**/**`finishing`**
> JUGA DIKELUARKAN dari `JalurTahapManager` generik, dibangun ULANG
> TOTAL di 3 file BARU terpisah — `js/vue-persiapan-sewing.js`,
> `js/vue-persiapan-webbing.js`, `js/vue-persiapan-finishing.js`
> (masing-masing 5 komponen sub-tab sendiri, pola SAMA seperti Bahan
> tapi lihat perbedaan arsitektur kartu di bawah). Jalur `vendor`
> TIDAK ikut disentuh — TETAP SATU-SATUNYA jalur generik lewat
> `JalurTahapManager` sekarang. **PERBEDAAN ARSITEKTUR KARTU PENTING**:
> Bahan = kartu digabung LINTAS DOKUMEN per bahan+warna
> (`kelompokKartuBahan`); ke-3 pos Acc ini = **kartu SATU-SATU per
> dokumen `spk_track`** (TIDAK ada penggabungan lintas dokumen, TIDAK
> ada alokasi stok kumulatif ala Bahan) — konsekuensinya SETIAP pos
> Acc perlu pola read-modify-write BARU `updateBarisXxxMassal()` (patch
> banyak baris sekaligus dalam 1 transaksi) karena 1 scan bisa
> menyentuh banyak baris komponen milik 1 anak-SPK sekaligus, beda dari
> Bahan yang 1 kartu=1 jenis bahan (maks 1 baris per anak-SPK per
> kartu). Detail lengkap: `STATUS-PROYEK.md` §5.11d.
>
> **UPDATE LAGI (5 Sep 2026, §5.12)**: TIDAK ADA perubahan ke `spk_track`
> atau jalur manapun di bagian ini — perubahan sesi ini murni di lapisan
> Zevanic House (Master Suplayer, `master_tlc` via Config). Koleksi
> `master_tlc` di bawah (dipakai ke-4 pos Bahan/Acc) SEKARANG skema-nya
> DIKOREKSI di dokumentasi ini (`{kode, nama, tipe}`, sebelumnya sempat
> salah tertulis `{nama, keterangan}` — implementasi kode sudah benar
> sejak awal).

### `spk_grouping/{autoId}` — kelompok SPK yang produk+pola-nya sama ("gelar kain bersama")
| Field | Tipe | Keterangan |
|---|---|---|
| `kode_spk` | string | Format `SPK{yymmdd}{counter 3 digit}`, GLOBAL per hari lintas produk (counter di `pengaturan_id_spk_grouping/{yymmdd}`) |
| `nama_produk` | string | Nama DASAR (dari `master_produk.nama`, bukan gabungan warna+size) |
| `size` | string | **BARU (31 Agt 2026)** — ikut jadi kunci pengelompokan klaster (lihat catatan `order_spk` di atas), supaya size beda TIDAK ikut kegabung dalam 1 SPK Grouping walau pola & nama produknya sama |
| `kunci_pola` | string | Tanda-tangan SET pola (`panjang x isi_pola_pcs`, diurutkan) — dasar pencocokan otomatis antar SKU |
| `sku_produk_terlibat` | array\<string\> | — |
| `qty_total` | number | Jumlah qty SPK anggota YANG IKUT grouping ini — **BARU (31 Agt 2026)**: bisa PARTIAL (bukan selalu = `qty_order` penuh), kalau anggotanya dipecah sebagian lewat panel qty |
| `breakdown` | array\<{order_spk_id, no_spk, sku_produk, nama_produk, qty}\> | Rincian per SPK anggota — `qty` di sini juga bisa partial (qty yang diikutkan ke grouping ini saja, BUKAN selalu `qty_order` penuh SPK-nya). **Catatan (31 Agt 2026, §5.11)**: ini SUMBER anggota untuk `hitungBahanRincian()`/`hitungSewingRincian()`/`hitungWebbingRincian()`/`hitungFinishingRincian()` saat grouping dibuat (jalur terkait aktif) |
| `jalur_aktif` | array\<string\> | Subset dari `vendor`/`bahan`/`sewing`/`webbing`/`finishing` — bahan+sewing/webbing/finishing dideteksi OTOMATIS dari BOM produk, `vendor` SELALU manual (checkbox, belum ada sumber BOM yang jelas — TETAP ADA di versi rebuild 31 Agt 2026, modul otomatisasi vendor menyusul terpisah) |
| `label_grouping_dicetak` | boolean | Gerbang: Scan Operator (jalur manapun) DITOLAK sebelum label ini dicetak |
| `tanggal_generate`, `dibuat_oleh` | Timestamp / string | — |

### `spk_track/{autoId}` — status 1 SPK Grouping DI 1 JALUR (1 dokumen per jalur aktif per grouping)
Dibuat otomatis (`buatSpkTrackUntukGrouping()`) begitu `spk_grouping` selesai dibuat — field produk didenormalisasi dari grouping (hemat baca).

| Field | Tipe | Keterangan |
|---|---|---|
| `grouping_id`, `kode_spk`, `nama_produk`, `qty_total` | — | Disalin dari `spk_grouping` |
| `jalur` | string | `vendor`/`bahan`/`sewing`/`webbing`/`finishing` |
| `status` | string | `perlu_diproses` → `sedang_diproses` (Scan Operator) → `perlu_dikirim` (Scan Entry) → `sedang_dikirim` (Scan Pack) → `selesai` (Scan Sampai). **Catatan**: untuk `jalur` `bahan`/`sewing`/`webbing`/`finishing`, status level-dokumen ini SEKARANG cuma dipakai buat kartu ringkas — status OPERASIONAL sesungguhnya ada PER BARIS di `bahan_rincian[].status`/`sewing_rincian[].status`/dst (lihat di bawah), beda dari `vendor` yang statusnya cuma di level dokumen ini |
| `operator_id`, `operator_nama` | string | Diisi saat Scan Operator (scan QR pribadi karyawan, cari ke `users`). Untuk 4 jalur non-vendor, field level-dokumen ini TIDAK dipakai lagi — operator dicatat PER BARIS (`..._rincian[].operator_uid`/`operator_nama`) |
| `kode_bagging`, `kode_tugas` | string | Kode label QR yang digenerate & dicetak per tahap (Scan Pack cek `kode_bagging`, Scan Kirim/Sampai cek `kode_tugas`). Untuk 4 jalur non-vendor, kode-kode ini dicatat PER BARIS, field level-dokumen ini tidak dipakai |
| `riwayat_scan` | array\<{aksi, oleh, pada, catatan?}\> | `arrayUnion` tiap scan — `aksi`: `operator`/`entry`/`masalah`/`pack`/`kirim`/`sampai`. Untuk 4 jalur non-vendor, riwayat per-scan operator dicatat di `..._rincian[].riwayat_operator[]` (per baris), BUKAN di array level-dokumen ini |
| `catatan_masalah` | string | Diisi lewat Scan Masalah (`prompt()`). Untuk 4 jalur non-vendor, dicatat PER BARIS |
| `bahan_rincian` | array | **BARU (31 Agt 2026, §5.11)** — HANYA diisi kalau `jalur==='bahan'` (jalur lain: array kosong `[]`). 1 baris per kombinasi (bahan × anak-SPK), dihitung SEKALI saat SPK Grouping dibuat (`hitungBahanRincian()`, sumber: `spk_grouping.breakdown[]` × `master_produk.bom_pola[]` baris `tipe==='internal'` × `master_bahan_aksesoris`), lihat kolom di bawah. **Batasan teknis PENTING** (berlaku juga untuk `sewing_rincian`/`webbing_rincian`/`finishing_rincian` di bawah): array Firestore TIDAK BISA diupdate 1 elemen saja secara langsung DAN TIDAK BISA berisi sentinel `serverTimestamp()` — tiap perubahan 1 baris WAJIB baca-ubah-tulis SELURUH array lewat `runTransaction` (fungsi `updateBarisBahan()`, `js/vue-persiapan-bahan.js`), timestamp per baris pakai `new Date().toISOString()` (string biasa, BUKAN `serverTimestamp()`) |
| `sewing_rincian` | array | **BARU (1 Sep 2026, §5.11d)** — HANYA diisi kalau `jalur==='sewing'` (jalur lain: array kosong `[]`). Field TERPISAH dari `bahan_rincian`/`webbing_rincian`/`finishing_rincian` (BUKAN 1 array generik gabungan) — sengaja dipisah supaya TIDAK perlu migrasi bentuk `bahan_rincian[]` yang sudah shipped. Dihitung SEKALI saat grouping dibuat (`hitungSewingRincian()`, sumber: `spk_grouping.breakdown[]` × `master_produk.bom_aksesoris[]` baris yang `tahap_proses`-nya cocok "sewing" × `master_bahan_aksesoris`). 1 baris per kombinasi (aksesoris × anak-SPK). Field per baris: identitas SAMA seperti `bahan_rincian[]` (`order_spk_id, no_spk, qty, bahan_aksesoris_id, bahan_nama, bahan_warna, produk_size, status, masuk_tahap_pada, label_cetak_pada, operator_uid, operator_nama, ditugaskan_pada, riwayat_operator[], entry_qty, entry_oleh, entry_pada, catatan_masalah, kode_bagging, kode_tugas, tlc_tujuan, sampai_pada`) TANPA field kain (`nama_pola`/`panjang_pola`/`isi_pola_pcs`/`amparan`/`kebutuhan_kain`) — pos ini pakai `butuh` (qty aksesoris polos dari BOM × qty SPK), bukan hitungan meter kain |
| `webbing_rincian` | array | **BARU (1 Sep 2026, §5.11d)** — pola SAMA seperti `sewing_rincian` (`hitungWebbingRincian()`, filter `tahap_proses` cocok "webbing"), TAPI baris-nya PUNYA field TAMBAHAN: `panjang_per_pcs`, `butuh_meter` (meter kebutuhan webbing), `roll` (`ceil(butuh_meter / master_bahan_aksesoris.panjang_roll)` — **null kalau `panjang_roll` item belum diisi**, null-safe, TIDAK crash/NaN), `kode_webbing2`, `kode_webbing3` (disalin dari `master_produk.bom_aksesoris[].webbing2`/`webbing3`, teks bebas) |
| `finishing_rincian` | array | **BARU (1 Sep 2026, §5.11d)** — pola SAMA seperti `sewing_rincian` (`hitungFinishingRincian()`, filter `tahap_proses` cocok "finishing"), TAPI baris-nya PUNYA field TAMBAHAN: `varian_tipe` (default `'tunggal'`) & `varian_jumlah` (default `1`) — **KEPUTUSAN default eksplisit, bukan asumsi diam-diam**: SERAH-TERIMA Finishing masih menandai varian sebagai "belum diputuskan" saat kode ini ditulis, jadi 1 baris = 1 varian tunggal dipakai sebagai default aman (boleh diubah kalau Guru mau versi multi-varian nanti). `keadaan_cetak`/`sisa_dicetak` DIHITUNG LIVE per baris di UI (BUKAN field tersimpan di Firestore) dari `status` vs `qty`/`varian_jumlah` |
| `dibuat_pada`, `diperbarui_pada` | Timestamp | — |

**Isi 1 elemen `bahan_rincian[]`** (jalur `bahan` saja):

| Field | Tipe | Keterangan |
|---|---|---|
| `order_spk_id`, `no_spk`, `qty` | — | Identitas anak-SPK & qty baris ini (dari `spk_grouping.breakdown[]`) |
| `bahan_aksesoris_id`, `bahan_nama`, `bahan_warna` | — | Resolve dari `master_bahan_aksesoris` |
| `nama_pola`, `produk_size` | string | Dari `master_produk.bom_pola[]`/`master_produk.size` |
| `panjang_pola`, `isi_pola_pcs` | number | Disalin dari `bom_pola` baris terkait |
| `amparan`, `kebutuhan_kain` | number | Dihitung: `amparan = ceil(qty / isi_pola_pcs)`, `kebutuhan_kain = (panjang_pola/100) * amparan` (meter) |
| `status` | string | `perlu_disiapkan` → `sedang_disiapkan` (ditugaskan operator) → `perlu_dikirim` (Scan Entry) → `sedang_dikirim` (Scan Pack) → `selesai` (Scan Sampai) — status OPERASIONAL sesungguhnya baris ini, terpisah dari `spk_track.status` level dokumen |
| `masuk_tahap_pada` | string (ISO) | Diupdate tiap kali baris pindah status — dasar hitung "tertahan" (ambang **6 jam**, seragam di semua tab/pos, warna beda kalau lewat) |
| `label_cetak_pada` | string (ISO) \| null | Diisi saat label SPK Grouping dicetak pertama kali |
| `operator_uid`, `operator_nama`, `ditugaskan_pada` | — | Operator AKTIF baris ini saat ini (individu ATAU tim — sama-sama identitas biasa di data master operator, tidak ada field pembeda skema) |
| `riwayat_operator` | array\<{uid, nama, dari_pada}\> | **Riwayat estafet/shift-handover** — operator boleh diganti di tengah jalan (scan ulang QR operator baru pada baris yang sama, sebelum baris itu `selesai`), progres/qty TIDAK reset, histori di-`push` (BUKAN overwrite) supaya kelihatan siapa pegang dari jam berapa (mis. buat lacak reject/serah-terima), ditampilkan di kartu UI |
| `entry_qty`, `entry_oleh`, `entry_pada` | — | Diisi saat Scan Entry (`konfirmasiEntry()`) — SATU-SATUNYA titik yang mengurangi `master_bahan_aksesoris.stok_akhir` (atomic lewat `runTransaction` 2 dokumen: `spk_track` + `master_bahan_aksesoris`). Cetak label & Scan Kirim TIDAK mengurangi stok |
| `catatan_masalah` | string | Diisi lewat Scan Masalah per baris |
| `kode_bagging`, `kode_tugas` | string | Kosong sampai dicetak (blank-then-scan-to-fill) — kode bagging dari `bagging` (tab Perlu Di Kirim, "Cetak Kode Bagging"), kode tugas dari `tugas_kirim` (tujuan TLC dari dropdown `master_tlc`, "Cetak Kode Tugas") |
| `tlc_tujuan` | string | **BARU (1 Sep 2026)** — snapshot `tugas_kirim.tlc_tujuan` ke baris ini SAAT Scan Kirim, biar tab Selesai tidak perlu query balik ke `tugas_kirim`. Pola field yang SAMA dipakai lagi di `sewing_rincian`/`webbing_rincian`/`finishing_rincian` (§5.11d) |
| `sampai_pada` | string (ISO) \| null | **BARU (1 Sep 2026)** — jam divisi PENERIMA Scan Sampai (mis. Proses Produksi > Potong). **PENTING: field ini TIDAK ADA PENULISNYA di manapun di sistem sekarang** — layar "Scan Sampai" itu sendiri di luar lingkup modul Bahan (SERAH-TERIMA §4: "divisi penerima, belum digambar") dan BELUM DIBANGUN sama sekali. Sampai modul itu ada, baris `sedang_dikirim` tidak akan pernah otomatis pindah ke `selesai` — tab Selesai (Bahan) akan tampil kosong terus, ini BUKAN bug. **Sama persis berlaku untuk `sewing_rincian`/`webbing_rincian`/`finishing_rincian[].sampai_pada`** (§5.11d) — jadi SEKARANG 4 pos sekaligus (bukan cuma Bahan) menunggu modul ini |

**Isi 1 elemen `sewing_rincian[]`** — field IDENTIK dengan `bahan_rincian[]` DI ATAS **KECUALI**: TIDAK punya `nama_pola`/`panjang_pola`/`isi_pola_pcs`/`amparan`/`kebutuhan_kain` (itu konsep kain, khusus Bahan) — field kebutuhannya cuma `qty` (langsung dari `bom_aksesoris[].qty` × qty anak-SPK, satuan bebas sesuai `bom_aksesoris[].satuan`). Semua field lain (`status`, `masuk_tahap_pada`, `operator_*`, `riwayat_operator[]`, `entry_*`, `catatan_masalah`, `kode_bagging`/`kode_tugas`, `tlc_tujuan`, `sampai_pada`) SAMA PERSIS makna & alurnya seperti `bahan_rincian[]` di atas.

**Isi 1 elemen `webbing_rincian[]`** — SAMA seperti `sewing_rincian[]` DITAMBAH: `panjang_per_pcs` (meter per pcs, dari BOM), `butuh_meter` (`panjang_per_pcs × qty`), `roll` (`ceil(butuh_meter / panjang_roll)` item terkait, `null` kalau `panjang_roll` belum diisi), `kode_webbing2`, `kode_webbing3` (teks bebas, disalin dari `bom_aksesoris[].webbing2`/`webbing3`).

**Isi 1 elemen `finishing_rincian[]`** — SAMA seperti `sewing_rincian[]` DITAMBAH: `varian_tipe` (default `'tunggal'`), `varian_jumlah` (default `1`) — `keadaan_cetak`/`sisa_dicetak` dihitung LIVE di UI dari `status` vs `qty`/`varian_jumlah`, TIDAK disimpan sebagai field tersendiri.

### Koleksi counter
| Koleksi/dokumen | Isinya |
|---|---|
| `pengaturan_id_spk_grouping/{yymmdd}` | `{ counter, dibuat_pada }` — counter kode SPK Grouping, key per tanggal (auto "reset" tiap hari ganti) |
| `pengaturan_id_spk_grouping/config` | **BARU (5 Sep 2026, §5.13)** — `{ prefix }`, key doc TETAP literal `"config"` (BUKAN tanggal, sengaja beda format supaya TIDAK PERNAH tabrakan dengan doc counter harian di atas). Diatur di Zevanic House > Config > TLC & Prefix (`AppConfigTlc`, `js/vue-config.js`). Dibaca `generateKodeSpkGrouping()`/`muatPreviewKode()` (`js/vue-persiapan-produksi-v2.js`), fallback `"SPK"` kalau belum diatur. Sama koleksi dengan doc counter di atas → otomatis ter-cover rule Firestore yang sama, TIDAK perlu rule baru |

### 🆕 Koleksi bersama — dipakai Persiapan Produksi > Bahan / Acc Sewing / Acc Webbing / Acc Finishing (31 Agt 2026 & 1 Sep 2026, §5.11 & §5.11d) — DAN SEKARANG Config > TLC & Prefix (5 Sep 2026, §5.12)

> Semua field DICEK LANGSUNG ke `js/vue-persiapan-bahan.js` (pemilik
> asli koleksi ini, 31 Agt 2026) — 3 file BARU 1 Sep 2026
> (`vue-persiapan-sewing.js`/`vue-persiapan-webbing.js`/`vue-persiapan-
> finishing.js`) memakai koleksi YANG SAMA, TIDAK menambah koleksi baru.
> Rules Firestore 6 koleksi ini **WAJIB ditempel manual** ke Firebase
> Console — belum dikonfirmasi Publish (lihat `STATUS-PROYEK.md` §5.11).
> **Dikonfirmasi (1 Sep 2026, §5.11d)**: rules 6 koleksi ini SUDAH
> generik/tidak di-filter per jalur (grep langsung ke `firestore.rules`)
> — jadi ke-3 modul Acc BARU TIDAK PERLU rules tambahan apapun, cukup
> pakai rules yang sama yang sudah disiapkan untuk Bahan. Tidak ada 1
> pun yang butuh index composite baru (semua query equality 1 field).
> **BARU (5 Sep 2026, §5.12)**: `master_tlc` SEKARANG JUGA dikelola
> lewat komponen bespoke `AppConfigTlc` (`js/vue-config.js`, tab Config
> "TLC & Prefix") — TIDAK menambah rules baru (koleksi + rules-nya SAMA
> dengan yang sudah dibutuhkan modul Bahan/Acc), cuma menambah 1 jalur
> UI tambahan untuk CRUD koleksi yang sama.

### `bagging/{autoId}` — kode label bagging (tanpa TLC)
Dicetak BLANK (kosong, belum ada kode) lewat tombol "Cetak Kode Bagging" di tab Perlu Di Kirim, kodenya baru DIISI operator lewat Scan Pack (bukan digenerate-lalu-ditempel seperti kode_bagging/kode_tugas di jalur lain — pola "blank-then-scan-to-fill", simplifikasi dari spek wireframe 3-field-modal).

| Field | Tipe | Keterangan |
|---|---|---|
| `kode` | string | Format `BAGyymmdd-NNN` (`generateKodeHarian()`, counter di `pengaturan_id_bagging/{yymmdd}`) |
| `produk_label` | string | `kunciSepack()`/`labelSepack()` — untuk Bahan: gabungan `nama_pola::bahan_nama::produk_size` (pola+nama bahan+size harus sama, warna/no_spk boleh beda). **Untuk ke-3 pos Acc (§5.11d): kunci BEDA, cuma `produk::produk_size`** (SERAH-TERIMA: "komponennya sudah terikat SPK, jadi bukan pola dan bahan seperti pos Bahan") — dasar validasi "syarat sepack" saat Scan Pack |
| `ditutup_pada` | Timestamp \| null | Diisi begitu semua baris dalam bagging ini sudah di-Scan Pack |
| `dibuat_pada`, `dibuat_oleh` | Timestamp / string | — |

### `tugas_kirim/{autoId}` — kode tugas kirim (tujuan TLC)
| Field | Tipe | Keterangan |
|---|---|---|
| `kode` | string | Format `TGSyymmdd-NNN` (`generateKodeHarian()`, counter di `pengaturan_id_tugas_kirim/{yymmdd}`) |
| `tlc_id`, `tlc_nama` | string | Tujuan, dari dropdown `master_tlc` (Cetak Kode Tugas) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp / string | — |

### `master_tlc/{autoId}` — daftar Titik Lokasi Cerdas (tujuan pengiriman)
> **KOREKSI SKEMA (5 Sep 2026, §5.12)**: skema di bawah SEBELUMNYA
> (per §5.11) SALAH tertulis sebagai `{nama, keterangan}` (disamakan
> pola generic 7-koleksi Config lain). **INI KELIRU** — implementasi
> kode (`vue-persiapan-bahan.js`/`vue-persiapan-sewing.js`/dst,
> DAN SEKARANG `AppConfigTlc`/`vue-config.js`) SUDAH memakai skema
> `{kode, nama, tipe}` sejak §5.11 ditulis, dikonfirmasi identik dari 4
> `SERAH-TERIMA.md` berbeda — implementasi kodenya BENAR dari awal, cuma
> baris di bawah ini yang telat dikoreksi.

| Field | Tipe | Keterangan |
|---|---|---|
| `kode` | string | ID manusia-terbaca (mis. `TLC-PTG-01`) — kemungkinan besar INILAH yang dimaksud Guru sebagai "Prefix" (format prefix+nomor), BUKAN entitas terpisah — lihat `STATUS-PROYEK.md` §5.12, masih tebakan berbasis bukti |
| `nama` | string | Nama lokasi (mis. "Pos Potong", "Pos Acc Sewing") |
| `tipe` | string | Kategori/jenis lokasi (teks bebas) |

Bisa diisi lewat tombol "Isi TLC Awal" di tab Perlu Di Kirim (10 lokasi contoh dari `SERAH-TERIMA.md` Bahan §5, HANYA jika koleksi masih kosong), ditambah manual lewat tombol itu, atau **BARU (5 Sep 2026)** lewat tab Config "TLC & Prefix" (`AppConfigTlc`, CRUD penuh: tambah/hapus). Sudah diisi seed entri `TLC-SEW`/`TLC-WEB`/`TLC-FIN` (label `'Pos Acc Sewing'`/`'Pos Acc Webbing'`/`'Pos Acc Finishing'`) oleh ke-3 file Acc — masing-masing file nge-seed entri POS-nya sendiri via tombol "Isi TLC Awal" kalau koleksi masih kosong, TIDAK saling menimpa punya pos lain.

### `cetak_ulang_log/{autoId}` — jejak audit cetak ulang label
Audit-only (create-only, tidak bisa update/delete lewat rules) — dicatat tiap kali admin cetak ulang label SPK Grouping yang sudah pernah dicetak sebelumnya (SERAH-TERIMA Bahan §3 "1b": WAJIB alasan + PIN admin). Pola & field yang SAMA dipakai ke-3 pos Acc.

| Field | Tipe | Keterangan |
|---|---|---|
| `grouping_id`, `kode_spk` | — | Label mana yang dicetak ulang |
| `alasan` | string | Diisi admin |
| `pin_dicatat` | string | **CATATAN PENTING**: PIN ini DIREKAM sebagai jejak audit saja, **TIDAK diverifikasi secara kriptografis** — tidak ada infrastruktur verifikasi PIN generik di codebase ini (dicek, cuma ada PIN kiosk-absensi, konteks beda), gate akses sebenarnya lewat izin menu admin-level Config Akses. Flagged sebagai kandidat perbaikan terpisah kalau Guru mau PIN sungguhan diverifikasi |
| `dicetak_oleh`, `dicetak_pada` | string / Timestamp | — |

### Koleksi counter (dokumen tunggal, bukan daftar)
| Koleksi/dokumen | Isinya |
|---|---|
| `pengaturan_id_bagging/{yymmdd}` | `{ counter, dibuat_pada }` — counter kode bagging, pola SAMA seperti `pengaturan_id_spk_grouping` |
| `pengaturan_id_tugas_kirim/{yymmdd}` | `{ counter, dibuat_pada }` — counter kode tugas kirim, pola sama |

⚠️ **Koleksi LAMA, DITINGGALKAN, TIDAK ditulis lagi**: `persiapan_produksi`, `persiapan_komponen` — cuma dipakai `js/vue-persiapan-produksi.js` (file DITINGGALKAN, tidak pernah dimuat lagi lewat `<script>`/import, lihat `PETA-MENU.md`). Data lama di 2 koleksi ini (kalau masih ada di Firestore) TIDAK dibaca kode manapun yang aktif sekarang — TERMASUK modul Bahan & ke-3 modul Acc baru di atas, yang SEMUANYA SENGAJA TIDAK memakai koleksi ini walau `persiapan_komponen` disebut sebagai sumber data di spek wireframe aslinya (dicek langsung ke kode, koleksi ini sudah ditinggalkan Guru sendiri 29 Agt 2026 — lihat `STATUS-PROYEK.md` §5.11).

---

## 🗄️ Firebase Storage

| Path | Isinya |
|---|---|
| `pengumuman/{idPengumuman}/media_{timestamp}.{ext}` | Lampiran gambar/video Pengumuman (Config Info) — maks 1MB, divalidasi client + Storage Rules |
| `master_produk/{produkId}/{segmen}_{timestamp}.jpg` | **BARU (30 Agt 2026, ditemukan saat audit Zevanic House)** — foto Master Produk (`vue-master-produk.js`, `uploadFotoProduk()`), pola path SAMA seperti Pengumuman. `segmen` = `foto` (foto utama produk) atau `pola{i}` (foto per baris BOM Pola) |

*(Update 30 Agt 2026: SEKARANG 2 folder yang dipakai, lihat baris di atas — catatan "Cuma 1 folder" per 18 Agt 2026 sudah tidak akurat. Foto selfie/KTP TIDAK di Storage, masih base64 langsung di field Firestore `foto_selfie`/`foto_ktp`, dengan segala konsekuensi ukuran dokumennya.)*

---

## ⚠️ Hal penting yang perlu diingat soal skema ini

1. **`role` vs `profil_akses`** (di `users`) — JANGAN PERNAH disatukan lagi. `role` cuma boleh 5 nilai baku, `profil_akses` boleh bebas. Lihat `STATUS-PROYEK.md` §6.2 untuk kronologi kenapa ini dipisah.
2. **`waktu` vs `waktu_ts`** (di `absensi`) — dua-duanya ada buat sementara (masa transisi). `waktu` jangan dihapus dulu (masih dipakai tampilan lama), `waktu_ts` yang dipakai buat query hemat ke depan.
3. **`foto_selfie`/`foto_ktp` base64 langsung di Firestore** — ini POTENSI RISIKO ke depan (dekati batas 1MB/dokumen Firestore kalau foto besar). Belum dipindah ke Storage seperti lampiran Pengumuman — kandidat perbaikan kalau ada masalah ukuran dokumen nanti.
4. **`pesanan_pembelian` vs `transaksi_kasir`** — JANGAN TERTUKAR. `pesanan_pembelian` = Order BELANJA (beli bahan dari suplayer, modul lama Zevanic House). `transaksi_kasir` = Order PENJUALAN (jual produk ke pelanggan, modul baru Pesanan). Sama-sama mengandung kata "pesanan" tapi arah uangnya berlawanan.
5. **`order_spk.status_grouping` sekarang TRI-STATE** (`''`/`'sebagian'`/`'tergrouping'`, sejak rebuild 31 Agt 2026) — kode LAMA yang masih cek biner (`if (status_grouping)` doang) bisa salah baca status `'sebagian'` sebagai "sudah beres". Kalau nambah UI baru yang baca field ini, WAJIB cek 3 nilai, bukan cuma truthy/falsy.
6. **`bom_pola` vs `bom_aksesoris` (di `master_produk`)** — JANGAN TERTUKAR (§5.11). `bom_pola` = kebutuhan KAIN (pos Bahan). `bom_aksesoris` = kebutuhan aksesoris/trim (pos Acc Sewing/Webbing/Finishing). Spek wireframe modul Bahan sempat salah sebut `bom_aksesoris` sebagai sumbernya — sudah dikoreksi ke `bom_pola` saat implementasi.
7. **`spk_track.bahan_rincian[]`/`sewing_rincian[]`/`webbing_rincian[]`/`finishing_rincian[]` masing-masing HANYA ada isinya kalau `jalur` dokumen cocok** — dokumen `spk_track` jalur `vendor` array ke-4nya selalu kosong `[]`, dan dokumen jalur `bahan` hanya `bahan_rincian[]` yang terisi (3 lainnya kosong), dst. Status operasional ke-4 jalur non-vendor ada PER BARIS di dalam array masing-masing, BUKAN di `spk_track.status` level dokumen (beda pola dari `vendor`) — kalau baca/tulis status jalur-jalur ini, WAJIB baca `..._rincian[].status`, bukan `spk_track.status`.
8. **Kartu Bahan vs kartu 3 pos Acc — JANGAN SAMAKAN CARA GABUNGNYA** (§5.11d). Bahan: 1 kartu = 1 bahan+warna, DIGABUNG lintas dokumen `spk_track` (`kelompokKartuBahan`). Acc Sewing/Webbing/Finishing: 1 kartu = 1 dokumen `spk_track` itu sendiri (1 SPK Grouping), TIDAK ADA penggabungan lintas dokumen. Kalau nambah fitur baru di salah satu pos, jangan asumsikan pola gabungnya sama dengan pos lain.
9. **`master_tlc` skema `{kode, nama, tipe}`, BUKAN `{nama, keterangan}`** (§5.12, 5 Sep 2026) — dokumentasi ini sempat salah menuliskan skema generic `{nama, keterangan}` untuk koleksi ini, padahal implementasi kode (`vue-persiapan-bahan.js` dkk sejak §5.11, DAN `AppConfigTlc`/`vue-config.js` sejak §5.12) SUDAH pakai `{kode, nama, tipe}` sejak awal. Kalau baca dokumen `master_tlc` di kode manapun, field yang benar adalah `kode`/`nama`/`tipe` — JANGAN pakai `keterangan`.
10. **`master_suplayer` & `alias_pembelian` field BARU (§5.12)** — `master_suplayer` sekarang punya `bank`/`nama_rek`/`no_rek`/`no_wa` (opsional, dokumen lama tanpa field ini null-safe); `alias_pembelian` sekarang punya `moq`/`moq_satuan`/`lead_time_hari`/`is_default_order` (jangan disamakan dengan `master_produk.kelipatan`, itu konsep BOM produk yang beda konteks sama sekali).
11. **ADA 2 MOQ terpisah, JANGAN DICAMPUR (§5.13, 5 Sep 2026, klarifikasi Guru langsung)**: (a) "MOQ Pembelian Bahan & Aksesoris" = `alias_pembelian.moq`/`moq_satuan`/`lead_time_hari` (§5.12 di atas) — jalur SUPLAYER/beli bahan; (b) "MOQ Pesanan Produk" = `master_produk.moq_serie` (§5.13) — jalur PRODUK/order, dipakai modul Serie nanti. Beda koleksi, beda konteks, beda tujuan — kalau ada permintaan fitur soal "MOQ" ke depan, WAJIB tanya dulu yang mana yang dimaksud kalau tidak eksplisit.
12. **ADA 2 "kelipatan" terpisah di `master_produk`, JANGAN DICAMPUR (§5.13)**: (a) `kelipatan` (lama, 28 Agt 2026) = auto-KPK dari `bom_pola[].isi_pola_pcs`, dipakai Order SPK/Kasir sebagai "Rekomendasi Kelipatan Order" — TETAP dipakai apa adanya; (b) `kelipatan_isi_pola` (baru, §5.13) = input MANUAL terpisah untuk modul Serie nanti, TIDAK ada hubungan hitung-otomatis dengan (a).
