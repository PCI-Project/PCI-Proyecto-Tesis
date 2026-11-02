import React, { useMemo, useRef, useState } from 'react';
import { LngLatTuple, Project } from '../../types';
import { getPCIRating } from '../../constants';
import { buildSampleMapFeatures, getPredominantDistress } from '../../services/gisService';
import { MapCanvas } from './MapCanvas';
import { SampleDistressesDialog, SampleDistressRow } from './SampleDistressesDialog';
import { useTranslations } from '../../hooks/useTranslations';

const pciColor = (pci?: number): string => {
  if (pci === undefined) return '#94a3b8';
  if (pci >= 86) return '#16a34a';
  if (pci >= 71) return '#22c55e';
  if (pci >= 56) return '#eab308';
  if (pci >= 41) return '#f97316';
  if (pci >= 26) return '#ef4444';
  if (pci >= 11) return '#dc2626';
  return '#4b5563';
};

const station = (value: number) => `${Math.floor(value / 1000)}+${(value % 1000).toFixed(2).padStart(6, '0')}`;

// Por debajo de este zoom se ve el eje de la ruta; por encima se oculta para no tapar las unidades.
const ROUTE_DETAIL_ZOOM = 17;

interface SelectedUnit {
  polygonId: string;
  sectionName: string;
  sampleId: number;
  evaluated: boolean;
  pci: string;
  area?: number;
  startStation: string;
  endStation: string;
  startCoordinates: string;
  endCoordinates: string;
  predominant: string;
  distresses: SampleDistressRow[];
}

