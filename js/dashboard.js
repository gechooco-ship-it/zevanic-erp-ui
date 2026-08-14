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
    // Poin 7 (Geofencing): sertakan gudang, koordinat, dan status radius untuk Clock In/Out
    if (window.statusPilihanGlobal === "HADIR (CLOCK IN)" || window.statusPilihanGlobal === "CLOCK OUT") {
      dataKirim.gudang = window.gudangDipilihGlobal || "";
      if (window.koordinatGlobal) {
        dataKirim.koordinat = { lat: window.koordinatGlobal.lat, lng: window.koordinatGlobal.lng };
      }
      if (window.statusRadiusGlobal) {
        dataKirim.jarak_meter = window.statusRadiusGlobal.jarak;
        dataKirim.radius_izin_meter = window.statusRadiusGlobal.radiusIzin;
        dataKirim.status_radius = window.statusRadiusGlobal.dalamRadius ? "DALAM RADIUS" : "DI LUAR RADIUS";
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
  // Poin 7: jaga-jaga (defense in depth) — tombol jepret sudah dikunci kalau di luar
  // radius, tapi cek ulang di sini juga sebelum benar-benar terkirim ke server.
  const perluLokasi = (window.statusPilihanGlobal === "HADIR (CLOCK IN)" || window.statusPilihanGlobal === "CLOCK OUT");
  if (perluLokasi) {
    if (!window.koordinatGlobal) {
      alert("Lokasi GPS belum berhasil diverifikasi. Silakan coba lagi.");
      return;
    }
    if (window.statusRadiusGlobal && window.statusRadiusGlobal.dalamRadius === false) {
      alert("Anda berada di luar radius gudang. Absensi tidak bisa dikirim.");
      return;
    }
  }

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
    let badgeApproval = "";
    if (d.status_approval === "PENDING") badgeApproval = '<span class="inline-block px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded ml-1">MENUNGGU</span>';
    else if (d.status_approval === "REJECTED") badgeApproval = '<span class="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded ml-1">DITOLAK</span>';
    tbody.innerHTML += `
      <tr class="hover:bg-gray-50">
        <td class="p-4 font-bold text-xs">${d.nama}<br><span class="text-[10px] font-mono text-gray-500">${d.id_karyawan} (${d.id_app})</span></td>
        <td class="p-4 text-xs">${d.email}<br><span class="text-gray-500">${d.jabatan || '-'}</span></td>
        <td class="p-4 text-xs font-semibold text-blue-600 uppercase">${d.role} <br> <span class="text-[10px] ${warnaStatus}">${d.status_kerja || 'Aktif'}</span>${badgeApproval}</td>
        <td class="p-4">
          <button onclick="bukaEditUser('${idDoc}')" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200 transition">
            <i class="fas fa-edit"></i> Edit
          </button>
        </td>
      </tr>`;
  });
};

