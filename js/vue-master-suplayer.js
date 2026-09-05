// js/vue-master-suplayer.js
// ============================================================================
// Zevanic House > Master Suplayer — menu BARU (5 Sep 2026, wireframe handoff
// "Zevanic House.dc.html" grup 5 + rekonstruksi Persiapan Produksi). Guru:
// alur Persiapan Produksi (Bahan/Acc Sewing/Webbing/Finishing) tertahan
// karena data dasar Suplayer belum lengkap — MOQ, Alias, dan "Petakan Order"
// (suplayer default per item) belum ada tempatnya. Modul ini pusatnya.
//
// GANTI TOTAL dari 2 tempat lama yang tercerai-berai:
//   - Config > Data Suplayer (js/vue-config.js, generik MasterDataTabelManager
//     — cuma nama/kontak/keterangan) — TAB ITU DIHAPUS dari Config, CRUD
//     Suplayer sekarang SATU-SATUNYA di sini (5.1).
//   - Stock & Pembelian > Alias Pembelian (js/vue-stock-pembelian.js,
//     AliasPembelianManager) — TAB ITU DIHAPUS dari Stock & Pembelian, PINDAH
//     ke sini (5.2) + field BARU moq/moq_satuan/lead_time_hari. Fungsi yang
//     BACA alias_pembelian di Nota/Kasir (vue-stock-pembelian.js) TIDAK
//     disentuh — struktur dokumen `alias_pembelian` TIDAK BERUBAH, cuma
//     lokasi UI-nya + field tambahan (dokumen lama tanpa field baru ini
//     null-safe, tampil "-"/kosong).
//
// 3 sub-tab (field `deprecated: true` menu lama, id BARU didaftarkan di
// vue-config-akses.js — lihat komentar di sana):
//   5.1 Entry + List Suplayer (SuplayerEntryList) — CRUD penuh, field BARU
//       bank/nama_rek/no_rek/no_wa (SPESIFIKASI-KOLEKSI-BARU.md, dipakai
//       format order WA driver di Persiapan Belanja nanti).
//   5.2 Alias & MOQ (AliasMoqManager) — eks Alias Pembelian + moq/
//       moq_satuan/lead_time_hari (dipakai hitung "qty beli" di Persiapan
//       Masalah & Persiapan Belanja nanti).
//   5.3 Petakan Order (PetakanOrderManager) — per item, tandai SATU alias
//       sebagai `is_default_order:true` (suplayer favorit/langganan item
//       itu) — dipakai auto-assign suplayer default nanti.
//
// TIDAK termasuk sesi ini (di luar scope "MOQ/kelipatan/prefix/TLC" yang
// diminta Guru): field `master_produk.moq_serie`/`kelipatan_isi_pola` (itu
// milik modul Serie, Proses Produksi — beda konteks MOQ, jangan dicampur).
// Kalau ternyata Guru maksudnya TERMASUK itu, tinggal tambah kolom di Entry
// Produk (js/vue-master-produk.js), bukan di sini.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=5';

