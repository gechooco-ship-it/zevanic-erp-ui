// js/vue-kartu-stok.js
// Stok & Pembelian > Kartu Stok. Daftar stok semua bahan+aksesoris (stok,
// teralokasi, bebas, batas kritis, rak, lot), klik baris -> ledger read-only.
//
// Koleksi & field:
// - master_bahan_aksesoris: full fetch client-side. Badge "Lot Aktif" dari
//   lot_bahan_aksesoris status 'aktif', dihitung sekali lalu dikelompokkan.
// - Teralokasi: hitungTeralokasiSemuaBahan() (spk_track baris belum
//   entry_qty). Bebas = stok - teralokasi; kritis kalau bebas <= batas_kritis.
// - kartu_stok_bahan_aksesoris: paginasi cursor usePaginasiFirestore, 15 per
//   halaman — bisa ratusan baris per item, jangan di-full-fetch.
//
// Jebakan:
// - stok_akhir/qty_sisa HANYA ditulis fungsi stok di vue-stock-pembelian.js.
//   File ini cuma menulis batas_kritis (popup Atur Batas Kritis).
// - Badge "Lot Aktif" hanya menghitung jenis lot; pak repack tidak ikut.
// - Teks "Belum ada transaksi masuk/keluar untuk item ini" istilah wajib;
//   paginasiDetail.errorPaginasi wajib tetap dirender.

