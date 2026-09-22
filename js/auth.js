// js/auth.js
// Gerbang otentikasi & konteks sesi: listener Firebase Auth, sesi otomatis,
// cache profil, hak akses menu/fitur/jabatan, helper shift & gateway WhatsApp.
//
// Koleksi & field:
// - users/{email}: role (5 role baku), nama + nama_lower (kotak cari),
//   status_approval, status_kerja, jenis_akun, gudang_penempatan, nama_shift,
//   jabatan, jenis_pekerjaan.
// - akses_jabatan/{jabatan}: role + jenis_pekerjaan + peta izin menu/fitur.
// - jadwal_shift/{email}_{YYYY-MM} & master_shift, absensi, wa_keluar, config.
//
// Jebakan:
// - onAuthStateChanged bisa memanggil user=null DULU sebelum sesi tersimpan
//   terbaca; toleransi 6000ms kalau ada cache sesi, 1200ms kalau tidak.
// - Komponen WAJIB `await window.authReady` sebelum fetch; yang menggambar
//   daftar menu WAJIB `await window.izinSiap` — authReady selesai lebih dulu.
// - Tiap window.currentUser berubah di tengah sesi WAJIB simpanKonteksSesi(),
//   kalau tidak cache localStorage basi dan menimpa balik saat reload.
// - Sidebar digerbang DUA lapis: role batas terluas, terapkanIzinMenuKeSidebar
//   mengurangi menurut JABATAN. Menu sidebar baru wajib punya data-menu-id.
import { doc, setDoc, getDoc, collection, getDocs, addDoc, query, where, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

window.statusPilihanGlobal = "HADIR (CLOCK IN)";
window.currentUser = { email: "", name: "", role: "operator", id_app: "", id_karyawan: "", jabatan: "", status_kerja: "aktif" };
window._manualLoginInProgress = false; // dicek oleh onAuthStateChanged, disetel oleh vue-login.js

// Deteksi link "Buat Password" (?buatpassword=1&email=..&token=..) WAJIB paling
// awal, sebelum logic sesi-otomatis di bawah sempat melempar ke screen-login.
// window._modeBuatPassword dicek di onAuthStateChanged besar supaya layarnya
// tidak ditimpa balik ke Login/Dashboard.
window._modeBuatPassword = new URLSearchParams(window.location.search).get('buatpassword') === '1';
if (window._modeBuatPassword && window.pindahLayar) {
  window.pindahLayar('screen-buat-password');
}

// window.authReady: sinyal Auth sudah pasti tahu login atau tidak. Komponen Vue
// WAJIB await ini sebelum fetch — tanpa itu Firestore Rules menolak dan tabelnya
// macet "Memuat data..". user=null tetap ditunggu 1200ms karena panggilan
// pertama Firebase bisa null sementara walau sesi tersimpan sebenarnya ada.
window.authReady = new Promise((resolve) => {
  let sudahSelesai = false;
  const lepasListener = onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
      if (!sudahSelesai) { sudahSelesai = true; lepasListener(); resolve(user); }
    } else {
      setTimeout(() => {
        if (!sudahSelesai) { sudahSelesai = true; lepasListener(); resolve(null); }
      }, 1200);
    }
  });
});

// window.izinSiap: sinyal IZIN MENU sudah dimuat — BEDA dari authReady, yang cuma
// menandakan Auth sudah tahu siapa yang login. Layar yang menggambar daftar menu
// WAJIB menunggu ini; kalau cuma menunggu authReady, ia menghitung gembok saat
// izinMenuSaya masih kosong dan hasilnya tidak pernah dihitung ulang.
let _tandaiIzinSiap = null;
window.izinSiap = new Promise((resolve) => { _tandaiIzinSiap = resolve; });
window.tandaiIzinSiap = function() {
  if (_tandaiIzinSiap) { _tandaiIzinSiap(); _tandaiIzinSiap = null; }
};
// Jaring pengaman: kalau ada jalur yang tidak pernah memuat izin (kiosk, buat
// password, login gagal), layar tidak boleh menggantung selamanya.
window.authReady.then(() => { setTimeout(window.tandaiIzinSiap, 5000); });


// window.cekIzinMenu(menuId, 'view'|'add'|'edit'|'delete'|'print') dan
// window.cekFiturAkses(menuId, fiturKey) baca window.izinMenuSaya yang diambil
// SEKALI saat login. Keduanya balik null = "belum diatur", pemanggil yang
// putuskan default — cek eksplisit `=== false` untuk "sengaja dilarang".
window.izinMenuSaya = undefined; // undefined = belum sempat dimuat sama sekali

// Izin menu datang dari JABATAN, bukan role. Role cuma pengaman di Firestore
// Rules; jabatan yang menentukan apa yang tampil. Dokumen akses_jabatan juga
// memuat role + jenis_pekerjaan jabatan itu, yang disalin ke users saat
// di-assign.
window.muatIzinMenuSaya = async function(role, jabatan) {
  try {
    const r = (role || '').toLowerCase();
    if (r === 'owner') {
      // Owner asli satu-satunya yang kebal. PIC Owner TIDAK — menunya ikut
      // jabatan, kuasa tulisnya saja yang setara owner di Rules.
      window.izinMenuSaya = 'OWNER_PENUH';
      return;
    }
    const j = (jabatan || '').trim().toLowerCase();
    if (!j) { window.izinMenuSaya = null; return; }
    try {
      const snap = await getDoc(doc(db, "akses_jabatan", j));
      window.izinMenuSaya = snap.exists() ? snap.data() : null;
    } catch (e) {
      console.error("Gagal muat akses_jabatan untuk", j, e);
      window.izinMenuSaya = null;
    }
  } finally {
    // WAJIB di finally: cabang owner dan cabang jabatan-kosong pun harus
    // melepas layar yang sedang menunggu, kalau tidak daftar menu macet.
    window.tandaiIzinSiap();
  }
};

window.cekIzinMenu = function(menuId, jenis) {
  if (window.izinMenuSaya === 'OWNER_PENUH') return true;
  if (!window.izinMenuSaya) return null; // belum dimuat / jabatan belum diatur -> pemanggil yang putuskan default
  const menu = window.izinMenuSaya.menus?.[menuId];
  if (!menu) return null;
  return menu[jenis] === true ? true : (menu[jenis] === false ? false : null);
};

window.cekFiturAkses = function(menuId, fiturKey) {
  if (window.izinMenuSaya === 'OWNER_PENUH') return true;
  if (!window.izinMenuSaya) return null;
  const menu = window.izinMenuSaya.menus?.[menuId];
  if (!menu || !menu.fitur) return null;
  const nilai = menu.fitur[fiturKey];
  return nilai === true ? true : (nilai === false ? false : null);
};


