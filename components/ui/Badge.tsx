import React from 'react';

/**
 * Componente Badge para mostrar etiquetas de estado, prioridad, etc.
 * Usado en RecommendationsView y otros componentes.
 */
export const Badge: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => {
  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'justify-center',
        'px-2',
        'py-1',
        'text-xs',
        'font-medium',
        'rounded-full',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
};