// =========================================================================
// ====== ANTREAN KARYAWAN: approve pendaftar baru sebelum bisa login ======
// =========================================================================
window.muatDataAntreanKaryawan = async function() {
  const container = document.getElementById('container-antrean-karyawan');
  if (!container) return;
  container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Memuat antrean karyawan baru...</p></div>`;

  try {
    const qGudang = await getDocs(collection(db, "master_gudang"));
    const daftarGudang = [];
    qGudang.forEach(g => daftarGudang.push(g.data().nama_gudang));

    const querySnapshot = await getDocs(collection(db, "users"));
    let html = "";
    let countPending = 0;

    querySnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const emailId = docSnap.id;
      if (d.status_approval === "PENDING") {
        countPending++;
        const idAman = emailId.replace(/[@.]/g, '_');
        html += `
          <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div class="flex items-center space-x-3 border-b pb-3">
              ${d.foto_ktp ? `<img src="${d.foto_ktp}" class="w-16 h-12 rounded-lg object-cover border cursor-pointer hover:scale-105 transition" onclick="bukaPreviewFoto('${d.foto_ktp}')">` : `<div class="w-16 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300"><i class="fas fa-id-card"></i></div>`}
              <div>
                <h4 class="font-bold text-slate-800 text-sm">${d.nama || 'Tanpa Nama'}</h4>
                <p class="text-[10px] text-gray-400 font-mono">${d.email || emailId} &bull; ${d.hp || '-'}</p>
                <p class="text-[10px] text-gray-400 font-mono">NIK: ${d.nik || '-'}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status Kerja</label>
                <select id="antrean-statuskerja-${idAman}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
                  <option value="Aktif" selected>Aktif</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                  <option value="Resign">Resign</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Role Akses</label>
                <select id="antrean-role-${idAman}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
                  <option value="operator" selected>Operator</option>
                  <option value="admin">Admin</option>
                  <option value="pic">PIC</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Jabatan</label>
                <select id="antrean-jabatan-${idAman}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
                  <option value="Operator" selected>Operator</option>
                  <option value="Admin">Admin</option>
                  <option value="Warehouse">Warehouse</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status Karyawan</label>
                <select id="antrean-tipe-${idAman}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
                  <option value="Tetap" selected>Tetap</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Kontrak">Kontrak</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Gudang Penempatan (bisa lebih dari satu)</label>
              <div id="antrean-gudang-${idAman}" class="flex flex-wrap gap-2"></div>
            </div>
            <div class="flex space-x-2 pt-2 border-t">
              <button onclick="setujuiKaryawanBaru('${emailId}')" class="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition text-xs">
                <i class="fas fa-check-circle mr-1"></i> Setujui & Aktifkan
              </button>
              <button onclick="tolakKaryawanBaru('${emailId}')" class="bg-red-50 text-red-600 font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition text-xs">
                <i class="fas fa-times"></i> Tolak
              </button>
            </div>
          </div>
        `;
      }
    });

    if (countPending === 0) {
      container.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400 bg-white rounded-3xl border border-dashed"><i class="fas fa-user-check text-4xl text-green-300 mb-3"></i><h4 class="font-bold text-gray-700 text-sm">Tidak Ada Antrean</h4><p class="text-xs text-gray-400 mt-1">Semua pendaftar sudah diproses.</p></div>`;
    } else {
      container.innerHTML = html;
      // Render checkbox gudang untuk tiap kartu SETELAH innerHTML terpasang (butuh elemen sudah ada di DOM)
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.status_approval === "PENDING") {
          const idAman = docSnap.id.replace(/[@.]/g, '_');
          window.renderGudangCheckboxes(document.getElementById(`antrean-gudang-${idAman}`), daftarGudang, []);
        }
      });
    }
  } catch (e) {
    console.error("Gagal muat antrean karyawan:", e);
    container.innerHTML = `<div class="col-span-full text-center py-8 text-red-500 text-xs">Gagal memuat antrean karyawan.</div>`;
  }
};

window.setujuiKaryawanBaru = async function(emailId) {
  const idAman = emailId.replace(/[@.]/g, '_');
  const statusKerja = document.getElementById(`antrean-statuskerja-${idAman}`).value;
  const role = document.getElementById(`antrean-role-${idAman}`).value;
  const jabatan = document.getElementById(`antrean-jabatan-${idAman}`).value;
  const statusKaryawan = document.getElementById(`antrean-tipe-${idAman}`).value;
  const gudangTerpilih = window.bacaGudangCheckboxes(document.getElementById(`antrean-gudang-${idAman}`));

  if (gudangTerpilih.length === 0) {
    if (!confirm("Belum ada gudang dipilih. Karyawan ini TIDAK akan bisa login sampai gudang ditautkan (bisa diatur lagi lewat Data Karyawan > Edit). Lanjutkan?")) return;
  }

  try {
    await updateDoc(doc(db, "users", emailId), {
      status_kerja: statusKerja,
      role: role,
      jabatan: jabatan,
      status_karyawan: statusKaryawan,
      gudang_penempatan: gudangTerpilih,
      status_approval: "APPROVED"
    });

    // Notifikasi WA (Poin 3): akun sudah aktif
    try {
      const userSnap = await getDoc(doc(db, "users", emailId));
      if (userSnap.exists()) {
        const d = userSnap.data();
        if (d.hp && window.kirimPesanWhatsapp && window.ambilTemplateWA) {
          const templateAktif = await window.ambilTemplateWA('template_aktif');
          window.kirimPesanWhatsapp(
            d.hp,
            templateAktif.replace(/\{nama\}/g, d.nama || ''),
            "Akun Aktif"
          ).catch(e => console.error("Gagal kirim notifikasi WA aktivasi:", e));
        }
      }
    } catch (e) { console.error("Gagal ambil data untuk notifikasi WA:", e); }

    alert("Karyawan berhasil disetujui dan diaktifkan!");
    window.muatDataAntreanKaryawan();
  } catch (e) {
    console.error("Gagal menyetujui karyawan:", e);
    alert("Gagal menyimpan persetujuan.");
  }
};

