import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className, ...props }) => {
  const baseClasses = 'px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-out transform-gpu hover:-translate-y-0.5 active:scale-95';
  
  const variantClasses = {
    primary: 'bg-primary text-text-inverted hover:bg-primary-dark focus:ring-primary/30 shadow-lg hover:shadow-xl shadow-primary/30',
    secondary: 'bg-secondary text-text-inverted hover:bg-secondary-dark focus:ring-secondary/30 shadow-lg hover:shadow-xl shadow-secondary/30',
    danger: 'bg-danger text-text-inverted hover:bg-danger-dark focus:ring-danger/30 shadow-lg hover:shadow-xl shadow-danger/30',
    ghost: 'bg-transparent text-text-muted hover:bg-primary/10 hover:text-primary focus:ring-primary/20 shadow-none hover:transform-none',
  };

  const disabledClasses = 'disabled:bg-border-muted disabled:text-text-muted disabled:border-transparent disabled:hover:bg-border-muted disabled:shadow-none disabled:transform-none';

  return (
    <button className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className || ''}`} {...props}>
      {children}
    </button>
  );
};
