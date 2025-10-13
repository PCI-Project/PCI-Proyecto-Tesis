import { Severity } from '../../../../types';

const SWELL_LOW = [ { x: 0.2, y: 5 }, { x: 0.4, y: 8 }, { x: 0.7, y: 11 }, { x: 1.2, y: 15 }, { x: 2, y: 19 }, { x: 3.5, y: 24 }, { x: 6, y: 29 }, { x: 10, y: 35 }, { x: 18, y: 42 }, { x: 30, y: 50 } ].sort((a, b) => a.x - b.x);
const SWELL_MEDIUM = [ { x: 0.2, y: 9 }, { x: 0.4, y: 12 }, { x: 0.7, y: 16 }, { x: 1.2, y: 20 }, { x: 2, y: 25 }, { x: 3.5, y: 31 }, { x: 6, y: 38 }, { x: 10, y: 45 }, { x: 18, y: 53 }, { x: 30, y: 62 } ].sort((a, b) => a.x - b.x);
const SWELL_HIGH = [ { x: 0.2, y: 14 }, { x: 0.4, y: 18 }, { x: 0.7, y: 22 }, { x: 1.2, y: 27 }, { x: 2, y: 32 }, { x: 3.5, y: 38 }, { x: 6, y: 45 }, { x: 10, y: 53 }, { x: 18, y: 62 }, { x: 30, y: 71 } ].sort((a, b) => a.x - b.x);

export const swellCurves = {
  [Severity.LOW]: SWELL_LOW,
  [Severity.MEDIUM]: SWELL_MEDIUM,
  [Severity.HIGH]: SWELL_HIGH,
};