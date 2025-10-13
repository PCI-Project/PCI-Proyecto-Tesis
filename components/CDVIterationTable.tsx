import React from 'react';
import { CDVIterationStep } from '../types';
import { useTranslations } from '../hooks/useTranslations';

interface CDVIterationTableProps {
  allDeducts: number[];
  steps: CDVIterationStep[];
  finalCDV: number;
  m: number;
}

export const CDVIterationTable: React.FC<CDVIterationTableProps> = ({ allDeducts, steps, finalCDV, m }) => {
  const { t } = useTranslations();
  if (steps.length === 0) {
    return (
      <div className="border rounded-lg p-4 text-center text-text-muted bg-bg-muted">
        {t('cdvTable.noDeducts')}
      </div>
    );
  }
  
  // Find the step that corresponds to the final chosen CDV to highlight it
  const finalStepIndex = steps.findIndex(step => step.cdv === finalCDV);

  // Determine the raw, un-adjusted deducts to show in the informational first row
  const numInitialDeductsToShow = Math.min(allDeducts.length, Math.ceil(m));
  const initialRawDeducts = allDeducts.slice(0, numInitialDeductsToShow);

  return (
    <div className="overflow-x-auto border border-border-muted rounded-lg">
      <table className="min-w-full bg-bg-surface text-sm text-center">
        <thead className="bg-primary text-text-inverted">
          <tr>
            <th className="py-2 px-3 uppercase font-semibold text-xs">#</th>
            {allDeducts.map((_, index) => (
              <th key={index} className="py-2 px-2 uppercase font-semibold text-xs">
                DV{index + 1}
              </th>
            ))}
            <th className="py-2 px-3 uppercase font-semibold text-xs">Total (TDV)</th>
            <th className="py-2 px-3 uppercase font-semibold text-xs">q</th>
            <th className="py-2 px-3 uppercase font-semibold text-xs">CDV</th>
          </tr>
        </thead>
        <tbody className="text-text-base">
          <tr 
            className="bg-bg-muted/50 border-t border-b border-dashed border-border-muted"
            title={t('cdvTable.initialDeductsHint', { m: m.toFixed(2) })}
          >
            <td className="py-1 px-3 text-text-muted font-semibold italic text-xs text-left">{t('cdvTable.initialDeducts')}</td>
            {allDeducts.map((_, deductIndex) => (
              <td key={deductIndex} className="py-1 px-2 font-semibold text-text-base">
                {initialRawDeducts.length > deductIndex ? initialRawDeducts[deductIndex].toFixed(1) : ''}
              </td>
            ))}
            <td colSpan={3} className="py-1 px-3"></td>
          </tr>
          {steps.map((step, stepIndex) => (
            <tr 
              key={stepIndex} 
              className={`border-t border-border-muted ${stepIndex === finalStepIndex ? 'bg-primary/20 font-bold' : ''}`}
              title={stepIndex === finalStepIndex ? t('cdvTable.maxCdvHint') : ''}
            >
              <td className="py-2 px-3 text-text-muted">{stepIndex + 1}</td>
              {allDeducts.map((_, deductIndex) => (
                <td key={deductIndex} className="py-2 px-2">
                  {step.deductsUsed.length > deductIndex ? step.deductsUsed[deductIndex].toFixed(1) : ''}
                </td>
              ))}
              <td className="py-2 px-3">{step.totalDeductValue.toFixed(1)}</td>
              <td className="py-2 px-3">{step.q}</td>
              <td className="py-2 px-3 text-danger">{step.cdv.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};