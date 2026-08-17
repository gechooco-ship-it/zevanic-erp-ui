// js/vue-home.js
// ============================================================================
// tab-home mobile — sapaan + kartu shift, lalu "hub menu" terkelompok:
// - Grup "Shortcut": Clock In/Clock Out (dinamis sesuai status hari ini),
//   Izin, Cuti, Lembur — tampil grid ikon seperti sebelumnya.
// - Grup "Absensi"/"Master Karyawan"/"Whatsapp": daftar link, muncul HANYA
//   untuk role yang berhak (lihat daftarMenuGroups di vue-components.js —
//   registry terpusat, satu sumber kebenaran, supaya nanti kalau desktop
//   mau dirapikan pakai struktur sama tinggal reuse fungsi yang sama).
// - Pengumuman tetap di bawah, baca data Firestore asli.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { daftarMenuGroups } from './vue-components.js';

const AppHome = {
  setup() {
    const nama = ref('');
    const sapaan = ref('Selamat datang');
    const shift = reactive({ nama: '', jamMasuk: '', jamKeluar: '' });
    const sudahAbsenHariIni = ref(false);
    const pengumuman = ref([]);
    const memuatPengumuman = ref(true);
    const menuGroups = ref([]);

    function tentukanSapaan() {
      const jam = new Date().getHours();
      if (jam >= 4 && jam < 11) return 'Selamat pagi';
      if (jam >= 11 && jam < 15) return 'Selamat siang';
      if (jam >= 15 && jam < 18) return 'Selamat sore';
      return 'Selamat malam';
    }

    function muatTampilan() {
      nama.value = window.currentUser?.name || window.currentUser?.nama || 'Karyawan';
      sapaan.value = tentukanSapaan();
      const hariIni = new Date().toLocaleDateString('id-ID');
      const statusLokal = localStorage.getItem('zevanic_absen_' + (window.currentUser?.email || ''));
      sudahAbsenHariIni.value = statusLokal === hariIni;
      menuGroups.value = daftarMenuGroups(window.currentUser?.role);
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

    async function muatPengumuman() {
      memuatPengumuman.value = true;
      try {
        // Ambil agak lebih banyak dari yang ditampilkan (15, bukan 5) —
        // karena sebagian akan disaring keluar berdasarkan role SETELAH
        // diambil (bukan query where() ke server, biar hemat baca —
        // filternya cuma bandingkan array kecil di JS, pakai role yang
        // SUDAH ada di window.currentUser, tidak baca Firestore lagi).
        const q = query(collection(db, "pengumuman"), orderBy("dibuat_pada", "desc"), limit(15));
        const snap = await getDocs(q);
        const roleSaya = (window.currentUser?.role || 'operator').toLowerCase();
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          const rolesTampil = data.rolesTampil || [];
          // Kosongkan array rolesTampil = tampil untuk SEMUA role (default
          // aman kalau pengumuman lama belum punya field ini sama sekali).
          if (rolesTampil.length === 0 || rolesTampil.includes(roleSaya)) {
            list.push({ id: d.id, ...data });
          }
        });
        pengumuman.value = list.slice(0, 5);
      } catch (e) {
        pengumuman.value = []; // koleksi belum ada/kosong itu wajar, bukan error
      }
      memuatPengumuman.value = false;
    }

    function klikClockInOut() {
      if (sudahAbsenHariIni.value) {
        if (window.prosesClockOut) window.prosesClockOut();
        return;
      }
      window.statusPilihanGlobal = "HADIR (CLOCK IN)";
      window.pindahLayar('screen-camera');
    }

    function klikMenu(item) {
      if (item.terkunci) {
        alert('Akses terkunci, silahkan hubungi Owner / PIC Owner!');
        return;
      }
      item.aksi();
    }

    function bukaIzin() { if (window.bukaFormIzinDariHome) window.bukaFormIzinDariHome(); }
    function bukaCuti() { if (window.bukaFormCutiDariHome) window.bukaFormCutiDariHome(); }
    function bukaLembur() { if (window.bukaFormLemburDariHome) window.bukaFormLemburDariHome(); }

    function muatSemua() {
      muatTampilan();
      muatShift();
      muatPengumuman();
    }

    onMounted(async () => { await window.authReady; muatSemua(); });

    return {
      nama, sapaan, shift, sudahAbsenHariIni, menuGroups,
      pengumuman, memuatPengumuman,
      klikClockInOut, klikMenu, bukaIzin, bukaCuti, bukaLembur,
      muatTampilan, muatSemua
    };
  },
  template: `
    <div>
      <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;" v-if="shift.nama">
        <div>
          <p style="font-size:11px; color:var(--text-muted); font-weight:600;">Shift hari ini</p>
          <p class="gc-heading num" style="font-size:15px; font-weight:700; margin-top:2px;">{{ shift.jamMasuk }} &ndash; {{ shift.jamKeluar }}</p>
        </div>
        <span v-if="sudahAbsenHariIni" class="tag ok"><span class="tag-dot"></span>Sudah absen</span>
        <span v-else class="tag warn"><span class="tag-dot"></span>Belum absen</span>
      </div>

      <h3 class="gc-heading" style="font-size:12px; font-weight:700; margin-bottom:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em;">Pengumuman</h3>
      <div v-if="memuatPengumuman" style="text-align:center; padding:24px 0; color:var(--text-faint); font-size:12px; margin-bottom:22px;">Memuat pengumuman...</div>
      <div v-else-if="pengumuman.length === 0" style="text-align:center; padding:24px 0; background:var(--surface); border:1px dashed var(--line); border-radius:16px; color:var(--text-faint); font-size:12px; margin-bottom:22px;">
        <i class="fas fa-bell-slash" style="font-size:22px; margin-bottom:8px; display:block;"></i>Belum ada pengumuman terbaru.
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px; margin-bottom:22px;">
        <div v-for="p in pengumuman" :key="p.id" style="display:flex; gap:12px; background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:12px;">
          <div style="width:38px; height:38px; border-radius:10px; background:var(--blue); flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#1F5060;"><i class="fas fa-bell"></i></div>
          <div>
            <b style="font-size:12.5px;">{{ p.judul }}</b>
            <p style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">{{ p.isi }}</p>
          </div>
        </div>
      </div>

      <h3 class="gc-heading" style="font-size:12px; font-weight:700; margin-bottom:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em;">Shortcut</h3>
      <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:22px;">
        <button @click="klikClockInOut" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;">
          <span style="width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;" :style="sudahAbsenHariIni ? 'background:#FBE4E4; color:var(--danger);' : 'background:var(--ivory-dim); color:var(--burgundy);'"><i class="fas" :class="sudahAbsenHariIni ? 'fa-right-from-bracket' : 'fa-clock'"></i></span>
          <span style="font-size:10.5px; font-weight:700; color:var(--text);">{{ sudahAbsenHariIni ? 'Clock out' : 'Clock in' }}</span>
        </button>
        <button @click="bukaIzin" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;">
          <span style="width:40px; height:40px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy);"><i class="fas fa-file-signature"></i></span>
          <span style="font-size:10.5px; font-weight:700; color:var(--text);">Izin</span>
        </button>
        <button @click="bukaCuti" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;">
          <span style="width:40px; height:40px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy);"><i class="fas fa-calendar-alt"></i></span>
          <span style="font-size:10.5px; font-weight:700; color:var(--text);">Cuti</span>
        </button>
        <button @click="bukaLembur" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer;">
          <span style="width:40px; height:40px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy);"><i class="fas fa-business-time"></i></span>
          <span style="font-size:10.5px; font-weight:700; color:var(--text);">Lembur</span>
        </button>
      </div>

      <div v-for="grup in menuGroups" :key="grup.nama" style="margin-bottom:22px;">
        <h3 class="gc-heading" style="font-size:12px; font-weight:700; margin-bottom:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em;">{{ grup.nama }}</h3>
        <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:10px;">
          <button v-for="item in grup.items" :key="item.label" @click="klikMenu(item)" style="background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:14px 6px; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; position:relative;" :style="item.terkunci ? 'opacity:.5;' : ''">
            <i v-if="item.terkunci" class="fas fa-lock" style="position:absolute; top:6px; right:8px; font-size:9px; color:var(--text-faint);"></i>
            <span style="width:40px; height:40px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy);"><i class="fas" :class="item.icon"></i></span>
            <span style="font-size:10.5px; font-weight:700; color:var(--text); text-align:center; line-height:1.25;">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-home');
if (mountPoint) {
  const vm = createApp(AppHome).mount('#vue-home');
  window.refreshHome = function() { vm.muatSemua(); };
}
