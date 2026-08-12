// js/dashboard.js
import { collection, addDoc, getDocs, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.muatDataProfil = function() {
  document.getElementById('profil-nama').innerText = window.currentUser.name;
  document.getElementById('profil-jabatan').innerText = window.currentUser.jabatan;
  document.getElementById('profil-id-kar').innerText = window.currentUser.id_karyawan;
  document.getElementById('profil-id-app').innerText = window.currentUser.id_app;
  document.getElementById('profil-email').innerText = window.currentUser.email;
  document.getElementById('profil-role').innerText = window.currentUser.role;
  document.getElementById('profil-status').innerText = window.currentUser.status_kerja;
  
  document.getElementById('profil-input-nama').value = window.currentUser.name;
  document.getElementById('profil-input-email').value = window.currentUser.email;
  document.getElementById('profil-input-jabatan').value = window.currentUser.jabatan;

  const qrData = "QR-" + window.currentUser.id_app;
  document.getElementById('profil-qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

  window.mulaiHitungJamKerja();
};

// ====== JAM KERJA OTOMATIS & SHIFT ======
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

// ====== UPDATE PROFIL ======
window.simpanPerubahanProfil = async function() {
  const namaBaru = document.getElementById('profil-input-nama').value;
  const hpBaru = document.getElementById('profil-input-hp').value;

  if (!namaBaru) {
    alert("Nama tidak boleh kosong!");
    return;
  }

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

// ====== PANEL ACC PIC & VALIDASI SERAGAM ======
// ====== PANEL ACC PIC & VALIDASI SERAGAM ======
window.muatDataAdminACC = async function() {
  const tbody = document.getElementById('tabel-admin-body');
  tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Memuat data absensi...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "attendance"));
  tbody.innerHTML = "";
  
  querySnapshot.forEach((document) => {
    const d = document.data();
    let idDoc = document.id;

    // Ambil state saat ini dari database
    let statusSeragam = d.seragam || "Sesuai";
    let persetujuan = d.persetujuan || "PENDING";

    // Placeholder data (Nanti akan dinamis terhubung setelah Modul Config Absensi aktif)
    let jabatan = d.jabatan || "Operator";
    let penempatan = d.penempatan || "Gudang Utama";
    let radius = d.radius || "Dalam Radius (15m)";
    let statusKehadiran = d.status_kehadiran || "Tepat Waktu";
    if (d.status === "IZIN" || d.status === "CUTI") statusKehadiran = d.status;

    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 border-b border-gray-50 last:border-0">
        <td class="p-4">
          <img src="${d.foto_selfie}" class="w-14 h-14 rounded-xl object-cover border shadow-sm cursor-pointer hover:scale-105 transition" onclick="window.open('${d.foto_selfie}')" title="Klik untuk memperbesar">
        </td>
        <td class="p-4 font-bold text-xs">
          ${d.nama_pegawai}
          <br><span class="text-[10px] text-gray-500 font-normal">${jabatan}</span>
          <br><span class="text-[10px] text-blue-600 font-semibold mt-0.5 inline-block"><i class="fas fa-building mr-1"></i>${penempatan}</span>
        </td>
        <td class="p-4 text-xs">
          <span class="font-black uppercase text-slate-700">${d.status}</span>
          <br><span class="text-[10px] text-gray-500 font-medium">${d.waktu}</span>
        </td>
        <td class="p-4 text-xs">
          <span class="font-bold text-gray-800">${statusKehadiran}</span>
          <br><span class="text-[10px] text-gray-500 inline-block mt-0.5"><i class="fas fa-map-marker-alt mr-1 text-red-400"></i>${radius}</span>
          ${d.keterangan ? `<br><span class="text-gray-400 italic mt-1 block max-w-[150px] truncate" title="${d.keterangan}">Ket: "${d.keterangan}"</span>` : ''}
        </td>
        <td class="p-4 text-xs space-y-2">
          <div class="flex flex-col">
            <span class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Seragam:</span>
            <select id="seragam-${idDoc}" class="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none font-semibold focus:ring-1 focus:ring-blue-500 w-32">
              <option value="Sesuai" ${statusSeragam === 'Sesuai' ? 'selected' : ''}>🟢 Sesuai</option>
              <option value="Tidak Sesuai" ${statusSeragam === 'Tidak Sesuai' ? 'selected' : ''}>🔴 Tidak Sesuai</option>
            </select>
          </div>
          <div class="flex flex-col">
            <span class="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Keputusan:</span>
            <select id="persetujuan-${idDoc}" class="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none font-semibold focus:ring-1 focus:ring-blue-500 w-32">
              <option value="PENDING" ${persetujuan === 'PENDING' ? 'selected' : ''}>⏳ Pending</option>
              <option value="ACC" ${persetujuan === 'ACC' ? 'selected' : ''}>✅ ACC (Terima)</option>
              <option value="REJECTED" ${persetujuan === 'REJECTED' ? 'selected' : ''}>❌ Tolak</option>
            </select>
          </div>
        </td>
        <td class="p-4 text-center">
          <button onclick="submitUpdateACC('${idDoc}')" class="bg-blue-600 text-white px-4 py-3 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm shadow-blue-200 transition active:scale-95 flex items-center justify-center w-full">
            Update <i class="fas fa-save ml-1.5"></i>
          </button>
        </td>
      </tr>`;
  });

  if(tbody.innerHTML === "") {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Belum ada data pengajuan absensi.</td></tr>';
  }
};

window.submitUpdateACC = async function(idDoc) {
  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  // Ambil nilai dari kedua dropdown
  const seragamVal = document.getElementById(`seragam-${idDoc}`).value;
  const persetujuanVal = document.getElementById(`persetujuan-${idDoc}`).value;

  try {
    // Simpan ke database firebase
    await updateDoc(doc(db, "attendance", idDoc), {
      seragam: seragamVal,
      persetujuan: persetujuanVal
    });
    
    // Beri tahu sukses & muat ulang tabel
    alert("Validasi Absensi Berhasil Diupdate & Disimpan!");
    window.muatDataAdminACC(); 
  } catch (e) {
    console.error("Gagal update absensi:", e);
    alert("Gagal menyimpan data ke server.");
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

// ====== ZONA KONTROL OWNER ======
window.muatDataSuperUser = async function() {
  const tbody = document.getElementById('tabel-superuser-body');
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
    window.muatDataSuperUser();
    
  } catch (error) {
    console.error("Gagal update:", error);
    alert("Terjadi kesalahan saat mengupdate data.");
  } finally {
    btnSimpan.innerHTML = '<i class="fas fa-save mr-1"></i> Simpan Perubahan';
    btnSimpan.disabled = false;
  }
};

// ====== FUNGSI NAVIGASI SUB-MENU (TAB DI DALAM TAB) ======
window.pindahSubTab = function(grupKelas, tabIdTujuan, elemenTombol) {
  // 1. Sembunyikan semua isi konten dalam grup ini
  const semuaKonten = document.querySelectorAll('.' + grupKelas + '-content');
  semuaKonten.forEach(el => el.classList.add('hidden'));
  
  // 2. Tampilkan konten yang dipilih
  document.getElementById(tabIdTujuan).classList.remove('hidden');
  
  // 3. Reset warna semua tombol di grup ini jadi abu-abu/putih
  const semuaTombol = document.querySelectorAll('.' + grupKelas + '-btn');
  semuaTombol.forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
    btn.classList.add('bg-white', 'text-gray-600');
  });
  
  // 4. Warnai tombol yang baru saja diklik jadi biru (aktif)
  if(elemenTombol) {
    elemenTombol.classList.remove('bg-white', 'text-gray-600');
    elemenTombol.classList.add('bg-blue-600', 'text-white', 'shadow-md');
  }
};