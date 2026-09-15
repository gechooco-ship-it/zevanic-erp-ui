// js/vue-home.js
// tab-home mobile — kartu shift, Clock In/Out + statistik, Favorit Saya,
// maksimal 4 grup menu, tombol Menu Lengkap, banner. Beranda dikunci satu layar
// (tidak scroll panjang).
//
// Koleksi & field:
// - pengaturan_sistem/urutan_menu_home: perKategori + urutanKategori, dipakai
//   daftarMenuGroups untuk mengurutkan grid menu (1x getDoc per muat).
// - master_shift: dicocokkan ke window.currentUser.nama_shift untuk kartu shift.
// - users/{email} dibaca lewat window.currentUser: menu_favorit (maks 4 id),
//   beranda_grup_urutan (ambil 4 pertama), beranda_batas_kartu.
//
// Jebakan:
// - Layar ini hanya MEMBACA preferensi; yang menulis menu_favorit dan
//   beranda_* adalah vue-atur-favorit.js.
// - Icon + aksi tiap kartu menu berasal dari DAFTAR_MENU (vue-config-akses.js)
//   lewat daftarMenuGroups — jangan menyalin daftar menu ke file ini.
// - Kartu Statistik (hari kerja/kehadiran/peringkat) sengaja menampilkan "–"
//   karena query pendukungnya belum ada; jangan diisi angka contoh.
// - Durasi kerja berjalan dibaca dari localStorage jam clock-in, bukan Firestore.

import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// KartuMenu & AksesTerbatasDialog ada di file yang sama dengan daftarMenuGroups.
import { daftarMenuGroups, KartuMenu, AksesTerbatasDialog } from './vue-components.js?v=13';

