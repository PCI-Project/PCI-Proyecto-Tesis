import React, { useState } from 'react';
import type { Project, SectionContext } from '../../../types';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { InfoTip } from '../../ui/InfoTip';
import { useTranslations } from '../../../hooks/useTranslations';
import { useLanguage } from '../../../contexts/LanguageContext';
import { ctxOf, invalidContextFields, levelOfSection, sectionAssumptions } from '../../../services/agent/analysis';
import { CURB_MIN_CM, TREATMENTS, treatmentName } from '../../../services/agent/catalogUi';
import type { AgentConfig } from '../../../types';
import { AssumeHint, ErrorHint, FieldRow, Segmented, selectClasses } from '../controls';
import { CopyContextModal } from '../modals/CopyContextModal';
import { LevelChip } from './ReceivedDataBlock';

const FUNCTIONAL = ['arterial', 'colectora', 'local', 'rural_primaria', 'rural_secundaria'];

interface Props {
  project: Project;
  config: AgentConfig;
  contexts: Record<string, SectionContext | null>;
  activeId: string;
  onActiveChange: (id: string) => void;
  onChange: (sectionId: string, next: SectionContext) => void;
  onCopy: (sourceId: string, targetIds: string[]) => void;
}

const numberOrNull = (value: string): number | null => (value.trim() === '' ? null : Number(value));

