import { useMemo, useRef, useState } from 'react';
import { Download, FileUp, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SelectInput,
  TabelResponsif,
  TextAreaInput,
  TextInput,
  tdCls,
  thCls,
} from '../components/ui';
import {
  deleteSoal,
  importSoal,
  importSoalDariForm,
  saveSoal,
  uploadGambarSoal,
} from '../services/api';
import {
  parseFileSoal,
  unduhTemplateDocx,
  unduhTemplateTxt,
  unduhTemplateXlsx,
  type BarisSoalImpor,
} from '../utils/imporSoal';
import type { SoalBank } from '../types';
import type { PageProps } from './PageProps';

interface FormSoal {
  id?: string;
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
}

const FORM_KOSONG: FormSoal = {
  jenjangId: '',
  mapelId: '',
  soal: '',
  opsiA: '',
  opsiB: '',
  opsiC: '',
  opsiD: '',
  opsiE: '',
  kunci: 'A',
  bobot: 1,
  pembahasan: '',
  gambarUrl: '',
};

export default function BankSoal({ data, toast, refreshData }: PageProps) {
  const [fJenjang, setFJenjang] = useState('');
  const [fMapel, setFMapel] = useState('');
  const [cari, setCari] = useState('');
  const [formBuka, setFormBuka] = useState(false);
  const [form, setForm] = useState<FormSoal>(FORM_KOSONG);
  const [simpanLoading, setSimpanLoading] = useState(false);
  const [hapusId, setHapusId] = useState<string | null>(null);
  const [imporBuka, setImporBuka] = useState(false);

  const mapelFilter = useMemo(
    () => data.mapel.filter((m) => !fJenjang || m.jenjangId === fJenjang),
    [data.mapel, fJenjang]
  );
  const mapelForm = useMemo(
    () => data.mapel.filter((m) => !form.jenjangId || m.jenjangId === form.jenjangId),
    [data.mapel, form.jenjangId]
  );

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return data.bankSoal
      .filter((s) => !fJenjang || s.jenjangId === fJenjang)
      .filter((s) => !fMapel || s.mapelId === fMapel)
      .filter((s) => !q || s.soal.toLowerCase().includes(q));
  }, [data.bankSoal, fJenjang, fMapel, cari]);

  const namaJenjang = (id: string) => data.jenjang.find((j) => j.id === id)?.nama || '-';
  const namaMapel = (id: string) => data.mapel.find((m) => m.id === id)?.nama || '-';

  const bukaTambah = () => {
    setForm({ ...FORM_KOSONG, jenjangId: fJenjang });
    setFormBuka(true);
  };
  const bukaUbah = (s: SoalBank) => {
    setForm({
      id: s.id,
      jenjangId: s.jenjangId,
      mapelId: s.mapelId,
      soal: s.soal,
      opsiA: s.opsiA,
      opsiB: s.opsiB,
      opsiC: s.opsiC,
      opsiD: s.opsiD,
      opsiE: s.opsiE || '',
      kunci: s.kunci,
      bobot: s.bobot || 1,
      pembahasan: s.pembahasan || '',
      gambarUrl: s.gambarUrl || '',
    });
    setFormBuka(true);
  };

  const simpan = async () => {
    if (!form.jenjangId || !form.mapelId) return toast('Pilih jenjang dan mapel.', 'error');
    if (!form.soal.trim()) return toast('Teks soal wajib diisi.', 'error');
    if (!form.opsiA.trim() || !form.opsiB.trim() || !form.opsiC.trim() || !form.opsiD.trim())
      return toast('Opsi A–D wajib diisi.', 'error');
    const opsiKunci: Record<string, string> = { A: form.opsiA, B: form.opsiB, C: form.opsiC, D: form.opsiD, E: form.opsiE };
    if (!opsiKunci[form.kunci]?.trim()) return toast(`Opsi ${form.kunci} yang jadi kunci kosong.`, 'error');
    setSimpanLoading(true);
    try {
      const { id, ...rest } = form;
      await saveSoal(id ? { id, ...rest } : rest);
      toast('Soal tersimpan.', 'sukses');
      setFormBuka(false);
      await refreshData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan.', 'error');
    } finally {
      setSimpanLoading(false);
    }
  };

  const hapus = async () => {
    if (!hapusId) return;
    try {
      await deleteSoal(hapusId);
      toast('Soal dihapus.', 'sukses');
      setHapusId(null);
      await refreshData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus.', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        judul="Bank Soal"
        subjudul={`${daftar.length} soal${fJenjang || fMapel || cari ? ' (terfilter)' : ''}.`}
        aksi={
          <>
            <Button varian="sekunder" onClick={() => setImporBuka(true)}>
              <FileUp className="h-4 w-4" /> Template &amp; Unggah
            </Button>
            <Button onClick={bukaTambah}>
              <Plus className="h-4 w-4" /> Tambah Soal
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Jenjang">
            <SelectInput value={fJenjang} onChange={(e) => { setFJenjang(e.target.value); setFMapel(''); }}>
              <option value="">Semua jenjang</option>
              {data.jenjang.map((j) => (
                <option key={j.id} value={j.id}>{j.nama}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Mapel">
            <SelectInput value={fMapel} onChange={(e) => setFMapel(e.target.value)}>
              <option value="">Semua mapel</option>
              {mapelFilter.map((m) => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cari soal">
            <TextInput value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Kata kunci..." />
          </Field>
        </div>
      </Card>

      {daftar.length === 0 ? (
        <EmptyState judul="Belum ada soal" subjudul="Tambah manual atau unggah dari file." />
      ) : (
        <Card>
          <TabelResponsif>
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={thCls}>No</th>
                  <th className={thCls}>Soal</th>
                  <th className={thCls}>Jenjang / Mapel</th>
                  <th className={thCls}>Kunci</th>
                  <th className={thCls}>Bobot</th>
                  <th className={thCls}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className={tdCls}>{i + 1}</td>
                    <td className={tdCls}>
                      <p className="max-w-md truncate" title={s.soal}>{s.soal}</p>
                      {s.gambarUrl && <p className="text-xs text-violet-600">🖼 ada gambar</p>}
                    </td>
                    <td className={tdCls}>
                      <p className="text-xs font-semibold">{namaJenjang(s.jenjangId)}</p>
                      <p className="text-xs text-slate-500">{namaMapel(s.mapelId)}</p>
                    </td>
                    <td className={tdCls}>
                      <Badge warna="hijau">{s.kunci}</Badge>
                    </td>
                    <td className={tdCls}>{s.bobot}</td>
                    <td className={tdCls}>
                      <div className="flex gap-1">
                        <button onClick={() => bukaUbah(s)} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="Ubah">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setHapusId(s.id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelResponsif>
        </Card>
      )}

      {formBuka && (
        <FormSoalModal
          form={form}
          setForm={setForm}
          mapelForm={mapelForm}
          jenjang={data.jenjang}
          onTutup={() => setFormBuka(false)}
          onSimpan={simpan}
          loading={simpanLoading}
          toast={toast}
        />
      )}

      {hapusId && (
        <ConfirmDialog
          judul="Hapus soal?"
          pesan="Soal akan dihapus dari bank soal. Tidak bisa dibatalkan."
          onYa={hapus}
          onBatal={() => setHapusId(null)}
        />
      )}

      {imporBuka && (
        <ImporSoalModal
          jenjang={data.jenjang}
          mapel={data.mapel}
          onTutup={() => setImporBuka(false)}
          toast={toast}
          refreshData={refreshData}
        />
      )}
    </div>
  );
}

function FormSoalModal({
  form,
  setForm,
  mapelForm,
  jenjang,
  onTutup,
  onSimpan,
  loading,
  toast,
}: {
  form: FormSoal;
  setForm: (f: FormSoal) => void;
  mapelForm: { id: string; nama: string }[];
  jenjang: { id: string; nama: string }[];
  onTutup: () => void;
  onSimpan: () => void;
  loading: boolean;
  toast: PageProps['toast'];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [unggahLoading, setUnggahLoading] = useState(false);
  const ubah = (k: keyof FormSoal, v: string | number) => setForm({ ...form, [k]: v });

  const unggahGambar = async (f: File) => {
    if (!f.type.startsWith('image/')) return toast('File harus gambar.', 'error');
    if (f.size > 2 * 1024 * 1024) return toast('Ukuran gambar maksimal 2 MB.', 'error');
    setUnggahLoading(true);
    try {
      const buf = await f.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const r = await uploadGambarSoal(btoa(bin), f.type, f.name);
      ubah('gambarUrl', r.url);
      toast('Gambar terunggah.', 'sukses');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengunggah gambar.', 'error');
    } finally {
      setUnggahLoading(false);
    }
  };

  return (
    <Modal judul={form.id ? 'Ubah Soal' : 'Tambah Soal'} onTutup={onTutup} lebar="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Jenjang">
            <SelectInput value={form.jenjangId} onChange={(e) => ubah('jenjangId', e.target.value)}>
              <option value="">— Pilih —</option>
              {jenjang.map((j) => (
                <option key={j.id} value={j.id}>{j.nama}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Mapel">
            <SelectInput value={form.mapelId} onChange={(e) => ubah('mapelId', e.target.value)}>
              <option value="">— Pilih —</option>
              {mapelForm.map((m) => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Teks soal">
          <TextAreaInput value={form.soal} onChange={(e) => ubah('soal', e.target.value)} rows={3} placeholder="Tulis soal..." />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Gambar soal (opsional)</span>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) unggahGambar(f);
                e.target.value = '';
              }}
            />
            <Button varian="sekunder" kecil loading={unggahLoading} onClick={() => fileRef.current?.click()}>
              {form.gambarUrl ? 'Ganti gambar' : 'Unggah gambar'}
            </Button>
            {form.gambarUrl && (
              <button onClick={() => ubah('gambarUrl', '')} className="text-xs text-red-600 hover:underline">
                Hapus
              </button>
            )}
          </div>
          {form.gambarUrl && <img src={form.gambarUrl} alt="Gambar soal" className="mt-2 max-h-40 rounded-lg border" />}
        </div>
        {(['A', 'B', 'C', 'D', 'E'] as const).map((k) => (
          <Field key={k} label={`Opsi ${k}${k === 'E' ? ' (opsional)' : ''}`}>
            <TextInput
              value={(form as unknown as Record<string, string>)[`opsi${k}`]}
              onChange={(e) => ubah(`opsi${k}` as keyof FormSoal, e.target.value)}
              placeholder={`Teks opsi ${k}`}
            />
          </Field>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kunci jawaban">
            <SelectInput value={form.kunci} onChange={(e) => ubah('kunci', e.target.value)}>
              {['A', 'B', 'C', 'D', 'E'].map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Bobot">
            <TextInput
              type="number"
              min={1}
              value={form.bobot}
              onChange={(e) => ubah('bobot', Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </Field>
        </div>
        <Field label="Pembahasan (opsional)">
          <TextAreaInput value={form.pembahasan} onChange={(e) => ubah('pembahasan', e.target.value)} rows={2} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button varian="sekunder" onClick={onTutup}>Batal</Button>
          <Button onClick={onSimpan} loading={loading}>Simpan</Button>
        </div>
      </div>
    </Modal>
  );
}

function ImporSoalModal({
  jenjang,
  mapel,
  onTutup,
  toast,
  refreshData,
}: {
  jenjang: { id: string; nama: string }[];
  mapel: { id: string; nama: string; jenjangId: string }[];
  onTutup: () => void;
  toast: PageProps['toast'];
  refreshData: () => Promise<void>;
}) {
  const [tab, setTab] = useState<'file' | 'form'>('file');
  const [jenjangId, setJenjangId] = useState(jenjang[0]?.id || '');
  const [mapelId, setMapelId] = useState('');
  const [baris, setBaris] = useState<BarisSoalImpor[]>([]);
  const [namaFile, setNamaFile] = useState('');
  const [parseLoading, setParseLoading] = useState(false);
  const [imporLoading, setImporLoading] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const mapelPilih = mapel.filter((m) => !jenjangId || m.jenjangId === jenjangId);
  const validCount = baris.filter((b) => b.valid).length;

  const pilihFile = async (f: File) => {
    setParseLoading(true);
    setNamaFile(f.name);
    try {
      const buf = await f.arrayBuffer();
      const hasil = await parseFileSoal(f.name, buf);
      setBaris(hasil.baris);
      if (hasil.baris.length === 0) toast('Tidak ada baris soal yang terbaca.', 'error');
      else toast(`Terbaca ${hasil.baris.length} baris (${hasil.valid.length} valid).`, 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membaca file.', 'error');
      setBaris([]);
    } finally {
      setParseLoading(false);
    }
  };

  const impor = async () => {
    if (!jenjangId || !mapelId) return toast('Pilih jenjang dan mapel tujuan.', 'error');
    const items = baris
      .filter((b) => b.valid)
      .map((b) => ({
        soal: b.item.soal || '',
        opsiA: b.item.opsiA || '',
        opsiB: b.item.opsiB || '',
        opsiC: b.item.opsiC || '',
        opsiD: b.item.opsiD || '',
        opsiE: b.item.opsiE,
        kunci: (b.item.kunci || '').toUpperCase(),
        bobot: b.item.bobot,
        pembahasan: b.item.pembahasan,
      }));
    if (items.length === 0) return toast('Tidak ada baris valid untuk diimpor.', 'error');
    setImporLoading(true);
    try {
      const r = await importSoal(jenjangId, mapelId, items);
      toast(`Berhasil: ${r.imported} soal diimpor${r.errors.length ? `, ${r.errors.length} gagal.` : '.'}`, r.errors.length ? 'error' : 'sukses');
      if (r.errors.length) {
        toast('Detail: ' + r.errors.slice(0, 3).map((e) => `baris ${e.baris}: ${e.pesan}`).join(' | '), 'error');
      }
      await refreshData();
      onTutup();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impor gagal.', 'error');
    } finally {
      setImporLoading(false);
    }
  };

  const imporDariForm = async () => {
    if (!formUrl.trim()) return toast('Tempel URL atau ID Google Form.', 'error');
    if (!jenjangId || !mapelId) return toast('Pilih jenjang dan mapel tujuan.', 'error');
    setFormLoading(true);
    try {
      const r = await importSoalDariForm(formUrl.trim(), jenjangId, mapelId);
      toast(`Impor dari Google Form: ${r.imported} soal masuk${r.dilewati.length ? `, ${r.dilewati.length} dilewati.` : '.'}`, 'sukses');
      await refreshData();
      onTutup();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impor dari Google Form gagal.', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <Modal judul="Template & Unggah Soal" onTutup={onTutup} lebar="max-w-3xl">
      <div className="mb-4 flex gap-2">
        <Button varian={tab === 'file' ? 'primer' : 'sekunder'} kecil onClick={() => setTab('file')}>
          <FileUp className="h-4 w-4" /> File (.txt/.docx/.xlsx)
        </Button>
        <Button varian={tab === 'form' ? 'primer' : 'sekunder'} kecil onClick={() => setTab('form')}>
          <Link2 className="h-4 w-4" /> Google Form
        </Button>
      </div>

      {tab === 'file' ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-2 text-sm font-bold text-slate-700">1. Unduh template (sudah ada contoh siap pakai)</p>
            <div className="flex flex-wrap gap-2">
              <Button varian="sekunder" kecil onClick={unduhTemplateTxt}>
                <Download className="h-3.5 w-3.5" /> .txt (Notepad)
              </Button>
              <Button varian="sekunder" kecil onClick={unduhTemplateDocx}>
                <Download className="h-3.5 w-3.5" /> .docx (Word)
              </Button>
              <Button varian="sekunder" kecil onClick={unduhTemplateXlsx}>
                <Download className="h-3.5 w-3.5" /> .xlsx (Excel)
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenjang tujuan">
              <SelectInput value={jenjangId} onChange={(e) => { setJenjangId(e.target.value); setMapelId(''); }}>
                {jenjang.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Mapel tujuan">
              <SelectInput value={mapelId} onChange={(e) => setMapelId(e.target.value)}>
                <option value="">— Pilih —</option>
                {mapelPilih.map((m) => (
                  <option key={m.id} value={m.id}>{m.nama}</option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">2. Pilih file yang sudah diisi</p>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.docx,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pilihFile(f);
                e.target.value = '';
              }}
            />
            <Button varian="sekunder" loading={parseLoading} onClick={() => fileRef.current?.click()}>
              <FileUp className="h-4 w-4" /> Pilih File
            </Button>
            {namaFile && <span className="ml-2 text-xs text-slate-500">{namaFile}</span>}
          </div>

          {baris.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">
                3. Pratinjau &amp; validasi ({validCount} valid dari {baris.length})
              </p>
              <TabelResponsif>
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr>
                      <th className={thCls}>No</th>
                      <th className={thCls}>Soal</th>
                      <th className={thCls}>Kunci</th>
                      <th className={thCls}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map((b) => (
                      <tr key={b.no} className={b.valid ? 'hover:bg-slate-50' : 'bg-red-50'}>
                        <td className={tdCls}>{b.no}</td>
                        <td className={tdCls}>
                          <p className="max-w-xs truncate" title={b.item.soal}>{b.item.soal || '(kosong)'}</p>
                        </td>
                        <td className={tdCls}>{(b.item.kunci || '-').toUpperCase()}</td>
                        <td className={tdCls}>
                          {b.valid ? <Badge warna="hijau">Valid</Badge> : <Badge warna="merah">{b.galat}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabelResponsif>
              <div className="mt-3 flex justify-end">
                <Button onClick={impor} loading={imporLoading} disabled={validCount === 0}>
                  Impor {validCount} Soal Valid
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Impor membaca soal pilihan ganda dari Google Form (mode kuis — kunci diambil dari jawaban
            benar). Soal tanpa kunci yang jelas akan dilewati. Backend perlu otorisasi Forms
            (<code>authorizeFormsAccess</code>) — lihat README.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenjang tujuan">
              <SelectInput value={jenjangId} onChange={(e) => { setJenjangId(e.target.value); setMapelId(''); }}>
                {jenjang.map((j) => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Mapel tujuan">
              <SelectInput value={mapelId} onChange={(e) => setMapelId(e.target.value)}>
                <option value="">— Pilih —</option>
                {mapelPilih.map((m) => (
                  <option key={m.id} value={m.id}>{m.nama}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <Field label="URL atau ID Google Form">
            <TextInput
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://docs.google.com/forms/d/1AbC.../edit  atau  1AbC..."
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={imporDariForm} loading={formLoading}>
              Impor dari Google Form
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