const AppHome = {
  components: { KartuMenu, AksesTerbatasDialog },
  setup() {
    const shift = reactive({ nama: '', jamMasuk: '', jamKeluar: '', gudang: '' });
    const sudahAbsenHariIni = ref(false);
    const menuGroups = ref([]);
    const detailShiftTerbuka = ref(false);
    // Durasi kerja berjalan — murni baca localStorage (jam clock-in TERSIMPAN di
    // perangkat) + jam sekarang, diperbarui tiap detik.
    const jamMasukAsli = ref('');
    const durasiBerjalan = ref('');
    let timerDurasi = null;

    function formatJam(d) {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    function mulaiHitungDurasi() {
      if (timerDurasi) clearInterval(timerDurasi);
      const tersimpan = localStorage.getItem('zevanic_jam_masuk_' + (window.currentUser?.email || ''));
      if (!tersimpan) { jamMasukAsli.value = ''; durasiBerjalan.value = ''; return; }
      const waktuMasuk = new Date(tersimpan);
      jamMasukAsli.value = formatJam(waktuMasuk);
      function tik() {
        const selisihMs = Date.now() - waktuMasuk.getTime();
        const totalDetik = Math.max(0, Math.floor(selisihMs / 1000));
        const j = Math.floor(totalDetik / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalDetik % 3600) / 60).toString().padStart(2, '0');
        const d = (totalDetik % 60).toString().padStart(2, '0');
        durasiBerjalan.value = `${j}:${m}:${d}`;
      }
      tik();
      timerDurasi = setInterval(tik, 1000);
    }

    // Urutan menu per kategori (Owner, Config Akses > Urutan Menu Home) — TIDAK
    // berubah dari versi lama.
    async function ambilUrutanKustom() {
      try {
        const snap = await getDoc(doc(db, 'pengaturan_sistem', 'urutan_menu_home'));
        if (!snap.exists()) return { perKategori: {}, urutanKategori: [] };
        const data = snap.data();
        return { perKategori: data.perKategori || {}, urutanKategori: data.urutanKategori || [] };
      } catch (e) {
        console.error('Gagal muat urutan menu Home mobile:', e);
        return { perKategori: {}, urutanKategori: [] };
      }
    }

    async function muatTampilan() {
      const status = await window.cekStatusClockInSaya(window.currentUser?.email || '');
      sudahAbsenHariIni.value = status.aktif;
      const { perKategori: urutanKustom, urutanKategori: urutanKatKustom } = await ambilUrutanKustom();
      menuGroups.value = daftarMenuGroups(window.currentUser?.role, urutanKustom, urutanKatKustom);
      const semuaId = new Set(menuGroups.value.flatMap(g => g.items.map(i => i.menuId)));
      favoritIds.value = favoritIds.value.filter(id => semuaId.has(id));
      const gudangList = window.normalisasiGudang ? window.normalisasiGudang(window.currentUser?.gudang_penempatan) : [];
      shift.gudang = gudangList.length > 0 ? gudangList.join(', ') : '-';
      mulaiHitungDurasi();
    }

    async function muatShift() {
      try {
        const namaShift = window.currentUser?.nama_shift;
        if (!namaShift) return;
        const snap = await getDocs(collection(db, "master_shift"));
        snap.forEach(d => {
          const s = d.data();
          if (s.nama_shift === namaShift) {
            shift.nama = s.nama_shift;
            shift.jamMasuk = s.jam_masuk || '';
            shift.jamKeluar = s.jam_keluar || '';
          }
        });
      } catch (e) {
        console.error("Gagal muat shift:", e);
      }
    }

    function klikClockInOut() {
      if (sudahAbsenHariIni.value) {
        if (window.prosesClockOut) window.prosesClockOut();
        return;
      }
      window.statusPilihanGlobal = "HADIR (CLOCK IN)";
      window.pindahLayar('screen-camera');
    }

    // Favorit
    // Saya — data TETAP field users/{email}.menu_favorit (maks 4), TIDAK berubah
    // dari versi lama. Yang berubah cuma UI pemilihnya (pindah ke layar Atur
    // Favorit, lihat header file).

    const favoritIds = ref([]);
    const semuaItemFlat = computed(() => menuGroups.value.flatMap(g => g.items));
    const daftarFavorit = computed(() =>
      favoritIds.value.map(id => semuaItemFlat.value.find(i => i.menuId === id)).filter(Boolean)
    );

    function bukaAturFavorit() {
      if (window.pindahTab) window.pindahTab('tab-atur-favorit', null, false);
    }

    // Grup menu di Beranda: maksimal 4 grup, diambil dari
    // users/{email}.beranda_grup_urutan (urutan preferensi user lewat Atur
    // Favorit); kalau belum pernah diatur, pakai 4 grup pertama menurut urutan
    // Owner. Jumlah kartu per grup dari beranda_batas_kartu, sama rata semua grup.

    const grupTampilList = computed(() => {
      if (menuGroups.value.length === 0) return [];
      const pilihan = Array.isArray(window.currentUser?.beranda_grup_urutan) ? window.currentUser.beranda_grup_urutan : [];
      const dipilih = pilihan.map(nama => menuGroups.value.find(g => g.nama === nama)).filter(Boolean);
      if (dipilih.length > 0) return dipilih.slice(0, 4);
      return menuGroups.value.slice(0, 4);
    });
    const batasKartuGrup = computed(() => {
      const n = Number(window.currentUser?.beranda_batas_kartu);
      return (Number.isFinite(n) && n >= 2 && n <= 8) ? n : 4;
    });
    function itemsGrupTampil(grup) { return grup.items.slice(0, batasKartuGrup.value); }
    const totalModul = computed(() => semuaItemFlat.value.length);

    // Dialog
    // "Akses Terbatas" bergaya (README "Interactions") — GANTI alert polos.
    // Modul terkunci TIDAK dibuka.

    const dialogTerkunciModul = ref(null); // { label } | null
    function klikMenu(item) {
      if (item.terkunci) { dialogTerkunciModul.value = item; return; }
      item.aksi();
    }

    function bukaMenuLengkap() {
      if (window.pindahTab) window.pindahTab('tab-menu-lengkap', null, false);
    }

    async function muatSemua() {
      favoritIds.value = Array.isArray(window.currentUser?.menu_favorit) ? window.currentUser.menu_favorit.slice(0, 4) : [];
      await muatTampilan();
      await muatShift();
    }

    // CUMA muat kalau window.currentUser SUDAH ada (navigasi dalam SPA); kalau
    // belum, biarkan window.refreshHome (dipanggil auth.js/vue-login.js) yang
    // memuat begitu data lengkap.
    onMounted(async () => {
      await window.authReady;
      if (window.currentUser && window.currentUser.email) {
        await muatSemua();
      }
    });
    onUnmounted(() => { if (timerDurasi) clearInterval(timerDurasi); });

    return {
      shift, sudahAbsenHariIni, menuGroups, detailShiftTerbuka,
      jamMasukAsli, durasiBerjalan,
      klikClockInOut, klikMenu,
      muatTampilan, muatSemua,
      daftarFavorit, bukaAturFavorit,
      grupTampilList, itemsGrupTampil, totalModul, bukaMenuLengkap,
      dialogTerkunciModul
    };
  },
  template: `
    <div class="gc-gradien-atas" style="margin:-12px -20px 0; padding:12px 20px 2px;">
      <!-- Baris sapaan + lonceng + avatar: lihat js/vue-header-mobile.js (mode 'home') -->

      <!-- Kartu shift -->
      <div class="gc-card gc-kartu-gradien" v-if="shift.nama" style="border-radius:24px; padding:12px 15px; margin-top:6px;">
        <div style="position:absolute; right:-34px; top:-24px; width:160px; height:160px; border-radius:50%; border:1px solid rgba(var(--tinta-gradien-rgb),.13);"></div>
        <div style="position:absolute; right:2px; top:8px; width:100px; height:100px; border-radius:50%; border:1px solid rgba(var(--tinta-gradien-rgb),.16);"></div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:1;">
          <div>
            <p style="font-size:11px; color:var(--tinta-gradien); opacity:.85; margin:0;">Shift hari ini:</p>
            <p class="gc-heading" style="font-size:12px; font-weight:600; margin:2px 0 0; color:var(--tinta-gradien);">{{ shift.gudang }}</p>
            <p class="gc-heading gc-num" style="font-size:21px; font-weight:700; margin:2px 0 0; color:var(--tinta-gradien);">{{ shift.jamMasuk }} &ndash; {{ shift.jamKeluar }}</p>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:7px;">
            <span class="gc-pil-status">
              <i class="fas" :class="sudahAbsenHariIni ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
              {{ sudahAbsenHariIni ? 'Sudah absen masuk' : 'Belum absen masuk' }}
            </span>
            <button @click="detailShiftTerbuka = true" style="background:none; border:none; padding:0; cursor:pointer; font-size:9.5px; font-weight:600; color:var(--tinta-gradien); opacity:.85; display:flex; align-items:center; gap:3px;">
              Detail Shift <i class="fas fa-chevron-right" style="font-size:9px;"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Baris Clock in + statistik -->
      <div style="display:flex; gap:10px; margin:10px 0 8px;">
        <button @click="klikClockInOut" style="flex:0 0 42%; background:var(--aksen-lembut); border:none; border-radius:18px; padding:10px 12px; display:flex; align-items:center; gap:9px; cursor:pointer; position:relative; overflow:hidden; text-align:left;">
          <div style="position:absolute; right:-14px; bottom:-14px; width:88px; height:88px; border-radius:50%; background:var(--surface); opacity:.5;"></div>
          <div style="position:relative; z-index:1; min-width:0;">
            <p class="gc-heading" style="font-size:14px; font-weight:700; color:var(--aksen-ink); margin:0;">{{ sudahAbsenHariIni ? 'Clock out' : 'Clock in' }}</p>
            <p style="font-size:9.5px; color:var(--text-muted); margin:2px 0 0;">{{ sudahAbsenHariIni ? 'Akhiri shift hari ini' : 'Mulai shift hari ini' }}</p>
          </div>
          <span style="position:relative; z-index:1; width:38px; height:38px; border-radius:50%; background:var(--surface); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas" :class="sudahAbsenHariIni ? 'fa-right-from-bracket' : 'fa-fingerprint'" style="font-size:16px; color:var(--aksen-ink);"></i></span>
        </button>
        <div class="gc-kartu-statistik">
          <div>
            <i class="fas fa-calendar-day" style="font-size:19px; color:var(--aksen-ink);"></i>
            <p class="gc-heading gc-num" style="font-size:15px; font-weight:700; margin:4px 0 0;">–</p>
            <p style="font-size:9px; color:var(--text-muted); margin:1px 0 0; white-space:nowrap;">Hari kerja</p>
          </div>
          <div>
            <i class="fas fa-chart-simple" style="font-size:19px; color:var(--aksen-ink);"></i>
            <p class="gc-heading gc-num" style="font-size:15px; font-weight:700; margin:4px 0 0;">–</p>
            <p style="font-size:9px; color:var(--text-muted); margin:1px 0 0; white-space:nowrap;">Kehadiran</p>
          </div>
          <div>
            <i class="fas fa-trophy" style="font-size:19px; color:var(--aksen-ink);"></i>
            <p class="gc-heading gc-num" style="font-size:15px; font-weight:700; margin:4px 0 0;">–</p>
            <p style="font-size:9px; color:var(--text-muted); margin:1px 0 0; white-space:nowrap;">Peringkat</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Favorit Saya — tombol Clock in/out tidak dipasang tetap di grid ini (sudah ada jalan
      pintas di baris Clock in + statistik di atas), tapi tetap bisa muncul kalau user memilihnya
      lewat Atur Favorit. Grid maksimal 4, persis isi favoritIds. -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:7px;">
      <h3 class="gc-heading" style="font-size:10px; font-weight:700; margin:0; color:var(--text-muted); text-transform:uppercase; letter-spacing:.09em;"><i class="fas fa-star" style="margin-right:6px; color:var(--aksen-ink);"></i>Favorit Saya</h3>
      <button @click="bukaAturFavorit" style="background:none; border:none; color:var(--text-muted); font-weight:600; font-size:10px; cursor:pointer; padding:4px 2px; display:flex; align-items:center; gap:4px;">Atur Favorit <i class="fas fa-gear" style="font-size:13px;"></i></button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-bottom:13px;">
      <kartu-menu v-for="item in daftarFavorit" :key="item.menuId" :item="item" @klik="klikMenu" />
    </div>

    <!-- Lihat Semua Menu — DIPINDAH ke sini, tepat di bawah Favorit Saya ( -->
    <button @click="bukaMenuLengkap" class="gc-card" style="width:100%; min-height:48px; border-radius:999px; padding:3px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; margin-bottom:14px;">
      <i class="fas fa-grip" style="font-size:16px; color:var(--aksen-ink);"></i>
      <span class="gc-heading" style="font-size:12px; font-weight:600; color:var(--aksen-ink);">Lihat Semua Menu ({{ totalModul }})</span>
    </button>

    <!-- Grup menu default — -->
    <div v-for="grup in grupTampilList" :key="grup.nama" style="margin-bottom:8px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:7px;">
        <h3 class="gc-heading" style="font-size:10px; font-weight:700; margin:0; color:var(--text-muted); text-transform:uppercase; letter-spacing:.09em;">{{ grup.nama }}</h3>
        <button v-if="grup.items.length > itemsGrupTampil(grup).length" @click="bukaMenuLengkap" style="background:none; border:none; color:var(--text-muted); font-weight:600; font-size:10px; cursor:pointer;">Lihat Semua ({{ grup.items.length }})</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:7px;">
        <kartu-menu v-for="item in itemsGrupTampil(grup)" :key="item.menuId" :item="item" @klik="klikMenu" />
      </div>
    </div>

    <!-- Banner motivasi -->
    <div class="gc-kartu-gradien" style="border-radius:24px; padding:12px; display:flex; align-items:flex-end; gap:12px; margin-bottom:16px;">
      <div style="position:absolute; right:-30px; bottom:-30px; width:150px; height:150px; border-radius:50%; background:rgba(var(--tinta-gradien-rgb),.09);"></div>
      <div style="position:relative; z-index:1; flex:1;">
        <h4 class="gc-heading" style="font-size:17px; font-weight:700; line-height:1.25; margin:0; color:var(--tinta-gradien);">Kerja rapi,<br>hasil maksimal.</h4>
        <p style="font-size:11px; color:var(--tinta-gradien); opacity:.85; margin:5px 0 10px;">Cek panduan kerja & SOP terbaru Zevanic House.</p>
      </div>
      <span style="position:relative; z-index:1; width:60px; height:60px; border-radius:50%; background:rgba(var(--tinta-gradien-rgb),.16); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-medal" style="font-size:24px; color:var(--tinta-gradien);"></i></span>
    </div>

    <!-- Dialog Detail Shift -->
    <div v-if="detailShiftTerbuka" class="gc-dialog-backdrop" @click="detailShiftTerbuka = false">
      <div class="gc-dialog" @click.stop style="text-align:left;">
        <h3 class="gc-heading" style="font-size:15px; font-weight:700; margin:0 0 14px; text-align:center;">Detail Shift</h3>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid var(--line);"><span style="font-size:11px; color:var(--text-muted);">Nama shift</span><span class="gc-heading" style="font-size:11.5px; font-weight:600;">{{ shift.nama || '-' }}</span></div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid var(--line);"><span style="font-size:11px; color:var(--text-muted);">Gudang</span><span class="gc-heading" style="font-size:11.5px; font-weight:600;">{{ shift.gudang || '-' }}</span></div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid var(--line);"><span style="font-size:11px; color:var(--text-muted);">Jam masuk</span><span class="gc-heading gc-num" style="font-size:11.5px; font-weight:600;">{{ shift.jamMasuk || '-' }}</span></div>
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); margin-bottom:16px;"><span style="font-size:11px; color:var(--text-muted);">Jam keluar</span><span class="gc-heading gc-num" style="font-size:11.5px; font-weight:600;">{{ shift.jamKeluar || '-' }}</span></div>
        <button @click="detailShiftTerbuka = false" class="btn-primary" style="border-radius:999px;">Tutup</button>
      </div>
    </div>

    <akses-terbatas-dialog v-if="dialogTerkunciModul" :nama-modul="dialogTerkunciModul.label" :menu-id="dialogTerkunciModul.menuId" @tutup="dialogTerkunciModul = null" />
  `
};

const mountPoint = document.getElementById('vue-home');
if (mountPoint) {
  const vm = createApp(AppHome).mount('#vue-home');
  window.refreshHome = function() { vm.muatSemua(); };
}
