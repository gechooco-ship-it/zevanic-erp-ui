// js/vue-antrean-dakar.js
// ============================================================================
// DIBANGUN ULANG (18 Agt 2026, sesi lanjutan) — versi SEBELUMNYA (baca dari
// "users" dengan status_approval=="PENDING", approve = updateDoc biasa)
// TERNYATA TIDAK PERNAH BERHASIL ter-push ke GitHub malam itu (lihat
// STATUS-PROYEK.md §3.5.5). File ini dibangun ulang dari SPESIFIKASI di
// STATUS-PROYEK.md §3.5.1/§3.5.2 — BELUM PERNAH DITES sama sekali, WAJIB
// dites end-to-end sebelum dipakai karyawan sungguhan.
//
// ALUR BARU: baca dari koleksi "pendaftaran_pending" (BUKAN "users" lagi
// — di alur baru, TIDAK ADA akun Auth/dokumen users sampai di-approve di
// sini). "Setujui" -> bikin akun Firebase Auth baru (password sementara =
// NIK) LEWAT INSTANCE FIREBASE KEDUA (supaya sesi Admin yang sedang login
// tidak ikut ter-logout), lalu tulis profil lengkap ke users/{email},
// hapus dokumen pending, kirim email cara login. "Tolak" -> hapus dokumen
// pending saja (tidak ada akun Auth yang perlu dibersihkan, karena memang
// belum pernah dibuat).
//
// TEKNIS PALING BERISIKO di file ini — instance Firebase KEDUA:
// createUserWithEmailAndPassword() BAWAANNYA otomatis login sebagai akun
// yang BARU dibuat. Kalau dipanggil di instance yang SAMA dengan sesi
// Admin (instance utama, firebase-config.js), Admin akan "terlempar"
// logout dari akunnya sendiri, jadi login sebagai karyawan baru itu.
// Solusinya: bikin instance Firebase KEDUA (initializeApp(firebaseConfig,
// "nama-unik"), config yang SAMA tapi instance terpisah total), pakai
// instance itu KHUSUS buat bikin akun, lalu BUANG instance itu
// (deleteApp). Sesi Admin di instance UTAMA sama sekali tidak tersentuh.
//
// Dipakai ulang: GudangCheckboxSelect (vue-components.js).
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, firebaseConfig } from "./firebase-config.js";
import { GudangCheckboxSelect } from './vue-components.js';

// Bikin akun Auth baru TANPA mengganggu sesi Admin yang sedang aktif di
// instance utama — lihat catatan panjang di atas file ini kenapa perlu
// begini.
async function buatAkunTanpaGangguSesi(email, passwordSementara) {
  const namaInstance = 'akun-baru-' + Date.now();
  const appKedua = initializeApp(firebaseConfig, namaInstance);
  const authKedua = getAuth(appKedua);
  try {
    await createUserWithEmailAndPassword(authKedua, email, passwordSementara);
    await signOut(authKedua); // jaga-jaga, walau instance ini akan dibuang juga
    return { sukses: true };
  } catch (e) {
    console.error("Gagal membuat akun Auth baru:", e);
    return { sukses: false, error: e };
  } finally {
    await deleteApp(appKedua); // buang instance kedua, sudah tidak dipakai lagi
  }
}

