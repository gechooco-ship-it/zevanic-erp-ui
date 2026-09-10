// js/vue-repack-komponen-acc.js
// ============================================================================
// Zevanic House > Stock & Pembelian > "Repack" — sub-tab BARU (7 Sep 2026,
// task #95, TIDAK ADA wireframe/handoff sama sekali untuk modul ini —
// dirancang langsung dari jawaban Guru lewat AskUserQuestion (bukan
// tebakan), karena PEDOMAN skill "keputusan kompleks/ambigu -> interupsi
// Guru saat itu juga" — modul baru tanpa spek apapun jelas masuk kategori
// itu. Guru sendiri menamainya "Repack".
//
// APA INI: Gudang sering mengemas ulang stok lepasan aksesoris jadi paket
// jumlah tetap (mis. 25 pcs/pak) supaya operator produksi tidak perlu
// menghitung ulang dari nol tiap butuh — tinggal ambil 1 pak yang isinya
// sudah pasti. Modul ini CUMA mencatat "sudah berapa pak tersedia" per
// item+ukuran pak.
//
// KEPUTUSAN GURU (AskUserQuestion, 7 Sep 2026) — JANGAN diubah tanpa
// re-konfirmasi:
//   1. "Cuma label, stok tidak berubah" — `stok_akhir` di
//      master_bahan_aksesoris (SATU-SATUNYA sumber kebenaran stok, lihat
//      js/vue-kartu-stok.js/vue-stock-pembelian.js) TIDAK PERNAH disentuh
//      file ini. Bikin/buka pak TIDAK menulis stok_akhir sama sekali —
//      murni lapisan visibilitas "berapa yang sudah dikemas rapi", bukan
//      transaksi stok. Konsekuensinya: TIDAK butuh runTransaction sama
//      sekali di file ini (beda dari modul Persiapan Produksi yang
//      transaksional karena menyentuh stok betulan).
//   2. "Boleh dipecah" — pak BOLEH dibuka kapan saja, tidak ada gerbang/
//      approval. "Buka 1 Pak" cuma menandai 1 dokumen jadi status='dibuka'
//      (histori, TIDAK dihapus — konsisten pola proyek ini: status
//      berubah, dokumen tetap ada buat jejak).
//
// SKEMA — koleksi BARU `repack_komponen_acc`, 1 DOKUMEN PER PAK FISIK
// (bukan 1 dokumen+counter agregat) — sengaja, supaya "Buka 1 Pak" cuma
// updateDoc 1 dokumen tunggal, tidak perlu transaksi buat hindari race
// condition di angka bersama (pola sama seperti roll_sisa_webbing,
// vue-persiapan-webbing.js, yang juga 1 dokumen per unit fisik):
//   bahan_aksesoris_id, nama_aksesoris, warna, satuan (snapshot
//   satuan_pemakaian SAAT pak dibuat), isi_per_pak (angka, pcs per pak),
//   status ('tersedia'|'dibuka'), dibuat_oleh, dibuat_pada,
//   dibuka_oleh, dibuka_pada (null sampai dibuka).
//
// SCOPE ITEM — "Komponen Acc" dibaca sebagai kategori_utama === 'Aksesoris'
// SAJA (bukan 'Bahan'/kain) — sesuai nama tugas "Kemasan Komponen Acc".
// Query bertarget where('kategori_utama','==','Aksesoris') dipakai di
// picker (bukan fetch semua lalu filter JS — PELAJARAN.md).
//
// TIDAK ADA cetak label/QR di v1 ini — modul ini murni visibilitas jumlah
// pak, bukan flow scan produksi. Kalau nanti Guru mau pak fisik ada label
// tercetak (supaya gampang dicocokkan ke rak), itu penambahan terpisah
// (reuse PopupPratinjauCetakLabel + buatQrDataUrl seperti modul lain, pola
// sudah ada) — SENGAJA belum ditambah sekarang, tidak diminta.
// ============================================================================
import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=7';