// WAJIB dipanggil tepat sebelum menyimpan dokumen absensi dan JANGAN di-cache di
// window.currentUser — shift bisa beda tiap tanggal, salah shift = Ontime/Telat
// salah hitung diam-diam. Baca jadwal_shift/{email}_{YYYY-MM}, skema & docId
// SAMA PERSIS vue-penjadwalan.js; aturan fallback-nya harus sama dengan file itu.
window.ambilShiftEfektifHariIni = async function(email, namaShiftDefault) {
  try {
    const sekarang = new Date();
    const bulanKey = `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}`;
    const snap = await getDoc(doc(db, "jadwal_shift", `${email}_${bulanKey}`));
    if (snap.exists()) {
      const hari = snap.data().hari || {};
      const nilaiHariIni = hari[String(sekarang.getDate())];
      if (nilaiHariIni !== undefined) return nilaiHariIni; // eksplisit dari Kalender/Rotasi, termasuk "OFF"
    }
  } catch (e) {
    // Gagal baca (mis. rule belum publish/offline) TIDAK BOLEH menggagalkan
    // Clock In/Out — jatuh balik senyap ke shift default, sama seperti perilaku
    // SEBELUM fitur rotasi ada.
    console.error("Gagal baca jadwal_shift, fallback ke shift default:", email, e);
  }
  return namaShiftDefault || '';
};

// Cache konteks sesi (window.currentUser + izinMenuSaya) di localStorage supaya
// reload tidak baca ulang users/{email} + akses_jabatan; dibersihkan cuma saat
// logout. foto_ktp SENGAJA dibuang dari cache. Isi cache hanya untuk TAMPILAN —
// penegak keamanan sungguhan tetap Firestore Rules di server.
window.simpanKonteksSesi = function() {
  try {
    const { foto_ktp, ...ringkas } = window.currentUser;
    localStorage.setItem('zevanic_konteks_sesi', JSON.stringify({
      data: ringkas,
      izinMenu: window.izinMenuSaya,
      disimpan_pada: Date.now()
    }));
  } catch (e) {
    console.error("Gagal simpan konteks sesi ke localStorage (tidak fatal, lanjut normal):", e);
  }
};

// Kembalikan {data, izinMenu} kalau cache ADA dan emailnya COCOK dengan user
// Firebase Auth yang sedang login sekarang — null kalau tidak ada/tidak cocok
// (pemanggil WAJIB fallback baca Firestore biasa).
window.bacaKonteksSesiDariCache = function(email) {
  try {
    const mentah = localStorage.getItem('zevanic_konteks_sesi');
    if (!mentah) return null;
    const cache = JSON.parse(mentah);
    if (!cache.data || cache.data.email !== email) return null; // beda akun -> jangan dipakai
    return cache;
  } catch (e) {
    console.error("Gagal baca cache konteks sesi:", e);
    return null;
  }
};

window.bersihkanKonteksSesi = function() {
  localStorage.removeItem('zevanic_konteks_sesi');
};

// SEMUA tabel yang menampilkan data karyawan/gudang/shift WAJIB lewat filter
// ini. Dua dimensi di-AND: jenis_pekerjaan SAMA dan gudang BERIRISAN. Cuma owner
// yang bypass total; pic_owner bebas lintas gudang tapi TETAP terkunci di
// usahanya sendiri — sama persis dengan bangunConstraintFilterPeran.
// Dimensi tanpa tag (di data maupun di profil admin) dianggap LOLOS, bukan kunci.
window.bolehLihatData = function(jenisPekerjaanData, gudangData) {
  const role = (window.currentUser.role || '').toLowerCase();
  if (role === 'owner') return true; // owner asli satu-satunya yang bypass total
  const iniPicOwner = role === 'pic_owner'; // bebas lintas gudang, TETAP terikat jenis pekerjaan
  const jpCocok = (() => {
    if (!jenisPekerjaanData || (Array.isArray(jenisPekerjaanData) && jenisPekerjaanData.length === 0)) return true;
    const jpAdmin = window.currentUser.jenis_pekerjaan;
    if (!jpAdmin) return true;
    return Array.isArray(jenisPekerjaanData) ? jenisPekerjaanData.includes(jpAdmin) : jenisPekerjaanData === jpAdmin;
  })();
  const gudangCocok = (() => {
    if (iniPicOwner) return true; // PIC Owner: semua gudang di dalam usahanya sendiri
    if (!gudangData || (Array.isArray(gudangData) && gudangData.length === 0)) return true;
    const gudangAdmin = window.normalisasiGudang(window.currentUser.gudang_penempatan);
    if (gudangAdmin.length === 0) return true;
    const gudangDataArr = Array.isArray(gudangData) ? gudangData : [gudangData];
    return gudangDataArr.some(g => gudangAdmin.includes(g));
  })();
  return jpCocok && gudangCocok;
};

// Dipertahankan sebagai alias singkat — dipakai di titik yang CUMA relevan
// dimensi jenis pekerjaan saja (misal Master Shift, tidak ada field gudang sama
// sekali).
window.bolehLihatJenisPekerjaan = function(jenisPekerjaanData) {
  return window.bolehLihatData(jenisPekerjaanData, null);
};



// Pesan error Firebase Auth diterjemahkan ke Bahasa Indonesia yang ramah
// pengguna
function pesanErrorAuth(kode) {
  const peta = {
    "auth/email-already-in-use": "Email ini sudah terdaftar di sistem. Kalau Anda YAKIN belum pernah daftar sebelumnya (atau pendaftaran sebelumnya sempat gagal di tengah jalan), JANGAN coba daftar ulang berkali-kali — hubungi Owner/Admin untuk dicek dan dibersihkan datanya. Kalau memang sudah pernah daftar, silakan langsung login.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/weak-password": "Password terlalu lemah, minimal 6 karakter.",
    "auth/wrong-password": "Email atau password salah.",
    "auth/user-not-found": "Email atau password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan gagal. Coba lagi beberapa saat lagi.",
    "auth/network-request-failed": "Gagal terhubung ke server. Cek koneksi internet Anda."
  };
  return peta[kode] || null;
}
window.pesanErrorAuth = pesanErrorAuth; // dipakai juga oleh js/vue-registrasi.js

// Salinan huruf kecil dari field nama, WAJIB ditulis berbarengan tiap kali nama
// ditulis ke users. Kotak cari memakai field ini supaya pencarian tidak peduli
// huruf besar-kecil; dokumen yang field ini hilang TIDAK akan pernah muncul di
// hasil cari, karena orderBy membuangnya.
window.namaUntukCari = function(nama) {
  return (nama || '').trim().toLowerCase();
};

