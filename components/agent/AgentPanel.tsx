import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentConfig, AgentRun, Project, ProjectView, SectionContext } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../hooks/useTranslations';
import { Button } from '../ui/Button';
import { AccordionBlock } from './AccordionBlock';
import { ReceivedDataBlock } from './blocks/ReceivedDataBlock';
import { SectionContextBlock } from './blocks/SectionContextBlock';
import { EquipmentBlock } from './blocks/EquipmentBlock';
import { CostsBlock } from './blocks/CostsBlock';
import { BudgetBlock } from './blocks/BudgetBlock';
import { buildAgentInput, inputHash } from '../../services/agent/buildAgentInput';
import { agentHealth, requestRecommendations } from '../../services/agent/agentClient';
import { computeBlocks, contextIssues, countAssumptions, ctxOf } from '../../services/agent/analysis';
import { initialConfig, writeDefaults } from '../../services/agent/defaults';
import { makeRun, pushRun, validateResultPair, downloadText, MAX_RUNS } from '../../services/agent/runs';
import { ResultView } from './ResultView';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { validateAgentInput } from '../../services/agent/validation';
import { Segmented } from './controls';

interface Props {
  project: Project;
  onSave: (patch: { agentConfig?: AgentConfig; agentRuns?: AgentRun[]; contexts?: Record<string, SectionContext | null> }) => Promise<void>;
  onNavigate: (view: ProjectView) => void;
}

type Phase = 'configure' | 'consulting' | 'result';
type Health = 'checking' | 'online' | 'offline';

const money = (n: number, currency: string) => `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${currency}`;

