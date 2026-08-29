// js/vue-persiapan-produksi-v2.js
// ============================================================================
// Persiapan Produksi V2 — menu BARU (29 Agt 2026, koreksi arsitektur menu).
// GANTI TOTAL dari js/vue-persiapan-produksi.js (DITINGGALKAN, tidak lagi
// dimuat di index.html — file lama TIDAK dihapus dari disk, cuma tidak
// dipakai lagi, keputusan Guru "ditulis ulang bersih dari nol").
//
// Latar: alur produksi BARU (permintaan Guru, lihat RENCANA-PERSIAPAN-
// PRODUKSI-V2.md untuk desain lengkap) —
//   1. "Perlu Disiapkan": SPK-SPK aktif (order_spk) yang PRODUK & POLA-nya
//      SAMA (nama produk dasar sama, panjang+isi pola BOM sama — supaya
//      kainnya bisa "gelar bersamaan > potong bersamaan") DIKELOMPOKKAN
//      jadi 1 kode "SPK Grouping" (format SPKyymmdd + urutan 3 digit,
//      GLOBAL per hari lintas produk — keputusan Guru, AskUserQuestion).
//   2. Dari 1 SPK Grouping itu, produksi jalan di 5 JALUR PARALEL independen
//      (Vendor/Bahan/Acc Sewing/Acc Webbing/Acc Finishing), masing-masing
//      5 TAHAP (Perlu Diproses -> Sedang Diproses -> Perlu Dikirim -> Sedang
//      Dikirim -> Selesai), digerakkan lewat cetak label + scan (Label SPK
//      Grouping -> Scan Operator, Scan Entry/Scan Masalah, Label Bagging ->
//      Scan Pack, Label Tugas -> Scan Kirim, Scan Sampai -> Selesai).
//
// STATUS PER FASE (lihat RENCANA-PERSIAPAN-PRODUKSI-V2.md §7):
// - Fase 1 — "Perlu Disiapkan" (generator SPK Grouping) — SELESAI.
// - Fase 2 — jalur Bahan (5 tahap + scan, komponen reusable
//   `JalurTahapManager`) — SELESAI.
// - Fase 3 (29 Agt 2026 malam) — 3 jalur Acc (Sewing/Webbing/Finishing) —
//   SELESAI. TIDAK ADA komponen baru: `JalurTahapManager` dipakai APA
//   ADANYA, cuma parameter `jalur` beda (persis sesuai rencana §7 poin 3)
//   — lihat blok mount di bawah `buatAppJalurTahap()`.
// - Fase 4 (29 Agt 2026 malam) — jalur Vendor — SELESAI. §5.D terjawab
//   Guru (driver internal yang sudah biasa belanja = juga jadi kurir
//   kirim+sampai barang vendor, akun+QR yang SAMA, bukan portal terpisah)
//   — 5-tahap generic yang sudah ada CUKUP, TIDAK ada tahap/label
//   tambahan. §5.C SEBAGIAN masih terbuka (field BOM buat deteksi
//   OTOMATIS jalur Vendor + jenis vendor) — jalur Vendor SEMENTARA cuma
//   bisa diaktifkan MANUAL (checkbox "+ Jalur Vendor (manual)", sudah ada
//   sejak Fase 1), belum otomatis dari BOM Aksesoris.
// - Fase 5 — audit menyeluruh referensi lama — belum dimulai.
//
// Kunci grouping — CATATAN PENTING (nyaris jadi bug, ketemu lewat riset
// kode SEBELUM ditulis, lihat STATUS-PROYEK.md §44.13): `order_spk.
// nama_produk` itu STRING GABUNGAN "Nama Warna Size" (lihat vue-order-
// spk.js, pilihProdukSpk()) — TIDAK BISA dipakai langsung buat cocokkan
// "nama produk sama" (2 varian warna beda "nama_produk"-nya walau
// sebenarnya harus tetap bisa digroup, sesuai Guru: "nama produk sama
// walau beda asal bahan sama"). Makanya di sini nama dasar diambil dari
// `master_produk.nama` (field TERPISAH dari warna/size), via `sku_produk`
// tiap SPK. SPK yang TIDAK terhubung ke Master Produk (sku_produk kosong,
// migrasi lama dari spreadsheet) TIDAK BISA dikelompokkan otomatis — tetap
// bisa lanjut sebagai grouping isi 1 SPK sendiri (lihat bagian "Belum Bisa
// Dikelompokkan Otomatis" di UI).
//
// Kunci pola — dari `master_produk.bom_pola[].panjang` + `.isi_pola_pcs`
// (dipakai JUGA oleh field `kelipatan`/KPK di vue-master-produk.js, field
// yang SAMA, cuma cara pakainya beda: kelipatan = KPK semua isi_pola_pcs,
// di sini = tanda-tangan SET pola buat cocokkan antar SKU/produk).
//
// jalur_aktif — dideteksi OTOMATIS dari BOM produk (bom_pola ada isi ->
// jalur 'bahan' aktif; bom_aksesoris.tahap_proses mengandung kata Sewing/
// Webbing/Finishing -> jalur itu aktif). Jalur 'vendor' TIDAK PUNYA sumber
// data BOM yang jelas (field BOM utk vendor MASIH pertanyaan terbuka,
// lihat RENCANA-PERSIAPAN-PRODUKSI-V2.md §5.C — vendor di sini artinya
// pekerjaan sublim/sablon/bordir, BUKAN bom_pola.tipe==='vendor' yang
// sempat jadi dugaan awal KELIRU) — makanya jalur Vendor cuma checkbox
// MANUAL di form pembuatan grouping, bukan hasil deteksi.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, orderBy, limit, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=5';
import { ambilSemuaProduk } from './vue-master-produk.js';

