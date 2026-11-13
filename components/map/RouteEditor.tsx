import React, { useEffect, useMemo, useState } from 'react';
import { GeodeticDatum, LngLatTuple, RouteLocation } from '../../types';
import { calculateRoadRoute } from '../../services/routingService';
import { fromUtm, measureRouteUtm, sliceRouteByUnits, suggestedUtmZone, toUtm, utmZoneView } from '../../services/gisService';
import { Button } from '../ui/Button';
import { InfoTip } from '../ui/InfoTip';
import { MapCanvas, SliceFeature } from './MapCanvas';

interface RouteEditorProps {
  value?: RouteLocation;
  onConfirm: (location: RouteLocation) => void;
  onClear: () => void;
  sliceLength?: number;
}

const NO_POINTS: LngLatTuple[] = [];

const longitudeLabel = (longitude: number) => `${Math.abs(longitude)}° ${longitude < 0 ? 'O' : 'E'}`;

interface ManualCoordinates { startX: string; startY: string; endX: string; endY: string; }

export const RouteEditor: React.FC<RouteEditorProps> = ({ value, onConfirm, onClear, sliceLength }) => {
  const [coordinateType, setCoordinateType] = useState<'GEOGRAPHIC' | 'UTM'>(value?.coordinateType || 'GEOGRAPHIC');
  const [datum, setDatum] = useState<GeodeticDatum>(value?.datum || 'WGS84');
  const [zone, setZone] = useState(value?.utmZone || 17);
  const [hemisphere, setHemisphere] = useState<'N' | 'S'>(value?.hemisphere || 'N');
  const [points, setPoints] = useState<LngLatTuple[]>(value ? [value.startPoint, ...value.intermediatePoints, value.endPoint] : []);
  const [route, setRoute] = useState<LngLatTuple[]>(value?.routeCoordinates || []);
  const [routingDistance, setRoutingDistance] = useState(value?.routingDistance || 0);
  const [snappedWaypoints, setSnappedWaypoints] = useState<LngLatTuple[]>(value?.snappedWaypoints || []);
  const [names, setNames] = useState<string[]>(value ? [value.startName || '', value.endName || ''] : []);
  const [manual, setManual] = useState<ManualCoordinates>({ startX: '', startY: '', endX: '', endY: '' });
  const [isRouting, setIsRouting] = useState(false);
  const [confirmed, setConfirmed] = useState(Boolean(value));
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [blankSteps, setBlankSteps] = useState<Array<{ x: string; y: string }>>([]);

  const calculationZone = coordinateType === 'UTM' ? zone : route[0] ? suggestedUtmZone(route[0][0]) : zone;
  const calculationDatum: GeodeticDatum = coordinateType === 'GEOGRAPHIC' ? 'WGS84' : datum;
  const calculationHemisphere: 'N' | 'S' = coordinateType === 'GEOGRAPHIC' && route[0] ? (route[0][1] >= 0 ? 'N' : 'S') : hemisphere;
  const engineeringLength = useMemo(
    () => route.length > 1 ? measureRouteUtm(route, calculationZone, calculationHemisphere, calculationDatum) : 0,
    [route, calculationZone, calculationHemisphere, calculationDatum],
  );

  const zoneView = coordinateType === 'UTM' ? utmZoneView(zone, hemisphere) : undefined;
  const insideZone = (point: LngLatTuple, view = zoneView) => !view
    || (point[0] >= view.bounds[0][0] && point[0] <= view.bounds[1][0] && point[1] >= view.bounds[0][1] && point[1] <= view.bounds[1][1]);

  const slices = useMemo<SliceFeature[]>(() => {
    if (route.length < 2 || !sliceLength || sliceLength <= 0) return [];
    const palette = confirmed ? ['#16a34a', '#4ade80'] : ['#2563eb', '#60a5fa'];
    return sliceRouteByUnits({ routeCoordinates: route, utmZone: calculationZone, hemisphere: calculationHemisphere, datum: calculationDatum }, sliceLength)
      .map((slice, index) => ({ id: slice.id, coordinates: slice.coordinates, color: palette[index % 2], label: String(slice.id) }));
  }, [route, sliceLength, confirmed, calculationZone, calculationHemisphere, calculationDatum]);

  const displayPoint = (point: LngLatTuple): LngLatTuple => coordinateType === 'UTM'
    ? toUtm(point, zone, hemisphere, datum)
    : [...point] as LngLatTuple;
  const inputPoint = (point: LngLatTuple): LngLatTuple => coordinateType === 'UTM'
    ? fromUtm(point, zone, hemisphere, datum)
    : point;

  useEffect(() => {
    const start = points[0] ? displayPoint(points[0]) : undefined;
    const end = points.length >= 2 ? displayPoint(points.at(-1)!) : undefined;
    setManual({
      startX: start ? start[0].toFixed(coordinateType === 'UTM' ? 3 : 6) : '',
      startY: start ? start[1].toFixed(coordinateType === 'UTM' ? 3 : 6) : '',
      endX: end ? end[0].toFixed(coordinateType === 'UTM' ? 3 : 6) : '',
      endY: end ? end[1].toFixed(coordinateType === 'UTM' ? 3 : 6) : '',
    });
  }, [points, coordinateType, datum, zone, hemisphere]);

  const resetCalculatedRoute = () => { setRoute([]); setConfirmed(false); setError(''); };

  const handleMapClick = (point: LngLatTuple) => {
    resetCalculatedRoute();
    if (points.length === 0) setPoints([point]);
    else if (points.length === 1) setPoints([points[0], point]);
    else setPoints(previous => [...previous.slice(0, -1), point, previous.at(-1)!]);
    if (coordinateType === 'GEOGRAPHIC') setZone(suggestedUtmZone(point[0]));
  };

  const applyManualCoordinates = () => {
    const texts = [manual.startX, manual.startY, manual.endX, manual.endY];
    const values = texts.map(Number);
    if (texts.some(text => text.trim() === '') || values.some(valueNumber => !Number.isFinite(valueNumber))) {
      setError('Complete las dos coordenadas del punto inicial y del punto final.');
      return;
    }
    if (coordinateType === 'GEOGRAPHIC' && (Math.abs(values[0]) > 180 || Math.abs(values[2]) > 180 || Math.abs(values[1]) > 90 || Math.abs(values[3]) > 90)) {
      setError('La longitud debe estar entre -180 y 180 y la latitud entre -90 y 90.');
      return;
    }
    try {
      const start = inputPoint([values[0], values[1]]);
      const end = inputPoint([values[2], values[3]]);
      if (!insideZone(start) || !insideZone(end)) { setError('Las coordenadas no pertenecen a la zona UTM seleccionada.'); return; }
      setPoints([start, ...points.slice(1, -1), end]);
      resetCalculatedRoute();
    } catch {
      setError('Las coordenadas no son válidas para el sistema seleccionado.');
    }
  };

  const addManualStep = () => {
    if (points.length < 2) { setError('Defina primero el punto inicial y el punto final.'); return; }
    setError('');
    setBlankSteps(previous => [...previous, { x: '', y: '' }]);
  };

  const updateBlankStep = (index: number, axis: 'x' | 'y', text: string) =>
    setBlankSteps(previous => previous.map((step, position) => position === index ? { ...step, [axis]: text } : step));

  const placeBlankStep = (index: number) => {
    const step = blankSteps[index];
    const values = [step.x, step.y].map(Number);
    if (step.x.trim() === '' || step.y.trim() === '' || values.some(valueNumber => !Number.isFinite(valueNumber))) {
      setError('Complete las dos coordenadas del punto de paso.');
      return;
    }
    if (coordinateType === 'GEOGRAPHIC' && (Math.abs(values[0]) > 180 || Math.abs(values[1]) > 90)) {
      setError('La longitud debe estar entre -180 y 180 y la latitud entre -90 y 90.');
      return;
    }
    const point = inputPoint([values[0], values[1]]);
    if (!insideZone(point)) { setError('El punto no pertenece a la zona UTM seleccionada.'); return; }
    setPoints(previous => [...previous.slice(0, -1), point, previous.at(-1)!]);
    setBlankSteps(previous => previous.filter((_, position) => position !== index));
    resetCalculatedRoute();
  };

  const restartTrace = () => {
    const hadConfirmedRoute = confirmed;
    setPoints([]); setBlankSteps([]); setDrafts({}); resetCalculatedRoute();
    if (hadConfirmedRoute) onClear();
  };
  const changeZone = (nextZone: number) => { setZone(nextZone); restartTrace(); };
  const changeHemisphere = (nextHemisphere: 'N' | 'S') => { setHemisphere(nextHemisphere); restartTrace(); };
  const changeCoordinateType = (nextType: 'GEOGRAPHIC' | 'UTM') => {
    if (nextType === 'UTM' && points.length > 0) {
      const nextZone = suggestedUtmZone(points[0][0]);
      const nextHemisphere: 'N' | 'S' = points[0][1] >= 0 ? 'N' : 'S';
      const view = utmZoneView(nextZone, nextHemisphere);
      setZone(nextZone); setHemisphere(nextHemisphere);
      setPoints(previous => previous.filter(point => insideZone(point, view)));
    }
    setCoordinateType(nextType);
    resetCalculatedRoute();
  };

  const draftKey = (pointIndex: number, axis: 0 | 1) => `${pointIndex}-${axis}`;
  const clearDraft = (pointIndex: number, axis: 0 | 1) => setDrafts(previous => {
    const { [draftKey(pointIndex, axis)]: _removed, ...rest } = previous;
    return rest;
  });
  const setIntermediateValue = (pointIndex: number, axis: 0 | 1, text: string) => {
    setDrafts(previous => ({ ...previous, [draftKey(pointIndex, axis)]: text }));
    if (text.trim() === '') return;
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;
    const shown = displayPoint(points[pointIndex]);
    shown[axis] = parsed;
    const next = [...points]; next[pointIndex] = inputPoint(shown);
    setPoints(next); resetCalculatedRoute();
  };

  const calculate = async () => {
    if (points.length < 2) { setError('Seleccione o introduzca un punto inicial y un punto final.'); return; }
    setIsRouting(true); setError(''); setConfirmed(false);
    try {
      const result = await calculateRoadRoute(points);
      setRoute(result.coordinates); setRoutingDistance(result.distance); setSnappedWaypoints(result.snappedWaypoints); setNames(result.waypointNames);
    } catch (routeError: any) {
      setError(`${routeError.message} Revise la conexión y ajuste los puntos intermedios.`);
    } finally { setIsRouting(false); }
  };

  const confirm = () => {
    if (route.length < 2 || points.length < 2) { setError('Calcule y revise la ruta antes de confirmarla.'); return; }
    setConfirmed(true);
    onConfirm({
      coordinateType, datum: calculationDatum, utmZone: calculationZone, hemisphere: calculationHemisphere,
      startPoint: points[0], endPoint: points.at(-1)!, intermediatePoints: points.slice(1, -1),
      snappedWaypoints, routeCoordinates: route, routingDistance, engineeringLength,
      startName: names[0] || '', endName: names.at(-1) || '',
    });
  };

  const instruction = points.length === 0
    ? '1. Seleccione en el mapa el punto inicial o escriba las coordenadas.'
    : points.length === 1
      ? '2. Seleccione ahora el punto final en el mapa.'
      : route.length === 0
        ? '3. Agregue puntos de paso si necesita orientar la trayectoria y pulse "Calcular por calles".'
        : confirmed
          ? 'Tramo confirmado. La línea verde es el eje seleccionado para la inspección.'
          : '4. Revise la línea azul y pulse "Confirmar ubicación" para aceptar el tramo.';

  return (
    <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-border-muted bg-bg-base/50 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-text-base">Ubicación y trazado vial</h4>
          <p className="text-sm text-text-muted">El trazador aproxima los puntos a vías cercanas y considera la dirección de toda la trayectoria.</p>
        </div>
        <select value={coordinateType} onChange={event => changeCoordinateType(event.target.value as 'GEOGRAPHIC' | 'UTM')} className="rounded-lg border border-border-base bg-bg-surface px-3 py-2 text-sm">
          <option value="GEOGRAPHIC">Coordenadas geográficas</option>
          <option value="UTM">Coordenadas UTM</option>
        </select>
      </div>

      {coordinateType === 'UTM' && (
        <div className="grid gap-3 rounded-lg border border-border-muted bg-bg-surface p-3 sm:grid-cols-3">
          <label className="text-sm text-text-muted">
            <span className="inline-flex items-center gap-1.5">Datum<InfoTip text="WGS 84 es el sistema del GPS y de OpenStreetMap. NAD 27 usa la elipse Clarke 1866 con la transformación media de la Zona del Canal de Panamá (dX 0, dY +125, dZ +201 m), con una precisión aproximada de ±20 m." /></span>
            <select value={datum} onChange={event => { setDatum(event.target.value as GeodeticDatum); resetCalculatedRoute(); }} className="mt-1 block w-full rounded-lg border border-border-base bg-bg-surface px-3 py-2 text-text-base">
              <option value="WGS84">WGS 84</option>
              <option value="NAD27">NAD 27 (Zona del Canal, Panamá)</option>
            </select>
          </label>
          <label className="text-sm text-text-muted">
            <span className="inline-flex items-center gap-1.5">Zona UTM<InfoTip text="Con coordenadas UTM el mapa solo muestra la franja de la zona elegida. Al cambiar de zona se borran los puntos colocados." /></span>
            <select value={zone} onChange={event => changeZone(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-border-base bg-bg-surface px-3 py-2 text-text-base">
              {Array.from({ length: 60 }, (_, index) => index + 1).map(zoneNumber => {
                const west = (zoneNumber - 31) * 6;
                return <option key={zoneNumber} value={zoneNumber}>Zona {zoneNumber} ({longitudeLabel(west)} a {longitudeLabel(west + 6)})</option>;
              })}
            </select>
          </label>
          <label className="text-sm text-text-muted">Hemisferio
            <select value={hemisphere} onChange={event => changeHemisphere(event.target.value as 'N' | 'S')} className="mt-1 block w-full rounded-lg border border-border-base bg-bg-surface px-3 py-2 text-text-base">
              <option value="N">Norte</option>
              <option value="S">Sur</option>
            </select>
          </label>
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">{instruction}</div>
      <MapCanvas route={slices.length ? undefined : route} slices={slices} points={route.length > 1 ? NO_POINTS : points} maxBounds={zoneView?.bounds} viewCenter={zoneView?.center} viewZoom={zoneView?.zoom} onMapClick={handleMapClick} routeColor={confirmed ? '#16a34a' : '#2563eb'} />
      {slices.length > 0 && <p className="text-xs text-text-muted">La ruta está dividida en {slices.length} unidades de muestra de {sliceLength!.toFixed(1)} m. Los puntos guía se ocultan mientras haya una ruta trazada; haga clic en el mapa para colocar nuevos puntos.</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => { setPoints([]); setBlankSteps([]); setDrafts({}); setRoute([]); setConfirmed(false); onClear(); }}>Borrar ruta</Button>
        <Button type="button" variant="secondary" onClick={calculate} disabled={isRouting}>{isRouting ? 'Analizando vías…' : 'Calcular por calles'}</Button>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {route.length > 1 && (
        <div className="grid sm:grid-cols-3 gap-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          <div><span className="block text-xs opacity-70">Longitud sobre el eje vial</span><strong>{routingDistance.toFixed(2)} m</strong></div>
          <div><span className="block text-xs opacity-70">Longitud UTM oficial</span><strong>{engineeringLength.toFixed(2)} m</strong></div>
          <div><span className="block text-xs opacity-70">Proyección de cálculo</span><strong>{calculationDatum} / {calculationZone}{calculationHemisphere}</strong></div>
        </div>
      )}

      <div className="rounded-xl border border-border-muted bg-bg-surface p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h5 className="font-semibold text-text-base">Entrada manual</h5>
            <p className="text-xs text-text-muted">{coordinateType === 'UTM' ? 'Este (X) y Norte (Y), en metros.' : 'Longitud (X) y Latitud (Y), en grados decimales.'}</p>
          </div>
          <Button type="button" variant="ghost" onClick={addManualStep}>Añadir punto de paso</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[90px_1fr_1fr_90px_1fr] items-center">
          <strong className="text-sm">Inicio</strong>
          <input type="number" step="any" placeholder={coordinateType === 'UTM' ? 'Este' : 'Longitud'} value={manual.startX} onChange={event => { setManual(previous => ({ ...previous, startX: event.target.value })); resetCalculatedRoute(); }} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
          <input type="number" step="any" placeholder={coordinateType === 'UTM' ? 'Norte' : 'Latitud'} value={manual.startY} onChange={event => { setManual(previous => ({ ...previous, startY: event.target.value })); resetCalculatedRoute(); }} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
          <strong className="text-sm">Final</strong>
          <input type="number" step="any" placeholder={coordinateType === 'UTM' ? 'Este' : 'Longitud'} value={manual.endX} onChange={event => { setManual(previous => ({ ...previous, endX: event.target.value })); resetCalculatedRoute(); }} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
          <input type="number" step="any" placeholder={coordinateType === 'UTM' ? 'Norte' : 'Latitud'} value={manual.endY} onChange={event => { setManual(previous => ({ ...previous, endY: event.target.value })); resetCalculatedRoute(); }} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
        </div>
        <div className="mt-3 flex justify-end"><Button type="button" variant="secondary" onClick={applyManualCoordinates}>Colocar coordenadas en el mapa</Button></div>
      </div>

      {(points.length > 2 || blankSteps.length > 0) && (
        <div className="space-y-2 rounded-lg border border-border-muted p-3">
          <h5 className="text-sm font-semibold">Puntos de paso</h5>
          {points.slice(1, -1).map((point, offset) => {
            const index = offset + 1;
            const shown = displayPoint(point);
            return (
              <div key={index} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2 items-center">
                <span className="text-sm">Paso {index}</span>
                <input type="number" step="any" value={drafts[draftKey(index, 0)] ?? shown[0]} onChange={event => setIntermediateValue(index, 0, event.target.value)} onBlur={() => clearDraft(index, 0)} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
                <input type="number" step="any" value={drafts[draftKey(index, 1)] ?? shown[1]} onChange={event => setIntermediateValue(index, 1, event.target.value)} onBlur={() => clearDraft(index, 1)} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
                <button type="button" onClick={() => { setPoints(previous => previous.filter((_, i) => i !== index)); setDrafts({}); resetCalculatedRoute(); }} className="px-2 text-danger" aria-label="Eliminar punto de paso">×</button>
              </div>
            );
          })}
          {blankSteps.map((step, offset) => (
            <div key={`blank-${offset}`} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2 items-center">
              <span className="text-sm">Paso {points.length - 1 + offset}</span>
              <input type="number" step="any" placeholder={coordinateType === 'UTM' ? 'Este' : 'Longitud'} value={step.x} onChange={event => updateBlankStep(offset, 'x', event.target.value)} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
              <input type="number" step="any" placeholder={coordinateType === 'UTM' ? 'Norte' : 'Latitud'} value={step.y} onChange={event => updateBlankStep(offset, 'y', event.target.value)} className="rounded-lg border border-border-base bg-bg-surface p-2 text-sm" />
              <div className="flex items-center gap-1">
                <Button type="button" variant="secondary" className="!px-3 !py-2" onClick={() => { setBlankSteps(previous => previous.filter((_, i) => i !== offset)); }} aria-label="Eliminar punto de paso">×</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="primary" onClick={confirm} disabled={route.length < 2}>Confirmar ubicación</Button>
      </div>
    </div>
  );
};
