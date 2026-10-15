import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Profile, CookieItem } from '../../../types';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { clsx } from 'clsx';

interface ImportCookiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
}

export const ImportCookiesModal: React.FC<ImportCookiesModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const { updateProfile } = useProfiles();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedCookies, setParsedCookies] = useState<CookieItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!profile) return null;

  const parseNetscapeCookies = (text: string): CookieItem[] => {
    const lines = text.split('\n');
    const result: CookieItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        result.push({
          domain: parts[0],
          path: parts[2] || '/',
          secure: parts[3]?.toUpperCase() === 'TRUE',
          expirationDate: parseInt(parts[4], 10) || undefined,
          name: parts[5],
          value: parts[6],
        });
      }
    }
    return result;
  };

  const validateAndParse = (raw: string, name?: string) => {
    try {
      setError(null);
      setSuccess(false);

      let cookiesArray: CookieItem[] | null = null;

      // 1. Try parsing JSON
      try {
        const parsed = JSON.parse(raw);
        cookiesArray = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.cookies)
          ? parsed.cookies
          : null;
      } catch {
        // 2. Try Netscape format
        const netscape = parseNetscapeCookies(raw);
        if (netscape.length > 0) {
          cookiesArray = netscape;
        }
      }

      if (!cookiesArray || cookiesArray.length === 0) {
        setError(t.importCookiesModal?.invalidJson || 'O arquivo ou texto precisa conter cookies válidos (JSON ou Netscape).');
        setParsedCookies(null);
        return;
      }

      setParsedCookies(cookiesArray);
      if (name) setFileName(name);
    } catch {
      setError(t.importCookiesModal?.invalidJson || 'Formato de cookies inválido.');
      setParsedCookies(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setJsonText(content);
      validateAndParse(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        const content = event.target?.result as string;
        setJsonText(content);
        validateAndParse(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonText(val);
    if (val.trim()) {
      validateAndParse(val);
    } else {
      setParsedCookies(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!parsedCookies || parsedCookies.length === 0) return;

    // 1. Update in local react context
    updateProfile({
      id: profile.id,
      cookies: parsedCookies,
    });

    // 2. Apply directly to browser via IPC (active or backup)
    if (window.geenjutsuApi?.injectCookies) {
      try {
        await window.geenjutsuApi.injectCookies(profile.id, parsedCookies);
      } catch (err) {
        console.error('[Geenjutsu] Erro ao injetar cookies via IPC:', err);
      }
    }

    setSuccess(true);
    setTimeout(() => {
      handleClose();
    }, 600);
  };

  const handleClose = () => {
    setJsonText('');
    setFileName('');
    setParsedCookies(null);
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t.importCookiesModal?.title || 'Importar Cookies'}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={!parsedCookies || parsedCookies.length === 0}
            className="gap-1.5"
          >
            <i className="ri-upload-2-line" />
            <span>{t.importCookiesModal?.importBtn || 'Importar'}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Profile info pill */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--sidebar-primary)] border border-[var(--border)] text-xs text-[var(--foreground)]">
          <i className="ri-user-3-line text-[var(--muted)] text-xs" />
          <span className="text-[var(--muted)]">{t.table.profileName}:</span>
          <span className="font-semibold truncate">{profile.name}</span>
        </div>

        {/* File Drag and Drop zone */}
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-center select-none',
            isDragging
              ? 'border-red-500 bg-red-500/5'
              : parsedCookies
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-[var(--border)] bg-[var(--muted-bg)]/40 hover:border-red-500/50 hover:bg-[var(--sidebar-primary)]'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            className={clsx(
              'w-9 h-9 rounded-xl flex items-center justify-center text-lg',
              parsedCookies
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-[var(--card)] text-[var(--muted)] border border-[var(--border)]'
            )}
          >
            <i className={parsedCookies ? 'ri-checkbox-circle-line' : 'ri-upload-cloud-2-line'} />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {fileName ? fileName : t.importCookiesModal?.dragDropText || 'Arraste o arquivo .json ou clique para selecionar'}
            </p>
            {parsedCookies ? (
              <p className="text-[11px] text-emerald-500 font-medium">
                {parsedCookies.length} cookies identificados com sucesso
              </p>
            ) : (
              <p className="text-[10.5px] text-[var(--muted)]">Suporta formatos JSON padrão de extensões e navegadores</p>
            )}
          </div>
        </div>

        {/* Direct Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.importCookiesModal?.pasteJsonText || 'Ou cole o JSON dos cookies diretamente:'}
          </label>
          <textarea
            rows={3}
            value={jsonText}
            onChange={handleTextChange}
            placeholder='[ { "name": "c_user", "value": "...", "domain": ".facebook.com" } ]'
            className="w-full bg-[var(--muted-bg)] text-[var(--foreground)] text-[11px] font-mono rounded-lg border border-[var(--border)] px-3 py-2 transition-all duration-150 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10 placeholder:text-[var(--muted)]/50 resize-none"
          />
        </div>

        {/* Error / Success alert */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
            <i className="ri-error-warning-line text-sm flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
            <i className="ri-checkbox-circle-line text-sm flex-shrink-0" />
            <span>{t.importCookiesModal?.successMsg || 'Cookies importados com sucesso!'}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
