// =========================================================================
// ====== LOGIKA PERPINDAHAN HALAMAN UTAMA (ANTI KETUMPUK) =================
// =========================================================================

window.pindahTab = function(tabId) {
  // 1. Sembunyikan semua tab (menggunakan id spesifik agar pasti terhapus)
  const tabs = ['tab-home', 'tab-profil', 'tab-admin-acc', 'tab-superuser'];
  tabs.forEach(tab => {
    const elemenTab = document.getElementById(tab);
    if (elemenTab) elemenTab.classList.add('hidden');
  });
  
  // 2. Tampilkan hanya tab target
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.remove('hidden');

  // 3. Trigger pemanggilan data otomatis
  if (tabId === 'tab-profil') {
    if (window.pindahSubProfile) window.pindahSubProfile('profil-qr', document.querySelector('.sub-profil-btn'));
    if (window.muatDataProfil) window.muatDataProfil(); 
  }
  
  // Tab admin otomatis muat antrean pending saat dibuka
  if (tabId === 'tab-admin-acc' && window.muatDataAdminACC) {
      if (window.pindahSubTab) window.pindahSubTab('sub-absensi', 'sub-absensi-accept', document.querySelectorAll('.sub-absensi-btn')[2]);
      window.muatDataAdminACC();
  }
  
  if (tabId === 'tab-superuser' && window.muatDataSuperUser) window.muatDataSuperUser();
};

// =========================================================================
// ====== LOGIKA HALAMAN PROFILE KARYAWAN ==================================
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

  // Auto-fill data saat masuk ke form Data Diri
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

  // Jika klik Tab Riwayat Profil, muat khusus riwayat personal
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
  
  // Fallback elemen profil lama di dashboard utama
  if (document.getElementById('profil-nama')) document.getElementById('profil-nama').innerText = window.currentUser.name || window.currentUser.nama || "";
  if (document.getElementById('profil-jabatan')) document.getElementById('profil-jabatan').innerText = window.currentUser.jabatan || window.currentUser.role || "";
  
  // Jika ada fitur hitung jam kerja, jalankan
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
      name: document.getElementById('upd-nama').value, // Simpan di dua kolom agar aman
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

    // Impor fungsi ini perlu dipastikan ada dari file firebase-config.js di app.js, 
    // namun kita gunakan db dan metode modular yg ada.
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const userRef = doc(db, "users", window.currentUser.email);
    await updateDoc(userRef, dataUpdate);
    
    // Update local variable
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


// =========================================================================
// ====== LOGIKA NAVIGASI SUB-TAB ADMIN ACC (pindahSubTab) =================
// =========================================================================

