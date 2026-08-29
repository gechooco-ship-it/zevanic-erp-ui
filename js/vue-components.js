// js/vue-components.js
// ============================================================================
// Komponen Vue yang dipakai BARENG di berbagai layar. Ini fondasi migrasi
// bertahap dari vanilla JS ke Vue — tujuannya supaya pola yang sama (misal
// "1 kategori master data: tambah/lihat/hapus") tidak ditulis ulang beda-beda
// di tiap layar seperti pola lama, tapi cukup 1 komponen dipakai berkali-kali.
//
// Dipakai via CDN (tanpa build step) — import langsung dari unpkg, sama
// seperti pola import Firebase yang sudah ada di app ini.
// ============================================================================
import { ref, computed, onMounted, onUnmounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, setDoc, getDoc, addDoc, deleteDoc, collection, getDocs, query, orderBy, limit, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// BARU (27 Agt 2026, §27) — daftarMenuGroups() di bawah sekarang MEMBACA
// DAFTAR_MENU langsung dari vue-config-akses.js (satu-satunya tempat menu
// didaftarkan) — bukan disalin tangan lagi. Lihat catatan lengkap di
// definisi daftarMenuGroups().
import { DAFTAR_MENU, KATEGORI_URUTAN } from './vue-config-akses.js';

// ---------------------------------------------------------------------------
// MasterDataCategory — kartu 1 kategori Master Data (tambah/lihat/hapus item).
// Baca data (termasuk seeding default kalau belum ada) tetap lewat
// window.ambilMasterList supaya SATU sumber logic dipakai bareng dengan
// bagian aplikasi yang belum dimigrasi (Antrean Dakar, Edit Karyawan, dll).
// ---------------------------------------------------------------------------
export const MasterDataCategory = {
  props: {
    kategori: { type: String, required: true },
    label: { type: String, required: true },
    // BARU — supaya komponen ini bisa dipakai ulang di menu LAIN (misal
    // Config Absensi > Jenis Pekerjaan) dengan izin Config Akses yang
    // benar, bukan selalu dicek ke 'config_karyawan'. Default tetap
    // 'config_karyawan' — 9 pemakaian lama di vue-config-karyawan.js
    // TIDAK perlu diubah sama sekali, otomatis tetap jalan sama seperti
    // sebelumnya.
    menuId: { type: String, default: 'config_karyawan' },
    // BARU (27 Agt 2026) — dipakai pertama kali buat menu "Config" (Zevanic
    // House). Guru minta format tampilan "entry+searchbox+table" di sana,
    // BEDA dari tampilan lama (kumpulan tag/chip) yang tetap dipertahankan
    // di semua pemakaian lama (Config Karyawan dst, default false = TIDAK
    // berubah). Logic tambah/hapus/cari di bawah TETAP 1 sumber yang sama,
    // cuma template yang beda per mode.
    tampilTabel: { type: Boolean, default: false }
  },
  setup(props) {
    const items = ref([]);
    const inputBaru = ref('');
    const memuat = ref(true);
    const menyimpan = ref(false);

    // PENERAPAN NYATA Config Akses — komponen ini dipakai buat beberapa
    // kategori Master Data sekaligus, izinnya dicek ke props.menuId
    // (menu tempat komponen ini dipasang), BUKAN hardcode lagi. Fallback
    // aman: kalau belum diatur (null), dianggap boleh.
    const bolehTambah = computed(() => window.cekIzinMenu(props.menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(props.menuId, 'delete') !== false);

    async function muat() {
      memuat.value = true;
      try {
        items.value = await window.ambilMasterList(props.kategori);
      } catch (e) {
        console.error('Gagal muat master data:', props.kategori, e);
      }
      memuat.value = false;
    }

    async function simpanKeFirestore() {
      menyimpan.value = true;
      try {
        await setDoc(doc(db, 'master_data', props.kategori), { items: items.value });
      } catch (e) {
        console.error('Gagal simpan master data:', props.kategori, e);
        alert('Gagal menyimpan perubahan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah item di sini. Hubungi Owner/PIC.');
      const nilai = inputBaru.value.trim();
      if (!nilai) return;
      if (items.value.includes(nilai)) { alert('Item ini sudah ada di daftar.'); return; }
      items.value.push(nilai);
      inputBaru.value = '';
      await simpanKeFirestore();
    }

    async function hapus(nilai) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus item di sini. Hubungi Owner/PIC.');
      items.value = items.value.filter(i => i !== nilai);
      await simpanKeFirestore();
    }

    onMounted(async () => { await window.authReady; muat(); });

    const cariItem = ref('');
    const itemsTersaring = computed(() => {
      const kata = cariItem.value.trim().toLowerCase();
      if (!kata) return items.value;
      return items.value.filter(i => i.toLowerCase().includes(kata));
    });

    return { items, itemsTersaring, cariItem, inputBaru, memuat, menyimpan, tambah, hapus, bolehTambah, bolehHapus };
  },
  template: `
    <!-- Mode BARU (27 Agt 2026) — entry+searchbox+table, dipakai menu Config. -->
    <div v-if="tampilTabel" class="gc-card" style="padding:16px;">
      <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:10px;">{{ label }}</h4>
      <div v-if="bolehTambah" style="display:flex; gap:8px; margin-bottom:10px;">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah item baru..." style="flex:1; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:8px 14px;">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div v-if="!memuat" style="position:relative; margin-bottom:10px;">
        <i class="fas fa-search" style="position:absolute; left:11px; top:9px; color:var(--text-faint); font-size:11px;"></i>
        <input v-model="cariItem" type="text" placeholder="Cari item..." style="width:100%; max-width:280px; padding:7px 10px 7px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:11.5px; outline:none;">
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead><tr><th style="width:48px;">No</th><th>{{ label }}</th><th style="width:70px;">Aksi</th></tr></thead>
          <tbody>
            <tr v-if="items.length === 0"><td colspan="3" style="color:var(--text-faint); font-size:11px;">Belum ada data.</td></tr>
            <tr v-else-if="itemsTersaring.length === 0"><td colspan="3" style="color:var(--text-faint); font-size:11px;">Tidak ada yang cocok dicari.</td></tr>
            <tr v-for="(item, i) in itemsTersaring" :key="item">
              <td>{{ i + 1 }}</td>
              <td>{{ item }}</td>
              <td><button v-if="bolehHapus" @click="hapus(item)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- Mode LAMA (tag/chip) — TIDAK berubah, dipakai semua menu lain. -->
    <div v-else class="gc-card" style="padding:16px;">
      <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:10px;">{{ label }}</h4>
      <div v-if="bolehTambah" style="display:flex; gap:8px; margin-bottom:10px;">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah item baru..." style="flex:1; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:8px 14px;">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div v-if="!memuat && items.length > 5" style="position:relative; margin-bottom:10px;">
        <i class="fas fa-search" style="position:absolute; left:11px; top:9px; color:var(--text-faint); font-size:11px;"></i>
        <input v-model="cariItem" type="text" placeholder="Cari item..." style="width:100%; max-width:220px; padding:7px 10px 7px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:11.5px; outline:none;">
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else style="display:flex; flex-wrap:wrap; gap:6px;">
        <span v-if="items.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada data.</span>
        <span v-else-if="itemsTersaring.length === 0" style="font-size:11px; color:var(--text-faint);">Tidak ada yang cocok dicari.</span>
        <span v-for="item in itemsTersaring" :key="item" class="tag neutral" style="gap:8px;">
          {{ item }}
          <button v-if="bolehHapus" @click="hapus(item)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:11px;"><i class="fas fa-times"></i></button>
        </span>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// DropdownCari — BARU (23 Agt 2026, awalnya buat Master Bahan & Aksesoris,
// ditaruh di sini karena bentuknya generik & bisa dipakai ulang di menu
// lain). Pengganti <select> polos: kotak ketik yang MEMFILTER daftar opsi
// sambil diketik (mirip combobox), bukan scroll-cari-manual di dropdown
// panjang. STRICT-SELECT — cuma bisa pilih dari `opsi` yang dikasih lewat
// props, TIDAK bisa isi teks bebas (kalau item belum ada di daftar, harus
// ditambah dulu lewat menu Master Data terkait, konsisten dengan pola
// MasterDataCategory di atas).
//
// KOMPONEN INI 100% BUATAN SENDIRI (bukan dari library/SDK/template Vue
// manapun) — jadi kalau ada perilaku standar combobox yang belum ada,
// memang harus ditambah manual di sini, bukan setting yang "kelupaan
// dinyalakan" dari library luar.
//
// FIX (27 Agt 2026, laporan Guru): SEBELUM INI navigasi keyboard (panah
// atas/bawah pas ngetik cari, lalu Enter buat pilih) BELUM ADA SAMA
// SEKALI — cuma bisa pilih pakai mouse/klik. Ditambah `indexSorot` (state
// baru) buat highlight 1 opsi yang lagi "disorot" panah, + handler
// @keydown Arrow Up/Down/Enter/Escape di bawah.
// ---------------------------------------------------------------------------
export const DropdownCari = {
  props: {
    modelValue: { type: String, default: '' },
    opsi: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'Cari & pilih...' },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const tampilDropdown = ref(false);
    const kataCari = ref('');
    const indexSorot = ref(-1); // FIX 27 Agt 2026 — opsi yang sedang disorot panah keyboard
    const listEl = ref(null); // FIX 27 Agt 2026 — buat auto-scroll pas sorotan geser lewat batas layar
    const opsiTersaring = computed(() => {
      const kata = kataCari.value.trim().toLowerCase();
      if (!kata) return props.opsi;
      return props.opsi.filter(o => o.toLowerCase().includes(kata));
    });
    // Reset sorotan tiap kali daftar opsi tersaring berubah (ketik huruf
    // baru) — mulai dari opsi PALING ATAS, biar Enter langsung pilih hasil
    // teratas tanpa perlu tekan panah bawah dulu.
    watch(opsiTersaring, () => { indexSorot.value = opsiTersaring.value.length > 0 ? 0 : -1; });
    // FIX (27 Agt 2026) — begitu sorotan geser (panah atas/bawah), pastikan
    // opsi yang disorot ikut ke-scroll ke dalam layar kalau posisinya lagi
    // di luar area kelihatan (list-nya scrollable, max-height:220px).
    watch(indexSorot, (i) => {
      if (i < 0 || !listEl.value) return;
      const el = listEl.value.children[i];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    });
    function buka() {
      if (props.disabled) return;
      kataCari.value = '';
      indexSorot.value = props.opsi.length > 0 ? 0 : -1;
      tampilDropdown.value = true;
    }
    // @mousedown.prevent di opsi (lihat template) mencegah event 'blur' di
    // input keburu nutup dropdown SEBELUM klik opsi sempat kedaftar — tetap
    // pasang jeda kecil di sini sebagai jaring pengaman kedua.
    function tutupTunda() {
      setTimeout(() => { tampilDropdown.value = false; }, 150);
    }
    function pilih(o) {
      emit('update:modelValue', o);
      tampilDropdown.value = false;
      kataCari.value = '';
      indexSorot.value = -1;
    }
    // FIX (27 Agt 2026) — navigasi keyboard: panah bawah/atas geser
    // sorotan (berhenti di ujung, TIDAK muter balik ke awal/akhir supaya
    // tidak bikin bingung), Enter pilih opsi yang sedang disorot, Escape
    // tutup dropdown tanpa memilih apa-apa.
    function sorotBerikutnya() {
      if (!tampilDropdown.value) { buka(); return; }
      if (opsiTersaring.value.length === 0) return;
      indexSorot.value = Math.min(indexSorot.value + 1, opsiTersaring.value.length - 1);
    }
    function sorotSebelumnya() {
      if (!tampilDropdown.value) return;
      if (opsiTersaring.value.length === 0) return;
      indexSorot.value = Math.max(indexSorot.value - 1, 0);
    }
    function pilihYangDisorot() {
      if (!tampilDropdown.value) return;
      const o = opsiTersaring.value[indexSorot.value];
      if (o !== undefined) pilih(o);
    }
    function tutupTanpaPilih(ev) {
      tampilDropdown.value = false;
      ev.target.blur();
    }
    return {
      tampilDropdown, kataCari, opsiTersaring, indexSorot, listEl,
      buka, pilih, tutupTunda, sorotBerikutnya, sorotSebelumnya, pilihYangDisorot, tutupTanpaPilih
    };
  },
  template: `
    <div style="position:relative;">
      <input
        :value="tampilDropdown ? kataCari : (modelValue || '')"
        @input="kataCari = $event.target.value"
        @focus="buka"
        @blur="tutupTunda"
        @keydown.down.prevent="sorotBerikutnya"
        @keydown.up.prevent="sorotSebelumnya"
        @keydown.enter.prevent="pilihYangDisorot"
        @keydown.esc="tutupTanpaPilih"
        :disabled="disabled"
        type="text"
        :placeholder="placeholder"
        style="width:100%; padding:8px 30px 8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; background:var(--surface); box-sizing:border-box;"
      >
      <i class="fas fa-chevron-down" style="position:absolute; right:12px; top:11px; font-size:10px; color:var(--text-faint); pointer-events:none;"></i>
      <div v-if="tampilDropdown" ref="listEl" style="position:absolute; top:calc(100% + 4px); left:0; right:0; background:var(--surface); border:1.5px solid var(--line); border-radius:10px; max-height:220px; overflow-y:auto; z-index:50; box-shadow:0 8px 20px rgba(0,0,0,.14);">
        <div v-if="opsiTersaring.length === 0" style="padding:10px 12px; font-size:11.5px; color:var(--text-faint);">Tidak ada yang cocok.</div>
        <div v-for="(o, i) in opsiTersaring" :key="o" @mousedown.prevent="pilih(o)" @mouseenter="indexSorot = i"
          :style="{padding:'8px 12px', fontSize:'12.5px', cursor:'pointer', background: (i===indexSorot ? 'var(--burgundy-light)' : (o===modelValue ? 'var(--ivory-dim)' : 'transparent')), fontWeight: (o===modelValue ? '700':'400')}">{{ o }}</div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// bacaFileExcel / ambilSheet / unduhWorkbook — BARU (28 Agt 2026, §37),
// DISALIN dari vue-master-produk.js/vue-bahan-aksesoris.js (konvensi
// proyek "disalin, bukan diimpor silang" antar file) — dipakai fitur
// Import/Upload Massal Excel di MasterDataTabelManager di bawah. Pakai
// XLSX global yang sudah dimuat lewat <script> di index.html (SheetJS).
// ---------------------------------------------------------------------------
function bacaFileExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(XLSX.read(new Uint8Array(e.target.result), { type: 'array' })); }
      catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
function ambilSheet(workbook, namaSheet) {
  const sheet = workbook.Sheets[namaSheet];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}
function unduhWorkbook(sheets, namaFile) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.baris, { header: s.header });
    XLSX.utils.book_append_sheet(wb, ws, s.nama);
  }
  XLSX.writeFile(wb, namaFile);
}