// --- Helper kecil, DISALIN dari vue-stock-pembelian.js (konvensi "salin
// logic kecil per-file" proyek ini — supaya modul ini tidak butuh export
// baru dari file yang sudah stabil). --------------------------------------
async function ambilDaftarBahanAksesorisLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Bahan & Aksesoris:', e);
    return [];
  }
}
function formatNamaBahan(b) {
  if (!b) return '-';
  return b.warna ? `${b.nama} ${b.warna}` : (b.nama || '-');
}
async function ambilDaftarSuplayerLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_suplayer'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Suplayer:', e);
    return [];
  }
}
function formatQty(n) {
  if (n === null || n === undefined || n === '') return '-';
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// ============================================================================
// 5.1 — Entry + List Suplayer
// ============================================================================
const SuplayerEntryList = {
  setup() {
    const menuId = 'suplayer_entry';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehEdit = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const memuat = ref(true);
    const daftar = ref([]);
    const cari = ref('');
    const menyimpan = ref(false);

    const kosongForm = () => ({ nama: '', kontak: '', bank: '', namaRek: '', noRek: '', noWa: '' });
    const form = reactive(kosongForm());
    const popupEdit = ref(null); // { id, ...kosongForm() }

    async function muat() {
      memuat.value = true;
      daftar.value = await ambilDaftarSuplayerLengkap();
      memuat.value = false;
    }

    const daftarTampil = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      if (!kata) return daftar.value;
      return daftar.value.filter(s => (s.nama || '').toLowerCase().includes(kata) || (s.kontak || '').toLowerCase().includes(kata));
    });

    function sudahAda(nama, kecualiId) {
      return daftar.value.some(s => s.id !== kecualiId && (s.nama || '').trim().toLowerCase() === nama.trim().toLowerCase());
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const nama = form.nama.trim();
      if (!nama) return alert('Nama Suplayer wajib diisi.');
      if (sudahAda(nama)) return alert('Nama Suplayer ini sudah ada.');
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'master_suplayer'), {
          nama, kontak: form.kontak.trim(),
          bank: form.bank.trim(), nama_rek: form.namaRek.trim(), no_rek: form.noRek.trim(), no_wa: form.noWa.trim(),
          keterangan: '', dibuat_pada: serverTimestamp()
        });
        Object.assign(form, kosongForm());
        await muat();
      } catch (e) { console.error('Gagal tambah Suplayer:', e); alert('Gagal menyimpan.'); }
      menyimpan.value = false;
    }

    function bukaEdit(s) {
      if (!bolehEdit.value) return;
      popupEdit.value = { id: s.id, nama: s.nama || '', kontak: s.kontak || '', bank: s.bank || '', namaRek: s.nama_rek || '', noRek: s.no_rek || '', noWa: s.no_wa || '' };
    }
    async function simpanEdit() {
      const p = popupEdit.value;
      if (!p) return;
      const nama = p.nama.trim();
      if (!nama) return alert('Nama Suplayer wajib diisi.');
      if (sudahAda(nama, p.id)) return alert('Nama Suplayer ini sudah dipakai Suplayer lain.');
      menyimpan.value = true;
      try {
        await updateDoc(doc(db, 'master_suplayer', p.id), {
          nama, kontak: p.kontak.trim(), bank: p.bank.trim(), nama_rek: p.namaRek.trim(), no_rek: p.noRek.trim(), no_wa: p.noWa.trim()
        });
        popupEdit.value = null;
        await muat();
      } catch (e) { console.error('Gagal ubah Suplayer:', e); alert('Gagal menyimpan.'); }
      menyimpan.value = false;
    }

    async function hapus(s) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus Suplayer "${s.nama}"? Alias & Petakan Order yang menunjuk ke Suplayer ini TIDAK ikut terhapus otomatis.`)) return;
      try { await deleteDoc(doc(db, 'master_suplayer', s.id)); await muat(); }
      catch (e) { console.error('Gagal hapus Suplayer:', e); alert('Gagal menghapus.'); }
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, daftarTampil, cari, form, menyimpan, bolehTambah, bolehEdit, bolehHapus, tambah, bukaEdit, simpanEdit, popupEdit, hapus };
  },
  template: `
    <div class="gc-card gc-card-menonjol" style="padding:16px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-truck-fast" style="color:var(--burgundy); margin-right:8px;"></i>Master Suplayer</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Data suplayer lengkap — dipakai Alias &amp; MOQ, Petakan Order, dan format order WA ke driver (Persiapan Belanja).</p>

      <div v-if="bolehTambah" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:8px; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Suplayer *</label><input v-model="form.nama" type="text" placeholder="Nama Suplayer"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Kontak/Alamat</label><input v-model="form.kontak" type="text" placeholder="Kontak/Alamat"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Bank</label><input v-model="form.bank" type="text" placeholder="Mis. BCA"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Rekening</label><input v-model="form.namaRek" type="text" placeholder="Atas nama"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>No. Rekening</label><input v-model="form.noRek" type="text" placeholder="No. rekening"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>No. WhatsApp</label><input v-model="form.noWa" type="text" placeholder="08..."></div>
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="align-self:end; padding:9px 18px;"><i class="fas fa-plus" style="margin-right:6px;"></i>Tambah</button>
      </div>

      <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-bottom:12px;">
        <i class="fas fa-magnifying-glass" style="font-size:14px; color:var(--text-faint);"></i>
        <input v-model="cari" type="text" placeholder="Cari nama/kontak..." style="flex:1; border:none; outline:none; background:none; font-size:12px;">
      </div>

      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarTampil.length === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-truck-fast"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada Suplayer</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="s in daftarTampil" :key="s.id" class="gc-card" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
            <div>
              <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ s.nama }}</div>
              <div style="font-size:11px; color:var(--text-faint);">{{ s.kontak || '-' }}</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px; font-size:12px;">
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint);">Bank</span><span style="font-weight:600;">{{ s.bank || '-' }}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint);">Rekening</span><span style="font-weight:600;">{{ s.nama_rek || '-' }} &middot; {{ s.no_rek || '-' }}</span></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint);">No. WA</span><span class="gc-num" style="font-weight:600;">{{ s.no_wa || '-' }}</span></div>
          </div>
          <div style="display:flex; gap:8px;">
            <button v-if="bolehEdit" @click="bukaEdit(s)" class="btn-outline" style="flex:1; padding:7px; font-size:11.5px;"><i class="fas fa-pen" style="margin-right:6px;"></i>Edit</button>
            <button v-if="bolehHapus" @click="hapus(s)" class="btn-outline" style="flex:1; padding:7px; font-size:11.5px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="popupEdit" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="popupEdit = null">
      <div class="gc-card" style="max-width:400px; width:100%; padding:18px;">
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; margin-bottom:12px;">Edit Suplayer</h3>
        <div class="gc-field"><label>Nama Suplayer *</label><input v-model="popupEdit.nama" type="text"></div>
        <div class="gc-field"><label>Kontak/Alamat</label><input v-model="popupEdit.kontak" type="text"></div>
        <div class="gc-field"><label>Bank</label><input v-model="popupEdit.bank" type="text"></div>
        <div class="gc-field"><label>Nama Rekening</label><input v-model="popupEdit.namaRek" type="text"></div>
        <div class="gc-field"><label>No. Rekening</label><input v-model="popupEdit.noRek" type="text"></div>
        <div class="gc-field"><label>No. WhatsApp</label><input v-model="popupEdit.noWa" type="text"></div>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <button @click="simpanEdit" :disabled="menyimpan" class="btn-primary" style="flex:1;">Simpan</button>
          <button @click="popupEdit = null" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// 5.2 — Alias & MOQ (eks "Alias Pembelian" di Stock & Pembelian, DITAMBAH
