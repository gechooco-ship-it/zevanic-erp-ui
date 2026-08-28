// js/vue-persiapan-produksi.js
// ============================================================================
// BARU (28 Agt 2026) — Zevanic House > Persiapan Produksi. Permintaan Guru
// (verbatim, ringkas): begitu 1 SPK baru masuk, dia dulu mampir ke antrean
// "Perlu Disiapkan" (kartu 1) — kalau di-Approve, sistem generate id turunan
// per komponen dari No. SPK (format `SPK-0001-BHN`/`-SEW`/`-WEB`/`-FIN`,
// disepakati lewat AskUserQuestion) supaya 4 komponen produksi yang sama
// gampang "disatukan" lagi nanti. Kartu 2-5 (Persiapan Bahan / Acc Sewing /
// Acc Webbing / Acc Finishing) menampilkan checklist per komponen, DIISI
// OTOMATIS dari BOM Master Produk yang terhubung ke SPK itu (BUKAN diketik
// manual) — tandai "sudah disiapkan" dilakukan operator/admin LEWAT SCAN
// (menu Scan Persiapan, js/vue-scan-persiapan.js — lihat integrasinya di
// sana, fungsi tandaiPersiapanDariScan()), BUKAN tombol toggle manual di
// sini (keputusan eksplisit Guru lewat AskUserQuestion, opsi "Scan QR lewat
// Scan Persiapan").
//
// 4 KEPUTUSAN ARSITEKTUR (disepakati Guru lewat AskUserQuestion SEBELUM
// kode ini ditulis, lihat STATUS-PROYEK.md untuk narasi lengkap):
//   1. Trigger masuk antrean "Perlu Disiapkan": OTOMATIS begitu SPK BARU
//      disimpan (bukan SPK yang diedit) — lihat js/vue-order-spk.js,
//      buatAntreanPersiapanProduksi(), dipanggil dari simpan().
//   2. Isi hasil Approve: Bahan + Acc SESUAI ISI BOM SAJA — kalau BOM
//      Aksesoris SPK itu cuma punya baris ber-tahap "Sewing" (tidak ada
//      Webbing/Finishing), CUMA kartu "SPK-xxxx-SEW" yang dibuat, 2 lainnya
//      TIDAK dibuat sama sekali (bukan dibuat kosong).
//   3. Format id turunan: `{no_spk}-BHN` (Bahan, dari BOM Pola) /
//      `-SEW` (Acc tahap "Sewing") / `-WEB` (Acc tahap "Webbing") /
//      `-FIN` (Acc tahap "Finishing").
//   4. Tandai "sudah disiapkan": lewat scan QR di menu Scan Persiapan
//      (BUKAN tombol manual di kartu-kartu Persiapan Produksi ini).
//
// KEPUTUSAN SEPIHAK TAMBAHAN (belum eksplisit ditanya, catat di sini biar
// gampang dikoreksi kalau meleset — konsisten pola "keputusan sepihak"
// proyek ini):
//   a. Pencocokan tahap Acc Sewing/Webbing/Finishing dilakukan dengan
//      MENCOCOKKAN TEKS field `tahap_proses` (BOM Aksesoris, Master Produk)
//      case-insensitive & trim, terhadap PERSIS 3 kata: "sewing",
//      "webbing", "finishing". Baris BOM Aksesoris yang tahap_proses-nya
//      TIDAK cocok salah satu dari 3 itu (typo, kosong, atau istilah lain)
//      TIDAK IKUT ke kartu manapun — Guru WAJIB isi field itu (via dropdown
//      "Persiapan Untuk Tahap" di BOM Aksesoris) persis salah satu dari 3
//      kata itu (boleh beda kapitalisasi) supaya baris itu ikut ter-
//      generate. Kalau ternyata kebutuhan sesungguhnya lebih fleksibel
//      (mis. tiap tahap boleh sub-kategori banyak, bukan cuma 3), ini
//      titik yang perlu direvisi.
//   b. Qty kebutuhan tiap baris = qty PER PCS di BOM (Bahan: field
//      `panjang` per baris BOM Pola; Acc: field `qty` per baris BOM
//      Aksesoris) DIKALI `qty_order` SPK — pola "BOM explosion" standar,
//      SAMA logic dasarnya dengan field `kelipatan` yang sudah dibangun
//      sebelumnya (KPK Isi Pola). BELUM ditanyakan eksplisit ke Guru —
//      kalau formula sesungguhnya beda (mis. ada faktor susut/waste %),
//      titik ini yang perlu direvisi.
//   c. Approve HANYA bisa dilakukan kalau SPK sudah terhubung ke Master
//      Produk lewat `sku_produk` (field opsional di Order SPK) — kalau
//      belum, tombol Approve tetap tampil tapi klik-nya cuma menampilkan
//      pesan jelas ("hubungkan dulu lewat Edit di Order SPK"), TIDAK
//      auto-generate BOM kosong/tebakan.
//   d. Approve BERSIFAT SEKALI JALAN per SPK (tombolnya hilang begitu
//      status sudah 'approved') — supaya progres checklist yang sudah
//      dicatat lewat Scan Persiapan TIDAK PERNAH tertimpa/ke-reset oleh
//      Approve ulang. Kalau BOM produk berubah SETELAH Approve, kartu
//      Persiapan Produksi yang sudah ada TIDAK otomatis ikut berubah
//      (perlu penanganan manual/fitur "Approve Ulang" terpisah kalau
//      dibutuhkan ke depan — belum diminta Guru).
//
// Pola file: campuran vue-order-spk.js (paginasi cursor + form dasar) &
// vue-config.js (komponen reusable dipakai berkali-kali beda prop, di sini
// `PersiapanKomponenListManager` dipakai 4x dengan prop `tipe` beda-beda —
// permintaan Guru eksplisit: "menu 2 sd 5 dst. format sama bedanya hanya
// filter data").
// ============================================================================
import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { usePaginasiFirestore } from './vue-paginasi.js';

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
function normalisasiTahap(teks) {
  return (teks || '').trim().toLowerCase();
}
// idAman — ganti karakter "/" (tidak valid buat doc id Firestore) kalau
// ternyata ada No. SPK yang memuatnya — jaga-jaga, bukan pola normal.
function idAman(teks) {
  return String(teks || '').replace(/\//g, '-');
}

// KODE_TAHAP_ACC — daftar 3 tahap Acc yang dikenali sistem (lihat
// "KEPUTUSAN SEPIHAK TAMBAHAN poin a" di atas file ini).
const KODE_TAHAP_ACC = [
  { cocok: 'sewing', kode: 'SEW', tipe: 'sewing' },
  { cocok: 'webbing', kode: 'WEB', tipe: 'webbing' },
  { cocok: 'finishing', kode: 'FIN', tipe: 'finishing' }
];

// LABEL_TIPE — dipakai PersiapanKomponenListManager (judul kartu, badge).
const LABEL_TIPE = {
  bahan: { label: 'Persiapan Bahan', icon: 'fa-scroll' },
  sewing: { label: 'Persiapan Acc Sewing', icon: 'fa-scissors' },
  webbing: { label: 'Persiapan Acc Webbing', icon: 'fa-ribbon' },
  finishing: { label: 'Persiapan Acc Finishing', icon: 'fa-check-double' }
};

// simpanKartuKomponen — tulis (atau timpa, HANYA dipanggil sekali per Approve,
// lihat "KEPUTUSAN SEPIHAK poin d") 1 dokumen `persiapan_komponen`.
function simpanKartuKomponen(antrean, tipe, kode, baris) {
  const id = `${idAman(antrean.no_spk)}-${kode}`;
  return setDoc(doc(db, 'persiapan_komponen', id), {
    spk_id: antrean.spk_id || antrean.id,
    no_spk: antrean.no_spk,
    nama_produk: antrean.nama_produk,
    sku_produk: antrean.sku_produk || '',
    qty_order: antrean.qty_order || 0,
    tipe,
    status: 'proses',
    baris,
    dibuat_pada: serverTimestamp(),
    dibuat_oleh: window.currentUser?.email || null
  });
}

// ---------------------------------------------------------------------------
// PersiapanQueueManager — kartu 1 "Perlu Disiapkan" (antrean SPK baru +
// tombol Approve yang men-generate kartu 2-5 dari BOM).
// ---------------------------------------------------------------------------
const MENU_ID_ANTREAN = 'persiapan_produksi_antrean';
const PersiapanQueueManager = {
  setup() {
    const bolehApprove = computed(() => window.cekIzinMenu(MENU_ID_ANTREAN, 'edit') !== false);
    const sedangApprove = ref(null); // id antrean yang lagi diproses
    const tampilkanApproved = ref(false);

    const paginasi = usePaginasiFirestore(db, 'persiapan_produksi', {
      perHalaman: 15,
      urutkanField: 'no_spk',
      cariField: 'no_spk',
      constraintTambahan: () => tampilkanApproved.value ? [] : [where('status', '==', 'perlu_disiapkan')],
      petakan: (id, d) => ({ id, ...d })
    });

    async function approveAntrean(item) {
      if (!item.sku_produk) {
        alert(`SPK "${item.no_spk}" belum terhubung ke Master Produk (SKU) — hubungkan dulu lewat Edit di menu Order SPK (field "Pilih Produk (SKU)"), supaya BOM produknya bisa dibaca sebelum di-Approve.`);
        return;
      }
      sedangApprove.value = item.id;
      try {
        const snapProduk = await getDocs(query(collection(db, 'master_produk'), where('sku', '==', item.sku_produk)));
        if (snapProduk.empty) {
          alert(`Produk dengan SKU "${item.sku_produk}" tidak ditemukan di Master Produk (mungkin sudah dihapus). Tidak bisa di-Approve — perbaiki dulu sambungan SKU di Order SPK.`);
          return;
        }
        const produk = snapProduk.docs[0].data();
        const qtyOrder = parseFloat(item.qty_order) || 0;

        // Lookup satuan Bahan/Aksesoris (1x per id unik, bukan per baris).
        const idUnik = new Set();
        (produk.bom_pola || []).forEach(b => { if (b.bahan_aksesoris_id) idUnik.add(b.bahan_aksesoris_id); });
        (produk.bom_aksesoris || []).forEach(a => { if (a.bahan_aksesoris_id) idUnik.add(a.bahan_aksesoris_id); });
        const petaSatuan = {};
        await Promise.all(Array.from(idUnik).map(async bid => {
          try {
            const snap = await getDoc(doc(db, 'master_bahan_aksesoris', bid));
            petaSatuan[bid] = snap.exists() ? (snap.data().satuan_pemakaian || '') : '';
          } catch (e) { petaSatuan[bid] = ''; }
        }));

        // Grup Bahan (dari BOM Pola) — lihat "KEPUTUSAN SEPIHAK poin b" atas
        // file ini soal formula qty_dibutuhkan.
        const barisBahan = (produk.bom_pola || [])
          .filter(b => b.nama_bahan)
          .map(b => ({
            nama: b.nama_bahan, warna: b.warna_bahan || '',
            qty_dibutuhkan: (parseFloat(b.panjang) || 0) * qtyOrder,
            satuan: petaSatuan[b.bahan_aksesoris_id] || '',
            qty_disiapkan: 0, selesai: false,
            bahan_aksesoris_id: b.bahan_aksesoris_id || ''
          }));

        // Grup Acc (dari BOM Aksesoris), dikelompokkan per tahap_proses.
        const barisAcc = { sewing: [], webbing: [], finishing: [] };
        (produk.bom_aksesoris || []).forEach(a => {
          if (!a.nama_aksesoris) return;
          const cocok = KODE_TAHAP_ACC.find(k => k.cocok === normalisasiTahap(a.tahap_proses));
          if (!cocok) return; // tahap tidak cocok Sewing/Webbing/Finishing -> dilewati
          barisAcc[cocok.tipe].push({
            nama: a.nama_aksesoris, warna: a.warna || '',
            qty_dibutuhkan: (parseFloat(a.qty) || 0) * qtyOrder,
            satuan: a.satuan || petaSatuan[a.bahan_aksesoris_id] || '',
            qty_disiapkan: 0, selesai: false,
            bahan_aksesoris_id: a.bahan_aksesoris_id || '',
            webbing2: a.webbing2 || '', webbing3: a.webbing3 || ''
          });
        });

        const tulisan = [];
        if (barisBahan.length > 0) tulisan.push(simpanKartuKomponen(item, 'bahan', 'BHN', barisBahan));
        KODE_TAHAP_ACC.forEach(k => {
          if (barisAcc[k.tipe].length > 0) tulisan.push(simpanKartuKomponen(item, k.tipe, k.kode, barisAcc[k.tipe]));
        });

        if (tulisan.length === 0) {
          alert(`Produk "${produk.nama || item.nama_produk}" belum punya isi BOM Pola/Aksesoris sama sekali (atau tahap Acc-nya belum diisi Sewing/Webbing/Finishing) — tidak ada kartu yang bisa di-generate. Lengkapi dulu BOM-nya di Master Produk.`);
          return;
        }
        await Promise.all(tulisan);
        await updateDoc(doc(db, 'persiapan_produksi', item.id), {
          status: 'approved', disetujui_pada: serverTimestamp(), disetujui_oleh: window.currentUser?.email || null
        });
        await paginasi.muatUlang();
        alert(`SPK "${item.no_spk}" disetujui — ${tulisan.length} kartu Persiapan (Bahan/Acc) dibuat.`);
      } catch (e) {
        console.error('Gagal Approve Persiapan Produksi:', e);
        alert('Gagal memproses Approve. Coba lagi.');
      }
      sedangApprove.value = null;
    }

    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });

    return { paginasi, formatQty, bolehApprove, sedangApprove, tampilkanApproved, approveAntrean };
  },
  template: `
    <div class="gc-card" style="padding:14px 14px 4px; margin-bottom:14px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas fa-list-check" style="color:var(--burgundy); margin-right:8px;"></i>Perlu Disiapkan</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Antrean SPK baru — TERISI OTOMATIS begitu Order SPK disimpan. Approve buat generate kartu Persiapan Bahan/Acc Sewing/Webbing/Finishing sesuai isi BOM produk yang terhubung.</p>
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div style="position:relative; max-width:280px; flex:1; min-width:200px;">
          <i class="fas fa-search" style="position:absolute; left:11px; top:11px; color:var(--text-faint); font-size:11px;"></i>
          <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari No. SPK..." style="width:100%; padding:8px 10px 8px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        </div>
        <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--text-muted); cursor:pointer;">
          <input type="checkbox" v-model="tampilkanApproved" @change="paginasi.muatUlang" style="accent-color:var(--burgundy);"> Tampilkan yang sudah di-Approve juga
        </label>
      </div>
    </div>

    <div v-if="paginasi.memuat.value" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="paginasi.errorPaginasi.value" class="gc-card" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
    <div v-else-if="paginasi.dataHalaman.value.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada SPK yang perlu disiapkan.</div>
    <div v-else style="display:grid; gap:12px;" class="grid-cols-1 md:grid-cols-2">
      <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:16px; border-left:4px solid var(--burgundy); position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:10px;">
          <div>
            <div style="font-weight:700; font-size:14px;">{{ item.no_spk }}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">{{ item.nama_produk }}</div>
          </div>
          <span class="tag" :class="item.status === 'approved' ? 'ok' : 'neutral'">{{ item.status === 'approved' ? 'Disetujui' : 'Perlu Disiapkan' }}</span>
        </div>
        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Qty Order</span><span style="font-weight:700;">{{ formatQty(item.qty_order) }} pcs</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">SKU Produk</span><span style="font-weight:700;">{{ item.sku_produk || '(belum terhubung)' }}</span></div>
        </div>
        <button v-if="item.status !== 'approved' && bolehApprove" @click="approveAntrean(item)" :disabled="sedangApprove === item.id" class="btn-primary block" style="font-size:12.5px; padding:9px;">
          <i class="fas fa-check" style="margin-right:6px;"></i>{{ sedangApprove === item.id ? 'Memproses...' : 'Approve — Generate Persiapan' }}
        </button>
        <p v-else-if="item.status !== 'approved'" style="font-size:10.5px; color:var(--text-faint);">Akun ini tidak punya izin Approve untuk menu ini.</p>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin:16px 0;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

// ---------------------------------------------------------------------------
// PersiapanKomponenListManager — kartu 2-5 (Bahan/Acc Sewing/Webbing/
// Finishing). Komponen SATU dipakai 4x (prop `tipe`), "format sama, beda
// filter" persis permintaan Guru. Checklist per baris READ-ONLY di sini —
// ditandai selesai lewat Scan Persiapan (lihat catatan header file).
// ---------------------------------------------------------------------------
const PersiapanKomponenListManager = {
  props: { tipe: { type: String, required: true } },
  setup(props) {
    const infoTipe = computed(() => LABEL_TIPE[props.tipe] || { label: props.tipe, icon: 'fa-box' });
    const paginasi = usePaginasiFirestore(db, 'persiapan_komponen', {
      perHalaman: 15,
      urutkanField: 'no_spk',
      cariField: 'no_spk',
      constraintTambahan: () => [where('tipe', '==', props.tipe)],
      petakan: (id, d) => ({ id, ...d })
    });
    function progres(item) {
      const baris = Array.isArray(item.baris) ? item.baris : [];
      if (baris.length === 0) return 0;
      return Math.round((baris.filter(b => b.selesai).length / baris.length) * 100);
    }
    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });
    return { infoTipe, paginasi, formatQty, progres };
  },
  template: `
    <div class="gc-card" style="padding:14px 14px 4px; margin-bottom:14px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas" :class="infoTipe.icon" style="color:var(--burgundy); margin-right:8px;"></i>{{ infoTipe.label }}</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Checklist otomatis dari BOM (setelah Approve di tab "Perlu Disiapkan"). Tandai "sudah disiapkan" lewat scan di menu Scan Persiapan — bukan di sini.</p>
      <div style="position:relative; max-width:280px; margin-bottom:12px;">
        <i class="fas fa-search" style="position:absolute; left:11px; top:11px; color:var(--text-faint); font-size:11px;"></i>
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari No. SPK..." style="width:100%; padding:8px 10px 8px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
      </div>
    </div>

    <div v-if="paginasi.memuat.value" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="paginasi.errorPaginasi.value" class="gc-card" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
    <div v-else-if="paginasi.dataHalaman.value.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada kartu {{ infoTipe.label }}.</div>
    <div v-else style="display:grid; gap:12px;" class="grid-cols-1 md:grid-cols-2">
      <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:16px; border-left:4px solid var(--burgundy);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
          <div>
            <div style="font-weight:700; font-size:14px;">{{ item.no_spk }}</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">{{ item.nama_produk }}</div>
          </div>
          <span class="tag" :class="item.status === 'selesai' ? 'ok' : 'neutral'">{{ item.status === 'selesai' ? 'Selesai' : 'Proses' }}</span>
        </div>
        <!-- Progress bar — "kartu yg menarik" permintaan Guru, gambaran cepat berapa % sudah disiapkan. -->
        <div style="height:6px; border-radius:4px; background:var(--ivory-dim); overflow:hidden; margin-bottom:10px;">
          <div :style="{ width: progres(item) + '%', height:'100%', background:'var(--burgundy)', transition:'width .3s' }"></div>
        </div>
        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:6px;">
          <div v-for="(b, i) in item.baris" :key="i" style="display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--ivory-dim); border-radius:10px; padding:8px 12px; font-size:12px;">
            <div style="min-width:0;">
              <div style="font-weight:700;">{{ b.nama }}<span v-if="b.warna"> {{ b.warna }}</span></div>
              <div style="color:var(--text-faint); font-size:11px;">{{ formatQty(b.qty_disiapkan) }} / {{ formatQty(b.qty_dibutuhkan) }} {{ b.satuan }}</div>
            </div>
            <i class="fas" :class="b.selesai ? 'fa-circle-check' : 'fa-circle'" :style="{ color: b.selesai ? 'var(--ok, #3a9d5d)' : 'var(--text-faint)', fontSize:'16px', flexShrink:0 }"></i>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin:16px 0;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

