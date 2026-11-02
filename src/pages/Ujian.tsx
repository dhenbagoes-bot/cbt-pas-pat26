import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Flag, Send } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
} from '../components/ui';
import {
  batalkanSesi,
  beaconBatalkanSesi,
  catatPeringatan,
  getSesi,
  getToken,
  getUrlEfektif,
  mulaiSesi,
  submitJawaban,
} from '../services/api';
import { formatSisaWaktu } from '../utils/ujian';
import { formatTanggalWaktu } from '../utils/format';
import type {
  HasilSubmit,
  MulaiSesiResponse,
  Paket,
  SesiAktif,
  SoalUjian,
} from '../types';
import type { PageProps } from './PageProps';

// ============================================================
// Ruang Ujian — ANTI-CURANG (inti):
//  - Jawaban HANYA di state memori (DILARANG localStorage/sessionStorage).
//  - pagehide/beforeunload -> beacon batalkanSesi (kecuali sudah submit).
//  - visibilitychange -> catatPeringatan (debounce).
//  - Blokir klik kanan, seleksi teks (CSS), shortcut Ctrl+C/U/P/S.
//  - Keluar fullscreen -> peringatan; capai ambangPeringatan -> sesi batal.
//  - Timer dari waktuSelesai server; auto-submit saat habis.
//  - Kunci jawaban TIDAK PERNAH dikirim ke/ditampilkan di klien.
// ============================================================

type Fase = 'daftar' | 'konfirmasi' | 'ujian' | 'selesai';

function parseWaktuServer(w: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec((w || '').trim());
  if (!m) return NaN;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] || 0)
  ).getTime();
}

