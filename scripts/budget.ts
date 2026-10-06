import fs from 'node:fs';
import type { Reader, Usage } from '@/lib/reader/types';

// A spending guard for measurement scripts run on a prepaid key. Every call's
// real token usage is priced (PRICE_IN_PER_M / PRICE_OUT_PER_M, USD per 1M
// tokens) and added to a ledger file shared by all scripts, so separate runs
// add up. Once the ledger reaches BUDGET_USD no new call is made.

const LEDGER = process.env.BUDGET_LEDGER || 'eval/data/spend.json';

type Ledger = { usd: number; calls: number; inputTokens: number; outputTokens: number };
const load = (): Ledger => {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { usd: 0, calls: 0, inputTokens: 0, outputTokens: 0 }; }
};

export class BudgetExceeded extends Error {}

export function withBudget(reader: Reader): Reader {
  const inPerM = Number(process.env.PRICE_IN_PER_M);
  const outPerM = Number(process.env.PRICE_OUT_PER_M);
  const max = Number(process.env.BUDGET_USD);
  if (!(inPerM > 0 && outPerM > 0 && max > 0)) return reader; // no budget set: unguarded
  const charge = (u: Usage) => {
    const l = load();
    l.calls++;
    l.inputTokens += u.inputTokens;
    l.outputTokens += u.outputTokens;
    l.usd += (u.inputTokens * inPerM + u.outputTokens * outPerM) / 1e6;
    fs.writeFileSync(LEDGER, JSON.stringify(l, null, 2));
  };
  const guard = <A extends unknown[], R extends { usage: Usage }>(fn: (...a: A) => Promise<R>) => async (...a: A): Promise<R> => {
    const spent = load().usd;
    if (spent >= max) throw new BudgetExceeded(`budget reached: $${spent.toFixed(2)} of $${max}`);
    const out = await fn(...a);
    charge(out.usage);
    return out;
  };
  return {
    readKey: guard(reader.readKey), readStudent: guard(reader.readStudent), readKlasik: guard(reader.readKlasik),
    draftRubric: guard(reader.draftRubric), gradeKlasik: guard(reader.gradeKlasik),
  };
}

export const spent = () => load();
