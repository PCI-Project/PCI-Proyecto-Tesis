import { Severity } from '../../../../types';

const SHOVING_LOW = [ { x: 0.1, y: 5 }, { x: 100, y: 5 } ].sort((a, b) => a.x - b.x);

export const shovingCurves = {
  [Severity.LOW]: SHOVING_LOW,
};