export const AgentPanel: React.FC<Props> = ({ project, onSave, onNavigate }) => {
  const { t } = useTranslations();
  const { user } = useAuth();
  const runs = project.agentRuns ?? [];

  const [config, setConfig] = useState<AgentConfig>(() => project.agentConfig ?? initialConfig(user?.id ?? 'anon'));
  const [contexts, setContexts] = useState<Record<string, SectionContext | null>>({});
  const [phase, setPhase] = useState<Phase>(runs.length ? 'result' : 'configure');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(runs[0]?.id ?? null);
  const [open, setOpen] = useState<number[]>([2]);
  const [activeSection, setActiveSection] = useState(project.sections[0]?.id ?? '');
  const [health, setHealth] = useState<Health>('checking');
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [defaultsSaved, setDefaultsSaved] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [confirmDrop, setConfirmDrop] = useState<{ override?: AgentConfig; files?: File[] } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // Guardado con espera: una sola cola, se vacía al cerrar bloque, generar o salir.
  const latest = useRef({ config, contexts });
  latest.current = { config, contexts };
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return chain.current;
    dirty.current = false;
    const snapshot = latest.current;
    chain.current = chain.current
      .then(() => onSaveRef.current({ agentConfig: { ...snapshot.config, updatedAt: new Date().toISOString() }, contexts: snapshot.contexts }))
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
    return chain.current;
  }, []);
  const touch = useCallback(() => {
    dirty.current = true;
    setSaveState('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 800);
  }, [flush]);
  useEffect(() => () => { void flush(); }, [flush]);

  const checkHealth = useCallback(() => {
    setHealth('checking');
    agentHealth().then(() => setHealth('online')).catch(() => setHealth('offline'));
  }, []);
  useEffect(() => { checkHealth(); }, [checkHealth]);

  const updateConfig = (patch: Partial<AgentConfig>) => { setConfig(c => ({ ...c, ...patch })); touch(); };
  const updateContext = (id: string, next: SectionContext) => { setContexts(c => ({ ...c, [id]: next })); touch(); };
  const copyContext = (sourceId: string, targets: string[]) => {
    const source = project.sections.find(s => s.id === sourceId);
    if (!source) return;
    const ctx = ctxOf(source, contexts);
    setContexts(c => ({ ...c, ...Object.fromEntries(targets.map(id => [id, { ...ctx }])) }));
    touch();
  };

  const issues = useMemo(() => [...validateAgentInput(project, config), ...contextIssues(project, contexts)], [project, config, contexts]);
  const blocks = useMemo(() => computeBlocks(project, config, contexts, issues), [project, config, contexts, issues]);
  const assumptions = countAssumptions(project, contexts);
  const fullContexts = () => Object.fromEntries(project.sections.map(s => [s.id, ctxOf(s, contexts)]));
  const mergedProject = (): Project => ({ ...project, sections: project.sections.map(s => ({ ...s, context: ctxOf(s, contexts) })) });

  const toggle = (n: number) => { setOpen(o => (o.includes(n) ? o.filter(x => x !== n) : [...o, n])); void flush(); };
  const summaryOf = (n: number) => {
    const b = blocks[n - 1];
    return `${t(b.summaryKey, Object.fromEntries(Object.entries(b.params).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('agent.') ? t(v) : v])))}${b.extraKey ? ` · ${t(b.extraKey, b.extraParams)}` : ''}`;
  };

  const storeRun = async (input: unknown, hash: string, analysis: any, narrative: any, source: AgentRun['narrativeSource'], version: string) => {
    const run = makeRun({ runs, input, hash, config: latest.current.config, contexts: fullContexts(), analysis, narrative, source, agentVersion: version });
    await onSave({ agentRuns: pushRun(runs, run).runs });
    setSelectedRunId(run.id);
    setPhase('result');
  };

  const generate = async (override?: AgentConfig) => {
    const cfg = override ?? config;
    setFailure(null);
    setServerErrors([]);
    if (override) { setConfig(override); latest.current = { config: override, contexts }; }
    dirty.current = true;
    await flush();
    const found = [...validateAgentInput(project, cfg), ...contextIssues(project, contexts)];
    if (found.length) {
      setAttempted(true);
      setOpen(Array.from(new Set(found.map(i => i.block))));
      setPhase('configure');
      return;
    }
    setAttempted(false);
    const input = buildAgentInput(mergedProject(), cfg, user?.company);
    const hash = await inputHash(input);
    const controller = new AbortController();
    controllerRef.current = controller;
    setElapsed(0);
    setPhase('consulting');
    const tick = window.setInterval(() => setElapsed(s => s + 1), 1000);
    try {
      const body = await requestRecommendations(input, controller);
      await storeRun(input, hash, body.analisis, body.narrativa, body.narrativa_origen === 'modelo' ? 'modelo' : 'automatica', String(body.version ?? ''));
    } catch (err: any) {
      if (controller.signal.aborted && !err?.status) setFailure(null);
      else if (err?.status === 422) setServerErrors((err.body?.errores ?? []).map((e: unknown) => (typeof e === 'string' ? e : JSON.stringify(e))));
      else { setFailure(t('agent.error.network')); setHealth('offline'); }
      setPhase('configure');
    } finally {
      window.clearInterval(tick);
      controllerRef.current = null;
    }
  };

  // Con el máximo de consultas guardadas, la más antigua se borra solo si el usuario lo confirma.
  const requestGenerate = (override?: AgentConfig) => {
    if (runs.length >= MAX_RUNS) setConfirmDrop({ override });
    else void generate(override);
  };

  const downloadInput = () => {
    const input = buildAgentInput(mergedProject(), config, user?.company);
    downloadText('entrada.json', JSON.stringify(input, null, 2));
  };

  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    setFailure(null);
    try {
      const parsed = await Promise.all(files.map(async f => JSON.parse(await f.text())));
      const analysis = parsed.find(p => p?.tramos && p?.red);
      const narrative = parsed.find(p => p?.resumen_ejecutivo !== undefined);
      const errors = validateResultPair(analysis, narrative);
      if (errors.length) { setFailure(t('agent.error.import', { fields: errors.join(', ') })); return; }
      const input = buildAgentInput(mergedProject(), config, user?.company);
      const hash = await inputHash(input);
      if (analysis.proyecto.huella_entrada !== hash) { setFailure(t('agent.error.hash')); return; }
      await storeRun(input, hash, analysis, narrative, 'importado', String(analysis.version ?? ''));
    } catch {
      setFailure(t('agent.error.import', { fields: 'JSON' }));
    }
  };

  const run = runs.find(r => r.id === selectedRunId) ?? runs[0];
  const analysis: any = run?.analysis;
  const latestRun = runs[0];

  // La huella actual frente a la de la última consulta: avisa si hubo cambios después de consultar.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!latestRun) { setStale(false); return; }
    let cancelled = false;
    inputHash(buildAgentInput(mergedProject(), config, user?.company)).then(h => { if (!cancelled) setStale(h !== latestRun.inputHash); }).catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, contexts, project.sections, latestRun?.inputHash]);

  const editFromResult = (block?: number) => {
    setPhase('configure');
    if (block) { setOpen([block]); window.setTimeout(() => document.getElementById(`agent-block-${block}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
  };
  const restoreRun = (r: AgentRun) => {
    setConfig(r.config);
    setContexts(r.contexts);
    touch();
    setSelectedRunId(runs[0]?.id ?? null);
    setPhase('configure');
  };

  // Marca de «cambiado» por bloque frente a la última consulta.
  const changedBlock = (n: number): string | undefined => {
    if (!latestRun) return undefined;
    const base = latestRun.config;
    const same = (x: unknown, y: unknown) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
    const diff =
      n === 2 ? !same(latestRun.contexts, fullContexts()) :
      n === 3 ? !same(base.availableTreatments, config.availableTreatments) :
      n === 4 ? !same(base.unitCosts, config.unitCosts) || base.currency !== config.currency :
      n === 5 ? !same(base.parameters, config.parameters) || base.budget !== config.budget || base.priorityMode !== config.priorityMode || base.contingencyPct !== config.contingencyPct || !same(base.pciThresholds, config.pciThresholds) :
      false;
    return diff ? t('agent.changed') : undefined;
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 className="text-2xl font-bold text-text-base">{t('agent.title')}</h2>
        <p className="text-sm text-text-muted">{t('agent.subtitle')}</p>
      </div>
      <button type="button" onClick={checkHealth} className="text-sm font-semibold rounded-full border border-border-base px-3 py-1.5 bg-bg-surface text-text-base">
        <span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 ${health === 'online' ? 'bg-primary' : health === 'offline' ? 'bg-danger' : 'bg-amber-500'}`} aria-hidden="true" />
        {t(`agent.health.${health}`)}
      </button>
    </div>
  );

  if (phase === 'consulting') {
    return (
      <div className="max-w-3xl mx-auto p-4">
        {header}
        <div role="status" className="rounded-xl border border-border-muted bg-bg-surface p-8 text-center space-y-4">
          <p className="text-lg font-semibold text-text-base animate-pulse">{t('agent.consulting.working')}</p>
          <p className="text-sm text-text-muted">{t('agent.consulting.elapsed', { s: elapsed })}</p>
          <Button variant="ghost" className="border border-border-base" onClick={() => controllerRef.current?.abort()}>{t('agent.consulting.cancel')}</Button>
        </div>
      </div>
    );
  }

  if (phase === 'result' && run && analysis) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        {header}
        <ConfirmationModal
          isOpen={confirmDrop !== null}
          onClose={() => setConfirmDrop(null)}
          onConfirm={() => { const c = confirmDrop; setConfirmDrop(null); if (c?.files) void importFiles(c.files); else void generate(c?.override); }}
          title={t('agent.limit.title')}
          confirmText={t('agent.limit.confirm')}
        >
          <p>{t('agent.limit.text', { max: MAX_RUNS, n: runs[runs.length - 1]?.number ?? 1 })}</p>
        </ConfirmationModal>
        <ResultView
          project={project} runs={runs} run={run} draft={config} stale={stale} busy={false} online={health !== 'offline'}
          onEdit={block => editFromResult(block)}
          onQuick={patch => requestGenerate({ ...config, ...patch, updatedAt: new Date().toISOString() })}
          onSelect={setSelectedRunId}
          onRestore={restoreRun}
        />
      </div>
    );
  }

  const bodies: Record<number, React.ReactNode> = {
    1: <ReceivedDataBlock project={project} config={config} issues={issues} onGoToCalculation={() => onNavigate('CALCULATION_DETAILS')} onGoToData={() => onNavigate('DATA_ENTRY')} />,
    2: <SectionContextBlock project={project} config={config} contexts={contexts} activeId={activeSection} onActiveChange={setActiveSection} onChange={updateContext} onCopy={copyContext} />,
    3: <EquipmentBlock project={project} config={config} contexts={contexts} onChange={updateConfig} />,
    4: config.analysisMode === 'diagnostico'
      ? <p className="text-sm text-text-muted">{t('agent.mode.b4Note')}</p>
      : <CostsBlock config={config} onChange={updateConfig} onSaveDefaults={() => { setDefaultsSaved(writeDefaults(user?.id ?? 'anon', config)); }} defaultsSaved={defaultsSaved} />,
    5: <BudgetBlock config={config} onChange={updateConfig} />,
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      {header}
      {latestRun && (
        <div role="status" className="mb-4 rounded-lg border border-secondary/30 bg-secondary/10 p-3 text-sm flex flex-wrap items-center gap-3">
          <span className="text-text-base">{t('agent.adjusting', { n: latestRun.number, date: latestRun.createdAt.slice(5, 16).replace('T', ' ') })}</span>
          <Button variant="ghost" className="border border-border-base !py-1.5" onClick={() => setPhase('result')}>{t('agent.viewResult', { n: latestRun.number })}</Button>
        </div>
      )}
      {health === 'offline' && (
        <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 p-3 text-sm">{t('agent.health.offlineHelp')}</div>
      )}
      {failure && <div role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{failure}</div>}
      {serverErrors.length > 0 && (
        <ul role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger list-disc pl-6">{serverErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}
      {attempted && issues.length > 0 && <div role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{t('agent.error.fix')}</div>}

      <section className="mb-4 rounded-xl border border-border-muted bg-bg-surface p-4">
        <p className="text-sm font-bold text-text-base mb-1">{t('agent.mode.title')}</p>
        <Segmented
          ariaLabel={t('agent.mode.title')}
          value={config.analysisMode ?? 'completo'}
          onChange={value => updateConfig({ analysisMode: value })}
          options={[{ value: 'completo', label: t('agent.mode.full') }, { value: 'diagnostico', label: t('agent.mode.diagnostic') }]}
        />
        <p className="text-xs text-text-muted mt-2">{t(config.analysisMode === 'diagnostico' ? 'agent.mode.diagnosticHelp' : 'agent.mode.fullHelp')}</p>
      </section>

      {[1, 2, 3, 4, 5].map(n => (
        <AccordionBlock
          key={n}
          id={`agent-block-${n}`}
          number={n}
          title={t(`agent.b${n}.title`)}
          status={blocks[n - 1].status}
          statusLabel={t(`agent.status.${blocks[n - 1].status}`)}
          summary={summaryOf(n)}
          open={open.includes(n)}
          onToggle={() => toggle(n)}
          changedLabel={changedBlock(n)}
        >
          {bodies[n]}
        </AccordionBlock>
      ))}

      <ConfirmationModal
        isOpen={confirmDrop !== null}
        onClose={() => setConfirmDrop(null)}
        onConfirm={() => { const c = confirmDrop; setConfirmDrop(null); if (c?.files) void importFiles(c.files); else void generate(c?.override); }}
        title={t('agent.limit.title')}
        confirmText={t('agent.limit.confirm')}
      >
        <p>{t('agent.limit.text', { max: MAX_RUNS, n: runs[runs.length - 1]?.number ?? 1 })}</p>
      </ConfirmationModal>
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border-muted bg-bg-surface/95 backdrop-blur p-3 shadow-lg">
        <span className="text-sm text-text-muted mr-auto">
          {assumptions > 0 ? t('agent.bar.assumed', { n: assumptions }) : t('agent.bar.complete')} · {t(`agent.save.${saveState}`)}
        </span>
        
        <Button variant="ghost" className="border border-border-base" onClick={downloadInput}>{t('agent.bar.downloadInput')}</Button>
        <label className="cursor-pointer inline-flex items-center rounded-xl border border-border-base px-4 py-2.5 text-sm font-bold text-text-muted hover:bg-primary/10">
          {t('agent.bar.importResults')}
          <input type="file" accept=".json,application/json" multiple className="sr-only" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (runs.length >= MAX_RUNS) setConfirmDrop({ files }); else void importFiles(files); }} />
        </label>
        <Button onClick={() => requestGenerate()} disabled={health === 'offline'}>{latestRun ? t('agent.bar.rerun') : t('agent.bar.generate')}</Button>
      </div>
    </div>
  );
};
