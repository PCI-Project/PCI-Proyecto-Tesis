import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  text: string;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, text, className = '' }) => {
  return (
    <div className={`relative flex items-center group ${className}`}>
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-1.5 text-xs font-semibold text-text-inverted bg-text-base rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-normal text-center">
        {text}
      </div>
    </div>
  );
};
