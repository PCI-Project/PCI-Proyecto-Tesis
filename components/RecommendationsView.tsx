import React, { useState, useEffect } from 'react';
import { Project, Section } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { getRecommendations, getPCIRating, checkServiceStatus } from '../services/recommendationsService';
import { useTranslations } from '../hooks/useTranslations';

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 101 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
);

export interface RecommendationCardProps {
  section: Section;
  recommendation: {
    tratamiento_recomendado: string;
    costo_estimado: number;
    beneficio_costo: number;
    prioridad: 'alta' | 'media' | 'baja';
    alerta_suficiencia_estadistica: boolean;
    observaciones: string;
  };
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  section,
  recommendation
}) => {
  const rating = getPCIRating(section.pci ?? 100);
  const { t } = useTranslations();

  const prioridadClass: Record<string, string> = {
    alta: 'bg-red-100 text-red-800 border-red-200',
    media: 'bg-yellow-100 text-brown-800 border-yellow-200',
    baja: 'bg-green-100 text-green-800 border-green-200'
  };

  return (
    <Card className="p-6 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-primary mb-1">
            {t('results.section')} {section.name}
          </h3>
          <p className="text-text-muted">
            PCI: {section.pci?.toFixed(2) ?? 'N/A'} ({t(`rating.${rating.labelKey}`)})
          </p>
        </div>
        <Badge
          className={prioridadClass[recommendation.prioridad] || 'bg-gray-100 text-gray-800'}
        >
          {t(`prioridad.${recommendation.prioridad}`)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm text-text-muted mb-2">{t('recommendations.tratamiento')}</h4>
          <p className="text-lg font-medium text-primary">
            {recommendation.tratamiento_recomendado}
          </p>
        </div>
        <div>
          <h4 className="text-sm text-text-muted mb-2">{t('recommendations.costo')}</h4>
          <p className="text-lg font-medium text-primary">
            ${recommendation.costo_estimado.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="text-sm text-text-muted mb-2">{t('recommendations.beneficio_costo')}</h4>
          <p className="text-lg font-medium text-primary">
            {recommendation.beneficio_costo.toFixed(2)}
          </p>
        </div>
        <div>
          <h4 className="text-sm text-text-muted mb-2">{t('recommendations.prioridad')}</h4>
          <p className="text-lg font-medium text-primary">
            {t(`prioridad.${recommendation.prioridad}`)}
          </p>
        </div>
      </div>

      <Card className="mt-4 p-4 bg-bg-surface border-border-muted">
        <h5 className="text-sm font-bold text-text-base mb-2">{t('recommendations.observaciones')}</h5>
        <p className="text-text-muted line-clamp-3">{recommendation.observaciones}</p>
      </Card>
    </Card>
  );
};

/**
 * Componente principal de vista de recomendaciones
 */
export const RecommendationsView: React.FC<{ project: Project }> = ({
  project
}) => {
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Array<{
    section: Section;
    recommendation: {
      tratamiento_recomendado: string;
      costo_estimado: number;
      beneficio_costo: number;
      prioridad: 'alta' | 'media' | 'baja';
      alerta_suficiencia_estadistica: boolean;
      observaciones: string;
    };
  }>>([]);
  const [serviceStatus, setServiceStatus] = useState<{ status: string; version: string } | null>(null);

  // Verificar estado del servicio al montar
  useEffect(() => {
    let ignored = false;
    checkServiceStatus()
      .then((status) => {
        if (!ignored) {
          setServiceStatus(status);
        }
      })
      .catch((err) => {
        if (!ignored) {
          console.error('Error verificando servicio:', err);
          setServiceStatus({ status: 'offline', version: 'unknown' });
        }
      });
    return () => { ignored = true; };
  }, []);

  // Obtener recomendaciones cuando cambia el proyecto
  useEffect(() => {
    let ignored = false;
    if (project && project.sections && project.sections.length > 0) {
      setLoading(true);
      setError(null);
      getRecommendations(project)
        .then((response) => {
          if (!ignored && response.success) {
            const recs = response.recommendations.map(rec => ({
              section: project.sections.find(s => s.id === rec.sectionId) || rec.section,
              recommendation: {
                tratamiento_recomendado: rec.tratamiento_recomendado,
                costo_estimado: rec.costo_estimado,
                beneficio_costo: rec.beneficio_costo,
                prioridad: rec.prioridad,
                alerta_suficiencia_estadistica: rec.alerta_suficiencia_estadistica,
                observaciones: rec.observaciones
              }
            }));
            setRecommendations(recs);
          }
        })
        .catch((err) => {
          console.error('Error obteniendo recomendaciones:', err);
          if (!ignored) {
            setError('Error al cargar recomendaciones');
          }
        })
        .finally(() => {
          if (!ignored) setLoading(false);
        });
    }
    return () => { ignored = true; };
  }, [project]);

  // Mensajes de estado
  if (!project) {
    return (
      <div className="bg-bg-base text-text-muted min-h-screen p-8">
        <h2 className="text-2xl font-bold text-primary mb-4">
          {t('app.selectProject')}
        </h2>
        <p className="text-text-muted">
          {t('recommendations.selectProjectDesc')}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-bg-base text-text-muted min-h-screen p-8">
        <h2 className="text-2xl font-bold text-primary mb-4">
          {t('recommendations.loading')}
        </h2>
        <p className="text-text-muted">{t('recommendations.loadingDescription')}</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto my-4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-base text-text-muted min-h-screen p-8">
        <h2 className="text-2xl font-bold text-danger mb-4">
          {t('recommendations.error')}
        </h2>
        <p className="text-text-muted">{error}</p>
        <Button onClick={() => window.location.reload()} variant="secondary">
          {t('recommendations.retry')}
        </Button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-bg-base text-text-muted min-h-screen p-8">
        <h2 className="text-2xl font-bold text-primary mb-4">
          {t('recommendations.noRecommendations')}
        </h2>
        <p className="text-text-muted">
          {t('recommendations.noRecommendationsDescription', {
            count: project.sections.length
          })}
        </p>
      </div>
    );
  }

  if (serviceStatus?.status === 'offline') {
    return (
      <div className="bg-bg-base text-text-muted min-h-screen p-8">
        <h2 className="text-2xl font-bold text-warning mb-4">
          {t('recommendations.serviceOffline')}
        </h2>
        <p className="text-text-muted">
          {t('recommendations.serviceOfflineDescription')}
        </p>
        <p>{t('recommendations.serviceVersion', { version: serviceStatus.version })}</p>
        <p>Mostrando datos locales basados en PCI calculado:</p>
        {recommendations.map((rec, index) => (
          <RecommendationCard key={index} section={rec.section} recommendation={rec.recommendation} />
        ))}
      </div>
    );
  }

  // Renderizar recomendaciones
  return (
    <div className="bg-bg-base min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-primary mb-4">
            {t('recommendations.title', { weightedPCI: project.weightedPCI ?? 0 })}
          </h2>
          
          <div className={`p-6 rounded-xl mb-6 text-center shadow-xl transition-colors duration-500 ${getPCIRating(project.weightedPCI ?? 0).className}`}>
            <div className="flex justify-center items-center gap-2">
              <p className="text-lg uppercase tracking-wider opacity-80 font-semibold">
                {t('results.weightedPCI')}
              </p>
              <p className="text-5xl font-bold my-2">{ (project.weightedPCI ?? 0).toFixed(2) }</p>
            </div>
            <div className={`inline-block px-4 py-1.5 rounded-full font-semibold text-lg bg-black/20`}>
              {t(getPCIRating(project.weightedPCI ?? 0).labelKey)}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {recommendations.map((rec, index) => (
            <RecommendationCard key={index} section={rec.section} recommendation={rec.recommendation} />
          ))}
        </div>

        {/* Footer con estado del servicio */}
        {serviceStatus && serviceStatus.status !== 'offline' && (
          <div className="mt-8 p-4 bg-bg-surface rounded-lg border-border-muted text-sm">
            <p className="text-text-muted">
              {t('recommendations.serviceOnline', {
                version: serviceStatus.version
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};