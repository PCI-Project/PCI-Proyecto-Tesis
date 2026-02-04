
import { Distress, DistressSummary, PCICalculationDetails, PavementType, Sample, Section, Severity, CDVIterationStep } from '../../types';
import { FLEXIBLE_DISTRESS_CURVES } from './data/flexible';
import { CORRECTION_CURVES_FLEXIBLE } from './data/correctionCurves';
import { getDistressOptions } from '../../constants';

/**
 * Realiza interpolación lineal entre dos puntos.
 * @param x El valor x para el que se debe encontrar el valor y.
 * @param x1 La coordenada x del primer punto.
 * @param y1 La coordenada y del primer punto.
 * @param x2 La coordenada x del segundo punto.
 * @param y2 La coordenada y del segundo punto.
 * @returns El valor y interpolado.
 */
function interpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x1 === x2) return y1;
  return y1 + (y2 - y1) * ((x - x1) / (x2 - x1));
}

/**
 * Encuentra el valor y correspondiente para un valor x dado a partir de un conjunto de puntos que representan una curva.
 * @param points Una matriz de puntos {x, y}, ordenados por x.
 * @param x El valor x a buscar.
 * @returns El valor y de la curva.
 */
function getValueFromCurve(points: { x: number; y: number }[], x: number): number {
  if (!points || points.length === 0) return 0;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;

  const pointAfter = points.find(p => p.x >= x);
  const pointBefore = [...points].reverse().find(p => p.x < x);

  if (!pointAfter) return points[points.length - 1].y; // Debería estar cubierto por la verificación anterior, pero por seguridad
  if (!pointBefore) return points[0].y;

  return interpolate(x, pointBefore.x, pointBefore.y, pointAfter.x, pointAfter.y);
}


/**
 * Define cómo se calcula la densidad para un tipo de daño dado, de acuerdo con ASTM D6433.
 */
enum DensityCalculationType {
    /** (cantidad / área) * 100. Para áreas o longitudes donde la curva es % de densidad. */
    PERCENT_AREA,
    /** cantidad. Para daños contados como unidades donde la curva se basa en el conteo. */
    COUNT,
    /** cantidad. Para daños medidos por longitud donde la curva está en metros. */
    LENGTH,
    /** cantidad / área. Para unidades como m/m^2. */
    METERS_PER_AREA,
    /** cantidad / área. Para unidades como conteo/m^2. */
    COUNT_PER_AREA,
}

/**
 * Mapea cada ID de daño a su método específico de cálculo de densidad.
 */
