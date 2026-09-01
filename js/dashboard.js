// js/dashboard.js
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
    await updateDoc(userRef, { nama: namaBaru, hp: hpBaru });
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

// simpanKeFirebase & kirimDataKeCloud (submit selfie ke Firestore) sudah
// pindah ke js/vue-camera.js.


// ====== PANEL ACC PIC & VALIDASI ======

window.bukaPreviewFoto = function(src) {
  document.getElementById('img-preview-besar').src = src;
  document.getElementById('modal-preview-foto').classList.remove('hidden');
};
window.tutupPreviewFoto = function() {
  document.getElementById('modal-preview-foto').classList.add('hidden');
  document.getElementById('img-preview-besar').src = "";
};

// ====== ZONA KONTROL OWNER ======
// Tabel Daftar Karyawan (dulu window.muatDataSuperUser/hapusKaryawan) sudah
// pindah ke js/vue-daftar-karyawan.js.

// =========================================================================
// ANTREAN KARYAWAN (Antrean Dakar) — sudah pindah ke js/vue-antrean-dakar.js.
// Dipakai ulang di sana: GudangCheckboxSelect (vue-components.js),
// window.ambilMasterList, window.ambilTemplateWA, window.kirimPesanWhatsapp.
// =========================================================================


// WhatsApp Gateway (Config API, Template Pesan, Monitoring Respon) sudah
// pindah ke js/vue-whatsapp-gateway.js. window.kirimPesanWhatsapp (auth.js)
// TETAP dipertahankan — masih dipakai alur registrasi/approval.


// Modal Edit Karyawan (dulu window.isiSelectDariMaster/bukaEditUser/
// tutupEditUser/simpanEditUser) sudah pindah ke js/vue-daftar-karyawan.js.

// =========================================================================
// MODUL CONFIG ABSENSI (Master Gudang & Master Shift) — UI-nya sudah pindah
// ke js/vue-config-absensi.js. Koleksi Firestore "master_gudang" dan
// "master_shift" TETAP dibaca langsung (skema field sama persis) oleh
// bagian yang belum dimigrasi: geofencing di camera.js, Penjadwalan,
// Daftar Karyawan, dan Antrean Dakar.
// =========================================================================


