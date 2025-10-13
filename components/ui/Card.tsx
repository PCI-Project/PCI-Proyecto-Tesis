import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-bg-surface text-text-base shadow-lg rounded-xl p-6 transition-all duration-300 ease-in-out transform-gpu ${className}`}>
      {children}
    </div>
  );
};