// Helper bersama (dipakai juga oleh dashboard.js): gudang_penempatan dulu string
// tunggal, sekarang array (mendukung banyak gudang). Ini menormalkan keduanya.
window.normalisasiGudang = function(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

// Field `waktu` di Firestore disimpan sebagai string locale id-ID berformat
// "D/M/YYYY, HH.MM.SS" — pemisah jam TITIK, bukan titik dua, jadi new
// Date(waktuStr) tidak bisa mem-parse-nya dan harus diurai manual di sini.
window.parseWaktuIndo = function(waktuStr) {
  if (!waktuStr || typeof waktuStr !== 'string') return null;
  try {
    const [tglPart, jamPart] = waktuStr.split(',').map(s => s.trim());
    if (!tglPart) return null;
    const [tgl, bln, thn] = tglPart.split('/').map(Number);
    if (!tgl || !bln || !thn) return null;
    let jam = 0, mnt = 0, dtk = 0;
    if (jamPart) {
      const bagianJam = jamPart.split('.').map(Number);
      jam = bagianJam[0] || 0;
      mnt = bagianJam[1] || 0;
      dtk = bagianJam[2] || 0;
    }
    const hasil = new Date(thn, bln - 1, tgl, jam, mnt, dtk);
    return isNaN(hasil.getTime()) ? null : hasil;
  } catch (e) {
    return null;
  }
};

// isDesktopBrowser & sudahClockInHariIniServer sudah direplikasi di
// js/vue-login.js (dipakai murni untuk gerbang login).

// Cek apakah waktu sekarang masih di dalam jam shift karyawan ini. DUA jendela
// diperiksa — shift yang mulai HARI INI dan yang mulai KEMARIN — karena shift
// yang menyeberang tengah malam (jam_keluar <= jam_masuk) masih berlaku di dini
// hari ini; jendela hari-ini saja akan salah menolaknya.
window.cekMasihJamKerja = async function(namaShift) {
  if (!namaShift) return false; // tidak ada shift ter-assign -> tidak bisa dipastikan, wajib login ulang
  try {
    const qShift = await getDocs(collection(db, "master_shift"));
    let shiftData = null;
    qShift.forEach(s => { if (s.data().nama_shift === namaShift) shiftData = s.data(); });
    if (!shiftData || !shiftData.jam_masuk || !shiftData.jam_keluar) {
      console.warn("[cekMasihJamKerja] Shift \"" + namaShift + "\" tidak ditemukan di master_shift, atau jam_masuk/jam_keluar kosong. shiftData:", shiftData);
      return false;
    }

    const sekarang = new Date();
    const [jamMasukH, jamMasukM] = shiftData.jam_masuk.split(':').map(Number);
    const [jamKeluarH, jamKeluarM] = shiftData.jam_keluar.split(':').map(Number);

    // Bangun 1 jendela [mulai, selesai] buat shift yang MULAI pada (sekarang +
    // offsetHari) — offsetHari=0 = mulai hari ini, -1 = mulai kemarin (buat
    // menangkap shift-nyebrang-tengah-malam yang masih berjalan pas dini hari).
    function bikinJendela(offsetHari) {
      const mulai = new Date(sekarang);
      mulai.setDate(mulai.getDate() + offsetHari);
      mulai.setHours(jamMasukH, jamMasukM, 0, 0);
      let selesai = new Date(mulai);
      selesai.setHours(jamKeluarH, jamKeluarM, 0, 0);
      if (selesai <= mulai) selesai.setDate(selesai.getDate() + 1); // shift lewat tengah malam
      return { mulai, selesai };
    }

    const jendelaHariIni = bikinJendela(0);
    const jendelaKemarin = bikinJendela(-1);
    const cocokHariIni = sekarang >= jendelaHariIni.mulai && sekarang <= jendelaHariIni.selesai;
    const cocokKemarin = sekarang >= jendelaKemarin.mulai && sekarang <= jendelaKemarin.selesai;
    const hasil = cocokHariIni || cocokKemarin;

    if (!hasil) {
      console.warn("[cekMasihJamKerja] TIDAK masuk jendela shift \"" + namaShift + "\" (" + shiftData.jam_masuk + "-" + shiftData.jam_keluar + "). sekarang=" + sekarang.toLocaleString('id-ID') + " | jendela hari ini=[" + jendelaHariIni.mulai.toLocaleString('id-ID') + " s/d " + jendelaHariIni.selesai.toLocaleString('id-ID') + "] | jendela kemarin=[" + jendelaKemarin.mulai.toLocaleString('id-ID') + " s/d " + jendelaKemarin.selesai.toLocaleString('id-ID') + "]");
    }

    return hasil;
  } catch (e) {
    console.error("Gagal cek jam kerja:", e);
    return false;
  }
};


// WHATSAPP GATEWAY: tulis dokumen wa_keluar; Cloud Function kirimWaKeluar
// mengirim lewat Fonnte (token di Secret Manager) dan mencatat wa_log sendiri.
// Hasil ditunggu sebentar supaya pemanggil (tombol Tes) tahu terkirim/gagal.
window.kirimPesanWhatsapp = async function(nomor, pesan, jenis) {
  try {
    const ref = await addDoc(collection(db, "wa_keluar"), {
      target: String(nomor || '').trim(), pesan: pesan || '', jenis: jenis || "Lainnya",
      dibuat_oleh: window.currentUser.email || '', dibuat_pada: serverTimestamp()
    });
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const snap = await getDoc(ref);
      const hasil = snap.exists() ? snap.data().hasil : null;
      if (hasil) return hasil === 'terkirim';
    }
  } catch (e) {
    console.error("Gagal kirim WhatsApp:", e);
  }
  return false;
};

// Ambil template pesan yang bisa diedit Owner (Menu WhatsApp Gateway > Template
// Pesan). jenis: 'template_otp' | 'template_aktif' | 'template_pending'
const TEMPLATE_DEFAULT_AUTH = {
  template_otp: "Kode OTP login Zevanic ERP Anda: *{kode}*. Jangan bagikan kode ini ke siapapun. Berlaku 5 menit.",
  template_aktif: "Halo {nama}, akun Zevanic ERP Anda sudah *AKTIF*. Anda sekarang bisa login dan melakukan absensi.",
  template_pending: "Halo {nama}, pendaftaran Anda di Zevanic ERP telah diterima dan sedang *menunggu persetujuan*. Silakan hubungi Koordinator/PIC untuk aktivasi akun Anda."
};
async function ambilTemplateWA(jenis) {
  try {
    const snap = await getDoc(doc(db, "config", "whatsapp_templates"));
    if (snap.exists() && snap.data()[jenis]) return snap.data()[jenis];
  } catch (e) {
    console.error("Gagal ambil template WA:", e);
  }
  return TEMPLATE_DEFAULT_AUTH[jenis];
}
window.ambilTemplateWA = ambilTemplateWA; // dipakai juga oleh dashboard.js

