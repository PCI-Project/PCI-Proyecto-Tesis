import { PavementType, Severity } from "./types";

export const FLEXIBLE_DISTRESSES: { id: string, nameKey: string, severities?: Severity[] }[] = [
  { id: '1', nameKey: 'distress_1' },
  { id: '2', nameKey: 'distress_2' },
  { id: '3', nameKey: 'distress_3' },
  { id: '4', nameKey: 'distress_4' },
  { id: '5', nameKey: 'distress_5' },
  { id: '6', nameKey: 'distress_6' },
  { id: '7', nameKey: 'distress_7' },
  { id: '8', nameKey: 'distress_8' },
  { id: '9', nameKey: 'distress_9' },
  { id: '10', nameKey: 'distress_10' },
  { id: '11', nameKey: 'distress_11' },
  { id: '12', nameKey: 'distress_12', severities: [Severity.MEDIUM] },
  { id: '13', nameKey: 'distress_13' },
  { id: '14', nameKey: 'distress_14' },
  { id: '15', nameKey: 'distress_15' },
  { id: '16', nameKey: 'distress_16', severities: [Severity.LOW] },
  { id: '17', nameKey: 'distress_17' },
  { id: '18', nameKey: 'distress_18' },
  { id: '19.1', nameKey: 'distress_19_1', severities: [Severity.MEDIUM, Severity.HIGH] },
  { id: '19.2', nameKey: 'distress_19_2' },
];

export const getDistressOptions = () => {
    return FLEXIBLE_DISTRESSES;
}

export const PCI_RATINGS: { [key: string]: { range: [number, number]; labelKey: string; className: string; mainCardClassName: string; } } = {
  GOOD: { range: [86, 100], labelKey: 'ratingGood', className: 'bg-green-600/20 text-green-700 font-bold', mainCardClassName: 'bg-green-600 text-text-inverted shadow-green-600/30' },
  SATISFACTORY: { range: [71, 85], labelKey: 'ratingSatisfactory', className: 'bg-green-500/20 text-green-600', mainCardClassName: 'bg-green-500 text-text-inverted shadow-green-500/30' },
  FAIR: { range: [56, 70], labelKey: 'ratingFair', className: 'bg-yellow-400/20 text-yellow-600', mainCardClassName: 'bg-yellow-400 text-text-base shadow-yellow-400/30' },
  POOR: { range: [41, 55], labelKey: 'ratingPoor', className: 'bg-orange-500/20 text-orange-600', mainCardClassName: 'bg-orange-500 text-text-inverted shadow-orange-500/30' },
  VERY_POOR: { range: [26, 40], labelKey: 'ratingVeryPoor', className: 'bg-red-500/20 text-red-600', mainCardClassName: 'bg-red-500 text-text-inverted shadow-red-500/30' },
  FAILED: { range: [11, 25], labelKey: 'ratingFailed', className: 'bg-red-600 text-text-inverted', mainCardClassName: 'bg-red-600 text-text-inverted shadow-red-600/30' },
  TERMINAL: { range: [0, 10], labelKey: 'ratingTerminal', className: 'bg-gray-600 text-text-inverted', mainCardClassName: 'bg-gray-600 text-text-inverted shadow-gray-600/30' },
};


export const getPCIRating = (pci: number) => {
  if (pci > 100) return PCI_RATINGS.GOOD;
  for (const key in PCI_RATINGS) {
    const rating = PCI_RATINGS[key];
    if (pci >= rating.range[0] && pci <= rating.range[1]) {
      return rating;
    }
  }
  return PCI_RATINGS.TERMINAL;
};

export const ASTM_DEFAULTS = {
  FLEXIBLE_SAMPLE_AREA: 225,  // m^2 (approx 2500 ft^2)
  ALLOWABLE_ERROR: 5, // e = 5 PCI points
  STD_DEV_AC: 10, // Assumed standard deviation for AC pavements
};