// ---------------------------------------------------------------------------
// PopupImportMasterData — BARU (28 Agt 2026, §37). Popup verifikasi Import
// Excel buat MasterDataTabelManager (di bawah) — generik, sengaja dibikin
// SESIMPEL skema aslinya (cuma 2-3 kolom teks bebas: Nama [+ field3
// opsional] + Keterangan, TIDAK ADA dropdown/foreign-key yang perlu
// divalidasi seperti Import BOM/Bahan & Aksesoris, jadi TIDAK butuh
// FieldValidasiInline/Levenshtein). Baris yang Nama-nya SUDAH ADA di
// daftar (persis sama alasan `tambah()` manual di MasterDataTabelManager
// menolak nama dobel) ditandai "Sudah ada, dilewati" — TIDAK menimpa,
// konsisten dengan §35 (Import Bahan & Aksesoris) & karena manual entry
// di komponen ini MEMANG tidak pernah izinkan 2 nama sama persis.
// ---------------------------------------------------------------------------
const PopupImportMasterData = {
  props: {
    labelSingular: { type: String, required: true },
    header: { type: Array, required: true }, // ['Nama'] + (field3? [field3Label]) + ['Keterangan']
    field3Key: { type: String, default: '' },
    field3Label: { type: String, default: '' },
    barisMentah: { type: Array, default: () => [] },
    daftarLama: { type: Array, default: () => [] }, // daftar {nama,...} yang sudah ada di Firestore
    sedangImport: { type: Boolean, default: false }
  },
  emits: ['tutup', 'konfirmasi'],
  setup(props, { emit }) {
    const namaLamaSet = computed(() => new Set(props.daftarLama.map(d => (d.nama || '').trim().toLowerCase())));
    const kolomField3 = computed(() => props.field3Key ? props.field3Label : '');

    const baris = ref(props.barisMentah.map(b => ({
      nama: String(b['Nama'] || '').trim(),
      field3: props.field3Key ? String(b[kolomField3.value] || '').trim() : '',
      keterangan: String(b['Keterangan'] || '').trim()
    })));

    // hitung urutan-kemunculan tiap nama (case-insensitive) di dalam file
    // itu sendiri — dobel DI FILE (bukan cuma dobel vs data lama) juga
    // harus ditandai, biar tidak 2x addDoc buat nama yang sama persis.
    const indexPertamaKemunculan = computed(() => {
      const peta = {};
      baris.value.forEach((b, i) => {
        const kunci = b.nama.toLowerCase();
        if (kunci && !(kunci in peta)) peta[kunci] = i;
      });
      return peta;
    });

    function statusBaris(b, i) {
      if (!b.nama) return { valid: false, dilewati: false, label: 'Nama kosong' };
      const kunci = b.nama.toLowerCase();
      if (namaLamaSet.value.has(kunci)) return { valid: true, dilewati: true, label: 'Sudah ada, dilewati' };
      if (indexPertamaKemunculan.value[kunci] !== i) return { valid: true, dilewati: true, label: 'Dobel di file ini, dilewati' };
      return { valid: true, dilewati: false, label: 'Baru, akan ditambahkan' };
    }

    const barisDenganStatus = computed(() => baris.value.map((b, i) => ({ b, status: statusBaris(b, i) })));
    const jumlahError = computed(() => barisDenganStatus.value.filter(x => !x.status.valid).length);
    const jumlahDitambahkan = computed(() => barisDenganStatus.value.filter(x => x.status.valid && !x.status.dilewati).length);
    const semuaSiap = computed(() => baris.value.length > 0 && jumlahError.value === 0);

    function konfirmasi() {
      if (!semuaSiap.value) return;
      const barisBaru = barisDenganStatus.value.filter(x => x.status.valid && !x.status.dilewati).map(x => x.b);
      emit('konfirmasi', barisBaru);
    }

    return { kolomField3, barisDenganStatus, jumlahError, jumlahDitambahkan, semuaSiap, konfirmasi };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;">
      <div class="gc-card" style="max-width:720px; width:100%; margin:24px 0;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-file-import" style="color:var(--burgundy); margin-right:8px;"></i>Verifikasi Import {{ labelSingular }}</h3>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Baris yang namanya sudah ada (atau dobel di file ini) otomatis dilewati, TIDAK menimpa data lama.</p>
        <div style="overflow-x:auto; margin-bottom:14px;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="text-align:left; color:var(--text-faint); font-size:10.5px; text-transform:uppercase;"><th style="padding:6px; min-width:140px;">Nama</th><th v-if="kolomField3" style="padding:6px; min-width:120px;">{{ kolomField3 }}</th><th style="padding:6px; min-width:160px;">Keterangan</th><th style="padding:6px;">Status</th></tr></thead>
            <tbody>
              <tr v-for="(x,i) in barisDenganStatus" :key="i" style="border-top:1px solid var(--line);">
                <td style="padding:6px; font-weight:700;">{{ x.b.nama || '-' }}</td>
                <td v-if="kolomField3" style="padding:6px;">{{ x.b.field3 || '-' }}</td>
                <td style="padding:6px;">{{ x.b.keterangan || '-' }}</td>
                <td style="padding:6px;"><span class="tag" :class="!x.status.valid ? 'danger' : (x.status.dilewati ? 'neutral' : 'ok')">{{ x.status.label }}</span></td>
              </tr>
              <tr v-if="!barisDenganStatus.length"><td :colspan="kolomField3 ? 4 : 3" style="padding:14px; text-align:center; color:var(--text-faint);">File kosong.</td></tr>
            </tbody>
          </table>
        </div>
        <p v-if="semuaSiap" style="font-size:11.5px; color:var(--text-muted); margin-bottom:10px;">{{ jumlahDitambahkan }} data baru akan ditambahkan, {{ barisDenganStatus.length - jumlahDitambahkan }} dilewati.</p>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button @click="$emit('tutup')" type="button" class="btn-outline" :disabled="sedangImport">Batal</button>
          <button @click="konfirmasi" type="button" class="btn-primary" :disabled="!semuaSiap || sedangImport">{{ sedangImport ? 'Mengimpor...' : 'Import' }}</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// MasterDataTabelManager — BARU (23 Agt 2026). Beda dari MasterDataCategory
// di atas (yang nyimpan 1 dokumen `master_data/{kategori}` berisi array
// string polos): komponen ini kelola koleksi Firestore SENDIRI (1 dokumen
// per item), tiap item punya 2 kolom: `nama` + `keterangan`. Dipakai
// pertama kali buat Data Satuan/Ukuran/Warna (Master Bahan & Aksesoris) —
// TAPI ditulis generik (props `koleksi`) supaya bisa dipakai ulang buat
// master data 2-kolom lain di menu manapun ke depannya.
// ---------------------------------------------------------------------------
export const MasterDataTabelManager = {
  props: {
    koleksi: { type: String, required: true },
    labelSingular: { type: String, required: true }, // "Satuan" / "Ukuran" / "Warna" / "Suplayer"
    labelNama: { type: String, required: true }, // "Nama Satuan" dst — placeholder input
    menuId: { type: String, default: 'bahan_aksesoris_entry' },
    // BARU (24 Agt 2026) — dipakai pertama kali buat Master Suplayer (field
    // "Kontak/Alamat", opsional). Kalau field3Key KOSONG (default), komponen
    // ini persis seperti semula: 2 kolom nama+keterangan. Kalau diisi, input
    // ke-3 muncul DI ANTARA nama & keterangan, disimpan dengan key custom.
    field3Key: { type: String, default: '' },
    field3Label: { type: String, default: '' }, // contoh: "Kontak/Alamat (opsional)"
    // BARU (27 Agt 2026) — sama seperti MasterDataCategory di atas, dipakai
    // pertama kali buat menu "Config". Default false = TIDAK berubah untuk
    // semua pemakaian lama (tag/chip).
    tampilTabel: { type: Boolean, default: false },
    // BARU (28 Agt 2026, §37) — fitur Import/Upload Massal Excel + Template.
    // Default false = TIDAK berubah untuk semua pemakaian lama/tab lain.
    // Dipakai pertama kali buat "Data Komponen" (Config) — opt-in per tab,
    // gampang dinyalakan buat tab lain (Satuan/Ukuran/Warna/dst) nanti
    // tinggal set prop ini `true`, tidak perlu kode baru.
    izinkanImportExcel: { type: Boolean, default: false }
  },
  components: { PopupImportMasterData },
  setup(props) {
    const daftar = ref([]);
    const memuat = ref(true);
    const namaBaru = ref('');
    const field3Baru = ref('');
    const keteranganBaru = ref('');
    const menyimpan = ref(false);
    // cariItem/daftarTersaring — BARU (27 Agt 2026), cuma dipakai mode
    // tampilTabel (searchbox). Tidak berpengaruh ke mode tag/chip lama.
    const cariItem = ref('');
    const daftarTersaring = computed(() => {
      const kata = cariItem.value.trim().toLowerCase();
      if (!kata) return daftar.value;
      return daftar.value.filter(d => (d.nama || '').toLowerCase().includes(kata));
    });

    const bolehTambah = computed(() => window.cekIzinMenu(props.menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(props.menuId, 'delete') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, props.koleksi));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        daftar.value = list;
      } catch (e) {
        console.error(`Gagal muat ${props.koleksi}:`, e);
      }
      memuat.value = false;
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah item di sini. Hubungi Owner/PIC.');
      const nama = namaBaru.value.trim();
      if (!nama) return;
      if (daftar.value.some(d => (d.nama || '').toLowerCase() === nama.toLowerCase())) {
        alert(`${props.labelSingular} "${nama}" sudah ada di daftar.`);
        return;
      }
      menyimpan.value = true;
      try {
        const dataBaru = { nama, keterangan: keteranganBaru.value.trim(), dibuat_pada: serverTimestamp() };
        if (props.field3Key) dataBaru[props.field3Key] = field3Baru.value.trim();
        await addDoc(collection(db, props.koleksi), dataBaru);
        namaBaru.value = ''; keteranganBaru.value = ''; field3Baru.value = '';
        await muat();
      } catch (e) {
        console.error(`Gagal tambah ${props.koleksi}:`, e);
        alert('Gagal menambah data.');
      }
      menyimpan.value = false;
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus item di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus ${props.labelSingular.toLowerCase()} "${item.nama}"? Data yang SUDAH memakai nilai ini TIDAK ikut berubah/terhapus.`)) return;
      try {
        await deleteDoc(doc(db, props.koleksi, item.id));
        await muat();
      } catch (e) {
        console.error(`Gagal hapus ${props.koleksi}:`, e);
        alert('Gagal menghapus data.');
      }
    }

    // --- Import/Upload Massal Excel + Template (BARU 28 Agt 2026, §37) -----
    const dropdownImportTerbuka = ref(false);
    const inputFileImport = ref(null);
    const popupImportAktif = ref(false);
    const barisMentahImport = ref([]);
    const sedangImport = ref(false);

    const headerImport = computed(() => ['Nama', ...(props.field3Key ? [props.field3Label] : []), 'Keterangan']);

    function unduhTemplateImport() {
      dropdownImportTerbuka.value = false;
      const contoh = { 'Nama': `Contoh ${props.labelSingular}`, 'Keterangan': 'Opsional, boleh dikosongkan' };
      if (props.field3Key) contoh[props.field3Label] = `Contoh ${props.field3Label}`;
      unduhWorkbook([{ nama: props.labelSingular, header: headerImport.value, baris: [contoh] }], `Template Import ${props.labelSingular}.xlsx`);
    }
    function pancingFileImport() { dropdownImportTerbuka.value = false; inputFileImport.value?.click(); }

    async function saatFileImportDipilih(ev) {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const wb = await bacaFileExcel(file);
        const baris = ambilSheet(wb, props.labelSingular);
        if (!baris.length) return alert(`Sheet "${props.labelSingular}" tidak ditemukan atau kosong. Pastikan file berasal dari Template Import ${props.labelSingular}.`);
        barisMentahImport.value = baris;
        popupImportAktif.value = true;
      } catch (e) {
        console.error('Gagal baca file Excel:', e);
        alert('Gagal membaca file Excel. Pastikan formatnya benar (.xlsx).');
      }
    }

    function tutupPopupImport() { popupImportAktif.value = false; }

    async function konfirmasiImport(barisBaru) {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah item di sini. Hubungi Owner/PIC.');
      sedangImport.value = true;
      try {
        for (const b of barisBaru) {
          const dataBaru = { nama: b.nama, keterangan: b.keterangan, dibuat_pada: serverTimestamp() };
          if (props.field3Key) dataBaru[props.field3Key] = b.field3;
          await addDoc(collection(db, props.koleksi), dataBaru);
        }
        popupImportAktif.value = false;
        await muat();
        alert(`Import selesai: ${barisBaru.length} data baru ditambahkan.`);
      } catch (e) {
        console.error(`Gagal import ${props.koleksi}:`, e);
        alert('Gagal mengimpor. Coba lagi.');
      }
      sedangImport.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      daftar, memuat, namaBaru, field3Baru, keteranganBaru, menyimpan, bolehTambah, bolehHapus, tambah, hapus, cariItem, daftarTersaring,
      dropdownImportTerbuka, inputFileImport, popupImportAktif, barisMentahImport, sedangImport, headerImport,
      unduhTemplateImport, pancingFileImport, saatFileImportDipilih, tutupPopupImport, konfirmasiImport
    };
  },
  template: `
    <!-- Mode BARU (27 Agt 2026) — entry+searchbox+table, dipakai menu Config. -->
    <div v-if="tampilTabel">
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Data {{ labelSingular }}</label>
      <div v-if="bolehTambah" style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap;">
        <input v-model="namaBaru" @keyup.enter="tambah" type="text" :placeholder="labelNama + '...'" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <input v-if="field3Key" v-model="field3Baru" @keyup.enter="tambah" type="text" :placeholder="field3Label" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <input v-model="keteranganBaru" @keyup.enter="tambah" type="text" placeholder="Keterangan (opsional)" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:0 16px;"><i class="fas fa-plus"></i></button>
      </div>
      <div v-if="!memuat" style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-start; margin-bottom:10px;">
        <div style="position:relative; flex:1; min-width:200px; max-width:280px;">
          <i class="fas fa-search" style="position:absolute; left:11px; top:9px; color:var(--text-faint); font-size:11px;"></i>
          <input v-model="cariItem" type="text" placeholder="Cari item..." style="width:100%; padding:7px 10px 7px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:11.5px; outline:none; box-sizing:border-box;">
        </div>
        <div v-if="izinkanImportExcel && bolehTambah" style="position:relative;">
          <button @click="dropdownImportTerbuka = !dropdownImportTerbuka" type="button" class="btn-outline" style="font-size:11.5px;"><i class="fas fa-file-import" style="margin-right:6px;"></i>Import / Template Excel <i class="fas fa-chevron-down" style="margin-left:4px; font-size:9px;"></i></button>
          <div v-if="dropdownImportTerbuka" style="position:absolute; z-index:30; top:calc(100% + 4px); left:0; background:var(--surface); border:1.5px solid var(--line); border-radius:10px; box-shadow:0 8px 20px rgba(0,0,0,.14); min-width:200px;">
            <button @click="unduhTemplateImport" type="button" style="display:block; width:100%; text-align:left; padding:9px 14px; background:none; border:none; font-size:12px; cursor:pointer;">Download Template</button>
            <button @click="pancingFileImport" type="button" style="display:block; width:100%; text-align:left; padding:9px 14px; background:none; border:none; font-size:12px; cursor:pointer; border-top:1px solid var(--line);">Import Excel (Upload Massal)</button>
          </div>
          <input ref="inputFileImport" type="file" accept=".xlsx,.xls" @change="saatFileImportDipilih" style="display:none;">
        </div>
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead><tr><th style="width:48px;">No</th><th>Nama</th><th v-if="field3Key">{{ field3Label }}</th><th>Keterangan</th><th style="width:70px;">Aksi</th></tr></thead>
          <tbody>
            <tr v-if="daftar.length === 0"><td :colspan="field3Key ? 5 : 4" style="color:var(--text-faint); font-size:11px;">Belum ada data.</td></tr>
            <tr v-else-if="daftarTersaring.length === 0"><td :colspan="field3Key ? 5 : 4" style="color:var(--text-faint); font-size:11px;">Tidak ada yang cocok dicari.</td></tr>
            <tr v-for="(d, i) in daftarTersaring" :key="d.id">
              <td>{{ i + 1 }}</td>
              <td>{{ d.nama }}</td>
              <td v-if="field3Key">{{ d[field3Key] || '-' }}</td>
              <td>{{ d.keterangan || '-' }}</td>
              <td><button v-if="bolehHapus" @click="hapus(d)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <popup-import-master-data
        v-if="popupImportAktif"
        :label-singular="labelSingular"
        :header="headerImport"
        :field3-key="field3Key"
        :field3-label="field3Label"
        :baris-mentah="barisMentahImport"
        :daftar-lama="daftar"
        :sedang-import="sedangImport"
        @tutup="tutupPopupImport"
        @konfirmasi="konfirmasiImport" />
    </div>
    <!-- Mode LAMA (tag/chip) — TIDAK berubah, dipakai semua menu lain. -->
    <div v-else>
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Data {{ labelSingular }}</label>
      <div v-if="bolehTambah" style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap;">
        <input v-model="namaBaru" @keyup.enter="tambah" type="text" :placeholder="labelNama + '...'" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <input v-if="field3Key" v-model="field3Baru" @keyup.enter="tambah" type="text" :placeholder="field3Label" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <input v-model="keteranganBaru" @keyup.enter="tambah" type="text" placeholder="Keterangan (opsional)" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:0 16px;"><i class="fas fa-plus"></i></button>
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else-if="daftar.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada data.</div>
      <div v-else style="display:flex; flex-wrap:wrap; gap:6px;">
        <span v-for="d in daftar" :key="d.id" class="tag neutral" :title="(field3Key && d[field3Key] ? (field3Label + ': ' + d[field3Key] + ' — ') : '') + (d.keterangan || '')" style="gap:8px;">
          {{ d.nama }}
          <button v-if="bolehHapus" @click="hapus(d)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:11px;"><i class="fas fa-times"></i></button>
        </span>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// DuaBaris — pola "2 baris per sel" yang dipakai berulang kali di berbagai
// tabel (Daftar Karyawan, Antrean Absensi, Riwayat All Absensi): baris atas
// bold/besar, baris bawah kecil/abu-abu. 1 komponen, dipakai di mana-mana.
// ---------------------------------------------------------------------------
export const DuaBaris = {
  props: {
    a: { type: [String, Number], default: '' },
    b: { type: [String, Number], default: '' }
  },
  template: `
    <span>
      <b style="color:var(--text);">{{ a || '-' }}</b><br>
      <span style="font-size:11px; color:var(--text-muted); font-weight:400;">{{ b || '-' }}</span>
    </span>
  `
};

// ---------------------------------------------------------------------------
// GudangCheckboxSelect — pilih gudang (bisa lebih dari satu) via checkbox.
// Dipakai lewat v-model, contoh: <gudang-checkbox-select v-model="gudangTerpilih" />
// ---------------------------------------------------------------------------
export const GudangCheckboxSelect = {
  props: {
    modelValue: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const daftarGudang = ref([]);
    const memuat = ref(true);
    const terbuka = ref(false);

    async function muat() {
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const snap = await getDocs(collection(db, 'master_gudang'));
      const list = [];
      snap.forEach(d => list.push(d.data().nama_gudang));
      daftarGudang.value = list;
      memuat.value = false;
    }

    function toggle(nama, dicentang) {
      const nilaiBaru = [...props.modelValue];
      const idx = nilaiBaru.indexOf(nama);
      if (dicentang && idx === -1) nilaiBaru.push(nama);
      if (!dicentang && idx > -1) nilaiBaru.splice(idx, 1);
      emit('update:modelValue', nilaiBaru);
    }

    function toggleDropdown() { terbuka.value = !terbuka.value; }
    function pilihSemua() { emit('update:modelValue', [...daftarGudang.value]); }
    function kosongkanSemua() { emit('update:modelValue', []); }

    const teksRingkasan = computed(() => {
      if (props.modelValue.length === 0) return 'Pilih gudang...';
      if (props.modelValue.length <= 2) return props.modelValue.join(', ');
      return `${props.modelValue.length} gudang dipilih`;
    });

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarGudang, memuat, terbuka, toggle, toggleDropdown, pilihSemua, kosongkanSemua, teksRingkasan };
  },
  template: `
    <div style="position:relative;">
      <button type="button" @click="toggleDropdown" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:10px 13px; background:var(--surface); border:1.5px solid var(--line); border-radius:12px; font-size:12.5px; cursor:pointer; text-align:left;" :style="modelValue.length === 0 ? 'color:var(--text-faint);' : 'color:var(--text);'">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ teksRingkasan }}</span>
        <i class="fas" :class="terbuka ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-faint); flex-shrink:0; margin-left:8px;"></i>
      </button>
      <div v-if="terbuka" style="position:absolute; z-index:20; top:calc(100% + 4px); left:0; right:0; background:var(--surface); border:1.5px solid var(--line); border-radius:12px; padding:10px; box-shadow:0 8px 20px rgba(59,42,31,.12); max-height:240px; overflow-y:auto;">
        <div v-if="memuat" style="font-size:11px; color:var(--text-faint); padding:6px;">Memuat gudang...</div>
        <div v-else-if="daftarGudang.length === 0" style="font-size:11px; color:var(--text-faint); padding:6px;">Belum ada Master Gudang. Buat dulu di Config Absensi.</div>
        <template v-else>
          <div style="display:flex; justify-content:flex-end; gap:10px; padding-bottom:8px; margin-bottom:6px; border-bottom:1px solid var(--line);">
            <button type="button" @click="pilihSemua" style="background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer;">Select All</button>
            <button type="button" @click="kosongkanSemua" style="background:none; border:none; color:var(--text-muted); font-weight:700; font-size:11px; cursor:pointer;">Clear All</button>
          </div>
          <label v-for="g in daftarGudang" :key="g" style="display:flex; align-items:center; gap:8px; padding:7px 6px; font-size:12.5px; cursor:pointer; border-radius:8px;">
            <input type="checkbox" :checked="modelValue.includes(g)" @change="toggle(g, $event.target.checked)" style="accent-color:var(--burgundy); width:15px; height:15px;">
            <span>{{ g }}</span>
          </label>
        </template>
      </div>
    </div>
  `
};
// ---------------------------------------------------------------------------
// KecamatanManager — khusus, bertingkat per Kabupaten/Kota.
// ---------------------------------------------------------------------------
export const KecamatanManager = {
  setup() {
    const daftarKabupaten = ref([]);
    const kabupatenTerpilih = ref('');
    const kecamatanList = ref([]);
    const inputBaru = ref('');
    const memuat = ref(true);

    async function muatKabupaten() {
      daftarKabupaten.value = await window.ambilMasterList('kabupaten');
      if (daftarKabupaten.value.length > 0 && !kabupatenTerpilih.value) {
        kabupatenTerpilih.value = daftarKabupaten.value[0];
      }
    }

    async function muatKecamatan() {
      if (!kabupatenTerpilih.value) { kecamatanList.value = []; return; }
      memuat.value = true;
      try {
        kecamatanList.value = await window.ambilKecamatanUntukKabupaten(kabupatenTerpilih.value);
      } catch (e) {
        console.error('Gagal muat kecamatan:', e);
      }
      memuat.value = false;
    }

    async function ambilPetaSekarang() {
      const snap = await getDoc(doc(db, 'master_data', 'kecamatan'));
      return (snap.exists() && snap.data().map) ? snap.data().map : {};
    }

    async function tambah() {
      const nilai = inputBaru.value.trim();
      if (!nilai || !kabupatenTerpilih.value) return;
      if (kecamatanList.value.includes(nilai)) { alert('Sudah ada.'); return; }
      const map = await ambilPetaSekarang();
      if (!map[kabupatenTerpilih.value]) map[kabupatenTerpilih.value] = [];
      map[kabupatenTerpilih.value].push(nilai);
      await setDoc(doc(db, 'master_data', 'kecamatan'), { map });
      kecamatanList.value = map[kabupatenTerpilih.value];
      inputBaru.value = '';
    }

    async function hapus(nilai) {
      const map = await ambilPetaSekarang();
      if (map[kabupatenTerpilih.value]) {
        map[kabupatenTerpilih.value] = map[kabupatenTerpilih.value].filter(i => i !== nilai);
      }
      await setDoc(doc(db, 'master_data', 'kecamatan'), { map });
      kecamatanList.value = map[kabupatenTerpilih.value] || [];
    }

    watch(kabupatenTerpilih, muatKecamatan);
    onMounted(async () => { await window.authReady; await muatKabupaten(); await muatKecamatan(); });

    return { daftarKabupaten, kabupatenTerpilih, kecamatanList, inputBaru, memuat, tambah, hapus };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:10px;">Kecamatan (per kabupaten/kota)</h4>
      <select v-model="kabupatenTerpilih" style="width:100%; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; margin-bottom:8px;">
        <option v-for="k in daftarKabupaten" :key="k" :value="k">{{ k }}</option>
      </select>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah kecamatan untuk kabupaten di atas..." style="flex:1; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        <button @click="tambah" class="btn-primary" style="padding:8px 14px;"><i class="fas fa-plus"></i></button>
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else style="display:flex; flex-wrap:wrap; gap:6px;">
        <span v-if="kecamatanList.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada kecamatan untuk kabupaten ini.</span>
        <span v-for="item in kecamatanList" :key="item" class="tag neutral" style="gap:8px;">
          {{ item }}
          <button @click="hapus(item)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:11px;"><i class="fas fa-times"></i></button>
        </span>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// GudangRingkas — tampilkan daftar gudang karyawan secara ringkas di tabel.
// Kalau cuma 1-2 gudang, tampil penuh. Kalau lebih, dipersingkat + link
// "lihat semua" yang buka popup daftar lengkapnya (popup dikelola sendiri
// di komponen ini, orang tua tidak perlu urus state apa-apa).
// Dipakai: <gudang-ringkas :gudang="d.gudang_penempatan" :nama="d.nama" />
// (terima array MAUPUN string lama — dinormalkan otomatis lewat
// window.normalisasiGudang, jadi aman untuk data lama/baru sekaligus.)
// ---------------------------------------------------------------------------
export const GudangRingkas = {
  props: {
    gudang: { type: [Array, String], default: () => [] },
    nama: { type: String, default: '' }
  },
  setup(props) {
    const popupTerbuka = ref(false);
    const daftar = computed(() => window.normalisasiGudang(props.gudang));
    const teksSingkat = computed(() => {
      if (daftar.value.length === 0) return '-';
      if (daftar.value.length <= 2) return daftar.value.join(', ');
      return daftar.value.slice(0, 1).join(', ') + ` +${daftar.value.length - 1} lainnya`;
    });
    const perluPopup = computed(() => daftar.value.length > 2);
    function buka() { popupTerbuka.value = true; }
    function tutup() { popupTerbuka.value = false; }
    return { daftar, teksSingkat, perluPopup, popupTerbuka, buka, tutup };
  },
  template: `
    <span>
      {{ teksSingkat }}
      <button v-if="perluPopup" @click="buka" style="background:none; border:none; color:var(--burgundy); font-weight:700; cursor:pointer; font-size:11px; margin-left:4px; text-decoration:underline;">lihat semua</button>
      <div v-if="popupTerbuka" @click="tutup" style="position:fixed; inset:0; background:rgba(59,42,31,.6); z-index:100; display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
        <div @click.stop style="background:var(--surface); width:100%; max-width:360px; padding:22px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
            <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;">Semua gudang{{ nama ? ' — ' + nama : '' }}</h3>
            <button @click="tutup" style="background:none; border:none; color:var(--text-faint); font-size:16px; cursor:pointer;"><i class="fas fa-times"></i></button>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <span v-for="g in daftar" :key="g" class="tag pink">{{ g }}</span>
          </div>
        </div>
      </div>
    </span>
  `
};

// ---------------------------------------------------------------------------
// daftarMenuGroups(role, urutanKustomPerKategori) — REGISTRY MENU TERPUSAT.
//
// DIROMBAK (27 Agt 2026, §27 — Redesain Home Mobile): SEBELUMNYA fungsi ini
// isinya array grup/menu yang ditulis TANGAN, terpisah dari DAFTAR_MENU
// (vue-config-akses.js) — itu yang bikin Home mobile ketinggalan jauh dari
// sidebar (lihat STATUS-PROYEK.md §27, ketauan grup "Zevanic House" di sini
// cuma ada 2 menu padahal sidebar sudah 12+). SEKARANG fungsi ini MEMBACA
// DAFTAR_MENU langsung — itu satu-satunya tempat menu didaftarkan (lengkap
// dengan label/icon/aksi/kategori-nya), jadi menu baru yang ditambah di
// sana OTOMATIS nongol juga di sini, tidak perlu disalin tangan lagi.
// Kategori (field `kategori` di DAFTAR_MENU) dipakai APA ADANYA sebagai
// nama grup di Home mobile — kategori 'Umum' (Dashboard/Profile) SENGAJA
// tidak diikutkan (bukan menu yang cocok jadi tile grid), begitu juga menu
// yang ditandai `deprecated: true`.
//
// `urutanKustomPerKategori` (opsional): { [kategori]: [menuId, ...] } dari
// Config Akses > "Urutan Menu di Home Mobile" (Owner yang atur). Menentukan
// urutan tampil per kategori — 5 teratas itu yang muncul duluan di Home
// sebelum orang ketuk "Lihat Semua" (lihat vue-home.js). Menu yang belum
// ada di urutan kustom jatuh ke urutan asli DAFTAR_MENU, di posisi paling
// akhir (self-healing kalau ada menu baru).
//
// `urutanKustomKategori` (BARU 27 Agt 2026, sesi lanjutan §27.2, opsional):
// array nama kategori, urutan GRUP-nya sendiri (mis. Zevanic House di atas
// Master Absensi) — dari panel yang SAMA ("Urutan Kategori (Grup Menu)").
// Kategori yang belum diatur jatuh ke urutan asli KATEGORI_URUTAN di posisi
// paling akhir (self-healing sama seperti item). Urutan yang SAMA ini juga
// dipakai sidebar desktop, lihat window.terapkanUrutanMenuDesktop di
// js/auth.js.
// ---------------------------------------------------------------------------
export function daftarMenuGroups(role, urutanKustomPerKategori, urutanKustomKategori) {
  const r = (role || 'operator').toLowerCase();
  const urutanKustom = urutanKustomPerKategori || {};
  const urutanKatKustom = urutanKustomKategori || [];
  const posisiKat = {};
  urutanKatKustom.forEach((k, idx) => { posisiKat[k] = idx; });

  const semuaGroup = KATEGORI_URUTAN
    .filter(k => k !== 'Umum')
    .map(kategori => {
      const itemsAsli = DAFTAR_MENU.filter(m => m.kategori === kategori && !m.deprecated);
      const urutan = urutanKustom[kategori] || [];
      const posisiKustom = {};
      urutan.forEach((id, idx) => { posisiKustom[id] = idx; });
      const items = [...itemsAsli].sort((a, b) => {
        const pa = posisiKustom[a.id];
        const pb = posisiKustom[b.id];
        if (pa !== undefined && pb !== undefined) return pa - pb;
        if (pa !== undefined) return -1;
        if (pb !== undefined) return 1;
        return itemsAsli.indexOf(a) - itemsAsli.indexOf(b);
      });
      return { nama: kategori, items };
    })
    .filter(g => g.items.length > 0)
    .sort((a, b) => {
      const pa = posisiKat[a.nama];
      const pb = posisiKat[b.nama];
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return 0;
    });

  // PERUBAHAN 17 Agt 2026 (khusus tampilan Home mobile): dulu grup/menu
  // yang tidak boleh diakses role ini langsung DIHILANGKAN dari daftar.
  // Sekarang SEMUA grup & menu tetap DITAMPILKAN untuk siapapun — item
  // yang sebenarnya tidak boleh diakses cuma ditandai `terkunci: true`,
  // dan pengecekannya PAKAI ROLE YANG SUDAH ADA DI MEMORI (parameter
  // `role` ini, dari window.currentUser.role) — BUKAN baca Firestore lagi,
  // supaya tetap hemat. Halaman pemanggil (vue-home.js) yang tampilkan
  // pesan "Akses terkunci" kalau item.terkunci true saat diklik.
  //
  // PENERAPAN NYATA Config Akses (17 Agt 2026, tahap 1): status terkunci
  // CEK IZIN 'view' SUNGGUHAN dari akses_config lewat
  // window.cekIzinMenu(menuId, 'view'). Kalau izin BELUM DIATUR untuk role
  // ini (hasilnya null, misal role itu belum pernah dibuka di Config Akses
  // sama sekali), JATUH KEMBALI ke default aman: terkunci untuk siapapun
  // SELAIN owner/superuser — supaya menu yang belum sempat diatur tidak
  // tiba-tiba kebuka ke semua orang.
  //
  // BARU (27 Agt 2026, §27) — `wajibOwner: true` di DAFTAR_MENU (Config
  // Akses, Hak Akses, List Device Kiosk) jadi pengunci TAMBAHAN di ATAS
  // hasil cekIzinMenu — TETAP terkunci untuk siapapun selain role 'owner'
  // asli, APAPUN hasil Config Akses-nya, sama seperti gerbang yang sudah
  // ada di sidebar desktop untuk 3 menu itu.
  return semuaGroup.map(g => ({
    ...g,
    items: g.items.map(m => {
      const izinAsli = window.cekIzinMenu(m.id, 'view');
      const fallbackAman = !(r === 'owner' || r === 'superuser');
      let terkunci = izinAsli === null ? fallbackAman : !izinAsli;
      if (m.wajibOwner && r !== 'owner') terkunci = true;
      return { label: m.label, menuId: m.id, icon: m.icon, aksi: m.aksi, terkunci };
    })
  }));
}

// ---------------------------------------------------------------------------
// PengumumanCarousel — komponen bersama, dipakai di desktop DAN mobile
// (Home) sekaligus, satu sumber kebenaran. Mengambil data sendiri (fetch +
// filter role lokal, TIDAK query where() ke server — hemat baca), tampil
// sebagai carousel geser (scroll-snap, otomatis + bisa digeser manual).
// Lampiran gambar/video (kalau ada) ditampilkan dengan RASIO TETAP 16:9
// (object-fit:cover) supaya proporsional di layar manapun tanpa gepeng/
// terpotong aneh, baik di desktop maupun mobile — TIDAK perlu upload 2
// versi file berbeda untuk itu.
// ---------------------------------------------------------------------------
export const PengumumanCarousel = {
  setup() {
    const daftar = ref([]);
    const memuat = ref(true);
    const slideAktif = ref(0);
    const railEl = ref(null);
    let timerOtomatis = null;

    async function muat() {
      memuat.value = true;
      try {
        const q = query(collection(db, "pengumuman"), orderBy("dibuat_pada", "desc"), limit(15));
        const snap = await getDocs(q);
        const roleSaya = (window.currentUser?.role || 'operator').toLowerCase();
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          const rolesTampil = data.rolesTampil || [];
          if (rolesTampil.length === 0 || rolesTampil.includes(roleSaya)) list.push({ id: d.id, ...data });
        });
        daftar.value = list.slice(0, 5);
        mulaiOtomatis();
      } catch (e) {
        daftar.value = []; // koleksi belum ada/kosong itu wajar, bukan error
      }
      memuat.value = false;
    }

    function keSlide(i) {
      slideAktif.value = i;
      if (railEl.value) {
        const anak = railEl.value.children[i];
        if (anak) anak.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      }
    }

    function mulaiOtomatis() {
      if (timerOtomatis) clearInterval(timerOtomatis);
      if (daftar.value.length <= 1) return;
      timerOtomatis = setInterval(() => {
        keSlide((slideAktif.value + 1) % daftar.value.length);
      }, 6000);
    }

    function saatDigeserManual() {
      if (!railEl.value) return;
      const lebar = railEl.value.clientWidth;
      const posisi = railEl.value.scrollLeft;
      slideAktif.value = Math.round(posisi / lebar);
      mulaiOtomatis(); // reset hitungan otomatis tiap kali orang geser sendiri
    }

    onMounted(async () => { await window.authReady; muat(); });
    onUnmounted(() => { if (timerOtomatis) clearInterval(timerOtomatis); });

    return { daftar, memuat, slideAktif, railEl, keSlide, saatDigeserManual };
  },
  template: `
    <div v-if="memuat" style="text-align:center; padding:24px 0; color:var(--text-faint); font-size:12px;">Memuat pengumuman...</div>
    <div v-else-if="daftar.length === 0" style="text-align:center; padding:24px 0; background:var(--surface); border:1px dashed var(--line); border-radius:16px; color:var(--text-faint); font-size:12px;">
      <i class="fas fa-bell-slash" style="font-size:22px; margin-bottom:8px; display:block;"></i>Belum ada pengumuman terbaru.
    </div>
    <div v-else>
      <div ref="railEl" @scroll="saatDigeserManual" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:12px; scrollbar-width:none;" class="no-scrollbar">
        <div v-for="p in daftar" :key="p.id" style="flex:0 0 100%; scroll-snap-align:start; background:var(--surface); border:1px solid var(--line); border-radius:16px; overflow:hidden;">
          <div v-if="p.mediaUrl" style="width:100%; aspect-ratio:16/9; background:var(--ivory-dim); overflow:hidden;">
            <video v-if="p.mediaType === 'video'" :src="p.mediaUrl" controls style="width:100%; height:100%; object-fit:cover; display:block;"></video>
            <img v-else :src="p.mediaUrl" :alt="p.judul" style="width:100%; height:100%; object-fit:cover; display:block;">
          </div>
          <div style="padding:11px; display:flex; gap:9px;">
            <div v-if="!p.mediaUrl" style="width:34px; height:34px; border-radius:10px; background:var(--blue); flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#1F5060;"><i class="fas fa-bell"></i></div>
            <div>
              <b style="font-size:13px;">{{ p.judul }}</b>
              <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">{{ p.isi }}</p>
            </div>
          </div>
        </div>
      </div>
      <div v-if="daftar.length > 1" style="display:flex; justify-content:center; gap:6px; margin-top:7px;">
        <button v-for="(p, i) in daftar" :key="p.id" @click="keSlide(i)" style="width:7px; height:7px; border-radius:50%; border:none; padding:0; cursor:pointer;" :style="i === slideAktif ? 'background:var(--burgundy); width:18px; border-radius:4px;' : 'background:var(--line);'"></button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// EmojiPicker — komponen bersama, tombol kecil + popup grid emoji. Dipakai
// di field judul/isi Pengumuman & Quote (Config Info), bisa dipakai ulang
// di form manapun ke depan yang butuh emoji. TIDAK menyimpan state teksnya
// sendiri — cuma emit karakter emoji yang dipilih (@pilih="target += $event"),
// pemanggil yang tentukan mau ditambahkan ke field mana.
// ---------------------------------------------------------------------------
const DAFTAR_EMOJI = [
  '😊','😀','🎉','🎊','✨','🔥','💪','👏','🙏','❤️',
  '📢','📣','⏰','🕐','✅','❌','⚠️','🏆','🎯','📅',
  '💰','🎁','🌟','👍','😍','🥳','💯','🚀','📌','☕'
];

export const EmojiPicker = {
  emits: ['pilih'],
  setup(props, { emit }) {
    const terbuka = ref(false);
    function toggle() { terbuka.value = !terbuka.value; }
    function pilih(emoji) { emit('pilih', emoji); terbuka.value = false; }
    return { terbuka, toggle, pilih, DAFTAR_EMOJI };
  },
  template: `
    <div style="position:relative; display:inline-block;">
      <button type="button" @click="toggle" style="background:var(--ivory-dim); border:1px solid var(--line); border-radius:8px; width:30px; height:30px; cursor:pointer; font-size:14px;">😊</button>
      <div v-if="terbuka" style="position:absolute; z-index:50; top:36px; right:0; background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(0,0,0,.15); padding:8px; width:200px; display:grid; grid-template-columns:repeat(6,1fr); gap:4px;">
        <button v-for="e in DAFTAR_EMOJI" :key="e" type="button" @click="pilih(e)" style="background:none; border:none; font-size:17px; padding:4px; cursor:pointer; border-radius:6px;">{{ e }}</button>
      </div>
      <div v-if="terbuka" @click="terbuka = false" style="position:fixed; inset:0; z-index:40;"></div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// QuoteCard — komponen bersama (Kotak 3), dipakai di desktop & mobile Home
// sekaligus. Ambil QUOTE HARI INI SAJA (query where tanggalTampil==hari
// ini, limit 1 — paling murah, 0 atau 1 baca), diatur di Config Info >
// Quote Harian. Kalau tidak ada Quote dijadwalkan untuk hari ini, komponen
// ini tidak render apapun (tidak ada kartu kosong yang aneh).
// ---------------------------------------------------------------------------
export const QuoteCard = {
  setup() {
    const quote = ref(null);
    const memuat = ref(true);

    async function muat() {
      memuat.value = true;
      try {
        const hariIni = new Date().toISOString().split('T')[0]; // format YYYY-MM-DD, sama dengan <input type="date">
        const q = query(collection(db, "quotes"), where("tanggalTampil", "==", hariIni), limit(1));
        const snap = await getDocs(q);
        quote.value = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
      } catch (e) {
        quote.value = null; // koleksi belum ada/kosong itu wajar, bukan error
      }
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return { quote, memuat };
  },
  template: `
    <div v-if="!memuat && quote" style="background:linear-gradient(135deg, var(--pink), var(--blue)); border-radius:18px; padding:12px 14px; margin-bottom:14px; position:relative; overflow:hidden;">
      <div style="position:absolute; right:-20px; bottom:-20px; width:100px; height:100px; border-radius:50%; background:rgba(255,255,255,.25);"></div>
      <div style="position:relative; z-index:1;">
        <h4 class="gc-heading" style="font-size:14px; font-weight:700; color:var(--mahogany); display:flex; align-items:center; gap:8px; margin:0;"><i class="fas fa-quote-left"></i> {{ quote.judul }}</h4>
        <p style="font-size:12.5px; color:var(--mahogany-soft); margin:5px 0 0 0; line-height:1.45;">{{ quote.isi }}</p>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// KartuMenu — BARU (redesain "Gechoo Mobile Organic", README.md §1.5) —
// kartu 1 menu (lingkaran ikon + label), dipakai BERSAMA di Favorit Saya,
// Grup menu (Beranda), dan Menu Lengkap — SATU tempat, bukan disalin 3x.
// Modul terkunci (wajibOwner / cekIzinMenu view=false) tampil opacity .5 +
// ikon gembok, TETAP diklik (pemanggil yang urus tampilkan dialog "Akses
// Terbatas", bukan komponen ini — supaya nama modul & konteks dialog bisa
// disesuaikan pemanggil).
// ---------------------------------------------------------------------------
export const KartuMenu = {
  props: {
    item: { type: Object, required: true },
    ditandai: { type: Boolean, default: false } // dipakai mode pilih favorit (bintang kecil)
  },
  emits: ['klik'],
  template: `
    <button @click="$emit('klik', item)" class="gc-card" style="padding:14px 6px 13px; min-height:88px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; cursor:pointer; position:relative; border-radius:16px;" :style="item.terkunci ? 'opacity:.5;' : ''">
      <i v-if="item.terkunci" class="fas fa-lock" style="position:absolute; top:7px; right:7px; font-size:10px; color:var(--text-faint);"></i>
      <i v-if="ditandai" class="fas fa-star" style="position:absolute; top:7px; left:7px; font-size:10px; color:var(--burgundy);"></i>
      <span style="width:34px; height:34px; border-radius:50%; background:var(--aksen-lembut); display:flex; align-items:center; justify-content:center; color:var(--aksen-ink); font-size:17px;"><i class="fas" :class="item.icon"></i></span>
      <span class="gc-heading" style="font-size:9.5px; font-weight:600; color:var(--text); text-align:center; line-height:1.25;">{{ item.label }}</span>
    </button>
  `
};

// ---------------------------------------------------------------------------
// AksesTerbatasDialog — BARU (redesain, README.md "Interactions") — GANTI
// alert() polos yang dulu dipakai untuk modul wajibOwner/terkunci. Dipakai
// bareng di Beranda & Menu Lengkap.
// ---------------------------------------------------------------------------
export const AksesTerbatasDialog = {
  props: { namaModul: { type: String, default: '' } },
  emits: ['tutup'],
  setup() {
    // Dibaca lewat computed (BUKAN window.currentUser langsung di
    // template) — pola wajib project ini, lihat catatan roleTampil di
    // vue-account-profile.js: Vue tidak reaktif ke window.currentUser
    // langsung. Dialog ini SELALU muncul SETELAH login (baru bisa klik
    // menu terkunci kalau sudah login), jadi cukup dibaca sekali saat
    // komponen ini dibuat — tidak perlu computed penuh, ref cukup.
    const roleSaya = window.currentUser?.role || '-';
    return { roleSaya };
  },
  template: `
    <div class="gc-dialog-backdrop" @click="$emit('tutup')">
      <div class="gc-dialog" @click.stop>
        <div style="width:56px; height:56px; border-radius:50%; background:var(--aksen-lembut); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; color:var(--aksen-ink); font-size:24px;"><i class="fas fa-lock"></i></div>
        <h3 class="gc-heading" style="font-size:17px; font-weight:700; margin:0;">Akses Terbatas</h3>
        <p style="font-size:12px; font-weight:600; margin:8px 0 0;">{{ namaModul }}</p>
        <p style="font-size:11px; color:var(--text-muted); margin:6px 0 18px; line-height:1.5;">Peran Anda saat ini ({{ roleSaya }}) belum diberi akses ke modul ini. Hubungi Owner / PIC Owner kalau perlu.</p>
        <button @click="$emit('tutup')" class="btn-primary" style="border-radius:999px;">Mengerti</button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// HeaderLayar — BARU (redesain "Gechoo Mobile Organic", README.md, dipakai
// di HAMPIR SEMUA layar baru: tombol kembali bulat + kicker + judul +
// menuId opsional). Tombol kembali pakai window.pindahTab(tabPulang) kalau
// prop `tab-pulang` diisi (paling umum), atau emit 'kembali' kalau
// pemanggil mau urus sendiri (dipakai untuk sub-layar di dalam 1 komponen,
// misal Profil Lengkap yang isinya banyak tabAktif internal).
// ---------------------------------------------------------------------------
export const HeaderLayar = {
  props: {
    kicker: { type: String, default: '' },
    judul: { type: String, required: true },
    menuId: { type: String, default: '' },
    tabPulang: { type: String, default: '' }
  },
  emits: ['kembali'],
  setup(props, { emit }) {
    function kembali() {
      if (props.tabPulang && window.pindahTab) window.pindahTab(props.tabPulang, null, false);
      else emit('kembali');
    }
    return { kembali };
  },
  template: `
    <div style="display:flex; align-items:center; gap:11px; margin-bottom:14px;">
      <button @click="kembali" style="width:34px; height:34px; border-radius:50%; background:var(--surface); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; color:var(--text);" aria-label="Kembali">
        <i class="fas fa-arrow-left" style="font-size:15px;"></i>
      </button>
      <div style="min-width:0;">
        <p v-if="kicker" class="gc-heading" style="font-size:9.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.08em; margin:0;">{{ kicker }}</p>
        <h2 class="gc-heading" style="font-size:18px; font-weight:700; color:var(--aksen-ink); margin:1px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ judul }}</h2>
        <p v-if="menuId" style="font-size:8.5px; color:var(--text-faint); margin:1px 0 0;">{{ menuId }}</p>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// KolomCari — BARU (redesain) — kolom cari pil (ikon kaca pembesar + input +
// tombol X saat terisi), dipakai di Menu Lengkap, Atur Favorit, dan pola
// Daftar modul. v-model lewat prop `modelValue` + emit 'update:modelValue'
// (kompatibel v-model bawaan Vue 3).
// ---------------------------------------------------------------------------
export const KolomCari = {
  props: { modelValue: { type: String, default: '' }, placeholder: { type: String, default: 'Cari...' } },
  emits: ['update:modelValue'],
  template: `
    <div style="display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-bottom:12px;">
      <i class="fas fa-magnifying-glass" style="font-size:15px; color:var(--text-faint); flex-shrink:0;"></i>
      <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" type="text" :placeholder="placeholder" style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
      <button v-if="modelValue" @click="$emit('update:modelValue', '')" style="background:none; border:none; padding:0; cursor:pointer; color:var(--text-faint); flex-shrink:0;"><i class="fas fa-xmark"></i></button>
    </div>
  `
};

// ---------------------------------------------------------------------------
// PopupPratinjauCetakLabel — BARU (28 Agt 2026, §41.1, permintaan Guru).
// Popup GENERIK pratinjau + konfigurasi SEBELUM cetak label fisik, dipakai
// BARENG oleh SEMUA tempat cetak label QR di app ini (Cetak Label di List
// Bahan & Aksesoris [GANTI dari tab tersendiri Stock & Pembelian], Cetak
// Label Roll di Nota Order Belanja, Cetak Label di Order SPK) — sebelumnya
// masing-masing LANGSUNG window.print() tanpa pratinjau/pengaturan apapun.
//
// Guru eksplisit: ukuran fisik yang dipakai 4x2 inch + kertas thermal
// roll (1 label = 1 lembar fisik, BUKAN banyak label per lembar kertas
// biasa seperti sebelumnya) — makanya CSS cetak di sini pakai `@page {
// size: 4in 2in; }` + `page-break-after` per label (gaya lama pola kotak
// dashed banyak-per-halaman DIHAPUS, sudah tidak relevan buat thermal).
//
// Kontrak props.daftarLabel: array `{kode, nama, info, qrDataUrl}` — kode
// TEKS QR (nama_pola/kode_lot/id_tampil/no_spk tergantung pemanggil),
// nama = judul barang, info = HTML pendek (boleh berisi entity &middot;,
// dst — makanya pratinjau di sini pakai v-html buat baris info, BUKAN
// interpolasi teks biasa yang otomatis di-escape Vue), qrDataUrl = hasil
// `buatQrDataUrl(kode)` yang SUDAH digambar duluan oleh pemanggil (pola
// generate-QR-sinkron-di-window-utama yang sudah terbukti jalan, lihat
// komentar panjang `buatQrDataUrl()` di js/vue-stock-pembelian.js — popup
// ini SENGAJA tidak menggambar QR sendiri, cuma terima gambar jadi).
//
// "Config print, data apa yang mau diprint" (permintaan Guru) diwakili 2
// checkbox tampilNama/tampilInfo — QR+kode SELALU tampil (itu intinya,
// biar tetap bisa discan). Jumlah Salinan mengulang TIAP label yang
// dikirim sebanyak N kali di halaman cetak (bukan pakai dialog "copies"
// bawaan printer — lebih pasti kejadian di printer thermal).
//
// Emit 'cetak' (payload {jumlahSalinan, tampilNama, tampilInfo}) SETELAH
// window cetak dibuka — pemanggil boleh dengarkan buat tindak lanjutnya
// sendiri (misal catat log_cetak_label, BEDA-BEDA per pemanggil, TIDAK
// semua pemanggil butuh — makanya logging TIDAK dijadikan tanggung jawab
// popup ini, cuma tugas cetak+pratinjau generik).
// ---------------------------------------------------------------------------
export const PopupPratinjauCetakLabel = {
  props: {
    terbuka: { type: Boolean, default: false },
    judul: { type: String, default: 'Cetak Label' },
    daftarLabel: { type: Array, default: () => [] }
  },
  emits: ['tutup', 'cetak'],
  setup(props, { emit }) {
    const tampilNama = ref(true);
    const tampilInfo = ref(true);
    const jumlahSalinan = ref(1);

    function tutup() { emit('tutup'); }

    function cetakSekarang() {
      if (!props.daftarLabel.length) return;
      const salinan = Math.max(1, parseInt(jumlahSalinan.value) || 1);
      let labelsHtml = '';
      for (const l of props.daftarLabel) {
        const qrHtml = l.qrDataUrl
          ? `<img src="${l.qrDataUrl}" alt="QR ${l.kode}">`
          : `<div style="font-size:9px;">(QR gagal dibuat)</div>`;
        const satuLabel = `
          <div class="label-cetak">
            <div class="qr">${qrHtml}</div>
            <div class="teks">
              <div class="kode">${l.kode}</div>
              ${(tampilNama.value && l.nama) ? `<div class="nama">${l.nama}</div>` : ''}
              ${(tampilInfo.value && l.info) ? `<div class="info">${l.info}</div>` : ''}
            </div>
          </div>`;
        for (let s = 0; s < salinan; s++) labelsHtml += satuLabel;
      }
      const w = window.open('', '_blank');
      if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak label.'); return; }
      w.document.write(`<html><head><title>${props.judul}</title>
        <style>
          @page { size: 4in 2in; margin: 0; }
          *{ box-sizing:border-box; }
          body{ font-family:Arial,sans-serif; margin:0; }
          .label-cetak{ width:4in; height:2in; padding:0.22in; display:flex; align-items:center; gap:0.2in; page-break-after:always; }
          .label-cetak:last-child{ page-break-after:auto; }
          .qr{ width:1.5in; height:1.5in; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
          .qr img{ width:100%; height:100%; display:block; }
          .teks{ font-size:12px; line-height:1.35; min-width:0; overflow:hidden; }
          .kode{ font-weight:700; font-size:17px; margin-bottom:4px; word-break:break-all; }
          .nama{ font-size:13px; }
          .info{ font-size:11px; color:#555; margin-top:2px; }
        </style>
        </head><body>
        ${labelsHtml}
        <script>
          window.onload = function() { setTimeout(function () { window.print(); }, 300); };
        <\/script>
        </body></html>`);
      w.document.close();
      emit('cetak', { jumlahSalinan: salinan, tampilNama: tampilNama.value, tampilInfo: tampilInfo.value });
      emit('tutup');
    }

    return { tampilNama, tampilInfo, jumlahSalinan, tutup, cetakSekarang };
  },
  template: `
    <div v-if="terbuka" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutup">
      <div class="gc-card" style="max-width:420px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:4px;">{{ judul }}</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:14px;">Pratinjau label ukuran 4x2 inch (thermal roll) &mdash; 1 label = 1 lembar fisik. Atur data yang mau tampil &amp; jumlah salinan sebelum cetak.</p>

        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px; max-height:260px; overflow-y:auto;">
          <div v-for="(l, i) in daftarLabel.slice(0,3)" :key="i" style="width:200px; height:100px; border:1.5px dashed var(--line); border-radius:6px; padding:10px; display:flex; align-items:center; gap:10px; background:#fff; margin:0 auto; box-sizing:border-box;">
            <img v-if="l.qrDataUrl" :src="l.qrDataUrl" style="width:56px; height:56px; flex-shrink:0;">
            <div v-else style="width:56px; height:56px; flex-shrink:0; background:var(--ivory-dim); border-radius:4px;"></div>
            <div style="min-width:0; overflow:hidden;">
              <div style="font-weight:700; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#222;">{{ l.kode }}</div>
              <div v-if="tampilNama && l.nama" style="font-size:10.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#222;">{{ l.nama }}</div>
              <div v-if="tampilInfo && l.info" style="font-size:9.5px; color:#777; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" v-html="l.info"></div>
            </div>
          </div>
          <div v-if="daftarLabel.length > 3" style="text-align:center; font-size:11px; color:var(--text-faint);">+ {{ daftarLabel.length - 3 }} label lainnya ikut dicetak</div>
          <div v-if="daftarLabel.length === 0" style="text-align:center; font-size:11px; color:var(--text-faint); padding:12px;">Belum ada label dipilih.</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;"><input type="checkbox" v-model="tampilNama" style="accent-color:var(--burgundy); width:15px; height:15px;">Tampilkan Nama Barang</label>
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;"><input type="checkbox" v-model="tampilInfo" style="accent-color:var(--burgundy); width:15px; height:15px;">Tampilkan Info (qty/tanggal)</label>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Jumlah Salinan per Label</label>
            <input v-model.number="jumlahSalinan" type="number" min="1" style="max-width:100px;">
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          <button @click="cetakSekarang" :disabled="daftarLabel.length===0" class="btn-primary" style="flex:1;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Sekarang ({{ daftarLabel.length * (jumlahSalinan||1) }} label)</button>
          <button @click="tutup" type="button" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};
