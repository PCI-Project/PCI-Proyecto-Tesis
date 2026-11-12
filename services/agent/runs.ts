import type { AgentConfig, AgentRun, SectionContext } from '../../types';

export const MAX_RUNS = 5;

export interface RunSummary {
  pciBefore: number;
  pciAfter: number | null;
  needed: number;
  financed: number;
  shortfall: number;
  unassigned: number | null;
}

export function makeRun(args: {
  runs: AgentRun[];
  input: unknown;
  hash: string;
  config: AgentConfig;
  contexts: Record<string, SectionContext | null>;
  analysis: any;
  narrative: any;
  source: AgentRun['narrativeSource'];
  agentVersion: string;
}): AgentRun {
  const number = args.runs.reduce((max, r) => Math.max(max, r.number || 0), 0) + 1;
  return {
    id: `run-${Date.now().toString(36)}-${number}`,
    number,
    createdAt: new Date().toISOString(),
    inputHash: args.hash,
    config: args.config,
    contexts: args.contexts,
    input: args.input,
    analysis: args.analysis,
    narrative: args.narrative,
    narrativeSource: args.source,
    agentVersion: args.agentVersion,
    status: 'listo',
  };
}

/** El más nuevo primero, máximo MAX_RUNS. `dropped` indica si se borró la más antigua. */
export function pushRun(runs: AgentRun[], run: AgentRun): { runs: AgentRun[]; dropped: boolean } {
  const next = [run, ...runs];
  return { runs: next.slice(0, MAX_RUNS), dropped: next.length > MAX_RUNS };
}

export function runSummary(run: AgentRun): RunSummary | null {
  const red = (run.analysis as any)?.red;
  if (!red) return null;
  return {
    pciBefore: Number(red.pci_ponderado),
    pciAfter: red.pci_ponderado_despues == null ? null : Number(red.pci_ponderado_despues),
    needed: Number(red.costo_total_necesario),
    financed: Number(red.costo_financiado),
    shortfall: Number(red.faltante),
    unassigned: red.saldo_sin_asignar == null ? null : Number(red.saldo_sin_asignar),
  };
}

/** Comprueba por su forma los dos archivos que deja `python -m agente todo`. Devuelve claves de error (vacío si todo bien). */
export function validateResultPair(analysis: any, narrative: any): string[] {
  const errors: string[] = [];
  for (const key of ['version', 'generado', 'proyecto', 'calibracion_usada', 'tramos', 'red', 'alertas_globales']) {
    if (analysis?.[key] === undefined) errors.push(`analisis.${key}`);
  }
  if (analysis?.proyecto && !analysis.proyecto.huella_entrada) errors.push('analisis.proyecto.huella_entrada');
  if (!narrative || typeof narrative !== 'object' || Array.isArray(narrative)) errors.push('narrativa');
  else if (narrative.resumen_ejecutivo === undefined) errors.push('narrativa.resumen_ejecutivo');
  return errors;
}

export const downloadText = (filename: string, text: string, mime = 'application/json') => {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
