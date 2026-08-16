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
// ============================================================================
import { createApp, ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

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

    async function simpanKeFirebase(fotoBase64) {
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
        if (perluLokasi.value) {
          dataKirim.gudang = gudangDipilih.value || "";
          if (koordinatGlobal) {
            dataKirim.koordinat = { lat: koordinatGlobal.lat, lng: koordinatGlobal.lng };
          }
          if (statusRadiusGlobal) {
            dataKirim.jarak_meter = statusRadiusGlobal.jarak;
            dataKirim.radius_izin_meter = statusRadiusGlobal.radiusIzin;
            dataKirim.status_radius = statusRadiusGlobal.dinamis
              ? "LOKASI DINAMIS"
              : (statusRadiusGlobal.dalamRadius ? "DALAM RADIUS" : "DI LUAR RADIUS");
          }
        }
        await addDoc(collection(db, "absensi"), dataKirim);
        return true;
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

      const berhasil = await simpanKeFirebase(hasilFotoUrl.value);

      mengirim.value = false;
      teksTombolKirim.value = 'Kirim Pengajuan';

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
          if (window.bukaTabAbsensiProfile) window.bukaTabAbsensiProfile();
        }
      }
    }

    return {
      videoEl, canvasEl, hasilFotoUrl, sedangMemuatKamera, kameraError, sudahAmbilFoto,
      mengirim, teksTombolKirim, modeLabel, perluLokasi, daftarGudangUser,
      tampilkanPilihGudang, gudangDipilih, statusLokasiHtml,
      pilihGudang, ambilFoto, ulangiFoto, kirimDataKeCloud,
      mulaiKamera, matikanKamera
    };
  },
  template: `
    <div class="gc-cam-wrap">
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
          <button @click="kirimDataKeCloud" :disabled="mengirim" class="btn-primary" style="display:flex; align-items:center;">
            {{ teksTombolKirim }} <i v-if="!mengirim" class="fas fa-check" style="margin-left:8px;"></i>
          </button>
        </div>
        <p class="gc-cam-caption">{{ sudahAmbilFoto ? '' : 'Ketuk tombol untuk foto' }}</p>
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
