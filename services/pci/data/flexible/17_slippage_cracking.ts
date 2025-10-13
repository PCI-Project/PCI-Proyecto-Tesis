import { Severity } from '../../../../types';

const SLIPPAGE_CRACKING_LOW = [ { x: 0.1, y: 3 }, { x: 100, y: 15 } ].sort((a, b) => a.x - b.x);
const SLIPPAGE_CRACKING_MEDIUM = [ { x: 0.1, y: 7 }, { x: 100, y: 25 } ].sort((a, b) => a.x - b.x);
const SLIPPAGE_CRACKING_HIGH = [ { x: 0.1, y: 12 }, { x: 100, y: 40 } ].sort((a, b) => a.x - b.x);

export const slippageCrackingCurves = {
  [Severity.LOW]: SLIPPAGE_CRACKING_LOW,
  [Severity.MEDIUM]: SLIPPAGE_CRACKING_MEDIUM,
  [Severity.HIGH]: SLIPPAGE_CRACKING_HIGH,
};