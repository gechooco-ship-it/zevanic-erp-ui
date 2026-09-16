// js/vue-popup-scan.js
// Bottom Sheet Picker "Mau scan apa?" — tombol QR navbar mobile membuka ini
// dulu, bukan lompat langsung ke tab Scan QR. Nav 5-tombol tetap sama, cuma
// tombol QR tengah yang jadi kontekstual lewat sheet ini.
//
// Koleksi & field:
// - Tidak menyentuh Firestore langsung; item PETA_PILIHAN_SCAN memanggil
//   fungsi window.bukaXxx milik modul lain (lihat file modul terkait).
//
// Jebakan:
// - Key PETA_PILIHAN_SCAN = targetId sub-tab paling spesifik di
//   window._riwayatNavAktif.subTabs (bukan tabId top-level) supaya tahap
//   yang beda modal (mis. Cutting Perlu Di Proses vs Perlu Di Kirim) dapat
//   pilihan beda. Konteks tidak match satupun key -> fallback 1 pilihan
//   "Scan QR" (pilihanDefault), sama seperti perilaku tombol QR lama.
// - aksi() modul lain bisa belum ke-mount (mount-on-demand) — selalu cek
//   window.bukaXxx ada dulu sebelum panggil, jangan asumsikan selalu ada.
import { createApp, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

// Isi per modul: fungsi window.bukaXxx didefinisikan di file modul masing-
// masing (dipanggil vm yang sudah ke-mount, lihat komentar di tiap file).
// Masalah SENGAJA tidak ada di sini — Scan Operator-nya cuma tombol
// per-kartu, tidak ada varian toolbar global untuk dipanggil tanpa konteks.
const PETA_PILIHAN_SCAN = {
  'sub-pp-bahan-perludisiapkan': [
    { icon: 'user', judul: 'Scan Operator', sub: 'Persiapan Bahan', gaya: 'aksen', aksi: () => window.bukaScanOperatorBahan && window.bukaScanOperatorBahan() }
  ],
  'sub-pp-sewing-perludisiapkan': [
    { icon: 'user', judul: 'Scan Operator', sub: 'Acc Sewing', gaya: 'aksen', aksi: () => window.bukaScanOperatorSewing && window.bukaScanOperatorSewing() }
  ],
  'sub-pp-webbing-perludisiapkan': [
    { icon: 'user', judul: 'Scan Operator', sub: 'Acc Webbing', gaya: 'aksen', aksi: () => window.bukaScanOperatorWebbing && window.bukaScanOperatorWebbing() }
  ],
  'sub-pp-finishing-perludisiapkan': [
    { icon: 'user', judul: 'Scan Operator', sub: 'Acc Finishing', gaya: 'aksen', aksi: () => window.bukaScanOperatorFinishing && window.bukaScanOperatorFinishing() }
  ],
  'sub-pr-cutting-perludiproses': [
    { icon: 'barcode', judul: 'Scan Sampai', sub: 'Terima kiriman bahan', aksi: () => window.bukaScanSampaiCutting && window.bukaScanSampaiCutting() },
    { icon: 'box-open', judul: 'Scan Unpack', sub: 'Buka isi bagging', aksi: () => window.bukaScanUnpackCutting && window.bukaScanUnpackCutting() }
  ],
  'sub-pr-cutting-perludikirim': [
    { icon: 'qrcode', judul: 'Scan Pack', sub: 'Kaitkan label ke bagging', aksi: () => window.bukaScanPackCutting && window.bukaScanPackCutting() },
    { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Muat bagging ke tugas kirim', aksi: () => window.bukaScanKirimCutting && window.bukaScanKirimCutting() }
  ]
};

function pilihanDefault() {
  return [{
    icon: 'qrcode',
    judul: 'Scan QR',
    gaya: 'aksen',
    aksi: () => { if (window.pindahTab) window.pindahTab('tab-scan-qr'); }
  }];
}

// Cari konteks aktif SEKARANG: sub-tab ter-track (§39, paling spesifik)
// dulu, baru tab top-level kalau tidak ketemu. Lihat js/dashboard.js utk
// bentuk window._riwayatNavAktif.
function ambilPilihanScanUntukKonteks() {
  const aktif = window._riwayatNavAktif;
  if (aktif && Array.isArray(aktif.subTabs)) {
    for (const entry of aktif.subTabs) {
      if (PETA_PILIHAN_SCAN[entry.targetId]) return PETA_PILIHAN_SCAN[entry.targetId];
    }
  }
  if (aktif && aktif.tab && PETA_PILIHAN_SCAN[aktif.tab]) return PETA_PILIHAN_SCAN[aktif.tab];
  return pilihanDefault();
}

const AppPopupScan = {
  setup() {
    const terbuka = ref(false);
    const judul = ref('Mau scan apa?');
    const daftarItem = ref([]);
    // Menandai apakah entry riwayat browser utk sheet ini SEDANG aktif —
    // dipakai supaya tutup() lewat tombol/backdrop (BUKAN tombol back HP)
    // ikut menetralkan entry itu (lihat tutup() di bawah), konsisten dgn
    // pola back HP §39/temuan #3 (GAP-MOBILE-10SEP2026.md) — sheet ini
    // juga ikut tertutup kalau tombol back HP ditekan selagi terbuka.
    let adaEntryHistory = false;

    function buka() {
      daftarItem.value = ambilPilihanScanUntukKonteks();
      terbuka.value = true;
      try {
        history.pushState({ sheetPilihanScan: true }, '', location.href);
        adaEntryHistory = true;
      } catch (e) {
        console.error('Gagal catat riwayat sheet pilihan scan (tidak fatal):', e);
      }
    }
    function tutup() {
      terbuka.value = false;
      if (adaEntryHistory) {
        adaEntryHistory = false;
        // SENGAJA pakai replaceState (netralkan entry di tempat), BUKAN
        // history.back() — back() itu async (popstate baru terpicu
        // beberapa saat kemudian), kalau pilihItem() langsung memanggil
        // item.aksi() sesudah ini (yang bisa pushState LAGI, mis. lewat
        // pindahTab) urutannya jadi rawan tabrakan/race. replaceState
        // sinkron & tidak menavigasi apa-apa, jadi aman dipanggil
        // berurutan dengan pushState lain tepat sesudahnya.
        try { history.replaceState(null, '', location.href); } catch (e) {}
      }
    }
    // Dipanggil listener popstate (tombol back HP) — TIDAK boleh ikut
    // history.back() lagi (sudah dikonsumsi tombol back itu sendiri).
    function tutupDariPopstate() {
      terbuka.value = false;
      adaEntryHistory = false;
    }
    function pilihItem(item) {
      tutup();
      if (item.aksi) item.aksi();
    }

    return { terbuka, judul, daftarItem, buka, tutup, tutupDariPopstate, pilihItem };
  },
  template: `
    <div>
      <div v-if="terbuka" class="gc-sheet-backdrop" @click="tutup"></div>
      <div v-if="terbuka" class="gc-sheet">
        <div class="gc-sheet-gagang-area" @click="tutup"><div class="gc-sheet-gagang"></div></div>
        <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:12px;">
          <span style="font:700 15px 'Poppins',sans-serif; color:var(--mahogany);">{{ judul }}</span>
          <span @click="tutup" style="margin-left:auto; font-size:11px; color:var(--text-faint); cursor:pointer;">tutup</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div v-for="(item, idx) in daftarItem" :key="idx" @click="pilihItem(item)"
               class="gc-card"
               :style="{padding:'11px 12px', display:'flex', gap:'10px', alignItems:'center', cursor:'pointer', borderRadius:'14px',
                        borderColor: item.gaya === 'aksen' ? 'var(--burgundy)' : undefined,
                        background: item.gaya === 'aksen' ? 'var(--burgundy-light)' : undefined}">
            <div :style="{width:'32px', height:'32px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          background: item.gaya === 'aksen' ? 'var(--burgundy)' : 'var(--ivory-dim)'}">
              <i class="fas" :class="'fa-' + item.icon" :style="{fontSize:'13px', color: item.gaya === 'aksen' ? '#FAF4E7' : 'var(--text-muted)'}"></i>
            </div>
            <div style="flex:1; min-width:0;">
              <div :style="{font:'600 12.5px Poppins,sans-serif', color: item.gaya === 'aksen' ? 'var(--burgundy)' : 'var(--text)'}">{{ item.judul }}</div>
              <div v-if="item.sub" style="font:400 10px 'Nunito Sans',sans-serif; color:var(--mahogany-soft); margin-top:1px;">{{ item.sub }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-popup-scan');
if (mountPoint) {
  const vm = createApp(AppPopupScan).mount('#vue-popup-scan');
  window.bukaPopupPilihanScan = function() { vm.buka(); };
  window.tutupPopupPilihanScan = function() { vm.tutup(); };

  // Tombol back HP/browser saat sheet ini terbuka — tutup sheetnya, JANGAN
  // biarkan lompat balik ke tab/layar sebelumnya (perilaku default browser
  // kalau tidak ditangani). Bentuk state {sheetPilihanScan:true} SENGAJA
  // beda dari state tab Dashboard ({tab:...}) & state layar terlacak
  // ({layarBack:...}, js/app.js) — listener popstate lain otomatis aman
  // mengabaikan bentuk ini.
  window.addEventListener('popstate', (e) => {
    const state = e.state;
    if (!state || !state.sheetPilihanScan) {
      // Back ditekan padahal state SEKARANG bukan sheet ini — tapi kalau
      // sheet MASIH kelihatan terbuka (jarang, race kondisi navigasi
      // cepat), tetap tutup paksa supaya tidak nyangkut menutupi layar.
      if (vm.terbuka) vm.tutupDariPopstate();
      return;
    }
  });

  // Jaring pengaman: dipanggil js/app.js pindahLayar() tiap pindah keluar
  // screen-dashboard (logout, buka kamera, dst) — pola SAMA seperti
  // window.tutupSheetProfil (js/vue-sheet-profil.js).
  window.tutupPaksaPopupPilihanScan = function() { vm.tutupDariPopstate(); };
}
