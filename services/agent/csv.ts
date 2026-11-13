import { TREATMENTS, TREATMENT_BY_ID } from './catalogUi';

export type CsvRowStatus = 'ok' | 'unknown' | 'unit' | 'invalid';

export interface CsvRow {
  line: number;
  id: string;
  valor: number | null;
  unidad: string;
  fuente: string;
  status: CsvRowStatus;
}

export interface CsvParseResult {
  rows: CsvRow[];
  error?: 'empty' | 'header';
}

const normalizeUnit = (u: string) => u.trim().toLowerCase().replace('²', '2').replace(/\s/g, '');

function splitLine(line: string, sep: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map(c => c.trim());
}

/** Lee un CSV de costos (id,valor,unidad,fuente). Separador coma o punto y coma; decimales con punto o coma; UTF-8. */
export function parseCostCsv(text: string): CsvParseResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { rows: [], error: 'empty' };
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const header = splitLine(lines[0], sep).map(h => h.toLowerCase());
  const iId = header.indexOf('id');
  const iValue = header.indexOf('valor');
  if (iId < 0 || iValue < 0) return { rows: [], error: 'header' };
  const iUnit = header.indexOf('unidad');
  const iSource = header.indexOf('fuente');

  const rows: CsvRow[] = lines.slice(1).map((line, index) => {
    const cells = splitLine(line, sep);
    const id = (cells[iId] || '').trim();
    const rawValue = (cells[iValue] || '').trim();
    const valor = rawValue === '' ? null : Number(sep === ';' || !rawValue.includes('.') ? rawValue.replace(',', '.') : rawValue);
    const unidad = iUnit >= 0 ? (cells[iUnit] || '').trim() : '';
    const fuente = iSource >= 0 ? (cells[iSource] || '').trim() : '';
    const info = TREATMENT_BY_ID[id];
    let status: CsvRowStatus = 'ok';
    if (!info) status = 'unknown';
    else if (valor === null || !Number.isFinite(valor) || valor < 0) status = 'invalid';
    else if (unidad && normalizeUnit(unidad) !== info.unit) status = 'unit';
    return { line: index + 2, id, valor: valor !== null && Number.isFinite(valor) ? valor : null, unidad, fuente, status };
  });
  return { rows };
}

export function costTemplateCsv(): string {
  const lines = ['id,valor,unidad,fuente'];
  TREATMENTS.forEach(t => lines.push(`${t.id},${t.exampleCost.toFixed(2)},${t.unit},`));
  return lines.join('\r\n') + '\r\n';
}