window.pindahSubTab = function(prefixClass, targetId, elemenTombol) {
  // 1. Sembunyikan semua konten sub-tab 
  const semuaKonten = document.querySelectorAll(`.${prefixClass}-content`);
  semuaKonten.forEach(el => el.classList.add('hidden'));
  
  // 2. Tampilkan target konten
  const target = document.getElementById(targetId);
  if (target) target.classList.remove('hidden');
  
  // 3. Reset gaya semua tombol
  const semuaTombol = document.querySelectorAll(`.${prefixClass}-btn`);
  semuaTombol.forEach(btn => {
    btn.classList.remove('bg-slate-800', 'text-white', 'font-bold', 'shadow-md');
    btn.classList.add('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
  });
  
  // 4. Terapkan gaya aktif pada tombol yang diklik
  if (elemenTombol) {
    elemenTombol.classList.remove('bg-gray-100', 'text-gray-600', 'font-semibold', 'hover:bg-gray-200');
    elemenTombol.classList.add('bg-slate-800', 'text-white', 'font-bold', 'shadow-md');
  }
};


// =========================================================================
// ====== MODUL VALIDASI ABSENSI (ADMIN ACC) ===============================
// =========================================================================

window.muatDataAdminACC = async function() {
  const container = document.getElementById('container-admin-acc');
  if (!container) return;
  
  container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p class="text-xs">Memuat antrean validasi absensi...</p></div>`;

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const querySnapshot = await getDocs(collection(db, "absensi")); // pastikan collection "absensi" atau "attendance"
    let html = "";
    let countPending = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      // Hanya tampilkan yang PENDING
      if (!data.status_acc || data.status_acc === "PENDING") {
        countPending++;
        const fotoUrl = data.foto_selfie || data.foto || "https://via.placeholder.com/150";
        const tanggalStr = data.waktu ? new Date(data.waktu).toLocaleString('id-ID') : "-";

        html += `
          <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div class="flex items-center space-x-3 border-b pb-3">
              <img src="${fotoUrl}" class="w-16 h-16 rounded-xl object-cover border-2 border-gray-100 shadow-sm" onclick="window.bukaPreviewFoto('${fotoUrl}')">
              <div>
                <h4 class="font-bold text-slate-800 text-sm">${data.nama_pegawai || data.nama || "Karyawan"}</h4>
                <p class="text-[10px] text-gray-400 font-mono">${data.email || "-"}</p>
                <span class="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded-full mt-1"><i class="fas fa-clock mr-1"></i>Menunggu Validasi</span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-3 rounded-2xl text-gray-600">
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Status</span> <b class="text-slate-800">${data.status || "HADIR"}</b></div>
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Waktu Presensi</span> <b class="text-slate-800">${tanggalStr}</b></div>
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Lokasi Gudang</span> <b class="text-slate-800">${data.gudang || "-"}</b></div>
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Shift Kerja</span> <b class="text-slate-800">${data.shift || "-"}</b></div>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label class="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Persetujuan</label>
                <select id="acc-status-${docId}" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none font-bold text-slate-700 text-xs">
                  <option value="ACC" selected>ACC (Valid)</option>
                  <option value="REJECT">Tolak (Reject)</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Seragam</label>
                <select id="acc-seragam-${docId}" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none font-bold text-slate-700 text-xs">
                  <option value="Sesuai" ${data.seragam === "Sesuai" ? "selected" : ""}>Sesuai</option>
                  <option value="Tidak Sesuai" ${data.seragam === "Tidak Sesuai" ? "selected" : ""}>Tidak Sesuai</option>
                </select>
              </div>
            </div>

            <div class="flex space-x-2 pt-2 border-t">
              <button onclick="prosesAcceptAbsensi('${docId}')" class="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition shadow-sm text-xs flex items-center justify-center">
                <i class="fas fa-check-circle mr-1.5"></i> Proses Validasi
              </button>
              <button onclick="hapusAbsensi('${docId}')" class="bg-red-50 text-red-600 font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition text-xs" title="Hapus Permanen">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        `;
      }
    });

    if (countPending === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 text-gray-400 bg-white rounded-3xl border border-dashed">
          <i class="fas fa-glass-cheers text-5xl text-blue-300 mb-4"></i>
          <h4 class="font-bold text-gray-700 text-sm">Semua Absensi Telah Tervalidasi</h4>
          <p class="text-xs text-gray-400 mt-1">Tidak ada antrean absensi baru yang perlu diperiksa.</p>
        </div>`;
    } else {
      container.innerHTML = html;
    }

  } catch (e) {
    console.error("Error muat admin ACC:", e);
    container.innerHTML = `<div class="col-span-full text-center py-8 text-red-500 text-xs">Gagal memuat antrean jaringan.</div>`;
  }
};

window.prosesAcceptAbsensi = async function(docId) {
  const statusAcc = document.getElementById(`acc-status-${docId}`).value;
  const seragam = document.getElementById(`acc-seragam-${docId}`).value;

  try {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const docRef = doc(db, "absensi", docId);
    await updateDoc(docRef, {
      status_acc: statusAcc,
      seragam: seragam,
      validated_at: new Date().toISOString(),
      validated_by: window.currentUser.name || window.currentUser.nama || window.currentUser.email
    });

    alert(`Absensi berhasil di-${statusAcc}! Data telah berpindah ke Riwayat & Rekapitulasi.`);
    window.muatDataAdminACC(); 
  } catch (e) {
    console.error("Gagal update ACC:", e);
    alert("Terjadi kesalahan sistem saat memproses validasi.");
  }
};

window.hapusAbsensi = async function(docId) {
  if (!confirm("Peringatan: Anda yakin ingin menghapus data absensi ini secara permanen? Data tidak dapat dikembalikan.")) return;
  try {
    const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    await deleteDoc(doc(db, "absensi", docId));
    window.muatDataAdminACC();
  } catch (e) {
    console.error("Gagal hapus:", e);
    alert("Gagal menghapus data.");
  }
};


