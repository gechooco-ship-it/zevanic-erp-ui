// js/vue-home-desktop.js
// ============================================================================
// Mount PengumumanCarousel & QuoteCard (komponen bersama, vue-components.js)
// khusus untuk area banner desktop di tab-home. Komponen yang SAMA juga
// dipakai di js/vue-home.js untuk mobile — file kecil ini cuma urus
// mount-nya di titik HTML yang berbeda (lihat index.html:
// #vue-pengumuman-desktop, #vue-quote-desktop).
// ============================================================================
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { PengumumanCarousel, QuoteCard } from './vue-components.js';

const mountPengumuman = document.getElementById('vue-pengumuman-desktop');
if (mountPengumuman) createApp(PengumumanCarousel).mount('#vue-pengumuman-desktop');

const mountQuote = document.getElementById('vue-quote-desktop');
if (mountQuote) createApp(QuoteCard).mount('#vue-quote-desktop');

