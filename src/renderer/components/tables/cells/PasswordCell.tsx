import React, { useState, useEffect, useRef } from 'react';

interface PasswordCellProps {
  value: any;
  onChange: (val: string) => void;
}

export const PasswordCell: React.FC<PasswordCellProps> = ({ value, onChange }) => {
  const [isMasked, setIsMasked] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [copied, setCopied] = useState(false);
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

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const strVal = String(value ?? '');
    if (!strVal) return;
    navigator.clipboard.writeText(strVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggleMask = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMasked(prev => !prev);
  };

  if (isEditing) {
    return (
      <div className="relative flex items-center w-full">
        <input
          ref={inputRef}
          type={isMasked ? 'password' : 'text'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder="Digite a senha..."
          className="w-full h-8 pl-2 pr-7 bg-[var(--sidebar-primary)] text-[var(--foreground)] text-xs font-mono rounded border border-red-500/70 focus:outline-none focus:ring-1 focus:ring-red-500/30"
        />
        <button
          type="button"
          onMouseDown={e => e.preventDefault()} // prevent blur
          onClick={() => setIsMasked(prev => !prev)}
          title={isMasked ? 'Mostrar senha' : 'Ocultar senha'}
          className="absolute right-1.5 w-5 h-5 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
        >
          <i className={isMasked ? 'ri-eye-line text-xs' : 'ri-eye-off-line text-xs'} />
        </button>
      </div>
    );
  }

  const strVal = String(value ?? '').trim();

  if (!strVal) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        title="Clique para adicionar senha"
        className="w-full min-h-[30px] flex items-center px-2 text-xs rounded hover:bg-[var(--muted-bg)]/80 cursor-text transition-colors group select-none"
      >
        <span className="text-[var(--muted)]/50 text-[11px] italic font-normal flex items-center gap-1">
          <i className="ri-lock-line text-[10px]" />
          <span>Vazio</span>
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="w-full min-h-[30px] flex items-center justify-between px-2 text-xs rounded hover:bg-[var(--muted-bg)]/80 cursor-pointer transition-colors group select-none"
      title="Clique para editar senha"
    >
      {/* Password representation */}
      <div className="flex items-center gap-1.5 min-w-0 pr-1">
        <i className="ri-lock-2-line text-xs text-[var(--muted)] flex-shrink-0" />
        {isMasked ? (
          <span className="font-mono text-sm tracking-widest text-[var(--foreground)] select-none">
            ••••••••
          </span>
        ) : (
          <span className="font-mono text-xs text-[var(--foreground)] select-text truncate max-w-[130px]">
            {strVal}
          </span>
        )}
      </div>

      {/* Action buttons (Eye toggle + Copy) */}
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {/* Toggle Eye Button */}
        <button
          type="button"
          onClick={handleToggleMask}
          title={isMasked ? 'Visualizar senha' : 'Ocultar senha'}
          className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
        >
          <i className={isMasked ? 'ri-eye-line text-xs' : 'ri-eye-off-line text-xs'} />
        </button>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? 'Senha copiada!' : 'Copiar senha'}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
            copied
              ? 'text-emerald-500 bg-emerald-500/10'
              : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]'
          }`}
        >
          <i className={copied ? 'ri-check-line text-xs' : 'ri-file-copy-line text-xs'} />
        </button>
      </div>
    </div>
  );
};
