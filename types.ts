export type ProjectView = 'SETUP' | 'DATA_ENTRY' | 'CALCULATION_DETAILS' | 'RESULTS' | 'AGENT';
export type AppView = 'DASHBOARD' | ProjectView | 'PROFILE' | 'ADMIN_SETTINGS';

export enum PavementType {
  FLEXIBLE = 'Flexible (Asfalto)',
}

export enum Severity {
  LOW = 'L',
  MEDIUM = 'M',
  HIGH = 'H',
}

export interface MongoUser {
  _id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'user';
  company?: string;
  jobTitle?: string;
  phone?: string;
  country?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MongoProject {
  _id: string;
  name?: string;
  nombre: string;
  descripcion?: string;
  inspector?: string;
  inspectionDate?: string;
  lastView?: ProjectView;
  weightedPCI?: number;
  sections: Section[];
  agentConfig?: AgentConfig;
  agentRuns?: AgentRun[];
  propietario: string;
  createdAt?: string;
  updatedAt?: string;
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
  /** true = el inspector la marcó evaluada aunque no tenga fallas (una unidad vacía sin marca está pendiente). */
  evaluated?: boolean;
  calculationDetails?: PCICalculationDetails;
}

export type LngLatTuple = [number, number];
export type GeodeticDatum = 'WGS84' | 'NAD27';

export interface RouteLocation {
  coordinateType: 'GEOGRAPHIC' | 'UTM';
  datum: GeodeticDatum;
  utmZone: number;
  hemisphere: 'N' | 'S';
  startPoint: LngLatTuple;
  endPoint: LngLatTuple;
  intermediatePoints: LngLatTuple[];
  snappedWaypoints: LngLatTuple[];
  routeCoordinates: LngLatTuple[];
  routingDistance: number;
  engineeringLength: number;
  startName?: string;
  endName?: string;
}

export interface SectionContext {
  roadType: 'urbana' | 'rural' | null;
  curbHeightCm: number | null;
  trafficInput: 'esal' | 'clase';
  esalMillions: number | null;
  trafficClass: 'bajo' | 'medio' | 'alto' | null;
  aadt: number | null;
  yearBuilt: number | null;
  lastInterventionYear: number | null;
  lastInterventionType: string | null;
  drainage: 'bueno' | 'regular' | 'malo' | null;
  functionalClass: string | null;
  notes: string | null;
}
export interface UnitCost { valor: number; unidad: 'm2' | 'm' | 'global'; fuente?: string; }
export interface AgentConfig {
  /** C1: 'diagnostico' = informe patológico sin costos, presupuesto, B/C ni prioridad. Sin valor = 'completo'. */
  analysisMode?: 'completo' | 'diagnostico';
  availableTreatments: string[];
  unitCosts: Record<string, UnitCost>;
  currency: string;
  budget: number | null;
  priorityMode: 'costo_beneficio' | 'peor_primero';
  contingencyPct: number;
  pciThresholds?: Partial<Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1', number>>;
  parameters?: Record<string, unknown>;
  updatedAt: string;
}
export interface AgentRun {
  id: string; number: number; createdAt: string; inputHash: string;
  config: AgentConfig; contexts: Record<string, SectionContext | null>;
  input: unknown; analysis: unknown; narrative: unknown;
  narrativeSource: 'modelo' | 'automatica' | 'importado';
  agentVersion: string; status: 'listo' | 'error'; error?: string;
}

export interface Section {
  context?: SectionContext;
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
  actualStdDev?: number;
  location?: string;
  routeLocation?: RouteLocation;
  revisedSampleUnits?: number;
  missingSamples?: number;
  samplesSufficient?: boolean;
  randomPCI?: number;
  additionalPCI?: number;
  systematicallyAddedSampleIds?: number[];
}

export interface Project {
  id: string;
  _id?: string;
  name: string;
  nombre?: string;
  descripcion?: string;
  inspector: string;
  inspectionDate: string;
  propietario?: string;
  sections: Section[];
  lastView?: ProjectView;
  weightedPCI?: number;
  agentConfig?: AgentConfig;
  agentRuns?: AgentRun[];
}