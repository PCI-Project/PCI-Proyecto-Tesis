import type { Sample, Section } from '../../types';

/**
 * C2: una unidad del plan de muestreo está evaluada si el inspector registró al menos una falla
 * o la marcó expresamente como evaluada sin fallas (`evaluated`). Una unidad vacía sin marca está pendiente.
 */
export const isSampleEvaluated = (sample: Sample): boolean => sample.evaluated === true || sample.distresses.length > 0;

/** Total de unidades de muestra que debe tener evaluadas un tramo para recibir recomendaciones. */
export const totalUnitsOf = (section: Section): number => Math.max(section.totalSampleUnits || 0, section.samples.length);

/** Unidades (1..N) sin evaluar: sin registrar, o registradas vacías y sin la marca de "evaluada sin fallas". */
export const pendingUnitIds = (section: Section): number[] => {
  const evaluated = new Set(section.samples.filter(isSampleEvaluated).map(sample => sample.id));
  const ids: number[] = [];
  for (let id = 1; id <= totalUnitsOf(section); id += 1) if (!evaluated.has(id)) ids.push(id);
  return ids;
};
