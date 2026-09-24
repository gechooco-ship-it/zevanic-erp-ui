// js/dashboard.js
// Cangkang Dashboard (vanilla, non-Vue): navigasi tab & sub-tab plus riwayat
// browser, accordion sidebar desktop, palet Ctrl+K, export CSV, dan helper
// master data yang dipakai bersama layar lain.
//
// Koleksi & field:
// - master_data/{kategori}: items[] — ambilMasterList auto-seed default kalau
//   dokumennya belum ada, jadi fungsi "baca" ini bisa MENULIS.
// - master_data/kecamatan: map{kabupaten: [kecamatan]}, auto-seed sama.
// - users/{email}: nama, hp (simpanPerubahanProfil).
//
// Jebakan:
// - Daftar id tab di pindahTab hardcode — tab baru yang tidak didaftarkan
//   tidak akan pernah disembunyikan/ditampilkan.
// - pindahTab/pindahSubTab push entry history; panggilan dari listener popstate
//   WAJIB menandai _dariPopstate biar riwayat tidak dobel/muter.
// - Satu grupKelas bisa punya >1 salinan tombol hidup di DOM; class 'active'
//   disamakan lewat data-target, bukan node yang diklik.
// - exportKeCSV membaca window.dataRiwayatGlobal yang diisi layar lain.
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";


let intervalJamKerja = null;
window.mulaiHitungJamKerja = function() {
  const headerBadge = document.getElementById('label-badge-role');
  if (!headerBadge) return;
  if (intervalJamKerja) clearInterval(intervalJamKerja);

  intervalJamKerja = setInterval(() => {
    const sekarang = new Date();
    const jamMasukShift = new Date();
    jamMasukShift.setHours(1, 0, 0, 0); // Asumsi Pukul 01:00 WIB

    const selisihMs = sekarang - jamMasukShift;
    let statusTeks = "";

    if (selisihMs < 0) {
      const sisaMs = Math.abs(selisihMs);
      const jam = Math.floor(sisaMs / (1000 * 60 * 60));
      const menit = Math.floor((sisaMs % (1000 * 60 * 60)) / (1000 * 60));
      const detik = Math.floor((sisaMs % (1000 * 60)) / 1000);
      statusTeks = `🟢 Tepat Waktu (-${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')})`;
    } else {
      const jam = Math.floor(selisihMs / (1000 * 60 * 60));
      const menit = Math.floor((selisihMs % (1000 * 60 * 60)) / (1000 * 60));
      const detik = Math.floor((selisihMs % (1000 * 60)) / 1000);
      statusTeks = `🔴 Terlambat (+${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')})`;
    }

    headerBadge.className = "text-xs font-black text-slate-800 uppercase tracking-wider flex items-center mb-0.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm";
    headerBadge.innerHTML = `<i class="far fa-clock mr-1.5 text-blue-600 animate-pulse"></i> Shift 01:00 | ${statusTeks}`;
  }, 1000);
};

window.simpanPerubahanProfil = async function() {
  const namaBaru = document.getElementById('profil-input-nama').value;
  const hpBaru = document.getElementById('profil-input-hp').value;
  if (!namaBaru) return alert("Nama tidak boleh kosong!");
  try {
    const userRef = doc(db, "users", window.currentUser.email);
    await updateDoc(userRef, { nama: namaBaru, nama_lower: window.namaUntukCari(namaBaru), hp: hpBaru });
    window.currentUser.name = namaBaru;
    document.getElementById('teks-nama-user').innerText = namaBaru;
    if (window.perbaruiAvatarSidebarDesktop) window.perbaruiAvatarSidebarDesktop();
    document.getElementById('profil-nama').innerText = namaBaru;
    alert("Profil berhasil diperbarui!");
  } catch (e) {
    console.error("Gagal update profil:", e);
    alert("Gagal memperbarui data profil ke cloud.");
  }
};

// simpanKeFirebase & kirimDataKeCloud (submit selfie ke Firestore) sudah pindah
// ke js/vue-camera.js.


// PANEL ACC PIC & VALIDASI

window.bukaPreviewFoto = function(src) {
  document.getElementById('img-preview-besar').src = src;
  document.getElementById('modal-preview-foto').classList.remove('hidden');
};
window.tutupPreviewFoto = function() {
  document.getElementById('modal-preview-foto').classList.add('hidden');
  document.getElementById('img-preview-besar').src = "";
};

// ZONA KONTROL OWNER — Tabel Daftar Karyawan (dulu
// window.muatDataSuperUser/hapusKaryawan) sudah pindah ke
// js/vue-daftar-karyawan.js.


// ANTREAN KARYAWAN (Antrean Dakar) — sudah pindah ke js/vue-antrean-dakar.js.
// Dipakai ulang di sana: GudangCheckboxSelect (vue-components.js),
// window.ambilMasterList, window.ambilTemplateWA, window.kirimPesanWhatsapp.



// WhatsApp Gateway (Config API, Template Pesan, Monitoring Respon) sudah pindah
// ke js/vue-whatsapp-gateway.js. window.kirimPesanWhatsapp (auth.js) TETAP
// dipertahankan — masih dipakai alur registrasi/approval.


// Modal Edit Karyawan (dulu window.isiSelectDariMaster/bukaEditUser/
// tutupEditUser/simpanEditUser) sudah pindah ke js/vue-daftar-karyawan.js.


// Koleksi Firestore "master_gudang" dan "master_shift" dibaca LANGSUNG (skema
// field sama persis) oleh geofencing camera.js, Penjadwalan, Daftar Karyawan,
// dan Antrean Dakar. UI pengelolanya di js/vue-config-absensi.js.



// Kecamatan dikecualikan (lihat fungsi khusus di bawah) karena strukturnya
// bertingkat per Kabupaten.

const MASTER_DATA_DEFAULT = {
  jenis_pekerjaan: ["Full Time", "Part Time", "Harian"],
  status_kerja: ["Aktif", "Tidak Aktif", "Resign"],
  // "status_pengguna" dihapus dari sini — sudah tidak dibaca di manapun lagi,
  // role sekarang turunan dari Jabatan (koleksi akses_jabatan).
  jabatan: ["Operator", "Admin", "Warehouse"],
  status_karyawan: ["Tetap", "Part Time", "Kontrak"],
  kabupaten: ["Bandung", "Bandung Barat", "Cimahi", "Garut"],
  alasan_izin: ["Sakit", "Keperluan Keluarga", "Keperluan Pribadi", "Lainnya"],
  alasan_cuti: ["Cuti Tahunan", "Cuti Melahirkan/Menikah", "Keperluan Keluarga", "Lainnya"],
  status_kehadiran: ["Ontime", "Terlambat", "Tidak Absen"]
};
const KECAMATAN_DEFAULT = {
  "Bandung": ["Cimaung", "Banjaran", "Soreang"],
  "Bandung Barat": ["Lembang", "Padalarang", "Ngamprah"],
  "Cimahi": ["Cimahi Utara", "Cimahi Tengah", "Cimahi Selatan"],
  "Garut": []
};

