import React, { useState, useCallback, useEffect } from 'react';
import { Project, Sample, Section, PavementType, Severity, AppView, ProjectView } from './types';
import { ProjectForm } from './components/ProjectForm';
import { ResultsDisplay } from './components/ResultsDisplay';
import { CalculationDetailsView } from './components/CalculationDetailsView';
import { DashboardView } from './components/DashboardView';
import { calculateProjectPCI, calculateSectionParameters } from './services/pciService';
import { AppHeader } from './components/AppHeader';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { useTranslations } from './hooks/useTranslations';
import { ASTM_DEFAULTS } from './constants';
import { useAuth } from './contexts/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { DataEntryView } from './components/DataEntryView';
import { ProfileView } from './components/ProfileView';


const VIEW_ORDER: ProjectView[] = ['SETUP', 'DATA_ENTRY', 'CALCULATION_DETAILS', 'RESULTS'];

// Helper to get projects from localStorage, now user-specific
const loadProjects = (userId: string): Project[] => {
  try {
    const savedProjectsJSON = localStorage.getItem(`pci-projects-${userId}`);
    if (!savedProjectsJSON) {
      return [];
    }
    const savedData = JSON.parse(savedProjectsJSON);
    
    // Ensure the loaded data is an array before returning
    if (Array.isArray(savedData)) {
      // Basic check for project structure
      return savedData.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string');
    }
    
    // If data is present but not an array, it's considered corrupt.
    console.warn(`Corrupted project data for user ${userId}; expected an array. Clearing data.`);
    localStorage.removeItem(`pci-projects-${userId}`);
    return [];

  } catch (error) {
    console.error(`Failed to parse projects for user ${userId}. Data might be corrupt. Clearing data.`, error);
    // If parsing fails, the data is corrupt.
    localStorage.removeItem(`pci-projects-${userId}`);
    return [];
  }
};


// Helper to save projects to localStorage, now user-specific
const saveProjects = (projects: Project[], userId: string) => {
  try {
    localStorage.setItem(`pci-projects-${userId}`, JSON.stringify(projects));
  } catch (error) {
    console.error(`Failed to save projects for user ${userId}`, error);
  }
};