const PETA_JALUR = {
  vendor: { label: 'Vendor', icon: 'fa-handshake', tag: 'pink' },
  bahan: { label: 'Bahan', icon: 'fa-scroll', tag: 'blue' },
  sewing: { label: 'Acc Sewing', icon: 'fa-scissors', tag: 'ok' },
  webbing: { label: 'Acc Webbing', icon: 'fa-ribbon', tag: 'ok' },
  finishing: { label: 'Acc Finishing', icon: 'fa-check-double', tag: 'ok' }
};

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// kunciPolaProduk — tanda-tangan SET pola (panjang+isi_pola_pcs, diurutkan
// supaya urutan input di form Master Produk tidak mempengaruhi hasil
// cocok/tidaknya), baris kosong (panjang=0 & isi=0) diabaikan sama seperti
// hitungKelipatan() di vue-master-produk.js.
function kunciPolaProduk(produk) {
  const baris = (produk?.bom_pola || [])
    .map(b => ({ p: parseFloat(b.panjang) || 0, i: parseFloat(b.isi_pola_pcs) || 0 }))
    .filter(b => b.p > 0 || b.i > 0)
    .sort((a, b) => (a.p - b.p) || (a.i - b.i));
  if (baris.length === 0) return '';
  return baris.map(b => `${b.p}x${b.i}`).join('|');
}

// jalurOtomatisProduk — lihat catatan panjang "jalur_aktif" di atas file
// ini. `tahap_proses` field TEKS BEBAS (bukan strict-select, lihat vue-
// master-produk.js) — dicocokkan longgar (contains, case-insensitive)
// supaya variasi kecil penulisan ("Sewing"/"sewing "/"SEWING") tetap
// kena, TIDAK menggagalkan deteksi cuma karena beda kapital/spasi.
function jalurOtomatisProduk(produk) {
  const jalur = new Set();
  const adaBahan = (produk?.bom_pola || []).some(b => (parseFloat(b.panjang) || 0) > 0 || (parseFloat(b.isi_pola_pcs) || 0) > 0);
  if (adaBahan) jalur.add('bahan');
  (produk?.bom_aksesoris || []).forEach(a => {
    const t = (a.tahap_proses || '').trim().toLowerCase();
    if (!t) return;
    if (t.includes('sewing')) jalur.add('sewing');
    else if (t.includes('webbing')) jalur.add('webbing');
    else if (t.includes('finishing')) jalur.add('finishing');
  });
  return jalur;
}

function buatQrDataUrl(teks) {
  if (typeof QRCode === 'undefined') return '';
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:160px; height:160px;';
  document.body.appendChild(tmp);
  let dataUrl = '';
  try {
    new QRCode(tmp, { text: String(teks || ''), width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
    const canvas = tmp.querySelector('canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Gagal generate QR:', teks, e);
  }
  document.body.removeChild(tmp);
  return dataUrl;
}

// generateKodeSpkGrouping — pola SAMA seperti generateIdBerurutan() di
// vue-bahan-aksesoris.js (runTransaction, wajib supaya counter tidak
// dobel kalau 2 admin generate BERSAMAAN persis di waktu yang sama), TAPI
// counter doc-nya di-KEY per TANGGAL (bukan per kategori) — otomatis
// "reset" tiap hari (keputusan Guru: "Global per hari, lintas produk"),
// tidak perlu job reset manual apapun karena doc baru dibuat begitu
// tanggal berganti.
async function generateKodeSpkGrouping() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const tanggalKey = `${yy}${mm}${dd}`;
  const refDoc = doc(db, 'pengaturan_id_spk_grouping', tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `SPK${tanggalKey}${String(counterBaru).padStart(3, '0')}`;
  });
}

// buatSpkTrackUntukGrouping — BARU (Fase 2, 29 Agt 2026 malam). Begitu 1
// SPK Grouping selesai dibuat, langsung buat 1 dokumen `spk_track` per
// jalur di `jalur_aktif`-nya (status awal SELALU 'perlu_diproses') —
// bukan cuma untuk jalur yang UI-nya sudah jadi (Bahan). Alasan: kalau
// track CUMA dibuat untuk jalur yang kebetulan sudah punya UI saat itu,
// begitu Fase 3/4 mengisi jalur lain nanti, grouping-grouping LAMA yang
// dibuat sebelum Fase itu jalan tidak akan punya track-nya — perlu
// backfill manual. Membuat semua track di awal (murah, cuma beberapa
// dokumen per grouping) menghindari masalah itu sama sekali. Field
// ditulis DENORMALISASI (kode_spk/nama_produk/qty_total disalin dari
// grouping) supaya daftar per-tahap (`JalurTahapManager` di bawah) bisa
// query+tampilkan langsung tanpa baca balik ke `spk_grouping` per baris
// (hemat baca Firestore, PRINSIP-HEMAT).
async function buatSpkTrackUntukGrouping(groupingId, kodeSpk, namaProduk, qtyTotal, jalurAktif) {
  await Promise.all((jalurAktif || []).map(jalur => addDoc(collection(db, 'spk_track'), {
    grouping_id: groupingId,
    kode_spk: kodeSpk,
    nama_produk: namaProduk,
    qty_total: qtyTotal,
    jalur,
    status: 'perlu_diproses',
    operator_id: '',
    operator_nama: '',
    kode_bagging: '',
    kode_tugas: '',
    riwayat_scan: [],
    catatan_masalah: '',
    dibuat_pada: serverTimestamp(),
    diperbarui_pada: serverTimestamp()
  })));
}

