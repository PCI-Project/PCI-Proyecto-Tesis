
import { Distress, DistressSummary, PCICalculationDetails, PavementType, Sample, Section, Severity, CDVIterationStep } from '../../types';
import { FLEXIBLE_DISTRESS_CURVES } from './data/flexible';
import { CORRECTION_CURVES_FLEXIBLE } from './data/correctionCurves';
import { getDistressOptions } from '../../constants';

/**
 * Performs linear interpolation between two points.
 * @param x The x-value to find the y-value for.
 * @param x1 The x-coordinate of the first point.
 * @param y1 The y-coordinate of the first point.
 * @param x2 The x-coordinate of the second point.
 * @param y2 The y-coordinate of the second point.
 * @returns The interpolated y-value.
 */
function interpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x1 === x2) return y1;
  return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
}

/**
 * Finds the corresponding y-value for a given x-value from a set of points representing a curve.
 * @param points An array of {x, y} points, sorted by x.
 * @param x The x-value to look up.
 * @returns The y-value from the curve.
 */
function getValueFromCurve(points: { x: number; y: number }[], x: number): number {
  if (!points || points.length === 0) return 0;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;

  const pointAfter = points.find(p => p.x >= x);
  const pointBefore = [...points].reverse().find(p => p.x < x);

  if (!pointAfter) return points[points.length - 1].y; // Should be covered by check above, but for safety
  if (!pointBefore) return points[0].y;

  return interpolate(x, pointBefore.x, pointBefore.y, pointAfter.x, pointAfter.y);
}


/**
 * Defines how density is calculated for a given distress type, according to ASTM D6433.
 */
enum DensityCalculationType {
    /** (quantity / area) * 100. For areas or lengths where curve is % density. */
    PERCENT_AREA,
    /** quantity. For distresses counted as units where curve is based on count. */
    COUNT,
    /** quantity. For distresses measured by length where curve is in meters. */
    LENGTH,
    /** quantity / area. For units like m/m^2. */
    METERS_PER_AREA,
    /** quantity / area. For units like count/m^2. */
    COUNT_PER_AREA,
}

/**
 * Maps each distress ID to its specific density calculation method.
 */
const DISTRESS_DENSITY_CONFIG: { [key: string]: DensityCalculationType } = {
    // Flexible Pavement Distresses
    '1': DensityCalculationType.PERCENT_AREA, // Alligator Cracking
    '2': DensityCalculationType.PERCENT_AREA, // Bleeding
    '3': DensityCalculationType.PERCENT_AREA, // Block Cracking
    '4': DensityCalculationType.PERCENT_AREA, // Bumps and Sags
    '5': DensityCalculationType.PERCENT_AREA, // Corrugation
    '6': DensityCalculationType.PERCENT_AREA, // Depression
    '7': DensityCalculationType.PERCENT_AREA, // Edge Cracking
    '8': DensityCalculationType.PERCENT_AREA, // Joint Reflection Cracking
    '9': DensityCalculationType.LENGTH,       // Lane/Shoulder Drop-off
    '10': DensityCalculationType.PERCENT_AREA, // Long. & Trans. Cracking
    '11': DensityCalculationType.PERCENT_AREA, // Patching
    '12': DensityCalculationType.PERCENT_AREA, // Polished Aggregate
    '13': DensityCalculationType.PERCENT_AREA, // Potholes (count/m2)
    '14': DensityCalculationType.COUNT,       // Railroad Crossing
    '15': DensityCalculationType.PERCENT_AREA, // Rutting
    '16': DensityCalculationType.PERCENT_AREA, // Shoving
    '17': DensityCalculationType.PERCENT_AREA, // Slippage Cracking
    '18': DensityCalculationType.PERCENT_AREA, // Swell
    '19.1': DensityCalculationType.PERCENT_AREA, // Raveling
    '19.2': DensityCalculationType.PERCENT_AREA, // Weathering
};


/**
 * Calculates the density value to be used in the deduct value curves.
 * @param type The distress type ID.
 * @param quantity The measured quantity of the distress.
 * @param area The area of the sample unit in m^2.
 * @returns The calculated density value, or null if not applicable.
 */
function calculateDensity(type: string, quantity: number, area: number): number | null {
    if (quantity <= 0 || area <= 0) return null;

    const calcType = DISTRESS_DENSITY_CONFIG[type];

    switch (calcType) {
        case DensityCalculationType.PERCENT_AREA:
            return (quantity / area) * 100;
        case DensityCalculationType.COUNT:
        case DensityCalculationType.LENGTH:
            return quantity;
        case DensityCalculationType.METERS_PER_AREA:
        case DensityCalculationType.COUNT_PER_AREA:
            return quantity / area;
        default:
            return (quantity / area) * 100;
    }
}