// moq/moq_satuan/lead_time_hari — SPESIFIKASI-KOLEKSI-BARU.md "alias_pembelian
// — tambah"). Struktur dokumen TIDAK BERUBAH, cuma field bertambah dan lokasi
// UI pindah — Nota/Kasir yang baca alias_pembelian TIDAK perlu diubah.
// ============================================================================
const AliasMoqManager = {
  components: { DropdownCari },
  setup() {
    const menuId = 'suplayer_alias_moq';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const memuat = ref(true);
    const daftarAlias = ref([]);
    const daftarBahan = ref([]);
    const daftarSuplayer = ref([]);
    const menyimpan = ref(false);
    const tampilTambahSuplayer = ref(false);

    const kosongForm = () => ({ suplayerNama: '', namaInternal: '', namaDiNota: '', moq: '', moqSatuan: '', leadTimeHari: '' });
    const form = reactive(kosongForm());

    const opsiNamaInternal = computed(() => daftarBahan.value.map(formatNamaBahan));
    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));

    async function muatSemua() {
      memuat.value = true;
      const [bahan, suplayer, snapAlias] = await Promise.all([
        ambilDaftarBahanAksesorisLengkap(),
        ambilDaftarSuplayerLengkap(),
        getDocs(collection(db, 'alias_pembelian'))
      ]);
      daftarBahan.value = bahan;
      daftarSuplayer.value = suplayer;
      const list = []; snapAlias.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.suplayer_nama || '').localeCompare(b.suplayer_nama || ''));
      daftarAlias.value = list;
      memuat.value = false;
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const suplayer = daftarSuplayer.value.find(s => s.nama === form.suplayerNama);
      const bahan = daftarBahan.value.find(b => formatNamaBahan(b) === form.namaInternal);
      if (!suplayer) return alert('Pilih Suplayer dulu. Kalau belum ada, tambahkan lewat tab Entry Suplayer atau tombol Pengaturan.');
      if (!bahan) return alert('Pilih Nama Bahan/Aksesoris (internal) dulu.');
      const namaDiNota = form.namaDiNota.trim();
      if (!namaDiNota) return alert('Isi nama barang persis seperti di nota Suplayer.');
      if (daftarAlias.value.some(a => a.suplayer_id === suplayer.id && (a.nama_di_nota || '').toLowerCase() === namaDiNota.toLowerCase())) {
        return alert('Alias ini sudah ada untuk Suplayer tersebut.');
      }
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'alias_pembelian'), {
          suplayer_id: suplayer.id, suplayer_nama: suplayer.nama,
          bahan_aksesoris_id: bahan.id, bahan_aksesoris_nama: formatNamaBahan(bahan),
          nama_di_nota: namaDiNota,
          moq: form.moq === '' ? null : (parseFloat(form.moq) || 0),
          moq_satuan: form.moqSatuan.trim(),
          lead_time_hari: form.leadTimeHari === '' ? null : (parseInt(form.leadTimeHari) || 0),
          is_default_order: false,
          dibuat_pada: serverTimestamp()
        });
        Object.assign(form, kosongForm());
        await muatSemua();
      } catch (e) { console.error('Gagal simpan Alias Pembelian:', e); alert('Gagal menyimpan.'); }
      menyimpan.value = false;
    }

    function namaInternalTampil(a) {
      const b = daftarBahan.value.find(x => x.id === a.bahan_aksesoris_id);
      return b ? formatNamaBahan(b) : (a.bahan_aksesoris_nama || '-');
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus alias "${item.nama_di_nota}" -> "${item.bahan_aksesoris_nama}"?`)) return;
      try { await deleteDoc(doc(db, 'alias_pembelian', item.id)); await muatSemua(); }
      catch (e) { console.error('Gagal hapus Alias Pembelian:', e); alert('Gagal menghapus.'); }
    }

    async function onSuplayerBaruTersimpan(namaBaru) {
      tampilTambahSuplayer.value = false;
      daftarSuplayer.value = await ambilDaftarSuplayerLengkap();
      form.suplayerNama = namaBaru;
    }

    onMounted(async () => { await window.authReady; await muatSemua(); });
    return {
      memuat, daftarAlias, form, opsiNamaInternal, opsiSuplayer, bolehTambah, bolehHapus,
      menyimpan, tambah, hapus, namaInternalTampil, formatQty,
      tampilTambahSuplayer, onSuplayerBaruTersimpan
    };
  },
  template: `
    <div class="gc-card gc-card-menonjol" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
        <h3 class="gc-heading" style="font-weight:700; font-size:15px;"><i class="fas fa-tags" style="color:var(--burgundy); margin-right:8px;"></i>Alias &amp; MOQ</h3>
      </div>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Petakan nama barang di nota Suplayer ke item internal, lengkap MOQ &amp; lead time — dipakai hitung qty beli di Persiapan Masalah/Belanja.</p>

      <div v-if="bolehTambah" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:8px; align-items:end; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;">
          <label>Suplayer</label>
          <div style="display:flex; gap:6px;">
            <dropdown-cari v-model="form.suplayerNama" :opsi="opsiSuplayer" placeholder="Pilih Suplayer..." />
            <button @click="tampilTambahSuplayer = true" type="button" class="icon-btn" style="flex-shrink:0;" title="Tambah Suplayer cepat"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama di Nota Suplayer</label><input v-model="form.namaDiNota" type="text" placeholder="Persis seperti di nota"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Internal</label><dropdown-cari v-model="form.namaInternal" :opsi="opsiNamaInternal" placeholder="Pilih item internal..." /></div>
        <div class="gc-field" style="margin-bottom:0;"><label>MOQ</label><input v-model="form.moq" type="number" min="0" placeholder="Mis. 500"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Satuan MOQ</label><input v-model="form.moqSatuan" type="text" placeholder="Mis. pak"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Lead Time (hari)</label><input v-model="form.leadTimeHari" type="number" min="0" placeholder="Mis. 3"></div>
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:0 18px; height:38px;"><i class="fas fa-plus"></i></button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarAlias.length === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-tags"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada alias</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="a in daftarAlias" :key="a.id" class="gc-card" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px;">
            <div>
              <div style="font-weight:700; font-size:13.5px;">{{ namaInternalTampil(a) }}</div>
              <div style="font-size:11.5px; color:var(--text-muted);">{{ a.suplayer_nama }}</div>
            </div>
            <span v-if="a.is_default_order" class="tag ok"><i class="fas fa-star" style="margin-right:4px;"></i>default</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px;" :style="{marginBottom: bolehHapus ? '10px' : '0'}">
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Nama di Nota</span><span style="font-weight:700;">{{ a.nama_di_nota }}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">MOQ</span><span class="gc-num" style="font-weight:700;">{{ formatQty(a.moq) }} {{ a.moq_satuan || '' }}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Lead Time</span><span class="gc-num" style="font-weight:700;">{{ a.lead_time_hari === null || a.lead_time_hari === undefined ? '-' : a.lead_time_hari + ' hari' }}</span></div>
          </div>
          <div v-if="bolehHapus" style="display:flex; gap:8px;">
            <button @click="hapus(a)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
          </div>
        </div>
      </div>

      <div v-if="tampilTambahSuplayer" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tampilTambahSuplayer=false">
        <div class="gc-card" style="max-width:340px; width:100%;">
          <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:10px;">Suplayer cepat — lengkapi Bank/Rek/WA-nya nanti lewat tab Entry Suplayer.</p>
          <div class="gc-field"><label>Nama Suplayer *</label><input id="__inputSuplayerCepatNama" type="text"></div>
          <div style="display:flex; gap:8px;">
            <button @click="(async()=>{const el=document.getElementById('__inputSuplayerCepatNama'); const nm=(el?.value||'').trim(); if(!nm){alert('Isi nama dulu.');return;} const {addDoc,collection,serverTimestamp}=await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'); const {db}=await import('./firebase-config.js'); await addDoc(collection(db,'master_suplayer'),{nama:nm,kontak:'',keterangan:'',dibuat_pada:serverTimestamp()}); onSuplayerBaruTersimpan(nm);})()" class="btn-primary" style="flex:1;">Simpan</button>
            <button @click="tampilTambahSuplayer=false" class="btn-outline" style="flex:1;">Batal</button>
          </div>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// 5.3 — Petakan Order: per item (yang punya >=1 alias), tandai SATU suplayer
// sebagai default (`is_default_order`). Klik "Jadikan Default" pada 1 baris
// -> baris itu true, baris LAIN di item yang sama otomatis false (writeBatch,
// atomik, supaya tidak pernah ada 2 default sekaligus per item).
// ============================================================================
const PetakanOrderManager = {
  setup() {
    const menuId = 'suplayer_petakan_order';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    const memuat = ref(true);
    const daftarAlias = ref([]);
    const daftarBahan = ref([]);
    const sedangProses = reactive({});

    async function muat() {
      memuat.value = true;
      const [bahan, snapAlias] = await Promise.all([
        ambilDaftarBahanAksesorisLengkap(),
        getDocs(collection(db, 'alias_pembelian'))
      ]);
      daftarBahan.value = bahan;
      const list = []; snapAlias.forEach(d => list.push({ id: d.id, ...d.data() }));
      daftarAlias.value = list;
      memuat.value = false;
    }

    const kelompokItem = computed(() => {
      const peta = {};
      daftarAlias.value.forEach(a => {
        const key = a.bahan_aksesoris_id;
        if (!key) return;
        if (!peta[key]) {
          const b = daftarBahan.value.find(x => x.id === key);
          peta[key] = { bahanAksesorisId: key, nama: b ? formatNamaBahan(b) : (a.bahan_aksesoris_nama || '-'), alias: [] };
        }
        peta[key].alias.push(a);
      });
      return Object.values(peta).sort((a, b) => a.nama.localeCompare(b.nama));
    });

    async function jadikanDefault(item, aliasTerpilih) {
      if (!bolehProses.value) return alert('Anda tidak punya izin di sini. Hubungi Owner/PIC.');
      sedangProses[aliasTerpilih.id] = true;
      try {
        const batch = writeBatch(db);
        item.alias.forEach(a => {
          batch.update(doc(db, 'alias_pembelian', a.id), { is_default_order: a.id === aliasTerpilih.id });
        });
        await batch.commit();
        item.alias.forEach(a => { a.is_default_order = (a.id === aliasTerpilih.id); });
      } catch (e) { console.error('Gagal set Petakan Order:', e); alert('Gagal menyimpan.'); }
      sedangProses[aliasTerpilih.id] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, kelompokItem, bolehProses, sedangProses, jadikanDefault, formatQty };
  },
  template: `
    <div class="gc-card gc-card-menonjol" style="padding:16px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-map-location-dot" style="color:var(--burgundy); margin-right:8px;"></i>Petakan Order</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Item ini biasanya dipesan dari Suplayer mana — tandai satu sebagai default. Item tanpa alias belum tampil di sini (tambahkan dulu lewat tab Alias &amp; MOQ).</p>

      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="kelompokItem.length === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-map-location-dot"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada item dengan alias suplayer</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="item in kelompokItem" :key="item.bahanAksesorisId" class="gc-card" style="padding:14px;">
          <div style="font-weight:700; font-size:13.5px; margin-bottom:8px;">{{ item.nama }}</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div v-for="a in item.alias" :key="a.id" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:10px;" :style="{ background: a.is_default_order ? 'var(--ok-light)' : 'var(--ivory-dim)' }">
              <div style="flex:1; min-width:0;">
                <div style="font-size:12px; font-weight:600;">{{ a.suplayer_nama }}</div>
                <div style="font-size:10.5px; color:var(--text-faint);">MOQ {{ formatQty(a.moq) }} {{ a.moq_satuan || '' }} &middot; lead time {{ a.lead_time_hari ?? '-' }} hari</div>
              </div>
              <span v-if="a.is_default_order" class="tag ok"><i class="fas fa-star" style="margin-right:4px;"></i>default</span>
              <button v-else-if="bolehProses" @click="jadikanDefault(item, a)" :disabled="sedangProses[a.id]" class="btn-outline" style="padding:6px 10px; font-size:11px; flex-shrink:0;">Jadikan Default</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// Mount — lazy, dipanggil dashboard.js pindahSubTab() (pola sama semua
// child-tab lain di app ini).
// ============================================================================
let vmSuplayerEntry = null, vmSuplayerAlias = null, vmSuplayerPetakan = null;
window.pastikanMountSuplayerEntry = function () {
  if (vmSuplayerEntry) return;
  if (document.getElementById('vue-suplayer-entry')) vmSuplayerEntry = createApp(SuplayerEntryList).mount('#vue-suplayer-entry');
};
window.pastikanMountSuplayerAliasMoq = function () {
  if (vmSuplayerAlias) return;
  if (document.getElementById('vue-suplayer-alias-moq')) vmSuplayerAlias = createApp(AliasMoqManager).mount('#vue-suplayer-alias-moq');
};
window.pastikanMountSuplayerPetakan = function () {
  if (vmSuplayerPetakan) return;
  if (document.getElementById('vue-suplayer-petakan')) vmSuplayerPetakan = createApp(PetakanOrderManager).mount('#vue-suplayer-petakan');
};
