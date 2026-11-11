import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { Project, MongoProject, Sample, Section, PavementType, Severity, AppView, ProjectView, AgentConfig, AgentRun, SectionContext } from './types';
import { ProjectForm } from './components/ProjectForm';
import { ResultsDisplay } from './components/ResultsDisplay';
import { CalculationDetailsView } from './components/CalculationDetailsView';
import { DashboardView } from './components/DashboardView';
import { calculateProjectPCI, calculateSectionParameters, getAdditionalRandomSampleIds } from './services/pciService';
import { AppHeader } from './components/AppHeader';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { useTranslations } from './hooks/useTranslations';
import { ASTM_DEFAULTS } from './constants';
import { useAuth } from './contexts/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { DataEntryView } from './components/DataEntryView';
import { ProfileView } from './components/ProfileView';
import { CurvesSettingsView } from './components/CurvesSettingsView';
import { AgentPanel } from './components/agent/AgentPanel';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://pci-backend-mqoc.onrender.com/api',
});

// Interceptor: adjunta el token automáticamente a cada petición
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const VIEW_ORDER: ProjectView[] = ['SETUP', 'DATA_ENTRY', 'CALCULATION_DETAILS', 'RESULTS', 'AGENT'];

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
  agentConfig: mongoProject.agentConfig,
  agentRuns: mongoProject.agentRuns || [],
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
  agentConfig: project.agentConfig,
  agentRuns: project.agentRuns || [],
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
  const [dataEntryConfig, setDataEntryConfig] = useState<{ sectionId: string; focusSampleId?: number; newlyAddedIds?: number[] } | null>(null);
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
          agentConfig: projectToSave.agentConfig,
          agentRuns: projectToSave.agentRuns,
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
      
      // Generar recomendaciones automáticamente después de guardar el proyecto
      if (projectToSave.sections && projectToSave.sections.length > 0) {
        try {
          console.log('[saveProjectToStorage] Generando recomendaciones automáticas...');
          // Llamada al backend para obtener recomendaciones
          const { data } = await API.post(`/projects/${projectToSave._id || projectToSave.id}/recommendations`, projectToSave);
          if (data.success) {
            console.log('[saveProjectToStorage] Recomendaciones generadas:', data.recommendations.length, 'secciones');
            // Aquí podríamos almacenar las recomendaciones o navegar a la vista
            // Por ahora, solo registramos en consola
          }
        } catch (recError) {
          // No fallar el guardado si el agente falla
          console.error('[saveProjectToStorage] Error generando recomendaciones:', recError);
        }
      }
    }
  };

  const handleSelectProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const targetView = project.lastView || 'SETUP';
      
      let projectToLoad = project;
      
      const needsDetailsCalc = targetView === 'CALCULATION_DETAILS' && !project.sections.some(s => s.samples.some(smp => smp.calculationDetails));
      const needsResultsCalc = (targetView === 'RESULTS' || targetView === 'AGENT') && project.weightedPCI === undefined;

      // Si la vista de destino requiere cálculos que faltan, execútalos ahora.
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
    setDataEntryConfig(null);
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
    setDataEntryConfig(null);
    setCurrentView('DASHBOARD');
  };

  const handleLoadDemoProject = () => {
    if (!user) return;
    const DEMO_PROJECT_ID = 'pci-demo-project-1';

    const sampleUnitArea = 225;
    const sampleUnitLength = 35;
    const width = sampleUnitArea / sampleUnitLength;
    const totalSampleUnits = 84;
    const sectionArea = totalSampleUnits * sampleUnitArea;
    const length = totalSampleUnits * sampleUnitLength;

    const params = calculateSectionParameters(
        sectionArea,
        sampleUnitArea,
        ASTM_DEFAULTS.STD_DEV_AC,
        ASTM_DEFAULTS.ALLOWABLE_ERROR,
        false
    );

    const makeSample = (id: number, entries: [string, Severity, number][]): Sample => ({
        id,
        area: sampleUnitArea,
        pavementType: PavementType.FLEXIBLE,
        isAdditional: false,
        distresses: entries.map(([type, severity, quantity], i) => ({
            id: `demo-${id}-${i}`,
            type,
            severity,
            quantity,
        })),
    });

    const { HIGH, MEDIUM, LOW } = Severity;

    const samples: Sample[] = [
        makeSample(3, [['11', MEDIUM, 19.925], ['10', MEDIUM, 29.1], ['1', HIGH, 4.11], ['11', HIGH, 18.373], ['1', MEDIUM, 5.06]]),
        makeSample(9, [['3', MEDIUM, 14.57], ['10', MEDIUM, 23.88], ['11', MEDIUM, 45.57], ['1', HIGH, 10.592], ['3', HIGH, 133.565]]),
        makeSample(15, [['1', HIGH, 45.93], ['10', MEDIUM, 16.2], ['3', HIGH, 87.295], ['11', MEDIUM, 38.775], ['11', HIGH, 1.6675]]),
        makeSample(21, [['11', LOW, 110.122], ['1', HIGH, 11.7525], ['13', HIGH, 1], ['3', HIGH, 97.1655], ['10', MEDIUM, 6.35]]),
        makeSample(27, [['3', HIGH, 148.635], ['10', MEDIUM, 35], ['11', MEDIUM, 37.28]]),
        makeSample(33, [['11', MEDIUM, 63.67], ['3', HIGH, 25.38], ['11', LOW, 78.89], ['2', MEDIUM, 5.04], ['1', HIGH, 25.34], ['13', HIGH, 14.94], ['13', LOW, 1]]),
        makeSample(39, [['1', HIGH, 40.822], ['11', LOW, 16.2], ['11', HIGH, 122.073], ['3', HIGH, 48.3775], ['10', MEDIUM, 35], ['13', MEDIUM, 1], ['4', MEDIUM, 2.34]]),
        makeSample(45, [['11', MEDIUM, 126.1222], ['11', LOW, 6.8414], ['11', HIGH, 58.8396], ['1', HIGH, 36.024]]),
        makeSample(51, [['11', LOW, 112.45], ['11', HIGH, 23.775], ['11', MEDIUM, 52.925], ['3', HIGH, 39.343]]),
        makeSample(57, [['10', MEDIUM, 12.3], ['1', HIGH, 9.84], ['3', HIGH, 84.412], ['11', LOW, 14.24], ['13', HIGH, 1], ['11', MEDIUM, 90.627], ['13', MEDIUM, 1], ['11', HIGH, 18.737]]),
        makeSample(63, [['10', MEDIUM, 7.11], ['11', MEDIUM, 68.6875], ['3', HIGH, 18.2], ['13', HIGH, 1], ['3', HIGH, 115.6672], ['1', HIGH, 13.8959], ['11', HIGH, 20.6325]]),
        makeSample(69, [['11', HIGH, 24.425], ['11', LOW, 80.905], ['11', MEDIUM, 51.685], ['3', HIGH, 66.03], ['13', LOW, 1]]),
        makeSample(75, [['3', HIGH, 47.8808], ['10', MEDIUM, 12.1], ['11', MEDIUM, 132.3795], ['13', HIGH, 0.52], ['13', HIGH, 1], ['11', HIGH, 3.8475], ['13', HIGH, 0.4], ['1', HIGH, 21.12]]),
        makeSample(81, [['3', HIGH, 183.522], ['13', HIGH, 0.55], ['10', MEDIUM, 93.61], ['11', HIGH, 49.093], ['13', HIGH, 1], ['1', HIGH, 3.239], ['11', LOW, 15.484]]),
    ];

    const demoProject: Project = {
        id: DEMO_PROJECT_ID,
        name: t('demoProject.name'),
        nombre: t('demoProject.name'),
        inspector: t('demoProject.inspector'),
        inspectionDate: '2025-06-06',
        lastView: 'DATA_ENTRY',
        propietario: user.id,
        sections: [
            {
                id: 'demo-section-1',
                name: t('demoProject.sectionName'),
                length,
                width,
                startStation: 0,
                pavementType: PavementType.FLEXIBLE,
                sampleUnitArea: sampleUnitArea,
                stdDev: ASTM_DEFAULTS.STD_DEV_AC,
                allowableError: ASTM_DEFAULTS.ALLOWABLE_ERROR,
                evaluateAllSamples: false,
                area: sectionArea,
                sampleUnitLength,
                ...params,
                samples,
            },
        ],
    };

    saveProjectToStorage(demoProject);
    setSelectedProject(demoProject);
    setCurrentView('DATA_ENTRY');
  };

  const handleLoadInsufficientExample = () => {
    if (!user) return;
    const DEMO_PROJECT_ID = 'pci-demo-insufficient-1';

    const sampleUnitArea = 225;
    const sampleUnitLength = 35;
    const width = sampleUnitArea / sampleUnitLength;
    const totalSampleUnits = 84;
    const sectionArea = totalSampleUnits * sampleUnitArea;
    const length = totalSampleUnits * sampleUnitLength;

    const params = calculateSectionParameters(
        sectionArea,
        sampleUnitArea,
        ASTM_DEFAULTS.STD_DEV_AC,
        ASTM_DEFAULTS.ALLOWABLE_ERROR,
        false
    );

    const makeSample = (id: number, entries: [string, Severity, number][]): Sample => ({
        id,
        area: sampleUnitArea,
        pavementType: PavementType.FLEXIBLE,
        isAdditional: false,
        distresses: entries.map(([type, severity, quantity], i) => ({
            id: `demo-variability-${id}-${i}`,
            type,
            severity,
            quantity,
        })),
    });

    const { HIGH, MEDIUM, LOW } = Severity;

    const samples: Sample[] = [
        makeSample(3, [['19.2', LOW, 0.9]]),
        makeSample(9, [['19.2', LOW, 1.575]]),
        makeSample(15, [['19.2', LOW, 2.7]]),
        makeSample(21, [['19.2', LOW, 4.5]]),
        makeSample(27, [['19.2', LOW, 7.875]]),
        makeSample(33, [['19.2', LOW, 13.5]]),
        makeSample(39, [['19.2', LOW, 22.5]]),
        makeSample(45, [['11', MEDIUM, 126.1222], ['11', LOW, 6.8414], ['11', HIGH, 58.8396], ['1', HIGH, 36.024]]),
        makeSample(51, [['11', LOW, 112.45], ['11', HIGH, 23.775], ['11', MEDIUM, 52.925], ['3', HIGH, 39.343]]),
        makeSample(57, [['10', MEDIUM, 12.3], ['1', HIGH, 9.84], ['3', HIGH, 84.412], ['11', LOW, 14.24], ['13', HIGH, 1], ['11', MEDIUM, 90.627], ['13', MEDIUM, 1], ['11', HIGH, 18.737]]),
        makeSample(63, [['10', MEDIUM, 7.11], ['11', MEDIUM, 68.6875], ['3', HIGH, 18.2], ['13', HIGH, 1], ['3', HIGH, 115.6672], ['1', HIGH, 13.8959], ['11', HIGH, 20.6325]]),
        makeSample(69, [['11', HIGH, 24.425], ['11', LOW, 80.905], ['11', MEDIUM, 51.685], ['3', HIGH, 66.03], ['13', LOW, 1]]),
        makeSample(75, [['3', HIGH, 47.8808], ['10', MEDIUM, 12.1], ['11', MEDIUM, 132.3795], ['13', HIGH, 0.52], ['13', HIGH, 1], ['11', HIGH, 3.8475], ['13', HIGH, 0.4], ['1', HIGH, 21.12]]),
        makeSample(81, [['3', HIGH, 183.522], ['13', HIGH, 0.55], ['10', MEDIUM, 93.61], ['11', HIGH, 49.093], ['13', HIGH, 1], ['1', HIGH, 3.239], ['11', LOW, 15.484]]),
    ];

    const variabilityProject: Project = {
        id: DEMO_PROJECT_ID,
        name: t('demoProjectInsufficient.name'),
        nombre: t('demoProjectInsufficient.name'),
        inspector: t('demoProjectInsufficient.inspector'),
        inspectionDate: '2025-06-06',
        lastView: 'DATA_ENTRY',
        propietario: user.id,
        sections: [
            {
                id: 'demo-variability-section-1',
                name: t('demoProjectInsufficient.sectionName'),
                length,
                width,
                startStation: 0,
                pavementType: PavementType.FLEXIBLE,
                sampleUnitArea,
                stdDev: ASTM_DEFAULTS.STD_DEV_AC,
                allowableError: ASTM_DEFAULTS.ALLOWABLE_ERROR,
                evaluateAllSamples: false,
                area: sectionArea,
                sampleUnitLength,
                ...params,
                samples,
            },
        ],
    };

    saveProjectToStorage(variabilityProject);
    setSelectedProject(variabilityProject);
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
      setDataEntryConfig(null);
      if (view === 'PROFILE' || view === 'DASHBOARD'|| view === 'ADMIN_SETTINGS') {
          setSelectedProject(null);
          setCurrentView(view);

          return;
      }
      
      let projectToUpdate = projectOverride || selectedProject;
      if (!projectToUpdate) return;
      
      // Si se mueve al paso de cálculo, realizar el cálculo primero
      if (view === 'CALCULATION_DETAILS' || view === 'RESULTS' || view === 'AGENT') {
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
  
  // Guarda datos del agente (configuración, contexto de tramos, consultas) sin borrar los resultados del PCI.
  const selectedProjectRef = useRef<Project | null>(null);
  selectedProjectRef.current = selectedProject;
  const handleAgentSave = async (patch: { agentConfig?: AgentConfig; agentRuns?: AgentRun[]; contexts?: Record<string, SectionContext | null> }) => {
    const current = selectedProjectRef.current;
    if (!current) return;
    const next: Project = { ...current };
    if (patch.agentConfig !== undefined) next.agentConfig = patch.agentConfig;
    if (patch.agentRuns !== undefined) next.agentRuns = patch.agentRuns;
    if (patch.contexts) {
      next.sections = current.sections.map(section =>
        section.id in patch.contexts! ? { ...section, context: patch.contexts![section.id] ?? undefined } : section
      );
    }
    selectedProjectRef.current = next;
    setSelectedProject(next);
    // saveProjectToStorage descarta la petición si ya hay un guardado en curso: se espera a que termine.
    const key = String(next._id || next.id);
    for (let i = 0; i < 100 && savingProjectIdRef.current === key; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await saveProjectToStorage(next);
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

  const handleEvaluateAdditional = (sectionId: string, missingCount: number) => {
    if (!selectedProject) return;
    const section = selectedProject.sections.find(s => s.id === sectionId);
    if (!section) return;

    const existingIds = section.samples.map(s => s.id);
    const idsToAdd = getAdditionalRandomSampleIds(section.totalSampleUnits, existingIds, missingCount);
    if (idsToAdd.length === 0) return;

    updateProjectState(draft => {
      const draftSection = draft.sections.find(s => s.id === sectionId);
      if (!draftSection) return;
      idsToAdd.forEach(id => {
        draftSection.samples.push({
          id,
          area: draftSection.sampleUnitArea,
          pavementType: draftSection.pavementType,
          distresses: [],
          isAdditional: false,
        });
      });
      draftSection.samples.sort((a, b) => a.id - b.id);
      draftSection.systematicallyAddedSampleIds = [
        ...(draftSection.systematicallyAddedSampleIds || []),
        ...idsToAdd,
      ];
    });

    setDataEntryConfig({ sectionId, focusSampleId: idsToAdd[0], newlyAddedIds: idsToAdd });
    setCurrentView('DATA_ENTRY');
  };
  
  const renderContent = () => {
    if (currentView === 'DASHBOARD') {
      return (
        <DashboardView
          projects={projects}
          onNewProject={handleNewProject}
          onSelectProject={handleSelectProject}
          onInitiateDelete={handleInitiateDelete}
          //onLoadExample={handleLoadDemoProject}
          //onLoadInsufficientExample={handleLoadInsufficientExample}
        />
      );
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
        return (
          <DashboardView
            projects={projects}
            onNewProject={handleNewProject}
            onSelectProject={handleSelectProject}
            onInitiateDelete={handleInitiateDelete}
            //onLoadExample={handleLoadDemoProject}
            //onLoadInsufficientExample={handleLoadInsufficientExample}
          />
        );
    }
    
    // La lógica de cálculo ahora se maneja mediante funciones de navegación/selección,
    // eliminando el riesgo de bucles infinitos durante la renderización.
    switch (currentView) {
      case 'DATA_ENTRY':
        return (
          <DataEntryView
            project={selectedProject}
            onSampleUpdate={handleSampleUpdate}
            onSampleAdd={handleSampleAdd}
            onSampleDelete={handleSampleDelete}
            initialConfig={dataEntryConfig}
          />
        );
      case 'CALCULATION_DETAILS':
        return <CalculationDetailsView project={selectedProject} />;
      case 'RESULTS':
        return (
          <ResultsDisplay
            project={selectedProject}
            onEvaluateAdditionalSamples={handleEvaluateAdditional}
            setCurrentView={setCurrentView}
          />
        );
      case 'AGENT':
        return (
          <AgentPanel
            project={selectedProject}
            onSave={handleAgentSave}
            onNavigate={handleNavigate}
          />
        );
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
