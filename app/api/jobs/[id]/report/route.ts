import { buildReportInput } from '@/lib/report/input';
import { buildWorkbook } from '@/lib/report/excel';
import { buildSummaryPdf } from '@/lib/report/pdf';
import { safeName } from '@/lib/report/common';
import { RESULT_STATUSES } from '@/lib/jobs/results';
import { withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The report files the e-mail carries, downloadable from the panel; while the
// exam waits for the teacher's check they show the points as they stand.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pdf = new URL(req.url).searchParams.get('format') === 'pdf';
  return withOwnedJob(id, async (db, job) => {
    if (!RESULT_STATUSES.has(job.status)) return Response.json({ error: 'Rapor, kâğıtlar okunduktan sonra hazır olur.' }, { status: 409 });
    const input = await buildReportInput(db, job.id);
    const body = pdf ? await buildSummaryPdf(input) : await buildWorkbook(input);
    const name = `${safeName(job.title)}${pdf ? '-ozet.pdf' : '.xlsx'}`;
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sinav${pdf ? '.pdf' : '.xlsx'}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