const AntreanDakarCard = {
  components: { GudangCheckboxSelect },
  props: {
    emailId: { type: String, required: true },
    data: { type: Object, required: true }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    const form = reactive({
      statusKerja: 'Aktif',
      shift: '',
      jabatan: '',
      statusKaryawan: '',
      gudang: []
    });
    const opsiStatusKerja = ref([]);
    const daftarShift = ref([]);
    const opsiJabatan = ref([]);
    const opsiStatusKaryawan = ref([]);
    const memproses = ref(false);

    async function muatOpsi() {
      opsiStatusKerja.value = await window.ambilMasterList('status_kerja');
      const qShift = await getDocs(collection(db, "master_shift"));
      const listShift = [];
      qShift.forEach(docSnap => listShift.push(docSnap.data()));
      daftarShift.value = listShift;
      opsiJabatan.value = await window.ambilMasterList('jabatan');
      opsiStatusKaryawan.value = await window.ambilMasterList('status_karyawan');

      form.statusKerja = opsiStatusKerja.value.includes('Aktif') ? 'Aktif' : (opsiStatusKerja.value[0] || '');
      form.shift = daftarShift.value[0]?.nama_shift || '';
      form.jabatan = opsiJabatan.value[0] || '';
      form.statusKaryawan = opsiStatusKaryawan.value[0] || '';
    }

    function lihatFotoBesar() {
      if (props.data.foto_ktp && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_ktp);
    }

    async function setujui() {
      if (window.cekIzinMenu('antrean_dakar', 'add') === false) {
        return alert('Anda tidak punya izin menyetujui karyawan baru. Hubungi Owner/PIC.');
      }
      if (form.gudang.length === 0) {
        if (!confirm("Belum ada gudang dipilih. Karyawan ini TIDAK akan bisa login sampai gudang ditautkan (bisa diatur lagi lewat Daftar Karyawan > Edit). Lanjutkan?")) return;
      }
      const nikSementara = (props.data.nik || '').trim();
      if (!/^\d{6,}$/.test(nikSementara)) {
        return alert("NIK karyawan ini tidak valid untuk dipakai sebagai password sementara (kosong/kurang dari 6 digit). Tolak pendaftaran ini dan minta karyawan daftar ulang dengan NIK yang benar.");
      }

      memproses.value = true;
      try {
        // 1. Bikin akun Auth DULU (lewat instance kedua) — kalau ini
        // gagal, dokumen pending TIDAK disentuh sama sekali, aman dicoba
        // lagi tanpa ada apapun yang perlu dibersihkan.
        const hasilAkun = await buatAkunTanpaGangguSesi(props.emailId, nikSementara);
        if (!hasilAkun.sukses) {
          const kode = hasilAkun.error?.code;
          if (kode === 'auth/email-already-in-use') {
            alert("Gagal: email ini SUDAH punya akun login (kemungkinan sisa dari sistem lama, atau percobaan approve sebelumnya sempat berhasil bikin akun tapi gagal di langkah berikutnya). Cek manual dulu di Firebase Console > Authentication sebelum coba approve lagi — JANGAN diulang berkali-kali.");
          } else {
            alert("Gagal membuat akun login untuk karyawan ini: " + (hasilAkun.error?.message || 'error tidak diketahui') + ". Data pendaftaran TIDAK terhapus, aman dicoba lagi.");
          }
          memproses.value = false;
          return;
        }

        // 2. Akun Auth sudah pasti berhasil dibuat -> baru tulis profil
        // lengkap ke "users" (gabungan data pendaftaran + isian Admin di
        // sini) dan hapus dokumen pending.
        await setDoc(doc(db, "users", props.emailId), {
          ...props.data,
          status_kerja: form.statusKerja,
          nama_shift: form.shift,
          // Role SENGAJA hardcode "operator" di sini — supaya siapapun
          // yang approve tidak bisa memberi akses lebih tinggi ke akun
          // baru. Role cuma bisa dinaikkan Owner lewat Hak Akses,
          // setelah karyawan ini beneran aktif.
          role: "operator",
          jabatan: form.jabatan,
          status_karyawan: form.statusKaryawan,
          gudang_penempatan: form.gudang,
          status_approval: "APPROVED",
          wajib_ganti_password: true,
          disetujui_pada: serverTimestamp(),
          disetujui_oleh: window.currentUser.name || window.currentUser.email
        });
        await deleteDoc(doc(db, "pendaftaran_pending", props.emailId));

        // 3. Notifikasi email cara login (best-effort — kalau gagal
        // kirim, akun & profil TETAP sudah jadi, cuma emailnya yang
        // perlu dikirim manual/ulang). Template bisa diedit Owner lewat
        // Mail Gateway > Template Pesan (bagian "Aktivasi Akun").
        try {
          let tpl = {};
          try {
            const snapTpl = await getDoc(doc(db, "config", "mail_templates"));
            tpl = snapTpl.exists() ? snapTpl.data() : {};
          } catch (e) { /* pakai fallback baku di bawah */ }
          const subjek = tpl.subjek_aktivasi || "Akun Zevanic ERP Anda Sudah Aktif";
          const isiTemplat = tpl.isi_aktivasi || "Halo {nama},\n\nAkun Zevanic ERP Anda sudah disetujui dan aktif.\n\nLogin di gechoo.online dengan:\nEmail: {email}\nPassword sementara: {password}\n\nAnda akan diminta mengganti password ini saat login pertama kali.";
          const isiEmail = isiTemplat
            .replace(/\{nama\}/g, props.data.nama || '')
            .replace(/\{email\}/g, props.emailId)
            .replace(/\{password\}/g, nikSementara);
          await addDoc(collection(db, "mail"), {
            to: [props.emailId],
            message: { subject: subjek, text: isiEmail },
            dikirim_pada: serverTimestamp()
          });
        } catch (e) {
          console.error("Gagal kirim email aktivasi (akun & profil TETAP berhasil dibuat):", e);
        }

        alert("Karyawan berhasil disetujui & diaktifkan! Email berisi cara login sudah dikirim ke " + props.emailId + ".");
        emit('diproses');
      } catch (e) {
        console.error("Gagal menyetujui karyawan:", e);
        alert("Terjadi kesalahan saat menyimpan persetujuan. Kalau akun login SUDAH sempat dibuat (cek Firebase Console > Authentication), mungkin perlu dihapus manual dulu supaya bisa dicoba approve lagi dari sini.");
      }
      memproses.value = false;
    }

    async function tolak() {
      if (window.cekIzinMenu('antrean_dakar', 'delete') === false) {
        return alert('Anda tidak punya izin menolak pendaftaran. Hubungi Owner/PIC.');
      }
      if (!confirm("Tolak pendaftaran karyawan ini? Data pendaftaran akan DIHAPUS PERMANEN (belum ada akun login yang perlu dibersihkan, karena memang belum pernah dibuat di alur ini).")) return;
      memproses.value = true;
      try {
        await deleteDoc(doc(db, "pendaftaran_pending", props.emailId));
        alert("Pendaftaran ditolak & dihapus.");
        emit('diproses');
      } catch (e) {
        console.error("Gagal menolak:", e);
        alert("Gagal memproses penolakan.");
      }
      memproses.value = false;
    }

    onMounted(async () => { await window.authReady; muatOpsi(); });
    return { form, opsiStatusKerja, daftarShift, opsiJabatan, opsiStatusKaryawan, memproses, lihatFotoBesar, setujui, tolak };
  },
  template: `
    <div class="gc-card">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
        <img v-if="data.foto_ktp" :src="data.foto_ktp" @click="lihatFotoBesar" style="width:64px; height:48px; border-radius:10px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
        <div v-else style="width:64px; height:48px; background:var(--ivory-dim); border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--text-faint);"><i class="fas fa-id-card"></i></div>
        <div>
          <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ data.nama || 'Tanpa Nama' }}</h4>
          <p style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif;">{{ data.email || emailId }} &bull; {{ data.hp || '-' }}</p>
          <p style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif;">NIK: {{ data.nik || '-' }}</p>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Status kerja</label>
          <select v-model="form.statusKerja" style="padding:7px 10px; font-size:12px;">
            <option v-for="o in opsiStatusKerja" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Jadwal shift</label>
          <select v-model="form.shift" style="padding:7px 10px; font-size:12px;">
            <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }} ({{ s.jam_masuk }} - {{ s.jam_keluar }})</option>
          </select>
        </div>
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Jabatan</label>
          <select v-model="form.jabatan" style="padding:7px 10px; font-size:12px;">
            <option v-for="o in opsiJabatan" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Status karyawan</label>
          <select v-model="form.statusKaryawan" style="padding:7px 10px; font-size:12px;">
            <option v-for="o in opsiStatusKaryawan" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
      </div>
      <div class="gc-field">
        <label style="font-size:10.5px;">Gudang penempatan (bisa lebih dari satu)</label>
        <gudang-checkbox-select v-model="form.gudang" />
      </div>
      <div style="display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--line);">
        <button @click="setujui" :disabled="memproses" class="btn-acc" style="flex:1;">
          <i class="fas fa-check-circle" style="margin-right:6px;"></i> {{ memproses ? 'Memproses...' : 'Setujui & aktifkan' }}
        </button>
        <button @click="tolak" :disabled="memproses" class="btn-rej">
          <i class="fas fa-times"></i> Tolak
        </button>
      </div>
    </div>
  `
};

