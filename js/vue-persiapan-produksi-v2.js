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
// FASE INI (Fase 1, lihat RENCANA-PERSIAPAN-PRODUKSI-V2.md §7): CUMA
// "Perlu Disiapkan" (generator SPK Grouping) yang fungsional penuh di file
// ini. 5 jalur (Vendor/Bahan/Acc Sewing/Acc Webbing/Acc Finishing) x 5 tahap
// SUDAH punya navigasi lengkap (index.html, sub-tab child-tab, riwayat
// browser aktif) tapi isinya masih placeholder statis "segera hadir" —
// TIDAK ada Vue di baliknya sampai Fase 2-5 (Bahan dulu, lalu 3 Acc, lalu
// Vendor) mengisi logic per jalurnya masing-masing. Keputusan ini SENGAJA
// (PRINSIP-HEMAT: jangan bangun infrastruktur sebelum benar-benar
// dibutuhkan) — bukan kelupaan.
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
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, getDocs, query, where, orderBy, limit, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
