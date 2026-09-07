# CHECKLIST TEST & PERBAIKAN DATA

> Dibaca saat mau melaporkan pekerjaan atau menyiapkan testing.
> **Isinya mati saat selesai**: begitu Guru konfirmasi sudah dites,
> barisnya **DIHAPUS**, bukan dicoret atau ditandai selesai.
> Batas 100 baris. Kalau melewati batas, artinya terlalu banyak pekerjaan
> menggantung belum dites — itu sinyal proyek, bukan sinyal dokumen.

## Wajib ditest Guru (browser / Firestore sungguhan)

**Sewing** — terblokir sampai 3 rule dipublish
- `sewing_track` ter-generate lazy dari `separating_batch` status `kirim_sewing`
- Scan Sampai/Unpack mencocokkan ke `separating_batch` dengan benar
- Tunjuk Operator ke-gate role + PIN + prasyarat `terima_pada`
- KPI per-operator (selesai hari ini + rata-rata jam) angkanya benar
- Cetak Label Pcs/Bagging/Tugas jumlahnya benar & **tidak dobel** saat Cetak Ulang
- Scan Kirim langsung pindah status begitu 1 bagging cocok

**Serie** — retest setelah fix `:terbuka` live
- 4 titik cetak label benar-benar membuka pratinjau: Cetak Batch Separating,
  Cetak ID Komponen, Cetak Kode Bagging, Cetak Kode Tugas (3 tujuan)

**Pesanan / piutang** — modul UANG
- Checkout Lunas/DP/Tempo menulis field baru di `transaksi_kasir` + `order_spk`
- Checkout **benar-benar diblokir** saat `saldo_piutang + sisa > limit_piutang`
- Proses massal QO hanya mengubah `qty_order`, **tidak menyentuh** `status_grouping`
- Catat pembayaran susulan mengurangi `saldo_piutang` dengan benar
- PopupPin selalu muncul, termasuk untuk Owner yang sudah login

**Stok & Pembelian** — modul UANG + STOK
- Minimal Owner + 1 user tier lain sudah punya `pin_hash` (kalau belum, PIN
  tidak bisa dipakai sama sekali di modul ini)
- Alur nota draft → final: kartu stok, lot, harga master ter-update benar
- Kenaikan harga memblokir checkout Pesanan, dan "Terapkan" membuka blokirnya
- FIFO multi-roll di Scan Persiapan dengan kasus nyata >1 lot aktif

**Masalah + retrofit Scan Masalah**
- Popup jumlah kurang tervalidasi (tidak bisa submit 0/kosong)
- Dokumen `persiapan_masalah` muncul dengan field benar
- Kartu bahan muncul di tab Perlu Diajukan dengan angka kumulatif benar
- Badge merah `catatan_masalah` di pos asal tidak berubah perilaku (regresi)

**Zevanic House 4 gap**
- Data `margin_modal` lama tidak terbaca salah sebagai persen
- Nota Order Belanja final tidak menimpa `harga_pemakaian` dengan angka salah
- HPP benar untuk produk ber-BOM kompleks

**Refactor 4 pos → ScanGenerik** — regresi, bukan fitur baru
- Tunjuk Operator: kamera tetap menyala antar-scan seperti sebelumnya
- Scan Entry mengurangi stok dengan benar
- Scan Pack & Scan Kirim bisa berkali-kali tanpa buka-tutup kamera manual

## Perbaikan data yang harus Guru kerjakan manual

Tidak ada migrasi otomatis — sandbox tidak punya akses Firestore live.

- `margin_modal` lama bernilai Rupiah akan terbaca **salah sebagai persen**.
  Cek data sebelum 7 Sep 2026.
- Dokumen rak lama belum punya field `rak` — masih tampil lewat fallback
  `rak_label`. Jangan dikira hilang kalau tampil kosong.
- TLC `TLC-PTG` `TLC-SER` `TLC-JHT` `TLC-FIN` `TLC-GBJ` **wajib ditambah
  manual** di Zevanic House > TLC & Prefix sebelum cetak kode tugas dipakai.
