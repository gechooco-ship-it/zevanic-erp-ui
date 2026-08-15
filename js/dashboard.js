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
          if (window.bukaTabAbsensiProfile) window.bukaTabAbsensiProfile();
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

  if (tabId === 'tab-admin-acc') {
      if (window.pindahSubTab) window.pindahSubTab('sub-absensi', 'sub-absensi-accept', document.querySelectorAll('.sub-absensi-btn')[2]);
  }
  
};

// Account Profile (Account/QR, Data Karyawan self-edit, Absensi dengan
// Izin/Cuti/Lembur + riwayat) sudah pindah ke js/vue-account-profile.js.
// window.mulaiHitungJamKerja TETAP dipertahankan (dipanggil dari Vue).


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

// Aju Banding (window._bandingFileGlobal/bukaModalAjuBanding/
// tutupModalAjuBanding/pilihFileBanding/kirimAjuBanding) sudah pindah ke
// komponen AjuBandingModal di js/vue-account-profile.js.
