import React, { useMemo } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useTranslations } from '../../../hooks/useTranslations';
import { parseCostCsv, type CsvRow } from '../../../services/agent/csv';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  fileName: string;
  onApply: (rows: CsvRow[]) => void;
}

export const CsvImportModal: React.FC<Props> = ({ isOpen, onClose, text, fileName, onApply }) => {
  const { t } = useTranslations();
  const parsed = useMemo(() => parseCostCsv(text), [text]);
  const usable = parsed.rows.filter(r => r.status === 'ok' || r.status === 'unit');
  const label = (r: CsvRow) => t(`agent.csv.status.${r.status}`);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('agent.csv.title')} containerClassName="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">{fileName}</p>
        {parsed.error ? (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{t(`agent.csv.error.${parsed.error}`)}</p>
        ) : (
          <>
            <div className="max-h-72 overflow-auto border border-border-muted rounded-lg">
              <table className="min-w-full text-sm bg-bg-surface">
                <thead className="bg-secondary/20 text-secondary-dark sticky top-0">
                  <tr><th className="text-left p-2">{t('agent.csv.line')}</th><th className="text-left p-2">id</th><th className="text-right p-2">{t('agent.b4.value')}</th><th className="text-left p-2">{t('agent.b4.unit')}</th><th className="text-left p-2">{t('agent.csv.result')}</th></tr>
                </thead>
                <tbody className="text-text-base">
                  {parsed.rows.map(r => (
                    <tr key={r.line} className="odd:bg-secondary/5">
                      <td className="p-2 font-mono">{r.line}</td>
                      <td className="p-2 font-mono">{r.id}</td>
                      <td className="p-2 text-right font-mono">{r.valor ?? '—'}</td>
                      <td className="p-2">{r.unidad || '—'}</td>
                      <td className={`p-2 font-semibold ${r.status === 'ok' ? 'text-primary-dark' : r.status === 'unit' ? 'text-amber-700 dark:text-amber-300' : 'text-danger'}`}>{label(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-text-base">{t('agent.csv.summary', { ok: usable.length, skipped: parsed.rows.length - usable.length })}</p>
          </>
        )}
        <div className="flex justify-end gap-4 pt-4 border-t border-border-muted">
          <Button variant="ghost" onClick={onClose}>{t('modal.cancel')}</Button>
          <Button disabled={usable.length === 0} onClick={() => { onApply(usable); onClose(); }}>{t('agent.csv.apply')}</Button>
        </div>
      </div>
    </Modal>
  );
};
