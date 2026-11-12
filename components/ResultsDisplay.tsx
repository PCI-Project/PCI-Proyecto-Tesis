import React, { useState } from 'react';
import { Project, Section, Sample, AppView } from '../types';
import { PCI_RATINGS, getPCIRating } from '../constants';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useTranslations } from '../hooks/useTranslations';
import { ExportModal } from './ExportModal';
import { PCIResultsMap } from './map/PCIResultsMap';

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);

const formatStation = (station: number): string => {
    const km = Math.floor(station / 1000);
    const m = station % 1000;
    return `${km}+${m.toFixed(2).padStart(6, '0')}`;
};

const SampleDetailRows: React.FC<{ samples: Sample[]; section: Section }> = ({ samples, section }) => {
  const { t } = useTranslations();
  return (
    <>
      {samples.sort((a, b) => a.id - b.id).map(sample => {
        const details = sample.calculationDetails;
        const sampleStartStation = section.startStation + (sample.id - 1) * section.sampleUnitLength;
        return (
            <tr key={sample.id} className="odd:bg-secondary/5">
              <td className='py-2 px-3 font-medium'>{sample.id}</td>
              <td className='py-2 px-3 font-mono'>{formatStation(sampleStartStation)}</td>
              <td className='py-2 px-3 font-medium text-primary'>{details?.pci?.toFixed(2) ?? 'N/A'}</td>
              <td className='py-2 px-3 font-medium text-danger'>{details?.cdv?.toFixed(2) ?? 'N/A'}</td>
              <td className='py-2 px-3'>
                <div className='flex flex-wrap gap-x-3 gap-y-1'>
                {details?.summaries?.sort((a,b) => b.deductValue - a.deductValue).map((d, i) => (
                  <span key={i} className="text-xs text-text-muted">{t(d.nameKey)}: <strong className="text-text-base">{d.deductValue.toFixed(1)}</strong></span>
                ))}
                 {details?.summaries?.length === 0 && <span className="text-xs text-text-muted">{t('results.noDistresses')}</span>}
                </div>
              </td>
            </tr>
        )
      })}
    </>
  );
};

