import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { Project, MongoProject, Sample, Section, PavementType, Severity, AppView, ProjectView } from './types';
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
import { CurvesSettingsView } from './components/CurvesSettingsView';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

// Interceptor: adjunta el token automáticamente a cada petición
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const VIEW_ORDER: ProjectView[] = ['SETUP', 'DATA_ENTRY', 'CALCULATION_DETAILS', 'RESULTS'];

const mapMongoProjectToProject = (mongoProject: MongoProject): Project => ({
  id: String(mongoProject._id),
  _id: String(mongoProject._id),
  name: mongoProject.nombre,
  nombre: mongoProject.nombre,
  descripcion: mongoProject.descripcion || '',
  inspector: mongoProject.inspector || '',
  inspectionDate: mongoProject.inspectionDate || '',
  propietario: mongoProject.propietario,
  sections: mongoProject.sections || [],
  lastView: mongoProject.lastView || 'SETUP',
  weightedPCI: mongoProject.weightedPCI,
});

const mapProjectToMongoPayload = (project: Project, userId: string) => ({
  nombre: project.nombre || project.name,
  descripcion: project.descripcion || '',
  inspector: project.inspector || '',
  inspectionDate: project.inspectionDate || '',
  lastView: project.lastView || 'SETUP',
  weightedPCI: project.weightedPCI,
  propietario: project.propietario || userId,
  sections: project.sections || [],
});