/**
 * Calculates the deduct value for a single distress type, given its density.
 * @param type The distress type ID.
 * @param severity The severity level of the distress.
 * @param density The calculated density of the distress.
 * @param distressCurves The set of curves for the pavement type.
 * @returns The calculated deduct value.
 */
function getDeductValue(type: string, severity: Severity, density: number | null, distressCurves: any): number {
  if (density === null || density <= 0) return 0;

  const curvesForDistress = distressCurves[type];
  if (!curvesForDistress) return 0;

  const curve = curvesForDistress[severity];
  if (!curve) return 0;

  return getValueFromCurve(curve, density);
}

/**
 * Groups distresses by type and severity and calculates their total quantities and deduct values.
 * @param sample The sample to analyze.
 * @returns An array of distress summaries.
 */
export function getSummaries(sample: Sample): DistressSummary[] {
    const distressOptions = getDistressOptions();
    const distressCurves = FLEXIBLE_DISTRESS_CURVES;
    const summaries: { [key: string]: DistressSummary } = {};

    for (const distress of sample.distresses) {
        if (distress.quantity <= 0) continue;

        const key = `${distress.type}-${distress.severity}`;
        if (!summaries[key]) {
            const distressInfo = distressOptions.find(d => d.id === distress.type);
            summaries[key] = {
                type: distress.type,
                nameKey: distressInfo?.nameKey || 'Unknown',
                severity: distress.severity,
                quantity: 0,
                density: null,
                deductValue: 0
            };
        }
        summaries[key].quantity += distress.quantity;
    }
    
    return Object.values(summaries).map(summary => {
        const density = calculateDensity(summary.type, summary.quantity, sample.area);
        const deductValue = getDeductValue(summary.type, summary.severity, density, distressCurves);

        return {
            ...summary,
            density: density,
            deductValue: deductValue
        };
    }).filter(s => s.deductValue > 0);
}


/**
 * Iteratively finds the maximum corrected deduct value (CDV) according to the procedure
 * outlined in ASTM D6433, section 9.5.5.
 * @param initialSortedDeducts An array of deduct values, sorted descending.
 * @param correctionCurve The appropriate correction curve for the pavement type.
 * @returns The final results including max CDV and all iteration steps.
 */
function calculateCDV(initialSortedDeducts: number[], correctionCurve: { x: number; y: number }[][]): { m: number; cdv: number; totalDeductValue: number; q: number; iterationSteps: CDVIterationStep[] } {
    const iterationSteps: CDVIterationStep[] = [];
    if (initialSortedDeducts.length === 0) {
        return { m: 1, cdv: 0, totalDeductValue: 0, q: 0, iterationSteps: [] };
    }

    // 9.5.3: Determine m, the maximum number of allowable deducts.
    const hdv = initialSortedDeducts[0] || 0;
    const m = hdv > 0 ? 1 + (9 / 98) * (100 - hdv) : 1;
    
    // 9.5.4: Reduce the number of individual deduct values to m.
    let deductsForIteration: number[];
    if (initialSortedDeducts.length > m) {
        const integerM = Math.floor(m);
        // Per ASTM, round the fractional part of 'm' to one decimal place.
        const fractionalM = parseFloat((m - integerM).toFixed(1));
        deductsForIteration = initialSortedDeducts.slice(0, integerM);
        if (fractionalM > 0 && initialSortedDeducts.length > integerM) {
            const fractionalDeduct = initialSortedDeducts[integerM] * fractionalM;
            deductsForIteration.push(fractionalDeduct);
        }
    } else {
        deductsForIteration = [...initialSortedDeducts];
    }
    
    // The iteration process starts with this adjusted list.
    let currentDeducts = [...deductsForIteration].sort((a,b) => b - a);

    while (true) {
        // 9.5.5.1: Determine TDV by summing the values in the current list.
        const totalDeductValue = currentDeducts.reduce((sum, val) => sum + val, 0);
        
        // 9.5.5.2: Determine q as the number of deduct values greater than 2.0
        const q = currentDeducts.filter(d => d > 2.0).length;

        if (q === 0) {
             if (iterationSteps.length === 0) {
                 iterationSteps.push({
                    deductsUsed: [...currentDeducts],
                    totalDeductValue: totalDeductValue,
                    q: 0,
                    cdv: totalDeductValue, // CDV = TDV when q=0
                });
            }
            break;
        }

        // 9.5.5.3: Determine CDV from TDV and q using the correction curves.
        const curveIndex = Math.min(q, correctionCurve.length) - 1;
        const correctionCurveForQ = correctionCurve[curveIndex];
        const cdv = getValueFromCurve(correctionCurveForQ, totalDeductValue);

        iterationSteps.push({
            deductsUsed: [...currentDeducts],
            totalDeductValue,
            q,
            cdv,
        });
        
        // The iteration stops after the step for q=1 is completed.
        if (q <= 1) {
            break;
        }

        // 9.5.5.4: Reduce the smallest individual deduct value greater than 2 to 2.
        let indexOfMin = -1;
        let minVal = Infinity;

        // Find the minimum deduct value that is greater than 2.
        for (let i = 0; i < currentDeducts.length; i++) {
            if (currentDeducts[i] > 2.0 && currentDeducts[i] < minVal) {
                minVal = currentDeducts[i];
                indexOfMin = i;
            }
        }
        
        if (indexOfMin !== -1) {
            currentDeducts[indexOfMin] = 2.0;
        } else {
            // This case should not be reached if q > 1, but serves as a safe exit.
            break;
        }
    }

    if (iterationSteps.length === 0) {
      return { m, cdv: 0, totalDeductValue: 0, q: 0, iterationSteps: [] };
    }

    // 9.5.5.5: The maximum CDV is the largest of all the CDVs found.
    const finalStep = iterationSteps.reduce(
        (maxStep, currentStep) => (currentStep.cdv > maxStep.cdv ? currentStep : maxStep),
        iterationSteps[0]
    );

    return {
        m,
        cdv: finalStep.cdv,
        totalDeductValue: finalStep.totalDeductValue,
        q: finalStep.q,
        iterationSteps,
    };
}


