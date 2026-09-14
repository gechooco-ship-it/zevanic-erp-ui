// js/vue-kartu-stok.js
// Stok & Pembelian > Kartu Stok. READ-ONLY total: melacak jumlah stok masuk/
// keluar per bahan/aksesoris. Tidak ada form entry, tidak ada scan di layar
// ini. Satu layar dengan item-switcher ("ganti item ▾") di kepala dan ledger
// di bawahnya yang update di tempat.
//
// Sumber data:
// - Combobox item: full fetch master_bahan_aksesoris client-side (master data
// terbatas, pola sama dengan ambilDaftarBahanAksesorisLengkap).
// - Ledger kartu_stok_bahan_aksesoris: paginasi cursor-based lewat
// usePaginasiFirestore, perHalaman 15 — bisa ratusan baris per item, jangan
// di-full-fetch.
// - Badge "Lot Aktif" lewat ambilLotAktif yang diekspor
// vue-stock-pembelian.js, dipakai apa adanya.
//
// Jebakan:
// - stok_akhir di master_bahan_aksesoris sumber kebenaran tunggal dan HANYA
// ditulis catatPergerakanKartuStok/catatPemakaianDariAlokasi/Scan Opname
// di vue-stock-pembelian.js lewat runTransaction. File ini tidak pernah
// menulis stok_akhir/qty_sisa, cuma membaca.
// - Catat Pemakaian (FIFO multi-roll + popup kekurangan lot) tidak hilang —
// pindah ke vue-scan-persiapan.js dan jadi scan-driven.
// - Teks empty state "Belum ada transaksi masuk/keluar untuk item ini" istilah
// wajib, jangan diparafrase.
// - paginasiDetail.errorPaginasi harus tetap dirender; di versi lama field itu
// ada tapi tidak pernah ditampilkan.
// - Export Excel Kartu Stok memang belum ada, bukan terhapus.
import { createApp, ref, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=13';
import { usePaginasiFirestore } from './vue-paginasi.js';
import { ambilLotAktif } from './vue-stock-pembelian.js';

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

const KartuStokManager = {
  components: { DropdownCari },
  setup() {
    // Item-switcher (BARU, gantikan tabel Ringkasan lama)
    const daftarItemLengkap = ref([]); // semua master_bahan_aksesoris, combobox "ganti item"
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
      muatLotAktifCount();
      paginasiDetail.muatUlang();
    }
    watch(itemEntry, () => {
      const it = opsiItemMap.value.get(itemEntry.value);
      if (it) pilihItem(it);
    });

    // Badge "Lot Aktif" (BARU, wireframe kepala layar) — pakai ULANG
    // ambilLotAktif yang SUDAH diekspor vue-stock-pembelian.js, TIDAK ada fungsi
    // baru. Item yang bukan pakai_lot_tracking otomatis akan menampilkan 0
    // (tidak ada dokumen lot_bahan_aksesoris untuknya) — dianggap wajar, bukan
    // disembunyikan (wireframe menampilkannya tanpa syarat di kepala layar).
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

    // Ledger 1 item (SAMA seperti sebelumnya, TIDAK diubah — cuma dipindah
    // dari sub-tampilan "Detail" ke satu-satunya layar).
    const paginasiDetail = usePaginasiFirestore(db, 'kartu_stok_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'dibuat_pada',
      urutkanArah: 'desc',
      constraintTambahan: () => itemAktif.value ? [where('bahan_aksesoris_id', '==', itemAktif.value.id)] : [],
      petakan: (id, d) => ({ id, ...d })
    });

    // muat — dipanggil ulang tiap tab "Kartu Stok" diklik lagi (lihat
    // pastikanMountKartuStok). Refresh daftar item, dan kalau sedang ada item
    // aktif dipilih, ikut refresh badge lot + ledgernya juga.
    async function muat() {
      await muatDaftarItemLengkap();
      if (itemAktif.value) { await muatLotAktifCount(); await paginasiDetail.muatUlang(); }
    }
    onMounted(async () => { await window.authReady; await muat(); });

    return {
      daftarItemLengkap, memuatDaftarItem, errorDaftarItem, muatDaftarItemLengkap, muat,
      itemEntry, opsiItemNama, itemAktif,
      lotAktifCount, memuatLot,
      paginasiDetail,
      formatQty
    };
  },
  template: `
    <div>
      <!--
        header item-picker + ledger digabung jadi SATU gc-card ( Cuma pembungkus yang berubah —
        isi kolom tabel & semua logic muat/paginasi TIDAK disentuh sama sekali.
      -->
      <div class="gc-card" style="padding:0;">
        <div style="padding:14px 14px 12px; border-bottom:1px solid var(--line);">
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