const DISTRESS_DENSITY_CONFIG: { [key: string]: DensityCalculationType } = {
    // Daños del Pavimento Flexible
    '1': DensityCalculationType.PERCENT_AREA, // Grietas de Cocodrilo
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
 * Calcula el valor de densidad a utilizar en las curvas de valores de deducción.
 * @param type El ID del tipo de daño.
 * @param quantity La cantidad medida del daño.
 * @param area El área de la unidad de muestra en m^2.
 * @returns El valor de densidad calculado, o nulo si no es aplicable.
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
 * Calcula el valor de deducción para un único tipo de daño, dada su densidad.
 * @param type El ID del tipo de daño.
 * @param severity El nivel de severidad del daño.
 * @param density La densidad calculada del daño.
 * @param distressCurves El conjunto de curvas para el tipo de pavimento.
 * @returns El valor de deducción calculado.
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
 * Agrupa daños por tipo y severidad y calcula sus cantidades totales y valores de deducción.
 * @param sample La muestra a analizar.
 * @returns Una matriz de resúmenes de daños.
 */
export function getSummaries(sample: Sample): DistressSummary[] {
    const distressOptions = getDistressOptions();
    const distressCurves = FLEXIBLE_DISTRESS_CURVES;
    const summaries: { [key: string]: DistressSummary } = {};
    //organiza
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
 * Encuentra iterativamente el valor máximo de deducción corregido (CDV) según el procedimiento
 * descrito en ASTM D6433, sección 9.5.5.
 * @param initialSortedDeducts Una matriz de valores de deducción, ordenados en orden descendente.
 * @param correctionCurve La curva de corrección apropiada para el tipo de pavimento.
 * @returns Los resultados finales incluyendo CDV máximo y todos los pasos de iteración.
 */
function calculateCDV(initialSortedDeducts: number[], correctionCurve: { x: number; y: number }[][]): { m: number; cdv: number; totalDeductValue: number; q: number; iterationSteps: CDVIterationStep[] } {
    const iterationSteps: CDVIterationStep[] = [];
    if (initialSortedDeducts.length === 0) {
        return { m: 1, cdv: 0, totalDeductValue: 0, q: 0, iterationSteps: [] };
    }

    // 9.5.3: Determinar m, el número máximo de deducciones permitidas.
    const hdv = initialSortedDeducts[0] || 0;
    const m = hdv > 0 ? 1 + (9 / 98) * (100 - hdv) : 1;
    
    // 9.5.4: Reducir el número de valores de deducción individuales a m.
    let deductsForIteration: number[];
    if (initialSortedDeducts.length > m) {
        const integerM = Math.floor(m);
        // Según ASTM, redondear la parte fraccionaria de 'm' a un lugar decimal.
        const fractionalM = parseFloat((m - integerM).toFixed(1));
        deductsForIteration = initialSortedDeducts.slice(0, integerM);
        if (fractionalM > 0 && initialSortedDeducts.length > integerM) {
            const fractionalDeduct = initialSortedDeducts[integerM] * fractionalM;
            deductsForIteration.push(fractionalDeduct);
        }
    } else {
        deductsForIteration = [...initialSortedDeducts];
    }
    
    // El proceso de iteración comienza con esta lista ajustada.
    let currentDeducts = [...deductsForIteration].sort((a,b) => b - a);

    while (true) {
        // 9.5.5.1: Determinar TDV sumando los valores en la lista actual.
        const totalDeductValue = currentDeducts.reduce((sum, val) => sum + val, 0);
        
        // 9.5.5.2: Determinar q como el número de valores de deducción mayor que 2.0
        const q = currentDeducts.filter(d => d > 2.0).length;

        if (q === 0) {
             if (iterationSteps.length === 0) {
                 iterationSteps.push({
                    deductsUsed: [...currentDeducts],
                    totalDeductValue: totalDeductValue,
                    q: 0,
                    cdv: totalDeductValue, // CDV = TDV cuando q=0
                });
            }
            break;
        }

        // 9.5.5.3: Determinar CDV de TDV y q usando las curvas de corrección.
        const curveIndex = Math.min(q, correctionCurve.length) - 1;
        const correctionCurveForQ = correctionCurve[curveIndex];
        const cdv = getValueFromCurve(correctionCurveForQ, totalDeductValue);

        iterationSteps.push({
            deductsUsed: [...currentDeducts],
            totalDeductValue,
            q,
            cdv,
        });
        
        // La iteración se detiene después de completar el paso para q=1.
        if (q <= 1) {
            break;
        }

        // 9.5.5.4: Reducir el valor de deducción individual más pequeño mayor que 2 a 2.
        let indexOfMin = -1;
        let minVal = Infinity;

        // Encuentra el valor de deducción mínimo que es mayor que 2.
        for (let i = 0; i < currentDeducts.length; i++) {
            if (currentDeducts[i] > 2.0 && currentDeducts[i] < minVal) {
                minVal = currentDeducts[i];
                indexOfMin = i;
            }
        }
        
        if (indexOfMin !== -1) {
            currentDeducts[indexOfMin] = 2.0;
        } else {
            // Este caso no debería alcanzarse si q > 1, pero sirve como una salida segura.
            break;
        }
    }

    if (iterationSteps.length === 0) {
      return { m, cdv: 0, totalDeductValue: 0, q: 0, iterationSteps: [] };
    }

    // 9.5.5.5: El CDV máximo es el más grande de todos los CDV encontrados.
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
 * Calcula todos los detalles del PCI para una sola muestra.
 * @param sample La muestra a calcular.
 * @returns Un objeto PCICalculationDetails.
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
 * Calcula el PCI de una sección promediando el PCI de sus muestras.
 * @param section La sección a calcular.
 * @returns El PCI calculado para la sección.
 */
export function calculateSectionPCI(section: Section): number {
    const validSamples = section.samples.filter(s => s.calculationDetails && s.calculationDetails.pci >= 0);
    if (validSamples.length === 0) return 100;

    const sumOfPCIs = validSamples.reduce((sum, s) => sum + (s.calculationDetails?.pci ?? 0), 0);
    return sumOfPCIs / validSamples.length;
}

/**
 * Calcula el PCI ponderado final para todo el proyecto.
 * @param sections Una matriz de secciones, con sus PCIs individuales calculados.
 * @returns El PCI ponderado para el proyecto.
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
 * Calcula los parámetros de muestreo para una sección.
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
    // Fórmula de ASTM D6433
    // n = (N * s^2) / (((e^2/4)*(N-1)) + s^2)
    const N = totalSampleUnits;
    const s2 = Math.pow(stdDev, 2);
    const e2 = Math.pow(allowableError, 2);

    const numerator = N * s2;
    const denominator = (e2 / 4) * (N - 1) + s2;
    minSampleUnits = denominator > 0 ? Math.ceil(numerator / denominator) : N;
    
    minSampleUnits = Math.min(minSampleUnits, totalSampleUnits); // No puede ser más que el total
    minSampleUnits = Math.max(1, minSampleUnits); // Debe ser al menos 1
    
    samplingInterval = Math.floor(totalSampleUnits / minSampleUnits);
  }
  
  return {
    totalSampleUnits,
    minSampleUnits,
    samplingInterval
  };
}