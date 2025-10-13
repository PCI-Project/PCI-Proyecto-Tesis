import { Severity } from '../../../../types';

const POLISHED_AGGREGATE_MEDIUM = [ { x: 0.1, y: 5 }, { x: 100, y: 5 } ].sort((a, b) => a.x - b.x);

export const polishedAggregateCurves = {
  [Severity.MEDIUM]: POLISHED_AGGREGATE_MEDIUM,
};