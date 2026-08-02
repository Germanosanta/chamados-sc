/** Portado de exportarCSV()/exportEncerradosCSV()/exportAuditCSV()
 * (relatorios/index.js) — mesmo formato (BOM UTF-8 + vírgula), gerado
 * client-side, sem lib externa. */
export function downloadCSV(filename: string, rows: (string | number)[][]): void {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
