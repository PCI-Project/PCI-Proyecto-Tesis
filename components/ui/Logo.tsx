import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface LogoProps {
    variant?: 'emblema' | 'horizontal';
    height?: number | string;
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'horizontal', height, className = '' }) => {
    const { theme } = useTheme();
    const color = theme === 'dark' ? 'negativo' : 'positivo';

    return (
        <img
            src={`/brand/${variant}-${color}.svg`}
            alt="AsphaltPCI Pro"
            aria-label="AsphaltPCI Pro"
            className={`block w-auto ${className}`}
            style={height ? { height } : undefined}
        />
    );
};
