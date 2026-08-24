import React, { useState, useEffect } from 'react';
import { Sample, Distress, Severity } from '../types';
import { getDistressOptions } from '../constants';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useTranslations } from '../hooks/useTranslations';

interface SampleCardProps {
  sample: Sample;
  sectionWidth: number;
  sectionStartStation: number;
  sectionSampleUnitLength: number;
  isSystematicSupplement?: boolean;
  onUpdate: (updatedSample: Sample) => void;
  onDelete: (sampleId: number) => void;
}

const PlusIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const TrashIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const evaluateMathExpr = (expr: string): number => {
  if (!expr) return 0;
  const sanitizedExpr = expr.trim().replace(/x/gi, '*').replace(/,/g, '.');
  if (/[^0-9.*+]/.test(sanitizedExpr)) return 0;
  try {
    const result = new Function(`return ${sanitizedExpr}`)();
    if (typeof result === 'number' && isFinite(result)) return result;
    return 0;
  } catch (e) {
    return 0;
  }
};

const initialQuantities = (distresses: Distress[]): Record<string, string> => {
    return distresses.reduce((acc, d) => {
        acc[d.id] = d.quantity > 0 ? String(d.quantity) : '';
        return acc;
    }, {} as Record<string, string>);
};

const formatStation = (station: number): string => {
    const km = Math.floor(station / 1000);
    const m = station % 1000;
    return `${km}+${m.toFixed(2).padStart(6, '0')}`;
};

const getSeverityColorClass = (severity: Severity): string => {
  return {
    [Severity.HIGH]: 'bg-red-500',
    [Severity.MEDIUM]: 'bg-yellow-400',
    [Severity.LOW]: 'bg-green-500',
  }[severity] || 'bg-gray-400';
};

