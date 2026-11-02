# CBT Sekolah Digital — `wwn-cbt-atm-80` v1.1.3

Aplikasi ujian digital (CBT) untuk madrasah/sekolah.
Siswa mengerjakan try out langsung dari browser (laptop & HP), guru mengelola bank soal &
paket ujian, memantau sesi live, dan melihat rekap hasil.

**Stack:** React 19 + Vite + TypeScript + Tailwind 4 (frontend, deploy di Vercel) •
Google Apps Script + Google Sheets + Google Drive (backend, gratis, milik madrasah sendiri).

---

## Fitur

| Peran | Bisa |
|---|---|
| **Siswa** | Mengerjakan paket ujian (ruang ujian anti-curang), melihat hasil & pembahasan, dashboard analisis belajar sendiri |
| **Guru** | Bank soal (tambah/ubah/hapus, unggah .txt/.docx/.xlsx, impor dari Google Form), paket ujian (mode manual/acak), monitor sesi live, rekap hasil + unduh Excel + cetak, **analisis kelas** (statistik, distribusi, butir soal), **laporan nilai PDF**, **notifikasi progres belajar WA** ke orang tua |
| **Admin** | Semua fitur guru + kelola pengguna & impor siswa (.xlsx, termasuk No. WA orang tua), jenjang/mapel/kelas, pengaturan madrasah, KKM & aturan anti-curang |

**Anti-curang (inti):**
- Jawaban hanya disimpan di **memori** — DILARANG `localStorage`/`sessionStorage`. Keluar/menutup tab = jawaban hilang.
- Keluar halaman (`pagehide`/`beforeunload`) → beacon otomatis **membatalkan sesi** di server.
- Pindah tab/aplikasi (`visibilitychange`) & keluar fullscreen → tercatat sebagai **peringatan**; mencapai ambang (default 3) → sesi otomatis dibatalkan.
- Klik kanan, seleksi teks, dan shortcut Ctrl+C/U/P/S dinonaktifkan selama ujian.
- Timer dihitung dari `waktuSelesai` server; waktu habis → **auto-submit**.
- Kunci jawaban & pembahasan **tidak pernah** dikirim ke browser siswa.

---

## A. Siapkan Backend (sekali saja)

Backend dibangun dari kontrak `docs/API_CONTRACT.md` (11 sheet: Pengaturan, Pengguna,
Jenjang, Mapel, Kelas, BankSoal, Paket, SesiUjian, Hasil, LogAktivitas, Notifikasi).
File `backend/Kode.gs` + `backend/appsscript.json` disiapkan terpisah mengikuti kontrak tersebut.

1. **Buat spreadsheet baru** di Google Drive (mis. nama: `Database CBT Sekolah`).
2. Di spreadsheet: menu **Extensions → Apps Script** (PENTING: dibuat dari dalam
   spreadsheet — *container-bound*. Kalau dibuat langsung di script.google.com,
   `SpreadsheetApp.getActiveSpreadsheet()` = `null` dan semua action gagal).
3. Hapus isi editor, **paste seluruh `backend/Kode.gs`**, simpan (Ctrl+S).
4. Ganti isi `appsscript.json` (menu ⚙️ Project Settings → centang *Show "appsscript.json"...*)
   dengan `backend/appsscript.json` (sudah memuat scope Sheets + Drive + Forms).
5. **Otorisasi Drive:** di editor Apps Script, pilih fungsi `authorizeDriveAccess` → **Run**.
   Setujui izin saat diminta (diperlukan untuk upload logo & gambar soal).
6. **Otorisasi Forms** (bila ingin impor soal dari Google Form): pilih fungsi
   `authorizeFormsAccess` → **Run**, setujui izin.
7. **Deploy:** Deploy → New deployment → tipe **Web app** →
   *Execute as:* **Me**, *Who has access:* **Anyone** → Deploy → **salin URL `/exec`**.

## B. Hubungkan Frontend

1. Buka aplikasi → menu **Konfigurasi**.
2. Tempel URL `/exec` ke kolom *URL Backend Manual* → **Simpan URL**.
3. Klik **Uji Koneksi** — harus muncul `Terhubung ✓ — versi 1.0.0 ...`.
4. Klik **Inisialisasi Database** — membuat 11 sheet + akun bawaan
   `admin`/`admin123` dan `guru`/`guru123`.

> Alternatif multi-madrasah: isi `apiUrl` di `public/schools.json`
> (format sama seperti aplikasi bel/jurnal TTS), lalu buka dengan `?school=<id>`.

## C. Konfigurasi Awal (login sebagai admin)

