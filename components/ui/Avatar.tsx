import React from 'react';

interface AvatarProps {
  name: string;
  className?: string;
}

const getInitials = (name: string): string => {
  if (!name) return '?';
  const nameParts = name.trim().split(/\s+/);
  if (nameParts.length === 1 && nameParts[0].length > 0) {
    return nameParts[0].substring(0, 2).toUpperCase();
  }
  if (nameParts.length > 1) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }
  return '?';
};

const themeColors = ['bg-primary', 'bg-secondary', 'bg-danger'];

export const Avatar: React.FC<AvatarProps> = ({ name, className = '' }) => {
  const initials = getInitials(name);
  
  // A simple hash to pick a color
  const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colorIndex = charCodeSum % themeColors.length;
  const bgColor = themeColors[colorIndex];

  return (
    <div
      className={`flex items-center justify-center rounded-full text-text-inverted font-bold select-none ${bgColor} ${className}`}
      aria-label={`Avatar for ${name}`}
    >
      <span>{initials}</span>
    </div>
  );
};