// Ambil daftar item 1 kategori. Kalau dokumennya belum ada di Firestore,
// otomatis diisi dulu dengan nilai default (sekali saja) supaya dropdown di
// seluruh aplikasi tidak pernah kosong.
window.ambilMasterList = async function(kategori) {
  const ref = doc(db, "master_data", kategori);
  const snap = await getDoc(ref);
  if (snap.exists() && Array.isArray(snap.data().items)) {
    return snap.data().items;
  }
  const defaultItems = MASTER_DATA_DEFAULT[kategori] || [];
  try { await setDoc(ref, { items: defaultItems }); } catch (e) { console.error(e); }
  return defaultItems;
};

// Helper bersama (dipakai oleh auth.js untuk dropdown kecamatan di form
// registrasi, dan oleh js/vue-components.js KecamatanManager).
window.ambilKecamatanUntukKabupaten = async function(kab) {
  try {
    const snap = await getDoc(doc(db, "master_data", "kecamatan"));
    let map = (snap.exists() && snap.data().map) ? snap.data().map : null;
    if (!map) {
      map = KECAMATAN_DEFAULT;
      await setDoc(doc(db, "master_data", "kecamatan"), { map });
    }
    return map[kab] || [];
  } catch (e) {
    console.error("Gagal ambil kecamatan:", e);
    return [];
  }
};

// window.ambilMasterList & window.ambilKecamatanUntukKabupaten dipakai Antrean
// Dakar dan form Registrasi. UI Master Data-nya sendiri ada di
// js/vue-components.js + js/vue-config-karyawan.js.


// Master Shift UI dipindah ke js/vue-config-absensi.js.


// Penjadwalan (ringkasan per-gudang, filter, pilih massal, update massal,
// pagination, export/import Excel) sudah pindah ke js/vue-penjadwalan.js.



// LOGIKA PERPINDAHAN HALAMAN UTAMA (ANTI KETUMPUK)


// Accordion sidebar: buka 1 grup, yang lain otomatis tutup. Grup dikumpulkan
// lewat atribut data-group di tombol parent, BUKAN daftar id hardcode — grup
// baru cukup ditambah tombol + data-group di index.html.
function setGrupSidebarTerbuka(groupId) {
  document.querySelectorAll('[data-group]').forEach(btn => {
    const target = document.getElementById(btn.dataset.group);
    const cocok = btn.dataset.group === groupId;
    if (target) target.classList.toggle('hidden', !cocok);
    const ikon = btn.querySelector('i.fa-chevron-down, i.fa-chevron-up');
    if (ikon) {
      ikon.classList.toggle('fa-chevron-down', !cocok);
      ikon.classList.toggle('fa-chevron-up', cocok);
    }
    // class buat warnai ikon+latar tombol kepala grup saat grup-nya terbuka
    // (persis mockup, lihat .gc-grp-buka di css/gechoo-design.css). Dulu tidak
    // ada state ini sama sekali di tombol parent-nya sendiri, cuma chevron yang
    // berubah.
    btn.classList.toggle('gc-grp-buka', cocok);
  });
}
window.toggleNavGroup = function(groupId) {
  const el = document.getElementById(groupId);
  if (!el) return;
  const sedangTerbuka = !el.classList.contains('hidden');
  setGrupSidebarTerbuka(sedangTerbuka ? null : groupId); // klik ulang grup yg sudah terbuka -> tutup semua
};
// bukaGrupSidebarUntukTab — dipanggil dari pindahTab supaya begitu pindah tab
// (klik sub-menu, tombol back/forward, dsb), grup sidebar yang relevan OTOMATIS
// ikut terbuka — jangan sampai orang pindah halaman tapi sidebar-nya masih
// nutup/nunjuk ke grup lain, bingung nyarinya.
const petaGrupSidebarPerTab = {
  // 3 tab ini dulu masing-masing punya grup sidebar sendiri
  // (navgrp-absensi/navgrp-keuangan/navgrp-karyawan), SEKARANG gabung 1 grup
  // "navgrp-management".
  'tab-admin-acc': 'navgrp-management',
  'tab-keuangan': 'navgrp-management',
  'tab-superuser': 'navgrp-management',
  'tab-zevanic-house': 'navgrp-zevanic',
  // 'tab-stok-pembelian' grup top-level tersendiri, terpisah dari Zevanic
  // House > Stock & Pembelian (lihat index.html komentar navgrp-stokpembelian).
  'tab-stok-pembelian': 'navgrp-stokpembelian',
  // 'tab-pesanan' grup top-level (sejajar Zevanic House/Persiapan
  // Produksi), lihat js/vue-pesanan.js.
  'tab-pesanan': 'navgrp-pesanan',
  // 'tab-persiapan-produksi' grup top-level (sejajar Zevanic House), lihat
  // js/vue-persiapan-produksi-v2.js.
  'tab-persiapan-produksi': 'navgrp-persiapanproduksi',
  // 'tab-scan-cetak' grup top-level (sejajar Zevanic
  // House/Pesanan/Persiapan Produksi), lihat js/vue-scan-cetak.js.
  'tab-scan-cetak': 'navgrp-scancetak',
  // 'tab-proses-produksi' grup top-level (sejajar Persiapan Produksi/Scan &
  // Cetak), lihat js/vue-pp-cutting.js.
  'tab-proses-produksi': 'navgrp-prosesproduksi',
  'tab-whatsapp': 'navgrp-integrasi',
  'tab-mail-gateway': 'navgrp-integrasi',
  'tab-device-kiosk': 'navgrp-integrasi'
};
window.bukaGrupSidebarUntukTab = function(tabId) {
  setGrupSidebarTerbuka(petaGrupSidebarPerTab[tabId] || null);
};
// Sub-tab yang tombol sidebarnya ada di grup lain dari tab induknya: Serie
// isinya di tab-proses-produksi, tapi tombolnya di grup Collection.
const petaGrupSidebarPerSubTab = { 'sub-pr-serie': 'navgrp-collection' };

