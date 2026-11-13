import type { AgentConfig } from '../../types';
import { catalog } from './catalog';
const key = 'asphalt-pci-mapa.agent-defaults.v1';
type Defaults = Pick<AgentConfig, 'availableTreatments' | 'unitCosts' | 'priorityMode' | 'contingencyPct'>;
export function readDefaults(userId: string): Defaults | undefined {
  try { return JSON.parse(localStorage.getItem(key) || '{}')[userId]; } catch { return undefined; }
}
export function writeDefaults(userId: string, config: AgentConfig): boolean {
  try {
    const all = JSON.parse(localStorage.getItem(key) || '{}');
    all[userId] = { availableTreatments: config.availableTreatments, unitCosts: config.unitCosts, priorityMode: config.priorityMode, contingencyPct: config.contingencyPct };
    localStorage.setItem(key, JSON.stringify(all)); return true;
  } catch { return false; }
}
export function initialConfig(userId: string): AgentConfig {
  const saved = readDefaults(userId);
  return { availableTreatments: Object.keys(catalog.treatments).filter(id => id !== 'monitoreo'), unitCosts: {}, priorityMode: 'costo_beneficio', contingencyPct: 10, ...saved, currency: 'USD', budget: null, updatedAt: new Date().toISOString() };
}
