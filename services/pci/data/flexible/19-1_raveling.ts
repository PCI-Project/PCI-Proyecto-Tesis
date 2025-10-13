import { Severity } from '../../../../types';

const RAVELING_MEDIUM = [ { x: 0.2, y: 4 }, { x: 0.4, y: 6 }, { x: 0.7, y: 8 }, { x: 1.2, y: 11 }, { x: 2, y: 14 }, { x: 3.5, y: 18 }, { x: 6, y: 23 }, { x: 10, y: 29 }, { x: 18, y: 36 }, { x: 30, y: 44 }, { x: 50, y: 53 }, { x: 80, y: 62 } ].sort((a, b) => a.x - b.x);
const RAVELING_HIGH = [ { x: 0.2, y: 9 }, { x: 0.4, y: 12 }, { x: 0.7, y: 15 }, { x: 1.2, y: 19 }, { x: 2, y: 24 }, { x: 3.5, y: 30 }, { x: 6, y: 37 }, { x: 10, y: 44 }, { x: 18, y: 53 }, { x: 30, y: 63 }, { x: 50, y: 73 }, { x: 80, y: 83 } ].sort((a, b) => a.x - b.x);

export const ravelingCurves = {
  [Severity.MEDIUM]: RAVELING_MEDIUM,
  [Severity.HIGH]: RAVELING_HIGH,
};