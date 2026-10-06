import fs from 'node:fs/promises';
import path from 'node:path';
import { createReader, graderModelName, readerModel } from '@/lib/reader';
import { checkPhoto, ImageError, normalizeImage } from '@/lib/images';
import { mergeSheets, type SheetPage } from '@/lib/klasik/sheets';
import { gradeDemoSheets, type DemoSheet } from '@/lib/demo/grade';
import type { KlasikLine, KlasikRead, Rubric } from '@/lib/types';
import type { Usage } from '@/lib/reader/types';
import { spent, withBudget } from './budget';

// MEB sınavları, öğrenci gibi kötü el yazısıyla doldurulmuş fotoğraflardan
// (scripts/meb-handwriting.py) ürünün yolundan: fotoğraf → yükleme kontrolü
// (normalizeImage + checkPhoto) → okuma → sayfaları birleştirme → puanlama,
// ve beklenen puanlarla karşılaştırma. Okuma kalitesi kaynak metne göre
// karakter hata oranıyla (CER) ölçülür.
//
//   npx tsx --tsconfig tsconfig.json scripts/eval-meb-photos.ts                # iki sınav
//   npx tsx --tsconfig tsconfig.json scripts/eval-meb-photos.ts eval/data/meb-elyazisi/tr8/manifest.json
//   MEB_STUDENTS=t02 MEB_PAGES=2 MEB_NO_GRADE=1 ...                          # duman testi
//   ... eval-meb-photos.ts --order shuffled eval/data/meb-elyazisi-isimli/tr8/manifest.json
//
// --order sequential|shuffled: sınıfın bütün sayfaları manifestin uploadOrder
// sırasıyla, tek seferde yüklenmiş gibi ürünün birleştirmesinden
// (mergeSheets(rows, roster)) geçer ve hangi sayfanın hangi öğrenciye gittiği
// ölçülür. Bu kip API çağırmaz: okumalar önbellekten gelir, eksikse söyler.
//
// Her okuma ve puanlama manifestin yanında önbelleğe alınır (reads-<model>/,
// grades-<okuyan>-<puanlayan>/): tekrar çalıştırma para harcamaz.

type Line = string | KlasikLine;
type Student = {
  id: string; name: string; pages: string[]; style: Record<string, unknown>;
  answers: { q: number; lines: Line[] }[];
  expected: { q: number; points: number; tags: string[]; why: string }[];
};
type Manifest = { exam: string; rubric: string; students: Student[]; uploadOrder?: Record<'sequential' | 'shuffled', string[]> };
type PageRead = { file: string; refused?: string; read?: KlasikRead; usage?: Usage };

const CONC = Number(process.env.MEB_CONCURRENCY || 3);
const ONLY = process.env.MEB_STUDENTS ? new Set(process.env.MEB_STUDENTS.split(',')) : null;
const PAGES = Number(process.env.MEB_PAGES || 0); // >0: öğrenci başına yalnız ilk N sayfa
const NO_GRADE = process.env.MEB_NO_GRADE === '1';

const exists = (p: string) => fs.access(p).then(() => true, () => false);
const readJson = async <T,>(p: string): Promise<T> => JSON.parse(await fs.readFile(p, 'utf8'));
const writeJson = async (p: string, v: unknown) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2));
};
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  }));
  return out;
}

const lineOf = (l: Line): KlasikLine => (typeof l === 'string' ? { text: l, crossed: false } : l);

