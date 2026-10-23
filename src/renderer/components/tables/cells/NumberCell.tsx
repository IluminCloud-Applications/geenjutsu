import React, { useState, useEffect, useRef } from 'react';

interface NumberCellProps {
  value: any;
  onChange: (val: number | null) => void;
}

export const NumberCell: React.FC<NumberCellProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value !== null && value !== undefined ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value !== null && value !== undefined ? String(value) : '');
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value !== null && value !== undefined) {
        onChange(null);
      }
      return;
    }
    const num = Number(trimmed);
    if (!isNaN(num) && num !== value) {
      onChange(num);
    } else if (isNaN(num)) {
      setDraft(value !== null && value !== undefined ? String(value) : '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setDraft(value !== null && value !== undefined ? String(value) : '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full h-8 px-2 bg-[var(--sidebar-primary)] text-[var(--foreground)] text-xs font-mono rounded border border-red-500/70 focus:outline-none focus:ring-1 focus:ring-red-500/30"
      />
    );
  }

  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div
      onClick={() => setIsEditing(true)}
      title={hasValue ? String(value) : 'Clique para inserir número'}
      className="w-full min-h-[30px] flex items-center px-2 text-xs font-mono rounded hover:bg-[var(--muted-bg)]/80 cursor-text transition-colors text-[var(--foreground)] truncate select-text"
    >
      {hasValue ? (
        <span className="truncate">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      ) : (
        <span className="text-[var(--muted)]/50 text-[11px] italic font-normal">—</span>
      )}
    </div>
  );
};