window.tolakKaryawanBaru = async function(emailId) {
  if (!confirm("Tolak pendaftaran karyawan ini? Karyawan tidak akan bisa login. Bisa diaktifkan lagi nanti lewat Data Karyawan jika berubah pikiran.")) return;
  try {
    await updateDoc(doc(db, "users", emailId), { status_approval: "REJECTED" });
    alert("Pendaftaran ditolak.");
    window.muatDataAntreanKaryawan();
  } catch (e) {
    console.error("Gagal menolak:", e);
    alert("Gagal memproses penolakan.");
  }
};

// =========================================================================
// PENGATURAN WHATSAPP GATEWAY (Menu Karyawan > WhatsApp Gateway, khusus Owner)
// Menyimpan URL Web App Apps Script + kunci rahasia ke Firestore. Token
// Fonnte sendiri TIDAK disimpan di sini — itu ada di Apps Script.
// =========================================================================
window.muatKonfigWhatsapp = async function() {
  try {
    const configSnap = await getDoc(doc(db, "config", "whatsapp_gateway"));
    if (configSnap.exists()) {
      const cfg = configSnap.data();
      document.getElementById('wa-webapp-url').value = cfg.webapp_url || '';
      document.getElementById('wa-secret').value = cfg.shared_secret || '';
      document.getElementById('wa-otp-aktif').checked = !!cfg.otp_aktif;
    }
  } catch (e) {
    console.error("Gagal memuat konfigurasi WhatsApp:", e);
  }
};

window.simpanKonfigWhatsapp = async function() {
  const webappUrl = document.getElementById('wa-webapp-url').value.trim();
  const secret = document.getElementById('wa-secret').value.trim();
  const otpAktif = document.getElementById('wa-otp-aktif').checked;

  if (!webappUrl || !secret) {
    alert("URL Web App dan Kunci Rahasia wajib diisi!");
    return;
  }

  try {
    await setDoc(doc(db, "config", "whatsapp_gateway"), {
      webapp_url: webappUrl,
      shared_secret: secret,
      otp_aktif: otpAktif
    });
    alert("Pengaturan WhatsApp Gateway berhasil disimpan!");
  } catch (e) {
    console.error("Gagal menyimpan konfigurasi WhatsApp:", e);
    alert("Gagal menyimpan pengaturan.");
  }
};

window.tesKirimWhatsapp = async function() {
  const nomor = document.getElementById('wa-test-nomor').value.trim();
  if (!nomor) {
    alert("Masukkan nomor HP tujuan tes terlebih dahulu!");
    return;
  }
  const btn = event.currentTarget;
  const teksAsli = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  const berhasil = await window.kirimPesanWhatsapp(nomor, "Ini pesan tes dari Zevanic ERP. Jika Anda menerima ini, WhatsApp Gateway sudah tersambung dengan benar. \u2705", "Tes");

  btn.innerHTML = teksAsli;
  btn.disabled = false;
  alert(berhasil ? "Pesan tes berhasil dikirim! Cek WhatsApp di nomor tersebut." : "Gagal mengirim pesan tes. Cek kembali URL Web App & Kunci Rahasia, pastikan sudah disimpan, dan cek Script Properties di Apps Script.");
};

// =========================================================================
// TEMPLATE PESAN (greeting) — bisa diubah Owner tanpa perlu ubah kode.
// =========================================================================
const TEMPLATE_DEFAULT = {
  template_otp: "Kode OTP login Zevanic ERP Anda: *{kode}*. Jangan bagikan kode ini ke siapapun. Berlaku 5 menit.",
  template_aktif: "Halo {nama}, akun Zevanic ERP Anda sudah *AKTIF*. Anda sekarang bisa login dan melakukan absensi.",
  template_pending: "Halo {nama}, pendaftaran Anda di Zevanic ERP telah diterima dan sedang *menunggu persetujuan*. Silakan hubungi Koordinator/PIC untuk aktivasi akun Anda."
};