export const App: React.FC = () => {
  const { t } = useTranslations();
  const { user, isLoading: isAuthLoading, deleteAccount, error: authError } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  const savingProjectIdRef = useRef<string | null>(null); // Evitar guardos duplicados sin causar re-renders

  // Cargar proyectos al iniciar o cuando cambia el usuario
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setSelectedProject(null);
      setCurrentView('DASHBOARD');
      return;
    }
    
    const cargarProyectos = async () => {
  try {
    const { data } = await API.get('/projects');
    console.log('[cargarProyectos] data cruda del backend:', data);

    const mappedProjects = data.map((p: any) => {
      const mapped = mapMongoProjectToProject(p);
      console.log('[cargarProyectos] proyecto mapeado:', mapped);
      return mapped;
    });

    setProjects(mappedProjects);
    setCurrentView('DASHBOARD');
    setSelectedProject(null);
  } catch (err) {
    console.error('Error cargando proyectos:', err);
    setProjects([]);
  }
};
    cargarProyectos();
  }, [user]);
  
  // Guardar / actualizar proyecto
    const saveProjectToStorage = async (projectToSave: Project) => {
    if (!user) return;

    const isNew = !projectToSave._id;
    const projectKey = projectToSave._id ? String(projectToSave._id) : String(projectToSave.id);

    // Evitar guardos duplicados si ya está guardándose
    if (savingProjectIdRef.current === projectKey) {
      console.log(`[saveProjectToStorage] ⚠️ Ya se está guardando este proyecto (${projectKey}), se ignora la solicitud duplicada`);
      return;
    }

    savingProjectIdRef.current = projectKey;
    console.log(`[saveProjectToStorage] ${isNew ? 'POST' : 'PUT'} - key: ${projectKey}, name: ${projectToSave.name}`);
    console.trace('[CALL STACK]');

    // Actualización optimista
    setProjects(currentProjects => {
      const existingIndex = currentProjects.findIndex(p => String(p._id || p.id) === projectKey);
      if (existingIndex > -1) {
        const updatedProjects = [...currentProjects];
        updatedProjects[existingIndex] = projectToSave;
        console.log(`[saveProjectToStorage] Proyecto reemplazado en índice ${existingIndex}`);
        return updatedProjects;
      } else if (isNew) {
        console.log(`[saveProjectToStorage] Proyecto nuevo agregado a la lista`);
        return [...currentProjects, projectToSave];
      }
      return currentProjects;
    });

    try {
      if (isNew) {
        // Proyecto nuevo: POST
        const { _id, ...projectData } = projectToSave;
        console.log(`[saveProjectToStorage] Enviando POST...`);
        const { data } = await API.post('/projects', projectData);
        const newMongoId = String(data._id);
        console.log(`[saveProjectToStorage] POST exitoso, nuevo _id: ${newMongoId}`);
        
        // Reemplazar proyecto temporal por el real del backend
        const mappedProject = mapMongoProjectToProject(data);

        setProjects(prev =>
          prev.map(p => String(p._id || p.id) === projectKey ? mappedProject : p)
        );

        setSelectedProject(currentSelectedProject =>
          currentSelectedProject && String(currentSelectedProject._id || currentSelectedProject.id) === projectKey
            ? mappedProject
            : currentSelectedProject
        );
      } else {
        console.log(`[saveProjectToStorage] Enviando PUT...`);
        const payload = mapProjectToMongoPayload(projectToSave, user.id);
        const { data } = await API.put(`/projects/${projectToSave._id}`, payload);
        console.log(`[saveProjectToStorage] PUT exitoso`);

        const mappedProject = mapMongoProjectToProject(data);

        const mergedProject = {
          ...mappedProject,
          ...projectToSave,
          _id: mappedProject._id || projectToSave._id,
          id: mappedProject.id || projectToSave.id,
          weightedPCI: projectToSave.weightedPCI,
          lastView: projectToSave.lastView,
          sections: projectToSave.sections,
        };

        setProjects(prev =>
          prev.map(p => String(p._id || p.id) === projectKey ? mergedProject : p)
        );

        setSelectedProject(currentSelectedProject =>
          currentSelectedProject && String(currentSelectedProject._id || currentSelectedProject.id) === projectKey
            ? mergedProject
            : currentSelectedProject
        );
      }
    } catch (err) { 
      console.error('[saveProjectToStorage] Error:', err);
      // Revertir optimista si falla
      setProjects(prev => prev.filter(p => String(p._id || p.id) !== projectKey));
    } finally {
      savingProjectIdRef.current = null;
    }
  };

  const handleSelectProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const targetView = project.lastView || 'SETUP';
      
      let projectToLoad = project;
      
      const needsDetailsCalc = targetView === 'CALCULATION_DETAILS' && !project.sections.some(s => s.samples.some(smp => smp.calculationDetails));
      const needsResultsCalc = targetView === 'RESULTS' && project.weightedPCI === undefined;

      // Si la vista de destino requiere cálculos que faltan, ejecútalos ahora.
      // Esto maneja la recarga de un proyecto que fue cerrado en una página de resultados.
      if (needsDetailsCalc || needsResultsCalc) {
        projectToLoad = calculateProjectPCI(project);
        // Lo guardamos de vuelta para que los datos calculados persistan para la próxima vez.
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

  const handleConfirmDelete = async () => {
    if (!projectToDeleteId || !user) return;

    // Actualización optimista
    const projectToDelete = projects.find(p => p.id === projectToDeleteId);
    setProjects(prevProjects => prevProjects.filter(p => p.id !== projectToDeleteId));
    setIsDeleteModalOpen(false);
    setProjectToDeleteId(null);

    try {
        // Usar _id si está disponible, de lo contrario usar id como respaldo (aunque delete usualmente requiere _id)
        const idToDelete = projectToDelete?._id || projectToDeleteId;
        await API.delete(`/projects/${idToDelete}`);
    } catch (err) { 
        console.error('Error eliminando proyecto:', err);
        // Revertir si falló
        if (projectToDelete) {
             setProjects(prev => [...prev, projectToDelete]);
             alert(t('dashboard.deleteError'));
        }
    }
  };
  
  const handleConfirmDeleteAccount = async () => {
    if (!user) return;
    const success = await deleteAccount(user.id);
    if (success) {
      setIsDeleteAccountModalOpen(false);
      // El logout se maneja dentro de la función deleteAccount, por lo que la UI se actualiza automáticamente
    } else {
      // El error se maneja y se muestra dentro del contexto, pero podrías mostrar un modal de error aquí si es necesario.
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
    // El proyecto demo es solo local por ahora, o podría publicarse en la API
    const DEMO_PROJECT_ID = 'pci-demo-project-1';
    
    const sectionArea = 100 * 3.5; // Dimensiones de ejemplo
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
        _id: '', // _id vacío para demo hasta que se guarde
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
        // Agregar campos requeridos para la nueva interfaz Project
        nombre: t('demoProject.name'),
        propietario: user.id,
    };

    // No guardamos automáticamente el proyecto demo en la DB para evitar desorden,
    // pero lo agregamos al estado local. El usuario puede guardarlo modificándolo.
    setProjects(prev => [...prev.filter(p => p.id !== DEMO_PROJECT_ID), demoProject]);
    setSelectedProject(demoProject);
    setCurrentView('DATA_ENTRY');
};

  // Esta es la función principal de actualización de estado para un proyecto activo.
  // Asegura la integridad de los datos borrando cualquier resultado de cálculo antiguo cada vez que se modifican los datos subyacentes.
  const updateProjectState = (updater: (draft: Project) => void) => {
    setSelectedProject(currentSelectedProject => {
      if (!currentSelectedProject) return null;
      
      const newProject = JSON.parse(JSON.stringify(currentSelectedProject));
      // Aplicar las modificaciones de datos específicas de la función actualizadora.
      updater(newProject);

      // Después de cualquier modificación de datos, debemos borrar los resultados de cálculo antiguos ya que ya no son válidos.
      newProject.weightedPCI = undefined;
      newProject.sections.forEach((section: Section) => {
        section.pci = undefined;
        section.samples.forEach((sample: Sample) => {
          sample.calculationDetails = undefined;
        });
      });

      // Persistir el estado del proyecto actualizado y limpiado.
      saveProjectToStorage(newProject);
      
      // Devolver el nuevo estado para una actualización inmediata de la interfaz de usuario.
      return newProject;
    });
  };

  const handleProjectSetupSave = (projectData: Omit<Project, 'id' | 'lastView' | 'weightedPCI' | '_id' | 'nombre' | 'propietario'>) => {
    if (!user) return;

    let newOrUpdatedProject: Project;
    
    if (selectedProject) {
        newOrUpdatedProject = { ...selectedProject, ...projectData };
    } else {
        const tempId = Date.now().toString();
        newOrUpdatedProject = { 
            id: tempId,
            _id: '', // Será poblado por el backend
            ...projectData, 
            sections: projectData.sections,
            // Mapear campos legacy al nuevo esquema
            nombre: projectData.name || 'Nuevo Proyecto',
            propietario: user.id
        };
    }

    // Borrar explícitamente cualquier resultado antiguo, ya que esta función no utiliza updateProjectState.
    newOrUpdatedProject.weightedPCI = undefined;
    newOrUpdatedProject.sections.forEach(s => {
        s.pci = undefined;
        s.samples.forEach(smp => {
            smp.calculationDetails = undefined;
        });
    });

    // Guardamos el proyecto antes de navegar para evitar que la navegación dispare otro save.
    setSelectedProject(newOrUpdatedProject);
    saveProjectToStorage(newOrUpdatedProject);
    handleNavigate('DATA_ENTRY', newOrUpdatedProject, true);
  };
  
  const handleNavigate = (view: AppView, projectOverride?: Project, skipSave = false) => {
      if (view === 'PROFILE' || view === 'DASHBOARD'|| view === 'ADMIN_SETTINGS') {
          setSelectedProject(null);
          setCurrentView(view);

          return;
      }
      
      let projectToUpdate = projectOverride || selectedProject;
      if (!projectToUpdate) return;
      
      // Si se mueve al paso de cálculo, realizar el cálculo primero
      if (view === 'CALCULATION_DETAILS' || view === 'RESULTS') {
          projectToUpdate = calculateProjectPCI(projectToUpdate);
          console.log('VIEW:', view);
          console.log('weightedPCI:', projectToUpdate.weightedPCI);
          console.log(
            'sections:',
            projectToUpdate.sections.map(s => ({
              name: s.name,
              pci: s.pci
            }))
          );
      }
      
      const lastViewIndex = VIEW_ORDER.indexOf(projectToUpdate.lastView || 'SETUP');
      const targetViewIndex = VIEW_ORDER.indexOf(view);

      const updatedProject = {
          ...projectToUpdate,
          lastView: (targetViewIndex > lastViewIndex ? view : projectToUpdate.lastView) || 'SETUP'
      };

      setSelectedProject(updatedProject);
      if (!skipSave) {
          saveProjectToStorage(updatedProject);
      }
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

      // Evitar agregar si ya existe
      if (section.samples.some(s => s.id === sampleIdToAdd)) return;

      const newSample: Sample = {
        id: sampleIdToAdd,
        area: section.sampleUnitArea,
        pavementType: section.pavementType,
        distresses: [],
        isAdditional: true,
      };
      section.samples.push(newSample);
      // Ordenar muestras por ID para mantener la lista ordenada
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
  return (
    <ProfileView
      onInitiateDelete={() => setIsDeleteAccountModalOpen(true)}
      onNavigate={handleNavigate}
    />
  );
}

    if (currentView === 'ADMIN_SETTINGS') {
        return <CurvesSettingsView />;
    }
    // SETUP puede funcionar con o sin un proyecto seleccionado
    if (currentView === 'SETUP') {
        return <ProjectForm initialProject={selectedProject} onProjectCreateOrUpdate={handleProjectSetupSave} />;
    }

    // Todas las demás vistas requieren un proyecto seleccionado.
    if (!selectedProject) {
        // Volver al panel si falta el proyecto para una vista específica del proyecto.
        return <DashboardView projects={projects} onNewProject={handleNewProject} onSelectProject={handleSelectProject} onInitiateDelete={handleInitiateDelete} onLoadExample={handleLoadDemoProject} />;
    }
    
    // La lógica de cálculo ahora se maneja mediante funciones de navegación/selección,
    // eliminando el riesgo de bucles infinitos durante la renderización.
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
