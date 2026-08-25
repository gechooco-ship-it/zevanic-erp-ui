// js/vue-kartu-stok.js
// ============================================================================
// BARU (malam 24 Agt 2026) — Zevanic House > Stock & Pembelian > Kartu Stok.
// Menu BARU (permintaan Guru): melacak JUMLAH stok (bukan cuma harga, beda
// dari Riwayat Harga Pembelian) per bahan/aksesoris — sisi MASUK (pembelian,
// otomatis dari Nota Order Belanja di-final-kan — lihat hook di
// js/vue-stock-pembelian.js `catatPergerakanKartuStok()`, DIPAKAI ULANG di
// sini, BUKAN didesain ulang) dan sisi KELUAR (pemakaian, form manual di
// halaman ini — BELUM ada modul produksi/konsumsi bahan otomatis).
//
// 2 tampilan (permintaan Guru persis):
// - KARTU STOK RINGKASAN — tabel semua item + stok_akhir masing-masing
//   (paginasi cursor-based, PRINSIP-HEMAT.md), klik 1 baris -> buka Detail.
// - KARTU STOK DETAIL — 1 item: saldo saat ini + riwayat pergerakan
//   (masuk/keluar, saldo berjalan tiap baris) + form "Catat Pemakaian".
//
// `stok_akhir` di `master_bahan_aksesoris` (field BARU, lihat
// PETA-DATABASE.md) JUGA ditampilkan sebagai kolom baru di List Bahan &
// Aksesoris (vue-bahan-aksesoris.js) — SUMBER KEBENARAN TUNGGAL ada di
// field itu, dihitung SELALU lewat catatPergerakanKartuStok() (runTransaction,
// atomik) — JANGAN PERNAH update stok_akhir langsung dari tempat lain.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js';
import { usePaginasiFirestore } from './vue-paginasi.js';
import { catatPergerakanKartuStok } from './vue-stock-pembelian.js';

function formatRupiah(n) {
  const angka = Math.round(parseFloat(n) || 0);
  return 'Rp ' + angka.toLocaleString('id-ID');
}
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