window.muatTemplateWA = async function() {
  try {
    const snap = await getDoc(doc(db, "config", "whatsapp_templates"));
    const tpl = snap.exists() ? snap.data() : {};
    document.getElementById('wa-tpl-otp').value = tpl.template_otp || TEMPLATE_DEFAULT.template_otp;
    document.getElementById('wa-tpl-aktif').value = tpl.template_aktif || TEMPLATE_DEFAULT.template_aktif;
    document.getElementById('wa-tpl-pending').value = tpl.template_pending || TEMPLATE_DEFAULT.template_pending;
  } catch (e) {
    console.error("Gagal memuat template WA:", e);
  }
};

window.simpanTemplateWA = async function() {
  try {
    await setDoc(doc(db, "config", "whatsapp_templates"), {
      template_otp: document.getElementById('wa-tpl-otp').value,
      template_aktif: document.getElementById('wa-tpl-aktif').value,
      template_pending: document.getElementById('wa-tpl-pending').value
    });
    alert("Template pesan berhasil disimpan!");
  } catch (e) {
    console.error("Gagal menyimpan template WA:", e);
    alert("Gagal menyimpan template.");
  }
};

// =========================================================================
// MONITORING RESPON — riwayat pengiriman WA (OTP, notifikasi, tes) & statusnya.
// =========================================================================
window.muatMonitoringWA = async function() {
  const tbody = document.getElementById('tabel-monitoring-wa');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Memuat riwayat...</td></tr>';

  try {
    const querySnapshot = await getDocs(collection(db, "wa_log"));
    let listLog = [];
    querySnapshot.forEach(docSnap => {
      const d = docSnap.data();
      d.id = docSnap.id;
      listLog.push(d);
    });

    listLog.sort((a, b) => new Date(b.waktu || 0) - new Date(a.waktu || 0));
    listLog = listLog.slice(0, 50);

    if (listLog.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Belum ada riwayat pengiriman.</td></tr>';
      return;
    }

    tbody.innerHTML = "";
    listLog.forEach(log => {
      const badgeStatus = log.sukses
        ? '<span class="px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[10px] rounded-full">Terkirim</span>'
        : '<span class="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[10px] rounded-full">Gagal</span>';
      tbody.innerHTML += `
        <tr class="hover:bg-gray-50">
          <td class="p-3">${log.waktu || '-'}</td>
          <td class="p-3 font-semibold">${log.jenis || '-'}</td>
          <td class="p-3 font-mono">${log.target || '-'}</td>
          <td class="p-3">${badgeStatus}</td>
          <td class="p-3 text-gray-500 max-w-[220px] truncate" title="${(log.keterangan || '').replace(/"/g, '&quot;')}">${log.keterangan || '-'}</td>
        </tr>`;
    });
  } catch (e) {
    console.error("Gagal memuat monitoring WA:", e);
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Gagal memuat riwayat.</td></tr>';
  }
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
    document.getElementById('edit-jabatan').value = d.jabatan || "";
    
    let statusSet = (d.status_kerja === "aktif") ? "Aktif" : (d.status_kerja || "Aktif");
    document.getElementById('edit-status').value = statusSet;
    document.getElementById('edit-tipe-karyawan').value = d.status_karyawan || "";
    document.getElementById('edit-status-approval').value = d.status_approval || "APPROVED";

    // Data Pribadi
    document.getElementById('edit-nik').value = d.nik || "";
    document.getElementById('edit-gender').value = d.gender || d.jk || "";
    document.getElementById('edit-tempatlahir').value = d.tempatLahir || "";
    document.getElementById('edit-tgllahir').value = d.tglLahir || d.tgl || "";
    document.getElementById('edit-hp').value = d.hp || "";

    // Alamat Domisili
    document.getElementById('edit-tinggal-kab').value = d.tinggalKab || d.domisiliKab || "";
    document.getElementById('edit-tinggal-kec').value = d.tinggalKec || d.domisiliKec || "";
    document.getElementById('edit-tinggal-detail').value = d.tinggalDetail || d.domisiliDetail || "";

    // Alamat KTP
    document.getElementById('edit-ktp-kab').value = d.ktpKab || "";
    document.getElementById('edit-ktp-kec').value = d.ktpKec || "";
    document.getElementById('edit-ktp-detail').value = d.ktpDetail || "";

    // Pendidikan & Keluarga
    document.getElementById('edit-nikah').value = d.statusNikah || d.nikah || "";
    document.getElementById('edit-tanggungan').value = d.tanggungan || "";
    document.getElementById('edit-pendidikan').value = d.pendidikan || "";
    document.getElementById('edit-sekolah').value = d.sekolah || "";
    document.getElementById('edit-jurusan').value = d.jurusan || "";

    // Rekening Bank
    document.getElementById('edit-bank').value = d.bank || "";
    document.getElementById('edit-norek').value = d.noRek || d.norek || "";
    document.getElementById('edit-namarek').value = d.atasNamaRek || d.namarek || "";

    // Kontak Darurat
    document.getElementById('edit-darurat-nama').value = d.daruratNama || "";
    document.getElementById('edit-darurat-hp').value = d.daruratHp || "";
    document.getElementById('edit-darurat-hub').value = d.daruratHub || "";

    const qGudang = await getDocs(collection(db, "master_gudang"));
    const daftarGudang = [];
    qGudang.forEach(g => daftarGudang.push(g.data().nama_gudang));
    window.renderGudangCheckboxes(document.getElementById('edit-gudang-checkboxes'), daftarGudang, d.gudang_penempatan);
    
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
  const tipeKaryawanBaru = document.getElementById('edit-tipe-karyawan').value;
  const statusApprovalBaru = document.getElementById('edit-status-approval').value;
  const gudangBaru = window.bacaGudangCheckboxes(document.getElementById('edit-gudang-checkboxes'));

  try {
    const userRef = doc(db, "users", emailId);
    await updateDoc(userRef, {
      role: roleBaru,
      jabatan: jabatanBaru,
      status_kerja: statusBaru,
      status_karyawan: tipeKaryawanBaru,
      status_approval: statusApprovalBaru,
      gudang_penempatan: gudangBaru,

      nik: document.getElementById('edit-nik').value,
      gender: document.getElementById('edit-gender').value,
      tempatLahir: document.getElementById('edit-tempatlahir').value,
      tglLahir: document.getElementById('edit-tgllahir').value,
      hp: document.getElementById('edit-hp').value,

      tinggalKab: document.getElementById('edit-tinggal-kab').value,
      tinggalKec: document.getElementById('edit-tinggal-kec').value,
      tinggalDetail: document.getElementById('edit-tinggal-detail').value,

      ktpKab: document.getElementById('edit-ktp-kab').value,
      ktpKec: document.getElementById('edit-ktp-kec').value,
      ktpDetail: document.getElementById('edit-ktp-detail').value,

      statusNikah: document.getElementById('edit-nikah').value,
      tanggungan: document.getElementById('edit-tanggungan').value,
      pendidikan: document.getElementById('edit-pendidikan').value,
      sekolah: document.getElementById('edit-sekolah').value,
      jurusan: document.getElementById('edit-jurusan').value,

      bank: document.getElementById('edit-bank').value,
      noRek: document.getElementById('edit-norek').value,
      atasNamaRek: document.getElementById('edit-namarek').value,

      daruratNama: document.getElementById('edit-darurat-nama').value,
      daruratHp: document.getElementById('edit-darurat-hp').value,
      daruratHub: document.getElementById('edit-darurat-hub').value
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
  const wadahGudang = document.getElementById('jadwal-gudang-checkboxes');
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

  // 2. Muat Opsi Gudang sebagai checkbox (satu karyawan bisa ditempatkan di lebih dari satu gudang)
  const qGudang = await getDocs(collection(db, "master_gudang"));
  const daftarGudang = [];
  qGudang.forEach(doc => daftarGudang.push(doc.data().nama_gudang));
  window.renderGudangCheckboxes(wadahGudang, daftarGudang, []);

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
  const gudangTerpilih = window.bacaGudangCheckboxes(document.getElementById('jadwal-gudang-checkboxes'));
  const shift = document.getElementById('jadwal-shift').value;
  const libur = document.getElementById('jadwal-libur').value;

  if(!email || gudangTerpilih.length === 0 || !shift) return alert("Harap pilih Karyawan, minimal 1 Gudang, dan Shift!");

  try {
      // Perbarui dokumen karyawan (mengawinkan data)
      await updateDoc(doc(db, "users", email), {
          gudang_penempatan: gudangTerpilih,
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
      const daftarGudangKaryawan = window.normalisasiGudang(d.gudang_penempatan);
      // Tampilkan hanya karyawan yang sudah disetting penjadwalannya
      if(daftarGudangKaryawan.length > 0 || d.nama_shift) {
          tbody.innerHTML += `
              <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <td class="p-3 font-bold text-xs">${d.nama} <br><span class="text-[10px] text-gray-400 font-normal">${d.email}</span></td>
                  <td class="p-3 text-xs text-blue-600 font-bold"><i class="fas fa-building mr-1"></i> ${daftarGudangKaryawan.length > 0 ? daftarGudangKaryawan.join(', ') : '-'}</td>
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
  
  if (tabId === 'tab-admin-acc' && window.muatDataAdminACC) {
      if (window.pindahSubTab) window.pindahSubTab('sub-absensi', 'sub-absensi-accept', document.querySelectorAll('.sub-absensi-btn')[2]);
      window.muatDataAdminACC();
  }
  
  if (tabId === 'tab-superuser' && window.muatDataAntreanKaryawan) window.muatDataAntreanKaryawan();

  if (tabId === 'tab-whatsapp' && window.muatKonfigWhatsapp) window.muatKonfigWhatsapp();
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

window.muatDataAdminACC = async function() {
  const container = document.getElementById('container-admin-acc');
  if (!container) return;
  
  container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p class="text-xs">Memuat antrean validasi absensi...</p></div>`;

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    const querySnapshot = await getDocs(collection(db, "absensi"));
    let html = "";
    let countPending = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      if (!data.status_acc || data.status_acc === "PENDING") {
        countPending++;
        const fotoUrl = data.foto_selfie || data.foto || "https://via.placeholder.com/150";
        const tanggalStr = data.waktu ? new Date(data.waktu).toLocaleString('id-ID') : "-";
        const koordinatHtml = data.koordinat
          ? `${data.koordinat.lat.toFixed(5)}, ${data.koordinat.lng.toFixed(5)}<br><a href="https://www.google.com/maps?q=${data.koordinat.lat},${data.koordinat.lng}" target="_blank" class="text-blue-500 text-[9px]"><i class="fas fa-map-marker-alt"></i> Lihat di Peta</a>`
          : '-';
        const statusRadiusHtml = data.status_radius === "DALAM RADIUS"
          ? `<span class="inline-block px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] rounded-full">Dalam Radius (${data.jarak_meter || 0}m)</span>`
          : data.status_radius === "DI LUAR RADIUS"
          ? `<span class="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[9px] rounded-full">Di Luar Radius (${data.jarak_meter || 0}m)</span>`
          : '<span class="text-gray-300">-</span>';

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
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Waktu</span> <b class="text-slate-800">${tanggalStr}</b></div>
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Gudang</span> <b class="text-slate-800">${data.gudang || "-"}</b></div>
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Shift</span> <b class="text-slate-800">${data.shift || "-"}</b></div>
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Koordinat</span> <b class="text-slate-800">${koordinatHtml}</b></div>
              <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Status Radius</span> ${statusRadiusHtml}</div>
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

    if (document.getElementById('stat-hadir')) document.getElementById('stat-hadir').innerText = countHadir;
    if (document.getElementById('stat-acc')) document.getElementById('stat-acc').innerText = countACC;
    if (document.getElementById('stat-seragam')) document.getElementById('stat-seragam').innerText = countSeragamBeda;
    if (document.getElementById('stat-izin')) document.getElementById('stat-izin').innerText = countIzin;

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
    
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        data.id = docSnap.id;
        listData.push(data);
    });

    listData.sort((a, b) => new Date(b.waktu || 0) - new Date(a.waktu || 0));
    window.dataRiwayatGlobal = listData; 

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
    
    if(window.muatDataRiwayatPersonal) window.muatDataRiwayatPersonal();
  } catch (e) {
    console.error("Gagal kirim banding:", e);
    alert("Gagal mengirimkan sanggahan ke server.");
  }
};
