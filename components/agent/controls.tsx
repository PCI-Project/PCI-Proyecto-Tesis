import React from 'react';

interface SegOption<T extends string> { value: T; label: string; }

/** Control segmentado de 2 o 3 opciones (mismas clases de tokens que el resto de la app). */
export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: {
  options: SegOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-xl border border-border-base overflow-hidden bg-bg-surface">
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${active ? 'bg-primary text-text-inverted' : 'text-text-muted hover:bg-primary/10'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const FieldRow: React.FC<{ label: string; children: React.ReactNode; hint?: React.ReactNode }> = ({ label, children, hint }) => (
  <div className="grid grid-cols-1 md:grid-cols-[11rem_1fr] gap-x-4 gap-y-1 py-2.5 border-b border-dashed border-border-muted last:border-0 items-start">
    <div className="text-sm font-medium text-text-muted md:pt-3">{label}</div>
    <div className="space-y-1">
      {children}
      {hint}
    </div>
  </div>
);

export const AssumeHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p role="status" className="text-xs font-semibold text-amber-800 dark:text-amber-200">{children}</p>
);

export const ErrorHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p role="alert" className="text-xs font-semibold text-danger">{children}</p>
);

export const selectClasses = 'block w-full border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-text-base bg-bg-surface p-3 shadow-sm';
export const checkClasses = 'h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary';
