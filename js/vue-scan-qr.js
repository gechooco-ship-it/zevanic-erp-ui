// js/vue-scan-qr.js
// ============================================================================
// Nav "Scan QR" — pemindai QR SUNGGUHAN pakai kamera (bukan cuma tampilan
// kosong). Pakai library jsQR (CDN, ringan, khusus baca pola QR dari data
// gambar) untuk mendeteksi kode dari feed kamera secara langsung.
//
// PENTING soal batas fitur ini: alur "scan SPK/produk/bahan/qty untuk
// perpindahan data produksi" yang direncanakan (lihat percakapan awal
// proyek ini) BELUM ADA logic pemrosesan datanya di server — itu kerjaan
// besar terpisah (skema data produksi, workflow tahapan, dst). Layar ini
// BENERAN bisa baca kode QR apapun dan tampilkan isinya — itu bagian
// generiknya yang sudah jadi & bisa dipakai; menyambungkannya ke alur
// produksi spesifik menyusul kalau skema datanya sudah dirancang.
// ============================================================================
import { createApp, ref, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

const AppScanQr = {
  setup() {
    const videoEl = ref(null);
    const canvasEl = ref(null);
    const sedangMemuatKamera = ref(false); // baru true SAAT mulaiKameraScan() dipanggil, bukan dari awal
    const belumDibuka = ref(true); // true = tab ini belum pernah dibuka sejak halaman dimuat
    const kameraError = ref('');
    const hasilScan = ref(null); // { data: "..." } atau null kalau belum ada
    const jsQrSiap = ref(false);

    let streamKamera = null;
    let frameId = null;

    function muatJsQr() {
      return new Promise((resolve, reject) => {
        if (window.jsQR) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    async function mulaiKameraScan() {
      belumDibuka.value = false;
      sedangMemuatKamera.value = true;
      kameraError.value = '';
      hasilScan.value = null;
      try {
        await muatJsQr();
        jsQrSiap.value = true;
      } catch (e) {
        kameraError.value = 'Gagal memuat modul pembaca QR. Cek koneksi internet.';
        sedangMemuatKamera.value = false;
        return;
      }
      try {
        streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoEl.value) {
          videoEl.value.srcObject = streamKamera;
          await videoEl.value.play();
        }
        sedangMemuatKamera.value = false;
        pindaiFrame();
      } catch (e) {
        kameraError.value = 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan.';
        sedangMemuatKamera.value = false;
      }
    }

    function pindaiFrame() {
      if (!streamKamera || hasilScan.value) return; // berhenti kalau kamera mati atau sudah ketemu hasil
      const video = videoEl.value;
      const canvas = canvasEl.value;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gambar = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const kode = window.jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: 'dontInvert' });
        if (kode && kode.data) {
          hasilScan.value = { data: kode.data };
          if (navigator.vibrate) navigator.vibrate(120); // getaran singkat sebagai penanda berhasil, kalau perangkatnya dukung
          return; // berhenti scan begitu ketemu
        }
      }
      frameId = requestAnimationFrame(pindaiFrame);
    }

    function matikanKameraScan() {
      if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
      if (streamKamera) {
        streamKamera.getTracks().forEach(t => t.stop());
        streamKamera = null;
      }
    }

    function pindaiUlang() {
      hasilScan.value = null;
      pindaiFrame();
    }

    // SENGAJA TIDAK auto-mulai kamera di sini — onMounted() ini jalan SEKALI
    // saat halaman pertama dimuat (jauh sebelum tab-nya benar-benar dibuka
    // orang), sama seperti bug "data macet" yang berkali-kali diperbaiki
    // hari ini. Kamera cuma nyala lewat window.mulaiScanQr() yang dipanggil
    // dashboard.js TEPAT saat tab Scan QR benar-benar dibuka.
    onUnmounted(matikanKameraScan);

    return { videoEl, canvasEl, sedangMemuatKamera, belumDibuka, kameraError, hasilScan, pindaiUlang, mulaiKameraScan, matikanKameraScan };
  },
  template: `
    <div class="gc-cam-wrap">
      <div class="gc-cam-top">
        <h2>Scan QR</h2>
        <p class="mode">Pindai kode QR — SPK, produk, bahan, atau QR karyawan</p>
      </div>
      <div class="gc-cam-view">
        <video ref="videoEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: sedangMemuatKamera || belumDibuka || hasilScan }"></video>
        <canvas ref="canvasEl" class="hidden"></canvas>
        <div v-if="sedangMemuatKamera || belumDibuka" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:16px; color:#C9B4A4;">
          <i class="fas fa-qrcode" style="font-size:44px; margin-bottom:10px;"></i>
          <span v-if="kameraError" style="color:#F2A0A0; font-size:12px;">{{ kameraError }}</span>
          <span v-else style="font-size:13px;">Menyiapkan kamera...</span>
        </div>
        <!-- BARU (28 Agt 2026, redesain, README §8) — animasi gxPop murni
             dekoratif saat kode terdeteksi, tidak ada logic tambahan. -->
        <div v-if="hasilScan" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:16px; color:var(--ok); animation:gxPop .3s ease;">
          <i class="fas fa-circle-check" style="font-size:44px; margin-bottom:10px;"></i>
          <span style="font-size:13px; font-weight:700;">Kode terdeteksi!</span>
        </div>
        <div v-if="!sedangMemuatKamera && !belumDibuka && !hasilScan" class="gc-cam-frame"></div>
        <div v-if="!sedangMemuatKamera && !belumDibuka && !hasilScan" class="gc-cam-scanline"></div>
      </div>

      <div style="width:100%; max-width:300px; margin-bottom:20px;">
        <div v-if="hasilScan" class="scan-result" style="margin-bottom:14px;">
          <div class="row"><span>Isi kode</span></div>
          <p style="font-size:12.5px; word-break:break-all; color:var(--text); margin-top:4px;">{{ hasilScan.data }}</p>
        </div>
        <button v-if="hasilScan" @click="pindaiUlang" class="btn-primary block">
          <i class="fas fa-rotate" style="margin-right:8px;"></i> Pindai lagi
        </button>
        <p v-else class="gc-cam-caption">Arahkan kamera ke kode QR</p>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-scan-qr');
if (mountPoint) {
  const vm = createApp(AppScanQr).mount('#vue-scan-qr');
  // Jembatan: dipanggil dari app.js (pindahLayar/pindahTab) setiap kali
  // masuk/keluar tab Scan QR, supaya kamera tidak terus menyala boros
  // baterai saat orang pindah ke tab lain.
  window.mulaiScanQr = function() { vm.mulaiKameraScan(); };
  window.matikanScanQr = function() { vm.matikanKameraScan(); };
}
