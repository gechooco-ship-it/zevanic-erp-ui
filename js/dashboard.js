// js/dashboard.js
import { collection, addDoc, getDocs, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// js/dashboard.js (Tambahan & Pembaruan Profil + Jam Kerja)

window.muatDataProfil = function() {
  document.getElementById('profil-nama').innerText = window.currentUser.name;
  document.getElementById('profil-jabatan').innerText = window.currentUser.jabatan;
  document.getElementById('profil-id-kar').innerText = window.currentUser.id_karyawan;
  document.getElementById('profil-id-app').innerText = window.currentUser.id_app;
  document.getElementById('profil-email').innerText = window.currentUser.email;
  document.getElementById('profil-role').innerText = window.currentUser.role;
  document.getElementById('profil-status').innerText = window.currentUser.status_kerja;
  
  // Isi juga nilai pada input form edit profil
  document.getElementById('profil-input-nama').value = window.currentUser.name;
  document.getElementById('profil-input-email').value = window.currentUser.email;
  document.getElementById('profil-input-jabatan').value = window.currentUser.jabatan;

  const qrData = "QR-" + window.currentUser.id_app;
  document.getElementById('profil-qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

  // Jalankan penghitung jam kerja di header jika sudah clock-in
  window.mulaiHitungJamKerja();
};

// ====== FITUR BARU: PENGHITUNG JAM KERJA OTOMATIS DI HEADER (Blueprint 3.2.1) ======
// js/dashboard.js (Pembaruan Tampilan Jam Kerja & Shift)
let intervalJamKerja = null;

window.mulaiHitungJamKerja = function() {
  const headerBadge = document.getElementById('label-badge-role');
  if (!headerBadge) return;

  // Kita buat tampilannya lebih besar, tebal, dan jelas (misal: Shift Masuk 01:00)
  if (intervalJamKerja) clearInterval(intervalJamKerja);

  intervalJamKerja = setInterval(() => {
    const sekarang = new Date();
    
    // Contoh asumsi Shift Masuk hari ini pukul 01:00 (bisa disesuaikan dengan database shift nanti)
    const jamMasukShift = new Date();
    jamMasukShift.setHours(1, 0, 0, 0); // Pukul 01:00 WIB

    const selisihMs = sekarang - jamMasukShift;
    let statusTeks = "";

    if (selisihMs < 0) {
      // Masih sebelum jam masuk (hitung mundur / early)
      const sisaMs = Math.abs(selisihMs);
      const jam = Math.floor(sisaMs / (1000 * 60 * 60));
      const menit = Math.floor((sisaMs % (1000 * 60 * 60)) / (1000 * 60));
      const detik = Math.floor((sisaMs % (1000 * 60)) / 1000);
      statusTeks = `🟢 Tepat Waktu (Masuk dlm -${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')})`;
    } else {
      // Sudah lewat dari jam masuk (terlambat / telat)
      const jam = Math.floor(selisihMs / (1000 * 60 * 60));
      const menit = Math.floor((selisihMs % (1000 * 60 * 60)) / (1000 * 60));
      const detik = Math.floor((selisihMs % (1000 * 60)) / 1000);
      statusTeks = `🔴 Terlambat (+${jam.toString().padStart(2,'0')}:${menit.toString().padStart(2,'0')}:${detik.toString().padStart(2,'0')})`;
    }

    // Ubah ukuran font jadi lebih besar dan jelas dibaca
    headerBadge.className = "text-xs md:text-sm font-black text-slate-800 uppercase tracking-wider flex items-center mb-0.5 bg-slate-100 px-3 py-1 rounded-lg border";
    headerBadge.innerHTML = `<i class="far fa-clock mr-1.5 text-blue-600 animate-pulse"></i> Shift 01:00 | ${statusTeks}`;
  }, 1000);
};

// ====== FITUR BARU: SIMPAN PERUBAHAN AKUN PROFILE ======
window.simpanPerubahanProfil = async function() {
  const namaBaru = document.getElementById('profil-input-nama').value;
  const hpBaru = document.getElementById('profil-input-hp').value;

  if (!namaBaru) {
    alert("Nama tidak boleh kosong!");
    return;
  }

  try {
    const userRef = doc(db, "users", window.currentUser.email);
    await updateDoc(userRef, {
      nama: namaBaru,
      hp: hpBaru
    });

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
      persetujuan: "PENDING"
    };

    if (window.statusPilihanGlobal === "IZIN" || window.statusPilihanGlobal === "CUTI") {
      dataKirim.tanggal_pengajuan = window.tanggalIzinGlobal;
      dataKirim.keterangan = window.keteranganIzinGlobal;
    }

    await addDoc(collection(db, "attendance"), dataKirim);
    return true;
  } catch (e) {
    console.error("Gagal simpan:", e);
    return false;
  }
};

window.kirimDataKeCloud = async function() {
  const btnFinal = document.getElementById('btn-clock-in-final');
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

      // ====== LOGIKA PINTAR: SIMPAN MEMORI ======
      if (window.statusPilihanGlobal === "HADIR (CLOCK IN)") {
          // Tandai bahwa karyawan ini sudah absen hari ini
          localStorage.setItem('zevanic_absen_' + window.currentUser.email, hariIni);
      } else if (window.statusPilihanGlobal === "CLOCK OUT") {
          // Tandai bahwa karyawan ini sudah pulang
          localStorage.setItem('zevanic_absen_' + window.currentUser.email, "OUT_" + hariIni);
      }
      // ==========================================

      if (window.statusPilihanGlobal === "CLOCK OUT") {
          alert("Clock Out berhasil! Hati-hati di jalan.");
          window.pindahLayar('screen-login');
      } else {
          window.pindahLayar('screen-dashboard');
          window.pindahTab('tab-riwayat'); 
      }
  }
};

