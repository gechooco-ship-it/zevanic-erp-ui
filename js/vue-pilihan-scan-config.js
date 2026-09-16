// js/vue-pilihan-scan-config.js
// Pilihan Scan (Scan & Cetak > Pilihan Scan) — layar admin buat Guru atur
// sendiri menu mana tampil pilihan scan apa di sheet "Mau scan apa?", tanpa
// ubah kode. Katalog aksi/konteks & fallback dibaca dari js/vue-popup-scan.js
// (satu sumber kebenaran, jangan duplikat di sini).
//
// Koleksi & field:
// - config_pilihan_scan/{targetId}: item_ids[] (urutan tampil di sheet),
//   diubah_pada, diubah_oleh. Konteks tanpa dokumen tampil "pakai default
//   kode" (DEFAULT_PILIHAN, js/vue-popup-scan.js).
//
// Jebakan:
// - Simpan/hapus WAJIB panggil invalidasiCachePilihanScan() supaya sheet
//   "Mau scan apa?" langsung pakai data terbaru, tidak nunggu reload.
// - Konteks baru (targetId baru) HANYA bisa ditambah lewat kode
//   (DAFTAR_KONTEKS, vue-popup-scan.js) — layar ini cuma atur konteks yang
//   sudah terdaftar di sana, tidak bisa menambah konteks baru sendiri.
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import { DAFTAR_AKSI_SCAN, DAFTAR_KONTEKS, DEFAULT_PILIHAN, invalidasiCachePilihanScan } from './vue-popup-scan.js?v=3';

