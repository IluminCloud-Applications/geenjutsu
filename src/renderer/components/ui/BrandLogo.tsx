import React from 'react';
import { clsx } from 'clsx';

interface BrandTextLogoProps {
  className?: string;
  heightClass?: string;
}

export const BrandTextLogo: React.FC<BrandTextLogoProps> = ({
  className = '',
  heightClass = 'h-[15px]',
}) => {
  return (
    <img
      src="./icon/logo_texto.webp"
      alt="Geenjutsu"
      className={clsx(
        heightClass,
        'w-auto object-contain select-none pointer-events-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
        className
      )}
    />
  );
};

interface AppIconProps {
  className?: string;
  sizeClass?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  className = '',
  sizeClass = 'h-8 w-auto',
}) => {
  return (
    <img
      src="./icon/icon.webp"
      alt="Geenjutsu Icon"
      className={clsx(
        sizeClass,
        'object-contain select-none pointer-events-none filter drop-shadow-[0_2px_6px_rgba(239,68,68,0.3)]',
        className
      )}
    />
  );
};
