// js/vue-pesanan.js
// ============================================================================
// Pesanan — grup top-level BARU (30 Agt 2026), sejajar Zevanic House/
// Persiapan Produksi. Spesifikasi final Guru (verbatim, setelah 1 ronde
// AskUserQuestion garbled/interrupted lalu disusulkan ulang lengkap):
//   "Pesaanan (Menu Group Baru), didalam group menu pesanan adalah:
//    1. Order SPK (ganti nama jadi Penjualan Kasir) > tampilan seperti
//       request order
//    2. Menunggu Proses
//    3. Proses Persiapan (ringkasan data tarikan dari proses persiapan
//       produksi)
//    4. Proses Produksi (ringkasan data tarikan dari proses persiapan
//       produksi)
//    5. Proses Pengiriman"
// + "iyah kita implementasikan pada zevanic erp > yg saya suruh tadi cuman
//    desain mockup" (mockup di zco.solusiumkm.digital/admin, BUKAN bagian
//    proyek ini, cuma referensi visual "tampilan seperti request order" —
//    tab kategori produk + grid produk + panel keranjang dgn pelanggan/
//    metode bayar/total/tombol "Buat Order").
//
// 4 KEPUTUSAN ARSITEKTUR (AskUserQuestion, dijawab jelas Guru) yang
// membentuk kode di bawah:
//   Q1. Fungsi lama Order SPK (list/edit/hapus/cetak label) pindah ke mana?
//       -> "Jadi bagian menu 'Menunggu Proses'". DISALIN (bukan diimpor)
//       dari js/vue-order-spk.js ke PesananMenungguManager di bawah, id
//       menu lama 'order_spk' DIPENSIUNKAN (lihat js/vue-config-akses.js),
//       js/vue-order-spk.js TIDAK LAGI dimuat di index.html (file
//       dibiarkan ada di disk, pola sama seperti vue-persiapan-produksi.js
//       lama).
//   Q2. Data transaksi Kasir disimpan bagaimana? -> "Koleksi baru khusus
//       transaksi Kasir (Direkomendasikan)". Koleksi BARU `transaksi_kasir`
//       (no_transaksi/nama_pelanggan/metode_pembayaran/items[]/total/
//       status) + OTOMATIS bikin 1 dokumen `order_spk` PER ITEM keranjang
//       (SPK BIASA, field/skema TIDAK berubah sama sekali) begitu "Buat
//       Order" ditekan — supaya order dari Kasir mengalir TANPA UBAHAN ke
//       pipeline Persiapan Produksi yang sudah ada (spk_grouping/
//       spk_track dst).
//   Q3. Apa beda "Proses Persiapan" vs "Proses Produksi"? -> "Persiapan =
//       jalur Vendor+Bahan, Produksi = jalur Sewing+Webbing+Finishing".
//       Keduanya "ringkasan data tarikan dari proses persiapan produksi"
//       (kutipan Guru) — jadi DIBUAT READ-ONLY (tidak ada tombol scan/aksi
//       seperti JalurTahapManager, itu tetap di menu "Persiapan Produksi"
//       aslinya), cuma ringkasan angka + daftar + tombol lompat ke jalur
//       aslinya.
//   Q4. Harga jual produk dari mana? -> "Field 'Harga Jual' baru di Master
//       Produk" (master_produk SEBELUMNYA 100% data BOM/ongkos produksi,
//       nol field harga jual — lihat js/vue-master-produk.js, field
//       `harga_jual` baru ditambahkan di sana bersamaan dgn fitur ini).
//
// 3 HAL YANG BELUM PERNAH EKSPLISIT DIKONFIRMASI GURU (diputuskan sendiri
// di sini dgn asumsi masuk akal, DIFLAG di STATUS-PROYEK.md & pesan
// laporan — BUKAN ditebak diam-diam, sesuai prinsip proyek "jangan bikin
// tebak2"):
//   A. Nama & skema koleksi Kasir: `transaksi_kasir` + counter harian
//      `pengaturan_id_transaksi_kasir` (format no_transaksi: TRXyymmdd +
//      urutan 3 digit, pola SAMA PERSIS seperti generateKodeSpkGrouping()
//      di vue-persiapan-produksi-v2.js).
//   B. Lingkup query "Proses Pengiriman": SEMUA jalur, status IN
//      ['perlu_dikirim','sedang_dikirim'] (tahap "lagi dalam proses
//      kirim", lintas jalur Vendor/Bahan/Sewing/Webbing/Finishing) — BUKAN
//      cuma jalur tertentu, karena kata "Pengiriman" cocok dengan NAMA
//      TAHAP di pipeline (bukan nama jalur seperti Persiapan/Produksi di
//      atas).
//   C. Urutan posisi grup sidebar "Pesanan": setelah "Zevanic House",
//      sebelum "Persiapan Produksi" (lihat KATEGORI_URUTAN di
//      vue-config-akses.js) — mengikuti alur kerja (Kasir jual -> SPK ->
//      Persiapan Produksi kerjakan).
//
// Query spk_track di komponen ringkasan (Persiapan/Produksi/Pengiriman) di
// bawah SENGAJA cuma pakai SATU filter 'in' per query (jalur SAJA, atau
// status SAJA — TIDAK PERNAH gabung keduanya dalam 1 query) — supaya TIDAK
// butuh index komposit manual di Firebase Console (index komposit baru
// itu selalu jadi blocker yang harus Guru tempel manual, lihat pola
// berulang di proyek ini). Grouping kedua (per-jalur di Pengiriman,
// per-status di Persiapan/Produksi) dihitung CLIENT-SIDE dari hasil query
// tunggal itu.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { usePaginasiFirestore } from './vue-paginasi.js';
import { PopupPratinjauCetakLabel, DropdownCari } from './vue-components.js?v=5';
import { ambilSemuaProduk } from './vue-master-produk.js';

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
// formatRupiah — DISALIN dari js/vue-master-produk.js (konvensi "salin
// logic kecil per-file" proyek ini, tidak ada util currency global).
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
// buatQrDataUrl — DISALIN dari js/vue-order-spk.js / vue-persiapan-
// produksi-v2.js (pola sama, lihat catatan panjang di file-file itu).
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