/**
 * Calculates all PCI details for a single sample.
 * @param sample The sample to calculate.
 * @returns A PCICalculationDetails object.
 */
export function calculatePCIForSample(sample: Sample): PCICalculationDetails {
  const summaries = getSummaries(sample);
  const sortedDeducts = summaries.map(s => s.deductValue).sort((a, b) => b - a);
  
  const correctionCurve = CORRECTION_CURVES_FLEXIBLE;

  const { cdv, totalDeductValue, q, iterationSteps, m } = calculateCDV(sortedDeducts, correctionCurve);

  const pci = Math.max(0, 100 - cdv);

  return {
    summaries,
    sortedDeducts,
    m,
    q,
    totalDeductValue,
    cdv,
    pci,
    cdvIterationSteps: iterationSteps,
  };
}


/**
 * Calculates the PCI for a section by averaging the PCI of its samples.
 * @param section The section to calculate.
 * @returns The calculated PCI for the section.
 */
export function calculateSectionPCI(section: Section): number {
    const validSamples = section.samples.filter(s => s.calculationDetails && s.calculationDetails.pci >= 0);
    if (validSamples.length === 0) return 100;

    const sumOfPCIs = validSamples.reduce((sum, s) => sum + (s.calculationDetails?.pci ?? 0), 0);
    return sumOfPCIs / validSamples.length;
}

/**
 * Calculates the final weighted PCI for the entire project.
 * @param sections An array of sections, with their individual PCIs calculated.
 * @returns The weighted PCI for the project.
 */
export function calculateProjectWeightedPCI(sections: Section[]): number {
    const validSections = sections.filter(s => s.pci !== undefined && s.pci >= 0);
    if (validSections.length === 0) return 100;
    
    const totalArea = validSections.reduce((sum, s) => sum + s.area, 0);
    if (totalArea === 0) return 100;

    const weightedPCISum = validSections.reduce((sum, s) => sum + (s.pci! * s.area), 0);
    
    return weightedPCISum / totalArea;
}

/**
 * Calculates sampling parameters for a section.
 */
export function calculateSectionParameters(
  area: number,
  sampleUnitArea: number,
  stdDev: number,
  allowableError: number,
  evaluateAllSamples: boolean
) {
  const totalSampleUnits = Math.ceil(area / sampleUnitArea);
  let minSampleUnits: number;
  let samplingInterval: number;

  if (evaluateAllSamples || totalSampleUnits <= 1) {
    minSampleUnits = totalSampleUnits;
    samplingInterval = 1;
  } else {
    // Formula from ASTM D6433
    // n = (N * s^2) / (((e^2/4)*(N-1)) + s^2)
    const N = totalSampleUnits;
    const s2 = Math.pow(stdDev, 2);
    const e2 = Math.pow(allowableError, 2);

    const numerator = N * s2;
    const denominator = (e2 / 4) * (N - 1) + s2;
    minSampleUnits = denominator > 0 ? Math.ceil(numerator / denominator) : N;
    
    minSampleUnits = Math.min(minSampleUnits, totalSampleUnits); // Cannot be more than total
    minSampleUnits = Math.max(1, minSampleUnits); // Must be at least 1
    
    samplingInterval = Math.floor(totalSampleUnits / minSampleUnits);
  }
  
  return {
    totalSampleUnits,
    minSampleUnits,
    samplingInterval
  };
}