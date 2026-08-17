// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

// EXPORTED (18 Agt 2026) — objek mentahnya, bukan cuma hasil initializeApp,
// dipakai js/vue-antrean-dakar.js untuk bikin instance Firebase KEDUA saat
// approve karyawan baru (supaya createUserWithEmailAndPassword tidak
// "melempar" logout sesi Admin yang sedang aktif di instance UTAMA). Lihat
// STATUS-PROYEK.md §3.5.2 untuk penjelasan lengkap kenapa ini perlu.
export const firebaseConfig = {
  apiKey: "AIzaSyDOKxjdqE1476uR9zB9lug-sYMFbGwGihk",
  authDomain: "zevanic-erp.firebaseapp.com",
  projectId: "zevanic-erp",
  storageBucket: "zevanic-erp.firebasestorage.app",
  messagingSenderId: "543775962833",
  appId: "1:543775962833:web:4dbec84b555d813bfaf7f0"
};

const app = initializeApp(firebaseConfig);

// Offline Persistence (cache lokal via IndexedDB) — data yang PERNAH dibaca
// tersimpan di perangkat, jadi kalau data yang SAMA diminta lagi (misal
// balik ke tab yang sama, atau reload halaman) Firestore bisa jawab dari
// cache lokal dulu tanpa perlu round-trip baca ke server tiap kali.
// persistentMultipleTabManager: aman kalau orang buka app di beberapa tab
// browser sekaligus (tidak rebutan/konflik cache antar tab).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);
// Firebase Storage — khusus buat lampiran gambar/video Config Info
// (Pengumuman). Firestore punya batas keras 1MB PER DOKUMEN, dan
// base64-kan file membengkakkan ukurannya ~33% — jadi TIDAK aman simpan
// gambar/video langsung di Firestore seperti foto_selfie/foto_ktp selama
// ini. Storage memang didesain untuk file, Firestore cuma simpan link-nya.
export const storage = getStorage(app);
