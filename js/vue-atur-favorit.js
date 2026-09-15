// js/vue-atur-favorit.js
// Layar "Atur Favorit": pilih maksimal 4 kartu favorit, lalu atur grup menu
// mana yang tampil di Beranda beserta jumlah kartu per grup.
//
// Koleksi & field:
// - users/{email}: menu_favorit (maks 4 id), beranda_grup_urutan, beranda_grup
//   (grup pertama), beranda_batas_kartu (2-8, default 4) — semuanya per-user.
// - pengaturan_sistem/urutan_menu_home: dibaca saja (perKategori,
//   urutanKategori); file ini tidak pernah menulis ke situ.
//
// Jebakan:
// - Tidak ada tombol Simpan: tiap toggle langsung updateDoc, lalu wajib
//   simpanKonteksSesi() + refreshHome() karena Beranda tidak reaktif otomatis.
// - Maksimal 4 grup tampil di Beranda (BATAS_GRUP_BERANDA); grup ke-5 dan
//   seterusnya tetap tersimpan tapi berlabel "Melewati batas".
// - Daftar modul berasal dari daftarMenuGroups (vue-components.js); modul
//   berlabel terkunci sengaja tidak bisa dijadikan favorit.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { daftarMenuGroups, HeaderLayar, KolomCari } from './vue-components.js?v=13';

// Beranda dikunci maksimal 4 grup menu yang dianggap paling sering dipakai.
// Grup mana saja ditentukan user lewat toggle di Bagian 2 (grupUrutan) — tidak
// ada tracking pemakaian sungguhan. Sisi tampilnya: js/vue-home.js
// grupTampilList.
const BATAS_GRUP_BERANDA = 4;

