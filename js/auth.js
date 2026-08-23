// js/auth.js
import { doc, setDoc, getDoc, collection, getDocs, addDoc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

window.statusPilihanGlobal = "HADIR (CLOCK IN)";
window.currentUser = { email: "", name: "", role: "operator", id_app: "", id_karyawan: "", jabatan: "", status_kerja: "aktif" };
window._manualLoginInProgress = false; // dicek oleh onAuthStateChanged, disetel oleh vue-login.js

// BARU (18 Agt 2026, revisi ke-2 alur registrasi) — deteksi link "Buat
// Password" dari email (?buatpassword=1&email=...&token=...) PALING AWAL,
// sebelum logic sesi-otomatis di bawah sempat jalan & mungkin melempar ke
// screen-login duluan. window._modeBuatPassword dicek di listener
// onAuthStateChanged besar di bawah (pola sama seperti
// window._manualLoginInProgress) supaya tidak ditimpa balik ke Login/
// Dashboard. app.js dimuat SEBELUM file ini (urutan <script> di
// index.html), jadi window.pindahLayar sudah pasti ada di titik ini.
window._modeBuatPassword = new URLSearchParams(window.location.search).get('buatpassword') === '1';
if (window._modeBuatPassword && window.pindahLayar) {
  window.pindahLayar('screen-buat-password');
}

// xx 
// window.authReady — PERBAIKAN BUG: semua layar Master Absensi/Master
// Karyawan (Antrean Dakar, Config Karyawan, Config Absensi, Daftar
// Karyawan, Penjadwalan, Antrean Absensi, Riwayat All Absensi) sebelumnya
// langsung ambil data Firestore begitu Vue-nya ter-mount (onMounted) — TANPA
// menunggu Firebase Auth benar-benar selesai memastikan status login. Kalau
// itu terjadi SEBELUM Auth siap (terutama pas sesi otomatis, yang butuh
// waktu cek dulu), Firestore Rules menolak baca datanya (karena dianggap
// belum login), dan karena tidak ada percobaan ulang, tabelnya macet
// "Memuat data..." selamanya sampai halaman di-reload manual.
//
// Listener INI SENGAJA terpisah dari onAuthStateChanged besar di bawah
// (yang urus logic sesi-otomatis/navigasi layar) — supaya tidak mengganggu
// logic sensitif itu sama sekali. Fungsinya cuma satu: kasih sinyal "Auth
// sudah pasti tahu jawabannya (login atau tidak)", dipakai semua komponen
// Vue yang fetch data lewat `await window.authReady` sebelum mulai ambil.
//
// PENTING (perbaikan putaran kedua): versi PERTAMA bug ini masih ada celah
// yang SAMA PERSIS dengan yang sudah pernah kita perbaiki di logic
// sesi-otomatis di bawah — Firebase kadang panggil callback ini DUA KALI:
// pertama dengan user=null SEMENTARA (bukan berarti belum login, cuma
// belum selesai cek sesi tersimpan), baru setelah itu dengan user asli.
// Versi pertama authReady langsung "selesai" di panggilan PERTAMA — kalau
// itu kebetulan yang null, semua komponen kena sinyal "siap" padahal
// belum. Sekarang meniru pola toleransi 1200ms yang sama seperti di bawah.
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

// ============================================================================
// SISTEM PENERAPAN IZIN CONFIG AKSES — fondasi bersama (17 Agt 2026)
//
// Sebelum ini, Config Akses cuma "cetak biru" — tersimpan tapi tidak
// membatasi apapun. Sekarang izin BENAR-BENAR dibaca & diterapkan lewat
// 2 fungsi bantu global ini, dipanggil dari MANAPUN di app (Vue atau
// vanilla JS) tanpa perlu import apapun:
//
//   window.cekIzinMenu(menuId, jenis) — jenis: 'view'|'add'|'edit'|'delete'|'print'
//   window.cekFiturAkses(menuId, fiturKey) — kontrol granular per-field,
//     misal kunci dropdown tertentu (lihat DAFTAR_MENU di
//     vue-config-akses.js untuk daftar fitur yang terdaftar per menu)
//
// Keduanya baca dari window.aksesConfigSaya — diambil SEKALI saat login
// (mirip window.currentUser), BUKAN baca Firestore tiap kali dicek, biar
// hemat. Kalau nanti butuh fitur baru serupa "kunci field X", TIDAK perlu
// bikin mekanisme baru — cukup daftarkan fiturKey baru di DAFTAR_MENU
// (vue-config-akses.js), lalu panggil window.cekFiturAkses(...) di titik
// yang mau dikunci. 1 pola, dipakai berkali-kali — bukan solusi ad-hoc
// per kasus.
//
// ATURAN JATUH-AMAN (fallback) — PENTING: kalau akses_config untuk role
// ini belum ada/gagal dibaca, kedua fungsi INI KEMBALIKAN null (bukan
// false) — artinya "belum diatur", dan kode PEMANGGIL yang memutuskan
// defaultnya (biasanya: anggap boleh, supaya tidak ada yang tiba-tiba
// terkunci keluar cuma karena Config Akses belum lengkap/belum dibuat
// buat role itu). Cek eksplisit `=== false` untuk "sengaja dilarang",
// jangan cek falsy biasa.
window.aksesConfigSaya = undefined; // undefined = belum sempat dimuat sama sekali

window.muatAksesConfigSaya = async function(role, profilAkses) {
  const r = (role || '').toLowerCase();
  if (r === 'owner') {
    // Owner SELALU akses penuh, tidak pernah dibatasi — tidak perlu baca
    // Firestore sama sekali buat role ini.
    window.aksesConfigSaya = 'OWNER_PENUH';
    return;
  }
  // Kunci pencarian akses_config: profil_akses kalau ada (bisa nama
  // custom, mis. "admin_finance"), fallback ke role untuk data lama yang
  // belum pernah diatur pakai profil custom sama sekali.
  const kunciCari = (profilAkses || role || '').toLowerCase();
  if (!kunciCari) { window.aksesConfigSaya = null; return; }
  try {
    const snap = await getDoc(doc(db, "akses_config", kunciCari));
    window.aksesConfigSaya = snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("Gagal muat akses_config untuk profil", kunciCari, e);
    window.aksesConfigSaya = null;
  }
};

window.cekIzinMenu = function(menuId, jenis) {
  if (window.aksesConfigSaya === 'OWNER_PENUH') return true;
  if (!window.aksesConfigSaya) return null; // belum dimuat / tidak ada data -> pemanggil yang putuskan default
  const menu = window.aksesConfigSaya.menus?.[menuId];
  if (!menu) return null;
  return menu[jenis] === true ? true : (menu[jenis] === false ? false : null);
};

window.cekFiturAkses = function(menuId, fiturKey) {
  if (window.aksesConfigSaya === 'OWNER_PENUH') return true;
  if (!window.aksesConfigSaya) return null;
  const menu = window.aksesConfigSaya.menus?.[menuId];
  if (!menu || !menu.fitur) return null;
  const nilai = menu.fitur[fiturKey];
  return nilai === true ? true : (nilai === false ? false : null);
};

// BARU (18 Agt 2026) — cache konteks sesi (window.currentUser +
// window.aksesConfigSaya) ke localStorage, supaya RELOAD halaman (F5,
// buka tab baru, dst) TIDAK perlu baca ulang "users/{email}" +
// "akses_config/{profil}" dari Firestore — cukup 1x per sesi LOGIN,
// bukan 1x per RELOAD. Dibersihkan SENDIRI cuma saat logout (lihat
// window.bersihkanKonteksSesi, dipanggil dari window.logout di bawah).
//
// AMAN dipakai localStorage untuk ini — email/role/profil_akses/
// jenis_pekerjaan/gudang BUKAN rahasia (levelnya sama dengan custom
// claim yang Firebase Auth sendiri SUDAH simpan permanen di IndexedDB).
// "Hak akses" (aksesConfig) juga cuma buat TAMPILAN — penegak keamanan
// SUNGGUHAN tetap Firestore Rules di server, tidak peduli apa isi
// localStorage. foto_ktp SENGAJA dibuang dari cache (besar, base64,
// tidak perlu buat kebanyakan layar).
window.simpanKonteksSesi = function() {
  try {
    const { foto_ktp, ...ringkas } = window.currentUser;
    localStorage.setItem('zevanic_konteks_sesi', JSON.stringify({
      data: ringkas,
      aksesConfig: window.aksesConfigSaya,
      disimpan_pada: Date.now()
    }));
  } catch (e) {
    console.error("Gagal simpan konteks sesi ke localStorage (tidak fatal, lanjut normal):", e);
  }
};

// Kembalikan {data, aksesConfig} kalau cache ADA dan emailnya COCOK
// dengan user Firebase Auth yang sedang login sekarang — null kalau
// tidak ada/tidak cocok (pemanggil WAJIB fallback baca Firestore biasa).
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

// PEDOMAN KERJA (18 Agt 2026) — SEMUA tabel yang nampilin data karyawan/
// gudang/shift WAJIB pakai filter ini secara DEFAULT, KECUALI Owner/
// Superuser (selalu bypass). Kalau nambah tabel BARU ke depan yang
// nampilin data serupa, WAJIB ikut pola ini juga — sama seperti aturan
// "menu baru default Owner-only" di §6.8.
//
// Gabungan 2 dimensi (role dicek DI DALAM fungsi ini duluan — Owner/
// Superuser bypass total, pemanggil TIDAK perlu cek role sendiri,
// konsisten dengan pola cekIzinMenu/cekFiturAkses di atas):
// 1. Jenis pekerjaan — HARUS SAMA dengan window.currentUser.jenis_pekerjaan
// 2. Gudang — HARUS BERIRISAN dengan window.currentUser.gudang_penempatan
//    (dicek pakai window.normalisasiGudang biar konsisten format array)
// Dua-duanya harus LOLOS (AND), bukan salah satu (OR).
//
// Aturan jatuh-aman SAMA di kedua dimensi (konsisten dengan §6.3 Config
// Akses): kalau datanya BELUM ADA tag sama sekali di dimensi itu (field
// kosong/tidak ada), dimensi itu dianggap LOLOS — supaya data lama yang
// belum sempat ditag tidak tiba-tiba hilang dari pandangan siapapun.
// Sama juga kalau ADMIN sendiri belum punya jenis_pekerjaan/gudang di
// profilnya — jatuh-aman ke LOLOS, bukan malah dikunci total.
//
// Dipakai untuk 3 bentuk data field, jenisPekerjaanData/gudangData
// boleh: string tunggal (karyawan), array (gudang/shift bisa >1 jenis
// pekerjaan; karyawan bisa >1 gudang), atau null/undefined (field tidak
// relevan di tabel itu, misal Master Shift tidak punya dimensi gudang).
window.bolehLihatData = function(jenisPekerjaanData, gudangData) {
  const role = (window.currentUser.role || '').toLowerCase();
  if (role === 'owner' || role === 'superuser') return true; // bypass total, SAMA seperti cekIzinMenu/cekFiturAkses
  const jpCocok = (() => {
    if (!jenisPekerjaanData || (Array.isArray(jenisPekerjaanData) && jenisPekerjaanData.length === 0)) return true;
    const jpAdmin = window.currentUser.jenis_pekerjaan;
    if (!jpAdmin) return true;
    return Array.isArray(jenisPekerjaanData) ? jenisPekerjaanData.includes(jpAdmin) : jenisPekerjaanData === jpAdmin;
  })();
  const gudangCocok = (() => {
    if (!gudangData || (Array.isArray(gudangData) && gudangData.length === 0)) return true;
    const gudangAdmin = window.normalisasiGudang(window.currentUser.gudang_penempatan);
    if (gudangAdmin.length === 0) return true;
    const gudangDataArr = Array.isArray(gudangData) ? gudangData : [gudangData];
    return gudangDataArr.some(g => gudangAdmin.includes(g));
  })();
  return jpCocok && gudangCocok;
};

// Dipertahankan sebagai alias singkat — dipakai di titik yang CUMA
// relevan dimensi jenis pekerjaan saja (misal Master Shift, tidak ada
// field gudang sama sekali).
window.bolehLihatJenisPekerjaan = function(jenisPekerjaanData) {
  return window.bolehLihatData(jenisPekerjaanData, null);
};
// ============================================================================


// Pesan error Firebase Auth diterjemahkan ke Bahasa Indonesia yang ramah pengguna
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

// Helper bersama (dipakai juga oleh dashboard.js): gudang_penempatan dulu string
// tunggal, sekarang array (mendukung banyak gudang). Ini menormalkan keduanya.
window.normalisasiGudang = function(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

// Helper bersama (dipakai vue-riwayat-absensi.js, vue-account-profile.js,
// vue-whatsapp-gateway.js untuk sorting berdasarkan waktu): field `waktu` di
// Firestore disimpan sebagai string locale Indonesia dari
// new Date().toLocaleString('id-ID'), formatnya "D/M/YYYY, HH.MM.SS" (titik
// sebagai pemisah jam, BUKAN titik dua) — new Date(waktuStr) tidak bisa parse
// ini secara langsung, jadi perlu di-parse manual di sini.
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

// Poin 1: cek apakah waktu sekarang masih dalam jam shift yang di-assign ke karyawan ini
window.cekMasihJamKerja = async function(namaShift) {
  if (!namaShift) return false; // tidak ada shift ter-assign -> tidak bisa dipastikan, wajib login ulang
  try {
    const qShift = await getDocs(collection(db, "master_shift"));
    let shiftData = null;
    qShift.forEach(s => { if (s.data().nama_shift === namaShift) shiftData = s.data(); });
    if (!shiftData || !shiftData.jam_masuk || !shiftData.jam_keluar) return false;

    const sekarang = new Date();
    const [jamMasukH, jamMasukM] = shiftData.jam_masuk.split(':').map(Number);
    const [jamKeluarH, jamKeluarM] = shiftData.jam_keluar.split(':').map(Number);

    const mulai = new Date(sekarang); mulai.setHours(jamMasukH, jamMasukM, 0, 0);
    let selesai = new Date(sekarang); selesai.setHours(jamKeluarH, jamKeluarM, 0, 0);
    if (selesai <= mulai) selesai.setDate(selesai.getDate() + 1); // shift lewat tengah malam

    return sekarang >= mulai && sekarang <= selesai;
  } catch (e) {
    console.error("Gagal cek jam kerja:", e);
    return false;
  }
};

// =========================================================================
// WHATSAPP GATEWAY (Fonnte lewat Google Apps Script sebagai perantara aman).
// Konfigurasi (URL Apps Script + kunci rahasia) disimpan di Firestore
// config/whatsapp_gateway, diatur lewat Menu Karyawan > WhatsApp Gateway.
// Token Fonnte sendiri TIDAK PERNAH ada di kode ini — disimpan di Apps Script.
// =========================================================================
window.kirimPesanWhatsapp = async function(nomor, pesan, jenis) {
  jenis = jenis || "Lainnya";
  let sukses = false;
  let keterangan = "";
  try {
    const configSnap = await getDoc(doc(db, "config", "whatsapp_gateway"));
    if (!configSnap.exists()) {
      keterangan = "Konfigurasi WhatsApp Gateway belum diatur.";
      console.warn(keterangan);
    } else {
      const cfg = configSnap.data();
      if (!cfg.webapp_url || !cfg.shared_secret) {
        keterangan = "URL Apps Script atau kunci rahasia belum diisi.";
        console.warn(keterangan);
      } else {
        // Menumpang di Apps Script project WA Gateway yang sudah ada (bot produksi) —
        // routing pakai query string ?modul=absensi sesuai hook yang sudah disiapkan
        // di doPost() mereka, supaya satu nomor/token bisa dipakai berdampingan.
        const urlDenganModul = cfg.webapp_url + (cfg.webapp_url.includes('?') ? '&' : '?') + 'modul=absensi';
        // Content-Type text/plain sengaja dipakai supaya browser tidak melakukan
        // CORS preflight (OPTIONS) yang tidak ditangani baik oleh Apps Script Web App.
        const resp = await fetch(urlDenganModul, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ secret: cfg.shared_secret, target: nomor, message: pesan })
        });
        const hasil = await resp.json();
        sukses = !!hasil.sukses;
        keterangan = hasil.pesan || (sukses ? "Terkirim." : "Gagal tanpa keterangan.");
      }
    }
  } catch (e) {
    console.error("Gagal kirim WhatsApp:", e);
    keterangan = e.message || "Error tidak diketahui.";
  }

  // Catat ke log untuk panel Monitoring Respon (best-effort, tidak menghambat alur utama)
  try {
    await addDoc(collection(db, "wa_log"), {
      waktu: new Date().toLocaleString('id-ID'),
      target: nomor,
      jenis: jenis,
      pesan: pesan,
      sukses: sukses,
      keterangan: keterangan
    });
  } catch (e) {
    console.error("Gagal mencatat log WA:", e);
  }

  return sukses;
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


