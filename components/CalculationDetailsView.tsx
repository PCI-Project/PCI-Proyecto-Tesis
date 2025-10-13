import React, { useState } from 'react';
import { Project, Sample, Section } from '../types';
import { Card } from './ui/Card';
import { CDVIterationTable } from './CDVIterationTable';
import { DistressSummaryTable } from './DistressSummaryTable';
import { useTranslations } from '../hooks/useTranslations';

const formatStation = (station: number): string => {
    const km = Math.floor(station / 1000);
    const m = station % 1000;
    return `${km}+${m.toFixed(2).padStart(6, '0')}`;
};

const CalculationDetailCard: React.FC<{ sample: Sample, section: Section }> = ({ sample, section }) => {
  const { t } = useTranslations();
  const details = sample.calculationDetails;

  const sampleStartStation = section.startStation + (sample.id - 1) * section.sampleUnitLength;
  
  if (!details) {
    return (
      <Card className="mt-4 bg-bg-muted border-dashed">
        <h4 className="font-bold text-text-base">{t('calcDetails.sample')} #{sample.id}</h4>
        <p className="text-text-muted mt-2 text-center py-4">
          {t('calcDetails.notGenerated')}
        </p>
      </Card>
    );
  }

  const hdv = details.sortedDeducts[0] || 0;

  return (
    <div className="p-4 border border-primary/40 rounded-lg bg-primary/5 mt-4 shadow-md">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-lg font-bold text-primary mb-1 flex items-center">
            {t('calcDetails.detailTitle')} #{sample.id}
            {sample.isAdditional && (
              <span className="ml-3 text-xs font-semibold bg-accent/10 text-accent px-2 py-1 rounded-full">
                  {t('calcDetails.additional')}
              </span>
            )}
          </h4>
          <p className="text-sm text-text-muted font-mono">{formatStation(sampleStartStation)}</p>
        </div>
        <div className="bg-primary/20 p-3 rounded-lg text-center">
            <p className="text-sm font-bold text-primary">PCI</p>
            <p className="text-2xl font-bold text-primary">{details.pci.toFixed(2)}</p>
        </div>
      </div>
      <div className="space-y-6 mt-4">
        
        {/* Step 1: Distress Summary Table */}
        <div>
          <h5 className="font-semibold text-text-base mb-2">{t('calcDetails.step1Title')}</h5>
          <DistressSummaryTable summaries={details.summaries} />
        </div>

        {/* Step 2 & 3: Sorted Deducts and 'm' calculation */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-semibold text-text-base">{t('calcDetails.step2Title')}</h5>
            <div className="bg-bg-muted p-3 rounded-md mt-1 text-sm text-text-base break-words border border-border-muted h-full">
              {details.sortedDeducts.length > 0 ? details.sortedDeducts.map(d => d.toFixed(1)).join(' | ') : t('calcDetails.noDistresses')}
            </div>
          </div>
          <div>
            <h5 className="font-semibold text-text-base">{t('calcDetails.step3Title')}</h5>
            <div className="bg-bg-muted p-3 rounded-md mt-1 text-sm text-text-base border border-border-muted h-full">
              <p className="text-xs text-text-muted italic">m = 1 + (9/98) * (100 - HDV)</p>
              <p>m = 1 + (9/98) * (100 - {hdv.toFixed(1)}) = <span className="font-bold">{details.m.toFixed(2)}</span></p>
            </div>
          </div>
        </div>

        {/* Step 4: CDV Iteration Table */}
        <div>
           <h5 className="font-semibold text-text-base mb-2">{t('calcDetails.step4Title')}</h5>
           <CDVIterationTable
              allDeducts={details.sortedDeducts}
              steps={details.cdvIterationSteps}
              finalCDV={details.cdv}
              m={details.m}
            />
        </div>
        
        {/* Step 5: Final Result */}
        <div>
           <h5 className="font-semibold text-text-base mb-2">{t('calcDetails.step5Title')}</h5>
           <div className="flex justify-end">
                <table className="w-full md:w-1/2 text-sm border border-border-muted rounded-lg overflow-hidden">
                <tbody className="text-text-base">
                    <tr className="border-b border-border-muted bg-bg-muted">
                    <td className="py-2 px-3 font-medium text-text-muted">{t('calcDetails.tdvForMaxCDV')}</td>
                    <td className="py-2 px-3 text-right font-semibold">{details.totalDeductValue.toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-border-muted">
                    <td className="py-2 px-3 font-medium text-text-muted">{t('calcDetails.qForMaxCDV')}</td>
                    <td className="py-2 px-3 text-right font-semibold">{details.q}</td>
                    </tr>
                    <tr className="border-b border-border-muted bg-bg-muted">
                    <td className="py-2 px-3 font-medium text-text-muted">{t('calcDetails.correctedDeductValue')} (CDV)</td>
                    <td className="py-2 px-3 text-right font-semibold text-danger">{details.cdv.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-primary/20">
                    <td className="py-2 px-3 font-bold text-primary">PCI (100 - CDV)</td>
                    <td className="py-2 px-3 text-right font-bold text-2xl text-primary">{details.pci.toFixed(2)}</td>
                    </tr>
                </tbody>
                </table>
           </div>
        </div>
      </div>
    </div>
  );
};


export const CalculationDetailsView: React.FC<{ project: Project }> = ({ project }) => {
  const { t } = useTranslations();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(project.sections[0]?.id || null);

  const activeSection = project.sections.find(s => s.id === activeSectionId);

  return (
    <Card>
      <h2 className="text-2xl font-bold text-primary mb-6">{t('stepper.step3')}</h2>
      
      {project.sections.length > 1 && (
         <div className="bg-bg-surface p-4 rounded-xl shadow-md border-border-muted/50 mb-6">
            <label htmlFor="section-select" className="block text-sm font-medium text-text-muted mb-1">{t('calcDetails.selectSectionTitle')}</label>
            <select
                id="section-select"
                value={activeSectionId || ''}
                onChange={e => setActiveSectionId(e.target.value)}
                className="block w-full border-border-base rounded-lg shadow-sm focus:ring-2 focus:ring-primary/40 focus:border-primary bg-bg-muted text-text-base"
            >
                {project.sections.map(section => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                ))}
            </select>
        </div>
      )}

      <div className="space-y-6">
        {activeSection ? (
          <div key={activeSection.id} className="p-4 border rounded-xl bg-bg-muted">
            <h3 className="text-xl font-bold text-text-base mb-2">{activeSection.name}</h3>
            {activeSection.samples.length > 0 ? (
                activeSection.samples.sort((a,b) => a.id - b.id).map(sample => (
                  <CalculationDetailCard key={sample.id} sample={sample} section={activeSection} />
                ))
            ) : (
                <p className="text-center py-10 text-text-muted">{t('dataEntry.noSamples')}</p>
            )}
          </div>
        ) : (
            <div className="text-center py-10">
                <p className="text-text-muted">{t('projectForm.noSections')}</p>
            </div>
        )}
      </div>
    </Card>
  );
};