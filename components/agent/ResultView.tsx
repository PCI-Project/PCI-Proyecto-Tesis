import React, { useState } from 'react';
import type { AgentConfig, AgentRun, Project } from '../../types';
import { useTranslations } from '../../hooks/useTranslations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Segmented } from './controls';
import { AgentReport } from './report/AgentReport';
import { ChatView } from './ChatView';
import { runSummary, downloadText } from '../../services/agent/runs';
import { TREATMENTS } from '../../services/agent/catalogUi';
import { compareRuns, ESTADO_COLOR, fmtMoney, fmtPci, orderedSections, solutionName, solutionTag, allAlerts } from '../../services/agent/reportModel';
import { generateAgentReportPdf } from '../../services/agent/agentReportPdf';
import { LevelChip } from './blocks/ReceivedDataBlock';

interface Props {
  project: Project;
  runs: AgentRun[];
  run: AgentRun;
  draft: AgentConfig;
  stale: boolean;
  busy: boolean;
  online: boolean;
  onEdit: (block?: number) => void;
  onQuick: (patch: Partial<AgentConfig>) => void;
  onSelect: (id: string) => void;
  onRestore: (run: AgentRun) => void;
}

const deltaText = (value: number, money = true) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money ? fmtMoney(Math.abs(value)) : Math.abs(value).toFixed(1)}`;

export const ResultView: React.FC<Props> = ({ project, runs, run, draft, stale, busy, online, onEdit, onQuick, onSelect, onRestore }) => {
  const { t } = useTranslations();
  const [tab, setTab] = useState<'summary' | 'report' | 'chat'>('summary');
  const [quickOpen, setQuickOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggleRow = (id: string) => setExpanded(e => (e.includes(id) ? e.filter(x => x !== id) : [...e, id]));
  const [budget, setBudget] = useState<string>(draft.budget == null ? '' : String(draft.budget));
  const [mode, setMode] = useState(draft.priorityMode);
  const isLatest = runs[0]?.id === run.id;
  const index = runs.findIndex(r => r.id === run.id);
  const previous = index >= 0 ? runs[index + 1] : undefined;
  const comparison = previous ? compareRuns(run, previous) : null;
  const analysis: any = run.analysis;
  const narrative: any = run.narrative;
  const summary = runSummary(run);
  const currency = run.config.currency;
  const sections = orderedSections(analysis);
  const single = Boolean(analysis.red?.un_solo_tramo); // C3: con un solo tramo no hay ranking
  const diag = analysis.modo === 'diagnostico'; // C1: informe patológico, sin dinero ni prioridad
  const [sortWorst, setSortWorst] = useState(false);
  const rows = diag && sortWorst ? [...sections].sort((a, b) => a.pci - b.pci) : sections; // filtro opcional: no es una prioridad
  const assumed = (analysis.tramos as any[]).reduce((sum, s) => sum + (s.contexto_usado?.asumidos?.length ?? 0), 0);
  const interim = (analysis.tramos as any[]).filter(s => s.tratamiento?.interino).length;
  const ownCosts = Object.keys(run.config.unitCosts).length;
  const alertCount = (level: string) => allAlerts(analysis, narrative).filter(a => a.level === level).length;
  const tr = (text: string) => text.replace(/· (\w+)$/, (_m, estado) => `· ${t(`agent.estado.${estado}`)}`);
  const budgetBad = budget.trim() !== '' && !(Number(budget) > 0);

  const chips: { key: string; label: string; value: string; block: number }[] = [
    { key: 'equip', label: t('agent.chip.equipment'), value: `${run.config.availableTreatments.length} / ${TREATMENTS.length}`, block: 3 },
    { key: 'budget', label: t('agent.b5.budget'), value: run.config.budget == null ? t('agent.b5.noCap') : `${fmtMoney(run.config.budget)} ${currency}`, block: 5 },
    { key: 'mode', label: t('agent.chip.mode'), value: t(run.config.priorityMode === 'costo_beneficio' ? 'agent.mode.bc' : 'agent.mode.worst'), block: 5 },
    { key: 'cont', label: t('agent.b5.contingency'), value: `${run.config.contingencyPct} %`, block: 5 },
    { key: 'costs', label: t('agent.chip.ownCosts'), value: `${ownCosts} / ${TREATMENTS.length}`, block: 4 },
    { key: 'assumed', label: t('agent.chip.assumed'), value: String(assumed), block: 2 },
    { key: 'interim', label: t('agent.chip.interim'), value: String(interim), block: 3 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => onEdit()}>{t('agent.result.edit')}</Button>
        <Button variant="ghost" className="border border-border-base" onClick={() => generateAgentReportPdf(project, run, t)}>{t('agent.result.pdf')}</Button>
        <Button variant="ghost" className="border border-border-base" onClick={() => { setTab('report'); setTimeout(() => window.print(), 300); }}>{t('agent.result.print')}</Button>
        <Button variant="ghost" className="border border-border-base" onClick={() => downloadText(`recomendaciones_v${run.number}.json`, JSON.stringify({ analisis: run.analysis, narrativa: run.narrative }, null, 2))}>JSON</Button>
        <span className="text-sm text-text-muted">v{run.number} · {run.createdAt.slice(0, 16).replace('T', ' ')} · {t(`agent.source.${run.narrativeSource}`)}</span>
      </div>

      {!isLatest && (
        <div role="status" className="rounded-lg border border-secondary/30 bg-secondary/10 p-3 text-sm flex flex-wrap items-center gap-3">
          <span className="font-semibold text-text-base">{t('agent.history.viewing', { n: run.number })}</span>
          <Button variant="ghost" className="border border-border-base !py-1.5" onClick={() => onRestore(run)}>{t('agent.history.restore')}</Button>
          <Button variant="ghost" className="border border-border-base !py-1.5" onClick={() => onSelect(runs[0].id)}>{t('agent.history.backLatest')}</Button>
        </div>
      )}

      <section aria-label={t('agent.chip.title')} className="rounded-xl border border-border-muted bg-bg-surface p-3">
        <p className="text-xs font-semibold text-text-muted mb-2">{t('agent.chip.title')}</p>
        <div className="flex flex-wrap gap-2">
          {chips.filter(chip => !diag || ['equip', 'assumed', 'interim'].includes(chip.key)).map(chip => (
            <button key={chip.key} type="button" onClick={() => onEdit(chip.block)} className="rounded-full border border-border-base bg-bg-base px-3 py-1.5 text-sm text-text-base hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40">
              <span className="text-text-muted">{chip.label} </span><span className="font-semibold">{chip.value}</span>
            </button>
          ))}
        </div>
        {!diag && <div className="mt-3">
          <button type="button" aria-expanded={quickOpen} onClick={() => setQuickOpen(o => !o)} className="text-sm font-semibold text-primary underline">{quickOpen ? '▾' : '▸'} {t('agent.quick.title')}</button>
          {quickOpen && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className="w-48"><Input label={t('agent.b5.budget')} type="number" min="0" step="100" value={budget} placeholder={t('agent.b5.noCap')} onChange={e => setBudget(e.target.value)} /></div>
              <Segmented<AgentConfig['priorityMode']> ariaLabel={t('agent.b5.mode')} value={mode} onChange={setMode} options={[{ value: 'costo_beneficio', label: t('agent.mode.bcShort') }, { value: 'peor_primero', label: t('agent.mode.worstShort') }]} />
              <Button disabled={budgetBad || busy || !online} onClick={() => onQuick({ budget: budget.trim() === '' ? null : Number(budget), priorityMode: mode })}>{t('agent.quick.rerun')}</Button>
              {budgetBad && <p role="alert" className="text-xs font-semibold text-danger">{t('agent.issues.invalidBudget')}</p>}
            </div>
          )}
        </div>}
      </section>

      {stale && isLatest && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 p-3 text-sm flex flex-wrap items-center gap-3">
          <span>{t('agent.stale')}</span>
          <Button variant="ghost" className="border border-amber-400 !py-1.5" disabled={busy || !online} onClick={() => onEdit()}>{t('agent.result.edit')}</Button>
        </div>
      )}

      <div role="tablist" aria-label={t('agent.result.title')} className="flex gap-2 border-b border-border-muted">
        {(['summary', 'report', 'chat'] as const).map(id => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`px-4 py-2 text-sm font-bold -mb-px border-b-2 ${tab === id ? 'border-primary text-primary' : 'border-transparent text-text-muted'}`}>{t(`agent.tab.${id}`)}</button>
        ))}
      </div>

      {tab === 'chat' ? <ChatView key={run.id} run={run} online={online} /> : tab === 'report' ? <AgentReport project={project} run={run} /> : (
        <div className="space-y-4">
          {comparison && comparison.deltas.length > 0 && (
            <div className="rounded-lg border border-border-muted bg-bg-surface p-3 text-sm">
              <p className="font-semibold text-text-base">{t('agent.compare.title', { n: previous!.number })}</p>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {comparison.deltas.map(d => (
                  <span key={d.key} className={d.better === true ? 'text-primary-dark' : d.better === false ? 'text-danger' : 'text-text-muted'}>
                    {t(`agent.compare.${d.key}`)} <strong className="font-mono">{deltaText(d.value, d.key !== 'pciAfter')}</strong>
                  </span>
                ))}
              </p>
              {comparison.changed.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-text-base">{comparison.changed.map(c => <li key={c.name}>{c.name}: {tr(c.from)} → {tr(c.to)}</li>)}</ul>
              )}
            </div>
          )}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {(diag ? [
                [t('agent.result.pci'), fmtPci(summary.pciBefore)],
                [t('agent.report.kArea'), `${Number(analysis.red?.area_total_m2 ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} m²`],
              ] : [
                [t('agent.result.pci'), `${fmtPci(summary.pciBefore)}${summary.pciAfter != null ? ` → ${fmtPci(summary.pciAfter)}` : ''}`],
                [t('agent.result.needed'), fmtMoney(summary.needed)],
                [t('agent.result.financed'), fmtMoney(summary.financed)],
                [t('agent.result.shortfall'), fmtMoney(summary.shortfall)],
                [t('agent.report.kUnassigned'), summary.unassigned == null ? '—' : fmtMoney(summary.unassigned)],
              ]).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border-muted bg-bg-surface p-3">
                  <p className="text-xs font-semibold text-text-muted">{label}</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-text-base">{value}</p>
                </div>
              ))}
            </div>
          )}
          <section className="rounded-xl border border-border-muted bg-bg-surface p-4">
            <h3 className="font-bold text-text-base mb-2">{t('agent.result.summary')}</h3>
            <p className="text-sm text-text-base whitespace-pre-line">{narrative?.resumen_ejecutivo}</p>
          </section>
          {diag && (
            <div className="rounded-lg border border-border-muted bg-bg-surface p-3 text-sm space-y-2">
              <p className="text-text-muted">{t('agent.mode.diagnosticNote')}</p>
              <label className="flex items-center gap-2 cursor-pointer text-text-base">
                <input type="checkbox" className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" checked={sortWorst} onChange={e => setSortWorst(e.target.checked)} />
                <span className="font-semibold">{t('agent.mode.sortWorst')}</span>
                <span className="text-xs text-text-muted">{t('agent.mode.sortHint')}</span>
              </label>
            </div>
          )}
          <div className="overflow-x-auto border border-border-muted rounded-lg">
            <table className="min-w-full text-sm bg-bg-surface">
              <thead className="bg-secondary/20 text-secondary-dark">
                <tr>
                  <th className="p-2"><span className="sr-only">{t('agent.rows.expand')}</span></th>{!single && !diag && <th className="text-left p-2">#</th>}<th className="text-left p-2">{t('agent.b1.section')}</th><th className="text-right p-2">PCI</th><th className="text-left p-2">{t('agent.b1.level')}</th>
                  <th className="text-left p-2">{t('agent.result.treatment')}</th>{!diag && <><th className="text-right p-2">{t('agent.result.cost')}</th><th className="text-right p-2">B/C</th><th className="text-left p-2">{t('agent.b1.state')}</th></>}
                </tr>
              </thead>
              <tbody className="text-text-base">
                {rows.map(s => {
                  const tag = solutionTag(s);
                  const isOpen = expanded.includes(s.id);
                  const previous = (s.trabajos_previos ?? []) as any[];
                  const discarded = (s.tratamiento?.descartados ?? []) as any[];
                  return (
                    <React.Fragment key={s.id}>
                      <tr className="odd:bg-secondary/5">
                        <td className="p-1">
                          <button type="button" aria-expanded={isOpen} aria-label={`${t('agent.rows.expand')}: ${s.nombre}`} onClick={() => toggleRow(s.id)} className="h-7 w-7 rounded text-text-muted hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40">{isOpen ? '▾' : '▸'}</button>
                        </td>
                        {!single && !diag && <td className="p-2 font-mono">{s.prioridad?.posicion ?? '—'}</td>}
                        <td className="p-2 font-medium">{s.nombre}</td>
                        <td className="p-2 text-right font-mono">{fmtPci(s.pci)}</td>
                        <td className="p-2"><LevelChip level={s.nivel_id} /></td>
                        <td className="p-2">{solutionName(s)}{tag && <span className="ml-1 text-xs text-text-muted">({t(`agent.report.${tag}`)})</span>}</td>
                        {!diag && <>
                          <td className="p-2 text-right font-mono">{fmtMoney(s.costos?.total)}</td>
                          <td className="p-2 text-right font-mono">{s.relacion_bc ?? '—'}</td>
                          <td className="p-2 font-semibold" style={{ color: ESTADO_COLOR[s.prioridad?.estado] }}>{t(`agent.estado.${s.prioridad?.estado}`)}</td>
                        </>}
                      </tr>
                      {isOpen && (
                        <tr className="bg-bg-base/60">
                          <td />
                          <td colSpan={diag ? 4 : single ? 7 : 8} className="p-3 text-xs space-y-1">
                            <p><span className="font-semibold">{t('agent.rows.previous')}:</span> {previous.length ? previous.map(p => `${p.nombre} ${p.cantidad} ${p.unidad}${diag ? (p.seguridad ? ` (${t('agent.report.safety')})` : '') : ` (${fmtMoney(p.costo)}${p.seguridad ? `, ${t('agent.report.safety')}` : ''})`}`).join(' · ') : '—'}</p>
                            {!diag && <p><span className="font-semibold">{t('agent.report.years')}:</span> {s.beneficio_detalle?.anios_recuperados ?? '—'}</p>}
                            <p><span className="font-semibold">{t('agent.report.discarded')}:</span> {discarded.length ? discarded.map(d => (typeof d === 'string' ? d : `${d.nombre ?? d.id}${d.motivo ? ` (${d.motivo})` : ''}`)).join('; ') : '—'}</p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-text-muted">
            {t('agent.counters', { critical: alertCount('critica'), warning: alertCount('advertencia'), info: alertCount('info'), assumed })}
          </p>
        </div>
      )}

      {runs.length > 1 && (
        <p className="text-sm text-text-muted flex flex-wrap items-center gap-2">
          <span>{t('agent.history.title')}:</span>
          {[...runs].reverse().map(r => (
            <button key={r.id} type="button" onClick={() => onSelect(r.id)} aria-current={r.id === run.id} className={`rounded px-2 py-0.5 border ${r.id === run.id ? 'border-primary text-primary font-bold' : 'border-border-base text-text-base'}`}>
              v{r.number} ({r.createdAt.slice(5, 10)})
            </button>
          ))}
        </p>
      )}
    </div>
  );
};
