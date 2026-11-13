import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useTranslations } from '../../hooks/useTranslations';

export interface SampleDistressRow {
  type: string;
  nameKey: string;
  severity: string;
  quantity: number;
  density: number | null;
  deductValue: number;
}

interface SampleDistressesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  pci?: string;
  area?: number;
  distresses: SampleDistressRow[];
}

const SEVERITY: Record<string, { label: string; className: string }> = {
  L: { label: 'Baja', className: 'bg-green-100 text-green-800' },
  M: { label: 'Media', className: 'bg-amber-100 text-amber-800' },
  H: { label: 'Alta', className: 'bg-red-100 text-red-800' },
};

// Cuadro flotante con las fallas registradas en una unidad de muestra. Se monta en <body> porque
// las tarjetas de la página usan transformaciones que descolocarían un elemento "fixed".
export const SampleDistressesDialog: React.FC<SampleDistressesDialogProps> = ({ isOpen, onClose, title, subtitle, pci, area, distresses }) => {
  const { t } = useTranslations();
  if (!isOpen) return null;

  return createPortal(
    <Modal isOpen={isOpen} onClose={onClose} title={title} containerClassName="max-w-3xl">
      {subtitle && <p className="-mt-2 mb-4 text-sm text-text-muted">{subtitle}</p>}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {pci !== undefined && <span className="rounded-full bg-primary/15 px-3 py-1 font-semibold text-text-base">PCI: {pci}</span>}
        {area !== undefined && <span className="rounded-full bg-bg-base px-3 py-1 font-semibold text-text-base">Área de la unidad: {area.toFixed(1)} m²</span>}
        <span className="rounded-full bg-bg-base px-3 py-1 font-semibold text-text-base">Fallas registradas: {distresses.length}</span>
      </div>

      {distresses.length === 0 ? (
        <p className="rounded-lg border border-border-muted p-4 text-center text-text-muted">No se registraron fallas en esta unidad.</p>
      ) : (
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-border-muted">
          <table className="min-w-full bg-bg-surface text-sm">
            <thead className="sticky top-0 bg-primary text-text-inverted">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase">Falla</th>
                <th className="py-2 px-3 text-left text-xs font-semibold uppercase">Severidad</th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase">Cantidad <span className="normal-case">(m², m o ud.)</span></th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase">Densidad (%)</th>
                <th className="py-2 px-3 text-right text-xs font-semibold uppercase">Valor deducido</th>
              </tr>
            </thead>
            <tbody className="text-text-base">
              {distresses.map(row => {
                const severity = SEVERITY[row.severity];
                return (
                  <tr key={`${row.type}-${row.severity}`} className="border-t border-border-muted">
                    <td className="py-2 px-3 font-medium">{row.type}. {t(row.nameKey)}</td>
                    <td className="py-2 px-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${severity?.className || 'bg-bg-base'}`}>{severity ? `${severity.label} (${row.severity})` : row.severity}</span></td>
                    <td className="py-2 px-3 text-right font-mono">{row.quantity.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono">{row.density === null ? 'N/A' : row.density.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-danger">{row.deductValue.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button type="button" variant="primary" onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>,
    document.body,
  );
};
