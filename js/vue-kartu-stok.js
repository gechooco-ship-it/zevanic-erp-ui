// js/vue-kartu-stok.js
// ============================================================================
// BARU (malam 24 Agt 2026) — Zevanic House > Stock & Pembelian > Kartu Stok.
// Menu BARU (permintaan Guru): melacak JUMLAH stok (bukan cuma harga, beda
// dari Riwayat Harga Pembelian) per bahan/aksesoris — sisi MASUK (pembelian,
// otomatis dari Nota Order Belanja di-final-kan — lihat hook di
// js/vue-stock-pembelian.js `catatPergerakanKartuStok()`, DIPAKAI ULANG di
// sini, BUKAN didesain ulang) dan sisi KELUAR (pemakaian, form manual di
// halaman ini — BELUM ada modul produksi/konsumsi bahan otomatis).
//
// 2 tampilan (permintaan Guru persis):
// - KARTU STOK RINGKASAN — tabel semua item + stok_akhir masing-masing
//   (paginasi cursor-based, PRINSIP-HEMAT.md), klik 1 baris -> buka Detail.
// - KARTU STOK DETAIL — 1 item: saldo saat ini + riwayat pergerakan
//   (masuk/keluar, saldo berjalan tiap baris) + form "Catat Pemakaian".
//
// `stok_akhir` di `master_bahan_aksesoris` (field BARU, lihat
// PETA-DATABASE.md) JUGA ditampilkan sebagai kolom baru di List Bahan &
// Aksesoris (vue-bahan-aksesoris.js) — SUMBER KEBENARAN TUNGGAL ada di
// field itu, dihitung SELALU lewat catatPergerakanKartuStok() (runTransaction,
// atomik) — JANGAN PERNAH update stok_akhir langsung dari tempat lain.
//
// UPDATE (25 Agt 2026, §25.3) — FIFO Roll/Lot OTOMATIS. Untuk item yang
// ditandai `pakai_lot_tracking`, "Catat Pemakaian" motong dari roll/lot
// TERLAMA dulu OTOMATIS. Kalau data lot BELUM ADA sama sekali -> BLOKIR.
// Kalau lot ADA tapi KURANG dari yang diminta -> popup 3 opsi keputusan
// (kurangi jumlah / proses sebagian + sisanya masuk Persiapan Masalah /
// tunggu dulu) — semua lewat koleksi `persiapan_masalah` yang SUDAH ADA
// apa adanya. (Lihat STATUS-PROYEK.md §25.3 untuk detail versi ini.)
//
// UPDATE (25 Agt 2026, Tahap 2 — GANTI pendekatan §25.3) — arahan Guru
// (persis): "per lot punya id bahan/aksesoris masing2 jadi nanti saat
// ngambil karyawan cari kode yg sama (atau saat pengambilan scan qr id
// bahan yg mau dipakai lalu ambil yg mau dipakainya)". FIFO OTOMATIS DIGANTI
// jadi FIFO SEBAGAI SARAN DEFAULT — karyawan isi Jumlah pemakaian seperti
// biasa, sistem otomatis SARAN-kan roll/lot TERTUA dulu (FIFO) di sebuah
// tabel "Pilih Roll/Lot yang Dipakai", TAPI karyawan BOLEH ganti/tambah
// roll lain lewat cari kode (ketik) atau tombol "Scan Roll" (kamera, baca
// QR label fisik roll — dicetak di OrderBelanjaScreen begitu Nota
// di-final-kan, lihat vue-stock-pembelian.js `cetakLabelLot()`). Kalau
// pilihan akhir BUKAN roll tertua -> muncul konfirmasi PERINGATAN dulu
// (keputusan Guru: "Beri peringatan dulu", BUKAN diblokir). Ada juga tombol
// "Scan Barang" di layar Ringkasan — scan QR roll (atau kode bahan) buat
// LANGSUNG buka Kartu Stok Detail item itu (jalan pintas, keputusan Guru:
// "Cuma buka form Catat Pemakaian lebih cepat" — TIDAK ada perubahan logic
// stok, berlaku SAMA untuk item lot maupun BUKAN lot).
// Kamera/QR pakai `jsQR` (CDN), pola SAMA PERSIS seperti `js/vue-scan-qr.js`
// yang sudah ada — disalin ulang ke sini (konsisten pola "salin logic kecil
// per-file" proyek ini). Lihat STATUS-PROYEK.md untuk detail lengkap.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=2';
import { usePaginasiFirestore } from './vue-paginasi.js';
import { catatPergerakanKartuStok, catatPemakaianDariAlokasi, ambilLotAktif, cariLotByKode, cariBahanByIdTampil, ambilBahanById } from './vue-stock-pembelian.js';
import { pakaiRiwayatTabVue } from './vue-riwayat-tab.js?v=1';

function formatRupiah(n) {
  const angka = Math.round(parseFloat(n) || 0);
  return 'Rp ' + angka.toLocaleString('id-ID');
}
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

