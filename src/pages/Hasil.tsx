import { useEffect, useState } from 'react';
import { Download, Eye, Printer } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  KopCetak,
  LoadingBlock,
  Modal,
  PageHeader,
  SelectInput,
  TabelResponsif,
  TtdCetak,
  tdCls,
  thCls,
} from '../components/ui';
import { getHasilSiswa, rekapHasil } from '../services/api';
import { buatXlsx } from '../utils/imporSoal';
import { formatTanggalWaktu } from '../utils/format';
import type { BarisRekap, HasilUjian, Paket, RincianSoal } from '../types';
import type { PageProps } from './PageProps';

function unduhBlob(nama: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function Hasil({ data, user, pengaturan, toast }: PageProps) {
  if (user?.peran === 'siswa') return <HasilSiswa {...{ data, user, pengaturan, toast } as PageProps} />;
  return <RekapGuru data={data} pengaturan={pengaturan} toast={toast} />;
}

// ================= SISWA =================

function HasilSiswa({ data, toast }: PageProps) {
  const [hasil] = useState<HasilUjian[]>(data.hasil);
  const [detailPaket, setDetailPaket] = useState<Paket | null>(null);
  const [rincian, setRincian] = useState<RincianSoal[] | null>(null);
  const [memuat, setMemuat] = useState(false);

  const bukaDetail = async (p: Paket) => {
    setDetailPaket(p);
    setRincian(null);
    setMemuat(true);
    try {
      const r = await getHasilSiswa(p.id);
      // Backend mengembalikan ARRAY hasil dengan `rincian` menempel per item.
      const item = r.find((h) => h.paketId === p.id) ?? r[0];
      setRincian(item?.rincian || null);
      if (!item?.rincian) toast('Pembahasan tidak diizinkan untuk paket ini.', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat detail.', 'error');
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div>
      <PageHeader judul="Hasil Saya" subjudul="Nilai & pembahasan try out yang sudah dikerjakan." />
      {hasil.length === 0 ? (
        <EmptyState judul="Belum ada hasil" subjudul="Kerjakan paket try out di menu Ujian." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {hasil.map((h) => {
            const p = data.paket.find((x) => x.id === h.paketId);
            const tampilSkor = p ? p.tampilSkor === 1 : true;
            return (
              <Card key={h.id}>
                <p className="text-xs font-bold uppercase text-violet-600">{h.namaPaket}</p>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    {tampilSkor ? (
                      <p className="font-mono-num text-4xl font-bold text-violet-700">{h.nilai}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Nilai diumumkan guru</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      Benar {h.benar} • Salah {h.salah} • Kosong {h.kosong}
                    </p>
                    <p className="text-xs text-slate-400">{formatTanggalWaktu(h.waktuSubmit)}</p>
                  </div>
                  {p && p.tampilPembahasan === 1 && (
                    <Button varian="sekunder" kecil onClick={() => bukaDetail(p)}>
                      <Eye className="h-3.5 w-3.5" /> Pembahasan
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {detailPaket && (
        <Modal judul={`Pembahasan — ${detailPaket.nama}`} onTutup={() => setDetailPaket(null)} lebar="max-w-3xl">
          {memuat ? (
            <LoadingBlock teks="Memuat pembahasan..." />
          ) : !rincian || rincian.length === 0 ? (
            <EmptyState judul="Tidak ada rincian" subjudul="Paket ini tidak mengizinkan pembahasan." />
          ) : (
            <div className="space-y-4">
              {rincian.map((r, i) => (
                <div key={r.soalId} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-900">
                    {i + 1}. {r.teks}
                  </p>
                  <div className="mt-2 space-y-1">
                    {r.opsi.map((o) => {
                      const kodeTampil = String.fromCharCode(65 + r.opsi.indexOf(o));
                      const isKunci = o.kode.toUpperCase() === r.kunci.toUpperCase();
                      const isJawaban = o.kode.toUpperCase() === (r.jawabanSiswa || '').toUpperCase();
                      return (
                        <p
                          key={o.kode}
                          className={`rounded-lg px-3 py-1.5 text-sm ${
                            isKunci
                              ? 'bg-emerald-100 font-semibold text-emerald-800'
                              : isJawaban
                                ? 'bg-red-100 text-red-800'
                                : 'text-slate-600'
                          }`}
                        >
                          {kodeTampil}. {o.teks}
                          {isKunci && ' ✓ (kunci)'}
                          {isJawaban && !isKunci && ' ← jawaban Anda'}
                        </p>
                      );
                    })}
                  </div>
                  {r.pembahasan && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <b>Pembahasan:</b> {r.pembahasan}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ================= GURU / ADMIN =================

function RekapGuru({
  data,
  pengaturan,
  toast,
}: {
  data: PageProps['data'];
  pengaturan: PageProps['pengaturan'];
  toast: PageProps['toast'];
}) {
  const [paketId, setPaketId] = useState(data.paket[0]?.id || '');
  const [rows, setRows] = useState<BarisRekap[]>([]);
  const [namaPaket, setNamaPaket] = useState('');
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    if (!paketId) {
      setRows([]);
      return;
    }
    (async () => {
      setMemuat(true);
      try {
        const r = await rekapHasil(paketId);
        setRows(r.rows);
        setNamaPaket(r.paket?.nama || '');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Gagal memuat rekap.', 'error');
      } finally {
        setMemuat(false);
      }
    })();
  }, [paketId, toast]);

  const selesai = rows.filter((r) => r.status === 'Selesai');
  const rata = selesai.length ? Math.round(selesai.reduce((a, r) => a + r.nilai, 0) / selesai.length) : 0;

  const unduhExcel = () => {
    const header = ['No', 'NIS', 'Nama', 'Kelas', 'Status', 'Nilai', 'Benar', 'Total Soal', 'Waktu Submit', 'Peringatan'];
    const isi = rows.map((r, i) => [
      String(i + 1),
      r.nis,
      r.nama,
      r.kelas,
      r.status,
      String(r.nilai),
      String(r.benar),
      String(r.totalSoal),
      r.waktuSubmit,
      String(r.peringatan),
    ]);
    const xlsx = buatXlsx([{ nama: 'Rekap', data: [header, ...isi] }]);
    unduhBlob(
      `rekap-${namaPaket.replace(/[^\w\-]+/g, '-').toLowerCase() || 'hasil'}.xlsx`,
      new Blob([xlsx], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    );
    toast('File Excel diunduh.', 'sukses');
  };

  return (
    <div>
      <PageHeader
        judul="Rekap Hasil"
        subjudul="Hasil try out per paket."
        aksi={
          rows.length > 0 && (
            <>
              <Button varian="sekunder" onClick={unduhExcel}>
                <Download className="h-4 w-4" /> Unduh Excel
              </Button>
              <Button varian="sekunder" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Cetak
              </Button>
            </>
          )
        }
      />

      <Card className="no-print mb-4">
        <Field label="Paket">
          <SelectInput value={paketId} onChange={(e) => setPaketId(e.target.value)}>
            {data.paket.map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </SelectInput>
        </Field>
      </Card>

      {memuat ? (
        <LoadingBlock teks="Memuat rekap..." />
      ) : rows.length === 0 ? (
        <EmptyState judul="Belum ada data" subjudul="Pilih paket lalu tunggu siswa mengerjakan." />
      ) : (
        <>
          <div className="no-print mb-4 grid grid-cols-3 gap-3">
            <Card><p className="text-xs text-slate-400">Selesai</p><p className="font-mono-num text-2xl font-bold">{selesai.length}</p></Card>
            <Card><p className="text-xs text-slate-400">Rata-rata</p><p className="font-mono-num text-2xl font-bold">{rata}</p></Card>
            <Card><p className="text-xs text-slate-400">Peserta</p><p className="font-mono-num text-2xl font-bold">{rows.length}</p></Card>
          </div>

          {/* area cetak */}
          <div id="print-area">
            <KopCetak
              logoUrl={pengaturan.logoUrl}
              namaSekolah={pengaturan.namaSekolah}
              alamat={pengaturan.alamatSekolah}
              telepon={pengaturan.telepon}
              judul="REKAP HASIL TRY OUT"
              subJudul={namaPaket}
            />
            <div className="cetak-tabel-wrap overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    {['No', 'NIS', 'Nama', 'Kelas', 'Status', 'Nilai', 'Benar'].map((h) => (
                      <th key={h} className="border border-slate-300 bg-slate-100 px-2 py-2 text-left text-xs font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.username}>
                      <td className="border border-slate-200 px-2 py-1.5">{i + 1}</td>
                      <td className="border border-slate-200 px-2 py-1.5">{r.nis}</td>
                      <td className="border border-slate-200 px-2 py-1.5">{r.nama}</td>
                      <td className="border border-slate-200 px-2 py-1.5">{r.kelas}</td>
                      <td className="border border-slate-200 px-2 py-1.5">{r.status}</td>
                      <td className="border border-slate-200 px-2 py-1.5 font-bold">{r.status === 'Selesai' ? r.nilai : '-'}</td>
                      <td className="border border-slate-200 px-2 py-1.5">{r.benar}/{r.totalSoal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TtdCetak namaKepala={pengaturan.namaKepala} />
          </div>

          <div className="no-print mt-4">
            <Card>
              <TabelResponsif>
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <th className={thCls}>No</th>
                      <th className={thCls}>Nama</th>
                      <th className={thCls}>Kelas</th>
                      <th className={thCls}>Status</th>
                      <th className={thCls}>Nilai</th>
                      <th className={thCls}>Benar</th>
                      <th className={thCls}>Peringatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.username} className="hover:bg-slate-50">
                        <td className={tdCls}>{i + 1}</td>
                        <td className={tdCls}>
                          <p className="font-semibold">{r.nama}</p>
                          <p className="text-xs text-slate-400">{r.nis}</p>
                        </td>
                        <td className={tdCls}>{r.kelas}</td>
                        <td className={tdCls}>
                          {r.status === 'Selesai' ? (
                            <Badge warna="hijau">Selesai</Badge>
                          ) : r.status === 'Mengerjakan' ? (
                            <Badge warna="biru">Mengerjakan</Badge>
                          ) : r.status === 'Dibatalkan' ? (
                            <Badge warna="merah">Dibatalkan</Badge>
                          ) : (
                            <Badge warna="abu">Belum mulai</Badge>
                          )}
                        </td>
                        <td className={tdCls}>
                          <span className="font-mono-num font-bold">{r.status === 'Selesai' ? r.nilai : '-'}</span>
                        </td>
                        <td className={tdCls}>{r.benar}/{r.totalSoal}</td>
                        <td className={tdCls}>{r.peringatan > 0 ? <Badge warna="kuning">{r.peringatan}×</Badge> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelResponsif>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
