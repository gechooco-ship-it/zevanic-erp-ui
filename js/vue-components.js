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
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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

    // PENERAPAN NYATA Config Akses — komponen ini dipakai buat 9 kategori
    // Master Data sekaligus, SEMUANYA di bawah menu "config_karyawan".
    // Cek 1 kali di sini, otomatis berlaku ke semuanya. Fallback aman:
    // kalau belum diatur (null), dianggap boleh.
    const bolehTambah = computed(() => window.cekIzinMenu('config_karyawan', 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('config_karyawan', 'delete') !== false);

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

    return { items, inputBaru, memuat, menyimpan, tambah, hapus, bolehTambah, bolehHapus };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:10px;">{{ label }}</h4>
      <div v-if="bolehTambah" style="display:flex; gap:8px; margin-bottom:10px;">
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
          <button v-if="bolehHapus" @click="hapus(item)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:11px;"><i class="fas fa-times"></i></button>
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
// daftarMenuGroups(role) — REGISTRY MENU TERPUSAT. Satu sumber kebenaran
// untuk struktur "menu apa masuk grup apa, siapa boleh lihat, dan aksinya
// pindah ke mana" — dipakai Home mobile (js/vue-home.js) sekarang, dan bisa
// dipakai ulang untuk desktop nanti kalau strukturnya mau disamakan (sesuai
// arahan: "kalau ada yg bisa jadi function bersama vue, hajar update
// component"). Ubah/tambah menu di SINI SATU TEMPAT SAJA, otomatis
// ke-reflect di semua tempat yang memakai fungsi ini.
// ---------------------------------------------------------------------------
export function daftarMenuGroups(role) {
  const r = (role || 'operator').toLowerCase();
  const semuaGroup = [
    {
      nama: 'Absensi',
      roleBoleh: ['pic', 'admin', 'owner', 'superuser'],
      items: [
        { label: 'Antrean Absensi', menuId: 'antrean_absensi', icon: 'fa-clipboard-check', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-accept', null); } },
        { label: 'Riwayat All Absensi', menuId: 'riwayat_absensi', icon: 'fa-clock-rotate-left', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-rekap', null); } },
        { label: 'Penjadwalan', menuId: 'penjadwalan', icon: 'fa-calendar-days', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-jadwal', null); } },
        { label: 'Config', menuId: 'config_absensi', icon: 'fa-gear', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-config', null); } }
      ]
    },
    {
      nama: 'Master Karyawan',
      roleBoleh: ['owner', 'superuser'],
      items: [
        { label: 'Antrean Dakar', menuId: 'antrean_dakar', icon: 'fa-user-clock', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-antrean', null); } },
        { label: 'Daftar Karyawan', menuId: 'daftar_karyawan', icon: 'fa-users', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-data', null); } },
        { label: 'Slip Gaji', menuId: 'slip_gaji', icon: 'fa-file-invoice-dollar', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-slip', null); } },
        { label: 'Payroll', menuId: 'payroll', icon: 'fa-money-check-dollar', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-payroll', null); } },
        { label: 'Config Karyawan', menuId: 'config_karyawan', icon: 'fa-sliders', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-config', null); } },
        { label: 'Config Info', menuId: 'config_info', icon: 'fa-bullhorn', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-info', null); } },
        // Hak Akses & Config Akses SENGAJA dikunci Owner asli saja (lihat
        // roleBoleh per-item di bawah) — Superuser tetap lihat 5 item lain
        // di grup ini, tapi bukan 2 ini, konsisten dengan gerbang yang
        // sudah ada di auth.js/index.html.
        { label: 'Hak Akses', menuId: 'hak_akses', icon: 'fa-user-shield', roleBoleh: ['owner'], aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-hakakses', null); } },
        { label: 'Config Akses', menuId: 'config_akses', icon: 'fa-shield-halved', roleBoleh: ['owner'], aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-akses', null); } }
      ]
    },
    {
      nama: 'Whatsapp',
      roleBoleh: ['owner', 'superuser'],
      items: [
        { label: 'Monitoring Respon', menuId: 'whatsapp_gateway', icon: 'fa-chart-line', aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('monitor'); } },
        { label: 'Template Pesan', menuId: 'whatsapp_gateway', icon: 'fa-comment-dots', aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('template'); } },
        { label: 'Config API', menuId: 'whatsapp_gateway', icon: 'fa-plug', aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('config'); } }
      ]
    }
  ];

  // PERUBAHAN 17 Agt 2026 (khusus tampilan Home mobile): dulu grup/menu
  // yang tidak boleh diakses role ini langsung DIHILANGKAN dari daftar.
  // Sekarang SEMUA grup & menu tetap DITAMPILKAN untuk siapapun — item
  // yang sebenarnya tidak boleh diakses cuma ditandai `terkunci: true`,
  // dan pengecekannya PAKAI ROLE YANG SUDAH ADA DI MEMORI (parameter
  // `role` ini, dari window.currentUser.role) — BUKAN baca Firestore lagi,
  // supaya tetap hemat. Halaman pemanggil (vue-home.js) yang tampilkan
  // pesan "Akses terkunci" kalau item.terkunci true saat diklik.
  // PERUBAHAN 17 Agt 2026: dulu grup/menu yang tidak boleh diakses role
  // ini langsung DIHILANGKAN dari daftar. Sekarang SEMUA grup & menu
  // tetap DITAMPILKAN untuk siapapun — item yang tidak boleh diakses
  // cuma ditandai `terkunci: true`.
  //
  // PENERAPAN NYATA Config Akses (17 Agt 2026, tahap 1): status terkunci
  // sekarang CEK IZIN 'view' SUNGGUHAN dari akses_config lewat
  // window.cekIzinMenu(menuId, 'view') — bukan cuma tebakan roleBoleh
  // hardcode lagi. Kalau izin BELUM DIATUR untuk role ini (hasilnya
  // null, misal role itu belum pernah dibuka di Config Akses sama
  // sekali), JATUH KEMBALI ke logic roleBoleh lama sebagai jaring
  // pengaman — supaya tidak ada yang tiba-tiba terkunci keluar cuma
  // karena admin belum sempat atur Config Akses buat role itu.
  return semuaGroup.map(g => ({
    ...g,
    items: g.items.map(i => {
      const izinAsli = i.menuId ? window.cekIzinMenu(i.menuId, 'view') : null;
      const terkunciFallback = !((!g.roleBoleh || g.roleBoleh.includes(r)) && (!i.roleBoleh || i.roleBoleh.includes(r)));
      return {
        ...i,
        terkunci: izinAsli === null ? terkunciFallback : !izinAsli
      };
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
          <div style="padding:14px; display:flex; gap:12px;">
            <div v-if="!p.mediaUrl" style="width:38px; height:38px; border-radius:10px; background:var(--blue); flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#1F5060;"><i class="fas fa-bell"></i></div>
            <div>
              <b style="font-size:13px;">{{ p.judul }}</b>
              <p style="font-size:12px; color:var(--text-muted); margin-top:3px;">{{ p.isi }}</p>
            </div>
          </div>
        </div>
      </div>
      <div v-if="daftar.length > 1" style="display:flex; justify-content:center; gap:6px; margin-top:10px;">
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
    <div v-if="!memuat && quote" style="background:linear-gradient(135deg, var(--pink), var(--blue)); border-radius:18px; padding:16px; margin-bottom:22px; position:relative; overflow:hidden;">
      <div style="position:absolute; right:-20px; bottom:-20px; width:100px; height:100px; border-radius:50%; background:rgba(255,255,255,.25);"></div>
      <div style="position:relative; z-index:1;">
        <h4 class="gc-heading" style="font-size:14px; font-weight:700; color:var(--mahogany); display:flex; align-items:center; gap:8px;"><i class="fas fa-quote-left"></i> {{ quote.judul }}</h4>
        <p style="font-size:12.5px; color:var(--mahogany-soft); margin-top:6px; line-height:1.5;">{{ quote.isi }}</p>
      </div>
    </div>
  `
};