// OTP login perangkat baru sudah pindah ke js/vue-login.js.


// SESI OTOMATIS: sesi Firebase masih tersimpan + masih dalam jam shift + sudah
// Clock In -> langsung ke Dashboard tanpa isi ulang email/password. HANYA jalan
// sekali saat aplikasi pertama dimuat, bukan tiap status auth berubah, supaya
// tidak bentrok dengan login manual di js/vue-login.js.

let sesiOtomatisSudahDicek = false;
onAuthStateChanged(auth, async (user) => {
  // Jangan proses kalau: sudah pernah selesai diproses SEBELUMNYA dengan user
  // nyata, ATAU sedang ada proses login manual aktif (window.js/vue-login.js
  // yang urus, supaya tidak bentrok/dobel navigasi).
  if (sesiOtomatisSudahDicek || window._manualLoginInProgress || window._modeBuatPassword) return;

  if (!user || !user.email) {
    // JANGAN kunci di sini: Firebase bisa memanggil callback ini dengan
    // user=null SEMENTARA sebelum sesi tersimpan selesai dibaca. Toleransi
    // sebelum menyerah ke layar Login: 6000ms kalau ada cache
    // 'zevanic_konteks_sesi' (hard refresh perlu unduh ulang modul), 1200ms.
    let adaCacheSesiTersimpan = false;
    try { adaCacheSesiTersimpan = !!localStorage.getItem('zevanic_konteks_sesi'); }
    catch (e) { /* localStorage diblokir (mode privat dsb) — anggap tidak ada cache, aman fallback cepat */ }
    setTimeout(() => {
      if (!sesiOtomatisSudahDicek && window.pindahLayar) window.pindahLayar('screen-login');
    }, adaCacheSesiTersimpan ? 6000 : 1200);
    return;
  }

  sesiOtomatisSudahDicek = true; // kunci HANYA setelah dapat user yang nyata
  let berhasilMasukDashboard = false;

  try {
    // Coba cache localStorage DULU (lihat window.bacaKonteksSesiDariCache di
    // atas) — cuma kalau kosong/beda akun baru baca Firestore biasa.
    const cache = window.bacaKonteksSesiDariCache(user.email);
    let d;
    if (cache) {
      d = cache.data;
      window.izinMenuSaya = cache.izinMenu;
      window.tandaiIzinSiap(); // dari cache, muatIzinMenuSaya di bawah tidak dipanggil
    } else {
      const userSnap = await getDoc(doc(db, "users", user.email));
      if (!userSnap.exists()) {
        console.warn("[Sesi Otomatis] GAGAL: dokumen users/" + user.email + " tidak ditemukan di Firestore -> balik ke Login.");
        return;
      }
      d = userSnap.data();
    }

    if (d.status_approval && d.status_approval !== "APPROVED") {
      console.warn("[Sesi Otomatis] GAGAL: status_approval = \"" + d.status_approval + "\" (bukan APPROVED) -> balik ke Login.");
      return;
    }

    const roleUser = (d.role || "operator").toLowerCase();
    const isOwnerRole = (roleUser === 'owner' || roleUser === 'pic_owner');
    const gudangUser = window.normalisasiGudang(d.gudang_penempatan);
    const statusKerjaUser = d.status_kerja || "Aktif";

    // status_kerja WAJIB dicek di jalur ini juga: tanpa itu karyawan resign yang
    // sesi Firebase-nya masih persist tinggal reload untuk masuk lagi, tidak
    // lewat penolakan login manual. Owner/PIC Owner dikecualikan supaya tidak
    // terkunci total kalau field ini kebetulan kosong/salah di akunnya sendiri.
    if (!isOwnerRole && statusKerjaUser !== "Aktif") {
      console.warn("[Sesi Otomatis] GAGAL: role=\"" + roleUser + "\" (bukan owner/pic owner) & status_kerja=\"" + statusKerjaUser + "\" (bukan Aktif) -> balik ke Login.");
      return;
    }

    // Akun kiosk BERHENTI di sini ke screen-absensi-qr, TIDAK PERNAH lewat
    // gerbang gudang/Clock In/jam kerja di bawah (kiosk bukan orang). Blok
    // serupa ada di vue-login.js. status_kerja sudah dicek di atas, jadi
    // "Nonaktifkan" dari Device Kiosk tetap memblokir kiosk yang dimatikan.
    if (d.jenis_akun === 'kiosk') {
      window.currentUser = { ...d, email: user.email, role: roleUser };
      if (!cache) await window.muatIzinMenuSaya(roleUser, d.jabatan);
      window.simpanKonteksSesi();
      berhasilMasukDashboard = true;
      window.pindahLayar('screen-absensi-qr');
      return;
    }

    // TIDAK ADA pengecualian role di gerbang gudang/Clock In/jam kerja ini —
    // Owner pun WAJIB punya gudang_penempatan + nama_shift terisi di profilnya,
    // kalau tidak akan tertahan terus di layar Login. Status Clock In diambil
    // dari window.cekStatusClockInSaya (tahan shift-malam & lintas-device).
    if (gudangUser.length === 0) {
      console.warn("[Sesi Otomatis] GAGAL: gudang_penempatan kosong setelah dinormalisasi (mentah: " + JSON.stringify(d.gudang_penempatan) + ") -> balik ke Login. Role: " + roleUser + ".");
      return;
    }

    const statusClockIn = await window.cekStatusClockInSaya(user.email);
    if (!statusClockIn.aktif) {
      console.warn("[Sesi Otomatis] GAGAL: cekStatusClockInSaya() bilang TIDAK aktif (belum Clock In / sudah Clock Out) -> balik ke Login. Hasil lengkap:", statusClockIn);
      return; // belum Clock In / sudah Clock Out -> tetap layar login
    }

    const masihJamKerja = await window.cekMasihJamKerja(d.nama_shift);
    if (!masihJamKerja) {
      console.warn("[Sesi Otomatis] GAGAL: cekMasihJamKerja() bilang di luar jam shift (atau shift tidak ditemukan/tidak ter-assign). nama_shift di profil = \"" + d.nama_shift + "\" -> balik ke Login.");
      return; // di luar jam kerja -> wajib login ulang
    }

    // Semua syarat terpenuhi -> lewati layar login, langsung ke Dashboard
    window.currentUser = {
      ...d,
      email: user.email,
      name: d.nama || d.name || user.email,
      role: roleUser,
      id_app: d.id_app || "N/A",
      id_karyawan: d.id_karyawan || "N/A",
      jabatan: d.jabatan || "Staff",
      status_kerja: statusKerjaUser,
      gudang_penempatan: gudangUser
    };
    // Kalau tadi TIDAK dari cache (fetch Firestore biasa), izinMenuSaya belum
    // keisi sama sekali — baru di titik ini perlu dimuat. Kalau SUDAH dari
    // cache, sudah keisi dari cache.izinMenu di atas, skip (hemat 1 baca
    // akses_jabatan).
    if (!cache) await window.muatIzinMenuSaya(roleUser, window.currentUser.jabatan);
    window.simpanKonteksSesi(); // simpan/refresh cache buat reload berikutnya
    if (window.aturTampilanBerdasarkanRole) window.aturTampilanBerdasarkanRole();
    if (window.refreshAccountProfileDisplay) window.refreshAccountProfileDisplay();
    // Home layar landasan, sudah ter-mount sebelum titik ini, jadi WAJIB
    // di-refresh di sini — tanpa itu Home membaca window.currentUser yang masih
    // fallback 'operator' dan grup menu yang berhak tampil ikut disembunyikan.
    if (window.refreshHome) window.refreshHome();
    if (window.refreshHeaderMobile) window.refreshHeaderMobile();
    if (window.pindahLayar) window.pindahLayar('screen-dashboard');
    if (window.pindahTab) window.pindahTab('tab-home');
    berhasilMasukDashboard = true;
  } catch (e) {
    console.error("[Sesi Otomatis] GAGAL: error tak terduga (exception) di tengah proses cek sesi -> balik ke Login. Detail error:", e);
  } finally {
    // Semua jalur yang TIDAK berhasil masuk Dashboard berakhir di sini, pindah
    // dari layar loading ke Login. Tiap jalur gagal di atas punya console.warn
    // sendiri dengan alasan persisnya; log di bawah cuma RINGKASAN AKHIR — cari
    // baris "[Sesi Otomatis] GAGAL" yang PALING ATAS untuk sebab sebenarnya.
    if (!berhasilMasukDashboard) {
      console.warn("[Sesi Otomatis] RINGKASAN: sesi TIDAK berhasil masuk Dashboard -> dikembalikan ke layar Login. Cari baris \"[Sesi Otomatis] GAGAL: ...\" di atas ini untuk alasan sebenarnya.");
      if (window.pindahLayar) window.pindahLayar('screen-login');
    }
  }
});

