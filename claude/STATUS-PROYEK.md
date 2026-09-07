# STATUS PROYEK — Zevanic/Gechoo ERP

> **WAJIB dibaca tiap sesi.** Isinya cuma keadaan SEKARANG.
> Batas **150 baris**. Mentok = dilarang menulis ke sini sampai isinya
> dipindah dulu. Jalankan `bash cek-dokumen.sh` sebelum push.

**Dokumen lain (baca saat perlu saja, jangan dibuka semua tiap sesi):**

| File | Isinya | Kapan dibaca |
|---|---|---|
| `PELAJARAN.md` | kelas bug yang pernah terjadi | **sebelum menulis kode** |
| `CHECKLIST-TEST.md` | yang wajib dites & data yang perlu dirapikan | saat mau lapor/test |
| `FONDASI.md` | stack, cara deploy, batas sandbox | saat kirim file / ragu cara kerja |
| `arsip-YYYY-MM.md` | alasan tiap keputusan | saat butuh tahu KENAPA |

## ATURAN MENULIS FILE INI (dan semua dokumen di atas)

- **1 modul = 1 baris tabel.** Catatan maks ~120 karakter. Tidak muat =
  itu narasi → arsip bulanan.
- **Modul beres total → barisnya DIHAPUS**, bukan ditandai selesai.
  File ini menyusut saat kerja selesai. Itu yang menjaga ukurannya.
- **Narasi/alasan/keputusan** → `arsip-YYYY-MM.md`, append di bawah,
  maks 40 baris per fitur, 4 bagian tetap.
- **Maks 300 baris dokumentasi per sesi.** Lebih → berhenti, tanya Guru.
- Tulis **1x per pekerjaan SELESAI**, bukan tiap file kode berubah.
- **Dilarang**: coretan, mengulang fakta yang sama di 2 tempat, paragraf
  riwayat "dulu X sekarang Y".
- **Tiap akhir sesi WAJIB**: hitung baris tiap dokumen (stage file dari
  `Code\Claude\` lalu `wc -l` — jangan dibaca isinya, tidak perlu) dan
  laporkan sisa jatahnya ke Guru. Dokumen TIDAK ada di repo, jadi tidak
  ada pemeriksa otomatis — ini satu-satunya yang menjaga batasnya.

## Giliran berikutnya

Semua modul yang ditugaskan (Finishing, Gudang Barang Jadi, Vendor,
Persiapan Belanja, 4 gap Bahan/Acc, Repack) sudah **selesai kode** —
diverifikasi ke git live (`git clone`), bukan tebakan dokumen. Giliran
Guru: publish rules baru ke Firebase Console + `git push`
`js/vue-repack-komponen-acc.js` (satu-satunya file sesi ini yang belum
ada di git per cek 7 Sep), lalu test browser. Belum ada modul baru
ditugaskan sesudah ini.

## Status modul (hanya yang belum beres)

| Modul | Kode | Rules | Test browser | Catatan |
|---|---|---|---|---|
| Finishing (Proses Produksi) | selesai | cek Console | belum | live di git per cek 7 Sep, sebelumnya salah tercatat "belum dibangun" |
| Gudang Barang Jadi | selesai | cek Console | belum | live di git per cek 7 Sep, sebelumnya salah tercatat "belum dibangun" |
| Sewing | selesai | **belum publish (3 koleksi)** | belum | `sewing_track`, `label_pcs`, `pengaturan_id_label_pcs` |
| Serie | selesai | published | sebagian | retest 4 titik cetak label setelah fix `:terbuka` live |
| Pesanan / piutang | selesai | published | **belum** | modul UANG |
| Stok & Pembelian | selesai | published | **belum** | modul UANG + STOK |
| Masalah + retrofit Scan Masalah | selesai | cek ulang | belum | pastikan `permintaan_bahan_manual` published |
| Zevanic House 4 gap | selesai | published | belum | list grid, margin persen, HPP, riwayat PIN |
| Refactor 4 pos → ScanGenerik | selesai | — | belum | murni refactor: beda perilaku = regresi |
| Beranda Desktop | live | — | sebagian | lonceng & angka KPI belum dikonfirmasi |
| Vendor | selesai | — | belum | reuse jalur generik `'vendor'` (v2), tanpa file baru |
| Persiapan Belanja | selesai | belum dikonfirmasi | belum | koleksi baru `order_belanja_driver`/`pending_driver` |
| 4 gap Bahan/Acc (Sewing/Webbing/Finishing) | selesai | belum dikonfirmasi | belum | PIN kriptografis, gerbang batch per-SPK, roll sisa, vendor sablon |
| Repack Komponen Acc | selesai | belum dikonfirmasi | belum | BARU, belum di-`git push` per cek 7 Sep |

## Blocker aktif

1. **Rules Sewing belum dipublish** — Sewing tidak bisa dites sama
   sekali sampai 3 koleksi itu ada di Firebase Console.
2. **Retest 4 titik cetak label Serie** — bug prop `:terbuka` baru
   diperbaiki, kode belum tentu sudah live.
3. **Rule `permintaan_bahan_manual`** — dokumen lama saling
   bertentangan soal sudah/belum publish. Cek langsung ke Console.
4. **6 koleksi baru sesi 7 Sep belum dikonfirmasi published** —
   `order_belanja_driver`, `pending_driver`,
   `pengaturan_id_order_belanja_driver`, `roll_sisa_webbing`,
   `pengaturan_id_roll_sisa`, `repack_komponen_acc`.