window.pindahTab = function(tabId, navKey, _dariPopstate) {
  // Tiap tab WAJIB terdaftar di array ini — tab yang tidak terdaftar tidak akan
  // pernah disembunyikan/ditampilkan.
  const tabs = ['tab-home', 'tab-profil', 'tab-admin-acc', 'tab-keuangan', 'tab-superuser', 'tab-zevanic-house', 'tab-stok-pembelian', 'tab-pesanan', 'tab-persiapan-produksi', 'tab-scan-cetak', 'tab-proses-produksi', 'tab-whatsapp', 'tab-mail-gateway', 'tab-device-kiosk', 'tab-scan-qr', 'tab-progress', 'tab-menu-lengkap', 'tab-atur-favorit'];
  const tabSebelumnya = tabs.find(t => {
    const el = document.getElementById(t);
    return el && !el.classList.contains('hidden');
  });

  // Satu entry riwayat browser per perpindahan tab, isinya snapshot gabungan
  // window._riwayatNavAktif {tab, navKey, subTabs}. JANGAN push kalau panggilan
  // ini berasal dari popstate (_dariPopstate) atau tab tujuannya sudah aktif —
  // riwayatnya jadi dobel/muter. URL sengaja tidak berubah (app tanpa routing).
  if (!_dariPopstate && tabSebelumnya !== tabId) {
    // Reset snapshot gabungan — pindah ke tab BEDA berarti semua sub-tab/
    // child-tab tab SEBELUMNYA sudah tidak relevan lagi buat riwayat.
    window._riwayatNavAktif = { tab: tabId, navKey: navKey || null, subTabs: [] };
    try {
      history.pushState(window._riwayatNavAktif, '', location.href);
    } catch (e) {
      console.error("Gagal catat riwayat navigasi tab (tidak fatal, navigasi tetap lanjut):", e);
    }
  }

  tabs.forEach(tab => {
    const elemenTab = document.getElementById(tab);
    if (elemenTab) elemenTab.classList.add('hidden');
  });

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.remove('hidden');
  if (window.aturHeaderKonteks) window.aturHeaderKonteks(tabId, null);
  if (window.bukaGrupSidebarUntukTab) window.bukaGrupSidebarUntukTab(tabId);

  // Tandai ikon nav mobile mana yang aktif. navKey opsional — dipakai khusus
  // untuk kasus 2 tombol berbeda (Absensi & Profile) yang sama-sama menuju
  // tab-profil, supaya masing-masing tetap tersorot sesuai yang benar-benar
  // diklik, bukan cuma ikut tabId apa adanya.
  document.querySelectorAll('.gc-mnav-item, .gc-mnav-scan').forEach(el => el.classList.remove('active'));
  const navBtn = document.querySelector('[data-navtab="' + (navKey || tabId) + '"]');
  if (navBtn) navBtn.classList.add('active');

  // Kamera Scan QR: nyala TEPAT saat tab-nya benar-benar dibuka, mati saat
  // pindah ke tab lain — bukan otomatis nyala dari awal (boros baterai & minta
  // izin kamera di waktu yang aneh kalau dilakukan dari awal muat halaman,
  // sebelum orang benar-benar mau pakai fiturnya).
  if (tabId === 'tab-scan-qr' && window.mulaiScanQr) window.mulaiScanQr();
  if (tabSebelumnya === 'tab-scan-qr' && tabId !== 'tab-scan-qr' && window.matikanScanQr) window.matikanScanQr();

  if (tabId === 'tab-admin-acc') {
      if (window.pindahSubTab) window.pindahSubTab('sub-absensi', 'sub-absensi-accept', document.querySelectorAll('.sub-absensi-btn')[2]);
  }
  if (tabId === 'tab-keuangan') {
      if (window.pindahSubTab) window.pindahSubTab('sub-keuangan', 'sub-keuangan-antrean', document.querySelectorAll('.sub-keuangan-btn')[0]);
  }
  if (tabId === 'tab-superuser') {
      if (window.pindahSubTab) window.pindahSubTab('sub-karyawan', 'sub-karyawan-antrean', document.querySelectorAll('.sub-karyawan-btn')[0]);
  }
  if (tabId === 'tab-zevanic-house') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', document.querySelectorAll('.sub-zevanic-house-btn')[0]);
        window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-entry');
      }
  }
  // landing default 'tab-stok-pembelian' (grup top-level baru, dipisah dari
  // Zevanic House > Stock & Pembelian): "Daftar Nota", sub-tab-strip-nya
  // (sub-zh-stock) TIDAK berubah sama sekali.
  if (tabId === 'tab-stok-pembelian') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-notaorder', document.querySelectorAll('.sub-zh-stock-btn')[0]);
      }
  }
  // landing default 'tab-persiapan-produksi' (grup top-level baru): "Perlu
  // Disiapkan", sama pola seperti tab-zevanic-house di atas.
  if (tabId === 'tab-persiapan-produksi') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-disiapkan', document.querySelectorAll('.sub-persiapan-produksi-btn')[0]);
      }
  }
  // landing default 'tab-pesanan' (grup top-level baru): "Penjualan Kasir"
  // (layar aksi utama sehari-hari, pola sama seperti
  // tab-zevanic-house/tab-persiapan-produksi di atas).
  if (tabId === 'tab-pesanan') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-pesanan', 'sub-pesanan-kasir', document.querySelectorAll('.sub-pesanan-btn')[0]);
      }
  }
  // landing default 'tab-scan-cetak' (grup top-level baru): "Scan Stok" (pola
  // sama seperti tab-pesanan di atas).
  if (tabId === 'tab-scan-cetak') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-stok', document.querySelectorAll('.sub-scan-cetak-btn')[0]);
        window.pindahSubTab('sub-scancetak-stok-tahap', 'sub-scancetak-stok-opname', document.querySelectorAll('.sub-scancetak-stok-tahap-btn')[0]);
      }
  }
  // landing default 'tab-proses- produksi' (grup top-level baru): "Cutting" >
  // "Perlu Di Proses" (pola sama seperti tab-scan-cetak di atas — cuma 1
  // sub-menu fungsional saat ini, sisanya placeholder alert di sidebar, lihat
  // js/vue-pp-cutting.js).
  if (tabId === 'tab-proses-produksi') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-proses-produksi', 'sub-pr-cutting', document.querySelectorAll('.sub-proses-produksi-btn')[0]);
        window.pindahSubTab('sub-pr-cutting-tahap', 'sub-pr-cutting-perludiproses', document.querySelectorAll('.sub-pr-cutting-tahap-btn')[0]);
      }
  }
  if (tabId === 'tab-whatsapp') {
      if (window.pastikanMountWhatsapp) window.pastikanMountWhatsapp();
  }
  if (tabId === 'tab-mail-gateway') {
      if (window.pastikanMountMailGateway) window.pastikanMountMailGateway();
  }
  if (tabId === 'tab-device-kiosk') {
      if (window.pastikanMountDeviceKiosk) window.pastikanMountDeviceKiosk();
  }
  
};

