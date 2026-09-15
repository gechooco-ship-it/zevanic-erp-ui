// js/vue-riwayat-tab.js
// Composable pakaiRiwayatTabVue(namaUnik, tabRef): menyambungkan tab internal
// Vue (ref lokal, mis. tab BOM Jasa/Pola/Aksesoris, atau Ringkasan/Detail di
// Kartu Stok) ke riwayat tombol back HP (window._riwayatNavAktif, dibangun di
// js/dashboard.js).
//
// Koleksi & field:
// - Tidak menyentuh Firestore; murni composable state tab + riwayat navigasi.
//
// Jebakan:
// - namaUnik harus unik SE-APLIKASI: dipakai sebagai kunci snapshot riwayat
//   sekaligus nama handler global. Konvensi '<menu>-<fungsi tab>'.
// - Sengaja diimpor bersama, bukan disalin per file seperti helper lain —
//   aturan restore/urutan/anti-loop harus 100% identik di semua pemakai.
// - Listener popstate dashboard.js memanggilnya SETELAH restore level subTabs
//   selesai, supaya komponen Vue tujuan sudah ter-mount. Kalau urutannya
//   kebalik, restore tab internal tidak berefek sama sekali.
// - Opt-in: komponen yang tidak memanggilnya tidak terpengaruh apa pun.

import { watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export function pakaiRiwayatTabVue(namaUnik, tabRef) {
  // 1. Restore kalau snapshot riwayat aktif sudah punya nilainya — menutup 2
  // skenario: (a) komponen PERTAMA kali di-mount tepat sesudah tombol back
  // ditekan (snapshot sudah lebih dulu diisi listener popstate), dan (b)
  // reload/refresh browser (state riwayat browser bertahan).
  if (window._riwayatNavAktif && Array.isArray(window._riwayatNavAktif.vueTabs)) {
    const ada = window._riwayatNavAktif.vueTabs.find(v => v.nama === namaUnik);
    if (ada) tabRef.value = ada.nilai;
  }

  // 2. Daftarkan handler restore ke `window` — dipakai listener popstate untuk
  // komponen yang SUDAH ke-mount SEBELUM back ditekan (kasus paling umum:
  // komponen cuma disembunyikan CSS, tidak pernah dibongkar-pasang, jadi setup
  // TIDAK jalan ulang dan handler ini satu-satunya jalan mengembalikan nilai).
  let sedangRestore = false;
  window['_restoreVueTab_' + namaUnik] = function (nilai) {
    sedangRestore = true;
    tabRef.value = nilai;
    // Vue watch callback jalan async (microtask) — lepas flag di microtask
    // berikutnya juga, supaya watch di bawah yang terpicu akibat baris di atas
    // benar-benar sempat melihat sedangRestore === true dulu.
    Promise.resolve().then(() => { sedangRestore = false; });
  };

  // 3. Catat tiap kali tab berubah lewat interaksi user (BUKAN dari restore poin
  // 1/2 di atas — makanya dicek `sedangRestore`).
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
