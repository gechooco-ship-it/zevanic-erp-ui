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
import { ref, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ---------------------------------------------------------------------------
// MasterDataCategory — kartu 1 kategori Master Data (tambah/lihat/hapus item).
// Baca data (termasuk seeding default kalau belum ada) tetap lewat
// window.ambilMasterList supaya SATU sumber logic dipakai bareng dengan
// bagian aplikasi yang belum dimigrasi (Antrean Dakar, Edit Karyawan, dll).
// ---------------------------------------------------------------------------
export const MasterDataCategory = {
  props: {
    kategori: { type: String, required: true },
    label: { type: String, required: true }
  },
  setup(props) {
    const items = ref([]);
    const inputBaru = ref('');
    const memuat = ref(true);
    const menyimpan = ref(false);

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
      const nilai = inputBaru.value.trim();
      if (!nilai) return;
      if (items.value.includes(nilai)) { alert('Item ini sudah ada di daftar.'); return; }
      items.value.push(nilai);
      inputBaru.value = '';
      await simpanKeFirestore();
    }

    async function hapus(nilai) {
      items.value = items.value.filter(i => i !== nilai);
      await simpanKeFirestore();
    }

    onMounted(muat);

    return { items, inputBaru, memuat, menyimpan, tambah, hapus };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:10px;">{{ label }}</h4>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah item baru..." style="flex:1; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:8px 14px;">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else style="display:flex; flex-wrap:wrap; gap:6px;">
        <span v-if="items.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada data.</span>
        <span v-for="item in items" :key="item" class="tag neutral" style="gap:8px;">
          {{ item }}
          <button @click="hapus(item)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:11px;"><i class="fas fa-times"></i></button>
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

    onMounted(muat);
    return { daftarGudang, memuat, toggle };
  },
  template: `
    <div style="display:flex; flex-wrap:wrap; gap:8px; padding:10px; background:var(--surface); border:1.5px solid var(--line); border-radius:12px; min-height:44px;">
      <span v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat gudang...</span>
      <span v-else-if="daftarGudang.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada Master Gudang. Buat dulu di Config Absensi.</span>
      <label v-for="g in daftarGudang" :key="g" style="display:flex; align-items:center; gap:7px; background:var(--ivory-dim); border-radius:10px; padding:7px 12px; font-size:12px; cursor:pointer; transition:.15s;">
        <input type="checkbox" :checked="modelValue.includes(g)" @change="toggle(g, $event.target.checked)" style="accent-color:var(--burgundy); width:14px; height:14px;">
        <span>{{ g }}</span>
      </label>
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
    onMounted(async () => { await muatKabupaten(); await muatKecamatan(); });

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
