import React, { useState, useEffect } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import { Button } from './ui/Button';
import { SampleCard } from './SampleCard';
import { SelectSampleUnitModal } from './SelectSampleUnitModal';
import { Project, Sample } from '../types';

interface DataEntryViewProps {
  project: Project;
  onSampleUpdate: (sectionId: string, updatedSample: Sample) => void;
  onSampleAdd: (sectionId: string, sampleId: number) => void;
  onSampleDelete: (sectionId: string, sampleId: number) => void;
  initialConfig?: { sectionId: string; focusSampleId?: number; newlyAddedIds?: number[] } | null;
}

export const DataEntryView: React.FC<DataEntryViewProps> = ({ project, onSampleUpdate, onSampleAdd, onSampleDelete, initialConfig }) => {
  const { t } = useTranslations();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialConfig?.sectionId || project.sections[0]?.id || null);
  const [activeSampleId, setActiveSampleId] = useState<number | null>(
    initialConfig?.focusSampleId ?? project.sections.find(s => s.id === (initialConfig?.sectionId || project.sections[0]?.id))?.samples[0]?.id ?? null
  );
  const [isSelectModalOpen, setSelectModalOpen] = useState(false);
  const [systematicNotice, setSystematicNotice] = useState<number[] | null>(initialConfig?.newlyAddedIds || null);

  const activeSection = project.sections.find(s => s.id === activeSectionId);
  const systematicIds = activeSection?.systematicallyAddedSampleIds || [];

  // Focuses the section/sample designated by App (e.g. the systematically-selected sample
  // added to satisfy the ASTM §7.5.2.2 statistical check). This never opens the free-pick
  // modal - that modal is reserved for the user explicitly adding a genuine additional
  // (nonrepresentative) sample unit via the "+ Add Sample" button below.
  useEffect(() => {
    if (initialConfig) {
      setActiveSectionId(initialConfig.sectionId);
      if (initialConfig.focusSampleId != null) {
        setActiveSampleId(initialConfig.focusSampleId);
      }
      if (initialConfig.newlyAddedIds?.length) {
        setSystematicNotice(initialConfig.newlyAddedIds);
      }
    }
  }, [initialConfig]);

  useEffect(() => {
     if (!activeSectionId && project.sections.length > 0) {
        setActiveSectionId(project.sections[0].id);
        setActiveSampleId(project.sections[0].samples[0]?.id || null);
    }
  }, [project.sections, activeSectionId]);

  const handleAddSample = (sampleId: number) => {
    if (!activeSection) return;
    onSampleAdd(activeSection.id, sampleId);
    setActiveSampleId(sampleId);
    setSelectModalOpen(false);
  };
  
  const handleSelectSection = (id: string) => {
    setActiveSectionId(id);
    const newSection = project.sections.find(s => s.id === id);
    setActiveSampleId(newSection?.samples[0]?.id || null);
  }
  
  useEffect(() => {
    if (activeSection && !activeSection.samples.some(s => s.id === activeSampleId)) {
        setActiveSampleId(activeSection.samples[0]?.id || null);
    }
  }, [activeSection, activeSampleId, activeSection?.samples]);


  return (
    <div className="space-y-6">
        {systematicNotice && systematicNotice.length > 0 && (
            <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                    <p className="font-bold text-secondary-dark">{t('dataEntry.systematicNoticeTitle')}</p>
                    <p className="text-sm text-text-muted mt-1">
                        {t('dataEntry.systematicNoticeDesc', { ids: systematicNotice.map(id => `#${id}`).join(', ') })}
                    </p>
                </div>
                <button
                    onClick={() => setSystematicNotice(null)}
                    aria-label={t('modal.close')}
                    className="text-text-muted hover:text-text-base shrink-0 text-xl leading-none px-1"
                >
                    &times;
                </button>
            </div>
        )}
        <div className="bg-bg-surface p-4 rounded-xl shadow-md border-border-muted/50">
            <label htmlFor="section-select" className="block text-sm font-medium text-text-muted mb-1.5">{t('dataEntry.selectSection')}:</label>
            <select
                id="section-select"
                value={activeSectionId || ''}
                onChange={e => handleSelectSection(e.target.value)}
                className="block w-full border-border-muted rounded-lg shadow-sm focus:ring-2 focus:ring-primary/40 focus:border-primary bg-bg-base/80 text-text-base font-semibold p-3"
            >
                {project.sections.map(section => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                ))}
            </select>
        </div>

        {activeSection && (
            <div>
                 <div className="flex items-center gap-2 border-b border-border-muted mb-4 overflow-x-auto pb-2">
                    {activeSection.samples.sort((a,b) => a.id - b.id).map(sample => (
                        <button
                            key={sample.id}
                            onClick={() => setActiveSampleId(sample.id)}
                            title={systematicIds.includes(sample.id) ? t('dataEntry.systematicBadge') : undefined}
                            className={`px-4 py-2 text-sm font-bold rounded-lg whitespace-nowrap transition-colors border-2 ${
                                activeSampleId === sample.id
                                ? 'bg-primary text-text-inverted border-primary shadow-md'
                                : 'bg-bg-surface text-text-muted hover:bg-primary/10 hover:text-primary border-transparent'
                            }`}
                        >
                            {t('dataEntry.sample')} #{sample.id} {sample.isAdditional ? `(${t('dataEntry.additionalShort')})` : ''}
                            {systematicIds.includes(sample.id) && <span className="ml-1 text-secondary-dark" aria-hidden="true">&bull;</span>}
                        </button>
                    ))}
                    <Button onClick={() => setSelectModalOpen(true)} variant="secondary" className="text-sm shrink-0 !py-2 !px-4 !shadow-none !bg-secondary/30 !text-secondary-dark hover:!bg-secondary/50">
                       + {t('dataEntry.addSample')}
                    </Button>
                </div>
                
                {activeSection.samples.length > 0 ? activeSection.samples.map(sample => (
                    <div key={sample.id} style={{ display: activeSampleId === sample.id ? 'block' : 'none' }}>
                       <SampleCard
                           sample={sample}
                           sectionWidth={activeSection.width}
                           sectionStartStation={activeSection.startStation}
                           sectionSampleUnitLength={activeSection.sampleUnitLength}
                           isSystematicSupplement={systematicIds.includes(sample.id)}
                           onUpdate={updatedSample => onSampleUpdate(activeSection.id, updatedSample)}
                           onDelete={sampleId => onSampleDelete(activeSection.id, sampleId)}
                       />
                    </div>
                )) : (
                  <div className="text-center py-12 bg-bg-surface rounded-lg border-2 border-dashed border-border-muted">
                    <p className="text-text-base font-semibold">{t('dataEntry.noSamples')}</p>
                  </div>
                )}
            </div>
        )}
        {activeSection && isSelectModalOpen && (
            <SelectSampleUnitModal
                isOpen={isSelectModalOpen}
                onClose={() => setSelectModalOpen(false)}
                onSelect={handleAddSample}
                totalUnits={activeSection.totalSampleUnits}
                existingSampleIds={activeSection.samples.map(s => s.id)}
            />
        )}
    </div>
  );
};
