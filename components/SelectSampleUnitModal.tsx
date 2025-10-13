import React from 'react';
import { useTranslations } from '../hooks/useTranslations';
import { Button } from './ui/Button';

interface SelectSampleUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sampleId: number) => void;
  totalUnits: number;
  existingSampleIds: number[];
}

export const SelectSampleUnitModal: React.FC<SelectSampleUnitModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  totalUnits,
  existingSampleIds,
}) => {
  const { t } = useTranslations();

  // Prevent body scroll when modal is open. This must be at the top level.
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);
  
  if (!isOpen) {
    return null;
  }

  const allUnits = Array.from({ length: totalUnits }, (_, i) => i + 1);

  return (
    <div
      className="fixed inset-0 bg-text-base bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-bg-surface rounded-xl shadow-xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-base mb-4">{t('dataEntry.selectSampleToAdd')}</h2>
          <div className="text-text-muted mb-6 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                {allUnits.map(unitId => {
                    const isExisting = existingSampleIds.includes(unitId);
                    return (
                        <button
                            key={unitId}
                            disabled={isExisting}
                            onClick={() => onSelect(unitId)}
                            className={`
                                w-full aspect-square rounded-lg flex items-center justify-center font-semibold border
                                transition-colors duration-150
                                ${isExisting 
                                    ? 'bg-border-muted/50 text-text-muted/60 cursor-not-allowed border-border-muted' 
                                    : 'bg-bg-surface text-secondary-dark border-secondary hover:bg-secondary/20'
                                }
                            `}
                            aria-label={`${t('dataEntry.unit')} ${unitId}`}
                        >
                            {unitId}
                        </button>
                    );
                })}
            </div>
            {allUnits.length === existingSampleIds.length && (
                <p className='text-center text-text-muted mt-4'>{t('dataEntry.allUnitsSelected')}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border-muted">
            <Button variant="secondary" onClick={onClose} className="!bg-bg-base !text-text-base hover:!bg-border-muted !shadow-none">
              {t('modal.close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