// =========================================================================
// Poin 1: SESI OTOMATIS — kalau browser ditutup lalu dibuka lagi, dan sesi
// Firebase masih tersimpan, dan user masih dalam jam kerja shift-nya, dan
// sudah Clock In hari ini -> langsung ke Dashboard tanpa isi ulang email/
// password. Ini HANYA jalan sekali saat aplikasi pertama kali dimuat, bukan
// setiap kali status auth berubah (supaya tidak bentrok dengan proses login
// manual di js/vue-login.js).
// =========================================================================
let sesiOtomatisSudahDicek = false;
onAuthStateChanged(auth, async (user) => {
  // Jangan proses kalau: sudah pernah selesai diproses SEBELUMNYA dengan user
  // nyata, ATAU sedang ada proses login manual aktif (window.js/vue-login.js
  // yang urus, supaya tidak bentrok/dobel navigasi).
  if (sesiOtomatisSudahDicek || window._manualLoginInProgress || window._modeBuatPassword) return;

  if (!user || !user.email) {
    // PENTING: TIDAK mengunci di sini. Firebase kadang memanggil callback ini
    // dengan user=null SEMENTARA sebelum sesi tersimpan selesai dicek dari
    // penyimpanan lokal — kalau kita kunci di sini, sesi yang sebenarnya ada
    // tidak akan pernah diproses saat callback dipanggil ulang dengan user
    // yang benar. Layar loading tetap tampil untuk saat ini; kalau memang
    // tidak ada sesi tersimpan, callback ini tidak akan dipanggil lagi — jadi
    // kita beri sedikit toleransi lalu pindah ke layar Login sebagai fallback.
    setTimeout(() => {
      if (!sesiOtomatisSudahDicek && window.pindahLayar) window.pindahLayar('screen-login');
    }, 1200);
    return;
  }

  sesiOtomatisSudahDicek = true; // kunci HANYA setelah dapat user yang nyata
  let berhasilMasukDashboard = false;

  try {
    // Coba cache localStorage DULU (lihat window.bacaKonteksSesiDariCache
    // di atas) — cuma kalau kosong/beda akun baru baca Firestore biasa.
    const cache = window.bacaKonteksSesiDariCache(user.email);
    let d;
    if (cache) {
      d = cache.data;
      window.aksesConfigSaya = cache.aksesConfig;
    } else {
      const userSnap = await getDoc(doc(db, "users", user.email));
      if (!userSnap.exists()) return;
      d = userSnap.data();
    }

    if (d.status_approval && d.status_approval !== "APPROVED") return;

    const roleUser = (d.role || "operator").toLowerCase();
    const isOwnerRole = (roleUser === 'owner' || roleUser === 'superuser');
    const gudangUser = window.normalisasiGudang(d.gudang_penempatan);
    const statusKerjaUser = d.status_kerja || "Aktif";

    // BARU (19 Agt 2026) — SEBELUMNYA status_kerja cuma DISIMPAN di jalur
    // ini, TIDAK PERNAH DICEK — celah nyata: karyawan resign yang sesi
    // lamanya masih aktif (Firebase Auth persist) tinggal reload halaman
    // buat masuk lagi, sama sekali tidak lewat login manual yang sudah
    // ada penolakannya. Owner/Superuser TETAP dikecualikan (beda urusan
    // dari Clock In di bawah — ini soal hindari kunci-mati total kalau
    // field ini kebetulan salah/kosong di akun Owner sendiri).
    if (!isOwnerRole && statusKerjaUser !== "Aktif") return;

    // BARU (22 Agt 2026) — akun Kiosk: BERHENTI DI SINI, langsung ke
    // screen-absensi-qr, TIDAK PERNAH lewat gerbang gudang/Clock In/jam
    // kerja di bawah (kiosk bukan orang, tidak "clock in" buat dirinya
    // sendiri) — ini yang bikin "terkunci" di menu Absensi QR tercapai
    // di SETIAP refresh/reload otomatis (bukan cuma pas login manual
    // pertama kali, lihat blok serupa di vue-login.js). status_kerja
    // TETAP dicek di atas (baris sebelum ini) — "Nonaktifkan" dari
    // Device Kiosk TETAP berfungsi blokir login kiosk yang dinonaktifkan.
    if (d.jenis_akun === 'kiosk') {
      window.currentUser = { ...d, email: user.email, role: roleUser };
      if (!cache) await window.muatAksesConfigSaya(roleUser, d.profil_akses);
      window.simpanKonteksSesi();
      berhasilMasukDashboard = true;
      window.pindahLayar('screen-absensi-qr');
      return;
    }

    // DIUBAH (19 Agt 2026, permintaan Hilman) — SEBELUMNYA Owner/Superuser
    // dikecualikan total dari gudang/Clock In/jam kerja ("perannya
    // manajerial"). Sekarang WAJIB ikut alur SAMA PERSIS, tidak ada
    // pengecualian — konsisten dengan login manual (vue-login.js) yang
    // sudah diubah sama. PENTING: Owner WAJIB sudah ada gudang_penempatan
    // + nama_shift terisi di profilnya, kalau belum akan tertahan di
    // layar login terus (lihat catatan di vue-login.js).
    //
    // Clock In DIROMBAK — SEBELUMNYA cek localStorage 'zevanic_absen_'
    // (device-lokal, date-string), yang PERSIS kena bug shift-malam:
    // Clock In malam kemarin + sekarang sudah lewat tengah malam ->
    // "hari ini" versi kalender beda tanggal, walau masih di shift yang
    // sama. Sekarang pakai window.cekStatusClockInSaya() — sumber
    // kebenaran YANG SAMA dipakai tombol Home & login manual, tahan
    // shift-malam & lintas-device.
    if (gudangUser.length === 0) return;

    const statusClockIn = await window.cekStatusClockInSaya(user.email);
    if (!statusClockIn.aktif) return; // belum Clock In / sudah Clock Out -> tetap layar login

    const masihJamKerja = await window.cekMasihJamKerja(d.nama_shift);
    if (!masihJamKerja) return; // di luar jam kerja -> wajib login ulang

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
    // Kalau tadi TIDAK dari cache (fetch Firestore biasa), aksesConfigSaya
    // belum keisi sama sekali — baru di titik ini perlu dimuat. Kalau
    // SUDAH dari cache, sudah keisi dari cache.aksesConfig di atas, skip
    // (hemat 1 baca akses_config).
    if (!cache) await window.muatAksesConfigSaya(roleUser, d.profil_akses);
    window.simpanKonteksSesi(); // simpan/refresh cache buat reload berikutnya
    if (window.aturTampilanBerdasarkanRole) window.aturTampilanBerdasarkanRole();
    if (window.refreshAccountProfileDisplay) window.refreshAccountProfileDisplay();
    // Home itu layar landasan (langsung tampil begitu login, beda dari
    // layar admin yang baru mount saat dibuka) — jadi butuh refresh SEGERA
    // di sini juga, sama seperti Account Profile. Tanpa ini, Home sempat
    // baca window.currentUser SEBELUM terisi data asli (masih fallback
    // kosong/'operator'), bikin grup menu Master Absensi/Karyawan/WhatsApp
    // dianggap tidak berhak muncul walau yang login sebenarnya Owner.
    if (window.refreshHome) window.refreshHome();
    if (window.refreshHeaderMobile) window.refreshHeaderMobile();
    if (window.pindahLayar) window.pindahLayar('screen-dashboard');
    if (window.pindahTab) window.pindahTab('tab-home');
    berhasilMasukDashboard = true;
  } catch (e) {
    console.error("Gagal cek sesi otomatis:", e);
  } finally {
    // Semua jalur yang TIDAK berhasil masuk Dashboard (profil tak ditemukan,
    // belum di-approve, belum Clock In, di luar jam shift, error) berakhir di
    // sini — pindah dari layar loading ke layar Login.
    if (!berhasilMasukDashboard && window.pindahLayar) window.pindahLayar('screen-login');
  }
});