const KartuStokManager = {
  components: { DropdownCari },
  setup() {
    const tampilan = ref('ringkasan'); // 'ringkasan' | 'detail'
    const filterKategori = ref('ALL');

    const paginasiRingkasan = usePaginasiFirestore(db, 'master_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama',
      constraintTambahan: () => filterKategori.value === 'ALL' ? [] : [where('kategori_utama', '==', filterKategori.value)],
      petakan: (id, d) => ({ id, ...d })
    });

    // ---- Detail 1 item ----
    const itemAktif = ref(null); // seluruh dokumen master_bahan_aksesoris item yang dibuka
    const paginasiDetail = usePaginasiFirestore(db, 'kartu_stok_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'dibuat_pada',
      urutkanArah: 'desc',
      constraintTambahan: () => itemAktif.value ? [where('bahan_aksesoris_id', '==', itemAktif.value.id)] : [],
      petakan: (id, d) => ({ id, ...d })
    });

    function bukaDetail(item) {
      itemAktif.value = item;
      tampilan.value = 'detail';
      paginasiDetail.muatUlang();
    }
    function kembaliKeRingkasan() {
      tampilan.value = 'ringkasan';
      itemAktif.value = null;
      paginasiRingkasan.muatUlang(); // stok_akhir mungkin berubah kalau tadi sempat catat pemakaian
    }

    // ---- Form "Catat Pemakaian" (sisi KELUAR, manual) ----
    const formPemakaian = reactive({ tanggal: new Date().toISOString().split('T')[0], qty: '', keterangan: '' });
    const menyimpanPemakaian = ref(false);
    async function catatPemakaian() {
      if (!itemAktif.value) return;
      const qty = parseFloat(formPemakaian.qty);
      if (!(qty > 0)) return alert('Isi jumlah pemakaian dulu (lebih dari 0).');
      const stokSaatIni = parseFloat(itemAktif.value.stok_akhir) || 0;
      if (qty > stokSaatIni) {
        if (!confirm(`Stok saat ini cuma ${formatQty(stokSaatIni)} ${itemAktif.value.satuan_pemakaian || ''}, tapi mau catat pemakaian ${formatQty(qty)}. Stok akan jadi MINUS. Lanjutkan?`)) return;
      }
      menyimpanPemakaian.value = true;
      try {
        await catatPergerakanKartuStok({
          bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: formPemakaian.tanggal,
          jenis: 'keluar', qty, satuan: itemAktif.value.satuan_pemakaian || '',
          sumber: 'Pemakaian Manual', noPembelian: '', keterangan: formPemakaian.keterangan || ''
        });
        // Refresh saldo yang ditampilkan di header Detail (baca ulang 1 dokumen,
        // bukan seluruh Ringkasan — hemat, cuma yang berubah).
        itemAktif.value.stok_akhir = itemAktif.value.stok_akhir
          ? (parseFloat(itemAktif.value.stok_akhir) || 0) - qty
          : -qty;
        formPemakaian.qty = ''; formPemakaian.keterangan = '';
        await paginasiDetail.muatUlang();
        alert('Pemakaian berhasil dicatat.');
      } catch (e) {
        console.error('Gagal catat pemakaian:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      menyimpanPemakaian.value = false;
    }

    onMounted(async () => { await window.authReady; await paginasiRingkasan.muatUlang(); });

    return {
      tampilan, filterKategori, paginasiRingkasan, paginasiDetail, itemAktif,
      bukaDetail, kembaliKeRingkasan, formPemakaian, menyimpanPemakaian, catatPemakaian,
      formatRupiah, formatQty
    };
  },
  template: `
    <div>
      <template v-if="tampilan === 'ringkasan'">
        <div class="gc-card" style="padding:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Kartu Stok — Ringkasan</label>
          <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Stok Akhir dihitung otomatis: MASUK dari Nota Order Belanja yang di-final-kan, KELUAR dari pencatatan Pemakaian manual di halaman Detail (klik 1 baris di bawah).</p>

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
            <div style="position:relative; max-width:320px; flex:1; min-width:220px;">
              <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
              <input :value="paginasiRingkasan.cariTeks.value" @input="paginasiRingkasan.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
            </div>
            <select v-model="filterKategori" @change="paginasiRingkasan.muatUlang()" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
              <option value="ALL">Semua Kategori</option>
              <option value="Bahan">Bahan</option>
              <option value="Aksesoris">Aksesoris</option>
            </select>
          </div>

          <div v-if="paginasiRingkasan.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
          <div v-else-if="paginasiRingkasan.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasiRingkasan.errorPaginasi.value }}</div>
          <div v-else-if="paginasiRingkasan.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada data.</div>
          <div v-else style="overflow-x:auto;">
            <table class="gc-table" style="width:100%; font-size:11.5px;">
              <thead><tr>
                <th>Nama</th><th>Kategori</th><th>Warna</th><th>Satuan Pemakaian</th><th>Stok Akhir</th><th></th>
              </tr></thead>
              <tbody>
                <tr v-for="item in paginasiRingkasan.dataHalaman.value" :key="item.id" style="cursor:pointer;" @click="bukaDetail(item)">
                  <td>{{ item.nama }}</td><td>{{ item.kategori_utama }}</td><td>{{ item.warna || '-' }}</td>
                  <td>{{ item.satuan_pemakaian || '-' }}</td>
                  <td style="font-weight:700; color:var(--burgundy);">{{ formatQty(item.stok_akhir || 0) }}</td>
                  <td><button class="icon-btn" @click.stop="bukaDetail(item)" title="Lihat Kartu Stok Detail"><i class="fas fa-arrow-right"></i></button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="!paginasiRingkasan.memuat.value && paginasiRingkasan.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
            <button class="icon-btn" :disabled="paginasiRingkasan.nomorHalaman.value <= 1" @click="paginasiRingkasan.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
            <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiRingkasan.nomorHalaman.value }}</span>
            <button class="icon-btn" :disabled="!paginasiRingkasan.adaBerikutnya.value" @click="paginasiRingkasan.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </template>

      <template v-else-if="tampilan === 'detail' && itemAktif">
        <div class="gc-card" style="padding:14px; margin-bottom:14px;">
          <button @click="kembaliKeRingkasan" class="btn-outline" style="font-size:11px; padding:6px 12px; margin-bottom:12px;"><i class="fas fa-arrow-left" style="margin-right:6px;"></i>Kembali ke Ringkasan</button>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="font-weight:700; font-size:16px;">{{ itemAktif.nama }}</h3>
              <p style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">{{ itemAktif.kategori_utama }} · {{ itemAktif.warna || '-' }} · Satuan Pemakaian: {{ itemAktif.satuan_pemakaian || '-' }}</p>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Stok Akhir Saat Ini</div>
              <div style="font-size:22px; font-weight:700; color:var(--burgundy);">{{ formatQty(itemAktif.stok_akhir || 0) }} <span style="font-size:13px; font-weight:400;">{{ itemAktif.satuan_pemakaian || '' }}</span></div>
            </div>
          </div>
        </div>

        <div class="gc-card" style="padding:14px; margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:10px;">Catat Pemakaian</label>
          <div style="display:grid; grid-template-columns:1fr 1fr 2fr auto; gap:8px; align-items:end;">
            <div class="gc-field" style="margin-bottom:0;"><label>Tanggal</label><input v-model="formPemakaian.tanggal" type="date" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Jumlah ({{ itemAktif.satuan_pemakaian || 'satuan' }})</label><input v-model.number="formPemakaian.qty" type="number" min="0" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Keterangan (opsional)</label><input v-model="formPemakaian.keterangan" type="text" placeholder="mis. dipakai buat SPK #123" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <button @click="catatPemakaian" :disabled="menyimpanPemakaian" class="btn-primary" style="padding:0 18px; height:38px;">{{ menyimpanPemakaian ? 'Menyimpan...' : 'Catat' }}</button>
          </div>
          <p style="font-size:10.5px; color:var(--text-faint); margin-top:8px;">Belum ada modul Produksi/SPK otomatis — pemakaian dicatat manual dulu di sini sampai modul itu ada.</p>
        </div>

        <div class="gc-card" style="padding:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Pergerakan</label>
          <div v-if="paginasiDetail.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
          <div v-else-if="paginasiDetail.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada pergerakan stok buat item ini.</div>
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
                  <td>{{ g.keterangan || '-' }}</td>
                  <td style="font-weight:700;">{{ formatQty(g.saldo_setelah) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!paginasiDetail.memuat.value && paginasiDetail.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
            <button class="icon-btn" :disabled="paginasiDetail.nomorHalaman.value <= 1" @click="paginasiDetail.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
            <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiDetail.nomorHalaman.value }}</span>
            <button class="icon-btn" :disabled="!paginasiDetail.adaBerikutnya.value" @click="paginasiDetail.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </template>
    </div>
  `
};

const AppKartuStok = { components: { KartuStokManager }, template: `<kartu-stok-manager />` };
let vmKartuStok = null;
window.pastikanMountKartuStok = function() {
  if (vmKartuStok) return;
  const mountPoint = document.getElementById('vue-kartu-stok');
  if (mountPoint) vmKartuStok = createApp(AppKartuStok).mount('#vue-kartu-stok');
};