export const PCIResultsMap: React.FC<{ project: Project }> = ({ project }) => {
  const { t } = useTranslations();
  const [selected, setSelected] = useState<SelectedUnit | null>(null);
  const [popupAt, setPopupAt] = useState<LngLatTuple | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [distressesOpen, setDistressesOpen] = useState(false);
  const sectionsWithRoute = useMemo(() => project.sections.filter(section => section.routeLocation?.routeCoordinates.length), [project]);
  const routes = useMemo(() => sectionsWithRoute.map(section => section.routeLocation!.routeCoordinates), [sectionsWithRoute]);
  const polygons = useMemo(() => sectionsWithRoute.flatMap(section => buildSampleMapFeatures(section).map(feature => {
    const sample = section.samples.find(item => item.id === feature.sampleId);
    const pci = sample?.calculationDetails?.pci;
    const predominant = getPredominantDistress(section, feature.sampleId);
    const distresses = [...(sample?.calculationDetails?.summaries || [])].sort((a, b) => b.deductValue - a.deductValue);
    const polygonId = `${section.id}-${feature.sampleId}`;
    const unit: SelectedUnit = {
      polygonId,
      sectionName: section.name,
      sampleId: feature.sampleId,
      evaluated: feature.evaluated,
      pci: pci === undefined ? 'N/A' : pci.toFixed(2),
      area: sample?.area,
      startStation: station(feature.startStation),
      endStation: station(feature.endStation),
      startCoordinates: `${feature.startPoint[1].toFixed(6)}, ${feature.startPoint[0].toFixed(6)}`,
      endCoordinates: `${feature.endPoint[1].toFixed(6)}, ${feature.endPoint[0].toFixed(6)}`,
      predominant: predominant || '',
      distresses,
    };
    return {
      id: polygonId,
      coordinates: feature.coordinates,
      color: feature.evaluated ? pciColor(pci) : '#cbd5e1',
      properties: unit as unknown as Record<string, unknown>,
    };
  })), [sectionsWithRoute]);

  // Mini panel de resumen que se abre sobre la unidad al hacer clic
  const popup = useMemo(() => {
    if (!selected || !popupAt) return null;
    const pciValue = selected.pci === 'N/A' ? undefined : Number(selected.pci);
    const rating = pciValue !== undefined ? getPCIRating(pciValue) : null;
    return {
      coordinate: popupAt,
      content: (
        <div className="w-72 rounded-xl border border-border-muted bg-bg-surface p-3 text-sm shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div><span className="block text-xs text-text-muted">{selected.sectionName}</span><strong className="text-base text-text-base">Unidad #{selected.sampleId}</strong></div>
            <button type="button" aria-label="Cerrar resumen" onClick={() => setPopupAt(null)} className="-mr-1 -mt-1 rounded-full px-2 text-lg leading-none text-text-muted hover:bg-primary/10 hover:text-primary">×</button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-lg px-2.5 py-1 text-lg font-bold text-white" style={{ background: selected.evaluated ? pciColor(pciValue) : '#94a3b8' }}>{selected.evaluated ? selected.pci : 'N/A'}</span>
            <span className="text-xs text-text-muted">{selected.evaluated ? `PCI · ${rating ? t(rating.labelKey) : ''}` : 'Unidad no evaluada'}</span>
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-2"><dt className="text-text-muted">Progresiva</dt><dd className="font-semibold text-text-base">{selected.startStation} – {selected.endStation}</dd></div>
            {selected.evaluated && <div className="flex justify-between gap-2"><dt className="text-text-muted">Falla predominante</dt><dd className="text-right font-semibold text-text-base">{selected.predominant ? t(selected.predominant) : 'Sin fallas'}</dd></div>}
            {selected.evaluated && <div className="flex justify-between gap-2"><dt className="text-text-muted">Fallas registradas</dt><dd className="font-semibold text-text-base">{selected.distresses.length}</dd></div>}
          </dl>
          <div className="mt-3 flex flex-wrap justify-end gap-3 text-xs font-semibold">
            {selected.evaluated && selected.distresses.length > 0 && <button type="button" onClick={() => setDistressesOpen(true)} className="text-primary hover:underline">Ver fallas</button>}
            <button type="button" onClick={() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })} className="text-text-muted hover:text-primary hover:underline">Más datos ↓</button>
          </div>
        </div>
      ),
    };
  }, [selected, popupAt, t]);

  if (sectionsWithRoute.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-border-muted bg-bg-base/40 p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-xl font-bold text-text-base">Mapa de resultados PCI</h3><p className="text-sm text-text-muted">Haga clic en una unidad de muestra del mapa para ver su información básica.</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded px-2 py-1 text-white" style={{ background: '#16a34a' }}>86–100</span><span className="rounded px-2 py-1" style={{ background: '#eab308' }}>56–70</span><span className="rounded px-2 py-1 text-white" style={{ background: '#f97316' }}>41–55</span><span className="rounded px-2 py-1 text-white" style={{ background: '#dc2626' }}>11–25</span><span className="rounded bg-slate-300 px-2 py-1">No evaluada</span></div></div>
      <MapCanvas
        routes={routes}
        polygons={polygons}
        detailZoom={ROUTE_DETAIL_ZOOM}
        selectedPolygonId={selected?.polygonId}
        onPolygonClick={(properties, point) => { setSelected(properties as unknown as SelectedUnit); setPopupAt(point); }}
        onMapClick={() => setPopupAt(null)}
        popup={popup}
        height={520}
      />
      <p className="mt-2 text-xs text-text-muted">Mover el mapa: arrastre con el mouse o use dos dedos en el touchpad. Zoom: rueda del mouse o pellizco. El eje azul de la ruta se oculta al acercar para que se vean las unidades.</p>
      {!selected && <div className="mt-3 rounded-lg border border-dashed border-border-base bg-bg-surface p-4 text-sm text-text-muted">Seleccione una unidad de muestra en el mapa para consultar su información básica: progresiva, PCI, falla predominante, coordenadas y las fallas registradas.</div>}
      {selected && <div ref={detailRef} className="mt-3 grid gap-3 rounded-lg border border-border-muted bg-bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div><span className="block text-xs text-text-muted">Tramo / unidad</span><strong>{selected.sectionName} · #{selected.sampleId}</strong></div>
        <div><span className="block text-xs text-text-muted">Progresiva</span><strong>{selected.startStation} – {selected.endStation}</strong></div>
        <div><span className="block text-xs text-text-muted">PCI</span><strong className="text-primary">{selected.pci}</strong></div>
        <div>
          <span className="block text-xs text-text-muted">Falla predominante</span>
          <strong>{!selected.evaluated ? 'Unidad no evaluada' : selected.predominant ? t(selected.predominant) : 'Sin fallas registradas'}</strong>
          {selected.evaluated && selected.distresses.length > 0 && <button type="button" onClick={() => setDistressesOpen(true)} className="mt-1 block text-xs font-semibold text-primary hover:underline">Ver fallas registradas ({selected.distresses.length})</button>}
        </div>
        <div className="sm:col-span-2"><span className="block text-xs text-text-muted">Coordenada inicial</span><strong className="font-mono">{selected.startCoordinates}</strong></div>
        <div className="sm:col-span-2"><span className="block text-xs text-text-muted">Coordenada final</span><strong className="font-mono">{selected.endCoordinates}</strong></div>
      </div>}
      {selected && <SampleDistressesDialog
        isOpen={distressesOpen}
        onClose={() => setDistressesOpen(false)}
        title={`Fallas registradas · Unidad #${selected.sampleId}`}
        subtitle={`${selected.sectionName} · progresiva ${selected.startStation} – ${selected.endStation}`}
        pci={selected.pci}
        area={selected.area}
        distresses={selected.distresses}
      />}
    </div>
  );
};