// Prefill email "Ingat Saya" + deteksi desktop (sembunyikan dropdown status)
// sudah dipindah ke onMounted di js/vue-login.js.

window.bukaFormRegistrasi = function() {
  window.pindahLayar('screen-register');
  if (window.resetFormRegistrasi) window.resetFormRegistrasi();
};

// Registrasi karyawan baru (form, dropdown Kabupaten/Kecamatan, submit +
// rollback akun jika simpan profil gagal) sudah pindah ke js/vue-registrasi.js.


// LOGIN (prosesLogin, lanjutkanSetelahLogin) + Modal OTP sudah pindah ke
// js/vue-login.js. window.prosesClockOut TETAP di bawah sini (dipanggil dari Vue
// Account Profile).



// Satu-satunya sumber kebenaran "sedang Clock In dan belum Clock Out" — dipakai
// bareng vue-home.js, prosesClockOut, dan vue-camera.js. localStorage cuma jalan
// pintas: begitu kosong WAJIB tanya Firestore. Return {aktif, docId, formatLama};
// formatLama:true = vue-camera.js harus BIKIN dokumen CLOCK OUT terpisah.
window.cekStatusClockInSaya = async function(email) {
  // 1. Jalan pintas: localStorage device INI (gratis, tanpa baca Firestore)
  const docIdLokal = localStorage.getItem('zevanic_absensi_doc_id_' + email);
  if (docIdLokal) return { aktif: true, docId: docIdLokal, formatLama: false };

  // 2. Format sekarang — tanya Firestore langsung (device baru/nebeng HP/cache
  // dibersihkan tetap kebaca benar lewat jalur ini).
  try {
    const qBaru = query(collection(db, "absensi"), where("email", "==", email), where("status", "==", "HADIR"), where("sedang_aktif", "==", true), limit(1));
    const snapBaru = await getDocs(qBaru);
    if (!snapBaru.empty) {
      const docId = snapBaru.docs[0].id;
      localStorage.setItem('zevanic_absensi_doc_id_' + email, docId); // sinkron device INI juga
      return { aktif: true, docId, formatLama: false };
    }
  } catch (e) {
    console.error("Gagal cek status Clock In (format baru):", e);
  }

  // 3. Jaring pengaman format lama: bandingkan waktu Clock In vs Clock Out
  // terakhir. Kalau waktu_ts tidak ada, anggap TIDAK aktif — jangan blokir.
  try {
    const qMasukLama = query(collection(db, "absensi"), where("email", "==", email), where("status", "==", "HADIR (CLOCK IN)"), orderBy("waktu_ts", "desc"), limit(1));
    const qKeluarLama = query(collection(db, "absensi"), where("email", "==", email), where("status", "==", "CLOCK OUT"), orderBy("waktu_ts", "desc"), limit(1));
    const [snapMasuk, snapKeluar] = await Promise.all([getDocs(qMasukLama), getDocs(qKeluarLama)]);
    if (!snapMasuk.empty) {
      const docMasuk = snapMasuk.docs[0];
      const tsMasuk = docMasuk.data().waktu_ts;
      if (tsMasuk) {
        const tsKeluar = snapKeluar.empty ? null : snapKeluar.docs[0].data().waktu_ts;
        const masihAktif = !tsKeluar || tsMasuk.toDate() > tsKeluar.toDate();
        if (masihAktif) return { aktif: true, docId: docMasuk.id, formatLama: true };
      }
    }
  } catch (e) {
    console.error("Gagal cek status Clock In (format lama):", e);
  }

  return { aktif: false, docId: null, formatLama: false };
};

