// js/vue-riwayat-absensi.js
// ============================================================================
// Halaman KEENAM yang dimigrasi ke Vue: Master Absensi > Riwayat All Absensi
// (laporan lengkap semua data absensi + edit/hapus/assign ulang + export CSV).
//
// DIROMBAK (18 Agt 2026) — tabel ini WAJIB nampilin 2 BENTUK dokumen
// sekaligus (LAMA: 1 baris = 1 event Clock In ATAU Clock Out terpisah;
// BARU: 1 baris = gabungan Clock In+Out, lihat js/vue-camera.js). Kolom
// "Tanggal/Waktu" yang dulu 1 kolom SEKARANG dipecah jadi 2 kolom
// terpisah — "Tanggal-Waktu Clock In" dan "Tanggal-Waktu Clock Out"
// (permintaan checklist rebuild 18 Agt 2026) — supaya kelihatan jelas
// jam masuk & keluar karyawan di 1 baris yang sama untuk dokumen format
// baru, TANPA kehilangan kompatibilitas ke dokumen format lama (yang
// otomatis cuma isi SALAH SATU kolom itu, sesuai jenis event-nya).
//
// formatBaris() di bawah adalah "penerjemah" 1 fungsi tunggal yang
// menyeragamkan KEDUA bentuk dokumen jadi 1 bentuk tampilan yang sama —
// SEMUA bagian template baca lewat fungsi ini, TIDAK ada cabang if/else
// format lama/baru tersebar di banyak tempat template (lebih gampang
// dirawat & diuji terpisah dari Vue).
//
// Ditambah filter TETAP "Status Kerja = Aktif" (permintaan checklist) —
// karyawan nonaktif/resign tidak perlu muncul di laporan operasional ini.
//
// Dipakai ulang: DuaBaris (dari migrasi Daftar Karyawan).
// window.hapusAbsensi TETAP dipanggil dari sini (fungsi bersama, juga
// dipakai oleh Antrean Absensi).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DuaBaris } from './vue-components.js';

// Diekspor juga (dipakai test) — seragamkan dokumen LAMA (1 event/baris)
// dan BARU (gabungan masuk+keluar) jadi 1 bentuk tampilan yang sama.
export function formatBaris(item) {
  const adalahBaru = item.status_acc_masuk !== undefined;
  if (adalahBaru) {
    return {
      waktuMasuk: item.waktu_masuk || null,
      waktuKeluar: item.waktu_keluar || null,
      statusAccMasuk: item.status_acc_masuk || null,
      statusAccKeluar: item.status_acc_keluar !== undefined ? item.status_acc_keluar : null,
      fotoMasuk: item.foto_selfie_masuk || null,
      fotoKeluar: item.foto_selfie_keluar || null,
      statusKehadiranMasuk: item.status_kehadiran_masuk || '',
      statusKehadiranKeluar: item.status_kehadiran_keluar || '',
      seragamMasuk: item.seragam_masuk || 'Sesuai',
      seragamKeluar: item.seragam_keluar || null
    };
  }
  // Format LAMA — 1 baris = 1 event tunggal (Clock In ATAU Clock Out
  // ATAU Izin/Cuti/Lembur, tidak pernah gabungan).
  const iniKeluar = item.status === 'CLOCK OUT';
  return {
    waktuMasuk: iniKeluar ? null : (item.waktu || null),
    waktuKeluar: iniKeluar ? (item.waktu || null) : null,
    statusAccMasuk: iniKeluar ? null : (item.status_acc || null),
    statusAccKeluar: iniKeluar ? (item.status_acc || null) : null,
    fotoMasuk: iniKeluar ? null : (item.foto_selfie || item.foto || null),
    fotoKeluar: iniKeluar ? (item.foto_selfie || item.foto || null) : null,
    statusKehadiranMasuk: iniKeluar ? '' : (item.status_kehadiran || ''),
    statusKehadiranKeluar: iniKeluar ? (item.status_kehadiran || '') : '',
    seragamMasuk: iniKeluar ? 'Sesuai' : (item.seragam || 'Sesuai'),
    seragamKeluar: iniKeluar ? (item.seragam || 'Sesuai') : null
  };
}

// Waktu sortir gabungan — pakai yang paling akhir terjadi (keluar kalau
// ada, jatuh-aman ke masuk kalau belum Clock Out).
function waktuUntukSortir(item) {
  if (item.status_acc_masuk !== undefined) return item.waktu_keluar || item.waktu_masuk || '';
  return item.waktu || '';
}

