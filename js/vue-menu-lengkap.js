// js/vue-menu-lengkap.js
// Komponen AppMenuLengkap — layar "Menu Lengkap": seluruh modul dari
// daftarMenuGroups (vue-components.js) dalam satu layar yang bisa dicari.
// Mount ke #vue-menu-lengkap, tab 'tab-menu-lengkap'.
//
// Koleksi & field:
// - pengaturan_sistem/urutan_menu_home: 1x getDoc untuk kategori dan urutan
//   kartu, sama seperti Beranda. Tidak ada baca Firestore lain — daftar
//   modulnya sudah ada di memori.
//
// Jebakan:
// - daftarMenuGroups satu-satunya sumber kebenaran daftar modul, dipakai
//   bersama Beranda dan Config Akses; menambah modul di sini saja tidak cukup.
// - Pencarian client-side, case-insensitive, "contains" — sengaja lebih longgar
//   daripada prefix-query Firestore yang dipakai layar berbasis server.
// - Modul terkunci tidak disembunyikan: tetap tampil lalu memunculkan
//   AksesTerbatasDialog saat diklik.

import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { daftarMenuGroups, KartuMenu, AksesTerbatasDialog, HeaderLayar, KolomCari } from './vue-components.js?v=13';

const AppMenuLengkap = {
  components: { KartuMenu, AksesTerbatasDialog, HeaderLayar, KolomCari },
  setup() {
    const menuGroups = ref([]);
    const cari = ref('');
    const dialogTerkunciModul = ref(null);
    const memuat = ref(true);

    async function ambilUrutanKustom() {
      try {
        const snap = await getDoc(doc(db, 'pengaturan_sistem', 'urutan_menu_home'));
        if (!snap.exists()) return { perKategori: {}, urutanKategori: [] };
        const data = snap.data();
        return { perKategori: data.perKategori || {}, urutanKategori: data.urutanKategori || [] };
      } catch (e) {
        console.error('Gagal muat urutan menu:', e);
        return { perKategori: {}, urutanKategori: [] };
      }
    }

    async function muat() {
      memuat.value = true;
      const { perKategori, urutanKategori } = await ambilUrutanKustom();
      menuGroups.value = daftarMenuGroups(window.currentUser?.role, perKategori, urutanKategori);
      memuat.value = false;
    }

    const grupTersaring = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      if (!kata) return menuGroups.value;
      return menuGroups.value
        .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(kata)) }))
        .filter(g => g.items.length > 0);
    });
    const totalHasil = computed(() => grupTersaring.value.reduce((n, g) => n + g.items.length, 0));

    function klikMenu(item) {
      if (item.terkunci) { dialogTerkunciModul.value = item; return; }
      item.aksi();
    }

    onMounted(async () => { await window.authReady; muat(); });

    return { menuGroups, cari, grupTersaring, totalHasil, klikMenu, dialogTerkunciModul, memuat };
  },
  template: `
    <div class="max-w-xl mx-auto w-full" style="padding-bottom:24px;">
      <header-layar kicker="SEMUA MODUL" judul="Menu Lengkap" tab-pulang="tab-home" />
      <kolom-cari v-model="cari" placeholder="Cari modul..." />

      <div v-if="memuat" style="text-align:center; padding:32px 0; color:var(--text-faint); font-size:11px;">Memuat...</div>

      <div v-else-if="totalHasil === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-magnifying-glass-minus"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Menu tidak ditemukan</h3>
        <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Coba kata kunci lain.</p>
      </div>

      <div v-else v-for="grup in grupTersaring" :key="grup.nama" style="margin-bottom:18px;">
        <h3 class="gc-heading" style="font-size:10px; font-weight:700; margin:0 0 7px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.08em;">{{ grup.nama }}</h3>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:7px;">
          <kartu-menu v-for="item in grup.items" :key="item.menuId" :item="item" @klik="klikMenu" />
        </div>
      </div>

      <akses-terbatas-dialog v-if="dialogTerkunciModul" :nama-modul="dialogTerkunciModul.label" :menu-id="dialogTerkunciModul.menuId" @tutup="dialogTerkunciModul = null" />
    </div>
  `
};

const mountPoint = document.getElementById('vue-menu-lengkap');
if (mountPoint) createApp(AppMenuLengkap).mount('#vue-menu-lengkap');
