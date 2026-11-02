// Tipe bersama wwn-cbt-atm-80 — nama field disesuaikan PERSIS dengan API_CONTRACT.md.

export type Peran = 'admin' | 'guru' | 'siswa';

/** Pengaturan sekolah (wire: angka untuk flag; wa* berupa string). */
export interface Pengaturan {
  namaSekolah: string;
  alamatSekolah: string;
  telepon: string;
  namaKepala: string;
  logoUrl: string;
  ambangPeringatan: number;
  wajibFullscreen: number;
  izinkanUlangSetelahBatal: number;
  kkm: number;
  waAktif: string;
  waEndpoint: string;
  waApiKey: string;
  waTemplateProgres: string;
}

export interface Jenjang {
  id: string;
  nama: string;
}

export interface Mapel {
  id: string;
  jenjangId: string;
  nama: string;
}

export interface Kelas {
  id: string;
  jenjangId: string;
  nama: string;
}

export interface Pengguna {
  id: string;
  nama: string;
  username: string;
  peran: Peran;
  nis: string;
  jenjangId: string;
  kelasId: string;
  aktif: number;
  /** No. WA orang tua (khusus siswa). */
  noHP: string;
}

export interface SoalBank {
  id: string;
  jenjangId: string;
  mapelId: string;
  soal: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE: string;
  kunci: string;
  bobot: number;
  pembahasan: string;
  gambarUrl: string;
  dibuatPada: string;
}

export type ModeSoal = 'manual' | 'acak';

export interface Paket {
  id: string;
  nama: string;
  jenjangId: string;
  mapelId: string;
  kelasIds: string[];
  modeSoal: ModeSoal;
  soalIds: string[];
  jumlahAcak: number;
  durasiMenit: number;
  mulai: string;
  selesai: string;
  acakSoal: number;
  acakOpsi: number;
  tampilSkor: number;
  tampilPembahasan: number;
  aktif: number;
  jumlahSoal: number;
}

export type StatusSesi = 'AKTIF' | 'SELESAI' | 'BATAL';

export interface SesiRingkas {
  id: string;
  paketId: string;
  namaPaket: string;
  username: string;
  namaSiswa: string;
  kelas: string;
  waktuMulai: string;
  waktuSelesai: string;
  status: StatusSesi;
  peringatan: number;
}

export interface HasilUjian {
  id: string;
  sesiId: string;
  paketId: string;
  namaPaket: string;
  username: string;
  namaSiswa: string;
  kelas: string;
  benar: number;
  salah: number;
  kosong: number;
  skor: number;
  totalBobot: number;
  nilai: number;
  waktuSubmit: string;
  /** Rincian per soal — hanya dari getHasilSiswa bila paket tampilPembahasan=1. */
  rincian?: RincianSoal[];
}

/** Seluruh data getAllData (sudah difilter server sesuai peran). */
export interface AllData {
  pengaturan: Pengaturan;
  jenjang: Jenjang[];
  mapel: Mapel[];
  kelas: Kelas[];
  pengguna: Pengguna[];
  bankSoal: SoalBank[];
  paket: Paket[];
  sesi: SesiRingkas[];
  hasil: HasilUjian[];
}

/** Sesi login — token HANYA di memori, tidak pernah disimpan ke storage. */
export interface UserSesi {
  nama: string;
  username: string;
  peran: Peran;
  nis: string;
  jenjangId: string;
  kelasId: string;
}

export interface SekolahEntry {
  id: string;
  nama: string;
  kota: string;
  apiUrl: string;
}

export interface ToastMsg {
  id: number;
  pesan: string;
  tipe: 'info' | 'sukses' | 'error';
}

export type PageKey =
  | 'dashboard'
  | 'bank-soal'
  | 'paket'
  | 'ujian'
  | 'monitor'
  | 'hasil'
  | 'analisis-saya'
  | 'analisis-kelas'
  | 'laporan'
  | 'notifikasi'
  | 'kelola-data'
  | 'pengaturan'
  | 'konfigurasi'
  | 'login';

