import type { AgentConfig, Project } from '../../types';
import { PavementType } from '../../types';
import { validThresholds } from './levels';
import { invalidParams } from './params';
import { pendingUnitIds, totalUnitsOf } from './coverage';
export interface AgentIssue { block: 1 | 2 | 3 | 4 | 5; key: string; sectionId?: string; sampleId?: number; done?: number; total?: number; }
export function validateAgentInput(project: Project, config: AgentConfig): AgentIssue[] {
  const issues: AgentIssue[] = [];
  if (!project.sections.length) issues.push({ block: 1, key: 'noSections' });
  for (const section of project.sections) {
    if (section.pci == null || !Number.isFinite(section.pci)) issues.push({ block: 1, key: 'missingPci', sectionId: section.id });
    if (section.pavementType !== PavementType.FLEXIBLE) issues.push({ block: 1, key: 'pavement', sectionId: section.id });
    if (!section.samples.length) issues.push({ block: 1, key: 'missingSamples', sectionId: section.id });
    // Regla C2: recomendaciones solo con el 100 % de las unidades de muestra del tramo evaluadas. Un muestreo mínimo
    // (parte de las unidades) sirve para el PCI, pero no para extrapolar cantidades, costos por área ni costos unitarios.
    const total = totalUnitsOf(section);
    const pending = pendingUnitIds(section).length;
    if (pending) issues.push({ block: 1, key: 'incompleteCoverage', sectionId: section.id, done: total - pending, total });
    section.samples.filter(s => !(s.area > 0)).forEach(s => issues.push({ block: 1, key: 'sampleArea', sectionId: section.id, sampleId: s.id }));
  }
  if (!config.availableTreatments.length) issues.push({ block: 3, key: 'noEquipment' });
  const diagnostic = config.analysisMode === 'diagnostico'; // C1: sin costos, presupuesto ni imprevistos
  if (!diagnostic && Object.values(config.unitCosts).some(c => !Number.isFinite(c.valor) || c.valor < 0)) issues.push({ block: 4, key: 'invalidCost' });
  if (!diagnostic && config.budget !== null && (!Number.isFinite(config.budget) || config.budget <= 0)) issues.push({ block: 5, key: 'invalidBudget' });
  if (!diagnostic && (!Number.isFinite(config.contingencyPct) || config.contingencyPct < 0 || config.contingencyPct > 30)) issues.push({ block: 5, key: 'invalidContingency' });
  if (!validThresholds(config.pciThresholds)) issues.push({ block: 5, key: 'invalidThresholds' });
  if (invalidParams(config).length) issues.push({ block: 5, key: 'invalidParams' });
  return issues;
}
