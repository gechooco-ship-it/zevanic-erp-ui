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

window.simpanKeFirebase = async function(fotoBase64) {
  try {
    let dataKirim = {
      nama_pegawai: window.currentUser.name,
      email: window.currentUser.email,
      role: window.currentUser.role,
      status: window.statusPilihanGlobal,
      waktu: new Date().toLocaleString('id-ID'),
      foto_selfie: fotoBase64,
      persetujuan: "PENDING",
      seragam: "Sesuai"
    };
    if (window.statusPilihanGlobal === "IZIN" || window.statusPilihanGlobal === "CUTI") {
      dataKirim.tanggal_pengajuan = window.tanggalIzinGlobal;
      dataKirim.keterangan = window.keteranganIzinGlobal;
    }
    if (window.statusPilihanGlobal === "LEMBUR (CLOCK IN)") {
      dataKirim.lembur_mulai = window.lemburMulaiGlobal || "";
      dataKirim.lembur_selesai = window.lemburSelesaiGlobal || "";
      dataKirim.keterangan = window.lemburAlasanGlobal || "";
      dataKirim.lembur_instruksi = window.lemburInstruksiGlobal || "";
    }
    // Poin 7 (Geofencing): sertakan gudang, koordinat, dan status radius untuk Clock In/Out
    if (window.statusPilihanGlobal === "HADIR (CLOCK IN)" || window.statusPilihanGlobal === "CLOCK OUT" || window.statusPilihanGlobal === "LEMBUR (CLOCK IN)") {
      dataKirim.gudang = window.gudangDipilihGlobal || "";
      if (window.koordinatGlobal) {
        dataKirim.koordinat = { lat: window.koordinatGlobal.lat, lng: window.koordinatGlobal.lng };
      }
      if (window.statusRadiusGlobal) {
        dataKirim.jarak_meter = window.statusRadiusGlobal.jarak;
        dataKirim.radius_izin_meter = window.statusRadiusGlobal.radiusIzin;
        dataKirim.status_radius = window.statusRadiusGlobal.dinamis
          ? "LOKASI DINAMIS"
          : (window.statusRadiusGlobal.dalamRadius ? "DALAM RADIUS" : "DI LUAR RADIUS");
      }
    }
    await addDoc(collection(db, "absensi"), dataKirim);
    return true;
  } catch (e) {
    console.error("Gagal simpan:", e);
    return false;
  }
};

window.kirimDataKeCloud = async function() {
  const btnFinal = document.getElementById('btn-clock-in-final');

  // Poin 7 (Geofencing): cek lokasi TEPAT saat submit ditekan. Kalau GPS belum
  // siap (masih dari pemanasan background di layar kamera, atau belum sempat
  // selesai), coba ambil lagi sekarang dan TUNGGU hasilnya — bukan langsung
  // gagal. Ini menghindari kondisi "sempat berhasil ambil foto tapi status GPS
  // sudah basi/hilang pas mau kirim".
  const perluLokasi = (window.statusPilihanGlobal === "HADIR (CLOCK IN)" || window.statusPilihanGlobal === "CLOCK OUT" || window.statusPilihanGlobal === "LEMBUR (CLOCK IN)");
  if (perluLokasi) {
    if (!window.koordinatGlobal && window.ambilLokasiGPS) {
      btnFinal.innerText = "Memeriksa lokasi GPS...";
      btnFinal.disabled = true;
      await window.ambilLokasiGPS();
      btnFinal.innerText = "Kirim Pengajuan";
      btnFinal.disabled = false;
    }
    if (!window.koordinatGlobal) {
      alert("Gagal mendapatkan lokasi GPS. Pastikan GPS & izin lokasi browser aktif (coba keluar dari area tertutup/beratap jika sinyal lemah), lalu coba lagi.");
      return;
    }
    if (window.statusRadiusGlobal && window.statusRadiusGlobal.dalamRadius === false) {
      alert(`Anda berada di luar radius gudang ${window.statusRadiusGlobal.gudang} (${window.statusRadiusGlobal.jarak}m dari batas ${window.statusRadiusGlobal.radiusIzin}m). Absensi tidak bisa dikirim.`);
      return;
    }
  }

  btnFinal.innerText = "Mengirim...";
  btnFinal.disabled = true;

  const fotoWajah = document.getElementById('hasil-foto').src;
  let berhasil = false;
  if(window.simpanKeFirebase) {
      berhasil = await window.simpanKeFirebase(fotoWajah);
  }
  btnFinal.innerText = "Kirim Pengajuan";
  btnFinal.disabled = false;
  
  if (berhasil) {
      const hariIni = new Date().toLocaleDateString('id-ID');
      if (window.statusPilihanGlobal === "HADIR (CLOCK IN)") {
          localStorage.setItem('zevanic_absen_' + window.currentUser.email, hariIni);
      } else if (window.statusPilihanGlobal === "CLOCK OUT") {
          localStorage.setItem('zevanic_absen_' + window.currentUser.email, "OUT_" + hariIni);
      }
      if (window.statusPilihanGlobal === "CLOCK OUT") {
          alert("Clock Out berhasil! Hati-hati di jalan.");
          window.pindahLayar('screen-login');
      } else {
          window.pindahLayar('screen-dashboard');
          window.pindahTab('tab-profil');
          window.pindahSubProfile('profil-riwayat', document.querySelector('.sub-profil-btn[onclick*=profil-riwayat]'));
      }
  }
};


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
  status_pengguna: ["operator", "admin", "pic", "owner"],
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