const SectionRow: React.FC<{ section: Section; onEvaluateAdditionalSamples?: (sectionId: string, count: number) => void }> = ({ section, onEvaluateAdditionalSamples }) => {
  const { t } = useTranslations();
  const [isExpanded, setIsExpanded] = useState(false);
  const sectionRating = getPCIRating(section.pci ?? 100);

  const regularSamples = section.samples.filter(s => !s.isAdditional);
  // Genuine ASTM "additional sample units" (§2.1.1): nonrepresentative units the user
  // chose freely, never pooled into the random-sample average. Shown as their own block.
  const additionalSamples = section.samples.filter(s => s.isAdditional);

  // Matches calculateSectionPCI: the §7.5.2 statistical check only covers random sample
  // units, excluding nonrepresentative "additional" units (§2.1.1).
  const n = regularSamples.filter(s => s.calculationDetails && s.calculationDetails.pci >= 0).length;

  return (
    <>
      <tr onClick={() => setIsExpanded(!isExpanded)} className="border-b border-border-muted hover:bg-primary/5 cursor-pointer transition-colors duration-200 group">
        <td className="py-3 px-4 font-semibold text-text-base group-hover:text-primary transition-colors">{section.name}</td>
        <td className="py-3 px-4">{section.area.toFixed(2)}</td>
        <td className="py-3 px-4 font-bold text-lg text-primary">{section.pci?.toFixed(2) ?? 'N/A'}</td>
        <td className="py-3 px-4">
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${sectionRating.className}`}>
            {t(sectionRating.labelKey)}
          </span>
        </td>
        <td className="py-3 px-4 text-right text-text-muted group-hover:text-primary">
          <ChevronDownIcon className={isExpanded ? 'rotate-180' : ''}/>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="p-0 bg-bg-base/60">
            <div className="p-4 space-y-4">
              <div>
                  <h4 className="font-bold text-md text-text-base mb-2">{t('results.sampleDetailsTitle', { name: section.name })}</h4>
                  <div className="border border-border-muted rounded-lg overflow-hidden">
                    <table className="min-w-full bg-bg-surface text-sm">
                      <thead className='bg-secondary/20 text-secondary-dark'>
                        <tr>
                          <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableSample')}</th>
                          <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableStation')}</th>
                          <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tablePCI')}</th>
                          <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableCDV')}</th>
                          <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableDVs')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-muted">
                        <SampleDetailRows samples={regularSamples} section={section} />
                      </tbody>
                    </table>
                  </div>
              </div>
              
              {additionalSamples.length > 0 && (
                  <div>
                      <h4 className="font-bold text-md text-text-base mb-1">{t('results.additionalSamplesTitle')}</h4>
                      <p className="text-sm text-text-muted mb-2">{t('results.additionalSamplesDesc')}</p>
                      <div className="border border-accent/40 rounded-lg overflow-hidden mb-4">
                        <table className="min-w-full bg-bg-surface text-sm">
                          <thead className='bg-accent/10 text-accent'>
                            <tr>
                              <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableSample')}</th>
                              <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableStation')}</th>
                              <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tablePCI')}</th>
                              <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableCDV')}</th>
                              <th className="text-left py-2 px-3 uppercase font-semibold text-xs">{t('results.tableDVs')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-muted">
                            <SampleDetailRows samples={additionalSamples} section={section} />
                          </tbody>
                        </table>
                      </div>

                      <Card className="border border-border-muted bg-bg-surface">
                          <h5 className="font-bold text-sm text-text-base mb-1">{t('results.pciBreakdownTitle')}</h5>
                          <p className="text-xs text-text-muted mb-3">{t('results.pciBreakdownSubtitle')}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                              <div className="flex justify-between sm:flex-col sm:justify-start border-b sm:border-b-0 border-border-muted/50 pb-1">
                                  <span className="text-text-muted">{t('results.pciRandomLabel')}</span>
                                  <span className="font-bold text-primary">{section.randomPCI?.toFixed(2) ?? 'N/A'}</span>
                              </div>
                              <div className="flex justify-between sm:flex-col sm:justify-start border-b sm:border-b-0 border-border-muted/50 pb-1">
                                  <span className="text-text-muted">{t('results.pciAdditionalLabel')}</span>
                                  <span className="font-bold text-accent">{section.additionalPCI?.toFixed(2) ?? 'N/A'}</span>
                              </div>
                              <div className="flex justify-between sm:flex-col sm:justify-start pb-1">
                                  <span className="text-text-muted">{t('results.pciCombinedLabel')}</span>
                                  <span className="font-bold text-text-base">{section.pci?.toFixed(2) ?? 'N/A'}</span>
                              </div>
                          </div>
                      </Card>
                  </div>
              )}

              {section.actualStdDev !== undefined && !section.evaluateAllSamples && (
                  <Card className="border border-border-muted bg-bg-surface">
                     <h4 className="font-bold text-md text-text-base mb-1">{t('results.stat_title')}</h4>
                     <p className="text-sm text-text-muted mb-4">{t('results.stat_subtitle')}</p>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm mb-4">
                         <div className="flex justify-between border-b border-border-muted/50 pb-1">
                             <span className="text-text-muted">{t('results.stat_n')}:</span>
                             <span className="font-bold">{n}</span>
                         </div>
                         <div className="flex justify-between border-b border-border-muted/50 pb-1">
                             <span className="text-text-muted">{t('results.stat_s')}:</span>
                             <span className="font-bold">{section.actualStdDev.toFixed(2)}</span>
                         </div>
                         <div className="flex justify-between border-b border-border-muted/50 pb-1">
                             <span className="text-text-muted">{t('results.stat_n_rev')}:</span>
                             <span className="font-bold">{section.revisedSampleUnits ?? 'N/A'}</span>
                         </div>
                         <div className="flex justify-between border-b border-border-muted/50 pb-1">
                             <span className="text-text-muted">{t('results.stat_e')}:</span>
                             <span className="font-bold">±{section.allowableError} pts PCI</span>
                         </div>
                         <div className="flex justify-between border-b border-border-muted/50 pb-1">
                             <span className="text-text-muted">{t('results.stat_conf')}:</span>
                             <span className="font-bold">95%</span>
                         </div>
                     </div>

                     <div className="mt-4 p-4 rounded-lg border border-border-muted bg-bg-base/50">
                         <h5 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">{t('results.stat_verdict')}</h5>
                         {section.samplesSufficient ? (
                             <div>
                                 <p className="text-primary font-bold text-lg">{t('results.stat_sufficient_title')}</p>
                                 <p className="text-sm text-text-muted">{t('results.stat_sufficient_desc')}</p>
                             </div>
                         ) : (
                             <div>
                                 <p className="text-danger font-bold text-lg mb-1">{t('results.stat_insufficient_title')}</p>
                                 <p className="text-sm text-text-muted mb-4">
                                     {t('results.stat_insufficient_desc', { count: section.missingSamples ?? 0 })}
                                 </p>
                                 {onEvaluateAdditionalSamples && (
                                     <Button
                                         variant="primary"
                                         onClick={() => onEvaluateAdditionalSamples(section.id, section.missingSamples ?? 0)}
                                     >
                                         {t('results.stat_button', { count: section.missingSamples ?? 0 })}
                                     </Button>
                                 )}
                             </div>
                         )}
                     </div>
                  </Card>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const ResultsDisplay: React.FC<{ project: Project; onEvaluateAdditionalSamples?: (sectionId: string, count: number) => void; setCurrentView: (view: AppView) => void }> = ({ project, onEvaluateAdditionalSamples, setCurrentView }) => {
  const { t } = useTranslations();
  const [isRatingScaleVisible, setIsRatingScaleVisible] = useState(false);
  const [isExportModalOpen, setExportModalOpen] = useState(false);
  const weightedPCI = project.weightedPCI ?? 0;
  const finalRating = getPCIRating(weightedPCI);
  
  const sortedRatings = Object.values(PCI_RATINGS).sort((a, b) => b.range[1] - a.range[1]);

  return (
    <>
    <Card>
      <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary">{t('results.title')}</h2>
          <p className="text-text-muted">{project.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => setExportModalOpen(true)} variant="secondary">{t('results.exportButton')}</Button>
            <Button onClick={() => setCurrentView('AGENT')} variant="primary">{t('agent.openFromResults')}</Button>
        </div>
      </div>

      <div className={`p-6 rounded-xl mb-6 text-center shadow-xl transition-colors duration-500 ${finalRating.mainCardClassName}`}>
        <div className="flex justify-center items-center gap-2">
            <p className="text-lg uppercase tracking-wider opacity-80 font-semibold">{t('results.weightedPCI')}</p>
            <button 
                onClick={() => setIsRatingScaleVisible(!isRatingScaleVisible)} 
                className="p-1 rounded-full hover:bg-black/20 transition-colors" 
                aria-label={t('results.viewRatingScale')}
                title={t('results.viewRatingScale')}
            >
                <InfoIcon className="h-5 w-5 opacity-90" />
            </button>
        </div>
        <p className="text-7xl font-bold my-2">{weightedPCI.toFixed(2)}</p>
        <div className={`inline-block px-4 py-1.5 rounded-full font-semibold text-lg bg-black/20`}>
          {t(finalRating.labelKey)}
        </div>
      </div>

      {isRatingScaleVisible && (
        <Card className="mb-6 animate-simple-fade-in border border-border-muted">
            <h3 className="text-xl font-bold text-text-base mb-4">{t('results.pciRatingScaleTitle')}</h3>
            <div className="space-y-1">
                {sortedRatings.map(rating => (
                    <div key={rating.labelKey} className={`flex items-center justify-between p-2 px-3 rounded-lg text-sm ${rating.className}`}>
                        <span className="font-semibold">{t(rating.labelKey)}</span>
                        <span className="font-mono font-bold tracking-wider">{`${rating.range[0]} - ${rating.range[1]}`}</span>
                    </div>
                ))}
            </div>
        </Card>
      )}

      <PCIResultsMap project={project} />

      <h3 className="text-xl font-bold text-text-base mb-4">{t('results.sectionBreakdown')}</h3>
      <div className="overflow-x-auto border border-border-muted rounded-lg">
        <table className="min-w-full bg-bg-surface">
          <thead className="bg-secondary/20 text-secondary-dark">
            <tr>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">{t('results.tableSectionName')}</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">{t('results.tableArea')} (m²)</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">{t('results.tableSectionPCI')}</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">{t('results.tableRating')}</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody className="text-text-base">
            {project.sections.map(section => (
              <SectionRow key={section.id} section={section} onEvaluateAdditionalSamples={onEvaluateAdditionalSamples} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
    <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setExportModalOpen(false)}
        project={project}
    />
    </>
  );
};