// Parameter ke-4 `opsi` opsional: tanpa opsi, tidak mencatat riwayat sama
// sekali. `opsi.catatRiwayat: true` opt-in riwayat browser dan MEWAJIBKAN
// tombolnya punya atribut data-target="<targetId>" (dipakai mencari tombol lagi
// saat restore). `opsi._dariPopstate: true` dipasang internal, cegah push loop.
window.pindahSubTab = function(grupKelas, targetId, tombolEl, opsi) {
  opsi = opsi || {};
  document.querySelectorAll('.' + grupKelas + '-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');
  // Target yang salah ketik dulu GAGAL DIAM-DIAM: panel tidak ketemu, layar
  // kosong, console bersih. Peringatan ini yang membuatnya ketahuan sekali
  // klik, bukan berbulan-bulan kemudian.
  else console.error('[pindahSubTab] Target "' + targetId + '" tidak ada di index.html. Grup: ' + grupKelas + '. Layar akan kosong.');
  if (petaGrupSidebarPerSubTab[targetId]) setGrupSidebarTerbuka(petaGrupSidebarPerSubTab[targetId]);

  // Popstate restore: tombolEl dikirim null oleh listener, dicari sendiri di
  // sini lewat data-target (makanya atribut itu WAJIB buat sub-tab yang ikut
  // opt-in riwayat).
  let elTombolAktif = tombolEl;
  if (!elTombolAktif && opsi._dariPopstate) {
    elTombolAktif = document.querySelector('.' + grupKelas + '-btn[data-target="' + targetId + '"]');
  }
  document.querySelectorAll('.' + grupKelas + '-btn').forEach(btn => btn.classList.remove('active'));
  // Satu grupKelas bisa punya >1 SALINAN baris tombol hidup bersamaan di DOM
  // (tiap Vue app mount-once, disembunyikan lewat CSS, bukan di-unmount). Class
  // 'active' karena itu disamakan ke SEMUA salinan yang data-target-nya cocok;
  // tombol tanpa data-target jatuh ke node yang benar-benar diklik.
  const salinanAktif = targetId ? document.querySelectorAll('.' + grupKelas + '-btn[data-target="' + targetId + '"]') : [];
  if (salinanAktif.length > 0) salinanAktif.forEach(btn => btn.classList.add('active'));
  else if (elTombolAktif) elTombolAktif.classList.add('active');

  if (opsi.catatRiwayat && !opsi._dariPopstate) {
    if (!window._riwayatNavAktif) window._riwayatNavAktif = { tab: null, navKey: null, subTabs: [] };
    const idxAda = window._riwayatNavAktif.subTabs.findIndex(s => s.grupKelas === grupKelas);
    const sudahSama = idxAda >= 0 && window._riwayatNavAktif.subTabs[idxAda].targetId === targetId;
    if (!sudahSama) {
      if (idxAda >= 0) window._riwayatNavAktif.subTabs[idxAda] = { grupKelas, targetId };
      else window._riwayatNavAktif.subTabs.push({ grupKelas, targetId });
      try {
        history.pushState(window._riwayatNavAktif, '', location.href);
      } catch (e) {
        console.error("Gagal catat riwayat navigasi sub-tab (tidak fatal, navigasi tetap lanjut):", e);
      }
    }
  }

  if (window.aturHeaderKonteks) {
    // Peta grupKelas sub-tab -> tab induk, dipakai aturHeaderKonteks. GrupKelas
    // yang tidak terdaftar di sini jatuh ke 'tab-lainnya'.
    const petaTabIndukPerGrup = { 'sub-absensi': 'tab-admin-acc', 'sub-keuangan': 'tab-keuangan', 'sub-karyawan': 'tab-superuser', 'sub-zevanic-house': 'tab-zevanic-house', 'sub-zh-databahan': 'tab-zevanic-house', 'sub-zh-suplayer': 'tab-zevanic-house', 'sub-zh-stock': 'tab-stok-pembelian', 'sub-zh-config': 'tab-zevanic-house', 'sub-pesanan': 'tab-pesanan', 'sub-persiapan-produksi': 'tab-persiapan-produksi', 'sub-pp-vendor-tahap': 'tab-persiapan-produksi', 'sub-pp-bahan-tahap': 'tab-persiapan-produksi', 'sub-pp-sewing-tahap': 'tab-persiapan-produksi', 'sub-pp-webbing-tahap': 'tab-persiapan-produksi', 'sub-pp-finishing-tahap': 'tab-persiapan-produksi', 'sub-pp-masalah-tahap': 'tab-persiapan-produksi', 'sub-scan-cetak': 'tab-scan-cetak', 'sub-scancetak-stok-tahap': 'tab-scan-cetak',
      'sub-proses-produksi': 'tab-proses-produksi', 'sub-pr-cutting-tahap': 'tab-proses-produksi', 'sub-pr-serie-tahap': 'tab-proses-produksi', 'sub-pr-sewing-tahap': 'tab-proses-produksi', 'sub-pr-finishing-tahap': 'tab-proses-produksi', 'sub-pr-finishing-sedang-sub': 'tab-proses-produksi', 'sub-pr-gudang-tahap': 'tab-proses-produksi', 'sub-pp-belanja-tahap': 'tab-persiapan-produksi' };
    window.aturHeaderKonteks(petaTabIndukPerGrup[grupKelas] || 'tab-lainnya', targetId);
  }

  // Komponen Vue di-mount di titik ini, bukan saat halaman dimuat — sub-tab
  // yang tidak pernah dibuka orang tidak pernah membaca Firestore sama sekali.
  // Tiap pastikanMountXxx WAJIB idempoten: dipanggil ulang tiap klik sub-tab,
  // dan cuma boleh benar-benar mount di panggilan pertama.
  const petaMount = {
    'sub-absensi-config': 'pastikanMountConfigAbsensi',
    'sub-absensi-jadwal': 'pastikanMountPenjadwalan',
    'sub-absensi-accept': 'pastikanMountAntreanAbsensi',
    'sub-absensi-lembur': 'pastikanMountAntreanLembur',
    'sub-absensi-rekap': 'pastikanMountRiwayatAbsensi',
    'sub-absensi-report': 'pastikanMountReportAbsensi',
    'sub-keuangan-antrean': 'pastikanMountAntreanReimburse',
    'sub-keuangan-kendaraan': 'pastikanMountMasterKendaraan',
    'sub-keuangan-kategori': 'pastikanMountMasterKeuangan',
    // 'sub-keuangan-riwayat-bensin'/'-servis' dihapus dari sini juga, gabung ke
    // 'sub-keuangan-riwayat-reimburse' (kini "Riwayat Keuangan"). Lihat
    // index.html + js/vue-reimburse.js.
    'sub-keuangan-riwayat-reimburse': 'pastikanMountRiwayatReimburse',
    'sub-karyawan-antrean': 'pastikanMountAntreanDakar',
    'sub-karyawan-config': 'pastikanMountConfigKaryawan',
    'sub-karyawan-info': 'pastikanMountConfigInfo',
    'sub-karyawan-data': 'pastikanMountDaftarKaryawan',
    // pastikanMountAksesKeamanan (js/vue-config-akses.js) memanggil 3 fungsi
    // mount sekaligus untuk pill Role/Jabatan/Assign; ketiganya idempoten.
    'sub-karyawan-akseskeamanan': 'pastikanMountAksesKeamanan',
    // Config, tab-tab child. "Jenis Produk" pola sama seperti "Data Ukuran";
    // "Data Komponen" pola sama seperti "Data Warna".
    'sub-zh-config-jenisbahan': 'pastikanMountConfigJenisBahan',
    'sub-zh-config-jenisaksesoris': 'pastikanMountConfigJenisAksesoris',
    'sub-zh-config-satuan': 'pastikanMountConfigSatuan',
    'sub-zh-config-warna': 'pastikanMountConfigWarna',
    'sub-zh-config-ukuran': 'pastikanMountConfigUkuran',
    'sub-zh-config-jenisproduk': 'pastikanMountConfigJenisProduk',
    'sub-zh-config-komponen': 'pastikanMountConfigKomponen',
    'sub-zh-config-tahappersiapan': 'pastikanMountConfigTahapPersiapan',
    // dulu 'sub-zh-config-suplayer': 'pastikanMountConfigSuplayer' (CRUD
    // Suplayer generik, PINDAH ke 3 entry Master Suplayer di bawah). Tab ini
    // sekarang "TLC & Prefix" (AppConfigTlc, koleksi master_tlc BARU).
    'sub-zh-config-tlc': 'pastikanMountConfigTlc',
    'sub-zh-config-resettesting': 'pastikanMountConfigResetTesting',
    // DIPINDAH — 'sub-zh-config-riwayatpin': 'pastikanMountConfigRiwayatPin'
    // pindah ke 'sub-scan-cetak-pin' di bawah (lihat js/vue-scan-cetak.js),
    // tombolnya sudah dicopot dari index.html.
    'sub-zh-databahan-entry': 'pastikanMountBahanAksesorisEntry',
    'sub-zh-databahan-list': 'pastikanMountBahanAksesorisList',
    // Zevanic House > Master Suplayer (3 sub-tab), lihat
    // js/vue-master-suplayer.js.
    'sub-zh-suplayer-entry': 'pastikanMountSuplayerEntry',
    'sub-zh-suplayer-alias-moq': 'pastikanMountSuplayerAliasMoq',
    'sub-zh-suplayer-petakan': 'pastikanMountSuplayerPetakan',
    // DIHAPUS — 'sub-zh-stock-listorder': 'pastikanMountListOrderBelanja' (tab &
    // mount "List Order Belanja" dihapus total, lihat vue-stock-pembelian.js).
    'sub-zh-stock-notaorder': 'pastikanMountNotaOrderBelanja',
    'sub-zh-stock-riwayat': 'pastikanMountRiwayatHargaPembelian',
    'sub-zh-stock-kartustok': 'pastikanMountKartuStok',
    // Rak Penyimpanan dipindah ke sini (dulu 'sub-zh-databahan-rak' di Data
    // Bahan & Aksesoris), lihat js/vue- rak-penyimpanan.js.
    'sub-zh-stock-rak': 'pastikanMountRakPenyimpanan',
    // 'sub-zh-stock-cetaklabel' tidak dipakai lagi — jangan dihidupkan ulang;
    // tab-nya tidak ada di index.html (Cetak Label sekarang tombol di List
    // Bahan & Aksesoris). Di bawah: Master Produk (BOM).
    'sub-zh-produk-entry': 'pastikanMountProdukEntry',
    'sub-zh-produk-list': 'pastikanMountProdukList',
    // Master Produk > HPP (wireframe step 2.3), Desktop-only.
    'sub-zh-produk-hpp': 'pastikanMountProdukHpp',
    // Master Pelanggan, single-view (lihat js/vue-master-pelanggan.js).
    'sub-zevanic-house-pelanggan': 'pastikanMountMasterPelanggan',
    // Persiapan Produksi V2, lihat js/vue-persiapan-produksi-v2.js. Jalur Vendor
    // TIDAK terdeteksi otomatis dari BOM — harus diaktifkan manual lewat
    // checkbox di "Perlu Disiapkan"; tahap scan dst-nya sendiri sudah penuh.
    'sub-pp-disiapkan': 'pastikanMountPpDisiapkan',
    // jalur Bahan sekarang js/vue-persiapan-bahan.js (kartu per bahan + warna),
    // BUKAN lagi JalurTahapManager generik. 2 tab pertama ganti nama div
    // (Perlu/Sedang DISIAPKAN, bukan Diproses).
    'sub-pp-bahan-perludisiapkan': 'pastikanMountPpBahanPerluDisiapkan',
    'sub-pp-bahan-sedangdisiapkan': 'pastikanMountPpBahanSedangDisiapkan',
    'sub-pp-bahan-perludikirim': 'pastikanMountPpBahanPerluDikirim',
    'sub-pp-bahan-sedangdikirim': 'pastikanMountPpBahanSedangDikirim',
    'sub-pp-bahan-selesai': 'pastikanMountPpBahanSelesai',
    'sub-pp-sewing-perludisiapkan': 'pastikanMountPpSewingPerluDisiapkan',
    'sub-pp-sewing-sedangdisiapkan': 'pastikanMountPpSewingSedangDisiapkan',
    'sub-pp-sewing-perludikirim': 'pastikanMountPpSewingPerluDikirim',
    'sub-pp-sewing-sedangdikirim': 'pastikanMountPpSewingSedangDikirim',
    'sub-pp-sewing-selesai': 'pastikanMountPpSewingSelesai',
    'sub-pp-webbing-perludisiapkan': 'pastikanMountPpWebbingPerluDisiapkan',
    'sub-pp-webbing-sedangdisiapkan': 'pastikanMountPpWebbingSedangDisiapkan',
    'sub-pp-webbing-perludikirim': 'pastikanMountPpWebbingPerluDikirim',
    'sub-pp-webbing-sedangdikirim': 'pastikanMountPpWebbingSedangDikirim',
    'sub-pp-webbing-selesai': 'pastikanMountPpWebbingSelesai',
    'sub-pp-finishing-perludisiapkan': 'pastikanMountPpFinishingPerluDisiapkan',
    'sub-pp-finishing-sedangdisiapkan': 'pastikanMountPpFinishingSedangDisiapkan',
    'sub-pp-finishing-perludikirim': 'pastikanMountPpFinishingPerluDikirim',
    'sub-pp-finishing-sedangdikirim': 'pastikanMountPpFinishingSedangDikirim',
    'sub-pp-finishing-selesai': 'pastikanMountPpFinishingSelesai',
    'sub-pp-vendor-perludiproses': 'pastikanMountPpVendorPerluDiproses',
    'sub-pp-vendor-sedangdiproses': 'pastikanMountPpVendorSedangDiproses',
    'sub-pp-vendor-perludikirim': 'pastikanMountPpVendorPerluDikirim',
    'sub-pp-vendor-sedangdikirim': 'pastikanMountPpVendorSedangDikirim',
    'sub-pp-vendor-selesai': 'pastikanMountPpVendorSelesai',
    // Persiapan Produksi > Masalah, 7 tahap (skema TRB baru), lihat
    // js/vue-pp-masalah.js.
    'sub-pp-masalah-perludiajukan': 'pastikanMountPpMasalahPerluDiajukan',
    'sub-pp-masalah-menunggusetuju': 'pastikanMountPpMasalahMenungguSetuju',
    'sub-pp-masalah-diajukanbelanja': 'pastikanMountPpMasalahDiajukanBelanja',
    'sub-pp-masalah-perludisiapkan': 'pastikanMountPpMasalahPerluDisiapkan',
    'sub-pp-masalah-sedangdisiapkan': 'pastikanMountPpMasalahSedangDisiapkan',
    'sub-pp-masalah-perludikirim': 'pastikanMountPpMasalahPerluDiKirim',
    'sub-pp-masalah-sedangdikirim': 'pastikanMountPpMasalahSedangDiKirim',
    'sub-pp-masalah-selesai': 'pastikanMountPpMasalahSelesai',
    // DIPINDAH — Scan Opname/Persiapan pindah dari
    // 'sub-zh-scan-opname'/'sub-zh-scan-persiapan' (Zevanic House) ke
    // 'sub-scancetak-stok-opname'/'sub-scancetak-stok-persiapan' (menu top-level
    // baru "Scan & Cetak"). Fungsi mount TIDAK berubah.
    'sub-scancetak-stok-opname': 'pastikanMountScanOpname',
    // Scan & Cetak > PIN (Riwayat PIN, dipindah dari Zevanic House > Config),
    // lihat js/vue-scan-cetak.js.
    'sub-scan-cetak-pin': 'pastikanMountScanCetakRiwayatPin',
    // Scan & Cetak > Cetak, sekarang juga memuat AppPengaturanCetak (ukuran
    // kertas/posisi QR/rincian tambahan per jenis cetak), lihat
    // js/vue-pengaturan-cetak.js.
    'sub-scan-cetak-cetak': 'pastikanMountPengaturanCetak',
    // Scan & Cetak > Pilihan Scan — admin atur sheet "Mau scan apa?" per
    // menu tanpa ubah kode, lihat js/vue-pilihan-scan-config.js.
    'sub-scan-cetak-pilihanscan': 'pastikanMountPilihanScanConfig',
    // REKONSTRUKSI: Penjualan Kasir (1.1/1.2), Menunggu Proses (2.1, keputusan
    // QO Owner/PIC Owner), Daftar Pesanan (3.1-3.2.1), Transaksi Keuangan
    // (4.1-4.2.2, piutang).
    'sub-pesanan-kasir': 'pastikanMountPesananKasir',
    'sub-pesanan-menunggu': 'pastikanMountPesananMenunggu',
    'sub-pesanan-daftar': 'pastikanMountPesananDaftar',
    'sub-pesanan-transaksi': 'pastikanMountPesananTransaksi',
    // Proses Produksi > Cutting, 7 tahap, lihat js/vue-pp-cutting.js.
    'sub-pr-cutting-perludiproses': 'pastikanMountCuttingPerluDiProses',
    'sub-pr-cutting-sedangampar': 'pastikanMountCuttingSedangAmpar',
    'sub-pr-cutting-sedangpola': 'pastikanMountCuttingSedangPola',
    'sub-pr-cutting-sedangcutting': 'pastikanMountCuttingSedangCutting',
    'sub-pr-cutting-perludikirim': 'pastikanMountCuttingPerluDiKirim',
    'sub-pr-cutting-sedangdikirim': 'pastikanMountCuttingSedangDiKirim',
    'sub-pr-cutting-selesai': 'pastikanMountCuttingSelesai',
    // Proses Produksi > Serie, 11 tahap (hub distribusi), lihat
    // js/vue-pp-serie.js.
    'sub-pr-serie-perludiproses': 'pastikanMountSeriePerluDiProses',
    'sub-pr-serie-sedangdiproses': 'pastikanMountSerieSedangDiProses',
    'sub-pr-serie-perludikirim': 'pastikanMountSeriePerluDiKirim',
    'sub-pr-serie-kirimsewing': 'pastikanMountSerieKirimSewing',
    'sub-pr-serie-setorsewing': 'pastikanMountSerieSetorSewing',
    'sub-pr-serie-terimasewing': 'pastikanMountSerieTerimaSewing',
    'sub-pr-serie-kirimfinishing': 'pastikanMountSerieKirimFinishing',
    'sub-pr-serie-setorfinishing': 'pastikanMountSerieSetorFinishing',
    'sub-pr-serie-terimafinishing': 'pastikanMountSerieTerimaFinishing',
    'sub-pr-serie-kirimgudang': 'pastikanMountSerieKirimGudang',
    'sub-pr-serie-selesai': 'pastikanMountSerieSelesai',
    // Proses Produksi > Sewing, 5 tahap, lihat js/vue-pp-sewing.js.
    'sub-pr-sewing-perludiproses': 'pastikanMountSewingPerluDiProses',
    'sub-pr-sewing-sedangsewing': 'pastikanMountSewingSedangSewing',
    'sub-pr-sewing-perludikirim': 'pastikanMountSewingPerluDikirim',
    'sub-pr-sewing-sedangkirim': 'pastikanMountSewingSedangKirim',
    'sub-pr-sewing-selesai': 'pastikanMountSewingSelesai',
    // Proses Produksi > Finishing, 5 tab (4.2 "Sedang Finishing" punya 4 sub-tab
    // nested QC/Steam/Folding/Packing), lihat js/vue-pp-finishing.js.
    'sub-pr-finishing-perludiproses': 'pastikanMountFinishingPerluDiProses',
    'sub-pr-finishing-sedangqc': 'pastikanMountFinishingSedangQc',
    'sub-pr-finishing-sedangsteam': 'pastikanMountFinishingSedangSteam',
    'sub-pr-finishing-sedangfolding': 'pastikanMountFinishingSedangFolding',
    'sub-pr-finishing-sedangpacking': 'pastikanMountFinishingSedangPacking',
    'sub-pr-finishing-perludikirim': 'pastikanMountFinishingPerluDikirim',
    'sub-pr-finishing-sedangkirim': 'pastikanMountFinishingSedangKirim',
    'sub-pr-finishing-selesai': 'pastikanMountFinishingSelesai',
    // Proses Produksi > Gudang Barang Jadi, 4 tab, lihat js/vue-pp-gudang.js.
    'sub-pr-gudang-perludisimpan': 'pastikanMountGudangPerluDisimpan',
    'sub-pr-gudang-stoktersedia': 'pastikanMountGudangStokTersedia',
    'sub-pr-gudang-riwayatkeluar': 'pastikanMountGudangRiwayatKeluar',
    'sub-pr-gudang-scanopname': 'pastikanMountGudangScanOpname',
    // Persiapan Produksi > Persiapan Belanja, 4 tab, lihat
    // js/vue-persiapan-belanja.js.
    'sub-pp-belanja-persiapanadmin': 'pastikanMountPpBelanjaPersiapanAdmin',
    'sub-pp-belanja-menungguacc': 'pastikanMountPpBelanjaMenungguAcc',
    'sub-pp-belanja-listorderdriver': 'pastikanMountPpBelanjaListOrderDriver',
    'sub-pp-belanja-riwayat': 'pastikanMountPpBelanjaRiwayat'
  };
  const namaFungsiMount = petaMount[targetId];
  if (namaFungsiMount && window[namaFungsiMount]) window[namaFungsiMount]();
};


