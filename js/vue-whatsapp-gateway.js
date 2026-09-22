// js/vue-whatsapp-gateway.js
// Master Integrasi > WhatsApp. Tab: Config API (tes kirim), Template Pesan
// (hub template per jadwal, dikelompokkan per modul), Monitoring Respon, Phonebook.
//
// Koleksi & field:
// - wa_keluar: antrean kirim; Cloud Function kirimWaKeluar -> Fonnte + wa_log.
// - wa_log: orderBy('waktu_ts','desc') + limit 50, Muat Lagi.
// - wa_kontak: nama, nomor (62...), peran, email_karyawan.
// - wa_grup_phonebook: nama, anggota (array id wa_kontak).
// - wa_group: nama, group_id (...@g.us), catatan.
// - wa_jadwal: template (field di dokumen jadwal, ikut terhapus bersamanya).
// - wa_perintah: ambil_grup, pratinjau_jadwal, tes_jadwal (jawaban di data).
//
// Jebakan:
// - Token Fonnte hanya di Secret Manager (FONNTE_TOKEN) milik Cloud Function.
// - Nomor disimpan 62xxxx tanpa +/spasi (normalisasiNomor); Fonnte menolak format lain.
// - Placeholder diisi di server (renderTemplate di functions); daftar nama yang
//   kosong ikut membuang satu baris judul tepat di atasnya.
// - Tulis Phonebook & template hanya Owner/PIC Owner (rules).

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, orderBy, limit, startAfter, startAt, endAt, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

export const JENIS_REPORT_WA = [
  { key: 'ringkasan_pagi', label: 'Ringkasan pagi (terlambat + belum absen)' },
  { key: 'rekap_harian', label: 'Rekap harian' },
  { key: 'pengingat_hrd', label: 'Pengingat validasi HRD' },
  { key: 'rekap_mingguan', label: 'Rekap mingguan (7 hari terakhir)' },
  { key: 'rekap_bulanan', label: 'Rekap bulanan (bulan lalu, tiap tanggal 1)' }
];
export const MODUL_WA = [
  { key: 'absensi', label: 'Absensi' },
  { key: 'persiapan', label: 'Persiapan Produksi' },
  { key: 'proses', label: 'Proses Produksi' },
  { key: 'belanja', label: 'Belanja' }
];
export const PLACEHOLDER_WA = ['hari', 'tanggal', 'jam', 'gudang', 'jenis_pekerjaan', 'shift', 'hadir', 'terjadwal', 'terlambat', 'menit_terlambat',
  'pulang_cepat', 'belum_absen', 'izin', 'lembur', 'seragam_tdk_sesuai', 'menunggu_validasi', 'menunggu_izin',
  'daftar_terlambat', 'daftar_belum_absen', 'link'];
export const TEMPLATE_BAWAAN_WA = {
  ringkasan_pagi: '*Ringkasan Absensi {hari}, {tanggal}*\n{gudang} · per jam {jam}\n\nHadir: {hadir} dari {terjadwal} terjadwal\nTerlambat: {terlambat} ({menit_terlambat} menit)\nBelum absen: {belum_absen}\nIzin/Cuti: {izin}\n\n*Terlambat:*\n{daftar_terlambat}\n\n*Belum absen:*\n{daftar_belum_absen}\n\nDetail: {link}',
  rekap_harian: '*Rekap Absensi {hari}, {tanggal}*\n{gudang}\n\nHadir: {hadir} dari {terjadwal} terjadwal\nTerlambat: {terlambat} ({menit_terlambat} menit)\nPulang cepat: {pulang_cepat}\nTidak absen: {belum_absen}\nIzin/Cuti: {izin}\nLembur: {lembur}\nSeragam tidak sesuai: {seragam_tdk_sesuai}\nMenunggu validasi: {menunggu_validasi}\n\n*Terlambat:*\n{daftar_terlambat}\n\n*Belum absen:*\n{daftar_belum_absen}\n\nDetail: {link}',
  pengingat_hrd: '*Pengingat Validasi Absensi*\nAda {menunggu_validasi} absensi dan {menunggu_izin} pengajuan izin/cuti/lembur yang menunggu validasi.\n\nMohon segera diproses: {link}',
  rekap_mingguan: '*Rekap Absensi Mingguan*\n{tanggal} · {gudang}\n\nHadir: {hadir} dari {terjadwal} terjadwal\nTerlambat: {terlambat} ({menit_terlambat} menit)\nPulang cepat: {pulang_cepat}\nTidak absen: {belum_absen}\nIzin/Cuti: {izin}\nLembur: {lembur}\n\n*Paling sering terlambat:*\n{daftar_terlambat}\n\n*Tidak absen:*\n{daftar_belum_absen}\n\nDetail: {link}',
  rekap_bulanan: '*Rekap Absensi Bulanan*\n{tanggal} · {gudang}\n\nHadir: {hadir} dari {terjadwal} terjadwal\nTerlambat: {terlambat} ({menit_terlambat} menit)\nPulang cepat: {pulang_cepat}\nTidak absen: {belum_absen}\nIzin/Cuti: {izin}\nLembur: {lembur}\n\n*Paling sering terlambat:*\n{daftar_terlambat}\n\n*Tidak absen:*\n{daftar_belum_absen}\n\nDetail: {link}'
};

// Tulis wa_perintah lalu tunggu jawaban server (maks ~30 detik). Melempar
// Error berisi keterangan server kalau gagal atau tidak dijawab.
export async function jalankanPerintahWa(isi) {
  const ref_ = await addDoc(collection(db, 'wa_perintah'), { ...isi, dibuat_oleh: window.currentUser.email || '', dibuat_pada: serverTimestamp() });
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const snap = await getDoc(ref_);
    const x = snap.exists() ? snap.data() : {};
    if (!x.hasil) continue;
    if (x.hasil === 'selesai') return x;
    throw new Error(x.keterangan || 'sebab tidak diketahui');
  }
  throw new Error('Server belum menjawab. Coba lagi beberapa saat lagi.');
}

