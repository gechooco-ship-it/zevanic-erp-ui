// js/vue-daftar-karyawan.js
// ============================================================================
// Halaman KETIGA yang dimigrasi ke Vue: Master Karyawan > Daftar Karyawan
// (tabel 8 kolom) + modal Edit Karyawan. Dimigrasi bareng karena keduanya
// saling terikat erat (tombol Edit di tabel membuka modal ini).
//
// Koleksi Firestore "users" dan "master_gudang" dibaca langsung dengan skema
// field yang SAMA PERSIS seperti versi lama — supaya Antrean Dakar,
// Penjadwalan, dan layar lain yang belum dimigrasi tetap jalan normal.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DuaBaris, GudangCheckboxSelect, GudangRingkas } from './vue-components.js';
import { usePaginasiFirestore } from './vue-paginasi.js';

// Field kosong default untuk form edit (dipakai untuk reset & memastikan
// semua field ke-cover, sama seperti window.bukaEditUser versi lama).
function formKosong() {
  return {
    emailAsli: '', nama: '', email: '', fotoKtp: '',
    role: 'operator', jenisPekerjaan: '', jabatan: '',
    statusKerja: 'Aktif', statusKaryawan: '', statusApproval: 'APPROVED',
    gudang: [],
    nik: '', gender: '', tempatLahir: '', tglLahir: '', hp: '',
    tinggalKab: '', tinggalKec: '', tinggalDetail: '',
    ktpKab: '', ktpKec: '', ktpDetail: '',
    statusNikah: '', tanggungan: '', pendidikan: '', sekolah: '', jurusan: '',
    bank: '', noRek: '', atasNamaRek: '',
    daruratNama: '', daruratHp: '', daruratHub: ''
  };
}