// Back/forward browser: pindahTab mencatat entry-nya, listener ini memulihkan
// dengan _dariPopstate=true supaya tidak push ulang. state null = sudah lewat
// entry sebelum app dibuka, biarkan browser keluar. state.subTabs WAJIB urut
// PALING LUAR ke PALING DALAM. Perpindahan layar (pindahLayar) tidak dicakup.
window.addEventListener('popstate', (e) => {
  const state = e.state;
  if (!state) return;
  window._riwayatNavAktif = state;
  if (state.tab) {
    window.pindahTab(state.tab, state.navKey, true);
  }
  if (Array.isArray(state.subTabs)) {
    state.subTabs.forEach(entry => {
      if (window.pindahSubTab) {
        window.pindahSubTab(entry.grupKelas, entry.targetId, null, { catatRiwayat: false, _dariPopstate: true });
      }
    });
  }
  // Level 3 — tab INTERNAL komponen Vue (lihat js/vue-riwayat-tab.js). SENGAJA
  // dijalankan PALING TERAKHIR, setelah subTabs di atas — supaya komponen Vue
  // tujuannya sudah pasti ke-mount duluan (lewat pastikanMountXxx yang otomatis
  // terpanggil dari pindahSubTab) sebelum handler restore-nya dipanggil.
  if (Array.isArray(state.vueTabs)) {
    state.vueTabs.forEach(entry => {
      const handler = window['_restoreVueTab_' + entry.nama];
      if (handler) handler(entry.nilai);
    });
  }
});

