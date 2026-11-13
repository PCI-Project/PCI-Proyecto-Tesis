import type { AgentConfig } from '../../types';
import { catalog } from './catalog';

/** Parámetros avanzados del agente (curva de deterioro y factores). Solo se guardan los que el usuario cambia. */

export interface ParamField {
  id: string;
  key: string;      // clave en catalogo/parametros_defecto.json
  sub: string;      // subclave dentro de esa clave ('valor', 'beta', 'L'...)
  group: 'curve' | 'factors';
  min: number;
  max: number;
  step: number;
  def: number;
  origin: 'norma' | 'supuesto';
}

const defaults = catalog.defaults as unknown as Record<string, any>;
const origin = (key: string): 'norma' | 'supuesto' => (defaults[key]?.origen === 'norma' ? 'norma' : 'supuesto');
const field = (id: string, key: string, sub: string, group: ParamField['group'], min: number, max: number, step: number): ParamField => ({
  id, key, sub, group, min, max, step, def: Number(defaults[key]?.[sub]), origin: origin(key),
});

export const PARAM_FIELDS: ParamField[] = [
  field('beta', 'curva_deterioro', 'beta', 'curve', 1, 3, 0.1),
  field('years', 'curva_deterioro', 'anios_hasta_pci_minimo', 'curve', 5, 40, 1),
  field('minPci', 'pci_minimo_aceptable', 'valor', 'curve', 20, 60, 1),
  field('potholeL', 'area_por_bache_m2', 'L', 'factors', 0.01, 5, 0.05),
  field('potholeM', 'area_por_bache_m2', 'M', 'factors', 0.01, 5, 0.05),
  field('potholeH', 'area_por_bache_m2', 'H', 'factors', 0.01, 5, 0.05),
  field('overwidth', 'sobreancho_parcheo', 'valor', 'factors', 1, 3, 0.05),
  field('crack', 'factor_grieta_bloque_m_por_m2', 'valor', 'factors', 0.1, 10, 0.05),
  field('structural', 'umbral_estructural_pct', 'valor', 'factors', 1, 100, 1),
];

type Params = Record<string, any>;

/** Valor cambiado por el usuario, o null si se usa el de defecto. */
export const paramOverride = (config: AgentConfig, f: ParamField): number | null => {
  const v = (config.parameters as Params | undefined)?.[f.key]?.[f.sub];
  return typeof v === 'number' ? v : null;
};

export const paramValid = (config: AgentConfig, f: ParamField): boolean => {
  const v = paramOverride(config, f);
  return v === null || (Number.isFinite(v) && v >= f.min && v <= f.max);
};

export const invalidParams = (config: AgentConfig): string[] => PARAM_FIELDS.filter(f => !paramValid(config, f)).map(f => f.id);

export const changedParams = (config: AgentConfig): number => PARAM_FIELDS.filter(f => paramOverride(config, f) !== null).length;

/** Devuelve el nuevo `parameters` con el valor aplicado; vacío o igual al defecto lo quita. */
export function setParam(config: AgentConfig, f: ParamField, raw: string): AgentConfig['parameters'] {
  const next: Params = { ...(config.parameters as Params | undefined) };
  const group: Params = { ...(next[f.key] ?? {}) };
  const value = raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(value) || value === f.def) delete group[f.sub];
  else group[f.sub] = value;
  if (Object.keys(group).length) next[f.key] = group;
  else delete next[f.key];
  return Object.keys(next).length ? next : undefined;
}
