import type { AgentRun } from '../../types';

/** Funciones puras que leen la respuesta del agente; las usan el informe en pantalla y el PDF. La web no recalcula cifras. */

export const fmtMoney = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ');
export const fmtInt = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(Number(n)) ? '—' : Math.round(Number(n)).toLocaleString('en-US').replace(/,/g, ' ');
export const fmtPci = (n: number | null | undefined): string => (n == null || !Number.isFinite(Number(n)) ? '—' : Number(n).toFixed(1));

export const LEVEL_FRANJA_COLOR: Record<string, string> = { A: '#2e7d32', B: '#a35f00', C: '#b3261e' };
export const levelColor = (levelId: string): string => LEVEL_FRANJA_COLOR[(levelId || 'C')[0]] ?? '#555555';

export const ESTADO_COLOR: Record<string, string> = { financiado: '#0f7c7c', solo_seguridad: '#a35f00', diferido: '#b3261e', sin_presupuesto: '#666666' };

export interface ReportData { analysis: any; narrative: any; run: AgentRun }

export const reportData = (run: AgentRun): ReportData => ({ analysis: run.analysis as any, narrative: run.narrative as any, run });

/** Tramos en el orden de ejecución que decidió el agente (los que no figuran, al final). */
export function orderedSections(analysis: any): any[] {
  const list: any[] = analysis?.tramos ?? [];
  const order: string[] = analysis?.red?.orden_ejecucion ?? [];
  const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id));
}

export const narrativeFor = (narrative: any, sectionId: string): Record<string, any> =>
  (narrative?.tramos ?? []).find((n: any) => n.tramo_id === sectionId) ?? {};

export interface FlatAlert { level: 'critica' | 'advertencia' | 'info'; text: string; sectionName?: string; code: string }
const LEVEL_RANK: Record<string, number> = { critica: 0, advertencia: 1, info: 2 };

/**
 * Alertas globales y por tramo; el texto sale de la narrativa por (código, tramo) y, si falta, del mensaje del agente.
 * Un mismo código puede repetirse en un tramo (p. ej. DATO_FALTANTE con tres datos supuestos): se empareja por orden de aparición.
 */
export function allAlerts(analysis: any, narrative: any): FlatAlert[] {
  const pool: any[] = narrative?.alertas ?? [];
  const seen = new Map<string, number>();
  const text = (code: string, sectionId: string | undefined, fallback: string) => {
    const key = `${code}|${sectionId ?? ''}`;
    const nth = seen.get(key) ?? 0;
    seen.set(key, nth + 1);
    return pool.filter(a => a.codigo === code && (a.tramo_id ?? undefined) === sectionId)[nth]?.texto ?? fallback;
  };
  const out: FlatAlert[] = [];
  (analysis?.alertas_globales ?? []).forEach((a: any) => out.push({ level: a.nivel, code: a.codigo, text: text(a.codigo, undefined, a.mensaje) }));
  (analysis?.tramos ?? []).forEach((s: any) => (s.alertas ?? []).forEach((a: any) =>
    out.push({ level: a.nivel, code: a.codigo, sectionName: s.nombre, text: text(a.codigo, s.id, a.mensaje) })));
  return out.sort((a, b) => (LEVEL_RANK[a.level] ?? 3) - (LEVEL_RANK[b.level] ?? 3));
}

export const solutionName = (section: any): string => section?.tratamiento?.nombre ?? section?.tratamiento?.nombre_ideal ?? '—';
export const solutionTag = (section: any): 'interim' | 'alternative' | null => {
  const t = section?.tratamiento;
  if (!t) return null;
  if (t.interino) return 'interim';
  if (t.seleccionado && t.ideal && t.seleccionado !== t.ideal) return 'alternative';
  return null;
};

/** Monto que se asigna a un tramo según su estado (total si financiado, solo seguridad si no). */
export const assigned = (section: any): number => {
  const estado = section?.prioridad?.estado;
  if (estado === 'financiado') return Number(section?.costos?.total ?? 0);
  if (estado === 'solo_seguridad') return Number(section?.prioridad?.costo_interino_si_diferido ?? 0);
  return 0;
};

