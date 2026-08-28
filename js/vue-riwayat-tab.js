// js/vue-riwayat-tab.js — BARU (28 Agt 2026, §39)
// =============================================================================
// Composable BERSAMA buat nyambungin tab INTERNAL Vue (ref lokal, mis.
// `const tab = ref('jasa')` di BOM Jasa/Pola/Aksesoris/Vendor Entry Produk,
// atau Ringkasan/Detail di Kartu Stok) ke sistem riwayat tombol back HP
// (`window._riwayatNavAktif`, dibangun di js/dashboard.js §22.3/§39).
//
// KENAPA FILE TERPISAH (bukan ditulis ulang di tiap file Vue, disalin
// SEKALI di sini lalu di-IMPORT bareng — beda dari konvensi "disalin,
// bukan diimpor silang" yang dipakai buat helper Excel dsb): logic-nya
// HARUS 100% identik di semua tempat (aturan restore/urutan/anti-loop
// yang presisi) — kalau disalin manual ke belasan file, risiko besar ada
// yang sedikit beda & bug-nya baru ketahuan pas user pencet back HP,
// bukan pas development. Sekali benar di sini, semua pemakainya otomatis
// benar & konsisten.
//
// CARA PAKAI (1 baris di dalam setup(), buat SETIAP ref tab yang mau ikut
// riwayat):
//   import { pakaiRiwayatTabVue } from './vue-riwayat-tab.js?v=1';
//   ...
//   setup(props) {
//     const tab = ref('jasa');
//     pakaiRiwayatTabVue('produk-bom-tab', tab); // <-- 1 baris ini
//     ...
//   }
//
// `namaUnik` (argumen 1) HARUS unik di SELURUH app (dipakai sebagai kunci
// di snapshot riwayat + nama handler global) — konvensi: '<menu>-<fungsi
// tab>', mis. 'produk-bom-tab', 'kartustok-tampilan'.
//
// BACKWARD COMPATIBLE / OPT-IN PENUH: komponen yang TIDAK memanggil ini
// sama sekali TIDAK terpengaruh apapun — tab-nya jalan seperti biasa,
// cuma tombol back HP tidak akan mundur ke tab sebelumnya (perilaku SAMA
// seperti sebelum §39 ada).
//
// CATATAN PENTING soal urutan restore: dipanggil listener `popstate` di
// dashboard.js SETELAH restore level `subTabs` (DOM/pindahSubTab) selesai
// — supaya komponen Vue yang jadi tujuan (mis. Entry Produk) SUDAH pasti
// ke-mount lebih dulu (lewat pastikanMountXxx() yang otomatis terpanggil
// dari pindahSubTab) sebelum bagian INI mencoba mengembalikan tab
// internalnya. Kalau dipanggil kebalik (vueTabs duluan), restore-nya bisa
// tidak berefek karena komponennya belum ada sama sekali di titik itu.
// =============================================================================
import { watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export function pakaiRiwayatTabVue(namaUnik, tabRef) {
  // 1. Restore kalau snapshot riwayat aktif SUDAH punya nilainya — ini
  //    menutup 2 skenario sekaligus: (a) komponen baru PERTAMA kali
  //    di-mount tepat sesudah tombol back ditekan (setup() ini baru jalan
  //    SEKARANG, snapshotnya sudah lebih dulu diisi listener popstate),
  //    dan (b) lanjutan sesi biasa yang kebetulan reload/refresh browser
  //    (state riwayat browser tetap ada walau halaman dimuat ulang).
  if (window._riwayatNavAktif && Array.isArray(window._riwayatNavAktif.vueTabs)) {
    const ada = window._riwayatNavAktif.vueTabs.find(v => v.nama === namaUnik);
    if (ada) tabRef.value = ada.nilai;
  }

  // 2. Daftarkan handler restore ke `window` — dipakai listener popstate
  //    buat skenario komponen yang SUDAH ke-mount SEBELUM back ditekan
  //    (kasus paling umum di app ini — komponen Vue di sini sengaja tidak
  //    pernah dibongkar-pasang ulang begitu sekali dibuka, cuma
  //    disembunyikan CSS, jadi setup() TIDAK jalan ulang, satu-satunya
  //    cara mengembalikan nilainya ya lewat handler ini).
  let sedangRestore = false;
  window['_restoreVueTab_' + namaUnik] = function (nilai) {
    sedangRestore = true;
    tabRef.value = nilai;
    // Vue watch callback jalan async (microtask) — lepas flag di microtask
    // berikutnya juga, supaya watch di bawah yang terpicu akibat baris di
    // atas benar-benar sempat melihat sedangRestore === true dulu.
    Promise.resolve().then(() => { sedangRestore = false; });
  };

  // 3. Catat tiap kali tab berubah lewat interaksi user (BUKAN dari
  //    restore poin 1/2 di atas — makanya dicek `sedangRestore`).
  watch(tabRef, (nilaiBaru) => {
    if (sedangRestore) return;
    if (!window._riwayatNavAktif) window._riwayatNavAktif = { tab: null, navKey: null, subTabs: [], vueTabs: [] };
    if (!Array.isArray(window._riwayatNavAktif.vueTabs)) window._riwayatNavAktif.vueTabs = [];
    const idx = window._riwayatNavAktif.vueTabs.findIndex(v => v.nama === namaUnik);
    const sudahSama = idx >= 0 && window._riwayatNavAktif.vueTabs[idx].nilai === nilaiBaru;
    if (sudahSama) return;
    if (idx >= 0) window._riwayatNavAktif.vueTabs[idx] = { nama: namaUnik, nilai: nilaiBaru };
    else window._riwayatNavAktif.vueTabs.push({ nama: namaUnik, nilai: nilaiBaru });
    try {
      history.pushState(window._riwayatNavAktif, '', location.href);
    } catch (e) {
      console.error('Gagal catat riwayat navigasi tab Vue (tidak fatal, navigasi tetap lanjut):', e);
    }
  });
}