window.muatDataRiwayat = async function() {
  const tbody = document.getElementById('tabel-riwayat-body');
  tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Memuat data...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "attendance"));
  tbody.innerHTML = "";
  
  querySnapshot.forEach((document) => {
    const d = document.data();
    if(d.email === window.currentUser.email) {
      let badgeColor = d.persetujuan === "ACC" ? "bg-green-100 text-green-700" : (d.persetujuan === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700");
      tbody.innerHTML += `
        <tr class="hover:bg-gray-50">
          <td class="p-4 text-xs">${d.waktu}</td>
          <td class="p-4 font-semibold text-xs">${d.status}</td>
          <td class="p-4"><img src="${d.foto_selfie}" class="w-10 h-10 rounded-lg object-cover border"></td>
          <td class="p-4"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${badgeColor}">${d.persetujuan}</span></td>
        </tr>`;
    }
  });
  if(tbody.innerHTML === "") tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Belum ada riwayat.</td></tr>';
};

window.muatDataAdminACC = async function() {
  const tbody = document.getElementById('tabel-admin-body');
  tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Memuat data...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "attendance"));
  tbody.innerHTML = "";
  
  querySnapshot.forEach((document) => {
    const d = document.data();
    let idDoc = document.id;
    let badgeColor = d.persetujuan === "ACC" ? "bg-green-100 text-green-700" : (d.persetujuan === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700");
    
    tbody.innerHTML += `
      <tr class="hover:bg-gray-50">
        <td class="p-4 font-bold text-xs">${d.nama_pegawai}<br><span class="text-[10px] text-gray-400 font-normal">${d.email}</span></td>
        <td class="p-4 text-xs">${d.waktu}<br><span class="text-blue-600 font-semibold">${d.status}</span></td>
        <td class="p-4"><img src="${d.foto_selfie}" class="w-10 h-10 rounded-lg object-cover border"></td>
        <td class="p-4 flex items-center space-x-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor} mr-2">${d.persetujuan}</span>
          <button onclick="ubahStatusACC('${idDoc}', 'ACC')" class="bg-green-500 text-white px-2.5 py-1 rounded text-xs font-bold hover:bg-green-600">ACC</button>
          <button onclick="ubahStatusACC('${idDoc}', 'REJECTED')" class="bg-red-500 text-white px-2.5 py-1 rounded text-xs font-bold hover:bg-red-600">Tolak</button>
        </td>
      </tr>`;
  });
};