// ---------- Ruang ujian ----------

/** Soal seperti dikembalikan mulaiSesi/getSesi — TANPA kunci/pembahasan. */
export interface OpsiUjian {
  kode: string; // 'A'..'E' (kode asli)
  teks: string;
}

export interface SoalUjian {
  id: string;
  teks: string;
  gambarUrl: string;
  opsi: OpsiUjian[];
}

export interface SesiAktif {
  id: string;
  paketId: string;
  waktuMulai: string;
  waktuSelesai: string;
  status: StatusSesi;
  peringatan: number;
}

export interface MulaiSesiResponse {
  sesi: SesiAktif;
  soal: SoalUjian[];
}

/** Jawaban satu soal — hanya kode A–E. */
export interface JawabanKirim {
  soalId: string;
  jawaban: string;
}

export interface HasilSubmit {
  id: string;
  benar: number;
  salah: number;
  kosong: number;
  skor: number;
  totalBobot: number;
  nilai: number;
  waktuSubmit: string;
}

// ---------- Rekap & rincian ----------

export interface BarisRekap {
  username: string;
  nis: string;
  nama: string;
  kelas: string;
  status: 'Selesai' | 'Mengerjakan' | 'Dibatalkan' | 'Belum mulai';
  nilai: number;
  benar: number;
  totalSoal: number;
  waktuSubmit: string;
  peringatan: number;
}

export interface RincianSoal {
  soalId: string;
  teks: string;
  opsi: OpsiUjian[];
  kunci: string;
  pembahasan: string;
  jawabanSiswa: string;
  benar: boolean;
}

// ---------- Impor ----------

export interface BarisSiswa {
  nama: string;
  nis: string;
  kelas: string;
  jenjang?: string;
  username?: string;
  password?: string;
  /** No. WA orang tua. */
  noHP?: string;
}

export interface BarisSoalImpor {
  soal: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  opsiE?: string;
  kunci: string;
  bobot?: number;
  pembahasan?: string;
}

export interface HasilImpor {
  imported: number;
  updated: number;
  errors: { baris: number; pesan: string }[];
}

// ---------- Analisis nilai & notifikasi ----------

export interface RingkasanSiswa {
  totalUjian: number;
  rataRata: number;
  nilaiTertinggi: number;
  mapelTerkuat: string;
  mapelTerlemah: string;
}

export interface StatMapel {
  mapelId: string;
  namaMapel: string;
  totalDikerjakan: number;
  benar: number;
  pct: number;
  nilaiRata: number;
  tuntas: boolean;
}

export interface TrenNilai {
  paketId: string;
  namaPaket: string;
  nilai: number;
  waktuSubmit: string;
}

export interface AnalisisSiswaData {
  ringkasan: RingkasanSiswa;
  perMapel: StatMapel[];
  tren: TrenNilai[];
}

export interface StatKelas {
  jumlah: number;
  rata2: number;
  min: number;
  maks: number;
  median: number;
  ketuntasanPct: number;
}

export interface DistribusiItem {
  rentang: string;
  jumlah: number;
}

export interface SiswaNilai {
  username: string;
  namaSiswa: string;
  kelas: string;
  nilai: number;
}

export interface ButirSoal {
  soalId: string;
  teks: string;
  dijawab: number;
  benar: number;
  pctBenar: number;
  klasifikasi: 'Sangat Mudah' | 'Mudah' | 'Sedang' | 'Sukar' | 'Sangat Sukar';
  dayaBeda: number | null;
}

export interface AnalisisKelasData {
  statistik: StatKelas;
  distribusi: DistribusiItem[];
  teratas: SiswaNilai[];
  terbawah: SiswaNilai[];
  butirSoal: ButirSoal[];
}

export interface NotifikasiLog {
  id: string;
  waktu: string;
  username: string;
  namaSiswa: string;
  noHP: string;
  jenis: string;
  isi: string;
  status: string;
}

export interface HasilKirimNotifikasi {
  total: number;
  terkirim: number;
  dilewati: number;
  detail: { username: string; nama: string; status: string }[];
}
