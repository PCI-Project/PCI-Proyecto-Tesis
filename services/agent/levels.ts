import type { AgentConfig } from '../../types';
export const defaultThresholds = { A1: 85, A2: 71, B1: 56, B2: 41, C1: 26 } as const;
export type Level = keyof typeof defaultThresholds | 'C2';
export function validThresholds(thresholds: AgentConfig['pciThresholds']): boolean {
  const t = { ...defaultThresholds, ...thresholds };
  const values = [100, t.A1, t.A2, t.B1, t.B2, t.C1, 0];
  return values.every(Number.isInteger) && values.slice(1).every((v, i) => v < values[i]);
}
export function levelForPci(pci: number, thresholds: AgentConfig['pciThresholds'] = {}): Level {
  const t = { ...defaultThresholds, ...thresholds };
  return (Object.keys(defaultThresholds) as Array<keyof typeof defaultThresholds>).find(k => pci >= t[k]) ?? 'C2';
}
