// js/dashboard.js
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

;

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
          window.pindahTab('tab-riwayat'); 
      }
  }
};

;

// ====== PANEL ACC PIC & VALIDASI ======
;

window.submitUpdateACC = async function(idDoc) {
  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  const seragamVal = document.getElementById(`seragam-${idDoc}`).value;
  const statusHadirVal = document.getElementById(`statushadir-${idDoc}`).value;

  try {
    await updateDoc(doc(db, "attendance", idDoc), {
      seragam: seragamVal,
      status_kehadiran: statusHadirVal,
      persetujuan: "ACC" // Otomatis tandai sudah di proses
    });
    alert("Data Kehadiran Berhasil Diperbarui!");
    window.muatDataAdminACC(); 
  } catch (e) {
    console.error("Gagal update:", e);
    alert("Gagal menyimpan data.");
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

window.hapusDataAbsensi = async function(idDoc) {
  if(confirm("Apakah Anda yakin ingin menghapus data absensi ini?")) {
    try {
      await deleteDoc(doc(db, "attendance", idDoc));
      alert("Data berhasil dihapus!");
      window.muatDataAdminACC();
    } catch (e) {
      console.error("Gagal menghapus:", e);
      alert("Terjadi kesalahan saat menghapus data.");
    }
  }
};

window.bukaPreviewFoto = function(src) {
  document.getElementById('img-preview-besar').src = src;
  document.getElementById('modal-preview-foto').classList.remove('hidden');
};
window.tutupPreviewFoto = function() {
  document.getElementById('modal-preview-foto').classList.add('hidden');
  document.getElementById('img-preview-besar').src = "";
};

// ====== ZONA KONTROL OWNER ======
window.muatDataSuperUser = async function() {
  const tbody = document.getElementById('tabel-superuser-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">Memuat data user...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "users"));
  tbody.innerHTML = "";
  querySnapshot.forEach((document) => {
    const d = document.data();
    let idDoc = document.id;
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

window.bukaEditUser = async function(emailId) {
  const userRef = doc(db, "users", emailId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const d = userSnap.data();
    document.getElementById('edit-email-asli').value = emailId;
    document.getElementById('edit-nama').value = d.nama || "";
    document.getElementById('edit-email').value = d.email || "";
    document.getElementById('edit-role').value = d.role || "operator";
    document.getElementById('edit-jabatan').value = d.jabatan || "Staff";
    
    let statusSet = (d.status_kerja === "aktif") ? "Aktif" : (d.status_kerja || "Aktif");
    document.getElementById('edit-status').value = statusSet;
    document.getElementById('edit-gudang').value = d.gudang_penempatan || "";
    
    const imgPreview = document.getElementById('edit-preview-ktp');
    if (d.foto_ktp) {
        imgPreview.src = d.foto_ktp;
        imgPreview.classList.remove('hidden');
    } else {
        imgPreview.classList.add('hidden');
    }
    
    document.getElementById('modal-edit-user').classList.remove('hidden');
  } else {
    alert("Data karyawan tidak ditemukan!");
  }
};
window.tutupEditUser = function() { document.getElementById('modal-edit-user').classList.add('hidden'); };

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
    window.muatDataSuperUser();
  } catch (error) {
    console.error("Gagal update:", error);
    alert("Terjadi kesalahan saat mengupdate data.");
  } finally {
    btnSimpan.innerHTML = '<i class="fas fa-save mr-1"></i> Simpan Perubahan';
    btnSimpan.disabled = false;
  }
};

// ====== NAVIGASI SUB-MENU ======
window.pindahSubTab = function(grupKelas, tabIdTujuan, elemenTombol) {
  const semuaKonten = document.querySelectorAll('.' + grupKelas + '-content');
  semuaKonten.forEach(el => el.classList.add('hidden'));
  document.getElementById(tabIdTujuan).classList.remove('hidden');
  
  const semuaTombol = document.querySelectorAll('.' + grupKelas + '-btn');
  semuaTombol.forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
    btn.classList.add('bg-white', 'text-gray-600');
  });
  
  if(elemenTombol) {
    elemenTombol.classList.remove('bg-white', 'text-gray-600');
    elemenTombol.classList.add('bg-blue-600', 'text-white', 'shadow-md');
  }
};

// =========================================================================
// ====== MODUL CONFIG ABSENSI (3.3.1.4.1 - MASTER GUDANG & SHIFT) ======
// =========================================================================

window.muatConfigAbsensi = function() {
  window.muatMasterGudang();
  window.muatMasterShift();
};

window.simpanMasterGudang = async function() {
  const nama = document.getElementById('conf-gudang-nama').value;
  const lat = document.getElementById('conf-gudang-lat').value;
  const lng = document.getElementById('conf-gudang-lng').value;
  const radius = document.getElementById('conf-gudang-radius').value;

  if(!nama || !lat || !lng || !radius) return alert("Semua kolom Master Gudang harus diisi lengkap!");

  try {
    await addDoc(collection(db, "master_gudang"), {
      nama_gudang: nama,
      latitude: lat,
      longitude: lng,
      radius: parseInt(radius)
    });
    alert("Master Gudang Berhasil Disimpan!");
    
    document.getElementById('conf-gudang-nama').value = '';
    document.getElementById('conf-gudang-lat').value = '';
    document.getElementById('conf-gudang-lng').value = '';
    document.getElementById('conf-gudang-radius').value = '';
    
    window.muatMasterGudang();
  } catch (e) {
    console.error(e);
    alert("Gagal menyimpan data gudang ke Firebase.");
  }
};

window.muatMasterGudang = async function() {
  const tbody = document.getElementById('tabel-gudang-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="p-2 text-center text-gray-400">Memuat data...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "master_gudang"));
  tbody.innerHTML = "";
  
  querySnapshot.forEach((document) => {
    const d = document.data();
    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
        <td class="p-2 font-bold text-blue-800">${d.nama_gudang}</td>
        <td class="p-2 text-[10px] text-gray-500 font-mono">Lat: ${d.latitude}<br>Lng: ${d.longitude}<br><span class="font-bold text-red-500">Radius: ${d.radius} m</span></td>
        <td class="p-2 text-center">
          <button onclick="hapusMasterGudang('${document.id}')" class="text-red-500 hover:text-white hover:bg-red-500 font-bold px-2 py-1.5 bg-red-50 rounded-lg transition"><i class="fas fa-trash-alt"></i></button>
        </td>
      </tr>
    `;
  });
  if(tbody.innerHTML === "") tbody.innerHTML = '<tr><td colspan="3" class="p-2 text-center text-gray-400">Belum ada data gudang terdaftar.</td></tr>';
};

window.hapusMasterGudang = async function(idDoc) {
  if(confirm("Yakin ingin menghapus Gudang ini dari Master Data?")) {
    await deleteDoc(doc(db, "master_gudang", idDoc));
    window.muatMasterGudang();
  }
};

window.simpanMasterShift = async function() {
  const nama = document.getElementById('conf-shift-nama').value;
  const inTime = document.getElementById('conf-shift-in').value;
  const outTime = document.getElementById('conf-shift-out').value;

  if(!nama || !inTime || !outTime) return alert("Semua kolom Master Shift harus diisi lengkap!");

  try {
    await addDoc(collection(db, "master_shift"), {
      nama_shift: nama,
      jam_masuk: inTime,
      jam_keluar: outTime
    });
    alert("Master Shift Berhasil Disimpan!");
    
    document.getElementById('conf-shift-nama').value = '';
    document.getElementById('conf-shift-in').value = '';
    document.getElementById('conf-shift-out').value = '';
    
    window.muatMasterShift();
  } catch (e) {
    console.error(e);
    alert("Gagal menyimpan data shift.");
  }
};

window.muatMasterShift = async function() {
  const tbody = document.getElementById('tabel-shift-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="p-2 text-center text-gray-400">Memuat data...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "master_shift"));
  tbody.innerHTML = "";
  
  querySnapshot.forEach((document) => {
    const d = document.data();
    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
        <td class="p-2 font-bold text-amber-700">${d.nama_shift}</td>
        <td class="p-2 text-[10px] text-gray-500 font-bold">In: <span class="text-green-600">${d.jam_masuk}</span><br>Out: <span class="text-red-500">${d.jam_keluar}</span></td>
        <td class="p-2 text-center">
          <button onclick="hapusMasterShift('${document.id}')" class="text-red-500 hover:text-white hover:bg-red-500 font-bold px-2 py-1.5 bg-red-50 rounded-lg transition"><i class="fas fa-trash-alt"></i></button>
        </td>
      </tr>
    `;
  });
  if(tbody.innerHTML === "") tbody.innerHTML = '<tr><td colspan="3" class="p-2 text-center text-gray-400">Belum ada data shift terdaftar.</td></tr>';
};

window.hapusMasterShift = async function(idDoc) {
  if(confirm("Yakin ingin menghapus Shift ini dari Master Data?")) {
    await deleteDoc(doc(db, "master_shift", idDoc));
    window.muatMasterShift();
  }
};

// =========================================================================
// ====== MODUL PENJADWALAN KARYAWAN (3.3.1.4.2) ======
// =========================================================================

window.muatDataPenjadwalan = async function() {
  const dropdownKaryawan = document.getElementById('dropdown-karyawan');
  const optGudang = document.getElementById('jadwal-gudang');
  const optShift = document.getElementById('jadwal-shift');
  
  // 1. Muat Opsi Karyawan ke dalam Custom Search Dropdown
  const qKaryawan = await getDocs(collection(db, "users"));
  dropdownKaryawan.innerHTML = ''; 
  qKaryawan.forEach(doc => {
      const d = doc.data();
      if(d.role !== 'owner') { 
          // Masukkan list ke dropdown
          dropdownKaryawan.innerHTML += `
            <div class="karyawan-option px-4 py-2 hover:bg-blue-50 cursor-pointer text-xs transition" onclick="pilihKaryawanDariList('${doc.id}', '${d.nama}')">
              <span class="font-bold text-gray-800 block">${d.nama}</span>
              <span class="text-[10px] text-gray-500">${d.email} - Role: ${d.role}</span>
            </div>`;
      }
  });

  // 2. Muat Opsi Gudang (Tetap pakai <select> karena jumlah gudang biasanya tidak ratusan)
  const qGudang = await getDocs(collection(db, "master_gudang"));
  optGudang.innerHTML = '<option value="">-- Pilih Gudang --</option>';
  qGudang.forEach(doc => {
      optGudang.innerHTML += `<option value="${doc.data().nama_gudang}">${doc.data().nama_gudang}</option>`;
  });

  // 3. Muat Opsi Shift (Tetap pakai <select>)
  const qShift = await getDocs(collection(db, "master_shift"));
  optShift.innerHTML = '<option value="">-- Pilih Shift --</option>';
  qShift.forEach(doc => {
      const d = doc.data();
      optShift.innerHTML += `<option value="${d.nama_shift}">${d.nama_shift} (${d.jam_masuk} - ${d.jam_keluar})</option>`;
  });

  // 4. Muat Tabel Jadwal Aktif
  window.muatTabelJadwal();
};

// ====== FUNGSI PELENGKAP SEARCH BOX KARYAWAN ======
window.bukaDropdownKaryawan = function() {
  document.getElementById('dropdown-karyawan').classList.remove('hidden');
};

window.filterPencarianKaryawan = function() {
  const kataKunci = document.getElementById('jadwal-karyawan-search').value.toLowerCase();
  const daftarOpsi = document.querySelectorAll('.karyawan-option');
  
  // Buka dropdown saat mengetik
  document.getElementById('dropdown-karyawan').classList.remove('hidden');

  // Sembunyikan yang tidak cocok dengan ketikan
  daftarOpsi.forEach(opsi => {
      const teks = opsi.innerText.toLowerCase();
      if(teks.includes(kataKunci)) {
          opsi.style.display = "block";
      } else {
          opsi.style.display = "none";
      }
  });
};

window.pilihKaryawanDariList = function(emailId, nama) {
  // Masukkan nama ke kotak pencarian
  document.getElementById('jadwal-karyawan-search').value = nama;
  // Masukkan email (ID) ke input tersembunyi untuk dikirim ke database
  document.getElementById('jadwal-karyawan').value = emailId;
  // Tutup dropdown
  document.getElementById('dropdown-karyawan').classList.add('hidden');
};

// Menutup dropdown jika user mengklik area luar kotak
document.addEventListener('click', function(event) {
  const wadahPencarian = document.getElementById('jadwal-karyawan-search');
  const dropdown = document.getElementById('dropdown-karyawan');
  
  if (wadahPencarian && dropdown) {
      if (event.target !== wadahPencarian && !dropdown.contains(event.target)) {
          dropdown.classList.add('hidden');
      }
  }
});

window.simpanJadwalKaryawan = async function() {
  const email = document.getElementById('jadwal-karyawan').value;
  const gudang = document.getElementById('jadwal-gudang').value;
  const shift = document.getElementById('jadwal-shift').value;
  const libur = document.getElementById('jadwal-libur').value;

  if(!email || !gudang || !shift) return alert("Harap pilih Karyawan, Gudang, dan Shift!");

  try {
      // Perbarui dokumen karyawan (mengawinkan data)
      await updateDoc(doc(db, "users", email), {
          gudang_penempatan: gudang,
          nama_shift: shift,
          hari_libur: libur
      });
      alert("Jadwal Karyawan Berhasil Diperbarui!");
      window.muatTabelJadwal();
  } catch (e) {
      console.error(e);
      alert("Gagal menyimpan jadwal.");
  }
};

window.muatTabelJadwal = async function() {
  const tbody = document.getElementById('tabel-jadwal-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-gray-400">Memuat data...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "users"));
  tbody.innerHTML = "";
  
  querySnapshot.forEach((document) => {
      const d = document.data();
      // Tampilkan hanya karyawan yang sudah disetting penjadwalannya
      if(d.gudang_penempatan || d.nama_shift) {
          tbody.innerHTML += `
              <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <td class="p-3 font-bold text-xs">${d.nama} <br><span class="text-[10px] text-gray-400 font-normal">${d.email}</span></td>
                  <td class="p-3 text-xs text-blue-600 font-bold"><i class="fas fa-building mr-1"></i> ${d.gudang_penempatan || '-'}</td>
                  <td class="p-3 text-xs text-amber-600 font-bold">
                    <i class="fas fa-clock mr-1"></i> ${d.nama_shift || '-'} 
                    <br><span class="text-[10px] text-red-500 font-semibold"><i class="fas fa-calendar-times mr-1 mt-1"></i> Libur: ${d.hari_libur || 'Tidak ada'}</span>
                  </td>
              </tr>
          `;
      }
  });
  
  if(tbody.innerHTML === "") {
      tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-gray-400">Belum ada karyawan yang dijadwalkan.</td></tr>';
  }
};

// =========================================================================
// ====== MODUL REKAP ABSENSI & EXPORT XLS (3.3.1.4.4) ======
// =========================================================================

window.siapkanFilterRekap = async function() {
  const optGudang = document.getElementById('rekap-filter-gudang');
  const optShift = document.getElementById('rekap-filter-shift');
  
  // Set default filter tanggal (Bulan ini: Tgl 1 s/d Hari ini)
  const hariIni = new Date();
  const tglAwal = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1);
  document.getElementById('rekap-filter-start').value = tglAwal.toISOString().split('T')[0];
  document.getElementById('rekap-filter-end').value = hariIni.toISOString().split('T')[0];

  // Muat opsi Gudang dari Master
  const qGudang = await getDocs(collection(db, "master_gudang"));
  optGudang.innerHTML = '<option value="SEMUA">Semua Gudang</option>';
  qGudang.forEach(doc => {
      optGudang.innerHTML += `<option value="${doc.data().nama_gudang}">${doc.data().nama_gudang}</option>`;
  });

  // Muat opsi Shift dari Master
  const qShift = await getDocs(collection(db, "master_shift"));
  optShift.innerHTML = '<option value="SEMUA">Semua Shift</option>';
  qShift.forEach(doc => {
      optShift.innerHTML += `<option value="${doc.data().nama_shift}">${doc.data().nama_shift}</option>`;
  });
};

window.muatDataRekap = async function() {
  const filterGudang = document.getElementById('rekap-filter-gudang').value;
  // Note: Database "attendance" kita saat ini belum menyimpan kolom shift secara langsung, 
  // Untuk query kompleks bisa dikembangkan nanti. Kita filter via JavaScript.
  const filterStart = new Date(document.getElementById('rekap-filter-start').value);
  const filterEnd = new Date(document.getElementById('rekap-filter-end').value);
  filterEnd.setHours(23, 59, 59); // Sampai akhir hari tersebut

  const tbody = document.getElementById('tabel-rekap-body');
  tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Menarik data...</td></tr>';
  
  try {
      const querySnapshot = await getDocs(collection(db, "attendance"));
      tbody.innerHTML = "";
      let adaData = false;

      querySnapshot.forEach((document) => {
          const d = document.data();
          
          // Parsing string waktu "DD/MM/YYYY, HH:mm:ss" ke Object Date JavaScript
          // Hati-hati: Format locale string bisa bervariasi. Asumsi format ID: DD/MM/YYYY
          let tglAbsen = null;
          if (d.waktu) {
              let parts = d.waktu.split(', ')[0].split('/');
              if (parts.length === 3) {
                  tglAbsen = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
              }
          }

          // Proses Filter
          let masukFilter = true;

          // Filter Tanggal
          if (tglAbsen) {
              if (tglAbsen < filterStart || tglAbsen > filterEnd) masukFilter = false;
          }

          // Filter Gudang (Asumsi d.penempatan akan disimpan saat clock-in nanti, jika kosong kita anggap lewat)
          if (filterGudang !== "SEMUA" && d.penempatan && d.penempatan !== filterGudang) masukFilter = false;
          
          // Cuma tampilkan yang sudah di ACC / Diproses (Memiliki status kehadiran)
          if(!d.status_kehadiran) masukFilter = false;

          if (masukFilter) {
              adaData = true;
              let warnaSeragam = d.seragam === 'Sesuai' ? 'text-emerald-600' : 'text-red-500';
              let ket = d.keterangan ? d.keterangan : '-';

              tbody.innerHTML += `
                  <tr class="hover:bg-emerald-50 transition border-b border-gray-100 last:border-0 text-xs">
                      <td class="p-3">${d.waktu}</td>
                      <td class="p-3 font-bold">${d.nama_pegawai}</td>
                      <td class="p-3">${d.penempatan || '-'}</td>
                      <td class="p-3 font-bold">${d.status_kehadiran}</td>
                      <td class="p-3 font-bold ${warnaSeragam}">${d.seragam}</td>
                      <td class="p-3 text-[10px] text-gray-500 italic truncate max-w-[150px]">${ket}</td>
                  </tr>
              `;
          }
      });

      if (!adaData) {
          tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Tidak ada data yang cocok dengan filter tersebut.</td></tr>';
      }
  } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-red-500">Gagal menarik data rekapitulasi.</td></tr>';
  }
};

window.exportKeExcel = function() {
  const table = document.getElementById("tabel-rekap-export");
  let csvContent = "";
  
  // Ambil semua baris di dalam tabel
  const rows = table.querySelectorAll("tr");
  
  for (let i = 0; i < rows.length; i++) {
      let row = [], cols = rows[i].querySelectorAll("td, th");
      
      for (let j = 0; j < cols.length; j++) {
          // Bersihkan teks dari newline dan koma agar format CSV tidak rusak
          let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/,/g, ";");
          row.push(data);
      }
      csvContent += row.join(",") + "\r\n";
  }

  // Buat Blob dan Link untuk Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", "Rekap_Absensi_Zevanic.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// =========================================================================
// ====== LOGIKA REGISTRASI KARYAWAN BARU (MASUK KE DATA KARYAWAN) ======
// =========================================================================

// 1. Fungsi mengubah file KTP menjadi gambar Base64 agar bisa disimpan
window.previewKTP = function(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgElement = document.getElementById('preview-ktp-img');
        imgElement.src = e.target.result;
        imgElement.classList.remove('hidden');
    };
    if(file) reader.readAsDataURL(file);
};

// 2. Fungsi Eksekusi Simpan Pendaftaran
window.simpanPendaftaranBaru = async function() {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    // Ambil field krusial (bisa ditambah variabel lain sesuai kebutuhan blueprint)
    const email = document.getElementById('reg-email').value;
    const nama = document.getElementById('reg-nama').value;
    const hp = document.getElementById('reg-hp').value;
    const nik = document.getElementById('reg-nik').value;

    if(!email || !nama || !hp || !nik) {
        alert("Harap isi field wajib: Nama, NIK, Email, dan No. HP!");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    // Auto-Generate ID Karyawan & ID APP (Format ZVN-XXXX)
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const idKar = "ZVN-" + randomNum;
    const idApp = "ZMS-" + randomNum;
    
    // Ambil Foto KTP jika dilampirkan
    const imgKTP = document.getElementById('preview-ktp-img').src;

    try {
        // Tembak data ke koleksi "users"
        await setDoc(doc(db, "users", email), {
            email: email,
            nama: nama,
            hp: hp,
            nik: nik,
            id_karyawan: idKar,
            id_app: idApp,
            role: "operator", // Default: Semua pendaftar baru adalah Operator
            jabatan: "Staff", // Default jabatan awal
            status_kerja: "Aktif",
            gudang_penempatan: "", // Akan diisi di Menu Penjadwalan
            nama_shift: "", // Akan diisi di Menu Penjadwalan
            foto_ktp: imgKTP.includes('base64') ? imgKTP : "",
            tanggal_daftar: new Date().toLocaleString('id-ID')
        });

        alert("Pendaftaran Berhasil! Data Karyawan sudah masuk ke sistem ERP.");
        
        // Bersihkan form & kembali ke halaman login
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-nama').value = '';
        document.getElementById('reg-hp').value = '';
        document.getElementById('reg-nik').value = '';
        document.getElementById('preview-ktp-img').src = '';
        document.getElementById('preview-ktp-img').classList.add('hidden');

        // Pindah layar ke Login
        window.pindahLayar('screen-login');

    } catch (e) {
        console.error("Gagal Daftar:", e);
        alert("Terjadi kesalahan saat memproses pendaftaran.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// =========================================================================
// ====== LOGIKA HALAMAN PROFILE (MENU MELAYANG & UPDATE DATA DIRI) ======
// =========================================================================

// Fungsi Navigasi Sub-Menu Profile (Sesuaikan dengan Style Menu Absensi)
;

// 3. Fungsi Update Semua Data Diri SUPER LENGKAP (CRUD)
;
// =========================================================================
// ====== LOGIKA HALAMAN PROFILE & OVERRIDE FUNGSI UTAMA ======
// =========================================================================

// =========================================================================
// ====== LOGIKA PERPINDAHAN TAB UTAMA (ANTI KETUMPUK) =====================
// =========================================================================
window.pindahTab = function(tabId) {
  // 1. Amankan dan sembunyikan SEMUA tab menggunakan daftar ID spesifik
  const tabs = ['tab-home', 'tab-profil', 'tab-riwayat', 'tab-admin-acc', 'tab-superuser'];
  tabs.forEach(tab => {
    const elemenTab = document.getElementById(tab);
    if (elemenTab) {
      elemenTab.classList.add('hidden');
    }
  });
  
  // 2. Tampilkan HANYA tab yang sedang diklik
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.remove('hidden');
  }

  // 3. Pemanggilan data otomatis sesuai tab yang aktif
  if (tabId === 'tab-profil') {
    if (window.pindahSubProfile) window.pindahSubProfile('profil-qr', document.querySelector('.sub-profil-btn'));
    if (window.muatDataProfil) window.muatDataProfil(); 
  }
  if (tabId === 'tab-riwayat' && window.muatDataRiwayat) window.muatDataRiwayat();
  if (tabId === 'tab-admin-acc' && window.muatDataAdminACC) window.muatDataAdminACC();
  if (tabId === 'tab-superuser' && window.muatDataSuperUser) window.muatDataSuperUser();
};

window.pindahSubProfile = function(targetId, elemenTombol) {
    const semuaKonten = document.querySelectorAll('.sub-profil-content');
    semuaKonten.forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById(targetId);
    if(target) target.classList.remove('hidden');
    
    const semuaTombol = document.querySelectorAll('.sub-profil-btn');
    semuaTombol.forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white', 'font-bold', 'shadow-sm');
        btn.classList.add('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
    });
    
    if(elemenTombol) {
        elemenTombol.classList.remove('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
        elemenTombol.classList.add('bg-slate-800', 'text-white', 'font-bold', 'shadow-sm');
    }

    if(targetId === 'profil-datadiri' && window.currentUser) {
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
};

window.muatDataProfil = function() {
    if(!window.currentUser) return;
    
    const elNama = document.getElementById('profil-nama-utama');
    const elIdApp = document.getElementById('profil-id-app-utama');
    const elJabatan = document.getElementById('profil-jabatan-utama');
    const elQr = document.getElementById('profil-qr-img');
    
    if(elNama) elNama.innerText = window.currentUser.name || window.currentUser.nama || "User";
    if(elIdApp) elIdApp.innerText = window.currentUser.id_app || "ID Tidak Ditemukan";
    if(elJabatan) elJabatan.innerText = window.currentUser.jabatan || window.currentUser.role || "Staff";
    
    if(elQr) {
        const qrData = window.currentUser.id_app || window.currentUser.email;
        elQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;
    }
    
    // Fallback old elements if they still exist elsewhere
    if(document.getElementById('profil-nama')) document.getElementById('profil-nama').innerText = window.currentUser.name || "";
    if(document.getElementById('profil-jabatan')) document.getElementById('profil-jabatan').innerText = window.currentUser.jabatan || "";
    
    if(window.mulaiHitungJamKerja) window.mulaiHitungJamKerja();
};

window.simpanUpdateDataDiriLengkap = async function() {
    const btn = event.currentTarget;
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const dataUpdate = {
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

        const userRef = doc(db, "users", window.currentUser.email);
        await updateDoc(userRef, dataUpdate);
        
        Object.assign(window.currentUser, dataUpdate);
        
        alert("Seluruh pembaruan data diri Anda berhasil disimpan secara sistem!");
        window.muatDataProfil(); 
    } catch (e) {
        console.error(e);
        alert("Gagal memperbarui data. Pastikan koneksi stabil.");
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
};

window.muatDataAdminACC = async function() {
  const container = document.getElementById('container-admin-acc');
  if(!container) return;
  
  container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p class="text-xs">Memuat data antrean absensi...</p></div>`;

  try {
    const querySnapshot = await getDocs(collection(db, "absensi"));
    let html = "";
    let countPending = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      if (!data.status_acc || data.status_acc === "PENDING") {
        countPending++;
        const fotoUrl = data.foto || "https://via.placeholder.com/150";
        const tanggalStr = data.waktu ? new Date(data.waktu).toLocaleString('id-ID') : "-";

        html += `
          <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3 text-xs">
            <div class="flex items-center space-x-3">
              <img src="${fotoUrl}" class="w-14 h-14 rounded-xl object-cover border">
              <div>
                <h4 class="font-bold text-gray-800 text-sm">${data.nama || "Pegawai"}</h4>
                <p class="text-[10px] text-gray-400">${data.email || "-"}</p>
                <span class="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded-full mt-1">Pending Validation</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2.5 rounded-xl text-gray-600">
              <div><span class="text-gray-400 block text-[9px]">Status:</span> <b>${data.status || "HADIR"}</b></div>
              <div><span class="text-gray-400 block text-[9px]">Waktu:</span> <b>${tanggalStr}</b></div>
              <div><span class="text-gray-400 block text-[9px]">Gudang:</span> <b>${data.gudang || "-"}</b></div>
              <div><span class="text-gray-400 block text-[9px]">Shift:</span> <b>${data.shift || "-"}</b></div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-gray-500 mb-0.5 font-semibold">Status ACC:</label>
                <select id="acc-status-${docId}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg outline-none font-bold text-slate-700">
                  <option value="ACC" selected>ACC / Disetujui</option>
                  <option value="REJECT">Tolak / Reject</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 mb-0.5 font-semibold">Seragam:</label>
                <select id="acc-seragam-${docId}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg outline-none font-bold text-slate-700">
                  <option value="Sesuai" ${data.seragam === "Sesuai" ? "selected" : ""}>Sesuai</option>
                  <option value="Tidak Sesuai" ${data.seragam === "Tidak Sesuai" ? "selected" : ""}>Tidak Sesuai</option>
                </select>
              </div>
            </div>

            <div class="flex space-x-2 pt-1">
              <button onclick="prosesAcceptAbsensi('${docId}')" class="flex-1 bg-green-600 text-white font-bold py-2 rounded-xl hover:bg-green-700 transition shadow-sm text-xs">
                <i class="fas fa-check-circle mr-1"></i> Submit ACC
              </button>
              <button onclick="hapusAbsensi('${docId}')" class="bg-red-50 text-red-600 font-bold px-3 py-2 rounded-xl hover:bg-red-100 transition text-xs" title="Hapus Data">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        `;
      }
    });

    if (countPending === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-gray-400 bg-white rounded-3xl border border-dashed">
          <i class="fas fa-check-double text-4xl text-green-400 mb-3"></i>
          <h4 class="font-bold text-gray-700 text-sm">Semua Absensi Telah Di-ACC</h4>
          <p class="text-xs text-gray-400 mt-0.5">Tidak ada antrean absensi baru yang perlu divalidasi.</p>
        </div>`;
    } else {
      container.innerHTML = html;
    }

  } catch (e) {
    console.error("Error muat admin ACC:", e);
    container.innerHTML = `<div class="col-span-full text-center py-8 text-red-500 text-xs">Gagal memuat data antrean.</div>`;
  }
};

window.prosesAcceptAbsensi = async function(docId) {
  const statusAcc = document.getElementById(`acc-status-${docId}`).value;
  const seragam = document.getElementById(`acc-seragam-${docId}`).value;

  try {
    const docRef = doc(db, "absensi", docId);
    await updateDoc(docRef, {
      status_acc: statusAcc,
      seragam: seragam,
      validated_at: new Date().toISOString(),
      validated_by: window.currentUser.name || window.currentUser.email
    });

    alert(`Absensi berhasil di-${statusAcc}! Data otomatis berpindah ke Rekapitulasi.`);
    window.muatDataAdminACC(); 
  } catch (e) {
    console.error("Gagal update ACC:", e);
    alert("Terjadi kesalahan saat memproses ACC.");
  }
};

window.hapusAbsensi = async function(docId) {
  if (!confirm("Apakah Anda yakin ingin menghapus data absensi ini secara permanen?")) return;
  try {
    await deleteDoc(doc(db, "absensi", docId));
    alert("Data absensi berhasil dihapus.");
    window.muatDataAdminACC();
  } catch (e) {
    console.error("Gagal hapus:", e);
    alert("Gagal menghapus data.");
  }
};

// Variable penyimpanan global untuk export CSV
window.dataFilterRiwayatGlobal = [];

// =========================================================================
// ====== MODUL RIWAYAT, REKAPITULASI, DAN EXPORT CSV ======================
// =========================================================================

window.muatDataRiwayat = async function() {
  const container = document.getElementById('container-riwayat-absensi');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-8 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-xl mb-1"></i><p>Memuat laporan absensi...</p></div>`;

  try {
    const userRole = (window.currentUser.role || 'operator').toLowerCase();
    const isOwnerOrPic = (userRole === 'owner' || userRole === 'pic' || userRole === 'admin' || userRole === 'superuser');

    // Ambil parameter filter
    const tglMulai = document.getElementById('filter-tgl-mulai')?.value;
    const tglSelesai = document.getElementById('filter-tgl-selesai')?.value;
    const filterGudang = document.getElementById('filter-gudang')?.value || 'ALL';
    const filterShift = document.getElementById('filter-shift')?.value || 'ALL';

    const querySnapshot = await getDocs(collection(db, "absensi"));
    let listData = [];

    // Reset Statistik
    let countHadir = 0;
    let countACC = 0;
    let countSeragamBeda = 0;
    let countIzin = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      data.id = docSnap.id;

      // Hak Akses: Owner/PIC lihat semua, Operator lihat milik sendiri
      const isMilikSendiri = data.email === window.currentUser.email;
      if (isOwnerOrPic || isMilikSendiri) {
        
        // Filter Tanggal
        let lolosTgl = true;
        if (data.waktu) {
          const tglData = new Date(data.waktu).toISOString().split('T')[0];
          if (tglMulai && tglData < tglMulai) lolosTgl = false;
          if (tglSelesai && tglData > tglSelesai) lolosTgl = false;
        }

        // Filter Gudang & Shift
        let lolosGudang = (filterGudang === 'ALL' || data.gudang === filterGudang);
        let lolosShift = (filterShift === 'ALL' || data.shift === filterShift);

        if (lolosTgl && lolosGudang && lolosShift) {
          listData.push(data);

          // Hitung Statistik
          if (data.status === "HADIR") countHadir++;
          else countIzin++;

          if (data.status_acc === "ACC") countACC++;
          if (data.seragam === "Tidak Sesuai") countSeragamBeda++;
        }
      }
    });

    // Update Angka Statistik UI
    if (document.getElementById('stat-hadir')) document.getElementById('stat-hadir').innerText = countHadir;
    if (document.getElementById('stat-acc')) document.getElementById('stat-acc').innerText = countACC;
    if (document.getElementById('stat-seragam')) document.getElementById('stat-seragam').innerText = countSeragamBeda;
    if (document.getElementById('stat-izin')) document.getElementById('stat-izin').innerText = countIzin;

    // Urutkan Tanggal Terbaru
    listData.sort((a, b) => new Date(b.waktu || 0) - new Date(a.waktu || 0));
    window.dataFilterRiwayatGlobal = listData; // Simpan untuk Export CSV

    if (listData.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 bg-white rounded-3xl border border-dashed text-gray-400 text-xs">
          <i class="fas fa-folder-open text-3xl mb-2 text-gray-300"></i>
          <p class="font-bold text-gray-600">Tidak ada data absensi ditemukan</p>
          <p class="text-[10px] text-gray-400">Coba ubah rentang tanggal atau parameter filter Anda.</p>
        </div>`;
      return;
    }

    let html = `
      <div class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[11px]">
            <tr>
              <th class="p-3">Karyawan</th>
              <th class="p-3">Waktu Presensi</th>
              <th class="p-3">Status</th>
              <th class="p-3">Gudang & Shift</th>
              <th class="p-3">Seragam</th>
              <th class="p-3 text-center">Status ACC</th>
              <th class="p-3 text-center">Aksi / Sanggahan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    listData.forEach(item => {
      const tgl = item.waktu ? new Date(item.waktu).toLocaleString('id-ID') : '-';
      const statusAccBadge = item.status_acc === "ACC" 
        ? `<span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] rounded-full">ACC (Valid)</span>`
        : item.status_acc === "REJECT"
        ? `<span class="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[9px] rounded-full">Ditolak</span>`
        : `<span class="px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[9px] rounded-full">Pending</span>`;

      // Tombol Aju Banding jika catatan tidak sesuai / ditolak
      let tombolBanding = `<span class="text-gray-300 text-[10px]">-</span>`;
      if (item.status_acc === "REJECT" || item.seragam === "Tidak Sesuai") {
        if (item.catatan_banding) {
          tombolBanding = `<span class="text-amber-600 font-bold text-[10px]" title="${item.catatan_banding}"><i class="fas fa-info-circle mr-1"></i>Telah Diajukan</span>`;
        } else {
          tombolBanding = `<button onclick="bukaModalAjuBanding('${item.id}')" class="px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 font-bold text-[10px] rounded-lg hover:bg-amber-100 transition"><i class="fas fa-gavel mr-1"></i>Aju Banding</button>`;
        }
      }

      html += `
        <tr class="hover:bg-gray-50 transition">
          <td class="p-3 font-semibold text-slate-800">
            ${item.nama || 'Pegawai'}<br>
            <span class="text-[10px] text-gray-400 font-normal">${item.email || ''}</span>
          </td>
          <td class="p-3">${tgl}</td>
          <td class="p-3"><span class="font-bold text-slate-700">${item.status || 'HADIR'}</span></td>
          <td class="p-3">${item.gudang || '-'} (${item.shift || '-'})</td>
          <td class="p-3">${item.seragam || 'Sesuai'}</td>
          <td class="p-3 text-center">${statusAccBadge}</td>
          <td class="p-3 text-center">${tombolBanding}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

  } catch (e) {
    console.error("Error muat riwayat:", e);
    container.innerHTML = `<div class="text-center py-8 text-red-500 text-xs">Gagal memuat laporan absensi.</div>`;
  }
};

// =========================================================================
// ====== FUNGSI EXPORT DATA KE CSV / EXCEL ================================
// =========================================================================
window.exportKeCSV = function() {
  if (!window.dataFilterRiwayatGlobal || window.dataFilterRiwayatGlobal.length === 0) {
    return alert("Tidak ada data untuk di-export. Silakan tampilkan laporan terlebih dahulu.");
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Nama Pegawai,Email,Waktu Presensi,Status Kehadiran,Gudang,Shift,Seragam,Status ACC\n";

  window.dataFilterRiwayatGlobal.forEach(row => {
    const nama = `"${(row.nama || '').replace(/"/g, '""')}"`;
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
  link.setAttribute("download", `Rekap_Absensi_Zevanic_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// =========================================================================
// ====== LOGIKA POPUP AJU BANDING =========================================
// =========================================================================
window.bukaModalAjuBanding = function(docId) {
  document.getElementById('banding-doc-id').value = docId;
  document.getElementById('banding-alasan').value = "";
  document.getElementById('modal-aju-banding').classList.remove('hidden');
};

window.tutupModalAjuBanding = function() {
  document.getElementById('modal-aju-banding').classList.add('hidden');
};

window.kirimAjuBanding = async function() {
  const docId = document.getElementById('banding-doc-id').value;
  const alasan = document.getElementById('banding-alasan').value;

  if (!alasan) return alert("Harap isi alasan sanggahan!");

  try {
    const docRef = doc(db, "absensi", docId);
    await updateDoc(docRef, {
      catatan_banding: alasan,
      tgl_banding: new Date().toISOString()
    });

    alert("Pengajuan sanggahan berhasil dikirimkan ke Admin / Owner.");
    window.tutupModalAjuBanding();
    window.muatDataRiwayat();
  } catch (e) {
    console.error("Gagal kirim banding:", e);
    alert("Gagal mengirimkan sanggahan.");
  }
};

// =========================================================================
// ====== LOGIKA RIWAYAT ACC & REKAP (UNTUK TAB ADMIN ACC) =================
// =========================================================================

window.muatDataRiwayatACC = async function() {
  const container = document.getElementById('container-acc-riwayat');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-8 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-xl mb-1"></i><p>Memuat riwayat persetujuan...</p></div>`;

  try {
    const querySnapshot = await getDocs(collection(db, "absensi"));
    let html = `
      <div class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[11px]">
            <tr>
              <th class="p-3">Karyawan</th>
              <th class="p-3">Waktu Presensi</th>
              <th class="p-3">Status ACC</th>
              <th class="p-3">Kesesuaian Seragam</th>
              <th class="p-3">Divalidasi Oleh</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    let countACC = 0;
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Tampilkan HANYA yang sudah di-ACC atau REJECT (Bukan Pending)
      if (data.status_acc && data.status_acc !== "PENDING") {
        countACC++;
        const tglPresensi = data.waktu ? new Date(data.waktu).toLocaleString('id-ID') : '-';
        
        const badgeStatus = data.status_acc === "ACC"
          ? `<span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] rounded-full"><i class="fas fa-check mr-1"></i>Disetujui (ACC)</span>`
          : `<span class="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[9px] rounded-full"><i class="fas fa-times mr-1"></i>Ditolak</span>`;

        html += `
          <tr class="hover:bg-gray-50 transition">
            <td class="p-3 font-semibold text-slate-800">${data.nama || 'Pegawai'}<br><span class="text-[10px] text-gray-400 font-normal">${data.email || ''}</span></td>
            <td class="p-3">${tglPresensi}</td>
            <td class="p-3">${badgeStatus}</td>
            <td class="p-3">${data.seragam || 'Sesuai'}</td>
            <td class="p-3 font-bold text-slate-700">${data.validated_by || 'Sistem / Admin'}</td>
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

window.siapkanFilterRekap = function() {
  const container = document.getElementById('container-acc-rekap');
  if (!container) return;
  
  // Ambil UI Filter & Tabel dari tab Profil > Riwayat agar tersinkronisasi 1 pintu
  if (window.muatDataRiwayat) {
    window.muatDataRiwayat(); // refresh datanya
    const kontenRiwayat = document.getElementById('profil-riwayat')?.innerHTML;
    if(kontenRiwayat) {
      container.innerHTML = kontenRiwayat;
    } else {
      container.innerHTML = '<p class="text-xs text-gray-400 text-center py-6">Fitur Rekapitulasi disinkronkan dengan menu Riwayat Profil.</p>';
    }
  }
};
