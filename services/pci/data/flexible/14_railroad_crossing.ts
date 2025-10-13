import { Severity } from '../../../../types';

const RAILROAD_CROSSING_LOW = [ { x: 1, y: 8 }, { x: 2, y: 9 } ].sort((a, b) => a.x - b.x);
const RAILROAD_CROSSING_MEDIUM = [ { x: 1, y: 18 }, { x: 2, y: 20 } ].sort((a, b) => a.x - b.x);
const RAILROAD_CROSSING_HIGH = [ { x: 1, y: 38 }, { x: 2, y: 40 } ].sort((a, b) => a.x - b.x);

export const railroadCrossingCurves = {
  [Severity.LOW]: RAILROAD_CROSSING_LOW,
  [Severity.MEDIUM]: RAILROAD_CROSSING_MEDIUM,
  [Severity.HIGH]: RAILROAD_CROSSING_HIGH,
};