window.pindahTab = function(tabId) {
  const tabs = ['tab-home', 'tab-profil', 'tab-admin-acc', 'tab-superuser', 'tab-whatsapp'];
  tabs.forEach(tab => {
    const elemenTab = document.getElementById(tab);
    if (elemenTab) elemenTab.classList.add('hidden');
  });
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.remove('hidden');

  if (tabId === 'tab-profil') {
    if (window.pindahSubProfile) window.pindahSubProfile('profil-qr', document.querySelector('.sub-profil-btn'));
    if (window.muatDataProfil) window.muatDataProfil(); 
  }
  
  if (tabId === 'tab-admin-acc') {
      if (window.pindahSubTab) window.pindahSubTab('sub-absensi', 'sub-absensi-accept', document.querySelectorAll('.sub-absensi-btn')[2]);
  }
  
};

window.pindahSubProfile = function(targetId, elemenTombol) {
  const semuaKonten = document.querySelectorAll('.sub-profil-content');
  semuaKonten.forEach(el => el.classList.add('hidden'));
  
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');
  
  const semuaTombol = document.querySelectorAll('.sub-profil-btn');
  semuaTombol.forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white', 'font-bold', 'shadow-sm');
    btn.classList.add('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
  });
  
  if (elemenTombol) {
    elemenTombol.classList.remove('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
    elemenTombol.classList.add('bg-slate-800', 'text-white', 'font-bold', 'shadow-sm');
  }

  if (targetId === 'profil-datadiri' && window.currentUser) {
    document.getElementById('upd-nama').value = window.currentUser.name || window.currentUser.nama || "";
    document.getElementById('upd-nik').value = window.currentUser.nik || "";
    document.getElementById('upd-jk').value = window.currentUser.jk || window.currentUser.gender || "";
    document.getElementById('upd-tempat-lahir').value = window.currentUser.tempatLahir || "";
    document.getElementById('upd-tgl-lahir').value = window.currentUser.tglLahir || window.currentUser.tgl || "";
    
    document.getElementById('upd-hp').value = window.currentUser.hp || "";
    document.getElementById('upd-email').value = window.currentUser.email || "";

    document.getElementById('upd-ktp-kab').value = window.currentUser.ktpKab || "";
    document.getElementById('upd-ktp-kec').value = window.currentUser.ktpKec || "";
    document.getElementById('upd-ktp-detail').value = window.currentUser.ktpDetail || "";

    document.getElementById('upd-dom-kab').value = window.currentUser.domisiliKab || window.currentUser.tinggalKab || "";
    document.getElementById('upd-dom-kec').value = window.currentUser.domisiliKec || window.currentUser.tinggalKec || "";
    document.getElementById('upd-dom-detail').value = window.currentUser.domisiliDetail || window.currentUser.tinggalDetail || "";

    document.getElementById('upd-pendidikan').value = window.currentUser.pendidikan || "";
    document.getElementById('upd-sekolah').value = window.currentUser.sekolah || "";
    document.getElementById('upd-jurusan').value = window.currentUser.jurusan || "";
    document.getElementById('upd-nikah').value = window.currentUser.statusNikah || window.currentUser.nikah || "";
    document.getElementById('upd-tanggungan').value = window.currentUser.tanggungan || "";

    document.getElementById('upd-darurat-nama').value = window.currentUser.daruratNama || "";
    document.getElementById('upd-darurat-hub').value = window.currentUser.daruratHub || "";
    document.getElementById('upd-darurat-hp').value = window.currentUser.daruratHp || "";

    document.getElementById('upd-bank').value = window.currentUser.bank || "";
    document.getElementById('upd-norek').value = window.currentUser.noRek || window.currentUser.norek || "";
    document.getElementById('upd-namarek').value = window.currentUser.atasNamaRek || window.currentUser.namarek || "";
  }

  if (targetId === 'profil-riwayat' && window.muatDataRiwayatPersonal) {
      window.muatDataRiwayatPersonal();
  }
};

