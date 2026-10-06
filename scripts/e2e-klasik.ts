import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import ExcelJS from 'exceljs';
import set from '@/eval/klasik/goruntu-seti/cases.json';

// The whole klasik flow as a teacher meets it, against a running app, worker,
// database and mail sink — the real product path, not the eval shortcuts:
// sign in by mail link, create an exam, upload the key and 30 pages, enter
// the roster, submit, check and approve the rubric, wait for grading, compare
// the review screen with the planned points, approve, and read the report
// out of the mail.
//
//   APP_URL=http://localhost:3100 DATABASE_URL=… MAIL_DIR=<sink folder> \
//     npx tsx --tsconfig tsconfig.json scripts/e2e-klasik.ts
//
// Real model calls through the worker (≈ 60), so it costs money.

const APP = process.env.APP_URL || 'http://localhost:3100';
const MAIL_DIR = process.env.MAIL_DIR!;
const PHOTOS = 'eval/data/klasik-goruntu';
const EMAIL = `e2e-${Date.now()}@okul.k12.tr`;
const XFF = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const STUDENTS = [
  'Elif Yıldız', 'Mert Kaya', 'Zeynep Arslan', 'Emre Demir', 'Ayşe Çelik', 'Burak Şahin', 'Selin Öztürk', 'Can Aydın',
  'Deniz Koç', 'Ece Kurt', 'Ali Polat', 'İrem Güneş', 'Oğuz Tekin', 'Melis Acar', 'Kaan Yurt',
];
let cookie = '';

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(p: string, init: RequestInit = {}) {
  const res = await fetch(APP + p, { ...init, headers: { 'x-forwarded-for': XFF, cookie, ...(init.headers || {}) }, redirect: 'manual' });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body };
}
const json = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
function must(r: { status: number; body: any }, ok: number[], what: string) {
  if (!ok.includes(r.status)) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body;
}

async function mailsTo(email: string) {
  const out = [];
  for (const f of (await fs.readdir(MAIL_DIR)).filter((f) => /^\d+\.json$/.test(f)).sort()) {
    const m = JSON.parse(await fs.readFile(path.join(MAIL_DIR, f), 'utf8'));
    if (String(m.to).includes(email)) out.push({ id: f.slice(0, 3), ...m });
  }
  return out;
}
async function waitMail(pred: (m: any) => boolean, what: string, ms = 120_000) {
  for (const t = Date.now(); Date.now() - t < ms; await sleep(1500)) {
    const m = (await mailsTo(EMAIL)).find(pred);
    if (m) return m;
  }
  throw new Error(`no mail: ${what}`);
}
async function waitStatus(jobId: string, want: string[], ms: number) {
  let last = '';
  for (const t = Date.now(); Date.now() - t < ms; await sleep(5000)) {
    const job = must(await api(`/api/jobs/${jobId}`), [200], 'job');
    if (job.status !== last) log('durum:', (last = job.status), JSON.stringify(job.pages ?? {}));
    if (want.includes(job.status)) return job;
  }
  throw new Error(`job stuck in ${last}`);
}

