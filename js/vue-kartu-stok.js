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
//
// UPDATE (25 Agt 2026, §25.3) — FIFO Roll/Lot. Untuk item yang ditandai
// `pakai_lot_tracking` (lihat vue-bahan-aksesoris.js), "Catat Pemakaian"
// SEKARANG motong dari roll/lot TERLAMA dulu lewat `catatPemakaianDenganFifo()`
// (`vue-stock-pembelian.js`) — bukan cuma kurangi `stok_akhir` agregat
// seperti item biasa. Kalau data lot BELUM ADA sama sekali -> BLOKIR
// (keputusan Guru). Kalau lot ADA tapi KURANG dari yang diminta -> muncul
// popup 3 opsi keputusan (kurangi jumlah / proses sebagian + sisanya masuk
// Persiapan Masalah / tunggu dulu) — SEMUA lewat koleksi `persiapan_masalah`
// yang SUDAH ADA apa adanya, tidak ada skema baru. Lihat STATUS-PROYEK.md §25.3.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js';
import { usePaginasiFirestore } from './vue-paginasi.js';
import { catatPergerakanKartuStok, catatPemakaianDenganFifo } from './vue-stock-pembelian.js';

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
    // BARU (25 Agt 2026, §25.3) — popup 3 opsi keputusan, muncul kalau
    // catatPemakaianDenganFifo() lempar error LOT_KURANG. null = tidak
    // tampil. Diisi { totalTersedia, qtyDiminta, kekurangan, tanggal, keterangan }.
    const kekuranganLot = ref(null);
    const memprosesKeputusan = ref(false);

    function ringkasRincianLot(rincian) {
      return rincian.map(r => `Lot masuk ${r.tanggal_masuk}: dipotong ${formatQty(r.dipotong)} (sisa ${formatQty(r.sisa_setelah)})`).join('\n');
    }

    async function catatPemakaian() {
      if (!itemAktif.value) return;
      const qty = parseFloat(formPemakaian.qty);
      if (!(qty > 0)) return alert('Isi jumlah pemakaian dulu (lebih dari 0).');

      // BARU (25 Agt 2026, §25.3) — item pakai_lot_tracking: jalur FIFO,
      // BEDA TOTAL dari item biasa (lihat catatan header file ini).
      if (itemAktif.value.pakai_lot_tracking) {
        menyimpanPemakaian.value = true;
        try {
          const hasil = await catatPemakaianDenganFifo({
            bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: formPemakaian.tanggal,
            qty, satuan: itemAktif.value.satuan_pemakaian || '', keterangan: formPemakaian.keterangan || ''
          });
          itemAktif.value.stok_akhir = hasil.stokSetelah;
          formPemakaian.qty = ''; formPemakaian.keterangan = '';
          await paginasiDetail.muatUlang();
          alert(`Pemakaian berhasil dicatat (FIFO dari roll/lot terlama).\n\n${ringkasRincianLot(hasil.rincian)}`);
        } catch (e) {
          if (e.kode === 'LOT_KOSONG') {
            alert('Item ini ditandai perlu Qty per Roll/Lot, TAPI belum ada data lot sama sekali untuk item ini. Pemakaian TIDAK BISA dicatat sampai ada data lot — isi dulu lewat popup "Qty per Roll/Lot" di Nota Order Belanja saat barang diterima.');
          } else if (e.kode === 'LOT_KURANG') {
            kekuranganLot.value = {
              totalTersedia: e.totalTersedia, qtyDiminta: qty,
              kekurangan: Math.round((qty - e.totalTersedia) * 100) / 100,
              tanggal: formPemakaian.tanggal, keterangan: formPemakaian.keterangan
            };
          } else {
            console.error('Gagal catat pemakaian (FIFO):', e);
            alert('Gagal menyimpan. Coba lagi.');
          }
        }
        menyimpanPemakaian.value = false;
        return;
      }

      // Item BIASA (tidak pakai_lot_tracking) — perilaku LAMA, tidak berubah.
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

    function tutupKeputusanKekurangan() { kekuranganLot.value = null; }

    // ajukanPersiapanMasalahKekurangan — dipakai OPSI B & C. Nulis 1 entri
    // BIASA ke `persiapan_masalah` (koleksi & skema yang SUDAH ADA, TIDAK
    // ada field baru) sejumlah `kekurangan` — otomatis masuk alur "perlu
    // dibeli" yang sudah berjalan (muncul di List/Nota Order Belanja).
    async function ajukanPersiapanMasalahKekurangan(k) {
      await addDoc(collection(db, 'persiapan_masalah'), {
        bahan_aksesoris_id: itemAktif.value.id,
        kategori_utama: itemAktif.value.kategori_utama || '',
        nama_bahan: itemAktif.value.nama,
        qty: k.kekurangan,
        satuan: itemAktif.value.satuan_pemakaian || '',
        keterangan: `Kekurangan stok roll/lot saat Catat Pemakaian tanggal ${k.tanggal} (tersedia ${formatQty(k.totalTersedia)}, diminta ${formatQty(k.qtyDiminta)})${k.keterangan ? ' — ' + k.keterangan : ''}`,
        status: 'menunggu',
        diminta_oleh: window.currentUser?.email || '-',
        dibuat_pada: serverTimestamp()
      });
    }

    // OPSI A — "Kurangi jumlah pemakaian": catat pemakaian SEJUMLAH yang
    // tersedia saja (pas dengan total qty_sisa lot aktif), tidak ada sisa,
    // tidak ada entri Persiapan Masalah baru.
    async function kurangiKeYangTersedia() {
      if (!kekuranganLot.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        const hasil = await catatPemakaianDenganFifo({
          bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: k.tanggal,
          qty: k.totalTersedia, satuan: itemAktif.value.satuan_pemakaian || '',
          keterangan: (k.keterangan || '') + ' (dikurangi otomatis ke qty yang tersedia — roll/lot tidak cukup)'
        });
        itemAktif.value.stok_akhir = hasil.stokSetelah;
        formPemakaian.qty = ''; formPemakaian.keterangan = '';
        kekuranganLot.value = null;
        await paginasiDetail.muatUlang();
        alert(`Pemakaian dicatat sejumlah ${formatQty(k.totalTersedia)} (dikurangi dari permintaan awal ${formatQty(k.qtyDiminta)} karena roll/lot tidak cukup).\n\n${ringkasRincianLot(hasil.rincian)}`);
      } catch (e) {
        console.error('Gagal proses "Kurangi jumlah pemakaian":', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // OPSI B — "Proses sebagian, order sisanya": catat pemakaian sejumlah
    // yang tersedia LEWAT FIFO SEKARANG, sisa kekurangan otomatis masuk
    // Persiapan Masalah.
    async function prosesSebagianDanAjukanSisa() {
      if (!kekuranganLot.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        let hasil = null;
        if (k.totalTersedia > 0) {
          hasil = await catatPemakaianDenganFifo({
            bahanId: itemAktif.value.id, namaBahan: itemAktif.value.nama, tanggal: k.tanggal,
            qty: k.totalTersedia, satuan: itemAktif.value.satuan_pemakaian || '',
            keterangan: (k.keterangan || '') + ' (diproses sebagian, sisa diajukan ke Persiapan Masalah)'
          });
          itemAktif.value.stok_akhir = hasil.stokSetelah;
        }
        await ajukanPersiapanMasalahKekurangan(k);
        formPemakaian.qty = ''; formPemakaian.keterangan = '';
        kekuranganLot.value = null;
        await paginasiDetail.muatUlang();
        alert(`${formatQty(k.totalTersedia)} sudah dicatat sebagai pemakaian. Sisa kekurangan (${formatQty(k.kekurangan)}) otomatis masuk antrean di menu Persiapan Masalah.`);
      } catch (e) {
        console.error('Gagal proses "Proses sebagian, order sisanya":', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    // OPSI C — "Tunggu dulu": TIDAK ada yang dicatat/dipotong sama sekali
    // sekarang, cuma kekurangan yang masuk Persiapan Masalah — admin/PIC
    // coba lagi "Catat Pemakaian" (qty penuh) nanti setelah stok cukup.
    async function tundaDanAjukanKekurangan() {
      if (!kekuranganLot.value) return;
      const k = kekuranganLot.value;
      memprosesKeputusan.value = true;
      try {
        await ajukanPersiapanMasalahKekurangan(k);
        kekuranganLot.value = null;
        alert(`Belum ada yang dicatat. Kekurangan (${formatQty(k.kekurangan)}) otomatis masuk antrean di menu Persiapan Masalah — coba "Catat Pemakaian" lagi (qty ${formatQty(k.qtyDiminta)}) setelah stok cukup.`);
      } catch (e) {
        console.error('Gagal proses "Tunggu dulu":', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      memprosesKeputusan.value = false;
    }

    onMounted(async () => { await window.authReady; await paginasiRingkasan.muatUlang(); });

    return {
      tampilan, filterKategori, paginasiRingkasan, paginasiDetail, itemAktif,
      bukaDetail, kembaliKeRingkasan, formPemakaian, menyimpanPemakaian, catatPemakaian,
      kekuranganLot, memprosesKeputusan, tutupKeputusanKekurangan,
      kurangiKeYangTersedia, prosesSebagianDanAjukanSisa, tundaDanAjukanKekurangan,
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
          <p v-if="itemAktif.pakai_lot_tracking" style="font-size:10.5px; color:var(--text-faint); margin-top:8px;"><i class="fas fa-layer-group" style="margin-right:4px;"></i>Item ini dilacak per Roll/Lot — pemakaian dipotong OTOMATIS dari roll/lot TERLAMA dulu (FIFO). Kalau roll/lot belum ada datanya sama sekali, pemakaian tidak bisa dicatat dulu.</p>
          <p v-else style="font-size:10.5px; color:var(--text-faint); margin-top:8px;">Belum ada modul Produksi/SPK otomatis — pemakaian dicatat manual dulu di sini sampai modul itu ada.</p>
        </div>

        <!-- BARU (25 Agt 2026, §25.3) — popup 3 opsi keputusan saat roll/lot
             kurang dari qty yang diminta. -->
        <div v-if="kekuranganLot" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
          <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto;">
            <h3 style="font-weight:700; font-size:15px; margin-bottom:10px;"><i class="fas fa-triangle-exclamation" style="color:var(--danger); margin-right:8px;"></i>Roll/Lot Tidak Cukup</h3>
            <p style="font-size:12px; margin-bottom:14px;">Stok di roll/lot yang tersedia cuma <b>{{ formatQty(kekuranganLot.totalTersedia) }} {{ itemAktif.satuan_pemakaian }}</b>, tapi mau dicatat pemakaian <b>{{ formatQty(kekuranganLot.qtyDiminta) }} {{ itemAktif.satuan_pemakaian }}</b> (kurang {{ formatQty(kekuranganLot.kekurangan) }}). Pilih tindak lanjut:</p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button @click="kurangiKeYangTersedia" :disabled="memprosesKeputusan" class="btn-outline" style="text-align:left; padding:10px 14px;">
                <b>Kurangi jumlah pemakaian</b><br><span style="font-size:11px; color:var(--text-faint);">Catat pemakaian sejumlah yang tersedia saja ({{ formatQty(kekuranganLot.totalTersedia) }})</span>
              </button>
              <button @click="prosesSebagianDanAjukanSisa" :disabled="memprosesKeputusan" class="btn-outline" style="text-align:left; padding:10px 14px;">
                <b>Proses sebagian, order sisanya</b><br><span style="font-size:11px; color:var(--text-faint);">Catat {{ formatQty(kekuranganLot.totalTersedia) }} sekarang, sisa kekurangan ({{ formatQty(kekuranganLot.kekurangan) }}) otomatis masuk antrean Persiapan Masalah</span>
              </button>
              <button @click="tundaDanAjukanKekurangan" :disabled="memprosesKeputusan" class="btn-outline" style="text-align:left; padding:10px 14px;">
                <b>Tunggu dulu</b><br><span style="font-size:11px; color:var(--text-faint);">Belum dicatat apa-apa sekarang, kekurangan ({{ formatQty(kekuranganLot.kekurangan) }}) masuk antrean Persiapan Masalah — coba Catat Pemakaian lagi nanti setelah stok cukup</span>
              </button>
            </div>
            <button @click="tutupKeputusanKekurangan" :disabled="memprosesKeputusan" class="btn-outline" style="width:100%; margin-top:14px;">Batal</button>
          </div>
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
                  <td>{{ g.keterangan || '-' }}
                    <i v-if="g.rincian_lot && g.rincian_lot.length" class="fas fa-circle-info" style="color:var(--burgundy); margin-left:4px; cursor:help;"
                      :title="g.rincian_lot.map(r => 'Lot masuk ' + r.tanggal_masuk + ': dipotong ' + formatQty(r.dipotong) + ' (sisa ' + formatQty(r.sisa_setelah) + ')').join('\n')"></i>
                  </td>
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
