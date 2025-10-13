import React, { useMemo } from 'react';
import { DistressSummary } from '../types';
import { useTranslations } from '../hooks/useTranslations';

interface DistressSummaryTableProps {
  summaries: DistressSummary[];
}

export const DistressSummaryTable: React.FC<DistressSummaryTableProps> = ({ summaries }) => {
  const { t } = useTranslations();
  if (summaries.length === 0) {
    return (
      <div className="border rounded-lg p-4 text-center text-text-muted bg-bg-muted">
        {t('summaryTable.noDistresses')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border-muted rounded-lg">
      <table className="min-w-full bg-bg-surface text-sm">
        <thead className="bg-primary text-text-inverted">
          <tr>
            <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('summaryTable.distress')}</th>
            <th className="text-right py-2 px-3 uppercase font-semibold text-xs">{t('summaryTable.density')} (%)</th>
            <th className="text-right py-2 px-3 uppercase font-semibold text-xs">{t('summaryTable.deductValue')}</th>
          </tr>
        </thead>
        <tbody className="text-text-muted">
          {summaries.map((s) => (
            <tr key={`${s.type}-${s.severity}`} className="border-t border-border-muted">
              <td className="py-2 px-3">
                <span className="text-text-base">{`${s.type}. ${t(s.nameKey)}`}</span>
                <span className="block text-xs">{s.severity} - {t('summaryTable.totalQuantity')}: {s.quantity.toFixed(1)}</span>
              </td>
              <td className="py-2 px-3 text-right font-medium text-text-base">
                {s.density === null ? 'N/A' : s.density.toFixed(2)}
              </td>
              <td className="py-2 px-3 text-right font-bold text-danger">{s.deductValue.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};