window.ubahStatusACC = async function(idDoc, statusBaru) {
  await updateDoc(doc(db, "attendance", idDoc), { persetujuan: statusBaru });
  alert("Status berhasil diperbarui!");
  window.muatDataAdminACC();
};

window.muatDataSuperUser = async function() {
  const tbody = document.getElementById('tabel-superuser-body');
  tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Memuat data user...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "users"));
  tbody.innerHTML = "";
  querySnapshot.forEach((document) => {
    const d = document.data();
    let idDoc = document.id; // idDoc di database kita adalah email
    
    // Warna badge status kerja
    let warnaStatus = (d.status_kerja === "Aktif" || d.status_kerja === "aktif") ? "text-green-500" : "text-red-500";

    tbody.innerHTML += `
      <tr class="hover:bg-gray-50">
        <td class="p-4 font-bold text-xs">${d.nama}<br><span class="text-[10px] font-mono text-gray-500">${d.id_karyawan} (${d.id_app})</span></td>
        <td class="p-4 text-xs">${d.email}<br><span class="text-gray-500">${d.jabatan || 'Staff'}</span></td>
        <td class="p-4 text-xs font-semibold text-blue-600 uppercase">${d.role} <br> <span class="text-[10px] ${warnaStatus}">${d.status_kerja || 'Aktif'}</span></td>
        <td class="p-4">
          <button onclick="bukaEditUser('${idDoc}')" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200 transition">
            <i class="fas fa-edit"></i> Edit
          </button>
        </td>
      </tr>`;
  });
};

// ====== FUNGSI BARU: BUKA, TUTUP, DAN SIMPAN MODAL EDIT ======

window.bukaEditUser = async function(emailId) {
  const userRef = doc(db, "users", emailId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const d = userSnap.data();
    
    // Isi data ke dalam modal
    document.getElementById('edit-email-asli').value = emailId;
    document.getElementById('edit-nama').value = d.nama || "";
    document.getElementById('edit-email').value = d.email || "";
    document.getElementById('edit-role').value = d.role || "operator";
    document.getElementById('edit-jabatan').value = d.jabatan || "Staff";
    
    // Kapitalisasi awal untuk status kerja ("Aktif" atau "Tidak Aktif")
    let statusSet = (d.status_kerja === "aktif") ? "Aktif" : (d.status_kerja || "Aktif");
    document.getElementById('edit-status').value = statusSet;
    
    document.getElementById('edit-gudang').value = d.gudang_penempatan || "";
    
    // Tampilkan Foto KTP
    const imgPreview = document.getElementById('edit-preview-ktp');
    if (d.foto_ktp) {
        imgPreview.src = d.foto_ktp;
        imgPreview.classList.remove('hidden');
    } else {
        imgPreview.classList.add('hidden');
    }
    
    // Tampilkan Modal
    document.getElementById('modal-edit-user').classList.remove('hidden');
  } else {
    alert("Data karyawan tidak ditemukan!");
  }
};

window.tutupEditUser = function() {
  document.getElementById('modal-edit-user').classList.add('hidden');
};

window.simpanEditUser = async function() {
  const btnSimpan = event.currentTarget;
  btnSimpan.innerText = "Menyimpan...";
  btnSimpan.disabled = true;

  const emailId = document.getElementById('edit-email-asli').value;
  const roleBaru = document.getElementById('edit-role').value;
  const jabatanBaru = document.getElementById('edit-jabatan').value;
  const statusBaru = document.getElementById('edit-status').value;
  const gudangBaru = document.getElementById('edit-gudang').value;

  try {
    const userRef = doc(db, "users", emailId);
    await updateDoc(userRef, {
      role: roleBaru,
      jabatan: jabatanBaru,
      status_kerja: statusBaru,
      gudang_penempatan: gudangBaru
    });
    
    alert("Data karyawan berhasil diperbarui!");
    window.tutupEditUser();
    window.muatDataSuperUser(); // Otomatis refresh tabel setelah simpan
    
  } catch (error) {
    console.error("Gagal update:", error);
    alert("Terjadi kesalahan saat mengupdate data.");
  } finally {
    btnSimpan.innerHTML = '<i class="fas fa-save mr-1"></i> Simpan Perubahan';
    btnSimpan.disabled = false;
  }
};
