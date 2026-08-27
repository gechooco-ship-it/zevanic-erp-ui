// js/vue-home.js
// ============================================================================
// tab-home mobile — kartu shift, lalu Pengumuman (komponen bersama, lihat
// PengumumanCarousel di vue-components.js — dipakai sama di desktop &
// mobile, satu sumber kebenaran), lalu "hub menu" terkelompok.
//
// DIROMBAK (27 Agt 2026, §27 — Redesain Home Mobile, atas diskusi & mockup
// dengan Hilman, lihat STATUS-PROYEK.md §27 untuk keputusan lengkapnya).
// REVISI (27 Agt 2026, §27.1 — lihat STATUS-PROYEK.md §27.1): grid semua
// jadi 4 kolom, kolom pencarian DIHAPUS, akordeon per kategori DIGANTI
// tampil-langsung Top-4 + "Lihat Semua" (TANPA perlu tap buka dulu).
// REVISI LAGI (27 Agt 2026, sesi lanjutan §27.2): urutan KATEGORI (bukan
// cuma urutan menu di dalamnya) sekarang juga bisa diatur Owner lewat
// Config Akses > "Urutan Menu di Home Mobile & Sidebar Desktop" — urutan
// yang SAMA dipakai juga oleh sidebar desktop (lihat
// window.terapkanUrutanMenuDesktop di js/auth.js). Badge jumlah menu di
// samping nama kategori DIHAPUS (sudah terwakili "Lihat Semua (N)").
// Header sapaan (vue-header-mobile.js), kartu shift, dan Quote Card TIDAK
// disentuh sama sekali — perombakan MULAI TEPAT SETELAH Quote Card:
//   1. "Favorit Saya" — GANTI baris Shortcut lama (5 ikon: Clock In/Out,
//      Izin, Cuti, Lembur, Reimburse). Sekarang cuma 1 kartu Clock In/Out
//      yang WAJIB & tidak bisa dilepas (posisi pertama, selalu ada) + MAKS
//      4 menu yang di-favoritkan sendiri oleh user lewat mode "Atur" —
//      total 5 kotak, grid LEBAR 4 KOLOM (§27.1) jadi baris ke-2 cuma 1
//      kotak (dikonfirmasi Hilman, BUKAN diturunkan jadi maks 3 favorit).
//      Disimpan per-user di field `menu_favorit` (dokumen users/{email}).
//   2. Kolom pencarian — DIHAPUS (§27.1, revisi dari versi awal).
//   3. Per kategori (dari daftarMenuGroups(), yang sekarang membaca
//      DAFTAR_MENU di vue-config-akses.js langsung — SATU sumber
//      kebenaran, lihat catatan di vue-components.js) — TAMPIL LANGSUNG
//      (§27.1, GANTI akordeon default-tertutup versi awal), nampilkan
//      Top-4 menu (urutan diatur Owner lewat Config Akses > "Urutan Menu
//      di Home Mobile"), sisanya lewat tombol "Lihat Semua". Urutan
//      KATEGORI-nya sendiri BARU §27.2 (lihat atas).
// Pola "tampil semua, yang tidak berhak dikunci gembok" (17 Agt 2026)
// TETAP dipakai apa adanya — cuma sumber & susunan tampilannya yang
// berubah.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// ?v=4 (§27.2) — daftarMenuGroups() di vue-components.js berubah lagi
// (parameter urutanKustomKategori BARU). File itu sendiri TIDAK punya
// skema versi baku (beberapa importer lain masih ?v=2 atau tanpa versi
// sama sekali — quirk lama, sengaja tidak ikut dibereskan di sini) —
// dipakai angka BARU tiap kali fungsi yang dipakai vue-home.js berubah,
// supaya browser Guru DIJAMIN ambil kopi paling baru untuk Home mobile.
import { daftarMenuGroups, PengumumanCarousel, QuoteCard } from './vue-components.js?v=4';

