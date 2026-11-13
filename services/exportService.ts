import { Project } from '../types';
import { getPCIRating } from '../constants';
import { ExportOptions } from '../components/ExportModal';
import { buildSampleUnitRows, formatStation, toUtm } from './gisService';
import { RouteLocation } from '../types';

// Declare global types for libraries loaded via CDN
declare const jspdf: any;
declare const JSZip: any;

// --- Ubicación y unidades de muestra ---

const datumLabel = (datum: string): string => datum === 'NAD27' ? 'NAD 27 (Zona del Canal)' : 'WGS 84';
const lengthSourceLabel = (hasRoute: boolean): string => hasRoute
    ? 'Medido sobre el mapa (eje vial de OpenStreetMap, medido en UTM)'
    : 'Ingresado manualmente';
const toUtmPoint = (point: [number, number], route: RouteLocation): [number, number] =>
    toUtm(point, route.utmZone, route.hemisphere, route.datum);
const geographic = (point?: [number, number]): string => point ? `${point[1].toFixed(6)}, ${point[0].toFixed(6)}` : '';
const utm = (point?: [number, number]): string => point ? `${point[0].toFixed(2)}, ${point[1].toFixed(2)}` : '';

// --- CSV Generation ---

const escapeCsvCell = (cell: any): string => {
    if (cell === null || cell === undefined) return '';
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const toCSV = (data: Record<string, any>[], headers: {key: string, label: string}[]): string => {
    const headerRow = headers.map(h => `"${h.label}"`).join(',');
    const dataRows = data.map(row =>
        headers.map(header => escapeCsvCell(row[header.key])).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
};

export const generateCsvZip = async (project: Project, options: ExportOptions, t: (key: string) => string): Promise<void> => {
    const zip = new JSZip();
    
    if (options.projectSummary) {
        const finalRating = getPCIRating(project.weightedPCI ?? 0);
        const headers = [
            { key: 'ProjectName', label: t('projectForm.projectName') },
            { key: 'Inspector', label: t('projectForm.inspectorName') },
            { key: 'InspectionDate', label: t('projectForm.inspectionDate') },
            { key: 'WeightedPCI', label: t('results.weightedPCI') },
            { key: 'Rating', label: t('results.tableRating') }
        ];
        const data = [{
            ProjectName: project.name,
            Inspector: project.inspector,
            InspectionDate: project.inspectionDate,
            WeightedPCI: (project.weightedPCI ?? 0).toFixed(2),
            Rating: t(finalRating.labelKey)
        }];
        zip.file("project_summary.csv", toCSV(data, headers));
    }

    if (options.sectionResults) {
        const headers = [
            { key: 'SectionName', label: t('projectForm.sectionName') },
            { key: 'Length_m', label: t('projectForm.length') },
            { key: 'Width_m', label: t('projectForm.width') },
            { key: 'Area_m2', label: `${t('results.tableArea')} (m²)` },
            { key: 'SectionPCI', label: t('results.tableSectionPCI') },
            { key: 'Rating', label: t('results.tableRating') },
            { key: 'RandomPCI', label: t('results.pciRandomLabel') },
            { key: 'AdditionalPCI', label: t('results.pciAdditionalLabel') },
            // ASTM D6433 §7.5.2 statistical sufficiency check
            { key: 'SamplesInspected_n', label: t('results.stat_n') },
            { key: 'ActualStdDev_s', label: t('results.stat_s') },
            { key: 'RevisedMinSamples', label: t('results.stat_n_rev') },
            { key: 'MissingSamples', label: t('results.stat_missing') },
            { key: 'SamplesSufficient', label: t('results.stat_verdict') },
        ];
        const data = project.sections.map(sec => {
            const rating = getPCIRating(sec.pci ?? 100);
            const n = sec.samples.filter(s => !s.isAdditional && s.calculationDetails && s.calculationDetails.pci >= 0).length;
            return {
                SectionName: sec.name,
                Length_m: sec.length,
                Width_m: sec.width,
                Area_m2: sec.area.toFixed(2),
                SectionPCI: sec.pci?.toFixed(2) ?? 'N/A',
                Rating: t(rating.labelKey),
                RandomPCI: sec.randomPCI?.toFixed(2) ?? 'N/A',
                AdditionalPCI: sec.additionalPCI?.toFixed(2) ?? 'N/A',
                SamplesInspected_n: n,
                ActualStdDev_s: sec.actualStdDev?.toFixed(2) ?? 'N/A',
                RevisedMinSamples: sec.revisedSampleUnits ?? 'N/A',
                MissingSamples: sec.missingSamples ?? 'N/A',
                SamplesSufficient: sec.samplesSufficient === undefined
                    ? 'N/A'
                    : t(sec.samplesSufficient ? 'results.stat_sufficient_title' : 'results.stat_insufficient_title'),
            };
        });
        zip.file("section_results.csv", toCSV(data, headers));
    }

    if (options.distressData) {
        const headers = [
            { key: 'SectionName', label: t('projectForm.sectionName') },
            { key: 'SampleID', label: t('results.tableSample') },
            { key: 'IsAdditional', label: t('sampleCard.additional') },
            { key: 'SystematicSupplement', label: t('sampleCard.systematicSupplement') },
            { key: 'SampleArea_m2', label: t('projectForm.sampleArea') },
            { key: 'DistressID', label: 'Distress ID' },
            { key: 'DistressName', label: t('sampleCard.tableDistressType') },
            { key: 'Severity', label: t('sampleCard.tableSeverity') },
            { key: 'Quantity', label: t('sampleCard.tableQuantity') },
            { key: 'Density_pc', label: t('summaryTable.density') },
            { key: 'DeductValue', label: t('summaryTable.deductValue') }
        ];
        const data: Record<string, any>[] = [];
        project.sections.forEach(section => {
            const systematicIds = new Set(section.systematicallyAddedSampleIds || []);
            section.samples.forEach(sample => {
                const summaries = sample.calculationDetails?.summaries || [];
                const base = {
                    SectionName: section.name,
                    SampleID: sample.id,
                    IsAdditional: sample.isAdditional,
                    SystematicSupplement: systematicIds.has(sample.id),
                    SampleArea_m2: sample.area,
                };
                if (summaries.length === 0) {
                     data.push({ ...base, DistressName: t('results.noDistresses') });
                } else {
                    summaries.forEach(summary => {
                        data.push({
                            ...base,
                            DistressID: summary.type,
                            DistressName: t(summary.nameKey),
                            Severity: summary.severity,
                            Quantity: summary.quantity.toFixed(3),
                            Density_pc: summary.density?.toFixed(2) ?? 'N/A',
                            DeductValue: summary.deductValue.toFixed(2)
                        });
                    });
                }
            });
        });
        zip.file("distress_data.csv", toCSV(data, headers));
    }

    if (options.calculationDetails) {
         const headers = [
            { key: 'SectionName', label: t('projectForm.sectionName') },
            { key: 'SampleID', label: t('results.tableSample') },
            { key: 'IsAdditional', label: t('sampleCard.additional') },
            { key: 'TotalDeductValue', label: 'TDV' },
            { key: 'CorrectedDeductValue', label: 'CDV' },
            { key: 'PCI', label: 'PCI' },
            { key: 'SortedDeducts', label: t('calcDetails.step2Title') },
        ];
        const data: Record<string, any>[] = [];
        project.sections.forEach(section => {
            section.samples.forEach(sample => {
                const details = sample.calculationDetails;
                if(details) {
                    data.push({
                        SectionName: section.name,
                        SampleID: sample.id,
                        IsAdditional: sample.isAdditional,
                        TotalDeductValue: details.totalDeductValue.toFixed(2),
                        CorrectedDeductValue: details.cdv.toFixed(2),
                        PCI: details.pci.toFixed(2),
                        SortedDeducts: details.sortedDeducts.map(d => d.toFixed(1)).join(' | ')
                    });
                }
            });
        });
        zip.file("calculation_details.csv", toCSV(data, headers));
    }


    if (options.locationData) {
        const BOM = '\uFEFF'; // para que Excel lea bien los acentos
        const locationHeaders = [
            { key: 'SectionName', label: t('projectForm.sectionName') },
            { key: 'Location', label: 'Ubicación' },
            { key: 'LengthSource', label: 'Origen del largo' },
            { key: 'Length_m', label: `${t('projectForm.length')} (m)` },
            { key: 'RoadLength_m', label: 'Largo sobre el eje vial (m)' },
            { key: 'UtmLength_m', label: 'Largo UTM oficial (m)' },
            { key: 'StartStation', label: 'Progresiva inicial' },
            { key: 'EndStation', label: 'Progresiva final' },
            { key: 'Datum', label: 'Datum' },
            { key: 'UtmZone', label: 'Zona UTM' },
            { key: 'StartLat', label: 'Inicio latitud' },
            { key: 'StartLon', label: 'Inicio longitud' },
            { key: 'EndLat', label: 'Fin latitud' },
            { key: 'EndLon', label: 'Fin longitud' },
            { key: 'StartEasting', label: 'Inicio este (m)' },
            { key: 'StartNorthing', label: 'Inicio norte (m)' },
            { key: 'EndEasting', label: 'Fin este (m)' },
            { key: 'EndNorthing', label: 'Fin norte (m)' },
        ];
        const locationData = project.sections.map(section => {
            const route = section.routeLocation;
            const first = route?.routeCoordinates[0];
            const last = route?.routeCoordinates[route.routeCoordinates.length - 1];
            const startUtm = route && first ? toUtmPoint(first, route) : undefined;
            const endUtm = route && last ? toUtmPoint(last, route) : undefined;
            return {
                SectionName: section.name,
                Location: section.location || '',
                LengthSource: lengthSourceLabel(Boolean(route)),
                Length_m: section.length.toFixed(2),
                RoadLength_m: route ? route.routingDistance.toFixed(2) : '',
                UtmLength_m: route ? route.engineeringLength.toFixed(2) : '',
                StartStation: formatStation(section.startStation),
                EndStation: formatStation(section.startStation + section.length),
                Datum: route ? datumLabel(route.datum) : '',
                UtmZone: route ? `${route.utmZone}${route.hemisphere}` : '',
                StartLat: first ? first[1].toFixed(6) : '',
                StartLon: first ? first[0].toFixed(6) : '',
                EndLat: last ? last[1].toFixed(6) : '',
                EndLon: last ? last[0].toFixed(6) : '',
                StartEasting: startUtm ? startUtm[0].toFixed(2) : '',
                StartNorthing: startUtm ? startUtm[1].toFixed(2) : '',
                EndEasting: endUtm ? endUtm[0].toFixed(2) : '',
                EndNorthing: endUtm ? endUtm[1].toFixed(2) : '',
            };
        });
        zip.file("section_location.csv", BOM + toCSV(locationData, locationHeaders));

        const unitHeaders = [
            { key: 'SectionName', label: t('projectForm.sectionName') },
            { key: 'UnitID', label: 'Unidad' },
            { key: 'Evaluated', label: 'Evaluada' },
            { key: 'StartStation', label: 'Progresiva inicial' },
            { key: 'EndStation', label: 'Progresiva final' },
            { key: 'Datum', label: 'Datum' },
            { key: 'UtmZone', label: 'Zona UTM' },
            { key: 'StartLat', label: 'Inicio latitud' },
            { key: 'StartLon', label: 'Inicio longitud' },
            { key: 'EndLat', label: 'Fin latitud' },
            { key: 'EndLon', label: 'Fin longitud' },
            { key: 'StartEasting', label: 'Inicio este (m)' },
            { key: 'StartNorthing', label: 'Inicio norte (m)' },
            { key: 'EndEasting', label: 'Fin este (m)' },
            { key: 'EndNorthing', label: 'Fin norte (m)' },
            { key: 'PCI', label: 'PCI' },
            { key: 'PredominantDistress', label: 'Falla predominante' },
        ];
        const unitData: Record<string, any>[] = [];
        project.sections.forEach(section => {
            const route = section.routeLocation;
            buildSampleUnitRows(section).forEach(unit => {
                unitData.push({
                    SectionName: section.name,
                    UnitID: unit.id,
                    Evaluated: unit.evaluated ? 'Sí' : 'No',
                    StartStation: formatStation(unit.startStation),
                    EndStation: formatStation(unit.endStation),
                    Datum: route ? datumLabel(route.datum) : '',
                    UtmZone: route ? `${route.utmZone}${route.hemisphere}` : '',
                    StartLat: unit.start ? unit.start[1].toFixed(6) : '',
                    StartLon: unit.start ? unit.start[0].toFixed(6) : '',
                    EndLat: unit.end ? unit.end[1].toFixed(6) : '',
                    EndLon: unit.end ? unit.end[0].toFixed(6) : '',
                    StartEasting: unit.startUtm ? unit.startUtm[0].toFixed(2) : '',
                    StartNorthing: unit.startUtm ? unit.startUtm[1].toFixed(2) : '',
                    EndEasting: unit.endUtm ? unit.endUtm[0].toFixed(2) : '',
                    EndNorthing: unit.endUtm ? unit.endUtm[1].toFixed(2) : '',
                    PCI: unit.pci !== undefined ? unit.pci.toFixed(2) : '',
                    PredominantDistress: unit.predominant ? t(unit.predominant) : '',
                });
            });
        });
        zip.file("sample_units.csv", BOM + toCSV(unitData, unitHeaders));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `${project.name.replace(/\s+/g, '_')}_report.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


// --- PDF Generation ---

export const generatePdfReport = async (project: Project, options: ExportOptions, t: (key: string) => string): Promise<void> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const finalRating = getPCIRating(project.weightedPCI ?? 0);
    const pageWidth = doc.internal.pageSize.getWidth();

    // --- Title Page ---
    doc.setFontSize(24);
    doc.setTextColor(54, 200, 200); // Primary color
    doc.text(t('exportModal.pdfTitle'), pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(18);
    doc.setTextColor(29, 35, 42); // text-base
    doc.text(project.name, pageWidth / 2, 45, { align: 'center' });

    let finalY = 45;

    if (options.projectSummary) {
        // Plain centered text instead of a fixed-width table: autoTable's `tableWidth:
        // 'wrap'` sizes itself to its (variable-length, translated) label text, so a
        // hardcoded margin can't keep it centered across languages/labels.
        doc.setFontSize(12);
        doc.setTextColor(29, 35, 42);
        doc.setFont(undefined, 'bold');
        doc.text(t('projectForm.inspectorName'), pageWidth / 2, 62, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.text(project.inspector, pageWidth / 2, 69, { align: 'center' });
        doc.setFont(undefined, 'bold');
        doc.text(t('projectForm.inspectionDate'), pageWidth / 2, 79, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.text(project.inspectionDate, pageWidth / 2, 86, { align: 'center' });

        doc.autoTable({
            startY: 101,
            body: [
                [t('results.weightedPCI')],
                [{ content: (project.weightedPCI ?? 0).toFixed(2), styles: { fontSize: 48, fontStyle: 'bold' } }],
                [t(finalRating.labelKey)]
            ],
            theme: 'plain',
            styles: { halign: 'center', fontSize: 14, fontStyle: 'bold' },
        });

        finalY = doc.previousAutoTable.finalY;
    }

    // --- Page Content ---
    project.sections.forEach(section => {
        const sectionRating = getPCIRating(section.pci ?? 0);
        const additionalSamples = section.samples.filter(s => s.isAdditional);
        const systematicIds = new Set(section.systematicallyAddedSampleIds || []);
        const n = section.samples.filter(s => !s.isAdditional && s.calculationDetails && s.calculationDetails.pci >= 0).length;

        if (options.sectionResults) {
            if (finalY > 250) doc.addPage();
            doc.setFontSize(16);
            doc.setTextColor(54, 200, 200);
            doc.text(`${t('projectForm.sectionName')}: ${section.name}`, 14, (finalY > 250 ? 20 : finalY + 15));

            doc.autoTable({
                startY: (finalY > 250 ? 28 : finalY + 23),
                head: [[t('results.tableArea'), t('results.tableSectionPCI'), t('results.tableRating')]],
                body: [[`${section.area.toFixed(2)} m²`, section.pci?.toFixed(2) ?? 'N/A', t(sectionRating.labelKey)]],
                theme: 'striped',
                headStyles: { fillColor: [54, 200, 200] },
            });
            finalY = doc.previousAutoTable.finalY;

            // Additional/nonrepresentative samples breakdown (ASTM D6433 §11, Eq 5/6/7) -
            // mirrors the order shown in the Results view.
            if (additionalSamples.length > 0) {
                if (finalY > 250) doc.addPage();
                doc.setFontSize(11);
                doc.setTextColor(29, 35, 42);
                doc.text(t('results.pciBreakdownTitle'), 14, (finalY > 250 ? 20 : finalY + 10));
                doc.autoTable({
                    startY: (finalY > 250 ? 26 : finalY + 14),
                    head: [[t('results.pciRandomLabel'), t('results.pciAdditionalLabel'), t('results.pciCombinedLabel')]],
                    body: [[
                        section.randomPCI?.toFixed(2) ?? 'N/A',
                        section.additionalPCI?.toFixed(2) ?? 'N/A',
                        section.pci?.toFixed(2) ?? 'N/A',
                    ]],
                    theme: 'grid',
                    headStyles: { fillColor: [244, 241, 187], textColor: [80, 75, 30] },
                });
                finalY = doc.previousAutoTable.finalY;
            }

            // Statistical sufficiency check (ASTM D6433 §7.5.2).
            if (section.actualStdDev !== undefined && !section.evaluateAllSamples) {
                if (finalY > 250) doc.addPage();
                doc.setFontSize(11);
                doc.setTextColor(29, 35, 42);
                doc.text(t('results.stat_title'), 14, (finalY > 250 ? 20 : finalY + 10));
                const verdict = section.samplesSufficient ? t('results.stat_sufficient_title') : t('results.stat_insufficient_title');
                doc.autoTable({
                    startY: (finalY > 250 ? 26 : finalY + 14),
                    head: [[t('results.stat_n'), t('results.stat_s'), t('results.stat_n_rev'), t('results.stat_e'), t('results.stat_verdict')]],
                    body: [[
                        String(n),
                        section.actualStdDev.toFixed(2),
                        String(section.revisedSampleUnits ?? 'N/A'),
                        `±${section.allowableError}`,
                        verdict,
                    ]],
                    theme: 'grid',
                    headStyles: { fillColor: [155, 193, 188] },
                });
                finalY = doc.previousAutoTable.finalY;
            }
        }

        if (options.locationData) {
            const route = section.routeLocation;
            const first = route?.routeCoordinates[0];
            const last = route?.routeCoordinates[route.routeCoordinates.length - 1];
            const infoRows: string[][] = [
                ['Ubicación', section.location || 'No indicada'],
                ['Progresivas', `${formatStation(section.startStation)} – ${formatStation(section.startStation + section.length)}`],
                ['Largo del tramo', `${section.length.toFixed(2)} m`],
                ['Origen del largo', lengthSourceLabel(Boolean(route))],
            ];
            if (route && first && last) {
                infoRows.push(
                    ['Largo sobre el eje vial', `${route.routingDistance.toFixed(2)} m`],
                    ['Largo UTM oficial', `${route.engineeringLength.toFixed(2)} m`],
                    ['Datum / zona UTM', `${datumLabel(route.datum)} / ${route.utmZone}${route.hemisphere}`],
                    ['Inicio (lat, lon)', geographic(first)],
                    ['Inicio (E, N)', utm(toUtmPoint(first, route))],
                    ['Fin (lat, lon)', geographic(last)],
                    ['Fin (E, N)', utm(toUtmPoint(last, route))],
                );
            }
            const infoY = finalY > 225 ? (doc.addPage(), 20) : finalY + 12;
            doc.setFontSize(13);
            doc.setTextColor(54, 200, 200);
            doc.text(`${t('projectForm.sectionName')}: ${section.name} - Ubicación y coordenadas`, 14, infoY);
            doc.autoTable({
                startY: infoY + 4,
                body: infoRows,
                theme: 'grid',
                styles: { fontSize: 9 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
            });
            finalY = doc.previousAutoTable.finalY;

            const units = buildSampleUnitRows(section);
            if (units.length > 0) {
                const withCoordinates = units.some(unit => unit.startUtm);
                const unitHead = withCoordinates
                    ? [['Unidad', 'Progresiva', 'Inicio (E, N)', 'Fin (E, N)', 'Evaluada', 'PCI']]
                    : [['Unidad', 'Progresiva', 'Evaluada', 'PCI']];
                const unitBody = units.map(unit => {
                    const stationText = `${formatStation(unit.startStation)} – ${formatStation(unit.endStation)}`;
                    const evaluatedText = unit.evaluated ? 'Sí' : 'No';
                    const pciText = unit.pci !== undefined ? unit.pci.toFixed(2) : '-';
                    return withCoordinates
                        ? [`#${unit.id}`, stationText, utm(unit.startUtm) || '-', utm(unit.endUtm) || '-', evaluatedText, pciText]
                        : [`#${unit.id}`, stationText, evaluatedText, pciText];
                });
                const unitsY = finalY > 235 ? (doc.addPage(), 20) : finalY + 10;
                doc.setFontSize(12);
                doc.setTextColor(29, 35, 42);
                doc.text('Unidades de muestra: progresivas y coordenadas', 14, unitsY);
                doc.autoTable({
                    startY: unitsY + 4,
                    head: unitHead,
                    body: unitBody,
                    theme: 'striped',
                    headStyles: { fillColor: [54, 200, 200] },
                    styles: { fontSize: 8 },
                });
                finalY = doc.previousAutoTable.finalY;
            }
        }

        if (options.distressData || options.calculationDetails) {
            // Sort a copy - never mutate the project's own sample array as a side effect.
            [...section.samples].sort((a, b) => a.id - b.id).forEach(sample => {
                 if (finalY > 240) doc.addPage();
                 const details = sample.calculationDetails;
                 doc.setFontSize(12);
                 doc.setTextColor(29, 35, 42);
                 let sampleLabel = `${t('sampleCard.title')} #${sample.id} | PCI: ${details?.pci?.toFixed(2) ?? 'N/A'}`;
                 if (sample.isAdditional) {
                     sampleLabel += ` (${t('sampleCard.additional')})`;
                 } else if (systematicIds.has(sample.id)) {
                     sampleLabel += ` (${t('sampleCard.systematicSupplement')})`;
                 }
                 doc.text(sampleLabel, 14, (finalY > 240 ? 20 : finalY + 10));
                 let currentY = (finalY > 240 ? 28 : finalY + 18);

                 if (options.distressData) {
                     const head = [[t('sampleCard.tableDistressType'), t('sampleCard.tableSeverity'), t('sampleCard.tableQuantity'), t('summaryTable.density'), t('summaryTable.deductValue')]];

                     let body;
                     if (details?.summaries && details.summaries.length > 0) {
                         body = details.summaries.map(s => [
                             `${s.type}. ${t(s.nameKey)}`,
                             s.severity,
                             s.quantity.toFixed(2),
                             s.density?.toFixed(2) ?? 'N/A',
                             s.deductValue.toFixed(2)
                         ]);
                     } else {
                         body = [
                             [{ content: t('results.noDistresses'), colSpan: 5, styles: { halign: 'center' } }]
                         ];
                     }

                     doc.autoTable({
                        startY: currentY,
                        head: head,
                        body: body,
                        theme: 'grid',
                        headStyles: { fillColor: [155, 193, 188] },
                     });
                     currentY = doc.previousAutoTable.finalY + 4;
                 }

                 if (options.calculationDetails && details) {
                     doc.autoTable({
                        startY: currentY,
                        head: [['TDV', 'CDV', 'm', t('calcDetails.step2Title')]],
                        body: [[
                            details.totalDeductValue.toFixed(2),
                            details.cdv.toFixed(2),
                            details.m.toFixed(2),
                            details.sortedDeducts.length > 0 ? details.sortedDeducts.map(d => d.toFixed(1)).join(' | ') : t('calcDetails.noDistresses'),
                        ]],
                        theme: 'plain',
                        styles: { fontSize: 9 },
                        headStyles: { fontStyle: 'bold', textColor: [107, 114, 128] },
                     });
                     currentY = doc.previousAutoTable.finalY;
                 }

                 finalY = currentY;
             });
        }
    });

    // --- Add Footers ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`AsphaltPCI Pro Report | ${project.name}`, 14, 287);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 35, 287);
    }

    doc.save(`${project.name.replace(/\s+/g, '_')}_report.pdf`);
};
