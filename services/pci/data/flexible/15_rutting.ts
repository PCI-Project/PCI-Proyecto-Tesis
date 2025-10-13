import { Severity } from '../../../../types';

const RUTTING_LOW = [ { x: 0.2, y: 4 }, { x: 0.4, y: 5.5 }, { x: 0.8, y: 8 }, { x: 1.5, y: 11 }, { x: 3, y: 15 }, { x: 5.5, y: 20 }, { x: 10, y: 26 }, { x: 20, y: 34 }, { x: 40, y: 44 }, { x: 60, y: 52 }, { x: 80, y: 58 }, { x: 100, y: 62 } ].sort((a, b) => a.x - b.x);
const RUTTING_MEDIUM = [ { x: 0.2, y: 7 }, { x: 0.4, y: 9 }, { x: 0.8, y: 12 }, { x: 1.5, y: 16 }, { x: 3, y: 21 }, { x: 5.5, y: 27 }, { x: 10, y: 34 }, { x: 20, y: 43 }, { x: 40, y: 54 }, { x: 60, y: 62 }, { x: 80, y: 68 }, { x: 100, y: 72 } ].sort((a, b) => a.x - b.x);
const RUTTING_HIGH = [ { x: 0.2, y: 12 }, { x: 0.4, y: 15 }, { x: 0.8, y: 19 }, { x: 1.5, y: 24 }, { x: 3, y: 30 }, { x: 5.5, y: 37 }, { x: 10, y: 45 }, { x: 20, y: 55 }, { x: 40, y: 66 }, { x: 60, y: 74 }, { x: 80, y: 80 }, { x: 100, y: 85 } ].sort((a, b) => a.x - b.x);

export const ruttingCurves = {
  [Severity.LOW]: RUTTING_LOW,
  [Severity.MEDIUM]: RUTTING_MEDIUM,
  [Severity.HIGH]: RUTTING_HIGH,
};