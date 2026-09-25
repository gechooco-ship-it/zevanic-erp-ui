// js/vue-pilihan-scan-config.js
// Pilihan Scan (Scan & Cetak > Pilihan Scan) — layar admin atur aksi scan apa
// tampil di sheet mobile "Mau scan apa?" DAN tombol scan desktop, SATU
// pengaturan per CHILD TAB (bukan per modul) — kartu berjenjang Group Menu >
// Sub Menu > Child Tab, tiap child kartu sendiri+tombol Atur sendiri.
// Kandidat checkbox tiap child SEMUA aksi milik modulnya (aksiModul), admin
// bebas centang 3-5 sesuai kebutuhan tab itu. Hierarki+katalog dari
// vue-popup-scan.js.
//
// Koleksi & field:
// - config_pilihan_scan/{targetId}: targetId = id CHILD TAB. item_ids[]
//   (urutan+aktif), diubah_pada/oleh. Tanpa dokumen pakai DEFAULT_PILIHAN.
//
// Jebakan:
// - Simpan/hapus WAJIB invalidasiCachePilihanScan() supaya sheet mobile dan
//   tombol desktop langsung pakai data terbaru, tidak nunggu reload.
// - Modul/aksi baru HANYA lewat kode (STRUKTUR_MENU_SCAN, vue-popup-scan.js)
//   — layar ini cuma atur yang sudah terdaftar di sana.
import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import { DAFTAR_AKSI_SCAN, STRUKTUR_MENU_SCAN, DEFAULT_PILIHAN, invalidasiCachePilihanScan } from './vue-popup-scan.js?v=8';

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

    // Kartu berjenjang: Group Menu > Sub Menu > Child Tab, LANGSUNG dari
    // STRUKTUR_MENU_SCAN. "Atur" ada di level CHILD TAB — tiap child punya
    // pengaturan sendiri, kandidatnya tetap SEMUA aksi milik sub menu induknya
    // (s.aksiModul), bukan disaring per child.
    const struktur = computed(() =>
      STRUKTUR_MENU_SCAN.map(g => ({
        group: g.group,
        subs: g.subs.map(s => ({
          sub: s.sub,
          childs: (s.childs || []).map(c => {
            if (!c.targetId) return { label: c.label, adaAksi: false };
            const dok = daftarDokumen.value[c.targetId];
            const itemIds = dok ? (dok.item_ids || []) : (s.aksiModul || []);
            return {
              label: c.label, adaAksi: true, targetId: c.targetId,
              sudahDiatur: !!dok,
              item: itemIds.map(id => DAFTAR_AKSI_SCAN[id]).filter(Boolean)
            };
          })
        }))
      }))
    );

    // Kandidat checkbox saat Atur dibuka — SEMUA aksi milik SUB MENU induk
    // child tab itu (bukan cuma yang "harusnya" ada di tab itu), biar admin
    // bebas nyalakan aksi apapun dari tab manapun.
    function kandidatUntukTarget(targetId) {
      for (const g of STRUKTUR_MENU_SCAN) {
        for (const s of g.subs) {
          if ((s.childs || []).some(c => c.targetId === targetId)) return s.aksiModul || [];
        }
      }
      return [];
    }
    const kandidatAktif = computed(() => editAktif.value ? kandidatUntukTarget(editAktif.value) : []);
    const labelAktif = computed(() => {
      if (!editAktif.value) return '';
      for (const g of STRUKTUR_MENU_SCAN) {
        for (const s of g.subs) {
          const c = (s.childs || []).find(x => x.targetId === editAktif.value);
          if (c) return `${g.group} > ${s.sub} > ${c.label}`;
        }
      }
      return editAktif.value;
    });

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
      memuat, struktur, editAktif, formItemIds, menyimpan, kandidatAktif, labelAktif,
      DAFTAR_AKSI_SCAN,
      bukaEdit, tutupEdit, toggleAksi, naikkan, turunkan, simpan, kembalikanDefault
    };
  },
  template: `
    <div>
      <div style="margin-bottom:14px;">
        <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 4px;">Pilihan Scan</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Satu pengaturan PER CHILD TAB buat sheet "Mau scan apa?" (mobile) DAN tombol scan di layar desktop — tiap tab centang sendiri dari SEMUA aksi milik modulnya. Child tab yang belum diatur pakai bawaan kode (semua aksi modul aktif).</p>
      </div>

      <div v-if="memuat" class="gc-kosong">Memuat...</div>
      <div v-else style="display:flex; flex-direction:column; gap:18px;">
        <div v-for="g in struktur" :key="g.group">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-faint); margin-bottom:8px;">{{ g.group }}</div>
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div v-for="s in g.subs" :key="s.sub">
              <div style="font-size:11px; font-weight:600; color:var(--text-muted); margin-bottom:6px;">{{ s.sub }}</div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div v-for="c in s.childs" :key="c.label" class="gc-card" style="padding:12px 14px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                    <div style="min-width:0;">
                      <div style="font-weight:700; font-size:13px;">{{ c.label }}</div>
                      <div v-if="c.adaAksi" style="margin-top:5px; display:flex; flex-wrap:wrap; align-items:center; gap:5px;">
                        <span :class="c.sudahDiatur ? 'tag ok' : 'tag neutral'" style="font-size:9px;">{{ c.sudahDiatur ? 'Sudah diatur' : 'Default' }}</span>
                        <span v-for="a in c.item" :key="a.fungsi" class="tag" style="font-size:9.5px;"><i class="fas" :class="'fa-' + a.icon" style="margin-right:3px;"></i>{{ a.judul }}</span>
                        <span v-if="!c.item.length" style="font-size:10px; color:var(--text-faint);">Nonaktif semua (fallback Scan QR).</span>
                      </div>
                      <div v-else style="margin-top:5px; font-size:10px; color:var(--text-faint);">Tidak ada aksi scan di child tab ini.</div>
                    </div>
                    <button v-if="c.adaAksi" @click="bukaEdit(c.targetId)" class="btn-outline" style="flex-shrink:0; padding:5px 10px; font-size:10.5px;"><i class="fas fa-pen" style="margin-right:4px;"></i>Atur</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="editAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupEdit">
        <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto; padding:18px;">
          <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 4px;">Atur Pilihan Scan</h3>
          <p style="font-size:11px; color:var(--text-faint); margin:0 0 12px;">{{ labelAktif }}</p>

          <div style="margin-bottom:14px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Aksi yang tampil/aktif (urutan dari atas = urutan di sheet mobile)</label>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div v-for="id in kandidatAktif" :key="id" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:6px 8px; border-radius:8px; background:var(--ivory-dim);">
                <input type="checkbox" :checked="formItemIds.includes(id)" @change="toggleAksi(id)">
                <i class="fas" :class="'fa-' + DAFTAR_AKSI_SCAN[id].icon" style="width:14px; text-align:center; color:var(--text-muted);"></i>
                <span style="flex:1;">{{ DAFTAR_AKSI_SCAN[id].judul }}<span v-if="DAFTAR_AKSI_SCAN[id].sub" style="color:var(--text-faint);"> — {{ DAFTAR_AKSI_SCAN[id].sub }}</span></span>
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