// Account Profile (Account/QR, Data Karyawan self-edit, Absensi dengan
// Izin/Cuti/Lembur + riwayat) sudah pindah ke js/vue-account-profile.js.
// window.mulaiHitungJamKerja TETAP dipertahankan (dipanggil dari Vue).


// "Riwayat ACC" (fitur terpisah, tumpang tindih dengan Riwayat All Absensi)
// sudah dihapus sepenuhnya atas permintaan — window.muatDataRiwayatACC tidak ada
// lagi.

// window.exportKeCSV membaca window.dataRiwayatGlobal yang diisi layar lain
// (laporan personal Account Profile > Absensi). Tabel Riwayat All Absensi
// sendiri ada di js/vue-riwayat-absensi.js.

window.exportKeCSV = function() {
  if (!window.dataRiwayatGlobal || window.dataRiwayatGlobal.length === 0) {
    return alert("Tidak ada data untuk di-export saat ini.");
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Nama Pegawai,Email,Waktu Presensi,Tipe Presensi,Lokasi Gudang,Shift,Seragam,Status Persetujuan\n";

  window.dataRiwayatGlobal.forEach(row => {
    const nama = `"${(row.nama_pegawai || row.nama || '').replace(/"/g, '""')}"`;
    const email = `"${(row.email || '').replace(/"/g, '""')}"`;
    const waktu = `"${row.waktu || ''}"`;
    const status = `"${row.status || 'HADIR'}"`;
    const gudang = `"${row.gudang || '-'}"`;
    const shift = `"${row.shift || '-'}"`;
    const seragam = `"${row.seragam || 'Sesuai'}"`;
    const statusAcc = `"${row.status_acc || 'PENDING'}"`;

    csvContent += `${nama},${email},${waktu},${status},${gudang},${shift},${seragam},${statusAcc}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Data_Absensi_Zevanic_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Aju Banding (window._bandingFileGlobal/bukaModalAjuBanding/
// tutupModalAjuBanding/pilihFileBanding/kirimAjuBanding) sudah pindah ke
// komponen AjuBandingModal di js/vue-account-profile.js.


// Palet Ctrl+K: daftar hasil DIBACA dari DOM sidebar (atribut
// data-menu-id/data-menu-ids di .gc-sidebar), bukan daftar hardcode terpisah,
// dan memilih hasil = .click() tombol sidebar ASLI supaya perilakunya identik.
// Filter contains + tidak peka huruf besar-kecil, murni client, nol baca Firestore.

(function paletPencarianGlobal() {
  const btnBuka = document.getElementById('btnPaletDesktop');
  const overlay = document.getElementById('paletOverlayDesktop');
  const input = document.getElementById('inputPaletDesktop');
  const hasilWrap = document.getElementById('paletHasilDesktop');
  if (!btnBuka || !overlay || !input || !hasilWrap) return; // topbar/palet tidak ada di layar ini

  function kumpulkanItem() {
    const daftar = [];
    const btnDash = document.querySelector('.gc-sidebar nav > button[onclick*="tab-home"]');
    const btnProfil = document.querySelector('.gc-sidebar nav > button[onclick*="tab-profil"]');
    if (btnDash) daftar.push({ label: btnDash.textContent.trim(), grup: 'Umum', el: btnDash });
    if (btnProfil) daftar.push({ label: btnProfil.textContent.trim(), grup: 'Umum', el: btnProfil });
    document.querySelectorAll('.gc-sidebar [data-menu-id], .gc-sidebar [data-menu-ids]').forEach(function (el) {
      const label = el.textContent.trim();
      if (!label) return;
      const subgroup = el.closest('.gc-nav-subgroup');
      let grup = 'Umum';
      if (subgroup && subgroup.previousElementSibling) {
        grup = subgroup.previousElementSibling.textContent.trim();
      }
      daftar.push({ label: label, grup: grup, el: el });
    });
    return daftar;
  }

  let semuaItem = [];
  let hasilTampil = [];

  function render() {
    if (!hasilTampil.length) {
      hasilWrap.innerHTML = '<div class="gc-notif-empty">Tidak ada menu cocok.</div>';
      return;
    }
    hasilWrap.innerHTML = hasilTampil.slice(0, 24).map(function (item, i) {
      return '<div class="gc-palet-item' + (i === 0 ? ' aktif' : '') + '" data-idx="' + i + '">' +
        '<span class="gc-palet-label">' + item.label + '</span>' +
        '<span class="gc-palet-grup">' + item.grup + '</span></div>';
    }).join('');
  }

  function saring(kata) {
    const k = kata.trim().toLowerCase();
    hasilTampil = !k ? semuaItem : semuaItem.filter(function (item) { return item.label.toLowerCase().indexOf(k) !== -1; });
    render();
  }

  function buka() {
    semuaItem = kumpulkanItem();
    hasilTampil = semuaItem;
    input.value = '';
    overlay.hidden = false;
    render();
    setTimeout(function () { input.focus(); }, 0);
  }
  function tutup() { overlay.hidden = true; }

  function pilih(idx) {
    const item = hasilTampil[idx];
    if (!item) return;
    tutup();
    item.el.click();
  }

  btnBuka.addEventListener('click', buka);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) tutup(); });
  input.addEventListener('input', function () { saring(input.value); });
  hasilWrap.addEventListener('click', function (e) {
    const row = e.target.closest('.gc-palet-item');
    if (row) pilih(Number(row.dataset.idx));
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (overlay.hidden) buka(); else tutup();
    } else if (e.key === 'Escape' && !overlay.hidden) {
      tutup();
    } else if (!overlay.hidden && e.key === 'Enter') {
      const aktif = hasilWrap.querySelector('.gc-palet-item');
      if (aktif) pilih(Number(aktif.dataset.idx));
    }
  });
})();

// Ikon tema sidebar desktop di-update manual lewat DOM karena sidebar desktop
// HTML statis, bukan Vue. Sumber kebenarannya tetap window.toggleTema /
// window.temaPreferensi di index.html — jangan bikin logic tema sendiri.
(function temaSidebarDesktop() {
  function kelasIkon(pref) {
    return pref === 'auto' ? 'fa-circle-half-stroke' : (pref === 'dark' ? 'fa-moon' : 'fa-sun');
  }
  function perbarui() {
    const el = document.getElementById('ikonTemaSidebarDesktop');
    if (!el) return; // topbar/sidebar tidak ada di layar ini
    const pref = window.temaPreferensi ? window.temaPreferensi() : 'light';
    el.className = 'fas ' + kelasIkon(pref);
  }
  window.toggleTemaSidebarDesktop = function () {
    if (window.toggleTema) window.toggleTema();
    perbarui();
  };
  window.addEventListener('zevanic-tema-berubah', perbarui);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', perbarui);
  } else {
    perbarui();
  }
})();

// Avatar inisial footer sidebar desktop. WAJIB dipanggil dari js/auth.js &
// js/dashboard.js di TIAP titik yang mengisi #teks-nama-user — grep
// "teks-nama-user" sebelum mengubah titik panggilnya.
window.perbaruiAvatarSidebarDesktop = function () {
  const el = document.getElementById('sidebarAvatarInisial');
  if (!el) return;
  const nama = (window.currentUser && (window.currentUser.name || window.currentUser.nama)) || '';
  const bersih = nama.trim();
  el.textContent = !bersih ? '?' : (function () {
    const kata = bersih.split(/\s+/);
    return kata.length === 1 ? kata[0].slice(0, 2).toUpperCase() : (kata[0][0] + kata[kata.length - 1][0]).toUpperCase();
  })();
};

// Subjudul (shift · gudang) footer sidebar desktop. Ambil dari field yang sudah
// ada di window.currentUser (nama_shift, gudang_penempatan lewat
// window.normalisasiGudang) — jangan tambah query Firestore baru.
window.perbaruiInfoSidebarDesktop = function () {
  const el = document.getElementById('teks-info-sidebar-desktop');
  if (!el) return;
  const shift = (window.currentUser && window.currentUser.nama_shift) || '';
  const gudangList = window.normalisasiGudang ? window.normalisasiGudang(window.currentUser && window.currentUser.gudang_penempatan) : [];
  const gudang = (gudangList && gudangList.length > 0) ? gudangList.join(', ') : '';
  const bagian = [shift, gudang].filter(Boolean);
  el.textContent = bagian.length ? bagian.join(' · ') : '-';
};