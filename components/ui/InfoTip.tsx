import React from 'react';

interface InfoTipProps {
  text: string;
  className?: string;
}

// Icono "i" con una explicación al pasar el cursor o enfocarlo con el teclado.
export const InfoTip: React.FC<InfoTipProps> = ({ text, className = '' }) => (
  <span className={`relative inline-flex align-middle group ${className}`}>
    <span
      tabIndex={0}
      role="img"
      aria-label={text}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-primary/70 text-[10px] font-bold italic leading-none text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      i
    </span>
    <span
      role="tooltip"
      className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-max max-w-xs whitespace-normal rounded-md bg-text-base px-3 py-1.5 text-left text-xs font-semibold normal-case tracking-normal text-text-inverted opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {text}
    </span>
  </span>
);
