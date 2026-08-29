// js/vue-menu-lengkap.js
// ============================================================================
// Layar BARU (redesain "Gechoo Mobile Organic", README.md §2) — "Menu
// Lengkap": semua modul (dari daftarMenuGroups(), SATU sumber kebenaran
// yang sama dipakai Beranda & Config Akses) dalam 1 layar bisa dicari.
// Diakses lewat tombol "Lihat Semua Menu (N)" di Beranda (js/vue-home.js)
// dan tombol "Lihat Semua (n)" di grup Beranda kalau grup itu py kartu
// tersembunyi. Tab: 'tab-menu-lengkap' (lihat index.html + dashboard.js
// petaMount, tidak perlu mount-on-demand khusus karena datanya sudah ada
// di memori lewat daftarMenuGroups(), TIDAK ada baca Firestore baru selain
// 1x getDoc urutan_menu_home yang sama seperti Beranda).
//
// Pencarian: client-side, case-INsensitive, "contains" (bukan prefix-match
// peka huruf besar/kecil seperti pola "Daftar modul" — itu batasan
// Firestore prefix-query untuk data SERVER, sedangkan di sini murni filter
// array 35 modul yang SUDAH ada di memori, jadi tidak ada alasan teknis
// untuk ikut batasan yang sama; UX lebih enak kalau longgar).
// ============================================================================
import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { daftarMenuGroups, KartuMenu, AksesTerbatasDialog, HeaderLayar, KolomCari } from './vue-components.js?v=5';

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

      <akses-terbatas-dialog v-if="dialogTerkunciModul" :nama-modul="dialogTerkunciModul.label" @tutup="dialogTerkunciModul = null" />
    </div>
  `
};

const mountPoint = document.getElementById('vue-menu-lengkap');
if (mountPoint) createApp(AppMenuLengkap).mount('#vue-menu-lengkap');
