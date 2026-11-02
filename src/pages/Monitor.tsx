import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  LoadingBlock,
  PageHeader,
  SelectInput,
  TabelResponsif,
  tdCls,
  thCls,
} from '../components/ui';
import { monitorSesi, resetSesi } from '../services/api';
import { formatTanggalWaktu } from '../utils/format';
import type { SesiRingkas } from '../types';
import type { PageProps } from './PageProps';

// Monitor sesi live — polling tiap 25 detik.
const POLL_MS = 25000;

function sisaDariWaktuSelesai(waktuSelesai: string, now: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec((waktuSelesai || '').trim());
  if (!m) return '-';
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)).getTime();
  const d = Math.max(0, Math.floor((t - now) / 1000));
  const mm = Math.floor(d / 60);
  const ss = d % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function Monitor({ data, toast }: PageProps) {
  const [paketId, setPaketId] = useState('');
  const [sesi, setSesi] = useState<SesiRingkas[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [resetTarget, setResetTarget] = useState<{ username: string; nama: string; paketId: string } | null>(null);
  const timerRef = useRef<number | null>(null);

  const muat = useCallback(async (pid: string) => {
    setMemuat(true);
    try {
      const r = await monitorSesi(pid || undefined);
      setSesi(r);
      setNow(Date.now());
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat monitor.', 'error');
    } finally {
      setMemuat(false);
    }
  }, [toast]);

  useEffect(() => {
    muat(paketId);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => muat(paketId), POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      window.clearInterval(tick);
    };
  }, [paketId, muat]);

  const aktif = sesi.filter((s) => s.status === 'AKTIF').length;

  const doReset = async () => {
    if (!resetTarget) return;
    try {
      const r = await resetSesi(resetTarget.username, resetTarget.paketId);
      toast(`Sesi direset: ${r.sesiDihapus} sesi & ${r.hasilDihapus} hasil dihapus. Siswa bisa mengulang.`, 'sukses');
      setResetTarget(null);
      muat(paketId);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mereset sesi.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        judul="Monitor Sesi"
        subjudul={`${aktif} sesi aktif • diperbarui otomatis tiap 25 detik.`}
        aksi={
          <>
            <div className="w-52">
              <SelectInput value={paketId} onChange={(e) => setPaketId(e.target.value)}>
                <option value="">Semua paket</option>
                {data.paket.map((p) => (
                  <option key={p.id} value={p.id}>{p.nama}</option>
                ))}
              </SelectInput>
            </div>
            <Button varian="sekunder" onClick={() => muat(paketId)}>
              <RefreshCw className="h-4 w-4" /> Muat Ulang
            </Button>
          </>
        }
      />

      {memuat && sesi.length === 0 ? (
        <LoadingBlock teks="Memuat sesi..." />
      ) : sesi.length === 0 ? (
        <EmptyState judul="Belum ada sesi" subjudul="Sesi muncul saat siswa mulai mengerjakan." />
      ) : (
        <Card>
          <TabelResponsif>
            <table className="w-full min-w-[760px]">
              <thead>
                <tr>
                  <th className={thCls}>Siswa</th>
                  <th className={thCls}>Paket</th>
                  <th className={thCls}>Mulai</th>
                  <th className={thCls}>Sisa</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Peringatan</th>
                  <th className={thCls}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sesi.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className={tdCls}>
                      <p className="font-semibold text-slate-900">{s.namaSiswa}</p>
                      <p className="text-xs text-slate-400">{s.username} • {s.kelas}</p>
                    </td>
                    <td className={tdCls}>{s.namaPaket}</td>
                    <td className={tdCls}>{formatTanggalWaktu(s.waktuMulai)}</td>
                    <td className={tdCls}>
                      {s.status === 'AKTIF' ? (
                        <span className="font-mono-num font-bold text-violet-700">
                          {sisaDariWaktuSelesai(s.waktuSelesai, now)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      {s.status === 'AKTIF' ? (
                        <Badge warna="hijau">Mengerjakan</Badge>
                      ) : s.status === 'SELESAI' ? (
                        <Badge warna="biru">Selesai</Badge>
                      ) : (
                        <Badge warna="merah">Dibatalkan</Badge>
                      )}
                    </td>
                    <td className={tdCls}>
                      {s.peringatan > 0 ? (
                        <Badge warna="kuning">{s.peringatan}×</Badge>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <button
                        onClick={() => setResetTarget({ username: s.username, nama: s.namaSiswa, paketId: s.paketId })}
                        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                        title="Hapus sesi & hasil siswa ini agar bisa mengulang dari nol"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelResponsif>
        </Card>
      )}

      {resetTarget && (
        <ConfirmDialog
          judul="Reset sesi siswa?"
          pesan={`Semua sesi & hasil milik ${resetTarget.nama} pada paket ini akan dihapus agar ia bisa mengulang dari nol. Lanjutkan?`}
          teksYa="Ya, Reset"
          varian="kuning"
          onYa={doReset}
          onBatal={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