const AppAturFavorit = {
  components: { HeaderLayar, KolomCari },
  setup() {
    const memuat = ref(true);
    const menuGroups = ref([]);
    const semuaItemFlat = computed(() => menuGroups.value.flatMap(g => g.items));

    // Bagian 1: Kartu favorit
    const cariFavorit = ref('');
    const favoritIds = ref([]);
    const menyimpanFavorit = ref(false);
    const itemTersaring = computed(() => {
      const kata = cariFavorit.value.trim().toLowerCase();
      const semua = semuaItemFlat.value.filter(i => !i.terkunci);
      if (!kata) return semua;
      return semua.filter(i => i.label.toLowerCase().includes(kata));
    });
    const kuotaPenuh = computed(() => favoritIds.value.length >= 4);

    async function toggleFavoritItem(item) {
      const idx = favoritIds.value.indexOf(item.menuId);
      if (idx >= 0) { favoritIds.value.splice(idx, 1); }
      else {
        if (kuotaPenuh.value) return;
        favoritIds.value.push(item.menuId);
      }
      await simpanFavorit();
    }

    async function simpanFavorit() {
      menyimpanFavorit.value = true;
      try {
        await updateDoc(doc(db, 'users', window.currentUser.email), { menu_favorit: favoritIds.value });
        window.currentUser.menu_favorit = [...favoritIds.value];
        if (window.simpanKonteksSesi) window.simpanKonteksSesi();
        // Tidak ada tombol Simpan di layar ini (tiap toggle langsung simpan ke
        // Firestore), tapi Beranda (js/vue-home.js) tidak reaktif ke perubahan
        // window.currentUser — favoritIds di sana dimuat sekali saat mount. Panggil
        // window.refreshHome supaya Beranda sudah sesuai saat user kembali.
        if (window.refreshHome) window.refreshHome();
      } catch (e) {
        console.error('Gagal simpan menu favorit:', e);
        alert('Gagal menyimpan pilihan favorit. Coba lagi.');
      }
      menyimpanFavorit.value = false;
    }

    async function resetFavorit() {
      if (!confirm('Kosongkan semua kartu favorit?')) return;
      favoritIds.value = [];
      await simpanFavorit();
    }

    // Bagian 2: Grup menu di beranda
    const grupUrutan = ref([]); // array nama kategori, urutan preferensi
    const batasKartu = ref(4);
    const menyimpanGrup = ref(false);

    function statusGrup(namaGrup) {
      const idx = grupUrutan.value.indexOf(namaGrup);
      if (idx === -1) return { kelas: 'neutral', teks: 'Disembunyikan' };
      if (idx < BATAS_GRUP_BERANDA) return { kelas: 'ok', teks: 'Tampil di beranda' };
      return { kelas: 'warn', teks: 'Melewati batas' };
    }

    async function toggleGrup(namaGrup) {
      const idx = grupUrutan.value.indexOf(namaGrup);
      if (idx >= 0) grupUrutan.value.splice(idx, 1);
      else grupUrutan.value.push(namaGrup);
      await simpanGrup();
    }

    async function simpanGrup() {
      menyimpanGrup.value = true;
      try {
        const batasAman = Math.max(2, Math.min(8, Number(batasKartu.value) || 4));
        batasKartu.value = batasAman;
        await updateDoc(doc(db, 'users', window.currentUser.email), {
          beranda_grup_urutan: grupUrutan.value,
          beranda_grup: grupUrutan.value[0] || null, // dibaca langsung vue-home.js (grupTampil)
          beranda_batas_kartu: batasAman
        });
        window.currentUser.beranda_grup_urutan = [...grupUrutan.value];
        window.currentUser.beranda_grup = grupUrutan.value[0] || null;
        window.currentUser.beranda_batas_kartu = batasAman;
        if (window.simpanKonteksSesi) window.simpanKonteksSesi();
        // Sama seperti simpanFavorit di atas — paksa Beranda muat ulang grup
        // terbaru, jangan nunggu reload manual.
        if (window.refreshHome) window.refreshHome();
      } catch (e) {
        console.error('Gagal simpan grup beranda:', e);
        alert('Gagal menyimpan pengaturan grup. Coba lagi.');
      }
      menyimpanGrup.value = false;
    }

    async function resetGrup() {
      if (!confirm('Kembalikan ke grup pertama (bawaan)?')) return;
      grupUrutan.value = [];
      batasKartu.value = 4;
      await simpanGrup();
    }

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
      favoritIds.value = Array.isArray(window.currentUser?.menu_favorit) ? window.currentUser.menu_favorit.slice(0, 4) : [];
      grupUrutan.value = Array.isArray(window.currentUser?.beranda_grup_urutan) ? [...window.currentUser.beranda_grup_urutan] : [];
      batasKartu.value = Number(window.currentUser?.beranda_batas_kartu) || 4;
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      memuat, menuGroups,
      cariFavorit, favoritIds, itemTersaring, kuotaPenuh, menyimpanFavorit, toggleFavoritItem, resetFavorit,
      grupUrutan, batasKartu, menyimpanGrup, statusGrup, toggleGrup, simpanGrup, resetGrup
    };
  },
  template: `
    <div class="max-w-xl mx-auto w-full" style="padding-bottom:24px;">
      <header-layar kicker="PENGATURAN" judul="Atur Favorit" tab-pulang="tab-home" />

      <!--
        Indikator loading singkat saat menyimpan; tiap toggle langsung simpan, tidak ada
        tombol Simpan terpisah. simpanFavorit/simpanGrup juga memanggil window.refreshHome.
      -->
      <div v-if="menyimpanFavorit || menyimpanGrup" style="position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:70; background:var(--burgundy); color:var(--tinta-gradien); border-radius:999px; padding:9px 16px; display:flex; align-items:center; gap:8px; box-shadow:0 10px 24px -8px rgba(0,0,0,.35);">
        <div class="animate-spin" style="width:14px; height:14px; border-radius:50%; border:2px solid rgba(var(--tinta-gradien-rgb),.35); border-top-color:var(--tinta-gradien);"></div>
        <span style="font-size:11px; font-weight:600;">Menyimpan...</span>
      </div>

      <div v-if="memuat" style="text-align:center; padding:32px 0; color:var(--text-faint); font-size:11px;">Memuat...</div>

      <template v-else>
        <!-- Bagian 1: Kartu favorit -->
        <div class="gc-card" style="margin-bottom:18px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <h3 class="gc-heading" style="font-size:12px; font-weight:700; margin:0;">Kartu favorit &middot; maksimal 4</h3>
            <button @click="resetFavorit" style="background:none; border:none; color:var(--text-muted); font-size:10.5px; font-weight:600; cursor:pointer;">Reset</button>
          </div>
          <p style="font-size:10.5px; color:var(--text-muted); margin:0 0 10px;">{{ favoritIds.length }} dari 4 kartu terpakai</p>
          <kolom-cari v-model="cariFavorit" placeholder="Cari modul..." />
          <div style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
            <div v-for="item in itemTersaring" :key="item.menuId" style="background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:11px 13px; display:flex; align-items:center; gap:10px;" :style="(kuotaPenuh && !favoritIds.includes(item.menuId)) ? 'opacity:.45;' : ''">
              <span style="width:30px; height:30px; border-radius:50%; background:var(--aksen-lembut); display:flex; align-items:center; justify-content:center; color:var(--aksen-ink); font-size:14px; flex-shrink:0;"><i class="fas" :class="item.icon"></i></span>
              <div style="flex:1; min-width:0;">
                <p style="font-size:12px; font-weight:600; color:var(--text); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ item.label }}</p>
              </div>
              <button @click="toggleFavoritItem(item)" :disabled="kuotaPenuh && !favoritIds.includes(item.menuId)" style="width:36px; height:21px; border-radius:999px; border:none; padding:2px; cursor:pointer; flex-shrink:0; position:relative; transition:background .15s;" :style="favoritIds.includes(item.menuId) ? 'background:var(--burgundy);' : 'background:var(--line);'">
                <span style="display:block; width:15px; height:15px; border-radius:50%; background:var(--surface); transition:transform .15s;" :style="favoritIds.includes(item.menuId) ? 'transform:translateX(15px);' : ''"></span>
              </button>
            </div>
            <p v-if="itemTersaring.length === 0" style="text-align:center; font-size:11px; color:var(--text-faint); padding:16px 0;">Modul tidak ditemukan.</p>
          </div>
        </div>

        <!-- Bagian 2: Grup menu di beranda -->
        <div class="gc-card">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <h3 class="gc-heading" style="font-size:12px; font-weight:700; margin:0;">Grup menu di beranda</h3>
            <button @click="resetGrup" style="background:none; border:none; color:var(--text-muted); font-size:10.5px; font-weight:600; cursor:pointer;">Reset</button>
          </div>
          <p style="font-size:10.5px; color:var(--text-muted); margin:0 0 12px;">Grup paling atas yang aktif ditampilkan di Beranda.</p>

          <div style="display:flex; align-items:center; justify-content:space-between; background:var(--ivory-dim); border-radius:14px; padding:10px 13px; margin-bottom:12px;">
            <span style="font-size:11.5px; font-weight:600; color:var(--text);">Kartu per grup</span>
            <div style="display:flex; align-items:center; gap:10px;">
              <button @click="batasKartu = Math.max(2, batasKartu - 1); simpanGrup()" style="width:26px; height:26px; border-radius:50%; border:1px solid var(--line); background:var(--surface); cursor:pointer; color:var(--text);">&minus;</button>
              <span class="gc-heading gc-num" style="font-size:13px; font-weight:700; min-width:16px; text-align:center;">{{ batasKartu }}</span>
              <button @click="batasKartu = Math.min(8, batasKartu + 1); simpanGrup()" style="width:26px; height:26px; border-radius:50%; border:1px solid var(--line); background:var(--surface); cursor:pointer; color:var(--text);">+</button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <div v-for="grup in menuGroups" :key="grup.nama" style="background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:11px 13px; display:flex; align-items:center; gap:10px;">
              <div style="flex:1; min-width:0;">
                <p style="font-size:12px; font-weight:600; color:var(--text); margin:0;">{{ grup.nama }}</p>
                <p style="font-size:9.5px; color:var(--text-faint); margin:2px 0 0;">{{ grup.items.length }} modul</p>
              </div>
              <span class="tag" :class="statusGrup(grup.nama).kelas" style="flex-shrink:0;">{{ statusGrup(grup.nama).teks }}</span>
              <button @click="toggleGrup(grup.nama)" style="width:40px; height:23px; border-radius:999px; border:none; padding:2px; cursor:pointer; flex-shrink:0; position:relative;" :style="grupUrutan.includes(grup.nama) ? 'background:var(--burgundy);' : 'background:var(--line);'">
                <span style="display:block; width:17px; height:17px; border-radius:50%; background:var(--surface); transition:transform .15s;" :style="grupUrutan.includes(grup.nama) ? 'transform:translateX(17px);' : ''"></span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  `
};

const mountPoint = document.getElementById('vue-atur-favorit');
if (mountPoint) createApp(AppAturFavorit).mount('#vue-atur-favorit');