// Karşılaştırma için: okuyucu matematiği düz metin yazar (sqrt(x), x^2, *),
// öğrenci kâğıdında √, ², · vardır; ikisi de aynı biçime getirilir.
function norm(s: string): string {
  return s
    .replace(/cbrt|∛/g, '3√').replace(/sqrt/g, '√')
    .replace(/[·×*⋅]/g, '*').replace(/[−–—]/g, '-')
    .replace(/<=|≤/g, '≤').replace(/>=|≥/g, '≥').replace(/=>|⇒|→|->/g, '→')
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/[\s^()[\]{}"“”'’‘.,;:!?]/g, '')
    .toLocaleLowerCase('tr');
}
function lev(a: string, b: string): number {
  if (!a.length) return b.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Sınıfın sayfaları öğretmenin yükleme sırasıyla: ürün sayfaları doğru
// öğrencilere bağlayabiliyor mu? Okumalar yalnız önbellekten.
async function orderRun(mf: string, order: 'sequential' | 'shuffled') {
  const dir = path.dirname(mf);
  const m = await readJson<Manifest>(mf);
  const files = m.uploadOrder?.[order];
  if (!files) throw new Error(`${mf}: uploadOrder.${order} yok (scripts/meb-handwriting.py ile yeniden üretin)`);
  const readDir = path.join(dir, `reads-${readerModel()}`);
  const owner = new Map(m.students.flatMap((st) => st.pages.map((f) => [f, st] as const)));
  const missing: string[] = [];
  const rows: SheetPage[] = [];
  for (const [i, file] of files.entries()) {
    const cache = path.join(readDir, `${file}.json`);
    if (!(await exists(cache))) { missing.push(file); continue; }
    const r = await readJson<PageRead>(cache);
    rows.push({
      id: file, seq: i + 1, status: r.read ? 'read' : 'failed', error: r.refused ?? null, filePath: null,
      result: r.read ? { type: 'klasik-student', read: r.read } : null, override: null, grade: null, gradedRev: 0, gradeAttempts: 0,
    });
  }
  if (missing.length) {
    console.log(`${m.exam}: ${missing.length} sayfanın okuması önbellekte yok (önce --order olmadan çalıştırın): ${missing.slice(0, 6).join(', ')}…`);
    return;
  }
  const roster = m.students.map((st) => st.name);
  const { sheets, failed } = mergeSheets(rows, roster);
  // bir kâğıt doğru: sayfaları tek bir öğrencinin bütün sayfaları
  let exact = 0, mixed = 0, split = 0;
  const lines: string[] = [];
  for (const sh of sheets) {
    const who = new Set(sh.pageIds.map((id) => owner.get(id)?.id));
    const st = owner.get(sh.pageIds[0])!;
    if (who.size > 1) mixed++;
    else if (sh.pageIds.length === st.pages.length) exact++;
    else split++;
    lines.push(`| ${sh.pageIds.join(' + ')} | ${sh.read.studentName ?? '-'} | ${[...who].join(', ')} | ${who.size > 1 ? '**karışık**' : sh.pageIds.length === st.pages.length ? 'tam' : 'eksik'} |`);
  }
  const md = [
    `# ${m.exam} — yükleme sırası: ${order} · okuyan ${readerModel()}`, '',
    '| Ölçü | Değer |', '|---|---|',
    `| Öğrenci / sayfa | ${m.students.length} / ${files.length} |`,
    `| Ürünün çıkardığı kâğıt | ${sheets.length} (okunamayan sayfa ${failed.length}) |`,
    `| Tam ve doğru kâğıt (bir öğrencinin bütün sayfaları) | ${exact}/${m.students.length} |`,
    `| Başka öğrencinin sayfasını içeren kâğıt | ${mixed} |`,
    `| Eksik kalmış kâğıt (öğrencinin sayfaları bölünmüş) | ${split} |`,
    '', '| Sayfalar | Okunan isim | Gerçek öğrenci | Durum |', '|---|---|---|---|', ...lines,
  ].join('\n');
  const report = path.join(dir, `order-${order}-${readerModel()}.md`);
  await fs.writeFile(report, md);
  console.log(md);
  console.log(`rapor: ${report}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const oi = argv.indexOf('--order');
  if (oi >= 0) {
    const order = argv[oi + 1];
    if (order !== 'sequential' && order !== 'shuffled') throw new Error('--order sequential|shuffled');
    argv.splice(oi, 2);
    const list = argv.length ? argv : ['eval/data/meb-elyazisi-isimli/mat9/manifest.json', 'eval/data/meb-elyazisi-isimli/tr8/manifest.json'];
    for (const mf of list) await orderRun(mf, order);
    return;
  }
  const manifests = argv;
  if (!manifests.length) manifests.push('eval/data/meb-elyazisi/mat9/manifest.json', 'eval/data/meb-elyazisi/tr8/manifest.json');
  const reader = withBudget(createReader());
  const rModel = readerModel();
  const gModel = graderModelName();

  for (const mf of manifests) {
    const dir = path.dirname(mf);
    const m = await readJson<Manifest>(mf);
    const rubric = (await readJson<{ rubric: Rubric }>(m.rubric)).rubric;
    const students = m.students.filter((s) => !ONLY || ONLY.has(s.id));
    const readDir = path.join(dir, `reads-${rModel}`);
    const gradeDir = path.join(dir, `grades-${rModel}-${gModel}`);
    console.log(`${m.exam}: ${students.length} öğrenci · okuyan ${rModel}${NO_GRADE ? '' : ` · puanlayan ${gModel}`}`);

    // 1. her sayfa: yükleme kontrolü ve okuma (önbellekli)
    const jobs = students.flatMap((s) => (PAGES ? s.pages.slice(0, PAGES) : s.pages).map((file) => ({ s, file })));
    const reads = new Map<string, PageRead>();
    await pool(jobs, CONC, async ({ file }) => {
      const cache = path.join(readDir, `${file}.json`);
      if (await exists(cache)) { reads.set(file, await readJson<PageRead>(cache)); return; }
      const raw = await fs.readFile(path.join(dir, file));
      let out: PageRead;
      try {
        const image = await normalizeImage(raw);
        await checkPhoto(image);
        const r = await reader.readKlasik(image);
        out = { file, read: r.read, usage: r.usage };
      } catch (e) {
        if (!(e instanceof ImageError)) { console.error(file, e instanceof Error ? e.message.slice(0, 200) : e); return; }
        out = { file, refused: e.message };
      }
      await writeJson(cache, out);
      reads.set(file, out);
      console.log(`  okundu ${file}${out.refused ? ` — REDDEDİLDİ: ${out.refused}` : ''}`);
    });

    // 2. sayfaları ürünün kuralıyla birleştir; ölç, sonra öğrenci başına tek kâğıt olarak puanla
    type Row = { id: string; q: number; expected: number; got: number | null; max: number; flagged: boolean; tags: string[]; cer: number | null; chars: number };
    const rows: Row[] = [];
    const notes: string[] = [];
    let backOk = 0, backAll = 0, merged = 0, nameOk = 0, refused = 0, crossedSrc = 0, crossedRead = 0;
    const sheets = new Map<string, DemoSheet>();
    for (const s of students) {
      const files = PAGES ? s.pages.slice(0, PAGES) : s.pages;
      const pr = files.map((f) => reads.get(f));
      if (pr.some((p) => !p)) { notes.push(`${s.id}: okunamayan sayfa var (hata)`); continue; }
      refused += pr.filter((p) => p!.refused).length;
      const ok = pr.filter((p) => p!.read).map((p) => p!.read!);
      pr.forEach((p, i) => {
        if (!p!.read) return;
        backAll++;
        if (p!.read.isBackSide === (i > 0)) backOk++;
      });
      const pages: SheetPage[] = ok.map((read, i) => ({
        id: `p${i + 1}`, seq: i + 1, status: 'read', error: null, filePath: null,
        result: { type: 'klasik-student', read }, override: null, grade: null, gradedRev: 0, gradeAttempts: 0,
      }));
      const product = mergeSheets(pages).sheets;
      if (product.length === 1) merged++;
      else notes.push(`${s.id}: ürün sayfaları ${product.length} kâğıda böldü (isBackSide: ${ok.map((r) => r.isBackSide).join(',')})`);
      const name = ok[0]?.studentName ?? '';
      if (name.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim() === s.name.toLocaleLowerCase('tr')) nameOk++;
      else notes.push(`${s.id}: isim "${name}" okundu, doğrusu "${s.name}"`);
      // ölçüm için öğrencinin sayfaları tek kâğıt: ilk sayfa dışındakiler arka yüz sayılır
      const one: KlasikRead[] = ok.map((r, i) => ({ ...r, isBackSide: i > 0 }));
      const sheetRead = mergeSheets(one.map((read, i) => ({ ...pages[i], result: { type: 'klasik-student', read } }))).sheets[0]?.read;

      let sheet: DemoSheet | undefined;
      if (!NO_GRADE && one.length) {
        const cache = path.join(gradeDir, `${s.id}${PAGES ? `-p${PAGES}` : ''}.json`);
        if (await exists(cache)) sheet = await readJson<DemoSheet>(cache);
        else {
          try {
            [sheet] = await gradeDemoSheets(reader, rubric, one);
            await writeJson(cache, sheet);
          } catch (e) {
            notes.push(`${s.id}: puanlanamadı — ${e instanceof Error ? e.message.slice(0, 120) : e}`);
          }
        }
        if (sheet) sheets.set(s.id, sheet);
      }

      for (const e of s.expected) {
        const src = s.answers.find((a) => a.q === e.q)?.lines.map(lineOf) ?? [];
        const got = sheetRead?.answers.filter((a) => a.q === e.q).flatMap((a) => a.lines) ?? [];
        crossedSrc += src.filter((l) => l.crossed).length;
        crossedRead += got.filter((l) => l.crossed).length;
        const a = norm(src.filter((l) => !l.crossed).map((l) => l.text).join(''));
        const b = norm(got.filter((l) => !l.crossed).map((l) => l.text).join(''));
        const onPage = PAGES ? rubricPageOf(m.exam, e.q) < PAGES : true;
        const q = sheet?.questions.find((x) => x.q === e.q);
        const max = rubric.questions.find((x) => x.q === e.q)!.criteria.reduce((t, c) => t + c.points, 0);
        rows.push({
          id: s.id, q: e.q, expected: e.points, got: q && onPage ? q.points : null, max, flagged: (q?.attention.length ?? 0) > 0,
          tags: e.tags, cer: onPage && a.length ? lev(a, b) / a.length : null, chars: a.length,
        });
      }
    }

    // 3. rapor
    const cerRows = rows.filter((r) => r.cer !== null);
    const cer = cerRows.reduce((t, r) => t + r.cer! * r.chars, 0) / Math.max(1, cerRows.reduce((t, r) => t + r.chars, 0));
    const graded = rows.filter((r) => r.got !== null);
    const tol = (r: Row) => Math.abs(r.got! - r.expected) <= 0.1 * r.max;
    const silentOver = graded.filter((r) => !r.flagged && r.got! - r.expected > 0.1 * r.max);
    const silentUnder = graded.filter((r) => !r.flagged && r.expected - r.got! > 0.1 * r.max);
    const totals = students.filter((s) => sheets.has(s.id)).map((s) => ({
      id: s.id, expected: s.expected.reduce((t, e) => t + e.points, 0), got: sheets.get(s.id)!.total,
    }));
    const pct = (n: number, d: number) => `%${((n / Math.max(1, d)) * 100).toFixed(0)}`;
    const worst = [...cerRows].sort((x, y) => y.cer! - x.cer!).slice(0, 10);
    const md = [
      `# ${m.exam} — fotoğraftan · okuyan ${rModel}${NO_GRADE ? '' : ` · puanlayan ${gModel}`}`, '',
      '| Ölçü | Değer |', '|---|---|',
      `| Öğrenci / sayfa | ${students.length} / ${jobs.length} |`,
      `| Yüklemede reddedilen sayfa | ${refused} |`,
      `| Okuma CER (karakter hata oranı) | %${(cer * 100).toFixed(2)} |`,
      `| Arka yüz / ön yüz doğru tespit | ${backOk}/${backAll} |`,
      `| Ürünün birleştirmesiyle tek kâğıt | ${merged}/${students.length} |`,
      `| İsim birebir doğru | ${nameOk}/${students.length} |`,
      `| Üstü çizili satır (kaynak → okunan) | ${crossedSrc} → ${crossedRead} |`,
      ...(graded.length ? [
        `| Beklenen puanla aynı (±%10) | ${graded.filter(tol).length}/${graded.length} (${pct(graded.filter(tol).length, graded.length)}) |`,
        `| Öğretmene işaretlenen | ${pct(graded.filter((r) => r.flagged).length, graded.length)} |`,
        `| Uyarısız fazla / eksik puan | ${silentOver.length} / ${silentUnder.length} |`,
        `| Öğrenci toplamı ort. fark | ${(totals.reduce((t, x) => t + Math.abs(x.got - x.expected), 0) / Math.max(1, totals.length)).toFixed(1)} |`,
      ] : []),
      '', '## En kötü okunan cevaplar', '', '| Cevap | CER | karakter |', '|---|---|---|',
      ...worst.map((r) => `| ${r.id}-q${r.q} | %${(r.cer! * 100).toFixed(1)} | ${r.chars} |`),
      ...(graded.length ? ['', '## Ayrışan puanlar', '', '| Cevap | Beklenen | Sistem | İşaret | Senaryo | CER |', '|---|---|---|---|---|---|',
        ...graded.filter((r) => !tol(r)).map((r) => `| ${r.id}-q${r.q} | ${r.expected} | ${r.got} | ${r.flagged ? 'var' : '**yok**'} | ${r.tags.join(', ')} | ${r.cer === null ? '-' : `%${(r.cer * 100).toFixed(1)}`} |`)] : []),
      ...(notes.length ? ['', '## Notlar', '', ...notes.map((n) => `- ${n}`)] : []),
    ].join('\n');
    const report = path.join(dir, `report-${rModel}${NO_GRADE ? '' : `-${gModel}`}${ONLY || PAGES ? '-kismi' : ''}.md`);
    await fs.writeFile(report, md);
    console.log(md.split('## En kötü')[0]);
    console.log(`rapor: ${report}`);
  }
}

// hangi soru hangi sayfada (0'dan); MEB_PAGES ile kısmi okumada CER yalnız okunan sayfalar için
function rubricPageOf(exam: string, q: number): number {
  const pages: Record<string, number[]> = { mat9: [0, 0, 1, 1, 2, 2, 3, 3], tr8: [0, 0, 1, 1, 1, 2, 2, 3] };
  return pages[exam]?.[q] ?? 0;
}

process.on('exit', () => { const l = spent(); if (l.calls) console.log(`Harcama (defter toplamı): $${l.usd.toFixed(3)} · ${l.calls} çağrı`); });
main().catch((e) => { console.error(e); process.exit(1); });
