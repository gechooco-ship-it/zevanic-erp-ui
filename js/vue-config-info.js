// js/vue-config-info.js
// ============================================================================
// Master Karyawan > Config Info — kelola pengumuman yang tampil di Home
// (mobile). Bisa buat banyak pengumuman, tiap pengumuman bisa diatur mau
// tampil untuk role apa saja (checkbox). Dibaca oleh js/vue-home.js —
// pengecekan role-nya dilakukan DI SANA secara lokal (window.currentUser),
// bukan query where() ke Firestore, supaya hemat baca.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage } from "./firebase-config.js";

const DAFTAR_ROLE = ['operator', 'pic', 'admin', 'owner', 'superuser'];
const BATAS_UKURAN_BYTE = 1 * 1024 * 1024; // 1MB, sesuai permintaan

const AppConfigInfo = {
  setup() {
    const daftarPengumuman = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);

    const form = reactive({
      id: null, // null = buat baru, terisi = sedang edit
      judul: '',
      isi: '',
      rolesTampil: [], // kosong = tampil untuk semua role
      mediaUrl: '',    // URL media yang SUDAH tersimpan (kalau sedang edit)
      mediaType: ''    // 'image' atau 'video'
    });
    const fileTerpilih = ref(null); // File baru yang BELUM diupload
    const previewUrl = ref('');     // preview lokal file baru (blob URL)
    const mengupload = ref(false);

    function formKosong() {
      form.id = null;
      form.judul = '';
      form.isi = '';
      form.rolesTampil = [];
      form.mediaUrl = '';
      form.mediaType = '';
      fileTerpilih.value = null;
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = '';
    }

    function pilihFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > BATAS_UKURAN_BYTE) {
        alert(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(2)}MB). Maksimal 1MB.`);
        event.target.value = '';
        return;
      }
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        alert('Cuma boleh file gambar atau video.');
        event.target.value = '';
        return;
      }
      fileTerpilih.value = file;
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = URL.createObjectURL(file);
    }

    function hapusMediaTerpilih() {
      fileTerpilih.value = null;
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = '';
      form.mediaUrl = '';
      form.mediaType = '';
    }

    async function muat() {
      memuat.value = true;
      try {
        const q = query(collection(db, "pengumuman"), orderBy("dibuat_pada", "desc"));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        daftarPengumuman.value = list;
      } catch (e) {
        console.error("Gagal muat Config Info:", e);
      }
      memuat.value = false;
    }

    function toggleRole(role) {
      const idx = form.rolesTampil.indexOf(role);
      if (idx > -1) form.rolesTampil.splice(idx, 1);
      else form.rolesTampil.push(role);
    }

    function edit(item) {
      formKosong();
      form.id = item.id;
      form.judul = item.judul || '';
      form.isi = item.isi || '';
      form.rolesTampil = [...(item.rolesTampil || [])];
      form.mediaUrl = item.mediaUrl || '';
      form.mediaType = item.mediaType || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function simpan() {
      if (!form.judul.trim() || !form.isi.trim()) return alert("Judul dan isi pengumuman harus diisi!");
      menyimpan.value = true;
      try {
        const idDipakai = form.id || String(Date.now());
        let mediaUrlBaru = form.mediaUrl;
        let mediaTypeBaru = form.mediaType;

        if (fileTerpilih.value) {
          mengupload.value = true;
          const urlLama = form.mediaUrl; // simpan dulu buat dihapus SETELAH upload baru sukses
          const ekstensi = fileTerpilih.value.name.split('.').pop();
          const pathFile = `pengumuman/${idDipakai}/media_${Date.now()}.${ekstensi}`;
          const refFile = storageRef(storage, pathFile);
          await uploadBytes(refFile, fileTerpilih.value);
          mediaUrlBaru = await getDownloadURL(refFile);
          mediaTypeBaru = fileTerpilih.value.type.startsWith('video/') ? 'video' : 'image';
          mengupload.value = false;

          // Hapus file LAMA (kalau sedang ganti media di pengumuman yang
          // sudah ada) — supaya tidak numpuk file yatim di Storage.
          if (urlLama) {
            try {
              await deleteObject(storageRef(storage, urlLama));
            } catch (e) { /* file lama mungkin sudah tidak ada, abaikan */ }
          }
        }

        await setDoc(doc(db, "pengumuman", idDipakai), {
          judul: form.judul.trim(),
          isi: form.isi.trim(),
          rolesTampil: form.rolesTampil,
          mediaUrl: mediaUrlBaru,
          mediaType: mediaTypeBaru,
          dibuat_pada: serverTimestamp()
        }, { merge: true });
        alert(form.id ? "Pengumuman berhasil diperbarui!" : "Pengumuman baru berhasil dibuat!");
        formKosong();
        await muat();
      } catch (e) {
        console.error("Gagal simpan pengumuman:", e);
        alert("Gagal menyimpan pengumuman.");
      }
      mengupload.value = false;
      menyimpan.value = false;
    }

    async function hapus(item) {
      if (!confirm("Yakin ingin menghapus pengumuman ini?")) return;
      try {
        await deleteDoc(doc(db, "pengumuman", item.id));
        if (item.mediaUrl) {
          try { await deleteObject(storageRef(storage, item.mediaUrl)); } catch (e) { /* abaikan kalau file sudah tidak ada */ }
        }
        await muat();
      } catch (e) {
        console.error("Gagal hapus pengumuman:", e);
        alert("Gagal menghapus pengumuman.");
      }
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      daftarPengumuman, memuat, menyimpan, mengupload, form, DAFTAR_ROLE,
      fileTerpilih, previewUrl, pilihFile, hapusMediaTerpilih,
      toggleRole, edit, simpan, hapus, formKosong, muat
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-bullhorn" style="margin-right:8px;"></i> Config Info</h4>
        <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Kelola pengumuman yang tampil di Home — desktop maupun mobile. Kosongkan pilihan role = tampil untuk SEMUA orang.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;">{{ form.id ? 'Edit Pengumuman' : 'Buat Pengumuman Baru' }}</h3>
        <div class="gc-field">
          <label>Judul</label>
          <input v-model="form.judul" type="text" placeholder="Contoh: Libur Nasional 17 Agustus">
        </div>
        <div class="gc-field">
          <label>Isi Pengumuman</label>
          <textarea v-model="form.isi" rows="3" placeholder="Contoh: Gudang tutup, absensi otomatis libur."></textarea>
        </div>
        <div class="gc-field">
          <label>Lampiran Gambar/Video (opsional, maks 1MB)</label>
          <div v-if="previewUrl || form.mediaUrl" style="position:relative; width:100%; max-width:320px; aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:var(--ivory-dim); margin-bottom:8px;">
            <video v-if="(fileTerpilih && fileTerpilih.type.startsWith('video/')) || form.mediaType === 'video'" :src="previewUrl || form.mediaUrl" controls style="width:100%; height:100%; object-fit:cover;"></video>
            <img v-else :src="previewUrl || form.mediaUrl" style="width:100%; height:100%; object-fit:cover;">
            <button @click="hapusMediaTerpilih" style="position:absolute; top:6px; right:6px; width:26px; height:26px; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; border:none; cursor:pointer;"><i class="fas fa-times" style="font-size:11px;"></i></button>
          </div>
          <input type="file" accept="image/*,video/*" @change="pilihFile" style="font-size:12px;">
          <p style="font-size:10.5px; color:var(--text-faint); margin-top:4px;">Ditampilkan dengan rasio 16:9 tetap, proporsional otomatis di desktop maupun mobile.</p>
        </div>
        <div class="gc-field">
          <label>Tampil untuk Role (kosongkan = semua)</label>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <label v-for="r in DAFTAR_ROLE" :key="r" style="display:flex; align-items:center; gap:6px; background:var(--ivory-dim); padding:8px 12px; border-radius:10px; font-size:12px; cursor:pointer; text-transform:uppercase; font-weight:700;">
              <input type="checkbox" :checked="form.rolesTampil.includes(r)" @change="toggleRole(r)" style="accent-color:var(--burgundy);">
              {{ r }}
            </label>
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:14px;">
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1;">
            <i class="fas fa-save" style="margin-right:8px;"></i> {{ mengupload ? 'Mengupload media...' : (menyimpan ? 'Menyimpan...' : (form.id ? 'Update Pengumuman' : 'Simpan Pengumuman')) }}
          </button>
          <button v-if="form.id" @click="formKosong" class="btn-outline">Batal Edit</button>
        </div>
      </div>

      <div class="gc-card">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">Daftar Pengumuman</h3>
          <button @click="muat" class="icon-btn"><i class="fas fa-sync-alt"></i></button>
        </div>
        <div v-if="memuat" style="text-align:center; padding:24px 0; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <div v-else-if="daftarPengumuman.length === 0" style="text-align:center; padding:24px 0; color:var(--text-faint); font-size:12px;">Belum ada pengumuman.</div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="p in daftarPengumuman" :key="p.id" style="border:1px solid var(--line); border-radius:14px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
              <div v-if="p.mediaUrl" style="width:64px; height:36px; border-radius:8px; overflow:hidden; flex-shrink:0; background:var(--ivory-dim);">
                <video v-if="p.mediaType === 'video'" :src="p.mediaUrl" style="width:100%; height:100%; object-fit:cover;"></video>
                <img v-else :src="p.mediaUrl" style="width:100%; height:100%; object-fit:cover;">
              </div>
              <div style="flex:1;">
                <b style="font-size:13px;">{{ p.judul }}</b>
                <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">{{ p.isi }}</p>
                <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;">
                  <span v-if="!p.rolesTampil || p.rolesTampil.length === 0" class="tag neutral">Semua role</span>
                  <span v-else v-for="r in p.rolesTampil" :key="r" class="tag pink" style="text-transform:uppercase;">{{ r }}</span>
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button @click="edit(p)" class="icon-btn"><i class="fas fa-pen"></i></button>
                <button @click="hapus(p)" class="icon-btn" style="color:var(--danger);"><i class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

let vmConfigInfo = null;
window.pastikanMountConfigInfo = function() {
  if (vmConfigInfo) return;
  const mountPoint = document.getElementById('vue-config-info');
  if (mountPoint) vmConfigInfo = createApp(AppConfigInfo).mount('#vue-config-info');
};
window.refreshConfigInfo = function() { if (vmConfigInfo) vmConfigInfo.muat(); };