import { createApp, ref, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=13';
import { usePaginasiFirestore } from './vue-paginasi.js';
import { ambilLotAktif, hitungTeralokasiSemuaBahan } from './vue-stock-pembelian.js?v=32';

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
  components: { DropdownCari },
  setup() {
    const view = ref('daftar'); // 'daftar' | 'ledger'

    // Item-switcher (Ganti Item di layar Ledger)
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

    const itemEntry = ref('');
    const opsiItemMap = computed(() => {
      const map = new Map();
      daftarItemLengkap.value.forEach(it => {
        const label = (it.nama || '(tanpa nama)') + (it.warna ? ` ${it.warna}` : '') + (it.id_tampil ? ` (${it.id_tampil})` : '');
        map.set(label, it);
      });
      return map;
    });
    const opsiItemNama = computed(() => Array.from(opsiItemMap.value.keys()));

    const itemAktif = ref(null); // seluruh dokumen master_bahan_aksesoris item yang dipilih
    function pilihItem(item) {
      itemAktif.value = item;
      itemEntry.value = '';
      view.value = 'ledger';
      muatLotAktifCount();
      paginasiDetail.muatUlang();
    }
    watch(itemEntry, () => {
      const it = opsiItemMap.value.get(itemEntry.value);
      if (it) pilihItem(it);
    });

    // Badge "Lot Aktif" (layar Ledger) memakai ULANG ambilLotAktif yang
    // diekspor vue-stock-pembelian.js, tidak ada fungsi baru. Item yang bukan
    // pakai_lot_tracking otomatis menampilkan 0 (tidak ada dokumen
    // lot_bahan_aksesoris untuknya) dan itu wajar, bukan disembunyikan.
    const lotAktifCount = ref(null); // null = belum dimuat/gagal
    const memuatLot = ref(false);
    async function muatLotAktifCount() {
      if (!itemAktif.value) { lotAktifCount.value = null; return; }
      memuatLot.value = true;
      try {
        const lots = await ambilLotAktif(itemAktif.value.id);
        lotAktifCount.value = lots.length;
      } catch (e) {
        console.error('Gagal muat jumlah lot aktif:', e);
        lotAktifCount.value = null; // badge tampil '-', TIDAK memblokir seluruh layar
      }
      memuatLot.value = false;
    }

    // Ledger 1 item.
    const paginasiDetail = usePaginasiFirestore(db, 'kartu_stok_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'dibuat_pada',
      urutkanArah: 'desc',
      constraintTambahan: () => itemAktif.value ? [where('bahan_aksesoris_id', '==', itemAktif.value.id)] : [],
      petakan: (id, d) => ({ id, ...d })
    });
    function kembaliKeDaftarStok() { view.value = 'daftar'; itemAktif.value = null; }

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
        if (q && !(b.nama || '').toLowerCase().includes(q)) return false;
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
      if (view.value === 'ledger' && itemAktif.value) { await muatLotAktifCount(); await paginasiDetail.muatUlang(); }
    }
    onMounted(async () => { await window.authReady; await muat(); });

    return {
      view, kembaliKeDaftarStok,
      daftarItemLengkap, memuatDaftarItem, errorDaftarItem, muatDaftarItemLengkap, muat,
      itemEntry, opsiItemNama, itemAktif, pilihItem,
      lotAktifCount, memuatLot,
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
            <input v-model="cariDaftarStok" type="text" placeholder="Cari nama item..." style="width:100%; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
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
                  <td><div style="font-weight:700;">{{ b.nama }}<span v-if="b.warna"> {{ b.warna }}</span></div><div style="font-size:10px; color:var(--text-faint);">{{ b.id_tampil || '-' }}</div></td>
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
            <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:10px;">{{ popupBatasKritisAktif.nama }}<span v-if="popupBatasKritisAktif.warna"> {{ popupBatasKritisAktif.warna }}</span> — status kritis muncul kalau stok bebas &le; angka ini.</p>
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
          <label class="gc-heading" style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Kartu Stok</label>
          <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Ledger pergerakan stok per item — masuk otomatis dari Nota Order Belanja yang di-final-kan, keluar dari Scan Persiapan, penyesuaian dari Scan Opname. Read-only di sini.</p>

          <div class="gc-field" style="max-width:420px; margin-bottom:0;">
            <label>Ganti Item</label>
            <dropdown-cari v-model="itemEntry" :opsi="opsiItemNama" placeholder="ganti item ▾ — cari nama item..." :disabled="memuatDaftarItem" />
          </div>
          <p v-if="memuatDaftarItem" style="font-size:11px; color:var(--text-faint); margin-top:8px;"><i class="fas fa-spinner fa-spin" style="margin-right:5px;"></i>Memuat daftar item...</p>
          <p v-else-if="errorDaftarItem" style="font-size:11px; color:var(--danger); margin-top:8px;">
            <i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>{{ errorDaftarItem }}
            <button @click="muatDaftarItemLengkap" class="btn-outline" style="padding:3px 10px; font-size:10.5px; margin-left:6px;">Coba lagi</button>
          </p>

          <div v-if="itemAktif" style="display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin-top:14px; padding:12px 14px; border-radius:10px; background:var(--ivory-dim); border:1px solid var(--burgundy);">
            <div style="flex:1; min-width:160px;">
              <div style="font-weight:700; font-size:14px;">{{ itemAktif.nama }}<span v-if="itemAktif.warna"> {{ itemAktif.warna }}</span></div>
              <div style="font-size:10.5px; color:var(--text-faint);">{{ itemAktif.id_tampil || '-' }} · {{ itemAktif.kategori_utama || '-' }}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Stok Akhir Saat Ini</div>
              <div style="font-size:19px; font-weight:700; color:var(--burgundy);">{{ formatQty(itemAktif.stok_akhir || 0) }} <span style="font-size:12px; font-weight:400;">{{ itemAktif.satuan_pemakaian || '' }}</span></div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Lot Aktif</div>
              <div style="font-size:19px; font-weight:700;">{{ memuatLot ? '...' : (lotAktifCount === null ? '-' : lotAktifCount) }} <span style="font-size:12px; font-weight:400;">lot</span></div>
            </div>
          </div>
        </div>

        <div style="padding:14px;">
          <!-- state: belum pilih item -->
          <div v-if="!itemAktif" class="gc-kosong">
            <div class="lingkaran"><i class="fas fa-boxes-stacked"></i></div>
            <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Pilih item dulu</h3>
            <p style="font-size:11.5px; color:var(--text-faint); margin:0;">Cari &amp; pilih item lewat kotak "Ganti Item" di atas untuk melihat kartu stoknya.</p>
          </div>

          <!-- ledger 1 item -->
          <template v-else>
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