window.muatDataProfil = function() {
  if (!window.currentUser) return;
  
  const elNama = document.getElementById('profil-nama-utama');
  const elIdApp = document.getElementById('profil-id-app-utama');
  const elJabatan = document.getElementById('profil-jabatan-utama');
  const elQr = document.getElementById('profil-qr-img');
  
  if (elNama) elNama.innerText = window.currentUser.name || window.currentUser.nama || "User";
  if (elIdApp) elIdApp.innerText = window.currentUser.id_app || "ID Tidak Ditemukan";
  if (elJabatan) elJabatan.innerText = window.currentUser.jabatan || window.currentUser.role || "Staff";
  
  if (elQr) {
    const qrData = window.currentUser.id_app || window.currentUser.email;
    elQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;
  }
  
  if (document.getElementById('profil-nama')) document.getElementById('profil-nama').innerText = window.currentUser.name || window.currentUser.nama || "";
  if (document.getElementById('profil-jabatan')) document.getElementById('profil-jabatan').innerText = window.currentUser.jabatan || window.currentUser.role || "";
  
  if (window.mulaiHitungJamKerja) window.mulaiHitungJamKerja();
};

window.simpanUpdateDataDiriLengkap = async function() {
  const btn = event.currentTarget;
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Menyimpan...';
  btn.disabled = true;

  try {
    const dataUpdate = {
      nama: document.getElementById('upd-nama').value,
      name: document.getElementById('upd-nama').value, 
      nik: document.getElementById('upd-nik').value,
      gender: document.getElementById('upd-jk').value,
      tempatLahir: document.getElementById('upd-tempat-lahir').value,
      tglLahir: document.getElementById('upd-tgl-lahir').value,
      hp: document.getElementById('upd-hp').value,
      ktpKab: document.getElementById('upd-ktp-kab').value,
      ktpKec: document.getElementById('upd-ktp-kec').value,
      ktpDetail: document.getElementById('upd-ktp-detail').value,
      tinggalKab: document.getElementById('upd-dom-kab').value,
      tinggalKec: document.getElementById('upd-dom-kec').value,
      tinggalDetail: document.getElementById('upd-dom-detail').value,
      pendidikan: document.getElementById('upd-pendidikan').value,
      sekolah: document.getElementById('upd-sekolah').value,
      jurusan: document.getElementById('upd-jurusan').value,
      statusNikah: document.getElementById('upd-nikah').value,
      tanggungan: document.getElementById('upd-tanggungan').value,
      daruratNama: document.getElementById('upd-darurat-nama').value,
      daruratHub: document.getElementById('upd-darurat-hub').value,
      daruratHp: document.getElementById('upd-darurat-hp').value,
      bank: document.getElementById('upd-bank').value,
      noRek: document.getElementById('upd-norek').value,
      atasNamaRek: document.getElementById('upd-namarek').value
    };

    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const userRef = doc(db, "users", window.currentUser.email);
    await updateDoc(userRef, dataUpdate);
    Object.assign(window.currentUser, dataUpdate);
    
    alert("Seluruh pembaruan data diri Anda berhasil disimpan secara sistem!");
    window.muatDataProfil(); 
  } catch (e) {
    console.error(e);
    alert("Gagal memperbarui data. Pastikan koneksi internet stabil.");
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
};

// Field "waktu" disimpan sebagai teks hasil new Date().toLocaleString('id-ID'),
// contoh: "15/8/2026, 10.30.15" (bukan format ISO). Bug lama: banyak tempat di
// file ini mencoba new Date(data.waktu) lagi seolah itu format yang bisa
// di-parse ulang — hasilnya selalu "Invalid Date" karena JS tidak mengerti
// format DD/M/YYYY dengan titik sebagai pemisah jam. Fungsi ini yang benar.
window.parseWaktuIndo = function(waktuStr) {
  if (!waktuStr || typeof waktuStr !== 'string') return null;
  const [tglPart, jamPart] = waktuStr.split(', ');
  if (!tglPart) return null;
  const [d, m, y] = tglPart.split('/').map(Number);
  if (!d || !m || !y) return null;
  let h = 0, mi = 0, s = 0;
  if (jamPart) {
    const bagianJam = jamPart.split('.').map(Number);
    h = bagianJam[0] || 0; mi = bagianJam[1] || 0; s = bagianJam[2] || 0;
  }
  const hasil = new Date(y, m - 1, d, h, mi, s);
  return isNaN(hasil.getTime()) ? null : hasil;
};

window.pindahSubTab = function(prefixClass, targetId, elemenTombol) {
  const semuaKonten = document.querySelectorAll(`.${prefixClass}-content`);
  semuaKonten.forEach(el => el.classList.add('hidden'));
  
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');
  
  const semuaTombol = document.querySelectorAll(`.${prefixClass}-btn`);
  semuaTombol.forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white', 'font-bold', 'shadow-md');
    btn.classList.add('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
  });
  
  if (elemenTombol) {
    elemenTombol.classList.remove('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
    elemenTombol.classList.add('bg-slate-800', 'text-white', 'font-bold', 'shadow-md');
  }
};

// =========================================================================
// ====== HELPER BERSAMA: PILIH GUDANG (MULTI) VIA CHECKBOX ================
// Dipakai oleh: Antrean Karyawan, Penjadwalan, dan Edit Karyawan.
// =========================================================================
window.renderGudangCheckboxes = function(container, daftarGudang, gudangTerpilih) {
  if (!container) return;
  const terpilih = window.normalisasiGudang(gudangTerpilih);
  if (!daftarGudang || daftarGudang.length === 0) {
    container.innerHTML = '<span class="text-[10px] text-gray-400">Belum ada Master Gudang. Buat dulu di Config Absensi.</span>';
    return;
  }
  container.innerHTML = daftarGudang.map(g => `
    <label class="flex items-center space-x-1.5 bg-white border rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer hover:bg-blue-50 transition">
      <input type="checkbox" value="${g}" class="rounded text-blue-600" ${terpilih.includes(g) ? 'checked' : ''}>
      <span>${g}</span>
    </label>
  `).join('');
};

window.bacaGudangCheckboxes = function(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
};

// Antrean Absensi (kartu validasi + Accept/Reject) sudah pindah ke
// js/vue-antrean-absensi.js. window.hapusAbsensi TETAP di sini karena masih
// dipakai Riwayat All Absensi yang belum dimigrasi.

window.hapusAbsensi = async function(docId) {
  if (!confirm("Peringatan: Anda yakin ingin menghapus data absensi ini secara permanen? Data tidak dapat dikembalikan.")) return;
  try {
    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    await deleteDoc(doc(db, "absensi", docId));
    // Dipanggil dari 2 komponen Vue berbeda (Antrean Absensi & Riwayat All
    // Absensi) — masing-masing menangani refresh-nya sendiri lewat .then(muat)
    // di pemanggilnya. Guard ini dipertahankan untuk jaga-jaga saja.
    if (window.muatDataAdminACC) window.muatDataAdminACC();
    if (window.siapkanFilterRekap) window.siapkanFilterRekap();
  } catch (e) {
    console.error("Gagal hapus:", e);
    alert("Gagal menghapus data.");
  }
};

window.dataRiwayatGlobal = [];

window.muatDataRiwayatPersonal = async function() {
  const container = document.getElementById('container-riwayat-absensi');
  if(!container) return;

  container.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Memuat laporan absensi Anda...</p></div>`;

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const tglMulai = document.getElementById('filter-tgl-mulai')?.value;
    const tglSelesai = document.getElementById('filter-tgl-selesai')?.value;
    const filterGudang = document.getElementById('filter-gudang')?.value || 'ALL';
    const filterShift = document.getElementById('filter-shift')?.value || 'ALL';

    const querySnapshot = await getDocs(collection(db, "absensi"));
    let listData = [];

    let countHadir = 0; let countACC = 0; let countSeragamBeda = 0; let countIzin = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      data.id = docSnap.id;
      
      if (data.email === window.currentUser.email) {
        let lolosTgl = true;
        if (data.waktu) {
          const waktuObj = window.parseWaktuIndo(data.waktu);
          if (waktuObj) {
            const tglData = `${waktuObj.getFullYear()}-${String(waktuObj.getMonth() + 1).padStart(2, '0')}-${String(waktuObj.getDate()).padStart(2, '0')}`;
            if (tglMulai && tglData < tglMulai) lolosTgl = false;
            if (tglSelesai && tglData > tglSelesai) lolosTgl = false;
          }
        }

        let lolosGudang = (filterGudang === 'ALL' || data.gudang === filterGudang);
        let lolosShift = (filterShift === 'ALL' || data.shift === filterShift);

        if (lolosTgl && lolosGudang && lolosShift) {
          listData.push(data);
          
          if (data.status === "HADIR" || data.status === "HADIR (CLOCK IN)") countHadir++;
          else countIzin++;

          if (data.status_acc === "ACC") countACC++;
          if (data.seragam === "Tidak Sesuai") countSeragamBeda++;
        }
      }
    });

    if (document.getElementById('stat-hadir')) document.getElementById('stat-hadir').innerText = countHadir;
    if (document.getElementById('stat-acc')) document.getElementById('stat-acc').innerText = countACC;
    if (document.getElementById('stat-seragam')) document.getElementById('stat-seragam').innerText = countSeragamBeda;
    if (document.getElementById('stat-izin')) document.getElementById('stat-izin').innerText = countIzin;

    listData.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
    window.dataRiwayatGlobal = listData;

    if (listData.length === 0) {
      container.innerHTML = `<div class="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 text-xs"><i class="fas fa-folder-open text-3xl mb-3 text-gray-300"></i><br>Belum ada riwayat absensi yang tercatat untuk Anda.</div>`;
      return;
    }

    let html = `
      <div class="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white mt-4">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[10px] uppercase">
            <tr>
              <th class="p-3">Persetujuan / Tipe Absen</th>
              <th class="p-3">Shift / Gudang</th>
              <th class="p-3">Tanggal / Waktu</th>
              <th class="p-3">Foto</th>
              <th class="p-3">Nama / No HP</th>
              <th class="p-3">Status Kehadiran / Seragam</th>
              <th class="p-3">Sanggahan Karyawan</th>
              <th class="p-3">Status Aju Banding</th>
              <th class="p-3 text-center">Aksi Aju Banding</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    const dua = (a, b) => `<b class="text-slate-800">${a || '-'}</b><br><span class="text-[10px] text-gray-400 font-normal">${b || '-'}</span>`;

    listData.forEach(item => {
      const [tglBagian, jamBagian] = (item.waktu || '-, -').split(', ');
      const fotoUrl = item.foto_selfie || item.foto || '';
      const statusAccLabel = item.status_acc === 'ACC' ? '<span class="text-green-600">ACC</span>' : (item.status_acc === 'REJECT' ? '<span class="text-red-500">REJECT</span>' : '<span class="text-amber-500">PENDING</span>');

      let statusBandingHtml = '<span class="text-gray-300">-</span>';
      let aksiBandingHtml = '<span class="text-gray-300 text-[10px]">-</span>';
      const bolehBanding = (item.status_acc === "REJECT" || item.seragam === "Tidak Sesuai");

      if (item.catatan_banding) {
        statusBandingHtml = '<span class="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[9px] rounded-full">Sudah Diajukan</span>';
        aksiBandingHtml = `<span class="text-[10px] text-gray-500" title="${item.catatan_banding.replace(/"/g,'&quot;')}"><i class="fas fa-check mr-1 text-green-500"></i>Terkirim</span>`;
      } else if (bolehBanding) {
        aksiBandingHtml = `<button onclick="bukaModalAjuBanding('${item.id}')" class="px-3 py-1.5 bg-white border border-amber-300 text-amber-600 font-bold text-[10px] rounded-lg hover:bg-amber-50 transition shadow-sm"><i class="fas fa-gavel mr-1"></i>Aju Banding</button>`;
      }

      html += `
        <tr class="hover:bg-gray-50 transition">
          <td class="p-3">${dua(statusAccLabel, item.status || 'HADIR')}</td>
          <td class="p-3">${dua(item.shift, item.gudang)}</td>
          <td class="p-3">${dua(tglBagian, jamBagian)}</td>
          <td class="p-3">${fotoUrl ? `<img src="${fotoUrl}" class="w-10 h-10 rounded-lg object-cover border cursor-pointer hover:scale-105 transition" onclick="bukaPreviewFoto('${fotoUrl}')">` : '<span class="text-gray-300">-</span>'}</td>
          <td class="p-3">${dua(item.nama_pegawai || item.nama, window.currentUser.hp || '-')}</td>
          <td class="p-3">${dua(item.status_kehadiran, item.seragam || 'Sesuai')}</td>
          <td class="p-3 max-w-[150px] truncate" title="${(item.catatan_banding || '').replace(/"/g, '&quot;')}">${item.catatan_banding || '-'}</td>
          <td class="p-3 text-center">${statusBandingHtml}</td>
          <td class="p-3 text-center">${aksiBandingHtml}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

  } catch (e) {
    console.error("Error muat riwayat personal:", e);
    container.innerHTML = `<div class="text-center py-8 text-red-500 text-xs">Gagal memuat laporan. Hubungi IT.</div>`;
  }
};

window.muatDataRiwayatACC = async function() {
  const container = document.getElementById('container-acc-riwayat');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p>Memuat riwayat persetujuan...</p></div>`;

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    const querySnapshot = await getDocs(collection(db, "absensi"));
    
    let html = `
      <div class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[10px] uppercase">
            <tr>
              <th class="p-4">Pegawai</th>
              <th class="p-4">Tgl & Waktu Presensi</th>
              <th class="p-4 text-center">Status Keputusan</th>
              <th class="p-4">Kesesuaian Seragam</th>
              <th class="p-4">Sanggahan Karyawan</th>
              <th class="p-4">Pemeriksa (Validator)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    let countACC = 0;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status_acc && data.status_acc !== "PENDING") {
        countACC++;
        const tglPresensi = data.waktu || '-';
        
        const badgeStatus = data.status_acc === "ACC"
          ? `<span class="px-2 py-1 bg-green-50 text-green-700 font-bold text-[10px] rounded-lg"><i class="fas fa-check mr-1"></i>Disetujui (ACC)</span>`
          : `<span class="px-2 py-1 bg-red-50 text-red-600 font-bold text-[10px] rounded-lg"><i class="fas fa-times mr-1"></i>Ditolak (REJECT)</span>`;

        const txtSanggah = data.catatan_banding 
          ? `<span class="text-amber-600 font-bold cursor-help" title="${data.catatan_banding}">Ada Sanggahan <i class="fas fa-info-circle"></i></span>` 
          : `<span class="text-gray-300">-</span>`;

        html += `
          <tr class="hover:bg-gray-50 transition">
            <td class="p-4 font-bold text-blue-900">${data.nama_pegawai || data.nama || 'Anonim'}<br><span class="text-[10px] text-gray-400 font-normal font-mono">${data.email || ''}</span></td>
            <td class="p-4 font-semibold text-slate-700">${tglPresensi}</td>
            <td class="p-4 text-center">${badgeStatus}</td>
            <td class="p-4 font-bold ${data.seragam === 'Tidak Sesuai' ? 'text-red-500' : 'text-slate-600'}">${data.seragam || 'Sesuai'}</td>
            <td class="p-4">${txtSanggah}</td>
            <td class="p-4 text-[10px] text-gray-500 font-mono">${data.validated_by || 'Sistem'}</td>
          </tr>
        `;
      }
    });

    html += `</tbody></table></div>`;

    if (countACC === 0) {
      container.innerHTML = `<div class="text-center py-10 bg-white rounded-3xl border border-dashed text-gray-400 text-xs">Belum ada riwayat absensi yang divalidasi.</div>`;
    } else {
      container.innerHTML = html;
    }
  } catch (e) {
    console.error("Error muat riwayat ACC:", e);
    container.innerHTML = `<div class="text-center py-8 text-red-500 text-xs">Gagal memuat riwayat persetujuan.</div>`;
  }
};

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

window._bandingFileGlobal = null;

window.bukaModalAjuBanding = function(docId) {
  document.getElementById('banding-doc-id').value = docId;
  document.getElementById('banding-alasan').value = "";
  document.getElementById('banding-file').value = "";
  document.getElementById('banding-file-info').innerText = "";
  window._bandingFileGlobal = null;
  document.getElementById('modal-aju-banding').classList.remove('hidden');
};

window.tutupModalAjuBanding = function() {
  document.getElementById('modal-aju-banding').classList.add('hidden');
};

window.pilihFileBanding = function(event) {
  const file = event.target.files[0];
  const info = document.getElementById('banding-file-info');
  const BATAS_1MB = 1024 * 1024;

  if (!file) { window._bandingFileGlobal = null; info.innerText = ""; return; }

  if (file.size > BATAS_1MB) {
    alert(`File terlalu besar (${Math.round(file.size / 1024)}KB). Maksimal 1MB.`);
    event.target.value = "";
    window._bandingFileGlobal = null;
    info.innerText = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    window._bandingFileGlobal = { dataUrl: e.target.result, tipe: file.type.startsWith('video') ? 'video' : 'foto', nama: file.name };
    info.innerHTML = `<i class="fas fa-check-circle text-green-500 mr-1"></i>${file.name} (${Math.round(file.size / 1024)}KB) siap diunggah`;
  };
  reader.readAsDataURL(file);
};

window.kirimAjuBanding = async function() {
  const docId = document.getElementById('banding-doc-id').value;
  const alasan = document.getElementById('banding-alasan').value;

  if (!alasan) return alert("Harap isi alasan sanggahan Anda!");

  try {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const dataBanding = {
      catatan_banding: alasan,
      tgl_banding: new Date().toISOString()
    };
    if (window._bandingFileGlobal) {
      dataBanding.lampiran_banding = window._bandingFileGlobal.dataUrl;
      dataBanding.lampiran_banding_tipe = window._bandingFileGlobal.tipe;
    }

    const docRef = doc(db, "absensi", docId);
    await updateDoc(docRef, dataBanding);

    alert("Sanggahan berhasil dikirimkan ke Admin / Owner untuk ditinjau ulang.");
    window.tutupModalAjuBanding();
    window._bandingFileGlobal = null;
    
    if(window.muatDataRiwayatPersonal) window.muatDataRiwayatPersonal();
  } catch (e) {
    console.error("Gagal kirim banding:", e);
    alert("Gagal mengirimkan sanggahan ke server. Kalau ada lampiran, coba kirim tanpa lampiran atau pakai file lebih kecil.");
  }
};
