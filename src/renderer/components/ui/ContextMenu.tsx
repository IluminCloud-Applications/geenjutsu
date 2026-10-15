import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { DropdownItem } from './Dropdown';

interface ContextMenuProps {
  x: number;
  y: number;
  items: DropdownItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; origin: string; ready: boolean }>({
    x,
    y,
    origin: 'top left',
    ready: false,
  });

  // Calculate precise clamped and flipped positioning based on viewport dimensions
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pad = 10;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let nx = x;
    let ny = y;
    let originY = 'top';
    let originX = 'left';

    // Vertical positioning: check if opening downwards overflows the viewport
    if (y + rect.height > winH - pad) {
      if (y - rect.height >= pad) {
        // Fits nicely above the click position
        ny = y - rect.height;
        originY = 'bottom';
      } else {
        // Doesn't fit cleanly on either side; clamp to viewport
        ny = Math.max(pad, winH - rect.height - pad);
        originY = y > winH / 2 ? 'bottom' : 'top';
      }
    } else {
      ny = Math.max(pad, y);
    }

    // Horizontal positioning: check if opening rightwards overflows the viewport
    if (x + rect.width > winW - pad) {
      if (x - rect.width >= pad) {
        // Fits nicely to the left of the click position
        nx = x - rect.width;
        originX = 'right';
      } else {
        // Clamp to viewport
        nx = Math.max(pad, winW - rect.width - pad);
        originX = x > winW / 2 ? 'right' : 'left';
      }
    } else {
      nx = Math.max(pad, x);
    }

    setPos({
      x: Math.round(nx),
      y: Math.round(ny),
      origin: `${originY} ${originX}`,
      ready: true,
    });
  }, [x, y, items]);

  useEffect(() => {
    // Notify any other active context menus to close
    window.dispatchEvent(new CustomEvent('geenjutsu:close-context-menu'));

    const handleCloseAll = () => onClose();
    window.addEventListener('geenjutsu:close-context-menu', handleCloseAll);

    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleContextMenuOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleScrollOrResize = () => onClose();

    // Use capture phase to intercept clicks/contextmenus before target components stop propagation
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleOutside, true);
      window.addEventListener('contextmenu', handleContextMenuOutside, true);
    }, 10);

    window.addEventListener('keydown', handleEsc);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('geenjutsu:close-context-menu', handleCloseAll);
      window.removeEventListener('mousedown', handleOutside, true);
      window.removeEventListener('contextmenu', handleContextMenuOutside, true);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className={clsx(
        'fixed z-[9999] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden py-1 min-w-[190px] select-none',
        pos.ready ? 'animate-fade-in-scale opacity-100' : 'opacity-0 pointer-events-none'
      )}
      style={{
        top: `${pos.y}px`,
        left: `${pos.x}px`,
        transformOrigin: pos.origin,
        boxShadow: 'var(--shadow-xl)',
      }}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {item.divider && idx > 0 && <div className="my-1 mx-2 border-t border-[var(--border)]/60" />}
          <button
            type="button"
            role="menuitem"
            onClick={e => {
              e.stopPropagation();
              onClose();
              item.onClick();
            }}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors cursor-pointer',
              item.danger
                ? 'text-red-500 hover:bg-red-500/10'
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
  );
};
