import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps {
  label: string;
  variant?: 'auto' | 'default' | 'red' | 'neutral';
  className?: string;
  onRemove?: () => void;
}

/**
 * Badge elegante e monocromático — funciona perfeitamente em light e dark.
 * Usa bordas sutis ao invés de fundos coloridos saturados.
 */
export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'auto',
  className = '',
  onRemove,
}) => {
  // Para 'auto', sempre usa 'default' — design consistente e limpo
  const resolvedVariant = variant === 'auto' ? 'default' : variant;

  const styles: Record<string, string> = {
    default:
      'bg-[var(--muted-bg)] text-[var(--foreground)] border border-[var(--border)]',
    red:
      'bg-red-500/8 text-red-500 border border-red-500/20',
    neutral:
      'bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium leading-none select-none',
          styles[resolvedVariant] ?? styles.default,
          className
        )
      )}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-[var(--muted)] hover:text-[var(--foreground)] focus:outline-none cursor-pointer transition-colors ml-0.5"
        >
          <i className="ri-close-line text-[10px]" />
        </button>
      )}
    </span>
  );
};