window.prosesClockOut = async function() {
  const status = await window.cekStatusClockInSaya(window.currentUser.email);
  if (!status.aktif) {
    alert("Anda belum Clock In, tidak bisa Clock Out.");
    return;
  }
  window.statusPilihanGlobal = "CLOCK OUT";
  // Label diatur otomatis oleh vue-camera.js (modeLabel) — lihat catatan di
  // vue-login.js.
  window.pindahLayar('screen-camera');
};

// Form Izin/Cuti/Lembur ada di js/vue-account-profile.js. Variabel global
// (statusPilihanGlobal, tanggalIzinGlobal, keteranganIzinGlobal,
// lemburMulaiGlobal, dst) + window.pindahLayar('screen-camera') adalah titik
// sambungnya ke alur kamera/geofencing.

// Lupa Password: tulis permintaan_reset; Cloud Function kirimLinkResetPassword
// membuat link lalu mengirimnya lewat koleksi mail (SMTP sama dengan OTP).
// Layar sengaja tidak membedakan email terdaftar/tidak (cegah tebak akun).
window.lupaPassword = async function() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) {
    alert("Isi dulu email Anda di kolom Email/Akun Login di atas, baru klik \"Lupa Password?\".");
    return;
  }
  try {
    await addDoc(collection(db, "permintaan_reset"), { email, dibuat_pada: serverTimestamp() });
    alert("Kalau " + email + " terdaftar sebagai akun login, link reset password sudah dikirim ke sana. Cek inbox dan folder Spam. Tidak datang dalam 10 menit? Hubungi Owner/Admin untuk dicek akunnya.");
  } catch (e) {
    console.error("Gagal kirim reset password:", e);
    alert(pesanErrorAuth(e.code) || "Gagal mengirim link reset password: " + e.message);
  }
};

// Logout sungguhan: keluar dari sesi Firebase Auth, bukan cuma pindah layar
window.logout = async function() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Gagal logout dari Firebase Auth:", e);
  }
  window.bersihkanKonteksSesi(); // WAJIB — supaya komputer bersama tidak nyangkut data akun sebelumnya
  window.currentUser = { email: "", name: "", role: "operator", id_app: "", id_karyawan: "", jabatan: "", status_kerja: "aktif" };
  window.pindahLayar('screen-login');
};

// js/auth.js (Bagian Aturan Tampilan Berdasarkan Role)