export const SectionContextBlock: React.FC<Props> = ({ project, config, contexts, activeId, onActiveChange, onChange, onCopy }) => {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const [copyOpen, setCopyOpen] = useState(false);
  const section = project.sections.find(s => s.id === activeId) ?? project.sections[0];
  if (!section) return null;
  const ctx = ctxOf(section, contexts);
  const assumptions = sectionAssumptions(ctx);
  const invalid = invalidContextFields(ctx);
  const level = levelOfSection(section, config);
  const set = (patch: Partial<SectionContext>) => onChange(section.id, { ...ctx, ...patch });
  const statusOf = (id: string): 'ok' | 'warn' | 'error' => {
    const c = ctxOf(project.sections.find(s => s.id === id)!, contexts);
    if (invalidContextFields(c).length) return 'error';
    return sectionAssumptions(c).length ? 'warn' : 'ok';
  };
  const dotClass = (id: string) => ({ error: 'bg-danger', warn: 'bg-amber-500', ok: 'bg-primary' })[statusOf(id)];
  const yearNow = new Date().getFullYear();

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label={t('agent.b2.sections')}>
        {project.sections.map(s => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === section.id}
            onClick={() => onActiveChange(s.id)}
            className={`flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-xl border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${s.id === section.id ? 'bg-primary text-text-inverted border-primary' : 'bg-bg-surface text-text-base border-border-base hover:border-primary'}`}
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.id === section.id ? 'bg-white' : dotClass(s.id)}`} aria-hidden="true" />
            {s.name}
            <span className="sr-only"> — {t(`agent.status.${statusOf(s.id)}`)}</span>
          </button>
        ))}
      </div>

      <p className="font-semibold text-text-base mb-1">
        {section.name} · PCI {section.pci != null ? section.pci.toFixed(1) : '—'} {level && <><LevelChip level={level} /> <span className="font-normal text-text-muted">{t(`agent.level.${level}`)}</span></>}
      </p>

      <FieldRow label={t('agent.b2.roadType')} hint={ctx.roadType === null ? <AssumeHint>{t('agent.assume.roadType')}</AssumeHint> : ctx.roadType === 'rural' ? <p className="text-xs text-text-muted">{t('agent.b2.ruralHint')}</p> : undefined}>
        <Segmented
          ariaLabel={t('agent.b2.roadType')}
          value={ctx.roadType}
          onChange={value => set({ roadType: value, ...(value === 'rural' ? { curbHeightCm: null } : {}) })}
          options={[{ value: 'urbana', label: t('agent.b2.urban') }, { value: 'rural', label: t('agent.b2.rural') }]}
        />
      </FieldRow>

      <FieldRow
        label={t('agent.b2.curb')}
        hint={ctx.roadType === 'rural' ? <p className="text-xs text-text-muted">{t('agent.b2.curbNA')}</p> : invalid.includes('curb') ? <ErrorHint>{t('agent.b2.range', { min: 0, max: 40 })}</ErrorHint> : ctx.curbHeightCm === null ? <AssumeHint>{t('agent.assume.curb')}</AssumeHint> : <p className="text-xs text-text-muted">{ctx.curbHeightCm >= CURB_MIN_CM ? t('agent.b2.curbOk', { min: CURB_MIN_CM }) : t('agent.b2.curbLow', { min: CURB_MIN_CM })}</p>}
      >
        {ctx.roadType !== 'rural' && (
          <div className="max-w-[12rem]"><Input type="number" step="0.5" min="0" aria-label={t('agent.b2.curb')} value={ctx.curbHeightCm ?? ''} onChange={e => set({ curbHeightCm: numberOrNull(e.target.value) })} placeholder="cm" /></div>
        )}
      </FieldRow>

      <FieldRow
        label={t('agent.b2.traffic')}
        hint={invalid.includes('esal') ? <ErrorHint>{t('agent.b2.range', { min: 0, max: 200 })}</ErrorHint> : assumptions.includes('traffic') ? <AssumeHint>{t('agent.assume.traffic')}</AssumeHint> : undefined}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            ariaLabel={t('agent.b2.traffic')}
            value={ctx.trafficInput}
            onChange={value => set({ trafficInput: value })}
            options={[{ value: 'esal', label: 'ESAL' }, { value: 'clase', label: t('agent.b2.trafficClass') }]}
          />
          {ctx.trafficInput === 'esal' ? (
            <div className="flex items-center gap-2 max-w-[14rem]"><Input type="number" step="0.1" min="0" aria-label="ESAL" value={ctx.esalMillions ?? ''} onChange={e => set({ esalMillions: numberOrNull(e.target.value) })} /><span className="text-sm text-text-muted whitespace-nowrap">{t('agent.b2.million')}</span></div>
          ) : (
            <Segmented
              ariaLabel={t('agent.b2.trafficClass')}
              value={ctx.trafficClass}
              onChange={value => set({ trafficClass: value })}
              options={[{ value: 'bajo', label: t('agent.b2.low') }, { value: 'medio', label: t('agent.b2.medium') }, { value: 'alto', label: t('agent.b2.high') }]}
            />
          )}
          <InfoTip text={t('agent.b2.trafficInfo')} />
        </div>
      </FieldRow>

      <FieldRow label={t('agent.b2.aadt')} hint={<p className="text-xs text-text-muted">{t('agent.b2.informative')}</p>}>
        <div className="max-w-[12rem]"><Input type="number" min="0" aria-label={t('agent.b2.aadt')} value={ctx.aadt ?? ''} onChange={e => set({ aadt: numberOrNull(e.target.value) })} /></div>
      </FieldRow>

      <FieldRow
        label={t('agent.b2.age')}
        hint={invalid.includes('yearBuilt') ? <ErrorHint>{t('agent.b2.range', { min: 1950, max: yearNow })}</ErrorHint> : invalid.includes('lastInterventionYear') ? <ErrorHint>{t('agent.b2.lastYearError')}</ErrorHint> : ctx.yearBuilt === null ? <p className="text-xs text-text-muted">{t('agent.b2.ageDefault')}</p> : undefined}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-32"><span className="block text-xs font-semibold text-text-muted mb-1" aria-hidden="true">{t('agent.b2.yearBuilt')}</span><Input type="number" aria-label={t('agent.b2.yearBuilt')} value={ctx.yearBuilt ?? ''} onChange={e => set({ yearBuilt: numberOrNull(e.target.value) })} /></div>
          <div className="w-40"><span className="block text-xs font-semibold text-text-muted mb-1" aria-hidden="true">{t('agent.b2.lastYear')}</span><Input type="number" aria-label={t('agent.b2.lastYear')} value={ctx.lastInterventionYear ?? ''} onChange={e => set({ lastInterventionYear: numberOrNull(e.target.value) })} /></div>
          <div className="w-64">
            <span className="block text-xs font-semibold text-text-muted mb-1" aria-hidden="true">{t('agent.b2.lastType')}</span>
            <select aria-label={t('agent.b2.lastType')} className={selectClasses} value={ctx.lastInterventionType ?? ''} onChange={e => set({ lastInterventionType: e.target.value || null })}>
              <option value="">{t('agent.b2.lastType')}</option>
              {TREATMENTS.map(tr => <option key={tr.id} value={tr.id}>{treatmentName(tr.id, language)}</option>)}
              <option value="otra">{t('agent.b2.other')}</option>
            </select>
          </div>
        </div>
      </FieldRow>

      <FieldRow label={t('agent.b2.drainage')}>
        <Segmented
          ariaLabel={t('agent.b2.drainage')}
          value={ctx.drainage}
          onChange={value => set({ drainage: value })}
          options={[{ value: 'bueno', label: t('agent.b2.good') }, { value: 'regular', label: t('agent.b2.fair') }, { value: 'malo', label: t('agent.b2.bad') }]}
        />
      </FieldRow>

      <FieldRow label={t('agent.b2.functional')}>
        <div className="max-w-xs">
          <select aria-label={t('agent.b2.functional')} className={selectClasses} value={ctx.functionalClass ?? ''} onChange={e => set({ functionalClass: e.target.value || null })}>
            <option value="">—</option>
            {FUNCTIONAL.map(f => <option key={f} value={f}>{t(`agent.functional.${f}`)}</option>)}
          </select>
        </div>
      </FieldRow>

      <FieldRow label={t('agent.b2.notes')} hint={invalid.includes('notes') ? <ErrorHint>{t('agent.b2.notesError')}</ErrorHint> : <p className="text-xs text-text-muted">{(ctx.notes ?? '').length} / 500</p>}>
        <textarea
          aria-label={t('agent.b2.notes')}
          rows={2}
          className="block w-full border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-text-base bg-bg-surface p-3 shadow-sm"
          value={ctx.notes ?? ''}
          onChange={e => set({ notes: e.target.value === '' ? null : e.target.value })}
        />
      </FieldRow>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        <Button type="button" variant="ghost" className="border border-border-base" onClick={() => setCopyOpen(true)} disabled={project.sections.length < 2}>{t('agent.b2.copyButton')}</Button>
      </div>

      <div className="mt-4 rounded-lg border border-secondary/20 bg-secondary/10 p-3 text-sm">
        <p className="font-semibold text-secondary-dark mb-1">{t('agent.b2.willAssume')}</p>
        {(() => {
          const lines = project.sections.flatMap(s => sectionAssumptions(ctxOf(s, contexts)).map(k => `${s.name}: ${t(`agent.assume.${k}`)}`));
          return lines.length ? <ul className="list-disc pl-5 space-y-0.5 text-text-base">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="text-text-muted">{t('agent.b2.nothingAssumed')}</p>;
        })()}
      </div>

      <CopyContextModal isOpen={copyOpen} onClose={() => setCopyOpen(false)} project={project} sourceId={section.id} onCopy={ids => onCopy(section.id, ids)} />
    </div>
  );
};
