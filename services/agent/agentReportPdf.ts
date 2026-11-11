import type { AgentRun, Project } from '../../types';
import {
  allAlerts, assigned, BIBLIOGRAPHY, fmtInt, fmtMoney, fmtPci, levelColor, narrativeFor, orderedSections,
  reportCode, solutionName, solutionTag, uniqueReferences, assumptionText, paramRows,
} from './reportModel';

declare const jspdf: any;

const hexToRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const HEAD = { fillColor: [11, 60, 93] as [number, number, number], textColor: 255 };

/** Informe en PDF (A4 vertical, márgenes de 16 mm). Mismas secciones que AgentReport, con lo esencial de cada una. */
export function generateAgentReportPdf(project: Project, run: AgentRun, t: (key: string, r?: Record<string, string | number>) => string): void {
  const { jsPDF } = jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const a: any = run.analysis;
  const n: any = run.narrative;
  const red = a.red ?? {};
  const diag = a.modo === 'diagnostico'; // C1: informe patológico, sin dinero ni prioridad
  const cal = a.calibracion_usada ?? {};
  const currency = cal.moneda ?? run.config.currency;
  const sections = orderedSections(a);
  const code = reportCode(a);
  let y = M;

  const ensure = (h: number) => { if (y + h > H - 18) { doc.addPage(); y = M; } };
  const heading = (text: string, newPage = true) => {
    if (newPage) { doc.addPage(); y = M; } else ensure(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(11, 60, 93);
    doc.text(text, M, y); y += 2; doc.setDrawColor(11, 60, 93); doc.line(M, y, W - M, y); y += 7;
    doc.setTextColor(30, 30, 30);
  };
  const paragraph = (text: unknown, size = 10, bold = false) => {
    if (!text) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(String(text), W - 2 * M);
    lines.forEach(line => { ensure(size * 0.45 + 1); doc.text(line, M, y); y += size * 0.45 + 0.8; });
    y += 1.5;
  };
  const bullets = (items?: string[]) => (items ?? []).forEach(item => paragraph(`• ${item}`));
  const table = (head: string[], body: (string | number)[][], opts: Record<string, unknown> = {}) => {
    ensure(20);
    doc.autoTable({ startY: y, head: [head], body, theme: 'striped', headStyles: HEAD, styles: { fontSize: 8, cellPadding: 1.5 }, margin: { left: M, right: M, bottom: 18 }, ...opts });
    y = doc.lastAutoTable.finalY + 5;
  };

  // Portada
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(11, 60, 93);
  doc.text(doc.splitTextToSize(diag ? t('agent.mode.reportTitle') : t('agent.report.title'), W - 2 * M), W / 2, 50, { align: 'center' });
  doc.setFontSize(14); doc.setTextColor(30, 30, 30); doc.text(String(a.proyecto?.nombre ?? project.name), W / 2, 80, { align: 'center' });
  y = 95;
  const cover: [string, unknown][] = [
    [t('agent.report.entity'), a.proyecto?.entidad], [t('agent.report.inspector'), a.proyecto?.inspector ?? project.inspector], [t('agent.report.inspDate'), a.proyecto?.fecha_inspeccion],
    [t('agent.report.generated'), run.createdAt.slice(0, 16).replace('T', ' ')], [t('agent.report.code'), code], [t('agent.report.agentVersion'), run.agentVersion || a.version], [t('agent.report.textSource'), t(`agent.source.${run.narrativeSource}`)],
  ];
  table(['', ''], cover.filter(([, v]) => v).map(([k, v]) => [k, String(v)]), { showHead: false, theme: 'plain', columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } }, styles: { fontSize: 10 } });
  paragraph(t('agent.report.disclaimer'), 9);

  // 1 Resumen
  heading(`1. ${t('agent.report.s1')}`);
  if (diag) table([t('agent.result.pci'), t('agent.report.kArea')], [[fmtPci(red.pci_ponderado), `${fmtInt(red.area_total_m2)} m²`]]);
  else table([t('agent.report.kPci'), t('agent.report.kNeeded'), t('agent.report.kBudget'), t('agent.report.kFunded'), t('agent.report.kShortfall')], [[
    `${fmtPci(red.pci_ponderado)} → ${fmtPci(red.pci_ponderado_despues)}`, `${fmtMoney(red.costo_total_necesario)} ${currency}`,
    cal.presupuesto == null ? t('agent.b5.noCap') : `${fmtMoney(cal.presupuesto)} ${currency}`, `${fmtMoney(red.costo_financiado)} ${currency}`, `${fmtMoney(red.faltante)} ${currency}`,
  ]]);
  paragraph(n?.resumen_ejecutivo);
  const critical = allAlerts(a, n).filter(x => x.level === 'critica');
  if (critical.length) { paragraph(t('agent.report.critical'), 10, true); bullets(critical.map(x => x.text)); }

  // 2 Metodología
  heading(`2. ${t('agent.report.s2')}`);
  paragraph(t(diag ? 'agent.mode.method' : 'agent.report.method'));
  paragraph(`${t('agent.report.thresholds')}: ${Object.entries(cal.umbrales_pci ?? {}).map(([k, v]) => `${k} ≥ ${v}`).join(' · ') || '—'}`);
  paragraph(t('agent.report.hash', { hash: String(a.proyecto?.huella_entrada ?? '') }), 8);

  // 3 Datos
  heading(`3. ${t('agent.report.s3')}`);
  table([t('agent.b1.section'), t('agent.b2.roadType'), t('agent.b2.curb'), t('agent.b2.traffic'), t('agent.b2.drainage')], sections.map(s => {
    const c = s.contexto_usado ?? {};
    const mark = (key: string, v: unknown) => `${v ?? '—'}${(c.asumidos ?? []).includes(key) ? '*' : ''}`;
    return [s.nombre, mark('tipo_via', c.tipo_via), mark('altura_bordillo_cm', c.altura_bordillo_cm), c.esal_millones != null ? `ESAL ${c.esal_millones} M` : mark('trafico', c.clase_trafico), c.drenaje ?? '—'];
  }));
  paragraph(`* ${t('agent.report.assumedNote')}`, 8);
  if (diag) paragraph(t('agent.mode.diagnosticNote'), 9);
  else table([t('agent.b4.treatment'), `${t('agent.b4.value')} (${currency})`, t('agent.b4.source')], Object.entries(cal.costos ?? {}).map(([id, c]: [string, any]) =>
    [id, fmtMoney(c.valor), c.origen === 'calibrado' || c.origen === 'propio' ? t('agent.report.calibrated') : t('agent.b4.example')]));

  // 4 Fichas
  sections.forEach(s => {
    const nt = narrativeFor(n, s.id);
    doc.addPage(); y = M;
    const [r, g, b] = hexToRgb(levelColor(s.nivel_id));
    doc.setFillColor(r, g, b); doc.rect(M, y, W - 2 * M, 10, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
    doc.text(`4. ${s.nombre}  ·  PCI ${fmtPci(s.pci)}  ·  ${s.nivel_id} ${s.nivel}`, M + 2, y + 6.5);
    doc.setTextColor(30, 30, 30); y += 15;
    const tag = solutionTag(s);
    paragraph(`${t('agent.report.solution')}: ${solutionName(s)}${tag ? ` (${t(`agent.report.${tag}`)})` : ''}`, 10, true);
    if (!diag) table([t('agent.result.cost'), t('agent.report.costM2'), t('agent.report.years'), 'B/C', t('agent.report.priority')], [[
      `${fmtMoney(s.costos?.total)} ${currency}`, fmtMoney(s.costos?.costo_m2), String(s.beneficio_detalle?.anios_recuperados ?? '—'), String(s.relacion_bc ?? '—'),
      `${s.prioridad?.posicion ?? '—'} · ${t(`agent.estado.${s.prioridad?.estado}`)}`,
    ]]);
    if (nt.diagnostico) { paragraph(t('agent.report.diagnosis'), 10, true); paragraph(nt.diagnostico); }
    if (nt.justificacion) { paragraph(t('agent.report.justification'), 10, true); paragraph(nt.justificacion); }
    paragraph(nt.trabajos_previos);
    const rows = [...(s.trabajos_previos ?? []), ...(s.partidas_tratamiento ?? [])].map((p: any) =>
      diag ? [`${p.nombre}${p.seguridad ? ` (${t('agent.report.safety')})` : ''}`, p.cantidad, p.unidad] : [`${p.nombre}${p.seguridad ? ` (${t('agent.report.safety')})` : ''}`, p.cantidad, p.unidad, fmtMoney(p.costo_unitario), fmtMoney(p.costo)]);
    if (!diag) rows.push([t('agent.report.subtotal'), '', '', '', fmtMoney(s.costos?.subtotal)], [t('agent.b5.contingency'), '', '', '', fmtMoney(s.costos?.imprevistos)], [t('agent.report.total'), '', '', '', fmtMoney(s.costos?.total)]);
    table(diag ? [t('agent.report.activity'), t('agent.report.qty'), t('agent.b4.unit')] : [t('agent.report.activity'), t('agent.report.qty'), t('agent.b4.unit'), t('agent.report.unitCost'), t('agent.result.cost')], rows, { columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    if (nt.consecuencia_si_se_difiere) paragraph(`${t('agent.report.ifDeferred')}: ${nt.consecuencia_si_se_difiere}`);
  });

  // 5 Priorización
  let cumulative = 0;
  heading(`5. ${diag ? t('agent.mode.orderTitle') : t('agent.report.s5')}`);
  paragraph(n?.priorizacion);
  if (diag) {
    table([t('agent.b1.section'), 'PCI', t('agent.b1.level'), t('agent.result.treatment')], sections.map(s => [s.nombre, fmtPci(s.pci), `${s.nivel_id} · ${s.nivel}`, solutionName(s)]));
  } else {
    const prio = sections.map(s => { cumulative += assigned(s); return [s.prioridad?.posicion ?? '—', s.nombre, fmtMoney(s.costos?.total), fmtMoney(assigned(s)), fmtMoney(cumulative), t(`agent.estado.${s.prioridad?.estado}`)]; });
    prio.push(['', t('agent.report.total'), fmtMoney(red.costo_total_necesario), fmtMoney(red.costo_financiado), '', ''], ['', t('agent.report.kShortfall'), fmtMoney(red.faltante), '', '', '']);
    table(['#', t('agent.b1.section'), t('agent.result.cost'), t('agent.report.assigned'), t('agent.report.cumulative'), t('agent.b1.state')], prio, { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
  }

  // 6 Alertas
  heading(`6. ${t('agent.report.s6')}`);
  table([t('agent.report.level'), t('agent.b1.section'), t('agent.report.alert')], allAlerts(a, n).map(x => [t(`agent.report.lvl.${x.level}`), x.sectionName ?? '—', x.text]));

  // 7 Conclusiones
  heading(`7. ${t('agent.report.s7')}`);
  paragraph(t('agent.report.conclusions'), 11, true); bullets(n?.conclusiones);
  paragraph(t('agent.report.recommendations'), 11, true); bullets(n?.recomendaciones);
  paragraph(t('agent.report.limitations'), 11, true); bullets(n?.limitaciones);

  // 8 Referencias, 9 Firma
  heading(`8. ${t('agent.report.s8')}`);
  bullets([...(uniqueReferences(a) as string[]), ...BIBLIOGRAPHY]);
  heading(`9. ${t('agent.report.s9')}`, false);
  paragraph(t('agent.report.declaration'));
  table(['', ''], [['preparedBy', a.proyecto?.inspector ?? project.inspector ?? ''], ['reviewedBy', ''], ['license', ''], ['signature', ''], ['date', ''], ['observations', '']].map(([k, v]) => [t(`agent.report.${k}`), v]),
    { showHead: false, theme: 'grid', columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } }, styles: { fontSize: 9, minCellHeight: 9 } });

  // Anexos A, B y C
  heading(t('agent.report.annexA'));
  sections.forEach(s => {
    paragraph(s.nombre, 10, true);
    table([t('agent.report.sample'), `${t('agent.b1.area')} (m²)`, 'PCI', t('agent.b1.distresses')], (s.muestras ?? []).map((m: any) => [
      `${m.id}${m.adicional ? ` (${t('agent.report.additional')})` : ''}`, m.area_m2, fmtPci(m.pci), (m.fallas ?? []).map((f: any) => `${f.tipo}-${f.severidad}: ${f.cantidad}`).join(' · ') || '—',
    ]));
  });
  heading(t('agent.report.annexB'));
  table([t('agent.report.term'), t('agent.report.definition')], ((n?.glosario ?? []) as any[]).map(g => [g.termino_es ?? g.termino_en, g.definicion]));
  heading(t('agent.report.annexC'));
  table([t('agent.report.parameter'), t('agent.b4.value'), t('agent.b4.source')], paramRows(a).map(p => [`${p.key}${p.sub ? ` · ${p.sub}` : ''}`, p.value, p.origin || '—']));
  paragraph(t('agent.report.assumptions'), 10, true);
  sections.forEach(s => paragraph(`${s.nombre}: ${(s.supuestos ?? []).length ? (s.supuestos as unknown[]).map(assumptionText).join(' · ') : '—'}`, 9));

  // Pie con número de página (segunda pasada)
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 110);
    doc.text(`${a.proyecto?.nombre ?? project.name} · ${t('agent.report.code')} ${code}`, M, H - 8);
    doc.text(`${t('agent.report.page', { n: i, total })}`, W - M, H - 8, { align: 'right' });
  }
  doc.save(`${String(a.proyecto?.nombre ?? project.name).replace(/\s+/g, '_')}_recomendaciones_v${run.number}.pdf`);
}