export function normalisasiNomor(nomor) {
  let n = String(nomor || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  else if (n.startsWith('8')) n = '62' + n;
  return n;
}

const AppWhatsappGateway = {
  setup() {
    const tabAktif = ref('config');
    const bolehUbah = computed(() => ['owner', 'pic_owner'].includes((window.currentUser?.role || '').toLowerCase()));

    // Config API: hanya tes kirim — koneksi & token diatur di server.
    const nomorTes = ref('');
    const mengujiKirim = ref(false);
    async function tesKirim() {
      if (!nomorTes.value.trim()) return alert("Masukkan nomor HP tujuan tes terlebih dahulu!");
      mengujiKirim.value = true;
      const berhasil = await window.kirimPesanWhatsapp(
        normalisasiNomor(nomorTes.value),
        "Ini pesan tes dari Zevanic ERP. Jika Anda menerima ini, WhatsApp Gateway sudah tersambung dengan benar.",
        "Tes"
      );
      mengujiKirim.value = false;
      alert(berhasil ? "Pesan tes terkirim! Cek WhatsApp di nomor tersebut." : "Gagal mengirim pesan tes. Buka tab Monitoring Respon untuk melihat alasannya (mis. token invalid, device disconnect, kuota habis).");
    }

    // ---- Phonebook ----
    const kontak = ref([]);
    const grupPb = ref([]);
    const waGroup = ref([]);
    const memuatPb = ref(false);
    async function muatPhonebook() {
      memuatPb.value = true;
      try {
        const [sk, sg, sw] = await Promise.all([
          getDocs(query(collection(db, 'wa_kontak'), orderBy('nama'))),
          getDocs(query(collection(db, 'wa_grup_phonebook'), orderBy('nama'))),
          getDocs(query(collection(db, 'wa_group'), orderBy('nama')))
        ]);
        kontak.value = sk.docs.map(d => ({ id: d.id, ...d.data() }));
        grupPb.value = sg.docs.map(d => ({ id: d.id, ...d.data() }));
        waGroup.value = sw.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal memuat phonebook:', e);
        alert('Gagal memuat Phonebook.');
      }
      memuatPb.value = false;
    }
    const cariKontak = ref('');
    const kontakTersaring = computed(() => {
      const k = cariKontak.value.trim().toLowerCase();
      if (!k) return kontak.value;
      return kontak.value.filter(x => (x.nama || '').toLowerCase().includes(k) || (x.nomor || '').includes(k));
    });
    const namaKontak = id => (kontak.value.find(k => k.id === id) || {}).nama || '(terhapus)';
    const grupDariKontak = id => grupPb.value.filter(g => (g.anggota || []).includes(id)).map(g => g.nama);

    // Form kontak (tambah/ubah)
    const formKontak = reactive({ buka: false, id: null, nama: '', nomor: '', peran: '', email_karyawan: '' });
    const menyimpanKontak = ref(false);
    function bukaKontak(k) {
      Object.assign(formKontak, { buka: true, id: k ? k.id : null, nama: k ? k.nama : '', nomor: k ? k.nomor : '', peran: k ? (k.peran || '') : '', email_karyawan: k ? (k.email_karyawan || '') : '' });
      hasilCariKaryawan.value = [];
      cariKaryawan.value = '';
    }
    async function simpanKontak() {
      const nomor = normalisasiNomor(formKontak.nomor);
      if (!formKontak.nama.trim()) return alert('Nama wajib diisi.');
      if (nomor.length < 10) return alert('Nomor WA tidak valid.');
      const dobel = kontak.value.find(k => k.nomor === nomor && k.id !== formKontak.id);
      if (dobel) return alert(`Nomor ini sudah tersimpan atas nama ${dobel.nama}.`);
      menyimpanKontak.value = true;
      const data = { nama: formKontak.nama.trim(), nomor, peran: formKontak.peran.trim(), email_karyawan: formKontak.email_karyawan || '' };
      try {
        if (formKontak.id) await updateDoc(doc(db, 'wa_kontak', formKontak.id), data);
        else await addDoc(collection(db, 'wa_kontak'), { ...data, dibuat_pada: serverTimestamp() });
        formKontak.buka = false;
        await muatPhonebook();
      } catch (e) {
        console.error('Gagal simpan kontak:', e);
        alert('Gagal menyimpan kontak.');
      }
      menyimpanKontak.value = false;
    }
    async function hapusKontak(k) {
      if (!confirm(`Hapus kontak ${k.nama}? Kontak ini juga dicabut dari semua grup phonebook.`)) return;
      try {
        for (const g of grupPb.value.filter(g => (g.anggota || []).includes(k.id))) {
          await updateDoc(doc(db, 'wa_grup_phonebook', g.id), { anggota: g.anggota.filter(x => x !== k.id) });
        }
        await deleteDoc(doc(db, 'wa_kontak', k.id));
        await muatPhonebook();
      } catch (e) {
        console.error('Gagal hapus kontak:', e);
        alert('Gagal menghapus kontak.');
      }
    }
    // Ambil dari Daftar Karyawan: cari lewat nama_lower (sama dengan kotak cari Daftar Karyawan).
    const cariKaryawan = ref('');
    const hasilCariKaryawan = ref([]);
    const mencariKaryawan = ref(false);
    async function jalankanCariKaryawan() {
      const k = cariKaryawan.value.trim().toLowerCase();
      if (k.length < 2) return alert('Ketik minimal 2 huruf nama.');
      mencariKaryawan.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('nama_lower'), startAt(k), endAt(k + '\uf8ff'), limit(10)));
        hasilCariKaryawan.value = snap.docs.map(d => ({ email: d.id, nama: d.data().nama || d.data().name || d.id, hp: d.data().hp || '', jabatan: d.data().jabatan || '' }));
        if (!hasilCariKaryawan.value.length) alert('Tidak ada karyawan dengan awalan nama itu.');
      } catch (e) {
        console.error('Gagal cari karyawan:', e);
        alert('Gagal mencari karyawan.');
      }
      mencariKaryawan.value = false;
    }
    function pakaiKaryawan(u) {
      Object.assign(formKontak, { nama: u.nama, nomor: u.hp, peran: formKontak.peran || u.jabatan, email_karyawan: u.email });
      hasilCariKaryawan.value = [];
    }

    // Form grup phonebook
    const formGrup = reactive({ buka: false, id: null, nama: '', anggota: [] });
    const menyimpanGrup = ref(false);
    function bukaGrup(g) {
      Object.assign(formGrup, { buka: true, id: g ? g.id : null, nama: g ? g.nama : '', anggota: g ? [...(g.anggota || [])] : [] });
    }
    function toggleAnggota(id) {
      const i = formGrup.anggota.indexOf(id);
      if (i >= 0) formGrup.anggota.splice(i, 1); else formGrup.anggota.push(id);
    }
    async function simpanGrup() {
      if (!formGrup.nama.trim()) return alert('Nama grup wajib diisi.');
      menyimpanGrup.value = true;
      const data = { nama: formGrup.nama.trim(), anggota: [...formGrup.anggota] };
      try {
        if (formGrup.id) await updateDoc(doc(db, 'wa_grup_phonebook', formGrup.id), data);
        else await addDoc(collection(db, 'wa_grup_phonebook'), { ...data, dibuat_pada: serverTimestamp() });
        formGrup.buka = false;
        await muatPhonebook();
      } catch (e) {
        console.error('Gagal simpan grup:', e);
        alert('Gagal menyimpan grup phonebook.');
      }
      menyimpanGrup.value = false;
    }
    async function hapusGrup(g) {
      if (!confirm(`Hapus grup phonebook ${g.nama}? Kontaknya tidak ikut terhapus.`)) return;
      try { await deleteDoc(doc(db, 'wa_grup_phonebook', g.id)); await muatPhonebook(); }
      catch (e) { console.error('Gagal hapus grup:', e); alert('Gagal menghapus grup.'); }
    }

    // Form WA Group + ambil daftar dari Fonnte
    const formWa = reactive({ buka: false, id: null, nama: '', group_id: '', catatan: '' });
    const menyimpanWa = ref(false);
    function bukaWa(w) {
      Object.assign(formWa, { buka: true, id: w ? w.id : null, nama: w ? w.nama : '', group_id: w ? w.group_id : '', catatan: w ? (w.catatan || '') : '' });
    }
    async function simpanWa() {
      const gid = formWa.group_id.trim();
      if (!formWa.nama.trim()) return alert('Nama grup wajib diisi.');
      if (!gid.endsWith('@g.us')) return alert('ID grup harus berakhiran @g.us.');
      const dobel = waGroup.value.find(w => w.group_id === gid && w.id !== formWa.id);
      if (dobel) return alert(`ID grup ini sudah tersimpan sebagai ${dobel.nama}.`);
      menyimpanWa.value = true;
      const data = { nama: formWa.nama.trim(), group_id: gid, catatan: formWa.catatan.trim() };
      try {
        if (formWa.id) await updateDoc(doc(db, 'wa_group', formWa.id), data);
        else await addDoc(collection(db, 'wa_group'), { ...data, dibuat_pada: serverTimestamp() });
        formWa.buka = false;
        await muatPhonebook();
      } catch (e) {
        console.error('Gagal simpan WA Group:', e);
        alert('Gagal menyimpan WA Group.');
      }
      menyimpanWa.value = false;
    }
    async function hapusWa(w) {
      if (!confirm(`Hapus WA Group ${w.nama} dari daftar? Grup WhatsApp-nya sendiri tidak terpengaruh.`)) return;
      try { await deleteDoc(doc(db, 'wa_group', w.id)); await muatPhonebook(); }
      catch (e) { console.error('Gagal hapus WA Group:', e); alert('Gagal menghapus WA Group.'); }
    }
    const grupFonnte = ref(null); // null = belum diambil
    const mengambilGrup = ref(false);
    async function ambilGrupFonnte() {
      mengambilGrup.value = true;
      try {
        const x = await jalankanPerintahWa({ aksi: 'ambil_grup' });
        grupFonnte.value = x.data || [];
      } catch (e) {
        console.error('Gagal ambil grup Fonnte:', e);
        alert('Gagal mengambil daftar grup dari Fonnte: ' + e.message);
      }
      mengambilGrup.value = false;
    }
    const sudahTersimpan = gid => waGroup.value.some(w => w.group_id === gid);
    function tambahDariFonnte(g) { bukaWa(null); formWa.nama = g.nama; formWa.group_id = g.id; }

    // ---- Template Pesan (hub): satu template per dokumen wa_jadwal ----
    const daftarJadwal = ref([]);
    const memuatJadwal = ref(false);
    const jadwalDipilih = ref(null);
    const isiTemplate = ref('');
    const areaTemplate = ref(null);
    const pratinjau = ref('');
    const prosesTemplate = ref('');
    async function muatTemplate() {
      memuatJadwal.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'wa_jadwal'), orderBy('nama')));
        daftarJadwal.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (jadwalDipilih.value && !daftarJadwal.value.some(j => j.id === jadwalDipilih.value.id)) jadwalDipilih.value = null;
      } catch (e) {
        console.error('Gagal memuat template:', e);
        alert('Gagal memuat daftar template.');
      }
      memuatJadwal.value = false;
    }
    const jadwalPerModul = computed(() => MODUL_WA.map(m => ({ ...m, jadwal: daftarJadwal.value.filter(j => (j.modul || 'absensi') === m.key) })));
    const labelJenis = key => (JENIS_REPORT_WA.find(j => j.key === key) || {}).label || key;
    function pilihJadwal(j) {
      jadwalDipilih.value = j;
      isiTemplate.value = j.template || TEMPLATE_BAWAAN_WA[j.jenis] || '';
      pratinjau.value = '';
    }
    function sisipkan(ph) {
      const el = areaTemplate.value;
      const teks = `{${ph}}`;
      if (!el) { isiTemplate.value += teks; return; }
      const a = el.selectionStart, b = el.selectionEnd;
      isiTemplate.value = isiTemplate.value.slice(0, a) + teks + isiTemplate.value.slice(b);
      requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + teks.length; });
    }
    function kembalikanBawaan() {
      if (confirm('Ganti isi template dengan versi bawaan? Perubahan belum disimpan sampai klik Simpan.')) isiTemplate.value = TEMPLATE_BAWAAN_WA[jadwalDipilih.value.jenis] || '';
    }
    async function simpanTemplate() {
      if (!isiTemplate.value.trim()) return alert('Isi template tidak boleh kosong.');
      prosesTemplate.value = 'simpan';
      try {
        await updateDoc(doc(db, 'wa_jadwal', jadwalDipilih.value.id), { template: isiTemplate.value, diubah_pada: serverTimestamp() });
        jadwalDipilih.value.template = isiTemplate.value;
        alert('Template tersimpan.');
      } catch (e) {
        console.error('Gagal simpan template:', e);
        alert('Gagal menyimpan template.');
      }
      prosesTemplate.value = '';
    }
    async function perintahTemplate(aksi) {
      prosesTemplate.value = aksi;
      try {
        const x = await jalankanPerintahWa({ aksi, jadwal_id: jadwalDipilih.value.id, template: isiTemplate.value });
        pratinjau.value = (x.data && x.data.pesan) || '';
        if (aksi === 'tes_jadwal') alert('Pesan tes diantrekan. ' + (x.keterangan || ''));
      } catch (e) {
        alert((aksi === 'tes_jadwal' ? 'Gagal kirim tes: ' : 'Gagal membuat pratinjau: ') + e.message);
      }
      prosesTemplate.value = '';
    }

    // Monitoring Respon dibaca lewat `waktu_ts` + orderBy+limit sungguhan,
    // dengan "Muat Lagi" (cursor startAfter, menambah ke daftar) — koleksi
    // wa_log bisa ribuan dokumen, jangan full fetch. Dokumen wa_log tanpa
    // `waktu_ts` tidak ikut query ini; ada tombol terpisah untuk membacanya.
    const UKURAN_MUAT_LOG = 50;
    const daftarLog = ref([]);
    const memuatLog = ref(true);
    const memuatLogLagi = ref(false);
    const adaLogBerikutnya = ref(false);
    let cursorLogTerakhir = null;
    const filterStatus = ref('ALL');
    const daftarLogTersaring = computed(() => {
      if (filterStatus.value === 'ALL') return daftarLog.value;
      const cariSukses = filterStatus.value === 'Terkirim';
      return daftarLog.value.filter(log => !!log.sukses === cariSukses);
    });

    async function muatMonitoring() {
      memuatLog.value = true;
      daftarLog.value = [];
      cursorLogTerakhir = null;
      adaLogBerikutnya.value = false;
      try {
        const snap = await getDocs(query(collection(db, "wa_log"), orderBy("waktu_ts", "desc"), limit(UKURAN_MUAT_LOG)));
        const docs = snap.docs;
        daftarLog.value = docs.map(d => ({ id: d.id, ...d.data() }));
        if (docs.length > 0) cursorLogTerakhir = docs[docs.length - 1];
        adaLogBerikutnya.value = docs.length === UKURAN_MUAT_LOG;
      } catch (e) {
        console.error("Gagal memuat monitoring WA:", e);
      }
      memuatLog.value = false;
    }

    async function muatLagiLog() {
      if (!cursorLogTerakhir || memuatLogLagi.value) return;
      memuatLogLagi.value = true;
      try {
        const snap = await getDocs(query(collection(db, "wa_log"), orderBy("waktu_ts", "desc"), startAfter(cursorLogTerakhir), limit(UKURAN_MUAT_LOG)));
        const docs = snap.docs;
        daftarLog.value = [...daftarLog.value, ...docs.map(d => ({ id: d.id, ...d.data() }))];
        if (docs.length > 0) cursorLogTerakhir = docs[docs.length - 1];
        adaLogBerikutnya.value = docs.length === UKURAN_MUAT_LOG;
      } catch (e) {
        console.error("Gagal memuat log WA berikutnya:", e);
      }
      memuatLogLagi.value = false;
    }

    // Jaring pengaman MANUAL (bukan otomatis) — lihat log dari SEBELUM waktu_ts
    // ada, TIDAK tersentuh oleh orderBy(waktu_ts) di atas. Fetch- semua SEKALI
    // kalau diklik, sama seperti "Cek Data Sangat Lama".
    const memuatLogLama = ref(false);
    const daftarLogLama = ref([]);
    const sudahCekLogLama = ref(false);
    async function muatLogLama() {
      memuatLogLama.value = true;
      try {
        const snap = await getDocs(collection(db, "wa_log"));
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!d.waktu_ts) list.push({ id: docSnap.id, ...d });
        });
        list.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
        daftarLogLama.value = list;
        sudahCekLogLama.value = true;
      } catch (e) {
        console.error("Gagal memuat log WA lama:", e);
      }
      memuatLogLama.value = false;
    }

    function pindahTab(nama) {
      tabAktif.value = nama;
      if (nama === 'monitor') muatMonitoring();
      if (nama === 'phonebook') muatPhonebook();
      if (nama === 'template') muatTemplate();
    }

    // muat — dipanggil ulang tiap menu WhatsApp diklik lagi (pastikanMountWhatsapp);
    // refresh pill-tab yang sedang aktif saja.
    function muat() {
      if (tabAktif.value === 'monitor') muatMonitoring();
      else if (tabAktif.value === 'phonebook') muatPhonebook();
      else if (tabAktif.value === 'template') muatTemplate();
    }
    onMounted(async () => { await window.authReady; });

    return {
      tabAktif, pindahTab, muat, bolehUbah,
      nomorTes, mengujiKirim, tesKirim,
      kontak, grupPb, waGroup, memuatPb, muatPhonebook, cariKontak, kontakTersaring, namaKontak, grupDariKontak,
      formKontak, menyimpanKontak, bukaKontak, simpanKontak, hapusKontak,
      cariKaryawan, hasilCariKaryawan, mencariKaryawan, jalankanCariKaryawan, pakaiKaryawan,
      formGrup, menyimpanGrup, bukaGrup, toggleAnggota, simpanGrup, hapusGrup,
      formWa, menyimpanWa, bukaWa, simpanWa, hapusWa, grupFonnte, mengambilGrup, ambilGrupFonnte, sudahTersimpan, tambahDariFonnte,
      daftarLog, daftarLogTersaring, filterStatus, memuatLog, muatMonitoring,
      adaLogBerikutnya, memuatLogLagi, muatLagiLog,
      memuatLogLama, daftarLogLama, sudahCekLogLama, muatLogLama,
      daftarJadwal, memuatJadwal, jadwalDipilih, isiTemplate, areaTemplate, pratinjau, prosesTemplate, muatTemplate,
      jadwalPerModul, labelJenis, pilihJadwal, sisipkan, kembalikanBawaan, simpanTemplate, perintahTemplate, PLACEHOLDER_WA
    };
  },
  template: `
    <div class="gc-card">
      <div>
        <h2 class="gc-heading" style="font-size:16.5px; font-weight:700; display:flex; align-items:center;"><i class="fab fa-whatsapp" style="color:var(--ok); margin-right:10px;"></i> WhatsApp Gateway</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:3px;">Kirim report dan pengingat lewat Fonnte. Token disimpan di server (Secret Manager), tidak pernah ada di aplikasi ini.</p>
      </div>
      <div class="flex space-x-2 overflow-x-auto no-scrollbar" style="padding-top:14px; margin-top:14px; border-top:1px solid var(--line);">
        <button @click="pindahTab('config')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'config' }"><i class="fas fa-cogs" style="margin-right:6px;"></i> Config API</button>
        <button @click="pindahTab('template')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'template' }"><i class="fas fa-comment-dots" style="margin-right:6px;"></i> Template Pesan</button>
        <button @click="pindahTab('monitor')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'monitor' }"><i class="fas fa-chart-line" style="margin-right:6px;"></i> Monitoring Respon</button>
        <button @click="pindahTab('phonebook')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'phonebook' }"><i class="fas fa-address-book" style="margin-right:6px;"></i> Phonebook</button>
      </div>
    </div>

    <div v-show="tabAktif === 'config'" style="margin-top:16px;">
      <div class="gc-card" style="max-width:480px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;">Koneksi Fonnte</h3>
        <p style="font-size:12px; color:var(--text-muted); line-height:1.55; margin-bottom:14px;">Pesan dikirim dari server ERP langsung ke Fonnte, memakai nomor yang sama dengan bot report. Token device disimpan sebagai <b>FONNTE_TOKEN</b> di Secret Manager Firebase dan diganti lewat Firebase CLI, tidak dari layar ini.</p>
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:8px; font-family:'Poppins',sans-serif;">Tes kirim pesan</label>
        <div style="display:flex; gap:8px;">
          <input v-model="nomorTes" type="text" placeholder="08xxxxxxxxxx" style="flex:1; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
          <button @click="tesKirim" :disabled="mengujiKirim" class="btn-primary" style="white-space:nowrap;">
            <i v-if="mengujiKirim" class="fas fa-spinner fa-spin"></i><span v-else>Kirim tes</span>
          </button>
        </div>
      </div>
    </div>

    <div v-show="tabAktif === 'template'" style="margin-top:16px;" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="gc-card" style="align-self:start;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin-bottom:4px;">Template per jadwal</h3>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Template lahir saat jadwal dibuat di Report Absensi › Jadwal Kirim WA, dan ikut terhapus bersama jadwalnya.</p>
        <div v-if="memuatJadwal" style="font-size:12px; color:var(--text-faint);">Memuat...</div>
        <div v-for="m in jadwalPerModul" :key="m.key" style="margin-bottom:12px;">
          <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px;">{{ m.label }}</div>
          <div v-if="m.jadwal.length === 0" style="font-size:11.5px; color:var(--text-faint);">{{ m.key === 'absensi' ? 'Belum ada jadwal.' : 'Menyusul.' }}</div>
          <button v-for="j in m.jadwal" :key="j.id" @click="pilihJadwal(j)" class="btn-outline" :class="{ filled: jadwalDipilih && jadwalDipilih.id === j.id }" style="display:block; width:100%; text-align:left; margin-bottom:6px; padding:8px 12px;">
            <div style="font-size:12px; font-weight:700;">{{ j.nama }}</div>
            <div style="font-size:10.5px; opacity:.8;">{{ labelJenis(j.jenis) }}<span v-if="!j.aktif"> · mati</span></div>
          </button>
        </div>
      </div>

      <div class="gc-card md:col-span-2">
        <div v-if="!jadwalDipilih" style="font-size:12px; color:var(--text-faint); padding:20px 0; text-align:center;">Pilih jadwal di kiri untuk mengubah templatenya.</div>
        <template v-else>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">Template: {{ jadwalDipilih.nama }}</h3>
            <button v-if="bolehUbah" @click="kembalikanBawaan" class="btn-outline" style="font-size:11px; padding:6px 10px;">Kembalikan ke bawaan</button>
          </div>
          <div style="font-size:11px; font-weight:700; margin-bottom:6px;">Sisipkan data (klik untuk menaruh di posisi kursor)</div>
          <div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;">
            <button v-for="ph in PLACEHOLDER_WA" :key="ph" @click="sisipkan(ph)" :disabled="!bolehUbah" class="tag neutral" style="border:none; cursor:pointer; font-family:'Poppins',sans-serif;">{{ '{' + ph + '}' }}</button>
          </div>
          <textarea ref="areaTemplate" v-model="isiTemplate" :readonly="!bolehUbah" rows="14" style="width:100%; padding:10px 12px; border:1.5px solid var(--line); border-radius:12px; font-size:12.5px; line-height:1.5; background:var(--surface); font-family:inherit;"></textarea>
          <p style="font-size:10.5px; color:var(--text-muted); margin-top:6px; line-height:1.5;">Format WA: *tebal*, _miring_, ~coret~. Daftar nama dikelompokkan per gudang, satu nama per baris, maksimal 10 per gudang lalu "…dan N lainnya". Kalau daftarnya kosong, satu baris judul tepat di atas {daftar_...} ikut disembunyikan. {menunggu_validasi} dan {menunggu_izin} = isi Antrean saat pesan dikirim. Jadwal yang dipecah per bagian memakai template ini untuk tiap bagian.</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
            <button @click="perintahTemplate('pratinjau_jadwal')" :disabled="!!prosesTemplate" class="btn-outline">{{ prosesTemplate === 'pratinjau_jadwal' ? 'Menyusun...' : 'Pratinjau dengan data saat ini' }}</button>
            <button v-if="bolehUbah" @click="perintahTemplate('tes_jadwal')" :disabled="!!prosesTemplate" class="btn-outline">{{ prosesTemplate === 'tes_jadwal' ? 'Mengirim...' : 'Kirim tes ke nomor saya' }}</button>
            <button v-if="bolehUbah" @click="simpanTemplate" :disabled="!!prosesTemplate" class="btn-primary">{{ prosesTemplate === 'simpan' ? 'Menyimpan...' : 'Simpan template' }}</button>
          </div>
          <div v-if="pratinjau" style="margin-top:14px; background:var(--ivory-dim); border-radius:14px; padding:12px;">
            <div style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">Pratinjau pesan WA</div>
            <div style="white-space:pre-wrap; font-size:12.5px; line-height:1.5; background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:10px 12px;">{{ pratinjau }}</div>
          </div>
        </template>
      </div>
    </div>

    <div v-show="tabAktif === 'monitor'" style="margin-top:16px;">
      <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
        <div>
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">Riwayat pengiriman</h3>
          <p style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">Termuat {{ daftarLog.length }} pengiriman terbaru — klik "Muat Lagi" di bawah untuk yang lebih lama.</p>
        </div>
        <button @click="muatMonitoring" class="btn-outline"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
      </div>
      <div style="margin-bottom:12px;">
        <select v-model="filterStatus" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="ALL">Semua status kirim</option>
          <option value="Terkirim">Terkirim</option>
          <option value="Gagal">Gagal</option>
        </select>
      </div>
      <div class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
        <table class="gc-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Jenis</th>
              <th>Nomor Tujuan</th>
              <th>Status</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="memuatLog"><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat riwayat...</td></tr>
            <tr v-else-if="daftarLog.length === 0"><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada riwayat pengiriman.</td></tr>
            <tr v-else-if="daftarLogTersaring.length === 0"><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada yang cocok filter.</td></tr>
            <tr v-for="log in daftarLogTersaring" :key="log.id">
              <td class="gc-cell-muted">{{ log.waktu || '-' }}</td>
              <td style="font-weight:600;">{{ log.jenis || '-' }}</td>
              <td style="font-family:'Poppins',sans-serif; font-size:11.5px;">{{ log.target || '-' }}</td>
              <td>
                <span v-if="log.sukses" class="tag ok">Terkirim</span>
                <span v-else class="tag danger">Gagal</span>
              </td>
              <td class="gc-cell-muted" style="max-width:220px; overflow:hidden; text-overflow:ellipsis;" :title="log.keterangan || ''">{{ log.keterangan || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="adaLogBerikutnya" style="text-align:center; margin-top:14px;">
        <button @click="muatLagiLog" :disabled="memuatLogLagi" class="btn-outline filled">
          <i class="fas" :class="memuatLogLagi ? 'fa-spinner fa-spin' : 'fa-rotate-right'" style="margin-right:6px;"></i>
          {{ memuatLogLagi ? 'Memuat...' : 'Muat Lagi (50 berikutnya)' }}
        </button>
      </div>

      <!--
        Jaring pengaman: log dari SEBELUM waktu_ts ada (lihat catatan di muatLogLama,
        js/vue-whatsapp-gateway.js) — manual, tidak otomatis.
      -->
      <div class="gc-card" style="margin-top:16px;">
        <button v-if="!sudahCekLogLama" @click="muatLogLama" :disabled="memuatLogLama" class="btn-outline" style="font-size:11px; padding:7px 12px;" title="Fetch manual sekali — cari log dari sebelum pembaruan hemat ini (tidak otomatis, di luar 'Muat Lagi' di atas)">
          <i class="fas fa-magnifying-glass" style="margin-right:5px;"></i>{{ memuatLogLama ? 'Memeriksa...' : 'Lihat Log Sebelum Pembaruan' }}
        </button>
        <div v-else>
          <p style="font-size:11px; color:var(--text-muted); margin-bottom:10px; font-style:italic;"><i class="fas fa-circle-info" style="margin-right:5px;"></i>Ketemu {{ daftarLogLama.length }} log dari sebelum pembaruan ini (dicatat dengan waktu teks, bukan Timestamp — diurutkan best-effort).</p>
          <div v-if="daftarLogLama.length > 0" class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
            <table class="gc-table">
              <thead><tr><th>Waktu</th><th>Jenis</th><th>Nomor Tujuan</th><th>Status</th><th>Keterangan</th></tr></thead>
              <tbody>
                <tr v-for="log in daftarLogLama" :key="log.id">
                  <td class="gc-cell-muted">{{ log.waktu || '-' }}</td>
                  <td style="font-weight:600;">{{ log.jenis || '-' }}</td>
                  <td style="font-family:'Poppins',sans-serif; font-size:11.5px;">{{ log.target || '-' }}</td>
                  <td><span v-if="log.sukses" class="tag ok">Terkirim</span><span v-else class="tag danger">Gagal</span></td>
                  <td class="gc-cell-muted" style="max-width:220px; overflow:hidden; text-overflow:ellipsis;" :title="log.keterangan || ''">{{ log.keterangan || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div v-show="tabAktif === 'phonebook'" style="margin-top:16px; display:flex; flex-direction:column; gap:16px;">
      <div v-if="memuatPb" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat phonebook...</div>

      <div class="gc-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">Kontak <span class="tag neutral" style="margin-left:4px;">{{ kontak.length }}</span></h3>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input v-model="cariKontak" type="text" placeholder="Cari nama / nomor..." style="padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; background:var(--ivory-dim);">
            <button v-if="bolehUbah" @click="bukaKontak(null)" class="btn-primary"><i class="fas fa-plus" style="margin-right:6px;"></i>Kontak</button>
          </div>
        </div>
        <div class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
          <table class="gc-table">
            <thead><tr><th>Nama</th><th>Nomor WA</th><th>Peran</th><th>Grup phonebook</th><th v-if="bolehUbah"></th></tr></thead>
            <tbody>
              <tr v-if="kontakTersaring.length === 0"><td :colspan="bolehUbah ? 5 : 4" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada kontak.</td></tr>
              <tr v-for="k in kontakTersaring" :key="k.id">
                <td style="font-weight:700;">{{ k.nama }}<div v-if="k.email_karyawan" style="font-size:10.5px; font-weight:400; color:var(--text-faint);">{{ k.email_karyawan }}</div></td>
                <td style="font-family:'Poppins',sans-serif; font-size:11.5px;">{{ k.nomor }}</td>
                <td>{{ k.peran || '-' }}</td>
                <td><span v-for="g in grupDariKontak(k.id)" :key="g" class="tag neutral" style="margin:0 4px 4px 0;">{{ g }}</span><span v-if="grupDariKontak(k.id).length === 0" style="color:var(--text-faint);">-</span></td>
                <td v-if="bolehUbah" style="text-align:right; white-space:nowrap;">
                  <button @click="bukaKontak(k)" class="btn-outline" style="padding:5px 10px; font-size:11px;">Ubah</button>
                  <button @click="hapusKontak(k)" class="btn-outline" style="padding:5px 10px; font-size:11px; color:var(--danger); border-color:var(--danger);">Hapus</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="gc-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">Grup phonebook</h3>
          <button v-if="bolehUbah" @click="bukaGrup(null)" class="btn-primary"><i class="fas fa-plus" style="margin-right:6px;"></i>Grup</button>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Daftar kontak buatan sendiri. Pesan dikirim satu-satu ke tiap anggota.</p>
        <div v-if="grupPb.length === 0" style="font-size:12px; color:var(--text-faint);">Belum ada grup phonebook.</div>
        <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-3">
          <div v-for="g in grupPb" :key="g.id" style="border:1px solid var(--line); border-radius:16px; padding:12px 14px; background:var(--surface);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div class="gc-heading" style="font-size:13px; font-weight:700;">{{ g.nama }}</div>
              <span class="tag neutral">{{ (g.anggota || []).length }} anggota</span>
            </div>
            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:8px;"><span v-for="id in (g.anggota || [])" :key="id" class="tag neutral">{{ namaKontak(id) }}</span></div>
            <div v-if="bolehUbah" style="display:flex; gap:6px; margin-top:10px;">
              <button @click="bukaGrup(g)" class="btn-outline" style="flex:1; padding:5px 10px; font-size:11px;">Ubah</button>
              <button @click="hapusGrup(g)" class="btn-outline" style="flex:1; padding:5px 10px; font-size:11px; color:var(--danger); border-color:var(--danger);">Hapus</button>
            </div>
          </div>
        </div>
      </div>

      <div class="gc-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:4px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">WA Group</h3>
          <div v-if="bolehUbah" style="display:flex; gap:8px;">
            <button @click="ambilGrupFonnte" :disabled="mengambilGrup" class="btn-outline"><i class="fas" :class="mengambilGrup ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'" style="margin-right:6px;"></i>{{ mengambilGrup ? 'Mengambil...' : 'Ambil daftar grup dari Fonnte' }}</button>
            <button @click="bukaWa(null)" class="btn-primary"><i class="fas fa-plus" style="margin-right:6px;"></i>WA Group</button>
          </div>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Grup WhatsApp sungguhan. Nomor bot Fonnte harus sudah menjadi anggota grupnya.</p>
        <div v-if="grupFonnte !== null" style="border:1px dashed var(--line); border-radius:14px; padding:12px; margin-bottom:12px;">
          <div style="font-size:12px; font-weight:700; margin-bottom:8px;">Grup yang diikuti nomor Fonnte ({{ grupFonnte.length }})</div>
          <div v-if="grupFonnte.length === 0" style="font-size:12px; color:var(--text-faint);">Nomor Fonnte belum ikut grup mana pun.</div>
          <div v-for="g in grupFonnte" :key="g.id" style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--ivory-dim); font-size:12px;">
            <span style="flex:1; font-weight:600;">{{ g.nama || '(tanpa nama)' }}</span>
            <span style="font-family:'Poppins',sans-serif; font-size:11px; color:var(--text-faint);">{{ g.id }}</span>
            <span v-if="sudahTersimpan(g.id)" class="tag ok">Tersimpan</span>
            <button v-else @click="tambahDariFonnte(g)" class="btn-outline" style="padding:4px 10px; font-size:11px;">Tambah</button>
          </div>
        </div>
        <div class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
          <table class="gc-table">
            <thead><tr><th>Nama grup</th><th>ID grup</th><th>Catatan</th><th v-if="bolehUbah"></th></tr></thead>
            <tbody>
              <tr v-if="waGroup.length === 0"><td :colspan="bolehUbah ? 4 : 3" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada WA Group.</td></tr>
              <tr v-for="w in waGroup" :key="w.id">
                <td style="font-weight:700;">{{ w.nama }}</td>
                <td style="font-family:'Poppins',sans-serif; font-size:11.5px;">{{ w.group_id }}</td>
                <td>{{ w.catatan || '-' }}</td>
                <td v-if="bolehUbah" style="text-align:right; white-space:nowrap;">
                  <button @click="bukaWa(w)" class="btn-outline" style="padding:5px 10px; font-size:11px;">Ubah</button>
                  <button @click="hapusWa(w)" class="btn-outline" style="padding:5px 10px; font-size:11px; color:var(--danger); border-color:var(--danger);">Hapus</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="formKontak.buka" style="position:fixed; inset:0; background:rgba(var(--scrim-rgb),.6); z-index:60; display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); width:100%; max-width:460px; max-height:90vh; overflow:auto; padding:22px; border-radius:20px;">
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; margin-bottom:14px;">{{ formKontak.id ? 'Ubah kontak' : 'Tambah kontak' }}</h3>
        <div style="border:1px dashed var(--line); border-radius:12px; padding:10px; margin-bottom:14px;">
          <label style="display:block; font-size:11.5px; font-weight:700; margin-bottom:6px;">Ambil dari Daftar Karyawan (opsional)</label>
          <div style="display:flex; gap:8px;">
            <input v-model="cariKaryawan" type="text" placeholder="Awalan nama karyawan..." @keyup.enter="jalankanCariKaryawan" style="flex:1; padding:8px 10px; border:1.5px solid var(--line); border-radius:10px; font-size:12px;">
            <button @click="jalankanCariKaryawan" :disabled="mencariKaryawan" class="btn-outline" style="padding:7px 12px;">{{ mencariKaryawan ? '...' : 'Cari' }}</button>
          </div>
          <button v-for="u in hasilCariKaryawan" :key="u.email" @click="pakaiKaryawan(u)" style="display:flex; width:100%; justify-content:space-between; gap:8px; padding:7px 4px; background:none; border:none; border-bottom:1px solid var(--ivory-dim); cursor:pointer; font-size:12px; text-align:left;">
            <span style="font-weight:600;">{{ u.nama }}</span><span style="color:var(--text-faint);">{{ u.hp || 'tanpa HP' }}</span>
          </button>
        </div>
        <div class="gc-field"><label>Nama</label><input v-model="formKontak.nama" type="text"></div>
        <div class="gc-field"><label>Nomor WA</label><input v-model="formKontak.nomor" type="text" placeholder="08xx / 628xx"></div>
        <div class="gc-field"><label>Peran (opsional)</label><input v-model="formKontak.peran" type="text" placeholder="mis. HRD, PIC SOG19, Owner"></div>
        <div style="display:flex; gap:10px; padding-top:6px;">
          <button @click="formKontak.buka = false" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="simpanKontak" :disabled="menyimpanKontak" class="btn-primary" style="flex:1;">{{ menyimpanKontak ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>
    </div>

    <div v-if="formGrup.buka" style="position:fixed; inset:0; background:rgba(var(--scrim-rgb),.6); z-index:60; display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); width:100%; max-width:460px; max-height:90vh; overflow:auto; padding:22px; border-radius:20px;">
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; margin-bottom:14px;">{{ formGrup.id ? 'Ubah grup phonebook' : 'Tambah grup phonebook' }}</h3>
        <div class="gc-field"><label>Nama grup</label><input v-model="formGrup.nama" type="text" placeholder="mis. HRD, Owner & PIC"></div>
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:6px; font-family:'Poppins',sans-serif;">Anggota ({{ formGrup.anggota.length }})</label>
        <div style="max-height:260px; overflow:auto; border:1px solid var(--line); border-radius:12px; padding:6px 10px; margin-bottom:12px;">
          <div v-if="kontak.length === 0" style="font-size:12px; color:var(--text-faint); padding:8px 0;">Tambahkan kontak dulu.</div>
          <label v-for="k in kontak" :key="k.id" style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:12.5px; cursor:pointer; border-bottom:1px solid var(--ivory-dim);">
            <input type="checkbox" :checked="formGrup.anggota.includes(k.id)" @change="toggleAnggota(k.id)" style="width:15px; height:15px; accent-color:var(--burgundy);">
            <span style="flex:1;">{{ k.nama }}</span><span style="font-size:11px; color:var(--text-faint);">{{ k.peran }}</span>
          </label>
        </div>
        <div style="display:flex; gap:10px;">
          <button @click="formGrup.buka = false" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="simpanGrup" :disabled="menyimpanGrup" class="btn-primary" style="flex:1;">{{ menyimpanGrup ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>
    </div>

    <div v-if="formWa.buka" style="position:fixed; inset:0; background:rgba(var(--scrim-rgb),.6); z-index:60; display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); width:100%; max-width:420px; max-height:90vh; overflow:auto; padding:22px; border-radius:20px;">
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; margin-bottom:14px;">{{ formWa.id ? 'Ubah WA Group' : 'Tambah WA Group' }}</h3>
        <div class="gc-field"><label>Nama grup</label><input v-model="formWa.nama" type="text"></div>
        <div class="gc-field"><label>ID grup</label><input v-model="formWa.group_id" type="text" placeholder="1203xxxxxxxxxxxx@g.us" style="font-family:'Poppins',sans-serif; font-size:11.5px;"></div>
        <div class="gc-field"><label>Catatan (opsional)</label><input v-model="formWa.catatan" type="text"></div>
        <div style="display:flex; gap:10px; padding-top:6px;">
          <button @click="formWa.buka = false" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="simpanWa" :disabled="menyimpanWa" class="btn-primary" style="flex:1;">{{ menyimpanWa ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>
    </div>
  `
};

let vmWhatsapp = null;
// Sama seperti layar admin lain — mount ditunda sampai benar-benar dinavigasi
// pertama kali (lihat catatan panjang di vue-antrean-dakar.js).
window.pastikanMountWhatsapp = function() {
  if (vmWhatsapp) { if (typeof vmWhatsapp.muat === 'function') vmWhatsapp.muat(); return; }
  const mountPoint = document.getElementById('vue-whatsapp-gateway');
  if (mountPoint) vmWhatsapp = createApp(AppWhatsappGateway).mount('#vue-whatsapp-gateway');
};
window.bukaSubTabWhatsapp = function(nama) { if (vmWhatsapp) vmWhatsapp.pindahTab(nama); };