export const areaByLevel = (analysis: any): { level: string; area: number; pct: number }[] => {
  const total = Number(analysis?.red?.area_total_m2 ?? 0) || 1;
  const map = new Map<string, number>();
  (analysis?.tramos ?? []).forEach((s: any) => map.set(s.nivel_id, (map.get(s.nivel_id) ?? 0) + Number(s.area_m2 ?? 0)));
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([level, area]) => ({ level, area, pct: (area / total) * 100 }));
};

export const reportCode = (analysis: any): string => String(analysis?.proyecto?.huella_entrada ?? '').slice(0, 8).toUpperCase();

export const uniqueReferences = (analysis: any): string[] =>
  Array.from(new Set((analysis?.tramos ?? []).flatMap((s: any) => s.referencias ?? [])));

export const BIBLIOGRAPHY = [
  'ASTM D6433-24. Standard Practice for Roads and Parking Lots Pavement Condition Index Surveys.',
  'MOP. Manual de Mantenimiento Vial MS-16, 4.ª ed. (2009). Panamá.',
  'MOP. Manual de Diseño de Sobrecapas MS-17. Panamá.',
];

// --- Anexos ---

/** Un supuesto puede venir como texto o como objeto con el texto en `texto` o `mensaje`. */
export const assumptionText = (a: unknown): string =>
  typeof a === 'string' ? a : String((a as any)?.texto ?? (a as any)?.mensaje ?? (a as any)?.descripcion ?? JSON.stringify(a));

export interface ParamRow { key: string; sub: string; value: string; origin: string }

/** Parámetros usados por el agente, aplanados a filas (clave, subclave, valor, origen). */
export function paramRows(analysis: any): ParamRow[] {
  const params = analysis?.calibracion_usada?.parametros ?? {};
  const rows: ParamRow[] = [];
  Object.entries(params).forEach(([key, v]: [string, any]) => {
    if (key.startsWith('_')) return;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const origin = String(v.origen ?? '');
      const entries = Object.entries(v).filter(([k]) => !['origen', 'fuente', 'nota'].includes(k) && !k.endsWith('_min') && !k.endsWith('_max'));
      entries.forEach(([sub, val]) => rows.push({ key, sub: entries.length === 1 && sub === 'valor' ? '' : sub, value: typeof val === 'object' ? JSON.stringify(val) : String(val), origin }));
    } else rows.push({ key, sub: '', value: String(v), origin: '' });
  });
  return rows;
}

// --- Comparación entre consultas ---

export interface RunComparison {
  deltas: { key: 'pciAfter' | 'needed' | 'financed' | 'shortfall' | 'unassigned'; value: number; better: boolean | null }[];
  changed: { name: string; from: string; to: string }[];
}

const stateOf = (s: any) => `${solutionName(s)}${s?.prioridad?.estado ? ` · ${s.prioridad.estado}` : ''}`;

/** Función pura: diferencias de la red y tramos cuya solución o estado cambió entre dos consultas. */
export function compareRuns(newer: AgentRun, older: AgentRun): RunComparison {
  const a = (newer.analysis as any)?.red ?? {};
  const b = (older.analysis as any)?.red ?? {};
  const spec: [RunComparison['deltas'][number]['key'], string, boolean][] = [
    ['pciAfter', 'pci_ponderado_despues', true], ['needed', 'costo_total_necesario', false], ['financed', 'costo_financiado', true],
    ['shortfall', 'faltante', false], ['unassigned', 'saldo_sin_asignar', false],
  ];
  const deltas = spec.flatMap(([key, field, higherIsBetter]) => {
    if (a[field] == null || b[field] == null) return [];
    const value = Number(a[field]) - Number(b[field]);
    return [{ key, value, better: Math.abs(value) < 0.005 || key === 'needed' || key === 'unassigned' ? null : higherIsBetter ? value > 0 : value < 0 }];
  });
  const olderById = new Map<string, any>(((older.analysis as any)?.tramos ?? []).map((s: any) => [s.id, s]));
  const changed = ((newer.analysis as any)?.tramos ?? []).flatMap((s: any) => {
    const prev = olderById.get(s.id);
    if (!prev) return [];
    const from = stateOf(prev), to = stateOf(s);
    return from === to ? [] : [{ name: s.nombre, from, to }];
  });
  return { deltas, changed };
}