async function main() {
  const problems: string[] = [];
  // 1. sign in by mail link
  must(await api('/api/auth/login', json('POST', { email: EMAIL })), [200], 'login');
  const loginMail = await waitMail((m) => /token=/.test(m.text), 'login link');
  const token = loginMail.text.match(/token=([A-Za-z0-9_-]+)/)![1];
  const cb = await api('/api/auth/callback', {
    method: 'POST', headers: { origin: APP, 'content-type': 'application/x-www-form-urlencoded' }, body: `token=${token}`,
  });
  if (cb.status !== 303 || !cookie.startsWith('so_user=')) throw new Error(`callback: ${cb.status}`);
  log('giriş tamam');

  // pages are bought through iyzico; here the account is credited directly
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`update users set page_balance = 40 where email = ${EMAIL}`;
  const balance0 = must(await api('/api/me'), [200], 'me').pageBalance;

  // 2. the exam, the key, the 30 pages, the roster
  const job = must(await api('/api/jobs', json('POST', { title: '9-B Karma Yazılı', mode: 'klasik', klasikMax: [20, 15, 15, 10, 20, 20] })), [201], 'create');
  const upload = async (file: string, kind: 'key' | 'student') => {
    const form = new FormData();
    form.set('kind', kind);
    form.set('file', new Blob([await fs.readFile(file)], { type: 'image/png' }), path.basename(file));
    return must(await api(`/api/jobs/${job.id}/pages`, { method: 'POST', body: form }), [201], `upload ${file}`);
  };
  await upload(path.join(PHOTOS, 'anahtar.png'), 'key');
  const folders = (await fs.readdir(PHOTOS)).filter((f) => /^s\d\d-/.test(f)).sort();
  for (const f of folders) for (const side of ['on', 'arka']) await upload(path.join(PHOTOS, f, `${side}.png`), 'student');
  log(`yüklendi: 1 anahtar + ${folders.length * 2} sayfa`);
  must(await api(`/api/jobs/${job.id}/roster`, json('PUT', { roster: STUDENTS.join('\n') })), [200], 'roster');
  must(await api(`/api/jobs/${job.id}/submit`, json('POST', { consent: true })), [202], 'submit');
  const afterSubmit = must(await api('/api/me'), [200], 'me').pageBalance;
  log(`gönderildi; sayfa hakkı ${balance0} → ${afterSubmit}`);

  // 3. the rubric drafted from the key photo; the teacher sets their own and approves
  await waitStatus(job.id, ['rubric'], 15 * 60_000);
  const draft = must(await api(`/api/jobs/${job.id}/rubric`), [200], 'rubric');
  await fs.writeFile(path.join(MAIL_DIR, 'ai-rubric-draft.json'), JSON.stringify(draft.rubric, null, 2));
  log(`AI rubrik taslağı: ${draft.rubric.questions.length} soru, ölçüt sayıları ${draft.rubric.questions.map((q: any) => q.criteria.length).join(',')}`);
  if (draft.rubric.questions.length !== 6) problems.push(`rubrik taslağında ${draft.rubric.questions.length} soru var (6 olmalı)`);
  const teacherRubric = { questions: set.rubric.questions.map(({ rev, ...q }: any) => q) };
  must(await api(`/api/jobs/${job.id}/rubric`, json('PUT', teacherRubric)), [200], 'rubric save');
  must(await api(`/api/jobs/${job.id}/rubric/approve`, { method: 'POST' }), [200, 202], 'rubric approve');
  log('rubrik onaylandı');

  // 4. grading, then the review screen against the planned points
  await waitStatus(job.id, ['review'], 20 * 60_000);
  const review = must(await api(`/api/jobs/${job.id}/review`), [200], 'review');
  let exact = 0, close = 0, n = 0;
  const lines: string[] = [];
  for (const [i, name] of STUDENTS.entries()) {
    const sid = `s${String(i + 1).padStart(2, '0')}`;
    const sheet = review.sheets.find((s: any) => s.student === name);
    if (!sheet) { problems.push(`${name}: kontrol ekranında yok (isimler: ${review.sheets.map((s: any) => s.student).join(', ')})`); continue; }
    const expected = set.cases.filter((c) => c.id.startsWith(`${sid}-`));
    const total = expected.reduce((a, c) => a + c.teacher, 0);
    for (const c of expected) {
      const q = sheet.questions.find((x: any) => x.q === c.q);
      n++;
      const d = Math.abs((q?.points ?? 0) - c.teacher);
      if (d === 0) exact++;
      if (d <= 0.1 * (q?.max ?? 1)) close++;
      else lines.push(`  ${sid}-q${c.q}: beklenen ${c.teacher}, sistem ${q?.points} ${q?.notes?.filter((x: any) => x.attention).map((x: any) => x.text).join('; ') || '(uyarısız)'}`);
    }
    if (sheet.seqs.length !== 2) problems.push(`${name}: ${sheet.seqs.length} sayfa birleşti (2 olmalı)`);
    log(`${name.padEnd(14)} beklenen ${String(total).padStart(5)} · sistem ${String(sheet.total).padStart(5)} · kontrol ${sheet.attention}`);
  }
  log(`puanlar: ${exact}/${n} birebir, ${close}/${n} ±%10`);
  lines.forEach((l) => console.log(l));
  if (review.failed?.length) problems.push(`okunamayan sayfa: ${JSON.stringify(review.failed)}`);

  // 5. approve, and read the report out of the mail
  must(await api(`/api/jobs/${job.id}/approve`, { method: 'POST' }), [202], 'approve');
  const report = await waitMail((m) => /sonuçları/.test(m.subject), 'report', 5 * 60_000);
  log(`rapor e-postası: "${report.subject}" ekler: ${report.attachments.join(', ')}`);
  const xlsx = report.attachments.find((a: string) => a.endsWith('.xlsx'));
  if (!xlsx || !report.attachments.some((a: string) => a.endsWith('.pdf'))) problems.push('raporda Excel ya da PDF eki yok');
  else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(MAIL_DIR, `${report.id}-${xlsx}`));
    const ws = wb.worksheets[0];
    const rows: string[] = [];
    ws.eachRow((r, i) => { if (i > 1) rows.push(String(r.getCell(1).value)); });
    log(`Excel: ${wb.worksheets.map((w) => w.name).join(', ')} · ${rows.length} öğrenci satırı`);
    if (rows.length !== 15) problems.push(`Excel'de ${rows.length} öğrenci var (15 olmalı)`);
  }
  const finalJob = must(await api(`/api/jobs/${job.id}`), [200], 'job');
  const balance1 = must(await api('/api/me'), [200], 'me').pageBalance;
  log(`son durum: ${finalJob.status} · sayfa hakkı ${balance1}`);
  if (finalJob.status !== 'done') problems.push(`iş durumu ${finalJob.status} (done olmalı)`);
  const [{ n: photos }] = await sql`select count(*)::int as n from pages where job_id = ${job.id} and file_path is not null`;
  if (photos) problems.push(`${photos} fotoğraf silinmedi`);
  await sql.end();

  console.log(problems.length ? `\nSORUNLAR:\n- ${problems.join('\n- ')}` : '\nAkış sorunsuz tamamlandı.');
}

main().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
