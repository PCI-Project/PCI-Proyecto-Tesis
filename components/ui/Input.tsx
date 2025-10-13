import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  containerClassName?: string;
  labelClassName?: string;
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  id, 
  containerClassName, 
  className, 
  labelClassName, 
  ...props 
}) => {
  const baseClasses = "block w-full border border-border-base rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-text-base bg-bg-surface disabled:bg-bg-muted disabled:text-text-muted/50 transition-colors p-3 placeholder:text-text-muted/60 shadow-sm";
  const defaultLabelClasses = "block font-medium text-text-muted";
  const finalId = id || props.name;

  return (
    <div className={containerClassName}>
      {label && <label htmlFor={finalId} className={`${defaultLabelClasses} ${labelClassName || 'text-sm mb-1.5'}`}>{label}</label>}
      <input
        id={finalId}
        className={`${baseClasses} ${className || ''}`}
        {...props}
      />
    </div>
  );
};