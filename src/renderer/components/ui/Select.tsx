import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FolderIcon } from './FolderIcon';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  badge?: string;
}

export interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={twMerge('w-full flex flex-col gap-1.5 select-none relative', className)} ref={containerRef}>
      {label && (
        <span className="text-xs font-medium text-[var(--muted-fg)]">{label}</span>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={clsx(
          'w-full h-9 flex items-center justify-between bg-[var(--muted-bg)] dark:bg-[var(--muted-bg)] text-[var(--foreground)] text-[12.5px] font-medium rounded-lg border px-3 transition-all duration-150 cursor-pointer focus:outline-none',
          isOpen
            ? 'border-red-500/60 ring-2 ring-red-500/10'
            : 'border-[var(--border)] hover:border-[var(--border-hover)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon && (
            <FolderIcon icon={selectedOption.icon} className="text-sm text-[var(--muted)]" />
          )}
          <span className={clsx(!selectedOption && 'text-[var(--muted)]', 'truncate')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[var(--card)] text-[var(--muted-fg)] border border-[var(--border)] ml-1">
              {selectedOption.badge}
            </span>
          )}
        </span>
        <i
          className={clsx(
            'ri-arrow-down-s-line text-[var(--muted)] text-base flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Options Dropdown */}
      {isOpen && (
        <div
          className="absolute top-[calc(100%+5px)] left-0 w-full z-50 bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden animate-fade-in-scale"
          style={{ boxShadow: 'var(--shadow-lg)' }}
        >
          <div className="max-h-52 overflow-y-auto py-1">
            {options.map(option => {
              const isSelected = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-red-500/8 text-red-500 font-semibold'
                      : 'text-[var(--foreground)] hover:bg-[var(--muted-bg)]'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {option.icon && (
                      <FolderIcon
                        icon={option.icon}
                        className={clsx('text-sm flex-shrink-0', isSelected ? 'text-red-500' : 'text-[var(--muted)]')}
                      />
                    )}
                    <div className="flex flex-col min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{option.label}</span>
                        {option.badge && (
                          <span className="text-[9.5px] font-mono px-1 py-0.2 rounded bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)] leading-tight">
                            {option.badge}
                          </span>
                        )}
                      </div>
                      {option.description && (
                        <span className="text-[10.5px] text-[var(--muted)] truncate font-mono">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <i className="ri-check-line text-red-500 text-sm flex-shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
