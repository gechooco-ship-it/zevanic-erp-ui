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
window.muatDataSuperUser = async function() {
  const tbody = document.getElementById('tabel-superuser-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-gray-400">Memuat data user...</td></tr>';

  // Ambil peta nama gudang -> jenis lokasi (Tetap/Dinamis), dipakai buat kolom 7
  const qGudang = await getDocs(collection(db, "master_gudang"));
  const petaJenisLokasi = {};
  qGudang.forEach(g => { petaJenisLokasi[g.data().nama_gudang] = g.data().tipe_lokasi || 'Tetap'; });

  const dua = (a, b) => `<b class="text-slate-800">${a || '-'}</b><br><span class="text-[10px] text-gray-400 font-normal">${b || '-'}</span>`;

  const querySnapshot = await getDocs(collection(db, "users"));
  tbody.innerHTML = "";
  querySnapshot.forEach((document) => {
    const d = document.data();
    let idDoc = document.id;
    let badgeApproval = "";
    if (d.status_approval === "PENDING") badgeApproval = '<span class="inline-block px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded ml-1">MENUNGGU</span>';
    else if (d.status_approval === "REJECTED") badgeApproval = '<span class="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded ml-1">DITOLAK</span>';

    const daftarGudangUser = window.normalisasiGudang(d.gudang_penempatan);
    const daftarJenisLokasi = [...new Set(daftarGudangUser.map(g => petaJenisLokasi[g] || '-'))];

    tbody.innerHTML += `
      <tr class="hover:bg-gray-50">
        <td class="p-3 text-xs">${dua(d.jenis_pekerjaan, d.status_kerja)}${badgeApproval}</td>
        <td class="p-3">
          ${d.foto_ktp ? `<img src="${d.foto_ktp}" class="w-12 h-9 rounded object-cover border cursor-pointer hover:scale-105 transition" onclick="bukaPreviewFoto('${d.foto_ktp}')">` : '<div class="w-12 h-9 bg-gray-100 rounded flex items-center justify-center text-gray-300"><i class="fas fa-id-card text-xs"></i></div>'}
        </td>
        <td class="p-3 text-xs">${dua(d.nama, d.id_karyawan + ' / ' + (d.id_app || '-'))}</td>
        <td class="p-3 text-xs">${dua(d.hp, d.email)}</td>
        <td class="p-3 text-xs">${dua(d.jabatan, d.status_karyawan)}</td>
        <td class="p-3 text-xs">${dua(daftarGudangUser.join(', ') || '-', d.nama_shift)}</td>
        <td class="p-3 text-xs uppercase">${dua(d.role, daftarJenisLokasi.join(', ') || '-')}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="bukaEditUser('${idDoc}')" class="bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200 transition">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="hapusKaryawan('${idDoc}')" class="bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 border border-red-200 transition">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>
      </tr>`;
  });
};

window.hapusKaryawan = async function(emailId) {
  if (!confirm(`Yakin ingin menghapus data karyawan "${emailId}" secara permanen? Data profil akan hilang dan tidak bisa dikembalikan.`)) return;
  try {
    await deleteDoc(doc(db, "users", emailId));
    alert("Data karyawan berhasil dihapus dari Daftar Karyawan.\n\nCatatan: akun login (Firebase Auth) orang ini masih ada di sistem terpisah. Kalau mau benar-benar diblokir dari login, hapus juga manual lewat Firebase Console > Authentication.");
    window.muatDataSuperUser();
  } catch (e) {
    console.error("Gagal menghapus karyawan:", e);
    alert("Gagal menghapus data karyawan.");
  }
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

    const [daftarStatusKerja, daftarJenisPekerjaan, daftarJabatan, daftarStatusKaryawan] = await Promise.all([
      window.ambilMasterList('status_kerja'),
      window.ambilMasterList('jenis_pekerjaan'),
      window.ambilMasterList('jabatan'),
      window.ambilMasterList('status_karyawan')
    ]);
    const opsiSelect = (list, nilaiDefault) => list.map(item =>
      `<option value="${item}" ${item === nilaiDefault ? 'selected' : ''}>${item}</option>`
    ).join('');

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
                  ${opsiSelect(daftarStatusKerja, 'Aktif')}
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Jenis Pekerjaan</label>
                <select id="antrean-jenispekerjaan-${idAman}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
                  ${opsiSelect(daftarJenisPekerjaan, daftarJenisPekerjaan[0] || '')}
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Jabatan</label>
                <select id="antrean-jabatan-${idAman}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
                  ${opsiSelect(daftarJabatan, daftarJabatan[0] || '')}
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status Karyawan</label>
                <select id="antrean-tipe-${idAman}" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
                  ${opsiSelect(daftarStatusKaryawan, daftarStatusKaryawan[0] || '')}
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
  const jenisPekerjaan = document.getElementById(`antrean-jenispekerjaan-${idAman}`).value;
  const jabatan = document.getElementById(`antrean-jabatan-${idAman}`).value;
  const statusKaryawan = document.getElementById(`antrean-tipe-${idAman}`).value;
  const gudangTerpilih = window.bacaGudangCheckboxes(document.getElementById(`antrean-gudang-${idAman}`));

  if (gudangTerpilih.length === 0) {
    if (!confirm("Belum ada gudang dipilih. Karyawan ini TIDAK akan bisa login sampai gudang ditautkan (bisa diatur lagi lewat Daftar Karyawan > Edit). Lanjutkan?")) return;
  }

  try {
    await updateDoc(doc(db, "users", emailId), {
      status_kerja: statusKerja,
      jenis_pekerjaan: jenisPekerjaan,
      // Role/Status Pengguna SENGAJA tidak diset di sini — supaya siapapun yang
      // approve di Antrean Dakar tidak bisa memberi akses Owner ke akun baru.
      // Role hanya bisa diubah Owner lewat Master Karyawan > Daftar Karyawan > Edit.
      role: "operator",
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

    listLog.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
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

window.isiSelectDariMaster = async function(selectId, kategori, nilaiTerpilih) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const items = await window.ambilMasterList(kategori);
  select.innerHTML = items.map(item =>
    `<option value="${item}" ${item === nilaiTerpilih ? 'selected' : ''}>${item}</option>`
  ).join('');
  // Kalau nilai tersimpan tidak ada di Master Data (data lama/dihapus dari master),
  // tetap tampilkan supaya data tidak hilang dari layar.
  if (nilaiTerpilih && !items.includes(nilaiTerpilih)) {
    select.innerHTML += `<option value="${nilaiTerpilih}" selected>${nilaiTerpilih} (tidak ada di Master Data)</option>`;
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

    await window.isiSelectDariMaster('edit-role', 'status_pengguna', d.role || 'operator');
    await window.isiSelectDariMaster('edit-jenis-pekerjaan', 'jenis_pekerjaan', d.jenis_pekerjaan || '');
    await window.isiSelectDariMaster('edit-jabatan', 'jabatan', d.jabatan || '');
    
    let statusSet = (d.status_kerja === "aktif") ? "Aktif" : (d.status_kerja || "Aktif");
    await window.isiSelectDariMaster('edit-status', 'status_kerja', statusSet);
    await window.isiSelectDariMaster('edit-tipe-karyawan', 'status_karyawan', d.status_karyawan || '');
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
  const jenisPekerjaanBaru = document.getElementById('edit-jenis-pekerjaan').value;
  const jabatanBaru = document.getElementById('edit-jabatan').value;
  const statusBaru = document.getElementById('edit-status').value;
  const tipeKaryawanBaru = document.getElementById('edit-tipe-karyawan').value;
  const statusApprovalBaru = document.getElementById('edit-status-approval').value;
  const gudangBaru = window.bacaGudangCheckboxes(document.getElementById('edit-gudang-checkboxes'));

  try {
    const userRef = doc(db, "users", emailId);
    await updateDoc(userRef, {
      role: roleBaru,
      jenis_pekerjaan: jenisPekerjaanBaru,
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
  const tipeLokasi = document.getElementById('conf-gudang-tipe').value;
  const lat = document.getElementById('conf-gudang-lat').value;
  const lng = document.getElementById('conf-gudang-lng').value;
  const radius = document.getElementById('conf-gudang-radius').value;

  if (!nama) return alert("Nama Gudang / Cabang harus diisi!");
  if (tipeLokasi === 'Tetap' && (!lat || !lng || !radius)) {
    return alert("Untuk lokasi Tetap, Latitude/Longitude/Radius harus diisi lengkap!");
  }

  try {
    await addDoc(collection(db, "master_gudang"), {
      nama_gudang: nama,
      tipe_lokasi: tipeLokasi,
      latitude: tipeLokasi === 'Tetap' ? lat : "",
      longitude: tipeLokasi === 'Tetap' ? lng : "",
      radius: tipeLokasi === 'Tetap' ? parseInt(radius) : 0
    });
    alert("Master Gudang Berhasil Disimpan!");
    
    document.getElementById('conf-gudang-nama').value = '';
    document.getElementById('conf-gudang-lat').value = '';
    document.getElementById('conf-gudang-lng').value = '';
    document.getElementById('conf-gudang-radius').value = '';
    document.getElementById('conf-gudang-tipe').value = 'Tetap';
    if (window.toggleFieldLokasiGudang) window.toggleFieldLokasiGudang();
    
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
    const isDinamis = d.tipe_lokasi === 'Dinamis';
    const infoLokasi = isDinamis
      ? '<span class="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 font-bold text-[9px] rounded-full">DINAMIS - Tanpa Radius</span>'
      : `Lat: ${d.latitude}<br>Lng: ${d.longitude}<br><span class="font-bold text-red-500">Radius: ${d.radius} m</span>`;
    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
        <td class="p-2 font-bold text-blue-800">${d.nama_gudang}</td>
        <td class="p-2 text-[10px] text-gray-500 font-mono">${infoLokasi}</td>
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

// =========================================================================
// SISTEM MASTER DATA (Config Karyawan) — 1 sistem generik dipakai bareng untuk
// 9 kategori dropdown di seluruh aplikasi. Disimpan di Firestore koleksi
// "master_data", 1 dokumen per kategori, field "items" (array string).
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
// js/vue-config-karyawan.js. window.ambilMasterList,
// window.ambilKecamatanUntukKabupaten, dan window.isiSelectDariMaster
// TETAP dipertahankan di sini karena masih dipakai layar yang belum
// dimigrasi (Antrean Dakar, Edit Karyawan, Registrasi).


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

// =========================================================================
// ====== PENJADWALAN (bulk): ringkasan, cari, filter, pilih massal, =======
// ====== update massal, pagination, export/import Excel ===================
// =========================================================================
window._jadwalState = {
  semuaKaryawan: [],
  gudangGudang: [],
  semuaShift: [],
  terpilih: new Set(),
  hasilFilter: [],
  halaman: 1,
  perHalaman: 15
};

window.muatDataPenjadwalan = async function() {
  const qKaryawan = await getDocs(collection(db, "users"));
  const daftarKaryawan = [];
  qKaryawan.forEach(docSnap => {
    const d = docSnap.data();
    if (d.role !== 'owner') daftarKaryawan.push({ email: docSnap.id, ...d });
  });
  window._jadwalState.semuaKaryawan = daftarKaryawan;

  const qGudang = await getDocs(collection(db, "master_gudang"));
  const daftarGudang = [];
  qGudang.forEach(docSnap => daftarGudang.push(docSnap.data().nama_gudang));
  window._jadwalState.daftarGudang = daftarGudang;

  const qShift = await getDocs(collection(db, "master_shift"));
  const daftarShift = [];
  qShift.forEach(docSnap => daftarShift.push(docSnap.data()));
  window._jadwalState.daftarShift = daftarShift;

  const daftarJenisPekerjaan = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];

  // Isi dropdown filter
  const isiOpsi = (id, list, labelSemua) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="ALL">${labelSemua}</option>` + list.map(v => `<option value="${v}">${v}</option>`).join('');
  };
  isiOpsi('jadwal-filter-jenispekerjaan', daftarJenisPekerjaan, 'Semua Jenis Pekerjaan');
  const elFilterGudang = document.getElementById('jadwal-filter-gudang');
  if (elFilterGudang) {
    elFilterGudang.innerHTML = `<option value="ALL">Semua Gudang</option>` +
      daftarGudang.map(v => `<option value="${v}">${v}</option>`).join('') +
      `<option value="__TANPA_GUDANG__">Tanpa Gudang</option>`;
  }
  isiOpsi('jadwal-filter-shift', daftarShift.map(s => s.nama_shift), 'Semua Shift');
  isiOpsi('jadwal-filter-libur', ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'], 'Semua Hari Libur');

  const selectBulkShift = document.getElementById('jadwal-bulk-shift');
  if (selectBulkShift) {
    selectBulkShift.innerHTML = '<option value="">-- Tidak Diubah --</option>' +
      daftarShift.map(s => `<option value="${s.nama_shift}">${s.nama_shift} (${s.jam_masuk} - ${s.jam_keluar})</option>`).join('');
  }
  window.renderGudangCheckboxes(document.getElementById('jadwal-bulk-gudang-checkboxes'), daftarGudang, []);

  window._jadwalState.terpilih.clear();
  window.jadwalTerapkanFilter();
};

// Karyawan dianggap "sudah dijadwalkan" kalau sudah punya minimal 1 gudang DAN shift
window.jadwalStatusTerjadwal = function(d) {
  const gudang = window.normalisasiGudang(d.gudang_penempatan);
  return (gudang.length > 0 && !!d.nama_shift);
};

window.jadwalTerapkanFilter = function() {
  const kataKunci = (document.getElementById('jadwal-cari-nama').value || '').toLowerCase().trim();
  const cekSudah = document.getElementById('jadwal-cek-sudah').checked;
  const cekBelum = document.getElementById('jadwal-cek-belum').checked;
  const fJenisPekerjaan = document.getElementById('jadwal-filter-jenispekerjaan').value;
  const fGudang = document.getElementById('jadwal-filter-gudang').value;
  const fShift = document.getElementById('jadwal-filter-shift').value;
  const fLibur = document.getElementById('jadwal-filter-libur').value;

  const hasil = window._jadwalState.semuaKaryawan.filter(d => {
    if (kataKunci && !(d.nama || '').toLowerCase().includes(kataKunci)) return false;

    const sudahTerjadwal = window.jadwalStatusTerjadwal(d);
    if (sudahTerjadwal && !cekSudah) return false;
    if (!sudahTerjadwal && !cekBelum) return false;

    if (fJenisPekerjaan !== 'ALL' && d.jenis_pekerjaan !== fJenisPekerjaan) return false;
    if (fGudang === '__TANPA_GUDANG__') {
      if (window.normalisasiGudang(d.gudang_penempatan).length > 0) return false;
    } else if (fGudang !== 'ALL' && !window.normalisasiGudang(d.gudang_penempatan).includes(fGudang)) {
      return false;
    }
    if (fShift !== 'ALL' && d.nama_shift !== fShift) return false;
    if (fLibur !== 'ALL' && d.hari_libur !== fLibur) return false;

    return true;
  });

  window._jadwalState.hasilFilter = hasil;
  window._jadwalState.halaman = 1;
  window.jadwalRenderRingkasan();
  window.jadwalRenderTabel();
};

window.jadwalRenderRingkasan = function() {
  const semua = window._jadwalState.semuaKaryawan;
  const daftarGudang = window._jadwalState.daftarGudang || [];
  const filterAktif = document.getElementById('jadwal-filter-gudang') ? document.getElementById('jadwal-filter-gudang').value : 'ALL';

  const hitungUntuk = (list) => {
    const total = list.length;
    const sudah = list.filter(window.jadwalStatusTerjadwal).length;
    return { total, sudah, belum: total - sudah };
  };

  const buatKartu = (label, nilaiFilter, angka, warnaAktif) => {
    const aktif = filterAktif === nilaiFilter;
    return `
      <div onclick="jadwalKlikKartuGudang('${nilaiFilter}')" class="flex-shrink-0 w-40 bg-white p-4 rounded-2xl border-2 ${aktif ? 'border-blue-500 shadow-md' : 'border-gray-100 shadow-sm'} cursor-pointer hover:border-blue-300 transition">
        <h4 class="text-[11px] font-bold text-slate-800 truncate mb-2" title="${label}">${label}</h4>
        <div class="space-y-1 text-[10px]">
          <div class="flex justify-between"><span class="text-gray-400">Total</span><b class="text-slate-800">${angka.total}</b></div>
          <div class="flex justify-between"><span class="text-gray-400">Sudah</span><b class="text-green-600">${angka.sudah}</b></div>
          <div class="flex justify-between"><span class="text-gray-400">Belum</span><b class="text-red-500">${angka.belum}</b></div>
        </div>
      </div>`;
  };

  let html = buatKartu('Semua Gudang', 'ALL', hitungUntuk(semua));

  daftarGudang.forEach(g => {
    const list = semua.filter(d => window.normalisasiGudang(d.gudang_penempatan).includes(g));
    html += buatKartu(g, g, hitungUntuk(list));
  });

  const tanpaGudang = semua.filter(d => window.normalisasiGudang(d.gudang_penempatan).length === 0);
  html += buatKartu('Tanpa Gudang', '__TANPA_GUDANG__', hitungUntuk(tanpaGudang));

  document.getElementById('jadwal-ring-scroll').innerHTML = html;
};

window.jadwalKlikKartuGudang = function(nilaiFilter) {
  document.getElementById('jadwal-filter-gudang').value = nilaiFilter;
  window.jadwalTerapkanFilter();
};

window.jadwalRenderTabel = function() {
  const tbody = document.getElementById('tabel-jadwal-body');
  const { hasilFilter, halaman, perHalaman, terpilih } = window._jadwalState;

  const totalHalaman = Math.max(1, Math.ceil(hasilFilter.length / perHalaman));
  const halamanAman = Math.min(halaman, totalHalaman);
  window._jadwalState.halaman = halamanAman;

  const mulai = (halamanAman - 1) * perHalaman;
  const potongan = hasilFilter.slice(mulai, mulai + perHalaman);

  if (potongan.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-gray-400">Tidak ada karyawan yang cocok dengan filter.</td></tr>';
  } else {
    tbody.innerHTML = potongan.map(d => {
      const gudangList = window.normalisasiGudang(d.gudang_penempatan);
      const sudahTerjadwal = window.jadwalStatusTerjadwal(d);
      const dicentang = terpilih.has(d.email);
      return `
        <tr class="hover:bg-gray-50">
          <td class="p-3"><input type="checkbox" ${dicentang ? 'checked' : ''} onchange="jadwalToggleCheckbox('${d.email}', this.checked)"></td>
          <td class="p-3"><b class="text-slate-800">${d.nama || '-'}</b><br><span class="text-[10px] text-gray-400">${d.email}</span></td>
          <td class="p-3">${d.jenis_pekerjaan || '-'}</td>
          <td class="p-3">${gudangList.join(', ') || '-'}</td>
          <td class="p-3">${d.nama_shift || '-'}</td>
          <td class="p-3">${d.hari_libur || '-'}</td>
          <td class="p-3 text-center">${sudahTerjadwal
            ? '<span class="inline-block px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] rounded-full">Sudah</span>'
            : '<span class="inline-block px-2 py-0.5 bg-red-100 text-red-600 font-bold text-[9px] rounded-full">Belum</span>'}</td>
        </tr>`;
    }).join('');
  }

  document.getElementById('jadwal-cek-header').checked = potongan.length > 0 && potongan.every(d => terpilih.has(d.email));
  document.getElementById('jadwal-jumlah-terpilih').innerText = terpilih.size;
  document.getElementById('jadwal-info-halaman').innerText =
    hasilFilter.length === 0 ? 'Tidak ada data' : `Halaman ${halamanAman} dari ${totalHalaman} (${hasilFilter.length} karyawan cocok filter)`;
};

window.jadwalToggleCheckbox = function(email, dicentang) {
  if (dicentang) window._jadwalState.terpilih.add(email);
  else window._jadwalState.terpilih.delete(email);
  document.getElementById('jadwal-jumlah-terpilih').innerText = window._jadwalState.terpilih.size;
};

window.jadwalToggleSemuaHalamanIni = function() {
  const dicentang = document.getElementById('jadwal-cek-header').checked;
  const { hasilFilter, halaman, perHalaman, terpilih } = window._jadwalState;
  const mulai = (halaman - 1) * perHalaman;
  hasilFilter.slice(mulai, mulai + perHalaman).forEach(d => {
    if (dicentang) terpilih.add(d.email); else terpilih.delete(d.email);
  });
  window.jadwalRenderTabel();
};

window.jadwalPilihSemua = function() {
  window._jadwalState.hasilFilter.forEach(d => window._jadwalState.terpilih.add(d.email));
  window.jadwalRenderTabel();
};

window.jadwalBersihkanPilihan = function() {
  window._jadwalState.terpilih.clear();
  window.jadwalRenderTabel();
};

window.jadwalHalamanSebelumnya = function() {
  if (window._jadwalState.halaman > 1) { window._jadwalState.halaman--; window.jadwalRenderTabel(); }
};
window.jadwalHalamanBerikutnya = function() {
  const totalHalaman = Math.max(1, Math.ceil(window._jadwalState.hasilFilter.length / window._jadwalState.perHalaman));
  if (window._jadwalState.halaman < totalHalaman) { window._jadwalState.halaman++; window.jadwalRenderTabel(); }
};

window.jadwalTerapkanBulkUpdate = async function() {
  const terpilih = Array.from(window._jadwalState.terpilih);
  if (terpilih.length === 0) return alert("Belum ada karyawan yang dicentang/terpilih.");

  const gudangBaru = window.bacaGudangCheckboxes(document.getElementById('jadwal-bulk-gudang-checkboxes'));
  const shiftBaru = document.getElementById('jadwal-bulk-shift').value;
  const liburBaru = document.getElementById('jadwal-bulk-libur').value;

  if (gudangBaru.length === 0 && !shiftBaru && !liburBaru) {
    return alert("Isi minimal salah satu: Gudang, Shift, atau Hari Libur untuk diterapkan.");
  }

  if (!confirm(`Terapkan perubahan ke ${terpilih.length} karyawan terpilih?`)) return;

  const dataUpdate = {};
  if (gudangBaru.length > 0) dataUpdate.gudang_penempatan = gudangBaru;
  if (shiftBaru) dataUpdate.nama_shift = shiftBaru;
  if (liburBaru) dataUpdate.hari_libur = liburBaru;

  let sukses = 0, gagal = 0;
  for (const email of terpilih) {
    try {
      await updateDoc(doc(db, "users", email), dataUpdate);
      sukses++;
    } catch (e) {
      console.error("Gagal update jadwal untuk", email, e);
      gagal++;
    }
  }

  alert(`Update massal selesai. Berhasil: ${sukses}, Gagal: ${gagal}.`);
  window.muatDataPenjadwalan();
};

window.jadwalExportExcel = function() {
  const data = window._jadwalState.hasilFilter.map(d => ({
    'Email (jangan diubah)': d.email,
    'Nama': d.nama || '',
    'Jenis Pekerjaan': d.jenis_pekerjaan || '',
    'Gudang (pisahkan koma jika lebih dari satu)': window.normalisasiGudang(d.gudang_penempatan).join(', '),
    'Shift': d.nama_shift || '',
    'Hari Libur': d.hari_libur || ''
  }));
  if (data.length === 0) return alert("Tidak ada data untuk diunduh (sesuai filter aktif).");

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Penjadwalan");
  XLSX.writeFile(wb, `Penjadwalan_Zevanic_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

window.jadwalImportExcel = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) return alert("File Excel kosong atau format tidak dikenali.");
      if (!confirm(`Ditemukan ${rows.length} baris data. Terapkan update ke semua karyawan di file ini?`)) {
        event.target.value = '';
        return;
      }

      let sukses = 0, gagal = 0, dilewati = 0;
      for (const row of rows) {
        const email = row['Email (jangan diubah)'];
        if (!email) { dilewati++; continue; }

        const dataUpdate = {};
        if (row['Gudang (pisahkan koma jika lebih dari satu)']) {
          dataUpdate.gudang_penempatan = String(row['Gudang (pisahkan koma jika lebih dari satu)']).split(',').map(g => g.trim()).filter(Boolean);
        }
        if (row['Shift']) dataUpdate.nama_shift = String(row['Shift']).trim();
        if (row['Hari Libur']) dataUpdate.hari_libur = String(row['Hari Libur']).trim();

        if (Object.keys(dataUpdate).length === 0) { dilewati++; continue; }

        try {
          await updateDoc(doc(db, "users", email), dataUpdate);
          sukses++;
        } catch (err) {
          console.error("Gagal update baris untuk", email, err);
          gagal++;
        }
      }

      alert(`Import selesai. Berhasil: ${sukses}, Gagal: ${gagal}, Dilewati (email kosong/tidak ada perubahan): ${dilewati}.`);
      event.target.value = '';
      window.muatDataPenjadwalan();
    } catch (err) {
      console.error("Gagal membaca file Excel:", err);
      alert("Gagal membaca file Excel. Pastikan formatnya sesuai hasil unduhan dari sistem ini.");
      event.target.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
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

window.muatDataAdminACC = async function() {
  const container = document.getElementById('container-admin-acc');
  if (!container) return;
  
  container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p class="text-xs">Memuat antrean validasi absensi...</p></div>`;

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");
    const querySnapshot = await getDocs(collection(db, "absensi"));
    const daftarStatusKehadiran = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : ["Ontime", "Terlambat", "Tidak Absen"];
    let html = "";
    let countPending = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const docId = docSnap.id;

      if (!data.status_acc || data.status_acc === "PENDING") {
        countPending++;
        const fotoUrl = data.foto_selfie || data.foto || "https://via.placeholder.com/150";
        const tanggalStr = data.waktu || "-";
        const koordinatHtml = data.koordinat
          ? `${data.koordinat.lat.toFixed(5)}, ${data.koordinat.lng.toFixed(5)}<br><a href="https://www.google.com/maps?q=${data.koordinat.lat},${data.koordinat.lng}" target="_blank" class="text-blue-500 text-[9px]"><i class="fas fa-map-marker-alt"></i> Lihat di Peta</a>`
          : '-';
        const statusRadiusHtml = data.status_radius === "DALAM RADIUS"
          ? `<span class="inline-block px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] rounded-full">Dalam Radius (${data.jarak_meter || 0}m)</span>`
          : data.status_radius === "DI LUAR RADIUS"
          ? `<span class="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[9px] rounded-full">Di Luar Radius (${data.jarak_meter || 0}m)</span>`
          : data.status_radius === "LOKASI DINAMIS"
          ? `<span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 font-bold text-[9px] rounded-full">Lokasi Dinamis</span>`
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
                <label class="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Status Kehadiran</label>
                <select id="acc-statuskehadiran-${docId}" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none font-bold text-slate-700 text-xs">
                  ${daftarStatusKehadiran.map(s => `<option value="${s}" ${data.status_kehadiran === s ? 'selected' : ''}>${s}</option>`).join('')}
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
              <button onclick="prosesAcceptAbsensi('${docId}', 'ACC')" class="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition shadow-sm text-xs flex items-center justify-center">
                <i class="fas fa-check-circle mr-1"></i> Accept
              </button>
              <button onclick="prosesAcceptAbsensi('${docId}', 'REJECT')" class="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl hover:bg-red-600 transition shadow-sm text-xs flex items-center justify-center">
                <i class="fas fa-times-circle mr-1"></i> Reject
              </button>
              <button onclick="hapusAbsensi('${docId}')" class="bg-gray-100 text-gray-500 font-bold px-3.5 py-2.5 rounded-xl hover:bg-gray-200 transition text-xs" title="Hapus Permanen">
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

window.prosesAcceptAbsensi = async function(docId, statusAcc) {
  const seragam = document.getElementById(`acc-seragam-${docId}`).value;
  const statusKehadiran = document.getElementById(`acc-statuskehadiran-${docId}`) ? document.getElementById(`acc-statuskehadiran-${docId}`).value : "";

  try {
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    const docRef = doc(db, "absensi", docId);
    await updateDoc(docRef, {
      status_acc: statusAcc,
      status_kehadiran: statusKehadiran,
      seragam: seragam,
      validated_at: new Date().toISOString(),
      validated_by: window.currentUser.name || window.currentUser.nama || window.currentUser.email
    });

    alert(`Absensi berhasil di-${statusAcc}! Data telah berpindah ke Riwayat All Absensi.`);
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

window.siapkanFilterRekap = async function() {
  const container = document.getElementById('container-acc-rekap');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p>Menyiapkan Riwayat All Absensi...</p></div>`;

  try {
    const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const { db } = await import("./firebase-config.js");

    // Cross-reference No. HP dari koleksi users (record absensi tidak simpan hp langsung)
    const qUsers = await getDocs(collection(db, "users"));
    const petaHp = {};
    qUsers.forEach(u => { petaHp[u.data().email] = u.data().hp || '-'; });

    const querySnapshot = await getDocs(collection(db, "absensi"));
    let listData = [];
    
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        data.id = docSnap.id;
        listData.push(data);
    });

    listData.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
    window.dataRiwayatGlobal = listData; 

    const dua = (a, b) => `<b class="text-slate-800">${a || '-'}</b><br><span class="text-[10px] text-gray-400 font-normal">${b || '-'}</span>`;

    let html = `
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center mb-4">
        <div>
           <h3 class="font-black text-slate-800 text-sm"><i class="fas fa-database text-purple-600 mr-2"></i> Riwayat All Absensi</h3>
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
              <th class="p-3">Persetujuan / Tipe Absen</th>
              <th class="p-3">Shift / Gudang</th>
              <th class="p-3">Tanggal / Waktu</th>
              <th class="p-3">Foto</th>
              <th class="p-3">Nama / No HP</th>
              <th class="p-3">Status Kehadiran / Seragam</th>
              <th class="p-3">Sanggahan Karyawan</th>
              <th class="p-3">Aju Banding</th>
              <th class="p-3">Pemeriksa</th>
              <th class="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
    `;

    listData.forEach(item => {
      const [tglBagian, jamBagian] = (item.waktu || '-, -').split(', ');
      const fotoUrl = item.foto_selfie || item.foto || '';
      const statusAccLabel = item.status_acc === 'ACC' ? '<span class="text-green-600">ACC</span>' : (item.status_acc === 'REJECT' ? '<span class="text-red-500">REJECT</span>' : '<span class="text-amber-500">PENDING</span>');
      const adaSanggahan = !!item.catatan_banding;

      html += `
        <tr class="hover:bg-blue-50 transition">
          <td class="p-3">${dua(statusAccLabel, item.status || 'HADIR')}</td>
          <td class="p-3">${dua(item.shift, item.gudang)}</td>
          <td class="p-3">${dua(tglBagian, jamBagian)}</td>
          <td class="p-3">${fotoUrl ? `<img src="${fotoUrl}" class="w-10 h-10 rounded-lg object-cover border cursor-pointer hover:scale-105 transition" onclick="bukaPreviewFoto('${fotoUrl}')">` : '<span class="text-gray-300">-</span>'}</td>
          <td class="p-3">${dua(item.nama_pegawai || item.nama, petaHp[item.email] || item.email || '-')}</td>
          <td class="p-3">${dua(item.status_kehadiran, item.seragam || 'Sesuai')}</td>
          <td class="p-3 max-w-[160px] truncate" title="${(item.catatan_banding || '').replace(/"/g, '&quot;')}">${item.catatan_banding || '-'}</td>
          <td class="p-3">${adaSanggahan ? '<span class="px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[9px] rounded-full">Ada Aju Banding</span>' : '<span class="text-gray-300">-</span>'}</td>
          <td class="p-3">${item.validated_by || '-'}</td>
          <td class="p-3 text-center">
            <div class="flex items-center justify-center gap-1">
              <button onclick="bukaEditAbsensi('${item.id}')" class="bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-100" title="Edit"><i class="fas fa-edit"></i></button>
              <button onclick="hapusAbsensi('${item.id}')" class="bg-red-50 text-red-600 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-100" title="Hapus"><i class="fas fa-trash-alt"></i></button>
              ${adaSanggahan ? `<button onclick="assignUlangAbsensi('${item.id}')" class="bg-amber-50 text-amber-600 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-amber-100" title="Assign ulang ke Antrean Absensi"><i class="fas fa-undo"></i></button>` : ''}
            </div>
          </td>
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

// ---- Aksi Edit & Assign Ulang untuk Riwayat All Absensi ----
window.bukaEditAbsensi = async function(docId) {
  const item = (window.dataRiwayatGlobal || []).find(i => i.id === docId);
  if (!item) return alert("Data tidak ditemukan, coba refresh dulu.");

  const daftarStatusKehadiran = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : ["Ontime", "Terlambat", "Tidak Absen"];
  document.getElementById('editabsensi-doc-id').value = docId;
  document.getElementById('editabsensi-nama').innerText = item.nama_pegawai || item.nama || '-';
  document.getElementById('editabsensi-statuskehadiran').innerHTML = daftarStatusKehadiran.map(s =>
    `<option value="${s}" ${item.status_kehadiran === s ? 'selected' : ''}>${s}</option>`
  ).join('');
  document.getElementById('editabsensi-seragam').value = item.seragam || 'Sesuai';
  document.getElementById('editabsensi-statusacc').value = item.status_acc || 'PENDING';
  document.getElementById('modal-edit-absensi').classList.remove('hidden');
};

window.tutupEditAbsensi = function() {
  document.getElementById('modal-edit-absensi').classList.add('hidden');
};

window.simpanEditAbsensi = async function() {
  const docId = document.getElementById('editabsensi-doc-id').value;
  const statusKehadiran = document.getElementById('editabsensi-statuskehadiran').value;
  const seragam = document.getElementById('editabsensi-seragam').value;
  const statusAcc = document.getElementById('editabsensi-statusacc').value;

  try {
    await updateDoc(doc(db, "absensi", docId), {
      status_kehadiran: statusKehadiran,
      seragam: seragam,
      status_acc: statusAcc
    });
    alert("Data absensi berhasil diperbarui!");
    window.tutupEditAbsensi();
    window.siapkanFilterRekap();
  } catch (e) {
    console.error("Gagal edit absensi:", e);
    alert("Gagal menyimpan perubahan.");
  }
};

// Assign ulang: dipakai kalau ada sanggahan karyawan (aju banding) — kembalikan
// record ke Antrean Absensi supaya diperiksa ulang oleh PIC/Owner.
window.assignUlangAbsensi = async function(docId) {
  if (!confirm("Kembalikan data ini ke Antrean Absensi untuk diperiksa ulang?")) return;
  try {
    await updateDoc(doc(db, "absensi", docId), {
      status_acc: "PENDING"
    });
    alert("Data berhasil di-assign ulang ke Antrean Absensi.");
    window.siapkanFilterRekap();
  } catch (e) {
    console.error("Gagal assign ulang:", e);
    alert("Gagal memproses assign ulang.");
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