const EditAbsensiModal = {
  props: {
    item: { type: Object, required: true }
  },
  emits: ['tutup', 'tersimpan'],
  setup(props, { emit }) {
    const adalahBaru = props.item.status_acc_masuk !== undefined;
    const form = reactive({
      statusKehadiran: props.item.status_kehadiran || props.item.status_kehadiran_masuk || '',
      seragam: props.item.seragam || props.item.seragam_masuk || 'Sesuai',
      statusAcc: props.item.status_acc || props.item.status_acc_masuk || 'PENDING'
    });
    const opsiStatusKehadiran = ref([]);
    const menyimpan = ref(false);

    async function muatOpsi() {
      opsiStatusKehadiran.value = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : ["Ontime", "Terlambat", "Tidak Absen"];
    }

    async function simpan() {
      menyimpan.value = true;
      try {
        // Dokumen BARU: edit di sini WAJIB ke field_masuk (form Edit cuma
        // 1 set kolom — kalau butuh edit sisi Keluar, dilakukan lewat
        // Antrean Absensi sebelum di-ACC, bukan dari sini).
        const dataUpdate = adalahBaru
          ? { status_kehadiran_masuk: form.statusKehadiran, seragam_masuk: form.seragam, status_acc_masuk: form.statusAcc }
          : { status_kehadiran: form.statusKehadiran, seragam: form.seragam, status_acc: form.statusAcc };
        await updateDoc(doc(db, "absensi", props.item.id), dataUpdate);
        alert("Data absensi berhasil diperbarui!");
        emit('tersimpan');
      } catch (e) {
        console.error("Gagal edit absensi:", e);
        alert("Gagal menyimpan perubahan.");
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; muatOpsi(); });
    return { form, opsiStatusKehadiran, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; z-index:100; background:rgba(59,42,31,.6); display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); border-radius:22px; padding:22px; width:100%; max-width:380px; font-size:12.5px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
          <h3 class="gc-heading" style="font-weight:700; font-size:14px;"><i class="fas fa-edit" style="color:var(--burgundy); margin-right:8px;"></i> Edit Data Absensi</h3>
          <button @click="$emit('tutup')" style="background:none; border:none; color:var(--text-faint); font-size:16px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>
        <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:12px;">Karyawan: <b style="color:var(--text);">{{ item.nama_pegawai || item.nama || '-' }}</b></p>
        <div class="gc-field">
          <label>Status Kehadiran</label>
          <select v-model="form.statusKehadiran"><option v-for="s in opsiStatusKehadiran" :key="s" :value="s">{{ s }}</option></select>
        </div>
        <div class="gc-field">
          <label>Seragam</label>
          <select v-model="form.seragam"><option value="Sesuai">Sesuai</option><option value="Tidak Sesuai">Tidak Sesuai</option></select>
        </div>
        <div class="gc-field">
          <label>Status Persetujuan</label>
          <select v-model="form.statusAcc"><option value="ACC">ACC</option><option value="REJECT">REJECT</option><option value="PENDING">PENDING</option></select>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas fa-save" style="margin-right:6px;"></i> {{ menyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </button>
      </div>
    </div>
  `
};

const AppRiwayatAbsensi = {
  components: { DuaBaris, EditAbsensiModal },
  setup() {
    const listData = ref([]);
    const cariNama = ref('');
    const listDataTersaring = computed(() => {
      const kata = cariNama.value.trim().toLowerCase();
      if (!kata) return listData.value;
      return listData.value.filter(item => (item.nama_pegawai || item.nama || '').toLowerCase().includes(kata));
    });
    const memuat = ref(true);
    const itemSedangDiedit = ref(null);

    // ---- Migrasi waktu_ts (18 Agt 2026) — TIDAK BERUBAH dari sebelumnya ----
    const migrasi = reactive({ totalBelumMigrasi: 0, sedangProses: false, sudahDicek: false, hasilTerakhir: '' });
    let dokumenBelumMigrasi = [];

    async function muat() {
      memuat.value = true;
      try {
        const qUsers = await getDocs(collection(db, "users"));
        const petaHp = {};
        const petaJenisPekerjaan = {};
        const petaStatusKerja = {}; // BARU — buat filter Status Kerja=Aktif
        qUsers.forEach(u => {
          const du = u.data();
          petaHp[du.email] = du.hp || '-';
          petaJenisPekerjaan[du.email] = du.jenis_pekerjaan || '';
          petaStatusKerja[du.email] = du.status_kerja || '';
        });

        const snap = await getDocs(collection(db, "absensi"));
        const list = [];
        dokumenBelumMigrasi = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!window.bolehLihatData(petaJenisPekerjaan[d.email], d.gudang)) return;
          // BARU (permintaan checklist) — karyawan nonaktif/resign tidak
          // perlu muncul di laporan operasional ini.
          if (petaStatusKerja[d.email] !== 'Aktif') return;
          d.id = docSnap.id;
          d.hpDicariDariUsers = petaHp[d.email] || d.email || '-';
          list.push(d);
          const belumAdaWaktuTs = d.status_acc_masuk !== undefined ? !d.waktu_masuk_ts : !d.waktu_ts;
          if (belumAdaWaktuTs) dokumenBelumMigrasi.push({ id: docSnap.id, waktu: d.waktu || d.waktu_masuk });
        });

        list.sort((a, b) => (window.parseWaktuIndo(waktuUntukSortir(b))?.getTime() || 0) - (window.parseWaktuIndo(waktuUntukSortir(a))?.getTime() || 0));
        listData.value = list;
        migrasi.totalBelumMigrasi = dokumenBelumMigrasi.length;
        migrasi.sudahDicek = true;
      } catch (e) {
        console.error("Gagal muat rekap global:", e);
      }
      memuat.value = false;
    }

    async function jalankanMigrasi() {
      if (migrasi.totalBelumMigrasi === 0) return;
      if (!confirm(`Migrasi ${migrasi.totalBelumMigrasi} dokumen lama sekarang? Proses ini aman diulang kalau terputus di tengah jalan (dokumen yang sudah selesai tidak akan diproses ulang).`)) return;

      migrasi.sedangProses = true;
      migrasi.hasilTerakhir = '';
      let sukses = 0, gagalParsing = 0;
      const UKURAN_BATCH = 400;

      try {
        for (let i = 0; i < dokumenBelumMigrasi.length; i += UKURAN_BATCH) {
          const potongan = dokumenBelumMigrasi.slice(i, i + UKURAN_BATCH);
          const batch = writeBatch(db);
          potongan.forEach(d => {
            const tanggalTerurai = window.parseWaktuIndo(d.waktu);
            if (!tanggalTerurai) { gagalParsing++; return; }
            // Field target waktu_ts vs waktu_masuk_ts tergantung format
            // dokumennya — dicek dari listData yang sudah dimuat (bukan
            // baca Firestore lagi cuma buat tahu ini format apa).
            const itemAsli = listData.value.find(x => x.id === d.id);
            const fieldTarget = (itemAsli && itemAsli.status_acc_masuk !== undefined) ? 'waktu_masuk_ts' : 'waktu_ts';
            batch.update(doc(db, "absensi", d.id), { [fieldTarget]: Timestamp.fromDate(tanggalTerurai) });
            sukses++;
          });
          await batch.commit();
        }
        migrasi.hasilTerakhir = `Selesai! ${sukses} dokumen berhasil dimigrasi.` + (gagalParsing > 0 ? ` ${gagalParsing} dokumen dilewati (format tanggal lama tidak terbaca — bisa dicek manual di Firestore Console kalau perlu).` : '');
        await muat();
      } catch (e) {
        console.error("Gagal migrasi waktu_ts:", e);
        migrasi.hasilTerakhir = 'Migrasi terhenti karena error: ' + e.message + ' — aman dijalankan ulang, dokumen yang sudah selesai tidak akan diproses dobel.';
      }
      migrasi.sedangProses = false;
    }

    function pisahTanggalWaktu(waktu) {
      const [tgl, jam] = (waktu || '-, -').split(', ');
      return { tgl, jam };
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    function bukaEdit(item) { itemSedangDiedit.value = item; }
    function tutupEdit() { itemSedangDiedit.value = null; }
    async function selesaiSimpan() { itemSedangDiedit.value = null; await muat(); }

    function hapus(docId) {
      if (window.hapusAbsensi) window.hapusAbsensi(docId).then(muat);
    }

    async function assignUlang(docId) {
      if (!confirm("Kembalikan data ini ke Antrean Absensi untuk diperiksa ulang?")) return;
      try {
        const item = listData.value.find(x => x.id === docId);
        const adalahBaru = item && item.status_acc_masuk !== undefined;
        // Dokumen BARU: assign ulang KEDUA sisi (masuk & keluar kalau
        // ada) — lebih aman daripada nebak sisi mana yang dimaksud.
        const dataUpdate = adalahBaru
          ? { status_acc_masuk: 'PENDING', ada_pending: true, ...(item.waktu_keluar ? { status_acc_keluar: 'PENDING' } : {}) }
          : { status_acc: 'PENDING' };
        await updateDoc(doc(db, "absensi", docId), dataUpdate);
        alert("Data berhasil di-assign ulang ke Antrean Absensi.");
        await muat();
      } catch (e) {
        console.error("Gagal assign ulang:", e);
        alert("Gagal memproses assign ulang.");
      }
    }

    function exportCSV() {
      if (listData.value.length === 0) return alert("Tidak ada data untuk di-export saat ini.");

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Nama Pegawai,Email,Tipe Absen,Gudang,Shift,Waktu Clock In,Status ACC Masuk,Waktu Clock Out,Status ACC Keluar,Seragam\n";

      listData.value.forEach(row => {
        const f = formatBaris(row);
        const nama = `"${(row.nama_pegawai || row.nama || '').replace(/"/g, '""')}"`;
        const email = `"${(row.email || '').replace(/"/g, '""')}"`;
        const status = `"${row.status || 'HADIR'}"`;
        const gudang = `"${row.gudang || '-'}"`;
        const shift = `"${row.shift || '-'}"`;
        const waktuMasuk = `"${f.waktuMasuk || '-'}"`;
        const accMasuk = `"${f.statusAccMasuk || '-'}"`;
        const waktuKeluar = `"${f.waktuKeluar || '-'}"`;
        const accKeluar = `"${f.statusAccKeluar || '-'}"`;
        const seragam = `"${f.seragamMasuk || f.seragamKeluar || 'Sesuai'}"`;
        csvContent += `${nama},${email},${status},${gudang},${shift},${waktuMasuk},${accMasuk},${waktuKeluar},${accKeluar},${seragam}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Data_Absensi_Zevanic_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      listData, listDataTersaring, cariNama, memuat, itemSedangDiedit, muat, pisahTanggalWaktu, lihatFotoBesar,
      bukaEdit, tutupEdit, selesaiSimpan, hapus, assignUlang, exportCSV, migrasi, jalankanMigrasi,
      formatBaris
    };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
         <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;"><i class="fas fa-database" style="color:var(--burgundy); margin-right:8px;"></i> Riwayat All Absensi</h3>
         <p style="font-size:10.5px; color:var(--text-muted); margin-top:3px;">Laporan lengkap seluruh karyawan. Anda bisa mengunduhnya untuk keperluan Payroll.</p>
      </div>
      <button @click="exportCSV" class="btn-outline filled" style="display:flex; align-items:center; gap:8px;">
          <i class="fas fa-file-excel"></i><span>Unduh Excel (CSV)</span>
      </button>
    </div>

    <div v-if="migrasi.sudahDicek && migrasi.totalBelumMigrasi > 0" class="gc-card" style="background:var(--warn-light); border:1.5px solid var(--warn); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <i class="fas fa-clock-rotate-left" style="color:var(--warn); font-size:18px; margin-top:2px;"></i>
          <div>
            <h4 class="gc-heading" style="font-weight:700; font-size:12.5px;">{{ migrasi.totalBelumMigrasi }} data lama belum punya Timestamp asli</h4>
            <p style="font-size:11px; color:var(--text-muted); margin-top:3px; max-width:480px;">Data ini masih tersimpan sebagai teks (dari sebelum 18 Agt 2026) — belum bisa dipakai untuk filter rentang tanggal yang hemat di server. Migrasi ini AMAN dijalankan kapan saja, boleh diulang kalau terputus, dan TIDAK mengubah data yang sudah dimigrasi.</p>
            <p v-if="migrasi.hasilTerakhir" style="font-size:11px; color:var(--text); margin-top:6px; font-weight:600;">{{ migrasi.hasilTerakhir }}</p>
          </div>
        </div>
        <button @click="jalankanMigrasi" :disabled="migrasi.sedangProses" class="btn-outline filled" style="flex-shrink:0;">
          {{ migrasi.sedangProses ? 'Sedang migrasi...' : 'Jalankan Migrasi' }}
        </button>
      </div>
    </div>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i>Menyiapkan Riwayat All Absensi...</div>

    <div v-if="!memuat && listData.length > 0" style="position:relative; margin-bottom:14px; max-width:320px;">
      <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
      <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
    </div>

    <div v-if="!memuat" class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
      <table class="gc-table">
        <thead>
          <tr>
            <th>Persetujuan / Tipe Absen</th>
            <th>Nama / No HP</th>
            <th>Gudang / Shift</th>
            <th>Tanggal - Waktu Clock In</th>
            <th>Tanggal - Waktu Clock Out</th>
            <th>Foto</th>
            <th>Status Kehadiran / Seragam</th>
            <th>Sanggahan Karyawan</th>
            <th>Pemeriksa</th>
            <th class="freeze freeze-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="listData.length === 0"><td colspan="10" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada data absensi.</td></tr>
          <tr v-else-if="listDataTersaring.length === 0"><td colspan="10" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada nama yang cocok dicari.</td></tr>
          <tr v-for="item in listDataTersaring" :key="item.id">
            <td>
              <b>
                <span v-if="formatBaris(item).statusAccMasuk === 'ACC'" style="color:var(--ok);">Masuk: ACC</span>
                <span v-else-if="formatBaris(item).statusAccMasuk === 'REJECT'" style="color:var(--danger);">Masuk: REJECT</span>
                <span v-else-if="formatBaris(item).statusAccMasuk === 'PENDING'" style="color:var(--warn);">Masuk: PENDING</span>
              </b>
              <br v-if="formatBaris(item).statusAccMasuk && formatBaris(item).statusAccKeluar">
              <b>
                <span v-if="formatBaris(item).statusAccKeluar === 'ACC'" style="color:var(--ok);">Keluar: ACC</span>
                <span v-else-if="formatBaris(item).statusAccKeluar === 'REJECT'" style="color:var(--danger);">Keluar: REJECT</span>
                <span v-else-if="formatBaris(item).statusAccKeluar === 'PENDING'" style="color:var(--warn);">Keluar: PENDING</span>
              </b>
              <br><span style="font-size:10.5px; color:var(--text-muted); font-weight:400;">{{ item.status || 'HADIR' }}</span>
            </td>
            <td><dua-baris :a="item.nama_pegawai || item.nama" :b="item.hpDicariDariUsers" /></td>
            <td><dua-baris :a="item.gudang" :b="item.shift" /></td>
            <td><dua-baris :a="pisahTanggalWaktu(formatBaris(item).waktuMasuk).tgl" :b="pisahTanggalWaktu(formatBaris(item).waktuMasuk).jam" /></td>
            <td><dua-baris :a="pisahTanggalWaktu(formatBaris(item).waktuKeluar).tgl" :b="pisahTanggalWaktu(formatBaris(item).waktuKeluar).jam" /></td>
            <td>
              <img v-if="formatBaris(item).fotoMasuk || formatBaris(item).fotoKeluar" :src="formatBaris(item).fotoMasuk || formatBaris(item).fotoKeluar" @click="lihatFotoBesar(formatBaris(item).fotoMasuk || formatBaris(item).fotoKeluar)" style="width:40px; height:40px; border-radius:10px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
              <span v-else style="color:var(--text-faint);">-</span>
            </td>
            <td><dua-baris :a="formatBaris(item).statusKehadiranMasuk || formatBaris(item).statusKehadiranKeluar" :b="formatBaris(item).seragamMasuk || formatBaris(item).seragamKeluar || 'Sesuai'" /></td>
            <td class="gc-cell-muted" style="max-width:160px; overflow:hidden; text-overflow:ellipsis;" :title="item.catatan_banding || ''">{{ item.catatan_banding || '-' }}</td>
            <td class="gc-cell-muted">{{ item.validated_by || item.validated_by_masuk || item.validated_by_keluar || '-' }}</td>
            <td class="freeze freeze-right">
              <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                <button @click="bukaEdit(item)" class="icon-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button @click="hapus(item.id)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                <button v-if="item.catatan_banding" @click="assignUlang(item.id)" class="icon-btn" style="color:var(--warn);" title="Assign ulang ke Antrean Absensi"><i class="fas fa-undo"></i></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <edit-absensi-modal v-if="itemSedangDiedit" :item="itemSedangDiedit" @tutup="tutupEdit" @tersimpan="selesaiSimpan" />
  `
};

let vmRiwayatAbsensi = null;
window.pastikanMountRiwayatAbsensi = function() {
  if (vmRiwayatAbsensi) return;
  const mountPoint = document.getElementById('vue-riwayat-absensi');
  if (mountPoint) vmRiwayatAbsensi = createApp(AppRiwayatAbsensi).mount('#vue-riwayat-absensi');
};
window.refreshRiwayatAbsensi = function() { if (vmRiwayatAbsensi) vmRiwayatAbsensi.muat(); };
