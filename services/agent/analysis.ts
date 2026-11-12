import type { AgentConfig, Project, Section, SectionContext } from '../../types';
import { defaultThresholds, levelForPci, type Level } from './levels';
import { emptyContext } from './buildAgentInput';
import { interimsForLevel, optionsForLevel, TREATMENTS } from './catalogUi';
import { validateAgentInput, type AgentIssue } from './validation';

export type BlockStatus = 'ok' | 'warn' | 'error';

export interface BlockInfo {
  status: BlockStatus;
  summaryKey: string;
  params: Record<string, string | number>;
  extraKey?: string;
  extraParams?: Record<string, string | number>;
  changed?: boolean;
}

export interface SectionEffect {
  sectionId: string;
  name: string;
  level: Level;
  satisfied: boolean;
  options: string[];
  interim: string | null;
}

export type AssumptionKey = 'roadType' | 'curb' | 'traffic';

export const ctxOf = (section: Section, contexts: Record<string, SectionContext | null>): SectionContext =>
  contexts[section.id] ?? section.context ?? emptyContext();

/** Datos opcionales vacíos que el agente va a suponer (nunca bloquean). */
export function sectionAssumptions(ctx: SectionContext): AssumptionKey[] {
  const list: AssumptionKey[] = [];
  if (ctx.roadType === null) list.push('roadType');
  if (ctx.roadType !== 'rural' && ctx.curbHeightCm === null) list.push('curb');
  const hasTraffic = ctx.trafficInput === 'esal' ? ctx.esalMillions !== null : ctx.trafficClass !== null;
  if (!hasTraffic) list.push('traffic');
  return list;
}

export const countAssumptions = (project: Project, contexts: Record<string, SectionContext | null>): number =>
  project.sections.reduce((sum, s) => sum + sectionAssumptions(ctxOf(s, contexts)).length, 0);

export function equipmentEffects(project: Project, config: AgentConfig, contexts: Record<string, SectionContext | null>): SectionEffect[] {
  const available = new Set(config.availableTreatments);
  return project.sections
    .filter(s => s.pci != null)
    .map(section => {
      const level = levelForPci(section.pci as number, config.pciThresholds);
      const options = optionsForLevel(level, ctxOf(section, contexts));
      const satisfied = options.some(id => available.has(id));
      const interim = satisfied ? null : interimsForLevel(level).find(id => available.has(id)) ?? null;
      return { sectionId: section.id, name: section.name, level, satisfied, options, interim };
    });
}

export function costRows(config: AgentConfig) {
  const available = new Set(config.availableTreatments);
  return TREATMENTS.filter(t => t.group === 'palliative' || available.has(t.id));
}

export const countExampleCosts = (config: AgentConfig) => {
  const rows = costRows(config);
  const own = rows.filter(r => config.unitCosts[r.id] !== undefined).length;
  return { total: rows.length, example: rows.length - own, own };
};

const inRange = (v: number | null, min: number, max: number) => v === null || (Number.isFinite(v) && v >= min && v <= max);

/** Valores que el agente rechazaría (422) si se mandaran: bloquean en el bloque 2. */
export function invalidContextFields(ctx: SectionContext): string[] {
  const year = new Date().getFullYear();
  const bad: string[] = [];
  if (!inRange(ctx.curbHeightCm, 0, 40)) bad.push('curb');
  if (!inRange(ctx.esalMillions, 0, 200)) bad.push('esal');
  if (!inRange(ctx.aadt, 0, 1e7)) bad.push('aadt');
  if (!inRange(ctx.yearBuilt, 1950, year) || (ctx.yearBuilt !== null && !Number.isInteger(ctx.yearBuilt))) bad.push('yearBuilt');
  if (ctx.lastInterventionYear !== null && (!Number.isInteger(ctx.lastInterventionYear) || ctx.lastInterventionYear > year || (ctx.yearBuilt !== null && ctx.lastInterventionYear < ctx.yearBuilt))) bad.push('lastInterventionYear');
  if (ctx.notes !== null && ctx.notes.length > 500) bad.push('notes');
  return bad;
}

export function contextIssues(project: Project, contexts: Record<string, SectionContext | null>): AgentIssue[] {
  return project.sections.flatMap(section =>
    invalidContextFields(ctxOf(section, contexts)).map(key => ({ block: 2 as const, key: `ctx_${key}`, sectionId: section.id })),
  );
}

export const levelOfSection =(section: Section, config: AgentConfig): Level | null =>
  section.pci == null ? null : levelForPci(section.pci, config.pciThresholds);

export const thresholdsOf = (config: AgentConfig) => ({ ...defaultThresholds, ...config.pciThresholds });

export function computeBlocks(
  project: Project,
  config: AgentConfig,
  contexts: Record<string, SectionContext | null>,
  issues: AgentIssue[] = validateAgentInput(project, config),
): BlockInfo[] {
  const has = (n: number) => issues.some(i => i.block === n);
  const samples = project.sections.reduce((n, s) => n + s.samples.length, 0);
  const distresses = project.sections.reduce((n, s) => n + s.samples.reduce((m, smp) => m + smp.distresses.length, 0), 0);
  const insufficient = project.sections.filter(s => s.samplesSufficient === false).length;
  const b1: BlockInfo = {
    status: has(1) ? 'error' : insufficient ? 'warn' : 'ok',
    summaryKey: 'agent.summary.b1',
    params: { sections: project.sections.length, samples, distresses, pci: (project.weightedPCI ?? 0).toFixed(1) },
  };

  const incomplete = project.sections.filter(s => sectionAssumptions(ctxOf(s, contexts)).length > 0).length;
  const b2: BlockInfo = has(2)
    ? { status: 'error', summaryKey: 'agent.summary.b2Invalid', params: {} }
    : incomplete
      ? { status: 'warn', summaryKey: 'agent.summary.b2Some', params: { n: incomplete, total: project.sections.length } }
      : { status: 'ok', summaryKey: 'agent.summary.b2None', params: {} };

  const effects = equipmentEffects(project, config, contexts);
  const noOption = effects.filter(e => !e.satisfied).length;
  const b3: BlockInfo = {
    status: has(3) ? 'error' : noOption ? 'warn' : 'ok',
    summaryKey: 'agent.summary.b3',
    params: { n: config.availableTreatments.length, total: TREATMENTS.length },
    ...(noOption ? { extraKey: 'agent.summary.b3Gap', extraParams: { n: noOption } } : {}),
  };

  const diagnostic = config.analysisMode === 'diagnostico';
  const costs = countExampleCosts(config);
  const b4: BlockInfo = diagnostic
    ? { status: 'ok', summaryKey: 'agent.summary.b4Off', params: {} }
    : {
      status: has(4) ? 'error' : costs.example > 0 ? 'warn' : 'ok',
      summaryKey: 'agent.summary.b4',
      params: { n: costs.example, total: costs.total, currency: config.currency },
    };

  const b5: BlockInfo = diagnostic ? { status: has(5) ? 'error' : 'ok', summaryKey: 'agent.summary.b5Diag', params: {} } : {
    status: has(5) ? 'error' : 'ok',
    summaryKey: config.budget === null ? 'agent.summary.b5NoCap' : 'agent.summary.b5',
    params: {
      budget: config.budget === null ? '' : Number.isFinite(config.budget) ? config.budget.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—',
      currency: config.currency,
      mode: config.priorityMode === 'costo_beneficio' ? 'agent.mode.bc' : 'agent.mode.worst',
      pct: Number.isFinite(config.contingencyPct) ? config.contingencyPct : '—',
    },
  };
  return [b1, b2, b3, b4, b5];
}
