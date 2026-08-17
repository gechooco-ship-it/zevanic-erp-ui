// js/vue-riwayat-absensi.js
// ============================================================================
// Halaman KEENAM yang dimigrasi ke Vue: Master Absensi > Riwayat All Absensi
// (laporan lengkap semua data absensi + edit/hapus/assign ulang + export CSV).
//
// Dipakai ulang: DuaBaris (dari migrasi Daftar Karyawan) — tabel 10 kolom ini
// pakai pola yang sama persis tanpa ditulis ulang.
// window.hapusAbsensi TETAP dipanggil dari sini (fungsi bersama, juga dipakai
// oleh Antrean Absensi yang sudah dimigrasi).
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DuaBaris } from './vue-components.js';

const EditAbsensiModal = {
  props: {
    item: { type: Object, required: true }
  },
  emits: ['tutup', 'tersimpan'],
  setup(props, { emit }) {
    const form = reactive({
      statusKehadiran: props.item.status_kehadiran || '',
      seragam: props.item.seragam || 'Sesuai',
      statusAcc: props.item.status_acc || 'PENDING'
    });
    const opsiStatusKehadiran = ref([]);
    const menyimpan = ref(false);

    async function muatOpsi() {
      opsiStatusKehadiran.value = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : ["Ontime", "Terlambat", "Tidak Absen"];
    }

    async function simpan() {
      menyimpan.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.item.id), {
          status_kehadiran: form.statusKehadiran,
          seragam: form.seragam,
          status_acc: form.statusAcc
        });
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
    const memuat = ref(true);
    const itemSedangDiedit = ref(null);

    // ---- Migrasi waktu_ts (18 Agt 2026) ----
    // Dokumen LAMA (dibuat sebelum perbaikan ini) cuma punya "waktu" (teks),
    // belum punya "waktu_ts" (Timestamp asli). Status migrasinya DIHITUNG
    // dari data yang SAMA yang sudah diambil muat() di bawah — TIDAK ada
    // baca Firestore tambahan cuma buat cek status ini.
    const migrasi = reactive({ totalBelumMigrasi: 0, sedangProses: false, sudahDicek: false, hasilTerakhir: '' });
    let dokumenBelumMigrasi = []; // {id, waktu} — disiapkan muat(), dipakai jalankanMigrasi()

    async function muat() {
      memuat.value = true;
      try {
        // Cross-reference No. HP dari koleksi users (record absensi tidak simpan hp langsung)
        const qUsers = await getDocs(collection(db, "users"));
        const petaHp = {};
        qUsers.forEach(u => { petaHp[u.data().email] = u.data().hp || '-'; });

        const snap = await getDocs(collection(db, "absensi"));
        const list = [];
        dokumenBelumMigrasi = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          d.id = docSnap.id;
          d.hpDicariDariUsers = petaHp[d.email] || d.email || '-';
          list.push(d);
          if (!d.waktu_ts) dokumenBelumMigrasi.push({ id: docSnap.id, waktu: d.waktu });
        });

        list.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
        listData.value = list;
        migrasi.totalBelumMigrasi = dokumenBelumMigrasi.length;
        migrasi.sudahDicek = true;
      } catch (e) {
        console.error("Gagal muat rekap global:", e);
      }
      memuat.value = false;
    }

    // Migrasi satu-kali: ubah "waktu" (teks) jadi "waktu_ts" (Timestamp
    // asli) buat dokumen LAMA yang belum punya. Pakai writeBatch — praktik
    // baku Firestore buat tulis banyak dokumen sekaligus (atomik per
    // kelompok, maks 500 operasi/batch, jadi dipecah per 400 biar aman).
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
            if (!tanggalTerurai) { gagalParsing++; return; } // format teks tidak terbaca -> lewati, jangan hentikan seluruh proses
            batch.update(doc(db, "absensi", d.id), { waktu_ts: Timestamp.fromDate(tanggalTerurai) });
            sukses++;
          });
          await batch.commit();
        }
        migrasi.hasilTerakhir = `Selesai! ${sukses} dokumen berhasil dimigrasi.` + (gagalParsing > 0 ? ` ${gagalParsing} dokumen dilewati (format tanggal lama tidak terbaca — bisa dicek manual di Firestore Console kalau perlu).` : '');
        await muat(); // refresh, sekaligus hitung ulang sisa yang belum (harusnya 0 kalau semua berhasil)
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
      // Fungsi bersama (juga dipakai Antrean Absensi)
      if (window.hapusAbsensi) window.hapusAbsensi(docId).then(muat);
    }

    async function assignUlang(docId) {
      if (!confirm("Kembalikan data ini ke Antrean Absensi untuk diperiksa ulang?")) return;
      try {
        await updateDoc(doc(db, "absensi", docId), { status_acc: "PENDING" });
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
      csvContent += "Nama Pegawai,Email,Waktu Presensi,Tipe Presensi,Lokasi Gudang,Shift,Seragam,Status Persetujuan\n";

      listData.value.forEach(row => {
        const nama = `"${(row.nama_pegawai || row.nama || '').replace(/"/g, '""')}"`;
        const email = `"${(row.email || '').replace(/"/g, '""')}"`;
        const waktu = `"${row.waktu || ''}"`;
        const status = `"${row.status || 'HADIR'}"`;
        const gudang = `"${row.gudang || '-'}"`;
        const shift = `"${row.shift || '-'}"`;
        const seragam = `"${row.seragam || 'Sesuai'}"`;
        const statusAcc = `"${row.status_acc || 'PENDING'}"`;
        csvContent += `${nama},${email},${waktu},${status},${gudang},${shift},${seragam},${statusAcc}\n`;
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
    return { listData, memuat, itemSedangDiedit, muat, pisahTanggalWaktu, lihatFotoBesar, bukaEdit, tutupEdit, selesaiSimpan, hapus, assignUlang, exportCSV, migrasi, jalankanMigrasi };
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

    <div v-else class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
      <table class="gc-table">
        <thead>
          <tr>
            <th>Persetujuan / Tipe Absen</th>
            <th>Shift / Gudang</th>
            <th>Tanggal / Waktu</th>
            <th>Foto</th>
            <th>Nama / No HP</th>
            <th>Status Kehadiran / Seragam</th>
            <th>Sanggahan Karyawan</th>
            <th>Aju Banding</th>
            <th>Pemeriksa</th>
            <th class="freeze freeze-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="listData.length === 0"><td colspan="10" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada data absensi.</td></tr>
          <tr v-for="item in listData" :key="item.id">
            <td>
              <b>
                <span v-if="item.status_acc === 'ACC'" style="color:var(--ok);">ACC</span>
                <span v-else-if="item.status_acc === 'REJECT'" style="color:var(--danger);">REJECT</span>
                <span v-else style="color:var(--warn);">PENDING</span>
              </b><br>
              <span style="font-size:10.5px; color:var(--text-muted); font-weight:400;">{{ item.status || 'HADIR' }}</span>
            </td>
            <td><dua-baris :a="item.shift" :b="item.gudang" /></td>
            <td><dua-baris :a="pisahTanggalWaktu(item.waktu).tgl" :b="pisahTanggalWaktu(item.waktu).jam" /></td>
            <td>
              <img v-if="item.foto_selfie || item.foto" :src="item.foto_selfie || item.foto" @click="lihatFotoBesar(item.foto_selfie || item.foto)" style="width:40px; height:40px; border-radius:10px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
              <span v-else style="color:var(--text-faint);">-</span>
            </td>
            <td><dua-baris :a="item.nama_pegawai || item.nama" :b="item.hpDicariDariUsers" /></td>
            <td><dua-baris :a="item.status_kehadiran" :b="item.seragam || 'Sesuai'" /></td>
            <td class="gc-cell-muted" style="max-width:160px; overflow:hidden; text-overflow:ellipsis;" :title="item.catatan_banding || ''">{{ item.catatan_banding || '-' }}</td>
            <td>
              <span v-if="item.catatan_banding" class="tag warn">Ada Aju Banding</span>
              <span v-else style="color:var(--text-faint);">-</span>
            </td>
            <td class="gc-cell-muted">{{ item.validated_by || '-' }}</td>
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
// Perbaikan bug BESAR: komponen ini dulu langsung di-mount() begitu file ini
// dimuat (artinya SETIAP kali halaman dibuka, oleh SIAPAPUN, termasuk yang
// tidak punya akses ke layar ini) — onMounted-nya otomatis mencoba fetch
// Firestore walau orangnya tidak pernah membuka tab ini sama sekali. Itu
// yang bikin console penuh "Missing or insufficient permissions" dan baca
// Firestore boros. Sekarang mount() BARU terjadi saat dashboard.js
// pindahSubTab benar-benar memanggil window.pastikanMountRiwayatAbsensi() —
// yaitu PERSIS saat tab ini pertama kali dibuka, bukan dari awal muat
// halaman.
window.pastikanMountRiwayatAbsensi = function() {
  if (vmRiwayatAbsensi) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-riwayat-absensi');
  if (mountPoint) vmRiwayatAbsensi = createApp(AppRiwayatAbsensi).mount('#vue-riwayat-absensi');
};
window.refreshRiwayatAbsensi = function() { if (vmRiwayatAbsensi) vmRiwayatAbsensi.muat(); };