const MENU_ID = 'stock_repack';
const TAMBAH_TAMPIL = 20;
const MAKS_PAK_SEKALI_BUAT = 200; // pagar wajar, cegah salah ketik/abuse

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
function formatWaktu(ts) {
  if (!ts) return '-';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) { return '-'; }
}
function pesanErrorFirestore(e) {
  if (e && e.code === 'failed-precondition') {
    return 'Perlu index Firestore baru — buka Console browser (F12), cari link "Create composite index" dari error ini, klik untuk bikin index-nya sekali, lalu muat ulang halaman ini.';
  }
  if (e && e.code === 'permission-denied') {
    return 'Tidak punya izin membaca data Repack. Hubungi Owner/Admin kalau ini tidak seharusnya terjadi.';
  }
  return 'Gagal memuat data Repack. Coba lagi.';
}
// kunciGrup — 1 baris tabel = 1 kombinasi item+isi_per_pak (pak beda isi
// dari item yang sama TETAP baris terpisah, supaya "isi 25" vs "isi 50"
// tidak tercampur di 1 angka).
function kunciGrup(d) { return `${d.bahan_aksesoris_id}::${d.isi_per_pak}`; }

const RepackKomponenAccManager = {
  components: { DropdownCari },
  setup() {
    const memuat = ref(true);
    const errorMuat = ref('');
    const daftarPak = ref([]); // semua dokumen status:'tersedia' (repack_komponen_acc)
    const cari = ref('');
    const batasTampil = ref(TAMBAH_TAMPIL);
    const sedangProses = reactive({}); // kunciGrup -> bool, gerbang klik dobel

    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const snap = await getDocs(query(collection(db, 'repack_komponen_acc'), where('status', '==', 'tersedia')));
        daftarPak.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Repack Komponen Acc:', e);
        errorMuat.value = pesanErrorFirestore(e);
        daftarPak.value = [];
      }
      memuat.value = false;
    }

    // --- Kelompokkan jadi baris tabel (1 baris = 1 item + 1 ukuran pak) ---
    const kelompok = computed(() => {
      const peta = {};
      daftarPak.value.forEach(d => {
        const key = kunciGrup(d);
        if (!peta[key]) {
          peta[key] = {
            key, bahanAksesorisId: d.bahan_aksesoris_id, nama: d.nama_aksesoris, warna: d.warna,
            satuan: d.satuan, isiPerPak: d.isi_per_pak, pak: []
          };
        }
        peta[key].pak.push(d);
      });
      const list = Object.values(peta);
      list.forEach(g => {
        // FIFO — pak yang dibuat lebih dulu diambil lebih dulu saat "Ambil 1 Pak"
        g.pak.sort((a, b) => (a.dibuat_pada?.toMillis ? a.dibuat_pada.toMillis() : 0) - (b.dibuat_pada?.toMillis ? b.dibuat_pada.toMillis() : 0));
        g.jumlahPak = g.pak.length;
        g.totalPcs = g.jumlahPak * (parseFloat(g.isiPerPak) || 0);
      });
      list.sort((a, b) => (a.nama || '').localeCompare(b.nama || '') || (a.isiPerPak - b.isiPerPak));
      return list;
    });

    const kelompokTerfilter = computed(() => {
      const q = cari.value.trim().toLowerCase();
      if (!q) return kelompok.value;
      return kelompok.value.filter(g => (g.nama || '').toLowerCase().includes(q) || (g.warna || '').toLowerCase().includes(q));
    });
    const kelompokTampil = computed(() => kelompokTerfilter.value.slice(0, batasTampil.value));
    const adaLebihBanyak = computed(() => kelompokTerfilter.value.length > batasTampil.value);
    function muatLebihBanyak() { batasTampil.value += TAMBAH_TAMPIL; }

    const ringkasan = computed(() => ({
      jumlahBaris: kelompokTerfilter.value.length,
      totalPak: kelompokTerfilter.value.reduce((s, g) => s + g.jumlahPak, 0)
    }));

    // --- Ambil 1 Pak (buka pak paling lama di grup ini — FIFO, boleh
    // dipecah kapan saja, keputusan Guru) ---
    async function ambilSatuPak(g) {
      if (!bolehProses.value || sedangProses[g.key] || !g.pak.length) return;
      sedangProses[g.key] = true;
      try {
        const pakDiambil = g.pak[0];
        await updateDoc(doc(db, 'repack_komponen_acc', pakDiambil.id), {
          status: 'dibuka', dibuka_oleh: window.currentUser?.email || '', dibuka_pada: serverTimestamp()
        });
        await muat();
      } catch (e) {
        console.error('Gagal membuka pak:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      sedangProses[g.key] = false;
    }

    // ------------------------------------------------------------------
    // Popup "Buat Pak Baru"
    // ------------------------------------------------------------------
    const popupTerbuka = ref(false);
    const daftarItemAksesoris = ref([]); // master_bahan_aksesoris, kategori_utama='Aksesoris' saja
    const memuatItem = ref(false);
    const itemEntry = ref('');
    const itemTerpilih = ref(null);
    const isiPerPakBaru = ref('');
    const jumlahPakBaru = ref(1);
    const menyimpan = ref(false);

    const opsiItemMap = computed(() => {
      const map = new Map();
      daftarItemAksesoris.value.forEach(it => {
        const label = (it.nama || '(tanpa nama)') + (it.warna ? ` ${it.warna}` : '') + (it.id_tampil ? ` (${it.id_tampil})` : '');
        map.set(label, it);
      });
      return map;
    });
    const opsiItemNama = computed(() => Array.from(opsiItemMap.value.keys()));

    async function bukaPopupBuat() {
      resetFormBuat();
      popupTerbuka.value = true;
      if (daftarItemAksesoris.value.length) return; // sudah pernah dimuat, cache ringan
      memuatItem.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'master_bahan_aksesoris'), where('kategori_utama', '==', 'Aksesoris')));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        daftarItemAksesoris.value = list;
      } catch (e) {
        console.error('Gagal muat daftar item Aksesoris (Repack):', e);
        alert('Gagal memuat daftar item Aksesoris. Coba lagi.');
      }
      memuatItem.value = false;
    }
    function resetFormBuat() {
      itemEntry.value = ''; itemTerpilih.value = null; isiPerPakBaru.value = ''; jumlahPakBaru.value = 1;
    }
    function tutupPopupBuat() { popupTerbuka.value = false; resetFormBuat(); }
    // watch (pola sama seperti vue-kartu-stok.js) — v-model DropdownCari
    // dicampur listener manual bisa saling timpa 2 arah bindingnya, jadi
    // pilih item lewat watch terpisah, bukan @update:modelValue di template.
    watch(itemEntry, () => {
      const it = opsiItemMap.value.get(itemEntry.value);
      itemTerpilih.value = it || null;
    });

    async function simpanPakBaru() {
      if (!itemTerpilih.value) return alert('Pilih item Aksesoris dulu.');
      const isi = parseFloat(isiPerPakBaru.value);
      if (!(isi > 0)) return alert('Isi per pak wajib angka lebih dari 0.');
      const jumlah = parseInt(jumlahPakBaru.value, 10);
      if (!(jumlah > 0)) return alert('Jumlah pak wajib angka lebih dari 0.');
      if (jumlah > MAKS_PAK_SEKALI_BUAT) return alert(`Maksimal ${MAKS_PAK_SEKALI_BUAT} pak sekali buat — bagi jadi beberapa kali kalau lebih.`);

      menyimpan.value = true;
      try {
        const it = itemTerpilih.value;
        const oleh = window.currentUser?.email || '';
        const data = {
          bahan_aksesoris_id: it.id, nama_aksesoris: it.nama || '', warna: it.warna || '',
          satuan: it.satuan_pemakaian || '', isi_per_pak: isi,
          status: 'tersedia', dibuat_oleh: oleh, dibuat_pada: serverTimestamp()
        };
        await Promise.all(Array.from({ length: jumlah }, () => addDoc(collection(db, 'repack_komponen_acc'), data)));
        tutupPopupBuat();
        await muat();
      } catch (e) {
        console.error('Gagal membuat pak baru:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, errorMuat, cari, muat,
      kelompokTampil, kelompokTerfilter, adaLebihBanyak, muatLebihBanyak, ringkasan,
      bolehProses, sedangProses, ambilSatuPak,
      popupTerbuka, bukaPopupBuat, tutupPopupBuat, memuatItem,
      itemEntry, opsiItemNama, itemTerpilih,
      isiPerPakBaru, jumlahPakBaru, menyimpan, simpanPakBaru,
      formatQty, formatWaktu
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:14px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <h3 style="font-weight:700; font-size:13.5px; margin:0;"><i class="fas fa-box-archive" style="color:var(--burgundy); margin-right:8px;"></i>Repack</h3>
        <button v-if="bolehProses" @click="bukaPopupBuat" class="btn-primary" style="margin-left:auto; padding:8px 16px; font-size:12px;"><i class="fas fa-plus" style="margin-right:6px;"></i>Buat Pak Baru</button>
      </div>
      <p style="font-size:11px; color:var(--text-faint); margin:8px 0 0;">Kemasan komponen Acc yang sudah dikemas jadi jumlah tetap per pak (mis. 25pcs) — supaya tidak perlu hitung ulang dari lepasan tiap butuh. Murni catatan jumlah pak; tidak mengubah stok item.</p>
      <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-top:12px;">
        <i class="fas fa-magnifying-glass" style="font-size:14px; color:var(--text-faint);"></i>
        <input v-model="cari" type="text" placeholder="Cari nama item / warna..." style="flex:1; border:none; outline:none; background:none; font-size:12px;">
      </div>
    </div>

    <!-- state: loading -->
    <div v-if="memuat" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat data Repack...</div>

    <!-- state: error -->
    <div v-else-if="errorMuat" class="gc-card" style="padding:20px;">
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <i class="fas fa-triangle-exclamation" style="color:var(--danger); font-size:16px; margin-top:2px;"></i>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:12.5px; color:var(--danger); margin-bottom:4px;">Gagal memuat data</div>
          <div style="font-size:11.5px; color:var(--text-muted);">{{ errorMuat }}</div>
          <button @click="muat" class="btn-outline" style="margin-top:10px; padding:7px 14px; font-size:11.5px;"><i class="fas fa-rotate-right" style="margin-right:6px;"></i>Coba Lagi</button>
        </div>
      </div>
    </div>

    <!-- state: kosong -->
    <div v-else-if="kelompokTerfilter.length === 0" class="gc-kosong">
      <div class="lingkaran"><i class="fas fa-box-archive"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada pak Repack tersedia</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin:0;">Klik "Buat Pak Baru" untuk mulai mengemas stok lepasan jadi pak berjumlah tetap.</p>
    </div>

    <!-- state: ideal/ekstrem -->
    <template v-else>
      <div class="gc-card" style="padding:0; overflow:hidden;">
        <div class="gc-table-scroll">
          <table class="gc-table">
            <thead>
              <tr>
                <th>Nama Item</th>
                <th style="text-align:right;">Isi/Pak</th>
                <th style="text-align:right;">Jumlah Pak</th>
                <th style="text-align:right;">Total Pcs</th>
                <th style="text-align:right;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in kelompokTampil" :key="g.key">
                <td>
                  <div style="font-weight:700; font-size:12px;">{{ g.nama }}<span v-if="g.warna"> &middot; {{ g.warna }}</span></div>
                </td>
                <td style="text-align:right; font-size:12px;">{{ formatQty(g.isiPerPak) }} {{ g.satuan }}</td>
                <td style="text-align:right;"><span class="tag ok" style="font-weight:700;">{{ g.jumlahPak }} pak</span></td>
                <td style="text-align:right; font-size:11.5px; color:var(--text-faint);">{{ formatQty(g.totalPcs) }} {{ g.satuan }}</td>
                <td style="text-align:right;">
                  <button v-if="bolehProses" @click="ambilSatuPak(g)" :disabled="sedangProses[g.key]" class="btn-outline" style="padding:6px 12px; font-size:11px;"><i class="fas fa-box-open" style="margin-right:5px;"></i>Ambil 1 Pak</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:10px;">
        <span style="font-size:10.5px; color:var(--text-faint);">{{ ringkasan.jumlahBaris }} baris item &middot; {{ ringkasan.totalPak }} pak tersedia</span>
        <button v-if="adaLebihBanyak" @click="muatLebihBanyak" class="btn-outline" style="margin-left:auto; padding:6px 14px; font-size:11px; border-radius:999px;">Muat 20 lagi</button>
      </div>
    </template>

    <!-- Popup Buat Pak Baru -->
    <div v-if="popupTerbuka" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupPopupBuat">
      <div class="gc-card" style="max-width:420px; width:100%; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
          <h3 style="font-weight:700; font-size:15px; margin:0;">Buat Pak Baru</h3>
          <span @click="tutupPopupBuat" style="margin-left:auto; font-size:11px; color:var(--burgundy); cursor:pointer;">tutup &times;</span>
        </div>

        <div class="gc-field" style="margin-bottom:10px;">
          <label>Item Aksesoris</label>
          <dropdown-cari v-model="itemEntry" :opsi="opsiItemNama" placeholder="Cari & pilih item Aksesoris..." :disabled="memuatItem" />
          <p v-if="memuatItem" style="font-size:10.5px; color:var(--text-faint); margin-top:4px;"><i class="fas fa-spinner fa-spin" style="margin-right:4px;"></i>Memuat daftar item...</p>
        </div>

        <div v-if="itemTerpilih" style="background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:14px; font-size:11px; color:var(--text-muted);">
          Stok lepasan saat ini: <b>{{ formatQty(itemTerpilih.stok_akhir || 0) }} {{ itemTerpilih.satuan_pemakaian || '' }}</b>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:6px;">
          <div class="gc-field" style="margin-bottom:0;"><label>Isi per Pak</label><input v-model.number="isiPerPakBaru" type="number" min="0" placeholder="Mis. 25"></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Jumlah Pak Dibuat</label><input v-model.number="jumlahPakBaru" type="number" min="1" placeholder="1"></div>
        </div>
        <p style="font-size:10px; color:var(--text-faint); margin:0 0 16px;">Total pcs yang akan dikemas: <b>{{ formatQty((parseFloat(isiPerPakBaru)||0) * (parseInt(jumlahPakBaru)||0)) }}</b> {{ itemTerpilih ? itemTerpilih.satuan_pemakaian : '' }} — stok lepasan TIDAK berkurang otomatis, cuma dicatat sudah dikemas.</p>

        <div style="display:flex; gap:8px;">
          <button @click="tutupPopupBuat" class="btn-outline" style="flex:1; padding:11px;">Batal</button>
          <button @click="simpanPakBaru" :disabled="menyimpan" class="btn-primary" style="flex:1.4; padding:11px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>
    </div>
  `
};

const AppRepackKomponenAcc = { components: { RepackKomponenAccManager }, template: `<repack-komponen-acc-manager />` };
let vmRepackKomponenAcc = null;
window.pastikanMountRepackKomponenAcc = function() {
  if (vmRepackKomponenAcc) return;
  const mountPoint = document.getElementById('vue-repack-komponen-acc');
  if (mountPoint) vmRepackKomponenAcc = createApp(AppRepackKomponenAcc).mount('#vue-repack-komponen-acc');
};
