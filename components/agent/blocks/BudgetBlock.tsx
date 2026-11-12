import React from 'react';
import type { AgentConfig } from '../../../types';
import { useTranslations } from '../../../hooks/useTranslations';
import { Input } from '../../ui/Input';
import { InfoTip } from '../../ui/InfoTip';
import { defaultThresholds, validThresholds } from '../../../services/agent/levels';
import { thresholdsOf } from '../../../services/agent/analysis';
import { checkClasses, ErrorHint, FieldRow, Segmented } from '../controls';
import { changedParams, PARAM_FIELDS, paramOverride, paramValid, setParam } from '../../../services/agent/params';

interface Props {
  config: AgentConfig;
  onChange: (patch: Partial<AgentConfig>) => void;
}

const KEYS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;

export const BudgetBlock: React.FC<Props> = ({ config, onChange }) => {
  const { t } = useTranslations();
  const noCap = config.budget === null;
  const thresholds = thresholdsOf(config);
  const thresholdsOk = validThresholds(config.pciThresholds);
  const customThresholds = KEYS.some(k => thresholds[k] !== defaultThresholds[k]);
  const setThreshold = (key: typeof KEYS[number], raw: string) => {
    const next = { ...thresholds, [key]: raw === '' ? NaN : Number(raw) };
    const same = KEYS.every(k => next[k] === defaultThresholds[k]);
    onChange({ pciThresholds: same ? undefined : next });
  };
  const contingencyBad = !Number.isFinite(config.contingencyPct) || config.contingencyPct < 0 || config.contingencyPct > 30;
  const budgetBad = config.budget !== null && (!Number.isFinite(config.budget) || config.budget <= 0);

  const diagnostic = config.analysisMode === 'diagnostico'; // C1: sin presupuesto, imprevistos ni prioridad

  return (
    <div>
      {diagnostic && <p className="text-sm text-text-muted pb-2">{t('agent.mode.b5Note')}</p>}
      {!diagnostic && <>
      <FieldRow label={t('agent.b5.budget')} hint={budgetBad ? <ErrorHint>{t('agent.issues.invalidBudget')}</ErrorHint> : <p className="text-xs text-text-muted">{noCap ? t('agent.b5.noCapHint') : t('agent.b5.capHint')}</p>}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 max-w-[16rem]">
            <Input type="number" min="0" step="100" aria-label={t('agent.b5.budget')} disabled={noCap} value={config.budget === null || Number.isNaN(config.budget) ? '' : config.budget} onChange={e => onChange({ budget: e.target.value === '' ? NaN : Number(e.target.value) })} />
            <span className="text-sm text-text-muted">{config.currency}</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-text-base">
            <input type="checkbox" className={checkClasses} checked={noCap} onChange={e => onChange({ budget: e.target.checked ? null : 100000 })} />
            {t('agent.b5.noCap')}
          </label>
        </div>
      </FieldRow>

      <FieldRow label={t('agent.b5.contingency')} hint={contingencyBad ? <ErrorHint>{t('agent.issues.invalidContingency')}</ErrorHint> : undefined}>
        <div className="flex items-center gap-3 max-w-md">
          <input type="range" min="0" max="30" step="1" aria-label={t('agent.b5.contingency')} className="flex-1 accent-primary" value={Number.isFinite(config.contingencyPct) ? config.contingencyPct : 0} onChange={e => onChange({ contingencyPct: Number(e.target.value) })} />
          <div className="w-20"><Input type="number" min="0" max="30" aria-label={t('agent.b5.contingency')} value={Number.isFinite(config.contingencyPct) ? config.contingencyPct : ''} onChange={e => onChange({ contingencyPct: e.target.value === '' ? NaN : Number(e.target.value) })} /></div>
          <span className="text-sm text-text-muted">%</span>
        </div>
      </FieldRow>

      <FieldRow label={t('agent.b5.mode')} hint={<p className="text-xs text-text-muted">{config.priorityMode === 'costo_beneficio' ? t('agent.b5.modeBcHelp') : t('agent.b5.modeWorstHelp')}</p>}>
        <Segmented
          ariaLabel={t('agent.b5.mode')}
          value={config.priorityMode}
          onChange={value => onChange({ priorityMode: value })}
          options={[{ value: 'costo_beneficio', label: t('agent.mode.bcShort') }, { value: 'peor_primero', label: t('agent.mode.worstShort') }]}
        />
      </FieldRow>
      </>}

      <details className="mt-3 rounded-lg border border-border-muted p-3" open={customThresholds || !thresholdsOk || changedParams(config) > 0}>
        <summary className="cursor-pointer text-sm font-semibold text-text-base">{t('agent.b5.advanced')}</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-text-muted">{t('agent.b5.thresholdsHelp')} <InfoTip text={t('agent.b5.thresholdsInfo')} /></p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {KEYS.map(key => (
              <div key={key}>
                <label className="block text-xs font-semibold text-text-muted mb-1" htmlFor={`thr-${key}`}>{key} ≥</label>
                <Input id={`thr-${key}`} type="number" min="1" max="99" step="1" value={Number.isFinite(thresholds[key]) ? thresholds[key] : ''} onChange={e => setThreshold(key, e.target.value)} />
                <p className="text-xs text-text-muted mt-1">{t(`agent.level.${key}`)}</p>
              </div>
            ))}
          </div>
          {!thresholdsOk && <ErrorHint>{t('agent.issues.invalidThresholds')}</ErrorHint>}
          {(['curve', 'factors'] as const).map(group => (
            <div key={group} className="pt-3 border-t border-dashed border-border-muted">
              <p className="text-sm font-semibold text-text-base mb-1">{t(`agent.b5.group.${group}`)}</p>
              <p className="text-xs text-text-muted mb-2">{t(`agent.b5.group.${group}Help`)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PARAM_FIELDS.filter(f => f.group === group).map(f => {
                  const value = paramOverride(config, f);
                  const ok = paramValid(config, f);
                  return (
                    <div key={f.id}>
                      <label className="block text-xs font-semibold text-text-muted mb-1" htmlFor={`param-${f.id}`}>{t(`agent.param.${f.id}`)}</label>
                      <Input id={`param-${f.id}`} type="number" min={f.min} max={f.max} step={f.step} aria-invalid={!ok} value={value ?? ''} placeholder={String(f.def)} onChange={e => onChange({ parameters: setParam(config, f, e.target.value) })} />
                      <p className={`text-xs mt-1 ${ok ? 'text-text-muted' : 'font-semibold text-danger'}`}>{ok ? `${t(`agent.param.origin.${f.origin}`)} · ${t('agent.param.default', { v: f.def })}` : t('agent.b2.range', { min: f.min, max: f.max })}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" className="text-sm font-semibold text-primary underline disabled:opacity-40" disabled={!customThresholds && changedParams(config) === 0} onClick={() => onChange({ pciThresholds: undefined, parameters: undefined })}>{t('agent.b5.resetThresholds')}</button>
        </div>
      </details>
    </div>
  );
};
