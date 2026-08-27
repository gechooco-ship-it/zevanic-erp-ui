// js/vue-scan-opname.js
// ============================================================================
// BARU (27 Agt 2026, §26.4, Tahap 4) — Zevanic House > Scan > Scan Opname.
// Bagian dari rencana besar "Config, Cetak Label, Order SPK, Scan" yang
// diuraikan & disepakati Guru SEBELUM koding di §26.0 (lihat STATUS-
// PROYEK.md). Tahap 1-3 (Config, Order SPK, Cetak Label) SUDAH dites Guru
// di live & jalan normal sebelum Tahap ini mulai dikerjakan.
//
// APA INI: hitung ulang stok FISIK vs stok SISTEM ("stock opname"), lewat
// scan QR (barcode) — bukan CRUD bebas. Keputusan Guru (§26.0 poin 5 & 7):
//   - Item `pakai_lot_tracking` (qty roll): opname PER ROLL — tiap
//     `kode_lot` dihitung ulang SENDIRI-SENDIRI (bukan 1 angka gabungan per
//     bahan). Scan label fisik roll (QR-nya SAMA dengan yang dicetak lewat
//     menu Cetak Label, §26.3) -> langsung ketemu 1 roll spesifik.
//   - Item BUKAN lot: opname per ITEM, dibandingkan ke `stok_akhir`
//     langsung. Scan QR item (BARU ada sejak §26.3 — item non-lot
//     sebelumnya tidak punya kode/QR sama sekali).
//   - Efek ke stok — Opsi B (Guru pilih setelah diuraikan 2 opsi): SELALU
//     tercatat sebagai pergerakan "Penyesuaian" di ledger
//     `kartu_stok_bahan_aksesoris` yang SUDAH ADA (BUKAN override diam-
//     diam, BUKAN koleksi baru terpisah) — auditable, kelihatan juga di
//     Kartu Stok > Detail > Riwayat Pergerakan punya item itu.
//   - Gating "mobile-only untuk non-Owner" — nyambung ke `window.
//     currentUser.role` yang SUDAH ADA (role === 'owner', pola SAMA
//     seperti Config Akses/Hak Akses/Device Kiosk di js/auth.js — BUKAN
//     mekanisme permission baru): Owner bebas di desktop MAUPUN mobile
//     (boleh cari-pilih item langsung, TIDAK wajib scan). Non-Owner
//     WAJIB mobile (dideteksi lewat `isDesktopBrowser()`, disalin dari
//     js/vue-login.js — konvensi "salin logic kecil per-file" proyek
//     ini) DAN WAJIB scan (tidak ada jalur cari/ketik manual sama sekali
//     buat non-Owner — kalau bukan mobile, halaman ini diblokir total).
//
// SEMUA transaksi yang mengubah stok_akhir/qty_sisa (aturan yang SUDAH
// didokumentasikan di js/vue-stock-pembelian.js: "JANGAN PERNAH update
// stok_akhir langsung dari tempat lain") lewat 2 fungsi BARU yang
// diekspor dari sana: `catatPenyesuaianOpnameItem()` &
// `catatPenyesuaianOpnameLot()` — file INI TIDAK PERNAH tulis stok_akhir/
// qty_sisa langsung.
//
// Kamera/QR pakai `jsQR` (CDN), pola SAMA PERSIS seperti js/vue-kartu-
// stok.js / js/vue-scan-qr.js — disalin ulang ke sini (konvensi "salin
// logic kecil per-file" proyek ini, BUKAN diimpor lintas file).
// `ambilDaftarBahanAksesorisLengkap()`/`formatNamaBahan()` JUGA disalin
// (sama seperti di vue-stock-pembelian.js sendiri — lihat catatan di
// sana, "disalin dari vue-bahan-aksesoris.js/vue-persiapan-masalah.js
// secara sengaja"). Fungsi baca/tulis LOT & stok (`ambilLotAktif`,
// `cariBahanByIdTampil`, `ambilBahanById`, `cariLotByKodeSemuaStatus`,
// `catatPenyesuaianOpnameItem`, `catatPenyesuaianOpnameLot`) DIIMPOR dari
// vue-stock-pembelian.js — itu SATU-SATUNYA file yang boleh nulis
// stok_akhir/qty_sisa (pola SAMA seperti vue-kartu-stok.js yang sudah
// duluan impor fungsi-fungsi serupa dari sana).
// ============================================================================
import { createApp, ref, computed, onMounted, onUnmounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=2';
import {
  ambilLotAktif, cariBahanByIdTampil, ambilBahanById, cariLotByKodeSemuaStatus,
  catatPenyesuaianOpnameItem, catatPenyesuaianOpnameLot
} from './vue-stock-pembelian.js';

const MENU_ID_SCAN_OPNAME = 'scan_opname';

// isDesktopBrowser — disalin dari js/vue-login.js (deteksi User-Agent
// sederhana, dipakai di sana buat gerbang login desktop). TIDAK
// diimpor lintas file, konsisten dengan konvensi proyek ini.
function isDesktopBrowser() {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
// ambilDaftarBahanAksesorisLengkap/formatNamaBahan — disalin dari
// vue-stock-pembelian.js (yang sendiri sudah disalin dari vue-bahan-
// aksesoris.js/vue-persiapan-masalah.js — "disalin secara sengaja",
// lihat catatan di sana).
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

const ScanOpnameManager = {
  components: { DropdownCari },
  setup() {
    const siapAkses = ref(false);
    const isOwner = ref(false);
    const isMobileDevice = ref(!isDesktopBrowser());
    const diblokirDesktop = computed(() => siapAkses.value && !isOwner.value && !isMobileDevice.value);
    const bolehSimpan = computed(() => window.cekIzinMenu(MENU_ID_SCAN_OPNAME, 'edit') !== false);

    // --- Cari & pilih item langsung (KHUSUS Owner — non-Owner tidak
    // punya jalur ini sama sekali, WAJIB scan). ---
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
    // spesifik dari daftar roll AKTIF-nya (opname per roll tetap berlaku
    // walau lewat jalur cari, bukan cuma scan). ---
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
        qtyFisik.value = ''; keteranganOpname.value = '';
        bahanEntry.value = '';
      }
    });
    function pilihRollUntukOpname(lot) {
      target.value = { tipe: 'roll', lot, bahan: bahanUntukPilihRoll.value };
      qtyFisik.value = ''; keteranganOpname.value = '';
      bahanEntry.value = ''; bahanUntukPilihRoll.value = null; daftarLotUntukPilih.value = [];
    }
    function batalPilihRoll() {
      bahanEntry.value = ''; bahanUntukPilihRoll.value = null; daftarLotUntukPilih.value = [];
    }

    // --- Kamera/QR (SEMUA role) — pola SAMA PERSIS seperti js/vue-kartu-
    // stok.js (lihat catatan header file). ---
    const scanAktif = ref(false);
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
    async function bukaScan() {
      scanAktif.value = true;
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
      if (!streamScan || !scanAktif.value) return;
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
      scanAktif.value = false;
      scanError.value = '';
    }
    async function tangkapHasilScan(kode) {
      tutupScan();
      const kodeBersih = (kode || '').trim();
      if (!kodeBersih) return;
      try {
        // Coba dulu sebagai kode_lot (QR label roll — SEMUA status, bukan
        // cuma 'aktif', supaya roll yang di sistem sudah 'habis' tapi
        // ternyata fisiknya masih ada TETAP bisa ditangkap lewat opname).
        const lot = await cariLotByKodeSemuaStatus(kodeBersih);
        if (lot) {
          const bahan = await ambilBahanById(lot.bahan_aksesoris_id);
          if (!bahan) { alert('Data Bahan/Aksesoris untuk roll ini tidak ditemukan.'); return; }
          target.value = { tipe: 'roll', lot, bahan };
          qtyFisik.value = ''; keteranganOpname.value = '';
          return;
        }
        // Bukan kode_lot -> coba sebagai id_tampil item (QR item non-lot,
        // BARU ada sejak menu Cetak Label, §26.3).
        const bahan = await cariBahanByIdTampil(kodeBersih);
        if (!bahan) { alert(`Kode "${kodeBersih}" tidak dikenali — bukan kode roll/lot atau ID Bahan/Aksesoris yang terdaftar.`); return; }
        if (bahan.pakai_lot_tracking) {
          // Item ini pakai Qty per Roll/Lot — opname WAJIB per roll
          // (§26.0 poin 5), bukan level item. Kode yang discan adalah
          // id_tampil ITEM-nya sendiri, bukan roll — kemungkinan salah
          // scan (label lama/tertukar).
          alert(`"${formatNamaBahan(bahan)}" adalah item Qty per Roll/Lot — opname harus PER ROLL, scan label ROLL-nya (bukan kode item).`);
          return;
        }
        target.value = { tipe: 'item', bahan };
        qtyFisik.value = ''; keteranganOpname.value = '';
      } catch (e) {
        console.error('Gagal memproses hasil scan:', e);
        alert('Gagal memproses hasil scan. Coba lagi.');
      }
    }

    // --- Target aktif (hasil scan ATAU hasil pilih roll Owner) + form
    // input qty fisik + simpan. ---
    const target = ref(null); // { tipe:'roll', lot, bahan } | { tipe:'item', bahan }
    const qtyFisik = ref('');
    const keteranganOpname = ref('');
    const menyimpan = ref(false);
    const riwayatSesi = ref([]); // in-memory saja (bukan koleksi baru) — cuma buat kemudahan lihat hasil scan berturut-turut di sesi ini

    function batalTarget() {
      target.value = null; qtyFisik.value = ''; keteranganOpname.value = '';
    }

    async function simpanOpname() {
      if (!target.value) return;
      const qf = parseFloat(qtyFisik.value);
      if (qtyFisik.value === '' || isNaN(qf) || qf < 0) return alert('Isi Qty Fisik yang ditemukan dulu (angka, boleh 0).');
      menyimpan.value = true;
      try {
        let hasil;
        const namaBahan = formatNamaBahan(target.value.bahan);
        const kodeTampil = target.value.tipe === 'roll' ? (target.value.lot.kode_lot || '-') : (target.value.bahan.id_tampil || '-');
        if (target.value.tipe === 'roll') {
          hasil = await catatPenyesuaianOpnameLot({ lotId: target.value.lot.id, qtyFisik: qf, keterangan: keteranganOpname.value.trim() });
        } else {
          hasil = await catatPenyesuaianOpnameItem({
            bahanId: target.value.bahan.id, namaBahan, satuan: target.value.bahan.satuan_pemakaian,
            qtyFisik: qf, keterangan: keteranganOpname.value.trim()
          });
        }
        const waktu = new Date().toLocaleTimeString('id-ID');
        if (hasil.delta === 0) {
          riwayatSesi.value.unshift({ waktu, nama: namaBahan, kode: kodeTampil, teks: 'Sudah sesuai, tidak ada penyesuaian' });
          alert('Stok sudah sesuai — tidak ada penyesuaian yang dicatat.');
        } else {
          const sebelum = target.value.tipe === 'roll' ? hasil.qtySisaSebelum : hasil.stokSebelum;
          const setelah = target.value.tipe === 'roll' ? hasil.qtySisaSetelah : hasil.stokSetelah;
          riwayatSesi.value.unshift({ waktu, nama: namaBahan, kode: kodeTampil, teks: `${hasil.delta > 0 ? '+' : ''}${formatQty(hasil.delta)} (sistem ${formatQty(sebelum)} → fisik ${formatQty(setelah)})` });
          alert(`Penyesuaian tercatat: ${hasil.delta > 0 ? '+' : ''}${formatQty(hasil.delta)}.`);
        }
        batalTarget();
      } catch (e) {
        console.error('Gagal simpan penyesuaian opname:', e);
        alert(e.message || 'Gagal menyimpan penyesuaian. Coba lagi.');
      }
      menyimpan.value = false;
    }

    onMounted(async () => {
      await window.authReady;
      isOwner.value = (window.currentUser?.role || '').toLowerCase() === 'owner';
      siapAkses.value = true;
      if (isOwner.value) {
        daftarBahan.value = await ambilDaftarBahanAksesorisLengkap();
      }
    });
    onUnmounted(tutupScan);

    return {
      siapAkses, isOwner, isMobileDevice, diblokirDesktop, bolehSimpan,
      daftarBahan, bahanEntry, opsiBahanNama,
      bahanUntukPilihRoll, daftarLotUntukPilih, memuatLotPilih, pilihRollUntukOpname, batalPilihRoll,
      scanAktif, videoScanEl, canvasScanEl, scanMemuatKamera, scanError, bukaScan, tutupScan,
      target, qtyFisik, keteranganOpname, menyimpan, batalTarget, simpanOpname,
      riwayatSesi, formatQty
    };
  },
  template: `
    <div v-if="!siapAkses" style="text-align:center; padding:30px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="diblokirDesktop" class="gc-card" style="padding:24px; text-align:center;">
      <i class="fas fa-mobile-screen-button" style="font-size:32px; color:var(--text-faint); margin-bottom:10px;"></i>
      <p style="font-size:13px; font-weight:700; margin-bottom:6px;">Scan Opname hanya bisa lewat HP</p>
      <p style="font-size:12px; color:var(--text-faint);">Untuk role Anda, menu ini cuma bisa diakses dari perangkat mobile (HP/tablet) supaya tiap penyesuaian stok WAJIB lewat scan barcode fisik. Silakan buka menu Zevanic House &gt; Scan &gt; Scan Opname ini lewat HP.</p>
    </div>

    <div v-else>
      <div class="gc-card" style="padding:14px; margin-bottom:14px;">
        <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Scan Opname</label>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Hitung ulang stok fisik lalu bandingkan ke stok sistem. Item Qty per Roll/Lot dihitung PER ROLL (scan label rollnya satu-satu). Selisih tercatat otomatis sebagai pergerakan "Penyesuaian" di Kartu Stok, TIDAK menimpa data diam-diam.</p>

        <div v-if="!target">
          <div v-if="isOwner" class="gc-field" style="max-width:420px; margin-bottom:10px;">
            <label>Cari &amp; Pilih Bahan/Aksesoris (khusus Owner)</label>
            <dropdown-cari v-model="bahanEntry" :opsi="opsiBahanNama" placeholder="Cari nama barang..." />
          </div>
          <p v-if="isOwner" style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">— atau —</p>
          <button @click="bukaScan" class="btn-primary" style="padding:12px 22px; font-size:13px;"><i class="fas fa-qrcode" style="margin-right:8px;"></i>Scan QR</button>

          <div v-if="bahanUntukPilihRoll" style="margin-top:14px;">
            <p style="font-size:12px; font-weight:700; margin-bottom:6px;">Pilih roll yang mau di-opname — {{ bahanUntukPilihRoll.nama }}<span v-if="bahanUntukPilihRoll.warna"> {{ bahanUntukPilihRoll.warna }}</span>:</p>
            <div v-if="memuatLotPilih" style="font-size:12px; color:var(--text-faint);">Memuat daftar roll...</div>
            <div v-else-if="daftarLotUntukPilih.length === 0" style="font-size:12px; color:var(--text-faint);">Belum ada roll aktif tercatat untuk item ini.</div>
            <div v-else style="overflow-x:auto;">
              <table class="gc-table" style="width:100%; font-size:11.5px;">
                <thead><tr><th>Kode Lot</th><th>Qty Sisa (Sistem)</th><th>Tanggal Masuk</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="l in daftarLotUntukPilih" :key="l.id">
                    <td>{{ l.kode_lot }}</td>
                    <td>{{ formatQty(l.qty_sisa) }} {{ bahanUntukPilihRoll.satuan_pemakaian }}</td>
                    <td>{{ l.tanggal_masuk || '-' }}</td>
                    <td><button @click="pilihRollUntukOpname(l)" class="btn-outline" style="padding:4px 10px; font-size:11px;">Pilih</button></td>
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
            <p v-if="target.tipe === 'roll'" style="font-size:11.5px; color:var(--text-faint);">Roll: <b>{{ target.lot.kode_lot }}</b> &middot; Qty Sisa (Sistem): <b>{{ formatQty(target.lot.qty_sisa) }} {{ target.lot.satuan || target.bahan.satuan_pemakaian }}</b><span v-if="target.lot.status !== 'aktif'"> &middot; <span class="tag neutral">Status sistem: Habis</span></span></p>
            <p v-else style="font-size:11.5px; color:var(--text-faint);">ID Tampil: <b>{{ target.bahan.id_tampil || '-' }}</b> &middot; Stok Akhir (Sistem): <b>{{ formatQty(target.bahan.stok_akhir) }} {{ target.bahan.satuan_pemakaian }}</b></p>
          </div>
          <label>Qty Fisik yang Ditemukan</label>
          <input v-model="qtyFisik" type="number" min="0" step="any" placeholder="0" style="width:100%; padding:9px 13px; border:1.5px solid var(--line); border-radius:10px; font-size:13px; margin-bottom:10px;">
          <label>Keterangan (opsional)</label>
          <textarea v-model="keteranganOpname" rows="2" placeholder="Catatan selisih, kalau ada..." style="width:100%; padding:9px 13px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; margin-bottom:12px;"></textarea>
          <div style="display:flex; gap:8px;">
            <button v-if="bolehSimpan" @click="simpanOpname" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:10px; font-size:12.5px;">{{ menyimpan ? 'Menyimpan...' : 'Catat Penyesuaian' }}</button>
            <p v-else style="font-size:11.5px; color:var(--text-faint); flex:1;">Akun ini tidak punya izin mencatat penyesuaian untuk menu ini.</p>
            <button @click="batalTarget" :disabled="menyimpan" class="btn-outline" style="padding:10px 16px; font-size:12.5px;">Batal</button>
          </div>
        </div>
      </div>

      <div v-if="riwayatSesi.length > 0" class="gc-card" style="padding:14px;">
        <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Sesi Ini</label>
        <p style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">Cuma daftar bantu di layar ini (tidak tersimpan terpisah) — riwayat lengkap & permanen ada di Kartu Stok &gt; Detail &gt; Riwayat Pergerakan tiap item.</p>
        <div style="overflow-x:auto;">
          <table class="gc-table" style="width:100%; font-size:11.5px;">
            <thead><tr><th>Jam</th><th>Barang</th><th>Kode</th><th>Hasil</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in riwayatSesi" :key="i">
                <td>{{ r.waktu }}</td><td>{{ r.nama }}</td><td>{{ r.kode }}</td><td>{{ r.teks }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="scanAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
        <div style="width:100%; max-width:340px; aspect-ratio:1/1; background:#111; border-radius:12px; overflow:hidden; position:relative; margin-bottom:16px;">
          <video ref="videoScanEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: scanMemuatKamera }"></video>
          <canvas ref="canvasScanEl" class="hidden"></canvas>
          <div v-if="scanMemuatKamera" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#C9B4A4; text-align:center; padding:16px;">
            <i class="fas fa-qrcode" style="font-size:36px; margin-bottom:10px;"></i>
            <span v-if="scanError" style="color:#F2A0A0; font-size:12px;">{{ scanError }}</span>
            <span v-else style="font-size:12.5px;">Menyiapkan kamera...</span>
          </div>
        </div>
        <p style="color:#fff; font-size:12.5px; margin-bottom:14px; text-align:center;">Arahkan kamera ke QR label roll (atau QR item)</p>
        <button @click="tutupScan" class="btn-outline" style="padding:8px 24px; background:#fff;">Batal</button>
      </div>
    </div>
  `
};

const AppScanOpname = {
  components: { ScanOpnameManager },
  template: `<scan-opname-manager />`
};
let vmScanOpname = null;
window.pastikanMountScanOpname = function() {
  if (vmScanOpname) return;
  const mountPoint = document.getElementById('vue-scan-opname');
  if (mountPoint) vmScanOpname = createApp(AppScanOpname).mount('#vue-scan-opname');
};
