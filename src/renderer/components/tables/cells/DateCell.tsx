import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatDateTime } from '../../../utils/dateFormatter';

interface DateCellProps {
  value: number | string | null | undefined;
  onChange: (val: number | null) => void;
}

export const DateCell: React.FC<DateCellProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [popPos, setPopPos] = useState({ top: 0, left: 0 });

  // Parse current date & time
  const currentTimestamp = value ? Number(value) : null;
  const activeDate = currentTimestamp && !isNaN(currentTimestamp) ? new Date(currentTimestamp) : new Date();

  const getDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getTimeString = (d: Date) => {
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  };

  const [dateInput, setDateInput] = useState(() => getDateString(activeDate));
  const [timeInput, setTimeInput] = useState(() => getTimeString(activeDate));

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popWidth = 260;
    const popHeight = 220;
    const pad = 8;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let top = rect.bottom + 4;
    if (top + popHeight > winH - pad && rect.top - popHeight - 4 >= pad) {
      top = rect.top - popHeight - 4;
    }

    let left = rect.left;
    if (left + popWidth > winW - pad) {
      left = Math.max(pad, winW - popWidth - pad);
    }

    setPopPos({ top, left });
  };

  const handleOpen = () => {
    const d = value ? new Date(Number(value)) : new Date();
    setDateInput(getDateString(d));
    setTimeInput(getTimeString(d));
    updatePosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScroll = () => updatePosition();

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const applyDateTime = (newDateStr: string, newTimeStr: string) => {
    if (!newDateStr) return;
    const [y, m, d] = newDateStr.split('-').map(Number);
    const [hh, mm] = (newTimeStr || '00:00').split(':').map(Number);
    const constructed = new Date(y, m - 1, d, hh || 0, mm || 0);
    onChange(constructed.getTime());
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDateInput(val);
    applyDateTime(val, timeInput);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTimeInput(val);
    applyDateTime(dateInput, val);
  };

  const setPresetNow = () => {
    const now = new Date();
    setDateInput(getDateString(now));
    setTimeInput(getTimeString(now));
    onChange(now.getTime());
  };

  const setPresetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDateInput(getDateString(d));
    setTimeInput(getTimeString(d));
    onChange(d.getTime());
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        title="Clique para editar a data e hora"
        className="w-full flex items-center justify-between min-h-[30px] px-2 py-1 rounded-md hover:bg-[var(--muted-bg)]/80 cursor-pointer group transition-colors select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <i className="ri-calendar-line text-xs text-[var(--muted)] group-hover:text-red-500 transition-colors flex-shrink-0" />
          <span className="text-xs font-mono font-medium text-[var(--foreground)] truncate">
            {value ? formatDateTime(value) : <span className="text-[var(--muted)]/50 italic">—</span>}
          </span>
        </div>
        <i className="ri-pencil-line text-[10px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1" />
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 w-[260px] bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl p-3 flex flex-col gap-2.5 animate-scale-in text-[var(--foreground)] select-none"
            style={{
              top: popPos.top,
              left: popPos.left,
              boxShadow: '0 12px 30px -4px rgba(0,0,0,0.35)',
            }}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border)]/60">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <i className="ri-calendar-event-line text-red-500" />
                <span>Editar Data & Hora</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xs" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={setPresetNow}
                className="flex-1 py-1 px-1.5 text-[11px] font-medium bg-[var(--muted-bg)] hover:bg-red-500/10 hover:text-red-500 rounded-md border border-[var(--border)] transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <i className="ri-flashlight-line text-[10px]" />
                <span>Agora</span>
              </button>
              <button
                type="button"
                onClick={setPresetYesterday}
                className="flex-1 py-1 px-1.5 text-[11px] font-medium bg-[var(--muted-bg)] hover:bg-red-500/10 hover:text-red-500 rounded-md border border-[var(--border)] transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <i className="ri-history-line text-[10px]" />
                <span>Ontem</span>
              </button>
            </div>

            {/* Inputs: Date & Time */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-medium text-[var(--muted)]">Data</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={handleDateChange}
                  className="w-full h-8 px-2 bg-[var(--muted-bg)] text-[var(--foreground)] rounded-lg border border-[var(--border)] text-xs font-mono focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-medium text-[var(--muted)]">Hora</label>
                <input
                  type="time"
                  value={timeInput}
                  onChange={handleTimeChange}
                  className="w-full h-8 px-2 bg-[var(--muted-bg)] text-[var(--foreground)] rounded-lg border border-[var(--border)] text-xs font-mono focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between">
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-[var(--muted)] hover:text-red-500 transition-colors cursor-pointer"
              >
                Limpar
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] px-3 py-1 rounded-md transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