window.aturTampilanBerdasarkanRole = function() {
  document.getElementById('teks-nama-user').innerText = window.currentUser.name;
  if (window.perbaruiAvatarSidebarDesktop) window.perbaruiAvatarSidebarDesktop();
  if (window.perbaruiInfoSidebarDesktop) window.perbaruiInfoSidebarDesktop();
  document.getElementById('label-role-sidebar').innerText = "Role: " + window.currentUser.role.toUpperCase();
  // REDESAIN — elemen #label-badge-role (badge "ERP Portal" + countdown shift
  // lama, js/dashboard.js mulaiHitungJamKerja) DICOPOT dari topbar desktop
  // (index.html), diganti breadcrumb statis. Elemen ini mungkin sudah tidak ada
  // di DOM — null-guard supaya tidak crash.
  const elBadgeRole = document.getElementById('label-badge-role');
  if (elBadgeRole) elBadgeRole.innerHTML = `<i class="far fa-clock mr-1.5"></i> ERP Portal - ${window.currentUser.role.toUpperCase()}`;

  const role = (window.currentUser.role || "operator").toLowerCase();

  // menu-admin-acc-btn/menu-keuangan-btn/menu-superuser-btn (id DOM lama, isinya
  // menu Karyawan) tombol ANAK di dalam grup "Management" (parent toggle:
  // menu-management); gerbang role tiap anak tetap dicek sendiri-sendiri.
  const menuManagement = document.getElementById('menu-management');
  const menuAdminAccBtn = document.getElementById('menu-admin-acc-btn');
  const menuSuperUserBtn = document.getElementById('menu-superuser-btn');
  const menuKeuanganBtn = document.getElementById('menu-keuangan-btn');
  const menuWhatsapp = document.getElementById('menu-whatsapp');
  const menuWhatsappBtn = document.getElementById('menu-whatsapp-btn');
  const menuMailGatewayBtn = document.getElementById('menu-mail-gateway-btn');
  const navMobileAdmin = document.getElementById('nav-mobile-admin');
  const navMobileSuper = document.getElementById('nav-mobile-super');
  const navMobileWhatsapp = document.getElementById('nav-mobile-whatsapp');
  // Akses & Keamanan KHUSUS Owner — PIC Owner pun TIDAK boleh, makanya sengaja
  // dipisah dari gerbang owner+pic_owner dan ditaruh di blok role === 'owner'.
  const btnAksesKeamanan = document.getElementById('btn-sub-karyawan-akseskeamanan');
  const menuDeviceKioskBtn = document.getElementById('menu-device-kiosk-btn');
  // Zevanic House > Master Bahan & Aksesoris. Gerbang role SAMA PERSIS dengan
  // Master Absensi/Keuangan (isAdminLevel di firestore.rules:
  // pic/pic_owner/admin/owner) — keputusan di.
  const menuZevanicHouse = document.getElementById('menu-zevanic-house');
  const menuZevanicHouseBtn = document.getElementById('menu-zevanic-house-btn');
  // Tombol anak grup "Stok dan Pembelian" (Nota Order Belanja/Riwayat
  // Harga/Kartu Stok/Rak Penyimpanan/Repack) TIDAK digerbang satu per satu di
  // sini — cukup ikut gerbang parent menuStokPembelian, pola sama seperti
  // menuPesanan. Gerbang role-nya isAdminLevel (pic/pic_owner/admin/owner).
  const menuStokPembelian = document.getElementById('menu-stok-pembelian');
  // Persiapan Produksi, grup top-level baru sejajar Zevanic House. Gerbang role
  // SAMA (isAdminLevel — pic/pic_owner/admin/owner), domainnya masih persiapan
  // produksi yang sebelumnya nested di Zevanic House.
  const menuPersiapanProduksi = document.getElementById('menu-persiapan-produksi');
  // Pesanan (js/vue-pesanan.js), gerbang role isAdminLevel. JEBAKAN: tombolnya
  // WAJIB ikut didaftarkan di array hide DAN blok show di bawah — kalau
  // ketinggalan, class "hidden" bawaan index.html tidak pernah dicopot dan
  // menunya tidak pernah muncul untuk role manapun.
  const menuPesanan = document.getElementById('menu-pesanan');
  // Scan & Cetak, gerbang role isAdminLevel — pola dan jebakan pendaftaran
  // tombolnya sama persis seperti menuPesanan di atas.
  const menuScanCetak = document.getElementById('menu-scan-cetak');
  // Proses Produksi, grup top-level baru sejajar Zevanic House/Pesanan/Persiapan
  // Produksi/Scan & Cetak. Gerbang role SAMA (isAdminLevel) — pola SAMA PERSIS
  // seperti menuPersiapanProduksi/menuScanCetak di atas, TERMASUK jebakan bug
  // yang sama (tombolnya wajib ditambahkan ke KEDUA array show/hide di bawah).
  const menuProsesProduksi = document.getElementById('menu-proses-produksi');

  [menuManagement, menuAdminAccBtn, menuKeuanganBtn, menuSuperUserBtn, menuWhatsapp, menuWhatsappBtn, menuMailGatewayBtn, navMobileAdmin, navMobileSuper, navMobileWhatsapp, btnAksesKeamanan, menuDeviceKioskBtn, menuZevanicHouse, menuZevanicHouseBtn, menuStokPembelian, menuPersiapanProduksi, menuPesanan, menuScanCetak, menuProsesProduksi].forEach(el => {
    if (el) el.classList.add('hidden');
  });

  // Master Keuangan (Antrean Reimburse + Kategori) SEJAJAR Master Absensi (bukan
  // anak di dalamnya) — dibuka karena PIC & Admin Finance BEDA peran validasi
  // (tahap 1 vs tahap 2), jadi menu-nya ditampilkan ke role yang SAMA persis
  // dengan Master Absensi.
  if (role === 'pic' || role === 'pic_owner' || role === 'owner' || role === 'admin') {
    // Parent menu-management dibuka di gerbang paling longgar ini; tombol anak
    // Karyawan (menuSuperUserBtn) TETAP digerbang lebih ketat di blok
    // owner/pic_owner di bawah.
    if (menuManagement) menuManagement.classList.remove('hidden');
    if (menuAdminAccBtn) menuAdminAccBtn.classList.remove('hidden');
    if (menuKeuanganBtn) menuKeuanganBtn.classList.remove('hidden');
    if (menuZevanicHouse) menuZevanicHouse.classList.remove('hidden');
    if (menuZevanicHouseBtn) menuZevanicHouseBtn.classList.remove('hidden');
    // Stok dan Pembelian sekarang grup sendiri (dulu menuZevanicStockBtn,
    // gerbang role TETAP SAMA).
    if (menuStokPembelian) menuStokPembelian.classList.remove('hidden');
    if (menuPersiapanProduksi) menuPersiapanProduksi.classList.remove('hidden');
    if (menuPesanan) menuPesanan.classList.remove('hidden');
    if (menuScanCetak) menuScanCetak.classList.remove('hidden');
    if (menuProsesProduksi) menuProsesProduksi.classList.remove('hidden');
    if (navMobileAdmin) {
      navMobileAdmin.classList.remove('hidden');
      navMobileAdmin.classList.add('flex');
    }
  }

  if (role === 'owner' || role === 'pic_owner') {
    if (menuSuperUserBtn) menuSuperUserBtn.classList.remove('hidden');
    if (navMobileSuper) {
      navMobileSuper.classList.remove('hidden');
      navMobileSuper.classList.add('flex');
    }
    if (menuWhatsapp) menuWhatsapp.classList.remove('hidden');
    if (menuWhatsappBtn) menuWhatsappBtn.classList.remove('hidden');
    if (menuMailGatewayBtn) menuMailGatewayBtn.classList.remove('hidden');
    if (navMobileWhatsapp) {
      navMobileWhatsapp.classList.remove('hidden');
      navMobileWhatsapp.classList.add('flex');
    }
  }

  if (role === 'owner') {
    if (btnAksesKeamanan) btnAksesKeamanan.classList.remove('hidden');
    // Device Kiosk — "hanya owner saja", SENGAJA pola sama persis Akses &
    // Keamanan (PIC Owner TIDAK ikut, beda dari WhatsApp/Mail Gateway yang
    // PIC Owner masih boleh).
    if (menuDeviceKioskBtn) menuDeviceKioskBtn.classList.remove('hidden');
  }

  // Lapisan pengurang: role di atas cuma menentukan batas TERLUAS. Config Akses
  // dan Jabatan baru dipakai di sini untuk mencabut menu yang dilarang.
  terapkanIzinMenuKeSidebar();

  // window.terapkanUrutanMenuDesktop sengaja TIDAK dipanggil: urutan sidebar
  // murni ikut urutan statis index.html. Kalau mau diaktifkan lagi, petaGrup di
  // fungsi itu DAN panel "Urutan Menu" di js/vue-config-akses.js
  // (fiturUrutanMenuAktif) wajib disesuaikan — petaGrup tidak sinkron lagi.
};

// Inilah yang membuat pengaturan di Config Akses & Akses Jabatan terasa di
// sidebar. Sifatnya CUMA MENGURANGI: tombol disembunyikan hanya kalau
// cekIzinMenu menjawab false (dilarang eksplisit). Jawaban null "belum diatur"
// sengaja dibiarkan tampil, supaya profil lama yang izinnya belum pernah diisi
// tidak terkunci total.
function terapkanIzinMenuKeSidebar() {
  document.querySelectorAll('[data-menu-id], [data-menu-ids]').forEach(el => {
    const ids = el.dataset.menuIds
      ? el.dataset.menuIds.split(',')
      : [el.dataset.menuId];
    // Tombol yang mewakili beberapa menu sekaligus baru hilang kalau SEMUA
    // menunya dilarang — satu saja yang masih boleh, tombolnya tetap ada.
    const adaYangBoleh = ids.some(id => window.cekIzinMenu(id.trim(), 'view') !== false);
    if (!adaYangBoleh) el.classList.add('hidden');
  });

  // Tombol grup (data-group) tidak punya menu id sendiri. Ia ikut hilang kalau
  // semua anaknya sudah hilang, supaya tidak ada grup yang dibuka lalu kosong.
  document.querySelectorAll('[data-group]').forEach(tombol => {
    const isi = document.getElementById(tombol.dataset.group);
    if (!isi) return;
    const anak = Array.from(isi.querySelectorAll('[data-menu-id], [data-menu-ids]'));
    if (anak.length > 0 && anak.every(a => a.classList.contains('hidden'))) {
      tombol.classList.add('hidden');
    }
  });
}

