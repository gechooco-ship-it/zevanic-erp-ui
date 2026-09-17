// js/vue-scan-persiapan.js
// Scan & Cetak > Scan Persiapan — mencatat pemakaian bahan untuk satu SPK
// lewat scan QR barang/roll, bukan ketik bebas.
//
// Koleksi & field:
// - SPK dipilih lewat dropdown (SPK tidak punya QR sendiri), sama untuk semua
//   role. Identifikasi barang: non-Owner WAJIB scan QR kamera, Owner boleh
//   scan atau pilih dari dropdown, di desktop maupun mobile.
// - bangunAlokasiFifoScan: ambil dari lot yang discan dulu, sisanya ditarik
//   dari lot aktif lain untuk bahan yang sama (FIFO lewat ambilLotAktif).
// - permintaan_bahan_manual: tujuan pengajuan sisa kalau stok kurang. Popup
//   stok kurang punya 3 opsi: kurangi jumlah, proses sebagian + ajukan sisa,
//   atau tunggu.
//
// Jebakan:
// - File ini TIDAK PERNAH menulis stok_akhir atau qty_sisa langsung. Semua
//   pergerakan lewat catatPergerakanKartuStok / catatPemakaianDariAlokasi di
//   js/vue-stock-pembelian.js, yang menulis ke ledger
//   kartu_stok_bahan_aksesoris.
// - "Riwayat Sesi Ini" hanya in-memory, tidak disimpan.