1. **Pengaturan** → isi identitas madrasah, unggah logo, atur:
   - *Ambang peringatan* (default 3),
   - *KKM* — Kriteria Ketuntasan Minimal (default 75), dipakai badge Tuntas/Belum
     di analisis & laporan,
   - *Wajib fullscreen* (disarankan Ya),
   - *Izinkan ulang setelah batal* (default Tidak).
   Klik **Simpan Pengaturan**.
2. **Ganti password bawaan** (admin & guru) di Kelola Data → Pengguna → ✏️
   (kosongkan password bila tidak ingin mengubah).
3. **Kelola Data → Jenjang/Mapel/Kelas**: sesuaikan (bawaan: MTs/SMP & MA/SMA/SMK
   + mapel Literasi B. Indonesia, Literasi B. Inggris, Penalaran Matematika).
4. **Kelola Data → Impor Siswa**: unduh template `.xlsx`, isi (Nama, NIS, Kelas wajib;
   password awal = NIS bila dikosongkan; **No. WA Orang Tua** diisi bila ingin
   kirim notifikasi progres belajar via WhatsApp), unggah → pratinjau → Impor.
5. **(Opsional) Notifikasi WhatsApp** → menu **Notifikasi**:
   - Isi *Endpoint*, *API Key*, dan *Template pesan* dari gateway WA madrasah
     (mis. Fonnte/Wablas — akun & nomor gateway milik madrasah sendiri),
     centang *Aktif*, klik **Simpan**.
   - Bila belum dikonfigurasi, pengiriman otomatis **dilewati** (tidak error)
     dan tercatat di riwayat.

## D. Alur Kerja Guru

1. **Bank Soal** → *Template & Unggah*: unduh template `.txt`/`.docx`/`.xlsx`
   (sudah ada contoh siap pakai), isi, unggah → pratinjau + validasi per baris → Impor.
   Atau: *Google Form* → tempel URL/ID form kuis → Impor.
2. **Paket Ujian** → *Buat Paket*: nama, jenjang, mapel, target kelas
   (kosongkan = semua kelas), mode **Manual** (centang soal dari bank) atau
   **Acak** (N soal diambil acak dari bank), durasi (5–300 menit), jendela
   mulai–selesai, opsi acak soal/opsi, tampil skor/pembahasan, aktif.
3. **Monitor**: pantau sesi live (auto-refresh 25 detik) — nama, status, sisa waktu,
   peringatan. Tombol **Reset** menghapus sesi+hasil siswa agar bisa mengulang.
4. **Hasil**: pilih paket → rekap (Selesai/Mengerjakan/Dibatalkan/Belum mulai) →
   **Unduh Excel** atau **Cetak** berkop madrasah.
5. **Analisis Kelas**: pilih paket + kelas → lihat rata-rata, median, ketuntasan
   klasikal vs KKM, distribusi nilai, 5 siswa teratas/terbawah, dan **analisis
   butir soal** (tingkat kesukaran: Sangat Mudah–Sangat Sukar + daya beda).
6. **Laporan**: pilih paket (+ kelas opsional) → pratinjau laporan berkop →
   **Cetak / Simpan PDF**.
7. **Notifikasi**: pilih target (Semua / per Kelas / manual) → **Kirim** progres
   belajar (rata-rata nilai, jumlah ujian, mapel terlemah) via WA ke nomor orang
   tua. Riwayat pengiriman tercatat otomatis.

## E. Uji End-to-End (wajib sebelum dipakai)

1. Buat 1 paket kecil (2–3 soal, durasi 10 menit, jendela mulai sekarang).
2. Login sebagai **siswa** (username = NIS, password = NIS).
3. Menu **Ujian** → Kerjakan → baca tata tertib → centang → **Mulai Ujian**.
4. Jawab 1 soal, tandai 1 soal ragu-ragu, pindah nomor via grid.
5. **Simulasi keluar aplikasi di tengah ujian:** tutup tab / buka tab lain / tekan tombol
   home di HP.
   - ✅ Yang harus terjadi: **jawaban terreset** (tidak ada yang tersimpan),
     sesi tercatat **BATAL** (cek di Monitor sebagai guru), dan muncul peringatan
     bila hanya pindah tab.
   - ❌ Bila jawaban masih ada setelah tab ditutup → JANGAN dipakai, laporkan.
6. Login lagi sebagai siswa → sesi lama berstatus Batal → buat sesi baru (bila
   *izinkanUlangSetelahBatal*=1) atau minta guru Reset via Monitor.
