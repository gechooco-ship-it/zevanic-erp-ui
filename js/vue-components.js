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
    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
      <h4 class="text-xs font-bold text-gray-700">{{ label }}</h4>
      <div class="flex space-x-2">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah item baru..."
               class="flex-1 px-2.5 py-1.5 bg-gray-50 border rounded-lg text-xs outline-none">
        <button @click="tambah" :disabled="menyimpan"
                class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div v-if="memuat" class="text-[10px] text-gray-400">Memuat...</div>
      <div v-else class="flex flex-wrap">
        <span v-if="items.length === 0" class="text-[10px] text-gray-400">Belum ada data.</span>
        <span v-for="item in items" :key="item"
              class="inline-flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg text-[11px] mr-1.5 mb-1.5">
          {{ item }}
          <button @click="hapus(item)" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button>
        </span>
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
    onMounted(async () => { await muatKabupaten(); await muatKecamatan(); });

    return { daftarKabupaten, kabupatenTerpilih, kecamatanList, inputBaru, memuat, tambah, hapus };
  },
  template: `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
      <h4 class="text-xs font-bold text-gray-700">Kecamatan (per Kabupaten/Kota)</h4>
      <select v-model="kabupatenTerpilih" class="w-full px-2.5 py-1.5 bg-gray-50 border rounded-lg text-xs outline-none mb-1">
        <option v-for="k in daftarKabupaten" :key="k" :value="k">{{ k }}</option>
      </select>
      <div class="flex space-x-2">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah kecamatan untuk kabupaten di atas..."
               class="flex-1 px-2.5 py-1.5 bg-gray-50 border rounded-lg text-xs outline-none">
        <button @click="tambah" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700"><i class="fas fa-plus"></i></button>
      </div>
      <div v-if="memuat" class="text-[10px] text-gray-400">Memuat...</div>
      <div v-else class="flex flex-wrap">
        <span v-if="kecamatanList.length === 0" class="text-[10px] text-gray-400">Belum ada kecamatan untuk kabupaten ini.</span>
        <span v-for="item in kecamatanList" :key="item"
              class="inline-flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-lg text-[11px] mr-1.5 mb-1.5">
          {{ item }}
          <button @click="hapus(item)" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button>
        </span>
      </div>
    </div>
  `
};