export const AppPilihanScanConfig = {
  setup() {
    const memuat = ref(true);
    const daftarDokumen = ref({}); // {targetId: {item_ids, ...}} — cuma yang PUNYA dokumen
    const editAktif = ref(null); // null | targetId
    const formItemIds = ref([]);
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, 'config_pilihan_scan'));
        const peta = {};
        snap.docs.forEach(d => { peta[d.id] = d.data(); });
        daftarDokumen.value = peta;
      } catch (e) {
        console.error('Gagal muat config_pilihan_scan:', e);
        alert('Gagal memuat Pilihan Scan. Coba refresh.');
      }
      memuat.value = false;
    }

    // Efektif = dari Firestore kalau ada, kalau tidak dari default kode —
    // ini yang SUNGGUHAN dipakai sheet "Mau scan apa?" (lihat
    // ambilItemUntukTarget, vue-popup-scan.js), jadi ditampilkan sama persis.
    const daftarKonteks = computed(() =>
      Object.entries(DAFTAR_KONTEKS).map(([targetId, labelJalur]) => {
        const dok = daftarDokumen.value[targetId];
        const itemIds = dok ? (dok.item_ids || []) : (DEFAULT_PILIHAN[targetId] || []);
        return {
          targetId, labelJalur,
          sudahDiatur: !!dok,
          item: itemIds.map(id => DAFTAR_AKSI_SCAN[id]).filter(Boolean)
        };
      })
    );

    function bukaEdit(targetId) {
      editAktif.value = targetId;
      const dok = daftarDokumen.value[targetId];
      formItemIds.value = dok ? [...(dok.item_ids || [])] : [...(DEFAULT_PILIHAN[targetId] || [])];
    }
    function tutupEdit() { editAktif.value = null; }

    function toggleAksi(aksiId) {
      const idx = formItemIds.value.indexOf(aksiId);
      if (idx >= 0) formItemIds.value.splice(idx, 1);
      else formItemIds.value.push(aksiId);
    }
    function naikkan(aksiId) {
      const idx = formItemIds.value.indexOf(aksiId);
      if (idx > 0) { const t = formItemIds.value[idx - 1]; formItemIds.value[idx - 1] = formItemIds.value[idx]; formItemIds.value[idx] = t; }
    }
    function turunkan(aksiId) {
      const idx = formItemIds.value.indexOf(aksiId);
      if (idx >= 0 && idx < formItemIds.value.length - 1) { const t = formItemIds.value[idx + 1]; formItemIds.value[idx + 1] = formItemIds.value[idx]; formItemIds.value[idx] = t; }
    }

    async function simpan() {
      if (!formItemIds.value.length) return alert('Pilih minimal 1 aksi scan, atau pakai "Kembalikan ke Default" kalau mau kosongkan pengaturan.');
      menyimpan.value = true;
      try {
        await setDoc(doc(db, 'config_pilihan_scan', editAktif.value), {
          item_ids: [...formItemIds.value],
          diubah_pada: serverTimestamp(),
          diubah_oleh: (window.currentUser && (window.currentUser.nama || window.currentUser.email)) || '-'
        }, { merge: false });
        invalidasiCachePilihanScan();
        editAktif.value = null;
        await muat();
      } catch (e) {
        console.error('Gagal simpan config_pilihan_scan:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function kembalikanDefault(targetId) {
      if (!daftarDokumen.value[targetId]) { tutupEdit(); return; }
      if (!confirm('Kembalikan konteks ini ke pilihan scan default (bawaan kode)?')) return;
      try {
        await deleteDoc(doc(db, 'config_pilihan_scan', targetId));
        invalidasiCachePilihanScan();
        if (editAktif.value === targetId) editAktif.value = null;
        await muat();
      } catch (e) { console.error('Gagal hapus config_pilihan_scan:', e); alert('Gagal mengembalikan ke default. Coba lagi.'); }
    }

    onMounted(muat);

    return {
      memuat, daftarKonteks, editAktif, formItemIds, menyimpan,
      DAFTAR_AKSI_SCAN, DAFTAR_KONTEKS,
      bukaEdit, tutupEdit, toggleAksi, naikkan, turunkan, simpan, kembalikanDefault
    };
  },
  template: `
    <div>
      <div style="margin-bottom:14px;">
        <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 4px;">Pilihan Scan</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Atur sheet "Mau scan apa?" yang muncul saat tombol QR navbar mobile ditekan — pilih aksi scan apa saja yang tampil per menu, dan urutannya. Menu yang belum diatur di sini pakai bawaan kode.</p>
      </div>

      <div v-if="memuat" class="gc-kosong">Memuat...</div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="k in daftarKonteks" :key="k.targetId" class="gc-card" style="padding:12px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:12.5px;">{{ k.labelJalur }}</div>
              <div style="margin-top:2px;">
                <span v-if="k.sudahDiatur" class="tag ok" style="font-size:9.5px;">Sudah diatur</span>
                <span v-else class="tag neutral" style="font-size:9.5px;">Pakai default kode</span>
              </div>
              <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;">
                <span v-for="a in k.item" :key="a.fungsi" class="tag" style="font-size:10px;"><i class="fas" :class="'fa-' + a.icon" style="margin-right:4px;"></i>{{ a.judul }}<span v-if="a.sub"> — {{ a.sub }}</span></span>
                <span v-if="!k.item.length" style="font-size:10.5px; color:var(--text-faint);">Tidak ada aksi (fallback ke Scan QR biasa).</span>
              </div>
            </div>
            <button @click="bukaEdit(k.targetId)" class="btn-outline" style="flex-shrink:0; padding:7px 12px; font-size:11px;"><i class="fas fa-pen" style="margin-right:5px;"></i>Atur</button>
          </div>
        </div>
      </div>

      <div v-if="editAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupEdit">
        <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto; padding:18px;">
          <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 4px;">Atur Pilihan Scan</h3>
          <p style="font-size:11px; color:var(--text-faint); margin:0 0 12px;">{{ DAFTAR_KONTEKS[editAktif] }}</p>

          <div style="margin-bottom:14px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Aksi yang tampil (urutan dari atas = urutan di sheet)</label>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div v-for="(a, id) in DAFTAR_AKSI_SCAN" :key="id" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:6px 8px; border-radius:8px; background:var(--ivory-dim);">
                <input type="checkbox" :checked="formItemIds.includes(id)" @change="toggleAksi(id)">
                <i class="fas" :class="'fa-' + a.icon" style="width:14px; text-align:center; color:var(--text-muted);"></i>
                <span style="flex:1;">{{ a.judul }}<span v-if="a.sub" style="color:var(--text-faint);"> — {{ a.sub }}</span></span>
                <button v-if="formItemIds.includes(id)" type="button" @click="naikkan(id)" class="icon-btn" style="padding:2px 6px;"><i class="fas fa-arrow-up"></i></button>
                <button v-if="formItemIds.includes(id)" type="button" @click="turunkan(id)" class="icon-btn" style="padding:2px 6px;"><i class="fas fa-arrow-down"></i></button>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:8px;">
            <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:10px;">{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
            <button @click="kembalikanDefault(editAktif)" type="button" class="btn-outline" style="flex:1; padding:10px;">Kembalikan ke Default</button>
          </div>
          <button @click="tutupEdit" type="button" class="btn-outline" style="width:100%; padding:10px; margin-top:8px;">Batal</button>
        </div>
      </div>
    </div>
  `
};

let _appPilihanScanConfig = null;
window.pastikanMountPilihanScanConfig = function () {
  const el = document.getElementById('vue-pilihan-scan-config');
  if (!el || el.dataset.mounted === '1') return;
  _appPilihanScanConfig = createApp(AppPilihanScanConfig);
  _appPilihanScanConfig.mount('#vue-pilihan-scan-config');
  el.dataset.mounted = '1';
};