// cariKaryawanByQr — DISALIN dari js/vue-absensi-qr.js (prosesHasilScan(),
// baris ~190-200; konvensi "salin logic kecil per-file" proyek ini). QR
// pribadi tiap akun isinya id_app (prioritas) ATAU email (fallback, lihat
// vue-account-profile.js muatAccountDisplay) — email JUGA jadi document
// ID koleksi users, makanya dicoba id_app dulu (query), baru fallback
// getDoc langsung pakai hasil scan sebagai email/doc id.
async function cariKaryawanByQr(qrData) {
  const qSnap = await getDocs(query(collection(db, 'users'), where('id_app', '==', qrData)));
  if (!qSnap.empty) return { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
  const docSnap = await getDoc(doc(db, 'users', qrData));
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
  return null;
}

// muatJsQr — DISALIN dari js/vue-scan-persiapan.js (konvensi yang sama).
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

const PersiapanDisiapkanManager = {
  components: { PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const daftarOrder = ref([]);
    const daftarGroupingTerbaru = ref([]);
    const sedangProses = reactive({});
    const vendorManual = reactive({});
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);

    const menuId = 'pp_disiapkan';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const snapOrder = await getDocs(query(collection(db, 'order_spk'), where('status', '==', 'Aktif')));
        const produk = await ambilSemuaProduk();
        const petaProduk = {};
        produk.forEach(p => { if (p.sku) petaProduk[p.sku] = p; });
        const list = [];
        snapOrder.forEach(d => {
          const data = d.data();
          // Sudah tergrouping sebelumnya -> tidak ikut antrean lagi.
          if (data.id_spk_grouping) return;
          const p = data.sku_produk ? (petaProduk[data.sku_produk] || null) : null;
          const kp = p ? kunciPolaProduk(p) : '';
          const namaBase = p ? (p.nama || '').trim() : '';
          list.push({
            id: d.id, ...data,
            _produk: p,
            _kunciGrup: (p && kp) ? `${namaBase.toLowerCase()}::${kp}` : null,
            _namaBase: namaBase || data.nama_produk || '(tanpa nama)',
            _kunciPolaLabel: kp
          });
        });
        daftarOrder.value = list;
      } catch (e) {
        console.error('Gagal muat antrean Perlu Disiapkan:', e);
        daftarOrder.value = [];
      }
      memuat.value = false;
    }

    async function muatGroupingTerbaru() {
      try {
        const q = query(collection(db, 'spk_grouping'), orderBy('tanggal_generate', 'desc'), limit(20));
        const snap = await getDocs(q);
        daftarGroupingTerbaru.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat SPK Grouping terbaru:', e);
        daftarGroupingTerbaru.value = [];
      }
    }

    // daftarKlaster — kandidat grouping OTOMATIS (>=1 SPK aktif berbagi
    // nama dasar + kunci pola yang SAMA), diurutkan yang anggotanya
    // paling banyak duluan (paling "berharga" digabung, biar operator
    // langsung lihat peluang gelar-kain-bersamaan terbesar dulu).
    const daftarKlaster = computed(() => {
      const peta = {};
      daftarOrder.value.forEach(o => {
        if (!o._kunciGrup) return;
        if (!peta[o._kunciGrup]) {
          peta[o._kunciGrup] = { kunciGrup: o._kunciGrup, namaBase: o._namaBase, kunciPolaLabel: o._kunciPolaLabel, anggota: [] };
        }
        peta[o._kunciGrup].anggota.push(o);
      });
      return Object.values(peta).map(k => ({
        ...k,
        qtyTotal: k.anggota.reduce((s, o) => s + (parseFloat(o.qty_order) || 0), 0),
        jalurOtomatis: Array.from(new Set(k.anggota.flatMap(o => Array.from(jalurOtomatisProduk(o._produk)))))
      })).sort((a, b) => b.anggota.length - a.anggota.length || a.namaBase.localeCompare(b.namaBase));
    });

    // daftarTanpaSku — SPK aktif yang BELUM terhubung Master Produk (SKU
    // kosong, biasanya migrasi lama dari spreadsheet) — tidak bisa dicocok-
    // kan otomatis (tidak ada data BOM buat ambil kunci pola), tapi TETAP
    // perlu jalan lewat "Perlu Disiapkan" (Guru: alur ini berlaku utk semua
    // SPK aktif) — disiapkan sebagai grouping isi 1 SPK sendiri.
    const daftarTanpaSku = computed(() => daftarOrder.value.filter(o => !o._kunciGrup));

    async function buatGrouping(klaster) {
      const key = klaster.kunciGrup;
      if (sedangProses[key]) return;
      sedangProses[key] = true;
      try {
        const kode = await generateKodeSpkGrouping();
        const jalurAktif = Array.from(new Set([...(klaster.jalurOtomatis || []), ...(vendorManual[key] ? ['vendor'] : [])]));
        const breakdown = klaster.anggota.map(o => ({ order_spk_id: o.id, no_spk: o.no_spk, sku_produk: o.sku_produk || '', nama_produk: o.nama_produk, qty: parseFloat(o.qty_order) || 0 }));
        const qtyTotal = breakdown.reduce((s, b) => s + b.qty, 0);
        const skuTerlibat = Array.from(new Set(klaster.anggota.map(o => o.sku_produk).filter(Boolean)));
        const refGrouping = await addDoc(collection(db, 'spk_grouping'), {
          kode_spk: kode,
          nama_produk: klaster.namaBase,
          kunci_pola: klaster.kunciPolaLabel || '',
          sku_produk_terlibat: skuTerlibat,
          qty_total: qtyTotal,
          breakdown,
          jalur_aktif: jalurAktif,
          label_grouping_dicetak: false,
          tanggal_generate: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        });
        await Promise.all(klaster.anggota.map(o => updateDoc(doc(db, 'order_spk', o.id), {
          id_spk_grouping: refGrouping.id, kode_spk_grouping: kode, status_grouping: 'tergrouping'
        })));
        await buatSpkTrackUntukGrouping(refGrouping.id, kode, klaster.namaBase, qtyTotal, jalurAktif);
        delete vendorManual[key];
        await Promise.all([muat(), muatGroupingTerbaru()]);
      } catch (e) {
        console.error('Gagal buat SPK Grouping:', e);
        alert('Gagal membuat SPK Grouping. Coba lagi.');
      }
      sedangProses[key] = false;
    }

    // buatGroupingSendiri — versi buat 1 SPK yang tidak punya kandidat
    // otomatis (baik karena tidak terhubung SKU, maupun karena memang
    // tidak ada SPK lain yang polanya cocok).
    async function buatGroupingSendiri(order) {
      const key = 'single-' + order.id;
      if (sedangProses[key]) return;
      sedangProses[key] = true;
      try {
        const kode = await generateKodeSpkGrouping();
        const jalurAktif = order._produk ? Array.from(jalurOtomatisProduk(order._produk)) : [];
        if (vendorManual[key]) jalurAktif.push('vendor');
        const qty = parseFloat(order.qty_order) || 0;
        const refGrouping = await addDoc(collection(db, 'spk_grouping'), {
          kode_spk: kode,
          nama_produk: order._namaBase,
          kunci_pola: order._kunciPolaLabel || '',
          sku_produk_terlibat: order.sku_produk ? [order.sku_produk] : [],
          qty_total: qty,
          breakdown: [{ order_spk_id: order.id, no_spk: order.no_spk, sku_produk: order.sku_produk || '', nama_produk: order.nama_produk, qty }],
          jalur_aktif: Array.from(new Set(jalurAktif)),
          label_grouping_dicetak: false,
          tanggal_generate: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        });
        await updateDoc(doc(db, 'order_spk', order.id), {
          id_spk_grouping: refGrouping.id, kode_spk_grouping: kode, status_grouping: 'tergrouping'
        });
        await buatSpkTrackUntukGrouping(refGrouping.id, kode, order._namaBase, qty, Array.from(new Set(jalurAktif)));
        delete vendorManual[key];
        await Promise.all([muat(), muatGroupingTerbaru()]);
      } catch (e) {
        console.error('Gagal buat SPK Grouping (mandiri):', e);
        alert('Gagal membuat SPK Grouping. Coba lagi.');
      }
      sedangProses[key] = false;
    }

    function cetakLabelGrouping(item) {
      if (typeof QRCode === 'undefined') {
        alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
        return;
      }
      daftarLabelPreview.value = [{
        kode: item.kode_spk,
        nama: item.nama_produk || '',
        info: `Qty Total: ${formatQty(item.qty_total)} &middot; ${(item.jalur_aktif || []).map(j => PETA_JALUR[j]?.label || j).join(', ')}`,
        qrDataUrl: buatQrDataUrl(item.kode_spk)
      }];
      popupCetakLabelAktif.value = true;
      updateDoc(doc(db, 'spk_grouping', item.id), { label_grouping_dicetak: true }).catch(e => console.error('Gagal catat status cetak label SPK Grouping:', e));
      item.label_grouping_dicetak = true;
    }

    onMounted(async () => {
      await window.authReady;
      await Promise.all([muat(), muatGroupingTerbaru()]);
    });

    return {
      memuat, daftarKlaster, daftarTanpaSku, daftarGroupingTerbaru,
      sedangProses, vendorManual, bolehProses, bolehCetak,
      buatGrouping, buatGroupingSendiri, cetakLabelGrouping,
      popupCetakLabelAktif, daftarLabelPreview,
      formatQty, PETA_JALUR
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px; border-radius:20px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas fa-layer-group" style="color:var(--aksen-ink); margin-right:8px;"></i>Perlu Disiapkan</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 0;">SPK aktif yang produk &amp; pola BOM-nya sama dikelompokkan jadi 1 kode SPK Grouping (bisa gelar &amp; potong kain bersamaan). Kelompokkan dulu di sini sebelum lanjut ke 5 jalur produksi (Vendor/Bahan/Acc Sewing/Acc Webbing/Acc Finishing).</p>
    </div>

    <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else>
      <div v-if="daftarKlaster.length === 0 && daftarTanpaSku.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK aktif yang perlu dikelompokkan</h3>
      </div>

      <div v-if="daftarKlaster.length" style="margin-bottom:6px;">
        <p style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em; margin:10px 2px 8px;">Kandidat Grouping Otomatis ({{ daftarKlaster.length }})</p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="k in daftarKlaster" :key="k.kunciGrup" class="gc-card" style="padding:14px; border-radius:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
              <div style="min-width:0;">
                <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ k.namaBase }}</div>
                <div style="font-size:10.5px; color:var(--text-faint); margin-top:2px;">Kunci Pola: {{ k.kunciPolaLabel || '-' }}</div>
              </div>
              <span class="tag pink" style="flex-shrink:0;">{{ k.anggota.length }} SPK</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; background:var(--ivory-dim); border-radius:10px; padding:8px 12px; margin-bottom:10px;">
              <div v-for="o in k.anggota" :key="o.id" style="display:flex; justify-content:space-between; gap:10px; font-size:11.5px;">
                <span style="color:var(--text-faint);">{{ o.no_spk }}</span>
                <span style="font-weight:700;">{{ formatQty(o.qty_order) }} pcs</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:12px; border-top:1px solid var(--line); margin-top:4px; padding-top:6px;">
                <span style="color:var(--text-faint);">Qty Total</span>
                <span style="font-weight:700;">{{ formatQty(k.qtyTotal) }} pcs</span>
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
              <span v-for="j in k.jalurOtomatis" :key="j" class="tag" :class="PETA_JALUR[j].tag"><i class="fas" :class="PETA_JALUR[j].icon"></i> {{ PETA_JALUR[j].label }}</span>
              <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer; color:var(--text-muted);">
                <input type="checkbox" v-model="vendorManual[k.kunciGrup]" style="accent-color:var(--burgundy); width:14px; height:14px;"> + Jalur Vendor (manual)
              </label>
            </div>

            <button v-if="bolehProses" @click="buatGrouping(k)" :disabled="sedangProses[k.kunciGrup]" class="btn-primary" style="width:100%; padding:10px;">
              <i class="fas fa-layer-group" style="margin-right:6px;"></i>{{ sedangProses[k.kunciGrup] ? 'Memproses...' : 'Buat SPK Grouping' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="daftarTanpaSku.length" style="margin-bottom:6px;">
        <p style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em; margin:16px 2px 8px;">Belum Bisa Dikelompokkan Otomatis ({{ daftarTanpaSku.length }})</p>
        <p style="font-size:10.5px; color:var(--text-faint); margin:-2px 2px 8px;">SPK ini belum terhubung ke Master Produk (SKU kosong) atau produknya belum punya BOM Pola — tidak ada data buat cocokkan otomatis. Tetap bisa lanjut sebagai SPK Grouping isi 1 SPK sendiri.</p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="o in daftarTanpaSku" :key="o.id" class="gc-card" style="padding:14px; border-radius:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
              <div style="min-width:0;">
                <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ o.no_spk }}</div>
                <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ o.nama_produk }} &middot; {{ formatQty(o.qty_order) }} pcs</div>
              </div>
              <span class="tag neutral" style="flex-shrink:0;">{{ o.sku_produk ? 'BOM Pola kosong' : 'Belum ada SKU' }}</span>
            </div>
            <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer; color:var(--text-muted); margin-bottom:10px;">
              <input type="checkbox" v-model="vendorManual['single-' + o.id]" style="accent-color:var(--burgundy); width:14px; height:14px;"> + Jalur Vendor (manual)
            </label>
            <button v-if="bolehProses" @click="buatGroupingSendiri(o)" :disabled="sedangProses['single-' + o.id]" class="btn-outline" style="width:100%; padding:9px;">
              <i class="fas fa-layer-group" style="margin-right:6px;"></i>{{ sedangProses['single-' + o.id] ? 'Memproses...' : 'Buat Grouping Sendiri' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <div style="margin-top:20px;">
      <p style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em; margin:10px 2px 8px;">SPK Grouping Terbaru</p>
      <div v-if="daftarGroupingTerbaru.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-layer-group"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada SPK Grouping dibuat</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in daftarGroupingTerbaru" :key="g.id" class="gc-card" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
            <div style="min-width:0;">
              <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ g.kode_spk }}</div>
              <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ g.nama_produk }} &middot; {{ formatQty(g.qty_total) }} pcs &middot; {{ (g.breakdown||[]).length }} SPK</div>
            </div>
            <span class="tag" :class="g.label_grouping_dicetak ? 'ok' : 'warn'" style="flex-shrink:0;">{{ g.label_grouping_dicetak ? 'Label tercetak' : 'Belum cetak label' }}</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
            <span v-for="j in g.jalur_aktif" :key="j" class="tag" :class="PETA_JALUR[j]?.tag || 'neutral'"><i class="fas" :class="PETA_JALUR[j]?.icon || 'fa-circle'"></i> {{ PETA_JALUR[j]?.label || j }}</span>
          </div>
          <button v-if="bolehCetak" @click="cetakLabelGrouping(g)" class="btn-outline" style="width:100%; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label SPK Grouping</button>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label SPK Grouping" :daftar-label="daftarLabelPreview" @tutup="popupCetakLabelAktif = false" />
  `
};

const AppPersiapanDisiapkan = { components: { PersiapanDisiapkanManager }, template: `<persiapan-disiapkan-manager />` };
let vmPpDisiapkan = null;
window.pastikanMountPpDisiapkan = function() {
  if (vmPpDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-disiapkan');
  if (mountPoint) vmPpDisiapkan = createApp(AppPersiapanDisiapkan).mount('#vue-pp-disiapkan');
};

// ============================================================================
// JalurTahapManager — Fase 2 (29 Agt 2026 malam), jalur Bahan. Komponen
// REUSABLE (prop `jalur`) — sengaja ditulis generik dari awal (bukan
// khusus "bahan") supaya Fase 3 (Acc Sewing/Webbing/Finishing) tinggal
// pasang mount baru dengan `jalur` beda, TIDAK perlu tulis ulang
// komponen ini (sama semangatnya dengan PersiapanKomponenListManager di
// sistem lama yang direuse lewat prop `tipe`).
//
// 1 instance = 1 TAHAP (dipasang 5x independen, 1 per div child-tab,
// sama pola mount-on-demand seperti Config's 8 tab child) — bukan 1
// instance mengurus semua 5 tahap sekaligus, supaya tiap tahap cuma
// query & render kartu yang relevan buat dirinya sendiri.
//
// Target scan per aksi (KEPUTUSAN SEPIHAK, catat di sini biar gampang
// dikoreksi Guru kalau meleset — konsisten pola "keputusan sepihak"
// proyek ini): SEMUA aksi scan (kecuali Scan Operator) scan LABEL FISIK
// yang menempel di batch pada tahap itu (Label SPK Grouping utk Entry/
// Masalah, Label Bagging utk Pack, Label Tugas utk Kirim/Sampai) — bukan
// scan barang/roll individual seperti Scan Persiapan (vue-scan-
// persiapan.js). Alasannya: jalur Bahan ini kerjanya per-BATCH gabungan
// (1 SPK Grouping = 1 hamparan kain), bukan per-item, jadi yang di-scan
// utk konfirmasi ya label batch itu sendiri, bukan makna "pemakaian
// barang" seperti Scan Persiapan yang sudah ada.
// ============================================================================
const TAHAP_URUTAN = ['perlu_diproses', 'sedang_diproses', 'perlu_dikirim', 'sedang_dikirim', 'selesai'];
const LABEL_AKSI_SCAN = {
  operator: 'Scan Operator', entry: 'Scan Entry', masalah: 'Scan Masalah',
  pack: 'Scan Pack', kirim: 'Scan Kirim', sampai: 'Scan Sampai'
};

const JalurTahapManager = {
  components: { PopupPratinjauCetakLabel },
  props: {
    jalur: { type: String, required: true },
    labelJalur: { type: String, required: true },
    tahap: { type: String, required: true },
    labelTahap: { type: String, required: true }
  },
  setup(props) {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const sedangProses = reactive({});
    const menuId = 'pp_' + props.jalur;
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', props.jalur), where('status', '==', props.tahap)));
        daftarTrack.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error(`Gagal muat spk_track (jalur=${props.jalur}, tahap=${props.tahap}):`, e);
        daftarTrack.value = [];
      }
      memuat.value = false;
    }

    // --- Cetak Label Bagging / Label Tugas (perlu_dikirim / sedang_dikirim) ---
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    function cetakLabelBagging(track) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const kodeBagging = track.kode_spk + '-BAG';
      updateDoc(doc(db, 'spk_track', track.id), { kode_bagging: kodeBagging, diperbarui_pada: serverTimestamp() })
        .then(muat)
        .catch(e => console.error('Gagal simpan kode_bagging:', e));
      daftarLabelPreview.value = [{ kode: kodeBagging, nama: track.nama_produk, info: `${track.kode_spk} &middot; Bagging`, qrDataUrl: buatQrDataUrl(kodeBagging) }];
      popupCetakLabelAktif.value = true;
    }
    function cetakLabelTugas(track) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const kodeTugas = track.kode_spk + '-TGS';
      updateDoc(doc(db, 'spk_track', track.id), { kode_tugas: kodeTugas, diperbarui_pada: serverTimestamp() })
        .then(muat)
        .catch(e => console.error('Gagal simpan kode_tugas:', e));
      daftarLabelPreview.value = [{ kode: kodeTugas, nama: track.nama_produk, info: `${track.kode_spk} &middot; Tugas`, qrDataUrl: buatQrDataUrl(kodeTugas) }];
      popupCetakLabelAktif.value = true;
    }

    // --- Kamera/QR — pola SAMA seperti vue-scan-persiapan.js. ---
    const modeScan = ref(null); // salah satu key LABEL_AKSI_SCAN, atau null
    const trackAktifScan = ref(null);
    const videoScanEl = ref(null);
    const canvasScanEl = ref(null);
    const scanMemuatKamera = ref(false);
    const scanError = ref('');
    let streamScan = null;
    let frameScanId = null;

    async function bukaScan(mode, track) {
      if (sedangProses[track.id]) return;
      modeScan.value = mode;
      trackAktifScan.value = track;
      scanMemuatKamera.value = true;
      scanError.value = '';
      try { await muatJsQr(); } catch (e) {
        scanError.value = 'Gagal memuat modul pembaca QR. Cek koneksi internet.';
        scanMemuatKamera.value = false;
        return;
      }
      try {
        streamScan = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoScanEl.value) { videoScanEl.value.srcObject = streamScan; await videoScanEl.value.play(); }
        scanMemuatKamera.value = false;
        pindaiFrameScan();
      } catch (e) {
        scanError.value = 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan.';
        scanMemuatKamera.value = false;
      }
    }
    function pindaiFrameScan() {
      if (!streamScan || !modeScan.value) return;
      const video = videoScanEl.value, canvas = canvasScanEl.value;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
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
      if (streamScan) { streamScan.getTracks().forEach(t => t.stop()); streamScan = null; }
      modeScan.value = null;
      trackAktifScan.value = null;
      scanError.value = '';
    }

    async function tangkapHasilScan(kodeMentah) {
      const mode = modeScan.value;
      const track = trackAktifScan.value;
      tutupScan();
      const kode = (kodeMentah || '').trim();
      if (!kode || !track) return;
      sedangProses[track.id] = true;
      try {
        const oleh = window.currentUser?.email || null;
        const pada = new Date().toISOString();

        if (mode === 'operator') {
          // Gerbang: Label SPK Grouping WAJIB sudah dicetak dulu (Guru:
          // "Label SPK Grouping -> Scan Operator") sebelum operator bisa
          // ditugaskan.
          const groupSnap = await getDoc(doc(db, 'spk_grouping', track.grouping_id));
          if (!groupSnap.exists() || !groupSnap.data().label_grouping_dicetak) {
            alert('Label SPK Grouping belum dicetak. Cetak dulu di menu "Perlu Disiapkan" sebelum Scan Operator.');
            return;
          }
          const karyawan = await cariKaryawanByQr(kode);
          if (!karyawan) { alert('QR tidak dikenali — karyawan tidak ditemukan.'); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            operator_id: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id,
            status: 'sedang_diproses', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'operator', oleh: karyawan.nama || karyawan.name || karyawan.id, pada })
          });
        } else if (mode === 'entry') {
          if (kode !== track.kode_spk) { alert(`Kode yang discan ("${kode}") tidak cocok dengan SPK Grouping ini (${track.kode_spk}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'perlu_dikirim', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'entry', oleh, pada })
          });
        } else if (mode === 'masalah') {
          if (kode !== track.kode_spk) { alert(`Kode yang discan ("${kode}") tidak cocok dengan SPK Grouping ini (${track.kode_spk}).`); return; }
          const catatan = prompt('Jelaskan masalahnya:');
          if (!catatan || !catatan.trim()) return;
          await updateDoc(doc(db, 'spk_track', track.id), {
            catatan_masalah: catatan.trim(), diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'masalah', oleh, pada, catatan: catatan.trim() })
          });
        } else if (mode === 'pack') {
          if (kode !== track.kode_bagging) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Bagging SPK ini (${track.kode_bagging}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'sedang_dikirim', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'pack', oleh, pada })
          });
        } else if (mode === 'kirim') {
          if (kode !== track.kode_tugas) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Tugas SPK ini (${track.kode_tugas}).`); return; }
          // Status TETAP "Sedang Dikirim" (Guru: "SCAN SAMPAI pada proses
          // selanjutnya" yang baru mengubah status) — cuma catat riwayat.
          await updateDoc(doc(db, 'spk_track', track.id), {
            diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'kirim', oleh, pada })
          });
        } else if (mode === 'sampai') {
          if (kode !== track.kode_tugas) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Tugas SPK ini (${track.kode_tugas}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'selesai', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'sampai', oleh, pada })
          });
        }
        await muat();
      } catch (e) {
        console.error('Gagal proses hasil scan:', mode, e);
        alert('Gagal memproses hasil scan. Coba lagi.');
      }
      sedangProses[track.id] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });
    onUnmounted(tutupScan);

    return {
      memuat, daftarTrack, sedangProses, bolehProses, bolehCetak,
      cetakLabelBagging, cetakLabelTugas, popupCetakLabelAktif, daftarLabelPreview,
      modeScan, trackAktifScan, videoScanEl, canvasScanEl, scanMemuatKamera, scanError,
      bukaScan, tutupScan, LABEL_AKSI_SCAN, formatQty
    };
  },
  template: `
    <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="daftarTrack.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-inbox"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK di tahap {{ labelTahap }}</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="t in daftarTrack" :key="t.id" class="gc-card" style="padding:14px; border-radius:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
          <div style="min-width:0;">
            <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ t.kode_spk }}</div>
            <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ t.nama_produk }} &middot; {{ formatQty(t.qty_total) }} pcs</div>
          </div>
          <span class="tag pink" style="flex-shrink:0;">{{ labelJalur }}</span>
        </div>

        <div v-if="t.operator_nama" style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;"><i class="fas fa-user" style="margin-right:6px; color:var(--aksen-ink);"></i>Operator: <b>{{ t.operator_nama }}</b></div>
        <div v-if="t.catatan_masalah" style="font-size:11.5px; color:var(--danger); margin-bottom:8px; background:var(--danger-light); border-radius:8px; padding:6px 10px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ t.catatan_masalah }}</div>

        <!-- Perlu Diproses -->
        <button v-if="tahap==='perlu_diproses' && bolehProses" @click="bukaScan('operator', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="width:100%; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>

        <!-- Sedang Diproses -->
        <div v-if="tahap==='sedang_diproses' && bolehProses" style="display:flex; gap:8px;">
          <button @click="bukaScan('entry', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Entry</button>
          <button @click="bukaScan('masalah', t)" :disabled="sedangProses[t.id]" class="btn-outline" style="flex:1; padding:10px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>Scan Masalah</button>
        </div>

        <!-- Perlu Dikirim -->
        <template v-if="tahap==='perlu_dikirim' && bolehProses">
          <button v-if="!t.kode_bagging" @click="cetakLabelBagging(t)" class="btn-outline" style="width:100%; padding:10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Bagging</button>
          <button v-else @click="bukaScan('pack', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="width:100%; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack ({{ t.kode_bagging }})</button>
        </template>

        <!-- Sedang Dikirim -->
        <template v-if="tahap==='sedang_dikirim' && bolehProses">
          <button v-if="!t.kode_tugas" @click="cetakLabelTugas(t)" class="btn-outline" style="width:100%; padding:10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Tugas</button>
          <div v-else style="display:flex; gap:8px;">
            <button @click="bukaScan('kirim', t)" :disabled="sedangProses[t.id]" class="btn-outline" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
            <button @click="bukaScan('sampai', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
          </div>
          <p style="font-size:10px; color:var(--text-faint); margin-top:6px;">Scan Kirim = dikirim dari sini. Scan Sampai = dikonfirmasi diterima pihak penerima (dilakukan di sini juga untuk Fase 2 — belum ada layar penerima terpisah).</p>
        </template>

        <!-- Selesai: riwayat -->
        <div v-if="tahap==='selesai' && t.riwayat_scan && t.riwayat_scan.length" style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
          <div v-for="(r, i) in t.riwayat_scan" :key="i" style="font-size:10.5px; color:var(--text-faint); display:flex; justify-content:space-between; gap:8px;">
            <span>{{ LABEL_AKSI_SCAN[r.aksi] || r.aksi }}{{ r.oleh ? ' — ' + r.oleh : '' }}</span>
            <span>{{ r.pada ? new Date(r.pada).toLocaleString('id-ID') : '' }}</span>
          </div>
        </div>
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
      <p style="color:#fff; font-size:12.5px; margin-bottom:14px; text-align:center;">{{ LABEL_AKSI_SCAN[modeScan] }} — arahkan kamera ke {{ modeScan==='operator' ? 'QR pribadi karyawan' : 'label QR SPK/Bagging/Tugas' }}</p>
      <button @click="tutupScan" class="btn-outline" style="padding:8px 24px; background:#fff;">Batal</button>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label" :daftar-label="daftarLabelPreview" @tutup="popupCetakLabelAktif = false" />
  `
};

function buatAppJalurTahap(jalur, labelJalur, tahap, labelTahap) {
  return {
    components: { JalurTahapManager },
    template: `<jalur-tahap-manager jalur="${jalur}" label-jalur="${labelJalur}" tahap="${tahap}" label-tahap="${labelTahap}" />`
  };
}

let vmPpBahanPerluDiproses = null;
window.pastikanMountPpBahanPerluDiproses = function() {
  if (vmPpBahanPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-bahan-perludiproses');
  if (mountPoint) vmPpBahanPerluDiproses = createApp(buatAppJalurTahap('bahan', 'Bahan', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-bahan-perludiproses');
};
let vmPpBahanSedangDiproses = null;
window.pastikanMountPpBahanSedangDiproses = function() {
  if (vmPpBahanSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdiproses');
  if (mountPoint) vmPpBahanSedangDiproses = createApp(buatAppJalurTahap('bahan', 'Bahan', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-bahan-sedangdiproses');
};
let vmPpBahanPerluDikirim = null;
window.pastikanMountPpBahanPerluDikirim = function() {
  if (vmPpBahanPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-bahan-perludikirim');
  if (mountPoint) vmPpBahanPerluDikirim = createApp(buatAppJalurTahap('bahan', 'Bahan', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-bahan-perludikirim');
};
let vmPpBahanSedangDikirim = null;
window.pastikanMountPpBahanSedangDikirim = function() {
  if (vmPpBahanSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdikirim');
  if (mountPoint) vmPpBahanSedangDikirim = createApp(buatAppJalurTahap('bahan', 'Bahan', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-bahan-sedangdikirim');
};
let vmPpBahanSelesai = null;
window.pastikanMountPpBahanSelesai = function() {
  if (vmPpBahanSelesai) return;
  const mountPoint = document.getElementById('vue-pp-bahan-selesai');
  if (mountPoint) vmPpBahanSelesai = createApp(buatAppJalurTahap('bahan', 'Bahan', 'selesai', 'Selesai')).mount('#vue-pp-bahan-selesai');
};

// ============================================================================
// Fase 3 (29 Agt 2026, malam) — 3 jalur Acc (Sewing/Webbing/Finishing).
// TIDAK ADA komponen baru ditulis — persis seperti diperkirakan di
// RENCANA-PERSIAPAN-PRODUKSI-V2.md §7 poin 3 ("state machine-nya sama
// persis dengan Fase 2, tinggal parametrisasi jalur"): JalurTahapManager +
// buatAppJalurTahap() (di atas) dipakai APA ADANYA, cuma parameter `jalur`/
// `labelJalur` yang beda. 15 mount function baru (3 jalur x 5 tahap),
// ditulis eksplisit satu-satu (bukan loop) — konsisten gaya kode proyek
// ini (gampang di-grep, gampang ditelusuri 1:1 ke index.html/dashboard.js).
// ============================================================================
let vmPpSewingPerluDiproses = null;
window.pastikanMountPpSewingPerluDiproses = function() {
  if (vmPpSewingPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-sewing-perludiproses');
  if (mountPoint) vmPpSewingPerluDiproses = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-sewing-perludiproses');
};
let vmPpSewingSedangDiproses = null;
window.pastikanMountPpSewingSedangDiproses = function() {
  if (vmPpSewingSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-sewing-sedangdiproses');
  if (mountPoint) vmPpSewingSedangDiproses = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-sewing-sedangdiproses');
};
let vmPpSewingPerluDikirim = null;
window.pastikanMountPpSewingPerluDikirim = function() {
  if (vmPpSewingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-sewing-perludikirim');
  if (mountPoint) vmPpSewingPerluDikirim = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-sewing-perludikirim');
};
let vmPpSewingSedangDikirim = null;
window.pastikanMountPpSewingSedangDikirim = function() {
  if (vmPpSewingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-sewing-sedangdikirim');
  if (mountPoint) vmPpSewingSedangDikirim = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-sewing-sedangdikirim');
};
let vmPpSewingSelesai = null;
window.pastikanMountPpSewingSelesai = function() {
  if (vmPpSewingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-sewing-selesai');
  if (mountPoint) vmPpSewingSelesai = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'selesai', 'Selesai')).mount('#vue-pp-sewing-selesai');
};

let vmPpWebbingPerluDiproses = null;
window.pastikanMountPpWebbingPerluDiproses = function() {
  if (vmPpWebbingPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-webbing-perludiproses');
  if (mountPoint) vmPpWebbingPerluDiproses = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-webbing-perludiproses');
};
let vmPpWebbingSedangDiproses = null;
window.pastikanMountPpWebbingSedangDiproses = function() {
  if (vmPpWebbingSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-webbing-sedangdiproses');
  if (mountPoint) vmPpWebbingSedangDiproses = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-webbing-sedangdiproses');
};
let vmPpWebbingPerluDikirim = null;
window.pastikanMountPpWebbingPerluDikirim = function() {
  if (vmPpWebbingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-webbing-perludikirim');
  if (mountPoint) vmPpWebbingPerluDikirim = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-webbing-perludikirim');
};
let vmPpWebbingSedangDikirim = null;
window.pastikanMountPpWebbingSedangDikirim = function() {
  if (vmPpWebbingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-webbing-sedangdikirim');
  if (mountPoint) vmPpWebbingSedangDikirim = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-webbing-sedangdikirim');
};
let vmPpWebbingSelesai = null;
window.pastikanMountPpWebbingSelesai = function() {
  if (vmPpWebbingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-webbing-selesai');
  if (mountPoint) vmPpWebbingSelesai = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'selesai', 'Selesai')).mount('#vue-pp-webbing-selesai');
};

let vmPpFinishingPerluDiproses = null;
window.pastikanMountPpFinishingPerluDiproses = function() {
  if (vmPpFinishingPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-finishing-perludiproses');
  if (mountPoint) vmPpFinishingPerluDiproses = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-finishing-perludiproses');
};
let vmPpFinishingSedangDiproses = null;
window.pastikanMountPpFinishingSedangDiproses = function() {
  if (vmPpFinishingSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdiproses');
  if (mountPoint) vmPpFinishingSedangDiproses = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-finishing-sedangdiproses');
};
let vmPpFinishingPerluDikirim = null;
window.pastikanMountPpFinishingPerluDikirim = function() {
  if (vmPpFinishingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-finishing-perludikirim');
  if (mountPoint) vmPpFinishingPerluDikirim = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-finishing-perludikirim');
};
let vmPpFinishingSedangDikirim = null;
window.pastikanMountPpFinishingSedangDikirim = function() {
  if (vmPpFinishingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdikirim');
  if (mountPoint) vmPpFinishingSedangDikirim = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-finishing-sedangdikirim');
};
let vmPpFinishingSelesai = null;
window.pastikanMountPpFinishingSelesai = function() {
  if (vmPpFinishingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-finishing-selesai');
  if (mountPoint) vmPpFinishingSelesai = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'selesai', 'Selesai')).mount('#vue-pp-finishing-selesai');
};
// Lihat STATUS-PROYEK.md §44.19 untuk detail Fase 3 (validasi, cross-check
// mount-div/petaMount, catatan uji manual yang masih diperlukan).

// ============================================================================
// Fase 4 (29 Agt 2026, malam) — jalur Vendor. SAMA seperti Fase 3: TIDAK
// ADA komponen baru, `JalurTahapManager` dipakai apa adanya dengan
// jalur='vendor'. Blocker §5.D RENCANA-PERSIAPAN-PRODUKSI-V2.md
// (apakah alur 5-tahap tetap sama walau barang fisik keluar lokasi ke
// vendor luar) SEKARANG TERJAWAB oleh Guru: *"vendor yg scan driver yg
// biasa belanja, karena dia jg kurir yg kirim dan sampai barang"* —
// driver INTERNAL (akun karyawan biasa, QR pribadi yang sama, BUKAN akun
// vendor eksternal terpisah) yang scan SEMUA aksi jalur ini (dia juga
// yang antar-jemput fisik ke vendor), jadi 5-tahap generic yang sudah ada
// (Scan Operator/Entry/Pack/Kirim/Sampai) SUDAH CUKUP tanpa tahap/label
// tambahan — persis pola Bahan/Acc, bukan alur baru.
//
// §5.C SEBAGIAN terjawab (siapa yang scan) — TAPI bagian lain §5.C
// (field baru di BOM Aksesoris Master Produk buat deteksi OTOMATIS jalur
// Vendor + jenis vendor Sublim/Sablon/Bordir) BELUM dijawab Guru, jadi
// SENGAJA BELUM dibangun (bukan lupa) — jalur Vendor tetap pakai jalur
// OPT-IN MANUAL yang sudah ada sejak Fase 1 (checkbox "+ Jalur Vendor
// (manual)" di form pembuatan grouping, `vendorManual`), BUKAN deteksi
// otomatis dari BOM. Ini sudah cukup buat jalur Vendor berfungsi
// end-to-end sekarang — deteksi otomatis BOM cuma kenyamanan tambahan
// buat nanti kalau Guru mau, bukan syarat wajib.
// ============================================================================
let vmPpVendorPerluDiproses = null;
window.pastikanMountPpVendorPerluDiproses = function() {
  if (vmPpVendorPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-vendor-perludiproses');
  if (mountPoint) vmPpVendorPerluDiproses = createApp(buatAppJalurTahap('vendor', 'Vendor', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-vendor-perludiproses');
};
let vmPpVendorSedangDiproses = null;
window.pastikanMountPpVendorSedangDiproses = function() {
  if (vmPpVendorSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-vendor-sedangdiproses');
  if (mountPoint) vmPpVendorSedangDiproses = createApp(buatAppJalurTahap('vendor', 'Vendor', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-vendor-sedangdiproses');
};
let vmPpVendorPerluDikirim = null;
window.pastikanMountPpVendorPerluDikirim = function() {
  if (vmPpVendorPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-vendor-perludikirim');
  if (mountPoint) vmPpVendorPerluDikirim = createApp(buatAppJalurTahap('vendor', 'Vendor', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-vendor-perludikirim');
};
let vmPpVendorSedangDikirim = null;
window.pastikanMountPpVendorSedangDikirim = function() {
  if (vmPpVendorSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-vendor-sedangdikirim');
  if (mountPoint) vmPpVendorSedangDikirim = createApp(buatAppJalurTahap('vendor', 'Vendor', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-vendor-sedangdikirim');
};
let vmPpVendorSelesai = null;
window.pastikanMountPpVendorSelesai = function() {
  if (vmPpVendorSelesai) return;
  const mountPoint = document.getElementById('vue-pp-vendor-selesai');
  if (mountPoint) vmPpVendorSelesai = createApp(buatAppJalurTahap('vendor', 'Vendor', 'selesai', 'Selesai')).mount('#vue-pp-vendor-selesai');
};
// Lihat STATUS-PROYEK.md §44.20 untuk detail Fase 4.
