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
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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

          <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:14px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;"><label>Nama karyawan</label><input :value="form.nama" readonly style="background:var(--ivory-dim); color:var(--text-muted); font-weight:700;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Email karyawan</label><input :value="form.email" readonly style="background:var(--ivory-dim); color:var(--text-muted);"></div>
          </div>

          <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:14px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Status pengguna (role akses)</label>
              <select v-model="form.role"><option v-for="o in opsiRole" :key="o" :value="o">{{ o }}</option></select>
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Jenis pekerjaan</label>
              <select v-model="form.jenisPekerjaan"><option v-for="o in opsiJenisPekerjaan" :key="o" :value="o">{{ o }}</option></select>
            </div>
          </div>

          <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:14px; margin-bottom:14px;">
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

          <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:14px; margin-bottom:14px;">
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
            <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>NIK</label><input v-model="form.nik"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Jenis kelamin</label><select v-model="form.gender"><option value="">-- Pilih --</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Tempat lahir</label><input v-model="form.tempatLahir"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Tanggal lahir</label><input v-model="form.tglLahir" type="date"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>No. HP / WhatsApp</label><input v-model="form.hp"></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Alamat domisili saat ini</h4>
            <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Kabupaten/kota</label><input v-model="form.tinggalKab"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kecamatan</label><input v-model="form.tinggalKec"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Detail alamat</label><textarea v-model="form.tinggalDetail" rows="2"></textarea></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Alamat sesuai KTP</h4>
            <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Kabupaten/kota</label><input v-model="form.ktpKab"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kecamatan</label><input v-model="form.ktpKec"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Detail alamat</label><textarea v-model="form.ktpDetail" rows="2"></textarea></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Pendidikan & keluarga</h4>
            <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Status pernikahan</label><select v-model="form.statusNikah"><option value="">-- Pilih --</option><option value="Belum Menikah">Belum Menikah</option><option value="Menikah">Menikah</option><option value="Cerai">Cerai</option></select></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Jumlah tanggungan</label><input v-model="form.tanggungan"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Pendidikan terakhir</label><input v-model="form.pendidikan"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Sekolah/kampus</label><input v-model="form.sekolah"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Jurusan</label><input v-model="form.jurusan"></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:14px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Rekening bank</h4>
            <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:12px;">
              <div class="gc-field" style="margin-bottom:0;"><label>Nama bank</label><input v-model="form.bank"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>No. rekening</label><input v-model="form.noRek"></div>
              <div class="gc-field" style="margin-bottom:0; grid-column:1/-1;"><label>Atas nama rekening</label><input v-model="form.atasNamaRek"></div>
            </div>
          </div>

          <div style="padding-top:14px; border-top:1px solid var(--line); margin-bottom:16px;">
            <h4 class="gc-heading" style="font-size:11.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:10px;">Kontak darurat</h4>
            <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:12px;">
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
    // DIPERBAIKI (22 Agt 2026) — SEBELUMNYA pakai pola sama seperti
    // bolehEdit/bolehHapus (`!== false`), yang artinya "izin BELUM
    // diatur" (null) dianggap BOLEH. Buat print badge/barcode karyawan
    // ini SENGAJA dibalik jadi default DITOLAK — soalnya ini mencetak
    // identitas fisik, bukan sekadar lihat/edit data. Owner/Superuser
    // selalu boleh; role lain WAJIB diizinkan eksplisit oleh Owner lewat
    // Config Akses (centang kolom Print), tidak otomatis ke-allow.
    const bolehPrint = computed(() => {
      const roleSaya = (window.currentUser.role || '').toLowerCase();
      if (['owner', 'superuser'].includes(roleSaya)) return true;
      return window.cekIzinMenu('daftar_karyawan', 'print') === true;
    });

    // BARU (22 Agt 2026, permintaan Hilman) — cetak barcode karyawan buat
    // absensi fisik, dipakai kalau HP karyawan tidak ada/rusak (di-scan
    // pakai fitur Scan QR yang sudah ada, tab-scan-qr). SENGAJA pakai
    // format QR PERSIS SAMA seperti di Account Profile (id_app, fallback
    // email, lewat api.qrserver.com) — supaya kompatibel dengan Scan QR
    // yang sudah ada, bukan bikin format baru yang malah tidak kebaca.
    function cetakBarcode(d) {
      const qrData = d.id_app || d.email || d.id;
      if (!qrData) return alert('Karyawan ini belum punya ID App maupun email, tidak bisa dibuatkan barcode.');
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
      const namaTampil = d.nama || d.name || '-';
      const jabatanTampil = d.jabatan || d.role || '-';
      const idTampil = d.id_app || d.email || d.id;

      const jendela = window.open('', '_blank', 'width=420,height=620');
      if (!jendela) return alert('Popup diblokir browser. Izinkan popup buat situs ini, lalu coba cetak lagi.');
      // Ukuran kertas FISIK 10x15cm (foto ukuran standar) — @page nentuin
      // ukuran kertas pas dicetak, body match persis biar tidak ada
      // margin nyasar/terpotong pas print sungguhan. Border putus-putus
      // cuma buat PREVIEW di layar (hilang otomatis pas print, karena
      // kertas 10x15 aslinya sudah pas ukurannya, tidak perlu garis batas).
      jendela.document.write(`<!DOCTYPE html>
<html><head><title>Barcode - ${namaTampil}</title>
<style>
  @page { size: 10cm 15cm; margin: 0; }
  * { box-sizing: border-box; }
  body {
    width: 10cm; height: 15cm; margin: 0 auto; padding: 0;
    font-family: -apple-system, 'Segoe UI', sans-serif; color: #3A2A22;
    display: flex; align-items: center; justify-content: center;
    background: #EDEDED;
  }
  .kartu {
    width: 10cm; height: 15cm; padding: 1cm;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    border: 2px dashed #C98B93; background: #fff;
  }
  img { width: 6cm; height: 6cm; }
  h2 { margin: 0.5cm 0 0.15cm; font-size: 22px; }
  p { margin: 0.05cm 0; color: #7A6A5C; font-size: 14px; }
  .id { font-weight: 700; color: #7A2E3A; font-size: 15px; }
  .catatan { margin-top: 0.8cm; font-size: 11px; color: #A69684; max-width: 8cm; }
  .tombol-cetak { margin-top: 0.6cm; padding: 8px 18px; border-radius: 10px; border: 1.5px solid #C98B93; background: #fff; cursor: pointer; font-size: 12px; }
  @media print {
    body { width: 10cm; height: 15cm; background: #fff; }
    .kartu { border: none; }
    .tombol-cetak { display: none; }
  }
</style></head>
<body>
  <div class="kartu">
    <img src="${qrUrl}" alt="Barcode" id="qrimg" onload="window.print()">
    <h2>${namaTampil}</h2>
    <p class="id">${idTampil}</p>
    <p>${jabatanTampil}</p>
    <p class="catatan">Tunjukkan barcode ini ke petugas Scan QR untuk absensi fisik, kalau HP tidak tersedia/rusak.</p>
    <button class="tombol-cetak" onclick="window.print()">Cetak Ulang</button>
  </div>
</body></html>`);
      jendela.document.close();
    }
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
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));
    const filterJenisPekerjaanOwner = ref('ALL');
    const filterGudangOwner = ref('ALL');
    const opsiJenisPekerjaanOwner = ref([]);
    const opsiGudangOwner = ref([]);

    const paginasi = reactive(usePaginasiFirestore(db, 'users', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama', // BARU — search box prefix-match server-side, hemat (bukan fetch-semua)
      filterPeran: true, // PEDOMAN KERJA (18 Agt 2026) - lihat vue-paginasi.js
      // BARU — filter manual Jenis Pekerjaan/Gudang, CUMA berlaku efeknya
      // buat Owner/Superuser (Admin biasa sudah otomatis kefilter lewat
      // filterPeran di atas, dropdown ini sengaja disembunyikan buat
      // mereka di template — pola §16, lihat STATUS-PROYEK.md).
      constraintTambahan: () => {
        if (!isOwnerRole.value) return [];
        const cs = [];
        if (filterJenisPekerjaanOwner.value !== 'ALL') cs.push(where('jenis_pekerjaan', '==', filterJenisPekerjaanOwner.value));
        if (filterGudangOwner.value !== 'ALL') cs.push(where('gudang_penempatan', 'array-contains', filterGudangOwner.value));
        return cs;
      },
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
      if (isOwnerRole.value && opsiJenisPekerjaanOwner.value.length === 0) {
        opsiJenisPekerjaanOwner.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
        const qGudang = await getDocs(collection(db, "master_gudang"));
        const listGudang = [];
        qGudang.forEach(g => listGudang.push(g.data().nama_gudang));
        opsiGudangOwner.value = listGudang;
      }
      await paginasi.muatUlang();
      memuat.value = false;
    }
    watch([filterJenisPekerjaanOwner, filterGudangOwner], () => paginasi.muatUlang());

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
    return {
      paginasi, memuat, emailSedangDiedit, muat, hapus, bukaEdit, tutupEdit, selesaiSimpan, badgeApproval, lihatFotoBesar, bolehHapus, bolehEdit, bolehPrint, cetakBarcode,
      cariNama: computed({ get: () => paginasi.cariTeks, set: (v) => paginasi.cariDenganDebounce(v) }),
      isOwnerRole, filterJenisPekerjaanOwner, filterGudangOwner, opsiJenisPekerjaanOwner, opsiGudangOwner
    };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-users" style="margin-right:8px;"></i> Daftar karyawan</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Master kontrol HR untuk edit role & status.</p>
      </div>
      <button @click="muat" class="btn-outline filled">Muat Data</button>
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:14px;">
      <div style="position:relative; flex:1; min-width:200px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>
      <template v-if="isOwnerRole">
        <select v-model="filterJenisPekerjaanOwner" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="ALL">Semua jenis pekerjaan</option>
          <option v-for="jp in opsiJenisPekerjaanOwner" :key="jp" :value="jp">{{ jp }}</option>
        </select>
        <select v-model="filterGudangOwner" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="ALL">Semua gudang</option>
          <option v-for="g in opsiGudangOwner" :key="g" :value="g">{{ g }}</option>
        </select>
      </template>
    </div>
    <!-- GANTI (28 Agt 2026) — dulu tabel scroll horizontal (8 kolom), SEKARANG
         kartu (pola sama seperti List Bahan/Aksesoris) — permintaan Guru:
         "Daftar Karyawan" eksplisit disebut jadi salah satu tabel yang
         dijadikan Kartu, di HP MAUPUN desktop. -->
    <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px; margin-top:16px;">Memuat data user...</div>
    <div v-else-if="paginasi.errorPaginasi" class="gc-card" style="text-align:center; padding:20px; color:var(--danger); font-size:12px; margin-top:16px;">{{ paginasi.errorPaginasi }}</div>
    <div v-else-if="paginasi.dataHalaman.length === 0" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px; margin-top:16px;">Belum ada data karyawan.</div>
    <div v-else style="display:flex; flex-direction:column; gap:10px; margin-top:16px;">
      <div v-for="d in paginasi.dataHalaman" :key="d.id" class="gc-card" style="padding:14px;">
        <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
          <img v-if="d.foto_ktp" :src="d.foto_ktp" @click="lihatFotoBesar(d.foto_ktp)" style="width:48px; height:48px; object-fit:cover; border-radius:10px; border:1px solid var(--line); cursor:pointer; flex-shrink:0;">
          <div v-else style="width:48px; height:48px; border-radius:10px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-id-card" style="color:var(--text-faint); font-size:15px;"></i></div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13.5px;">{{ d.nama }}</div>
            <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ d.idGabungan }}</div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0;">
            <span v-if="d.status_karyawan" class="tag neutral">{{ d.status_karyawan }}</span>
            <span v-if="badgeApproval(d.status_approval)" class="tag" :class="badgeApproval(d.status_approval).kelas" style="padding:2px 8px; font-size:9px;">{{ badgeApproval(d.status_approval).teks }}</span>
          </div>
        </div>

        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Jenis Pekerjaan / Status Kerja</span><span style="font-weight:700; text-align:right;">{{ d.jenis_pekerjaan || '-' }} / {{ d.status_kerja || '-' }}</span></div>
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">No HP / Email</span><span style="font-weight:700; text-align:right;">{{ d.hp || '-' }} / {{ d.email || '-' }}</span></div>
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Jabatan</span><span style="font-weight:700; text-align:right;">{{ d.jabatan || '-' }}</span></div>
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px; align-items:flex-start;"><span style="color:var(--text-faint); flex-shrink:0;">Penempatan / Shift</span><span style="font-weight:700; text-align:right;"><gudang-ringkas :gudang="d.gudang_penempatan" :nama="d.nama" /> / {{ d.nama_shift || '-' }}</span></div>
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Role / Jenis Lokasi</span><span style="font-weight:700; text-align:right; text-transform:uppercase;">{{ d.profil_akses || d.role }} / {{ d.jenisLokasiGabungan }}</span></div>
        </div>

        <div style="display:flex; gap:8px;">
          <button v-if="bolehPrint" @click="cetakBarcode(d)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px;"><i class="fas fa-barcode" style="margin-right:6px;"></i>Barcode</button>
          <button v-if="bolehEdit" @click="bukaEdit(d.id)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px;"><i class="fas fa-pen" style="margin-right:6px;"></i>Edit</button>
          <button v-if="bolehHapus" @click="hapus(d.id)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
        </div>
      </div>
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