export const SampleCard: React.FC<SampleCardProps> = ({ sample, sectionWidth, sectionStartStation, sectionSampleUnitLength, isSystematicSupplement, onUpdate, onDelete }) => {
  const { t } = useTranslations();
  const [localQuantities, setLocalQuantities] = useState<Record<string, string>>({});
  
  useEffect(() => {
    setLocalQuantities(initialQuantities(sample.distresses));
  }, [sample.distresses]);

  const distressOptions = getDistressOptions();
  
  const sampleLength = sectionWidth > 0 ? sample.area / sectionWidth : 0;
  const sampleStartStation = sectionStartStation + (sample.id - 1) * sectionSampleUnitLength;
  const sampleEndStation = sampleStartStation + sampleLength;

  const handleDistressChange = (id: string, field: keyof Omit<Distress, 'id' | 'quantity'>, value: any) => {
    const updatedSample = { ...sample, distresses: sample.distresses.map(d => {
      if (d.id === id) {
        const newDistress = { ...d, [field]: value };
        if (field === 'type') {
            const distressInfo = distressOptions.find(opt => opt.id === value);
            const availableSeverities = distressInfo?.severities || Object.values(Severity);
            if (!availableSeverities.includes(newDistress.severity)) {
                newDistress.severity = availableSeverities[0];
            }
        }
        return newDistress;
      }
      return d;
    })};
    onUpdate(updatedSample);
  };
  
  const handleQuantityChange = (id: string, textValue: string) => {
    setLocalQuantities(prev => ({ ...prev, [id]: textValue }));
  };

  const commitQuantityChange = (id: string, textValue: string) => {
    const numericValue = evaluateMathExpr(textValue);
    onUpdate({ ...sample, distresses: sample.distresses.map(d => d.id === id ? { ...d, quantity: numericValue } : d)});
    setLocalQuantities(prev => ({...prev, [id]: numericValue > 0 ? String(numericValue) : ''}));
  };

  const addDistress = () => {
    const newDistress: Distress = {
      id: Date.now().toString(),
      type: distressOptions[0].id,
      severity: Severity.LOW,
      quantity: 0,
    };
    setLocalQuantities(prev => ({...prev, [newDistress.id]: ''}))
    onUpdate({ ...sample, distresses: [...sample.distresses, newDistress] });
  };

  const removeDistress = (id: string) => {
    onUpdate({ ...sample, distresses: sample.distresses.filter(d => d.id !== id) });
    setLocalQuantities(prev => {
      const newQuantities = {...prev};
      delete newQuantities[id];
      return newQuantities;
    })
  };
  
  return (
    <Card className="border border-border-muted/50">
      <div className='md:flex justify-between items-start border-b border-border-muted pb-4 mb-4'>
        <div className='mb-4 md:mb-0'>
            <h3 className="text-xl font-bold text-primary flex items-center">
                {t('sampleCard.title')} #{sample.id}
                {sample.isAdditional && (
                    <span className="ml-3 text-xs font-semibold bg-accent text-accent-text px-2 py-1 rounded-full">
                        {t('sampleCard.additional')}
                    </span>
                )}
                {isSystematicSupplement && (
                    <span
                        className="ml-3 text-xs font-semibold bg-secondary/20 text-secondary-dark px-2 py-1 rounded-full"
                        title={t('sampleCard.systematicSupplementHint')}
                    >
                        {t('sampleCard.systematicSupplement')}
                    </span>
                )}
            </h3>
            <p className="text-sm text-text-muted mt-1">{t('sampleCard.stationing')}: 
                <span className='font-mono font-medium'> {formatStation(sampleStartStation)}</span> a 
                <span className='font-mono font-medium'> {formatStation(sampleEndStation)}</span>
            </p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="block text-sm font-medium text-text-muted">{t('sampleCard.dimensions')}</span>
              <p className="mt-1 font-semibold text-text-base">
                {sampleLength.toFixed(1)}m &times; {sectionWidth.toFixed(1)}m
              </p>
            </div>
            {sample.isAdditional && (
                <Button variant="ghost" onClick={() => onDelete(sample.id)} className="!p-2.5 !rounded-full !text-danger hover:!bg-danger/10">
                    <TrashIcon />
                </Button>
            )}
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-text-base">{t('sampleCard.distressLogTitle')}</h4>
            <Button onClick={addDistress} variant="secondary" className="inline-flex items-center !text-sm !py-1.5 !px-3 !shadow-md">
                <PlusIcon /> {t('sampleCard.addDistress')}
            </Button>
        </div>
        <div className="overflow-x-auto border border-border-muted rounded-lg">
            <table className="min-w-full bg-bg-surface text-sm">
                <thead className="bg-secondary/20 text-secondary-dark">
                    <tr>
                        <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider w-[45%]">{t('sampleCard.tableDistressType')}</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider w-[20%]">{t('sampleCard.tableSeverity')}</th>
                        <th className="py-2 px-3 text-left text-xs font-semibold uppercase tracking-wider w-[25%]">{t('sampleCard.tableQuantity')}</th>
                        <th className="py-2 px-3 text-center text-xs font-semibold uppercase tracking-wider w-[10%]">{t('sampleCard.tableAction')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                    {sample.distresses.length > 0 ? (
                        sample.distresses.map(distress => {
                          const distressInfo = distressOptions.find(opt => opt.id === distress.type);
                          const availableSeverities = distressInfo?.severities || Object.values(Severity);
                          const isSeverityLocked = availableSeverities.length === 1;
                          const indicatorColorClass = getSeverityColorClass(distress.severity);

                          return (
                            <tr key={distress.id} className="odd:bg-bg-base/50 hover:bg-primary/5 transition-colors duration-150">
                                <td className="p-2 align-top">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-1 h-5 rounded-full flex-shrink-0 ${indicatorColorClass}`} aria-hidden="true"></span>
                                    <select 
                                        value={distress.type} 
                                        onChange={e => handleDistressChange(distress.id, 'type', e.target.value)}
                                        className="w-full text-sm block border-border-muted rounded-md shadow-sm focus:ring-primary focus:border-primary bg-bg-surface text-text-base py-1.5"
                                    >
                                        {distressOptions.map(opt => <option key={opt.id} value={opt.id}>{`${opt.id}. ${t(opt.nameKey)}`}</option>)}
                                    </select>
                                  </div>
                                </td>
                                <td className="p-2 align-top">
                                    <select 
                                        value={distress.severity}
                                        onChange={e => handleDistressChange(distress.id, 'severity', e.target.value)}
                                        disabled={isSeverityLocked}
                                        className="w-full text-sm block border-border-muted rounded-md shadow-sm focus:ring-primary focus:border-primary bg-bg-surface text-text-base disabled:bg-bg-base/60 disabled:text-text-muted/50 py-1.5"
                                    >
                                        {availableSeverities.map(sev => <option key={sev} value={sev}>{sev}</option>)}
                                    </select>
                                </td>
                                <td className="p-2 align-top">
                                    <Input
                                        type="text" 
                                        value={localQuantities[distress.id] || ''}
                                        onChange={e => handleQuantityChange(distress.id, e.target.value)}
                                        onBlur={(e) => commitQuantityChange(distress.id, e.currentTarget.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                commitQuantityChange(distress.id, (e.target as HTMLInputElement).value);
                                                e.preventDefault(); 
                                            }
                                        }}
                                        className="text-sm !py-1.5"
                                        placeholder={t('sampleCard.quantityPlaceholder')}
                                    />
                                </td>
                                <td className="p-2 align-top text-center">
                                    <Button variant="ghost" onClick={() => removeDistress(distress.id)} className="!p-2 !rounded-full !text-danger hover:!bg-danger/10 hover:scale-110">
                                        <TrashIcon />
                                    </Button>
                                </td>
                            </tr>
                          )
                        })
                    ) : (
                        <tr>
                            <td colSpan={4} className="text-center py-10 text-text-muted bg-bg-base/40">
                                <p className="font-semibold">{t('sampleCard.noDistresses')}</p>
                                <p className="text-xs mt-1">{t('sampleCard.noDistressesHint')}</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </Card>
  );
};