export const App: React.FC = () => {
  const { t } = useTranslations();
  const { user, isLoading: isAuthLoading, deleteAccount, error: authError } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
        setProjects(loadProjects(user.id));
        setCurrentView('DASHBOARD');
        setSelectedProject(null);
    } else {
        setProjects([]);
        setSelectedProject(null);
        setCurrentView('DASHBOARD');
    }
  }, [user]);
  
  // Persists a project to the main projects list and localStorage immediately.
  // Used for critical saves like navigation or setup completion.
  const saveProjectToStorage = (projectToSave: Project) => {
    if (!user) return;
    setProjects(currentProjects => {
      const existingIndex = currentProjects.findIndex(p => p.id === projectToSave.id);
      const newProjects = [...currentProjects];

      if (existingIndex > -1) {
        newProjects[existingIndex] = projectToSave;
      } else {
        newProjects.push(projectToSave);
      }
      
      saveProjects(newProjects, user.id);
      return newProjects;
    });
  };

  const handleSelectProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const targetView = project.lastView || 'SETUP';
      
      let projectToLoad = project;
      
      const needsDetailsCalc = targetView === 'CALCULATION_DETAILS' && !project.sections.some(s => s.samples.some(smp => smp.calculationDetails));
      const needsResultsCalc = targetView === 'RESULTS' && project.weightedPCI === undefined;

      // If the target view requires calculations that are missing, run them now.
      // This handles re-loading a project that was closed on a results page.
      if (needsDetailsCalc || needsResultsCalc) {
        projectToLoad = calculateProjectPCI(project);
        // We save it back so the calculated data persists for next time.
        saveProjectToStorage(projectToLoad);
      }
      
      setSelectedProject(projectToLoad);
      setCurrentView(targetView);
    }
  };

  const handleNewProject = () => {
    setSelectedProject(null);
    setCurrentView('SETUP');
  };

  const handleInitiateDelete = (projectId: string) => {
    setProjectToDeleteId(projectId);
    setIsDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    setProjectToDeleteId(null);
    setIsDeleteModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!projectToDeleteId || !user) return;

    setProjects(prevProjects => {
        const updatedProjects = prevProjects.filter(p => p.id !== projectToDeleteId);
        saveProjects(updatedProjects, user.id);
        return updatedProjects;
    });

    setProjectToDeleteId(null);
    setIsDeleteModalOpen(false);
  };
  
  const handleConfirmDeleteAccount = async () => {
    if (!user) return;
    const success = await deleteAccount(user.id);
    if (success) {
      setIsDeleteAccountModalOpen(false);
      // The logout is handled inside the deleteAccount function, so UI will update automatically
    } else {
      // The error is handled and displayed within the context, but you could show a modal error here if needed.
      setIsDeleteAccountModalOpen(false);
      alert(authError || t('profile.deleteAccountErrorGeneric'));
    }
  };


  const handleGoToDashboard = () => {
    setSelectedProject(null);
    setCurrentView('DASHBOARD');
  };

  const handleLoadDemoProject = () => {
    if (!user) return;
    const DEMO_PROJECT_ID = 'pci-demo-project-1';
    
    // Always create a fresh demo project, overwriting if it exists.
    const otherProjects = projects.filter(p => p.id !== DEMO_PROJECT_ID);

    const sectionArea = 100 * 3.5; // Example dimensions
    const sampleUnitArea = ASTM_DEFAULTS.FLEXIBLE_SAMPLE_AREA;

    const params = calculateSectionParameters(
        sectionArea,
        sampleUnitArea,
        ASTM_DEFAULTS.STD_DEV_AC,
        ASTM_DEFAULTS.ALLOWABLE_ERROR,
        false
    );

    const demoProject: Project = {
        id: DEMO_PROJECT_ID,
        name: t('demoProject.name'),
        inspector: t('demoProject.inspector'),
        inspectionDate: new Date().toISOString().split('T')[0],
        lastView: 'DATA_ENTRY',
        sections: [
            {
                id: 'demo-section-1',
                name: t('demoProject.sectionName'),
                length: 100,
                width: 3.5,
                startStation: 0,
                pavementType: PavementType.FLEXIBLE,
                sampleUnitArea: sampleUnitArea,
                stdDev: ASTM_DEFAULTS.STD_DEV_AC,
                allowableError: ASTM_DEFAULTS.ALLOWABLE_ERROR,
                evaluateAllSamples: false,
                area: sectionArea,
                sampleUnitLength: sampleUnitArea / 3.5,
                ...params,
                samples: [
                    {
                        id: 1,
                        area: sampleUnitArea,
                        pavementType: PavementType.FLEXIBLE,
                        isAdditional: false,
                        distresses: [
                            { id: 'd1', type: '1', severity: Severity.HIGH, quantity: 40.822 },
                            { id: 'd2', type: '11', severity: Severity.LOW, quantity: 16.2 },
                            { id: 'd3', type: '11', severity: Severity.HIGH, quantity: 122.073 },
                            { id: 'd4', type: '3', severity: Severity.HIGH, quantity: 48.3775 },
                            { id: 'd5', type: '10', severity: Severity.MEDIUM, quantity: 35 },
                            { id: 'd6', type: '13', severity: Severity.MEDIUM, quantity: 1 },
                            { id: 'd7', type: '4', severity: Severity.MEDIUM, quantity: 2.34 },
                        ],
                    },
                ],
            },
        ],
    };

    const newProjects = [...otherProjects, demoProject];
    setProjects(newProjects);
    saveProjects(newProjects, user.id);
    setSelectedProject(demoProject);
    setCurrentView('DATA_ENTRY');
};

  // This is the main state update function for an active project.
  // It ensures data integrity by clearing any old calculation results whenever underlying data is changed.
  const updateProjectState = (updater: (draft: Project) => void) => {
    setSelectedProject(currentSelectedProject => {
      if (!currentSelectedProject) return null;
      
      const newProject = JSON.parse(JSON.stringify(currentSelectedProject));
      // Apply the specific data modifications from the updater function.
      updater(newProject);

      // After any data modification, we must clear old calculation results as they are no longer valid.
      newProject.weightedPCI = undefined;
      newProject.sections.forEach((section: Section) => {
        section.pci = undefined;
        section.samples.forEach((sample: Sample) => {
          sample.calculationDetails = undefined;
        });
      });

      // Persist the updated, cleaned project state.
      saveProjectToStorage(newProject);
      
      // Return the new state for an immediate UI update.
      return newProject;
    });
  };

  const handleProjectSetupSave = (projectData: Omit<Project, 'id' | 'lastView' | 'weightedPCI'>) => {
    let newOrUpdatedProject: Project = selectedProject 
      ? { ...selectedProject, ...projectData }
      : { id: Date.now().toString(), ...projectData, sections: projectData.sections };

    // Explicitly clear any old results, as this function doesn't use updateProjectState.
    newOrUpdatedProject.weightedPCI = undefined;
    newOrUpdatedProject.sections.forEach(s => {
        s.pci = undefined;
        s.samples.forEach(smp => {
            smp.calculationDetails = undefined;
        });
    });

    handleNavigate('DATA_ENTRY', newOrUpdatedProject);
  };
  
  const handleNavigate = (view: AppView, projectOverride?: Project) => {
      if (view === 'PROFILE' || view === 'DASHBOARD') {
          setSelectedProject(null);
          setCurrentView(view);
          return;
      }
      
      let projectToUpdate = projectOverride || selectedProject;
      if (!projectToUpdate) return;
      
      // If moving to calculation step, perform calculation first
      if (view === 'CALCULATION_DETAILS' || view === 'RESULTS') {
          projectToUpdate = calculateProjectPCI(projectToUpdate);
      }
      
      const lastViewIndex = VIEW_ORDER.indexOf(projectToUpdate.lastView || 'SETUP');
      const targetViewIndex = VIEW_ORDER.indexOf(view);

      const updatedProject = {
          ...projectToUpdate,
          lastView: (targetViewIndex > lastViewIndex ? view : projectToUpdate.lastView) || 'SETUP'
      };

      setSelectedProject(updatedProject);
      saveProjectToStorage(updatedProject);
      setCurrentView(view);
  };
  
  const handleSampleUpdate = (sectionId: string, updatedSample: Sample) => {
    updateProjectState(draft => {
      const section = draft.sections.find(s => s.id === sectionId);
      if (section) {
        section.samples = section.samples.map(s =>
          s.id === updatedSample.id ? updatedSample : s
        );
      }
    });
  };

  const handleSampleAdd = (sectionId: string, sampleIdToAdd: number) => {
    updateProjectState(draft => {
      const section = draft.sections.find(s => s.id === sectionId);
      if (!section) return;

      // Prevent adding if it already exists
      if (section.samples.some(s => s.id === sampleIdToAdd)) return;

      const newSample: Sample = {
        id: sampleIdToAdd,
        area: section.sampleUnitArea,
        pavementType: section.pavementType,
        distresses: [],
        isAdditional: true,
      };
      section.samples.push(newSample);
      // Sort samples by ID to keep the list ordered
      section.samples.sort((a, b) => a.id - b.id);
    });
  };

  const handleSampleDelete = (sectionId: string, sampleId: number) => {
    updateProjectState(draft => {
      const section = draft.sections.find(s => s.id === sectionId);
      if (section) {
        section.samples = section.samples.filter(s => s.id !== sampleId);
      }
    });
  };
  
  const renderContent = () => {
    if (currentView === 'DASHBOARD') {
      return <DashboardView projects={projects} onNewProject={handleNewProject} onSelectProject={handleSelectProject} onInitiateDelete={handleInitiateDelete} onLoadExample={handleLoadDemoProject} />;
    }
    
    if (currentView === 'PROFILE') {
      return <ProfileView onInitiateDelete={() => setIsDeleteAccountModalOpen(true)} />;
    }

    // SETUP can work with or without a selected project
    if (currentView === 'SETUP') {
        return <ProjectForm initialProject={selectedProject} onProjectCreateOrUpdate={handleProjectSetupSave} />;
    }

    // All other views require a selected project.
    if (!selectedProject) {
        // Fallback to dashboard if project is missing for a project-specific view.
        return <DashboardView projects={projects} onNewProject={handleNewProject} onSelectProject={handleSelectProject} onInitiateDelete={handleInitiateDelete} onLoadExample={handleLoadDemoProject} />;
    }
    
    // The calculation logic is now handled by navigation/selection functions,
    // removing the risk of infinite loops during render.
    switch (currentView) {
      case 'DATA_ENTRY':
        return <DataEntryView project={selectedProject} onSampleUpdate={handleSampleUpdate} onSampleAdd={handleSampleAdd} onSampleDelete={handleSampleDelete} />;
      case 'CALCULATION_DETAILS':
        return <CalculationDetailsView project={selectedProject} />;
      case 'RESULTS':
        return <ResultsDisplay project={selectedProject} />;
      default:
        return <div>{t('app.unknownView')}</div>;
    }
  };

  if (isAuthLoading) {
    return (
        <div className="bg-bg-base text-text-muted min-h-screen font-sans flex items-center justify-center">
            <h1 className="text-2xl font-bold text-primary animate-pulse">{t('auth.loading')}</h1>
        </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="bg-bg-base text-text-muted h-screen font-sans overflow-hidden flex flex-col">
      <AppHeader
        project={selectedProject}
        currentView={currentView}
        onNavigate={handleNavigate}
        onGoHome={handleGoToDashboard}
      />
      <main className="container mx-auto px-4 sm:px-6 md:px-8 pb-8 pt-6 max-w-7xl flex-grow overflow-y-auto no-scrollbar">
        {renderContent()}
      </main>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={t('modal.deleteTitle')}
      >
        <p>{t('modal.deleteConfirmText', { name: projects.find(p => p.id === projectToDeleteId)?.name || '' })}</p>
      </ConfirmationModal>
      <ConfirmationModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        title={t('profile.deleteAccountConfirmTitle')}
      >
        <p>{t('profile.deleteAccountConfirmText')}</p>
      </ConfirmationModal>
    </div>
  );
};