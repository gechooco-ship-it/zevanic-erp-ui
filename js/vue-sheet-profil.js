// js/vue-sheet-profil.js
// Bottom Sheet Profil, naik dari bawah saat "Profil" di nav bawah diketuk
// (js/app.js, mnavProfile). Isi: kartu QR gradien, 3 aksi cepat (Keluar,
// Scan QR, Mode gelap), 6 tautan sub-layar Profile, dan tombol tutup.
//
// Koleksi & field:
// - Tidak menyentuh Firestore; semua data dibaca dari window.currentUser
//   (id_app, email, name/nama, nik, nama_shift) yang sudah dimuat saat login.
//
// Jebakan:
// - Isi QR memakai id_app, jatuh ke email kalau id_app kosong.
// - Tautan ke-6 "Estimasi Gaji" sengaja ada walau mockup menyebut lima —
//   itu satu-satunya jalan mobile ke layar tersebut, menghapusnya regresi.
// - "Profil Lengkap" mengarah ke sub-tab 'datadiri' (Data Karyawan).
// - Ketuk kartu QR membuka dialog zoom (gc-dialog-backdrop, z-index di atas
//   sheet); satu-satunya jalan keluar logout adalah tombol Keluar di grid.
// - Semua aksi dibungkus fungsi lokal yang mengecek global vanilla dulu
//   (pindahTab, pindahTabAccountProfile, toggleTema, temaPreferensi, logout)
//   — jangan panggil window.xxx langsung dari template.
// - window.bukaSheetProfil / tutupSheetProfil dipasang saat mount.

import { createApp, ref, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

const AppSheetProfil = {
  setup() {
    const terbuka = ref(false);
    const nama = ref('');
    const nik = ref('');
    const namaShift = ref('');
    const qrUrl = ref('');
    // Preferensi MENTAH ('light'/'dark'/'auto') dari window.temaPreferensi
    // (lihat index.html) — bisa 'auto' (ikut sistem), beda dari
    // window.temaSaatIni yang cuma 'light'/'dark' EFEKTIF.
    const temaPref = ref('light');
    const qrZoom = ref(false);
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
    function tutup() { qrZoom.value = false; terbuka.value = false; }

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

    // HARUS lewat fungsi begini, bukan "window.logout" langsung di template
    // (pola sama seperti drawer lama — Vue anggap "window" properti komponen,
    // bukan objek global browser, kalau dipanggil langsung dari template).
    function keluar() { tutup(); if (window.logout) window.logout(); }

    return { terbuka, nama, nik, namaShift, qrUrl, qrZoom, temaPref, ikonTema, labelTema, buka, tutup, klikScanQr, klikModeGelap, navigasi, keluar };
  },
  template: `
    <div>
      <div v-if="terbuka" class="gc-sheet-backdrop" @click="tutup"></div>
      <div v-if="terbuka" class="gc-sheet">
        <div class="gc-sheet-gagang-area" @click="tutup"><div class="gc-sheet-gagang"></div></div>

        <div class="gc-kartu-gradien" style="border-radius:22px; padding:16px; margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:14px; position:relative; z-index:1;">
            <button @click="qrZoom = true" title="Perbesar QR" aria-label="Perbesar QR" style="width:78px; height:78px; padding:7px; background:rgba(var(--tinta-gradien-rgb),.16); border:none; border-radius:16px; flex-shrink:0; cursor:pointer;">
              <img :src="qrUrl" alt="QR Code" style="width:100%; height:100%; object-fit:contain; display:block;">
            </button>
            <div style="min-width:0;">
              <h4 class="gc-heading" style="font-size:17px; font-weight:700; color:var(--tinta-gradien); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ nama }}</h4>
              <p style="font-size:10.5px; color:var(--tinta-gradien); opacity:.85; margin:3px 0 0;">NIK {{ nik }} &middot; {{ namaShift }}</p>
              <p style="font-size:9.5px; color:var(--tinta-gradien); opacity:.7; margin:5px 0 0;">Tunjukkan QR ini untuk absensi/verifikasi.</p>
            </div>
          </div>
        </div>

        <!--
          Slot pertama = "Keluar" (logout), bukan Clock In/Out. Clock In/Out diakses lewat
          kartu Favorit Saya di Beranda — WAJIB tetap tampil di sana.
        -->
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

        <!--
          Oval kecil ikon X = TUTUP sheet, bukan logout. Logout cuma lewat tombol
          Keluar di grid atas.
        -->
        <div style="display:flex; justify-content:center; margin-top:14px;">
          <button @click="tutup" title="Tutup" aria-label="Tutup" style="display:flex; align-items:center; justify-content:center; width:34px; height:26px; border-radius:999px; border:1px solid var(--danger-light); background:var(--danger-light); color:var(--danger); cursor:pointer;">
            <i class="fas fa-xmark" style="font-size:13px;"></i>
          </button>
        </div>
      </div>

      <!-- Zoom QR: dialog terpisah dari sheet supaya tetap tampil di atasnya. -->
      <div v-if="terbuka && qrZoom" class="gc-dialog-backdrop" @click="qrZoom = false">
        <div class="gc-dialog" @click.stop style="max-width:300px;">
          <h3 class="gc-heading" style="font-size:15px; font-weight:700; margin:0 0 4px;">{{ nama }}</h3>
          <p style="font-size:10.5px; color:var(--text-muted); margin:0 0 14px;">NIK {{ nik }} &middot; {{ namaShift }}</p>
          <div style="background:#fff; border-radius:16px; padding:14px; margin-bottom:14px;">
            <img :src="qrUrl" alt="QR Code" style="width:100%; height:auto; display:block;">
          </div>
          <button @click="qrZoom = false" class="btn-primary" style="border-radius:999px;">Tutup</button>
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
  // (lihat komentar js/app.js pindahLayar), jadi TIDAK ikut otomatis tersembunyi
  // saat pindah layar (mis. logout -> screen-login). Expose fungsi tutup supaya
  // pindahLayar bisa memaksa sheet tertutup.
  window.tutupSheetProfil = function() { vm.tutup(); };
}
