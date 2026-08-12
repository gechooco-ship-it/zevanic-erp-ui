// js/dashboard.js
import { collection, addDoc, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.muatDataProfil = function() {
  document.getElementById('profil-nama').innerText = window.currentUser.name;
  document.getElementById('profil-jabatan').innerText = window.currentUser.jabatan;
  document.getElementById('profil-id-kar').innerText = window.currentUser.id_karyawan;
  document.getElementById('profil-id-app').innerText = window.currentUser.id_app;
  document.getElementById('profil-email').innerText = window.currentUser.email;
  document.getElementById('profil-role').innerText = window.currentUser.role;
  document.getElementById('profil-status').innerText = window.currentUser.status_kerja;
  
  const qrData = "QR-" + window.currentUser.id_app;
  document.getElementById('profil-qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
};

window.simpanKeFirebase = async function(fotoBase64) {
  try {
    await addDoc(collection(db, "attendance"), {
      nama_pegawai: window.currentUser.name,
      email: window.currentUser.email,
      role: window.currentUser.role,
      status: window.statusPilihanGlobal,
      waktu: new Date().toLocaleString('id-ID'),
      foto_selfie: fotoBase64,
      persetujuan: "PENDING"
    });
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
  if(window.simpanKeFirebase) {
      await window.simpanKeFirebase(fotoWajah);
  }

  btnFinal.innerText = "Kirim Pengajuan";
  btnFinal.disabled = false;
  
  window.pindahLayar('screen-dashboard');
  window.pindahTab('tab-riwayat'); 
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
  tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Memuat data user...</td></tr>';
  
  const querySnapshot = await getDocs(collection(db, "users"));
  tbody.innerHTML = "";
  querySnapshot.forEach((document) => {
    const d = document.data();
    tbody.innerHTML += `
      <tr class="hover:bg-gray-50">
        <td class="p-4 font-bold text-xs">${d.nama}<br><span class="text-[10px] font-mono text-gray-500">${d.id_karyawan} (${d.id_app})</span></td>
        <td class="p-4 text-xs">${d.email}<br><span class="text-gray-500">${d.jabatan || '-'}</span></td>
        <td class="p-4 text-xs font-semibold text-blue-600 uppercase">${d.role}</td>
      </tr>`;
  });
};