import { createApp, ref, computed, onMounted, onUnmounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=13';
import {
  ambilLotAktif, cariLotByKode, cariBahanByIdTampil, ambilBahanById,
  catatPergerakanKartuStok, catatPemakaianDariAlokasi
} from './vue-stock-pembelian.js';

const MENU_ID_SCAN_PERSIAPAN = 'scan_persiapan';
const SUMBER_SCAN_PERSIAPAN = 'Pemakaian (Scan Persiapan)';

// isDesktopBrowser — disalin dari js/vue-login.js (sama seperti
// vue-scan-opname.js — konvensi "salin logic kecil per-file").
function isDesktopBrowser() {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
// ambilDaftarBahanAksesorisLengkap/formatNamaBahan — disalin dari
// vue-stock-pembelian.js (sama seperti vue-scan-opname.js).
async function ambilDaftarBahanAksesorisLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Bahan/Aksesoris:', e);
    return [];
  }
}
function formatNamaBahan(b) {
  return (b.nama || '') + (b.warna ? ` ${b.warna}` : '');
}
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
// ringkasRincianLot — DIPORT dari vue-kartu-stok.js (fungsi kecil, disalin bukan
// diimpor — file itu tidak mengekspor apapun).
function ringkasRincianLot(rincian) {
  return rincian.map(r => `Roll ${r.kode_lot || r.lot_id}: dipotong ${formatQty(r.dipotong)} (sisa ${formatQty(r.sisa_setelah)})`).join('\n');
}
// bangunAlokasiFifoScan — versi scan dari `bangunAlokasiFifo` vue-kartu-stok.js.
// SELALU memprioritaskan `lotAwal` (roll yang dipegang operator) sampai
// qty_sisa-nya habis, sisanya disambung FIFO dari roll aktif LAIN item yang sama.
// Selalu baca ULANG lot lewat ambilLotAktif, bukan cache — aman sebelum simpan.
async function bangunAlokasiFifoScan(bahanId, lotAwal, qty) {
  const semuaAktif = await ambilLotAktif(bahanId);
  const petaFresh = new Map(semuaAktif.map(l => [l.id, l]));
  const lotAwalFresh = petaFresh.get(lotAwal.id) || lotAwal;
  const totalTersedia = semuaAktif.reduce((t, l) => t + (parseFloat(l.qty_sisa) || 0), 0);

  const alokasi = [];
  let sisa = qty;
  const tersediaAwal = parseFloat(lotAwalFresh.qty_sisa) || 0;
  if (tersediaAwal > 0) {
    const ambil = Math.min(tersediaAwal, sisa);
    alokasi.push({ lotId: lotAwalFresh.id, kode_lot: lotAwalFresh.kode_lot, ambil });
    sisa -= ambil;
  }
  if (sisa > 0) {
    for (const l of semuaAktif) {
      if (sisa <= 0) break;
      if (l.id === lotAwalFresh.id) continue;
      const tersedia = parseFloat(l.qty_sisa) || 0;
      if (tersedia <= 0) continue;
      const ambil = Math.min(tersedia, sisa);
      alokasi.push({ lotId: l.id, kode_lot: l.kode_lot, ambil });
      sisa -= ambil;
    }
  }
  return { alokasi, totalTersedia, kekurangan: Math.max(0, Math.round(sisa * 100) / 100) };
}
// ambilDaftarSpkAktif — baca `order_spk` (§26.2), DIFILTER status "Aktif" saja
// (sesuai catatan di vue-order-spk.js). Query 1 field where saja (tidak orderBy
// field lain) — supaya TIDAK butuh index komposit baru di Firestore, urutan
// ditentukan di sini (client-side, sort by no_spk).
async function ambilDaftarSpkAktif() {
  try {
    const snap = await getDocs(query(collection(db, 'order_spk'), where('status', '==', 'Aktif')));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.no_spk || '').localeCompare(b.no_spk || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Order SPK aktif:', e);
    return [];
  }
}
// cariSpkByNoSpk — Order SPK mencetak label fisik ber-QR berisi `no_spk`
// (`cetakSpkList` di vue-order-spk.js), jadi ID Order bisa discan, bukan cuma
// dipilih dari dropdown. Query mencari status APAPUN (bukan cuma Aktif) supaya
// SPK "Selesai" dapat pesan jelas, bukan "kode tidak dikenali".
async function cariSpkByNoSpk(noSpk) {
  if (!noSpk) return null;
  const snap = await getDocs(query(collection(db, 'order_spk'), where('no_spk', '==', String(noSpk).trim())));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

// Catat Pemakaian TIDAK menyentuh koleksi `persiapan_komponen` sama sekali.
// Integrasi checklist Persiapan Produksi lama sudah dilepas total sejak sistem
// pindah ke Persiapan Produksi V2, jadi jangan tambahkan lagi query ke koleksi
// itu di jalur scan ini — selalu kosong dan cuma buang 1 baca Firestore.

const ScanPersiapanManager = {
  components: { DropdownCari },
  setup() {
    const siapAkses = ref(false);
    const isOwner = ref(false);
    const isMobileDevice = ref(!isDesktopBrowser());
    const diblokirDesktop = computed(() => siapAkses.value && !isOwner.value && !isMobileDevice.value);
    const bolehSimpan = computed(() => window.cekIzinMenu(MENU_ID_SCAN_PERSIAPAN, 'edit') !== false);

    // Langkah 1: pilih ID Order — dropdown ATAU scan (§26.6; Order SPK mencetak
    // label ber-QR). Tombol scan kecil di sebelah field, tersedia SEMUA role:
    // gerbang mobile-only cuma berlaku untuk identifikasi BARANG di Langkah 2,
    // sedangkan ID Order hanya metadata pengelompokan.
    const daftarSpk = ref([]);
    const memuatSpk = ref(false);
    const spkEntry = ref('');
    const opsiSpkMap = computed(() => {
      const map = new Map();
      daftarSpk.value.forEach(s => {
        const label = `${s.no_spk} — ${s.nama_produk}`;
        map.set(label, s);
      });
      return map;
    });
    const opsiSpkNama = computed(() => Array.from(opsiSpkMap.value.keys()));
    const spkAktif = ref(null); // { id, no_spk, nama_produk, .. } | null
    function pilihSpk(s) {
      spkAktif.value = s;
      spkEntry.value = '';
    }
    watch(spkEntry, () => {
      const s = opsiSpkMap.value.get(spkEntry.value);
      if (s) pilihSpk(s);
    });
    function gantiSpk() {
      spkAktif.value = null;
      batalTarget();
    }

    // Langkah 2: cari & pilih barang langsung (KHUSUS Owner — non-Owner
    // tidak punya jalur ini sama sekali, WAJIB scan).
    const daftarBahan = ref([]);
    const bahanEntry = ref('');
    const opsiBahanMap = computed(() => {
      const map = new Map();
      daftarBahan.value.forEach(b => {
        const label = formatNamaBahan(b) + (b.id_tampil ? ` (${b.id_tampil})` : '');
        map.set(label, b);
      });
      return map;
    });
    const opsiBahanNama = computed(() => Array.from(opsiBahanMap.value.keys()));

    // Item lot-tracked dipilih Owner lewat dropdown -> pilih 1 roll AKTIF
    // spesifik. Sengaja cuma cariLotByKode/ambilLotAktif, BUKAN
    // cariLotByKodeSemuaStatus seperti Scan Opname: untuk PEMAKAIAN, roll yang
    // sudah 'habis' memang tidak boleh dipilih lagi.
    const bahanUntukPilihRoll = ref(null);
    const daftarLotUntukPilih = ref([]);
    const memuatLotPilih = ref(false);
    watch(bahanEntry, async () => {
      const b = opsiBahanMap.value.get(bahanEntry.value);
      bahanUntukPilihRoll.value = null;
      daftarLotUntukPilih.value = [];
      if (!b) return;
      if (b.pakai_lot_tracking) {
        bahanUntukPilihRoll.value = b;
        memuatLotPilih.value = true;
        try { daftarLotUntukPilih.value = await ambilLotAktif(b.id); }
        catch (e) { console.error('Gagal ambil daftar lot:', e); daftarLotUntukPilih.value = []; }
        memuatLotPilih.value = false;
      } else {
        target.value = { tipe: 'item', bahan: b };
        qtyDipakai.value = ''; keteranganPemakaian.value = '';
        bahanEntry.value = '';
      }
    });
    function pilihRollUntukPemakaian(lot) {
      target.value = { tipe: 'roll', lot, bahan: bahanUntukPilihRoll.value };
      qtyDipakai.value = ''; keteranganPemakaian.value = '';
      bahanEntry.value = ''; bahanUntukPilihRoll.value = null; daftarLotUntukPilih.value = [];
    }
    function batalPilihRoll() {
      bahanEntry.value = ''; bahanUntukPilihRoll.value = null; daftarLotUntukPilih.value = [];
    }

    // Kamera/QR (SEMUA role) — pola sama seperti vue-scan-opname.js /
    // vue-kartu-stok.js. `modeScan` ('spk'|'barang'|null) menampung 2 tujuan
    // scan, pola yang sama dengan `modeScan` 2-tujuan di vue-kartu-stok.js.
    const modeScan = ref(null); // 'spk' | 'barang' | null
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
      if (mode === 'spk') {
        // scan barcode ID Order (dicetak lewat vue-order-spk.js, `cetakSpkList`).
        // Cari TANPA filter status dulu (`cariSpkByNoSpk`) supaya kalau ternyata
        // SPK-nya sudah "Selesai", user dapat pesan JELAS — bukan "kode tidak
        // dikenali" yang membingungkan.
        try {
          const s = await cariSpkByNoSpk(kodeBersih);
          if (!s) { alert(`ID Order "${kodeBersih}" tidak ditemukan.`); return; }
          if (s.status !== 'Aktif') { alert(`ID Order "${s.no_spk}" berstatus "${s.status}" — cuma ID Order berstatus Aktif yang bisa dipakai buat Scan Persiapan.`); return; }
          pilihSpk(s);
        } catch (e) {
          console.error('Gagal cari ID Order dari hasil scan:', e);
          alert('Gagal memproses hasil scan. Coba lagi.');
        }
        return;
      }
      // mode === 'barang' (jalur LAMA, TIDAK berubah sama sekali dari §26.5)
      try {
        // Coba dulu sebagai kode_lot (QR label roll, AKTIF saja — roll 'habis'
        // memang seharusnya tidak bisa dipakai lagi, beda dari Scan Opname yang
        // sengaja cari semua status).
        const lot = await cariLotByKode(kodeBersih);
        if (lot) {
          const bahan = await ambilBahanById(lot.bahan_aksesoris_id);
          if (!bahan) { alert('Data Bahan/Aksesoris untuk roll ini tidak ditemukan.'); return; }
          target.value = { tipe: 'roll', lot, bahan };
          qtyDipakai.value = ''; keteranganPemakaian.value = '';
          return;
        }
        // Bukan kode_lot (atau roll-nya sudah habis) -> coba sebagai id_tampil
        // item non-lot (QR dari menu Cetak Label, §26.3).
        const bahan = await cariBahanByIdTampil(kodeBersih);
        if (!bahan) { alert(`Kode "${kodeBersih}" tidak ditemukan atau roll-nya sudah habis. Scan roll lain, atau minta bantuan Admin/Owner.`); return; }
        if (bahan.pakai_lot_tracking) {
          alert(`"${formatNamaBahan(bahan)}" adalah item Qty per Roll/Lot — pemakaian harus PER ROLL, scan label ROLL-nya (bukan kode item).`);
          return;
        }
        target.value = { tipe: 'item', bahan };
        qtyDipakai.value = ''; keteranganPemakaian.value = '';
      } catch (e) {
        console.error('Gagal memproses hasil scan:', e);
        alert('Gagal memproses hasil scan. Coba lagi.');
      }
    }

    // Target aktif (hasil scan ATAU hasil pilih roll Owner) + form input qty
    // + simpan.
    const target = ref(null); // { tipe:'roll', lot, bahan } | { tipe:'item', bahan }
    const qtyDipakai = ref('');
    const keteranganPemakaian = ref('');
    const menyimpan = ref(false);
    const riwayatSesi = ref([]); // in-memory saja (bukan koleksi baru), sama pola vue-scan-opname.js

    // popup 3 opsi "Roll/Lot Tidak Cukup", muncul kalau TOTAL semua roll aktif
    // item ini (roll yang di-scan + semua roll FIFO lainnya) masih < qty yang
    // diminta. null = tidak tampil. { totalTersedia, qtyDiminta, kekurangan }.
    const kekuranganLot = ref(null);
    const memprosesKeputusan = ref(false);

    function batalTarget() {
      target.value = null; qtyDipakai.value = ''; keteranganPemakaian.value = '';
      kekuranganLot.value = null;
    }
    function tutupKeputusanKekurangan() { kekuranganLot.value = null; }

    function keteranganGabungSpk() {
      return `ID Order: ${spkAktif.value.no_spk} — ${spkAktif.value.nama_produk}` + (keteranganPemakaian.value.trim() ? ' — ' + keteranganPemakaian.value.trim() : '');
    }

    // ajukanPersiapanMasalahKekurangan — menulis ke koleksi board manual
    // `permintaan_bahan_manual`, skema field sama dengan vue-kartu-stok.js,
    // keterangannya menyertakan ID Order aktif. JANGAN pakai nama
    // 'persiapan_masalah' di sini: itu milik pos Masalah (js/vue-pp-masalah.js).
    async function ajukanPersiapanMasalahKekurangan(k) {
      const bahan = target.value.bahan;
      await addDoc(collection(db, 'permintaan_bahan_manual'), {
        bahan_aksesoris_id: bahan.id,
        kategori_utama: bahan.kategori_utama || '',
        nama_bahan: formatNamaBahan(bahan),
        qty: k.kekurangan,
        satuan: bahan.satuan_pemakaian || '',
        keterangan: `Kekurangan stok roll/lot saat Scan Persiapan (ID Order: ${spkAktif.value?.no_spk || '-'} — ${spkAktif.value?.nama_produk || '-'}) tanggal ${new Date().toISOString().slice(0, 10)} (tersedia ${formatQty(k.totalTersedia)}, diminta ${formatQty(k.qtyDiminta)})${keteranganPemakaian.value.trim() ? ' — ' + keteranganPemakaian.value.trim() : ''}`,
        status: 'menunggu',
        diminta_oleh: window.currentUser?.email || '-',
        dibuat_pada: serverTimestamp()
      });
    }

    // OPSI A — "Kurangi jumlah pemakaian": catat SEJUMLAH yang tersedia saja
    // (FIFO penuh dari semua roll aktif), tidak ada sisa dan tidak menulis entri
    // Persiapan Masalah. Pola sama dengan vue-kartu-stok.js.
    async function kurangiKeYangTersedia() {
      if (!kekuranganLot.value || !target.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        const { alokasi } = await bangunAlokasiFifoScan(target.value.bahan.id, target.value.lot, k.totalTersedia);
        const namaBahan = formatNamaBahan(target.value.bahan);
        const hasil = await catatPemakaianDariAlokasi({
          bahanId: target.value.bahan.id, namaBahan, tanggal: new Date().toISOString().slice(0, 10),
          qty: k.totalTersedia, satuan: target.value.bahan.satuan_pemakaian || '',
          keterangan: keteranganGabungSpk() + ' (dikurangi otomatis ke qty yang tersedia — roll/lot tidak cukup)',
          alokasi: alokasi.map(r => ({ lotId: r.lotId, qty: r.ambil })),
          sumber: SUMBER_SCAN_PERSIAPAN
        });
        riwayatSesi.value.unshift({ waktu: new Date().toLocaleTimeString('id-ID'), nama: namaBahan, kode: target.value.lot.kode_lot || '-', qty: formatQty(k.totalTersedia) + ' ' + (target.value.bahan.satuan_pemakaian || '') });
        kekuranganLot.value = null;
        alert(`Pemakaian dicatat sejumlah ${formatQty(k.totalTersedia)} (dikurangi dari permintaan awal ${formatQty(k.qtyDiminta)} karena roll/lot tidak cukup).\n\n${ringkasRincianLot(hasil.rincian)}`);
        batalTarget();
      } catch (e) {
        console.error('Gagal proses "Kurangi jumlah pemakaian" (Scan Persiapan):', e);
        alert(e.message || 'Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // OPSI B — "Proses sebagian, order sisanya": catat pemakaian sejumlah yang
    // tersedia LEWAT FIFO PENUH SEKARANG, sisa kekurangan otomatis masuk
    // Persiapan Masalah. DIPORT dari vue-kartu-stok.js.
    async function prosesSebagianDanAjukanSisa() {
      if (!kekuranganLot.value || !target.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        const namaBahan = formatNamaBahan(target.value.bahan);
        if (k.totalTersedia > 0) {
          const { alokasi } = await bangunAlokasiFifoScan(target.value.bahan.id, target.value.lot, k.totalTersedia);
          const hasil = await catatPemakaianDariAlokasi({
            bahanId: target.value.bahan.id, namaBahan, tanggal: new Date().toISOString().slice(0, 10),
            qty: k.totalTersedia, satuan: target.value.bahan.satuan_pemakaian || '',
            keterangan: keteranganGabungSpk() + ' (diproses sebagian, sisa diajukan ke Persiapan Masalah)',
            alokasi: alokasi.map(r => ({ lotId: r.lotId, qty: r.ambil })),
            sumber: SUMBER_SCAN_PERSIAPAN
          });
          riwayatSesi.value.unshift({ waktu: new Date().toLocaleTimeString('id-ID'), nama: namaBahan, kode: target.value.lot.kode_lot || '-', qty: formatQty(k.totalTersedia) + ' ' + (target.value.bahan.satuan_pemakaian || '') });
          void hasil; // rincian dilampirkan di ledger; tidak ditampilkan panjang di alert supaya alert tidak dobel-panjang dgn pesan Persiapan Masalah
        }
        await ajukanPersiapanMasalahKekurangan(k);
        kekuranganLot.value = null;
        alert(`${formatQty(k.totalTersedia)} sudah dicatat sebagai pemakaian (ID Order: ${spkAktif.value.no_spk}). Sisa kekurangan (${formatQty(k.kekurangan)}) otomatis masuk antrean di menu Persiapan Masalah.`);
        batalTarget();
      } catch (e) {
        console.error('Gagal proses "Proses sebagian, order sisanya" (Scan Persiapan):', e);
        alert(e.message || 'Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // OPSI C — "Tunggu dulu": TIDAK ada yang dicatat/dipotong sekarang, cuma
    // kekurangan yang masuk Persiapan Masalah. Logika sama dengan
    // vue-kartu-stok.js.
    async function tundaDanAjukanKekurangan() {
      if (!kekuranganLot.value || !target.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        await ajukanPersiapanMasalahKekurangan(k);
        kekuranganLot.value = null;
        alert(`Belum ada yang dicatat. Kekurangan (${formatQty(k.kekurangan)}) otomatis masuk antrean di menu Persiapan Masalah — coba "Catat Pemakaian" lagi (qty ${formatQty(k.qtyDiminta)}) setelah stok cukup.`);
      } catch (e) {
        console.error('Gagal proses "Tunggu dulu" (Scan Persiapan):', e);
        alert(e.message || 'Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // simpanPemakaianRoll — versi scan dari `mulaiCatatPemakaian` +
    // `konfirmasiAlokasi` vue-kartu-stok.js. Roll yang dipegang diprioritaskan,
    // sisanya disambung FIFO lewat `bangunAlokasiFifoScan`. Kalau SEMUA roll
    // aktif tidak cukup -> buka popup 3 opsi (`kekuranganLot`), BELUM menyimpan.
    async function simpanPemakaianRoll(qty) {
      menyimpan.value = true;
      try {
        const { alokasi, totalTersedia, kekurangan } = await bangunAlokasiFifoScan(target.value.bahan.id, target.value.lot, qty);
        if (kekurangan > 0) {
          kekuranganLot.value = { totalTersedia, qtyDiminta: qty, kekurangan };
          menyimpan.value = false;
          return;
        }
        const namaBahan = formatNamaBahan(target.value.bahan);
        const kodeAwal = target.value.lot.kode_lot || '-';
        const hasil = await catatPemakaianDariAlokasi({
          bahanId: target.value.bahan.id, namaBahan, tanggal: new Date().toISOString().slice(0, 10),
          qty, satuan: target.value.bahan.satuan_pemakaian || target.value.lot.satuan || '',
          keterangan: keteranganGabungSpk(),
          alokasi: alokasi.map(r => ({ lotId: r.lotId, qty: r.ambil })),
          sumber: SUMBER_SCAN_PERSIAPAN
        });
        riwayatSesi.value.unshift({ waktu: new Date().toLocaleTimeString('id-ID'), nama: namaBahan, kode: kodeAwal, qty: formatQty(qty) + ' ' + (target.value.bahan.satuan_pemakaian || '') });
        if (alokasi.length > 1) {
          alert(`Pemakaian tercatat: ${formatQty(qty)} ${target.value.bahan.satuan_pemakaian || ''} — ${namaBahan} (ID Order: ${spkAktif.value.no_spk}).\n\nRoll ${kodeAwal} tidak cukup sendirian — otomatis disambung dari roll lain (FIFO). Rincian per roll:\n${ringkasRincianLot(hasil.rincian)}`);
        } else {
          alert(`Pemakaian tercatat: ${formatQty(qty)} ${target.value.bahan.satuan_pemakaian || ''} — ${namaBahan} (ID Order: ${spkAktif.value.no_spk}).`);
        }
        batalTarget();
      } catch (e) {
        if (e.kode === 'LOT_BERUBAH') {
          alert(e.message + ' Coba scan/pilih ulang roll-nya.');
        } else {
          console.error('Gagal simpan pemakaian roll (Scan Persiapan):', e);
          alert(e.message || 'Gagal menyimpan. Coba lagi.');
        }
      }
      menyimpan.value = false;
    }

    async function simpanPemakaian() {
      if (!target.value || !spkAktif.value) return;
      const qty = parseFloat(qtyDipakai.value);
      if (!(qty > 0)) return alert('Isi Qty yang dipakai dulu (harus lebih dari 0).');

      if (target.value.tipe === 'roll') {
        await simpanPemakaianRoll(qty);
        return;
      }

      // tipe 'item' (BUKAN pakai_lot_tracking) — tidak ada konsep
      // roll/FIFO/kekurangan-lot di jalur ini.
      const stokSaatIni = parseFloat(target.value.bahan.stok_akhir) || 0;
      if (qty > stokSaatIni) {
        if (!confirm(`Stok saat ini cuma ${formatQty(stokSaatIni)} ${target.value.bahan.satuan_pemakaian || ''}, tapi mau catat pemakaian ${formatQty(qty)}. Stok akan jadi MINUS. Lanjutkan?`)) return;
      }

      menyimpan.value = true;
      try {
        const namaBahan = formatNamaBahan(target.value.bahan);
        const kodeTampil = target.value.bahan.id_tampil || '-';
        const tanggalHariIni = new Date().toISOString().slice(0, 10);

        await catatPergerakanKartuStok({
          bahanId: target.value.bahan.id, namaBahan, tanggal: tanggalHariIni,
          jenis: 'keluar', qty, satuan: target.value.bahan.satuan_pemakaian || '',
          sumber: SUMBER_SCAN_PERSIAPAN, noPembelian: '', keterangan: keteranganGabungSpk()
        });


        const waktu = new Date().toLocaleTimeString('id-ID');
        riwayatSesi.value.unshift({ waktu, nama: namaBahan, kode: kodeTampil, qty: formatQty(qty) + ' ' + (target.value.bahan.satuan_pemakaian || '') });
        alert(`Pemakaian tercatat: ${formatQty(qty)} ${target.value.bahan.satuan_pemakaian || ''} — ${namaBahan} (ID Order: ${spkAktif.value.no_spk}).`);
        batalTarget();
      } catch (e) {
        console.error('Gagal simpan pemakaian (Scan Persiapan):', e);
        alert(e.message || 'Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function muat() {
      isOwner.value = (window.currentUser?.role || '').toLowerCase() === 'owner';
      siapAkses.value = true;
      memuatSpk.value = true;
      daftarSpk.value = await ambilDaftarSpkAktif();
      memuatSpk.value = false;
      if (isOwner.value) {
        daftarBahan.value = await ambilDaftarBahanAksesorisLengkap();
      }
    }
    onMounted(async () => { await window.authReady; await muat(); });
    onUnmounted(tutupScan);

    return {
      siapAkses, isOwner, muat, isMobileDevice, diblokirDesktop, bolehSimpan,
      daftarSpk, memuatSpk, spkEntry, opsiSpkNama, spkAktif, gantiSpk,
      daftarBahan, bahanEntry, opsiBahanNama,
      bahanUntukPilihRoll, daftarLotUntukPilih, memuatLotPilih, pilihRollUntukPemakaian, batalPilihRoll,
      modeScan, videoScanEl, canvasScanEl, scanMemuatKamera, scanError, bukaScan, tutupScan,
      target, qtyDipakai, keteranganPemakaian, menyimpan, batalTarget, simpanPemakaian,
      riwayatSesi, formatQty, formatNamaBahan,
      // popup 3 opsi "Roll/Lot Tidak Cukup".
      kekuranganLot, memprosesKeputusan, tutupKeputusanKekurangan,
      kurangiKeYangTersedia, prosesSebagianDanAjukanSisa, tundaDanAjukanKekurangan
    };
  },
  template: `
    <div v-if="!siapAkses" style="text-align:center; padding:30px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="diblokirDesktop" class="gc-card" style="padding:24px; text-align:center;">
      <i class="fas fa-mobile-screen-button" style="font-size:32px; color:var(--text-faint); margin-bottom:10px;"></i>
      <p style="font-size:13px; font-weight:700; margin-bottom:6px;">Scan Persiapan hanya bisa lewat HP</p>
      <p style="font-size:12px; color:var(--text-faint);">Untuk role Anda, menu ini cuma bisa diakses dari perangkat mobile (HP/tablet) supaya tiap pemakaian barang WAJIB lewat scan barcode fisik. Silakan buka menu Zevanic House &gt; Scan &gt; Scan Persiapan ini lewat HP.</p>
    </div>

    <div v-else>
      <div class="gc-card" style="padding:14px; margin-bottom:14px;">
        <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Scan Persiapan</label>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Catat pemakaian barang buat 1 ID Order — pilih ID Order dulu, lalu scan barang/roll berkali-kali sampai selesai. Riwayat lengkap tetap bisa dilihat di menu Kartu Stok (pilih item yang sama) seperti biasa.</p>

        <div v-if="!spkAktif">
          <div v-if="memuatSpk" style="font-size:12px; color:var(--text-faint);">Memuat daftar Order SPK aktif...</div>
          <div v-else-if="daftarSpk.length === 0" style="font-size:12px; color:var(--text-faint);">Belum ada Order SPK berstatus "Aktif". Tambah dulu lewat menu Zevanic House &gt; Order SPK.</div>
          <div v-else class="gc-field" style="max-width:420px;">
            <label>Pilih ID Order (status Aktif)</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <div style="flex:1;"><dropdown-cari v-model="spkEntry" :opsi="opsiSpkNama" placeholder="Cari ID Order / nama produk..." /></div>
              <button @click="bukaScan('spk')" class="btn-outline" style="padding:9px 12px; font-size:12px; white-space:nowrap;" title="Scan barcode ID Order (label dari menu Order SPK)"><i class="fas fa-qrcode"></i></button>
            </div>
            <p style="font-size:10px; color:var(--text-faint); margin-top:6px;">Bisa cari lewat dropdown, atau scan barcode label ID Order (dicetak dari menu Order SPK) lewat tombol kamera di sebelahnya.</p>
          </div>
        </div>

        <div v-else>
          <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <p style="font-size:12.5px;"><i class="fas fa-clipboard-list" style="color:var(--burgundy); margin-right:6px;"></i>ID Order: <b>{{ spkAktif.no_spk }}</b> — {{ spkAktif.nama_produk }}</p>
            <button @click="gantiSpk" class="btn-outline" style="padding:5px 12px; font-size:11px;">Ganti ID Order</button>
          </div>

          <div v-if="!target">
            <div v-if="isOwner" class="gc-field" style="max-width:420px; margin-bottom:10px;">
              <label>Cari &amp; Pilih Bahan/Aksesoris (khusus Owner)</label>
              <dropdown-cari v-model="bahanEntry" :opsi="opsiBahanNama" placeholder="Cari nama barang..." />
            </div>
            <p v-if="isOwner" style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">— atau —</p>
            <button @click="bukaScan('barang')" class="btn-primary" style="padding:12px 22px; font-size:13px;"><i class="fas fa-qrcode" style="margin-right:8px;"></i>Scan QR</button>

            <div v-if="bahanUntukPilihRoll" style="margin-top:14px;">
              <p style="font-size:12px; font-weight:700; margin-bottom:6px;">Pilih roll yang mau dipakai — {{ bahanUntukPilihRoll.nama }}<span v-if="bahanUntukPilihRoll.warna"> {{ bahanUntukPilihRoll.warna }}</span>:</p>
              <div v-if="memuatLotPilih" style="font-size:12px; color:var(--text-faint);">Memuat daftar roll...</div>
              <div v-else-if="daftarLotUntukPilih.length === 0" style="font-size:12px; color:var(--text-faint);">Belum ada roll aktif tercatat untuk item ini.</div>
              <div v-else style="overflow-x:auto;">
                <table class="gc-table" style="width:100%; font-size:11.5px;">
                  <thead><tr><th>Kode Lot</th><th>Qty Sisa</th><th>Tanggal Masuk</th><th></th></tr></thead>
                  <tbody>
                    <tr v-for="l in daftarLotUntukPilih" :key="l.id">
                      <td>{{ l.kode_lot }}</td>
                      <td>{{ formatQty(l.qty_sisa) }} {{ bahanUntukPilihRoll.satuan_pemakaian }}</td>
                      <td>{{ l.tanggal_masuk || '-' }}</td>
                      <td><button @click="pilihRollUntukPemakaian(l)" class="btn-outline" style="padding:4px 10px; font-size:11px;">Pilih</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button @click="batalPilihRoll" class="btn-outline" style="margin-top:8px; padding:6px 14px; font-size:11.5px;">Batal</button>
            </div>
          </div>

          <div v-else class="gc-field" style="max-width:460px;">
            <div style="background:var(--ivory-dim); border-radius:10px; padding:12px 14px; margin-bottom:12px;">
              <p style="font-size:12.5px; font-weight:700; margin-bottom:2px;">{{ target.bahan.nama }}<span v-if="target.bahan.warna"> {{ target.bahan.warna }}</span></p>
              <p v-if="target.tipe === 'roll'" style="font-size:11.5px; color:var(--text-faint);">Roll: <b>{{ target.lot.kode_lot }}</b> &middot; Qty Sisa: <b>{{ formatQty(target.lot.qty_sisa) }} {{ target.lot.satuan || target.bahan.satuan_pemakaian }}</b></p>
              <p v-else style="font-size:11.5px; color:var(--text-faint);">ID Tampil: <b>{{ target.bahan.id_tampil || '-' }}</b> &middot; Stok Akhir: <b>{{ formatQty(target.bahan.stok_akhir) }} {{ target.bahan.satuan_pemakaian }}</b></p>
            </div>
            <label>Qty yang Dipakai/Diambil</label>
            <input v-model="qtyDipakai" type="number" min="0" step="any" placeholder="0" style="width:100%; padding:9px 13px; border:1.5px solid var(--line); border-radius:10px; font-size:13px; margin-bottom:10px;">
            <label>Keterangan (opsional)</label>
            <textarea v-model="keteranganPemakaian" rows="2" placeholder="Catatan tambahan, kalau ada..." style="width:100%; padding:9px 13px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; margin-bottom:12px;"></textarea>
            <div style="display:flex; gap:8px;">
              <button v-if="bolehSimpan" @click="simpanPemakaian" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:10px; font-size:12.5px;">{{ menyimpan ? 'Menyimpan...' : 'Catat Pemakaian' }}</button>
              <p v-else style="font-size:11.5px; color:var(--text-faint); flex:1;">Akun ini tidak punya izin mencatat pemakaian untuk menu ini.</p>
              <button @click="batalTarget" :disabled="menyimpan" class="btn-outline" style="padding:10px 16px; font-size:12.5px;">Batal</button>
            </div>
          </div>
        </div>
      </div>

      <!--
        popup 3 opsi keputusan saat roll/lot AKTIF (semuanya, bukan cuma yang di-scan) masih
        kurang dari qty yang diminta.
      -->
      <div v-if="kekuranganLot" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="gc-card" style="max-width:420px; width:100%; max-height:90vh; overflow-y:auto;">
          <h3 style="font-weight:700; font-size:15px; margin-bottom:10px;"><i class="fas fa-triangle-exclamation" style="color:var(--danger); margin-right:8px;"></i>Roll/Lot Tidak Cukup</h3>
          <p style="font-size:12px; margin-bottom:14px;">Semua roll aktif <b>{{ target ? formatNamaBahan(target.bahan) : '' }}</b> total cuma sisa <b>{{ formatQty(kekuranganLot.totalTersedia) }} {{ target ? target.bahan.satuan_pemakaian : '' }}</b>, tapi mau dicatat pemakaian <b>{{ formatQty(kekuranganLot.qtyDiminta) }}</b> (kurang {{ formatQty(kekuranganLot.kekurangan) }}). Pilih tindak lanjut:</p>
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

      <div v-if="riwayatSesi.length > 0" class="gc-card" style="padding:14px;">
        <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Sesi Ini</label>
        <p style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">Cuma daftar bantu di layar ini (tidak tersimpan terpisah) — riwayat lengkap &amp; permanen ada di menu Kartu Stok &gt; Riwayat Pergerakan tiap item (pilih itemnya lewat "Ganti Item").</p>
        <div style="overflow-x:auto;">
          <table class="gc-table" style="width:100%; font-size:11.5px;">
            <thead><tr><th>Jam</th><th>Barang</th><th>Kode</th><th>Qty Dipakai</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in riwayatSesi" :key="i">
                <td>{{ r.waktu }}</td><td>{{ r.nama }}</td><td>{{ r.kode }}</td><td>{{ r.qty }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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
        <p style="color:#fff; font-size:12.5px; margin-bottom:14px; text-align:center;">{{ modeScan === 'spk' ? 'Arahkan kamera ke barcode label ID Order' : 'Arahkan kamera ke QR label roll (atau QR item)' }}</p>
        <button @click="tutupScan" class="btn-outline" style="padding:8px 24px; background:#fff;">Batal</button>
      </div>
    </div>
  `
};

const AppScanPersiapan = {
  components: { ScanPersiapanManager },
  template: `<scan-persiapan-manager ref="mgr" />`
};
let vmScanPersiapan = null;
window.pastikanMountScanPersiapan = function() {
  if (vmScanPersiapan) {
    const mgr = vmScanPersiapan.$refs && vmScanPersiapan.$refs.mgr;
    if (mgr && typeof mgr.muat === 'function') mgr.muat();
    return;
  }
  const mountPoint = document.getElementById('vue-scan-persiapan');
  if (mountPoint) vmScanPersiapan = createApp(AppScanPersiapan).mount('#vue-scan-persiapan');
};