const AppAntreanDakar = {
  components: { AntreanDakarCard },
  setup() {
    const daftarPending = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const snap = await getDocs(collection(db, "pendaftaran_pending"));
        const list = [];
        snap.forEach(docSnap => list.push({ id: docSnap.id, data: docSnap.data() }));
        daftarPending.value = list;
      } catch (e) {
        console.error("Gagal memuat antrean pendaftaran:", e);
        errorMuat.value = 'Gagal memuat data (' + (e.code || e.message) + '). Kemungkinan izin akses (role Anda) belum ter-refresh — coba Logout lalu Login lagi.';
      }
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarPending, memuat, errorMuat, muat };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-user-clock" style="margin-right:8px;"></i> Antrean persetujuan karyawan baru</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Pendaftar baru TIDAK punya akun login sama sekali sampai disetujui & dilengkapi datanya di sini.</p>
      </div>
      <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
    </div>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px; margin-top:16px;">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i>Memuat antrean karyawan baru...
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; margin-top:16px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px; margin-top:16px;">
      <i class="fas fa-user-check" style="font-size:34px; color:var(--ok); margin-bottom:10px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada antrean</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Semua pendaftar sudah diproses.</p>
    </div>
    <div v-else style="gap:14px; margin-top:16px;" class="grid grid-cols-1 md:grid-cols-2">
      <antrean-dakar-card v-for="item in daftarPending" :key="item.id" :email-id="item.id" :data="item.data" @diproses="muat" />
    </div>
  `
};

let vmAntreanDakar = null;
// Perbaikan bug BESAR (dipertahankan dari versi lama): komponen ini BARU
// di-mount() saat dashboard.js pindahSubTab benar-benar memanggil
// window.pastikanMountAntreanDakar() — PERSIS saat tab ini pertama kali
// dibuka, bukan dari awal muat halaman.
window.pastikanMountAntreanDakar = function() {
  if (vmAntreanDakar) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-antrean-dakar');
  if (mountPoint) vmAntreanDakar = createApp(AppAntreanDakar).mount('#vue-antrean-dakar');
};
window.refreshAntreanDakar = function() { if (vmAntreanDakar) vmAntreanDakar.muat(); };