// ============================================================================
// 1. PENJUALAN KASIR (dulu "Order SPK", tampilan POS ala mockup Request
//    Order). Simpan 1 dokumen `transaksi_kasir` + N dokumen `order_spk`
//    (1 per item keranjang) sekaligus.
// ============================================================================
const METODE_PEMBAYARAN_OPSI = ['Tunai', 'Transfer', 'QRIS', 'Lainnya'];

// generateNoTransaksiKasir — pola SAMA PERSIS seperti generateKodeSpkGrouping()
// di js/vue-persiapan-produksi-v2.js (runTransaction, counter di-key per
// tanggal, reset otomatis tiap hari ganti). Lihat asumsi "A" di komentar
// besar atas file ini.
async function generateNoTransaksiKasir() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const tanggalKey = `${yy}${mm}${dd}`;
  const refDoc = doc(db, 'pengaturan_id_transaksi_kasir', tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `TRX${tanggalKey}${String(counterBaru).padStart(3, '0')}`;
  });
}

function formatLabelProduk(p) {
  return [p.nama, p.warna, p.size].filter(Boolean).join(' ');
}

const PesananKasirManager = {
  setup() {
    const menuId = 'pesanan_kasir';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);

    const memuatProduk = ref(true);
    const daftarProduk = ref([]);
    const kategoriAktif = ref('Semua');
    const cariProduk = ref('');

    const daftarKategori = computed(() => {
      const set = new Set(daftarProduk.value.map(p => p.jenis_produk).filter(Boolean));
      return ['Semua', ...Array.from(set).sort()];
    });
    const produkTampil = computed(() => {
      const kata = cariProduk.value.trim().toLowerCase();
      return daftarProduk.value.filter(p => {
        if (kategoriAktif.value !== 'Semua' && p.jenis_produk !== kategoriAktif.value) return false;
        if (!kata) return true;
        return formatLabelProduk(p).toLowerCase().includes(kata) || (p.sku || '').toLowerCase().includes(kata);
      });
    });

    // keranjang — object polos (bukan array) dikunci per SKU, supaya
    // tambah produk yang sama tinggal qty++ (pola sama seperti
    // dicentangTabel di OrderSpkManager, cuma isinya beda).
    const keranjang = reactive({});
    const daftarKeranjang = computed(() => Object.values(keranjang));
    const totalBelanja = computed(() => daftarKeranjang.value.reduce((total, i) => total + (i.qty * i.harga_satuan), 0));
    const totalItem = computed(() => daftarKeranjang.value.reduce((total, i) => total + i.qty, 0));

    function tambahKeKeranjang(produk) {
      if (keranjang[produk.sku]) { keranjang[produk.sku].qty++; return; }
      keranjang[produk.sku] = {
        sku: produk.sku,
        nama: formatLabelProduk(produk),
        harga_satuan: parseFloat(produk.harga_jual) || 0,
        qty: 1
      };
    }
    function tambahQty(sku) { if (keranjang[sku]) keranjang[sku].qty++; }
    function kurangiQty(sku) {
      if (!keranjang[sku]) return;
      keranjang[sku].qty--;
      if (keranjang[sku].qty <= 0) delete keranjang[sku];
    }
    function hapusDariKeranjang(sku) { delete keranjang[sku]; }
    function kosongkanKeranjang() { Object.keys(keranjang).forEach(k => delete keranjang[k]); }

    const namaPelanggan = ref('');
    const metodePembayaran = ref('Tunai');
    const menyimpan = ref(false);

    async function buatOrder() {
      if (daftarKeranjang.value.length === 0) return alert('Keranjang masih kosong. Pilih produk dulu.');
      menyimpan.value = true;
      try {
        const noTransaksi = await generateNoTransaksiKasir();
        const itemsSiap = daftarKeranjang.value.map(i => ({
          sku_produk: i.sku,
          nama_produk: i.nama,
          qty: i.qty,
          harga_satuan: i.harga_satuan,
          subtotal: i.qty * i.harga_satuan
        }));
        const totalSiap = itemsSiap.reduce((t, i) => t + i.subtotal, 0);

        await addDoc(collection(db, 'transaksi_kasir'), {
          no_transaksi: noTransaksi,
          nama_pelanggan: namaPelanggan.value.trim(),
          metode_pembayaran: metodePembayaran.value,
          items: itemsSiap,
          total: totalSiap,
          status: 'Aktif',
          dibuat_pada: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        });

        // buatOrder -> N dokumen order_spk (1 per item), field/skema SAMA
        // PERSIS seperti Order SPK manual (lihat Q2 di komentar besar atas
        // file ini) — no_spk = "{no_transaksi}-{urutan item}", UNIK karena
        // no_transaksi sendiri sudah unik (counter transaksi).
        const tanggalHariIni = new Date().toISOString().slice(0, 10);
        await Promise.all(itemsSiap.map((it, idx) => addDoc(collection(db, 'order_spk'), {
          no_spk: `${noTransaksi}-${idx + 1}`,
          sku_produk: it.sku_produk,
          nama_produk: it.nama_produk,
          qty_order: it.qty,
          tanggal: tanggalHariIni,
          status: 'Aktif',
          dibuat_pada: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        })));

        alert(`Order Kasir ${noTransaksi} tersimpan (${formatRupiah(totalSiap)}). ${itemsSiap.length} SPK otomatis dibuat, sudah masuk ke menu "Menunggu Proses".`);
        kosongkanKeranjang();
        namaPelanggan.value = '';
        metodePembayaran.value = 'Tunai';
      } catch (e) {
        console.error('Gagal membuat Order Kasir:', e);
        alert('Gagal membuat order. Coba lagi.');
      }
      menyimpan.value = false;
    }

    onMounted(async () => {
      await window.authReady;
      memuatProduk.value = true;
      try {
        daftarProduk.value = await ambilSemuaProduk();
      } catch (e) {
        console.error('Gagal muat daftar produk buat Kasir:', e);
      }
      memuatProduk.value = false;
    });

    return {
      bolehTambah, memuatProduk, daftarProduk, kategoriAktif, cariProduk,
      daftarKategori, produkTampil, keranjang, daftarKeranjang, totalBelanja, totalItem,
      tambahKeKeranjang, tambahQty, kurangiQty, hapusDariKeranjang, kosongkanKeranjang,
      namaPelanggan, metodePembayaran, METODE_PEMBAYARAN_OPSI, menyimpan, buatOrder,
      formatRupiah
    };
  },
  template: `
    <div v-if="!bolehTambah" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12.5px;">Akun ini tidak punya izin untuk Penjualan Kasir.</div>
    <div v-else style="display:flex; flex-direction:column; gap:14px;">
      <div class="gc-card" style="padding:14px; border-radius:20px;">
        <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-bottom:12px; max-width:360px;">
          <i class="fas fa-magnifying-glass" style="font-size:13px; color:var(--text-faint); flex-shrink:0;"></i>
          <input v-model="cariProduk" type="text" placeholder="Cari produk / SKU..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
        </div>
        <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; margin-bottom:12px;" class="no-scrollbar">
          <button v-for="k in daftarKategori" :key="k" @click="kategoriAktif = k" class="btn-outline" :class="{filled: kategoriAktif === k}" style="font-size:11.5px; padding:6px 14px; white-space:nowrap; flex-shrink:0;">{{ k }}</button>
        </div>

        <div v-if="memuatProduk" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat produk...</div>
        <div v-else-if="produkTampil.length === 0" class="gc-kosong">
          <div class="lingkaran"><i class="fas fa-box-open"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada produk cocok</h3>
        </div>
        <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px;">
          <button v-for="p in produkTampil" :key="p.sku" @click="tambahKeKeranjang(p)" type="button" class="gc-card" style="padding:10px; border-radius:16px; text-align:left; cursor:pointer; border:1.5px solid var(--line);">
            <img v-if="p.foto" :src="p.foto" style="width:100%; height:84px; object-fit:cover; border-radius:10px; margin-bottom:8px;">
            <div v-else style="width:100%; height:84px; border-radius:10px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; margin-bottom:8px;"><i class="fas fa-tshirt" style="color:var(--text-faint); font-size:20px;"></i></div>
            <div style="font-weight:700; font-size:12px; line-height:1.3; margin-bottom:2px;">{{ p.nama }}</div>
            <div style="font-size:10.5px; color:var(--text-muted); margin-bottom:4px;">{{ p.warna }} &middot; {{ p.size }}</div>
            <div style="font-weight:700; font-size:12.5px; color:var(--burgundy);">{{ p.harga_jual > 0 ? formatRupiah(p.harga_jual) : 'Harga belum diisi' }}</div>
          </button>
        </div>
      </div>

      <div class="gc-card" style="padding:14px; border-radius:20px;">
        <h3 style="font-weight:700; font-size:13.5px; margin-bottom:10px;"><i class="fas fa-cash-register" style="color:var(--aksen-ink); margin-right:8px;"></i>Keranjang ({{ totalItem }})</h3>

        <div v-if="daftarKeranjang.length === 0" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Keranjang masih kosong — klik produk di atas buat menambahkan.</div>
        <div v-else style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
          <div v-for="i in daftarKeranjang" :key="i.sku" style="display:flex; align-items:center; gap:8px; background:var(--ivory-dim); border-radius:12px; padding:8px 10px;">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:12px;">{{ i.nama }}</div>
              <div style="font-size:10.5px; color:var(--text-muted);">{{ formatRupiah(i.harga_satuan) }} / pcs</div>
            </div>
            <button @click="kurangiQty(i.sku)" type="button" class="icon-btn" style="width:26px; height:26px;"><i class="fas fa-minus" style="font-size:10px;"></i></button>
            <span style="font-size:12.5px; font-weight:700; min-width:22px; text-align:center;">{{ i.qty }}</span>
            <button @click="tambahQty(i.sku)" type="button" class="icon-btn" style="width:26px; height:26px;"><i class="fas fa-plus" style="font-size:10px;"></i></button>
            <div style="font-weight:700; font-size:12px; min-width:80px; text-align:right;">{{ formatRupiah(i.qty * i.harga_satuan) }}</div>
            <button @click="hapusDariKeranjang(i.sku)" type="button" class="icon-btn" style="width:26px; height:26px; color:var(--danger);"><i class="fas fa-trash-alt" style="font-size:10px;"></i></button>
          </div>
        </div>

        <div style="display:grid; gap:10px; margin-bottom:14px;" class="grid-cols-1 md:grid-cols-2">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Nama Pelanggan <span style="font-weight:400; color:var(--text-faint);">(opsional)</span></label>
            <input v-model="namaPelanggan" type="text" placeholder="Nama pelanggan...">
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Metode Pembayaran</label>
            <div style="display:flex; gap:14px; flex-wrap:wrap; padding-top:6px;">
              <label v-for="m in METODE_PEMBAYARAN_OPSI" :key="m" style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer;">
                <input type="radio" :value="m" v-model="metodePembayaran" style="accent-color:var(--burgundy);">{{ m }}
              </label>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-top:1px solid var(--line); margin-bottom:12px;">
          <span style="font-weight:700; font-size:13.5px;">Total</span>
          <span style="font-weight:700; font-size:18px; color:var(--burgundy);">{{ formatRupiah(totalBelanja) }}</span>
        </div>

        <div style="display:flex; gap:8px;">
          <button @click="buatOrder" :disabled="menyimpan || daftarKeranjang.length === 0" class="btn-primary" style="flex:1; padding:13px;"><i class="fas fa-check" style="margin-right:6px;"></i>{{ menyimpan ? 'Memproses...' : 'Buat Order' }}</button>
          <button v-if="daftarKeranjang.length > 0" @click="kosongkanKeranjang" type="button" class="btn-outline" style="padding:13px;">Kosongkan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// 2. MENUNGGU PROSES — DISALIN dari OrderSpkManager (js/vue-order-spk.js,
//    lihat Q1 di komentar besar atas file ini), field/logic TIDAK berubah
//    (masih koleksi `order_spk` yang SAMA — SPK yang dibuat lewat Kasir DAN
//    lewat form manual di sini SAMA-SAMA muncul di daftar ini), cuma
//    `menuId` yang ganti jadi 'pesanan_menunggu'.
// ============================================================================
const STATUS_SPK_OPSI = ['Aktif', 'Selesai'];

function formStateKosongSpk() {
  return reactive({
    no_spk: '', sku_produk: '', nama_produk: '', qty_order: '',
    tanggal: new Date().toISOString().slice(0, 10), status: 'Aktif'
  });
}

const PesananMenungguManager = {
  components: { PopupPratinjauCetakLabel, DropdownCari },
  setup() {
    const form = formStateKosongSpk();
    const menyimpan = ref(false);
    const sedangEditId = ref(null);

    const menuId = 'pesanan_menunggu';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    const mencetak = ref(false);
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    function cetakSpkList(daftarSpk) {
      if (typeof QRCode === 'undefined') {
        alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
        return;
      }
      if (!Array.isArray(daftarSpk) || daftarSpk.length === 0) return;
      daftarLabelPreview.value = daftarSpk.map(s => ({
        kode: s.no_spk,
        nama: s.nama_produk || '',
        info: `Qty Order: ${formatQty(s.qty_order ?? s.qty_target)} &middot; ${s.tanggal || ''}`,
        qrDataUrl: buatQrDataUrl(s.no_spk)
      }));
      popupCetakLabelAktif.value = true;
    }

    const paginasi = usePaginasiFirestore(db, 'order_spk', {
      perHalaman: 15,
      urutkanField: 'no_spk',
      cariField: 'no_spk',
      petakan: (id, d) => ({ id, ...d, qty_order: d.qty_order ?? d.qty_target ?? 0 })
    });

    const daftarProduk = ref([]);
    const opsiProdukLabel = computed(() => daftarProduk.value.map(formatLabelProdukSku));
    const produkTerpilih = computed(() => daftarProduk.value.find(p => p.sku === form.sku_produk) || null);
    const labelProdukTerpilih = computed(() => produkTerpilih.value ? formatLabelProdukSku(produkTerpilih.value) : '');
    function formatLabelProdukSku(p) { return `${p.sku} — ${[p.nama, p.warna, p.size].filter(Boolean).join(' ')}`; }
    function pilihProdukSpk(label) {
      const p = daftarProduk.value.find(x => formatLabelProdukSku(x) === label);
      if (!p) { form.sku_produk = ''; return; }
      form.sku_produk = p.sku;
      form.nama_produk = [p.nama, p.warna, p.size].filter(Boolean).join(' ');
    }
    function lepasProdukSpk() { form.sku_produk = ''; }

    function resetForm() {
      Object.assign(form, formStateKosongSpk());
      sedangEditId.value = null;
    }

    async function cekNoSpkDobel() {
      const q = query(collection(db, 'order_spk'), where('no_spk', '==', form.no_spk.trim()));
      const snap = await getDocs(q);
      return snap.docs.some(d => d.id !== sedangEditId.value);
    }

    async function simpan(jugaCetak) {
      const noSpkTrim = form.no_spk.trim();
      if (!noSpkTrim) return alert('Isi No. SPK dulu.');
      if (!form.nama_produk.trim()) return alert('Isi Nama Produk/Keterangan dulu.');
      if (!(parseFloat(form.qty_order) > 0)) return alert('Isi Qty Order dulu (harus lebih dari 0).');
      if (!form.tanggal) return alert('Isi Tanggal dulu.');

      menyimpan.value = true;
      try {
        if (await cekNoSpkDobel()) {
          alert(`No. SPK "${noSpkTrim}" sudah terdaftar. Edit yang sudah ada kalau mau ubah datanya, atau pakai nomor lain.`);
          menyimpan.value = false;
          return;
        }
        const data = {
          no_spk: noSpkTrim,
          sku_produk: form.sku_produk || '',
          nama_produk: form.nama_produk.trim(),
          qty_order: parseFloat(form.qty_order) || 0,
          tanggal: form.tanggal,
          status: form.status
        };
        if (sedangEditId.value) {
          await updateDoc(doc(db, 'order_spk', sedangEditId.value), {
            ...data, diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
          });
          if (!jugaCetak) alert('Perubahan SPK tersimpan.');
        } else {
          await addDoc(collection(db, 'order_spk'), {
            ...data, dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          if (!jugaCetak) alert('SPK baru tersimpan.');
        }
        resetForm();
        await paginasi.muatUlang();
        if (jugaCetak) cetakSpkList([data]);
      } catch (e) {
        console.error('Gagal simpan SPK (Menunggu Proses):', e);
        alert('Gagal menyimpan data SPK. Coba lagi.');
      }
      menyimpan.value = false;
    }

    const dicentangTabel = reactive({});
    const spkTercentang = computed(() => paginasi.dataHalaman.value.filter(s => dicentangTabel[s.id]));
    function toggleSemuaTabel(v) { paginasi.dataHalaman.value.forEach(s => { dicentangTabel[s.id] = v; }); }
    function cetakTerpilih() {
      if (spkTercentang.value.length === 0) return;
      mencetak.value = true;
      try { cetakSpkList(spkTercentang.value); } finally { mencetak.value = false; }
    }

    function bukaEdit(item) {
      sedangEditId.value = item.id;
      Object.assign(form, {
        no_spk: item.no_spk || '', sku_produk: item.sku_produk || '', nama_produk: item.nama_produk || '',
        qty_order: item.qty_order || '', tanggal: item.tanggal || '', status: item.status || 'Aktif'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function batalEdit() { resetForm(); }

    async function hapus(item) {
      if (!confirm(`Hapus SPK "${item.no_spk}" secara permanen?`)) return;
      try {
        await deleteDoc(doc(db, 'order_spk', item.id));
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal hapus SPK (Menunggu Proses):', e);
        alert('Gagal menghapus data SPK.');
      }
    }

    onMounted(async () => {
      await window.authReady;
      await paginasi.muatUlang();
      daftarProduk.value = await ambilSemuaProduk();
    });

    return {
      form, STATUS_SPK_OPSI, menyimpan, sedangEditId,
      simpan, bukaEdit, batalEdit, hapus, paginasi, formatQty,
      bolehTambah, bolehHapus, bolehCetak, mencetak,
      dicentangTabel, spkTercentang, toggleSemuaTabel, cetakTerpilih,
      cetakSpkList, popupCetakLabelAktif, daftarLabelPreview,
      opsiProdukLabel, produkTerpilih, labelProdukTerpilih, pilihProdukSpk, lepasProdukSpk
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px; border-radius:20px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas fa-clipboard-list" style="color:var(--aksen-ink); margin-right:8px;"></i>{{ sedangEditId ? 'Edit SPK' : 'Tambah SPK' }}</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Daftar SPK aktif — termasuk yang otomatis dibuat dari Penjualan Kasir. No. SPK dipakai dropdown "No SPK" di menu Scan Persiapan.</p>

      <div v-if="bolehTambah" style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field" style="grid-column:1 / -1;">
          <label>Pilih Produk (SKU) <span style="font-weight:400; color:var(--text-faint);">(opsional — hubungkan ke Master Produk)</span></label>
          <dropdown-cari :model-value="labelProdukTerpilih" :opsi="opsiProdukLabel" placeholder="Cari SKU / Nama / Warna / Size produk..." @update:modelValue="pilihProdukSpk" />
          <button v-if="form.sku_produk" @click="lepasProdukSpk" type="button" class="btn-outline" style="font-size:10.5px; padding:3px 8px; margin-top:6px;">Lepas Sambungan SKU</button>
        </div>
        <div class="gc-field">
          <label>No. SPK <span style="color:var(--danger);">*</span></label>
          <input v-model="form.no_spk" type="text" placeholder="Contoh: SPK-0001">
        </div>
        <div class="gc-field">
          <label>Nama Produk / Keterangan <span style="color:var(--danger);">*</span></label>
          <input v-model="form.nama_produk" type="text" placeholder="Contoh: Kaos Polo Navy L">
        </div>
        <div class="gc-field">
          <label>Qty Order <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.qty_order" type="number" min="0" placeholder="0">
          <p v-if="produkTerpilih && produkTerpilih.kelipatan > 0" style="font-size:10.5px; color:var(--burgundy); margin-top:4px;">
            <i class="fas fa-circle-info" style="margin-right:4px;"></i>Rekomendasi Kelipatan Order: {{ produkTerpilih.kelipatan }} pcs (dari Isi Pola BOM)
            <template v-if="form.qty_order > 0 && (form.qty_order % produkTerpilih.kelipatan) !== 0">
              — Qty saat ini bukan kelipatan {{ produkTerpilih.kelipatan }}, sisa {{ form.qty_order % produkTerpilih.kelipatan }} pcs berpotensi boros pola.
            </template>
          </p>
        </div>
        <div class="gc-field">
          <label>Tanggal <span style="color:var(--danger);">*</span></label>
          <input v-model="form.tanggal" type="date">
        </div>
        <div class="gc-field" style="grid-column:1 / -1;">
          <label>Status</label>
          <div style="display:flex; gap:16px;">
            <label v-for="s in STATUS_SPK_OPSI" :key="s" style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer;">
              <input type="radio" :value="s" v-model="form.status" style="accent-color:var(--burgundy);">{{ s }}
            </label>
          </div>
        </div>
      </div>

      <div v-if="bolehTambah" style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button v-if="bolehCetak" @click="simpan(true)" :disabled="menyimpan" class="btn-primary" style="flex:1; min-width:160px; padding:12px;"><i class="fas fa-print" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan + Cetak' }}</button>
        <button @click="simpan(false)" :disabled="menyimpan" class="btn-outline" style="flex:1; min-width:120px; padding:12px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : (sedangEditId ? 'Simpan Perubahan' : 'Simpan') }}</button>
        <button v-if="sedangEditId" @click="batalEdit" class="btn-outline" style="flex:1; min-width:100px; padding:12px;">Batal Edit</button>
      </div>
      <p v-if="bolehTambah && !bolehCetak" style="font-size:10.5px; color:var(--text-faint); margin-top:8px;">Akun ini tidak punya izin cetak untuk menu ini — cuma tombol "Simpan" yang tersedia.</p>
    </div>

    <div class="gc-card" style="padding:14px 14px 4px; border-radius:20px;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; flex:1; min-width:200px; max-width:320px;">
          <i class="fas fa-magnifying-glass" style="font-size:13px; color:var(--text-faint); flex-shrink:0;"></i>
          <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari No. SPK..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
        </div>
        <div v-if="bolehCetak" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <button @click="toggleSemuaTabel(true)" class="btn-outline" style="padding:5px 10px; font-size:11px;">Pilih Semua</button>
          <button @click="toggleSemuaTabel(false)" class="btn-outline" style="padding:5px 10px; font-size:11px;">Kosongkan</button>
          <button @click="cetakTerpilih" :disabled="spkTercentang.length === 0 || mencetak" class="btn-primary" style="padding:6px 14px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:6px;"></i>{{ mencetak ? 'Mencetak...' : ('Cetak (' + spkTercentang.length + ')') }}</button>
        </div>
      </div>
      <p v-if="bolehCetak" style="font-size:10.5px; color:var(--text-faint); margin:-4px 0 10px;">Centang baris di tabel bawah buat cetak ulang label banyak No. SPK sekaligus (cuma baris yang lagi tampil di halaman ini).</p>
    </div>
    <div v-if="paginasi.memuat.value" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="paginasi.errorPaginasi.value" class="gc-card" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
    <div v-else-if="paginasi.dataHalaman.value.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-clipboard-list"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada SPK menunggu proses</h3>
    </div>
    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:14px; border-radius:20px;">
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:12px;">
          <input v-if="bolehCetak" type="checkbox" v-model="dicentangTabel[item.id]" style="accent-color:var(--burgundy); width:16px; height:16px; margin-top:2px; flex-shrink:0;" title="Pilih buat cetak label">
          <div style="flex:1; min-width:0;">
            <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ item.no_spk }}</div>
          </div>
          <span class="tag" :class="item.status === 'Aktif' ? 'ok' : 'neutral'" style="flex-shrink:0;">{{ item.status }}</span>
        </div>
        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Nama Produk / Keterangan</span><span style="font-weight:700; text-align:right;">{{ item.nama_produk }}</span></div>
          <div v-if="item.sku_produk" style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">SKU Produk</span><span style="font-weight:700; text-align:right;">{{ item.sku_produk }}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Qty Order</span><span style="font-weight:700;">{{ formatQty(item.qty_order) }}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Tanggal</span><span style="font-weight:700;">{{ item.tanggal }}</span></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button v-if="bolehTambah" @click="bukaEdit(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px;"><i class="fas fa-pen" style="margin-right:6px;"></i>Edit</button>
          <button v-if="bolehCetak" @click="cetakSpkList([item])" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak</button>
          <button v-if="bolehHapus" @click="hapus(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
        </div>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin:16px 0;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>
    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label No. SPK" :daftar-label="daftarLabelPreview" @tutup="popupCetakLabelAktif = false" />
  `
};

