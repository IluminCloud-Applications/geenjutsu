import React from 'react';
import { clsx } from 'clsx';

export interface FolderIconProps {
  icon?: string;
  className?: string;
  fallback?: string;
}

export const FolderIcon: React.FC<FolderIconProps> = ({
  icon,
  className = '',
  fallback = 'ri-folder-3-line',
}) => {
  const isRemixIcon = icon && (icon.startsWith('ri-') || icon.includes('ri-'));

  if (!icon) {
    return <i className={clsx(fallback, 'text-[15px] leading-none flex-shrink-0', className)} />;
  }

  if (isRemixIcon) {
    return <i className={clsx(icon, 'text-[15px] leading-none flex-shrink-0', className)} />;
  }

  // It's an emoji
  return (
    <span
      className={clsx(
        'text-[14px] leading-none flex-shrink-0 inline-flex items-center justify-center select-none font-normal',
        className
      )}
      role="img"
      aria-label="folder icon"
    >
      {icon}
    </span>
  );
};
