import { Severity } from '../../../../types';

const WEATHERING_LOW = [ { x: 0.2, y: 4 }, { x: 0.4, y: 5 }, { x: 0.7, y: 7 }, { x: 1.2, y: 9 }, { x: 2, y: 11 }, { x: 3.5, y: 14 }, { x: 6, y: 18 }, { x: 10, y: 22 }, { x: 18, y: 27 }, { x: 30, y: 33 }, { x: 50, y: 40 }, { x: 80, y: 47 } ].sort((a, b) => a.x - b.x);
const WEATHERING_MEDIUM = [ { x: 0.2, y: 6 }, { x: 0.4, y: 8 }, { x: 0.7, y: 10 }, { x: 1.2, y: 13 }, { x: 2, y: 16 }, { x: 3.5, y: 20 }, { x: 6, y: 25 }, { x: 10, y: 31 }, { x: 18, y: 38 }, { x: 30, y: 46 }, { x: 50, y: 55 }, { x: 80, y: 64 } ].sort((a, b) => a.x - b.x);
const WEATHERING_HIGH = [ { x: 0.2, y: 11 }, { x: 0.4, y: 13 }, { x: 0.7, y: 16 }, { x: 1.2, y: 20 }, { x: 2, y: 24 }, { x: 3.5, y: 29 }, { x: 6, y: 35 }, { x: 10, y: 42 }, { x: 18, y: 50 }, { x: 30, y: 59 }, { x: 50, y: 69 }, { x: 80, y: 79 } ].sort((a, b) => a.x - b.x);

export const weatheringCurves = {
  [Severity.LOW]: WEATHERING_LOW,
  [Severity.MEDIUM]: WEATHERING_MEDIUM,
  [Severity.HIGH]: WEATHERING_HIGH,
};