// Kecamatan dikecualikan (lihat fungsi khusus di bawah) karena strukturnya
// bertingkat per Kabupaten.
// =========================================================================
const MASTER_DATA_DEFAULT = {
  jenis_pekerjaan: ["Full Time", "Part Time", "Harian"],
  status_kerja: ["Aktif", "Tidak Aktif", "Resign"],
  // "status_pengguna" dihapus dari sini (17 Agt 2026) — sudah tidak
  // dibaca di manapun lagi, role sekarang dikelola lewat Config Akses +
  // Hak Akses (koleksi akses_config). Lihat catatan di vue-config-karyawan.js.
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

// Catatan migrasi Vue: fungsi UI Master Data (tambah/lihat/hapus item,
// termasuk Kecamatan) sudah dipindah ke js/vue-components.js +
// js/vue-config-karyawan.js. window.ambilMasterList dan
// window.ambilKecamatanUntukKabupaten TETAP dipertahankan di sini karena
// masih dipakai layar yang belum dimigrasi (Antrean Dakar, Registrasi).


// Master Shift UI dipindah ke js/vue-config-absensi.js.

// =========================================================================
// Penjadwalan (ringkasan per-gudang, filter, pilih massal, update massal,
// pagination, export/import Excel) sudah pindah ke js/vue-penjadwalan.js.
// =========================================================================

// =========================================================================
// ====== LOGIKA PERPINDAHAN HALAMAN UTAMA (ANTI KETUMPUK) =================
// =========================================================================

// setGrupSidebarTerbuka / toggleNavGroup / bukaGrupSidebarUntukTab — DIROMBAK
// (24 Agt 2026, revisi permintaan Guru) — SEKARANG dipakai SEMUA grup
// sidebar (Master Absensi/Keuangan/Karyawan/Zevanic House/Integrasi), pola
// SERAGAM: parent (klik = buka/tutup) > sub-menu nested di bawahnya.
// ACCORDION — buka 1 grup, yang lain otomatis tutup (biar sidebar tetap
// rapi walau daftarnya panjang) — dicari lewat atribut data-group di tiap
// tombol parent, BUKAN daftar id di-hardcode di sini, supaya kalau ada
// grup baru nanti tinggal tambah tombol+data-group di index.html saja.
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
    // BARU (30 Agt 2026, sesi lanjutan) — class buat warnai ikon+latar
    // tombol kepala grup saat grup-nya terbuka (persis mockup, lihat
    // .gc-grp-buka di css/gechoo-design.css). Dulu tidak ada state ini
    // sama sekali di tombol parent-nya sendiri, cuma chevron yang berubah.
    btn.classList.toggle('gc-grp-buka', cocok);
  });
}
window.toggleNavGroup = function(groupId) {
  const el = document.getElementById(groupId);
  if (!el) return;
  const sedangTerbuka = !el.classList.contains('hidden');
  setGrupSidebarTerbuka(sedangTerbuka ? null : groupId); // klik ulang grup yg sudah terbuka -> tutup semua
};
// bukaGrupSidebarUntukTab — dipanggil dari pindahTab() supaya begitu
// pindah tab (klik sub-menu, tombol back/forward, dsb), grup sidebar yang
// relevan OTOMATIS ikut terbuka — jangan sampai orang pindah halaman tapi
// sidebar-nya masih nutup/nunjuk ke grup lain, bingung nyarinya.
const petaGrupSidebarPerTab = {
  'tab-admin-acc': 'navgrp-absensi',
  'tab-keuangan': 'navgrp-keuangan',
  'tab-superuser': 'navgrp-karyawan',
  'tab-zevanic-house': 'navgrp-zevanic',
  // BARU (30 Agt 2026, fitur "Pesanan") — 'tab-pesanan' grup top-level
  // BARU (sejajar Zevanic House/Persiapan Produksi), lihat js/vue-pesanan.js.
  'tab-pesanan': 'navgrp-pesanan',
  // BARU (29 Agt 2026, koreksi arsitektur menu) — 'tab-persiapan-produksi'
  // grup top-level BARU (sejajar Zevanic House), lihat STATUS-PROYEK.md
  // §44.13.
  'tab-persiapan-produksi': 'navgrp-persiapanproduksi',
  'tab-whatsapp': 'navgrp-integrasi',
  'tab-mail-gateway': 'navgrp-integrasi',
  'tab-device-kiosk': 'navgrp-integrasi'
};
window.bukaGrupSidebarUntukTab = function(tabId) {
  setGrupSidebarTerbuka(petaGrupSidebarPerTab[tabId] || null);
};

