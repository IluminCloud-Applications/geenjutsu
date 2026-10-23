import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TableColumn, TableRow } from '../../../../types/table';

interface SelectCellProps {
  value: any;
  column: TableColumn;
  allRows: TableRow[];
  onChange: (val: string | null) => void;
}

export interface StatusMeta {
  badgeClass: string;
  icon: string;
  dotClass: string;
}

export function getStatusMeta(text: string): StatusMeta {
  if (!text) {
    return {
      badgeClass: 'bg-[var(--muted-bg)] text-[var(--muted)] border-[var(--border)]',
      icon: 'ri-circle-line',
      dotClass: 'bg-[var(--muted)]',
    };
  }

  const lower = text.toLowerCase().trim();

  // 1. Social Platforms
  if (lower === 'facebook') {
    return {
      badgeClass: 'bg-[#1877F2]/15 text-[#1877F2] border-[#1877F2]/30',
      icon: 'ri-facebook-circle-fill',
      dotClass: 'bg-[#1877F2]',
    };
  }
  if (lower === 'instagram') {
    return {
      badgeClass: 'bg-[#E1306C]/15 text-[#E1306C] border-[#E1306C]/30',
      icon: 'ri-instagram-fill',
      dotClass: 'bg-[#E1306C]',
    };
  }
  if (lower === 'tiktok') {
    return {
      badgeClass: 'bg-[#EE1D52]/15 text-[#EE1D52] border-[#EE1D52]/30',
      icon: 'ri-tiktok-fill',
      dotClass: 'bg-[#EE1D52]',
    };
  }
  if (lower.includes('google') || lower.includes('youtube')) {
    return {
      badgeClass: 'bg-red-500/15 text-red-500 border-red-500/30',
      icon: 'ri-youtube-fill',
      dotClass: 'bg-red-500',
    };
  }
  if (lower.includes('twitter') || lower === 'x') {
    return {
      badgeClass: 'bg-slate-500/15 text-[var(--foreground)] border-slate-500/30',
      icon: 'ri-twitter-x-fill',
      dotClass: 'bg-slate-400',
    };
  }
  if (lower === 'pinterest') {
    return {
      badgeClass: 'bg-[#E60023]/15 text-[#E60023] border-[#E60023]/30',
      icon: 'ri-pinterest-fill',
      dotClass: 'bg-[#E60023]',
    };
  }

  // 2. Active / Ready / Success / Confirmed
  if (
    lower === 'ativa' ||
    lower === 'ativo' ||
    lower === 'confirmado' ||
    lower === 'finalizado' ||
    lower === 'concluído' ||
    lower === 'concluido' ||
    lower.includes('verificad')
  ) {
    return {
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      icon: 'ri-checkbox-circle-fill',
      dotClass: 'bg-emerald-500',
    };
  }

  // 3. Ready for use / Ready for Ads
  if (lower.includes('pront')) {
    return {
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      icon: 'ri-rocket-fill',
      dotClass: 'bg-emerald-400',
    };
  }

  // 4. Advertising / Running ads
  if (lower.includes('anunci')) {
    return {
      badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      icon: 'ri-megaphone-fill',
      dotClass: 'bg-blue-500',
    };
  }

  // 5. Warming up / Aquecimento
  if (lower.includes('aquec')) {
    return {
      badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      icon: 'ri-fire-fill',
      dotClass: 'bg-amber-500',
    };
  }

  // 6. Farm / Farming
  if (lower.includes('farm')) {
    return {
      badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
      icon: 'ri-seedling-fill',
      dotClass: 'bg-teal-400',
    };
  }

  // 7. Contingency / Contingência
  if (lower.includes('conting')) {
    return {
      badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      icon: 'ri-shield-user-fill',
      dotClass: 'bg-indigo-400',
    };
  }

  // 8. Restricted / Blocked / Disabled / Error
  if (
    lower.includes('bloque') ||
    lower.includes('restr') ||
    lower.includes('desativ') ||
    lower.includes('erro') ||
    lower.includes('falha')
  ) {
    return {
      badgeClass: 'bg-red-500/15 text-red-500 border-red-500/30',
      icon: 'ri-close-circle-fill',
      dotClass: 'bg-red-500',
    };
  }

  // 9. Analysis / Review / In Progress
  if (lower.includes('análise') || lower.includes('analise') || lower.includes('andamento')) {
    return {
      badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      icon: 'ri-search-eye-line',
      dotClass: 'bg-sky-400',
    };
  }

  // 10. Pending (SMS, Email, Verification)
  if (lower.includes('pendent')) {
    const isSms = lower.includes('sms');
    const isEmail = lower.includes('email') || lower.includes('e-mail');
    return {
      badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: isSms ? 'ri-message-3-fill' : isEmail ? 'ri-mail-fill' : 'ri-time-fill',
      dotClass: 'bg-amber-400',
    };
  }

  // 11. Paused
  if (lower.includes('pausad')) {
    return {
      badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
      icon: 'ri-pause-circle-fill',
      dotClass: 'bg-slate-400',
    };
  }

  // 12. Farm Stage: Criação / Importação
  if (lower.includes('criaç') || lower.includes('criac') || lower.includes('import')) {
    return {
      badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
      icon: 'ri-user-add-fill',
      dotClass: 'bg-violet-400',
    };
  }

  // 13. Farm Stage: Cookies Iniciais
  if (lower.includes('cookie')) {
    return {
      badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      icon: 'ri-donut-chart-fill',
      dotClass: 'bg-cyan-400',
    };
  }

  // 14. Farm Stage: Interação Social
  if (lower.includes('social') || lower.includes('interaç') || lower.includes('interac')) {
    return {
      badgeClass: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
      icon: 'ri-heart-fill',
      dotClass: 'bg-pink-400',
    };
  }

  // 15. Farm Stage: 2FA Ativado
  if (lower.includes('2fa') || lower.includes('segurança') || lower.includes('chave')) {
    return {
      badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      icon: 'ri-shield-keyhole-fill',
      dotClass: 'bg-purple-400',
    };
  }

  // Fallback: deterministic vibrant color palette
  const FALLBACK_PALETTE = [
    { badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dotClass: 'bg-blue-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dotClass: 'bg-emerald-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dotClass: 'bg-amber-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dotClass: 'bg-purple-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dotClass: 'bg-rose-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', dotClass: 'bg-cyan-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30', dotClass: 'bg-violet-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dotClass: 'bg-orange-400', icon: 'ri-price-tag-3-fill' },
    { badgeClass: 'bg-teal-500/15 text-teal-400 border-teal-500/30', dotClass: 'bg-teal-400', icon: 'ri-price-tag-3-fill' },
  ];

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}

export const SelectCell: React.FC<SelectCellProps> = ({
  value,
  column,
  allRows,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 });

  // Collect all unique options currently present in this column across all rows + column configured options
  const uniqueOptions = useMemo(() => {
    const set = new Set<string>();

    if (column.options && Array.isArray(column.options)) {
      column.options.forEach(opt => {
        if (opt && String(opt).trim()) set.add(String(opt).trim());
      });
    }

    allRows.forEach(row => {
      const val = row.data?.[column.id];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        set.add(String(val).trim());
      }
    });

    return Array.from(set);
  }, [column.id, column.options, allRows]);

  // Filtered options based on user typing
  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter(opt => opt.toLowerCase().includes(q));
  }, [uniqueOptions, query]);

  const exactMatchExists = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return false;
    return uniqueOptions.some(opt => opt.toLowerCase() === q);
  }, [uniqueOptions, query]);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const popWidth = Math.max(rect.width, 240);

    let left = rect.left;
    if (left + popWidth > winW - 16) {
      left = winW - popWidth - 16;
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 4;
    if (top + 250 > winH - 16 && rect.top - 250 > 16) {
      top = rect.top - 254;
    }

    setPos({ top, left, width: popWidth });
  };

  const handleOpen = () => {
    updatePosition();
    setQuery('');
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => inputRef.current?.focus(), 50);

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

    const handleScroll = () => {
      updatePosition();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const selectOption = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
  };

  const createAndSelect = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (filteredOptions.length === 1 && !exactMatchExists) {
        selectOption(filteredOptions[0]);
      } else if (query.trim()) {
        createAndSelect();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const currentStr = value !== null && value !== undefined ? String(value).trim() : '';
  const currentMeta = getStatusMeta(currentStr);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        title={currentStr || 'Selecionar ou digitar opção'}
        className="w-full min-h-[30px] flex items-center justify-between px-2 text-xs rounded hover:bg-[var(--muted-bg)]/80 cursor-pointer transition-colors group select-none"
      >
        <div className="flex items-center min-w-0 pr-1">
          {currentStr ? (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${currentMeta.badgeClass} max-w-full truncate shadow-sm`}
            >
              <i className={`${currentMeta.icon} text-[11px] leading-none flex-shrink-0`} />
              <span className="truncate">{currentStr}</span>
            </span>
          ) : (
            <span className="text-[var(--muted)]/50 text-[11px] italic font-normal flex items-center gap-1">
              <span>Selecione...</span>
            </span>
          )}
        </div>
        <i className="ri-arrow-down-s-line text-[var(--muted)] text-xs opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${pos.top}px`,
              left: `${pos.left}px`,
              width: `${pos.width}px`,
            }}
            className="z-50 bg-[var(--sidebar-primary)] border border-[var(--border)] rounded-xl shadow-xl shadow-black/40 overflow-hidden flex flex-col p-1.5 animate-scale-in"
          >
            {/* Search or Create Input */}
            <div className="relative flex items-center mb-1">
              <i className="ri-search-line absolute left-2 text-[var(--muted)] text-xs pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar ou digitar novo..."
                className="w-full h-7 pl-6 pr-2 bg-[var(--card)] text-[var(--foreground)] text-xs rounded-md border border-[var(--border)] focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 placeholder:text-[var(--muted)]"
              />
            </div>

            {/* Create option button if typed text not exact match */}
            {query.trim() && !exactMatchExists && (
              <button
                type="button"
                onClick={createAndSelect}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-left font-medium text-red-500 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer mb-1 border-b border-[var(--border)]/40 pb-2"
              >
                <i className="ri-add-line text-xs" />
                <span className="truncate">
                  Criar &ldquo;<strong>{query.trim()}</strong>&rdquo;
                </span>
              </button>
            )}

            {/* List of existing options */}
            <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
              {filteredOptions.length > 0 ? (
                filteredOptions.map(opt => {
                  const isSelected = opt === currentStr;
                  const optMeta = getStatusMeta(opt);

                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => selectOption(opt)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 text-xs text-left rounded-md transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-red-500/10 text-red-500 font-semibold'
                          : 'text-[var(--foreground)] hover:bg-[var(--muted-bg)]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${optMeta.badgeClass}`}>
                          <i className={`${optMeta.icon} text-[10.5px] leading-none`} />
                        </span>
                        <span className="truncate">{opt}</span>
                      </span>
                      {isSelected && <i className="ri-check-line text-xs text-red-500 ml-1 flex-shrink-0" />}
                    </button>
                  );
                })
              ) : (
                <div className="py-2 text-center text-[11px] text-[var(--muted)]">
                  Nenhuma opção encontrada
                </div>
              )}
            </div>

            {/* Clear option button */}
            {currentStr && (
              <div className="pt-1 mt-1 border-t border-[var(--border)]/40">
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[11px] text-[var(--muted)] hover:text-red-500 hover:bg-[var(--muted-bg)] rounded-md transition-colors cursor-pointer"
                >
                  <i className="ri-close-circle-line text-xs" />
                  <span>Limpar valor</span>
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};
