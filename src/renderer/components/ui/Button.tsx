import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'launch' | 'stop' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  icon?: string;
  iconPosition?: 'left' | 'right';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      icon,
      iconPosition = 'left',
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white rounded-lg font-semibold tracking-tight shadow-sm shadow-red-600/20',

      secondary:
        'bg-[var(--muted-bg)] hover:bg-[var(--border)] text-[var(--foreground)] border border-[var(--border)] rounded-lg active:scale-[0.97]',

      ghost:
        'hover:bg-[var(--muted-bg)] text-[var(--foreground)] rounded-lg active:scale-[0.97]',

      outline:
        'border border-[var(--border)] hover:bg-[var(--muted-bg)] text-[var(--foreground)] rounded-lg active:scale-[0.97]',

      launch:
        'bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white rounded-md font-semibold shadow-sm shadow-red-600/20 border border-red-500/20',

      stop:
        'bg-[var(--sidebar-primary)] hover:bg-[var(--muted-bg)] active:scale-[0.97] text-[var(--foreground)] border border-[var(--border)] rounded-md font-semibold',

      danger:
        'bg-red-500/8 hover:bg-red-500/14 active:scale-[0.97] text-red-500 border border-red-500/20 rounded-lg',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-xs px-3.5 py-2 gap-2',
      lg: 'text-sm px-4 py-2 gap-2.5',
      icon: 'p-1.5 rounded-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {icon && iconPosition === 'left' && <i className={clsx(icon, 'text-[14px] leading-none')} />}
        {children}
        {icon && iconPosition === 'right' && <i className={clsx(icon, 'text-[14px] leading-none')} />}
      </button>
    );
  }
);

Button.displayName = 'Button';