// ============================================================================
// 3. RINGKASAN (Proses Persiapan / Proses Produksi / Proses Pengiriman) —
//    1 komponen dipakai 3 tempat lewat props, BACA SAJA (tidak ada tombol
//    scan/aksi apapun — itu tetap di menu "Persiapan Produksi" asli),
//    "ditarik" dari koleksi `spk_track` yang SAMA (lihat Q3 + asumsi B di
//    komentar besar atas file ini). Tombol "Buka di Persiapan Produksi"
//    tiap baris lompat ke jalur+tahap aslinya buat yang mau proses lebih
//    lanjut (scan dsb).
// ============================================================================
const TAHAP_URUTAN = ['perlu_diproses', 'sedang_diproses', 'perlu_dikirim', 'sedang_dikirim', 'selesai'];
const TAHAP_LABEL = {
  perlu_diproses: 'Perlu Diproses', sedang_diproses: 'Sedang Diproses',
  perlu_dikirim: 'Perlu Dikirim', sedang_dikirim: 'Sedang Dikirim', selesai: 'Selesai'
};
const TAHAP_SLUG = {
  perlu_diproses: 'perludiproses', sedang_diproses: 'sedangdiproses',
  perlu_dikirim: 'perludikirim', sedang_dikirim: 'sedangdikirim', selesai: 'selesai'
};
const PETA_JALUR = {
  vendor: { label: 'Vendor', icon: 'fa-handshake' },
  bahan: { label: 'Bahan', icon: 'fa-scroll' },
  sewing: { label: 'Acc Sewing', icon: 'fa-scissors' },
  webbing: { label: 'Acc Webbing', icon: 'fa-ribbon' },
  finishing: { label: 'Acc Finishing', icon: 'fa-check-double' }
};

