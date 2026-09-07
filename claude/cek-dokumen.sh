#!/usr/bin/env bash
# cek-dokumen.sh — jalankan SEBELUM git push.
# Taruh di folder yang sama dengan dokumen (Code\Claude\), jalankan lewat
# Git Bash:  bash cek-dokumen.sh
# Exit 1 kalau ada pelanggaran, jadi bisa dipakai sebagai git hook.

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
gagal=0

# nama-file:batas-baris
BATAS="STATUS-PROYEK.md:150
PELAJARAN.md:120
CHECKLIST-TEST.md:100
FONDASI.md:80"

# file yang isinya harus keadaan SEKARANG, bukan cerita perubahan
TANPA_RIWAYAT="STATUS-PROYEK.md CHECKLIST-TEST.md"

echo "== Cek dokumen di $DIR =="
echo

# --- 1. Batas baris per file ------------------------------------------------
while IFS=: read -r nama maks; do
  [ -n "$nama" ] || continue
  f="$DIR/$nama"
  if [ ! -f "$f" ]; then
    echo "GAGAL  $nama tidak ada di folder ini."
    gagal=1
    continue
  fi
  b=$(wc -l < "$f" | tr -d ' ')
  if [ "$b" -gt "$maks" ]; then
    echo "GAGAL  $nama = $b baris (maks $maks)."
    case "$nama" in
      STATUS-PROYEK.md)
        echo "       Pindahkan narasi/alasan ke arsip-$(date +%Y-%m).md."
        echo "       Modul yang sudah beres total: HAPUS barisnya." ;;
      CHECKLIST-TEST.md)
        echo "       Terlalu banyak pekerjaan menggantung belum dites."
        echo "       Item yang sudah dikonfirmasi Guru: HAPUS barisnya." ;;
      PELAJARAN.md)
        echo "       Gabungkan entri yang sekelas. Tambah entri hanya untuk"
        echo "       kelas bug BARU, bukan tiap kejadian." ;;
      FONDASI.md)
        echo "       Isinya harusnya nyaris tidak berubah. Kalau membesar,"
        echo "       ada isi file lain yang salah tempat di sini." ;;
    esac
    gagal=1
  else
    echo "OK     $nama = $b baris (sisa jatah $((maks - b)))"
  fi
done <<< "$BATAS"

# --- 2. Pola terlarang ------------------------------------------------------
for nama in $TANPA_RIWAYAT; do
  f="$DIR/$nama"
  [ -f "$f" ] || continue
  # teks di dalam backtick diabaikan (itu kutipan aturan, bukan coretan asli)
  bersih=$(sed 's/`[^`]*`//g' "$f")

  n=$(printf '%s\n' "$bersih" | grep -c '~~' || true)
  if [ "$n" -gt 0 ]; then
    echo "GAGAL  $nama: ada $n baris pakai coretan (~~...~~)."
    echo "       Fakta yang tidak berlaku DIHAPUS, bukan dicoret."
    printf '%s\n' "$bersih" | grep -n '~~' | head -3 | sed 's/^/       /'
    gagal=1
  fi

  n=$(printf '%s\n' "$bersih" | grep -ciE 'DIPERBARUI|HISTORIS|Riwayat sebelumnya|status ini sekarang' || true)
  if [ "$n" -gt 0 ]; then
    echo "GAGAL  $nama: ada $n baris berisi paragraf riwayat."
    echo "       Tulis keadaan SEKARANG, bukan cerita perubahan."
    printf '%s\n' "$bersih" | grep -niE 'DIPERBARUI|HISTORIS|Riwayat sebelumnya|status ini sekarang' | head -3 | sed 's/^/       /'
    gagal=1
  fi
done

# --- 3. Arsip bulanan -------------------------------------------------------
ada_arsip=0
for f in "$DIR"/arsip-*.md; do
  [ -e "$f" ] || continue
  ada_arsip=1
  b=$(wc -l < "$f" | tr -d ' ')
  nama=$(basename "$f")
  if [ "$b" -gt 1500 ]; then
    echo "GAGAL  $nama = $b baris (maks 1500). Pecah per setengah bulan."
    gagal=1
  else
    echo "OK     $nama = $b baris"
  fi
done
if [ "$ada_arsip" -eq 0 ]; then
  echo "PERINGATAN  Belum ada arsip-YYYY-MM.md. Tanpa tujuan pemindahan,"
  echo "            narasi pasti nyangkut di STATUS-PROYEK.md."
fi

# --- 4. Dokumen liar yang tidak terdaftar -----------------------------------
for f in "$DIR"/*.md; do
  [ -e "$f" ] || continue
  nama=$(basename "$f")
  case "$nama" in
    STATUS-PROYEK.md|PELAJARAN.md|CHECKLIST-TEST.md|FONDASI.md|arsip-*.md) continue ;;
  esac
  b=$(wc -l < "$f" | tr -d ' ')
  echo "PERINGATAN  $nama ($b baris) tidak terdaftar & tidak dibatasi."
  echo "            Dokumen baru cenderung jadi tempat menumpuk. Masih perlu?"
done

echo
if [ "$gagal" -ne 0 ]; then
  echo "== ADA PELANGGARAN. Rapikan dulu sebelum push. =="
  exit 1
fi
echo "== Semua batas aman. =="
exit 0
