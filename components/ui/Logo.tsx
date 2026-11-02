import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import emblemaPositivo from '../../public/brand/emblema-positivo.svg';
import emblemaNegativo from '../../public/brand/emblema-negativo.svg';
import horizontalPositivo from '../../public/brand/horizontal-positivo.svg';
import horizontalNegativo from '../../public/brand/horizontal-negativo.svg';
import iconoApp from '../../public/brand/icono-app.svg';

interface LogoProps {
    variant?: 'emblema' | 'horizontal';
    height?: number | string;
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'horizontal', height, className = '' }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const logoMap: Record<string, Record<string, string>> = {
        emblema: {
            positivo: emblemaPositivo,
            negativo: emblemaNegativo,
        },
        horizontal: {
            positivo: horizontalPositivo,
            negativo: horizontalNegativo,
        },
    };

    const color = isDark ? 'negativo' : 'positivo';
    const src = logoMap[variant]?.[color] || iconoApp;

    return (
        <img
            src={src}
            alt="AsphaltPCI Pro"
            aria-label="AsphaltPCI Pro"
            className={`block w-auto ${className}`}
            style={height ? { height } : undefined}
        />
    );
};