// =========================================================================
// ====== MODUL RIWAYAT PERSONAL (KHUSUS TAMPILAN PROFIL) ==================
// =========================================================================

// Variabel penampung data filter global agar bisa di-export CSV
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

    // Reset Statistik Personal
    let countHadir = 0; let countACC = 0; let countSeragamBeda = 0; let countIzin = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      data.id = docSnap.id;
      
      // HANYA AMBIL DATA MILIK USER INI SAJA! (Personal Profile)
      if (data.email === window.currentUser.email) {
        
        // Filter Logic
        let lolosTgl = true;
        if (data.waktu) {
          const tglData = new Date(data.waktu).toISOString().split('T')[0];
          if (tglMulai && tglData < tglMulai) lolosTgl = false;
          if (tglSelesai && tglData > tglSelesai) lolosTgl = false;
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

    // Update UI Statistik
    if (document.getElementById('stat-hadir')) document.getElementById('stat-hadir').innerText = countHadir;
    if (document.getElementById('stat-acc')) document.getElementById('stat-acc').innerText = countACC;
    if (document.getElementById('stat-seragam')) document.getElementById('stat-seragam').innerText = countSeragamBeda;
    if (document.getElementById('stat-izin')) document.getElementById('stat-izin').innerText = countIzin;

    // Urutkan Tanggal Terbaru
    listData.sort((a, b) => new Date(b.waktu || 0) - new Date(a.waktu || 0));
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
              <th class="p-3">Waktu Presensi</th>
              <th class="p-3">Status</th>
              <th class="p-3">Lokasi & Shift</th>
              <th class="p-3">Seragam</th>
              <th class="p-3 text-center">Status Validasi</th>
              <th class="p-3 text-center">Aksi / Sanggahan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    listData.forEach(item => {
      const tgl = item.waktu ? new Date(item.waktu).toLocaleString('id-ID') : '-';
      const statusAccBadge = item.status_acc === "ACC" 
        ? `<span class="px-2 py-1 bg-green-50 text-green-700 font-bold text-[9px] rounded-lg"><i class="fas fa-check-circle mr-1"></i>ACC Valid</span>`
        : item.status_acc === "REJECT"
        ? `<span class="px-2 py-1 bg-red-50 text-red-600 font-bold text-[9px] rounded-lg"><i class="fas fa-times-circle mr-1"></i>Ditolak</span>`
        : `<span class="px-2 py-1 bg-yellow-50 text-yellow-700 font-bold text-[9px] rounded-lg"><i class="fas fa-clock mr-1"></i>Pending</span>`;

      // Logika Tombol Aju Banding
      let tombolBanding = `<span class="text-gray-300 text-[10px]">-</span>`;
      if (item.status_acc === "REJECT" || item.seragam === "Tidak Sesuai") {
        if (item.catatan_banding) {
          tombolBanding = `<span class="text-amber-600 font-bold text-[10px] bg-amber-50 px-2 py-1 rounded-lg" title="${item.catatan_banding}"><i class="fas fa-info-circle mr-1"></i>Telah Diajukan</span>`;
        } else {
          tombolBanding = `<button onclick="bukaModalAjuBanding('${item.id}')" class="px-3 py-1.5 bg-white border border-amber-300 text-amber-600 font-bold text-[10px] rounded-lg hover:bg-amber-50 transition shadow-sm"><i class="fas fa-gavel mr-1"></i>Aju Sanggahan</button>`;
        }
      }

      html += `
        <tr class="hover:bg-gray-50 transition">
          <td class="p-3 font-semibold text-slate-800">${tgl}</td>
          <td class="p-3"><span class="font-bold text-slate-700">${item.status || 'HADIR'}</span></td>
          <td class="p-3">${item.gudang || '-'} (${item.shift || '-'})</td>
          <td class="p-3 font-semibold ${item.seragam === 'Tidak Sesuai' ? 'text-amber-600' : 'text-gray-600'}">${item.seragam || 'Sesuai'}</td>
          <td class="p-3 text-center">${statusAccBadge}</td>
          <td class="p-3 text-center">${tombolBanding}</td>
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


// =========================================================================
// ====== MODUL RIWAYAT ACC & REKAP (KHUSUS OWNER/ADMIN) ===================
// =========================================================================

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
      // Tampilkan SEMUA karyawan yang statusnya BUKAN PENDING (Hanya yang sudah diproses Owner/PIC)
      if (data.status_acc && data.status_acc !== "PENDING") {
        countACC++;
        const tglPresensi = data.waktu ? new Date(data.waktu).toLocaleString('id-ID') : '-';
        
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

window.siapkanFilterRekap = async function() {
  const container = document.getElementById('container-acc-rekap');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p>Menyiapkan Rekapitulasi Data Komplit...</p></div>`;

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const querySnapshot = await getDocs(collection(db, "absensi"));
    let listData = [];
    
    // Tarik SEMUA Data Karyawan Tanpa Filter Email (Karena ini akses Owner/PIC)
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        data.id = docSnap.id;
        listData.push(data);
    });

    listData.sort((a, b) => new Date(b.waktu || 0) - new Date(a.waktu || 0));
    window.dataRiwayatGlobal = listData; // Simpan untuk Export CSV Global

    let html = `
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center mb-4">
        <div>
           <h3 class="font-black text-slate-800 text-sm"><i class="fas fa-database text-purple-600 mr-2"></i> Rekapitulasi Absensi Global</h3>
           <p class="text-[10px] text-gray-500 mt-1">Laporan lengkap seluruh karyawan. Anda bisa mengunduhnya untuk keperluan Payroll.</p>
        </div>
        <button onclick="exportKeCSV()" class="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md flex items-center space-x-2">
            <i class="fas fa-file-excel text-sm"></i><span>Unduh Excel (CSV)</span>
        </button>
      </div>

      <div class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-slate-800 text-white font-bold border-b text-[10px] uppercase">
            <tr>
              <th class="p-3">Nama Pegawai</th>
              <th class="p-3">Waktu Presensi</th>
              <th class="p-3">Gudang & Shift</th>
              <th class="p-3">Tipe Absen</th>
              <th class="p-3">Status ACC</th>
              <th class="p-3">Seragam</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    listData.forEach(item => {
      const tgl = item.waktu ? new Date(item.waktu).toLocaleString('id-ID') : '-';
      html += `
        <tr class="hover:bg-blue-50 transition cursor-pointer">
          <td class="p-3 font-bold text-slate-800">${item.nama_pegawai || item.nama || 'Anonim'}</td>
          <td class="p-3">${tgl}</td>
          <td class="p-3">${item.gudang || '-'} (${item.shift || '-'})</td>
          <td class="p-3 font-semibold text-blue-600">${item.status || 'HADIR'}</td>
          <td class="p-3 font-bold ${item.status_acc === 'ACC' ? 'text-green-600' : 'text-amber-500'}">${item.status_acc || 'PENDING'}</td>
          <td class="p-3">${item.seragam || 'Sesuai'}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;

  } catch(e) {
     console.error("Gagal muat rekap global:", e);
     container.innerHTML = `<div class="text-center py-8 text-red-500 text-xs">Gagal menarik data rekapitulasi server.</div>`;
  }
};

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


