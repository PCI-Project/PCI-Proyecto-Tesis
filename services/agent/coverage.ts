import type { Sample } from '../../types';

/**
 * C2: una unidad del plan de muestreo está evaluada si el inspector registró al menos una falla
 * o la marcó expresamente como evaluada sin fallas (`evaluated`). Una unidad vacía sin marca está pendiente.
 */
export const isSampleEvaluated = (sample: Sample): boolean => sample.evaluated === true || sample.distresses.length > 0;
