import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  label?: string;
  suffix?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon, label, id, suffix, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {icon && (
            <div className="absolute left-3 text-[var(--muted)] pointer-events-none flex items-center">
              <i className={clsx(icon, 'text-sm')} />
            </div>
          )}
          <input
            id={id}
            ref={ref}
            className={twMerge(
              clsx(
                'w-full h-9 bg-[var(--muted-bg)] text-[var(--foreground)] text-[12.5px] font-medium rounded-lg border px-3 transition-all duration-150',
                error
                  ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                  : 'border-[var(--border)] focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10 hover:border-[var(--border-hover)]',
                'placeholder:text-[var(--muted)] placeholder:font-normal focus:outline-none',
                props.readOnly && 'cursor-default text-[var(--muted-fg)] focus:border-[var(--border)] focus:ring-0 hover:border-[var(--border)] select-all',
                icon && 'pl-9',
                suffix && 'pr-9',
                className
              )
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 flex items-center text-[var(--muted)]">
              {suffix}
            </div>
          )}
        </div>
        {error && (
          <span className="text-[11px] text-red-500 font-medium leading-none">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
