from pydantic import BaseModel
from typing import List, Optional

class DistressSummarySchema(BaseModel):
    type: str          # Ej: "11" (Patching)
    nameKey: str       # Ej: "distress_11"
    severity: str      # "L", "M", "H"
    quantity: float
    density: Optional[float] = None
    deductValue: float

class CalculationDetailsSchema(BaseModel):
    summaries: List[DistressSummarySchema]
    totalDeductValue: float
    cdv: float
    pci: float

class SampleSchema(BaseModel):
    id: int
    area: float
    isAdditional: bool
    calculationDetails: Optional[CalculationDetailsSchema] = None

class SectionSchema(BaseModel):
    id: str
    name: str
    area: float
    pavementType: str
    totalSampleUnits: int
    minSampleUnits: int
    pci: Optional[float] = None
    actualStdDev: Optional[float] = None
    revisedSampleUnits: Optional[int] = None
    missingSamples: Optional[int] = None
    samplesSufficient: Optional[bool] = None
    randomPCI: Optional[float] = None
    additionalPCI: Optional[float] = None
    samples: List[SampleSchema]

class AgentInputRequest(BaseModel):
    id: str
    name: str
    inspector: str
    inspectionDate: str
    weightedPCI: Optional[float] = 100.0
    sections: List[SectionSchema]