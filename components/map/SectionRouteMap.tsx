import React, { useMemo, useState } from 'react';
import { Section } from '../../types';
import { sliceRouteByUnits } from '../../services/gisService';
import { Button } from '../ui/Button';
import { MapCanvas, SliceFeature } from './MapCanvas';

const BASE_COLORS = ['#2563eb', '#60a5fa'];
const SAMPLED_COLOR = '#f97316';

// Mapa desplegable de un tramo ya agregado: muestra la vía seleccionada dividida en las
// unidades de muestra del tramo. Solo se crea el mapa mientras está desplegado.
export const SectionRouteMap: React.FC<{ section: Section }> = ({ section }) => {
  const [open, setOpen] = useState(false);
  const location = section.routeLocation;

  const slices = useMemo<SliceFeature[]>(() => {
    if (!location || location.routeCoordinates.length < 2) return [];
    const sampledIds = new Set(section.samples.map(sample => sample.id));
    return sliceRouteByUnits(location, section.sampleUnitLength, section.startStation, section.totalSampleUnits)
      .map((slice, index) => ({
        id: slice.id,
        coordinates: slice.coordinates,
        color: sampledIds.has(slice.id) ? SAMPLED_COLOR : BASE_COLORS[index % 2],
        label: String(slice.id),
      }));
  }, [location, section.samples, section.sampleUnitLength, section.startStation, section.totalSampleUnits]);

  if (!location || slices.length === 0) return null;

  return (
    <div className="mb-3">
      <Button type="button" variant="ghost" onClick={() => setOpen(previous => !previous)}>
        {open ? 'Ocultar mapa de la ruta' : 'Ver mapa de la ruta'}
      </Button>
      {open && (
        <div className="mt-2 space-y-2">
          <MapCanvas slices={slices} height={360} />
          <p className="text-xs text-text-muted">
            Ruta dividida en {slices.length} unidades de muestra de {section.sampleUnitLength.toFixed(1)} m. Las unidades naranja son las que se evaluarán.
          </p>
        </div>
      )}
    </div>
  );
};