// Baca pengaturan_sistem/urutan_menu_home (field perKategori + urutanKategori),
// lalu CUMA reorder node DOM sidebar yang sudah ada — onclick/pindahTab tidak
// disentuh. Tombol ikut diatur lewat data-menu-id, atau data-menu-ids="id1,id2"
// yang posisinya dari index PALING KECIL; tanpa atribut itu jatuh paling akhir.
function _urutkanSiblingMenu(containerEl, urutanIds) {
  if (!containerEl) return;
  const posisi = {};
  (urutanIds || []).forEach((id, idx) => { posisi[id] = idx; });
  const anak = Array.from(containerEl.children).map((el, idxAsli) => {
    const idsEl = el.dataset && el.dataset.menuIds
      ? el.dataset.menuIds.split(',')
      : (el.dataset && el.dataset.menuId ? [el.dataset.menuId] : null);
    let key = Infinity;
    if (idsEl) {
      idsEl.forEach(id => { if (posisi[id] !== undefined && posisi[id] < key) key = posisi[id]; });
    }
    return { el, key, idxAsli };
  });
  anak.sort((a, b) => (a.key - b.key) || (a.idxAsli - b.idxAsli));
  anak.forEach(({ el }) => containerEl.appendChild(el));
}

window.terapkanUrutanMenuDesktop = async function() {
  let perKategori = {};
  let urutanKategori = null;
  try {
    const snap = await getDoc(doc(db, 'pengaturan_sistem', 'urutan_menu_home'));
    if (snap.exists()) {
      const data = snap.data();
      perKategori = data.perKategori || {};
      urutanKategori = data.urutanKategori || null;
    }
  } catch (e) {
    console.error('Gagal muat urutan menu utk sidebar desktop:', e);
    return;
  }

  // Lapisan A: urutan GRUP kategori itu sendiri di sidebar kiri (Master
  // Absensi/Keuangan/Karyawan/Zevanic House/Integrasi). Kategori 'Umum'
  // (Dashboard/Profile) TIDAK ikut diatur, selalu tetap di atas.
  const petaGrup = {
    'Master Absensi': 'navgrp-absensi',
    'Master Keuangan': 'navgrp-keuangan',
    'Master Karyawan': 'navgrp-karyawan',
    'Zevanic House': 'navgrp-zevanic',
    // 'Persiapan Produksi' grup top-level, sejajar Zevanic House.
    'Persiapan Produksi': 'navgrp-persiapanproduksi',
    // 'Scan & Cetak' grup top-level baru, lihat js/vue-scan-cetak.js.
    'Scan & Cetak': 'navgrp-scancetak',
    // 'Proses Produksi' grup top-level baru, lihat js/vue-pp-cutting.js.
    'Proses Produksi': 'navgrp-prosesproduksi',
    'Master Integrasi': 'navgrp-integrasi'
  };
  if (urutanKategori && urutanKategori.length) {
    const nav = document.querySelector('.gc-sidebar nav');
    if (nav) {
      const posisi = {};
      urutanKategori.forEach((k, idx) => { const gid = petaGrup[k]; if (gid) posisi[gid] = idx; });
      const pasangan = Object.values(petaGrup).map((gid, idxAsli) => {
        const tombol = nav.querySelector(`[data-group="${gid}"]`);
        const isi = document.getElementById(gid);
        const key = posisi[gid] !== undefined ? posisi[gid] : Infinity;
        return { tombol, isi, key, idxAsli };
      }).filter(p => p.tombol && p.isi);
      pasangan.sort((a, b) => (a.key - b.key) || (a.idxAsli - b.idxAsli));
      pasangan.forEach(({ tombol, isi }) => { nav.appendChild(tombol); nav.appendChild(isi); });
    }
  }

  // Lapisan B: urutan tombol DI DALAM tiap grup/tab-strip — dipanggil walaupun
  // urutanKategori belum diatur (biar urutan per-item tetap ikut walau urutan
  // grup masih default).
  _urutkanSiblingMenu(document.getElementById('navgrp-integrasi'), perKategori['Master Integrasi']);
  _urutkanSiblingMenu(document.getElementById('navgrp-zevanic'), perKategori['Zevanic House']);
  // grup 'Persiapan Produksi' baru: 6 sub-menu sejajar (Perlu
  // Disiapkan/Vendor/Bahan/Acc Sewing/Acc Webbing/Acc Finishing), semuanya
  // langsung anak navgrp-persiapanproduksi (tidak ada tab-strip lebih dalam lagi
  // seperti Zevanic House), jadi cukup 1 baris ini saja.
  _urutkanSiblingMenu(document.getElementById('navgrp-persiapanproduksi'), perKategori['Persiapan Produksi']);
  // grup 'Scan & Cetak' baru: 4 sub-menu sejajar (Scan Stok/Referensi
  // Scan/Cetak/PIN), langsung anak navgrp-scancetak (pola sama seperti Persiapan
  // Produksi di atas).
  _urutkanSiblingMenu(document.getElementById('navgrp-scancetak'), perKategori['Scan & Cetak']);
  // grup 'Proses Produksi' baru: cuma 1 sub-menu (Cutting) yang punya menu-id
  // sungguhan saat ini (4 lainnya masih placeholder alert tanpa data-menu-id,
  // jadi tidak ikut diurutkan di sini) — pola sama seperti Persiapan Produksi di
  // atas.
  _urutkanSiblingMenu(document.getElementById('navgrp-prosesproduksi'), perKategori['Proses Produksi']);
  const stripParent = (kelas) => { const el = document.querySelector('.' + kelas); return el ? el.parentElement : null; };
  _urutkanSiblingMenu(stripParent('sub-absensi-btn'), perKategori['Master Absensi']);
  _urutkanSiblingMenu(stripParent('sub-keuangan-btn'), perKategori['Master Keuangan']);
  _urutkanSiblingMenu(stripParent('sub-karyawan-btn'), perKategori['Master Karyawan']);
  // Sub-tab Zevanic House yang lebih dalam lagi (Data Bahan & Aksesoris, Stock &
  // Pembelian) — id2 menunya bagian dari kategori 'Zevanic House' yang sama,
  // jadi pakai array urutan yang sama juga.
  _urutkanSiblingMenu(stripParent('sub-zh-databahan-btn'), perKategori['Zevanic House']);
  _urutkanSiblingMenu(stripParent('sub-zh-stock-btn'), perKategori['Zevanic House']);
  // DIPINDAH — dulu 'sub-zh-scan-btn'/perKategori['Zevanic House'] (Scan
  // Opname/Persiapan masih di Zevanic House). Sekarang 2 menu itu di kategori
  // 'Scan & Cetak', tombolnya class 'sub-scancetak-stok- tahap-btn' (lihat
  // index.html tab-scan-cetak > sub-scan-cetak-stok).
  _urutkanSiblingMenu(stripParent('sub-scancetak-stok-tahap-btn'), perKategori['Scan & Cetak']);
};
