import React from 'react';
import type { AgentRun, Project } from '../../../types';
import { useTranslations } from '../../../hooks/useTranslations';
import {
  allAlerts, areaByLevel, assigned, ESTADO_COLOR, fmtInt, fmtMoney, fmtPci, levelColor, narrativeFor,
  orderedSections, reportCode, solutionName, solutionTag, uniqueReferences, BIBLIOGRAPHY, assumptionText, paramRows,
} from '../../../services/agent/reportModel';

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #agent-report, #agent-report * { visibility: visible !important; }
  #agent-report { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
  #agent-report section.report-page { break-before: page; }
  #agent-report thead { display: table-header-group; }
  #agent-report tr { break-inside: avoid; }
  #agent-report { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`p-1.5 font-semibold text-white ${right ? 'text-right' : 'text-left'}`} style={{ background: '#0b3c5d' }}>{children}</th>
);
const Td: React.FC<{ children?: React.ReactNode; right?: boolean; bold?: boolean }> = ({ children, right, bold }) => (
  <td className={`p-1.5 align-top ${right ? 'text-right font-mono' : ''} ${bold ? 'font-bold' : ''}`}>{children}</td>
);
const Table: React.FC<{ head: React.ReactNode; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto my-2"><table className="min-w-full text-xs border border-gray-200"><thead><tr>{head}</tr></thead><tbody className="[&>tr:nth-child(even)]:bg-gray-50">{children}</tbody></table></div>
);
const H2: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <h2 id={id} className="text-lg font-bold mt-0 mb-3 pb-1 border-b-2" style={{ color: '#0b3c5d', borderColor: '#0b3c5d' }}>{children}</h2>
);
const Bullets: React.FC<{ items?: string[] }> = ({ items }) => (items && items.length ? <ul className="list-disc pl-5 space-y-1 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-sm text-gray-500">—</p>);

interface Props { project: Project; run: AgentRun }

