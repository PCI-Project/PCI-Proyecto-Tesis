import { Project } from '../types';
import { getPCIRating } from '../constants';
import { ExportOptions } from '../components/ExportModal';

// Declare global types for libraries loaded via CDN
declare const jspdf: any;
declare const JSZip: any;

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
            { key: 'Length_m', label: `${t('projectForm.length')} (m)` },
            { key: 'Width_m', label: `${t('projectForm.width')} (m)` },
            { key: 'Area_m2', label: `${t('results.tableArea')} (m²)` },
            { key: 'SectionPCI', label: t('results.tableSectionPCI') },
            { key: 'Rating', label: t('results.tableRating') }
        ];
        const data = project.sections.map(sec => {
            const rating = getPCIRating(sec.pci ?? 100);
            return {
                SectionName: sec.name,
                Length_m: sec.length,
                Width_m: sec.width,
                Area_m2: sec.area.toFixed(2),
                SectionPCI: sec.pci?.toFixed(2) ?? 'N/A',
                Rating: t(rating.labelKey)
            };
        });
        zip.file("section_results.csv", toCSV(data, headers));
    }

    if (options.distressData) {
        const headers = [
            { key: 'SectionName', label: t('projectForm.sectionName') },
            { key: 'SampleID', label: t('results.tableSample') },
            { key: 'IsAdditional', label: t('sampleCard.additional') },
            { key: 'SampleArea_m2', label: t('projectForm.sampleArea') },
            { key: 'DistressID', label: 'Distress ID' },
            { key: 'DistressName', label: t('sampleCard.tableDistressType') },
            { key: 'Severity', label: t('sampleCard.tableSeverity') },
            { key: 'Quantity', label: t('sampleCard.tableQuantity') },
            { key: 'Density_pc', label: `${t('summaryTable.density')} (%)` },
            { key: 'DeductValue', label: t('summaryTable.deductValue') }
        ];
        const data: Record<string, any>[] = [];
        project.sections.forEach(section => {
            section.samples.forEach(sample => {
                const summaries = sample.calculationDetails?.summaries || [];
                if (summaries.length === 0) {
                     data.push({ SectionName: section.name, SampleID: sample.id, IsAdditional: sample.isAdditional, SampleArea_m2: sample.area, DistressName: t('results.noDistresses') });
                } else {
                    summaries.forEach(summary => {
                        data.push({
                            SectionName: section.name,
                            SampleID: sample.id,
                            IsAdditional: sample.isAdditional,
                            SampleArea_m2: sample.area,
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
    
    // --- Title Page ---
    doc.setFontSize(24);
    doc.setTextColor(54, 200, 200); // Primary color
    doc.text("Pavement Condition Report", doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

    doc.setFontSize(18);
    doc.setTextColor(29, 35, 42); // text-base
    doc.text(project.name, doc.internal.pageSize.getWidth() / 2, 45, { align: 'center' });

    doc.autoTable({
        startY: 60,
        body: [
            [{ content: t('projectForm.inspectorName'), styles: { fontStyle: 'bold' } }, project.inspector],
            [{ content: t('projectForm.inspectionDate'), styles: { fontStyle: 'bold' } }, project.inspectionDate],
        ],
        theme: 'plain',
        styles: { fontSize: 12 },
        tableWidth: 'wrap',
        margin: { left: doc.internal.pageSize.getWidth() / 2 - 40 }
    });
    
    doc.autoTable({
        startY: doc.previousAutoTable.finalY + 20,
        body: [
            [t('results.weightedPCI')],
            [{ content: (project.weightedPCI ?? 0).toFixed(2), styles: { fontSize: 48, fontStyle: 'bold' } }],
            [t(finalRating.labelKey)]
        ],
        theme: 'plain',
        styles: { halign: 'center', fontSize: 14, fontStyle: 'bold' },
    });
    
    let finalY = doc.previousAutoTable.finalY;

    // --- Page Content ---
    project.sections.forEach(section => {
        const sectionRating = getPCIRating(section.pci ?? 0);
        if (options.sectionResults) {
            if (finalY > 250) doc.addPage();
            doc.setFontSize(16);
            doc.setTextColor(54, 200, 200);
            doc.text(`${t('projectForm.sectionName')}: ${section.name}`, 14, (finalY > 250 ? 20 : finalY + 15));
            
            doc.autoTable({
                startY: (finalY > 250 ? 28 : finalY + 23),
                head: [[t('results.tableArea'), 'Section PCI', t('results.tableRating')]],
                body: [[`${section.area.toFixed(2)} m²`, section.pci?.toFixed(2) ?? 'N/A', t(sectionRating.labelKey)]],
                theme: 'striped',
                headStyles: { fillColor: [54, 200, 200] },
            });
            finalY = doc.previousAutoTable.finalY;
        }

        if (options.distressData) {
            section.samples.sort((a,b) => a.id - b.id).forEach(sample => {
                 if (finalY > 240) doc.addPage();
                 const details = sample.calculationDetails;
                 doc.setFontSize(12);
                 doc.setTextColor(29, 35, 42);
                 doc.text(`${t('sampleCard.title')} #${sample.id} | PCI: ${details?.pci?.toFixed(2) ?? 'N/A'}`, 14, (finalY > 240 ? 20 : finalY + 10));
                 
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
                    startY: (finalY > 240 ? 28 : finalY + 18),
                    head: head,
                    body: body,
                    theme: 'grid',
                    headStyles: { fillColor: [155, 193, 188] },
                 });
                 finalY = doc.previousAutoTable.finalY;
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
