import React from 'react';
import type { BlockStatus } from '../../services/agent/analysis';

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${className ?? ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const STATUS_STYLE: Record<BlockStatus, { symbol: string; className: string }> = {
  ok: { symbol: '✓', className: 'bg-primary text-text-inverted' },
  warn: { symbol: '!', className: 'bg-amber-500 text-white' },
  error: { symbol: '×', className: 'bg-danger text-white' },
};

interface AccordionBlockProps {
  id: string;
  number: number;
  title: string;
  status: BlockStatus;
  statusLabel: string;
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  changedLabel?: string;
  children: React.ReactNode;
}

/** Bloque expandible: mismo patrón que SectionRow de ResultsDisplay (chevron que gira, contenido con fade). */
export const AccordionBlock: React.FC<AccordionBlockProps> = ({ id, number, title, status, statusLabel, summary, open, onToggle, changedLabel, children }) => {
  const style = STATUS_STYLE[status];
  return (
    <section id={id} className={`rounded-xl border bg-bg-surface mb-3 scroll-mt-4 ${open ? 'border-primary shadow-md' : 'border-border-muted'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <span className={`shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${style.className}`} aria-hidden="true">{style.symbol}</span>
        <span className="sr-only">{statusLabel}</span>
        <span className="font-bold text-text-base">{number} · {title}</span>
        <span className="flex-1 min-w-0 text-sm text-text-muted hidden sm:block truncate">{summary}</span>
        {changedLabel && <span className="text-xs font-semibold text-primary-dark bg-primary/10 rounded-full px-2 py-0.5">{changedLabel}</span>}
        <ChevronDownIcon className={`text-text-muted shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {!open && <p className="sm:hidden px-4 pb-3 -mt-1 text-sm text-text-muted">{summary}</p>}
      {open && (
        <div id={`${id}-body`} className="px-4 pb-4 pt-3 border-t border-border-muted animate-simple-fade-in">
          {children}
        </div>
      )}
    </section>
  );
};