const RingkasanSpkTrackManager = {
  props: {
    // isi SALAH SATU (bukan dua-duanya) — lihat catatan "SATU filter 'in'
    // per query" di komentar besar atas file ini.
    jalurSet: { type: Array, default: null },
    statusSet: { type: Array, default: null },
    judul: { type: String, required: true },
    subjudul: { type: String, default: '' },
    ikon: { type: String, default: 'fa-list-check' }
  },
  setup(props) {
    const memuat = ref(true);
    const daftarTrack = ref([]);

    async function muat() {
      memuat.value = true;
      try {
        let q;
        if (props.jalurSet) q = query(collection(db, 'spk_track'), where('jalur', 'in', props.jalurSet));
        else if (props.statusSet) q = query(collection(db, 'spk_track'), where('status', 'in', props.statusSet));
        else { daftarTrack.value = []; memuat.value = false; return; }
        const snap = await getDocs(q);
        daftarTrack.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat ringkasan spk_track:', e);
        daftarTrack.value = [];
      }
      memuat.value = false;
    }

    // Mode jalur (Persiapan/Produksi) -> ringkas per TAHAP. Mode status
    // (Pengiriman) -> ringkas per JALUR.
    const ringkasPerTahap = computed(() => {
      const peta = {}; TAHAP_URUTAN.forEach(t => { peta[t] = 0; });
      daftarTrack.value.forEach(t => { if (peta[t.status] !== undefined) peta[t.status]++; });
      return peta;
    });
    const ringkasPerJalur = computed(() => {
      const peta = {}; Object.keys(PETA_JALUR).forEach(j => { peta[j] = 0; });
      daftarTrack.value.forEach(t => { if (peta[t.jalur] !== undefined) peta[t.jalur]++; });
      return peta;
    });

    function bukaDiJalur(track) {
      if (!window.pindahTab || !window.pindahSubTab) return;
      window.pindahTab('tab-persiapan-produksi');
      window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-' + track.jalur, null, { catatRiwayat: true });
      window.pindahSubTab('sub-pp-' + track.jalur + '-tahap', 'sub-pp-' + track.jalur + '-' + (TAHAP_SLUG[track.status] || 'perludiproses'), null, { catatRiwayat: true });
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftarTrack, ringkasPerTahap, ringkasPerJalur, muat, bukaDiJalur,
      TAHAP_URUTAN, TAHAP_LABEL, PETA_JALUR, formatQty
    };
  },
  template: `
    <div style="display:flex; flex-direction:column; gap:14px;">
      <div class="gc-card" style="padding:16px; border-radius:20px;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:2px;"><i :class="'fas ' + ikon" style="color:var(--aksen-ink); margin-right:8px;"></i>{{ judul }}</h3>
        <p v-if="subjudul" style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">{{ subjudul }}</p>

        <div v-if="jalurSet" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px;">
          <div v-for="t in TAHAP_URUTAN" :key="t" class="gc-card" style="padding:10px; text-align:center; background:var(--ivory-dim); border-radius:14px;">
            <div style="font-size:20px; font-weight:700; color:var(--burgundy);">{{ ringkasPerTahap[t] }}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">{{ TAHAP_LABEL[t] }}</div>
          </div>
        </div>
        <div v-else style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px;">
          <div v-for="(info, j) in PETA_JALUR" :key="j" class="gc-card" style="padding:10px; text-align:center; background:var(--ivory-dim); border-radius:14px;">
            <div style="font-size:20px; font-weight:700; color:var(--burgundy);">{{ ringkasPerJalur[j] }}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;"><i :class="'fas ' + info.icon" style="margin-right:4px;"></i>{{ info.label }}</div>
          </div>
        </div>
      </div>

      <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarTrack.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i :class="'fas ' + ikon"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada data di tahap ini</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftarTrack" :key="t.id" class="gc-card" style="padding:14px; border-radius:18px;">
          <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
            <div style="flex:1; min-width:0;">
              <div class="gc-heading" style="font-weight:700; font-size:13px;">{{ t.kode_spk }}</div>
              <div style="font-size:11px; color:var(--text-muted);">{{ t.nama_produk }}</div>
            </div>
            <span class="tag neutral" style="flex-shrink:0;"><i :class="'fas ' + (PETA_JALUR[t.jalur] ? PETA_JALUR[t.jalur].icon : 'fa-question')" style="margin-right:4px;"></i>{{ PETA_JALUR[t.jalur] ? PETA_JALUR[t.jalur].label : t.jalur }}</span>
            <span class="tag" :class="t.status === 'selesai' ? 'ok' : 'warn'" style="flex-shrink:0;">{{ TAHAP_LABEL[t.status] || t.status }}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:10px;"><span style="color:var(--text-faint);">Qty Total</span><span style="font-weight:700;">{{ formatQty(t.qty_total) }}</span></div>
          <button @click="bukaDiJalur(t)" class="btn-outline" style="width:100%; font-size:11.5px; padding:7px 10px;"><i class="fas fa-arrow-up-right-from-square" style="margin-right:6px;"></i>Buka di Persiapan Produksi</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// Mount functions — 1 per sub-tab, dipanggil window.pastikanMountXxx() dari
// js/dashboard.js (petaMount) TEPAT saat sub-tabnya pertama kali dibuka
// (pola SAMA seperti semua modul lain di app ini).
// ============================================================================
const AppPesananKasir = { components: { PesananKasirManager }, template: `<pesanan-kasir-manager />` };
let vmPesananKasir = null;
window.pastikanMountPesananKasir = function() {
  if (vmPesananKasir) return;
  const mountPoint = document.getElementById('vue-pesanan-kasir');
  if (mountPoint) vmPesananKasir = createApp(AppPesananKasir).mount('#vue-pesanan-kasir');
};

const AppPesananMenunggu = { components: { PesananMenungguManager }, template: `<pesanan-menunggu-manager />` };
let vmPesananMenunggu = null;
window.pastikanMountPesananMenunggu = function() {
  if (vmPesananMenunggu) return;
  const mountPoint = document.getElementById('vue-pesanan-menunggu');
  if (mountPoint) vmPesananMenunggu = createApp(AppPesananMenunggu).mount('#vue-pesanan-menunggu');
};

const AppPesananPersiapan = {
  components: { RingkasanSpkTrackManager },
  template: `<ringkasan-spk-track-manager :jalur-set="['vendor','bahan']" judul="Proses Persiapan" subjudul="Ringkasan jalur Vendor & Bahan, ditarik langsung dari Persiapan Produksi." ikon="fa-list-check" />`
};
let vmPesananPersiapan = null;
window.pastikanMountPesananPersiapan = function() {
  if (vmPesananPersiapan) return;
  const mountPoint = document.getElementById('vue-pesanan-persiapan');
  if (mountPoint) vmPesananPersiapan = createApp(AppPesananPersiapan).mount('#vue-pesanan-persiapan');
};

const AppPesananProduksi = {
  components: { RingkasanSpkTrackManager },
  template: `<ringkasan-spk-track-manager :jalur-set="['sewing','webbing','finishing']" judul="Proses Produksi" subjudul="Ringkasan jalur Acc Sewing, Webbing & Finishing, ditarik langsung dari Persiapan Produksi." ikon="fa-gears" />`
};
let vmPesananProduksi = null;
window.pastikanMountPesananProduksi = function() {
  if (vmPesananProduksi) return;
  const mountPoint = document.getElementById('vue-pesanan-produksi');
  if (mountPoint) vmPesananProduksi = createApp(AppPesananProduksi).mount('#vue-pesanan-produksi');
};

const AppPesananPengiriman = {
  components: { RingkasanSpkTrackManager },
  template: `<ringkasan-spk-track-manager :status-set="['perlu_dikirim','sedang_dikirim']" judul="Proses Pengiriman" subjudul="Semua SPK yang sedang di tahap kirim, lintas jalur (Vendor/Bahan/Sewing/Webbing/Finishing)." ikon="fa-truck-fast" />`
};
let vmPesananPengiriman = null;
window.pastikanMountPesananPengiriman = function() {
  if (vmPesananPengiriman) return;
  const mountPoint = document.getElementById('vue-pesanan-pengiriman');
  if (mountPoint) vmPesananPengiriman = createApp(AppPesananPengiriman).mount('#vue-pesanan-pengiriman');
};
