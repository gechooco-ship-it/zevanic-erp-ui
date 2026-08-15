// js/camera.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

let streamKamera = null;
window.ktpBase64Global = "";

// Poin 7 (Geofencing): state lokasi & gudang yang dipilih saat clock-in/clock-out
window.koordinatGlobal = null;       // { lat, lng, accuracy }
window.gudangDipilihGlobal = "";     // nama gudang yang dipilih/aktif
window.statusRadiusGlobal = null;    // { dalamRadius, jarak, radiusIzin, gudang }

// Kompresi gambar sisi klien: perkecil dimensi & kualitas JPEG supaya ukuran
// file kecil (penting: Firestore punya batas 1MB per dokumen — foto asli dari
// kamera HP bisa 3-8MB kalau tidak dikompres, bisa bikin simpan data gagal).
function kompresGambar(file, maxDimensi, kualitas) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let { width, height } = img;
        if (width > maxDimensi || height > maxDimensi) {
          if (width > height) {
            height = Math.round(height * (maxDimensi / width));
            width = maxDimensi;
          } else {
            width = Math.round(width * (maxDimensi / height));
            height = maxDimensi;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', kualitas));
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

window.previewKTP = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const img = document.getElementById('preview-ktp-img');
  kompresGambar(file, 1000, 0.75).then(dataUrl => {
    window.ktpBase64Global = dataUrl;
    img.src = dataUrl;
    img.classList.remove('hidden');
  }).catch(err => {
    console.error("Gagal kompres foto KTP:", err);
    alert("Gagal memproses foto KTP. Coba ambil/pilih foto lain.");
  });
};

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

window.validasiRadiusGudang = async function() {
  const statusEl = document.getElementById('status-lokasi-kamera');
  if (!window.koordinatGlobal) return;
  if (!window.gudangDipilihGlobal) {
    if (statusEl) statusEl.innerHTML = '<span class="text-gray-300 text-xs">Pilih gudang terlebih dahulu.</span>';
    return;
  }

  try {
    const qGudang = await getDocs(collection(db, "master_gudang"));
    let gudangData = null;
    qGudang.forEach(g => { if (g.data().nama_gudang === window.gudangDipilihGlobal) gudangData = g.data(); });

    if (!gudangData) {
      window.statusRadiusGlobal = null;
      if (statusEl) statusEl.innerHTML = '<span class="text-amber-400 text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>Data gudang tidak ditemukan. Hubungi Owner/PIC.</span>';
      return;
    }

    // Lokasi Dinamis (orang lapangan): tidak ada titik/radius pasti, lokasi
    // dicatat apa adanya untuk arsip tanpa divalidasi jaraknya.
    if (gudangData.tipe_lokasi === 'Dinamis') {
      window.statusRadiusGlobal = { dalamRadius: true, jarak: 0, radiusIzin: 0, gudang: window.gudangDipilihGlobal, dinamis: true };
      if (statusEl) statusEl.innerHTML = `<span class="text-blue-400 text-xs"><i class="fas fa-map-marked-alt mr-1"></i>Lokasi Dinamis (${window.gudangDipilihGlobal}) — tanpa validasi radius</span>`;
      return;
    }

    if (!gudangData.latitude || !gudangData.longitude) {
      window.statusRadiusGlobal = null;
      if (statusEl) statusEl.innerHTML = '<span class="text-amber-400 text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>Data lokasi gudang belum lengkap. Hubungi Owner/PIC.</span>';
      return;
    }

    const jarak = hitungJarakMeter(
      window.koordinatGlobal.lat, window.koordinatGlobal.lng,
      parseFloat(gudangData.latitude), parseFloat(gudangData.longitude)
    );
    const radiusIzin = parseFloat(gudangData.radius) || 0;
    const dalamRadius = jarak <= radiusIzin;

    window.statusRadiusGlobal = { dalamRadius, jarak: Math.round(jarak), radiusIzin, gudang: window.gudangDipilihGlobal };

    if (statusEl) {
      statusEl.innerHTML = dalamRadius
        ? `<span class="text-green-400 text-xs"><i class="fas fa-check-circle mr-1"></i>Dalam radius ${window.gudangDipilihGlobal} (\u00b1${Math.round(jarak)}m)</span>`
        : `<span class="text-red-400 text-xs"><i class="fas fa-times-circle mr-1"></i>Di luar radius ${window.gudangDipilihGlobal} (${Math.round(jarak)}m dari batas ${radiusIzin}m)</span>`;
    }
  } catch (e) {
    console.error("Gagal validasi radius:", e);
    if (statusEl) statusEl.innerHTML = '<span class="text-red-400 text-xs">Gagal memeriksa lokasi gudang.</span>';
  }
};

// Poin 7 (Geofencing) — didesain ulang jadi Promise supaya bisa DITUNGGU dengan
// andal, khususnya saat tombol "Kirim Pengajuan" ditekan. Sebelumnya GPS dicek
// di background sambil kamera dibuka dan tombol jepret dikunci sampai lokasi
// terverifikasi — ini rawan race condition (GPS lambat/gagal indoor bikin macet
// atau status jadi tidak sinkron). Sekarang: kamera SELALU bisa dipakai kapan
// saja, dan GPS di-cek ulang secara aktif (di-await) tepat sebelum data dikirim.
window.ambilLokasiGPS = function() {
  const statusEl = document.getElementById('status-lokasi-kamera');
  if (!navigator.geolocation) {
    if (statusEl) statusEl.innerHTML = '<span class="text-red-400 text-xs"><i class="fas fa-exclamation-triangle mr-1"></i>Perangkat/browser tidak mendukung GPS.</span>';
    return Promise.resolve(null);
  }
  if (statusEl) statusEl.innerHTML = '<span class="text-gray-300 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i>Mencari lokasi GPS...</span>';

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const koor = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        window.koordinatGlobal = koor;
        await window.validasiRadiusGudang();
        resolve(koor);
      },
      (err) => {
        window.koordinatGlobal = null;
        window.statusRadiusGlobal = null;
        if (statusEl) statusEl.innerHTML = '<span class="text-red-400 text-xs"><i class="fas fa-map-marker-alt mr-1"></i>Gagal mengambil lokasi. Aktifkan GPS & izinkan akses lokasi di browser.</span>';
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
};

window.mulaiKamera = async function() {
    const video = document.getElementById('kamera-feed');
    const pesan = document.getElementById('pesan-kamera');
    const btnJepret = document.getElementById('btn-jepret');
    const hasilFoto = document.getElementById('hasil-foto');
    const grupBtnLanjut = document.getElementById('grup-btn-lanjut');
    const wadahGudang = document.getElementById('wadah-pilih-gudang');
    const selectGudang = document.getElementById('pilih-gudang-kamera');
    const statusLokasi = document.getElementById('status-lokasi-kamera');

    video.classList.add('hidden');
    hasilFoto.classList.add('hidden');
    grupBtnLanjut.classList.add('hidden');
    pesan.classList.remove('hidden');
    btnJepret.classList.add('hidden');
    btnJepret.disabled = false;
    btnJepret.classList.remove('opacity-40', 'cursor-not-allowed');

    // Poin 7: geofencing hanya berlaku untuk Clock In & Clock Out (bukan Izin/Cuti)
    const perluLokasi = (window.statusPilihanGlobal === "HADIR (CLOCK IN)" || window.statusPilihanGlobal === "CLOCK OUT");
    window.koordinatGlobal = null;
    window.gudangDipilihGlobal = "";
    window.statusRadiusGlobal = null;
    if (wadahGudang) wadahGudang.classList.add('hidden');
    if (statusLokasi) statusLokasi.innerHTML = '';

    if (perluLokasi) {
      const daftarGudang = (window.currentUser && Array.isArray(window.currentUser.gudang_penempatan)) ? window.currentUser.gudang_penempatan : [];
      if (daftarGudang.length > 1 && wadahGudang && selectGudang) {
        selectGudang.innerHTML = daftarGudang.map(g => `<option value="${g}">${g}</option>`).join('');
        window.gudangDipilihGlobal = daftarGudang[0];
        wadahGudang.classList.remove('hidden');
      } else if (daftarGudang.length === 1) {
        window.gudangDipilihGlobal = daftarGudang[0];
      }
    }

    try {
        streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        video.srcObject = streamKamera;
        video.classList.remove('hidden');
        pesan.classList.add('hidden');
        btnJepret.classList.remove('hidden');

        // Panaskan GPS di background supaya lebih cepat pas nanti dicek ulang
        // saat submit — TIDAK mengunci tombol jepret sama sekali (kamera bisa
        // dipakai kapan saja, terlepas dari status GPS).
        if (perluLokasi) {
          window.ambilLokasiGPS();
        }
    } catch (err) {
        pesan.innerHTML = '<span class="text-red-400 text-xs">Gagal mengakses kamera.</span>';
    }
};

window.matikanKamera = function() {
    if (streamKamera) {
        streamKamera.getTracks().forEach(track => track.stop());
        streamKamera = null;
    }
};

window.ambilFoto = function() {
    const video = document.getElementById('kamera-feed');
    const canvas = document.getElementById('canvas-foto');
    const hasilFoto = document.getElementById('hasil-foto');
    
    canvas.width = 400;
    canvas.height = 400 * (video.videoHeight / video.videoWidth);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    hasilFoto.src = dataUrl;
    
    hasilFoto.classList.remove('hidden');
    video.classList.add('hidden');
    document.getElementById('frame-wajah').classList.add('hidden');
    document.getElementById('btn-jepret').classList.add('hidden');
    document.getElementById('grup-btn-lanjut').classList.remove('hidden');
};

window.ulangiFoto = function() {
    document.getElementById('hasil-foto').classList.add('hidden');
    document.getElementById('kamera-feed').classList.remove('hidden');
    document.getElementById('frame-wajah').classList.remove('hidden');
    document.getElementById('grup-btn-lanjut').classList.add('hidden');
    document.getElementById('btn-jepret').classList.remove('hidden');
};