const EditKaryawanModal = {
  components: { GudangCheckboxSelect },
  props: {
    emailId: { type: String, default: null }
  },
  emits: ['tutup', 'tersimpan'],
  setup(props, { emit }) {
    const form = reactive(formKosong());
    const menyimpan = ref(false);
    const opsiRole = ref([]);
    // petaTingkatKeamanan: nama profil (form.role, bisa custom) -> tingkat
    // keamanan baku. Sama persis pola yang dipakai vue-hak-akses.js —
    // lihat penjelasan lengkap di vue-config-akses.js.
    const petaTingkatKeamanan = reactive({});
    const opsiJenisPekerjaan = ref([]);
    const opsiJabatan = ref([]);
    const opsiStatusKerja = ref([]);
    const opsiStatusKaryawan = ref([]);

    async function muatOpsiMaster() {
      // Sinkron dengan Config Akses & Hak Akses — dulu ambil dari Master
      // Data "status_pengguna" (Config Karyawan), sekarang dari koleksi
      // akses_config yang SAMA dipakai keduanya, biar 1 sumber kebenaran
      // saja untuk "role apa saja yang ada" di SELURUH aplikasi.
      try {
        const qProfil = await getDocs(collection(db, "akses_config"));
        const namaProfil = [];
        petaTingkatKeamanan.operator = 'operator';
        petaTingkatKeamanan.pic = 'pic';
        petaTingkatKeamanan.admin = 'admin';
        petaTingkatKeamanan.owner = 'owner';
        petaTingkatKeamanan.superuser = 'superuser';
        const bakuMinimal = ['operator', 'pic', 'admin', 'owner', 'superuser'];
        qProfil.forEach(d => {
          namaProfil.push(d.id);
          const data = d.data();
          petaTingkatKeamanan[d.id] = data.tingkatKeamanan || (bakuMinimal.includes(d.id) ? d.id : 'operator');
        });
        opsiRole.value = [...new Set([...bakuMinimal, ...namaProfil])].sort();
      } catch (e) {
        console.error("Gagal sinkron daftar role dari Config Akses:", e);
        opsiRole.value = ['operator', 'pic', 'admin', 'owner', 'superuser'];
      }
      opsiJenisPekerjaan.value = await window.ambilMasterList('jenis_pekerjaan');
      opsiJabatan.value = await window.ambilMasterList('jabatan');
      opsiStatusKerja.value = await window.ambilMasterList('status_kerja');
      opsiStatusKaryawan.value = await window.ambilMasterList('status_karyawan');
    }

    // Pastikan nilai tersimpan tetap muncul di dropdown meski sudah dihapus
    // dari Master Data (supaya data lama tidak "hilang" dari layar).
    function pastikanAdaDiOpsi(opsiRef, nilai) {
      if (nilai && !opsiRef.value.includes(nilai)) opsiRef.value = [...opsiRef.value, nilai];
    }

    async function muatDataKaryawan(emailId) {
      if (!emailId) return;
      const snap = await getDoc(doc(db, 'users', emailId));
      if (!snap.exists()) { alert('Data karyawan tidak ditemukan!'); emit('tutup'); return; }
      const d = snap.data();

      Object.assign(form, {
        emailAsli: emailId,
        nama: d.nama || '',
        email: d.email || '',
        fotoKtp: d.foto_ktp || '',
        role: d.profil_akses || d.role || 'operator',
        jenisPekerjaan: d.jenis_pekerjaan || '',
        jabatan: d.jabatan || '',
        statusKerja: d.status_kerja === 'aktif' ? 'Aktif' : (d.status_kerja || 'Aktif'),
        statusKaryawan: d.status_karyawan || '',
        statusApproval: d.status_approval || 'APPROVED',
        gudang: window.normalisasiGudang(d.gudang_penempatan),
        nik: d.nik || '',
        gender: d.gender || d.jk || '',
        tempatLahir: d.tempatLahir || '',
        tglLahir: d.tglLahir || d.tgl || '',
        hp: d.hp || '',
        tinggalKab: d.tinggalKab || d.domisiliKab || '',
        tinggalKec: d.tinggalKec || d.domisiliKec || '',
        tinggalDetail: d.tinggalDetail || d.domisiliDetail || '',
        ktpKab: d.ktpKab || '',
        ktpKec: d.ktpKec || '',
        ktpDetail: d.ktpDetail || '',
        statusNikah: d.statusNikah || d.nikah || '',
        tanggungan: d.tanggungan || '',
        pendidikan: d.pendidikan || '',
        sekolah: d.sekolah || '',
        jurusan: d.jurusan || '',
        bank: d.bank || '',
        noRek: d.noRek || d.norek || '',
        atasNamaRek: d.atasNamaRek || d.namarek || '',
        daruratNama: d.daruratNama || '',
        daruratHp: d.daruratHp || '',
        daruratHub: d.daruratHub || ''
      });

      await muatOpsiMaster();
      pastikanAdaDiOpsi(opsiRole, form.role);
      pastikanAdaDiOpsi(opsiJenisPekerjaan, form.jenisPekerjaan);
      pastikanAdaDiOpsi(opsiJabatan, form.jabatan);
      pastikanAdaDiOpsi(opsiStatusKerja, form.statusKerja);
      pastikanAdaDiOpsi(opsiStatusKaryawan, form.statusKaryawan);
    }

    async function simpan() {
      menyimpan.value = true;
      try {
        // form.role sebenarnya NAMA PROFIL (bisa custom, mis.
        // "admin_finance") — WAJIB tulis 2 field terpisah: "role" (tingkat
        // keamanan baku, dicari dari petaTingkatKeamanan, dipakai
        // Firestore Rules) dan "profil_akses" (nama aslinya, dipakai cari
        // izin tampilan). Lihat penjelasan lengkap di vue-config-akses.js.
        const tingkat = petaTingkatKeamanan[form.role] || 'operator';
        await updateDoc(doc(db, 'users', form.emailAsli), {
          role: tingkat,
          profil_akses: form.role,
          jenis_pekerjaan: form.jenisPekerjaan,
          jabatan: form.jabatan,
          status_kerja: form.statusKerja,
          status_karyawan: form.statusKaryawan,
          status_approval: form.statusApproval,
          gudang_penempatan: form.gudang,

          nik: form.nik,
          gender: form.gender,
          tempatLahir: form.tempatLahir,
          tglLahir: form.tglLahir,
          hp: form.hp,

          tinggalKab: form.tinggalKab,
          tinggalKec: form.tinggalKec,
          tinggalDetail: form.tinggalDetail,

          ktpKab: form.ktpKab,
          ktpKec: form.ktpKec,
          ktpDetail: form.ktpDetail,

          statusNikah: form.statusNikah,
          tanggungan: form.tanggungan,
          pendidikan: form.pendidikan,
          sekolah: form.sekolah,
          jurusan: form.jurusan,

          bank: form.bank,
          noRek: form.noRek,
          atasNamaRek: form.atasNamaRek,

          daruratNama: form.daruratNama,
          daruratHp: form.daruratHp,
          daruratHub: form.daruratHub
        });
        alert('Data karyawan berhasil diperbarui!');
        emit('tersimpan');
      } catch (e) {
        console.error('Gagal update karyawan:', e);
        alert('Terjadi kesalahan saat mengupdate data.');
      }
      menyimpan.value = false;
    }

    function lihatFotoBesar() {
      if (form.fotoKtp && window.bukaPreviewFoto) window.bukaPreviewFoto(form.fotoKtp);
    }

    watch(() => props.emailId, (emailId) => {
      Object.assign(form, formKosong());
      if (emailId) muatDataKaryawan(emailId);
    }, { immediate: true });

    return { form, menyimpan, opsiRole, opsiJenisPekerjaan, opsiJabatan, opsiStatusKerja, opsiStatusKaryawan, simpan, lihatFotoBesar };
  },
  template: `
    <div style="position:fixed; inset:0; z-index:100; background:rgba(59,42,31,.6); display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); border-radius:22px; padding:24px; width:100%; max-width:560px; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:16px;">
          <h3 class="gc-heading" style="font-size:16px; font-weight:700;"><i class="fas fa-user-edit" style="color:var(--burgundy); margin-right:8px;"></i> Detail & edit karyawan</h3>
          <button @click="$emit('tutup')" style="background:none; border:none; color:var(--text-faint); font-size:20px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>

        <div style="font-size:13px;">
          <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:16px; background:var(--ivory-dim); padding:14px; border-radius:16px;">
            <span style="font-size:10px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px;">Dokumen KTP karyawan</span>
            <img v-if="form.fotoKtp" :src="form.fotoKtp" @click="lihatFotoBesar" style="height:128px; object-fit:cover; border-radius:12px; border:1px solid var(--line); cursor:pointer;" title="Klik untuk memperbesar KTP">
            <span v-else style="font-size:12px; color:var(--text-faint);">Belum ada foto KTP</span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;"><label>Nama karyawan</label><input :value="form.nama" readonly style="background:var(--ivory-dim); color:var(--text-muted); font-weight:700;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Email karyawan</label><input :value="form.email" readonly style="background:var(--ivory-dim); color:var(--text-muted);"></div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Status pengguna (role akses)</label>
              <select v-model="form.role"><option v-for="o in opsiRole" :key="o" :value="o">{{ o }}</option></select>
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Jenis pekerjaan</label>
              <select v-model="form.jenisPekerjaan"><option v-for="o in opsiJenisPekerjaan" :key="o" :value="o">{{ o }}</option></select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Jabatan</label>
              <select v-model="form.jabatan"><option v-for="o in opsiJabatan" :key="o" :value="o">{{ o }}</option></select>
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Status karyawan</label>
              <select v-model="form.statusKaryawan"><option v-for="o in opsiStatusKaryawan" :key="o" :value="o">{{ o }}</option></select>
            </div>
          </div>

          <div class="gc-field">
            <label>Status kerja</label>
            <select v-model="form.statusKerja"><option v-for="o in opsiStatusKerja" :key="o" :value="o">{{ o }}</option></select>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Status persetujuan</label>
              <select v-model="form.statusApproval">
                <option value="APPROVED">Disetujui (bisa login)</option>
                <option value="PENDING">Menunggu</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Gudang penempatan</label>
              <gudang-checkbox-select v-model="form.gudang" />
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Data pribadi</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>NIK</label><input v-model="form.nik"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Jenis kelamin</label><select v-model="form.gender"><option value="">-- Pilih --</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Tempat lahir</label><input v-model="form.tempatLahir"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Tanggal lahir</label><input v-model="form.tglLahir" type="date"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>No. HP / WhatsApp</label><input v-model="form.hp"></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Alamat domisili saat ini</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Kabupaten/kota</label><input v-model="form.tinggalKab"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kecamatan</label><input v-model="form.tinggalKec"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Detail alamat</label><textarea v-model="form.tinggalDetail" rows="2"></textarea></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Alamat sesuai KTP</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Kabupaten/kota</label><input v-model="form.ktpKab"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kecamatan</label><input v-model="form.ktpKec"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Detail alamat</label><textarea v-model="form.ktpDetail" rows="2"></textarea></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Pendidikan & keluarga</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Status pernikahan</label><select v-model="form.statusNikah"><option value="">-- Pilih --</option><option value="Belum Menikah">Belum Menikah</option><option value="Menikah">Menikah</option><option value="Cerai">Cerai</option></select></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Jumlah tanggungan</label><input v-model="form.tanggungan"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Pendidikan terakhir</label><input v-model="form.pendidikan"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Sekolah/kampus</label><input v-model="form.sekolah"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Jurusan</label><input v-model="form.jurusan"></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Rekening bank</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Nama bank</label><input v-model="form.bank"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>No. rekening</label><input v-model="form.noRek"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Atas nama rekening</label><input v-model="form.atasNamaRek"></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:16px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Kontak darurat</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Nama</label><input v-model="form.daruratNama"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Hubungan</label><input v-model="form.daruratHub"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>No. HP darurat</label><input v-model="form.daruratHp"></div>
            </div>
          </div>

          <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
            <i class="fas fa-save" style="margin-right:6px;"></i> {{ menyimpan ? 'Menyimpan...' : 'Simpan perubahan' }}
          </button>
        </div>
      </div>
    </div>
  `
};