// Prefill email "Ingat Saya" + deteksi desktop (sembunyikan dropdown status)
// sudah dipindah ke onMounted() di js/vue-login.js.

window.bukaFormRegistrasi = function() {
  window.pindahLayar('screen-register');
  if (window.resetFormRegistrasi) window.resetFormRegistrasi();
};

// Registrasi karyawan baru (form, dropdown Kabupaten/Kecamatan, submit +
// rollback akun jika simpan profil gagal) sudah pindah ke
// js/vue-registrasi.js.


// LOGIN (prosesLogin, lanjutkanSetelahLogin) + Modal OTP sudah pindah ke
// js/vue-login.js. window.prosesClockOut TETAP di bawah sini (dipanggil
// dari Vue Account Profile).


// ============================================================================
// BARU (19 Agt 2026) — satu-satunya sumber kebenaran soal "apakah SAYA
// sedang Clock In dan belum Clock Out". Dipakai BARENG oleh vue-home.js
// (tentukan tombol Clock In/Out di Home), fungsi prosesClockOut di bawah,
// DAN vue-camera.js (submit Clock Out) — supaya ketiganya TIDAK BISA beda
// pendapat soal status orangnya.
//
// 2 BUG NYATA yang melatarbelakangi ini (dilaporkan Hilman 19 Agt 2026):
// 1. Shift malam (masuk 18:00, pulang besok 06:00) — logic LAMA cocokkan
//    localStorage['zevanic_absen_'+email] === tanggal HARI INI (string
//    persis). Begitu lewat tengah malam, tanggalnya beda walau orangnya
//    masih di shift yang SAMA belum selesai — salah baca status.
// 2. Karyawan nebeng HP (tidak punya HP sendiri) — localStorage itu
//    NEMPEL DI PERANGKAT, bukan ke akun. Ganti perangkat = localStorage
//    kosong = sistem kira "belum pernah Clock In" padahal aslinya sudah
//    (datanya ADA di Firestore, cuma tidak kebaca dari device yang beda).
//
// PRINSIP: localStorage cuma JALAN PINTAS (gratis, cepat) — begitu KOSONG
// atau meragukan, WAJIB tanya Firestore (sumber kebenaran), TIDAK BOLEH
// langsung disimpulkan "belum Clock In".
//
// Return: { aktif: bool, docId: string|null, formatLama: bool }
// - formatLama:true dipakai vue-camera.js buat tau harus BIKIN dokumen
//   CLOCK OUT terpisah (perilaku lama), BUKAN updateDoc ke dokumen
//   manapun — dokumen format lama TIDAK bisa digabung tanpa migrasi
//   paksa yang sudah kita hindari (lihat vue-camera.js).
window.cekStatusClockInSaya = async function(email) {
  // 1. Jalan pintas: localStorage device INI (gratis, tanpa baca Firestore)
  const docIdLokal = localStorage.getItem('zevanic_absensi_doc_id_' + email);
  if (docIdLokal) return { aktif: true, docId: docIdLokal, formatLama: false };

  // 2. Format BARU — tanya Firestore langsung (device baru/nebeng HP/cache
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

  // 3. Jaring pengaman FORMAT LAMA (masa transisi) — bandingkan waktu
  // Clock In vs Clock Out TERAKHIR. Kalau tidak bisa dipastikan dengan
  // aman (waktu_ts belum dimigrasi — lihat Riwayat All Absensi), JANGAN
  // blokir siapapun — anggap tidak aktif, lebih aman daripada memblokir
  // orang yang sebenarnya sedang tidak aktif.
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
  // Label diatur otomatis oleh vue-camera.js (modeLabel) — lihat catatan di vue-login.js.
  window.pindahLayar('screen-camera');
};

