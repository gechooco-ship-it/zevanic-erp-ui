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
import { createApp, ref, reactive, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DuaBaris, GudangCheckboxSelect } from './vue-components.js';

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
    const opsiJenisPekerjaan = ref([]);
    const opsiJabatan = ref([]);
    const opsiStatusKerja = ref([]);
    const opsiStatusKaryawan = ref([]);

    async function muatOpsiMaster() {
      opsiRole.value = await window.ambilMasterList('status_pengguna');
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
        role: d.role || 'operator',
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
        await updateDoc(doc(db, 'users', form.emailAsli), {
          role: form.role,
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
    <div class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 fade-in">
      <div class="bg-white rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="flex justify-between items-center border-b pb-3 mb-4">
          <h3 class="text-lg font-bold text-gray-800"><i class="fas fa-user-edit text-blue-600 mr-2"></i> Detail & Edit Karyawan</h3>
          <button @click="$emit('tutup')" class="text-gray-400 hover:text-red-500"><i class="fas fa-times text-xl"></i></button>
        </div>

        <div class="space-y-4 text-sm">
          <div class="flex flex-col items-center mb-4 bg-gray-50 py-3 rounded-xl border border-gray-100">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Dokumen KTP Karyawan</span>
            <img v-if="form.fotoKtp" :src="form.fotoKtp" @click="lihatFotoBesar" class="h-32 object-cover rounded-lg border shadow-sm cursor-pointer hover:scale-105 transition" title="Klik untuk memperbesar KTP">
            <span v-else class="text-xs text-gray-400">Belum ada foto KTP</span>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs font-semibold text-gray-500 mb-1">Nama Karyawan</label><input :value="form.nama" readonly class="w-full px-3 py-2 bg-gray-100 border rounded-lg font-bold text-gray-600 outline-none"></div>
            <div><label class="block text-xs font-semibold text-gray-500 mb-1">Email Karyawan</label><input :value="form.email" readonly class="w-full px-3 py-2 bg-gray-100 border rounded-lg text-gray-600 outline-none"></div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Status Pengguna (Role Akses)</label>
              <select v-model="form.role" class="w-full px-3 py-2 bg-white border focus:ring-2 focus:ring-blue-500 rounded-lg outline-none">
                <option v-for="o in opsiRole" :key="o" :value="o">{{ o }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Jenis Pekerjaan</label>
              <select v-model="form.jenisPekerjaan" class="w-full px-3 py-2 bg-white border focus:ring-2 focus:ring-blue-500 rounded-lg outline-none">
                <option v-for="o in opsiJenisPekerjaan" :key="o" :value="o">{{ o }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Jabatan</label>
              <select v-model="form.jabatan" class="w-full px-3 py-2 bg-white border focus:ring-2 focus:ring-blue-500 rounded-lg outline-none">
                <option v-for="o in opsiJabatan" :key="o" :value="o">{{ o }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Status Karyawan</label>
              <select v-model="form.statusKaryawan" class="w-full px-3 py-2 bg-white border focus:ring-2 focus:ring-blue-500 rounded-lg outline-none">
                <option v-for="o in opsiStatusKaryawan" :key="o" :value="o">{{ o }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1">Status Kerja</label>
            <select v-model="form.statusKerja" class="w-full px-3 py-2 bg-white border focus:ring-2 focus:ring-blue-500 rounded-lg outline-none">
              <option v-for="o in opsiStatusKerja" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Status Persetujuan</label>
              <select v-model="form.statusApproval" class="w-full px-3 py-2 bg-white border focus:ring-2 focus:ring-blue-500 rounded-lg outline-none">
                <option value="APPROVED">Disetujui (bisa login)</option>
                <option value="PENDING">Menunggu</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Gudang Penempatan</label>
              <gudang-checkbox-select v-model="form.gudang" />
            </div>
          </div>

          <div class="pt-3 border-t space-y-3">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Data Pribadi</h4>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">NIK</label><input v-model="form.nik" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Jenis Kelamin</label><select v-model="form.gender" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Pilih --</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Tempat Lahir</label><input v-model="form.tempatLahir" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Tanggal Lahir</label><input v-model="form.tglLahir" type="date" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div class="col-span-2"><label class="block text-xs font-semibold text-gray-500 mb-1">No. HP / WhatsApp</label><input v-model="form.hp" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
            </div>
          </div>

          <div class="pt-3 border-t space-y-3">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Alamat Domisili Saat Ini</h4>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Kabupaten/Kota</label><input v-model="form.tinggalKab" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Kecamatan</label><input v-model="form.tinggalKec" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div class="col-span-2"><label class="block text-xs font-semibold text-gray-500 mb-1">Detail Alamat</label><textarea v-model="form.tinggalDetail" rows="2" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea></div>
            </div>
          </div>

          <div class="pt-3 border-t space-y-3">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Alamat Sesuai KTP</h4>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Kabupaten/Kota</label><input v-model="form.ktpKab" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Kecamatan</label><input v-model="form.ktpKec" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div class="col-span-2"><label class="block text-xs font-semibold text-gray-500 mb-1">Detail Alamat</label><textarea v-model="form.ktpDetail" rows="2" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea></div>
            </div>
          </div>

          <div class="pt-3 border-t space-y-3">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Pendidikan & Keluarga</h4>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Status Pernikahan</label><select v-model="form.statusNikah" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Pilih --</option><option value="Belum Menikah">Belum Menikah</option><option value="Menikah">Menikah</option><option value="Cerai">Cerai</option></select></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Jumlah Tanggungan</label><input v-model="form.tanggungan" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Pendidikan Terakhir</label><input v-model="form.pendidikan" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Sekolah/Kampus</label><input v-model="form.sekolah" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div class="col-span-2"><label class="block text-xs font-semibold text-gray-500 mb-1">Jurusan</label><input v-model="form.jurusan" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
            </div>
          </div>

          <div class="pt-3 border-t space-y-3">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Rekening Bank</h4>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Nama Bank</label><input v-model="form.bank" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">No. Rekening</label><input v-model="form.noRek" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div class="col-span-2"><label class="block text-xs font-semibold text-gray-500 mb-1">Atas Nama Rekening</label><input v-model="form.atasNamaRek" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
            </div>
          </div>

          <div class="pt-3 border-t space-y-3">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Kontak Darurat</h4>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Nama</label><input v-model="form.daruratNama" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block text-xs font-semibold text-gray-500 mb-1">Hubungan</label><input v-model="form.daruratHub" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div class="col-span-2"><label class="block text-xs font-semibold text-gray-500 mb-1">No. HP Darurat</label><input v-model="form.daruratHp" class="w-full px-3 py-2 bg-white border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"></div>
            </div>
          </div>

          <button @click="simpan" :disabled="menyimpan" class="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition active:scale-95 mt-4 disabled:opacity-50">
            <i class="fas fa-save mr-1"></i> {{ menyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>
  `
};

const AppDaftarKaryawan = {
  components: { DuaBaris, EditKaryawanModal },
  setup() {
    const daftarKaryawan = ref([]);
    const memuat = ref(true);
    const emailSedangDiedit = ref(null);

    async function muat() {
      memuat.value = true;
      const qGudang = await getDocs(collection(db, "master_gudang"));
      const petaJenisLokasi = {};
      qGudang.forEach(g => { petaJenisLokasi[g.data().nama_gudang] = g.data().tipe_lokasi || 'Tetap'; });

      const qUsers = await getDocs(collection(db, "users"));
      const list = [];
      qUsers.forEach(docSnap => {
        const d = docSnap.data();
        const gudangList = window.normalisasiGudang(d.gudang_penempatan);
        const jenisLokasiList = [...new Set(gudangList.map(g => petaJenisLokasi[g] || '-'))];
        list.push({
          id: docSnap.id, ...d,
          gudangGabungan: gudangList.join(', ') || '-',
          jenisLokasiGabungan: jenisLokasiList.join(', ') || '-',
          idGabungan: (d.id_karyawan || '-') + ' / ' + (d.id_app || '-')
        });
      });
      daftarKaryawan.value = list;
      memuat.value = false;
    }

    async function hapus(emailId) {
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

    function bukaEdit(emailId) { emailSedangDiedit.value = emailId; }
    function tutupEdit() { emailSedangDiedit.value = null; }
    async function selesaiSimpan() { emailSedangDiedit.value = null; await muat(); }

    function badgeApproval(status) {
      if (status === 'PENDING') return { teks: 'MENUNGGU', kelas: 'bg-yellow-100 text-yellow-700' };
      if (status === 'REJECTED') return { teks: 'DITOLAK', kelas: 'bg-red-100 text-red-700' };
      return null;
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    onMounted(muat);
    return { daftarKaryawan, memuat, emailSedangDiedit, muat, hapus, bukaEdit, tutupEdit, selesaiSimpan, badgeApproval, lihatFotoBesar };
  },
  template: `
    <div class="bg-red-50 border border-red-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
      <div>
        <h3 class="text-sm font-bold text-red-700 mb-0.5"><i class="fas fa-users mr-2"></i> Daftar Karyawan</h3>
        <p class="text-[10px] text-red-600">Master kontrol HR untuk Edit Role & Status.</p>
      </div>
      <button @click="muat" class="bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-red-700 transition">Muat Data</button>
    </div>
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto w-full mt-4">
      <table class="w-full text-left border-collapse text-sm whitespace-nowrap min-w-max">
        <thead class="bg-red-50 text-red-700 text-xs uppercase sticky top-0 z-10">
          <tr>
            <th class="p-3">Jenis Pekerjaan / Status Kerja</th>
            <th class="p-3">KTP</th>
            <th class="p-3">Nama / ID</th>
            <th class="p-3">No HP / Email</th>
            <th class="p-3">Jabatan / Status Karyawan</th>
            <th class="p-3">Penempatan / Shift</th>
            <th class="p-3">Role / Jenis Lokasi</th>
            <th class="p-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 text-gray-700">
          <tr v-if="memuat"><td colspan="8" class="p-4 text-center text-gray-400">Memuat data user...</td></tr>
          <tr v-else-if="daftarKaryawan.length === 0"><td colspan="8" class="p-4 text-center text-gray-400">Belum ada data karyawan.</td></tr>
          <tr v-for="d in daftarKaryawan" :key="d.id" class="hover:bg-gray-50">
            <td class="p-3 text-xs">
              <dua-baris :a="d.jenis_pekerjaan" :b="d.status_kerja" />
              <span v-if="badgeApproval(d.status_approval)" :class="badgeApproval(d.status_approval).kelas" class="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ml-1">{{ badgeApproval(d.status_approval).teks }}</span>
            </td>
            <td class="p-3">
              <img v-if="d.foto_ktp" :src="d.foto_ktp" @click="lihatFotoBesar(d.foto_ktp)" class="w-12 h-9 rounded object-cover border cursor-pointer hover:scale-105 transition">
              <div v-else class="w-12 h-9 bg-gray-100 rounded flex items-center justify-center text-gray-300"><i class="fas fa-id-card text-xs"></i></div>
            </td>
            <td class="p-3 text-xs"><dua-baris :a="d.nama" :b="d.idGabungan" /></td>
            <td class="p-3 text-xs"><dua-baris :a="d.hp" :b="d.email" /></td>
            <td class="p-3 text-xs"><dua-baris :a="d.jabatan" :b="d.status_karyawan" /></td>
            <td class="p-3 text-xs"><dua-baris :a="d.gudangGabungan" :b="d.nama_shift" /></td>
            <td class="p-3 text-xs uppercase"><dua-baris :a="d.role" :b="d.jenisLokasiGabungan" /></td>
            <td class="p-3 text-center">
              <div class="flex items-center justify-center gap-1.5">
                <button @click="bukaEdit(d.id)" class="bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200 transition"><i class="fas fa-edit"></i></button>
                <button @click="hapus(d.id)" class="bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 border border-red-200 transition"><i class="fas fa-trash-alt"></i></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <edit-karyawan-modal v-if="emailSedangDiedit" :email-id="emailSedangDiedit" @tutup="tutupEdit" @tersimpan="selesaiSimpan" />
  `
};

const mountPoint = document.getElementById('vue-daftar-karyawan');
if (mountPoint) {
  createApp(AppDaftarKaryawan).mount('#vue-daftar-karyawan');
}
