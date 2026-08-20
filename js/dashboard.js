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
    document.getElementById('teks-nama-user').innerText = "Hi, " + namaBaru;
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

window.pindahTab = function(tabId, navKey) {
  const tabs = ['tab-home', 'tab-profil', 'tab-admin-acc', 'tab-keuangan', 'tab-superuser', 'tab-whatsapp', 'tab-mail-gateway', 'tab-scan-qr', 'tab-progress'];
  const tabSebelumnya = tabs.find(t => {
    const el = document.getElementById(t);
    return el && !el.classList.contains('hidden');
  });

  tabs.forEach(tab => {
    const elemenTab = document.getElementById(tab);
    if (elemenTab) elemenTab.classList.add('hidden');
  });
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.remove('hidden');
  if (window.aturHeaderKonteks) window.aturHeaderKonteks(tabId, null);

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
  if (tabId === 'tab-whatsapp') {
      if (window.pastikanMountWhatsapp) window.pastikanMountWhatsapp();
  }
  if (tabId === 'tab-mail-gateway') {
      if (window.pastikanMountMailGateway) window.pastikanMountMailGateway();
  }
  
};

// pindahSubTab: SEBELUMNYA dipanggil di banyak tombol (Config Absensi,
// Penjadwalan, Daftar Karyawan, dst) tapi definisinya sendiri hilang/kehapus
// tidak sengaja di masa lalu — tombol-tombol itu praktis mati (klik tidak
// berbuat apa-apa, cuma error di Console). Diperbaiki di sini, sekalian
// pindah dari cara lama (gonta-ganti banyak class Tailwind manual) ke class
// gc-sub-tab-btn/active yang lebih sederhana.
window.pindahSubTab = function(grupKelas, targetId, tombolEl) {
  document.querySelectorAll('.' + grupKelas + '-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.' + grupKelas + '-btn').forEach(btn => btn.classList.remove('active'));
  if (tombolEl) tombolEl.classList.add('active');

  if (window.aturHeaderKonteks) {
    const petaTabIndukPerGrup = { 'sub-absensi': 'tab-admin-acc', 'sub-keuangan': 'tab-keuangan', 'sub-karyawan': 'tab-superuser' };
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
    'sub-keuangan-kategori': 'pastikanMountMasterKeuangan',
    'sub-karyawan-antrean': 'pastikanMountAntreanDakar',
    'sub-karyawan-config': 'pastikanMountConfigKaryawan',
    'sub-karyawan-info': 'pastikanMountConfigInfo',
    'sub-karyawan-data': 'pastikanMountDaftarKaryawan',
    'sub-karyawan-akses': 'pastikanMountConfigAkses',
    'sub-karyawan-hakakses': 'pastikanMountHakAkses'
  };
  const namaFungsiMount = petaMount[targetId];
  if (namaFungsiMount && window[namaFungsiMount]) window[namaFungsiMount]();
};

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