const AppDaftarKaryawan = {
  components: { DuaBaris, EditKaryawanModal, GudangRingkas },
  setup() {
    const memuat = ref(true);
    // PENERAPAN NYATA Config Akses — tombol Hapus/Edit sembunyi kalau
    // izinnya memang tidak ada. Fallback aman: belum diatur = boleh.
    const bolehHapus = computed(() => window.cekIzinMenu('daftar_karyawan', 'delete') !== false);
    const bolehEdit = computed(() => window.cekIzinMenu('daftar_karyawan', 'edit') !== false);
    const emailSedangDiedit = ref(null);
    let petaJenisLokasi = {}; // diisi sekali sebelum muat halaman pertama

    async function muatPetaGudang() {
      const qGudang = await getDocs(collection(db, "master_gudang"));
      petaJenisLokasi = {};
      qGudang.forEach(g => { petaJenisLokasi[g.data().nama_gudang] = g.data().tipe_lokasi || 'Tetap'; });
    }

    // Paginasi Firestore SUNGGUHAN (composable bersama, lihat
    // js/vue-paginasi.js) — cuma tarik 15 karyawan per halaman dari
    // server, bukan tarik SEMUA lalu potong di JS seperti sebelumnya.
    // Diurutkan berdasarkan nama supaya urutannya stabil & masuk akal.
    const paginasi = reactive(usePaginasiFirestore(db, 'users', {
      perHalaman: 15,
      urutkanField: 'nama',
      filterPeran: true, // PEDOMAN KERJA (18 Agt 2026) - lihat vue-paginasi.js
      petakan: (id, d) => {
        const gudangList = window.normalisasiGudang(d.gudang_penempatan);
        const jenisLokasiList = [...new Set(gudangList.map(g => petaJenisLokasi[g] || '-'))];
        return {
          id, ...d,
          jenisLokasiGabungan: jenisLokasiList.join(', ') || '-',
          idGabungan: (d.id_karyawan || '-') + ' / ' + (d.id_app || '-')
        };
      }
    }));

    async function muat() {
      memuat.value = true;
      await muatPetaGudang();
      await paginasi.muatUlang();
      memuat.value = false;
    }

    async function hapus(emailId) {
      if (window.cekIzinMenu('daftar_karyawan', 'delete') === false) {
        return alert('Anda tidak punya izin menghapus karyawan. Hubungi Owner/PIC.');
      }
      if (!confirm(`Yakin ingin menghapus data karyawan "${emailId}" secara permanen? Data profil akan hilang dan tidak bisa dikembalikan.`)) return;
      try {
        await deleteDoc(doc(db, "users", emailId));
        alert("Data karyawan berhasil dihapus dari Daftar Karyawan.\n\nCatatan: akun login (Firebase Auth) orang ini masih ada di sistem terpisah. Kalau mau benar-benar diblokir dari login, hapus juga manual lewat Firebase Console > Authentication.");
        await muat();
      } catch (e) {
        console.error("Gagal menghapus karyawan:", e);
        alert("Gagal menghapus data karyawan.");
      }
    }

    function bukaEdit(emailId) {
      if (window.cekIzinMenu('daftar_karyawan', 'edit') === false) {
        return alert('Anda tidak punya izin mengedit karyawan. Hubungi Owner/PIC.');
      }
      emailSedangDiedit.value = emailId;
    }
    function tutupEdit() { emailSedangDiedit.value = null; }
    async function selesaiSimpan() { emailSedangDiedit.value = null; await muat(); }

    function badgeApproval(status) {
      if (status === 'PENDING') return { teks: 'MENUNGGU', kelas: 'warn' };
      if (status === 'REJECTED') return { teks: 'DITOLAK', kelas: 'danger' };
      return null;
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    onMounted(async () => { await window.authReady; muat(); });
    return { paginasi, memuat, emailSedangDiedit, muat, hapus, bukaEdit, tutupEdit, selesaiSimpan, badgeApproval, lihatFotoBesar, bolehHapus, bolehEdit };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-users" style="margin-right:8px;"></i> Daftar karyawan</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Master kontrol HR untuk edit role & status.</p>
      </div>
      <button @click="muat" class="btn-outline filled">Muat Data</button>
    </div>
    <div class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line); margin-top:16px;">
      <table class="gc-table">
        <thead>
          <tr>
            <th class="freeze freeze-left">Nama / ID</th>
            <th>Jenis Pekerjaan / Status Kerja</th>
            <th>KTP</th>
            <th>No HP / Email</th>
            <th>Jabatan / Status Karyawan</th>
            <th>Penempatan / Shift</th>
            <th>Role / Jenis Lokasi</th>
            <th class="freeze freeze-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="memuat"><td colspan="8" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat data user...</td></tr>
          <tr v-else-if="paginasi.errorPaginasi"><td colspan="8" style="text-align:center; padding:20px; color:var(--danger);">{{ paginasi.errorPaginasi }}</td></tr>
          <tr v-else-if="paginasi.dataHalaman.length === 0"><td colspan="8" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada data karyawan.</td></tr>
          <tr v-for="d in paginasi.dataHalaman" :key="d.id">
            <td class="freeze freeze-left">
              <dua-baris :a="d.nama" :b="d.idGabungan" />
              <span v-if="badgeApproval(d.status_approval)" class="tag" :class="badgeApproval(d.status_approval).kelas" style="margin-left:6px; padding:2px 8px; font-size:9px;">{{ badgeApproval(d.status_approval).teks }}</span>
            </td>
            <td><dua-baris :a="d.jenis_pekerjaan" :b="d.status_kerja" /></td>
            <td>
              <img v-if="d.foto_ktp" :src="d.foto_ktp" @click="lihatFotoBesar(d.foto_ktp)" style="width:48px; height:36px; border-radius:8px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
              <div v-else style="width:48px; height:36px; background:var(--ivory-dim); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--text-faint); font-size:11px;"><i class="fas fa-id-card"></i></div>
            </td>
            <td><dua-baris :a="d.hp" :b="d.email" /></td>
            <td><dua-baris :a="d.jabatan" :b="d.status_karyawan" /></td>
            <td>
              <gudang-ringkas :gudang="d.gudang_penempatan" :nama="d.nama" /><br>
              <span style="font-size:11px; color:var(--text-muted);">{{ d.nama_shift || '-' }}</span>
            </td>
            <td style="text-transform:uppercase;"><dua-baris :a="d.profil_akses || d.role" :b="d.jenisLokasiGabungan" /></td>
            <td class="freeze freeze-right">
              <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                <button v-if="bolehEdit" @click="bukaEdit(d.id)" class="icon-btn"><i class="fas fa-edit"></i></button>
                <button v-if="bolehHapus" @click="hapus(d.id)" class="icon-btn" style="color:var(--danger);"><i class="fas fa-trash-alt"></i></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; font-size:12px;">
      <span style="color:var(--text-faint);">Halaman {{ paginasi.nomorHalaman }}</span>
      <div style="display:flex; gap:8px;">
        <button @click="paginasi.halamanSebelumnya" :disabled="paginasi.nomorHalaman <= 1 || paginasi.memuat" class="icon-btn"><i class="fas fa-chevron-left"></i></button>
        <button @click="paginasi.halamanBerikutnya" :disabled="!paginasi.adaBerikutnya || paginasi.memuat" class="icon-btn"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>

    <edit-karyawan-modal v-if="emailSedangDiedit" :email-id="emailSedangDiedit" @tutup="tutupEdit" @tersimpan="selesaiSimpan" />
  `
};

let vmDaftarKaryawan = null;
// Perbaikan bug BESAR: komponen ini dulu langsung di-mount() begitu file ini
// dimuat (artinya SETIAP kali halaman dibuka, oleh SIAPAPUN, termasuk yang
// tidak punya akses ke layar ini) — onMounted-nya otomatis mencoba fetch
// Firestore walau orangnya tidak pernah membuka tab ini sama sekali. Itu
// yang bikin console penuh "Missing or insufficient permissions" dan baca
// Firestore boros. Sekarang mount() BARU terjadi saat dashboard.js
// pindahSubTab benar-benar memanggil window.pastikanMountDaftarKaryawan() —
// yaitu PERSIS saat tab ini pertama kali dibuka, bukan dari awal muat
// halaman.
window.pastikanMountDaftarKaryawan = function() {
  if (vmDaftarKaryawan) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-daftar-karyawan');
  if (mountPoint) vmDaftarKaryawan = createApp(AppDaftarKaryawan).mount('#vue-daftar-karyawan');
};
window.refreshDaftarKaryawan = function() { if (vmDaftarKaryawan) vmDaftarKaryawan.muat(); };
