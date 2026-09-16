// js/vue-popup-scan.js
// Bottom Sheet Picker "Mau scan apa?" — tombol QR navbar mobile membuka ini
// dulu, bukan lompat langsung ke tab Scan QR. Nav 5-tombol tetap sama, cuma
// tombol QR tengah yang jadi kontekstual lewat sheet ini. Ekspor
// DAFTAR_AKSI_SCAN, DAFTAR_KONTEKS, DEFAULT_PILIHAN, invalidasiCachePilihanScan
// dipakai layar admin js/vue-pilihan-scan-config.js.
//
// Koleksi & field:
// - config_pilihan_scan/{targetId}: 1 dokumen = 1 konteks (sub-tab paling
//   spesifik) — item_ids[] (urutan tampil), diubah_pada, diubah_oleh. Konteks
//   TANPA dokumen jatuh ke DEFAULT_PILIHAN di kode. Dibaca 1x getDocs per
//   sesi lalu dicache (lihat pastikanCachePilihanScan).
// - Tidak menulis Firestore lain — tiap item cuma memanggil window.bukaXxx
//   milik modul lain (lihat DAFTAR_AKSI_SCAN.fungsi).
//
// Jebakan:
// - Key DEFAULT_PILIHAN/dokumen Firestore = targetId sub-tab paling spesifik
//   di window._riwayatNavAktif.subTabs (bukan tabId top-level) supaya tahap
//   yang beda modal (mis. Cutting Perlu Di Proses vs Perlu Di Kirim) dapat
//   pilihan beda. Konteks tidak match satupun -> fallback "Scan QR" biasa.
// - window.bukaXxx modul lain bisa belum ke-mount (mount-on-demand) — selalu
//   cek fungsinya ada dulu sebelum panggil, jangan asumsikan selalu ada.
// - Simpan/hapus dari layar admin WAJIB panggil invalidasiCachePilihanScan(),
//   kalau tidak sheet ini masih pakai cache lama sampai reload halaman.
import { createApp, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// DAFTAR_AKSI_SCAN — katalog TETAP semua aksi scan yang bisa dimasukkan ke
// sheet ini. Menambah titik scan baru = tambah 1 entri di sini (fungsi =
// nama window.bukaXxx yang didefinisikan di file modul terkait) — baru
// setelah itu bisa dipasang ke konteks manapun lewat layar admin.
export const DAFTAR_AKSI_SCAN = {
  operator_bahan: { icon: 'user', judul: 'Scan Operator', sub: 'Persiapan Bahan', gaya: 'aksen', fungsi: 'bukaScanOperatorBahan' },
  operator_sewing: { icon: 'user', judul: 'Scan Operator', sub: 'Acc Sewing', gaya: 'aksen', fungsi: 'bukaScanOperatorSewing' },
  operator_webbing: { icon: 'user', judul: 'Scan Operator', sub: 'Acc Webbing', gaya: 'aksen', fungsi: 'bukaScanOperatorWebbing' },
  operator_finishing: { icon: 'user', judul: 'Scan Operator', sub: 'Acc Finishing', gaya: 'aksen', fungsi: 'bukaScanOperatorFinishing' },
  cutting_sampai: { icon: 'barcode', judul: 'Scan Sampai', sub: 'Terima kiriman bahan', fungsi: 'bukaScanSampaiCutting' },
  cutting_unpack: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Buka isi bagging', fungsi: 'bukaScanUnpackCutting' },
  cutting_pack: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Kaitkan label ke bagging', fungsi: 'bukaScanPackCutting' },
  cutting_kirim: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Muat bagging ke tugas kirim', fungsi: 'bukaScanKirimCutting' }
};

// DAFTAR_KONTEKS — konteks (targetId sub-tab) yang sudah dikenal sheet ini,
// dengan label jalur menu buat layar admin. Masalah SENGAJA tidak ada di
// sini — Scan Operator-nya cuma tombol per-kartu, tidak ada varian toolbar
// global untuk dipanggil tanpa konteks.
export const DAFTAR_KONTEKS = {
  'sub-pp-bahan-perludisiapkan': 'Persiapan Produksi > Bahan > Perlu Disiapkan',
  'sub-pp-sewing-perludisiapkan': 'Persiapan Produksi > Acc Sewing > Perlu Disiapkan',
  'sub-pp-webbing-perludisiapkan': 'Persiapan Produksi > Acc Webbing > Perlu Disiapkan',
  'sub-pp-finishing-perludisiapkan': 'Persiapan Produksi > Acc Finishing > Perlu Disiapkan',
  'sub-pr-cutting-perludiproses': 'Proses Produksi > Cutting > Perlu Di Proses',
  'sub-pr-cutting-perludikirim': 'Proses Produksi > Cutting > Perlu Di Kirim'
};

// DEFAULT_PILIHAN — dipakai kalau konteks belum punya dokumen
// config_pilihan_scan (belum pernah diatur dari layar admin).
export const DEFAULT_PILIHAN = {
  'sub-pp-bahan-perludisiapkan': ['operator_bahan'],
  'sub-pp-sewing-perludisiapkan': ['operator_sewing'],
  'sub-pp-webbing-perludisiapkan': ['operator_webbing'],
  'sub-pp-finishing-perludisiapkan': ['operator_finishing'],
  'sub-pr-cutting-perludiproses': ['cutting_sampai', 'cutting_unpack'],
  'sub-pr-cutting-perludikirim': ['cutting_pack', 'cutting_kirim']
};

// Cache in-memory per sesi, hemat read Firestore — koleksinya kecil (jumlah
// konteks, bukan jumlah scan). null = belum dimuat sekalipun.
let _cachePilihanScan = null;

async function pastikanCachePilihanScan() {
  if (_cachePilihanScan) return;
  _cachePilihanScan = {};
  try {
    const snap = await getDocs(collection(db, 'config_pilihan_scan'));
    snap.docs.forEach(d => { _cachePilihanScan[d.id] = d.data(); });
  } catch (e) {
    console.error('Gagal muat config_pilihan_scan, pakai default kode:', e);
  }
}
// Dipanggil js/vue-pilihan-scan-config.js tiap simpan/hapus, supaya sheet ini
// tidak nyangkut pakai cache lama sampai reload halaman.
export function invalidasiCachePilihanScan() { _cachePilihanScan = null; }

function ambilItemUntukTarget(targetId) {
  const dariFirestore = _cachePilihanScan && _cachePilihanScan[targetId];
  const ids = dariFirestore ? (dariFirestore.item_ids || []) : DEFAULT_PILIHAN[targetId];
  if (!ids || !ids.length) return null;
  const item = ids.map(id => DAFTAR_AKSI_SCAN[id]).filter(Boolean).map(a => ({
    icon: a.icon, judul: a.judul, sub: a.sub, gaya: a.gaya,
    aksi: () => window[a.fungsi] && window[a.fungsi]()
  }));
  return item.length ? item : null;
}

function pilihanDefault() {
  return [{
    icon: 'qrcode',
    judul: 'Scan QR',
    gaya: 'aksen',
    aksi: () => { if (window.pindahTab) window.pindahTab('tab-scan-qr'); }
  }];
}

// Cari konteks aktif SEKARANG: sub-tab ter-track dulu (paling spesifik), baru
// tab top-level kalau tidak ketemu. Lihat js/dashboard.js utk bentuk
// window._riwayatNavAktif.
function ambilPilihanScanUntukKonteks() {
  const aktif = window._riwayatNavAktif;
  if (aktif && Array.isArray(aktif.subTabs)) {
    for (const entry of aktif.subTabs) {
      const item = ambilItemUntukTarget(entry.targetId);
      if (item) return item;
    }
  }
  if (aktif && aktif.tab) {
    const item = ambilItemUntukTarget(aktif.tab);
    if (item) return item;
  }
  return pilihanDefault();
}

const AppPopupScan = {
  setup() {
    const terbuka = ref(false);
    const judul = ref('Mau scan apa?');
    const daftarItem = ref([]);
    // Menandai apakah entry riwayat browser utk sheet ini SEDANG aktif —
    // dipakai supaya tutup() lewat tombol/backdrop (BUKAN tombol back HP)
    // ikut menetralkan entry itu (lihat tutup() di bawah). Sheet ini juga
    // ikut tertutup kalau tombol back HP ditekan selagi terbuka.
    let adaEntryHistory = false;

    async function buka() {
      await pastikanCachePilihanScan();
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
