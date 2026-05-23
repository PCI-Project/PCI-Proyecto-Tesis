import React, { useState, useEffect, useMemo } from 'react';
import { Project, Section, PavementType, Sample } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { calculateSectionParameters } from '../services/pciService';
import { ASTM_DEFAULTS } from '../constants';
import { useTranslations } from '../hooks/useTranslations';
import { useAuth } from '../contexts/AuthContext';
import { Tooltip } from './ui/Tooltip';

interface ProjectFormProps {
  onProjectCreateOrUpdate: (project: Omit<Project, 'id' | 'lastView'>) => void;
  initialProject?: Project | null;
}

const TrashIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const QuestionMarkIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
);

const formatStation = (station: number): string => {
    const km = Math.floor(station / 1000);
    const m = station % 1000;
    return `${km}+${m.toFixed(2).padStart(6, '0')}`;
};


export const ProjectForm: React.FC<ProjectFormProps> = ({ onProjectCreateOrUpdate, initialProject }) => {
  const { t } = useTranslations();
  const { user } = useAuth();
  const [projectData, setProjectData] = useState({
    name: initialProject?.name || 'New Road Project',
    inspector: initialProject?.inspector || user?.name || '',
    inspectionDate: initialProject?.inspectionDate || new Date().toISOString().split('T')[0],
  });
  const [sections, setSections] = useState<Section[]>(initialProject?.sections || []);
  const [newSection, setNewSection] = useState({
      name: '',
      length: '3000',
      width: '6.5',
      startStation: '0',
      sampleUnitArea: ASTM_DEFAULTS.FLEXIBLE_SAMPLE_AREA.toString(),
      stdDev: ASTM_DEFAULTS.STD_DEV_AC.toString(),
      allowableError: ASTM_DEFAULTS.ALLOWABLE_ERROR.toString(),
      evaluateAllSamples: false,
      startSampleUnit: '1',
  });

  const newSectionParams = useMemo(() => {
    const length = parseFloat(newSection.length);
    const width = parseFloat(newSection.width);
    const sampleUnitArea = parseFloat(newSection.sampleUnitArea);
    const stdDev = parseFloat(newSection.stdDev);
    const allowableError = parseFloat(newSection.allowableError);

    const hasInvalidNumbers = isNaN(length) || isNaN(width) || isNaN(sampleUnitArea) || length <= 0 || width <= 0 || sampleUnitArea <= 0 || isNaN(stdDev) || isNaN(allowableError);
    const area = length * width;

    if (newSection.evaluateAllSamples || hasInvalidNumbers) {
      const totalUnits = (area > 0 && sampleUnitArea > 0) ? Math.ceil(area / sampleUnitArea) : 0;
      const minUnits = newSection.evaluateAllSamples ? totalUnits : 1;
      return { totalSampleUnits: totalUnits, minSampleUnits: minUnits, samplingInterval: 1 };
    }
    
    return calculateSectionParameters(area, sampleUnitArea, stdDev, allowableError, false);
  }, [newSection.length, newSection.width, newSection.sampleUnitArea, newSection.stdDev, newSection.allowableError, newSection.evaluateAllSamples]);

  useEffect(() => {
    const startUnit = parseInt(newSection.startSampleUnit, 10);
    const interval = newSectionParams.samplingInterval;
    if (!newSection.evaluateAllSamples && interval > 0 && startUnit > interval) {
        setNewSection(prev => ({ ...prev, startSampleUnit: '1' }));
    }
  }, [newSection.startSampleUnit, newSection.evaluateAllSamples, newSectionParams.samplingInterval]);
  
  const handleProjectDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectData({ ...projectData, [e.target.name]: e.target.value });
  };

  const handleNewSectionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const name = target.name;
    const value = target.type === 'checkbox' && target instanceof HTMLInputElement ? target.checked : target.value;

    setNewSection(prev => ({
        ...prev,
        [name]: value
    }));
  };

  const handleAddSection = () => {
    const length = parseFloat(newSection.length);
    const width = parseFloat(newSection.width);
    const startStation = parseFloat(newSection.startStation);
    const sampleUnitArea = parseFloat(newSection.sampleUnitArea);
    const stdDev = parseFloat(newSection.stdDev);
    const allowableError = parseFloat(newSection.allowableError);
    const startSampleUnit = parseInt(newSection.startSampleUnit, 10);

    if (!newSection.name || isNaN(length) || length <= 0 || isNaN(width) || width <= 0 || isNaN(startStation) || isNaN(sampleUnitArea) || sampleUnitArea <= 0 || (!newSection.evaluateAllSamples && (isNaN(stdDev) || stdDev <=0 || isNaN(allowableError) || allowableError <=0 || isNaN(startSampleUnit) || startSampleUnit <= 0))) {
      alert(t('projectForm.validation.alert'));
      return;
    }
    
    const calculatedParams = newSectionParams;

    const samplingInterval = calculatedParams.samplingInterval > 0 ? calculatedParams.samplingInterval : 1;
    const sampleIds = newSection.evaluateAllSamples 
        ? Array.from({ length: calculatedParams.totalSampleUnits }, (_, i) => i + 1)
        : Array.from({ length: calculatedParams.minSampleUnits }, (_, i) => ((startSampleUnit - 1 + i * (samplingInterval + 1)) % calculatedParams.totalSampleUnits) + 1);

    const samples: Sample[] = sampleIds.map(id => ({
        id: id,
        area: sampleUnitArea,
        pavementType: PavementType.FLEXIBLE,
        distresses: [],
        isAdditional: false,
    }));
    
    const newSectionToAdd: Section = {
        id: Date.now().toString(),
        name: newSection.name,
        length,
        width,
        startStation,
        pavementType: PavementType.FLEXIBLE,
        sampleUnitArea,
        stdDev,
        allowableError,
        evaluateAllSamples: newSection.evaluateAllSamples,
        startSampleUnit: newSection.evaluateAllSamples ? undefined : startSampleUnit,
        area: length * width,
        sampleUnitLength: width > 0 ? sampleUnitArea / width : 0,
        ...calculatedParams,
        samples,
    };

    setSections([...sections, newSectionToAdd]);
    // Reset form for the next section
    setNewSection({
        name: '',
        length: '1000',
        width: '7',
        startStation: String(startStation + length),
        sampleUnitArea: ASTM_DEFAULTS.FLEXIBLE_SAMPLE_AREA.toString(),
        stdDev: ASTM_DEFAULTS.STD_DEV_AC.toString(),
        allowableError: ASTM_DEFAULTS.ALLOWABLE_ERROR.toString(),
        evaluateAllSamples: false,
        startSampleUnit: '1',
    });
  };

  const handleRemoveSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sections.length === 0) {
        alert(t('projectForm.validation.atLeastOneSection'));
        return;
    }
    onProjectCreateOrUpdate({
        ...projectData,
        sections,
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <h2 className="text-2xl font-bold text-primary mb-4">{t('projectForm.projectDataTitle')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Input
              label={t('projectForm.projectName')}
              name="name"
              value={projectData.name}
              onChange={handleProjectDataChange}
              required
            />
            <Input
              label={t('projectForm.inspectorName')}
              name="inspector"
              value={projectData.inspector}
              onChange={handleProjectDataChange}
              required
            />
            <Input
              label={t('projectForm.inspectionDate')}
              name="inspectionDate"
              type="date"
              value={projectData.inspectionDate}
              onChange={handleProjectDataChange}
              required
            />
          </div>
        </Card>

        <Card className="mb-6">
            <h2 className="text-2xl font-bold text-primary mb-4">{t('projectForm.sectionsTitle')}</h2>
            {sections.length > 0 ? (
                <div className="space-y-4">
                    {sections.map((section, index) => (
                        <div key={section.id} className="bg-bg-base/60 p-4 rounded-lg border border-border-muted">
                            <div className="flex justify-between items-start mb-3">
                                <div className='pr-4'>
                                    <p className="font-bold text-text-base">{index + 1}. {section.name}</p>
                                    <p className="text-sm text-text-muted">
                                        {section.length}m x {section.width}m | {t('projectForm.stationing')}: {formatStation(section.startStation)} - {formatStation(section.startStation + section.length)}
                                    </p>
                                </div>
                                <Button type="button" variant="ghost" onClick={() => handleRemoveSection(section.id)} className="!p-2 !rounded-full text-danger hover:!bg-danger/10 transition-transform hover:scale-110 shrink-0">
                                    <TrashIcon />
                                </Button>
                            </div>
                            <div className="pt-3 border-t border-border-muted/50 grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div>
                                    <p className="text-sm text-text-muted">{t('projectForm.totalUnits')}</p>
                                    <p className="text-xl font-bold text-text-base">{section.totalSampleUnits}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-text-muted">{t('projectForm.minSamples')}</p>
                                    <p className="text-xl font-bold text-text-base">{section.minSampleUnits}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-text-muted">{t('projectForm.interval')}</p>
                                    <p className="text-xl font-bold text-text-base">{!section.evaluateAllSamples && section.samplingInterval > 1 ? `${t('every')} ${section.samplingInterval}` : t('projectForm.notApplicable')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-text-muted">{t('projectForm.sampleLength')}</p>
                                    <p className="text-xl font-bold text-text-base">
                                        {(section.width > 0 ? (section.sampleUnitArea / section.width).toFixed(1) : '0.0')}m
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-text-muted text-center py-4">{t('projectForm.noSections')}</p>
            )}
        </Card>

        <Card className="mb-6">
            <h3 className="text-xl font-bold text-primary mb-4">{t('projectForm.addNewSection')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <Input
                    label={t('projectForm.sectionName')}
                    name="name"
                    value={newSection.name}
                    onChange={handleNewSectionChange}
                    placeholder={t('projectForm.sectionNamePlaceholder')}
                    containerClassName="md:col-span-2 lg:col-span-3"
                />
                 <Input
                    label={t('projectForm.length')}
                    name="length"
                    type="number"
                    value={newSection.length}
                    onChange={handleNewSectionChange}
                />
                 <Input
                    label={t('projectForm.width')}
                    name="width"
                    type="number"
                    value={newSection.width}
                    onChange={handleNewSectionChange}
                />
                 <Input
                    label={t('projectForm.startStation')}
                    name="startStation"
                    type="number"
                    value={newSection.startStation}
                    onChange={handleNewSectionChange}
                    placeholder={t('projectForm.startStationPlaceholder')}
                />
                <div className="md:col-span-2 lg:col-span-3 border-t border-border-muted my-2"></div>
                
                <div className="flex items-center gap-4">
                    <input
                        type="checkbox"
                        id="evaluateAllSamples"
                        name="evaluateAllSamples"
                        checked={newSection.evaluateAllSamples}
                        onChange={handleNewSectionChange}
                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="evaluateAllSamples" className="block text-sm font-medium text-text-muted">
                        {t('projectForm.evaluate100')}
                    </label>
                </div>

                <div>
                    <label htmlFor="sampleUnitArea" className="flex items-center text-sm font-medium text-text-muted mb-1.5">
                        {t('projectForm.sampleArea')}
                        <Tooltip text={t('projectForm.sampleAreaTooltip')}>
                            <QuestionMarkIcon className="ml-1.5 h-4 w-4 text-text-muted/70 hover:text-primary cursor-help" />
                        </Tooltip>
                    </label>
                    <Input
                        id="sampleUnitArea"
                        name="sampleUnitArea"
                        type="number"
                        value={newSection.sampleUnitArea}
                        onChange={handleNewSectionChange}
                    />
                </div>

                {!newSection.evaluateAllSamples && (
                  <>
                    <div className="md:col-span-2 lg:col-span-3 border-t border-border-muted my-2"></div>
                    <Input
                        label={t('projectForm.stdDev')}
                        name="stdDev"
                        type="number"
                        step="0.1"
                        value={newSection.stdDev}
                        onChange={handleNewSectionChange}
                    />
                    <Input
                        label={t('projectForm.allowableError')}
                        name="allowableError"
                        type="number"
                        step="0.1"
                        value={newSection.allowableError}
                        onChange={handleNewSectionChange}
                    />
                    <div>
                        <label htmlFor="startSampleUnit" className="block text-sm font-medium text-text-muted mb-1.5">{t('projectForm.startSample')}</label>
                        <select
                            id="startSampleUnit"
                            name="startSampleUnit"
                            value={newSection.startSampleUnit}
                            onChange={handleNewSectionChange}
                            className="block w-full border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-text-base bg-bg-surface p-3 shadow-sm"
                        >
                            {Array.from({ length: newSectionParams.samplingInterval > 0 ? newSectionParams.samplingInterval : 1 }, (_, i) => i + 1).map(unitNumber => (
                                <option key={unitNumber} value={unitNumber}>
                                    {unitNumber}
                                </option>
                            ))}
                        </select>
                    </div>
                  </>
                )}
               
            </div>
            
            <div className="mt-6 bg-secondary/10 p-4 rounded-lg border border-secondary/20">
                <h4 className="font-semibold text-secondary-dark mb-2">{t('projectForm.samplingParameters')}</h4>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-sm text-text-muted">{t('projectForm.totalUnits')}</p>
                        <p className="text-xl font-bold text-text-base">{newSectionParams.totalSampleUnits || '...'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-text-muted">{t('projectForm.minSamples')}</p>
                        <p className="text-xl font-bold text-text-base">{newSectionParams.minSampleUnits || '...'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-text-muted">{t('projectForm.interval')}</p>
                        <p className="text-xl font-bold text-text-base">{!newSection.evaluateAllSamples && newSectionParams.samplingInterval > 1 ? `${t('every')} ${newSectionParams.samplingInterval}` : t('projectForm.notApplicable')}</p>
                    </div>
                    <div>
                        <p className="text-sm text-text-muted">{t('projectForm.sampleLength')}</p>
                        <p className="text-xl font-bold text-text-base">{ (parseFloat(newSection.width) > 0 ? (parseFloat(newSection.sampleUnitArea) / parseFloat(newSection.width)).toFixed(1) : '0.0')}m</p>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <Button type="button" variant="secondary" onClick={handleAddSection}>
                    {t('projectForm.addSection')}
                </Button>
            </div>
        </Card>

        <div className="flex justify-end mt-8">
            <Button type="submit" variant="primary" className="!text-lg">
                {t('projectForm.saveAndContinue')}
            </Button>
        </div>
    </form>
  );
};
