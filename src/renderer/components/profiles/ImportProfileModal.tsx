import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { clsx } from 'clsx';

export const ImportProfileModal: React.FC = () => {
  const {
    isImportProfileModalOpen,
    setIsImportProfileModalOpen,
    profiles,
    folders,
    importFullProfile,
  } = useProfiles();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateAndParse = (content: string, name?: string) => {
    try {
      setError(null);
      setSuccess(false);
      const json = JSON.parse(content);
      const profile = json.profile || json;

      if (!profile || !profile.name || typeof profile.name !== 'string') {
        setError(t.importProfileModal?.invalidJson || 'O arquivo JSON não contém um perfil válido do Geenjutsu.');
        setParsedData(null);
        return;
      }

      setParsedData(profile);
      if (name) setFileName(name);

      // Check for duplicate profile name
      const duplicateExists = profiles.some(
        p => !p.isTrash && p.name.trim().toLowerCase() === profile.name.trim().toLowerCase()
      );
      setIsDuplicate(duplicateExists);
      setConfirmDuplicate(false);
    } catch {
      setError(t.importProfileModal?.invalidJson || 'Arquivo JSON inválido.');
      setParsedData(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      validateAndParse(event.target?.result as string, file.name);
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
        validateAndParse(event.target?.result as string, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = () => {
    if (!parsedData) return;
    if (isDuplicate && !confirmDuplicate) {
      setError('Confirme a importação do perfil duplicado para prosseguir.');
      return;
    }

    const res = importFullProfile({ profile: parsedData });
    if (!res.success) {
      setError(res.error || 'Erro ao importar perfil');
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      handleClose();
    }, 600);
  };

  const handleClose = () => {
    setFileName('');
    setParsedData(null);
    setError(null);
    setIsDuplicate(false);
    setConfirmDuplicate(false);
    setSuccess(false);
    setIsImportProfileModalOpen(false);
  };

  const targetFolderName =
    parsedData?.folder?.name ||
    (typeof parsedData?.folder === 'string'
      ? folders.find(f => f.id === parsedData.folder)?.name || parsedData.folder
      : 'Pasta Padrão');

  const willCreateFolder =
    targetFolderName &&
    !folders.some(f => f.name.toLowerCase() === targetFolderName.toLowerCase() || f.id === targetFolderName);

  return (
    <Modal
      isOpen={isImportProfileModalOpen}
      onClose={handleClose}
      title={t.importProfileModal?.title || 'Importar Perfil'}
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
            disabled={!parsedData || (isDuplicate && !confirmDuplicate)}
            className="gap-1.5"
          >
            <i className="ri-upload-2-line" />
            <span>{t.importProfileModal?.importBtn || 'Importar'}</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted)]">
          {t.importProfileModal?.instruction || 'Selecione ou arraste o arquivo JSON do perfil exportado do Geenjutsu.'}
        </p>

        {/* Dropzone */}
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
              : parsedData
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
              'w-10 h-10 rounded-xl flex items-center justify-center text-xl',
              parsedData
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-[var(--card)] text-[var(--muted)] border border-[var(--border)]'
            )}
          >
            <i className={parsedData ? 'ri-checkbox-circle-line' : 'ri-file-upload-line'} />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-[var(--foreground)]">
              {fileName ? fileName : t.importProfileModal?.dragDropText || 'Arraste o arquivo .json ou clique para selecionar'}
            </p>
            <p className="text-[10.5px] text-[var(--muted)]">
              Formato JSON completo com proxy, tags, cookies e configurações
            </p>
          </div>
        </div>

        {/* Preview of Parsed Profile */}
        {parsedData && (
          <div className="p-3.5 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                Configuração Detectada
              </span>
              <span className="text-[10.5px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Pronto para importar
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[var(--muted)] block text-[10.5px]">Nome:</span>
                <span className="font-semibold text-[var(--foreground)] truncate block">
                  {parsedData.name}
                </span>
              </div>

              <div>
                <span className="text-[var(--muted)] block text-[10.5px]">Plataforma / SO:</span>
                <span className="font-medium text-[var(--foreground)] capitalize">
                  {parsedData.platform || 'general'} · {parsedData.os || 'mac'}
                </span>
              </div>

              <div>
                <span className="text-[var(--muted)] block text-[10.5px]">Pasta:</span>
                <span className="font-medium text-[var(--foreground)]">
                  {targetFolderName}
                  {willCreateFolder && (
                    <span className="text-[10px] text-amber-500 block font-normal">
                      (criará nova pasta)
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[var(--muted)] block text-[10.5px]">Proxy:</span>
                <span className="font-medium text-[var(--foreground)] truncate block font-mono text-[11px]">
                  {parsedData.proxy?.host ? `${parsedData.proxy.host}:${parsedData.proxy.port || '8080'}` : 'Direto'}
                </span>
              </div>
            </div>

            {/* Tags */}
            {parsedData.tags && parsedData.tags.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-[var(--border)]/60">
                <span className="text-[10.5px] text-[var(--muted)] block">Tags:</span>
                <div className="flex flex-wrap gap-1">
                  {parsedData.tags.map((tg: string) => (
                    <Badge key={tg} label={tg} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Duplicate Warning */}
        {isDuplicate && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 space-y-2">
            <div className="flex items-start gap-2 text-xs font-semibold">
              <i className="ri-alert-line text-sm mt-0.5 flex-shrink-0" />
              <span>
                {t.importProfileModal?.duplicateWarning?.replace('{name}', parsedData?.name || '') ||
                  `Atenção: Já existe um perfil com o nome "${parsedData?.name}". Deseja importar mesmo assim?`}
              </span>
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--foreground)] cursor-pointer select-none pl-6 font-medium">
              <input
                type="checkbox"
                checked={confirmDuplicate}
                onChange={e => setConfirmDuplicate(e.target.checked)}
                className="w-4 h-4 rounded border-amber-500/50 text-amber-500 focus:ring-amber-500/20"
              />
              <span>{t.importProfileModal?.importAnyway || 'Importar mesmo assim'}</span>
            </label>
          </div>
        )}

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
            <span>{t.importProfileModal?.successMsg || 'Perfil importado com sucesso!'}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
