// js/vue-absensi-qr.js
// Layar Absensi QR untuk HP Kiosk yang digantung di gudang (karyawan tanpa HP).
// Alur: menu jenis absen -> auto-scan QR -> PIN -> konfirmasi arah Clock
// In/Out -> delegasi ke screen-camera -> kartu sukses beberapa detik.
//
// Koleksi & field:
// - users: dicari lewat where(id_app == hasil scan), fallback doc(users/{email}).
//   Dipakai: pin_hash, gudang_penempatan, nama_shift, jenis_akun='kiosk'.
// - Tidak menulis absensi sendiri — penulisan dilakukan vue-camera.js.
//
// Jebakan:
// - hashPin di sini salinan persis dari vue-account-profile.js; beda satu
//   karakter pun hash tidak akan pernah cocok.
// - Gudang yang dioper ke kamera adalah IRISAN gudang karyawan dan gudang
//   kiosk — Rules cuma izinkan kiosk menulis absensi gudang miliknya sendiri.
// - window.currentUser dioverride sementara jadi karyawan terscan; identitas
//   kiosk disimpan di window._kioskUserAsli dan WAJIB dipulihkan lewat
//   window.selesaiModeKiosk (dipanggil balik dari vue-camera.js).
// - PIN diminta dua kali (identitas, lalu submit), maksimal 3 percobaan.

import { createApp, ref, onMounted, onBeforeUnmount } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";


