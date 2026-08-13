// js/dashboard.js
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// =========================================================================
// ====== LOGIKA PERPINDAHAN TAB UTAMA (PERBAIKAN BUG BLANK) ===============
// =========================================================================
window.pindahTab = function(tabId) {
  const semuaTab = document.querySelectorAll('.tab-content');
  semuaTab.forEach(tab => tab.classList.add('hidden'));
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.remove('hidden');

  // Pemanggilan data otomatis sesuai tab yang diklik
  if (tabId === 'tab-profil') {
    window.pindahSubProfile('profil-qr', document.querySelector('.sub-profil-btn'));
    window.muatDataProfil(); 
  }
  if (tabId === 'tab-riwayat' && window.muatDataRiwayat) window.muatDataRiwayat();
  if (tabId === 'tab-admin-acc' && window.muatDataAdminACC) window.muatDataAdminACC();
  if (tabId === 'tab-superuser' && window.muatDataSuperUser) window.muatDataSuperUser();
};

// =========================================================================
// ====== LOGIKA HALAMAN PROFILE (SUB-MENU KONSISTEN & DATA LENGKAP) =======
// =========================================================================
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

  // Isi data lengkap pendaftaran ke form Data Diri
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
    console.error("Gagal simpan data diri:", e);
    alert("Gagal memperbarui data. Pastikan koneksi internet Anda stabil.");
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
};

// =========================================================================
// ====== LOGIKA PANEL VALIDASI / ACC (OTOMATIS HILANG SAAT DI-SUBMIT) =====
// =========================================================================
window.muatDataAdminACC = async function() {
  const container = document.getElementById('container-admin-acc');
  if (!container) return;
  
  container.innerHTML = `<div class="col-span-full text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p class="text-xs">Memuat data antrean absensi...</p></div>`;

  try {
    const querySnapshot = await getDocs(collection(db, "absensi"));
    let html = "";
    let countPending = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      // HANYA TAMPILKAN DATA PENDING. JIKA SUDAH ACC / REJECT -> HILANG DARI ANTREAN
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
                <span class="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded-full mt-1">Pending Validation</span>
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
    window.muatDataAdminACC(); // Refresh antrean ACC agar otomatis hilang
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

// =========================================================================
// ====== LOGIKA RIWAYAT & REKAP (OWNER/PIC DAPAT MELIHAT SEMUA KARYAWAN) ==
// =========================================================================
window.muatDataRiwayat = async function() {
  const container = document.getElementById('container-riwayat-absensi');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-8 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-xl mb-1"></i><p>Memuat riwayat & rekap...</p></div>`;

  try {
    const userRole = (window.currentUser.role || 'operator').toLowerCase();
    const isOwnerOrPic = (userRole === 'owner' || userRole === 'pic' || userRole === 'admin' || userRole === 'superuser');

    const querySnapshot = await getDocs(collection(db, "absensi"));
    let listData = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      data.id = docSnap.id;
      
      // HAK AKSES: Owner/PIC/Admin melihat SEMUA karyawan, Operator HANYA melihat miliknya
      if (isOwnerOrPic || data.email === window.currentUser.email) {
        listData.push(data);
      }
    });

    listData.sort((a, b) => new Date(b.waktu || 0) - new Date(a.waktu || 0));

    if (listData.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-gray-400 text-xs">Belum ada riwayat absensi tercatat.</div>`;
      return;
    }

    let html = `
      <div class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[11px]">
            <tr>
              <th class="p-3">Karyawan</th>
              <th class="p-3">Waktu</th>
              <th class="p-3">Status</th>
              <th class="p-3">Gudang & Shift</th>
              <th class="p-3">Seragam</th>
              <th class="p-3 text-center">Status ACC</th>
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
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

  } catch (e) {
    console.error("Error muat riwayat:", e);
    container.innerHTML = `<div class="text-center py-8 text-red-500 text-xs">Gagal memuat riwayat absensi.</div>`;
  }
};

// =========================================================================
// ====== LOGIKA DIREKTORI DATA KARYAWAN (SUPER USER) ======================
// =========================================================================
window.muatDataSuperUser = async function() {
  const container = document.getElementById('container-superuser-data');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-8 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-xl mb-1"></i><p>Memuat direktori karyawan...</p></div>`;

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    let html = `
      <div class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[11px]">
            <tr>
              <th class="p-3">ID Karyawan</th>
              <th class="p-3">Nama Lengkap</th>
              <th class="p-3">Email</th>
              <th class="p-3">Role Akses</th>
              <th class="p-3">Jabatan</th>
              <th class="p-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    querySnapshot.forEach((docSnap) => {
      const u = docSnap.data();
      html += `
        <tr class="hover:bg-gray-50 transition">
          <td class="p-3 font-mono font-bold text-blue-600">${u.id_karyawan || u.id_app || '-'}</td>
          <td class="p-3 font-semibold text-slate-800">${u.name || u.nama || 'Pegawai'}</td>
          <td class="p-3">${u.email || '-'}</td>
          <td class="p-3"><span class="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold text-[10px] rounded-full uppercase">${u.role || 'operator'}</span></td>
          <td class="p-3">${u.jabatan || 'Staff'}</td>
          <td class="p-3"><span class="px-2 py-0.5 ${u.status_kerja === 'nonaktif' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'} font-bold text-[10px] rounded-full">${u.status_kerja || 'aktif'}</span></td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

  } catch (e) {
    console.error("Error muat superuser:", e);
    container.innerHTML = `<div class="text-center py-8 text-red-500 text-xs">Gagal memuat direktori karyawan.</div>`;
  }
};