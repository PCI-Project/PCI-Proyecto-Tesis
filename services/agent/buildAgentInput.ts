import type { AgentConfig, Project, SectionContext } from '../../types';
import { isSampleEvaluated } from './coverage';

export const emptyContext = (): SectionContext => ({ roadType: null, curbHeightCm: null, trafficInput: 'esal', esalMillions: null, trafficClass: null, aadt: null, yearBuilt: null, lastInterventionYear: null, lastInterventionType: null, drainage: null, functionalClass: null, notes: null });

export function buildAgentInput(project: Project, config: AgentConfig, company?: string) {
  return {
    version: '1.0',
    proyecto: { id: project.id, nombre: project.name, inspector: project.inspector, fecha_inspeccion: project.inspectionDate.slice(0, 10), ...(project.descripcion ? { descripcion: project.descripcion } : {}), ...(company ? { entidad: company } : {}) },
    calibracion: config.analysisMode === 'diagnostico'
      // C1: en diagnóstico no se envían costos, moneda, presupuesto, prioridad ni imprevistos
      ? { modo_analisis: 'diagnostico', tratamientos_disponibles: config.availableTreatments, ...(config.pciThresholds && Object.keys(config.pciThresholds).length ? { umbrales_pci: config.pciThresholds } : {}), ...(config.parameters && Object.keys(config.parameters).length ? { parametros: config.parameters } : {}) }
      : { tratamientos_disponibles: config.availableTreatments, costos_unitarios: config.unitCosts, moneda: config.currency, presupuesto: config.budget, modo_priorizacion: config.priorityMode, ...(config.pciThresholds && Object.keys(config.pciThresholds).length ? { umbrales_pci: config.pciThresholds } : {}), parametros: { ...config.parameters, imprevistos_pct: { valor: config.contingencyPct } } },
    tramos: project.sections.map(section => {
      const c = section.context ?? emptyContext();
      return {
        id: section.id, nombre: section.name, longitud_m: section.length, ancho_m: section.width, area_m2: section.area, pci: section.pci,
        ...(section.location ? { ubicacion: section.location } : {}),
        total_unidades_muestra: section.totalSampleUnits, ...(section.samplesSufficient !== undefined ? { muestreo_suficiente: section.samplesSufficient } : {}),
        contexto: { tipo_via: c.roadType, altura_bordillo_cm: c.roadType === 'rural' ? null : c.curbHeightCm, esal_millones: c.trafficInput === 'esal' ? c.esalMillions : null, clase_trafico: c.trafficInput === 'clase' ? c.trafficClass : null, tpda: c.aadt, anio_construccion: c.yearBuilt, anio_ultima_intervencion: c.lastInterventionYear, ultima_intervencion: c.lastInterventionType, drenaje: c.drainage, clasificacion_funcional: c.functionalClass, observaciones: c.notes },
        muestras: section.samples.map(sample => ({ id: sample.id, area_m2: sample.area, adicional: sample.isAdditional, evaluada: isSampleEvaluated(sample),...(sample.calculationDetails ? { pci: sample.calculationDetails.pci } : {}), fallas: sample.distresses.filter(d => d.quantity > 0).map((d, index, all) => {
          const summary = sample.calculationDetails?.summaries.find(s => s.type === d.type && s.severity === d.severity);
          const first = all.findIndex(x => x.type === d.type && x.severity === d.severity) === index;
          return { tipo: d.type, severidad: d.severity, cantidad: d.quantity, ...(summary && first ? { valor_deducido: summary.deductValue } : {}) };
        }) }))
      };
    })
  };
}

// Orden recursivo y JSON compacto. Se calcula sobre la misma representación enviada.
export function canonicalJson(value: unknown): string {
  const normalize = (item: any): any => Array.isArray(item) ? item.map(normalize) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().filter(key => item[key] !== undefined).map(key => [key, normalize(item[key])])) : item;
  return JSON.stringify(normalize(value));
}
export async function inputHash(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(input));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