export default function Ujian({
  data,
  user,
  pengaturan,
  toast,
  pindah,
  refreshData,
  onRuangUjianChange,
}: PageProps & { onRuangUjianChange: (aktif: boolean) => void }) {
  const [fase, setFase] = useState<Fase>('daftar');
  const [paketPilih, setPaketPilih] = useState<Paket | null>(null);
  const [setuju, setSetuju] = useState(false);
  const [mulaiLoading, setMulaiLoading] = useState(false);

  // ---- state ruang ujian (semua di memori) ----
  const [sesi, setSesi] = useState<SesiAktif | null>(null);
  const [soal, setSoal] = useState<SoalUjian[]>([]);
  const [jawaban, setJawaban] = useState<Record<string, string>>({});
  const [ragu, setRagu] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const [sisaDetik, setSisaDetik] = useState(0);
  const [peringatan, setPeringatan] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [konfirmSelesai, setKonfirmSelesai] = useState(false);
  const [hasil, setHasil] = useState<HasilSubmit | null>(null);
  const [tampilSkorPaket, setTampilSkorPaket] = useState(true);

  // flag: sudah submit -> beacon TIDAK boleh membatalkan sesi
  const sudahSubmitRef = useRef(false);
  const sesiRef = useRef<SesiAktif | null>(null);
  const deadlineRef = useRef(0);
  const peringatanTerkirimRef = useRef(0); // debounce visibilitychange

  const ambang = pengaturan.ambangPeringatan || 3;
  const wajibFs = pengaturan.wajibFullscreen === 1;

  useEffect(() => {
    sesiRef.current = sesi;
  }, [sesi]);

  useEffect(() => {
    onRuangUjianChange(fase === 'ujian' || fase === 'konfirmasi');
  }, [fase, onRuangUjianChange]);

  const keluarRuangUjian = useCallback(
    (pesan: string, tipe: 'info' | 'error' = 'info') => {
      sudahSubmitRef.current = false;
      setFase('daftar');
      setSesi(null);
      setSoal([]);
      setJawaban({});
      setRagu(new Set());
      setIdx(0);
      setPaketPilih(null);
      setSetuju(false);
      setHasil(null);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
      toast(pesan, tipe);
      refreshData();
    },
    [toast, refreshData]
  );

  const doSubmit = useCallback(
    async (otomatis: boolean) => {
      const s = sesiRef.current;
      if (!s || sudahSubmitRef.current || !otomatis && submitLoading) return;
      setSubmitLoading(true);
      try {
        const arr = Object.entries(jawabanRef.current).map(([soalId, kode]) => ({
          soalId,
          jawaban: kode,
        }));
        const r = await submitJawaban(s.id, arr);
        sudahSubmitRef.current = true;
        setHasil(r.hasil);
        setFase('selesai');
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => undefined);
        }
        toast(otomatis ? 'Waktu habis — jawaban tersubmit otomatis.' : 'Jawaban tersubmit.', 'sukses');
        refreshData();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Gagal mengirim jawaban.', 'error');
      } finally {
        setSubmitLoading(false);
      }
    },
    [toast, refreshData, submitLoading]
  );

  const jawabanRef = useRef<Record<string, string>>({});
  useEffect(() => {
    jawabanRef.current = jawaban;
  }, [jawaban]);

  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;

  // ---- timer: deadline = timestamp server `waktuSelesai` (absolut) ----
  // PENTING: jangan hitung dari waktuMulai + durasi — sesi yang dilanjutkan
  // (getSesi) harus memakai sisa waktu aslinya, bukan durasi penuh lagi.
  useEffect(() => {
    if (fase !== 'ujian' || !sesi) return;
    const selesai = parseWaktuServer(sesi.waktuSelesai);
    deadlineRef.current = Number.isFinite(selesai) ? selesai : Date.now();
    const id = setInterval(() => {
      const sisa = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setSisaDetik(sisa);
      if (sisa <= 0) {
        clearInterval(id);
        doSubmitRef.current(true);
      }
    }, 1000);
    setSisaDetik(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
    return () => clearInterval(id);
  }, [fase, sesi]);

  // ---- anti-curang: listeners ----
  useEffect(() => {
    if (fase !== 'ujian') return;

    const onPageHide = () => {
      const s = sesiRef.current;
      if (!s || sudahSubmitRef.current) return;
      // Jawaban di memori otomatis hilang; beacon memastikan sesi dibatalkan server.
      beaconBatalkanSesi(getUrlEfektif(), getToken(), s.id);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = sesiRef.current;
      if (!s || sudahSubmitRef.current) return;
      beaconBatalkanSesi(getUrlEfektif(), getToken(), s.id);
      e.preventDefault();
    };
    const onVisibility = () => {
      const s = sesiRef.current;
      if (!s || sudahSubmitRef.current || !document.hidden) return;
      // debounce: abaikan bila peringatan baru saja dikirim (< 5 dtk)
      const now = Date.now();
      if (now - peringatanTerkirimRef.current < 5000) return;
      peringatanTerkirimRef.current = now;
      catatPeringatan(s.id, 'tab-tidak-aktif')
        .then((r) => {
          setPeringatan(r.peringatan);
          if (r.dibatalkan) {
            sudahSubmitRef.current = true; // cegah beacon ganda
            keluarRuangUjian(
              'Sesi dibatalkan: Anda berpindah tab/aplikasi melebihi batas peringatan.',
              'error'
            );
          } else {
            toast(`Peringatan ${r.peringatan}/${ambang}: jangan berpindah tab/aplikasi!`, 'error');
          }
        })
        .catch(() => undefined);
    };
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['c', 'u', 'p', 's'].includes(k)) {
        e.preventDefault();
        toast('Shortcut dinonaktifkan selama ujian.', 'error');
      }
    };
    const onFullscreen = () => {
      const s = sesiRef.current;
      if (!s || sudahSubmitRef.current || !wajibFs) return;
      if (!document.fullscreenElement) {
        catatPeringatan(s.id, 'keluar-fullscreen')
          .then((r) => {
            setPeringatan(r.peringatan);
            if (r.dibatalkan) {
              sudahSubmitRef.current = true;
              keluarRuangUjian('Sesi dibatalkan: keluar mode fullscreen melebihi batas.', 'error');
            } else {
              toast(
                `Peringatan ${r.peringatan}/${ambang}: kembali ke mode fullscreen!`,
                'error'
              );
              document.documentElement.requestFullscreen().catch(() => undefined);
            }
          })
          .catch(() => undefined);
      }
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [fase, ambang, wajibFs, toast, keluarRuangUjian]);

  // ---- aksi ----

  const mulaiDariPaket = (p: Paket) => {
    const sesiAktif = data.sesi.find((s) => s.paketId === p.id && s.status === 'AKTIF');
    if (sesiAktif) {
      lanjutkanSesi(sesiAktif.id, p);
      return;
    }
    setPaketPilih(p);
    setSetuju(false);
    setFase('konfirmasi');
  };

  const lanjutkanSesi = async (sesiId: string, p: Paket) => {
    setMulaiLoading(true);
    try {
      const r: MulaiSesiResponse = await getSesi(sesiId);
      masukRuangUjian(p, r);
      toast('Sesi dilanjutkan. Jawaban sebelumnya (jika ada) terreset.', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal melanjutkan sesi.', 'error');
      refreshData();
    } finally {
      setMulaiLoading(false);
    }
  };

  const mulaiUjian = async () => {
    if (!paketPilih || !setuju) return;
    setMulaiLoading(true);
    try {
      const r = await mulaiSesi(paketPilih.id);
      masukRuangUjian(paketPilih, r);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memulai sesi.', 'error');
    } finally {
      setMulaiLoading(false);
    }
  };

  const masukRuangUjian = (p: Paket, r: MulaiSesiResponse) => {
    sudahSubmitRef.current = false;
    setSesi(r.sesi);
    setSoal(r.soal);
    setJawaban({});
    setRagu(new Set());
    setIdx(0);
    setPeringatan(r.sesi.peringatan || 0);
    setTampilSkorPaket(p.tampilSkor === 1);
    setFase('ujian');
    if (wajibFs) {
      document.documentElement.requestFullscreen().catch(() => {
        toast('Aktifkan mode fullscreen manual bila diminta browser.', 'info');
      });
    }
  };

  const batalkanManual = async () => {
    const s = sesiRef.current;
    if (!s) return;
    try {
      await batalkanSesi(s.id, 'dibatalkan-peserta');
    } catch {
      /* abaikan */
    }
    sudahSubmitRef.current = true;
    keluarRuangUjian('Sesi dibatalkan. Jawaban tidak tersimpan.', 'info');
  };

  const pilihJawaban = (soalId: string, kode: string) => {
    setJawaban((j) => ({ ...j, [soalId]: kode }));
  };

  const toggleRagu = (soalId: string) => {
    setRagu((r) => {
      const n = new Set(r);
      if (n.has(soalId)) n.delete(soalId);
      else n.add(soalId);
      return n;
    });
  };

  // ================= render =================

  if (fase === 'daftar') {
    const tersedia = data.paket.filter((p) => p.aktif === 1);
    return (
      <div>
        <PageHeader judul="Ujian" subjudul="Pilih paket try out yang tersedia." />
        {mulaiLoading && <LoadingBlock teks="Menyiapkan sesi ujian..." />}
        {tersedia.length === 0 ? (
          <EmptyState judul="Belum ada paket tersedia" subjudul="Hubungi guru Anda." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tersedia.map((p) => {
              const sesiAktif = data.sesi.find((s) => s.paketId === p.id && s.status === 'AKTIF');
              const sesiSelesai = data.sesi.find((s) => s.paketId === p.id && s.status === 'SELESAI');
              const mapel = data.mapel.find((m) => m.id === p.mapelId)?.nama || '-';
              return (
                <Card key={p.id}>
                  <p className="text-xs font-bold uppercase text-violet-600">{mapel}</p>
                  <h3 className="mt-1 font-bold text-slate-900">{p.nama}</h3>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <p>⏱ {p.durasiMenit} menit • 📝 {p.jumlahSoal} soal</p>
                    <p>Berakhir: {formatTanggalWaktu(p.selesai)}</p>
                  </div>
                  {sesiAktif ? (
                    <Button varian="kuning" className="mt-3 w-full" onClick={() => mulaiDariPaket(p)} loading={mulaiLoading}>
                      Lanjutkan Sesi
                    </Button>
                  ) : sesiSelesai ? (
                    <Button varian="sekunder" className="mt-3 w-full" onClick={() => pindah('hasil')}>
                      Lihat Hasil
                    </Button>
                  ) : (
                    <Button className="mt-3 w-full" onClick={() => mulaiDariPaket(p)}>
                      Kerjakan
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (fase === 'konfirmasi' && paketPilih) {
    const p = paketPilih;
    const mapel = data.mapel.find((m) => m.id === p.mapelId)?.nama || '-';
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader judul="Konfirmasi Ujian" subjudul="Periksa data & tata tertib sebelum mulai." />
        <Card className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">{p.nama}</h2>
          <p className="text-sm text-slate-500">{mapel}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Nama peserta</p>
              <p className="font-bold text-slate-900">{user?.nama}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">NIS / Username</p>
              <p className="font-bold text-slate-900">{user?.nis || user?.username}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Jumlah soal</p>
              <p className="font-bold text-slate-900">{p.jumlahSoal}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Durasi</p>
              <p className="font-bold text-slate-900">{p.durasiMenit} menit</p>
            </div>
          </div>
        </Card>
        <Card className="mb-4">
          <h3 className="mb-2 font-bold text-slate-900">📋 Tata Tertib Ujian</h3>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Dilarang berpindah tab, membuka aplikasi lain, atau menutup halaman ujian.</li>
            <li>Dilarang menyalin soal (klik kanan &amp; shortcut salin dinonaktifkan).</li>
            <li>
              Setiap pelanggaran tercatat sebagai peringatan. Bila mencapai {ambang} peringatan, sesi
              <b> otomatis dibatalkan</b> dan jawaban hilang.
            </li>
            <li>Menutup/men-refresh halaman = keluar dari ujian (jawaban tidak tersimpan).</li>
            <li>Jawaban tersimpan hanya saat Anda menekan tombol <b>Selesaikan</b> atau waktu habis.</li>
          </ul>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={setuju}
              onChange={(e) => setSetuju(e.target.checked)}
              className="mt-1 h-4 w-4 accent-violet-600"
            />
            <span className="text-sm font-semibold text-slate-700">
              Saya telah membaca tata tertib dan siap mengerjakan ujian dengan jujur.
            </span>
          </label>
        </Card>
        <div className="flex gap-2">
          <Button varian="sekunder" onClick={() => setFase('daftar')} className="flex-1">
            Kembali
          </Button>
          <Button onClick={mulaiUjian} loading={mulaiLoading} disabled={!setuju} className="flex-1">
            Mulai Ujian
          </Button>
        </div>
      </div>
    );
  }

  if (fase === 'selesai' && hasil) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-9 w-9 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Jawaban Terkirim</h2>
        {tampilSkorPaket ? (
          <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase text-slate-400">Nilai Anda</p>
            <p className="font-mono-num text-5xl font-bold text-violet-700">{hasil.nilai}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 p-2">
                <p className="font-bold text-emerald-700">{hasil.benar}</p>
                <p className="text-slate-500">Benar</p>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <p className="font-bold text-red-700">{hasil.salah}</p>
                <p className="text-slate-500">Salah</p>
              </div>
              <div className="rounded-lg bg-slate-100 p-2">
                <p className="font-bold text-slate-700">{hasil.kosong}</p>
                <p className="text-slate-500">Kosong</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Skor {hasil.skor} dari {hasil.totalBobot} • {formatTanggalWaktu(hasil.waktuSubmit)}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Jawaban Anda sudah tersimpan. Nilai akan diumumkan oleh guru.
          </p>
        )}
        <Button onClick={() => pindah('hasil')} className="mt-5">
          Lihat Hasil Saya
        </Button>
      </div>
    );
  }

  // ---- fase 'ujian': ruang ujian ----
  const aktif = soal[idx];
  const terjawab = Object.keys(jawaban).length;
  const raguCount = ragu.size;
  const belum = soal.length - terjawab;
  const bahaya = sisaDetik <= 300;

  return (
    <div className="ruang-ujian mx-auto max-w-4xl">
      {/* bar status */}
      <div className="sticky top-[68px] z-30 -mx-3 mb-4 bg-slate-100/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${bahaya ? 'bg-red-600 text-white' : 'bg-violet-600 text-white'}`}>
            <Clock className="h-4 w-4" />
            <span className="font-mono-num">{formatSisaWaktu(sisaDetik)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {peringatan > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Peringatan {peringatan}/{ambang}
              </span>
            )}
            <span className="rounded-full bg-slate-200 px-2.5 py-1 font-semibold text-slate-600">
              Terjawab {terjawab}/{soal.length}
            </span>
            <Button varian="bahaya" kecil onClick={batalkanManual}>
              Batalkan
            </Button>
          </div>
        </div>
      </div>

      {aktif && (
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-violet-700">Soal {idx + 1} dari {soal.length}</p>
            <button
              onClick={() => toggleRagu(aktif.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                ragu.has(aktif.id) ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Flag className="h-3.5 w-3.5" /> {ragu.has(aktif.id) ? 'Ragu-ragu ✓' : 'Tandai ragu-ragu'}
            </button>
          </div>
          {aktif.gambarUrl && (
            <img src={aktif.gambarUrl} alt="Gambar soal" className="mb-3 max-h-64 rounded-xl border" />
          )}
          <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-slate-900">{aktif.teks}</p>
          <div className="mt-4 space-y-2">
            {aktif.opsi.map((o) => {
              const dipilih = jawaban[aktif.id] === o.kode;
              return (
                <button
                  key={o.kode}
                  onClick={() => pilihJawaban(aktif.id, o.kode)}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                    dipilih
                      ? 'border-violet-600 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-violet-300'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      dipilih ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {String.fromCharCode(65 + aktif.opsi.indexOf(o))}
                  </span>
                  <span className="text-sm text-slate-800">{o.teks}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <Button varian="sekunder" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              ← Sebelumnya
            </Button>
            {idx < soal.length - 1 ? (
              <Button onClick={() => setIdx((i) => Math.min(soal.length - 1, i + 1))}>
                Berikutnya →
              </Button>
            ) : (
              <Button varian="hijau" onClick={() => setKonfirmSelesai(true)}>
                <Send className="h-4 w-4" /> Selesaikan
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* grid nomor soal */}
      <Card>
        <p className="mb-2 text-sm font-bold text-slate-700">Navigasi Soal</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {soal.map((s, i) => {
            const ada = !!jawaban[s.id];
            const rg = ragu.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                className={`flex h-10 items-center justify-center rounded-lg text-sm font-bold transition ${
                  i === idx
                    ? 'ring-2 ring-violet-600 ring-offset-2 ' + (ada ? 'bg-emerald-500 text-white' : rg ? 'bg-amber-400 text-white' : 'bg-slate-700 text-white')
                    : ada
                      ? 'bg-emerald-500 text-white'
                      : rg
                        ? 'bg-amber-400 text-white'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" /> Terjawab</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400" /> Ragu-ragu</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-200" /> Belum dijawab</span>
        </div>
        <Button varian="hijau" className="mt-4 w-full" onClick={() => setKonfirmSelesai(true)}>
          <Send className="h-4 w-4" /> Selesaikan Ujian
        </Button>
      </Card>

      {konfirmSelesai && (
        <Modal judul="Selesaikan ujian?" onTutup={() => setKonfirmSelesai(false)} lebar="max-w-sm">
          <div className="space-y-2 text-sm text-slate-600">
            <p>Terjawab: <b className="text-emerald-600">{terjawab}</b></p>
            <p>Ragu-ragu: <b className="text-amber-600">{raguCount}</b></p>
            <p>Belum dijawab: <b className={belum > 0 ? 'text-red-600' : 'text-slate-600'}>{belum}</b></p>
            {belum > 0 && <p className="text-xs text-slate-400">Soal yang belum dijawab dihitung kosong.</p>}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button varian="sekunder" onClick={() => setKonfirmSelesai(false)}>Periksa Lagi</Button>
            <Button
              varian="hijau"
              loading={submitLoading}
              onClick={() => {
                setKonfirmSelesai(false);
                doSubmitRef.current(false);
              }}
            >
              Ya, Kirim Jawaban
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