7. Kerjakan sampai selesai → **Selesaikan** → cek nilai & pembahasan (bila diizinkan).
8. Login sebagai guru → **Hasil** → pastikan nilai & rekap sesuai, unduh Excel, cetak.

## F. Catatan Teknis

- **Sesi login**: admin/guru otomatis **tetap masuk** (token + profil tersimpan di
  perangkat, kedaluwarsa 7 hari); sesi **siswa hanya di memori** (hilang saat
  tab ditutup) — demi anti-curang. Yang boleh di `localStorage` hanya URL
  backend, pilihan madrasah, dan sesi tersimpan admin/guru.
- **Nilai resmi selalu dihitung server** (`nilai = round(skor/totalBobot*100)`).
  Util `hitungNilaiSkor` di frontend hanya untuk pratinjau/test.
- Impor file (.txt/.docx/.xlsx) **tanpa library tambahan** — ZIP & XML ditulis/dibaca
  manual di `src/utils/imporSoal.ts` (pola yang sama dipakai untuk unduh Excel rekap).
- Halaman **Konfigurasi** & **Masuk** selalu bisa dibuka walau backend gagal dimuat,
  agar tidak terjebak di layar error.
- Test: `node test/smoke-backend.mjs` (verifikasi kontrak backend — dijalankan
  terhadap mock di Node), `node test/impor-soal.test.ts` dan (setelah kompilasi util)
  `node test/frontend-logic.test.mjs`. Verifikasi build: `npx tsc --noEmit` dan
  `npx vite build`.
- Upload ke GitHub via web (drag-and-drop semua file/folder kecuali
  `node_modules`, `dist`, `test/dist-test`) → Vercel auto-deploy.

## G. Panduan Skala Besar (±1000 pengguna bersamaan)

**Batas resmi Google (per akun, berlaku untuk Gmail gratis maupun Workspace):**
maksimal **30 eksekusi bersamaan** per akun — karena backend di-deploy
*Execute as: Me*, seluruh request siswa dihitung ke akun pemilik script.
Melewati 30 eksekusi bersamaan → request gagal. Workspace for Education
menaikkan kuota *harian* (URL Fetch 100rb/hari, runtime 6 jam/hari) tetapi
**tidak** menaikkan batas 30 konkuren ini.

**Yang sudah diamankan di v1.1.0:**
- Kunci global dihapus — aksi *baca* (getAllData, getSesi, monitor, rekap,
  analisis) berjalan paralel tanpa antre.
- Aksi *tulis* (mulaiSesi, submitJawaban, batalkanSesi, dsb.) memakai kunci
  singkat 8 detik; bila server sibuk → backend menjawab
  `{success:false, retryable:true}` dan frontend **otomatis mencoba lagi**
  (maks. 4x, jeda eksponensial + acak) — aman karena mulaiSesi &
  submitJawaban idempotent (tidak duplikat).

**Topologi yang disarankan untuk 1000 siswa:**
1. **Pisahkan backend per jenjang** — 1 spreadsheet + 1 project Apps Script
   untuk SMP, 1 untuk SMA, 1 untuk SMK, 1 untuk MA (±250 siswa per backend).
   Daftarkan keempatnya di `public/schools.json`, buka via `?school=smp`,
   `?school=sma`, dst. Tiap backend punya jatah 30 eksekusi sendiri.
   (Jenjang/Mapel/Kelas tiap backend tetap diatur di Kelola Data — sesuai
   permintaan "tinggal diubah di pengaturan".)
2. **Jadwalkan gelombang (wajib)** — jangan biarkan 250 siswa menekan
   *Mulai Ujian* di detik yang sama. Bagi per kelas dengan jeda mulai
   **3–5 menit** (paket mendukung jendela mulai–selesai per paket; buat
   1 paket per gelombang bila perlu).
3. **4 mapel/hari tidak masalah** — yang kritis hanya *momen mulai serentak*,
   bukan jumlah mapel. Antar mapel beri jeda 15–30 menit.
4. **Kapasitas Sheets aman** — 1000 siswa × 4 mapel = ±4000 baris Hasil/hari;
   batas Sheets 10 juta sel. Arsipkan (pindahkan) sheet Hasil/SesiUjian
   tiap akhir semester bila sudah >100rb baris agar tetap ringan.
5. **Uji beban sebelum hari-H** — simulasikan 1 kelas (±30–40 siswa) menekan
   mulai bersamaan; bila banyak retry, perketat jadwal gelombang.

**Yang tetap tidak bisa:** 1000 klik *dalam 1 detik* ke 1 backend — tidak ada
trik kode yang mengalahkan batas 30 konkuren Google. Gelombang + backend
per jenjang adalah kuncinya.