export const AgentReport: React.FC<Props> = ({ project, run }) => {
  const { t } = useTranslations();
  const a: any = run.analysis;
  const n: any = run.narrative;
  const red = a.red ?? {};
  const cal = a.calibracion_usada ?? {};
  const sections = orderedSections(a);
  const currency = cal.moneda ?? run.config.currency;
  const alerts = allAlerts(a, n);
  const levels = areaByLevel(a);
  const code = reportCode(a);
  const modes = red.comparacion_modos;
  const diag = a.modo === 'diagnostico'; // C1: informe patológico, sin dinero ni prioridad
  let cumulative = 0;

  const index = [
    ['r-1', t('agent.report.s1')], ['r-2', t('agent.report.s2')], ['r-3', t('agent.report.s3')], ['r-4', t('agent.report.s4')],
    ['r-5', diag ? t('agent.mode.orderTitle') : t('agent.report.s5')], ['r-6', t('agent.report.s6')], ['r-7', t('agent.report.s7')], ['r-8', t('agent.report.s8')], ['r-9', t('agent.report.s9')],
  ];

  return (
    <div className="flex gap-4 items-start">
      <style>{PRINT_CSS}</style>
      <nav aria-label={t('agent.report.index')} className="hidden lg:block sticky top-4 w-52 shrink-0 text-sm">
        <p className="font-bold text-text-base mb-2">{t('agent.report.index')}</p>
        <ul className="space-y-1">
          {index.map(([id, label]) => <li key={id}><a className="text-primary underline" href={`#${id}`} onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label}</a></li>)}
          {sections.map(s => <li key={s.id} className="pl-3"><a className="text-primary underline" href={`#r-s-${s.id}`} onClick={e => { e.preventDefault(); document.getElementById(`r-s-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{s.nombre}</a></li>)}
        </ul>
      </nav>

      <article id="agent-report" className="flex-1 min-w-0 max-w-[210mm] mx-auto bg-white text-gray-900 shadow-lg p-6 sm:p-10 space-y-8">
        <section className="report-page text-center space-y-3 py-6">
          <h1 className="text-2xl font-bold" style={{ color: '#0b3c5d' }}>{diag ? t('agent.mode.reportTitle') : t('agent.report.title')}</h1>
          <p className="text-lg font-semibold">{a.proyecto?.nombre ?? project.name}</p>
          <dl className="text-sm text-left max-w-md mx-auto grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
            {a.proyecto?.entidad && <><dt className="text-gray-500">{t('agent.report.entity')}</dt><dd>{a.proyecto.entidad}</dd></>}
            {a.proyecto?.ubicacion && <><dt className="text-gray-500">{t('agent.report.location')}</dt><dd>{typeof a.proyecto.ubicacion === 'string' ? a.proyecto.ubicacion : ''}</dd></>}
            <dt className="text-gray-500">{t('agent.report.inspector')}</dt><dd>{a.proyecto?.inspector ?? project.inspector}</dd>
            <dt className="text-gray-500">{t('agent.report.inspDate')}</dt><dd>{a.proyecto?.fecha_inspeccion}</dd>
            <dt className="text-gray-500">{t('agent.report.generated')}</dt><dd>{run.createdAt.slice(0, 16).replace('T', ' ')}</dd>
            <dt className="text-gray-500">{t('agent.report.code')}</dt><dd className="font-mono">{code}</dd>
            <dt className="text-gray-500">{t('agent.report.agentVersion')}</dt><dd>{run.agentVersion || a.version}</dd>
            <dt className="text-gray-500">{t('agent.report.textSource')}</dt><dd>{t(`agent.source.${run.narrativeSource}`)}</dd>
          </dl>
          <p className="text-xs text-gray-600 max-w-lg mx-auto border border-gray-300 rounded p-2">{t('agent.report.disclaimer')}</p>
        </section>

        <section className="report-page">
          <H2 id="r-1">1. {t('agent.report.s1')}</H2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {(diag ? [
              [t('agent.report.kArea'), `${fmtInt(red.area_total_m2)} m²`], [t('agent.result.pci'), fmtPci(red.pci_ponderado)],
            ] : [
              [t('agent.report.kArea'), `${fmtInt(red.area_total_m2)} m²`], [t('agent.report.kPci'), `${fmtPci(red.pci_ponderado)} → ${fmtPci(red.pci_ponderado_despues)}`],
              [t('agent.report.kNeeded'), `${fmtMoney(red.costo_total_necesario)} ${currency}`], [t('agent.report.kBudget'), cal.presupuesto == null ? t('agent.b5.noCap') : `${fmtMoney(cal.presupuesto)} ${currency}`],
              [t('agent.report.kFunded'), `${fmtMoney(red.costo_financiado)} ${currency}`], [t('agent.report.kShortfall'), `${fmtMoney(red.faltante)} ${currency}`],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="border border-gray-200 rounded p-2"><p className="text-[11px] text-gray-500">{label}</p><p className="font-bold font-mono text-sm">{value}</p></div>
            ))}
          </div>
          <p className="text-sm whitespace-pre-line">{n?.resumen_ejecutivo}</p>
          <div className="flex h-5 w-full rounded overflow-hidden mt-3" role="img" aria-label={t('agent.report.areaByLevel')}>
            {levels.map(l => <div key={l.level} style={{ width: `${l.pct}%`, background: levelColor(l.level) }} title={`${l.level}: ${l.pct.toFixed(1)} %`} />)}
          </div>
          <p className="text-xs text-gray-600 mt-1">{levels.map(l => `${l.level}: ${fmtInt(l.area)} m² (${l.pct.toFixed(1)} %)`).join(' · ')}</p>
          {alerts.filter(x => x.level === 'critica').length > 0 && (
            <div className="mt-3 border-l-4 border-red-700 bg-red-50 p-2 text-sm">
              <p className="font-bold text-red-800">{t('agent.report.critical')}</p>
              <ul className="list-disc pl-5">{alerts.filter(x => x.level === 'critica').map((x, i) => <li key={i}>{x.text}</li>)}</ul>
            </div>
          )}
        </section>

        <section className="report-page text-sm space-y-2">
          <H2 id="r-2">2. {t('agent.report.s2')}</H2>
          <p>{t(diag ? 'agent.mode.method' : 'agent.report.method')}</p>
          <p className="font-semibold">{t('agent.report.thresholds')}</p>
          <p className="font-mono text-xs">{Object.entries(cal.umbrales_pci ?? {}).map(([k, v]) => `${k} ≥ ${v}`).join(' · ') || '—'}</p>
          <p className="text-xs text-gray-600">{t('agent.report.hash', { hash: String(a.proyecto?.huella_entrada ?? '') })}</p>
        </section>

        <section className="report-page">
          <H2 id="r-3">3. {t('agent.report.s3')}</H2>
          <Table head={<><Th>{t('agent.b1.section')}</Th><Th>{t('agent.b2.roadType')}</Th><Th right>{t('agent.b2.curb')}</Th><Th>{t('agent.b2.traffic')}</Th><Th>{t('agent.b2.drainage')}</Th></>}>
            {sections.map(s => {
              const c = s.contexto_usado ?? {};
              const mark = (key: string, value: unknown) => `${value ?? '—'}${(c.asumidos ?? []).includes(key) ? '*' : ''}`;
              return (
                <tr key={s.id}><Td>{s.nombre}</Td><Td>{mark('tipo_via', c.tipo_via)}</Td><Td right>{mark('altura_bordillo_cm', c.altura_bordillo_cm)}</Td>
                  <Td>{c.esal_millones != null ? `ESAL ${c.esal_millones} M` : mark('trafico', c.clase_trafico)}</Td><Td>{c.drenaje ?? '—'}</Td></tr>
              );
            })}
          </Table>
          <p className="text-xs text-gray-600">* {t('agent.report.assumedNote')}</p>
          <p className="text-sm font-semibold mt-3">{t('agent.report.equipment')}</p>
          <p className="text-xs">{(cal.tratamientos_disponibles ?? []).length} {t('agent.report.treatments')}</p>
          {diag ? <p className="text-xs text-gray-600 mt-3">{t('agent.mode.diagnosticNote')}</p> : <>
          <p className="text-sm font-semibold mt-3">{t('agent.report.costsUsed')}</p>
          <Table head={<><Th>{t('agent.b4.treatment')}</Th><Th right>{t('agent.b4.value')} ({currency})</Th><Th>{t('agent.b4.source')}</Th></>}>
            {Object.entries(cal.costos ?? {}).map(([id, c]: [string, any]) => (
              <tr key={id}><Td>{id}</Td><Td right>{fmtMoney(c.valor)}</Td><Td>{c.origen === 'calibrado' || c.origen === 'propio' ? t('agent.report.calibrated') : t('agent.b4.example')}</Td></tr>
            ))}
          </Table></>}
        </section>

        <div id="r-4"><h2 className="sr-only">4. {t('agent.report.s4')}</h2>
          {sections.map(s => {
            const nt = narrativeFor(n, s.id);
            const tag = solutionTag(s);
            return (
              <section key={s.id} id={`r-s-${s.id}`} className="report-page mb-8 space-y-2">
                <div className="flex flex-wrap items-center gap-3 p-2 rounded text-white" style={{ background: levelColor(s.nivel_id) }}>
                  <h3 className="font-bold">4. {s.nombre}</h3>
                  <span className="text-sm">PCI {fmtPci(s.pci)} · {s.nivel_id} · {s.nivel}</span>
                </div>
                <div className="relative h-4 rounded overflow-hidden my-1" style={{ background: 'linear-gradient(90deg,#b3261e 0%,#b3261e 40%,#a35f00 40%,#a35f00 70%,#2e7d32 70%,#2e7d32 100%)' }} role="img" aria-label={t('agent.report.pciBar', { now: fmtPci(s.pci), after: fmtPci(s.tratamiento?.pci_despues) })}>
                  <span className="absolute top-0 h-4 w-1 bg-black" style={{ left: `${Math.min(100, Math.max(0, Number(s.pci)))}%` }} />
                  {s.tratamiento?.pci_despues != null && <span className="absolute top-0 h-4 w-1 border border-black bg-white" style={{ left: `${Math.min(100, Math.max(0, Number(s.tratamiento.pci_despues)))}%` }} />}
                </div>
                <p className="text-[11px] text-gray-600">{t('agent.report.pciBar', { now: fmtPci(s.pci), after: fmtPci(s.tratamiento?.pci_despues) })}</p>
                <p className="text-sm"><span className="font-semibold">{t('agent.report.solution')}:</span> {solutionName(s)}{tag ? ` (${t(`agent.report.${tag}`)})` : ''}</p>
                {!diag && <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {([
                    [t('agent.result.cost'), `${fmtMoney(s.costos?.total)} ${currency}`], [t('agent.report.costM2'), fmtMoney(s.costos?.costo_m2)],
                    [t('agent.report.years'), s.beneficio_detalle?.anios_recuperados ?? '—'], ['B/C', s.relacion_bc ?? '—'], [t('agent.report.priority'), `${s.prioridad?.posicion ?? '—'} · ${t(`agent.estado.${s.prioridad?.estado}`)}`],
                  ] as [string, React.ReactNode][]).map(([label, value]) => <div key={label} className="border border-gray-200 rounded p-1.5"><p className="text-gray-500">{label}</p><p className="font-bold font-mono">{value}</p></div>)}
                </div>}
                {nt.diagnostico && <><p className="font-semibold text-sm">{t('agent.report.diagnosis')}</p><p className="text-sm">{nt.diagnostico}</p></>}
                {nt.justificacion && <><p className="font-semibold text-sm">{t('agent.report.justification')}</p><p className="text-sm">{nt.justificacion}</p></>}
                {(s.tratamiento?.descartados ?? []).length > 0 && <p className="text-xs text-gray-700"><span className="font-semibold">{t('agent.report.discarded')}:</span> {(s.tratamiento.descartados as any[]).map(d => (typeof d === 'string' ? d : `${d.nombre ?? d.id}${d.motivo ? ` (${d.motivo})` : ''}`)).join('; ')}</p>}
                {nt.trabajos_previos && <p className="text-sm">{nt.trabajos_previos}</p>}
                <Table head={<><Th>{t('agent.report.activity')}</Th><Th right>{t('agent.report.qty')}</Th><Th>{t('agent.b4.unit')}</Th>{!diag && <><Th right>{t('agent.report.unitCost')}</Th><Th right>{t('agent.result.cost')}</Th></>}</>}>
                  {[...(s.trabajos_previos ?? []), ...(s.partidas_tratamiento ?? [])].map((p: any, i: number) => (
                    <tr key={i}><Td>{p.nombre}{p.seguridad ? ` (${t('agent.report.safety')})` : ''}<span className="block text-[10px] text-gray-500">{p.motivo}</span></Td><Td right>{p.cantidad}</Td><Td>{p.unidad}</Td>{!diag && <><Td right>{fmtMoney(p.costo_unitario)}</Td><Td right>{fmtMoney(p.costo)}</Td></>}</tr>
                  ))}
                  {!diag && <>
                  <tr><Td bold>{t('agent.report.subtotal')}</Td><Td /><Td /><Td /><Td right bold>{fmtMoney(s.costos?.subtotal)}</Td></tr>
                  <tr><Td bold>{t('agent.b5.contingency')}</Td><Td /><Td /><Td /><Td right bold>{fmtMoney(s.costos?.imprevistos)}</Td></tr>
                  <tr><Td bold>{t('agent.report.total')}</Td><Td /><Td /><Td /><Td right bold>{fmtMoney(s.costos?.total)}</Td></tr>
                  </>}
                </Table>
                {nt.consecuencia_si_se_difiere && <p className="text-sm"><span className="font-semibold">{t('agent.report.ifDeferred')}:</span> {nt.consecuencia_si_se_difiere}</p>}
              </section>
            );
          })}
        </div>

        <section className="report-page">
          <H2 id="r-5">5. {diag ? t('agent.mode.orderTitle') : t('agent.report.s5')}</H2>
          <p className="text-sm whitespace-pre-line mb-2">{n?.priorizacion}</p>
          {diag ? (
            <Table head={<><Th>{t('agent.b1.section')}</Th><Th right>PCI</Th><Th>{t('agent.b1.level')}</Th><Th>{t('agent.result.treatment')}</Th></>}>
              {sections.map(s => <tr key={s.id}><Td>{s.nombre}</Td><Td right>{fmtPci(s.pci)}</Td><Td>{s.nivel_id} · {s.nivel}</Td><Td>{solutionName(s)}</Td></tr>)}
            </Table>
          ) : <>
          <Table head={<><Th>#</Th><Th>{t('agent.b1.section')}</Th><Th right>{t('agent.result.cost')}</Th><Th right>{t('agent.report.assigned')}</Th><Th right>{t('agent.report.cumulative')}</Th><Th>{t('agent.b1.state')}</Th></>}>
            {sections.map(s => { cumulative += assigned(s); return (
              <tr key={s.id}><Td>{s.prioridad?.posicion ?? '—'}</Td><Td>{s.nombre}</Td><Td right>{fmtMoney(s.costos?.total)}</Td><Td right>{fmtMoney(assigned(s))}</Td><Td right>{fmtMoney(cumulative)}</Td>
                <Td><span style={{ color: ESTADO_COLOR[s.prioridad?.estado] }} className="font-semibold">{t(`agent.estado.${s.prioridad?.estado}`)}</span></Td></tr>
            ); })}
            <tr><Td bold>{t('agent.report.total')}</Td><Td /><Td right bold>{fmtMoney(red.costo_total_necesario)}</Td><Td right bold>{fmtMoney(red.costo_financiado)}</Td><Td /><Td /></tr>
            <tr><Td bold>{t('agent.report.kShortfall')}</Td><Td /><Td right bold>{fmtMoney(red.faltante)}</Td><Td /><Td /><Td /></tr>
            {red.saldo_sin_asignar != null && <tr><Td bold>{t('agent.report.kUnassigned')}</Td><Td /><Td right bold>{fmtMoney(red.saldo_sin_asignar)}</Td><Td /><Td /><Td /></tr>}
          </Table>
          {modes && <p className="text-xs text-gray-700">{t('agent.report.otherMode', { mode: modes.modo, pci: fmtPci(modes.pci_ponderado_despues), n: (modes.tramos_financiados ?? []).length })}</p>}
          </>}
        </section>

        <section className="report-page">
          <H2 id="r-6">6. {t('agent.report.s6')}</H2>
          <Table head={<><Th>{t('agent.report.level')}</Th><Th>{t('agent.b1.section')}</Th><Th>{t('agent.report.alert')}</Th></>}>
            {alerts.map((x, i) => <tr key={i}><Td bold>{t(`agent.report.lvl.${x.level}`)}</Td><Td>{x.sectionName ?? '—'}</Td><Td>{x.text}</Td></tr>)}
          </Table>
        </section>

        <section className="report-page space-y-3">
          <H2 id="r-7">7. {t('agent.report.s7')}</H2>
          <div><p className="font-semibold text-sm mb-1">{t('agent.report.conclusions')}</p><Bullets items={n?.conclusiones} /></div>
          <div><p className="font-semibold text-sm mb-1">{t('agent.report.recommendations')}</p><Bullets items={n?.recomendaciones} /></div>
          <div><p className="font-semibold text-sm mb-1">{t('agent.report.limitations')}</p><Bullets items={n?.limitaciones} /></div>
        </section>

        <section className="report-page">
          <H2 id="r-8">8. {t('agent.report.s8')}</H2>
          <Bullets items={[...uniqueReferences(a) as string[], ...BIBLIOGRAPHY]} />
        </section>

        <section className="report-page text-sm space-y-3">
          <H2 id="r-9">9. {t('agent.report.s9')}</H2>
          <p>{t('agent.report.declaration')}</p>
          <table className="min-w-full text-xs border border-gray-300"><tbody>
            {([['preparedBy', a.proyecto?.inspector ?? project.inspector], ['reviewedBy', ''], ['license', ''], ['signature', ''], ['date', ''], ['observations', '']] as [string, string][]).map(([key, value]) => (
              <tr key={key}><td className="p-2 border border-gray-300 w-48 font-semibold">{t(`agent.report.${key}`)}</td><td className="p-2 border border-gray-300 h-9">{value}</td></tr>
            ))}
          </tbody></table>
        </section>
        <section className="report-page space-y-3">
          <h2 id="r-a" className="text-lg font-bold pb-1 border-b-2" style={{ color: '#0b3c5d', borderColor: '#0b3c5d' }}>{t('agent.report.annexA')}</h2>
          {sections.map(s => (
            <div key={s.id}>
              <p className="text-sm font-semibold">{s.nombre}</p>
              <Table head={<><Th>{t('agent.report.sample')}</Th><Th right>{t('agent.b1.area')} (m²)</Th><Th right>PCI</Th><Th>{t('agent.b1.distresses')}</Th></>}>
                {(s.muestras ?? []).map((m: any) => (
                  <tr key={m.id}><Td>{m.id}{m.adicional ? ` (${t('agent.report.additional')})` : ''}</Td><Td right>{m.area_m2}</Td><Td right>{fmtPci(m.pci)}</Td>
                    <Td>{(m.fallas ?? []).map((f: any) => `${f.tipo}-${f.severidad}: ${f.cantidad}`).join(' · ') || '—'}</Td></tr>
                ))}
              </Table>
            </div>
          ))}
        </section>

        <section className="report-page">
          <h2 id="r-b" className="text-lg font-bold mb-3 pb-1 border-b-2" style={{ color: '#0b3c5d', borderColor: '#0b3c5d' }}>{t('agent.report.annexB')}</h2>
          <Table head={<><Th>{t('agent.report.term')}</Th><Th>{t('agent.report.definition')}</Th></>}>
            {((n?.glosario ?? []) as any[]).map((g, i) => <tr key={i}><Td bold>{g.termino_es ?? g.termino_en}</Td><Td>{g.definicion}</Td></tr>)}
          </Table>
        </section>

        <section className="report-page">
          <h2 id="r-c" className="text-lg font-bold mb-3 pb-1 border-b-2" style={{ color: '#0b3c5d', borderColor: '#0b3c5d' }}>{t('agent.report.annexC')}</h2>
          <Table head={<><Th>{t('agent.report.parameter')}</Th><Th>{t('agent.b4.value')}</Th><Th>{t('agent.b4.source')}</Th></>}>
            {paramRows(a).map((p, i) => <tr key={i}><Td>{p.key}{p.sub ? ` · ${p.sub}` : ''}</Td><Td>{p.value}</Td><Td>{p.origin || '—'}</Td></tr>)}
          </Table>
          <p className="text-sm font-semibold mt-3">{t('agent.report.assumptions')}</p>
          {sections.map(s => (
            <div key={s.id} className="text-xs"><span className="font-semibold">{s.nombre}:</span>{' '}{(s.supuestos ?? []).length ? (s.supuestos as unknown[]).map(assumptionText).join(' · ') : '—'}</div>
          ))}
        </section>
      </article>
    </div>
  );
};
