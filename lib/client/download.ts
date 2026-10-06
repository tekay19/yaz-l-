// Files the admin screens hand to the browser.

export type CsvCell = string | number | null | undefined;

// Rows as CSV text. Visitor-supplied text must not run as a formula when the
// file is opened in Excel, so a string starting with = + - @ or a control
// character is prefixed with a quote.
export function toCsv(rows: CsvCell[][]): string {
  const cell = (c: CsvCell) => {
    let s = String(c ?? '');
    if (typeof c === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\n');
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// with a BOM, so Excel opens the Turkish letters as UTF-8
export const downloadCsv = (rows: CsvCell[][], name: string) =>
  downloadBlob(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }), name);
