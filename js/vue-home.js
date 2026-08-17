// js/vue-home.js
// ============================================================================
// tab-home mobile — kartu shift, lalu Pengumuman (komponen bersama, lihat
// PengumumanCarousel di vue-components.js — dipakai sama di desktop &
// mobile, satu sumber kebenaran), lalu "hub menu" terkelompok:
// - Grup "Shortcut": Clock In/Clock Out (dinamis sesuai status hari ini),
//   Izin, Cuti, Lembur — tampil grid ikon.
// - Grup "Absensi"/"Master Karyawan"/"Whatsapp": SEMUA menu tetap tampil
//   untuk siapapun (17 Agt 2026, perubahan dari sebelumnya yang
//   menyembunyikan) — yang tidak berhak cuma ditandai terkunci, klik-nya
//   munculkan pesan, bukan navigasi (lihat daftarMenuGroups di
//   vue-components.js — registry terpusat, satu sumber kebenaran).
// ============================================================================
import { createApp, ref, reactive, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { daftarMenuGroups, PengumumanCarousel, QuoteCard } from './vue-components.js';

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

    function muatTampilan() {
      const hariIni = new Date().toLocaleDateString('id-ID');
      const statusLokal = localStorage.getItem('zevanic_absen_' + (window.currentUser?.email || ''));
      sudahAbsenHariIni.value = statusLokal === hariIni;
      menuGroups.value = daftarMenuGroups(window.currentUser?.role);
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
    }

    onMounted(async () => { await window.authReady; muatSemua(); });
    onUnmounted(() => { if (timerDurasi) clearInterval(timerDurasi); });

    return {
      shift, sudahAbsenHariIni, menuGroups,
      jamMasukAsli, durasiBerjalan,
      klikClockInOut, klikMenu, bukaIzin, bukaCuti, bukaLembur,
      muatTampilan, muatSemua
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
