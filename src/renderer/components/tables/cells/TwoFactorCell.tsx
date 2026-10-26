import React, { useState, useEffect, useRef } from 'react';
import { generateTotp, cleanSecret, formatSecret, TotpResult } from '../../../utils/totp';

interface TwoFactorCellProps {
  value: any;
  onChange: (val: string) => void;
}

export const TwoFactorCell: React.FC<TwoFactorCellProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [totpResult, setTotpResult] = useState<TotpResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? '');
    setTotpResult(null);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  // Timer to count down remainingSeconds and auto-refresh when window expires
  useEffect(() => {
    if (!totpResult || !value) return;

    const interval = setInterval(() => {
      const latest = generateTotp(String(value));
      setTotpResult(latest);
    }, 1000);

    return () => clearInterval(interval);
  }, [totpResult?.token, value]);

  const commit = () => {
    setIsEditing(false);
    const cleaned = cleanSecret(draft);
    if (cleaned !== cleanSecret(value ?? '')) {
      onChange(cleaned);
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

  const handleObtainCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    const strVal = String(value ?? '').trim();
    if (!strVal) return;

    const result = generateTotp(strVal);
    setTotpResult(result);

    if (result.token) {
      navigator.clipboard.writeText(result.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleCopyToken = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!totpResult?.token) return;
    navigator.clipboard.writeText(totpResult.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopySecret = (e: React.MouseEvent) => {
    e.stopPropagation();
    const strVal = String(value ?? '').trim();
    if (!strVal) return;
    navigator.clipboard.writeText(cleanSecret(strVal));
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 1500);
  };

  if (isEditing) {
    return (
      <div className="relative flex items-center w-full" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder="Cole a chave 2FA (ex: JBSW Y3DP...)"
          className="w-full h-8 pl-2 pr-7 bg-[var(--sidebar-primary)] text-[var(--foreground)] text-xs font-mono rounded border border-red-500/70 focus:outline-none focus:ring-1 focus:ring-red-500/30"
        />
        <button
          type="button"
          onMouseDown={e => {
            e.preventDefault();
            commit();
          }}
          title="Salvar"
          className="absolute right-1.5 w-5 h-5 flex items-center justify-center text-emerald-400 hover:text-emerald-300 cursor-pointer"
        >
          <i className="ri-check-line text-xs" />
        </button>
      </div>
    );
  }

  const strVal = String(value ?? '').trim();

  if (!strVal) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        title="Clique para adicionar a chave 2FA"
        className="w-full min-h-[30px] flex items-center px-2 text-xs rounded hover:bg-[var(--muted-bg)]/80 cursor-text transition-colors group select-none"
      >
        <span className="text-[var(--muted)]/60 text-[11px] font-normal flex items-center gap-1.5 group-hover:text-red-500 transition-colors">
          <i className="ri-shield-keyhole-line text-xs" />
          <span>+ Chave 2FA</span>
        </span>
      </div>
    );
  }

  const formattedSecretKey = formatSecret(strVal);

  return (
    <div
      onDoubleClick={() => setIsEditing(true)}
      className="w-full min-h-[30px] flex items-center justify-between gap-1.5 px-2 text-xs rounded hover:bg-[var(--muted-bg)]/50 transition-colors select-none group"
    >
      {/* 2FA Generated Code Display */}
      {totpResult ? (
        totpResult.error ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-amber-500 text-[11px] font-medium flex items-center gap-1">
              <i className="ri-alert-line text-xs" />
              <span>Chave inválida</span>
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] underline cursor-pointer"
            >
              corrigir
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleCopyToken}
              title="Clique para copiar o código de 6 dígitos"
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer shadow-xs ${
                copiedToken
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-500/15 text-red-500 hover:bg-red-500/25 border border-red-500/30'
              }`}
            >
              {copiedToken ? (
                <>
                  <i className="ri-check-line text-xs" />
                  <span className="text-[11px]">Copiado!</span>
                </>
              ) : (
                <>
                  <i className="ri-shield-keyhole-fill text-xs" />
                  <span className="tracking-wider">{totpResult.formattedToken}</span>
                  <span className="text-[10px] opacity-75 font-normal ml-0.5">
                    {totpResult.remainingSeconds}s
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setTotpResult(null);
              }}
              title="Ocultar código"
              className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-opacity cursor-pointer"
            >
              <i className="ri-close-line text-xs" />
            </button>
          </div>
        )
      ) : (
        /* Secret key preview */
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <i className="ri-shield-keyhole-line text-xs text-[var(--muted)] flex-shrink-0" />
          <span
            className="font-mono text-[11px] text-[var(--muted)] truncate max-w-[100px]"
            title={`Chave: ${formattedSecretKey} (dois cliques para editar)`}
          >
            {formattedSecretKey.length > 12
              ? `${formattedSecretKey.slice(0, 4)}...${formattedSecretKey.slice(-4)}`
              : formattedSecretKey}
          </span>

          {/* Quick copy secret button */}
          <button
            type="button"
            onClick={handleCopySecret}
            title={copiedSecret ? 'Chave copiada!' : 'Copiar chave 2FA completa'}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--muted)] hover:text-[var(--foreground)] transition-opacity cursor-pointer flex-shrink-0"
          >
            <i className={copiedSecret ? 'ri-check-line text-emerald-400 text-xs' : 'ri-file-copy-line text-[11px]'} />
          </button>
        </div>
      )}

      {/* Button to Obtain / Generate 6 digits */}
      {!totpResult && (
        <button
          type="button"
          onClick={handleObtainCode}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 transition-all cursor-pointer shadow-xs flex-shrink-0"
          title="Obter e copiar código de 6 dígitos"
        >
          <i className="ri-key-2-line text-xs" />
          <span>Obter</span>
        </button>
      )}

      {/* Edit button */}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        title="Editar chave 2FA"
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--muted)] hover:text-red-500 transition-opacity cursor-pointer flex-shrink-0"
      >
        <i className="ri-edit-line text-[11px]" />
      </button>
    </div>
  );
};
