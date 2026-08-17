// js/vue-home-desktop.js
// ============================================================================
// Mount PengumumanCarousel (komponen bersama, vue-components.js) khusus
// untuk area banner desktop di tab-home. Komponen yang sama JUGA dipakai
// di dalam js/vue-home.js untuk mobile — file kecil ini cuma urus
// mount-nya di titik HTML yang berbeda (lihat index.html: #vue-pengumuman-desktop).
// ============================================================================
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { PengumumanCarousel } from './vue-components.js';

const mountPoint = document.getElementById('vue-pengumuman-desktop');
if (mountPoint) {
  createApp(PengumumanCarousel).mount('#vue-pengumuman-desktop');
}
