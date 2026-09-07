# Peta Dampak — Rekonstruksi Besar (Pesanan, Zevanic House, Persiapan Produksi, Proses Produksi)

> Dibuat 5 Sep 2026, atas permintaan Guru: *"kita mulai koding saya akan
> rekonstruksi besar2n dari mulai pesanan, zevanic house, persiapan produksi
> dan tambahan proses produksi... semua dirombak melalu wireframe claude
> design logika, alur, database, menu akan terdampak."* Guru memilih
> **"Petakan dampak dulu"** sebelum koding — dokumen ini isinya itu.
>
> Sumber: 20 berkas di `Mockup/handoff/` (dibaca penuh) + `PETA-DATABASE.md`,
> `PETA-MENU.md` (dibaca penuh) + **verifikasi langsung ke kode live**
> (`git clone` repo, commit terakhir **2 Sep 2026**) — bukan cuma dari teks
> spek wireframe, sesuai kebiasaan proyek ini (spek bisa basi dari kode).
>
> **UPDATE progres (5 Sep 2026, sesi lanjutan)**: Guru konfirmasi lanjut
> rekonstruksi sesuai §6 di bawah. Langkah 1 (push+uji Bahan/Acc) tugas Guru
> sendiri — status belum dikonfirmasi. Langkah 2 (Publish `firestore.rules`
> tertunda) **SELESAI** — Guru paste isi `firestore.rules` lengkap, dicek
> silang, semua koleksi lama (`master_tlc`, `spk_track`, `bagging`/
> `tugas_kirim`/`cetak_ulang_log`, `transaksi_kasir`/`pengaturan_id_
> transaksi_kasir`, dst) sudah ADA match block-nya — lihat `STATUS-
> PROYEK.md` §5.13, `claude/FIRESTORE-RULES-SNAPSHOT.md` (snapshot baru).
> Langkah 3 (Infrastruktur PIN sungguhan) **SENGAJA DILEWATI** atas pilihan
> eksplisit Guru (AskUserQuestion) — perlu Cloud Function di repo terpisah
> yang Claude tidak punya akses, ditunda sampai langkah 11-12 benar-benar
> butuh. Langkah 4 ("Master Pelanggan + Master Suplayer rebuild") **KODE
> SELESAI KEDUANYA** — Master Suplayer rebuild sudah lebih dulu jadi di
> §5.12 (sebelum dokumen ini ditulis, sesi yang sama hari itu), Master
> Pelanggan (koleksi & modul baru total) baru saja ditulis §5.14. Rules
> `master_pelanggan` **SUDAH DIPUBLISH Guru** (7 Sep 2026, dikirim juga
> `firestore.rules` versi gabungan lengkap siap tempel) — belum ada
> konfirmasi push kode ke repo/uji browser. Detail lengkap tiap langkah ada
> di `STATUS-PROYEK.md` §5.12/§5.13/§5.14, TIDAK diulang di sini — dokumen
> ini tetap peta urutan, bukan log implementasi.
>
> **UPDATE progres (7 Sep 2026)**: Guru diskusi & memutuskan 9 dari 37 poin
> "Yang Belum Diputuskan" di §7 (lihat tabel §7 untuk jawaban lengkap per
> baris) + 3 poin lain ternyata SUDAH dijawab sebelumnya di §5.10 (Perlu
> Disiapkan). 2 jawaban baru membuka **build item baru** yang belum ada di
> rencana manapun sebelumnya — dicatat di §9 (baru) supaya tidak hilang:
> (a) config ambang "tertahan" per pos/shift (bukan lagi 1 angka tetap),
> (b) menu "Kemasan Komponen Acc" (nama lama "Bagging Acc", diganti 7 Sep
> 2026 karena tabrakan istilah — lihat §9.4) di Stok untuk komponen kecil
> (D-ring, cord lock, dst) yang sudah dikemas per jumlah tetap (mis. 25/24
> pcs) sebelum dipakai.
>
> **UPDATE progres (7 Sep 2026, lanjutan sore)**: Guru minta cek langsung
> ke `Mockup/handoff/Scan dan Cetak/wireframe.dc.html` soal modul "Scan
> Sampai". Ditemukan: Scan Sampai (dan 5 saudaranya — Operator/Entry/
> Masalah/Pack/Kirim) memang dirancang sebagai **1 komponen generik**
> ("bikin sekali, panggil di mana-mana"), dipakai bukan cuma Cutting tapi
> **SEMUA 9 pos** (4 Persiapan Produksi + 5 Proses Produksi — dikonfirmasi
> silang ke SERAH-TERIMA Serie/Sewing/Finishing/Gudang, semua punya tab
> "Scan Sampai" sendiri). Detail teknis versi Proses Produksi-nya (dirujuk
> sebagai "Scan & Cetak 2.7–2.13" oleh Cutting, "2.14–2.20" oleh Serie)
> **TIDAK PERNAH DIGAMBAR** di file aslinya — baru prinsip, belum spek.
> **Keputusan Guru**: bangun **1 modul Scan generik** mencakup SEMUA 6
> jenis scan sekaligus (retrofit total — termasuk Bahan/Acc/Masalah yang
> sudah live diubah supaya ikut pakai komponen yang sama), dikerjakan
> SEBAGAI PRIORITAS TERPISAH sebelum Cutting mulai — detail build item
> baru ini di §9.3. Guru juga memutuskan: **Persiapan Produksi diperbarui
> dulu seluruhnya sesuai handoff baru** (Masalah rebuild, Persiapan
> Belanja, kekurangan Bahan/Acc lain, Modul Scan generik) **SEBELUM**
> masuk Proses Produksi (Cutting dst) — urutan langkah di §6 digeser
> mengikuti ini. Detail kekurangan Bahan/Acc di luar ambang tertahan
> masih **BELUM dijelaskan Guru** (ditanya, jawaban tertunda) — jangan
> anggap sudah lengkap sebelum ada jawabannya.
>
> **UPDATE progres (7 Sep 2026, lanjutan malam)**: lanjut
> `/design-terapkan-handoff` untuk modul **Stok dan Pembelian** (4 sub-tab:
> Daftar Nota, Riwayat Harga Pembelian, Kartu Stok, Rak Penyimpanan).
> Selama pengerjaan Kartu Stok, ditemukan rencana awal Guru ("pindah ke
> Scan & Cetak") berdasar premis yang TERNYATA salah — `vue-scan-
> persiapan.js` memang sudah ada dan dipakai, tapi cuma menangani kasus
> sederhana (1 roll), belum FIFO multi-roll/alur kekurangan. Dilaporkan ke
> Guru, keputusan baru: scope FIFO+kekurangan dipindah ke Scan Persiapan
> DULU, baru Kartu Stok jadi read-only murni — lihat pelajaran baru di
> `STATUS-PROYEK.md` §6. Modul ini JUGA menemukan (bukan membangun ulang)
> infrastruktur PIN yang sudah ada (`users.pin_hash`, dibangun 22 Agt 2026
> untuk Kiosk) dan memakainya untuk finalisasi nota + Terapkan harga — ini
> BUKAN infrastruktur PIN generik yang dimaksud langkah 3 di bawah (yang
> masih sengaja ditunda), tapi solusi lebih ringan yang cukup untuk modul
> ini saja. Detail lengkap: `STATUS-PROYEK.md` §5.14. Kode ditulis + `node
> --check` lolos + dikirim ke `Code\` device — **BELUM DITEST BROWSER/
> FIRESTORE SAMA SEKALI**, dan modul ini sensitif UANG+STOK.
>
> **UPDATE progres (7 Sep 2026, lanjutan malam lagi) — PENYIMPANGAN
> URUTAN, langkah 15 dikerjakan lebih dulu**: atas permintaan eksplisit
> Guru lewat invocation `/design-terapkan-handoff` langsung untuk modul
> "Pesanan dan Transaksi", **langkah 15 (Pesanan — fitur piutang) di §6
> DIKERJAKAN SEKARANG**, LONCAT dari urutan yang disarankan (langkah 5-14
> — Modul Scan generik, Masalah rebuild, kekurangan Bahan/Acc, Stok dan
> Pembelian [sudah selesai duluan sebagai 7c], Persiapan Belanja, Vendor,
> lalu Proses Produksi Cutting-Gudang — SEMUA INI TETAP BELUM SELESAI).
> Bukan kesalahan — Guru yang eksplisit minta dikerjakan sekarang — tapi
> WAJIB dicatat sebagai penyimpangan urutan disarankan supaya sesi
> berikutnya tidak bingung kenapa langkah 15 sudah ada kodenya padahal
> langkah 5-14 belum. Detail lengkap keputusan (7 keputusan Guru D1-D7 +
> 4 tambahan teknis T1-T4, termasuk 1 temuan arsitektur `status_grouping`
> yang dikoreksi mid-implementasi): `STATUS-PROYEK.md` §5.15. Ringkasan:
> 4 sub-menu Pesanan direkonstruksi total (Penjualan Kasir, Menunggu
> Proses [jadi murni antrian QO], Daftar Pesanan [BARU, gabungan 3 menu
> ringkasan lama], Transaksi Keuangan [BARU]), 1 koleksi BARU
> `piutang_pembayaran` (**BELUM DIPUBLISH rules-nya — blocker keras**),
> field baru di `transaksi_kasir`/`order_spk`. **KODE DITULIS, `node
> --check` lolos, BELUM DITEST BROWSER/FIRESTORE SAMA SEKALI** — jangan
> dianggap siap pakai. Langkah 5-14 di §6 di bawah TETAP berlaku apa
> adanya untuk urutan sisanya (tidak berubah karena penyimpangan ini).
>
> **UPDATE progres (7 Sep 2026, malam lanjut) — langkah 5 lanjut jalan,
> urutan KEMBALI ke rencana**: setelah fondasi Scan & Cetak (§5.16) &
> loncatan Pesanan (§5.15) di atas, Guru instruksikan lanjut sesuai
> urutan yang sudah disepakati (*"oke kita gas step selanjutanya
> persiapan produksi"*) — **4 pos Persiapan Produksi (Bahan/Acc Sewing/
> Webbing/Finishing) diretrofit memakai `ScanGenerik`**, menggantikan
> `ModalScanQr` yang dulu disalin identik 4x. `ScanGenerik` ditulis ulang
> interface-nya dulu (§5.16 draft-nya ternyata single-shot, tidak
> mendukung "scan berkali-kali" yang dibutuhkan 4 modul ini) supaya
> persis sama perilakunya dengan `ModalScanQr` — baru dipasang. **Ini
> BUKTI PERTAMA `ScanGenerik` genuinely dipakai ulang lintas file** (4
> pemanggil), bukan cuma janji arsitektur di komentar kode. Perilaku
> scan TIDAK berubah sama sekali (murni ganti komponen, bukan fitur
> baru). Detail lengkap: `STATUS-PROYEK.md` §5.17. **BELUM DITEST
> BROWSER SAMA SEKALI** — `node --check` lolos ke-5 file yang diubah.
> Urutan langkah 6-14 di §6 di bawah TIDAK berubah, giliran berikutnya
> tetap Masalah (langkah 6) lalu sisanya sesuai tabel.
>
> **UPDATE progres (7 Sep 2026, malam lanjut lagi) — langkah 6 (Masalah)
> SELESAI DITULIS**: instruksi Guru *"masalah gas"*. Persiapan Produksi >
> Masalah **REBUILD TOTAL** dari papan manual bebas-teks lama jadi alur 7
> tahap (Perlu Diajukan → Menunggu Setuju → Perlu Disiapkan → Sedang
> Disiapkan → Perlu Di Kirim → Sedang Di Kirim → Selesai), file baru
> `js/vue-pp-masalah.js`. **Konflik arsitektur ditemukan SEBELUM menulis
> kode** (dilaporkan via AskUserQuestion, BUKAN ditebak): nama koleksi
> `persiapan_masalah` yang diasumsikan wireframe berskema baru TERNYATA
> sudah dipakai aktif skema LAMA oleh papan manual + 2 fitur §5.14 (Scan
> Persiapan kekurangan, Daftar Permintaan Stok & Pembelian). Keputusan
> Guru: skema BARU tetap pakai nama `persiapan_masalah`, 3 konsumen skema
> lama DIPINDAH ke koleksi baru `permintaan_bahan_manual`. **Retrofit
> Scan Masalah di 4 pos Bahan/Acc Sewing/Webbing/Finishing (supaya
> benar-benar membuat dokumen `persiapan_masalah`) SENGAJA BELUM
> dikerjakan sesi ini** (keputusan Guru: "Modul Masalah dulu, retrofit
> menyusul") — jadi modul Masalah akan tampil **KOSONG di semua 7 tab**
> sampai retrofit itu ada, itu EKSPEKTASI bukan bug. Data "pakai/minggu"
> dihitung LIVE dari riwayat `spk_track` (keputusan Guru ke-3), bukan
> di-cache. Detail lengkap: `STATUS-PROYEK.md` §5.18. **BELUM DITEST
> BROWSER SAMA SEKALI** — `node --check` lolos, tag HTML seimbang. Rules
> `permintaan_bahan_manual` **BELUM DIPUBLISH** (blocker board manual
> lama). **Giliran berikutnya: Cutting** (Proses Produksi mulai) — TAPI
> lihat catatan §6: retrofit Scan Masalah (di atas) dan Persiapan Belanja
> (langkah 8, prasyarat penuh Masalah) masih menyusul, belum tentu Guru
> mau loncat ke Cutting duluan seperti pola sebelumnya.

---

## 0. Ringkasan eksekutif

Paket wireframe ini menyentuh **4 area top-level** + 1 area pendukung:

| Area | Sifat | Skala |
|---|---|---|
| **Pesanan dan Transaksi** | Rework — nambah piutang/pelanggan ke fitur yang sudah ada (kasir, dsb) | Sedang |
| **Zevanic House** | Rework — Master Pelanggan baru, Master Suplayer diperluas total | Sedang-besar |
| **Persiapan Produksi** | Rework sebagian (Masalah **rebuild total**), pos baru (Persiapan Belanja) | Besar |
| **Proses Produksi** | **BARU SELURUHNYA** — 5 pos (Cutting, Serie, Sewing, Finishing, Gudang Barang Jadi) | Sangat besar |
| Stok & Pembelian / Scan & Cetak | Alias Pembelian pindah lokasi (kecil) **+ rebuild 4 sub-tab lain (Daftar Nota, Riwayat Harga, Kartu Stok, Rak Penyimpanan) — SELESAI §5.14, 7 Sep 2026 malam, ternyata skalanya Sedang bukan Kecil** | Sedang |

**Temuan paling penting** (dari verifikasi kode, bukan dari teks wireframe):

1. **Proses Produksi mengisi placeholder yang sudah lama menunggu.** Kartu
   "Pipeline Produksi" di Beranda desktop (`vue-home-desktop.js`) sudah ada
   sejak 30 Agt 2026 sebagai **placeholder UI-only "Segera Hadir"** untuk
   jalur Cutting/Serie/Sewing/Finishing — sengaja tanpa skema data (keputusan
   eksplisit Guru saat itu). Paket wireframe ini persis yang dibutuhkan untuk
   mengaktifkannya.
2. **Ada writer yang selama ini hilang — jawabannya bukan cuma Cutting,
   tapi 1 modul Scan generik dipakai semua pos.** `spk_track.
   bahan_rincian[].sampai_pada` (dan padanannya di `sewing_rincian[]`/
   `webbing_rincian[]`/`finishing_rincian[]`) **belum punya penulis di
   manapun** — didokumentasikan eksplisit di `PETA-DATABASE.md` sebagai
   gap yang disengaja ditunda. **Diperbarui 7 Sep 2026**: "Scan Sampai"
   TERNYATA bukan fitur khusus Cutting — ini 1 dari 6 jenis scan yang
   dirancang sebagai komponen generik dipakai SEMUA 9 pos (lihat §9.3).
   Begitu modul Scan generik ini + Cutting selesai, tab **Selesai** di
   Bahan/Acc Sewing/Acc Webbing/Acc Finishing (yang sekarang "sengaja
   kosong terus") akan **mulai terisi data** — perlu di-regression-test
   ke 4 modul lama itu juga, bukan cuma modul baru.
3. **Persiapan Masalah bukan penambahan — itu rebuild total.** ~~Kode live
   sekarang (`js/vue-persiapan-masalah.js`, 197 baris) cuma daftar datar
   status `menunggu`/`sudah_dipesan`.~~ **SELESAI DITULIS (§5.18, 7 Sep
   2026 malam lanjut)** — 7 child-menu (Perlu Diajukan → Menunggu Setuju →
   … → Selesai) dengan alur approval Owner, file baru `js/vue-pp-masalah.js`
   (papan lama dipindah jadi koleksi `permintaan_bahan_manual`, bukan
   dihapus). **BELUM DITEST BROWSER**, dan akan tampil kosong sampai
   retrofit Scan Masalah (4 pos) menyusul — lihat catatan update progres
   teratas & `STATUS-PROYEK.md` §5.18.
4. **Master Suplayer juga rebuild, bukan tambahan field kecil.** ~~Sekarang
   cuma tabel generik `MasterDataTabelManager` (field: nama, keterangan,
   kontak).~~ **SELESAI (§5.12)** — 3 sub-halaman penuh (5.1 Entry+List, 5.2
   Alias+MOQ, 5.3 Petakan Order) + 4 field baru (bank, nama_rek, no_rek,
   no_wa) sudah ditulis & dikirim ke folder `Code`, menunggu push+uji Guru.
5. **`firestore.rules` akan jadi bottleneck berulang.** ~~`transaksi_kasir`
   dan `pengaturan_id_transaksi_kasir` (fitur Pesanan, 30 Agt) masih belum
   dipublish~~ **RESOLVED (5 Sep 2026)** — lihat catatan update progres di
   atas. Paket ini menambah **12+ koleksi baru** (lihat §2) — kalau pola
   yang sama berulang (kode selesai, rules menyusul telat), modul baru akan
   terus tertahan di "kode selesai, belum bisa ditulis". ~~Sudah terbukti
   lagi persis begitu di §5.14~~ **RESOLVED (7 Sep 2026)** — rules
   `master_pelanggan` sudah dipublish Guru. **Terbukti lagi (7 Sep 2026
   malam) di §5.15**: koleksi BARU `piutang_pembayaran` (Pesanan piutang)
   BELUM dipublish rules-nya — blocker keras aktif SAAT INI. **Terbukti
   LAGI (§5.18, malam lanjut lagi)**: koleksi BARU `permintaan_bahan_manual`
   (papan manual lama Masalah, dipindah) juga BELUM dipublish. Rekomendasi
   tetap sama: siapkan draft rules BERSAMAAN dengan tiap modul (SUDAH
   dijalankan sejak §5.11 — draft dikirim terpisah tiap kali ada koleksi
   baru, termasuk `piutang_pembayaran` §5.15 dan `permintaan_bahan_manual`
   §5.18).
6. **Infrastruktur PIN generik (langkah 3) masih ditunda TOTAL, TAPI
   ditemukan solusi lebih ringan yang sudah cukup untuk sebagian modul.**
   `users.pin_hash` (SHA-256 client-side, dibangun 22 Agt 2026 untuk Kiosk)
   ternyata sudah bisa dipakai ulang untuk Stok & Pembelian (finalisasi
   nota, Terapkan harga — lihat §5.14) TANPA perlu Cloud Function. Ini
   BUKAN pengganti `verifikasiPIN()` generik yang dibayangkan §2.3/langkah
   3 (yang masih relevan untuk Persiapan Belanja nanti), tapi berguna
   dicatat sebagai opsi kalau modul lain juga cuma butuh PIN level
   Owner/Admin sederhana, bukan audit trail penuh. **DIREUSE LAGI (§5.15,
   7 Sep 2026 malam)** — Pesanan (Menunggu Proses "Proses massal" +
   Transaksi Keuangan "Catat pembayaran") juga pakai `pin_hash` yang sama,
   SELALU wajib PIN walau user login sudah Owner (beda dari pola skip-PIN-
   untuk-Owner di Stok & Pembelian, keputusan Guru D4). **Masalah (§5.18)
   TIDAK pakai PIN sama sekali** untuk gerbang Owner di Menunggu Setuju —
   pakai `tierOwnerKeAtas()` client-side saja (SERAH-TERIMA modul ini
   tidak memintanya), beda pola dari 2 modul di atas.

---

## 1. Status live sekarang (dikonfirmasi ke kode, bukan ke ingatan)

| Modul | Status live (commit 2 Sep 2026) | Catatan |
|---|---|---|
| Persiapan Produksi › Perlu Disiapkan | ✅ Aktif, sudah dipakai | Wireframe barunya kemungkinan cuma penyempurnaan kecil (klaster, panel grouping) — **belum dibandingkan detail** |
| Persiapan Produksi › Bahan | ⚠️ Kode selesai & dikirim, **belum di-push Guru, belum diuji** | `js/vue-persiapan-bahan.js` ADA di repo (sudah ter-push ternyata — cek ulang saat mulai kerja apakah statusnya sudah berubah jadi "aktif") |
| Persiapan Produksi › Acc Sewing/Webbing/Finishing | idem Bahan | 3 file ada di repo |
| Persiapan Produksi › Vendor | ✅ Aktif, tapi **generik** (`JalurTahapManager`) | Wireframe **belum digambar** untuk pos ini — lihat §5 |
| Persiapan Produksi › Masalah | ✅ **REBUILD TOTAL SELESAI DITULIS (§5.18, 7 Sep 2026 malam lanjut)** — 7 child-menu, file `js/vue-pp-masalah.js` | **BELUM DITEST BROWSER.** Akan tampil KOSONG di semua 7 tab sampai retrofit Scan Masalah (4 pos) dikerjakan — EKSPEKTASI, bukan bug |
| Persiapan Produksi › Persiapan Belanja | ❌ Belum ada sama sekali | Konsepnya baru; sebagian tumpang tindih "List Order Belanja" yang sudah ada di Stok & Pembelian — lihat §5 |
| Pesanan (semua 4 sub-menu, DIREKONSTRUKSI TOTAL §5.15) | ⚠️ **Kode direkonstruksi total & selesai ditulis (7 Sep 2026 malam, §5.15), `firestore.rules` transaksi_kasir SUDAH dipublish, TAPI koleksi BARU `piutang_pembayaran` BELUM dipublish (blocker keras)** | Piutang/pelanggan DIKERJAKAN SEKARANG (loncat urutan, lihat catatan update progres teratas) — BELUM DIUJI BROWSER/FIRESTORE SAMA SEKALI. Menu lama "Menunggu Proses" (CRUD manual) & 3 menu ringkasan lama (Persiapan/Produksi/Pengiriman) SUDAH TIDAK ADA LAGI, diganti struktur baru — lihat `PETA-MENU.md` |
| Zevanic House › Master Suplayer | ✅ **Rebuild SELESAI (§5.12)**, kode dikirim ke `Code`, belum push/uji Guru | 5.1-5.3 + 4 field baru sudah jadi |
| Zevanic House › Master Pelanggan | ✅ **Modul baru SELESAI ditulis (§5.14 lama/§5.12 di STATUS-PROYEK.md)**, kode dikirim ke `Code`, rules **SUDAH dipublish (7 Sep 2026)**, belum push/uji Guru | Koleksi + menu baru total, lihat `js/vue-master-pelanggan.js`. **`saldo_piutang` SEKARANG mulai benar-benar dipakai (§5.15)** lewat 2 titik resmi di modul Pesanan |
| Proses Produksi (semua 5 pos) | ❌ Belum ada sama sekali | Tidak ada file, tidak ada koleksi, tidak ada grup sidebar (`navgrp-prosesproduksi` belum ada) |
| Stok & Pembelian › Alias Pembelian | ✅ Dipindah ke Zevanic House › Master Suplayer 5.2 (§5.12) | Struktur data sama, hanya lokasi menu berubah |
| Stok & Pembelian › Daftar Nota (ganti "Order Belanja") | ✅ **Rebuild SELESAI ditulis (7 Sep 2026, `STATUS-PROYEK.md` §5.14)**, kode dikirim ke `Code`, **BELUM push/uji Guru** | Entry keyboard-first + PIN finalisasi + foto_bon; "List Order Belanja" (estimasi lama) DIHAPUS TOTAL dari sini |
| Stok & Pembelian › Riwayat Harga Pembelian | ✅ **SELESAI ditulis (§5.14)**, belum push/uji Guru | Alert kenaikan harga + tombol Terapkan (PIN Owner) |
| Stok & Pembelian › Kartu Stok | ✅ **SELESAI ditulis, GANTI jadi read-only murni (§5.14)**, belum push/uji Guru | "Catat Pemakaian" dipindah ke Scan Persiapan (lihat baris di bawah) |
| Stok & Pembelian › Rak Penyimpanan | ✅ **Dipindah dari "Data Bahan & Aksesoris" + migrasi model data (§5.14)**, belum push/uji Guru | Data rak LAMA butuh rapi-rapi manual Guru (tidak ada migrasi otomatis) |
| Scan & Cetak › Scan Persiapan | ✅ **Diperluas (FIFO multi-roll + alur kekurangan, §5.14)**, belum push/uji Guru | Menyerap 2 fungsi yang tadinya cuma ada di Kartu Stok lama |
| `master_produk.moq_serie` / `.kelipatan_isi_pola` | ✅ **SELESAI (§5.13)**, kode dikirim ke `Code`, rules TIDAK perlu tambahan | Field manual, prasyarat data Serie |
| `master_bahan_aksesoris.panjang_roll` | ✅ **Sudah ada** (ditambahkan 1 Sep 2026 untuk Acc Webbing) | Bisa dipakai ulang oleh Serie kalau perlu basis roll yang sama |

---

## 2. Dampak database — koleksi baru & field baru

### 2.1 Koleksi BARU total (belum ada sama sekali di kode/Firestore)

| Koleksi | Dipakai oleh | Catatan kunci |
|---|---|---|
| `master_pelanggan` | Zevanic House, Pesanan (kasir, piutang) | ✅ **KODE SELESAI (§5.14)**, rules SUDAH dipublish. `saldo_piutang` SEKARANG (§5.15) mulai benar-benar ditulis lewat 2 titik resmi (checkout Kasir menambah, `catatPembayaranSusulan()` mengurangi) — TIDAK lagi selalu `0` |
| `piutang_pembayaran` | Pesanan › Transaksi Keuangan | ✅ **KODE SELESAI (§5.15, 7 Sep 2026 malam)** — 1 dokumen per PEMBAYARAN, bukan per transaksi. Wewenang: Owner/PIC Owner + PIN (selalu wajib, termasuk Owner login). **⚠️ RULES BELUM DIPUBLISH — blocker keras**, belum bisa dipakai sama sekali di production |
| `permintaan_bahan_manual` | Persiapan Masalah (papan manual LAMA, dipindah dari `persiapan_masalah`) | ✅ **KODE SELESAI (§5.18, 7 Sep 2026 malam lanjut)** — fungsi & perilaku TIDAK berubah, cuma ganti nama koleksi (nama `persiapan_masalah` sekarang dipakai skema BARU 7-tahap). **⚠️ RULES BELUM DIPUBLISH — blocker keras**, papan manual lama akan `permission-denied` sampai dipublish |
| `order_belanja_driver` | Persiapan Belanja, Stok & Pembelian › List Order Driver | 1 dokumen = 1 order ke 1 suplayer |
| `pending_driver` | idem | Item yang stoknya habis di suplayer asal, bisa di-assign ulang |
| `cutting_track` | Proses Produksi › Cutting | 1 per SPK Grouping masuk Cutting, status 7 nilai |
| `label_komponen` | Cutting | 1 per label komponen (4×2cm) |
| `pengaturan_id_label_komponen/{yymmdd}` | Cutting | counter harian |
| `separating_batch` | Serie | 1 per batch hasil Generate Separating |
| `pengaturan_id_separating/{yymmdd}` | Serie | counter harian |
| `sewing_track` | Sewing (Proses Produksi) | 1 per batch masuk Sewing |
| `label_pcs` | Sewing → dipakai lintas Finishing/Gudang/Kasir | **Label paling penting di seluruh paket** — 1 label dipakai 3 pemakai (Finishing scan per tahap, Gudang scan masuk, Kasir scan jual) |
| `pengaturan_id_label_pcs/{yymmdd}` | Sewing | counter harian |
| `finishing_track` | Finishing (Proses Produksi) | 1 per pcs, 4 tahap (QC/Steam/Folding/Packing) |
| `opname_produk_jadi` (opsional) | Gudang Barang Jadi › Scan Opname | Log audit opname, bukan wajib di versi awal |
| `kemasan_komponen_acc` (nama BARU, ganti dari `bagging_acc` 7 Sep 2026, lihat §9.4) | Stok & Pembelian, Acc Sewing/Webbing/Finishing | Kode kemasan untuk komponen kecil (D-ring, cord lock, dst) yang dikemas per jumlah tetap (mis. 25/24 pcs) SEBELUM dipakai produksi — BELUM didesain skemanya, baru keputusan arah |

**Catatan desain penting**: Persiapan Produksi (Bahan/Acc) pakai koleksi
terpisah `bagging`/`tugas_kirim` dengan pola "blank-then-scan-to-fill".
Spek Proses Produksi (Cutting/Serie/Sewing/Finishing) menyebut
`kode_bagging[]`/`kode_tugas` sebagai **field langsung di dalam dokumen
track**-nya sendiri, tanpa merinci apakah itu tetap menunjuk ke koleksi
`bagging`/`tugas_kirim` yang sama atau berdiri sendiri. Ini **perlu
diklarifikasi ke Guru sebelum mulai Cutting** — kalau tidak diseragamkan,
"1 modul cetak, banyak pos" (aturan di `PEDOMAN-SERAH-TERIMA.md`) tidak
akan benar-benar tercapai untuk Proses Produksi.

### 2.2 Field BARU di koleksi yang SUDAH ADA

| Koleksi | Field baru | Untuk |
|---|---|---|
| `transaksi_kasir` | `pelanggan_id`, `status_bayar`, `dp_persen`, `total_dibayar`, `sisa_piutang`, `jatuh_tempo` | ✅ **SELESAI (§5.15, 7 Sep 2026 malam)** — Pesanan piutang |
| `order_spk` | `qo_diproses`, `qo_diproses_pada`, `qo_oleh` (proses massal QO), `pelanggan_id`, `pelanggan_nama`, `transaksi_kasir_id`, `no_transaksi`, `status_bayar` (snapshot) | ✅ **SELESAI (§5.15)** — bukan dari spek asli, ditambahkan karena diperlukan teknis (lihat `STATUS-PROYEK.md` §5.15 T1/T2) |
| `master_suplayer` | `bank`, `nama_rek`, `no_rek`, `no_wa` | ✅ SELESAI (§5.12) |
| `alias_pembelian` | `moq`, `moq_satuan`, `lead_time_hari`, `is_default_order` | ✅ SELESAI (§5.12) |
| `persiapan_masalah` | `tlc_asal`, `sumber_jalur`, `spk_track_id`, `baris_index` | ✅ **SELESAI (§5.18)** — skema BARU 7-tahap, koleksi ini SEKARANG dipakai penuh untuk rebuild Masalah (bukan lagi papan manual lama, yang dipindah ke `permintaan_bahan_manual`) |
| `pesanan_pembelian` | `foto_bon`, `order_driver_id` | ✅ **SELESAI (§5.14, 7 Sep 2026 malam)** — `order_driver_id` SELALU `null` untuk sekarang, belum ada modul driver yang menulis |
| `master_bahan_aksesoris` | `harga_perlu_konfirmasi`, `harga_pending` | ✅ **BARU (§5.14)** — dipakai alert kenaikan harga + checkout guard, bukan bagian spesifikasi awal, ditemukan perlu saat implementasi |
| `users` | `pin_hash`, `pin_salt` | PIN generik (edit harga, cetak ulang, dst) — **PIN WAJIB unik lintas user**, perlu strategi lookup kalau pakai bcrypt. **DITUNDA** (langkah 3 dilewati, lihat update progres di atas). **Catatan 7 Sep 2026 malam**: `pin_hash` (tanpa `pin_salt` terpisah, salt-nya email) TERNYATA SUDAH ADA dari fitur Kiosk 22 Agt — direuse di Stok & Pembelian (§5.14) DAN Pesanan (§5.15), bukan field baru |
| `master_produk` | `moq_serie`, `kelipatan_isi_pola` | ✅ SELESAI (§5.13) |
| `master_bahan_aksesoris` | — (sudah ada `panjang_roll`) | Bisa dipakai ulang |
| `spk_track` (jalur bahan/sewing/webbing/finishing) | **tidak ada field baru**, tapi `..._rincian[].sampai_pada` **akhirnya dapat penulis** | Ditulis oleh Cutting saat "Scan Sampai" (lihat §0 poin 2). **Sudah DIBACA (read-only) oleh Masalah §5.18** untuk hitung "pakai/minggu" live — belum ditulis modul manapun |
| Pengaturan ambang "tertahan" (koleksi/lokasi BELUM ditentukan, lihat §9) | Field per-pos/per-shift, GANTI dari konstanta tetap `AMBANG_TERTAHAN_JAM` | Config baru, dipakai perhitungan KPI "tertahan" di semua pos (Bahan/Acc/nanti Proses Produksi) |

### 2.3 PIN — catatan keamanan

Spek `SPESIFIKASI-KOLEKSI-BARU.md` minta `pin_hash` di-hash (bcrypt/SHA-256+salt),
**bukan plaintext**. Sistem PIN yang sudah ada sekarang (`cetak_ulang_log.pin_dicatat`,
dipakai modul Bahan/Acc) **eksplisit TIDAK diverifikasi kriptografis** —
cuma dicatat sebagai jejak audit (dikonfirmasi di `PETA-DATABASE.md`). Paket
baru ini (piutang, edit harga, cetak ulang label) mengasumsikan PIN
**benar-benar diverifikasi** lewat fungsi generik `verifikasiPIN(inputPIN)`.
Ini kebutuhan infrastruktur baru — bukan modifikasi kecil — harus dikerjakan
sebelum modul manapun yang bergantung padanya (Persiapan Belanja, Pesanan
piutang, Stok & Pembelian edit harga).

**UPDATE (5 Sep 2026)**: Guru sudah ditawari mulai infrastruktur ini
(AskUserQuestion) dan memilih **menunda** — karena hash PIN yang aman
biasanya butuh Cloud Function, dan repo `zevanic-cloud-function` TIDAK bisa
diakses sesi Claude manapun (`PETA-INFRASTRUKTUR.md`). Opsi yang ditawarkan
tapi TIDAK dipilih: (a) hash di client pakai Web Crypto/SubtleCrypto (lebih
lemah, bisa dikerjakan penuh di sesi chat), (c) Claude tulis spek Cloud
Function-nya buat ditempel Guru sendiri. Kalau langkah 11/12 sudah dekat,
pertanyaan ini akan muncul lagi dan salah satu opsi itu perlu dipilih.

**UPDATE (7 Sep 2026 malam)**: ternyata opsi (a) di atas SUDAH ADA duluan,
dibangun 22 Agt 2026 untuk keperluan lain (absensi Kiosk) — `users.
pin_hash` = SHA-256(pin + '|' + email) via Web Crypto, tanpa Cloud
Function. Dipakai ulang di Stok & Pembelian (§5.14) untuk finalisasi nota
+ Terapkan harga. Ini TIDAK menyelesaikan kebutuhan `verifikasiPIN()`
generik yang dibayangkan di atas (skema hash-nya lebih sederhana, tidak
ada salt acak per-user, dan belum tentu cukup aman untuk kasus piutang
bernilai besar) — tapi dicatat sebagai opsi murah kalau modul lain
(Persiapan Belanja, dst) ternyata juga cuma butuh PIN level Owner/Admin
sederhana, bukan audit trail penuh.

**UPDATE LAGI (7 Sep 2026 malam lagi, §5.15)**: `pin_hash` yang sama JUGA
dipakai untuk gerbang PIN Pesanan (Menunggu Proses "Proses massal",
Transaksi Keuangan "Catat pembayaran") — meski ini modul PIUTANG yang
disebut eksplisit di paragraf atas sebagai kasus yang idealnya menunggu
`verifikasiPIN()` generik. Keputusan Guru (D4): pakai `pin_hash` yang
sudah ada dulu, SELALU wajib (termasuk untuk Owner yang sudah login) —
bukan menunggu infrastruktur generik yang masih ditunda. Risikonya SAMA
seperti dicatat di atas (skema hash lebih sederhana, belum tentu cukup
untuk piutang bernilai besar) — dicatat di sini supaya tidak dianggap
sudah "aman penuh" hanya karena ada gerbang PIN.

**UPDATE LAGI (7 Sep 2026 malam lanjut lagi, §5.18)**: Masalah (Menunggu
Setuju, gerbang Owner/PIC Owner) **TIDAK pakai PIN sama sekali** — cuma
`tierOwnerKeAtas()` client-side (cek role login, tanpa popup PIN). Beda
pola dari Stok & Pembelian/Pesanan di atas — SERAH-TERIMA modul Masalah
tidak pernah meminta PIN untuk aksi ini, jadi tidak ditambahkan sendiri.

---

## 3. Dampak menu / sidebar

| Perubahan | Detail |
|---|---|
| **Grup sidebar baru**: "Proses Produksi" | Sejajar "Persiapan Produksi", 5 sub-menu: Cutting, Serie, Sewing, Finishing, Gudang Barang Jadi. `navgrp-prosesproduksi` belum ada di `index.html` — perlu dibuat dari nol (pola sama seperti `navgrp-persiapanproduksi`) |
| **Sub-menu baru** di Zevanic House: "Master Pelanggan" | ✅ **SELESAI (§5.14)** — nested di `navgrp-zevanic` (BUKAN grup top-level baru), 1 tombol + 1 div konten single-view, TIDAK perlu sentuh `auth.js` |
| **Master Suplayer** diperluas | ✅ **SELESAI (§5.12)** — dari 1 tabel generik jadi grup 3 sub-halaman (Entry+List, Alias+MOQ, Petakan Order) |
| **Sub-menu baru** di Persiapan Produksi: "Persiapan Belanja" | Grup 8, admin input + driver mobile + riwayat |
| **Persiapan Masalah** — isi menu sama, tapi jadi 7 child-menu (bukan 1 daftar) | ✅ **SELESAI (§5.18, 7 Sep 2026 malam lanjut)** — nested di `sub-persiapan-produksi` (BUKAN grup top-level baru), 7 sub-tab `sub-pp-masalah-*`, menu-id Config Akses baru `pp_masalah`, TIDAK perlu sentuh `auth.js` (mengikuti pola nested Masalah dalam grup Persiapan Produksi yang sudah ada) |
| **Alias Pembelian** pindah dari Stok & Pembelian ke Zevanic House › Master Suplayer 5.2 | ✅ SELESAI (§5.12) |
| **List Order Belanja** (Stok & Pembelian) — **DIHAPUS TOTAL** (diputuskan 7 Sep 2026, lihat §5 poin 1), digantikan sepenuhnya oleh Persiapan Belanja | ✅ **DIEKSEKUSI (§5.14, 7 Sep 2026 malam)** — bukan cuma keputusan, sudah dihapus dari kode+menu+sidebar. Persiapan Belanja (langkah 8) sendiri belum mulai dibangun — jadi untuk sementara TIDAK ADA jalur order estimasi sampai langkah 8 selesai |
| **4 sub-tab Stok & Pembelian rebuild** (Daftar Nota, Riwayat Harga, Kartu Stok, Rak Penyimpanan) | ✅ **SELESAI (§5.14, 7 Sep 2026 malam)** — lihat §1 untuk status per sub-tab |
| **Menu baru "Kemasan Komponen Acc"** (ganti nama dari "Bagging Acc", Stok & Pembelian, lihat §9.4) | Kode kemasan komponen kecil per jumlah tetap — BELUM didesain, baru arah keputusan |
| **Grup Pesanan direkonstruksi total (§5.15)**: `pesanan_persiapan`/`pesanan_produksi`/`pesanan_pengiriman` DIHAPUS, GANTI `pesanan_daftar` ("Daftar Pesanan") dan `pesanan_transaksi` ("Transaksi Keuangan") | ✅ **SELESAI DITULIS (7 Sep 2026 malam, §5.15)** — `pesanan_kasir`/`pesanan_menunggu` id sama, isi layarnya berubah total (Menunggu Proses jadi murni antrian QO). BELUM DIUJI |
| **DAFTAR_MENU** (`vue-config-akses.js`) | Perlu banyak entri `menuId` baru — tiap sub-menu baru di atas butuh 1 entri, plus kategori baru `"Proses Produksi"` masuk ke `KATEGORI_URUTAN`. `master_pelanggan` sudah ditambahkan (§5.14). **7 Sep 2026 malam**: `stock_list_order_belanja` di-deprecated, `stock_rak_penyimpanan` ditambahkan, `bahan_aksesoris_rak` (lokasi lama) di-deprecated. **7 Sep 2026 malam lagi (§5.15)**: `pesanan_persiapan`/`pesanan_produksi`/`pesanan_pengiriman` dihapus, `pesanan_daftar`/`pesanan_transaksi` ditambahkan. **7 Sep 2026 malam lanjut lagi (§5.18)**: `pp_masalah` ditambahkan (default Owner-only, mengikuti kebijakan proyek untuk menu baru) |
| **Beranda desktop** — kartu "Pipeline Produksi" | Placeholder "Segera Hadir" → diaktifkan datanya nyata begitu Proses Produksi jadi (baca `cutting_track`/`separating_batch`/`sewing_track`/`finishing_track`/`label_pcs`) |
| **Pesanan › Daftar Pesanan (3.1)** — kartu "Pipeline Proses Produksi" | Sekarang tampil "—" (modul belum ada) — otomatis terisi begitu Proses Produksi jadi, TANPA perlu ubah kode `vue-pesanan.js` (asalkan field yang dibaca cocok) |

---

## 4. Dampak alur/logika per area

### 4.1 Pesanan dan Transaksi
- ✅ **DIKERJAKAN §5.15 (7 Sep 2026 malam, loncat urutan)** — Kasir sekarang
  WAJIB pilih pelanggan sebelum checkout. Metode bayar TETAP Tunai/Transfer/
  QRIS (Lainnya dihapus), status bayar bertambah Lunas/DP/Tempo (Cicilan
  BUKAN opsi checkout, jadi status turunan dari `limit_piutang`, keputusan
  Guru D6 — beda dari rencana awal poin ini yang membayangkan Cicilan
  sebagai metode terpisah).
- Piutang jadi first-class: `status_bayar` tri-state di `transaksi_kasir`,
  dicatat via `piutang_pembayaran`, gerbang PIN + role Owner-tier untuk
  "Proses massal" (Menunggu Proses) dan "Catat pembayaran" (Transaksi
  Keuangan).
- Daftar Pesanan (3.1, sekarang `PesananDaftarManager`) dapat ringkasan
  menyeluruh + kartu per pelanggan + pipeline (bagian Persiapan sudah bisa
  jalan sekarang, TAPI disederhanakan jadi perkiraan begitu SPK masuk
  grouping campur-pelanggan, lihat `STATUS-PROYEK.md` §5.15 poin 5; bagian
  Proses Produksi nunggu modul baru, tampil "—").

### 4.2 Zevanic House
- Master Pelanggan: ✅ CRUD baru penuh SELESAI (§5.14) — **SEKARANG (§5.15)
  mulai benar-benar dipakai** oleh Pesanan (kasir wajib pilih pelanggan,
  `saldo_piutang` mulai berubah lewat 2 titik resmi).
- Master Suplayer: ✅ SELESAI (§5.12) — dari generik jadi CRUD lengkap +
  alias + MOQ + petakan order otomatis (`is_default_order`).
- Tidak ada perubahan pada Master Bahan/Master Produk selain field kecil
  (✅ `moq_serie`/`kelipatan_isi_pola` selesai §5.13).

### 4.3 Persiapan Produksi
- **Perlu Disiapkan**: kemungkinan penyempurnaan kecil (klaster per nama+
  ukuran+versi pola, panel grouping) — **perlu dibandingkan detail vs kode
  live sebelum diasumsikan "tidak berubah"**, karena wireframe menjelaskan
  perilaku yang cukup rinci (mis. penomoran harian 3 digit, kotak "akan
  masuk ke — otomatis") yang belum tentu 100% sama dengan implementasi
  31 Agt 2026. **Dikonfirmasi ULANG (7 Sep 2026, §5.15)**: `status_grouping`/
  `qty_tergrouping`/`grouping_ids` TETAP eksklusif milik modul ini — modul
  Pesanan (Menunggu Proses) yang sempat direncanakan menulis field ini
  ternyata TIDAK BOLEH (temuan arsitektur mid-implementasi, dikoreksi
  sebelum kode ditulis, lihat `STATUS-PROYEK.md` §5.15 poin 4).
- **Bahan / Acc Sewing / Acc Webbing / Acc Finishing**: kode sudah ada,
  **belum diuji** — sebelum menyentuh apapun di sini untuk paket baru ini,
  modul-modul ini harus dites dulu (lihat urutan di §6).
- **Vendor**: wireframe belum digambar. Spec eksplisit bilang "belum
  diputuskan" apakah dibuatkan wireframe khusus atau tetap generik.
- **Masalah**: ✅ **REBUILD TOTAL SELESAI DITULIS (§5.18, 7 Sep 2026 malam
  lanjut)** — dari 1 daftar jadi 7 child-menu dengan alur approval Owner
  (3 tombol keputusan: Setujui/Ajukan Belanja/Tolak — gerbang
  `tierOwnerKeAtas()` tanpa PIN) dan qty beli kelipatan MOQ dari
  `alias_pembelian`. Angka kumulatif lintas grouping **dihitung LIVE**
  (diputuskan 7 Sep 2026, lihat §7), bukan di-cache. **BELUM DITEST
  BROWSER**, dan akan tampil KOSONG di semua 7 tab sampai retrofit Scan
  Masalah di 4 pos (Bahan/Acc Sewing/Webbing/Finishing) menyusul — itu
  keputusan cakupan Guru untuk sesi ini ("Modul Masalah dulu, retrofit
  menyusul"), bukan gap tak terduga. Detail lengkap + daftar penyimpangan
  dari spek (3 judgment call terdokumentasi): `STATUS-PROYEK.md` §5.18.
- **Persiapan Belanja** (baru): admin input nota → cek pengajuan dari
  Masalah → ACC Owner → generate order per suplayer ke HP driver → driver
  beli (share WA + upload bon) → masuk ke Stok & Pembelian sebagai nota.
  **Catatan 7 Sep 2026 malam**: Stok & Pembelian sisi penerima (Daftar
  Nota) SUDAH SELESAI (§5.14) — begitu Persiapan Belanja dibangun
  (langkah 8), notanya sudah punya tempat masuk, tapi `order_driver_id`
  di `pesanan_pembelian` masih `null` sampai langkah 8 benar-benar
  menulis field itu. **Masalah (§5.18) sudah menyiapkan pintu keluar**
  ke sini — status `diajukan_belanja` di `persiapan_masalah` dari tombol
  "Ajukan Belanja" — tapi belum ada modul Persiapan Belanja yang
  membacanya.

### 4.4 Proses Produksi (baru seluruhnya)
Alur fisik: **Cutting → Serie → Sewing → Serie → Finishing → Serie →
Gudang Barang Jadi**. Serie adalah **hub wajib** — tidak ada jalur
langsung antar divisi manapun (aturan lintas modul, ditegaskan di
`PEDOMAN-SERAH-TERIMA.md` poin 11).

- **Cutting**: terima kiriman (scan sampai — **menutup Persiapan Bahan**),
  gelar kain, cetak label komponen, potong, kirim ke Serie.
- **Serie**: hub distribusi 11 tab — generate separating (gabung SPK beda
  yang bahan+warna+size sama), kirim/terima ke-dari Sewing dan Finishing,
  kirim ke Gudang. Alokasi PO FIFO terjadi di titik masuk Gudang, bukan
  di Serie.
- **Sewing**: jahit jadi produk jadi, cetak **label pcs** (dipakai 3
  tempat: Finishing, Gudang, Kasir — ini titik pertemuan paling kritis
  seluruh paket).
- **Finishing**: QC → Steam → Folding → Packing, 4 operator beda, tanpa
  cetak label baru (pakai label pcs dari Sewing). QC gagal → Persiapan
  Masalah → rework via Serie ke Sewing. Kekurangan hangtag 1 warna
  **cuma menahan baris warna itu** (diputuskan 7 Sep 2026, lihat §7),
  BUKAN seluruh SPK.
- **Gudang Barang Jadi**: scan masuk per pcs, stok **derived** dari
  `label_pcs.status` (bukan field tersendiri) — pola pertama di sistem
  ini yang pakai derived-stock, bukan `stok_akhir` yang ditulis langsung.
  Titik keluar: kasir scan QR label pcs.

### 4.5 Stok & Pembelian / Scan & Cetak
- Perubahan lokasi menu saja untuk Alias Pembelian (✅ selesai, lihat §3).
- **4 sub-tab lain (Daftar Nota, Riwayat Harga, Kartu Stok, Rak
  Penyimpanan) — REBUILD, ✅ SELESAI (§5.14, 7 Sep 2026 malam)**, lihat
  `STATUS-PROYEK.md` §5.14 untuk detail lengkap tiap sub-tab. Ini yang
  membuat baris §0/§1 untuk area ini berubah dari "rework kecil" jadi
  "sedang" — awalnya dokumen ini cuma menandai perpindahan Alias
  Pembelian, ternyata paket wireframe-nya jauh lebih besar dari itu.
- Scan & Cetak jadi tempat setting cetak terpusat ("1 modul cetak, banyak
  pos") — kalau setting diubah di sini, semua pos yang pakai jenis cetak
  itu ikut berubah. Ini butuh 1 lapisan konfigurasi baru yang belum ada
  sekarang (Scan Opname/Cetak Label Produk saat ini berdiri sendiri per
  modul, belum ada 1 config bersama). **Catatan**: `vue-scan-persiapan.js`
  sendiri (bukan Scan Opname/Cetak Label) sudah diperluas §5.14 untuk
  menyerap FIFO multi-roll + alur kekurangan dari Kartu Stok lama — belum
  terkait dengan config cetak terpusat di atas. **`vue-scan-persiapan.js`
  fungsi `ajukanPersiapanMasalahKekurangan()` diperbarui (§5.18)** untuk
  ikut ganti nama koleksi ke `permintaan_bahan_manual` — fungsi tidak
  berubah, masih menunggu retrofit lanjutan supaya benar-benar menulis
  skema baru `persiapan_masalah`.
- **Kemasan Komponen Acc** (BARU, 7 Sep 2026, ganti nama dari "Bagging
  Acc") — lihat §9.4, arah keputusan komponen kecil Acc Sewing dikemas
  per jumlah tetap sebelum dipakai produksi.

---

## 5. Konflik & keputusan yang perlu Guru sebelum koding jalan

Diurutkan dari yang paling menghambat:

1. ~~**List Order Belanja (Stok & Pembelian) vs Persiapan Belanja (baru)**~~
   **RESOLVED (7 Sep 2026)** — dikonfirmasi tumpang tindih nyata lewat audit
   kode (`vue-stock-pembelian.js` sudah baca dari Persiapan Masalah, tapi
   manual/admin-only, tanpa driver/ACC Owner/WA-share/upload bon). Keputusan
   Guru: **List Order Belanja DIHAPUS TOTAL**, digantikan sepenuhnya oleh
   Persiapan Belanja (langkah 8 di §6) — bukan jalan paralel, bukan cuma
   read-only. **DIEKSEKUSI (§5.14, 7 Sep 2026 malam)** — sudah benar-benar
   dihapus dari kode, bukan cuma keputusan tertulis.
2. **Vendor** — tetap generik atau tunggu wireframe baru? Kalau paket
   Proses Produksi selesai duluan, Vendor jadi satu-satunya jalur yang
   masih terasa "kuno" dibanding pos lain.
3. **Pola `bagging`/`tugas_kirim`** — apakah Proses Produksi memakai
   koleksi yang sama dengan Persiapan Produksi (konsisten "1 modul cetak")
   atau berdiri sendiri per pos (field inline di `cutting_track`/
   `sewing_track`/dst, seperti tertulis literal di spec)? **Catatan
   (§5.18)**: Masalah REUSE penuh `bagging`/`tugas_kirim`/`master_tlc`
   yang sudah ada (bukan koleksi baru) — preseden tambahan untuk opsi
   "konsisten 1 modul cetak" di atas.
4. **Firestore rules** — siapa yang menyiapkan draft rules per koleksi
   baru, dan kapan? ~~(Preseden: `transaksi_kasir` sampai sekarang belum
   dipublish, 6 hari sejak kode selesai.)~~ **Update**: proses draft
   BERSAMAAN kode sudah berjalan konsisten sejak §5.11, dan Publish oleh
   Guru juga sudah SELESAI untuk semua koleksi s.d. §5.14 (7 Sep 2026,
   termasuk `master_pelanggan`) — titik lambat lama ini TIDAK lagi jadi
   bottleneck aktif untuk koleksi-koleksi itu. **AKTIF LAGI (§5.15, 7 Sep
   2026 malam)**: koleksi BARU `piutang_pembayaran` (Pesanan piutang)
   BELUM dipublish — blocker keras baru, sama polanya seperti sebelumnya.
   **AKTIF LAGI (§5.18, malam lanjut lagi)**: koleksi BARU
   `permintaan_bahan_manual` (Masalah) JUGA belum dipublish — 2 blocker
   rules berjalan bersamaan sekarang. **Catatan**: field baru §5.14 malam
   (`harga_perlu_konfirmasi`/`harga_pending` di `master_bahan_aksesoris`,
   `foto_bon`/`order_driver_id` di `pesanan_pembelian`) TIDAK butuh rule
   baru (field di koleksi yang rule-nya sudah ada), begitu juga field
   baru §5.15 di `transaksi_kasir`/`order_spk` dan field baru §5.18 di
   `persiapan_masalah` (koleksi itu SUDAH ADA rule-nya) — beda dengan
   `riwayat_pin` (§5.13), `piutang_pembayaran` (§5.15), dan
   `permintaan_bahan_manual` (§5.18) yang semuanya butuh match block baru.
5. Poin "Yang Belum Diputuskan" di tiap `SERAH-TERIMA.md` (daftar lengkap
   di §7) — **9 dari 37 sudah dijawab Guru 7 Sep 2026** (ditandai ✅ di
   tabel §7), plus 3 lagi ternyata sudah dijawab lebih dulu di §5.10.
   Sisanya (~25 poin) masih terbuka.

---

## 6. Urutan pengerjaan yang disarankan

Menggabungkan urutan resmi di `PEDOMAN-SERAH-TERIMA.md` dengan temuan
dependency dari verifikasi kode:

**GESER (7 Sep 2026, keputusan Guru)**: Persiapan Produksi diselesaikan
DULU seluruhnya (langkah 5-9 baru di bawah) sebelum masuk Proses Produksi
— urutan LAMA (Cutting duluan) sudah TIDAK berlaku, digantikan urutan ini.

> **CATATAN PENYIMPANGAN (7 Sep 2026 malam lagi)**: langkah **15** di
> tabel bawah ini (Pesanan — fitur piutang) DIKERJAKAN LEBIH DULU, LONCAT
> dari urutan ini, atas permintaan eksplisit Guru — lihat catatan update
> progres paling atas dokumen ini & `STATUS-PROYEK.md` §5.15. Langkah
> 5-14 di bawah TIDAK berubah urutannya dan TETAP belum selesai — loncatan
> ini HANYA untuk langkah 15, bukan pergeseran urutan permanen.

| # | Langkah | Status (7 Sep 2026) | Alasan |
|---|---|---|---|
| 1 | **Push & uji** Bahan/Acc Sewing/Webbing/Finishing yang sudah "kode selesai" | ⏳ Tugas Guru, belum dikonfirmasi | Prasyarat murni — modul-modul ini akan disentuh lagi di langkah 5-8 di bawah, harus stabil duluan |
| 2 | Publish `firestore.rules` yang tertunda (`transaksi_kasir`, 6 koleksi Bahan/Acc, `master_pelanggan`) | ✅ **SELESAI** | Blocker keras yang sudah ada sebelum paket baru ini pun — semua rules s.d. §5.14 sudah dipublish |
| 3 | Infrastruktur PIN sungguhan (`verifikasiPIN`, `pin_hash`) | ⏸️ **Sengaja dilewati** (pilihan Guru) | Dipakai banyak modul baru (Persiapan Belanja, Stok edit harga) — kerjakan sekali, pakai ulang. Tunggu Cloud Function/keputusan pendekatan. **Catatan 7 Sep 2026 malam**: Stok & Pembelian (§5.14) DAN Pesanan (§5.15) TIDAK menunggu langkah ini — ternyata sudah ada `users.pin_hash` dari Kiosk yang cukup dipakai ulang untuk kebutuhan modul-modul itu, lihat §2.3. Masalah (§5.18) TIDAK pakai PIN sama sekali (cukup gerbang role) |
| 4 | Master Pelanggan + Master Suplayer (rebuild) | ✅ **KODE SELESAI KEDUANYA, RULES SELESAI KEDUANYA** (Suplayer §5.12, Pelanggan §5.14) — belum push/uji Guru | Data dasar yang dibutuhkan Pesanan piutang & Persiapan Belanja |
| 5 | **Modul Scan generik** (Operator/Entry/Masalah/Pack/Kirim/Sampai, BARU §9.3) | 🔶 **FONDASI + RETROFIT BAHAN/ACC SELESAI (7 Sep 2026 malam lanjut, §5.16+§5.17, `STATUS-PROYEK.md`)** — `PopupPinGenerik`/`ScanGenerik` ditulis di `js/vue-scan-cetak.js` + menu "Scan & Cetak" dibangun (§5.16), lalu `ScanGenerik` ditulis ulang interface-nya supaya persis sama `ModalScanQr` dan **4 pos Persiapan Produksi (Bahan/Acc Sewing/Webbing/Finishing) SUDAH diretrofit** memakainya (§5.17). **Retrofit Masalah (5 dokumen `persiapan_masalah` dari scan, di 4 pos) MASIH BELUM DIKERJAKAN** — keputusan Guru eksplisit di §5.18 ("Modul Masalah dulu, retrofit menyusul"), BUKAN terlewat. **Scan "Sampai" ITU SENDIRI (field `sampai_pada`) MASIH BELUM PUNYA PENULIS** — tetap menunggu Cutting | Retrofit Bahan/Acc SELESAI; retrofit Masalah + Scan Sampai masih menyusul |
| 6 | **Masalah** (rebuild total, 7 child-menu) | ✅ **SELESAI DITULIS (7 Sep 2026 malam lanjut, §5.18)** — instruksi Guru *"masalah gas"*. `js/vue-pp-masalah.js` baru, 7 tahap lengkap. **BELUM DITEST BROWSER.** Tampil KOSONG sampai retrofit langkah 5 (Scan Masalah di 4 pos) menyusul — keputusan cakupan Guru, bukan gap | Bagian dari "Persiapan Produksi diperbarui dulu" — SELESAI, tapi butuh retrofit langkah 5 supaya benar-benar terisi data |
| 7 | **Kekurangan Bahan/Acc lain** (ambang tertahan per pos §9.1 + 4 gap kode nyata, ditemukan & DIPUTUSKAN 7 Sep 2026: PIN cetak-ulang belum diverifikasi kriptografis, Bahan belum ada gerbang-batch, Acc Webbing belum ada logic roll-sisa, Acc Finishing belum ada alur vendor-sablon terpisah — dikerjakan SEKALIGUS ke-4nya) | ⏳ Belum mulai, cakupan sudah lengkap | Bagian dari "Persiapan Produksi diperbarui dulu" |
| 7b | **Zevanic House lain** (List Bahan grid/expand, margin persen, HPP, Riwayat PIN — BARU §9.2, ditemukan 7 Sep 2026) | ✅ Semua 4 keputusan diambil Guru + kode ditulis + `node --check` lolos + sudah dikirim ke `Code\` device (7 Sep 2026) — **BELUM DITEST BROWSER sama sekali**. Rule Firestore `riwayat_pin` **SUDAH dipublish** (7 Sep 2026 malam, bareng `piutang_pembayaran`) dan Riwayat PIN sendiri **PINDAH ke menu Scan & Cetak** (§5.16) — layar Config yang lama sudah dihapus | Master Suplayer/Pelanggan sudah selesai, tapi Master Bahan/Produk/Config di area yang sama ternyata masih ada gap dari wireframe — sekalian selagi di Zevanic House |
| 7c | **Stok dan Pembelian** (rebuild 4 sub-tab: Daftar Nota, Riwayat Harga, Kartu Stok, Rak Penyimpanan — BARU `STATUS-PROYEK.md` §5.14, dikerjakan 7 Sep 2026 malam via `/design-terapkan-handoff`) | ✅ Kode ditulis + `node --check` lolos + dikirim ke `Code\` device (7 Sep 2026) — **BELUM DITEST BROWSER/FIRESTORE SAMA SEKALI**, dan modul ini sensitif UANG+STOK (harga pembelian, saldo stok) | List Order Belanja (poin 1 di §5) akhirnya DIEKSEKUSI di sini (dihapus total dari kode, bukan cuma diputuskan). Kartu Stok/Scan Persiapan sempat ada salah premis rencana (lihat pelajaran baru `STATUS-PROYEK.md` §6) — sudah diperbaiki lewat konfirmasi ulang ke Guru |
| 8 | **Persiapan Belanja** | ⏳ Belum mulai | Butuh Masalah (langkah 6) sudah jadi dulu (sumber pengajuan) — **langkah 6 SEKARANG SUDAH SELESAI DITULIS (§5.18)**, jadi prasyarat ini terpenuhi dari sisi kode (status `diajukan_belanja` sudah disiapkan sebagai pintu keluar), TAPI belum ditest browser. Sisi penerima di Stok & Pembelian (Daftar Nota) sudah siap duluan (§7c) |
| 9 | Vendor | ⏳ Belum mulai | Setelah keputusan §5 poin 2 diambil — bagian akhir Persiapan Produksi sebelum pindah ke Proses Produksi |
| 10 | **Cutting** | ⏳ Belum mulai | Proses Produksi mulai di sini, SETELAH langkah 5-9 (Persiapan Produksi) selesai — bukan lagi langkah 5 seperti rencana lama |
| 11 | **Serie** | ⏳ Belum mulai | Hub — semua pos lain bergantung padanya |
| 12 | **Sewing** (Proses Produksi) | ⏳ Belum mulai | Sumber `label_pcs`, dipakai Finishing+Gudang+Kasir |
| 13 | **Finishing** | ⏳ Belum mulai | Bergantung pada label pcs dari Sewing |
| 14 | **Gudang Barang Jadi** | ⏳ Belum mulai | Titik akhir, baru bisa diuji penuh setelah 10-13 selesai |
| 15 | Pesanan — fitur piutang | ✅ **KODE SELESAI DITULIS, LONCAT DIKERJAKAN LEBIH DULU (7 Sep 2026 malam, §5.15)** — atas permintaan eksplisit Guru, BUKAN menunggu giliran urutan ini. **BELUM DITEST BROWSER/FIRESTORE SAMA SEKALI**, DAN diblokir rule Firestore `piutang_pembayaran` yang belum dipublish | Butuh Master Pelanggan (langkah 4, kode+rules sudah siap) — prasyarat itu SUDAH terpenuhi makanya loncat lebih dulu bisa dikerjakan. Checkout guard harga pending (§7c) sudah lebih dulu masuk ke `vue-pesanan.js` |
| 16 | **Kemasan Komponen Acc** (BARU, §9.4, ganti nama dari "Bagging Acc") | ⏳ Belum mulai, baru arah keputusan | Menyusul begitu skema `kemasan_komponen_acc` didesain — dibahas bareng Acc Sewing/Webbing/Finishing karena field terkait ada di sana |

Setiap langkah **tetap 1 modul 1 sesi chat**, sesuai aturan
`PEDOMAN-SERAH-TERIMA.md` — dokumen ini hanya peta urutan, bukan izin
mengerjakan beberapa modul sekaligus. **Pengecualian yang sudah terjadi**:
langkah 15 dikerjakan di luar urutan atas permintaan eksplisit Guru
(dicatat, bukan pelanggaran diam-diam) — lihat catatan penyimpangan di
atas tabel ini.

---

## 7. Daftar lengkap "Yang Belum Diputuskan" (dari 20 berkas serah terima)

> **Legenda (7 Sep 2026)**: ✅ = sudah dijawab Guru, keputusan final. Baris
> tanpa tanda = masih terbuka, belum ditanyakan/dijawab.

| Modul | Pertanyaan | Jawaban |
|---|---|---|
| Lintas modul | Roll webbing terpakai sebagian — jadi stok sisa kode sendiri atau dibebankan penuh ke SPK? | ✅ **Jadi stok sisa, kode sendiri** (bisa dipakai SPK lain nanti) |
| Lintas modul | "Menunggu cetakan" (Acc Finishing) — alur sendiri ke vendor sablon, atau tetap lewat Persiapan Masalah? | ✅ **Alur sendiri**, khusus vendor sablon (bukan digabung ke Persiapan Masalah) |
| Lintas modul | Satu anak SPK boleh dipegang 2 operator (dibagi)? | ✅ **Tidak boleh** — tetap 1 operator aktif per anak SPK, ganti orang pakai estafet (scan ulang), bukan dikerjakan 2 orang bersamaan |
| Lintas modul | Ambang "tertahan" per pos & per shift — nilainya belum ditetapkan (sementara 6 jam dipakai seragam) | ✅ **Perlu menu config tersendiri** — ambang BOLEH beda-beda per pos, dipakai buat hitung KPI "tertahan". Ini BUILD ITEM baru, belum didesain skemanya — lihat §9 |
| Lintas modul | Perpindahan tugas saat ganti shift — sudah disepakati lewat scan, tapi layarnya belum digambar | ✅ **Ditunda dulu** — dibahas lagi nanti kalau modul yang butuh ini (Cutting/Serie/dst) sudah mulai dikerjakan |
| Perlu Disiapkan | Grouping yang sudah dibuat — masuk tab Selesai sebagai riwayat atau hilang total? | ✅ **Sudah dijawab lebih dulu di §5.10** (31 Agt 2026, keputusan Guru poin 3): hilang total dari antrean, tidak ada tab riwayat |
| Perlu Disiapkan | Aturan pembatalan grouping kalau Owner salah gabung | ✅ **Sudah dijawab lebih dulu di §5.10** (keputusan poin 4): fitur ini DITUNDA, belum dibangun |
| Perlu Disiapkan | Satu SPK boleh ikut 2 grouping (qty sebagian)? | ✅ **Sudah dijawab lebih dulu di §5.10** (keputusan poin 6): BOLEH — sudah diimplementasikan (`qty_tergrouping`, `grouping_ids`) |
| Bahan/Acc Sewing/Webbing/Finishing | Tab Selesai sebagai riwayat — apa saja disimpan, berapa lama | ✅ **Tanpa batas waktu** — tidak dihapus otomatis, riwayat menumpuk terus (sama seperti asumsi sementara §5.11b) |
| Bahan/Acc Sewing/Webbing/Finishing | Layar Scan Sampai divisi penerima — **sekarang terjawab oleh Cutting**, tapi perlu konfirmasi field yang ditulis persis cocok | ✅ **Diperbarui 7 Sep 2026**: bukan cuma Cutting — Scan Sampai dipakai SEMUA 9 pos sebagai 1 komponen generik (lihat §9.3). Dibangun sebagai modul Scan generik terpisah SEBELUM Cutting (langkah 5 baru di §6), bukan ditunggu sampai Cutting mulai |
| Acc Sewing | Komponen kecil (D-ring, cord lock) — dihitung ketat per pcs atau per kantong dgn toleransi? | ✅ **Arah baru dari Guru**: dibuat kode kemasan tambahan per komponen kecil yang SUDAH dikemas per jumlah tetap (mis. 25/24 pcs) sebelum dipakai — perlu menu "Kemasan Komponen Acc" (ganti nama dari "Bagging Acc") di Stok. BUILD ITEM baru, skema belum didesain — lihat §9.4 |
| Acc Webbing | Roll terpakai sebagian — sama seperti poin lintas modul di atas | ✅ Sama seperti roll webbing lintas modul: **stok sisa, kode sendiri** |
| Acc Finishing | Kekurangan hangtag 1 warna — menahan seluruh SPK atau cuma baris warna itu? | ✅ **Cuma baris warna itu** — baris warna lain tetap lanjut diproses |
| Masalah | Kumulatif lintas grouping — dihitung live atau di-cache? | ✅ **Dihitung live**, konsisten dengan pola "dihitung live" di modul lain — **DIIMPLEMENTASIKAN (§5.18)**: `hitungPakaiPerMinggu()` baca `spk_track` langsung tiap render, tidak ada field cache |
| Masalah | Batas waktu pengajuan sebelum auto-eskalasi | *(masih terbuka — §5.18 tidak menjawab ini, tidak ada infrastruktur cron/scheduled function di app ini untuk auto-eskalasi. Tombol "Ajukan" di Perlu Diajukan tetap manual per kartu bahan — lihat `STATUS-PROYEK.md` §5.18 poin 1, judgment call)* |
| Persiapan Belanja | Format WA order — bisa diedit admin? | |
| Persiapan Belanja | Driver bisa tambah item di luar order (order tambahan)? | |
| Persiapan Belanja | Batas waktu ACC sebelum auto-cancel | |
| Vendor | Wireframe khusus vs tetap generik | |
| Vendor | Vendor punya akses sistem sendiri atau hanya lewat admin? | |
| Pesanan | Retur/pembatalan pesanan — belum dirancang | *(masih terbuka — §5.15 belum menjawab ini, `transaksi_kasir.status` masih cuma `'Aktif'`)* |
| Pesanan | Diskon per item atau per transaksi — belum ada field | *(masih terbuka — §5.15 belum menambah field diskon)* |
| Pesanan | Format cetak struk — thermal 58/80mm atau A4? | *(masih terbuka — §5.15 pakai `window.print()` browser MVP, T4, bukan integrasi printer thermal sungguhan)* |
| Pesanan | Cicilan — ada denda keterlambatan? | ✅ **Dijawab implisit §5.15**: TIDAK ada jadwal cicilan/denda — Cicilan murni status turunan dari `limit_piutang`, checkout diblokir total kalau lewat limit (keputusan Guru D6), tidak ada mekanisme denda dibangun |
| Zevanic House | Import/export Excel List Bahan & List Produk — tombol ada, format belum | |
| Zevanic House | Foto produk — ukuran maks, kompresi, path Storage | |
| Zevanic House | HPP — di-cache sebagai field atau selalu dihitung live dari BOM? | |
| Zevanic House | ~~Master Pelanggan — tipe (retail/reseller/grosir) beda limit piutang?~~ | ✅ **Dijawab implisit §5.14**: TIDAK — tipe murni informasional, limit tetap manual per pelanggan |
| Stok & Pembelian | Format cetak nota — thermal atau A4? | *(masih terbuka — §5.14 malam belum menjawab ini, cetak nota belum dibangun)* |
| Stok & Pembelian | Nota dari driver bisa diedit admin sebelum finalisasi? | *(masih terbuka — `order_driver_id` di Daftar Nota §5.14 baru shell `null`, belum ada alur driver sungguhan buat dites)* |
| Stok & Pembelian | Kartu Stok — perlu export Excel? | *(masih terbuka — sengaja dilewati saat rebuild §5.14, lihat `STATUS-PROYEK.md` §5.14 poin 6)* |
| Scan & Cetak | Wireframe Scan Opname & Scan Persiapan belum digambar | |
| Scan & Cetak | Format label produk (ukuran, isi, QR) | |
| Scan & Cetak | Scan Opname bisa partial (scan sebagian, simpan, lanjut besok)? | |
| Cutting | Tab OUTSOURCE — alur maju-mundur vendor belum diputuskan | |
| Cutting | Sablon sebagai tujuan — outsource atau sub-menu sendiri? (diparkir) | |
| Serie | Sablon — diparkir (sama seperti Cutting) | |
| Serie | Batch separating bisa dibatalkan setelah digenerate? | |

---

## 8. Referensi

- 20 berkas `Mockup/handoff/` (dibaca penuh 5 Sep 2026, **DIBACA ULANG
  PENUH 7 Sep 2026** langsung dari device Guru — semua 8 sub-menu
  Persiapan Produksi + 5 sub-menu Proses Produksi + Pesanan/Zevanic
  House/Stok & Pembelian/Scan & Cetak. Hasil: isi §7 dikonfirmasi
  LENGKAP/tidak ada poin baru yang terlewat, TAPI ditemukan detail baru
  yang tidak tertangkap sesi 5 Sep — lihat §9.3 & §9.4 (gap "Scan &
  Cetak" untuk semua 5 pos Proses Produksi, tabrakan nama `bagging` vs
  `bagging_acc`) dan §5.4/§5.7 di `STATUS-PROYEK.md` (gap kode nyata di
  Bahan/Acc: PIN belum diverifikasi, roll sisa Acc Webbing belum
  diimplementasi, alur vendor sablon Acc Finishing belum diimplementasi
  walau sudah diputuskan). **7 Sep 2026 malam lagi**: folder handoff
  `01 - Pesanan dan Transaksi` (SERAH-TERIMA.md, PEDOMAN-SERAH-TERIMA.md,
  SPESIFIKASI-KOLEKSI-BARU.md, wireframe.dc.html) dibaca ulang penuh
  untuk `/design-terapkan-handoff` §5.15. **7 Sep 2026 malam lanjut
  lagi**: folder handoff "Persiapan Produksi - Masalah" dibaca ulang
  penuh (SERAH-TERIMA.md + PEDOMAN-SERAH-TERIMA.md universal) untuk
  `/design-terapkan-handoff` §5.18
- `PETA-DATABASE.md`, `PETA-MENU.md`, `PEDOMAN-GAYA-KERJA.md` (dibaca
  penuh sesi ini)
- Verifikasi kode live: `git clone gechooco-ship-it/zevanic-erp-ui`,
  **diperbarui 7 Sep 2026** ke commit `92083d5` ("test") — sebelumnya
  commit 2 Sep ("uppp") sudah ketinggalan 2 commit
- `STATUS-PROYEK.md` §5.9 (Pipeline Produksi placeholder), §5.10-§5.18
  (histori rebuild Persiapan Produksi V2, Master Suplayer, Prefix Kode
  SPK, Master Pelanggan, Zevanic House 4 gap wireframe, Stok dan
  Pembelian, Pesanan dan Transaksi, fondasi Scan & Cetak, retrofit 4 pos
  Persiapan Produksi, rebuild Masalah) — **§5.18 di `STATUS-PROYEK.md`
  sekarang berisi Persiapan Produksi > Masalah** (rebuild 7 Sep 2026
  malam lanjut lagi), retrofit Scan Generik ada di §5.17, Stok dan
  Pembelian ada di §5.14, Zevanic House 4 gap di §5.13, Master Pelanggan
  di §5.12 (penomoran §5.x bergeser seiring sesi berjalan, selalu cek
  nomor section aktual di `STATUS-PROYEK.md`, jangan asumsikan dari
  dokumen ini)

**Status dokumen ini**: langkah 1-4 di §6 sudah berjalan (rincian per
langkah ada di `STATUS-PROYEK.md` §5.12-§5.13), plus 2 pekerjaan
tambahan di luar urutan numerik (7b Zevanic House, 7c Stok dan
Pembelian) sudah SELESAI DITULIS 7 Sep 2026 — rules `master_pelanggan`
sudah dipublish 7 Sep 2026. Langkah 15 (Pesanan piutang) JUGA sudah
SELESAI DITULIS, LONCAT dari urutan atas permintaan Guru — rules
`piutang_pembayaran` BELUM dipublish (blocker). Langkah 5 (fondasi +
retrofit 4 pos Bahan/Acc) SELESAI. **DITAMBAH (7 Sep 2026 malam lanjut
lagi)**: langkah **6 (Masalah, rebuild total 7 tahap) SEKARANG JUGA
SELESAI DITULIS** — `js/vue-pp-masalah.js` baru, retrofit Scan Masalah
di 4 pos SENGAJA ditunda ke sesi lain (keputusan cakupan Guru). Langkah
7-14 dan 16 BELUM dimulai — menunggu Guru push+uji kode Master
Pelanggan/Suplayer (langkah 4) DAN Zevanic House (7b) DAN Stok dan
Pembelian (7c) DAN Pesanan (15) DAN Masalah (6) sebelum langkah 7 dan
seterusnya dimulai, sesuai urutan yang disarankan di sini. Rules
`piutang_pembayaran` DAN `permintaan_bahan_manual` KEDUANYA masih
menunggu Publish Guru — 2 blocker keras aktif bersamaan.

---

## 9. Build item baru dari diskusi §7 (7 Sep 2026) — BELUM didesain, baru arah keputusan

Dua keputusan di §7 membuka kebutuhan build yang belum ada di rencana
manapun sebelumnya. Dicatat di sini supaya tidak hilang, TAPI belum masuk
antrean kerja konkret (langkah 14-15 di §6) — nunggu giliran sesuai urutan
prioritas Guru.

### 9.1 Config ambang "tertahan" per pos/shift
Sekarang: 1 konstanta tetap `AMBANG_TERTAHAN_JAM = 6` di
`js/vue-persiapan-bahan.js` (dan turunannya di Sewing/Webbing/Finishing),
sama untuk semua pos & shift. Guru minta ini jadi **menu config** — ambang
beda-beda per pos (dan kemungkinan per shift), dipakai untuk hitung KPI
"tertahan" di semua pos. **Belum didesain**: skema Firestore-nya (koleksi
baru atau field di `pengaturan_sistem`?), UI config-nya, dan apakah field
existing yang baca `AMBANG_TERTAHAN_JAM` (hardcode) di 4 file
(`vue-persiapan-bahan.js`/`-sewing.js`/`-webbing.js`/`-finishing.js`) perlu
diubah SEMUA sekaligus atau bertahap.

### 9.2 Zevanic House — gap ditemukan dari wireframe penuh (7 Sep 2026)
Audit baru (baca `wireframe.dc.html` "06 - Zevanic House" secara utuh,
bukan cuma `SERAH-TERIMA.md`-nya) menemukan gap yang BELUM tercatat
sebelumnya, di luar Master Suplayer/Master Pelanggan yang sudah SELESAI:

- **Master Bahan & Aksesoris — List (1.2.1/1.2.2)**: wireframe minta
  tabel grid 7 kolom + filter tab (Semua/Bahan/Aksesoris/Perlu
  dilengkapi) + baris bisa dibuka menampilkan roll/lot aktif + 3 harga
  terakhir + tombol "Lihat Kartu Stok". Kode live sekarang pakai **kartu**
  (diputuskan sengaja 28 Agt 2026, §39 arsip) — TIDAK ada baris buka/
  tutup, TIDAK ada tampilan roll/lot atau 3 harga terakhir sama sekali.
  **Perlu keputusan Guru**: wireframe ini dibuat SETELAH redesain kartu
  28 Agt — apakah memang mau balik ke grid+expand (ikuti wireframe,
  sesuai prinsip skill "wireframe menang"), atau redesain kartu tetap
  dipakai dan wireframe di bagian ini dianggap belum sinkron?
- **Margin harga jual**: wireframe minta `margin_modal` dalam **persen**
  (harga_pemakaian = modal + margin%). Kode live pakai **Rupiah tetap**
  (modal + margin Rp). Ini BUKAN kosmetik — ganti ke persen berarti
  migrasi data untuk item yang sudah py margin Rp tersimpan.
- **HPP per produk (2.3)**: wireframe minta dihitung OTOMATIS dari BOM +
  field manual biaya tambahan. **BELUM ADA SAMA SEKALI** di kode (0 hasil
  grep "hpp" di seluruh `js/`) — greenfield total, terkait §7 "HPP
  di-cache atau live" yang juga masih belum diputuskan.
- **Riwayat PIN (Config 4.1)**: disebut di teks SERAH-TERIMA tapi TIDAK
  ADA wireframe layarnya sama sekali (juga nomor grup di SERAH-TERIMA
  vs wireframe.dc.html tidak sinkron — SERAH-TERIMA bilang grup 4 =
  Config, wireframe bilang grup 4 = Pelanggan). Belum ada kode ataupun
  desain — perlu digambar/didesain dulu, bukan tinggal diimplementasi.

**SEMUA 4 gap di atas SUDAH DIPUTUSKAN Guru (AskUserQuestion, 7 Sep
2026) DAN SUDAH DIIMPLEMENTASI (kode ditulis, `node --check` lolos,
dikirim ke `Code\` device) — detail lengkap per fitur ada di
`STATUS-PROYEK.md` §5.13, JANGAN diulang di sini. Ringkasan keputusan:
1. List Bahan → **"Ikuti wireframe (grid+expand)"** (bukan pertahankan
   kartu). 2. Margin → **"Ganti ke persen"** (bukan pertahankan Rupiah,
   migrasi data lama JADI tanggung jawab manual Guru). 3. HPP →
   **"Dihitung live (Recommended)"** (bukan di-cache — cuma biaya
   tambahan manual yang ditulis ke Firestore). 4. Riwayat PIN →
   **"Bikin sekarang, tapi kosong dulu"** (di Config, sesuai teks
   SERAH-TERIMA — BUKAN di Scan & Cetak walau itu tempat yang lebih
   masuk akal secara arsitektur generik PIN §9.3, karena infrastruktur
   generik itu belum dibangun). **BELUM ADA testing browser SAMA
   SEKALI** untuk ke-4 nya — jangan anggap SELESAI sebelum Guru
   konfirmasi jalan di browser, dan Riwayat PIN butuh rule Firestore
   `riwayat_pin` di-publish dulu (belum ada di
   `FIRESTORE-RULES-SNAPSHOT.md`) sebelum bisa dites sama sekali.

### 9.3 Modul Scan generik (Operator/Entry/Masalah/Pack/Kirim/Sampai) — BARU 7 Sep 2026
Temuan dari cek langsung `Mockup/handoff/Scan dan Cetak/wireframe.dc.html`
(rule 2.1-2.6, grup "Scan Persiapan Produksi"): 6 jenis scan (Operator,
Entry, Masalah, Pack, Kirim, **Sampai**) dirancang sebagai **1 komponen
generik + parameter pos** — "satu fitur, satu file", dipanggil di semua
pos, TIDAK dibuat ulang tiap pos. Dikonfirmasi silang: **Scan Sampai
dipakai di SEMUA 9 pos** (4 Persiapan Produksi: Bahan/Acc Sewing/Acc
Webbing/Acc Finishing/Masalah, + 5 Proses Produksi: Cutting 1.1, Serie
2.1/2.6/2.9, Sewing 3.1, Finishing 4.1, Gudang 5.1) — bukan cuma dipakai
Cutting seperti asumsi awal di dokumen ini (lihat versi lama §0 poin 2,
sekarang diperbarui).

**Gap penting**: detail teknis versi Proses Produksi (dirujuk Cutting
sebagai "Scan & Cetak 2.7–2.13", dirujuk Serie sebagai "2.14–2.20")
**TIDAK PERNAH DIGAMBAR** di canvas aslinya — file `wireframe.dc.html`
berhenti di 2.6, langsung lompat ke grup 3 (Cetak). Jadi referensi itu
"menggantung" — prinsipnya ada, speknya belum.

**Keputusan Guru (7 Sep 2026)**: bangun modul ini **mencakup SEMUA 6
jenis scan sekaligus**, bukan cuma Scan Sampai — termasuk **retrofit
Bahan/Acc Sewing/Acc Webbing/Acc Finishing/Masalah yang SUDAH LIVE**
supaya semuanya ikut pakai 1 komponen generik yang sama (bukan kode
scan yang saat ini kemungkinan terpisah/duplikat per modul). Ini
dikerjakan SEBAGAI PRIORITAS TERPISAH (langkah 5 baru di §6), SEBELUM
Cutting mulai — jadi begitu Cutting (dan Serie/Sewing/Finishing/Gudang
setelahnya) dibangun, tinggal PANGGIL komponen ini dengan parameter pos,
bukan bikin scan sendiri-sendiri lagi.

**Catatan 7 Sep 2026 malam**: `vue-scan-persiapan.js` (file yang sudah
ada, dipakai untuk kasus SPK-linked sederhana di Persiapan Produksi)
BUKAN modul Scan generik yang dimaksud di atas — ini file spesifik yang
justru DIPERLUAS lebih lanjut (§5.14) untuk menyerap 2 fungsi dari Kartu
Stok lama (FIFO multi-roll, alur kekurangan). Modul Scan generik §9.3 ini
sendiri masih belum mulai dikerjakan — jangan tertukar antara "Scan
Persiapan" (file spesifik, sudah ada & baru diperluas) dengan "modul Scan
generik" (rencana besar 6-jenis-scan yang masih di langkah 5, belum
mulai).

**UPDATE (7 Sep 2026 malam lanjut, §5.17)**: retrofit ke 4 modul Persiapan
Produksi (Bahan/Acc Sewing/Webbing/Finishing) **SUDAH SELESAI** — komponen
`ScanGenerik` ditulis ulang interface-nya (props `aktif`/`judul`/
`subjudul`, emit `hasil`/`tutup`, perilaku "scan berkali-kali" identik)
supaya jadi drop-in replacement untuk `ModalScanQr` yang dulu disalin 4x,
lalu ke-4 file diganti memakainya. **Data yang sudah berjalan TIDAK
terganggu** — ini murni ganti komponen kamera, 0 field Firestore baru, 0
perubahan validasi, jadi tidak ada risiko migrasi data. Retrofit ke
`persiapan_masalah` BELUM relevan (modul itu tidak pernah pakai
`ModalScanQr`) — akan dikerjakan sekalian saat Masalah di-REBUILD
(langkah 6 §6). Nama file & lokasi komponen generik SUDAH ditentukan
(`js/vue-scan-cetak.js`, bukan file terpisah baru) — yang MASIH belum
didesain hanya bentuk API untuk 5 modul Proses Produksi (Cutting dst)
nanti: parameter (`pos`, `tahap`, callback per jenis scan) belum
dibutuhkan konkret sampai Cutting mulai dikerjakan (langkah 10 §6).

**UPDATE LAGI (7 Sep 2026 malam lanjut lagi, §5.18)**: Masalah **REBUILD
TOTAL SELESAI DITULIS** (`js/vue-pp-masalah.js`) — TAPI retrofit "Scan
Masalah supaya benar-benar membuat dokumen `persiapan_masalah`" di 4 pos
Bahan/Acc Sewing/Webbing/Finishing **SENGAJA BELUM dikerjakan**, sesuai
keputusan cakupan eksplisit Guru ("Modul Masalah dulu, retrofit
menyusul"). Sampai retrofit itu ada, ke-4 pos itu masih cuma catat
`catatan_masalah` teks bebas (perilaku LAMA, tidak berubah), dan modul
Masalah baru akan tampil KOSONG di semua 7 tabnya. Ini PR terpisah yang
masih menunggu giliran — BUKAN bagian dari cakupan §5.18.

**Belum didesain (sisa)**: bentuk API parameter untuk Proses Produksi
(`pos`, `tahap`, callback per jenis scan) — belum dibutuhkan konkret
sampai Cutting mulai. Field-level behavior per pos
untuk Scan Sampai spesifik SUDAH ada per divisi di SERAH-TERIMA
masing-masing — dikonfirmasi LENGKAP (7 Sep 2026, ke-20 berkas handoff
sudah dibaca semua, bukan cuma sebagian):
- Cutting 1.1: menulis `sampai_pada` ke `spk_track.bahan_rincian[]`.
- Serie: 3 titik (2.1 dari Cutting, 2.6 dari Sewing, 2.9 dari Finishing)
  — SEMUA menulis DB di sisi Serie.
- Sewing 3.1 (dari Serie): Sewing yang menulis DB, Serie 2.5 read-only.
- Finishing 4.1 (dari Serie): menulis DB.
- Gudang Barang Jadi 5.1: scan sampai DIIKUTI langkah terpisah "scan
  masuk gudang" per pcs (bukan 1 scan gabungan) — trigger alokasi FIFO
  PO bersamaan. Kalau pcs yang discan sudah teralokasi ke pelanggan
  lain, kasir dapat peringatan KUNING, TIDAK memblokir penjualan.

**Gap tambahan ditemukan (7 Sep 2026)**: rujukan "Scan & Cetak" untuk
SEMUA 5 pos Proses Produksi ternyata TIDAK ADA satupun yang digambar —
Serie rujuk "2.14–2.20", Sewing "2.21–2.26 + 3.8", Finishing "2.27–2.32",
Gudang "2.33–2.36 + 3.8" — semuanya menggantung sama seperti Cutting
"2.7–2.13". Rule **3.8** dirujuk BERSAMA oleh Sewing dan Gudang — indikasi
ada 1 sub-komponen scan `label_pcs` yang juga dimaksudkan generik/dipakai
bersama (bukan cuma 6 jenis scan Persiapan Produksi) — pertimbangkan
masuk cakupan modul ini juga, TAPI karena Sewing/Gudang giliran
kerjanya masih jauh (langkah 12/14 di §6), tidak perlu didesain detail
sekarang — cukup dicatat supaya tidak diulang tebak nanti.

### 9.4 Menu "Kemasan Komponen Acc" (GANTI NAMA dari "Bagging Acc", Stok & Pembelian)
**Nama diganti 7 Sep 2026** — nama kerja lama "Bagging Acc" tabrakan
istilah dengan koleksi `bagging` yang SUDAH ADA di kode live (artinya
BEDA TOTAL: `bagging` sekarang adalah kode paket KIRIM hasil produksi
antar-TLC, `kode` format `BAGyymmdd-NNN`, field
`produk/size/isi[]/ditutup_pada`, dibuat saat Scan Pack di tab Perlu Di
Kirim). Ide di bawah ini soal PENGEMASAN komponen kecil SEBELUM
produksi — konsep berbeda total, cuma kebetulan dulu dinamai mirip.
Koleksi barunya jadi `kemasan_komponen_acc` (BUKAN `bagging_acc`).

Latar: komponen kecil Acc Sewing (D-ring, cord lock, dst) sekarang harus
dihitung satu-satu di lini produksi kalau mengikuti pola Bahan biasa. Guru
usul: komponen kecil ini **dikemas lebih dulu** per jumlah tetap (mis. 25
atau 24 pcs per kantong) SEBELUM dipakai produksi, dicatat sebagai kode
tersendiri (koleksi baru `kemasan_komponen_acc`) di menu baru "Kemasan
Komponen Acc" — kemungkinan di Stok & Pembelian (dekat Scan & Cetak)
supaya bisa disiapkan di muka, sebelum SPK Grouping jalur Acc Sewing/
Webbing/Finishing dibuat. **Belum didesain**: field skema
`kemasan_komponen_acc`, siapa yang membuat kodenya (admin gudang?
operator?), bagaimana Acc Sewing "menarik" dari stok kemasan ini saat
entry (scan kode vs pilih dari daftar), dan apakah jumlah per kantong
(25/24) itu tetap per jenis komponen atau bisa diatur bebas tiap kali
bikin kode baru.