// =========================================================================
// ====== LOGIKA POPUP AJU BANDING (SANGGAHAN OPERATOR) ====================
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

  if (!alasan) return alert("Harap isi alasan sanggahan Anda!");

  try {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const docRef = doc(db, "absensi", docId);
    await updateDoc(docRef, {
      catatan_banding: alasan,
      tgl_banding: new Date().toISOString()
    });

    alert("Sanggahan berhasil dikirimkan ke Admin / Owner untuk ditinjau ulang.");
    window.tutupModalAjuBanding();
    
    // Refresh tabel profil pribadi
    if(window.muatDataRiwayatPersonal) window.muatDataRiwayatPersonal();
  } catch (e) {
    console.error("Gagal kirim banding:", e);
    alert("Gagal mengirimkan sanggahan ke server.");
  }
};


// =========================================================================
// ====== MODUL CONFIG ABSENSI (MASTER GUDANG & SHIFT) =====================
// =========================================================================

window.muatConfigAbsensi = function() {
  if(window.muatMasterGudang) window.muatMasterGudang();
  if(window.muatMasterShift) window.muatMasterShift();
};

window.simpanMasterGudang = async function() {
  const nama = document.getElementById('conf-gudang-nama').value;
  const lat = document.getElementById('conf-gudang-lat').value;
  const lng = document.getElementById('conf-gudang-lng').value;
  const radius = document.getElementById('conf-gudang-radius').value;

  if(!nama || !lat || !lng || !radius) return alert("Semua kolom Master Gudang harus diisi lengkap!");

  try {
    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    await addDoc(collection(db, "master_gudang"), {
      nama_gudang: nama,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
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
  tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-gray-400">Memuat data...</td></tr>';
  
  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    const querySnapshot = await getDocs(collection(db, "master_gudang"));
    
    tbody.innerHTML = "";
    querySnapshot.forEach((document) => {
      const d = document.data();
      tbody.innerHTML += `
        <tr class="hover:bg-blue-50 transition border-b border-gray-100 last:border-0">
          <td class="p-3 font-bold text-blue-800">${d.nama_gudang}</td>
          <td class="p-3 text-[10px] text-gray-500 font-mono leading-tight">Lat: ${d.latitude}<br>Lng: ${d.longitude}<br><span class="font-bold text-red-500">Radius: ${d.radius} m</span></td>
          <td class="p-3 text-center">
            <button onclick="hapusMasterGudang('${document.id}')" class="text-red-500 hover:text-white hover:bg-red-500 font-bold px-3 py-2 bg-red-50 rounded-lg transition shadow-sm"><i class="fas fa-trash-alt"></i></button>
          </td>
        </tr>
      `;
    });
    if(tbody.innerHTML === "") tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-gray-400">Belum ada data gudang terdaftar.</td></tr>';
  } catch(e) {
    console.error(e);
  }
};

window.hapusMasterGudang = async function(idDoc) {
  if(confirm("Yakin ingin menghapus Gudang ini dari Master Data?")) {
    try {
      const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const { db } = await import("./firebase-config.js");
      await deleteDoc(doc(db, "master_gudang", idDoc));
      window.muatMasterGudang();
    } catch(e) {
      console.error(e);
    }
  }
};

window.simpanMasterShift = async function() {
  const nama = document.getElementById('conf-shift-nama').value;
  const inTime = document.getElementById('conf-shift-in').value;
  const outTime = document.getElementById('conf-shift-out').value;

  if(!nama || !inTime || !outTime) return alert("Semua kolom Master Shift harus diisi lengkap!");

  try {
    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
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
  tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-gray-400">Memuat data...</td></tr>';
  
  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    const querySnapshot = await getDocs(collection(db, "master_shift"));
    
    tbody.innerHTML = "";
    querySnapshot.forEach((document) => {
      const d = document.data();
      tbody.innerHTML += `
        <tr class="hover:bg-amber-50 transition border-b border-gray-100 last:border-0">
          <td class="p-3 font-bold text-amber-700">${d.nama_shift}</td>
          <td class="p-3 text-[10px] text-gray-500 font-bold">In: <span class="text-green-600">${d.jam_masuk}</span><br>Out: <span class="text-red-500">${d.jam_keluar}</span></td>
          <td class="p-3 text-center">
            <button onclick="hapusMasterShift('${document.id}')" class="text-red-500 hover:text-white hover:bg-red-500 font-bold px-3 py-2 bg-red-50 rounded-lg transition shadow-sm"><i class="fas fa-trash-alt"></i></button>
          </td>
        </tr>
      `;
    });
    if(tbody.innerHTML === "") tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-gray-400">Belum ada data shift terdaftar.</td></tr>';
  } catch(e) {
    console.error(e);
  }
};

window.hapusMasterShift = async function(idDoc) {
  if(confirm("Yakin ingin menghapus Shift ini dari Master Data?")) {
    try {
       const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
       const { db } = await import("./firebase-config.js");
       await deleteDoc(doc(db, "master_shift", idDoc));
       window.muatMasterShift();
    } catch(e) { console.error(e); }
  }
};

// =========================================================================
// ====== MODUL PENJADWALAN KARYAWAN =======================================
// =========================================================================

window.muatDataPenjadwalan = async function() {
  const selectKaryawan = document.getElementById('jadwal-karyawan');
  const selectGudang = document.getElementById('jadwal-gudang');
  const selectShift = document.getElementById('jadwal-shift');
  const tbody = document.getElementById('tabel-jadwal-body');
  
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>Memuat jadwal...</td></tr>';

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const snapKaryawan = await getDocs(collection(db, "users"));
    let optKaryawan = '<option value="">-- Pilih Karyawan --</option>';
    snapKaryawan.forEach(docSnap => {
      const k = docSnap.data();
      optKaryawan += `<option value="${docSnap.id}|${k.nama || k.name || 'User'}">${k.nama || k.name || 'User'} (${docSnap.id})</option>`;
    });
    if(selectKaryawan) selectKaryawan.innerHTML = optKaryawan;

    const snapGudang = await getDocs(collection(db, "master_gudang"));
    let optGudang = '<option value="">-- Pilih Gudang --</option>';
    snapGudang.forEach(docSnap => {
      optGudang += `<option value="${docSnap.data().nama_gudang}">${docSnap.data().nama_gudang}</option>`;
    });
    if(selectGudang) selectGudang.innerHTML = optGudang;

    const snapShift = await getDocs(collection(db, "master_shift"));
    let optShift = '<option value="">-- Pilih Shift --</option>';
    snapShift.forEach(docSnap => {
      optShift += `<option value="${docSnap.data().nama_shift}">${docSnap.data().nama_shift} (${docSnap.data().jam_masuk} - ${docSnap.data().jam_keluar})</option>`;
    });
    if(selectShift) selectShift.innerHTML = optShift;

    const snapJadwal = await getDocs(collection(db, "penjadwalan"));
    tbody.innerHTML = "";
    
    snapJadwal.forEach((docSnap) => {
      const d = docSnap.data();
      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
          <td class="p-3 font-bold text-slate-800">${d.nama_karyawan}<br><span class="text-[9px] text-gray-400 font-normal">${d.email_karyawan}</span></td>
          <td class="p-3"><span class="px-2 py-1 bg-blue-50 text-blue-600 font-bold rounded-lg text-[10px]">${d.gudang}</span></td>
          <td class="p-3"><span class="px-2 py-1 bg-amber-50 text-amber-600 font-bold rounded-lg text-[10px]">${d.shift}</span></td>
          <td class="p-3 text-center font-black text-red-500">${d.hari_libur}</td>
          <td class="p-3 text-center">
            <button onclick="hapusPenjadwalan('${docSnap.id}')" class="text-red-500 hover:text-white hover:bg-red-500 font-bold px-3 py-2 bg-red-50 rounded-lg transition shadow-sm"><i class="fas fa-trash-alt"></i></button>
          </td>
        </tr>
      `;
    });

    if(tbody.innerHTML === "") tbody.innerHTML = '<tr><td colspan="5" class="p-5 text-center text-gray-400">Belum ada penjadwalan aktif.</td></tr>';

  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5" class="p-5 text-center text-red-500">Gagal memuat data penjadwalan.</td></tr>';
  }
};

window.simpanPenjadwalan = async function() {
  const valKaryawan = document.getElementById('jadwal-karyawan').value;
  const gudang = document.getElementById('jadwal-gudang').value;
  const shift = document.getElementById('jadwal-shift').value;
  const libur = document.getElementById('jadwal-libur').value;

  if(!valKaryawan || !gudang || !shift || !libur) {
    return alert("Semua kolom plotting jadwal harus diisi lengkap!");
  }

  const [emailKaryawan, namaKaryawan] = valKaryawan.split('|');

  try {
    const { collection, addDoc, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    await addDoc(collection(db, "penjadwalan"), {
      email_karyawan: emailKaryawan,
      nama_karyawan: namaKaryawan,
      gudang: gudang,
      shift: shift,
      hari_libur: libur,
      dibuat_pada: new Date().toISOString()
    });

    const userRef = doc(db, "users", emailKaryawan);
    await updateDoc(userRef, {
      gudang_aktif: gudang,
      shift_aktif: shift,
      hari_libur: libur
    });

    alert("Jadwal Karyawan Berhasil Diterapkan!");
    window.muatDataPenjadwalan(); 

  } catch (e) {
    console.error(e);
    alert("Gagal menyimpan penjadwalan.");
  }
};

window.hapusPenjadwalan = async function(idDoc) {
  if(confirm("Yakin ingin mencabut jadwal karyawan ini?")) {
    try {
      const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const { db } = await import("./firebase-config.js");
      await deleteDoc(doc(db, "penjadwalan", idDoc));
      window.muatDataPenjadwalan();
    } catch (e) {
      console.error(e);
    }
  }
};