import React from 'react';
import type { AgentConfig, Project } from '../../../types';
import { useTranslations } from '../../../hooks/useTranslations';
import { levelOfSection } from '../../../services/agent/analysis';
import type { AgentIssue } from '../../../services/agent/validation';

export const LEVEL_COLOR: Record<string, string> = { A: '#2e7d32', B: '#a35f00', C: '#b3261e' };

export const LevelChip: React.FC<{ level: string }> = ({ level }) => (
  <span className="inline-block rounded px-1.5 py-0.5 text-xs font-bold text-white" style={{ background: LEVEL_COLOR[level[0]] }}>{level}</span>
);

interface Props {
  project: Project;
  config: AgentConfig;
  issues: AgentIssue[];
  onGoToCalculation: () => void;
  onGoToData: () => void;
}

export const ReceivedDataBlock: React.FC<Props> = ({ project, config, issues, onGoToCalculation, onGoToData }) => {
  const { t } = useTranslations();
  const blocking = issues.filter(i => i.block === 1);
  const nameOf = (id?: string) => project.sections.find(s => s.id === id)?.name ?? '';

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {t('agent.b1.intro', { inspector: project.inspector || '—', date: (project.inspectionDate || '').slice(0, 10) })}
      </p>
      <div className="overflow-x-auto border border-border-muted rounded-lg">
        <table className="min-w-full bg-bg-surface text-sm">
          <thead className="bg-secondary/20 text-secondary-dark">
            <tr>
              <th className="text-left py-2 px-3 font-semibold">{t('agent.b1.section')}</th>
              <th className="text-right py-2 px-3 font-semibold">{t('agent.b1.area')} (m²)</th>
              <th className="text-right py-2 px-3 font-semibold">PCI</th>
              <th className="text-left py-2 px-3 font-semibold">{t('agent.b1.level')}</th>
              <th className="text-right py-2 px-3 font-semibold">{t('agent.b1.samples')}</th>
              <th className="text-right py-2 px-3 font-semibold">{t('agent.b1.distresses')}</th>
              <th className="text-left py-2 px-3 font-semibold">{t('agent.b1.state')}</th>
            </tr>
          </thead>
          <tbody className="text-text-base">
            {project.sections.map(section => {
              const level = levelOfSection(section, config);
              const hasIssue = blocking.some(i => i.sectionId === section.id);
              const insufficient = section.samplesSufficient === false;
              return (
                <tr key={section.id} className="odd:bg-secondary/5">
                  <td className="py-2 px-3 font-medium">{section.name}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{section.area.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{section.pci != null ? section.pci.toFixed(1) : '—'}</td>
                  <td className="py-2 px-3">{level ? <><LevelChip level={level} /> <span className="text-text-muted">{t(`agent.level.${level}`)}</span></> : '—'}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{section.samples.length} / {section.totalSampleUnits}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{section.samples.reduce((n, s) => n + s.distresses.length, 0)}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${hasIssue ? 'bg-danger' : insufficient ? 'bg-amber-500' : 'bg-primary'}`} aria-hidden="true" />
                    <span className="sr-only">{hasIssue ? t('agent.status.error') : insufficient ? t('agent.status.warn') : t('agent.status.ok')}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {blocking.length > 0 && (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger space-y-1">
          {blocking.map((issue, i) => (
            <p key={i}>{t(`agent.issues.${issue.key}`, { name: nameOf(issue.sectionId), sample: issue.sampleId ?? '', done: issue.done ?? 0, total: issue.total ?? 0 })}</p>
          ))}
          {blocking.some(i => i.key === 'incompleteCoverage') && (
            <>
              <p className="text-xs">{t('agent.issues.coverageWhy')}</p>
              <button type="button" onClick={onGoToData} className="font-semibold underline">{t('agent.issues.goData')}</button>
            </>
          )}
          {blocking.some(i => i.key === 'missingPci') && (
            <button type="button" onClick={onGoToCalculation} className="font-semibold underline">{t('agent.issues.goCalc')}</button>
          )}
        </div>
      )}
      {project.sections.filter(s => s.samplesSufficient === false).map(s => (
        <div key={s.id} role="status" className="rounded-lg border border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 p-3 text-sm">
          {t('agent.issues.insufficient', { name: s.name, count: s.missingSamples ?? 0 })}
        </div>
      ))}
      <p className="text-xs text-text-muted">{t('agent.b1.levelNote')}</p>
    </div>
  );
};