const AppHome = {
  components: { PengumumanCarousel, QuoteCard },
  setup() {
    const shift = reactive({ nama: '', jamMasuk: '', jamKeluar: '', gudang: '' });
    const sudahAbsenHariIni = ref(false);
    const menuGroups = ref([]);
    // Durasi kerja berjalan (Kotak 2) — murni baca localStorage (jam
    // clock-in TERSIMPAN di perangkat, bukan Firestore) + jam sekarang
    // dari perangkat sendiri, diperbarui tiap detik pakai setInterval.
    // Tidak ada baca Firestore tambahan sama sekali untuk fitur ini.
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

    // BARU (27 Agt 2026, §27), N diubah 5->4 di §27.1 — urutan menu per
    // kategori (4 teratas yang tampil duluan, tanpa perlu tap buka dulu)
    // diatur Owner lewat Config Akses > "Urutan Menu di Home Mobile",
    // disimpan 1 dokumen tunggal. 1x getDoc per muat Home (hemat baca) —
    // kalau belum pernah diatur sama sekali, urutanKustom kosong dan
    // daftarMenuGroups() jatuh ke urutan asli DAFTAR_MENU (lihat
    // vue-components.js).
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

    // DIROMBAK (19 Agt 2026) — dulu cocokkan localStorage vs tanggal HARI
    // INI (string persis), yang SALAH untuk shift malam (lintas tengah
    // malam) dan karyawan nebeng HP (localStorage kosong di device
    // beda). Sekarang pakai window.cekStatusClockInSaya() — satu sumber
    // kebenaran bareng auth.js/vue-camera.js, lihat catatan lengkap di
    // auth.js. Variabel sudahAbsenHariIni TETAP nama yang sama (supaya
    // binding template tidak perlu ikut berubah) tapi ARTINYA sekarang
    // "sedang aktif Clock In" (bukan cuma "absen hari ini").
    async function muatTampilan() {
      const status = await window.cekStatusClockInSaya(window.currentUser?.email || '');
      sudahAbsenHariIni.value = status.aktif;
      const { perKategori: urutanKustom, urutanKategori: urutanKatKustom } = await ambilUrutanKustom();
      menuGroups.value = daftarMenuGroups(window.currentUser?.role, urutanKustom, urutanKatKustom);
      // Sinkronkan favorit tersimpan dengan menu yang benar-benar ada
      // sekarang (menu bisa saja sudah dihapus/diganti id-nya) — id yang
      // sudah tidak ketemu lagi otomatis dibuang dari daftar favorit,
      // TANPA perlu tulis ulang ke Firestore kalau memang tidak berubah.
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

    // ------------------------------------------------------------------
    // BARU (27 Agt 2026, §27) — Favorit Saya. Maks. 4 menu, disimpan per-
    // user di field `menu_favorit` (dokumen users/{email}) — pola SAMA
    // seperti pin_hash disimpan di vue-account-profile.js (updateDoc +
    // update window.currentUser langsung + window.simpanKonteksSesi()
    // biar cache localStorage ikut segar, tanpa perlu reload).
    // ------------------------------------------------------------------
    const modeAturFavorit = ref(false);
    const favoritIds = ref([]);
    const semuaItemFlat = computed(() => menuGroups.value.flatMap(g => g.items));
    const daftarFavorit = computed(() =>
      favoritIds.value.map(id => semuaItemFlat.value.find(i => i.menuId === id)).filter(Boolean)
    );

    async function toggleAturFavorit() {
      if (modeAturFavorit.value) {
        // Lagi nutup mode "Atur" -> simpan ke Firestore.
        try {
          await updateDoc(doc(db, 'users', window.currentUser.email), { menu_favorit: favoritIds.value });
          window.currentUser.menu_favorit = [...favoritIds.value];
          if (window.simpanKonteksSesi) window.simpanKonteksSesi();
        } catch (e) {
          console.error('Gagal simpan menu favorit:', e);
          alert('Gagal menyimpan pilihan favorit. Coba lagi.');
        }
      }
      modeAturFavorit.value = !modeAturFavorit.value;
    }

    function toggleFavorit(item) {
      if (item.terkunci) return; // tidak bisa favoritkan menu yang terkunci
      const idx = favoritIds.value.indexOf(item.menuId);
      if (idx >= 0) { favoritIds.value.splice(idx, 1); return; }
      if (favoritIds.value.length >= 4) {
        alert('Maksimal 4 menu favorit — lepas salah satu dulu sebelum menambah yang baru.');
        return;
      }
      favoritIds.value.push(item.menuId);
    }

    // klikMenu MENGGANTIKAN peran sebelumnya — sekarang cabang perilakunya
    // tergantung mode: lagi "Atur" -> toggle favorit; normal -> navigasi
    // (atau tampilkan pesan terkunci), PERSIS logic lama.
    function klikMenu(item) {
      if (modeAturFavorit.value) { toggleFavorit(item); return; }
      if (item.terkunci) {
        alert('Akses terkunci, silahkan hubungi Owner / PIC Owner!');
        return;
      }
      item.aksi();
    }

    // ------------------------------------------------------------------
    // REVISI (27 Agt 2026, §27.1) — kolom pencarian lintas-kategori versi
    // awal (§27) DIHAPUS atas permintaan Hilman. Per kategori SEKARANG
    // tampil LANGSUNG (bukan akordeon default-tertutup lagi), Top-4 menu
    // saja sampai "Lihat Semua" diketuk — grupTerbuka/toggleGrup (buka-
    // tutup per kategori) juga DIHAPUS karena tidak perlu lagi.
    // ------------------------------------------------------------------
    const BATAS_TAMPIL = 4;
    const grupLihatSemua = reactive({});
    function toggleLihatSemua(nama) { grupLihatSemua[nama] = !grupLihatSemua[nama]; }
    function itemsTampil(grup) {
      return grupLihatSemua[grup.nama] ? grup.items : grup.items.slice(0, BATAS_TAMPIL);
    }

    // CATATAN (27 Agt 2026, §27) — bukaIzin/bukaCuti/bukaLembur/
    // bukaReimburse (dulu dipanggil tombol Shortcut yang sekarang dihapus
    // atas permintaan Hilman, lihat header file ini) SUDAH DIHAPUS dari
    // sini karena tidak dipakai lagi. window.bukaFormIzinDariHome/dst di
    // vue-account-profile.js (jembatan yang dulu dipanggil fungsi-fungsi
    // ini) SENGAJA DIBIARKAN ada di sana — tidak berbahaya kalau tidak
    // dipanggil siapapun. PENTING: Izin/Cuti/Lembur/Reimburse BUKAN menu
    // di DAFTAR_MENU (murni shortcut lama), jadi TIDAK BISA dipilih lewat
    // "Favorit Saya" yang baru — akses 1-ketuk dari Home utk ke-4 fitur
    // ini sekarang hilang, cuma bisa lewat tab Profile (bottom nav) ->
    // Absensi/Reimburse. Ini konsekuensi yang SUDAH disetujui Hilman
    // ("Shortcut hapus"), bukan sesuatu yang lupa dipindah.

    async function muatSemua() {
      favoritIds.value = Array.isArray(window.currentUser?.menu_favorit) ? window.currentUser.menu_favorit.slice(0, 4) : [];
      await muatTampilan();
      await muatShift();
    }

    // DIPERBAIKI (23 Agt 2026, bug ditemukan Hilman: badge "Sudah absen"
    // balik jadi "Belum absen" begitu di-refresh, lihat STATUS-PROYEK.md
    // §19.5) — SEBELUMNYA di sini langsung await muatSemua() begitu
    // authReady resolve. Tapi `window.authReady` CUMA nandain Firebase
    // AUTH sudah tau SIAPA yang login — BUKAN nandain window.currentUser
    // (data profil Firestore) sudah lengkap terisi (lihat §10 poin 4,
    // pelajaran yang SAMA yang membongkar bug badge PIN di §19.2). Kalau
    // dipaksa jalan di sini padahal window.currentUser MASIH kosong,
    // muatTampilan() jalan dengan email KOSONG ('') -> query Firestore-nya
    // pasti balik "tidak ketemu" -> sudahAbsenHariIni jadi FALSE. Race
    // condition-nya: fetch dengan email kosong ini (harus nunggu network,
    // lebih lambat) bisa SELESAI BELAKANGAN dan MENIMPA hasil BENAR yang
    // sudah lebih dulu dimuat window.refreshHome() (dipanggil dari
    // auth.js/vue-login.js TEPAT SETELAH window.currentUser lengkap) —
    // itulah kenapa badge sempat benar dulu, lalu "balik salah" sendiri.
    // Perbaikannya: di sini CUMA muat kalau window.currentUser SUDAH ada
    // (kasus navigasi dalam SPA, bukan refresh/reload baru) — kalau belum
    // ada, JANGAN muat apapun, CUKUP diam dan biarkan window.refreshHome()
    // yang memanggil muatSemua() begitu datanya benar-benar siap.
    onMounted(async () => {
      await window.authReady;
      if (window.currentUser && window.currentUser.email) {
        await muatSemua();
      }
    });
    onUnmounted(() => { if (timerDurasi) clearInterval(timerDurasi); });

    return {
      shift, sudahAbsenHariIni, menuGroups,
      jamMasukAsli, durasiBerjalan,
      klikClockInOut, klikMenu,
      muatTampilan, muatSemua,
      modeAturFavorit, toggleAturFavorit, daftarFavorit,
      grupLihatSemua, toggleLihatSemua, itemsTampil, BATAS_TAMPIL
    };
  },
  template: `
    <div>
      <div class="gc-card" v-if="shift.nama" style="margin-top:-26px; margin-bottom:14px; padding:14px 16px; position:relative; z-index:2; box-shadow:0 8px 20px rgba(110,30,44,.12);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <p style="font-size:11px; color:var(--text-muted); font-weight:600; margin:0;">Shift hari ini &middot; {{ shift.gudang }}</p>
            <p class="gc-heading num" style="font-size:15px; font-weight:700; margin:2px 0 0 0;">{{ shift.jamMasuk }} &ndash; {{ shift.jamKeluar }}</p>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span v-if="sudahAbsenHariIni" class="tag ok"><span class="tag-dot"></span>Sudah absen</span>
            <span v-else class="tag warn"><span class="tag-dot"></span>Belum absen</span>
            <span v-if="sudahAbsenHariIni && jamMasukAsli" class="gc-heading num" style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:flex; align-items:center; gap:4px;">
              <i class="fas fa-stopwatch" style="color:var(--burgundy); font-size:10px;"></i>{{ jamMasukAsli }} &ndash; {{ durasiBerjalan }}
            </span>
          </div>
        </div>
      </div>

      <quote-card />

      <!-- BARU (27 Agt 2026, §27) — Favorit Saya, GANTI baris Shortcut lama.
           1 kartu Clock In/Out wajib (selalu ada, tidak bisa dilepas) + maks
           4 menu favorit pilihan user sendiri lewat mode "Atur". -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <h3 class="gc-heading" style="font-size:12px; font-weight:700; margin:0; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em;"><i class="fas fa-star" style="margin-right:6px; color:var(--burgundy);"></i>Favorit Saya</h3>
        <button @click="toggleAturFavorit" style="background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer; padding:4px 2px;">{{ modeAturFavorit ? 'Selesai' : 'Atur' }}</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:6px;">
        <button @click="klikClockInOut" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;">
          <span style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;" :style="sudahAbsenHariIni ? 'background:#FBE4E4; color:var(--danger);' : 'background:var(--ivory-dim); color:var(--burgundy);'"><i class="fas" :class="sudahAbsenHariIni ? 'fa-right-from-bracket' : 'fa-clock'"></i></span>
          <span style="font-size:10.5px; font-weight:700; color:var(--text);">{{ sudahAbsenHariIni ? 'Clock out' : 'Clock in' }}</span>
        </button>
        <button v-for="item in daftarFavorit" :key="item.menuId" @click="klikMenu(item)" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; position:relative;" :style="item.terkunci ? 'opacity:.5;' : ''">
          <i v-if="item.terkunci" class="fas fa-lock" style="position:absolute; top:6px; right:8px; font-size:9px; color:var(--text-faint);"></i>
          <i v-if="modeAturFavorit && !item.terkunci" class="fas fa-star" style="position:absolute; top:6px; left:8px; font-size:9px; color:var(--burgundy);"></i>
          <span style="width:40px; height:40px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy);"><i class="fas" :class="item.icon"></i></span>
          <span style="font-size:10.5px; font-weight:700; color:var(--text); text-align:center; line-height:1.25;">{{ item.label }}</span>
        </button>
        <div v-if="modeAturFavorit" v-for="n in Math.max(0, 4 - daftarFavorit.length)" :key="'slot-'+n" style="border:1.5px dashed var(--line); border-radius:16px; display:flex; align-items:center; justify-content:center; min-height:74px; color:var(--text-faint); font-size:9.5px; text-align:center; padding:6px;">
          Pilih dari daftar di bawah
        </div>
      </div>
      <p v-if="modeAturFavorit" style="font-size:11px; color:var(--text-muted); margin:0 0 20px;">Ketuk menu (yang tidak terkunci) di daftar kategori di bawah buat jadiin favorit — maksimal 4. Ketuk lagi buat lepas, lalu ketuk "Selesai" buat simpan.</p>
      <div v-else style="margin-bottom:20px;"></div>

      <!-- REVISI (27 Agt 2026, §27.1) — per kategori TAMPIL LANGSUNG (GANTI
           akordeon default-tertutup versi §27; kolom pencarian juga sudah
           DIHAPUS, lihat header file). Top-4 menu per kategori, sisanya
           lewat "Lihat Semua". -->
      <div v-for="grup in menuGroups" :key="grup.nama" style="margin-bottom:20px;">
        <div style="display:flex; align-items:center; margin-bottom:10px;">
          <h3 class="gc-heading" style="font-size:12px; font-weight:700; margin:0; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em;">{{ grup.nama }}</h3>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px;">
          <button v-for="item in itemsTampil(grup)" :key="item.menuId" @click="klikMenu(item)" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; position:relative;" :style="item.terkunci ? 'opacity:.5;' : ''">
            <i v-if="item.terkunci" class="fas fa-lock" style="position:absolute; top:6px; right:8px; font-size:9px; color:var(--text-faint);"></i>
            <i v-if="modeAturFavorit && !item.terkunci" class="fas fa-star" style="position:absolute; top:6px; left:8px; font-size:9px;" :style="daftarFavorit.some(f => f.menuId === item.menuId) ? 'color:var(--burgundy);' : 'color:var(--text-faint);'"></i>
            <span style="width:40px; height:40px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy);"><i class="fas" :class="item.icon"></i></span>
            <span style="font-size:10.5px; font-weight:700; color:var(--text); text-align:center; line-height:1.25;">{{ item.label }}</span>
          </button>
        </div>
        <button v-if="grup.items.length > BATAS_TAMPIL" @click="toggleLihatSemua(grup.nama)" style="display:block; margin:12px auto 2px; background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer;">
          {{ grupLihatSemua[grup.nama] ? 'Sembunyikan' : 'Lihat Semua (' + grup.items.length + ')' }}
        </button>
      </div>

      <div style="margin-bottom:14px;">
        <pengumuman-carousel />
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-home');
if (mountPoint) {
  const vm = createApp(AppHome).mount('#vue-home');
  window.refreshHome = function() { vm.muatSemua(); };
}
