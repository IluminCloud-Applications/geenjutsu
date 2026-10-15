import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { clsx } from 'clsx';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { FolderIcon } from '../ui/FolderIcon';

interface FolderIconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
  className?: string;
  align?: 'left' | 'right';
  showLabel?: boolean;
}

const PRESET_EMOJIS = ['📁', '🚀', '🔥', '🛒', '💰', '🛡️', '⚡', '🎯', '📊', '👥', '🌐', '🔒', '📱', '📦', '⭐', '💼'];

export const FolderIconPicker: React.FC<FolderIconPickerProps> = ({
  value,
  onChange,
  className = '',
  align = 'left',
  showLabel = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    origin: string;
    ready: boolean;
  }>({
    top: 0,
    left: 0,
    origin: align === 'right' ? 'top right' : 'top left',
    ready: false,
  });
  const { theme } = useTheme();
  const { t } = useI18n();

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !popoverRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const pad = 12;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let top = triggerRect.bottom + 6;
    let originY = 'top';

    // If opening downwards overflows viewport, flip upwards if there is enough space
    if (top + popoverRect.height > winH - pad) {
      if (triggerRect.top - popoverRect.height - 6 >= pad) {
        top = triggerRect.top - popoverRect.height - 6;
        originY = 'bottom';
      } else {
        top = Math.max(pad, winH - popoverRect.height - pad);
        originY = triggerRect.top > winH / 2 ? 'bottom' : 'top';
      }
    }

    let left = align === 'right' ? triggerRect.right - popoverRect.width : triggerRect.left;
    let originX = align === 'right' ? 'right' : 'left';

    // Clamp horizontally to stay within viewport
    if (left + popoverRect.width > winW - pad) {
      left = winW - popoverRect.width - pad;
      originX = 'right';
    }
    if (left < pad) {
      left = pad;
      originX = 'left';
    }

    setPopoverPos({
      top: Math.round(top),
      left: Math.round(left),
      origin: `${originY} ${originX}`,
      ready: true,
    });
  }, [isOpen, align]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setIsOpen(false);
      }
    };

    const handleScroll = (e: Event) => {
      if (popoverRef.current?.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleResize = () => {
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleSelectEmoji = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
  };

  const handleResetDefault = () => {
    onChange('ri-folder-3-line');
    setIsOpen(false);
  };

  const toggleOpen = () => {
    if (!isOpen) {
      setPopoverPos(prev => ({ ...prev, ready: false }));
    }
    setIsOpen(!isOpen);
  };

  const isCustomEmoji = value && !value.startsWith('ri-');

  return (
    <div className={clsx('relative inline-block', className)} ref={triggerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={toggleOpen}
        title={t.foldersPage.chooseEmoji}
        className={clsx(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 cursor-pointer select-none',
          isOpen
            ? 'border-red-500/60 bg-red-500/8 text-red-500 ring-2 ring-red-500/10'
            : 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--foreground)] hover:border-[var(--border-hover)]'
        )}
      >
        <div className="w-6 h-6 rounded-md bg-[var(--card)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 shadow-xs">
          <FolderIcon icon={value} className="text-sm" />
        </div>
        {showLabel && (
          <span className="text-[12px] font-medium text-[var(--muted-fg)]">
            {isCustomEmoji ? t.foldersPage.changeEmoji : t.foldersPage.chooseEmoji}
          </span>
        )}
        <i className="ri-arrow-down-s-line text-xs text-[var(--muted)]" />
      </button>

      {/* Floating Popover via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className={clsx(
              'fixed z-[9999] w-[330px] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden select-none',
              popoverPos.ready ? 'animate-fade-in-scale opacity-100' : 'opacity-0 pointer-events-none'
            )}
            style={{
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              transformOrigin: popoverPos.origin,
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border)] bg-[var(--sidebar-primary)]">
              <div className="flex items-center gap-2">
                <i className="ri-emotion-line text-xs text-red-500" />
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {t.foldersPage.chooseEmoji}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xs" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="p-2 border-b border-[var(--border)]/60 bg-[var(--card)]">
              <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5 px-1">
                {t.foldersPage.popularEmojis}
              </span>
              <div className="grid grid-cols-8 gap-1">
                {PRESET_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectEmoji(emoji)}
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all duration-100 cursor-pointer',
                      value === emoji
                        ? 'bg-red-500/15 border border-red-500/40 scale-105'
                        : 'hover:bg-[var(--muted-bg)] active:scale-95'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Emoji Picker */}
            <div className="p-1">
              <EmojiPicker
                onEmojiClick={(data: EmojiClickData) => handleSelectEmoji(data.emoji)}
                theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                lazyLoadEmojis={true}
                searchPlaceHolder={t.foldersPage.searchEmoji}
                width="100%"
                height={300}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled={true}
              />
            </div>

            {/* Footer Reset */}
            <div className="p-2 bg-[var(--sidebar-primary)] border-t border-[var(--border)] flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetDefault}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[var(--muted-fg)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-restart-line text-xs" />
                <span>{t.foldersPage.resetDefault}</span>
              </button>
              {isCustomEmoji && (
                <span className="text-[10.5px] text-[var(--muted)]">
                  Emoji: <span className="text-sm ml-1">{value}</span>
                </span>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
