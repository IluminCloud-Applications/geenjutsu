import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DropdownItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; origin: string; ready: boolean }>({
    top: 0,
    left: 0,
    origin: align === 'right' ? 'top right' : 'top left',
    ready: false,
  });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !menuRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let top = triggerRect.bottom + 4;
    let originY = 'top';

    // If opening downwards overflows viewport, flip upwards
    if (top + menuRect.height > winH - pad && triggerRect.top - menuRect.height - 4 >= pad) {
      top = triggerRect.top - menuRect.height - 4;
      originY = 'bottom';
    } else if (top + menuRect.height > winH - pad) {
      top = Math.max(pad, winH - menuRect.height - pad);
    }

    let left = align === 'right' ? triggerRect.right - menuRect.width : triggerRect.left;
    let originX = align === 'right' ? 'right' : 'left';

    // Clamp horizontally
    if (left + menuRect.width > winW - pad) {
      left = winW - menuRect.width - pad;
      originX = 'right';
    }
    if (left < pad) {
      left = pad;
      originX = 'left';
    }

    setMenuPos({
      top: Math.round(top),
      left: Math.round(left),
      origin: `${originY} ${originX}`,
      ready: true,
    });
  }, [isOpen, align, items]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScrollOrResize = () => setIsOpen(false);

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div className={twMerge('relative inline-flex', className)} ref={triggerRef}>
      <div
        onClick={e => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="cursor-pointer"
      >
        {trigger}
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={clsx(
              'fixed z-[9999] min-w-[170px] bg-[var(--card)] border border-[var(--border)] rounded-xl py-1 overflow-hidden select-none',
              menuPos.ready ? 'animate-fade-in-scale opacity-100' : 'opacity-0 pointer-events-none'
            )}
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              transformOrigin: menuPos.origin,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {items.map((item, idx) => (
              <React.Fragment key={idx}>
                {item.divider && idx > 0 && (
                  <div className="my-1 mx-2 border-t border-[var(--border)]/60" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={e => {
                    e.stopPropagation();
                    setIsOpen(false);
                    item.onClick();
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition-colors cursor-pointer',
                    item.danger
                      ? 'text-red-500 hover:bg-red-500/8'
                      : 'text-[var(--foreground)] hover:bg-[var(--muted-bg)]'
                  )}
                >
                  {item.icon && (
                    <i
                      className={clsx(
                        item.icon,
                        'text-sm leading-none flex-shrink-0',
                        item.danger ? 'text-red-500' : 'text-[var(--muted)]'
                      )}
                    />
                  )}
                  <span className="font-medium tracking-tight truncate">{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