const AppPersiapanAntrean = { components: { PersiapanQueueManager }, template: `<persiapan-queue-manager />` };
const AppPersiapanBahan = { components: { PersiapanKomponenListManager }, template: `<persiapan-komponen-list-manager tipe="bahan" />` };
const AppPersiapanSewing = { components: { PersiapanKomponenListManager }, template: `<persiapan-komponen-list-manager tipe="sewing" />` };
const AppPersiapanWebbing = { components: { PersiapanKomponenListManager }, template: `<persiapan-komponen-list-manager tipe="webbing" />` };
const AppPersiapanFinishing = { components: { PersiapanKomponenListManager }, template: `<persiapan-komponen-list-manager tipe="finishing" />` };

let vmPersiapanAntrean = null, vmPersiapanBahan = null, vmPersiapanSewing = null, vmPersiapanWebbing = null, vmPersiapanFinishing = null;
window.pastikanMountPersiapanProduksiAntrean = function() {
  if (vmPersiapanAntrean) return;
  const mountPoint = document.getElementById('vue-persiapan-produksi-antrean');
  if (mountPoint) vmPersiapanAntrean = createApp(AppPersiapanAntrean).mount('#vue-persiapan-produksi-antrean');
};
window.pastikanMountPersiapanProduksiBahan = function() {
  if (vmPersiapanBahan) return;
  const mountPoint = document.getElementById('vue-persiapan-produksi-bahan');
  if (mountPoint) vmPersiapanBahan = createApp(AppPersiapanBahan).mount('#vue-persiapan-produksi-bahan');
};
window.pastikanMountPersiapanProduksiSewing = function() {
  if (vmPersiapanSewing) return;
  const mountPoint = document.getElementById('vue-persiapan-produksi-sewing');
  if (mountPoint) vmPersiapanSewing = createApp(AppPersiapanSewing).mount('#vue-persiapan-produksi-sewing');
};
window.pastikanMountPersiapanProduksiWebbing = function() {
  if (vmPersiapanWebbing) return;
  const mountPoint = document.getElementById('vue-persiapan-produksi-webbing');
  if (mountPoint) vmPersiapanWebbing = createApp(AppPersiapanWebbing).mount('#vue-persiapan-produksi-webbing');
};
window.pastikanMountPersiapanProduksiFinishing = function() {
  if (vmPersiapanFinishing) return;
  const mountPoint = document.getElementById('vue-persiapan-produksi-finishing');
  if (mountPoint) vmPersiapanFinishing = createApp(AppPersiapanFinishing).mount('#vue-persiapan-produksi-finishing');
};
