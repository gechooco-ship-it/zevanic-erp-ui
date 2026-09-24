// js/vue-kartu-stok.js
// Stok & Pembelian > Kartu Stok. Daftar stok semua bahan+aksesoris, klik baris
// -> halaman item: stok per lot/pak (cetak + opname per baris, lot susulan),
// cetak label ID Item, stok teralokasi, lalu ledger pergerakan.
//
// Koleksi & field:
// - master_bahan_aksesoris: full fetch client-side; batas_kritis diedit di sini.
// - lot_bahan_aksesoris (lot & pak) dan log_cetak_label lewat fungsi ekspor
//   vue-stock-pembelian.js. Teralokasi: hitungTeralokasiSemuaBahan().
// - kartu_stok_bahan_aksesoris: paginasi cursor 15 per halaman.
//
// Jebakan:
// - stok_akhir/qty_sisa HANYA ditulis fungsi stok di vue-stock-pembelian.js;
//   opname di sini memanggil catatPenyesuaianOpnameItem/Lot, digerbang PIN
//   Owner (Scan Opname di HP tetap jalur operator).
// - window.bukaKartuStokItem(id) dipakai Master Bahan untuk deep-link.
// - Teks "Belum ada transaksi masuk/keluar untuk item ini" istilah wajib;
//   paginasiDetail.errorPaginasi wajib tetap dirender.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, getDoc, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=15';
import { usePaginasiFirestore } from './vue-paginasi.js';
import { ambilSemuaLotByBahan, hitungTeralokasiSemuaBahan, catatLogCetakLabel, catatPenyesuaianOpnameItem, catatPenyesuaianOpnameLot, rincianTeralokasiBahan, buatLotSusulan } from './vue-stock-pembelian.js?v=34';
import { PopupPinGenerik, buatQrDataUrl } from './vue-scan-cetak.js?v=12';

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
// pesanErrorFirestore — disalin dari js/vue-config.js (`AppConfigRiwayatPin` >
// `pesanError`), pola "salin logic kecil per-file" proyek ini — bukan diimpor
// lintas file (fungsi itu privat di komponen tsb).
function pesanErrorFirestore(e) {
  return e && e.code === 'failed-precondition'
    ? 'Perlu index Firestore baru — buka Console browser (F12), cari link "Create composite index" dari error ini, klik untuk bikin index-nya sekali.'
    : (e && e.code === 'permission-denied')
      ? 'Tidak punya izin membaca data ini. Hubungi Owner/PIC kalau ini tidak seharusnya terjadi.'
      : 'Gagal memuat data. Coba lagi.';
}
// adminKeAtas — gerbang popup "Atur Batas Kritis" (spek: Admin/Owner), TANPA
// PIN — cukup tier akun yang login, pola sama seperti picOwnerKeAtas di
// file Persiapan Produksi.
function adminKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return ['admin', 'pic', 'pic_owner', 'owner', 'superuser'].includes(role);
}

