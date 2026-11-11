import axios from 'axios';

/**
 * Cliente HTTP del backend. Adjunta el token de sesión (igual que AuthContext),
 * porque las rutas /api/projects/* exigen autenticación.
 */
const createApiClient = () => {
  const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://pci-backend-mqoc.onrender.com/api',
  });
  API.interceptors.request.use((config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {
      // localStorage no disponible: la petición saldrá sin token
    }
    return config;
  });
  return API;
};

/**
 * API client para obtener recomendaciones de mantenimiento PCI.
 * Se conecta al backend Node.js que ejecuta el agente Python.
 */

export interface RecommendationResult {
  sectionId: string;
  tratamientoRecomendado: string;
  costoEstimado: number;
  beneficioCosto: number;
  prioridad: 'alta' | 'media' | 'baja';
  alertaSuficienciaEstadistica: boolean;
  observaciones: string;
}

/**
 * Interfaz para la respuesta del endpoint de recomendaciones
 */
export interface RecommendationsResponse {
  success: boolean;
  proyectoId: string;
  recommendations: RecommendationResult[];
  weightedPCI: number;
}

/**
 * Obtiene recomendaciones de mantenimiento para un proyecto PCI.
 * Llama al endpoint POST /api/projects/:id/recommendations
 * 
 * @param project - El proyecto PCI con secciones y muestras calculadas
 * @returns Promesa con las recomendaciones de mantenimiento
 */
export const getRecommendations = async (
  project: { id: string; sections: any[] }
): Promise<RecommendationsResponse> => {
  const API = createApiClient();

  const { data } = await API.post(`/projects/${project.id}/recommendations`, project);

  return data;
};

/**
 * Verifica si el servicio de recomendaciones está disponible
 * Hace una llamada ligera al endpoint raíz
 */
export const checkServiceStatus = async (): Promise<{ status: string; version: string }> => {
  const API = createApiClient();

  const { data } = await API.get('/');
  return data;
};

/**
 * Obtiene el rating PCI basado en el valor numérico
 */
export const getPCIRating = (pci: number): { labelKey: string; className: string; range: [number, number] } => {
  const PCI_RATINGS: Record<string, { labelKey: string; className: string; range: [number, number] }> = {
    'Excelente': { labelKey: 'excelente', className: 'bg-green-100 text-green-800', range: [85, 100] },
    'Muy Bueno': { labelKey: 'muy_bueno', className: 'bg-lightGreen-100 text-green-800', range: [70, 84] },
    'Bueno': { labelKey: 'bueno', className: 'bg-yellow-100 text-brown-800', range: [55, 69] },
    'Regular': { labelKey: 'regular', className: 'bg-orange-100 text-orange-800', range: [40, 54] },
    'Malo': { labelKey: 'malo', className: 'bg-red-100 text-red-800', range: [25, 39] },
    'Muy Malo': { labelKey: 'muy_malo', className: 'bg-gray-100 text-gray-800', range: [0, 24] }
  };

  if (pci >= 85) return PCI_RATINGS['Excelente'];
  if (pci >= 70) return PCI_RATINGS['Muy Bueno'];
  if (pci >= 55) return PCI_RATINGS['Bueno'];
  if (pci >= 40) return PCI_RATINGS['Regular'];
  if (pci >= 25) return PCI_RATINGS['Malo'];
  return PCI_RATINGS['Muy Malo'];
};