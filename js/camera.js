// js/camera.js
let streamKamera = null;
window.ktpBase64Global = ""; 

window.previewKTP = function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      window.ktpBase64Global = e.target.result;
      const img = document.getElementById('preview-ktp-img');
      img.src = window.ktpBase64Global;
      img.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
};

window.mulaiKamera = async function() {
    const video = document.getElementById('kamera-feed');
    const pesan = document.getElementById('pesan-kamera');
    const btnJepret = document.getElementById('btn-jepret');
    const hasilFoto = document.getElementById('hasil-foto');
    const grupBtnLanjut = document.getElementById('grup-btn-lanjut');

    video.classList.add('hidden');
    hasilFoto.classList.add('hidden');
    grupBtnLanjut.classList.add('hidden');
    pesan.classList.remove('hidden');
    btnJepret.classList.add('hidden');

    try {
        streamKamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        video.srcObject = streamKamera;
        video.classList.remove('hidden');
        pesan.classList.add('hidden');
        btnJepret.classList.remove('hidden');
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
