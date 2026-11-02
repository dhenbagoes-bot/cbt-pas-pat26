// Uji logika frontend CBT (node assert, tanpa framework).
// Prasyarat: kompilasi dulu ->
//   npx tsc --ignoreConfig src/utils/ujian.ts --outDir test/dist-test \
//     --module nodenext --target es2020 --moduleResolution nodenext --skipLibCheck
// Jalankan: node test/frontend-logic.test.mjs
import assert from 'node:assert/strict';
import {
  acakArray,
  acakOpsi,
  acakSoalUntukSesi,
  formatSisaWaktu,
  hitungBenar,
  hitungNilaiSkor,
} from './dist-test/ujian.js';

/** PRNG deterministik (mulberry32) agar uji acak dapat diulang. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let lolos = 0;
let gagal = 0;

function uji(nama, fn) {
  try {
    fn();
    lolos++;
    console.log(`✓ ${nama}`);
  } catch (e) {
    gagal++;
    console.error(`✗ ${nama}: ${e.message}`);
  }
}

// --- 1. acakArray: permutasi lengkap, asli tidak diubah, deterministik ---
uji('acakArray permutasi lengkap', () => {
  const asli = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const hasil = acakArray(asli, prng(42));
  assert.equal(hasil.length, asli.length);
  assert.deepEqual([...hasil].sort((a, b) => a - b), asli); // semua elemen tepat sekali
  assert.deepEqual(asli, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // asli tidak diubah
  // deterministik dengan seed sama
  assert.deepEqual(acakArray(asli, prng(42)), hasil);
  // seed berbeda (hampir pasti) beda urutan
  assert.notDeepEqual(acakArray(asli, prng(7)), hasil);
  // array kosong & 1 elemen aman
  assert.deepEqual(acakArray([], prng(1)), []);
  assert.deepEqual(acakArray(['x'], prng(1)), ['x']);
});

// --- 2. acakOpsi: kode A–E dipertahankan ---
uji('acakOpsi kode dipertahankan', () => {
  const opsi = [
    { kode: 'A', teks: 'satu' },
    { kode: 'B', teks: 'dua' },
    { kode: 'C', teks: 'tiga' },
    { kode: 'D', teks: 'empat' },
    { kode: 'E', teks: 'lima' },
  ];
  const hasil = acakOpsi(opsi, prng(99));
  assert.equal(hasil.length, 5);
  // himpunan kode tetap A–E (tidak ada kode palsu/hilang)
  assert.deepEqual(hasil.map((o) => o.kode).sort(), ['A', 'B', 'C', 'D', 'E']);
  // tiap kode tetap menempel pada teks aslinya
  for (const o of hasil) {
    const asal = opsi.find((x) => x.kode === o.kode);
    assert.equal(o.teks, asal.teks);
  }
});

// --- 3. hitungNilaiSkor: simulasi rumus server ---
uji('hitungNilaiSkor rumus server', () => {
  // contoh kontrak: 8 benar bobot 1 dari 10 soal -> 80
  assert.equal(hitungNilaiSkor(8, 10), 80);
  assert.equal(hitungNilaiSkor(10, 10), 100);
  assert.equal(hitungNilaiSkor(0, 10), 0);
  // totalBobot 0 -> 0 (tanpa pembagian nol)
  assert.equal(hitungNilaiSkor(5, 0), 0);
  // pembulatan: 1/3 -> 33, 2/3 -> 67
  assert.equal(hitungNilaiSkor(1, 3), 33);
  assert.equal(hitungNilaiSkor(2, 3), 67);
  // bobot campuran: skor 5 dari total 8 -> 63 (62.5 dibulatkan)
  assert.equal(hitungNilaiSkor(5, 8), 63);
});

// --- 4. formatSisaWaktu ---
uji('formatSisaWaktu', () => {
  assert.equal(formatSisaWaktu(3661), '01:01:01');
  assert.equal(formatSisaWaktu(3600), '01:00:00');
  assert.equal(formatSisaWaktu(125), '02:05');
  assert.equal(formatSisaWaktu(59), '00:59');
  assert.equal(formatSisaWaktu(0), '00:00');
  assert.equal(formatSisaWaktu(-10), '00:00');
  assert.equal(formatSisaWaktu(90.7), '01:30'); // dibulatkan ke bawah
});

// --- 5. acakSoalUntukSesi: subset acak sejumlah N ---
uji('acakSoalUntukSesi', () => {
  const bank = ['s1', 's2', 's3', 's4', 's5'];
  const ambil = acakSoalUntukSesi(bank, 3, prng(5));
  assert.equal(ambil.length, 3);
  assert.equal(new Set(ambil).size, 3); // tanpa duplikat
  for (const s of ambil) assert.ok(bank.includes(s));
  // N melebihi bank -> seluruh bank (tanpa duplikat)
  const semua = acakSoalUntukSesi(bank, 99, prng(5));
  assert.equal(semua.length, 5);
  assert.deepEqual([...semua].sort(), [...bank].sort());
  // N=0 -> kosong
  assert.deepEqual(acakSoalUntukSesi(bank, 0, prng(5)), []);
});

// --- 6. hitungBenar: benar/salah/kosong (pratinjau lokal) ---
uji('hitungBenar', () => {
  const kunci = [
    { soalId: 's1', kode: 'A' },
    { soalId: 's2', kode: 'B' },
    { soalId: 's3', kode: 'C' },
    { soalId: 's4', kode: 'D' },
  ];
  const jawaban = [
    { soalId: 's1', jawaban: 'A' }, // benar
    { soalId: 's2', jawaban: 'c' }, // salah (case-insensitive vs B)
    // s3 kosong
    { soalId: 's4', jawaban: 'd' }, // benar (lowercase ok)
  ];
  assert.deepEqual(hitungBenar(kunci, jawaban), { benar: 2, salah: 1, kosong: 1 });
  assert.deepEqual(hitungBenar(kunci, []), { benar: 0, salah: 0, kosong: 4 });
});

console.log(`\n${lolos} lolos, ${gagal} gagal.`);
if (gagal > 0) process.exit(1);