window.pindahTab = function(tabId, navKey, _dariPopstate) {
  // BARU (28 Agt 2026, redesain "Gechoo Mobile Organic") — 'tab-menu-lengkap'
  // & 'tab-atur-favorit' (layar baru, lihat js/vue-menu-lengkap.js &
  // js/vue-atur-favorit.js, dibuka dari js/vue-home.js) didaftarkan di sini
  // supaya ikut disembunyikan/ditampilkan seperti tab lain.
  // BARU (29 Agt 2026) — 'tab-persiapan-produksi' (grup top-level baru,
  // lihat STATUS-PROYEK.md §44.13). BARU (30 Agt 2026) — 'tab-pesanan'
  // (grup top-level baru, lihat js/vue-pesanan.js).
  const tabs = ['tab-home', 'tab-profil', 'tab-admin-acc', 'tab-keuangan', 'tab-superuser', 'tab-zevanic-house', 'tab-pesanan', 'tab-persiapan-produksi', 'tab-whatsapp', 'tab-mail-gateway', 'tab-device-kiosk', 'tab-scan-qr', 'tab-progress', 'tab-menu-lengkap', 'tab-atur-favorit'];
  const tabSebelumnya = tabs.find(t => {
    const el = document.getElementById(t);
    return el && !el.classList.contains('hidden');
  });

  // BARU (23 Agt 2026) — Browser History API, lihat STATUS-PROYEK.md §19.4.
  // DIPERLUAS (28 Agt 2026, §39) — sekarang mencatat SATU snapshot
  // `window._riwayatNavAktif` gabungan (tab + semua sub-tab/child-tab
  // yang ikut opt-in `catatRiwayat`), bukan cuma {tab,navKey} sendirian
  // — lihat STATUS-PROYEK.md §22.3/§39 buat desain lengkapnya. Catat
  // perpindahan tab INI sebagai 1 entry riwayat browser, KECUALI kalau
  // panggilan ini sendiri HASIL dari tombol back/forward (_dariPopstate,
  // dipasang oleh listener 'popstate' di bawah — jangan sampai push lagi,
  // nanti muter/dobel) atau tab tujuannya SAMA dengan yang sudah aktif
  // (hindari entry kosong berulang). URL tidak berubah (app ini tanpa
  // routing) — cuma dipakai sebagai "jejak" internal buat tombol back HP.
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

  // Tandai ikon nav mobile mana yang aktif. navKey opsional — dipakai
  // khusus untuk kasus 2 tombol berbeda (Absensi & Profile) yang sama-sama
  // menuju tab-profil, supaya masing-masing tetap tersorot sesuai yang
  // benar-benar diklik, bukan cuma ikut tabId apa adanya.
  document.querySelectorAll('.gc-mnav-item, .gc-mnav-scan').forEach(el => el.classList.remove('active'));
  const navBtn = document.querySelector('[data-navtab="' + (navKey || tabId) + '"]');
  if (navBtn) navBtn.classList.add('active');

  // Kamera Scan QR: nyala TEPAT saat tab-nya benar-benar dibuka, mati saat
  // pindah ke tab lain — bukan otomatis nyala dari awal (boros baterai &
  // minta izin kamera di waktu yang aneh kalau dilakukan dari awal muat
  // halaman, sebelum orang benar-benar mau pakai fiturnya).
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
  // BARU (29 Agt 2026) — landing default 'tab-persiapan-produksi' (grup
  // top-level baru): "Perlu Disiapkan", sama pola seperti tab-zevanic-house
  // di atas.
  if (tabId === 'tab-persiapan-produksi') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-disiapkan', document.querySelectorAll('.sub-persiapan-produksi-btn')[0]);
      }
  }
  // BARU (30 Agt 2026) — landing default 'tab-pesanan' (grup top-level
  // baru): "Penjualan Kasir" (layar aksi utama sehari-hari, pola sama
  // seperti tab-zevanic-house/tab-persiapan-produksi di atas).
  if (tabId === 'tab-pesanan') {
      if (window.pindahSubTab) {
        window.pindahSubTab('sub-pesanan', 'sub-pesanan-kasir', document.querySelectorAll('.sub-pesanan-btn')[0]);
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

// pindahSubTab: SEBELUMNYA dipanggil di banyak tombol (Config Absensi,
// Penjadwalan, Daftar Karyawan, dst) tapi definisinya sendiri hilang/kehapus
// tidak sengaja di masa lalu — tombol-tombol itu praktis mati (klik tidak
// berbuat apa-apa, cuma error di Console). Diperbaiki di sini, sekalian
// pindah dari cara lama (gonta-ganti banyak class Tailwind manual) ke class
// gc-sub-tab-btn/active yang lebih sederhana.
//
// BARU (28 Agt 2026, §39) — parameter ke-4 `opsi` (opsional, default {}),
// backward-compatible: TIDAK dikirim = PERSIS perilaku lama, tidak mencatat
// riwayat apapun (semua pemanggil lama otomatis aman). `opsi.catatRiwayat:
// true` → sub-tab/child-tab ini opt-in ke riwayat browser (WAJIB tombolnya
// punya atribut `data-target="<targetId>"`, dipakai buat cari tombol lagi
// pas restore dari popstate). `opsi._dariPopstate: true` → dipasang
// INTERNAL oleh listener popstate sendiri, supaya tidak push ulang (cegah
// loop). Lihat STATUS-PROYEK.md §22.3/§39 buat desain lengkapnya.
window.pindahSubTab = function(grupKelas, targetId, tombolEl, opsi) {
  opsi = opsi || {};
  document.querySelectorAll('.' + grupKelas + '-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');

  // Popstate restore: tombolEl dikirim null oleh listener, dicari sendiri
  // di sini lewat data-target (makanya atribut itu WAJIB buat sub-tab yang
  // ikut opt-in riwayat).
  let elTombolAktif = tombolEl;
  if (!elTombolAktif && opsi._dariPopstate) {
    elTombolAktif = document.querySelector('.' + grupKelas + '-btn[data-target="' + targetId + '"]');
  }
  document.querySelectorAll('.' + grupKelas + '-btn').forEach(btn => btn.classList.remove('active'));
  if (elTombolAktif) elTombolAktif.classList.add('active');

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
    // BARU (29 Agt 2026) — 'sub-persiapan-produksi' + 5 sub-jalur (vendor/
    // bahan/sewing/webbing/finishing) -> 'tab-persiapan-produksi' (grup
    // top-level baru). 'sub-zh-persiapanproduksi' (versi LAMA, nested di
    // Zevanic House) DIHAPUS dari peta ini — tombolnya sudah dicopot dari
    // index.html, tidak ada lagi yang memanggilnya.
    // BARU (30 Agt 2026) — 'sub-pesanan' -> 'tab-pesanan' (grup top-level
    // baru, lihat js/vue-pesanan.js).
    const petaTabIndukPerGrup = { 'sub-absensi': 'tab-admin-acc', 'sub-keuangan': 'tab-keuangan', 'sub-karyawan': 'tab-superuser', 'sub-zevanic-house': 'tab-zevanic-house', 'sub-zh-databahan': 'tab-zevanic-house', 'sub-zh-stock': 'tab-zevanic-house', 'sub-zh-config': 'tab-zevanic-house', 'sub-zh-scan': 'tab-zevanic-house', 'sub-pesanan': 'tab-pesanan', 'sub-persiapan-produksi': 'tab-persiapan-produksi', 'sub-pp-vendor-tahap': 'tab-persiapan-produksi', 'sub-pp-bahan-tahap': 'tab-persiapan-produksi', 'sub-pp-sewing-tahap': 'tab-persiapan-produksi', 'sub-pp-webbing-tahap': 'tab-persiapan-produksi', 'sub-pp-finishing-tahap': 'tab-persiapan-produksi' };
    window.aturHeaderKonteks(petaTabIndukPerGrup[grupKelas] || 'tab-lainnya', targetId);
  }

  // Perbaikan bug "Memuat data..." macet — TAPI hemat baca Firestore:
  // ambil data cuma pas sub-tab-nya BENAR-BENAR dibuka orang (bukan buat
  // SEMUA orang pas login, termasuk operator yang tidak punya akses ke
  // menu ini sama sekali). Di titik ini juga sudah pasti lama setelah
  // login berhasil, jadi tidak mungkin lagi kena masalah timing Auth.
  //
  // PERBAIKAN BESAR (menggantikan cara lama window.subTabSudahDimuat):
  // sebelumnya komponennya SUDAH ter-mount dari awal (cuma disembunyikan
  // CSS), jadi onMounted-nya tetap jalan sendiri saat halaman dibuka —
  // walau ada pelacakan "sekali per sesi" di SINI, itu cuma mencegah
  // panggilan ULANG, TIDAK mencegah panggilan PERTAMA yang otomatis dari
  // onMounted saat mount awal. Sekarang componentnya BARU di-mount() lewat
  // window.pastikanMountXxx() di titik INI — jadi kalau orang tidak pernah
  // klik ke sub-tab ini, komponennya tidak pernah lahir sama sekali, dan
  // tidak pernah mencoba baca Firestore sama sekali. pastikanMountXxx()
  // sendiri sudah idempoten (aman dipanggil berkali-kali, cuma mount()
  // sekali di panggilan pertama), jadi tidak perlu pelacakan manual lagi.
  const petaMount = {
    'sub-absensi-config': 'pastikanMountConfigAbsensi',
    'sub-absensi-jadwal': 'pastikanMountPenjadwalan',
    'sub-absensi-accept': 'pastikanMountAntreanAbsensi',
    'sub-absensi-lembur': 'pastikanMountAntreanLembur',
    'sub-absensi-rekap': 'pastikanMountRiwayatAbsensi',
    'sub-keuangan-antrean': 'pastikanMountAntreanReimburse',
    'sub-keuangan-kendaraan': 'pastikanMountMasterKendaraan',
    'sub-keuangan-kategori': 'pastikanMountMasterKeuangan',
    'sub-keuangan-riwayat-reimburse': 'pastikanMountRiwayatReimburse',
    'sub-keuangan-riwayat-bensin': 'pastikanMountRiwayatBensin',
    'sub-keuangan-riwayat-servis': 'pastikanMountRiwayatServis',
    'sub-karyawan-antrean': 'pastikanMountAntreanDakar',
    'sub-karyawan-config': 'pastikanMountConfigKaryawan',
    'sub-karyawan-info': 'pastikanMountConfigInfo',
    'sub-karyawan-data': 'pastikanMountDaftarKaryawan',
    'sub-karyawan-akses': 'pastikanMountConfigAkses',
    'sub-karyawan-hakakses': 'pastikanMountHakAkses',
    // BARU (27 Agt 2026, §26.1) — Config (6 tab child). BARU (28 Agt 2026) —
    // tab ke-7 "Jenis Produk", pola sama seperti "Data Ukuran". BARU (28 Agt
    // 2026) — tab ke-8 "Data Komponen", pola sama seperti "Data Warna".
    'sub-zh-config-jenisbahan': 'pastikanMountConfigJenisBahan',
    'sub-zh-config-jenisaksesoris': 'pastikanMountConfigJenisAksesoris',
    'sub-zh-config-satuan': 'pastikanMountConfigSatuan',
    'sub-zh-config-warna': 'pastikanMountConfigWarna',
    'sub-zh-config-ukuran': 'pastikanMountConfigUkuran',
    'sub-zh-config-jenisproduk': 'pastikanMountConfigJenisProduk',
    'sub-zh-config-komponen': 'pastikanMountConfigKomponen',
    'sub-zh-config-tahappersiapan': 'pastikanMountConfigTahapPersiapan',
    'sub-zh-config-suplayer': 'pastikanMountConfigSuplayer',
    'sub-zh-databahan-entry': 'pastikanMountBahanAksesorisEntry',
    'sub-zh-databahan-list': 'pastikanMountBahanAksesorisList',
    'sub-zh-databahan-rak': 'pastikanMountRakPenyimpanan',
    'sub-zevanic-house-persiapan': 'pastikanMountPersiapanMasalah',
    'sub-zh-stock-alias': 'pastikanMountAliasPembelian',
    'sub-zh-stock-listorder': 'pastikanMountListOrderBelanja',
    'sub-zh-stock-notaorder': 'pastikanMountNotaOrderBelanja',
    'sub-zh-stock-riwayat': 'pastikanMountRiwayatHargaPembelian',
    'sub-zh-stock-kartustok': 'pastikanMountKartuStok',
    // DIPENSIUNKAN (28 Agt 2026, §41.2) — dulu 'sub-zh-stock-cetaklabel':
    // 'pastikanMountCetakLabel' di sini, tab-nya sudah dihapus dari
    // index.html (Cetak Label pindah jadi tombol di List Bahan & Aksesoris).
    // BARU (27 Agt 2026, §28) — Master Produk (BOM).
    'sub-zh-produk-entry': 'pastikanMountProdukEntry',
    'sub-zh-produk-list': 'pastikanMountProdukList',
    // DIPENSIUNKAN (30 Agt 2026, fitur "Pesanan") — dulu di sini
    // 'sub-zevanic-house-orderspk': 'pastikanMountOrderSpk', tombol & div
    // kontennya sudah dicopot dari index.html, GANTI TOTAL oleh
    // 'sub-pesanan-menunggu' di bawah (lihat js/vue-pesanan.js).
    // DIPENSIUNKAN (29 Agt 2026, koreksi arsitektur menu) — 5 entry lama
    // 'sub-zh-persiapanproduksi-*' -> pastikanMountPersiapanProduksi* DIHAPUS
    // dari sini, tombolnya sudah dicopot dari index.html (lihat js/vue-
    // persiapan-produksi.js, DITINGGALKAN tidak lagi dimuat).
    // BARU (29 Agt 2026) — Persiapan Produksi V2 (grup top-level baru):
    // "Perlu Disiapkan" (Fase 1) + jalur Bahan (Fase 2) + 3 jalur Acc
    // Sewing/Webbing/Finishing (Fase 3) + jalur Vendor (Fase 4, 29 Agt
    // 2026 malam — semua parametrisasi JalurTahapManager yang SAMA, tidak
    // ada komponen baru) sekarang SEMUA punya komponen Vue sungguhan.
    // Jalur Vendor deteksi otomatis dari BOM MASIH belum ada (§5.C
    // RENCANA doc sebagian terbuka) — sementara cuma bisa diaktifkan
    // manual (checkbox di "Perlu Disiapkan"), tapi tahapnya sendiri
    // (scan dst) SUDAH fungsional penuh.
    // Lihat js/vue-persiapan-produksi-v2.js & STATUS-PROYEK.md §44.13/
    // §44.14/§44.19/§44.20.
    'sub-pp-disiapkan': 'pastikanMountPpDisiapkan',
    // GANTI (31 Agt 2026, wireframe handoff "Persiapan Produksi - Bahan")
    // — jalur Bahan sekarang js/vue-persiapan-bahan.js (kartu per bahan +
    // warna), BUKAN lagi JalurTahapManager generik. 2 tab pertama ganti
    // nama div (Perlu/Sedang DISIAPKAN, bukan Diproses).
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
    // BARU (27 Agt 2026, §26.4) — Scan > Scan Opname.
    'sub-zh-scan-opname': 'pastikanMountScanOpname',
    // BARU (27 Agt 2026, §26.5, Tahap 5 — TAHAP TERAKHIR) — Scan > Scan Persiapan.
    'sub-zh-scan-persiapan': 'pastikanMountScanPersiapan',
    // BARU (30 Agt 2026) — grup top-level "Pesanan" (lihat js/vue-pesanan.js
    // utk latar belakang lengkap): Penjualan Kasir (POS), Menunggu Proses
    // (CRUD SPK, disalin dari OrderSpkManager lama), Proses Persiapan/
    // Produksi/Pengiriman (ringkasan read-only dari spk_track).
    'sub-pesanan-kasir': 'pastikanMountPesananKasir',
    'sub-pesanan-menunggu': 'pastikanMountPesananMenunggu',
    'sub-pesanan-persiapan': 'pastikanMountPesananPersiapan',
    'sub-pesanan-produksi': 'pastikanMountPesananProduksi',
    'sub-pesanan-pengiriman': 'pastikanMountPesananPengiriman'
  };
  const namaFungsiMount = petaMount[targetId];
  if (namaFungsiMount && window[namaFungsiMount]) window[namaFungsiMount]();
};

// =========================================================================
// TOMBOL BACK BROWSER/HP (History API) — BARU 23 Agt 2026, lihat
// STATUS-PROYEK.md §19.4. SEBELUM ini app TIDAK PERNAH pakai Browser
// History API sama sekali — tombol back HP langsung "keluar" ke riwayat
// browser SEBELUM app ini dibuka (biasanya hasil pencarian terakhir),
// alih-alih kembali ke tab yang sebelumnya dibuka DI DALAM app.
//
// Cara kerja: setiap window.pindahTab() (di atas) mencatat 1 entry riwayat
// browser (kecuali dipanggil dari sini sendiri). Listener di bawah ini
// menangkap event 'popstate' (browser back/forward) dan memanggil balik
// window.pindahTab() dengan tab yang tersimpan di entry itu, DENGAN flag
// _dariPopstate=true supaya tidak ikut push lagi (baca komentar di
// pindahTab). Kalau riwayatnya sudah habis (state null, berarti sudah
// sampai entry SEBELUM app ini dibuka), tidak ada yang dilakukan di sini —
// biarkan browser lanjut keluar app seperti biasa, itu sudah benar.
//
// DIPERLUAS (28 Agt 2026, §39) — sekarang JUGA merestorasi sub-tab/child-
// tab (`state.subTabs`, array {grupKelas,targetId}, urutan PALING LUAR ke
// PALING DALAM, disimpan sengaja begitu supaya elemen DOM yang lebih dalam
// tidak keburu ke-hidden oleh induknya). `window._riwayatNavAktif` DIISI
// LANGSUNG dari `state` (bukan dibangun ulang) supaya klik berikutnya
// (bukan dari popstate) melanjutkan dari snapshot yang benar. TETAP TIDAK
// MENCAKUP (sengaja, lihat §19.4): perpindahan LAYAR/screen (pindahLayar —
// Login, Kamera, Buat Password, Absensi QR) yang sudah punya alur "Batal"/
// pengaman sendiri. Kalau back ditekan SAAT sedang di layar selain
// Dashboard (misal Kamera), listener ini tetap boleh konsumsi 1 langkah
// riwayat browser di belakang layar (tidak berbahaya, cuma update tab yang
// sedang tersembunyi) — TIDAK mengubah screen yang sedang tampil.
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
  // Level 3 (28 Agt 2026, §39) — tab INTERNAL komponen Vue (lihat
  // js/vue-riwayat-tab.js). SENGAJA dijalankan PALING TERAKHIR, setelah
  // subTabs di atas — supaya komponen Vue tujuannya sudah pasti ke-mount
  // duluan (lewat pastikanMountXxx() yang otomatis terpanggil dari
  // pindahSubTab) sebelum handler restore-nya dipanggil.
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
// sudah dihapus sepenuhnya atas permintaan — window.muatDataRiwayatACC tidak
// ada lagi.

// Tabel Riwayat All Absensi (siapkanFilterRekap/bukaEditAbsensi/
// tutupEditAbsensi/simpanEditAbsensi/assignUlangAbsensi) sudah pindah ke
// js/vue-riwayat-absensi.js. window.exportKeCSV & window.dataRiwayatGlobal
// TETAP di sini — masih dipakai laporan personal Account Profile > Absensi
// yang belum dimigrasi.

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

// ============================================================================
// Palet Pencarian Global / Ctrl K (BARU, 30 Agt 2026, sesi lanjutan —
// permintaan Guru "ada pencarian, terapkan"). REVISI dari keputusan §5.9
// yang sebelumnya SENGAJA tidak membangun elemen ini karena mockup-nya
// cuma visual (README paket handoff: "penanganan tombol fisiknya belum
// diikat — hanya palet Ctrl K yang berfungsi lewat klik. Implementasikan
// listener sungguhan di repo."). DI SINI DIIKAT SUNGGUHAN:
// - Daftar hasil pencarian DIBACA LANGSUNG dari DOM sidebar (tiap elemen
//   ber-atribut data-menu-id/data-menu-ids di dalam .gc-sidebar), BUKAN
//   daftar hardcode terpisah — otomatis akurat kalau menu berubah, tidak
//   ada 2 sumber kebenaran yang bisa beda.
// - Klik hasil = trigger .click() pada tombol sidebar ASLI (bukan
//   menduplikasi logic pindahTab()/pindahSubTab()), supaya perilakunya
//   PERSIS sama seperti user klik manual di sidebar (termasuk buka
//   accordion grup induknya, catatRiwayat, dst — apapun yang sudah
//   ditempel di onclick tombol itu).
// - Filter ketikan = contains + tidak peka huruf besar-kecil. Ini AMAN
//   (beda dari pencarian daftar modul yang wajib prefix-match+peka huruf
//   besar-kecil demi hemat baca Firestore, PETA-HEMAT.md) karena ini
//   MURNI filter array di client, sudah dari DOM, nol baca Firestore.
// - Navigasi panah atas/bawah TIDAK diimplementasi (disederhanakan) —
//   Enter pilih hasil PALING ATAS yang sedang tampil. Kalau Guru mau
//   navigasi panah sungguhan nanti, itu penambahan kecil terpisah.
// ============================================================================
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

// Sinkronisasi ikon tombol tema sidebar desktop (BARU, 30 Agt 2026, ronde
// audit desain) — sidebar desktop ini murni HTML statis (bukan Vue), jadi
// ikonnya di-update manual lewat DOM, PAKAI ULANG window.toggleTema()/
// window.temaPreferensi() yang sudah ada di index.html (BUKAN logic tema
// baru) — sama seperti pola ikonTema di js/vue-sheet-profil.js (mobile).
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

// Avatar inisial footer sidebar desktop (BARU, 30 Agt 2026, ronde audit
// desain) — #teks-nama-user DIPINDAH dari topbar ke footer sidebar
// (pojok kiri-bawah, persis mockup .sb-foot), dipasangkan avatar inisial
// SAMA POLA dengan inisial() di js/vue-header-mobile.js (mobile), cuma
// versi vanilla JS karena sidebar desktop bukan komponen Vue. Dipanggil
// dari js/auth.js & js/dashboard.js persis di titik yang sudah mengisi
// #teks-nama-user (cek grep "teks-nama-user" sebelum ubah titik panggil).
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

// Subjudul (shift · gudang) footer sidebar desktop (BARU, 30 Agt 2026,
// ronde audit desain lanjutan) — Guru bandingkan screenshot live vs
// mockup: mockup `.sb-who` punya baris ke-2 "SOG27A · Gudang Utama",
// live sebelumnya cuma 1 baris nama. PAKAI ULANG field yang SUDAH ADA di
// window.currentUser (nama_shift, gudang_penempatan lewat
// window.normalisasiGudang — SAMA persis dipakai Kartu Absen di
// js/vue-home-desktop.js), BUKAN query Firestore baru.
window.perbaruiInfoSidebarDesktop = function () {
  const el = document.getElementById('teks-info-sidebar-desktop');
  if (!el) return;
  const shift = (window.currentUser && window.currentUser.nama_shift) || '';
  const gudangList = window.normalisasiGudang ? window.normalisasiGudang(window.currentUser && window.currentUser.gudang_penempatan) : [];
  const gudang = (gudangList && gudangList.length > 0) ? gudangList.join(', ') : '';
  const bagian = [shift, gudang].filter(Boolean);
  el.textContent = bagian.length ? bagian.join(' · ') : '-';
};