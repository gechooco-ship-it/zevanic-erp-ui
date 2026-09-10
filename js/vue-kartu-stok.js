// js/vue-kartu-stok.js
// ============================================================================
// BARU (malam 24 Agt 2026) — Zevanic House > Stock & Pembelian > Kartu Stok.
// Menu BARU (permintaan Guru): melacak JUMLAH stok (bukan cuma harga, beda
// dari Riwayat Harga Pembelian) per bahan/aksesoris — sisi MASUK (pembelian,
// otomatis dari Nota Order Belanja di-final-kan) dan sisi KELUAR.
//
// REKONSTRUKSI TOTAL (7 Sep 2026) — sesuai wireframe handoff "04 - Stok dan
// Pembelian" (§5 "Kartu Stok"), yang menegaskan layar ini "Read-only di
// sini, ditulis oleh Nota dan Scan Opname" — TIDAK ADA form entry manual
// sama sekali di sini pada desain barunya. Ini REDESAIN DISENGAJA (wireframe
// menggantikan perilaku lama, bukan hal yang direkonsiliasi dengan kode
// lama), sesuai keputusan Guru (ditanya eksplisit lewat AskUserQuestion,
// "Pindahkan scope ke Scan Persiapan"):
//
//   1. "Catat Pemakaian" (form desktop, FIFO multi-roll otomatis + popup 3
//      opsi "kekurangan lot" terhubung `persiapan_masalah`) DIHAPUS TOTAL
//      dari file ini. BEDA dari pola "gap fitur sementara yang Guru terima
//      sadar" yang dipakai di modul lain (mis. "List Order Belanja" —
//      lihat js/vue-stock-pembelian.js) — di sini TIDAK ADA gap: KEDUA
//      kemampuan itu SUDAH DIPORT & DIPERLUAS lebih dulu ke
//      `js/vue-scan-persiapan.js` (Zevanic House > Scan > Scan Persiapan,
//      SUDAH LIVE & dites Guru Tahap 1-4 sebelum port ini) SEBELUM
//      penghapusan ini dilakukan — catat pemakaian TETAP BISA dilakukan,
//      cuma pindah menu & jadi scan-driven (bukan form-driven). Lihat
//      catatan header `vue-scan-persiapan.js` (blok "PORT DARI KARTU
//      STOK") untuk detail persis apa yang dipindah & adaptasi UX-nya.
//   2. Layar 2-tingkat lama (Ringkasan [tabel semua item] -> Detail [1
//      item, tombol "Kembali"]) DIGANTI jadi SATU layar sesuai wireframe:
//      item-switcher (dropdown cari, "ganti item ▾") di kepala layar,
//      ledger di bawahnya update di tempat begitu item diganti — TIDAK
//      ADA lagi navigasi bolak-balik/tombol "Kembali ke Ringkasan".
//      Sumber combobox: SEMUA `master_bahan_aksesoris` (full fetch client
//      side, sama pola dgn `ambilDaftarBahanAksesorisLengkap()` di
//      vue-scan-persiapan.js/vue-stock-pembelian.js — koleksi master
//      data terbatas, bukan transaksional, jadi full-fetch dianggap aman
//      "hemat" sesuai PRINSIP-HEMAT.md; BEDA dari ledger-nya sendiri
//      [`kartu_stok_bahan_aksesoris`, bisa ratusan baris per item] yang
//      TETAP paginasi cursor-based lewat usePaginasiFirestore, TIDAK
//      diubah dari sebelumnya).
//      TIDAK ADA lagi filter Kategori / tabel-list-semua-item terpisah
//      (yang dulu ada di Ringkasan) — wireframe cuma minta 1 kontrol
//      ringkas "ganti item ▾", bukan layar browsing dgn filter; pencarian
//      substring bawaan `DropdownCari` (component yang sudah ada) dianggap
//      cukup menggantikan peran itu.
//   3. Header info: "Stok Akhir Saat Ini" (SUDAH ADA sebelumnya) + BARU
//      "Lot Aktif" (badge jumlah lot AKTIF item terpilih, lewat
//      `ambilLotAktif()` yang SUDAH diekspor `js/vue-stock-pembelian.js`
//      — signature/perilakunya DIKONFIRMASI TIDAK BERUBAH sesudah audit
//      "Daftar Nota" sesi ini, DIPAKAI ULANG PERSIS, TIDAK ada fungsi baru
//      di file itu).
//   4. Fitur "Scan Barang" (jalan pintas QR buka Detail lebih cepat, +
//      kamera/jsQR) DIHAPUS BERSAMAAN — itu cuma jalan pintas ke "Catat
//      Pemakaian" yang sekarang sudah tidak ada di layar ini, dan
//      wireframe tidak menggambarkan kontrol scan di layar ini (cuma
//      kotak cari + dropdown biasa). Kalau nanti ternyata dibutuhkan lagi
//      (mis. buat mempercepat pilih item read-only), ini keputusan
//      terpisah yang belum diminta — TIDAK ditambahkan sendiri di sini.
//   5. 5 state ditegakkan: loading (memuat daftar item / memuat ledger),
//      kosong (belum pilih item -- DAN item terpilih tapi ledger-nya
//      kosong, teks PERSIS sesuai wireframe §"Empty state": "Belum ada
//      transaksi masuk/keluar untuk item ini" -- istilah wajib, TIDAK
//      diparafrase), error (gagal muat daftar item ATAU gagal muat ledger
//      -- lewat `paginasiDetail.errorPaginasi` yang SEBENARNYA SUDAH ADA
//      di composable `usePaginasiFirestore` sejak awal tapi belum pernah
//      ditampilkan di template Detail versi lama -- CELAH lama, sekalian
//      diperbaiki di sini, pola pesan sama dgn `AppConfigRiwayatPin` di
//      js/vue-config.js), ideal (ledger terisi normal), ekstrem (ratusan
//      baris ledger -- paginasi cursor-based yang SUDAH ADA, perHalaman:15
//      + tombol Sebelumnya/Berikutnya, TIDAK diubah dari sebelumnya).
//   6. Export Excel Kartu Stok: SENGAJA TIDAK disentuh sama sekali (masih
//      "Yang Belum Diputuskan" §7 SERAH-TERIMA.md — bukan ditolak, bukan
//      ditambah, dibiarkan seperti apa adanya/tidak ada).
//
// `stok_akhir` di `master_bahan_aksesoris` TETAP SUMBER KEBENARAN TUNGGAL,
// TETAP HANYA dihitung lewat `catatPergerakanKartuStok()`/
// `catatPemakaianDariAlokasi()`/fungsi Scan Opname di vue-stock-pembelian.js
// (runTransaction, atomik) — file INI (sekarang read-only total) TIDAK
// PERNAH menulis stok_akhir/qty_sisa, cuma MEMBACA.
// ============================================================================
import { createApp, ref, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=7';
import { usePaginasiFirestore } from './vue-paginasi.js';
import { ambilLotAktif } from './vue-stock-pembelian.js';

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
// pesanErrorFirestore — disalin dari js/vue-config.js (`AppConfigRiwayatPin`
// > `pesanError()`), pola "salin logic kecil per-file" proyek ini — bukan
// diimpor lintas file (fungsi itu privat di komponen tsb).
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
    // ---- Item-switcher (BARU, gantikan tabel Ringkasan lama) ----
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

    // ---- Badge "Lot Aktif" (BARU, wireframe kepala layar) — pakai ULANG
    // ambilLotAktif() yang SUDAH diekspor vue-stock-pembelian.js, TIDAK ada
    // fungsi baru. Item yang bukan pakai_lot_tracking otomatis akan
    // menampilkan 0 (tidak ada dokumen lot_bahan_aksesoris untuknya) —
    // dianggap wajar, bukan disembunyikan (wireframe menampilkannya tanpa
    // syarat di kepala layar).
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

    // ---- Ledger 1 item (SAMA seperti sebelumnya, TIDAK diubah — cuma
    // dipindah dari sub-tampilan "Detail" ke satu-satunya layar). ----
    const paginasiDetail = usePaginasiFirestore(db, 'kartu_stok_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'dibuat_pada',
      urutkanArah: 'desc',
      constraintTambahan: () => itemAktif.value ? [where('bahan_aksesoris_id', '==', itemAktif.value.id)] : [],
      petakan: (id, d) => ({ id, ...d })
    });

    onMounted(async () => {
      await window.authReady;
      await muatDaftarItemLengkap();
    });

    return {
      daftarItemLengkap, memuatDaftarItem, errorDaftarItem, muatDaftarItemLengkap,
      itemEntry, opsiItemNama, itemAktif,
      lotAktifCount, memuatLot,
      paginasiDetail,
      formatQty
    };
  },
  template: `
    <div>
      <!-- BARU (9 Sep 2026, audit wireframe §5 "Kartu Stok") — header
           item-picker + ledger digabung jadi SATU gc-card (dulu 2 gc-card
           bertumpuk terpisah). Cuma pembungkus yang berubah — isi kolom
           tabel & semua logic muat/paginasi TIDAK disentuh sama sekali. -->
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

const AppKartuStok = { components: { KartuStokManager }, template: `<kartu-stok-manager />` };
let vmKartuStok = null;
window.pastikanMountKartuStok = function() {
  if (vmKartuStok) return;
  const mountPoint = document.getElementById('vue-kartu-stok');
  if (mountPoint) vmKartuStok = createApp(AppKartuStok).mount('#vue-kartu-stok');
};
