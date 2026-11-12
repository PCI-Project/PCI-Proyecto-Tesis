import React from 'react';
import type { AgentConfig, Project, SectionContext } from '../../../types';
import { useTranslations } from '../../../hooks/useTranslations';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Button } from '../../ui/Button';
import { ALL_TREATMENT_IDS, BASIC_CREW_IDS, GROUP_ORDER, TREATMENTS, treatmentName } from '../../../services/agent/catalogUi';
import { equipmentEffects } from '../../../services/agent/analysis';
import { checkClasses } from '../controls';
import { LevelChip } from './ReceivedDataBlock';

interface Props {
  project: Project;
  config: AgentConfig;
  contexts: Record<string, SectionContext | null>;
  onChange: (patch: Partial<AgentConfig>) => void;
}

export const EquipmentBlock: React.FC<Props> = ({ project, config, contexts, onChange }) => {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const selected = new Set(config.availableTreatments);
  const set = (ids: string[]) => onChange({ availableTreatments: ALL_TREATMENT_IDS.filter(id => ids.includes(id)) });
  const toggle = (id: string) => set(selected.has(id) ? config.availableTreatments.filter(x => x !== id) : [...config.availableTreatments, id]);
  const effects = equipmentEffects(project, config, contexts);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted mr-1">{t('agent.b3.shortcuts')}</span>
        <Button type="button" variant="ghost" className="border border-border-base !py-1.5" onClick={() => set(ALL_TREATMENT_IDS)}>{t('agent.b3.all')}</Button>
        <Button type="button" variant="ghost" className="border border-border-base !py-1.5" onClick={() => set(BASIC_CREW_IDS)}>{t('agent.b3.basic')}</Button>
        <Button type="button" variant="ghost" className="border border-border-base !py-1.5" onClick={() => set([])}>{t('agent.b3.none')}</Button>
        <span className="ml-auto text-sm font-semibold text-text-base">{t('agent.b3.count', { n: config.availableTreatments.length, total: TREATMENTS.length })}</span>
      </div>

      {config.availableTreatments.length === 0 && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{t('agent.issues.noEquipment')}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {GROUP_ORDER.map(group => {
          const items = TREATMENTS.filter(tr => tr.group === group);
          if (!items.length) return null;
          const all = items.every(i => selected.has(i.id));
          return (
            <fieldset key={group} className="rounded-lg border border-border-muted p-3">
              <legend className="px-1 text-sm font-bold text-secondary-dark">{t(`agent.group.${group}`)}</legend>
              <label className="flex items-center gap-3 cursor-pointer p-1.5 rounded-md hover:bg-bg-muted text-sm font-semibold text-text-muted">
                <input type="checkbox" className={checkClasses} checked={all} onChange={e => set(e.target.checked ? Array.from(new Set([...config.availableTreatments, ...items.map(i => i.id)])) : config.availableTreatments.filter(id => !items.some(i => i.id === id)))} />
                {t('agent.b3.groupAll')}
              </label>
              {items.map(item => (
                <label key={item.id} className="flex items-center gap-3 cursor-pointer p-1.5 rounded-md hover:bg-bg-muted">
                  <input type="checkbox" className={checkClasses} checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                  <span className="text-sm text-text-base">{treatmentName(item.id, language)}</span>
                  <span className="ml-auto text-xs text-text-muted">{t(`agent.unit.${item.unit}`)}</span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>

      <div className="rounded-lg border border-secondary/20 bg-secondary/10 p-3">
        <p className="text-sm font-semibold text-secondary-dark mb-2">{t('agent.b3.effect')}</p>
        {effects.length === 0 ? <p className="text-sm text-text-muted">{t('agent.b3.noEffect')}</p> : (
          <ul className="space-y-1.5 text-sm">
            {effects.map(e => (
              <li key={e.sectionId} className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true" className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${e.satisfied ? 'bg-primary' : 'bg-amber-500'}`}>{e.satisfied ? '✓' : '!'}</span>
                <span className="font-semibold text-text-base">{e.name}</span>
                <LevelChip level={e.level} />
                <span className="text-text-muted">
                  {e.satisfied
                    ? t('agent.b3.hasOption', { n: e.options.filter(id => selected.has(id)).length })
                    : e.interim ? t('agent.b3.interim', { name: treatmentName(e.interim, language) }) : t('agent.b3.noOption')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
