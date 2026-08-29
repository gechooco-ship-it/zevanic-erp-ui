// js/vue-sheet-profil.js
// ============================================================================
// Bottom Sheet Profil — GANTI TOTAL js/vue-profile-drawer.js (drawer geser
// dari kanan), sesuai keputusan Guru "hapus total, ganti bersih"
// (redesain "Gechoo Mobile Organic", README.md §6). Muncul naik dari bawah
// saat "Profil" di nav bawah diketuk (lihat js/app.js, mnavProfile).
//
// Isi: kartu QR gradien, 3 aksi cepat (Clock in/out, Scan QR, Mode gelap),
// tautan ke sub-layar Profile, Keluar.
//
// CATATAN (perluasan dari mockup, BUKAN kontradiksi) — README cuma sebut
// "Lima tautan" (Profil lengkap/Absensi saya/Reimburse saya/Pencapaian/
// Keamanan). Drawer LAMA yang digantikan sheet ini py 6 tujuan (termasuk
// "Estimasi Gaji", ditambahkan 28 Agt karena SATU-SATUNYA jalan mobile ke
// situ). Supaya tidak menghilangkan tujuan yang sudah bisa dijangkau
// (regresi), sheet ini TETAP menyertakan "Estimasi Gaji" sebagai tautan ke-6
// — gaya visual & 5 label lain PERSIS ikut mockup, cuma jumlah baris beda.
// "Profil Lengkap" di sini mengarah ke sub-tab 'datadiri' (Data Karyawan) —
// QR sendiri sudah tidak perlu tautan terpisah karena sudah ditampilkan
// LANGSUNG di kartu QR sheet ini.
// ============================================================================
import { createApp, ref, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

const AppSheetProfil = {
  setup() {
    const terbuka = ref(false);
    const nama = ref('');
    const nik = ref('');
    const namaShift = ref('');
    const qrUrl = ref('');
    // DIROMBAK (29 Agt 2026, permintaan Guru) — dulu boolean terang/gelap
    // saja. Sekarang preferensi MENTAH ('light'/'dark'/'auto') dari
    // window.temaPreferensi() (lihat index.html) — bisa 'auto' (ikut
    // sistem), beda dari window.temaSaatIni() yang cuma 'light'/'dark'
    // EFEKTIF.
    const temaPref = ref('light');
    const ikonTema = computed(() => temaPref.value === 'auto' ? 'fa-circle-half-stroke' : (temaPref.value === 'dark' ? 'fa-moon' : 'fa-sun'));
    const labelTema = computed(() => temaPref.value === 'auto' ? 'Otomatis' : (temaPref.value === 'dark' ? 'Mode gelap' : 'Mode terang'));

    function muatData() {
      const qrData = window.currentUser?.id_app || window.currentUser?.email || '';
      qrUrl.value = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}` : '';
      nama.value = window.currentUser?.name || window.currentUser?.nama || 'User';
      nik.value = window.currentUser?.nik || '-';
      namaShift.value = window.currentUser?.nama_shift || '-';
      temaPref.value = window.temaPreferensi ? window.temaPreferensi() : 'light';
    }

    function buka() {
      muatData();
      terbuka.value = true;
    }
    function tutup() { terbuka.value = false; }

    function klikScanQr() {
      tutup();
      if (window.pindahTab) window.pindahTab('tab-scan-qr');
    }

    function klikModeGelap() {
      if (window.toggleTema) window.toggleTema();
      temaPref.value = window.temaPreferensi ? window.temaPreferensi() : temaPref.value;
    }

    function navigasi(subtab) {
      tutup();
      window.pindahTab('tab-profil', 'tab-profil');
      if (window.pindahTabAccountProfile) window.pindahTabAccountProfile(subtab);
    }

    // HARUS lewat fungsi begini, bukan "window.logout()" langsung di
    // template (pola sama seperti drawer lama — Vue anggap "window"
    // properti komponen, bukan objek global browser, kalau dipanggil
    // langsung dari template).
    function keluar() { tutup(); if (window.logout) window.logout(); }

    return { terbuka, nama, nik, namaShift, qrUrl, temaPref, ikonTema, labelTema, buka, tutup, klikScanQr, klikModeGelap, navigasi, keluar };
  },
  template: `
    <div>
      <div v-if="terbuka" class="gc-sheet-backdrop" @click="tutup"></div>
      <div v-if="terbuka" class="gc-sheet">
        <div class="gc-sheet-gagang-area" @click="tutup"><div class="gc-sheet-gagang"></div></div>

        <div class="gc-kartu-gradien" style="border-radius:22px; padding:16px; margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:14px; position:relative; z-index:1;">
            <div style="width:78px; height:78px; padding:7px; background:rgba(251,237,236,.16); border-radius:16px; flex-shrink:0;">
              <img :src="qrUrl" alt="QR Code" style="width:100%; height:100%; object-fit:contain;">
            </div>
            <div style="min-width:0;">
              <h4 class="gc-heading" style="font-size:17px; font-weight:700; color:var(--tinta-gradien); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ nama }}</h4>
              <p style="font-size:10.5px; color:var(--tinta-gradien); opacity:.85; margin:3px 0 0;">NIK {{ nik }} &middot; {{ namaShift }}</p>
              <p style="font-size:9.5px; color:var(--tinta-gradien); opacity:.7; margin:5px 0 0;">Tunjukkan QR ini untuk absensi/verifikasi.</p>
            </div>
          </div>
        </div>

        <!-- DIROMBAK (29 Agt 2026, permintaan Guru setelah cek live) — slot
             pertama tadinya "Clock in/out" (jalan pintas ke kamera), SEKARANG
             diganti "Keluar" (logout). Clock In/Out TETAP bisa diakses lewat
             kartu Favorit Saya di Beranda (WAJIB tampil di sana, lihat
             PETA-MENU.md), jadi bukan regresi — cuma jalan pintas kedua di
             sini yang dilepas, diganti Keluar karena dianggap lebih sering
             dicari dari Profil. -->
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px;">
          <button @click="keluar" style="background:var(--danger-light); border:none; border-radius:18px; padding:13px 8px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer;">
            <i class="fas fa-right-from-bracket" style="font-size:20px; color:var(--danger);"></i>
            <span style="font-size:10px; font-weight:600; color:var(--danger);">Keluar</span>
          </button>
          <button @click="klikScanQr" style="background:var(--aksen-lembut); border:none; border-radius:18px; padding:13px 8px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer;">
            <i class="fas fa-qrcode" style="font-size:20px; color:var(--aksen-ink);"></i>
            <span style="font-size:10px; font-weight:600; color:var(--aksen-ink);">Scan QR</span>
          </button>
          <button @click="klikModeGelap" style="background:var(--aksen-lembut); border:none; border-radius:18px; padding:13px 8px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer;">
            <i class="fas" :class="ikonTema" style="font-size:20px; color:var(--aksen-ink);"></i>
            <span style="font-size:10px; font-weight:600; color:var(--aksen-ink);">{{ labelTema }}</span>
          </button>
        </div>

        <div style="display:flex; flex-direction:column; gap:7px; margin-bottom:14px;">
          <button @click="navigasi('datadiri')" class="gc-card" style="padding:13px 14px; min-height:48px; display:flex; align-items:center; gap:10px; cursor:pointer; border-radius:16px; text-align:left;">
            <i class="fas fa-id-card" style="font-size:18px; color:var(--aksen-ink); width:20px; text-align:center;"></i>
            <span style="flex:1; font-size:12.5px; font-weight:600; color:var(--text);">Profil Lengkap</span>
            <i class="fas fa-chevron-right" style="font-size:12px; color:var(--text-faint);"></i>
          </button>
          <button @click="navigasi('absensi')" class="gc-card" style="padding:13px 14px; min-height:48px; display:flex; align-items:center; gap:10px; cursor:pointer; border-radius:16px; text-align:left;">
            <i class="fas fa-history" style="font-size:18px; color:var(--aksen-ink); width:20px; text-align:center;"></i>
            <span style="flex:1; font-size:12.5px; font-weight:600; color:var(--text);">Absensi Saya</span>
            <i class="fas fa-chevron-right" style="font-size:12px; color:var(--text-faint);"></i>
          </button>
          <button @click="navigasi('reimburse')" class="gc-card" style="padding:13px 14px; min-height:48px; display:flex; align-items:center; gap:10px; cursor:pointer; border-radius:16px; text-align:left;">
            <i class="fas fa-receipt" style="font-size:18px; color:var(--aksen-ink); width:20px; text-align:center;"></i>
            <span style="flex:1; font-size:12.5px; font-weight:600; color:var(--text);">Reimburse Saya</span>
            <i class="fas fa-chevron-right" style="font-size:12px; color:var(--text-faint);"></i>
          </button>
          <button @click="navigasi('gaji')" class="gc-card" style="padding:13px 14px; min-height:48px; display:flex; align-items:center; gap:10px; cursor:pointer; border-radius:16px; text-align:left;">
            <i class="fas fa-sack-dollar" style="font-size:18px; color:var(--aksen-ink); width:20px; text-align:center;"></i>
            <span style="flex:1; font-size:12.5px; font-weight:600; color:var(--text);">Estimasi Gaji</span>
            <i class="fas fa-chevron-right" style="font-size:12px; color:var(--text-faint);"></i>
          </button>
          <button @click="navigasi('pencapaian')" class="gc-card" style="padding:13px 14px; min-height:48px; display:flex; align-items:center; gap:10px; cursor:pointer; border-radius:16px; text-align:left;">
            <i class="fas fa-trophy" style="font-size:18px; color:var(--aksen-ink); width:20px; text-align:center;"></i>
            <span style="flex:1; font-size:12.5px; font-weight:600; color:var(--text);">Pencapaian</span>
            <i class="fas fa-chevron-right" style="font-size:12px; color:var(--text-faint);"></i>
          </button>
          <button @click="navigasi('keamanan')" class="gc-card" style="padding:13px 14px; min-height:48px; display:flex; align-items:center; gap:10px; cursor:pointer; border-radius:16px; text-align:left;">
            <i class="fas fa-shield-halved" style="font-size:18px; color:var(--aksen-ink); width:20px; text-align:center;"></i>
            <span style="flex:1; font-size:12.5px; font-weight:600; color:var(--text);">Keamanan</span>
            <i class="fas fa-chevron-right" style="font-size:12px; color:var(--text-faint);"></i>
          </button>
        </div>

        <!-- Tombol Keluar kedua — DIKEMBALIKAN ke bawah (29 Agt 2026, revisi
             setelah cek live: percobaan pertama sempat dipindah ke ATAS,
             Guru minta balik ke BAWAH lagi, setelah Keamanan, rata TENGAH).
             Oval kecil isi ikon X saja (BUKAN lebar penuh seperti sebelum
             redesain) — sengaja disediakan DUA jalan ke keluar (grid di atas
             + ini) karena Guru minta keduanya secara eksplisit. -->
        <div style="display:flex; justify-content:center; margin-top:14px;">
          <button @click="keluar" title="Keluar" aria-label="Keluar" style="display:flex; align-items:center; justify-content:center; width:34px; height:26px; border-radius:999px; border:1px solid var(--danger-light); background:var(--danger-light); color:var(--danger); cursor:pointer;">
            <i class="fas fa-xmark" style="font-size:13px;"></i>
          </button>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-sheet-profil');
if (mountPoint) {
  const vm = createApp(AppSheetProfil).mount('#vue-sheet-profil');
  window.bukaSheetProfil = function() { vm.buka(); };
  // Sama seperti drawer lama — sheet ini di-mount DI LUAR #screen-dashboard
  // (lihat komentar js/app.js pindahLayar()), jadi TIDAK ikut otomatis
  // tersembunyi saat pindah layar (mis. logout -> screen-login). Expose
  // fungsi tutup supaya pindahLayar() bisa memaksa sheet tertutup.
  window.tutupSheetProfil = function() { vm.tutup(); };
}
