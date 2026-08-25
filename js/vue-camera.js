// js/vue-camera.js
// ============================================================================
// Migrasi TERAKHIR & PALING SENSITIF: layar Kamera (selfie Hadir/Izin/Cuti/
// Lembur/Clock Out) + Geofencing GPS. Berbeda dari layar lain yang sudah
// dimigrasi — ini satu-satunya bagian yang bicara LANGSUNG dengan hardware
// (getUserMedia untuk kamera, navigator.geolocation untuk GPS), jadi dipakai
// pola Vue "template ref" untuk elemen <video>/<canvas> (akses DOM langsung,
// bukan lewat reactive binding — memang begitu caranya untuk MediaStream).
//
// Semua LOGIC (geofencing, kompresi foto, submit ke Firestore) direplikasi
// PERSIS SAMA dengan versi vanilla sebelumnya, termasuk desain "GPS di-cek
// ulang & ditunggu tepat saat submit" yang sudah pernah diperbaiki dari bug
// race condition sebelumnya.
//
// Jembatan ke vanilla: window.mulaiKamera() & window.matikanKamera()
// DIPERTAHANKAN sebagai fungsi global (dipanggil dari app.js pindahLayar
// setiap kali pindah layar) — tapi sekarang isinya memanggil method Vue ini.
//
// window.previewKTP / kompresGambar / window.ktpBase64Global TIDAK dipindah
// ke sini — itu tetap di js/camera.js karena masih dipakai Registrasi
// (fitur upload foto KTP, bukan bagian dari layar selfie ini).
//
// DIROMBAK (18 Agt 2026) — Clock In & Clock Out SEKARANG jadi 1 DOKUMEN
// per orang per hari (dulu 2 dokumen terpisah lewat addDoc() dua kali).
// Clock In bikin dokumen baru (field *_masuk) DAN simpan ID dokumen itu
// ke localStorage (zevanic_absensi_doc_id_{email}, pola SAMA seperti
// zevanic_jam_masuk_{email} yang sudah ada). Clock Out ambil ID itu dari
// localStorage lalu updateDoc() ke dokumen YANG SAMA (field *_keluar) —
// TIDAK PERLU baca Firestore sama sekali buat cari dokumennya kalau
// localStorage-nya ada. Kalau localStorage kosong (cache dibersihkan,
// device beda), fallback query 1x ke Firestore (email+tanggal+status).
//
// status_acc_masuk & status_acc_keluar SENGAJA field TERPISAH (bukan
// digabung 1 status_acc) — supaya PIC/Admin Finance bisa approve Clock In
// pagi & Clock Out sore sebagai 2 aksi independen di kartu yang sama,
// keputusan disepakati bareng Hilman 18 Agt 2026. ada_pending (boolean)
// jadi 1 field tambahan yang di-update tiap ada perubahan status —
// dipakai Antrean Absensi query where('ada_pending','==',true) LANGSUNG,
// tanpa perlu "OR antar-field" yang Firestore tidak bisa lakukan dengan
// hemat. Lihat STATUS-PROYEK.md buat penjelasan lengkap rancangan ini.
//
// IZIN/CUTI/LEMBUR TIDAK ikut dirombak — tetap 1 dokumen tunggal seperti
// sebelumnya (tidak ada pasangan "masuk/keluar" buat jenis pengajuan itu).
//
// DATA LAMA (dibuat sebelum perombakan ini, format 2-dokumen-terpisah)
// SENGAJA DIBIARKAN APA ADANYA — Antrean/Riwayat Absensi WAJIB tetap bisa
// baca kedua format sampai data lama itu naturally phase-out (approved/
// rejected, tidak pernah jadi dokumen baru lagi). Jangan migrasi paksa.
// ============================================================================
import { createApp, ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// BARU (23 Agt 2026, permintaan Hilman: PIN Kiosk 2x, yang KEDUA diminta
// SETELAH foto selfie diambil, tepat sebelum submit) — SAMA PERSIS dengan
// hashPin di vue-absensi-qr.js/vue-account-profile.js — disalin (bukan
// diimpor), pola yang sama dipakai di semua file lain yang butuh fungsi
// kecil ini.
async function hashPin(pin, email) {
  const data = new TextEncoder().encode(pin + '|' + email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const MAKS_PERCOBAAN_PIN_KIOSK = 3;

// Haversine: jarak antara 2 koordinat GPS dalam meter
function hitungJarakMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const AppKamera = {
  setup() {
    const videoEl = ref(null);
    const canvasEl = ref(null);
    const hasilFotoUrl = ref('');
    const sedangMemuatKamera = ref(true);
    const kameraError = ref('');
    const sudahAmbilFoto = ref(false);
    const mengirim = ref(false);
    const teksTombolKirim = ref('Kirim Pengajuan');

    // BARU (23 Agt 2026) — gerbang PIN kedua, KHUSUS mode Kiosk
    // (window.modeKioskAktif). Diminta SETELAH foto selfie diambil & tombol
    // Kirim ditekan, TEPAT SEBELUM data benar-benar ditulis ke Firestore —
    // sesuai klarifikasi Hilman: "kamera kebuka > PIN kedua > alert". PIN
    // dicocokkan ke window.currentUser.pin_hash (identitas KARYAWAN yang
    // di-scan, sudah dioverride vue-absensi-qr.js sebelum masuk sini —
    // BUKAN identitas asli Kiosk).
    const pinKioskDiminta = ref(false);
    const pinKioskInput = ref('');
    const pinKioskError = ref('');
    const percobaanPinKiosk = ref(0);
    const memverifikasiPinKiosk = ref(false);
    // BARU (23 Agt 2026, ronde 3, permintaan Hilman: kasih sesi loading
    // sambil nunggu, jangan langsung "diam" dulu sebelum kartu sukses
    // muncul) — true = PIN kedua SUDAH benar, lagi proses kirim ke
    // Firestore. Modal PIN (pinKioskDiminta) TETAP terbuka selama ini,
    // TAPI isinya ganti jadi spinner (lihat template), BUKAN langsung
    // ditutup — supaya tidak ada jeda "kosong" antara PIN benar & kartu
    // sukses/alert gagal muncul.
    const mengirimPinKiosk = ref(false);

    const modeLabel = ref('Mode: Hadir');
    const perluLokasi = ref(false);
    const daftarGudangUser = ref([]);
    const tampilkanPilihGudang = ref(false);
    const gudangDipilih = ref('');
    const statusLokasiHtml = ref('');

    let streamKamera = null;
    let koordinatGlobal = null;
    let statusRadiusGlobal = null;

    function tentukanPerluLokasi() {
      return (window.statusPilihanGlobal === "HADIR (CLOCK IN)" || window.statusPilihanGlobal === "CLOCK OUT" || window.statusPilihanGlobal === "LEMBUR (CLOCK IN)");
    }

    async function validasiRadiusGudang() {
      if (!koordinatGlobal) return;
      if (!gudangDipilih.value) {
        statusLokasiHtml.value = '<span class="tag neutral">Pilih gudang terlebih dahulu.</span>';
        return;
      }
      try {
        const qGudang = await getDocs(collection(db, "master_gudang"));
        let gudangData = null;
        qGudang.forEach(g => { if (g.data().nama_gudang === gudangDipilih.value) gudangData = g.data(); });

        if (!gudangData) {
          statusRadiusGlobal = null;
          statusLokasiHtml.value = '<span class="tag warn"><span class="tag-dot"></span>Data gudang tidak ditemukan. Hubungi Owner/PIC.</span>';
          return;
        }

        if (gudangData.tipe_lokasi === 'Dinamis') {
          statusRadiusGlobal = { dalamRadius: true, jarak: 0, radiusIzin: 0, gudang: gudangDipilih.value, dinamis: true };
          statusLokasiHtml.value = `<span class="tag blue"><span class="tag-dot"></span>Lokasi Dinamis (${gudangDipilih.value}) — tanpa validasi radius</span>`;
          return;
        }

        if (!gudangData.latitude || !gudangData.longitude) {
          statusRadiusGlobal = null;
          statusLokasiHtml.value = '<span class="tag warn"><span class="tag-dot"></span>Data lokasi gudang belum lengkap. Hubungi Owner/PIC.</span>';
          return;
        }

        const jarak = hitungJarakMeter(koordinatGlobal.lat, koordinatGlobal.lng, parseFloat(gudangData.latitude), parseFloat(gudangData.longitude));
        const radiusIzin = parseFloat(gudangData.radius) || 0;
        const dalamRadius = jarak <= radiusIzin;
        statusRadiusGlobal = { dalamRadius, jarak: Math.round(jarak), radiusIzin, gudang: gudangDipilih.value };

        statusLokasiHtml.value = dalamRadius
          ? `<span class="tag ok"><span class="tag-dot"></span>Dalam radius ${gudangDipilih.value} (\u00b1${Math.round(jarak)}m)</span>`
          : `<span class="tag danger"><span class="tag-dot"></span>Di luar radius ${gudangDipilih.value} (${Math.round(jarak)}m dari batas ${radiusIzin}m)</span>`;
      } catch (e) {
        console.error("Gagal validasi radius:", e);
        statusLokasiHtml.value = '<span class="tag danger">Gagal memeriksa lokasi gudang.</span>';
      }
    }

    function ambilLokasiGPS() {
      if (!navigator.geolocation) {
        statusLokasiHtml.value = '<span class="tag danger"><span class="tag-dot"></span>Perangkat/browser tidak mendukung GPS.</span>';
        return Promise.resolve(null);
      }
      statusLokasiHtml.value = '<span class="tag neutral"><i class="fas fa-spinner fa-spin" style="margin-right:5px;"></i>Mencari lokasi GPS...</span>';

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            koordinatGlobal = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
            await validasiRadiusGudang();
            resolve(koordinatGlobal);
          },
          (err) => {
            koordinatGlobal = null;
            statusRadiusGlobal = null;
            statusLokasiHtml.value = '<span class="tag danger"><span class="tag-dot"></span>Gagal mengambil lokasi. Aktifkan GPS & izinkan akses lokasi di browser.</span>';
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });
    }

    function pilihGudang(nama) {
      gudangDipilih.value = nama;
      ambilLokasiGPS();
    }

    async function mulaiKamera() {
      sedangMemuatKamera.value = true;
      kameraError.value = '';
      hasilFotoUrl.value = '';
      sudahAmbilFoto.value = false;
      teksTombolKirim.value = 'Kirim Pengajuan';
      pinKioskDiminta.value = false;
      pinKioskInput.value = '';
      pinKioskError.value = '';
      percobaanPinKiosk.value = 0;
      mengirimPinKiosk.value = false;

      modeLabel.value = "Mode: " + (window.statusPilihanGlobal || 'Hadir');
      perluLokasi.value = tentukanPerluLokasi();
      koordinatGlobal = null;
      gudangDipilih.value = '';
      statusRadiusGlobal = null;
      statusLokasiHtml.value = '';
      tampilkanPilihGudang.value = false;
      daftarGudangUser.value = [];

      if (perluLokasi.value) {
        const daftar = (window.currentUser && Array.isArray(window.currentUser.gudang_penempatan)) ? window.currentUser.gudang_penempatan : [];
        daftarGudangUser.value = daftar;
        if (daftar.length > 1) {
          gudangDipilih.value = daftar[0];
          tampilkanPilihGudang.value = true;
        } else if (daftar.length === 1) {
          gudangDipilih.value = daftar[0];
        }
      }

      try {
        streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (videoEl.value) videoEl.value.srcObject = streamKamera;
        sedangMemuatKamera.value = false;

        if (perluLokasi.value) ambilLokasiGPS();
      } catch (err) {
        kameraError.value = 'Gagal mengakses kamera.';
      }
    }

    function matikanKamera() {
      if (streamKamera) {
        streamKamera.getTracks().forEach(track => track.stop());
        streamKamera = null;
      }
    }

    function ambilFoto() {
      const video = videoEl.value;
      const canvas = canvasEl.value;
      canvas.width = 400;
      canvas.height = 400 * (video.videoHeight / video.videoWidth);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      hasilFotoUrl.value = canvas.toDataURL('image/jpeg', 0.7);
      sudahAmbilFoto.value = true;
    }

    function ulangiFoto() {
      hasilFotoUrl.value = '';
      sudahAmbilFoto.value = false;
    }

    // Ubah "HH:MM" jadi objek Date HARI INI jam segitu.
    function jamKeStringHariIni(strJam) {
      if (!strJam) return null;
      const [j, m] = strJam.split(':').map(Number);
      if (isNaN(j) || isNaN(m)) return null;
      const d = new Date();
      d.setHours(j, m, 0, 0);
      return d;
    }

    async function hitungJamKeluarUntukGaji() {
      const sekarang = new Date();
      try {
        // 1. Cari jam pulang jadwal shift karyawan ini.
        const namaShift = window.currentUser?.nama_shift;
        let batasAtas = null;
        if (namaShift) {
          const snapShift = await getDocs(collection(db, "master_shift"));
          snapShift.forEach(d => {
            const s = d.data();
            if (s.nama_shift === namaShift) batasAtas = jamKeStringHariIni(s.jam_keluar);
          });
        }
        // Tidak ketemu jadwal shift sama sekali -> tidak bisa membatasi
        // dengan aman, pakai jam Clock Out asli apa adanya (lebih aman
        // daripada menebak/salah potong jam kerja orang).
        if (!batasAtas) return sekarang.toLocaleString('id-ID');

        // 2. Cari pengajuan Lembur milik SAYA SENDIRI yang SUDAH di-ACC
        // untuk hari ini — kalau ada dan jam selesainya lebih lambat dari
        // jadwal shift, itu yang jadi batas baru (bukan shift lagi).
        const awalHariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate(), 0, 0, 0);
        const hariIni = sekarang.toLocaleDateString('id-ID');
        const qLembur = query(
          collection(db, "absensi"),
          where("email", "==", window.currentUser.email),
          where("status", "==", "LEMBUR (CLOCK IN)"),
          where("status_acc", "==", "ACC")
        );
        const snapLembur = await getDocs(qLembur);
        snapLembur.forEach(d => {
          const l = d.data();
          // Cocokkan tanggal pakai waktu_ts (Timestamp asli, andal) kalau
          // dokumennya SUDAH dimigrasi (lihat Riwayat All Absensi > alat
          // migrasi). Dokumen LAMA yang belum sempat dimigrasi masih
          // jatuh ke cara lama (cocokkan teks tanggal) sebagai fallback —
          // supaya proses gaji tetap jalan benar buat data lama juga,
          // tidak mendadak berhenti berfungsi cuma karena belum dimigrasi.
          let cocokHariIni;
          if (l.waktu_ts) {
            cocokHariIni = l.waktu_ts.toDate() >= awalHariIni;
          } else {
            cocokHariIni = (l.waktu || '').split(',')[0].trim() === hariIni;
          }
          if (!cocokHariIni) return;
          const selesaiLembur = jamKeStringHariIni(l.lembur_selesai);
          if (selesaiLembur && selesaiLembur > batasAtas) batasAtas = selesaiLembur;
        });

        // 3. Ambil yang LEBIH KECIL — jam asli Clock Out kalau belum
        // lewat batas, atau batas atasnya kalau sudah lewat.
        const jamDipakai = sekarang <= batasAtas ? sekarang : batasAtas;
        return jamDipakai.toLocaleString('id-ID');
      } catch (e) {
        console.error("Gagal hitung jam keluar untuk gaji, pakai jam asli:", e);
        return sekarang.toLocaleString('id-ID');
      }
    }


    // Kunci localStorage tempat ID dokumen Clock In disimpan — dibaca lagi
    // saat Clock Out supaya updateDoc() langsung tahu dokumen mana yang
    // dituju, TANPA perlu query cari dulu (gratis, bukan baca Firestore).
    function kunciDocIdAbsensi(email) { return 'zevanic_absensi_doc_id_' + email; }

    // CATATAN (19 Agt 2026) — fallback pencarian dokumen dulu ADA di sini
    // sendiri (cariDocIdHadirHariIni), tapi DIHAPUS — digantikan
    // window.cekStatusClockInSaya() di auth.js yang JAUH lebih lengkap
    // (nangani format lama JUGA, dan bekerja lintas device buat kasus
    // karyawan nebeng HP). Satu sumber kebenaran, bukan 2 fallback
    // terpisah yang bisa beda pendapat. Lihat catatan lengkap di auth.js.

    // Return: id dokumen (string) kalau berhasil, atau false kalau gagal —
    // BEDA dari sebelumnya yang cuma true/false, karena Clock In sekarang
    // WAJIB tahu ID dokumennya sendiri buat disimpan ke localStorage.
    async function simpanKeFirebase(fotoBase64) {
      const email = window.currentUser.email;
      const hariIni = new Date().toLocaleDateString('id-ID');
      const statusPilihan = window.statusPilihanGlobal;

      try {
        // ==================================================================
        // JALUR 1: HADIR (CLOCK IN) — bikin dokumen BARU, field ber-akhiran
        // _masuk. ada_pending:true karena status_acc_masuk baru "PENDING".
        // ==================================================================
        if (statusPilihan === "HADIR (CLOCK IN)") {
          // BARU (23 Agt 2026, bug ditemukan Hilman: bisa Clock In sampai
          // 7x) — jaring pengaman TERAKHIR tepat di titik TULIS (bukan
          // cuma andalkan badge/UI di Home & Login sudah benar). Apapun
          // penyebabnya di sisi UI (race condition, cache, tombol
          // kepencet dobel, dsb — lihat STATUS-PROYEK.md §19.5), di sini
          // dicek LANGSUNG ke sumber kebenaran (window.cekStatusClockInSaya)
          // SEBELUM benar-benar bikin dokumen Clock In baru. Kalau
          // ternyata SUDAH ada Clock In aktif punya orang ini, TOLAK di
          // sini — supaya TIDAK PERNAH ada 2 dokumen "sedang_aktif:true"
          // bersamaan untuk 1 karyawan.
          const statusCekDulu = await window.cekStatusClockInSaya(email);
          if (statusCekDulu.aktif) {
            // Sentinel KHUSUS (bukan `false` biasa) — supaya pemanggil
            // (di bawah, dekat "Gagal mengirim pengajuan...") tidak
            // menampilkan alert GENERIK "masalah izin akses/koneksi" di
            // ATAS alert spesifik ini (dobel alert membingungkan).
            //
            // DIPERBAIKI (23 Agt 2026, ditemukan Hilman) — SEBELUMNYA di
            // sini SELALU redirect ke screen-dashboard/tab-home, padahal
            // kalau ini dipicu dari mode Kiosk (window.modeKioskAktif),
            // window.currentUser lagi DI-TIMPA SEMENTARA jadi identitas
            // KARYAWAN yang di-scan (lihat vue-absensi-qr.js) — redirect
            // ke Dashboard biasa jadi SALAH ARAH (device Kiosk seharusnya
            // balik ke menu Absensi QR, bukan Dashboard karyawan siapapun
            // yang kebetulan sedang di-scan). Sekarang pola yang SAMA
            // dengan batalKamera() di bawah: mode Kiosk -> selesaiModeKiosk()
            // (pulihkan identitas Kiosk asli + balik ke screen-absensi-qr),
            // bukan Kiosk -> redirect Dashboard seperti semula.
            if (window.modeKioskAktif && window.selesaiModeKiosk) {
              alert("Karyawan ini SUDAH Clock In dan masih aktif (belum Clock Out). Tidak bisa Clock In dua kali. Kembali ke menu Kiosk...");
              window.selesaiModeKiosk();
            } else {
              alert("Anda SUDAH Clock In dan masih aktif (belum Clock Out). Tidak bisa Clock In dua kali. Mengalihkan ke Dashboard...");
              if (window.pindahLayar) window.pindahLayar('screen-dashboard');
              if (window.pindahTab) window.pindahTab('tab-home');
            }
            return 'SUDAH_CLOCK_IN';
          }

          const dataKirim = {
            nama_pegawai: window.currentUser.name,
            jenis_pekerjaan: window.currentUser.jenis_pekerjaan || '', // BARU (19 Agt 2026) - titip dari memori, hindari baca users terpisah
            hp: window.currentUser.hp || '',
            status_kerja: window.currentUser.status_kerja || '',
            // DIPERBAIKI (malam 24 Agt 2026, bug ditemukan Guru: "Shift"
            // di Antrean Absensi/Riwayat All Absensi tidak pernah tampil)
            // — root cause: field ini TIDAK PERNAH dititip ke dokumen
            // absensi sejak awal, padahal vue-antrean-absensi.js SUDAH
            // baca `data.shift`/`nama_shift` buat hitung Status Kehadiran
            // otomatis (19 Agt 2026) — jadi perhitungan itu diam-diam
            // SELALU gagal (jamShift tidak pernah ke-fetch). Titip di
            // sini, pola SAMA seperti jenis_pekerjaan/status_kerja di atas.
            nama_shift: window.currentUser.nama_shift || '',
            email, role: window.currentUser.role,
            status: "HADIR", // BUKAN "HADIR (CLOCK IN)" lagi — dokumen ini
                              // mewakili SELURUH hari (masuk+keluar), bukan
                              // cuma momen Clock In saja.
            tanggal: hariIni, // dipakai fallback cariDocIdHadirHariIni() di atas
            waktu_masuk: new Date().toLocaleString('id-ID'), // dipertahankan (tampilan) — rename dari "waktu"
            waktu_masuk_ts: serverTimestamp(),
            foto_selfie_masuk: fotoBase64,
            status_acc_masuk: "PENDING",
            seragam_masuk: "Sesuai",
            ada_pending: true,
            // BARU (19 Agt 2026) — dipakai window.cekStatusClockInSaya()
            // (auth.js) buat tau "masih ada Clock In aktif belum ditutup"
            // TANPA bergantung ke localStorage device — jadi kebaca benar
            // walau shift-nya nyebrang tengah malam ATAU dibuka dari HP
            // yang beda (nebeng). Diset false lagi pas Clock Out.
            sedang_aktif: true
          };
          if (perluLokasi.value) {
            dataKirim.gudang = gudangDipilih.value || "";
            if (koordinatGlobal) dataKirim.koordinat_masuk = { lat: koordinatGlobal.lat, lng: koordinatGlobal.lng };
            if (statusRadiusGlobal) {
              dataKirim.jarak_meter_masuk = statusRadiusGlobal.jarak;
              dataKirim.radius_izin_meter_masuk = statusRadiusGlobal.radiusIzin;
              dataKirim.status_radius_masuk = statusRadiusGlobal.dinamis
                ? "LOKASI DINAMIS"
                : (statusRadiusGlobal.dalamRadius ? "DALAM RADIUS" : "DI LUAR RADIUS");
            }
          }
          const docRef = await addDoc(collection(db, "absensi"), dataKirim);
          return docRef.id;
        }

        // ==================================================================
        // JALUR 2: CLOCK OUT — cek dulu status AKTIF-nya (window.
        // cekStatusClockInSaya di auth.js, bukan localStorage/tanggal
        // lagi — lihat catatan lengkap di sana). Dua kemungkinan:
        //   a) formatLama:false -> updateDoc() ke dokumen Clock In yang
        //      SAMA (field *_keluar), seperti sebelumnya.
        //   b) formatLama:true -> dokumen Clock In-nya masih pakai skema
        //      LAMA (dari sebelum 18 Agt 2026) — TIDAK bisa digabung
        //      tanpa migrasi paksa, jadi addDoc() dokumen CLOCK OUT
        //      TERPISAH persis seperti perilaku asli sebelum dirombak.
        // ==================================================================
        if (statusPilihan === "CLOCK OUT") {
          const status = await window.cekStatusClockInSaya(email);
          if (!status.aktif) {
            console.error("Tidak ketemu Clock In aktif buat di-Clock Out.");
            alert("Tidak ditemukan data Clock In yang aktif. Kalau Anda YAKIN sudah Clock In, hubungi Admin/Owner — jangan coba Clock In ulang.");
            return false;
          }

          if (status.formatLama) {
            // (b) Dokumen CLOCK OUT terpisah — skema PERSIS seperti
            // sebelum dirombak 18 Agt 2026 (dokumen Clock In lama ini
            // tetap apa adanya, tidak disentuh/diupdate sama sekali).
            const dataKirim = {
              nama_pegawai: window.currentUser.name,
              jenis_pekerjaan: window.currentUser.jenis_pekerjaan || '',
              hp: window.currentUser.hp || '',
              status_kerja: window.currentUser.status_kerja || '',
              nama_shift: window.currentUser.nama_shift || '', // lihat catatan di dataKirim format baru di atas
              email, role: window.currentUser.role,
              status: "CLOCK OUT",
              waktu: new Date().toLocaleString('id-ID'),
              waktu_ts: serverTimestamp(),
              foto_selfie: fotoBase64,
              persetujuan: "PENDING",
              status_acc: "PENDING",
              seragam: "Sesuai",
              jam_keluar_untuk_gaji: await hitungJamKeluarUntukGaji()
            };
            if (perluLokasi.value) {
              dataKirim.gudang = gudangDipilih.value || "";
              if (koordinatGlobal) dataKirim.koordinat = { lat: koordinatGlobal.lat, lng: koordinatGlobal.lng };
              if (statusRadiusGlobal) {
                dataKirim.jarak_meter = statusRadiusGlobal.jarak;
                dataKirim.radius_izin_meter = statusRadiusGlobal.radiusIzin;
                dataKirim.status_radius = statusRadiusGlobal.dinamis
                  ? "LOKASI DINAMIS"
                  : (statusRadiusGlobal.dalamRadius ? "DALAM RADIUS" : "DI LUAR RADIUS");
              }
            }
            const docRef = await addDoc(collection(db, "absensi"), dataKirim);
            return docRef.id;
          }

          // (a) Format BARU — updateDoc() ke dokumen yang sama.
          //
          // DIPERBAIKI (23 Agt 2026, bug ditemukan Hilman: discan ulang
          // beberapa menit setelah Clock Out, MASIH dianggap "sedang aktif
          // Clock In" jadi bisa Clock Out lagi) — SEBELUMNYA cuma nutup 1
          // dokumen (`status.docId`, dari cekStatusClockInSaya yang query-
          // nya `limit(1)`). Root cause SEBENARNYA: sebelum bug Clock In
          // dobel (§19.5) diperbaiki, SATU karyawan bisa ke-generate LEBIH
          // DARI 1 dokumen "sedang_aktif:true" sekaligus (tiap Clock In
          // dobel = dokumen baru). Clock Out lewat `limit(1)` cuma nutup
          // SATU dari dokumen-dokumen zombie itu — sisanya TETAP
          // "sedang_aktif:true" selamanya, jadi scan berikutnya (walau
          // beda waktu, bukan race sesaat) masih nemu dokumen LAIN yang
          // masih aktif -> dikira belum Clock Out. Sekarang query SEMUA
          // dokumen "sedang_aktif:true" milik email ini (bukan cuma 1) dan
          // TUTUP SEKALIGUS SEMUANYA di titik Clock Out mana pun terjadi —
          // supaya tidak mungkin ada zombie tersisa lagi ke depan, apapun
          // penyebab dokumen dobelnya (jaring pengaman, bukan cuma
          // mengandalkan data sudah bersih).
          const qSemuaAktif = query(
            collection(db, "absensi"),
            where("email", "==", email),
            where("status", "==", "HADIR"),
            where("sedang_aktif", "==", true)
          );
          const snapSemuaAktif = await getDocs(qSemuaAktif);
          const dataUpdate = {
            waktu_keluar: new Date().toLocaleString('id-ID'),
            waktu_keluar_ts: serverTimestamp(),
            foto_selfie_keluar: fotoBase64,
            status_acc_keluar: "PENDING",
            seragam_keluar: "Sesuai",
            ada_pending: true, // status_acc_keluar baru "PENDING" -> WAJIB true lagi
            sedang_aktif: false, // BARU — shift ini SELESAI, tutup dari pantauan cekStatusClockInSaya
            jam_keluar_untuk_gaji: await hitungJamKeluarUntukGaji()
          };
          if (perluLokasi.value) {
            if (koordinatGlobal) dataUpdate.koordinat_keluar = { lat: koordinatGlobal.lat, lng: koordinatGlobal.lng };
            if (statusRadiusGlobal) {
              dataUpdate.jarak_meter_keluar = statusRadiusGlobal.jarak;
              dataUpdate.radius_izin_meter_keluar = statusRadiusGlobal.radiusIzin;
              dataUpdate.status_radius_keluar = statusRadiusGlobal.dinamis
                ? "LOKASI DINAMIS"
                : (statusRadiusGlobal.dalamRadius ? "DALAM RADIUS" : "DI LUAR RADIUS");
            }
          }
          // Kalau karena SESUATU HAL query di atas kosong (harusnya tidak
          // mungkin, karena status.aktif sudah dipastikan true di atas —
          // ini cuma jaring pengaman ekstra), jatuh balik ke docId dari
          // cekStatusClockInSaya supaya tidak diam-diam gagal total.
          const docIdUtama = snapSemuaAktif.docs[0]?.id || status.docId;
          const semuaDocId = snapSemuaAktif.docs.length > 0 ? snapSemuaAktif.docs.map(d => d.id) : [docIdUtama];
          // DIPERBAIKI (23 Agt 2026, ronde 2 — dilaporkan Hilman: "sudah
          // Clock Out, tapi discan lagi malah diminta Clock Out lagi",
          // dikonfirmasi terjadi disertai alert "Gagal mengirim
          // pengajuan..." di akun Owner) — root cause KEMUNGKINAN BESAR:
          // dokumen zombie LAMA (sisa testing 7x Clock In sebelum §19.5
          // diperbaiki) bisa punya field `gudang` yang TIDAK termasuk
          // gudang Kiosk INI — Firestore Rules cuma izinkan Kiosk menulis
          // absensi buat gudang miliknya sendiri (§18.4 poin 9). SEBELUMNYA
          // pakai Promise.all — kalau SATU SAJA dokumen ditolak Rules
          // (gudang tidak cocok), SEMUANYA (termasuk dokumen shift yang
          // SEHARUSNYA berhasil ditutup Kiosk ini) ikut dianggap gagal —
          // Clock Out selalu gagal & orangnya kelihatan "aktif terus" di
          // scan berikutnya, TIDAK PERNAH bisa Clock In lagi lewat Kiosk
          // manapun. Sekarang pakai Promise.allSettled — tiap dokumen
          // ditutup SENDIRI-SENDIRI, dokumen yang MEMANG boleh ditutup
          // Kiosk ini tetap berhasil walau ada dokumen lain yang ditolak.
          // CATATAN: ini belum tentu 100% akar masalahnya (belum bisa
          // baca firestore.rules dari sesi ini) — kalau dokumen zombie
          // gudang-tidak-cocok itu MASIH ada setelah fix ini, Kiosk mana
          // pun TETAP tidak akan bisa menutupnya (itu keterbatasan Rules,
          // bukan bug kode) — solusinya orangnya WAJIB Clock Out sekali
          // lewat HP-nya SENDIRI (bukan Kiosk) buat membersihkan sisa
          // dokumen lama itu, baru Kiosk bisa dipakai normal lagi.
          const hasilTutup = await Promise.allSettled(semuaDocId.map(id => updateDoc(doc(db, "absensi", id), dataUpdate)));
          const jumlahBerhasil = hasilTutup.filter(h => h.status === 'fulfilled').length;
          const jumlahGagal = hasilTutup.length - jumlahBerhasil;
          if (jumlahGagal > 0) {
            console.error(
              `Clock Out: ${jumlahGagal} dari ${hasilTutup.length} dokumen absensi GAGAL ditutup ` +
              `(kemungkinan gudang dokumen lama tidak cocok dengan gudang Kiosk ini) — ${jumlahBerhasil} lainnya berhasil. Detail:`,
              hasilTutup.filter(h => h.status === 'rejected').map(h => h.reason?.message || h.reason)
            );
          }
          if (jumlahBerhasil === 0) {
            // Tidak ada SATU PUN yang berhasil ditutup — ini baru benar-
            // benar gagal total, lempar supaya catch di luar tampilkan
            // alert gagal seperti biasa (perilaku sebelumnya, TIDAK berubah
            // untuk kasus ini).
            throw hasilTutup[0].reason || new Error('Semua percobaan tutup dokumen Clock Out gagal.');
          }
          return docIdUtama;
        }

        // ==================================================================
        // JALUR 3: IZIN / CUTI / LEMBUR — TIDAK BERUBAH, tetap 1 dokumen
        // tunggal seperti sebelumnya (tidak ada pasangan masuk/keluar).
        // ==================================================================
        const dataKirim = {
          nama_pegawai: window.currentUser.name,
          jenis_pekerjaan: window.currentUser.jenis_pekerjaan || '',
          hp: window.currentUser.hp || '',
          status_kerja: window.currentUser.status_kerja || '',
          nama_shift: window.currentUser.nama_shift || '', // lihat catatan di dataKirim format baru di atas
          email, role: window.currentUser.role,
          status: statusPilihan,
          waktu: new Date().toLocaleString('id-ID'),
          waktu_ts: serverTimestamp(),
          foto_selfie: fotoBase64,
          persetujuan: "PENDING", // legacy, dipertahankan apa adanya (tidak dibaca di manapun)
          status_acc: "PENDING",
          seragam: "Sesuai"
        };
        if (statusPilihan === "IZIN" || statusPilihan === "CUTI") {
          dataKirim.tanggal_pengajuan = window.tanggalIzinGlobal;
          dataKirim.keterangan = window.keteranganIzinGlobal;
        }
        if (statusPilihan === "LEMBUR (CLOCK IN)") {
          dataKirim.lembur_mulai = window.lemburMulaiGlobal || "";
          dataKirim.lembur_selesai = window.lemburSelesaiGlobal || "";
          dataKirim.keterangan = window.lemburAlasanGlobal || "";
          dataKirim.lembur_instruksi = window.lemburInstruksiGlobal || "";
          if (perluLokasi.value) {
            dataKirim.gudang = gudangDipilih.value || "";
            if (koordinatGlobal) dataKirim.koordinat = { lat: koordinatGlobal.lat, lng: koordinatGlobal.lng };
            if (statusRadiusGlobal) {
              dataKirim.jarak_meter = statusRadiusGlobal.jarak;
              dataKirim.radius_izin_meter = statusRadiusGlobal.radiusIzin;
              dataKirim.status_radius = statusRadiusGlobal.dinamis
                ? "LOKASI DINAMIS"
                : (statusRadiusGlobal.dalamRadius ? "DALAM RADIUS" : "DI LUAR RADIUS");
            }
          }
        }
        const docRef = await addDoc(collection(db, "absensi"), dataKirim);
        return docRef.id;
      } catch (e) {
        console.error("Gagal simpan:", e);
        return false;
      }
    }

    async function kirimDataKeCloud() {
      if (perluLokasi.value) {
        if (!koordinatGlobal) {
          teksTombolKirim.value = 'Memeriksa lokasi GPS...';
          mengirim.value = true;
          await ambilLokasiGPS();
          mengirim.value = false;
          teksTombolKirim.value = 'Kirim Pengajuan';
        }
        if (!koordinatGlobal) {
          alert("Gagal mendapatkan lokasi GPS. Pastikan GPS & izin lokasi browser aktif (coba keluar dari area tertutup/beratap jika sinyal lemah), lalu coba lagi.");
          return;
        }
        if (statusRadiusGlobal && statusRadiusGlobal.dalamRadius === false) {
          alert(`Anda berada di luar radius gudang ${statusRadiusGlobal.gudang} (${statusRadiusGlobal.jarak}m dari batas ${statusRadiusGlobal.radiusIzin}m). Absensi tidak bisa dikirim.`);
          return;
        }
      }

      mengirim.value = true;
      teksTombolKirim.value = 'Mengirim...';

      const hasilId = await simpanKeFirebase(hasilFotoUrl.value);

      mengirim.value = false;
      teksTombolKirim.value = 'Kirim Pengajuan';

      // BARU (23 Agt 2026) — sentinel KHUSUS dari jaring pengaman Clock In
      // dobel (lihat simpanKeFirebase, JALUR 1) — alert-nya SUDAH
      // ditampilkan & sudah dialihkan ke Dashboard di sana, jadi di sini
      // CUKUP berhenti diam-diam, JANGAN tampilkan alert generik di bawah
      // (mencegah dobel alert yang membingungkan).
      if (hasilId === 'SUDAH_CLOCK_IN') {
        return;
      }

      // DIPERBAIKI (23 Agt 2026) — BUG LAMA baru ketahuan sekarang:
      // SEBELUMNYA kalau simpanKeFirebase() gagal (hasilId===false),
      // TIDAK ADA feedback apapun ke user — cuma diam saja, kelihatan
      // seperti "tidak ada respon" padahal sebenarnya GAGAL (biasanya
      // permission denied dari Firestore Rules). Sekarang kasih pesan
      // jelas, biar orangnya tahu harus hubungi Admin, bukan mengira
      // app-nya hang/rusak.
      if (!hasilId) {
        alert("Gagal mengirim pengajuan. Kemungkinan masalah izin akses atau koneksi — coba lagi, atau hubungi Admin/Owner kalau berulang.");
        return;
      }

      if (hasilId) {
        const hariIni = new Date().toLocaleDateString('id-ID');
        if (window.statusPilihanGlobal === "HADIR (CLOCK IN)") {
          localStorage.setItem('zevanic_absen_' + window.currentUser.email, hariIni);
          // Simpan JAM clock-in juga (bukan cuma tanggal) — dipakai Home
          // buat tampilkan "Clock in HH:MM - jam berjalan sekarang", cuma
          // baca localStorage, tidak nambah baca Firestore sama sekali.
          localStorage.setItem('zevanic_jam_masuk_' + window.currentUser.email, new Date().toISOString());
          // BARU (18 Agt 2026) — simpan ID dokumen juga, dibaca lagi saat
          // Clock Out supaya updateDoc() ke dokumen YANG SAMA (gabungan
          // masuk+keluar), lihat kunciDocIdAbsensi()/simpanKeFirebase().
          localStorage.setItem(kunciDocIdAbsensi(window.currentUser.email), hasilId);
        } else if (window.statusPilihanGlobal === "CLOCK OUT") {
          localStorage.setItem('zevanic_absen_' + window.currentUser.email, "OUT_" + hariIni);
          localStorage.removeItem('zevanic_jam_masuk_' + window.currentUser.email);
          localStorage.removeItem(kunciDocIdAbsensi(window.currentUser.email));
        }
        if (window.statusPilihanGlobal === "CLOCK OUT") {
          // BARU (23 Agt 2026) — mode Kiosk: SEBELUMNYA langsung panggil
          // selesaiModeKiosk() (reset diam-diam, TANPA feedback apapun
          // ke orang yang baru submit) — Hilman laporan "kirim pengajuan
          // tidak ada respon". Sekarang tampilkan kartu sukses dulu
          // (foto+nama+jam, otomatis tutup 3 detik) lewat
          // window.tampilkanSuksesKiosk() (vue-absensi-qr.js), BARU
          // reset ke menu — bukan langsung dari sini.
          if (window.modeKioskAktif && window.tampilkanSuksesKiosk) {
            window.tampilkanSuksesKiosk({ jenis: 'CLOCK OUT', foto: hasilFotoUrl.value });
          } else {
            alert("Clock Out berhasil! Hati-hati di jalan.");
            window.pindahLayar('screen-login');
          }
        } else {
          if (window.modeKioskAktif && window.tampilkanSuksesKiosk) {
            window.tampilkanSuksesKiosk({ jenis: window.statusPilihanGlobal, foto: hasilFotoUrl.value });
          } else {
            window.pindahLayar('screen-dashboard');
            window.pindahTab('tab-profil');
            if (window.bukaTabAbsensiProfile) window.bukaTabAbsensiProfile();
          }
        }
      }
    }

    // Dipanggil dari tombol "Kirim Pengajuan" — mode Kiosk WAJIB lewat
    // gerbang PIN kedua dulu (buka modal), mode biasa (karyawan submit
    // sendiri lewat HP-nya, sudah login Firebase Auth) langsung kirim
    // seperti sebelumnya, TIDAK berubah.
    function klikTombolKirim() {
      if (window.modeKioskAktif) {
        pinKioskInput.value = '';
        pinKioskError.value = '';
        percobaanPinKiosk.value = 0;
        pinKioskDiminta.value = true;
      } else {
        kirimDataKeCloud();
      }
    }

    function tambahDigitKiosk(n) {
      pinKioskError.value = '';
      if (pinKioskInput.value.length >= 6) return;
      pinKioskInput.value += String(n);
    }
    function hapusDigitKiosk() {
      pinKioskError.value = '';
      pinKioskInput.value = pinKioskInput.value.slice(0, -1);
    }
    function kosongkanPinKiosk() {
      pinKioskError.value = '';
      pinKioskInput.value = '';
    }
    function batalPinKiosk() {
      pinKioskDiminta.value = false;
      pinKioskInput.value = '';
      pinKioskError.value = '';
      mengirimPinKiosk.value = false;
    }

    async function verifikasiPinKiosk() {
      if (pinKioskInput.value.length !== 6) { pinKioskError.value = 'PIN wajib 6 digit.'; return; }
      if (!window.currentUser || !window.currentUser.pin_hash) {
        alert('Data PIN karyawan tidak ditemukan. Mengalihkan ke menu Kiosk...');
        pinKioskDiminta.value = false;
        batalKamera();
        return;
      }
      memverifikasiPinKiosk.value = true;
      try {
        // Salt = email KARYAWAN yang di-scan (window.currentUser sudah
        // dioverride vue-absensi-qr.js sebelum masuk screen-camera) —
        // PERSIS cara PIN pertama dicocokkan di vue-absensi-qr.js.
        const hashInput = await hashPin(pinKioskInput.value, window.currentUser.email);
        if (hashInput === window.currentUser.pin_hash) {
          pinKioskInput.value = ''; pinKioskError.value = ''; percobaanPinKiosk.value = 0;
          memverifikasiPinKiosk.value = false;
          // BARU (23 Agt 2026, ronde 3, permintaan Hilman) — JANGAN tutup
          // modal PIN dulu di sini — ganti isinya jadi spinner "Mengirim
          // Absensi..." (lihat template), supaya tidak ada jeda kosong
          // antara PIN benar & kartu sukses/alert gagal muncul. Modal
          // BARU benar-benar ditutup setelah kirimDataKeCloud() selesai
          // (baik sukses MAUPUN gagal — kalau sukses & mode Kiosk, layar
          // sudah keburu pindah ke screen-absensi-qr duluan lewat
          // tampilkanSuksesKiosk, jadi modal ini otomatis ikut hilang
          // dari pandangan; reset di bawah cuma jaga-jaga/tidak berefek
          // visual apapun di kasus itu).
          mengirimPinKiosk.value = true;
          await kirimDataKeCloud();
          mengirimPinKiosk.value = false;
          pinKioskDiminta.value = false;
          return;
        } else {
          percobaanPinKiosk.value++;
          if (percobaanPinKiosk.value >= MAKS_PERCOBAAN_PIN_KIOSK) {
            alert(`PIN salah ${MAKS_PERCOBAAN_PIN_KIOSK}x berturut-turut. Kembali ke menu Kiosk.`);
            pinKioskDiminta.value = false;
            batalKamera();
          } else {
            pinKioskError.value = `PIN salah. Sisa percobaan: ${MAKS_PERCOBAAN_PIN_KIOSK - percobaanPinKiosk.value}.`;
            pinKioskInput.value = '';
          }
        }
      } catch (e) {
        console.error('Gagal verifikasi PIN Kiosk (tahap kedua):', e);
        pinKioskError.value = 'Terjadi kesalahan sistem, coba lagi.';
      }
      memverifikasiPinKiosk.value = false;
    }

    function batalKamera() {
      matikanKamera();
      // Mode Kiosk: batal juga WAJIB balik ke menu Absensi Melalui QR,
      // BUKAN ke screen-dashboard (itu dashboard punya akun KIOSK,
      // bukan tempat yang relevan buat siapapun yang lagi discan).
      if (window.modeKioskAktif && window.selesaiModeKiosk) { window.selesaiModeKiosk(); return; }
      // Kembali ke layar sebelum masuk kamera — Login (kalau ini alur Login
      // pertama kali) atau Dashboard (kalau dari shortcut Home saat sudah
      // login). Dilacak otomatis oleh app.js pindahLayar, fallback ke
      // Dashboard kalau entah kenapa tidak ke-track.
      window.pindahLayar(window._layarSebelumKamera || 'screen-dashboard');
    }

    return {
      videoEl, canvasEl, hasilFotoUrl, sedangMemuatKamera, kameraError, sudahAmbilFoto,
      mengirim, teksTombolKirim, modeLabel, perluLokasi, daftarGudangUser,
      tampilkanPilihGudang, gudangDipilih, statusLokasiHtml,
      pinKioskDiminta, pinKioskInput, pinKioskError, memverifikasiPinKiosk, mengirimPinKiosk,
      pilihGudang, ambilFoto, ulangiFoto, kirimDataKeCloud, klikTombolKirim,
      tambahDigitKiosk, hapusDigitKiosk, kosongkanPinKiosk, batalPinKiosk, verifikasiPinKiosk,
      mulaiKamera, matikanKamera, batalKamera
    };
  },
  template: `
    <div class="gc-cam-wrap">
      <button @click="batalKamera" class="gc-cam-close" aria-label="Batal"><i class="fas fa-arrow-left"></i></button>
      <div class="gc-cam-top">
        <h2>Verifikasi wajah</h2>
        <p class="mode">{{ modeLabel }}</p>
      </div>

      <div v-if="tampilkanPilihGudang" class="gc-field" style="width:100%; max-width:300px; margin-top:10px;">
        <label>Pilih gudang</label>
        <select :value="gudangDipilih" @change="pilihGudang($event.target.value)">
          <option v-for="g in daftarGudangUser" :key="g" :value="g">{{ g }}</option>
        </select>
      </div>
      <div style="margin-top:8px;" v-html="statusLokasiHtml"></div>

      <div class="gc-cam-view">
        <video ref="videoEl" autoplay playsinline style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: sedangMemuatKamera || sudahAmbilFoto }"></video>
        <img v-if="sudahAmbilFoto" :src="hasilFotoUrl" style="width:100%; height:100%; object-fit:cover;">
        <canvas ref="canvasEl" class="hidden"></canvas>
        <div v-if="sedangMemuatKamera" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:16px; color:#C9B4A4;">
          <i class="fas fa-camera" style="font-size:44px; margin-bottom:10px;"></i>
          <span v-if="kameraError" style="color:#F2A0A0; font-size:12px;">{{ kameraError }}</span>
          <span v-else style="font-size:13px;">Meminta akses kamera...</span>
        </div>
        <div v-if="!sedangMemuatKamera && !sudahAmbilFoto" class="gc-cam-frame"></div>
      </div>

      <div style="width:100%; max-width:300px; margin-bottom:20px; display:flex; flex-direction:column; align-items:center; min-height:96px;">
        <button v-if="!sedangMemuatKamera && !sudahAmbilFoto" @click="ambilFoto" class="gc-cam-btn">
          <div class="gc-cam-btn-inner"></div>
        </button>
        <div v-if="sudahAmbilFoto" style="display:flex; gap:12px;">
          <button @click="ulangiFoto" class="btn-outline">Ulangi</button>
          <button @click="klikTombolKirim" :disabled="mengirim" class="btn-primary" style="display:flex; align-items:center;">
            {{ teksTombolKirim }} <i v-if="!mengirim" class="fas fa-check" style="margin-left:8px;"></i>
          </button>
        </div>
        <p class="gc-cam-caption">{{ sudahAmbilFoto ? '' : 'Ketuk tombol untuk foto' }}</p>
      </div>

      <!-- ============ GERBANG PIN KEDUA (mode Kiosk saja, BARU 23 Agt 2026)
           — muncul SETELAH foto diambil & Kirim ditekan, TEPAT SEBELUM
           data ditulis ke Firestore. ============ -->
      <div v-if="pinKioskDiminta" style="position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
        <div style="background:var(--surface); border-radius:20px; padding:26px 22px; max-width:320px; width:100%; text-align:center;">
          <!-- BARU (23 Agt 2026, ronde 3) — PIN benar, lagi kirim ke
               Firestore: modal TETAP terbuka, ganti isi jadi spinner
               (bukan langsung ditutup begitu saja) supaya tidak ada jeda
               "kosong" sebelum kartu sukses/alert gagal muncul. -->
          <template v-if="mengirimPinKiosk">
            <i class="fas fa-spinner fa-spin" style="font-size:30px; color:var(--burgundy); margin-bottom:14px; display:block;"></i>
            <h3 style="font-weight:700; font-size:14px; margin-bottom:4px;">Mengirim Absensi...</h3>
            <p style="font-size:11px; color:var(--text-muted);">Mohon tunggu sebentar</p>
          </template>
          <template v-else>
            <i class="fas fa-shield-halved" style="font-size:26px; color:var(--burgundy); margin-bottom:8px; display:block;"></i>
            <h3 style="font-weight:700; font-size:14px; margin-bottom:4px;">Konfirmasi Terakhir</h3>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:16px;">Masukkan PIN sekali lagi untuk mengirim absensi ini</p>

            <div style="display:flex; gap:10px; justify-content:center; margin-bottom:10px;">
              <span v-for="i in 6" :key="i" style="width:14px; height:14px; border-radius:50%; border:1.5px solid var(--burgundy); display:inline-block;"
                :style="{ background: pinKioskInput.length >= i ? 'var(--burgundy)' : 'transparent' }"></span>
            </div>
            <p v-if="pinKioskError" style="font-size:11px; color:var(--danger); font-weight:700; min-height:14px; margin-bottom:8px;">{{ pinKioskError }}</p>
            <p v-else style="min-height:14px; margin-bottom:8px;"></p>

            <div style="display:flex; gap:10px; width:100%; margin-bottom:16px;">
              <button @click="verifikasiPinKiosk" :disabled="memverifikasiPinKiosk || pinKioskInput.length !== 6" class="btn-primary" style="flex:1; padding:11px;">{{ memverifikasiPinKiosk ? '...' : 'Kirim' }}</button>
              <button @click="batalPinKiosk" class="btn-outline" style="flex:1; padding:11px;">Batal</button>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; width:100%;">
              <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n" @click="tambahDigitKiosk(n)"
                style="padding:14px 0; font-size:16px; font-weight:700; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:12px; cursor:pointer;">{{ n }}</button>
              <button @click="kosongkanPinKiosk" style="padding:14px 0; font-size:11px; font-weight:700; color:var(--text-faint); background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:12px; cursor:pointer;">Hapus</button>
              <button @click="tambahDigitKiosk(0)" style="padding:14px 0; font-size:16px; font-weight:700; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:12px; cursor:pointer;">0</button>
              <button @click="hapusDigitKiosk" style="padding:14px 0; font-size:15px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:12px; cursor:pointer;"><i class="fas fa-delete-left"></i></button>
            </div>
          </template>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-camera');
if (mountPoint) {
  const vm = createApp(AppKamera).mount('#vue-camera');
  // Jembatan ke vanilla: dipanggil dari app.js (pindahLayar) setiap kali
  // pindah layar ke/dari screen-camera.
  window.mulaiKamera = function() { vm.mulaiKamera(); };
  window.matikanKamera = function() { vm.matikanKamera(); };
}