// SAMA PERSIS dengan hashPin di vue-account-profile.js (Fase 1) — WAJIB identik,
// kalau beda dikit saja hasil hash tidak akan pernah cocok. Disalin (bukan
// diimpor) karena ini utilitas kecil berdiri sendiri, pola yang sama dipakai
// kompresGambarReimburse di vue-reimburse.js.
async function hashPin(pin, email) {
  const data = new TextEncoder().encode(pin + '|' + email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const MAKS_PERCOBAAN_PIN = 3;


const AppAbsensiQr = {
  setup() {
    // tahap: 'menu' -> 'scan' -> 'mencari' -> 'pin' (Fase 4) | balik 'menu'
    // kalau gagal
    const tahap = ref('menu');
    const jenisTerpilih = ref('');
    const karyawanTerscan = ref(null);
    const sisaDetik = ref(7);
    const pinInput = ref('');
    const pinError = ref('');
    const percobaanPin = ref(0);
    const memverifikasiPin = ref(false);
    const suksesInfo = ref(null); // { nama, shift, jenis, foto, waktu } — diisi window.tampilkanSuksesKiosk

    // Menu 4 tombol: Clock In & Clock Out digabung jadi 1 tombol "Clock In / Out".
    // Arah (Masuk/Keluar) ditentukan OTOMATIS setelah orangnya di-scan & PIN benar
    // (lihat lanjutKeKameraAsli, key 'ABSEN'), dihitung dari status terkini lewat
    // window.cekStatusClockInSaya — sumber kebenaran yang sama dipakai Home & Login.
    const JENIS_MENU = [
      { key: 'ABSEN', label: 'Clock In / Out', icon: 'fa-clock' },
      { key: 'LEMBUR (CLOCK IN)', label: 'Lembur', icon: 'fa-business-time' },
      { key: 'IZIN', label: 'Izin', icon: 'fa-file-signature' },
      { key: 'CUTI', label: 'Cuti', icon: 'fa-calendar-alt' },
    ];
    const PESAN_SUKSES = {
      'HADIR (CLOCK IN)': 'Berhasil Clock In!',
      'CLOCK OUT': 'Berhasil Clock Out!',
      'LEMBUR (CLOCK IN)': 'Pengajuan Lembur Terkirim!',
      'IZIN': 'Pengajuan Izin Terkirim!',
      'CUTI': 'Pengajuan Cuti Terkirim!',
    };
    // dipakai tahap 'konfirmasi' (PIN kedua) buat kasih tau dengan jelas
    // tindakan APA yang lagi dikonfirmasi. Terpisah dari PESAN_SUKSES (yang
    // bahasanya "sudah terjadi") karena di sini masih "akan terjadi".
    const LABEL_ARAH = {
      'HADIR (CLOCK IN)': { label: 'Clock In', icon: 'fa-right-to-bracket' },
      'CLOCK OUT': { label: 'Clock Out', icon: 'fa-right-from-bracket' },
      'LEMBUR (CLOCK IN)': { label: 'Lembur', icon: 'fa-business-time' },
      'IZIN': { label: 'Izin', icon: 'fa-file-signature' },
      'CUTI': { label: 'Cuti', icon: 'fa-calendar-alt' },
    };
    // Urutan PIN: PIN pertama cuma cek identitas + tentukan arah -> layar konfirmasi
    // cuma tampilkan badge arah -> kamera & foto -> PIN KEDUA diminta TEPAT SEBELUM
    // submit ke Firestore (di vue-camera.js, gerbang terakhir setelah foto ada).
    // arahAbsenTerkonfirmasi dikirim ke kamera lewat window.statusPilihanGlobal.
    const arahAbsenTerkonfirmasi = ref('');

    let streamKamera = null;
    let timeoutHabis = null;
    let intervalHitung = null;
    let rafId = null;
    let sudahKetemu = false; // guard — cegah loopScan & timeout jalan BARENGAN setelah QR ketemu

    function elVideo() { return document.getElementById('video-scan-qr'); }
    function elCanvas() { return document.getElementById('canvas-scan-qr'); }

    async function pilihJenis(key) {
      jenisTerpilih.value = key;
      tahap.value = 'scan';
      sudahKetemu = false;
      sisaDetik.value = 7;
      await mulaiScan();
    }

    async function mulaiScan() {
      try {
        streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      } catch (e) {
        console.error("Gagal akses kamera:", e);
        alert("Tidak bisa mengakses kamera depan. Pastikan izin kamera sudah diberikan ke browser ini.");
        kembaliKeMenu();
        return;
      }
      // Video element baru ADA di DOM setelah Vue render v-if="tahap==='scan'"
      // selesai — tunggu 1 tick biar elemen-nya sudah pasti muncul.
      await new Promise(resolve => setTimeout(resolve, 50));
      const video = elVideo();
      if (!video) { hentikanKamera(); return; }
      video.srcObject = streamKamera;
      await video.play();

      // Hitung mundur TAMPILAN (per detik, buat UI) — TERPISAH dari timeout
      // SEBENARNYA (di bawah), biar tidak meleset kalau ada jeda render antar
      // keduanya.
      intervalHitung = setInterval(() => {
        sisaDetik.value = Math.max(0, sisaDetik.value - 1);
      }, 1000);

      // Timeout SEBENARNYA — 7 detik pas, kamera WAJIB berhenti kalau QR belum
      // ketemu, balik ke menu (sesuai spesifikasi).
      timeoutHabis = setTimeout(() => {
        if (sudahKetemu) return; // sudah keduluan ketemu QR, abaikan timeout
        hentikanKamera();
        alert("QR tidak ditemukan dalam 7 detik. Coba lagi.");
        kembaliKeMenu();
      }, 7000);

      loopScan();
    }

    function loopScan() {
      if (sudahKetemu) return;
      const video = elVideo();
      const canvas = elCanvas();
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gambar = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const kode = window.jsQR ? window.jsQR(gambar.data, gambar.width, gambar.height) : null;
        if (kode && kode.data) {
          sudahKetemu = true;
          hentikanKamera();
          prosesHasilScan(kode.data);
          return;
        }
      }
      rafId = requestAnimationFrame(loopScan);
    }

    function hentikanKamera() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (timeoutHabis) { clearTimeout(timeoutHabis); timeoutHabis = null; }
      if (intervalHitung) { clearInterval(intervalHitung); intervalHitung = null; }
      if (streamKamera) {
        streamKamera.getTracks().forEach(track => track.stop());
        streamKamera = null;
      }
    }

    // Cari karyawan pemilik barcode — QR isinya id_app (prioritas) atau email
    // (fallback), format sama yang di-generate Account Profile. id_app dicoba dulu,
    // baru fallback anggap hasil scan itu email (email juga document ID users).
    async function prosesHasilScan(qrData) {
      tahap.value = 'mencari';
      try {
        let dataKaryawan = null;
        const qSnap = await getDocs(query(collection(db, "users"), where("id_app", "==", qrData)));
        if (!qSnap.empty) {
          dataKaryawan = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
        } else {
          const docSnap = await getDoc(doc(db, "users", qrData));
          if (docSnap.exists()) dataKaryawan = { id: docSnap.id, ...docSnap.data() };
        }

        if (!dataKaryawan) {
          alert("Barcode tidak dikenali — karyawan tidak ditemukan.");
          kembaliKeMenu();
          return;
        }

        karyawanTerscan.value = dataKaryawan;
        tahap.value = 'pin'; // Fase 4 yang bangun keypad PIN di tahap ini
      } catch (e) {
        console.error("Gagal cari data karyawan dari hasil scan:", e);
        // Penyebab umum: field jenis_akun='kiosk' belum terisi di dokumen users akun
        // Kiosk ini (dicek firestore.rules lewat isKiosk, bukan custom claim role),
        // atau gudang_penempatan-nya belum diisi lewat menu Device Kiosk.
        alert("Gagal mengambil data karyawan. Kemungkinan izin akses HP Kiosk belum diatur di sistem (Fase 5, menyusul).");
        kembaliKeMenu();
      }
    }

    // Setelah PIN benar: DELEGASI PENUH ke screen-camera (foto selfie, pilih gudang,
    // cek radius, tulis Firestore). window.currentUser dioverride sementara jadi
    // profil karyawan yang di-scan; identitas ASLI Kiosk disimpan di
    // window._kioskUserAsli dan dipulihkan lewat window.selesaiModeKiosk.
    async function lanjutKeKameraAsli() {
      const k = karyawanTerscan.value;
      window._kioskUserAsli = window.currentUser;
      // Gudang yang dioper ke kamera adalah IRISAN gudang karyawan dan gudang kiosk:
      // Firestore Rules cuma izinkan Kiosk menulis absensi untuk gudang miliknya
      // sendiri, jadi gudang karyawan apa adanya bisa bikin tulisan DITOLAK diam-diam
      // (kasus Owner yang gudang pertamanya beda dengan gudang kiosk).
      const gudangKaryawan = k.gudang_penempatan || [];
      const gudangKiosk = window._kioskUserAsli.gudang_penempatan || [];
      const gudangIrisan = gudangKaryawan.filter(g => gudangKiosk.includes(g));
      if (gudangIrisan.length === 0) {
        alert(`Karyawan "${k.nama || k.name}" tidak ditempatkan di gudang yang sama dengan Kiosk ini. Absensi tidak bisa diproses lewat Kiosk ini.`);
        // WAJIB reset balik ke menu, bukan cuma `return` — kalau tidak, layar
        // tertinggal diam di tahap 'konfirmasi'/'pin' tanpa jalan keluar.
        // Konsisten dengan jalur gagal lainnya.
        kembaliKeMenu();
        return;
      }
      // DIUBAH — arah Clock In/Out SEKARANG sudah ditentukan & ditampilkan
      // DULUAN di layar konfirmasi (PIN pertama), dipakai lagi di sini APA
      // ADANYA (BUKAN dihitung ulang) — supaya yang dieksekusi PASTI sama dengan
      // yang ditunjukkan ke orangnya sebelum PIN kedua.
      window.currentUser = { ...k, email: k.id, gudang_penempatan: gudangIrisan };
      window.statusPilihanGlobal = arahAbsenTerkonfirmasi.value;
      window.modeKioskAktif = true;
      window.pindahLayar('screen-camera');
    }

    // Dipanggil begitu PIN PERTAMA benar. Arah Clock In/Out ditentukan DI SINI,
    // tepat setelah identitas karyawan pasti, pakai window.cekStatusClockInSaya
    // (sumber kebenaran sama dengan Home/Login). Hasilnya tampil di layar konfirmasi.
    async function siapkanKonfirmasi() {
      const k = karyawanTerscan.value;
      let statusFinal = jenisTerpilih.value;
      if (statusFinal === 'ABSEN') {
        const statusKaryawan = await window.cekStatusClockInSaya(k.id);
        statusFinal = statusKaryawan.aktif ? 'CLOCK OUT' : 'HADIR (CLOCK IN)';
      }
      arahAbsenTerkonfirmasi.value = statusFinal;
      tahap.value = 'konfirmasi';
    }

    function kembaliKeMenu() {
      hentikanKamera();
      tahap.value = 'menu';
      jenisTerpilih.value = '';
      karyawanTerscan.value = null;
      pinInput.value = '';
      pinError.value = '';
      percobaanPin.value = 0;
      sudahKetemu = false;
      // Reset arah yang sempat ditentukan juga, supaya scan berikutnya SELALU
      // mulai bersih dari PIN pertama lagi.
      arahAbsenTerkonfirmasi.value = '';
    }
    // logoutKiosk WAJIB signOut sungguhan, bukan cuma pindahLayar('screen-login'):
    // kiosk yang terkunci (lihat auth.js) akan dilempar BALIK ke screen-absensi-qr
    // di refresh berikutnya selama sesi Firebase-nya masih aktif.
    async function logoutKiosk() {
      hentikanKamera();
      if (!confirm('Logout dari Device Kiosk ini?')) return;
      await signOut(auth);
      if (window.pindahLayar) window.pindahLayar('screen-login');
    }
    // Keypad PIN (Fase 4)
    function tambahDigit(n) {
      pinError.value = '';
      if (pinInput.value.length >= 6) return;
      pinInput.value += String(n);
    }
    function hapusDigit() {
      pinError.value = '';
      pinInput.value = pinInput.value.slice(0, -1);
    }
    function kosongkanPin() {
      pinError.value = '';
      pinInput.value = '';
    }

    async function verifikasiPin() {
      if (pinInput.value.length !== 6) { pinError.value = 'PIN wajib 6 digit.'; return; }
      const k = karyawanTerscan.value;
      if (!k || !k.pin_hash) {
        alert('Karyawan ini belum mengatur PIN di Profile > Keamanan. Absensi via QR tidak bisa dipakai sampai PIN diatur.');
        kembaliKeMenu();
        return;
      }
      memverifikasiPin.value = true;
      try {
        // Salt HARUS email pemilik PIN (k.id, document ID = email) — BUKAN sisi
        // HP Kiosk — persis cara hash dibuat pas dipasang di Profile.
        const hashInput = await hashPin(pinInput.value, k.id);
        if (hashInput === k.pin_hash) {
          pinInput.value = ''; pinError.value = ''; percobaanPin.value = 0;
          // PIN ini cuma memastikan identitas & menentukan arah — belum eksekusi apapun.
          // Lanjut ke layar konfirmasi (badge arah), lalu kamera. PIN KEDUA (gerbang
          // akhir) diminta di vue-camera.js tepat sebelum submit, setelah foto diambil.
          await siapkanKonfirmasi();
        } else {
          percobaanPin.value++;
          if (percobaanPin.value >= MAKS_PERCOBAAN_PIN) {
            alert(`PIN salah ${MAKS_PERCOBAAN_PIN}x berturut-turut. Kembali ke menu awal.`);
            kembaliKeMenu();
          } else {
            pinError.value = `PIN salah. Sisa percobaan: ${MAKS_PERCOBAAN_PIN - percobaanPin.value}.`;
            pinInput.value = '';
          }
        }
      } catch (e) {
        console.error('Gagal verifikasi PIN:', e);
        pinError.value = 'Terjadi kesalahan sistem, coba lagi.';
      }
      memverifikasiPin.value = false;
    }

    // Kalau komponen ke-unmount, pastikan kamera BENAR-BENAR mati supaya lampu
    // kamera tidak nyala terus. Jembatan ke vanilla: dipanggil dari vue-camera.js
    // saat proses mode Kiosk selesai (submit sukses atau Batal) — pulihkan identitas
    // asli Kiosk, reset komponen ini balik ke menu.
    onMounted(() => {
      // Reset MURNI (dipakai Batal/dibatalkan — TANPA kartu sukses, langsung
      // balik ke menu diam-diam, itu memang benar untuk kasus batal, beda dari
      // kasus BERHASIL di bawah).
      window.selesaiModeKiosk = function() {
        if (window._kioskUserAsli) {
          window.currentUser = window._kioskUserAsli;
          window._kioskUserAsli = null;
        }
        window.modeKioskAktif = false;
        kembaliKeMenu();
        window.pindahLayar('screen-absensi-qr');
      };

      // Dipanggil vue-camera.js setelah submit BERHASIL (bukan dibatalkan). Kartu
      // besar (foto+nama+shift+jenis+jam) tampil 3 detik sebelum reset ke menu, supaya
      // orang yang baru scan dapat konfirmasi dan yang mengantre tahu gilirannya.
      window.tampilkanSuksesKiosk = function({ jenis, foto }) {
        const k = karyawanTerscan.value;
        suksesInfo.value = {
          nama: k?.nama || k?.name || '-',
          shift: k?.nama_shift || '-',
          jenis,
          foto,
          waktu: new Date().toLocaleTimeString('id-ID')
        };
        tahap.value = 'sukses';
        // Ucapkan "Terima kasih" lewat text-to-speech browser, KHUSUS Clock In/Clock
        // Out (bukan Lembur/Izin/Cuti). Dibungkus try/catch + cek window.speechSynthesis
        // ada dulu, supaya perangkat tanpa dukungan suara tidak menggagalkan submit.
        if (jenis === 'HADIR (CLOCK IN)' || jenis === 'CLOCK OUT') {
          try {
            if (window.speechSynthesis) {
              window.speechSynthesis.cancel(); // hindari numpuk kalau ada ucapan sebelumnya belum selesai
              const ucapan = new SpeechSynthesisUtterance('Terima kasih');
              ucapan.lang = 'id-ID';
              window.speechSynthesis.speak(ucapan);
            }
          } catch (e) {
            console.error('Gagal memutar suara "Terima kasih":', e);
          }
        }
        // pindahLayar dipanggil SEKARANG JUGA, bukan menunggu 3 detik: kartu sukses ini
        // hidup di div 'screen-absensi-qr' yang masih hidden saat vue-camera.js memanggil
        // fungsi ini, jadi tahap 'sukses' tidak kelihatan kalau layarnya belum dipindah.
        // Sekaligus mematikan kamera (app.js pindahLayar panggil window.matikanKamera).
        window.pindahLayar('screen-absensi-qr');
        // DIUBAH — durasi tampil kartu sukses dari 3 detik jadi 7 detik.
        setTimeout(() => {
          suksesInfo.value = null;
          window.selesaiModeKiosk();
        }, 7000);
      };
    });

    onBeforeUnmount(() => { hentikanKamera(); });

    return {
      tahap, jenisTerpilih, karyawanTerscan, sisaDetik, JENIS_MENU, PESAN_SUKSES, LABEL_ARAH,
      arahAbsenTerkonfirmasi,
      pinInput, pinError, percobaanPin, memverifikasiPin, suksesInfo,
      pilihJenis, kembaliKeMenu, logoutKiosk, lanjutKeKameraAsli,
      tambahDigit, hapusDigit, kosongkanPin, verifikasiPin
    };
  },
  template: `
    <div style="min-height:100vh; display:flex; flex-direction:column; background:var(--ivory);">
      <div style="padding:16px 18px; display:flex; align-items:center; gap:14px; border-bottom:1px solid var(--line); background:var(--surface);">
        <div style="flex:1;">
          <h2 style="font-weight:700; font-size:15px; margin:0; color:var(--burgundy-dark);">Absensi Melalui QR</h2>
          <p style="font-size:10.5px; color:var(--text-muted); margin:1px 0 0;">Khusus HP Kiosk gudang</p>
        </div>
        <button @click="logoutKiosk" style="background:none; border:1.5px solid var(--line); border-radius:10px; padding:6px 12px; font-size:11px; color:var(--text-muted); cursor:pointer;"><i class="fas fa-right-from-bracket" style="margin-right:4px;"></i>Logout</button>
      </div>

      <!-- TAHAP: MENU (5 pilihan) -->
      <div v-if="tahap === 'menu'" style="flex:1; padding:28px 20px; display:flex; flex-direction:column; gap:12px; max-width:420px; margin:0 auto; width:100%;">
        <p style="font-size:12px; color:var(--text-muted); text-align:center; margin-bottom:10px;">Pilih jenis absensi, lalu arahkan kamera ke barcode karyawan.</p>
        <button v-for="m in JENIS_MENU" :key="m.key" @click="pilihJenis(m.key)"
          style="display:flex; align-items:center; gap:14px; padding:16px 18px; background:var(--surface); border:1.5px solid var(--line); border-radius:16px; cursor:pointer; text-align:left;">
          <span style="width:42px; height:42px; border-radius:12px; background:var(--pink); color:var(--burgundy); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas" :class="m.icon" style="font-size:16px;"></i></span>
          <span style="font-size:14px; font-weight:700; color:var(--text);">{{ m.label }}</span>
          <i class="fas fa-chevron-right" style="margin-left:auto; color:var(--text-faint); font-size:12px;"></i>
        </button>
      </div>

      <!-- TAHAP: SCAN (kamera sungguhan) -->
      <div v-else-if="tahap === 'scan'" style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:4px;">{{ JENIS_MENU.find(m => m.key === jenisTerpilih)?.label }}</h3>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:16px;">Arahkan barcode karyawan ke kamera</p>
        <div style="position:relative; width:260px; height:260px; border-radius:20px; overflow:hidden; border:3px solid var(--burgundy); background:#000;">
          <video id="video-scan-qr" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; transform:scaleX(-1);"></video>
          <canvas id="canvas-scan-qr" style="display:none;"></canvas>
          <div style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,.55); color:#fff; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700;">{{ sisaDetik }}s</div>
        </div>
        <button @click="kembaliKeMenu" class="btn-outline" style="margin-top:22px; padding:9px 20px;">Batal</button>
      </div>

      <!-- TAHAP: MENCARI (loading pas cek database) -->
      <div v-else-if="tahap === 'mencari'" style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px;">
        <i class="fas fa-spinner fa-spin" style="font-size:30px; color:var(--burgundy); margin-bottom:14px;"></i>
        <p style="font-size:12px; color:var(--text-muted);">Mencari data karyawan...</p>
      </div>

      <!-- TAHAP: PIN (keypad sungguhan) -->
      <div v-else-if="tahap === 'pin'" style="flex:1; display:flex; flex-direction:column; align-items:center; padding:24px 20px; text-align:center; max-width:340px; margin:0 auto; width:100%;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:2px;">{{ karyawanTerscan?.nama || karyawanTerscan?.name }}</h3>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:18px;">Masukkan PIN 6 digit</p>

        <!-- Titik progress PIN -->
        <div style="display:flex; gap:10px; margin-bottom:10px;">
          <span v-for="i in 6" :key="i" style="width:14px; height:14px; border-radius:50%; border:1.5px solid var(--burgundy);"
            :style="{ background: pinInput.length >= i ? 'var(--burgundy)' : 'transparent' }"></span>
        </div>
        <p v-if="pinError" style="font-size:11px; color:var(--danger); font-weight:700; min-height:14px; margin-bottom:8px;">{{ pinError }}</p>
        <p v-else style="min-height:14px; margin-bottom:8px;"></p>

        <!-- 2 tombol DI ATAS keypad, sesuai spesifikasi -->
        <div style="display:flex; gap:10px; width:100%; margin-bottom:18px;">
          <button @click="verifikasiPin" :disabled="memverifikasiPin || pinInput.length !== 6" class="btn-primary" style="flex:1; padding:11px;">{{ memverifikasiPin ? '...' : 'Enter' }}</button>
          <button @click="kembaliKeMenu" class="btn-outline" style="flex:1; padding:11px;">Kembali</button>
        </div>

        <!-- Keypad angka -->
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; width:100%;">
          <button v-for="n in [1,2,3,4,5,6,7,8,9]" :key="n" @click="tambahDigit(n)"
            style="padding:16px 0; font-size:18px; font-weight:700; background:var(--surface); border:1.5px solid var(--line); border-radius:14px; cursor:pointer;">{{ n }}</button>
          <button @click="kosongkanPin" style="padding:16px 0; font-size:12px; font-weight:700; color:var(--text-faint); background:var(--surface); border:1.5px solid var(--line); border-radius:14px; cursor:pointer;">Hapus</button>
          <button @click="tambahDigit(0)" style="padding:16px 0; font-size:18px; font-weight:700; background:var(--surface); border:1.5px solid var(--line); border-radius:14px; cursor:pointer;">0</button>
          <button @click="hapusDigit" style="padding:16px 0; font-size:16px; background:var(--surface); border:1.5px solid var(--line); border-radius:14px; cursor:pointer;"><i class="fas fa-delete-left"></i></button>
        </div>
      </div>

      <!-- TAHAP: KONFIRMASI -->
      <div v-else-if="tahap === 'konfirmasi'" style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px 20px; text-align:center; max-width:340px; margin:0 auto; width:100%;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;">{{ karyawanTerscan?.nama || karyawanTerscan?.name }}</h3>
        <div style="display:inline-flex; align-items:center; gap:6px; background:var(--pink); color:var(--burgundy); border-radius:20px; padding:7px 16px; font-size:13px; font-weight:700; margin:10px 0 16px;">
          <i class="fas" :class="LABEL_ARAH[arahAbsenTerkonfirmasi]?.icon"></i>
          {{ LABEL_ARAH[arahAbsenTerkonfirmasi]?.label }}
        </div>
        <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:26px;">Kamera akan dibuka untuk foto selfie. PIN akan diminta sekali lagi sebagai konfirmasi akhir sebelum absensi dikirim.</p>
        <div style="display:flex; gap:10px; width:100%;">
          <button @click="lanjutKeKameraAsli" class="btn-primary" style="flex:1; padding:13px;">Lanjut ke Kamera</button>
          <button @click="kembaliKeMenu" class="btn-outline" style="flex:1; padding:13px;">Batal</button>
        </div>
      </div>

      <!-- TAHAP: SUKSES (kartu besar "epic", auto-tutup 7 detik) -->
      <div v-else-if="tahap === 'sukses' && suksesInfo" style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; text-align:center; background:var(--ivory);">
        <!--
          animasi gxPop murni dekoratif ditambahkan ke kartu "epic" ini — ukuran/isi/durasi 7
          detik TIDAK disentuh sama sekali .
        -->
        <div style="background:var(--surface); border-radius:28px; padding:40px 32px; max-width:460px; width:100%; box-shadow:0 16px 40px rgba(0,0,0,.14); animation:gxPop .3s ease;">
          <i class="fas fa-circle-check" style="font-size:46px; color:var(--ok); margin-bottom:12px; display:block;"></i>
          <h2 style="font-weight:700; font-size:22px; margin-bottom:6px; color:var(--burgundy-dark);">Selamat, {{ suksesInfo.nama }}!</h2>
          <p style="font-size:15px; color:var(--ok); font-weight:700; margin-bottom:24px;">{{ PESAN_SUKSES[suksesInfo.jenis] }}</p>
          <!--
            2x LIPAT — dari 172x172 bingkai ganda jadi 344x344, bingkainya ikut disesuaikan (bukan
            sekadar 2x mentah, supaya tetap enak dilihat).
          -->
          <img v-if="suksesInfo.foto" :src="suksesInfo.foto" style="width:344px; height:344px; max-width:100%; border-radius:50%; object-fit:cover; margin-bottom:22px; border:6px solid var(--pink); box-shadow:0 0 0 6px var(--burgundy), 0 14px 30px rgba(0,0,0,.2);">
          <div style="text-align:left; background:var(--ivory-dim); border-radius:16px; padding:16px 18px; font-size:14px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="color:var(--text-muted);">Shift</span><b>{{ suksesInfo.shift }}</b></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted);">Jam</span><b>{{ suksesInfo.waktu }}</b></div>
          </div>
        </div>
        <p style="font-size:11px; color:var(--text-faint); margin-top:18px;">Kembali ke menu dalam beberapa detik, silakan giliran berikutnya...</p>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-absensi-qr');
if (mountPoint) createApp(AppAbsensiQr).mount('#vue-absensi-qr');