const KartuStokManager = {
  components: { DropdownCari },
  setup() {
    const tampilan = ref('ringkasan'); // 'ringkasan' | 'detail'
    // BARU (§39) — saklar Ringkasan/Detail ini adalah tab internal Vue
    // GENUINE (bukan navigasi antar menu), disambungkan ke riwayat tombol
    // back HP. CATATAN: `itemAktif` (item yang lagi dibuka di Detail) TIDAK
    // ikut disimpan/di-restore lewat composable ini (di luar cakupannya,
    // cuma nilai tab) — untuk navigasi back DALAM SATU sesi (komponen ini
    // tidak pernah di-unmount ulang, lihat pastikanMountKartuStok di bawah)
    // itemAktif tetap konsisten karena tidak pernah direset kecuali lewat
    // kembaliKeRingkasan(). Kasus reload penuh browser saat persis di tab
    // Detail: tampilan akan ke-restore 'detail' tapi itemAktif kosong (balik
    // ke null) -> halaman tampak kosong sampai user klik "Kembali ke
    // Ringkasan" lalu pilih ulang item; edge-case minor, bukan regresi dari
    // sebelumnya (sebelum ini pun reload SELALU balik ke Ringkasan).
    pakaiRiwayatTabVue('kartustok-tampilan', tampilan);
    const filterKategori = ref('ALL');

    const paginasiRingkasan = usePaginasiFirestore(db, 'master_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama',
      constraintTambahan: () => filterKategori.value === 'ALL' ? [] : [where('kategori_utama', '==', filterKategori.value)],
      petakan: (id, d) => ({ id, ...d })
    });

    // ---- Detail 1 item ----
    const itemAktif = ref(null); // seluruh dokumen master_bahan_aksesoris item yang dibuka
    const paginasiDetail = usePaginasiFirestore(db, 'kartu_stok_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'dibuat_pada',
      urutkanArah: 'desc',
      constraintTambahan: () => itemAktif.value ? [where('bahan_aksesoris_id', '==', itemAktif.value.id)] : [],
      petakan: (id, d) => ({ id, ...d })
    });

    // BARU (Tahap 2) — daftar lot AKTIF milik itemAktif, urut FIFO (tanggal_
    // masuk ASC). Dimuat ulang tiap kali Detail dibuka & tiap kali sesudah
    // pemakaian berhasil dicatat (qty_sisa berubah).
    const daftarLotAktif = ref([]);
    const memuatLot = ref(false);
    async function muatDaftarLot() {
      if (!itemAktif.value || !itemAktif.value.pakai_lot_tracking) { daftarLotAktif.value = []; return; }
      memuatLot.value = true;
      try {
        daftarLotAktif.value = await ambilLotAktif(itemAktif.value.id);
      } catch (e) {
        console.error('Gagal muat data roll/lot:', e);
        daftarLotAktif.value = [];
      }
      memuatLot.value = false;
    }

    function bukaDetail(item) {
      itemAktif.value = item;
      tampilan.value = 'detail';
      tampilAlokasi.value = false;
      alokasiPemakaian.value = [];
      kekuranganLot.value = null;
      carianKodeRoll.value = '';
      paginasiDetail.muatUlang();
      muatDaftarLot();
    }
    function kembaliKeRingkasan() {
      tampilan.value = 'ringkasan';
      itemAktif.value = null;
      daftarLotAktif.value = [];
      tampilAlokasi.value = false;
      alokasiPemakaian.value = [];
      paginasiRingkasan.muatUlang(); // stok_akhir mungkin berubah kalau tadi sempat catat pemakaian
    }

    // ---- Form "Catat Pemakaian" (sisi KELUAR, manual) ----
    const formPemakaian = reactive({ tanggal: new Date().toISOString().split('T')[0], qty: '', keterangan: '' });
    const menyimpanPemakaian = ref(false);
    // popup 3 opsi keputusan (§25.3, TIDAK berubah alurnya), muncul kalau
    // total qty_sisa semua lot aktif < qty yang diminta. null = tidak
    // tampil. Diisi { totalTersedia, qtyDiminta, kekurangan, tanggal, keterangan }.
    const kekuranganLot = ref(null);
    const memprosesKeputusan = ref(false);

    // BARU (Tahap 2) — tabel "Pilih Roll/Lot yang Dipakai" (default FIFO,
    // editable/scan-able). Baris: { lotId, kode_lot, tanggal_masuk, qty_sisa, ambil }.
    const tampilAlokasi = ref(false);
    const alokasiPemakaian = ref([]);
    const carianKodeRoll = ref('');

    function ringkasRincianLot(rincian) {
      return rincian.map(r => `Roll ${r.kode_lot || r.lot_id}: dipotong ${formatQty(r.dipotong)} (sisa ${formatQty(r.sisa_setelah)})`).join('\n');
    }

    // bangunAlokasiFifo — saran DEFAULT (roll tertua dulu), dihitung dari
    // daftarLotAktif (SUDAH urut FIFO). Dipakai (a) begitu tabel alokasi
    // dibuka pertama kali, (b) sebagai pembanding "menyimpang dari FIFO?"
    // sebelum simpan, (c) sebagai alokasi otomatis di 2 dari 3 opsi
    // keputusan kekuranganLot (di situ tidak ada pilihan lain selain pakai
    // semua yang tersedia).
    function bangunAlokasiFifo(qty) {
      let sisa = qty;
      const hasil = [];
      for (const l of daftarLotAktif.value) {
        if (sisa <= 0) break;
        const tersedia = parseFloat(l.qty_sisa) || 0;
        if (tersedia <= 0) continue;
        const ambil = Math.min(tersedia, sisa);
        hasil.push({ lotId: l.id, kode_lot: l.kode_lot, tanggal_masuk: l.tanggal_masuk, qty_sisa: tersedia, ambil });
        sisa -= ambil;
      }
      return hasil;
    }

    const totalAlokasi = computed(() => alokasiPemakaian.value.reduce((t, r) => t + (parseFloat(r.ambil) || 0), 0));
    const alokasiCocok = computed(() => Math.round((totalAlokasi.value - (parseFloat(formPemakaian.qty) || 0)) * 100) === 0);
    const sarananKodeRoll = computed(() => {
      const teks = carianKodeRoll.value.trim().toLowerCase();
      if (!teks) return [];
      return daftarLotAktif.value.filter(l => (l.kode_lot || '').toLowerCase().includes(teks)).slice(0, 8);
    });

    function tandaAlokasi(list) {
      return list.map(r => r.lotId + ':' + (Math.round((parseFloat(r.ambil) || 0) * 100) / 100)).sort().join('|');
    }
    function apakahMenyimpangFifo() {
      const qty = parseFloat(formPemakaian.qty) || 0;
      return tandaAlokasi(bangunAlokasiFifo(qty)) !== tandaAlokasi(alokasiPemakaian.value);
    }

    function tambahBarisAlokasi(lot) {
      const existing = alokasiPemakaian.value.find(r => r.lotId === lot.id);
      const target = parseFloat(formPemakaian.qty) || 0;
      const sisaDibutuhkan = Math.max(0, target - totalAlokasi.value);
      if (existing) {
        existing.ambil = Math.min(existing.qty_sisa, (parseFloat(existing.ambil) || 0) + (sisaDibutuhkan > 0 ? sisaDibutuhkan : 0));
      } else {
        const tersedia = parseFloat(lot.qty_sisa) || 0;
        const ambil = sisaDibutuhkan > 0 ? Math.min(tersedia, sisaDibutuhkan) : Math.min(tersedia, target);
        alokasiPemakaian.value.push({ lotId: lot.id, kode_lot: lot.kode_lot, tanggal_masuk: lot.tanggal_masuk, qty_sisa: tersedia, ambil });
      }
    }
    function hapusBarisAlokasi(i) { alokasiPemakaian.value.splice(i, 1); }
    function batalAlokasi() { tampilAlokasi.value = false; alokasiPemakaian.value = []; }

    // catatPemakaianBiasa — item BUKAN pakai_lot_tracking, perilaku LAMA,
    // TIDAK berubah sama sekali.
    async function catatPemakaianBiasa(qty) {
      const stokSaatIni = parseFloat(itemAktif.value.stok_akhir) || 0;
      if (qty > stokSaatIni) {
        if (!confirm(`Stok saat ini cuma ${formatQty(stokSaatIni)} ${itemAktif.value.satuan_pemakaian || ''}, tapi mau catat pemakaian ${formatQty(qty)}. Stok akan jadi MINUS. Lanjutkan?`)) return;
      }
      menyimpanPemakaian.value = true;
      try {
        await catatPergerakanKartuStok({
          bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: formPemakaian.tanggal,
          jenis: 'keluar', qty, satuan: itemAktif.value.satuan_pemakaian || '',
          sumber: 'Pemakaian Manual', noPembelian: '', keterangan: formPemakaian.keterangan || ''
        });
        // Refresh saldo yang ditampilkan di header Detail (baca ulang 1 dokumen,
        // bukan seluruh Ringkasan — hemat, cuma yang berubah).
        itemAktif.value.stok_akhir = itemAktif.value.stok_akhir
          ? (parseFloat(itemAktif.value.stok_akhir) || 0) - qty
          : -qty;
        formPemakaian.qty = ''; formPemakaian.keterangan = '';
        await paginasiDetail.muatUlang();
        alert('Pemakaian berhasil dicatat.');
      } catch (e) {
        console.error('Gagal catat pemakaian:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      menyimpanPemakaian.value = false;
    }

    // mulaiCatatPemakaian — GANTI (Tahap 2) dari catatPemakaian() versi
    // §25.3. Item BIASA -> langsung catatPemakaianBiasa() (tidak berubah).
    // Item pakai_lot_tracking -> cek dulu kosong/kurangnya data lot (lewat
    // daftarLotAktif yang SUDAH dimuat muatDaftarLot() saat Detail dibuka),
    // kalau cukup -> buka tabel alokasi (default FIFO, editable/scan-able)
    // alih-alih langsung menyimpan.
    async function mulaiCatatPemakaian() {
      if (!itemAktif.value) return;
      const qty = parseFloat(formPemakaian.qty);
      if (!(qty > 0)) return alert('Isi jumlah pemakaian dulu (lebih dari 0).');

      if (!itemAktif.value.pakai_lot_tracking) {
        await catatPemakaianBiasa(qty);
        return;
      }

      if (daftarLotAktif.value.length === 0) {
        alert('Item ini ditandai perlu Qty per Roll/Lot, TAPI belum ada data lot sama sekali untuk item ini. Pemakaian TIDAK BISA dicatat sampai ada data lot — isi dulu lewat popup "Qty per Roll/Lot" di Nota Order Belanja saat barang diterima.');
        return;
      }
      const totalTersedia = daftarLotAktif.value.reduce((t, l) => t + (parseFloat(l.qty_sisa) || 0), 0);
      if (totalTersedia < qty) {
        kekuranganLot.value = {
          totalTersedia, qtyDiminta: qty,
          kekurangan: Math.round((qty - totalTersedia) * 100) / 100,
          tanggal: formPemakaian.tanggal, keterangan: formPemakaian.keterangan
        };
        return;
      }
      alokasiPemakaian.value = bangunAlokasiFifo(qty);
      carianKodeRoll.value = '';
      tampilAlokasi.value = true;
    }

    // konfirmasiAlokasi — tombol "Konfirmasi & Simpan" di tabel alokasi.
    // Kalau pilihan akhir MENYIMPANG dari saran FIFO -> tampilkan konfirmasi
    // peringatan DULU (keputusan Guru: "Beri peringatan dulu kalau bukan
    // yang tertua" — bukan diblokir, cuma diminta konfirmasi sadar).
    async function konfirmasiAlokasi() {
      if (!alokasiCocok.value) {
        alert(`Total roll/lot yang diambil (${formatQty(totalAlokasi.value)}) belum sama dengan jumlah pemakaian (${formatQty(formPemakaian.qty)}). Sesuaikan dulu qty tiap baris atau tambah/hapus roll.`);
        return;
      }
      if (apakahMenyimpangFifo()) {
        if (!confirm('Roll/lot yang dipilih BUKAN yang tertua (FIFO). Roll lama sebaiknya dipakai duluan supaya tidak kadaluarsa/rusak lebih dulu. Lanjutkan pakai pilihan ini?')) return;
      }
      menyimpanPemakaian.value = true;
      try {
        const hasil = await catatPemakaianDariAlokasi({
          bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: formPemakaian.tanggal,
          qty: parseFloat(formPemakaian.qty), satuan: itemAktif.value.satuan_pemakaian || '',
          keterangan: formPemakaian.keterangan || '',
          alokasi: alokasiPemakaian.value.filter(r => (parseFloat(r.ambil) || 0) > 0).map(r => ({ lotId: r.lotId, qty: parseFloat(r.ambil) || 0 }))
        });
        itemAktif.value.stok_akhir = hasil.stokSetelah;
        formPemakaian.qty = ''; formPemakaian.keterangan = '';
        tampilAlokasi.value = false; alokasiPemakaian.value = [];
        await muatDaftarLot();
        await paginasiDetail.muatUlang();
        alert(`Pemakaian berhasil dicatat.\n\n${ringkasRincianLot(hasil.rincian)}`);
      } catch (e) {
        if (e.kode === 'LOT_BERUBAH') {
          alert(e.message + ' Data roll/lot dimuat ulang, coba susun lagi pilihannya.');
          await muatDaftarLot();
        } else {
          console.error('Gagal catat pemakaian (alokasi roll/lot):', e);
          alert('Gagal menyimpan. Coba lagi.');
        }
      }
      menyimpanPemakaian.value = false;
    }

    function tutupKeputusanKekurangan() { kekuranganLot.value = null; }

    // ajukanPersiapanMasalahKekurangan — dipakai OPSI B & C. Nulis 1 entri
    // BIASA ke `persiapan_masalah` (koleksi & skema yang SUDAH ADA, TIDAK
    // ada field baru) sejumlah `kekurangan` — otomatis masuk alur "perlu
    // dibeli" yang sudah berjalan (muncul di List/Nota Order Belanja).
    async function ajukanPersiapanMasalahKekurangan(k) {
      await addDoc(collection(db, 'persiapan_masalah'), {
        bahan_aksesoris_id: itemAktif.value.id,
        kategori_utama: itemAktif.value.kategori_utama || '',
        nama_bahan: itemAktif.value.nama,
        qty: k.kekurangan,
        satuan: itemAktif.value.satuan_pemakaian || '',
        keterangan: `Kekurangan stok roll/lot saat Catat Pemakaian tanggal ${k.tanggal} (tersedia ${formatQty(k.totalTersedia)}, diminta ${formatQty(k.qtyDiminta)})${k.keterangan ? ' — ' + k.keterangan : ''}`,
        status: 'menunggu',
        diminta_oleh: window.currentUser?.email || '-',
        dibuat_pada: serverTimestamp()
      });
    }

    // OPSI A — "Kurangi jumlah pemakaian": catat pemakaian SEJUMLAH yang
    // tersedia saja (pas dengan total qty_sisa lot aktif, dialokasikan FIFO
    // penuh — tidak ada pilihan lain karena memang cuma segini adanya),
    // tidak ada sisa, tidak ada entri Persiapan Masalah baru.
    async function kurangiKeYangTersedia() {
      if (!kekuranganLot.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        const alokasi = bangunAlokasiFifo(k.totalTersedia).map(r => ({ lotId: r.lotId, qty: r.ambil }));
        const hasil = await catatPemakaianDariAlokasi({
          bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: k.tanggal,
          qty: k.totalTersedia, satuan: itemAktif.value.satuan_pemakaian || '',
          keterangan: (k.keterangan || '') + ' (dikurangi otomatis ke qty yang tersedia — roll/lot tidak cukup)',
          alokasi
        });
        itemAktif.value.stok_akhir = hasil.stokSetelah;
        formPemakaian.qty = ''; formPemakaian.keterangan = '';
        kekuranganLot.value = null;
        await muatDaftarLot();
        await paginasiDetail.muatUlang();
        alert(`Pemakaian dicatat sejumlah ${formatQty(k.totalTersedia)} (dikurangi dari permintaan awal ${formatQty(k.qtyDiminta)} karena roll/lot tidak cukup).\n\n${ringkasRincianLot(hasil.rincian)}`);
      } catch (e) {
        console.error('Gagal proses "Kurangi jumlah pemakaian":', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // OPSI B — "Proses sebagian, order sisanya": catat pemakaian sejumlah
    // yang tersedia LEWAT FIFO PENUH SEKARANG, sisa kekurangan otomatis
    // masuk Persiapan Masalah.
    async function prosesSebagianDanAjukanSisa() {
      if (!kekuranganLot.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        let hasil = null;
        if (k.totalTersedia > 0) {
          const alokasi = bangunAlokasiFifo(k.totalTersedia).map(r => ({ lotId: r.lotId, qty: r.ambil }));
          hasil = await catatPemakaianDariAlokasi({
            bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: k.tanggal,
            qty: k.totalTersedia, satuan: itemAktif.value.satuan_pemakaian || '',
            keterangan: (k.keterangan || '') + ' (diproses sebagian, sisa diajukan ke Persiapan Masalah)',
            alokasi
          });
          itemAktif.value.stok_akhir = hasil.stokSetelah;
        }
        await ajukanPersiapanMasalahKekurangan(k);
        formPemakaian.qty = ''; formPemakaian.keterangan = '';
        kekuranganLot.value = null;
        await muatDaftarLot();
        await paginasiDetail.muatUlang();
        alert(`${formatQty(k.totalTersedia)} sudah dicatat sebagai pemakaian. Sisa kekurangan (${formatQty(k.kekurangan)}) otomatis masuk antrean di menu Persiapan Masalah.`);
      } catch (e) {
        console.error('Gagal proses "Proses sebagian, order sisanya":', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // OPSI C — "Tunggu dulu": TIDAK ada yang dicatat/dipotong sama sekali
    // sekarang, cuma kekurangan yang masuk Persiapan Masalah — admin/PIC
    // coba lagi "Catat Pemakaian" (qty penuh) nanti setelah stok cukup.
    async function tundaDanAjukanKekurangan() {
      if (!kekuranganLot.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        await ajukanPersiapanMasalahKekurangan(k);
        kekuranganLot.value = null;
        alert(`Belum ada yang dicatat. Kekurangan (${formatQty(k.kekurangan)}) otomatis masuk antrean di menu Persiapan Masalah — coba "Catat Pemakaian" lagi (qty ${formatQty(k.qtyDiminta)}) setelah stok cukup.`);
      } catch (e) {
        console.error('Gagal proses "Tunggu dulu":', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // ---- Scan QR (kamera) — BARU (Tahap 2). Pola SAMA PERSIS seperti
    // js/vue-scan-qr.js (disalin ulang, bukan diimpor lintas file — pola
    // yang sudah dipakai di proyek ini). 2 titik pemakaian, dibedakan lewat
    // `modeScan`: 'barang' (tombol "Scan Barang" di Ringkasan — jalan
    // pintas buka Detail) dan 'roll' (tombol "Scan Roll" di tabel alokasi
    // — tambah/pilih 1 roll spesifik). ----
    const modeScan = ref(null); // 'barang' | 'roll' | null
    const videoScanEl = ref(null);
    const canvasScanEl = ref(null);
    const scanMemuatKamera = ref(false);
    const scanError = ref('');
    let streamScan = null;
    let frameScanId = null;

    function muatJsQr() {
      return new Promise((resolve, reject) => {
        if (window.jsQR) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    async function bukaScan(mode) {
      if (mode === 'roll' && !itemAktif.value) return;
      modeScan.value = mode;
      scanMemuatKamera.value = true;
      scanError.value = '';
      try {
        await muatJsQr();
      } catch (e) {
        scanError.value = 'Gagal memuat modul pembaca QR. Cek koneksi internet.';
        scanMemuatKamera.value = false;
        return;
      }
      try {
        streamScan = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoScanEl.value) {
          videoScanEl.value.srcObject = streamScan;
          await videoScanEl.value.play();
        }
        scanMemuatKamera.value = false;
        pindaiFrameScan();
      } catch (e) {
        scanError.value = 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan.';
        scanMemuatKamera.value = false;
      }
    }

    function pindaiFrameScan() {
      if (!streamScan || !modeScan.value) return;
      const video = videoScanEl.value;
      const canvas = canvasScanEl.value;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gambar = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const kode = window.jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: 'dontInvert' });
        if (kode && kode.data) {
          if (navigator.vibrate) navigator.vibrate(120);
          tangkapHasilScan(kode.data);
          return;
        }
      }
      frameScanId = requestAnimationFrame(pindaiFrameScan);
    }

    function tutupScan() {
      if (frameScanId) { cancelAnimationFrame(frameScanId); frameScanId = null; }
      if (streamScan) {
        streamScan.getTracks().forEach(t => t.stop());
        streamScan = null;
      }
      modeScan.value = null;
      scanError.value = '';
    }

    async function tangkapHasilScan(kode) {
      const mode = modeScan.value;
      tutupScan();
      const kodeBersih = (kode || '').trim();
      if (!kodeBersih) return;
      if (mode === 'barang') {
        // "Scan Barang" — Ringkasan level. Cuma jalan pintas buka Detail,
        // BERLAKU SAMA untuk item lot maupun BUKAN lot (keputusan Guru:
        // "Cuma buka form Catat Pemakaian lebih cepat"). Coba dulu sebagai
        // kode_lot (kode di label roll), fallback coba sebagai ID bahan
        // langsung (kalau nanti ada QR/label lain yang isinya ID bahan).
        try {
          let item = null;
          const lot = await cariLotByKode(kodeBersih);
          // lot.bahan_aksesoris_id SUDAH ID dokumen Firestore asli (bukan
          // id_tampil) -> ambilBahanById() (getDoc langsung). Fallback kalau
          // kode yang di-scan BUKAN kode_lot: coba sebagai id_tampil bahan
          // itu sendiri (cariBahanByIdTampil(), query field id_tampil).
          if (lot) item = await ambilBahanById(lot.bahan_aksesoris_id);
          else item = await cariBahanByIdTampil(kodeBersih);
          if (!item) { alert(`Kode "${kodeBersih}" tidak ditemukan di Data Bahan & Aksesoris atau data roll/lot.`); return; }
          bukaDetail(item);
        } catch (e) {
          console.error('Gagal cari dari hasil scan:', e);
          alert('Gagal memproses hasil scan. Coba lagi.');
        }
      } else if (mode === 'roll') {
        // "Scan Roll" — dalam tabel alokasi, HARUS untuk itemAktif yang
        // sedang dibuka (roll milik bahan lain ditolak dengan pesan jelas).
        try {
          const lot = await cariLotByKode(kodeBersih);
          if (!lot) { alert(`Kode roll "${kodeBersih}" tidak ditemukan atau roll-nya sudah habis.`); return; }
          if (!itemAktif.value || lot.bahan_aksesoris_id !== itemAktif.value.id) {
            alert(`Roll ini bukan untuk item "${itemAktif.value ? itemAktif.value.nama : ''}" (roll ini punya barang: ${lot.nama_bahan || '-'}).`);
            return;
          }
          tambahBarisAlokasi(lot);
        } catch (e) {
          console.error('Gagal cari roll dari hasil scan:', e);
          alert('Gagal memproses hasil scan. Coba lagi.');
        }
      }
    }

    onMounted(async () => { await window.authReady; await paginasiRingkasan.muatUlang(); });
    onUnmounted(tutupScan);

    return {
      tampilan, filterKategori, paginasiRingkasan, paginasiDetail, itemAktif,
      bukaDetail, kembaliKeRingkasan, formPemakaian, menyimpanPemakaian, mulaiCatatPemakaian,
      kekuranganLot, memprosesKeputusan, tutupKeputusanKekurangan,
      kurangiKeYangTersedia, prosesSebagianDanAjukanSisa, tundaDanAjukanKekurangan,
      // BARU (Tahap 2) — tabel alokasi roll/lot.
      daftarLotAktif, memuatLot, tampilAlokasi, alokasiPemakaian, totalAlokasi, alokasiCocok,
      carianKodeRoll, sarananKodeRoll, tambahBarisAlokasi, hapusBarisAlokasi, batalAlokasi, konfirmasiAlokasi,
      // BARU (Tahap 2) — scan QR.
      modeScan, videoScanEl, canvasScanEl, scanMemuatKamera, scanError, bukaScan, tutupScan,
      formatRupiah, formatQty
    };
  },
  template: `
    <div>
      <template v-if="tampilan === 'ringkasan'">
        <div class="gc-card" style="padding:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Kartu Stok — Ringkasan</label>
          <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Stok Akhir dihitung otomatis: MASUK dari Nota Order Belanja yang di-final-kan, KELUAR dari pencatatan Pemakaian manual di halaman Detail (klik 1 baris di bawah).</p>

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
            <div style="position:relative; max-width:320px; flex:1; min-width:220px;">
              <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
              <input :value="paginasiRingkasan.cariTeks.value" @input="paginasiRingkasan.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
            </div>
            <select v-model="filterKategori" @change="paginasiRingkasan.muatUlang()" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
              <option value="ALL">Semua Kategori</option>
              <option value="Bahan">Bahan</option>
              <option value="Aksesoris">Aksesoris</option>
            </select>
            <button @click="bukaScan('barang')" class="btn-outline" style="padding:9px 14px; font-size:12px; white-space:nowrap;" title="Scan QR roll untuk langsung buka Kartu Stok Detail item itu"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Barang</button>
          </div>

          <div v-if="paginasiRingkasan.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
          <div v-else-if="paginasiRingkasan.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasiRingkasan.errorPaginasi.value }}</div>
          <div v-else-if="paginasiRingkasan.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada data.</div>
          <div v-else style="overflow-x:auto;">
            <table class="gc-table" style="width:100%; font-size:11.5px;">
              <thead><tr>
                <th>Nama</th><th>Kategori</th><th>Warna</th><th>Satuan Pemakaian</th><th>Stok Akhir</th><th></th>
              </tr></thead>
              <tbody>
                <tr v-for="item in paginasiRingkasan.dataHalaman.value" :key="item.id" style="cursor:pointer;" @click="bukaDetail(item)">
                  <td>{{ item.nama }}</td><td>{{ item.kategori_utama }}</td><td>{{ item.warna || '-' }}</td>
                  <td>{{ item.satuan_pemakaian || '-' }}</td>
                  <td style="font-weight:700; color:var(--burgundy);">{{ formatQty(item.stok_akhir || 0) }}</td>
                  <td><button class="icon-btn" @click.stop="bukaDetail(item)" title="Lihat Kartu Stok Detail"><i class="fas fa-arrow-right"></i></button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="!paginasiRingkasan.memuat.value && paginasiRingkasan.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
            <button class="icon-btn" :disabled="paginasiRingkasan.nomorHalaman.value <= 1" @click="paginasiRingkasan.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
            <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiRingkasan.nomorHalaman.value }}</span>
            <button class="icon-btn" :disabled="!paginasiRingkasan.adaBerikutnya.value" @click="paginasiRingkasan.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </template>

      <template v-else-if="tampilan === 'detail' && itemAktif">
        <div class="gc-card" style="padding:14px; margin-bottom:14px;">
          <button @click="kembaliKeRingkasan" class="btn-outline" style="font-size:11px; padding:6px 12px; margin-bottom:12px;"><i class="fas fa-arrow-left" style="margin-right:6px;"></i>Kembali ke Ringkasan</button>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="font-weight:700; font-size:16px;">{{ itemAktif.nama }}</h3>
              <p style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">{{ itemAktif.kategori_utama }} · {{ itemAktif.warna || '-' }} · Satuan Pemakaian: {{ itemAktif.satuan_pemakaian || '-' }}</p>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Stok Akhir Saat Ini</div>
              <div style="font-size:22px; font-weight:700; color:var(--burgundy);">{{ formatQty(itemAktif.stok_akhir || 0) }} <span style="font-size:13px; font-weight:400;">{{ itemAktif.satuan_pemakaian || '' }}</span></div>
            </div>
          </div>
        </div>

        <div class="gc-card" style="padding:14px; margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:10px;">Catat Pemakaian</label>
          <div style="display:grid; gap:8px;" class="grid-cols-1 md:grid-cols-4">
            <div class="gc-field" style="margin-bottom:0;"><label>Tanggal</label><input v-model="formPemakaian.tanggal" type="date" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Jumlah ({{ itemAktif.satuan_pemakaian || 'satuan' }})</label><input v-model.number="formPemakaian.qty" type="number" min="0" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Keterangan (opsional)</label><input v-model="formPemakaian.keterangan" type="text" placeholder="mis. dipakai buat SPK #123" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <button @click="mulaiCatatPemakaian" :disabled="menyimpanPemakaian || memuatLot || tampilAlokasi" class="btn-primary" style="padding:0 18px; height:38px; align-self:end;">{{ menyimpanPemakaian ? 'Menyimpan...' : (itemAktif.pakai_lot_tracking ? 'Lanjut' : 'Catat') }}</button>
          </div>
          <p v-if="itemAktif.pakai_lot_tracking" style="font-size:10.5px; color:var(--text-faint); margin-top:8px;"><i class="fas fa-layer-group" style="margin-right:4px;"></i>Item ini dilacak per Roll/Lot — sistem SARANKAN roll TERTUA dulu (FIFO), tapi bisa diganti/dipilih sendiri (cari kode atau Scan Roll) di langkah berikutnya. Kalau roll/lot belum ada datanya sama sekali, pemakaian tidak bisa dicatat dulu.</p>
          <p v-else style="font-size:10.5px; color:var(--text-faint); margin-top:8px;">Belum ada modul Produksi/SPK otomatis — pemakaian dicatat manual dulu di sini sampai modul itu ada.</p>
        </div>

        <!-- BARU (Tahap 2) — tabel "Pilih Roll/Lot yang Dipakai" (default
             FIFO, editable/scan-able). -->
        <div v-if="tampilAlokasi" class="gc-card" style="padding:14px; margin-bottom:14px; border:1.5px solid var(--burgundy);">
          <h3 style="font-weight:700; font-size:14px; margin-bottom:6px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:6px;"></i>Pilih Roll/Lot yang Dipakai</h3>
          <p style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">Sudah diisi otomatis pakai saran roll TERTUA (FIFO) untuk total {{ formatQty(formPemakaian.qty) }} {{ itemAktif.satuan_pemakaian }}. Ganti/tambah roll lain lewat cari kode atau Scan Roll kalau yang benar-benar diambil bukan roll tertua.</p>

          <div style="display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; align-items:flex-start;">
            <div style="position:relative; flex:1; min-width:200px;">
              <input v-model="carianKodeRoll" type="text" placeholder="Cari kode roll (mis. BHN-0001-L003)..." style="width:100%; padding:8px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
              <div v-if="carianKodeRoll && sarananKodeRoll.length" style="position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid var(--line); border-radius:8px; margin-top:2px; max-height:170px; overflow-y:auto; z-index:20; box-shadow:0 4px 10px rgba(0,0,0,.1);">
                <div v-for="lot in sarananKodeRoll" :key="lot.id" @click="tambahBarisAlokasi(lot); carianKodeRoll=''" style="padding:7px 10px; font-size:11.5px; cursor:pointer; border-bottom:1px solid var(--line);">
                  <b>{{ lot.kode_lot }}</b> — sisa {{ formatQty(lot.qty_sisa) }} {{ itemAktif.satuan_pemakaian }} (masuk {{ lot.tanggal_masuk }})
                </div>
              </div>
            </div>
            <button @click="bukaScan('roll')" class="btn-outline" style="font-size:11.5px; padding:8px 14px; white-space:nowrap;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Roll</button>
          </div>

          <div v-if="alokasiPemakaian.length === 0" style="text-align:center; padding:14px; color:var(--text-faint); font-size:12px;">Belum ada roll dipilih.</div>
          <table v-else class="gc-table" style="width:100%; font-size:11.5px; margin-bottom:10px;">
            <thead><tr><th>Kode Roll</th><th>Tanggal Masuk</th><th>Tersedia</th><th>Diambil</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in alokasiPemakaian" :key="r.lotId">
                <td>{{ r.kode_lot }}</td>
                <td>{{ r.tanggal_masuk }}</td>
                <td>{{ formatQty(r.qty_sisa) }}</td>
                <td><input v-model.number="r.ambil" type="number" min="0" :max="r.qty_sisa" @change="r.ambil = Math.min(Math.max(parseFloat(r.ambil)||0, 0), r.qty_sisa)" style="width:80px; padding:5px 7px; border:1.5px solid var(--line); border-radius:6px; font-size:11.5px;"></td>
                <td><button @click="hapusBarisAlokasi(i)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button></td>
              </tr>
            </tbody>
          </table>

          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--ivory-dim); border-radius:8px; padding:8px 12px; margin-bottom:12px; font-size:12px;">
            <span style="color:var(--text-muted);">Total diambil:</span>
            <b :style="{color: alokasiCocok ? 'var(--ok)' : 'var(--danger)'}">{{ formatQty(totalAlokasi) }} / {{ formatQty(formPemakaian.qty) }} {{ itemAktif.satuan_pemakaian }}</b>
          </div>

          <div style="display:flex; gap:8px;">
            <button @click="konfirmasiAlokasi" :disabled="menyimpanPemakaian || !alokasiCocok" class="btn-primary" style="flex:1;">{{ menyimpanPemakaian ? 'Menyimpan...' : 'Konfirmasi & Simpan' }}</button>
            <button @click="batalAlokasi" :disabled="menyimpanPemakaian" class="btn-outline" style="flex:1;">Batal</button>
          </div>
        </div>

        <!-- Popup 3 opsi keputusan saat roll/lot kurang dari qty yang
             diminta (§25.3, TIDAK berubah alurnya). -->
        <div v-if="kekuranganLot" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
          <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto;">
            <h3 style="font-weight:700; font-size:15px; margin-bottom:10px;"><i class="fas fa-triangle-exclamation" style="color:var(--danger); margin-right:8px;"></i>Roll/Lot Tidak Cukup</h3>
            <p style="font-size:12px; margin-bottom:14px;">Stok di roll/lot yang tersedia cuma <b>{{ formatQty(kekuranganLot.totalTersedia) }} {{ itemAktif.satuan_pemakaian }}</b>, tapi mau dicatat pemakaian <b>{{ formatQty(kekuranganLot.qtyDiminta) }} {{ itemAktif.satuan_pemakaian }}</b> (kurang {{ formatQty(kekuranganLot.kekurangan) }}). Pilih tindak lanjut:</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button @click="kurangiKeYangTersedia" :disabled="memprosesKeputusan" class="btn-outline" style="text-align:left; padding:10px 14px;">
                <b>Kurangi jumlah pemakaian</b><br><span style="font-size:11px; color:var(--text-faint);">Catat pemakaian sejumlah yang tersedia saja ({{ formatQty(kekuranganLot.totalTersedia) }})</span>
              </button>
              <button @click="prosesSebagianDanAjukanSisa" :disabled="memprosesKeputusan" class="btn-outline" style="text-align:left; padding:10px 14px;">
                <b>Proses sebagian, order sisanya</b><br><span style="font-size:11px; color:var(--text-faint);">Catat {{ formatQty(kekuranganLot.totalTersedia) }} sekarang, sisa kekurangan ({{ formatQty(kekuranganLot.kekurangan) }}) otomatis masuk antrean Persiapan Masalah</span>
              </button>
              <button @click="tundaDanAjukanKekurangan" :disabled="memprosesKeputusan" class="btn-outline" style="text-align:left; padding:10px 14px;">
                <b>Tunggu dulu</b><br><span style="font-size:11px; color:var(--text-faint);">Belum dicatat apa-apa sekarang, kekurangan ({{ formatQty(kekuranganLot.kekurangan) }}) masuk antrean Persiapan Masalah — coba Catat Pemakaian lagi nanti setelah stok cukup</span>
              </button>
            </div>
            <button @click="tutupKeputusanKekurangan" :disabled="memprosesKeputusan" class="btn-outline" style="width:100%; margin-top:14px;">Batal</button>
          </div>
        </div>

        <!-- BARU (Tahap 2) — modal kamera Scan QR (dipakai "Scan Barang" &
             "Scan Roll"), pola SAMA seperti js/vue-scan-qr.js. -->
        <div v-if="modeScan" style="position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
          <div style="width:100%; max-width:340px; aspect-ratio:1/1; background:#111; border-radius:12px; overflow:hidden; position:relative; margin-bottom:16px;">
            <video ref="videoScanEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: scanMemuatKamera }"></video>
            <canvas ref="canvasScanEl" class="hidden"></canvas>
            <div v-if="scanMemuatKamera" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#C9B4A4; text-align:center; padding:16px;">
              <i class="fas fa-qrcode" style="font-size:36px; margin-bottom:10px;"></i>
              <span v-if="scanError" style="color:#F2A0A0; font-size:12px;">{{ scanError }}</span>
              <span v-else style="font-size:12.5px;">Menyiapkan kamera...</span>
            </div>
          </div>
          <p style="color:#fff; font-size:12.5px; margin-bottom:14px; text-align:center;">{{ modeScan === 'barang' ? 'Arahkan kamera ke QR label roll (atau kode barang)' : 'Arahkan kamera ke QR label roll' }}</p>
          <button @click="tutupScan" class="btn-outline" style="padding:8px 24px; background:#fff;">Batal</button>
        </div>

        <div class="gc-card" style="padding:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Pergerakan</label>
          <div v-if="paginasiDetail.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
          <div v-else-if="paginasiDetail.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada pergerakan stok buat item ini.</div>
          <div v-else style="overflow-x:auto;">
            <table class="gc-table" style="width:100%; font-size:11.5px;">
              <thead><tr>
                <th>Tanggal</th><th>Jenis</th><th>Jumlah</th><th>Sumber</th><th>No. Pembelian</th><th>Keterangan</th><th>Saldo Setelah</th>
              </tr></thead>
              <tbody>
                <tr v-for="g in paginasiDetail.dataHalaman.value" :key="g.id">
                  <td>{{ g.tanggal }}</td>
                  <td><span :style="{color: g.jenis === 'masuk' ? 'var(--ok)' : 'var(--danger)', fontWeight:700}">{{ g.jenis === 'masuk' ? 'Masuk' : 'Keluar' }}</span></td>
                  <td>{{ formatQty(g.qty) }} {{ g.satuan }}</td>
                  <td>{{ g.sumber || '-' }}</td>
                  <td>{{ g.no_pembelian || '-' }}</td>
                  <td>{{ g.keterangan || '-' }}
                    <i v-if="g.rincian_lot && g.rincian_lot.length" class="fas fa-circle-info" style="color:var(--burgundy); margin-left:4px; cursor:help;"
                      :title="g.rincian_lot.map(r => 'Roll ' + (r.kode_lot || r.lot_id) + ' (masuk ' + r.tanggal_masuk + '): dipotong ' + formatQty(r.dipotong) + ' (sisa ' + formatQty(r.sisa_setelah) + ')').join('\\n')"></i>
                  </td>
                  <td style="font-weight:700;">{{ formatQty(g.saldo_setelah) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!paginasiDetail.memuat.value && paginasiDetail.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
            <button class="icon-btn" :disabled="paginasiDetail.nomorHalaman.value <= 1" @click="paginasiDetail.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
            <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiDetail.nomorHalaman.value }}</span>
            <button class="icon-btn" :disabled="!paginasiDetail.adaBerikutnya.value" @click="paginasiDetail.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </template>
    </div>
  `
};

const AppKartuStok = { components: { KartuStokManager }, template: `<kartu-stok-manager />` };
let vmKartuStok = null;
window.pastikanMountKartuStok = function() {
  if (vmKartuStok) return;
  const mountPoint = document.getElementById('vue-kartu-stok');
  if (mountPoint) vmKartuStok = createApp(AppKartuStok).mount('#vue-kartu-stok');
};
