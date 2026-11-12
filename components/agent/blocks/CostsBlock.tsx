import React, { useRef, useState } from 'react';
import type { AgentConfig } from '../../../types';
import { useTranslations } from '../../../hooks/useTranslations';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button } from '../../ui/Button';
import { ConfirmationModal } from '../../ui/ConfirmationModal';
import { costRows, countExampleCosts } from '../../../services/agent/analysis';
import { treatmentName } from '../../../services/agent/catalogUi';
import { costTemplateCsv, type CsvRow } from '../../../services/agent/csv';
import { downloadText } from '../../../services/agent/runs';
import { CsvImportModal } from '../modals/CsvImportModal';

const CURRENCIES = ['USD', 'PAB'];

interface Props {
  config: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
  onSaveDefaults: () => void;
  defaultsSaved: boolean;
}

export const CostsBlock: React.FC<Props> = ({ config, onChange, onSaveDefaults, defaultsSaved }) => {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const rows = costRows(config);
  const counts = countExampleCosts(config);

  const setCost = (id: string, unit: 'm2' | 'm' | 'global', raw: string) => {
    const next = { ...config.unitCosts };
    if (raw.trim() === '') delete next[id];
    else next[id] = { ...next[id], valor: Number(raw), unidad: unit };
    onChange({ unitCosts: next });
  };
  const setSource = (id: string, text: string) => {
    const current = config.unitCosts[id];
    if (!current) return;
    const { fuente: _old, ...rest } = current;
    onChange({ unitCosts: { ...config.unitCosts, [id]: text.trim() === '' ? rest : { ...rest, fuente: text } } });
  };
  const applyCsv =(list: CsvRow[]) => {
    const next = { ...config.unitCosts };
    list.forEach(r => {
      const unit = (rows.find(x => x.id === r.id)?.unit ?? 'm2') as 'm2' | 'm' | 'global';
      next[r.id] = { valor: r.valor as number, unidad: unit, ...(r.fuente ? { fuente: r.fuente } : {}) };
    });
    onChange({ unitCosts: next });
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    setCsv({ name: file.name, text: await file.text() });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-text-muted" htmlFor="agent-currency">{t('agent.b4.currency')}</label>
        <select id="agent-currency" className="border border-border-base rounded-xl bg-bg-surface text-text-base p-2" value={config.currency} onChange={e => onChange({ currency: e.target.value })}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-text-muted">{t('agent.b4.counts', { own: counts.own, example: counts.example })}</span>
      </div>

      {counts.example > 0 && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 p-3 text-sm">{t('agent.b4.exampleWarning')}</p>
      )}

      <div className="overflow-x-auto border border-border-muted rounded-lg">
        <table className="min-w-full text-sm bg-bg-surface">
          <thead className="bg-secondary/20 text-secondary-dark">
            <tr>
              <th className="text-left p-2 font-semibold">{t('agent.b4.treatment')}</th>
              <th className="text-left p-2 font-semibold">{t('agent.b4.unit')}</th>
              <th className="text-right p-2 font-semibold">{t('agent.b4.value')} ({config.currency})</th>
              <th className="text-left p-2 font-semibold">{t('agent.b4.source')}</th>
            </tr>
          </thead>
          <tbody className="text-text-base">
            {rows.map(row => {
              const own = config.unitCosts[row.id];
              const invalid = own !== undefined && (!Number.isFinite(own.valor) || own.valor < 0);
              return (
                <tr key={row.id} className="odd:bg-secondary/5">
                  <td className="p-2">{treatmentName(row.id, language)}</td>
                  <td className="p-2 text-text-muted">{t(`agent.unit.${row.unit}`)}</td>
                  <td className="p-2 text-right">
                    <input
                      type="number" min="0" step="0.01"
                      aria-label={`${treatmentName(row.id, language)} — ${t('agent.b4.value')}`}
                      aria-invalid={invalid}
                      className={`w-28 text-right font-mono rounded-lg border p-1.5 bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 ${invalid ? 'border-danger' : 'border-border-base'}`}
                      value={own ? own.valor : ''}
                      placeholder={row.exampleCost.toFixed(2)}
                      onChange={e => setCost(row.id, row.unit, e.target.value)}
                    />
                  </td>
                  <td className="p-2 text-xs text-text-muted">
                    {own ? (
                      <input
                        type="text" maxLength={120}
                        aria-label={`${treatmentName(row.id, language)} — ${t('agent.b4.source')}`}
                        className="w-full min-w-[9rem] rounded-lg border border-border-base p-1.5 bg-bg-surface text-text-base text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                        value={own.fuente ?? ''}
                        placeholder={t('agent.b4.sourcePlaceholder')}
                        onChange={e => setSource(row.id, e.target.value)}
                      />
                    ) : t('agent.b4.example')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label={t('agent.b4.import')} onChange={e => onFile(e.target.files?.[0])} />
        <Button type="button" variant="ghost" className="border border-border-base" onClick={() => fileRef.current?.click()}>{t('agent.b4.import')}</Button>
        <Button type="button" variant="ghost" className="border border-border-base" onClick={() => downloadText('costos_plantilla.csv', costTemplateCsv(), 'text/csv')}>{t('agent.b4.template')}</Button>
        <Button type="button" variant="ghost" className="border border-border-base" onClick={onSaveDefaults}>{defaultsSaved ? t('agent.b4.saved') : t('agent.b4.saveMine')}</Button>
        <Button type="button" variant="ghost" className="border border-border-base" onClick={() => setConfirmReset(true)} disabled={counts.own === 0}>{t('agent.b4.reset')}</Button>
      </div>

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); onChange({ unitCosts: {} }); }}
        title={t('agent.b4.resetTitle')}
        confirmText={t('agent.b4.resetConfirm')}
      >
        <p>{t('agent.b4.resetText', { n: counts.own })}</p>
      </ConfirmationModal>

      {csv && <CsvImportModal isOpen onClose={() => setCsv(null)} text={csv.text} fileName={csv.name} onApply={applyCsv} />}
    </div>
  );
};
