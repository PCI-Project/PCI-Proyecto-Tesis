

export type ProjectView = 'SETUP' | 'DATA_ENTRY' | 'CALCULATION_DETAILS' | 'RESULTS';
export type AppView = 'DASHBOARD' | ProjectView | 'PROFILE';

export enum PavementType {
  FLEXIBLE = 'Flexible (Asfalto)',
}

export enum Severity {
  LOW = 'L',
  MEDIUM = 'M',
  HIGH = 'H',
}

export interface User {
  _id: string;          // ← ID nativo de Mongo
  nombre: string;
  email: string;
  rol: 'admin' | 'user';
  createdAt?: string;   // ← timestamps de Mongoose
}
export interface Project {
  _id: string;          // ← reemplaza el "id" local
  nombre: string;
  descripcion?: string;
  sections: Section[];
  propietario: string;
  createdAt?: string;
}

export interface Distress {
  id: string; // Unique ID for the specific instance of a distress entry
  type: string; // The official ID from ASTM D6433 (e.g., '1' or '19.1')
  severity: Severity;
  quantity: number;
}

export interface DistressSummary {
  type: string;
  nameKey: string;
  severity: Severity;
  quantity: number;
  density: number | null;
  deductValue: number;
}

export interface CDVIterationStep {
  deductsUsed: number[];
  totalDeductValue: number;
  q: number;
  cdv: number;
}


export interface PCICalculationDetails {
  summaries: DistressSummary[];
  sortedDeducts: number[];
  m: number;
  q: number;
  totalDeductValue: number;
  cdv: number;
  pci: number;
  cdvIterationSteps: CDVIterationStep[];
}


export interface Sample {
  id: number; // e.g. Sample Unit #5
  area: number; // m^2
  pavementType: PavementType;
  distresses: Distress[];
  isAdditional: boolean;
  calculationDetails?: PCICalculationDetails;
}

export interface Section {
  id: string;
  name: string;
  length: number; // meters
  width: number; // meters
  startStation: number; // meters
  pavementType: PavementType;
  // User-defined sample unit properties
  sampleUnitArea: number; // m^2
  stdDev: number;
  allowableError: number;
  evaluateAllSamples: boolean;
  startSampleUnit?: number;
  // Calculated properties
  area: number; // m^2
  sampleUnitLength: number; // meters
  totalSampleUnits: number;
  minSampleUnits: number;
  samplingInterval: number;
  // Data
  samples: Sample[];
  pci?: number;
}

export interface Project {
  id:string;
  name: string;
  inspector: string;
  inspectionDate: string;
  sections: Section[];
  lastView?: ProjectView;
  weightedPCI?: number;
}