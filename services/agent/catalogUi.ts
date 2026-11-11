import { catalog } from './catalog';
import type { SectionContext } from '../../types';
import type { Level } from './levels';

interface RawTreatment {
  tipo: string;
  nombre: string;
  nombre_en: string;
  nivel?: string | null;
  unidad: 'm2' | 'm' | 'global';
  equipo: string[];
}

const raw = catalog.treatments as unknown as Record<string, RawTreatment>;
const rawCosts = catalog.costs as unknown as Record<string, { valor: number; unidad: 'm2' | 'm' | 'global' }>;
const rawLevels = catalog.levels as unknown as Array<Record<string, any>>;

export type GroupId = 'palliative' | 'preventive' | 'minor' | 'major' | 'reconstruction';
export const GROUP_ORDER: GroupId[] = ['palliative', 'preventive', 'minor', 'major', 'reconstruction'];

export interface TreatmentInfo {
  id: string;
  name: string;
  nameEn: string;
  unit: 'm2' | 'm' | 'global';
  equipment: string[];
  group: GroupId;
  exampleCost: number;
}

const groupOf = (t: RawTreatment): GroupId => {
  if (t.tipo !== 'tratamiento') return 'palliative';
  const level = (t.nivel || '').toLowerCase();
  if (level.startsWith('mantenimiento')) return 'preventive';
  if (level.includes('menor')) return 'minor';
  if (level.includes('mayor')) return 'major';
  return 'reconstruction';
};

/** Catálogo para la interfaz, sin «monitoreo» (no requiere equipo). Sustituible por GET /api/recommendations/catalogo. */
export const TREATMENTS: TreatmentInfo[] = Object.entries(raw)
  .filter(([id]) => id !== 'monitoreo')
  .map(([id, t]) => ({
    id,
    name: t.nombre,
    nameEn: t.nombre_en,
    unit: t.unidad,
    equipment: t.equipo || [],
    group: groupOf(t),
    exampleCost: rawCosts[id]?.valor ?? 0,
  }));

export const TREATMENT_BY_ID: Record<string, TreatmentInfo> = Object.fromEntries(TREATMENTS.map(t => [t.id, t]));

export const treatmentName = (id: string, language: string): string => {
  const t = TREATMENT_BY_ID[id];
  if (!t) return id;
  return language === 'es' ? t.name : t.nameEn;
};

export const CURB_MIN_CM: number = (catalog.defaults as any).bordillo_min_cm.valor;

const levelDef = (level: Level) => rawLevels.find(l => l.id === level) ?? {};

/** Opciones del nivel según el contexto del tramo (bordillo, vía rural). Para A y C1 se usa la unión de las opciones. */
export function optionsForLevel(level: Level, ctx?: SectionContext | null): string[] {
  const def = levelDef(level);
  if (level === 'A1' || level === 'A2') {
    return ['sellado_grietas', ...TREATMENTS.filter(t => t.group === 'preventive').map(t => t.id)];
  }
  if (level === 'B1' || level === 'B2') {
    let key = 'opciones_bordillo_limitado';
    if (ctx?.roadType === 'rural') key = 'opciones_rural';
    else if (ctx?.roadType === 'urbana' && ctx.curbHeightCm != null && ctx.curbHeightCm >= CURB_MIN_CM) key = 'opciones_bordillo_suficiente';
    return (def[key] as string[]) ?? [];
  }
  if (level === 'C1') {
    return Array.from(new Set([...(def.opciones_estructura_recuperable ?? []), ...(def.opciones_estructura_perdida ?? [])]));
  }
  return (def.opciones as string[]) ?? [];
}

export const interimsForLevel = (level: Level): string[] =>
  ((levelDef(level).interinas as string[]) ?? []).filter(id => id !== 'monitoreo');

/** Atajos del bloque Equipo. */
export const ALL_TREATMENT_IDS = TREATMENTS.map(t => t.id);
export const BASIC_CREW_IDS = TREATMENTS.filter(t => t.group === 'palliative' || ['fog_seal', 'slurry_seal'].includes(t.id)).map(t => t.id);
