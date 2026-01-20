import React from 'react';
import { Project } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useTranslations } from '../hooks/useTranslations';
import { getPCIRating } from '../constants';

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const TrashIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const formatStation = (station: number): string => {
    const km = Math.floor(station / 1000);
    const m = station % 1000;
    return `${km}+${m.toFixed(2).padStart(6, '0')}`;
};

const getStatus = (project: Project, t: (key: string) => string): { text: string; className: string, borderColor: string } => {
    if (project.weightedPCI !== undefined) {
        const pciRating = getPCIRating(project.weightedPCI);
        return { text: t(pciRating.labelKey), className: pciRating.className, borderColor: 'border-primary' };
    }
    if (project.lastView && project.lastView !== 'SETUP') {
       return { text: t('dashboard.statusDataEntry'), className: 'bg-secondary/30 text-secondary-dark', borderColor: 'border-secondary' };
    }
    return { text: t('dashboard.statusDraft'), className: 'bg-border-muted text-text-muted', borderColor: 'border-border-base' };
};

interface ProjectCardProps {
    project: Project;
    index: number;
    onSelectProject: (id: string) => void;
    onInitiateDelete: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, index, onSelectProject, onInitiateDelete }) => {
    const { t } = useTranslations();
    const status = getStatus(project, t);
    
    const handleSelect = () => onSelectProject(project.id);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
        }
    };
    
    const { totalLength, averageWidth, startStation, endStation } = React.useMemo(() => {
        if (!project.sections || project.sections.length === 0) {
            return { totalLength: 0, averageWidth: 0, startStation: 0, endStation: 0 };
        }

        const totalLength = project.sections.reduce((sum, s) => sum + s.length, 0);
        const totalWidthSum = project.sections.reduce((sum, s) => sum + s.width, 0);
        const averageWidth = project.sections.length > 0 ? totalWidthSum / project.sections.length : 0;
        const startStation = Math.min(...project.sections.map(s => s.startStation));
        const endStation = Math.max(...project.sections.map(s => s.startStation + s.length));
        
        return { totalLength, averageWidth, startStation, endStation };
    }, [project.sections]);

    return (
        <div 
            onClick={handleSelect}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={`${t('dashboard.continue')} ${project.name}`}
            className={`group relative flex flex-col h-full bg-bg-surface text-text-base shadow-lg rounded-xl border-l-4 ${status.borderColor} hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 ease-out transform-gpu cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
        >
            <div className="flex-grow flex flex-col p-5 text-left">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-text-base pr-2 break-words">{`${index}. ${project.name}`}</h3>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shrink-0 ${status.className}`}>
                        {status.text}
                    </span>
                </div>

                {project.sections.length > 0 && (
                  <div className="text-sm text-text-muted mb-2 font-medium">
                    <span>{totalLength.toFixed(0)}m x {averageWidth.toFixed(1)}m</span>
                    <span className="mx-2 text-text-muted/50">|</span>
                    <span>{t('projectForm.stationing')}: {formatStation(startStation)} - {formatStation(endStation)}</span>
                  </div>
                )}
                
                <p className="text-sm text-text-muted mb-4 flex-shrink-0">{t('dashboard.inspector')}: {project.inspector}</p>
                
                <div className="flex-grow flex items-center justify-center bg-bg-base/50 group-hover:bg-primary/5 transition-colors p-4 rounded-lg my-auto">
                    {project.weightedPCI !== undefined ? (
                        <div className='text-center'>
                            <p className="text-sm text-primary">{t('dashboard.tablePCI')}</p>
                            <p className="text-5xl font-bold text-primary my-1">{project.weightedPCI.toFixed(2)}</p>
                        </div>
                    ) : (
                        <div className="text-center">
                             <p className="text-4xl font-bold text-text-muted/10 group-hover:text-text-muted/20 transition-colors">-</p>
                             <p className="text-sm text-primary font-semibold mt-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out">{t('dashboard.continue')} &rarr;</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-bg-base/60 group-hover:bg-bg-base p-3 border-t border-border-muted flex justify-between items-center">
                 <p className="text-xs text-text-muted px-2 font-mono">{project.inspectionDate}</p>
                <Button 
                  onClick={(e) => { e.stopPropagation(); onInitiateDelete(project.id); }} 
                  variant="ghost" 
                  className="!p-1.5 !rounded-full !text-text-muted hover:!bg-danger/10 hover:!text-danger"
                  aria-label={`${t('modal.deleteTitle')} ${project.name}`}
                >
                    <TrashIcon className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
};


interface DashboardViewProps {
  projects: Project[];
  onNewProject: () => void;
  onSelectProject: (projectId: string) => void;
  onInitiateDelete: (projectId: string) => void;
  onLoadExample: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ projects, onNewProject, onSelectProject, onInitiateDelete, onLoadExample }) => {
  const { t } = useTranslations();
  
  return (
    <div>
      <div className="bg-bg-surface rounded-xl p-6 shadow-md mb-8 border border-border-muted">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h2 className="text-3xl font-bold text-primary">{t('dashboard.subtitle')}</h2>
                  <p className="text-text-muted mt-1 max-w-lg">{t('dashboard.headerDescription')}</p>
              </div>
              <div className="flex items-center flex-shrink-0 gap-3 mt-4 md:mt-0">
                  <Button onClick={onLoadExample} variant="secondary">
                      {t('dashboard.loadExample')}
                  </Button>
                  <Button onClick={onNewProject} variant="primary" className="inline-flex items-center">
                      <PlusIcon className="mr-2" /> {t('dashboard.newProject')}
                  </Button>
              </div>
          </div>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.sort((a,b) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime()).map((project, index) => (
                <ProjectCard
                    key={project.id}
                    project={project}
                    index={index + 1}
                    onSelectProject={onSelectProject}
                    onInitiateDelete={onInitiateDelete}
                />
            ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-bg-surface rounded-lg border-2 border-dashed border-border-muted">
            <h3 className="text-xl font-bold text-text-base">{t('dashboard.noProjects')}</h3>
            <p className="text-text-muted mt-2">{t('dashboard.noProjectsHint')}</p>
            <Button onClick={onNewProject} variant="primary" className="mt-6 inline-flex items-center">
              <PlusIcon className="mr-2" /> {t('dashboard.newProject')}
            </Button>
        </div>
      )}
    </div>
  );
};