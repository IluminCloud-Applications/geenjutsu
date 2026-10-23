import React, { useState, useEffect, useRef } from 'react';

interface TextCellProps {
  value: any;
  onChange: (val: string) => void;
}

export const TextCell: React.FC<TextCellProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (draft !== (value ?? '')) {
      onChange(draft);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setDraft(value ?? '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full h-8 px-2 bg-[var(--sidebar-primary)] text-[var(--foreground)] text-xs rounded border border-red-500/70 focus:outline-none focus:ring-1 focus:ring-red-500/30"
      />
    );
  }

  const strVal = String(value ?? '').trim();

  return (
    <div
      onClick={() => setIsEditing(true)}
      title={strVal || 'Clique para editar'}
      className="w-full min-h-[30px] flex items-center px-2 text-xs rounded hover:bg-[var(--muted-bg)]/80 cursor-text transition-colors text-[var(--foreground)] truncate select-text"
    >
      {strVal ? (
        <span className="truncate">{strVal}</span>
      ) : (
        <span className="text-[var(--muted)]/50 text-[11px] italic font-normal">—</span>
      )}
    </div>
  );
};
