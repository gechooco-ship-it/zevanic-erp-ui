// js/camera.js
// ============================================================================
// File ini SEKARANG hanya berisi kompresi & preview foto KTP (dipakai saat
// Registrasi karyawan baru). Seluruh logic layar kamera selfie (Hadir/Izin/
// Cuti/Lembur/Clock Out) + geofencing GPS sudah pindah ke js/vue-camera.js.
// ============================================================================
window.ktpBase64Global = "";

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
  if (!file) return Promise.resolve();

  const img = document.getElementById('preview-ktp-img'); // mungkin null (Vue menangani preview-nya sendiri)
  return kompresGambar(file, 1000, 0.75).then(dataUrl => {
    window.ktpBase64Global = dataUrl;
    if (img) {
      img.src = dataUrl;
      img.classList.remove('hidden');
    }
    return dataUrl;
  }).catch(err => {
    console.error("Gagal kompres foto KTP:", err);
    alert("Gagal memproses foto KTP. Coba ambil/pilih foto lain.");
  });
};
