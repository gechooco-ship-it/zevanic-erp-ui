// js/vue-scan-persiapan.js
// ============================================================================
// BARU (27 Agt 2026, §26.5, Tahap 5 — TAHAP TERAKHIR) — Zevanic House >
// Scan > Scan Persiapan. Bagian dari rencana besar "Config, Cetak Label,
// Order SPK, Scan" yang diuraikan & disepakati Guru SEBELUM koding di
// §26.0 (lihat STATUS-PROYEK.md). Tahap 1-4 SUDAH dites Guru di live &
// jalan normal sebelum Tahap ini mulai dikerjakan.
//
// APA INI (§26.0 poin 8 & 9): jalur BARU buat catat PEMAKAIAN barang,
// terhubung ke No. SPK (Order SPK, §26.2) — lewat scan QR, bukan ketik
// bebas. Guru eksplisit: "Scan Persiapan MENGGANTIKAN cuma AKSI catat
// pemakaian barunya (form qty+keterangan)" — Ringkasan & Detail
// keluar-masuk di Kartu Stok (js/vue-kartu-stok.js) TIDAK disentuh sama
// sekali, tetap ada seperti sekarang buat lihat data. Form "Catat
// Pemakaian" LAMA di Kartu Stok Detail JUGA TIDAK dihapus — tetap jalur
// yang dipakai kalau pemakaian TIDAK terkait SPK tertentu, atau butuh
// alokasi FIFO multi-roll otomatis (lihat catatan "Simplifikasi" di
// bawah).
//
// ALUR:
//   1. Pilih No. SPK dulu (dropdown, WAJIB, difilter status "Aktif" saja
//      — sesuai catatan di vue-order-spk.js). No. SPK TIDAK dibuatkan QR/
//      barcode sendiri (Guru tidak pernah minta ini, beda dari barang/
//      roll) — jadi dropdown biasa, BUKAN scan, berlaku SAMA untuk semua
//      role (bukan cuma Owner) — keputusan sepihak, lihat catatan
//      "KEPUTUSAN SEPIHAK" di bawah.
//   2. Identifikasi barang (item biasa ATAU 1 roll spesifik utk item
//      pakai_lot_tracking) yang dipakai buat SPK itu:
//        - Non-Owner: WAJIB scan QR (kamera) — SAMA PERSIS pola gating
//          `vue-scan-opname.js` (role !== 'owner' + wajib mobile + wajib
//          scan, tidak ada jalur ketik/cari manual sama sekali).
//        - Owner: bebas cari-pilih (dropdown) ATAU scan, desktop maupun
//          mobile — SAMA PERSIS pola Owner di `vue-scan-opname.js`.
//   3. Isi Qty yang dipakai/diambil + keterangan (opsional) -> Catat
//      Pemakaian. Ditulis ke `kartu_stok_bahan_aksesoris` (ledger yang
//      SUDAH ADA) lewat 2 fungsi shared di vue-stock-pembelian.js:
//      `catatPergerakanKartuStok()` (item biasa, jenis:'keluar') /
//      `catatPemakaianDariAlokasi()` (item ber-roll, param BARU `sumber`
//      supaya kelihatan beda dari pemakaian manual desktop — lihat
//      catatan di vue-stock-pembelian.js). File INI TIDAK PERNAH tulis
//      stok_akhir/qty_sisa langsung — aturan "JANGAN PERNAH update
//      stok_akhir langsung dari tempat lain" TETAP dipegang.
//   4. Balik ke langkah 2 (No. SPK yang sama tetap terpilih) — 1 sesi bisa
//      catat banyak barang berturut-turut buat SPK yang sama, sampai
//      user ganti No. SPK sendiri. "Riwayat Sesi Ini" (in-memory saja,
//      sama seperti vue-scan-opname.js) nunjukin apa saja yang sudah
//      dicatat di sesi ini.
//
// KEPUTUSAN SEPIHAK (belum eksplisit ditanya ke Guru, catat di sini biar
// gampang dikoreksi kalau meleset — konsisten dengan pola "keputusan
// sepihak" proyek ini, mis. §25.11):
//   a. No. SPK dipilih lewat DROPDOWN (bukan scan) utk SEMUA role —
//      karena memang tidak ada infrastruktur QR/barcode utk No. SPK
//      sama sekali (beda dari barang/roll yang sudah punya label QR
//      lewat Cetak Label §26.3). Gerbang "wajib scan" §26.0 poin 6 & 9
//      dibaca SPESIFIK utk identifikasi BARANG (yang menentukan APA &
//      BERAPA stok berubah) — bukan utk metadata No. SPK yang sekadar
//      label pengelompokan/audit, tidak mengubah logic stok sama sekali.
//   b. SIMPLIFIKASI alokasi roll: Scan Persiapan CUMA proses 1 roll per
//      transaksi (qty yang diisi dibatasi maksimal `qty_sisa` roll yang
//      dipilih/discan) — TIDAK mereplikasi tabel alokasi FIFO multi-roll
//      + 3 opsi keputusan "kekurangan lot" (kurangi/proses sebagian/
//      tunggu, terhubung Persiapan Masalah) yang ada di form "Catat
//      Pemakaian" desktop (vue-kartu-stok.js). Kalau qty yang dibutuhkan
//      lebih besar dari 1 roll, user cukup scan roll BERIKUTNYA lagi
//      (natural buat alur fisik "ambil dari roll ini abis, lanjut roll
//      itu") — form "Catat Pemakaian" lama di Kartu Stok Detail TETAP
//      ada persis seperti sekarang buat kasus yang butuh alokasi
//      otomatis multi-roll/kekurangan stok.
//
// Gating "mobile-only utk non-Owner" & kamera/QR: SAMA PERSIS pola
// `vue-scan-opname.js` (§26.4) — lihat catatan di file itu, disalin ulang
// ke sini (konvensi "salin logic kecil per-file" proyek ini).
// ============================================================================
import { createApp, ref, computed, onMounted, onUnmounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=2';
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
// ambilDaftarSpkAktif — baca `order_spk` (§26.2), DIFILTER status "Aktif"
// saja (sesuai catatan di vue-order-spk.js). Query 1 field where() saja
// (tidak orderBy field lain) — supaya TIDAK butuh index komposit baru di
// Firestore, urutan ditentukan di sini (client-side, sort by no_spk).
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
// cariSpkByNoSpk — BARU (27 Agt 2026, §26.6). Order SPK (`vue-order-
// spk.js`) SEKARANG bisa cetak label fisik ber-QR isi `no_spk`
// (`cetakSpkList()`, di file itu) — jadi No. SPK SEKARANG JUGA bisa
// discan, BUKAN cuma dropdown lagi (lihat catatan header file, ini
// men-SUPERSEDE "keputusan sepihak poin a" §26.5). Query cari status
// APAPUN (bukan cuma Aktif) — supaya kalau yang discan ternyata SPK
// "Selesai", user dapat pesan jelas (bukan "kode tidak dikenali").
async function cariSpkByNoSpk(noSpk) {
  if (!noSpk) return null;
  const snap = await getDocs(query(collection(db, 'order_spk'), where('no_spk', '==', String(noSpk).trim())));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

const ScanPersiapanManager = {
  components: { DropdownCari },
  setup() {
    const siapAkses = ref(false);
    const isOwner = ref(false);
    const isMobileDevice = ref(!isDesktopBrowser());
    const diblokirDesktop = computed(() => siapAkses.value && !isOwner.value && !isMobileDevice.value);
    const bolehSimpan = computed(() => window.cekIzinMenu(MENU_ID_SCAN_PERSIAPAN, 'edit') !== false);

    // --- Langkah 1: pilih No. SPK — dropdown ATAU scan (BARU §26.6,
    // lihat catatan header file — men-SUPERSEDE "keputusan sepihak poin
    // a" §26.5, SEKARANG No. SPK JUGA punya label ber-QR lewat Order
    // SPK). Tombol scan kecil di sebelah field, tersedia semua role
    // (BUKAN gerbang mobile-only — itu KHUSUS identifikasi BARANG di
    // Langkah 2, No. SPK cuma metadata pengelompokan, sama seperti
    // alasan dropdown tetap ada di semua role). ---
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
    const spkAktif = ref(null); // { id, no_spk, nama_produk, ... } | null
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

    // --- Langkah 2: cari & pilih barang langsung (KHUSUS Owner —
    // non-Owner tidak punya jalur ini sama sekali, WAJIB scan). ---
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

    // --- Item lot-tracked dipilih Owner lewat dropdown -> pilih 1 roll
    // AKTIF spesifik (SAMA seperti vue-scan-opname.js, tapi cuma daftar
    // roll AKTIF — cariLotByKode/ambilLotAktif, BUKAN cariLotByKodeSemua
    // Status seperti Scan Opname, karena buat PEMAKAIAN roll yang sudah
    // 'habis' memang seharusnya tidak bisa dipilih lagi). ---
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

    // --- Kamera/QR (SEMUA role) — pola SAMA PERSIS seperti
    // vue-scan-opname.js / vue-kartu-stok.js. BARU (27 Agt 2026, §26.6):
    // `scanAktif` (boolean) DIGANTI `modeScan` ('spk'|'barang'|null) —
    // SEKARANG ada 2 tujuan scan (No. SPK BARU, barang yang SUDAH ada
    // sejak awal), pola SAMA PERSIS `modeScan` 2-tujuan di
    // vue-kartu-stok.js ('barang'|'roll'). ---
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
        // BARU (27 Agt 2026, §26.6) — scan barcode No. SPK (dicetak lewat
        // vue-order-spk.js, `cetakSpkList()`). Cari TANPA filter status
        // dulu (`cariSpkByNoSpk()`) supaya kalau ternyata SPK-nya sudah
        // "Selesai", user dapat pesan JELAS — bukan "kode tidak dikenali"
        // yang membingungkan.
        try {
          const s = await cariSpkByNoSpk(kodeBersih);
          if (!s) { alert(`No. SPK "${kodeBersih}" tidak ditemukan.`); return; }
          if (s.status !== 'Aktif') { alert(`No. SPK "${s.no_spk}" berstatus "${s.status}" — cuma No. SPK berstatus Aktif yang bisa dipakai buat Scan Persiapan.`); return; }
          pilihSpk(s);
        } catch (e) {
          console.error('Gagal cari No. SPK dari hasil scan:', e);
          alert('Gagal memproses hasil scan. Coba lagi.');
        }
        return;
      }
      // mode === 'barang' (jalur LAMA, TIDAK berubah sama sekali dari §26.5)
      try {
        // Coba dulu sebagai kode_lot (QR label roll, AKTIF saja — roll
        // 'habis' memang seharusnya tidak bisa dipakai lagi, beda dari
        // Scan Opname yang sengaja cari semua status).
        const lot = await cariLotByKode(kodeBersih);
        if (lot) {
          const bahan = await ambilBahanById(lot.bahan_aksesoris_id);
          if (!bahan) { alert('Data Bahan/Aksesoris untuk roll ini tidak ditemukan.'); return; }
          target.value = { tipe: 'roll', lot, bahan };
          qtyDipakai.value = ''; keteranganPemakaian.value = '';
          return;
        }
        // Bukan kode_lot (atau roll-nya sudah habis) -> coba sebagai
        // id_tampil item non-lot (QR dari menu Cetak Label, §26.3).
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

    // --- Target aktif (hasil scan ATAU hasil pilih roll Owner) + form
    // input qty + simpan. ---
    const target = ref(null); // { tipe:'roll', lot, bahan } | { tipe:'item', bahan }
    const qtyDipakai = ref('');
    const keteranganPemakaian = ref('');
    const menyimpan = ref(false);
    const riwayatSesi = ref([]); // in-memory saja (bukan koleksi baru), sama pola vue-scan-opname.js

    function batalTarget() {
      target.value = null; qtyDipakai.value = ''; keteranganPemakaian.value = '';
    }

    async function simpanPemakaian() {
      if (!target.value || !spkAktif.value) return;
      const qty = parseFloat(qtyDipakai.value);
      if (!(qty > 0)) return alert('Isi Qty yang dipakai dulu (harus lebih dari 0).');

      if (target.value.tipe === 'roll') {
        const sisa = parseFloat(target.value.lot.qty_sisa) || 0;
        if (qty > sisa) {
          alert(`Roll ${target.value.lot.kode_lot} cuma sisa ${formatQty(sisa)}, tidak cukup buat ${formatQty(qty)}. Kurangi jumlahnya, atau catat sisanya lewat scan roll LAIN (Scan Persiapan cuma proses 1 roll per pencatatan — lihat catatan di halaman ini).`);
          return;
        }
      } else {
        const stokSaatIni = parseFloat(target.value.bahan.stok_akhir) || 0;
        if (qty > stokSaatIni) {
          if (!confirm(`Stok saat ini cuma ${formatQty(stokSaatIni)} ${target.value.bahan.satuan_pemakaian || ''}, tapi mau catat pemakaian ${formatQty(qty)}. Stok akan jadi MINUS. Lanjutkan?`)) return;
        }
      }

      menyimpan.value = true;
      try {
        const namaBahan = formatNamaBahan(target.value.bahan);
        const kodeTampil = target.value.tipe === 'roll' ? (target.value.lot.kode_lot || '-') : (target.value.bahan.id_tampil || '-');
        const keteranganGabung = `No SPK: ${spkAktif.value.no_spk} — ${spkAktif.value.nama_produk}` + (keteranganPemakaian.value.trim() ? ' — ' + keteranganPemakaian.value.trim() : '');
        const tanggalHariIni = new Date().toISOString().slice(0, 10);

        if (target.value.tipe === 'roll') {
          await catatPemakaianDariAlokasi({
            bahanId: target.value.bahan.id, namaBahan, tanggal: tanggalHariIni,
            qty, satuan: target.value.bahan.satuan_pemakaian || target.value.lot.satuan || '',
            keterangan: keteranganGabung,
            alokasi: [{ lotId: target.value.lot.id, qty }],
            sumber: SUMBER_SCAN_PERSIAPAN
          });
        } else {
          await catatPergerakanKartuStok({
            bahanId: target.value.bahan.id, namaBahan, tanggal: tanggalHariIni,
            jenis: 'keluar', qty, satuan: target.value.bahan.satuan_pemakaian || '',
            sumber: SUMBER_SCAN_PERSIAPAN, noPembelian: '', keterangan: keteranganGabung
          });
        }

        const waktu = new Date().toLocaleTimeString('id-ID');
        riwayatSesi.value.unshift({ waktu, nama: namaBahan, kode: kodeTampil, qty: formatQty(qty) + ' ' + (target.value.bahan.satuan_pemakaian || '') });
        alert(`Pemakaian tercatat: ${formatQty(qty)} ${target.value.bahan.satuan_pemakaian || ''} — ${namaBahan} (No SPK: ${spkAktif.value.no_spk}).`);
        batalTarget();
      } catch (e) {
        console.error('Gagal simpan pemakaian (Scan Persiapan):', e);
        alert(e.message || 'Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    onMounted(async () => {
      await window.authReady;
      isOwner.value = (window.currentUser?.role || '').toLowerCase() === 'owner';
      siapAkses.value = true;
      memuatSpk.value = true;
      daftarSpk.value = await ambilDaftarSpkAktif();
      memuatSpk.value = false;
      if (isOwner.value) {
        daftarBahan.value = await ambilDaftarBahanAksesorisLengkap();
      }
    });
    onUnmounted(tutupScan);

    return {
      siapAkses, isOwner, isMobileDevice, diblokirDesktop, bolehSimpan,
      daftarSpk, memuatSpk, spkEntry, opsiSpkNama, spkAktif, gantiSpk,
      daftarBahan, bahanEntry, opsiBahanNama,
      bahanUntukPilihRoll, daftarLotUntukPilih, memuatLotPilih, pilihRollUntukPemakaian, batalPilihRoll,
      modeScan, videoScanEl, canvasScanEl, scanMemuatKamera, scanError, bukaScan, tutupScan,
      target, qtyDipakai, keteranganPemakaian, menyimpan, batalTarget, simpanPemakaian,
      riwayatSesi, formatQty
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
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Catat pemakaian barang buat 1 No. SPK — pilih No. SPK dulu, lalu scan barang/roll berkali-kali sampai selesai. Riwayat lengkap tetap bisa dilihat di Kartu Stok &gt; Detail seperti biasa.</p>

        <div v-if="!spkAktif">
          <div v-if="memuatSpk" style="font-size:12px; color:var(--text-faint);">Memuat daftar Order SPK aktif...</div>
          <div v-else-if="daftarSpk.length === 0" style="font-size:12px; color:var(--text-faint);">Belum ada Order SPK berstatus "Aktif". Tambah dulu lewat menu Zevanic House &gt; Order SPK.</div>
          <div v-else class="gc-field" style="max-width:420px;">
            <label>Pilih No. SPK (status Aktif)</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <div style="flex:1;"><dropdown-cari v-model="spkEntry" :opsi="opsiSpkNama" placeholder="Cari No. SPK / nama produk..." /></div>
              <button @click="bukaScan('spk')" class="btn-outline" style="padding:9px 12px; font-size:12px; white-space:nowrap;" title="Scan barcode No. SPK (label dari menu Order SPK)"><i class="fas fa-qrcode"></i></button>
            </div>
            <p style="font-size:10px; color:var(--text-faint); margin-top:6px;">Bisa cari lewat dropdown, atau scan barcode label No. SPK (dicetak dari menu Order SPK) lewat tombol kamera di sebelahnya.</p>
          </div>
        </div>

        <div v-else>
          <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <p style="font-size:12.5px;"><i class="fas fa-clipboard-list" style="color:var(--burgundy); margin-right:6px;"></i>No. SPK: <b>{{ spkAktif.no_spk }}</b> — {{ spkAktif.nama_produk }}</p>
            <button @click="gantiSpk" class="btn-outline" style="padding:5px 12px; font-size:11px;">Ganti No. SPK</button>
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

      <div v-if="riwayatSesi.length > 0" class="gc-card" style="padding:14px;">
        <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Sesi Ini</label>
        <p style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">Cuma daftar bantu di layar ini (tidak tersimpan terpisah) — riwayat lengkap & permanen ada di Kartu Stok &gt; Detail &gt; Riwayat Pergerakan tiap item.</p>
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
        <p style="color:#fff; font-size:12.5px; margin-bottom:14px; text-align:center;">{{ modeScan === 'spk' ? 'Arahkan kamera ke barcode label No. SPK' : 'Arahkan kamera ke QR label roll (atau QR item)' }}</p>
        <button @click="tutupScan" class="btn-outline" style="padding:8px 24px; background:#fff;">Batal</button>
      </div>
    </div>
  `
};

const AppScanPersiapan = {
  components: { ScanPersiapanManager },
  template: `<scan-persiapan-manager />`
};
let vmScanPersiapan = null;
window.pastikanMountScanPersiapan = function() {
  if (vmScanPersiapan) return;
  const mountPoint = document.getElementById('vue-scan-persiapan');
  if (mountPoint) vmScanPersiapan = createApp(AppScanPersiapan).mount('#vue-scan-persiapan');
};