const KartuStokManager = {
  components: { PopupPratinjauCetakLabel, PopupPinGenerik },
  setup() {
    const view = ref('daftar'); // 'daftar' | 'ledger'

    const daftarItemLengkap = ref([]); // semua master_bahan_aksesoris
    const memuatDaftarItem = ref(true);
    const errorDaftarItem = ref('');
    async function muatDaftarItemLengkap() {
      memuatDaftarItem.value = true;
      errorDaftarItem.value = '';
      try {
        const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        daftarItemLengkap.value = list;
      } catch (e) {
        console.error('Gagal muat daftar item (Kartu Stok):', e);
        errorDaftarItem.value = pesanErrorFirestore(e);
      }
      memuatDaftarItem.value = false;
    }

    const itemAktif = ref(null); // seluruh dokumen master_bahan_aksesoris item yang dipilih
    function pilihItem(item) {
      itemAktif.value = item;
      view.value = 'ledger';
      muatLot();
      muatTeralokasi();
      paginasiDetail.muatUlang();
    }
    // Stok teralokasi item ini: kebutuhan SPK yang belum di-scan entry.
    const daftarTeralokasi = ref([]);
    const memuatTeralokasi = ref(false);
    async function muatTeralokasi() {
      if (!itemAktif.value) return;
      memuatTeralokasi.value = true;
      try { daftarTeralokasi.value = await rincianTeralokasiBahan(itemAktif.value.id); }
      catch (e) { console.error('Gagal muat rincian teralokasi:', e); daftarTeralokasi.value = []; }
      memuatTeralokasi.value = false;
    }
    const totalTeralokasi = computed(() => daftarTeralokasi.value.reduce((t, r) => t + r.qty, 0));

    // Lot susulan: stok item ber-lot yang belum dipecah jadi lot.
    const stokTanpaLot = computed(() => {
      const it = itemAktif.value;
      if (!it || !it.pakai_lot_tracking) return 0;
      const totalLot = daftarLot.value.filter(l => l.status === 'aktif' && l.jenis !== 'pak').reduce((t, l) => t + (parseFloat(l.qty_sisa) || 0), 0);
      return Math.round(((parseFloat(it.stok_akhir) || 0) - totalLot) * 100) / 100;
    });
    const susulan = ref(null); // { jumlah, qtySama, baris:[{qty,keterangan}] }
    const pinSusulan = ref(false);
    function bukaSusulan() { susulan.value = { jumlah: '', qtySama: '', baris: [] }; }
    function buatBarisSusulan() {
      const n = Math.max(1, Math.floor(parseFloat(susulan.value.jumlah) || 0));
      const q = parseFloat(susulan.value.qtySama) > 0 ? parseFloat(susulan.value.qtySama) : '';
      susulan.value.baris = Array.from({ length: n }, (_, i) => ({ qty: q !== '' ? q : (susulan.value.baris[i]?.qty ?? ''), keterangan: '' }));
    }
    const totalSusulan = computed(() => Math.round((susulan.value?.baris || []).reduce((t, b) => t + (parseFloat(b.qty) || 0), 0) * 100) / 100);
    function lanjutSusulan() {
      const b = susulan.value.baris;
      if (!b.length || b.some(x => !(parseFloat(x.qty) > 0))) return alert('Isi jumlah roll lalu qty tiap roll.');
      if (totalSusulan.value !== stokTanpaLot.value) return alert(`Total roll ${formatQty(totalSusulan.value)} harus sama dengan stok tanpa lot ${formatQty(stokTanpaLot.value)}.`);
      pinSusulan.value = true;
    }
    async function pinSusulanSukses() {
      pinSusulan.value = false;
      try {
        const lotBaru = await buatLotSusulan({ bahanId: itemAktif.value.id, rincian: susulan.value.baris });
        susulan.value = null;
        await muatLot();
        cetakLot(lotBaru);
      } catch (e) { console.error('Gagal buat lot susulan:', e); alert(e.message || 'Gagal membuat lot susulan.'); }
    }
    // Deep-link dari Master Bahan: id disimpan dulu kalau daftar belum termuat.
    let idTunggu = null;
    function bukaById(id) {
      const it = daftarItemLengkap.value.find(x => x.id === id);
      if (it) { idTunggu = null; pilihItem(it); } else idTunggu = id;
    }

    // Stok per lot/pak item ini (semua status; yang habis bisa disembunyikan).
    const daftarLot = ref([]);
    const memuatLot = ref(false);
    const tampilHabis = ref(false);
    async function muatLot() {
      if (!itemAktif.value) { daftarLot.value = []; return; }
      memuatLot.value = true;
      try { daftarLot.value = await ambilSemuaLotByBahan(itemAktif.value.id, { termasukPak: true }); }
      catch (e) { console.error('Gagal muat lot item:', e); daftarLot.value = []; }
      memuatLot.value = false;
    }
    const lotTampil = computed(() => daftarLot.value.filter(l => tampilHabis.value || l.status === 'aktif'));
    const lotAktifCount = computed(() => daftarLot.value.filter(l => l.status === 'aktif').length);
    const lotDipilih = reactive({});
    const lotTerpilih = computed(() => lotTampil.value.filter(l => lotDipilih[l.id]));

    // Cetak label (ID Item atau lot/pak). Kode tetap; log ke log_cetak_label.
    const bolehCetak = computed(() => window.cekIzinMenu('stock_cetak_label', 'print') !== false);
    const cetak = reactive({ aktif: false, daftar: [], jenis: '' });
    function namaItem(it) { return (it.nama || '') + (it.warna ? ' ' + it.warna : ''); }
    function cetakItem() {
      const it = itemAktif.value;
      if (!it.id_tampil) return alert('Item ini belum punya ID Tampil.');
      cetak.daftar = [{ kode: it.id_tampil, nama: namaItem(it), info: it.satuan_pemakaian || '', qrDataUrl: buatQrDataUrl(it.id_tampil) }];
      cetak.jenis = 'item'; cetak.aktif = true;
    }
    function cetakLot(daftar) {
      if (!daftar.length) return alert('Pilih minimal 1 lot/pak.');
      const it = itemAktif.value;
      cetak.daftar = daftar.map(l => ({ kode: l.kode_lot, nama: namaItem(it),
        info: `sisa ${formatQty(l.qty_sisa)} ${l.satuan || it.satuan_pemakaian || ''} &middot; ${l.tanggal_masuk || ''}${l.status !== 'aktif' ? ' &middot; HABIS (cetak ulang)' : ''}`,
        qrDataUrl: buatQrDataUrl(l.kode_lot) }));
      cetak.jenis = 'roll'; cetak.aktif = true;
    }
    async function saatCetak(payload) {
      await catatLogCetakLabel(namaItem(itemAktif.value), cetak.daftar.length * (payload?.jumlahSalinan || 1), cetak.jenis);
      if (riwayatCetak.aktif) await muatRiwayatCetak();
    }
    const riwayatCetak = reactive({ aktif: false, memuat: false, daftar: [] });
    async function muatRiwayatCetak() {
      riwayatCetak.memuat = true;
      try {
        const snap = await getDocs(query(collection(db, 'log_cetak_label'), where('nama_barang', '==', namaItem(itemAktif.value))));
        riwayatCetak.daftar = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.tanggal?.seconds || 0) - (a.tanggal?.seconds || 0));
      } catch (e) { console.error('Gagal muat riwayat cetak:', e); riwayatCetak.daftar = []; }
      riwayatCetak.memuat = false;
    }
    function bukaRiwayatCetak() { riwayatCetak.aktif = true; muatRiwayatCetak(); }
    function formatWaktu(ts) { return ts && typeof ts.seconds === 'number' ? new Date(ts.seconds * 1000).toLocaleString('id-ID') : '-'; }

    // Opname per item (non-lot) atau per lot/pak: qty fisik + alasan, PIN Owner.
    const opname = ref(null); // { tipe:'item'|'lot', lot, sistem, qty, alasan }
    const pinOpname = ref(false);
    const menyimpanOpname = ref(false);
    function bukaOpnameItem() { const it = itemAktif.value; opname.value = { tipe: 'item', lot: null, sistem: parseFloat(it.stok_akhir) || 0, qty: '', alasan: '' }; }
    function bukaOpnameLot(l) { opname.value = { tipe: 'lot', lot: l, sistem: parseFloat(l.qty_sisa) || 0, qty: '', alasan: '' }; }
    function lanjutOpname() {
      const o = opname.value;
      const qf = parseFloat(o.qty);
      if (o.qty === '' || isNaN(qf) || qf < 0) return alert('Isi qty fisik (angka, boleh 0).');
      if (qf !== o.sistem && !o.alasan.trim()) return alert('Ada selisih — alasan wajib diisi.');
      pinOpname.value = true;
    }
    async function pinOpnameSukses(user) {
      pinOpname.value = false;
      const o = opname.value; const it = itemAktif.value;
      const qf = parseFloat(o.qty);
      const ket = (o.alasan.trim() ? o.alasan.trim() + ' — ' : '') + 'Opname Kartu Stok, PIN ' + (user.nama || user.email || '');
      menyimpanOpname.value = true;
      try {
        const hasil = o.tipe === 'lot'
          ? await catatPenyesuaianOpnameLot({ lotId: o.lot.id, qtyFisik: qf, keterangan: ket })
          : await catatPenyesuaianOpnameItem({ bahanId: it.id, namaBahan: namaItem(it), satuan: it.satuan_pemakaian, qtyFisik: qf, keterangan: ket });
        alert(hasil.delta === 0 ? 'Stok sudah sesuai, tidak ada penyesuaian.' : `Penyesuaian tercatat: ${hasil.delta > 0 ? '+' : ''}${formatQty(hasil.delta)}.`);
        opname.value = null;
        const snap = await getDoc(doc(db, 'master_bahan_aksesoris', it.id));
        if (snap.exists()) itemAktif.value = { id: snap.id, ...snap.data() };
        await muatLot(); await paginasiDetail.muatUlang();
      } catch (e) { console.error('Gagal opname:', e); alert(e.message || 'Gagal menyimpan opname.'); }
      menyimpanOpname.value = false;
    }

    // Ledger 1 item.    // Ledger 1 item.
    const paginasiDetail = usePaginasiFirestore(db, 'kartu_stok_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'dibuat_pada',
      urutkanArah: 'desc',
      constraintTambahan: () => itemAktif.value ? [where('bahan_aksesoris_id', '==', itemAktif.value.id)] : [],
      petakan: (id, d) => ({ id, ...d })
    });
    function kembaliKeDaftarStok() { view.value = 'daftar'; itemAktif.value = null; muat(); }

    // DAFTAR STOK (5.1) — teralokasi (semua jalur Bahan+3 Acc) + lot aktif,
    // dihitung SEKALI per muat (bukan per baris) lalu digabung client-side.
    const petaTeralokasi = ref({});
    const petaLotAktif = ref({});
    const memuatAgregat = ref(true);
    async function muatAgregatDaftarStok() {
      memuatAgregat.value = true;
      try {
        const [teralokasi, lotSnap] = await Promise.all([
          hitungTeralokasiSemuaBahan(),
          getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('status', '==', 'aktif')))
        ]);
        petaTeralokasi.value = teralokasi;
        const peta = {};
        lotSnap.forEach(d => {
          const id = d.data().bahan_aksesoris_id;
          if (id && d.data().jenis !== 'pak') peta[id] = (peta[id] || 0) + 1;
        });
        petaLotAktif.value = peta;
      } catch (e) {
        console.error('Gagal hitung agregat Daftar Stok (teralokasi/lot aktif):', e);
      }
      memuatAgregat.value = false;
    }
    const filterKategori = ref('semua'); // 'semua' | 'Bahan' | 'Aksesoris'
    const filterKritisHabis = ref(false);
    const cariDaftarStok = ref('');
    // gayaFilterAktif — .btn-outline TIDAK punya varian .active di
    // gechoo-design.css, jadi state terpilih ditandai lewat :style langsung
    // (bukan bikin class CSS baru untuk kebutuhan sekecil ini).
    function gayaFilterAktif(aktif) {
      return aktif ? { borderColor: 'var(--burgundy)', background: 'var(--ivory-dim)', color: 'var(--burgundy)', fontWeight: '700' } : {};
    }

    const daftarStokBaris = computed(() => {
      return daftarItemLengkap.value.map(it => {
        const stok = parseFloat(it.stok_akhir) || 0;
        const teralokasi = petaTeralokasi.value[it.id] || 0;
        const bebas = stok - teralokasi;
        const batasKritis = parseFloat(it.batas_kritis) || 0;
        let status = 'aman';
        if (bebas <= 0) status = 'habis';
        else if (batasKritis > 0 && bebas <= batasKritis) status = 'kritis';
        return { ...it, stok, teralokasi, bebas, batasKritis, status, lotAktif: petaLotAktif.value[it.id] || 0 };
      });
    });
    const daftarStokTampil = computed(() => {
      const q = cariDaftarStok.value.trim().toLowerCase();
      return daftarStokBaris.value.filter(b => {
        if (filterKategori.value !== 'semua' && b.kategori_utama !== filterKategori.value) return false;
        if (filterKritisHabis.value && b.status === 'aman') return false;
        if (q) {
          const hay = [b.nama, b.warna, b.id_tampil, b.jenis].map(x => (x || '').toString().toLowerCase()).join(' ');
          if (!q.split(/\s+/).every(k => hay.includes(k))) return false;
        }
        return true;
      });
    });
    const jumlahKritisHabis = computed(() => daftarStokBaris.value.filter(b => b.status !== 'aman').length);

    // Popup 5.1a — Atur Batas Kritis. Satuan akhir dikunci (tampil read-only,
    // BUKAN field yang diedit di sini).
    const popupBatasKritisAktif = ref(null); // item asli, atau null = tertutup
    const nilaiBatasKritisInput = ref('');
    const menyimpanBatasKritis = ref(false);
    function bukaBatasKritis(item) { popupBatasKritisAktif.value = item; nilaiBatasKritisInput.value = String(item.batas_kritis || ''); }
    function tutupBatasKritis() { popupBatasKritisAktif.value = null; }
    async function simpanBatasKritis() {
      const item = popupBatasKritisAktif.value;
      if (!item) return;
      const nilai = parseFloat(nilaiBatasKritisInput.value);
      if (!(nilai >= 0)) { alert('Batas kritis wajib angka 0 atau lebih.'); return; }
      menyimpanBatasKritis.value = true;
      try {
        await updateDoc(doc(db, 'master_bahan_aksesoris', item.id), { batas_kritis: nilai });
        item.batas_kritis = nilai; // patch lokal, hindari full reload
        popupBatasKritisAktif.value = null;
      } catch (e) {
        console.error('Gagal simpan batas kritis:', e);
        alert('Gagal menyimpan batas kritis. Coba lagi.');
      }
      menyimpanBatasKritis.value = false;
    }

    // muat — dipanggil ulang tiap tab "Kartu Stok" diklik lagi (lihat
    // pastikanMountKartuStok). Refresh daftar item + agregat Daftar Stok; kalau
    // sedang di Ledger, ikut refresh badge lot + ledgernya juga.
    async function muat() {
      await muatDaftarItemLengkap();
      await muatAgregatDaftarStok();
      if (idTunggu) bukaById(idTunggu);
      else if (view.value === 'ledger' && itemAktif.value) { await muatLot(); await paginasiDetail.muatUlang(); }
    }
    onMounted(async () => { await window.authReady; await muat(); });

    return {
      view, kembaliKeDaftarStok,
      daftarItemLengkap, memuatDaftarItem, errorDaftarItem, muatDaftarItemLengkap, muat,
      itemAktif, pilihItem, bukaById,
      daftarTeralokasi, memuatTeralokasi, totalTeralokasi,
      stokTanpaLot, susulan, pinSusulan, bukaSusulan, buatBarisSusulan, totalSusulan, lanjutSusulan, pinSusulanSukses,
      daftarLot, lotTampil, lotAktifCount, memuatLot, tampilHabis, lotDipilih, lotTerpilih,
      bolehCetak, cetak, cetakItem, cetakLot, saatCetak, riwayatCetak, bukaRiwayatCetak, formatWaktu,
      opname, pinOpname, menyimpanOpname, bukaOpnameItem, bukaOpnameLot, lanjutOpname, pinOpnameSukses,
      paginasiDetail,
      formatQty,
      memuatAgregat, filterKategori, filterKritisHabis, cariDaftarStok, daftarStokTampil, jumlahKritisHabis, gayaFilterAktif,
      popupBatasKritisAktif, nilaiBatasKritisInput, menyimpanBatasKritis, bukaBatasKritis, tutupBatasKritis, simpanBatasKritis,
      bolehAturBatasKritis: computed(() => adminKeAtas(window.currentUser))
    };
  },
  template: `
    <div>
      <!-- DAFTAR STOK (5.1) -->
      <div v-if="view === 'daftar'" class="gc-card" style="padding:0;">
        <div style="padding:14px 14px 12px; border-bottom:1px solid var(--line);">
          <label class="gc-heading" style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Daftar Stok</label>
          <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Stok = stok_akhir saat ini. Teralokasi = kebutuhan SPK Grouping yang sudah terbit tapi belum di-scan entry (Bahan + 3 Acc). Bebas = Stok − Teralokasi. Klik baris untuk lihat ledger pergerakannya.</p>

          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:10px;">
            <button @click="filterKategori='semua'" class="btn-outline" :style="gayaFilterAktif(filterKategori==='semua')" style="font-size:11px; padding:5px 12px;">Semua</button>
            <button @click="filterKategori='Bahan'" class="btn-outline" :style="gayaFilterAktif(filterKategori==='Bahan')" style="font-size:11px; padding:5px 12px;">Bahan</button>
            <button @click="filterKategori='Aksesoris'" class="btn-outline" :style="gayaFilterAktif(filterKategori==='Aksesoris')" style="font-size:11px; padding:5px 12px;">Aksesoris</button>
            <button @click="filterKritisHabis = !filterKritisHabis" class="btn-outline" :style="gayaFilterAktif(filterKritisHabis)" style="font-size:11px; padding:5px 12px;">
              <i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Kritis/Habis <span v-if="jumlahKritisHabis > 0">({{ jumlahKritisHabis }})</span>
            </button>
          </div>
          <div style="position:relative; max-width:320px;">
            <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
            <input v-model="cariDaftarStok" type="text" placeholder="Cari nama, warna, atau ID..." style="width:100%; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
          </div>
        </div>

        <div style="padding:14px;">
          <div v-if="memuatDaftarItem || memuatAgregat" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Memuat...</div>
          <div v-else-if="errorDaftarItem" style="padding:12px 14px; border-radius:10px; background:var(--danger-light); color:var(--danger); font-size:11.5px;">
            <i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ errorDaftarItem }}
            <button @click="muat" class="btn-outline" style="padding:3px 10px; font-size:10.5px; margin-left:6px;">Coba lagi</button>
          </div>
          <div v-else-if="daftarStokTampil.length === 0" class="gc-kosong">
            <div class="lingkaran"><i class="fas fa-boxes-stacked"></i></div>
            <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada item cocok filter ini.</h3>
          </div>
          <div v-else style="overflow-x:auto;">
            <table class="gc-table" style="width:100%; font-size:11.5px;">
              <thead><tr>
                <th>Item</th><th>Stok</th><th>Teralokasi</th><th>Bebas</th><th>Batas Kritis</th><th>Status</th><th>Rak</th><th>Lot</th>
              </tr></thead>
              <tbody>
                <tr v-for="b in daftarStokTampil" :key="b.id" style="cursor:pointer;" @click="pilihItem(b)">
                  <td><div style="font-weight:700;">{{ (b.nama || '') + (b.warna ? ' ' + b.warna : '') }}</div><div style="font-size:10px; color:var(--text-faint);">{{ b.id_tampil || '-' }}</div></td>
                  <td>{{ formatQty(b.stok) }} {{ b.satuan_pemakaian }}</td>
                  <td>{{ formatQty(b.teralokasi) }}</td>
                  <td :style="{fontWeight:700, color: b.bebas <= 0 ? 'var(--danger)' : 'inherit'}">{{ formatQty(b.bebas) }}</td>
                  <td @click.stop>
                    {{ b.batasKritis > 0 ? formatQty(b.batasKritis) : '-' }}
                    <button v-if="bolehAturBatasKritis" @click="bukaBatasKritis(b)" class="icon-btn" style="width:18px; height:18px; margin-left:4px;" title="Atur Batas Kritis"><i class="fas fa-pen" style="font-size:8.5px;"></i></button>
                  </td>
                  <td>
                    <span v-if="b.status === 'habis'" class="tag danger">habis</span>
                    <span v-else-if="b.status === 'kritis'" class="tag warn">kritis</span>
                    <span v-else class="tag ok">aman</span>
                  </td>
                  <td>{{ b.rak_label || '-' }}</td>
                  <td>{{ b.lotAktif > 0 ? b.lotAktif : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Popup 5.1a — Atur Batas Kritis -->
      <div v-if="popupBatasKritisAktif" class="gc-dialog-backdrop" @click.self="tutupBatasKritis">
        <div class="gc-form-dialog">
          <div class="gc-form-dialog-head"><i class="fas fa-triangle-exclamation" style="color:var(--warn);"></i><b>Atur Batas Kritis</b></div>
          <div class="gc-form-dialog-body">
            <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:10px;">{{ (popupBatasKritisAktif.nama || '') + (popupBatasKritisAktif.warna ? ' ' + popupBatasKritisAktif.warna : '') }} — status kritis muncul kalau stok bebas &le; angka ini.</p>
            <div class="gc-field">
              <label>Batas Kritis ({{ popupBatasKritisAktif.satuan_pemakaian || 'satuan' }}, satuan terkunci)</label>
              <input v-model="nilaiBatasKritisInput" type="number" min="0" step="any" style="width:100%; padding:8px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:13px;">
            </div>
          </div>
          <div style="display:flex; gap:8px; padding:0 20px 16px;">
            <button @click="simpanBatasKritis" :disabled="menyimpanBatasKritis" class="btn-primary" style="flex:1;">{{ menyimpanBatasKritis ? 'Menyimpan...' : 'Simpan' }}</button>
            <button @click="tutupBatasKritis" class="btn-outline" style="flex:1;">Batal</button>
          </div>
        </div>
      </div>

      <!-- LEDGER (5.2) 1 item -->
      <div v-if="view === 'ledger'" class="gc-card" style="padding:0;">
        <div style="padding:14px 14px 12px; border-bottom:1px solid var(--line);">
          <button @click="kembaliKeDaftarStok" class="btn-outline" style="font-size:11px; padding:5px 12px; margin-bottom:10px;"><i class="fas fa-arrow-left" style="margin-right:5px;"></i>Daftar Stok</button>
          <label class="gc-heading" style="font-size:12px; font-weight:700; color:var(--text-muted); display:block;">Kartu Stok</label>
          <div v-if="itemAktif" style="display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin-top:14px; padding:12px 14px; border-radius:10px; background:var(--ivory-dim); border:1px solid var(--burgundy);">
            <div style="flex:1; min-width:160px;">
              <div style="font-weight:700; font-size:14px;">{{ (itemAktif.nama || '') + (itemAktif.warna ? ' ' + itemAktif.warna : '') }}</div>
              <div style="font-size:10.5px; color:var(--text-faint);">{{ itemAktif.id_tampil || '-' }} · {{ itemAktif.kategori_utama || '-' }}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Stok Akhir Saat Ini</div>
              <div style="font-size:19px; font-weight:700; color:var(--burgundy);">{{ formatQty(itemAktif.stok_akhir || 0) }} <span style="font-size:12px; font-weight:400;">{{ itemAktif.satuan_pemakaian || '' }}</span></div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Lot Aktif</div>
              <div style="font-size:19px; font-weight:700;">{{ memuatLot ? '...' : lotAktifCount }} <span style="font-size:12px; font-weight:400;">lot/pak</span></div>
            </div>
          </div>
          <div v-if="itemAktif" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <button v-if="bolehCetak && !itemAktif.pakai_lot_tracking" @click="cetakItem" class="btn-outline" style="font-size:11.5px; padding:7px 12px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label ID Item</button>
            <button v-if="!itemAktif.pakai_lot_tracking" @click="bukaOpnameItem" class="btn-outline" style="font-size:11.5px; padding:7px 12px;"><i class="fas fa-scale-balanced" style="margin-right:6px;"></i>Stock Opname</button>
            <button v-if="bolehCetak" @click="bukaRiwayatCetak" class="btn-outline" style="font-size:11.5px; padding:7px 12px;"><i class="fas fa-clock-rotate-left" style="margin-right:6px;"></i>Riwayat Cetak Label</button>
          </div>
        </div>

        <div style="padding:14px;">
          <template v-if="itemAktif">
            <div v-if="stokTanpaLot > 0 && !memuatLot" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 12px; margin-bottom:12px; border-radius:10px; background:var(--warn-light); color:var(--warn-text); font-size:12px;">
              <span style="flex:1; min-width:180px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i><b>{{ formatQty(stokTanpaLot) }} {{ itemAktif.satuan_pemakaian }}</b> belum punya lot — tidak bisa di-scan di Persiapan.</span>
              <button @click="bukaSusulan" class="btn-primary" style="font-size:11.5px; padding:7px 12px;"><i class="fas fa-layer-group" style="margin-right:6px;"></i>Buat Lot Susulan</button>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
              <label style="font-size:12px; font-weight:700; color:var(--text-muted);">Stok per Lot / Pak</label>
              <label style="font-size:11px; color:var(--text-faint); display:flex; align-items:center; gap:4px; margin-left:auto;"><input type="checkbox" v-model="tampilHabis"> tampilkan yang habis</label>
              <button v-if="bolehCetak && lotTerpilih.length" @click="cetakLot(lotTerpilih)" class="btn-primary" style="font-size:11px; padding:5px 10px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak {{ lotTerpilih.length }} terpilih</button>
            </div>
            <div v-if="memuatLot" style="font-size:11.5px; color:var(--text-faint); padding:8px 0;">Memuat lot...</div>
            <div v-else-if="lotTampil.length === 0" style="font-size:11.5px; color:var(--text-faint); padding:8px 0 14px;">{{ itemAktif.pakai_lot_tracking ? 'Belum ada lot tercatat.' : 'Item ini tanpa lot; belum ada pak repack.' }}</div>
            <div v-else style="overflow-x:auto; margin-bottom:18px;">
              <table class="gc-table" style="width:100%; font-size:11.5px;">
                <thead><tr><th style="width:28px;"></th><th>Kode</th><th>Jenis</th><th>Sisa / Awal</th><th>Masuk</th><th>No. Pembelian</th><th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  <tr v-for="l in lotTampil" :key="l.id">
                    <td><input type="checkbox" v-model="lotDipilih[l.id]"></td>
                    <td class="gc-num" style="font-weight:700;">{{ l.kode_lot }}</td>
                    <td>{{ l.jenis === 'pak' ? 'Pak' : 'Lot' }}</td>
                    <td><b>{{ formatQty(l.qty_sisa) }}</b> / {{ formatQty(l.qty_awal ?? l.qty) }} {{ l.satuan || itemAktif.satuan_pemakaian }}</td>
                    <td>{{ l.tanggal_masuk || '-' }}</td>
                    <td>{{ l.no_pembelian || '-' }}</td>
                    <td><span class="tag" :class="l.status === 'aktif' ? 'ok' : 'neutral'">{{ l.status === 'aktif' ? 'aktif' : 'habis' }}</span></td>
                    <td style="white-space:nowrap;">
                      <button v-if="bolehCetak" @click="cetakLot([l])" class="icon-btn" title="Cetak label"><i class="fas fa-print"></i></button>
                      <button @click="bukaOpnameLot(l)" class="icon-btn" title="Stock Opname"><i class="fas fa-scale-balanced"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Stok Teralokasi <span style="font-weight:400; color:var(--text-faint);">— total {{ formatQty(totalTeralokasi) }} {{ itemAktif.satuan_pemakaian }}, bebas {{ formatQty((parseFloat(itemAktif.stok_akhir) || 0) - totalTeralokasi) }}</span></label>
            <div v-if="memuatTeralokasi" style="font-size:11.5px; color:var(--text-faint); padding:6px 0 14px;">Memuat...</div>
            <div v-else-if="daftarTeralokasi.length === 0" style="font-size:11.5px; color:var(--text-faint); padding:6px 0 14px;">Tidak ada kebutuhan SPK yang menunggu item ini.</div>
            <div v-else style="overflow-x:auto; margin-bottom:18px;">
              <table class="gc-table" style="width:100%; font-size:11.5px;">
                <thead><tr><th>Jalur</th><th>Kode</th><th>Untuk Produk</th><th>ID Order</th><th>Qty</th><th>Status</th><th>Operator</th></tr></thead>
                <tbody><tr v-for="(r, i) in daftarTeralokasi" :key="i">
                  <td style="text-transform:capitalize;">{{ r.jalur }}</td><td class="gc-num">{{ r.kode }}</td><td>{{ r.produk || '-' }}</td>
                  <td class="gc-num">{{ r.id_order || '-' }}</td><td><b>{{ formatQty(r.qty) }}</b></td><td>{{ (r.status || '-').replace(/_/g, ' ') }}</td><td>{{ r.operator || '-' }}</td>
                </tr></tbody>
              </table>
            </div>

            <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Pergerakan</label>
            <div v-if="paginasiDetail.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Memuat...</div>

            <div v-else-if="paginasiDetail.errorPaginasi.value" style="padding:12px 14px; border-radius:10px; background:var(--danger-light); color:var(--danger); font-size:11.5px;">
              <i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ paginasiDetail.errorPaginasi.value }}
              <button @click="paginasiDetail.muatUlang" class="btn-outline" style="margin-left:8px; padding:3px 10px; font-size:11px;">Coba lagi</button>
            </div>

            <div v-else-if="paginasiDetail.dataHalaman.value.length === 0" class="gc-kosong">
              <div class="lingkaran"><i class="fas fa-clipboard-list"></i></div>
              <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada transaksi masuk/keluar untuk item ini</h3>
            </div>

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

            <div v-if="!paginasiDetail.memuat.value && !paginasiDetail.errorPaginasi.value && paginasiDetail.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
              <button class="icon-btn" :disabled="paginasiDetail.nomorHalaman.value <= 1" @click="paginasiDetail.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
              <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiDetail.nomorHalaman.value }}</span>
              <button class="icon-btn" :disabled="!paginasiDetail.adaBerikutnya.value" @click="paginasiDetail.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
            </div>
          </template>
        </div>
      </div>

      <div v-if="susulan" class="gc-dialog-backdrop" @click.self="susulan = null">
        <div class="gc-card" style="max-width:480px; width:100%; max-height:88vh; overflow-y:auto; padding:16px;">
          <b style="font-size:13.5px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:6px;"></i>Lot Susulan — {{ itemAktif && ((itemAktif.nama || '') + ' ' + (itemAktif.warna || '')) }}</b>
          <p style="font-size:11.5px; color:var(--text-faint); margin:6px 0 12px;">Stok tanpa lot <b>{{ formatQty(stokTanpaLot) }} {{ itemAktif && itemAktif.satuan_pemakaian }}</b> dipecah jadi roll. Stok tidak berubah; label langsung dicetak.</p>
          <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; margin-bottom:12px;">
            <div class="gc-field" style="margin:0; flex:1; min-width:100px;"><label>Jumlah roll</label><input v-model="susulan.jumlah" type="number" min="1"></div>
            <div class="gc-field" style="margin:0; flex:1; min-width:100px;"><label>Qty per roll (opsional)</label><input v-model="susulan.qtySama" type="number" min="0" step="any"></div>
            <button @click="buatBarisSusulan" :disabled="!(susulan.jumlah > 0)" class="btn-outline" style="padding:9px 12px; font-size:11.5px;">Buat baris</button>
          </div>
          <div v-for="(b, i) in susulan.baris" :key="i" style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">
            <span style="width:26px; font-size:11px; color:var(--text-faint);">#{{ i + 1 }}</span>
            <input v-model="b.qty" type="number" min="0" step="any" placeholder="qty" style="flex:1; padding:7px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
            <input v-model="b.keterangan" type="text" placeholder="keterangan (opsional)" style="flex:1.4; padding:7px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          </div>
          <div style="font-size:12px; margin:10px 0 14px;">Total: <b :style="{ color: totalSusulan === stokTanpaLot ? 'var(--ok)' : 'var(--danger)' }">{{ formatQty(totalSusulan) }}</b> / {{ formatQty(stokTanpaLot) }}</div>
          <div style="display:flex; gap:8px;">
            <button @click="lanjutSusulan" class="btn-primary" style="flex:1;">Lanjut PIN</button>
            <button @click="susulan = null" class="btn-outline" style="flex:1;">Batal</button>
          </div>
        </div>
      </div>
      <popup-pin-generik v-if="pinSusulan" judul="PIN Owner — Lot Susulan" pesan="Stok dipecah jadi lot baru, jumlah stok tidak berubah." konteks="Kartu Stok - Lot Susulan" :roles-diizinkan="['owner','superuser','pic_owner']" @sukses="pinSusulanSukses" @batal="pinSusulan = false" />

      <popup-pratinjau-cetak-label :terbuka="cetak.aktif" judul="Cetak Label" :daftar-label="cetak.daftar" jenis-cetak="label_bahan_aksesoris" @tutup="cetak.aktif = false; muatLot()" @cetak="saatCetak" />

      <div v-if="opname" class="gc-dialog-backdrop" @click.self="opname = null">
        <div class="gc-form-dialog">
          <div class="gc-form-dialog-head"><i class="fas fa-scale-balanced" style="color:var(--burgundy);"></i><b>Stock Opname — {{ opname.tipe === 'lot' ? opname.lot.kode_lot : (itemAktif && itemAktif.id_tampil) }}</b></div>
          <div class="gc-form-dialog-body">
            <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:10px;">Stok sistem: <b>{{ formatQty(opname.sistem) }} {{ itemAktif && itemAktif.satuan_pemakaian }}</b>. Isi jumlah fisik yang ditemukan.</p>
            <div class="gc-field"><label>Qty Fisik</label><input v-model="opname.qty" type="number" min="0" step="any"></div>
            <div class="gc-field"><label>Alasan (wajib kalau selisih)</label><input v-model="opname.alasan" type="text" placeholder="mis. hitung ulang gudang"></div>
          </div>
          <div style="display:flex; gap:8px; padding:0 20px 16px;">
            <button @click="lanjutOpname" :disabled="menyimpanOpname" class="btn-primary" style="flex:1;">{{ menyimpanOpname ? 'Menyimpan...' : 'Lanjut PIN' }}</button>
            <button @click="opname = null" class="btn-outline" style="flex:1;">Batal</button>
          </div>
        </div>
      </div>
      <popup-pin-generik v-if="pinOpname" judul="PIN Owner — Stock Opname" pesan="Penyesuaian stok dicatat di Kartu Stok." konteks="Kartu Stok - Stock Opname" :roles-diizinkan="['owner','superuser','pic_owner']" @sukses="pinOpnameSukses" @batal="pinOpname = false" />

      <div v-if="riwayatCetak.aktif" class="gc-dialog-backdrop" @click.self="riwayatCetak.aktif = false">
        <div class="gc-card" style="max-width:520px; width:100%; max-height:85vh; overflow-y:auto; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <b style="font-size:13.5px;">Riwayat Cetak Label — {{ itemAktif && itemAktif.nama }}</b>
            <button @click="riwayatCetak.aktif = false" class="icon-btn"><i class="fas fa-times"></i></button>
          </div>
          <div v-if="riwayatCetak.memuat" style="font-size:12px; color:var(--text-faint);">Memuat...</div>
          <div v-else-if="riwayatCetak.daftar.length === 0" style="font-size:12px; color:var(--text-faint);">Belum ada riwayat cetak untuk item ini.</div>
          <table v-else class="gc-table" style="width:100%; font-size:11.5px;">
            <thead><tr><th>Tanggal</th><th>Jenis</th><th>Jumlah</th><th>Oleh</th></tr></thead>
            <tbody><tr v-for="r in riwayatCetak.daftar" :key="r.id"><td>{{ formatWaktu(r.tanggal) }}</td><td>{{ r.jenis === 'roll' ? 'Lot/Pak' : 'Item' }}</td><td>{{ r.jumlah_label }}</td><td>{{ r.dicetak_oleh || '-' }}</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

const AppKartuStok = { components: { KartuStokManager }, template: `<kartu-stok-manager ref="mgr" />` };
let vmKartuStok = null;
window.pastikanMountKartuStok = function() {
  if (vmKartuStok) {
    const mgr = vmKartuStok.$refs && vmKartuStok.$refs.mgr;
    if (mgr && typeof mgr.muat === 'function') mgr.muat();
    return;
  }
  const mountPoint = document.getElementById('vue-kartu-stok');
  if (mountPoint) vmKartuStok = createApp(AppKartuStok).mount('#vue-kartu-stok');
};
window.bukaKartuStokItem = function(id) {
  window.pastikanMountKartuStok();
  const mgr = vmKartuStok && vmKartuStok.$refs && vmKartuStok.$refs.mgr;
  if (mgr && typeof mgr.bukaById === 'function') mgr.bukaById(id);
};