// Pengajuan Izin/Cuti/Lembur (form-nya) sudah pindah ke
// js/vue-account-profile.js. Variabel global (statusPilihanGlobal,
// tanggalIzinGlobal, keteranganIzinGlobal, lemburMulaiGlobal, dst) dan
// window.pindahLayar('screen-camera') TETAP dipakai — itu titik sambung ke
// alur kamera/geofencing yang belum dimigrasi. window.prosesClockOut TETAP
// di atas sini (dipanggil dari Vue).

// Lupa Password: pakai fitur bawaan Firebase Auth (kirim link reset ke email
// terdaftar). Tidak butuh WhatsApp/backend tambahan — ini paling aman & simpel.
window.lupaPassword = async function() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) {
    alert("Isi dulu email Anda di kolom Email/Akun Login di atas, baru klik \"Lupa Password?\".");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Link reset password sudah dikirim ke " + email + ". Cek inbox (atau folder Spam) email Anda.");
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
  document.getElementById('teks-nama-user').innerText = "Hi, " + window.currentUser.name;
  document.getElementById('label-role-sidebar').innerText = "Role: " + window.currentUser.role.toUpperCase();
  document.getElementById('label-badge-role').innerHTML = `<i class="far fa-clock mr-1.5"></i> ERP Portal - ${window.currentUser.role.toUpperCase()}`;

  const role = (window.currentUser.role || "operator").toLowerCase();

  const menuAdminAcc = document.getElementById('menu-admin-acc');
  const menuAdminAccBtn = document.getElementById('menu-admin-acc-btn');
  const menuSuperUser = document.getElementById('menu-superuser');
  const menuSuperUserBtn = document.getElementById('menu-superuser-btn');
  const menuKeuangan = document.getElementById('menu-keuangan');
  const menuKeuanganBtn = document.getElementById('menu-keuangan-btn');
  const menuWhatsapp = document.getElementById('menu-whatsapp');
  const menuWhatsappBtn = document.getElementById('menu-whatsapp-btn');
  const menuMailGatewayBtn = document.getElementById('menu-mail-gateway-btn');
  const navMobileAdmin = document.getElementById('nav-mobile-admin');
  const navMobileSuper = document.getElementById('nav-mobile-super');
  const navMobileWhatsapp = document.getElementById('nav-mobile-whatsapp');
  // Config Akses & Hak Akses SENGAJA dipisah dari gerbang owner+superuser di
  // atas — permintaan eksplisit: dua sub-menu ini khusus Owner saja, bahkan
  // Superuser (yang sebelumnya setara Owner untuk Master Karyawan lain)
  // tidak boleh mengaksesnya.
  const btnKonfigAkses = document.getElementById('btn-sub-karyawan-akses');
  const btnHakAkses = document.getElementById('btn-sub-karyawan-hakakses');
  const menuDeviceKioskBtn = document.getElementById('menu-device-kiosk-btn');
  // BARU (23 Agt 2026) — Zevanic House > Master Bahan & Aksesoris. Gerbang
  // role SAMA PERSIS dengan Master Absensi/Keuangan (isAdminLevel() di
  // firestore.rules: pic/admin/owner/superuser) — keputusan dikonfirmasi
  // Hilman lewat AskUserQuestion ("admin ke atas").
  const menuZevanicHouse = document.getElementById('menu-zevanic-house');
  const menuZevanicHouseBtn = document.getElementById('menu-zevanic-house-btn');

  [menuAdminAcc, menuAdminAccBtn, menuKeuangan, menuKeuanganBtn, menuSuperUser, menuSuperUserBtn, menuWhatsapp, menuWhatsappBtn, menuMailGatewayBtn, navMobileAdmin, navMobileSuper, navMobileWhatsapp, btnKonfigAkses, btnHakAkses, menuDeviceKioskBtn, menuZevanicHouse, menuZevanicHouseBtn].forEach(el => {
    if (el) el.classList.add('hidden');
  });

  // Master Keuangan (Antrean Reimburse + Kategori) SEJAJAR Master Absensi
  // (bukan anak di dalamnya) — dibuka Hilman 19 Agt 2026 karena PIC & Admin
  // Finance BEDA peran validasi (tahap 1 vs tahap 2), jadi menu-nya
  // ditampilkan ke role yang SAMA persis dengan Master Absensi.
  if (role === 'pic' || role === 'owner' || role === 'admin' || role === 'superuser') {
    if (menuAdminAcc) menuAdminAcc.classList.remove('hidden');
    if (menuAdminAccBtn) menuAdminAccBtn.classList.remove('hidden');
    if (menuKeuangan) menuKeuangan.classList.remove('hidden');
    if (menuKeuanganBtn) menuKeuanganBtn.classList.remove('hidden');
    if (menuZevanicHouse) menuZevanicHouse.classList.remove('hidden');
    if (menuZevanicHouseBtn) menuZevanicHouseBtn.classList.remove('hidden');
    if (navMobileAdmin) {
      navMobileAdmin.classList.remove('hidden');
      navMobileAdmin.classList.add('flex');
    }
  }

  if (role === 'owner' || role === 'superuser') {
    if (menuSuperUser) menuSuperUser.classList.remove('hidden');
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
    if (btnKonfigAkses) btnKonfigAkses.classList.remove('hidden');
    if (btnHakAkses) btnHakAkses.classList.remove('hidden');
    // Device Kiosk (22 Agt 2026) — "hanya owner saja", SENGAJA pola sama
    // persis Config Akses/Hak Akses (Superuser TIDAK ikut, beda dari
    // WhatsApp/Mail Gateway yang Superuser masih boleh).
    if (menuDeviceKioskBtn) menuDeviceKioskBtn.classList.remove('hidden');
  }
};
