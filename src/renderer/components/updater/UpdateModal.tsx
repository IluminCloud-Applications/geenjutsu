import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { UpdateCheckResult, UpdateService } from '../../services/updateService';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateData: UpdateCheckResult | null;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, updateData }) => {
  const [copied, setCopied] = useState(false);

  if (!updateData || !isOpen) return null;

  const isMac = UpdateService.getPlatform() === 'mac';
  const notes = updateData.updateInfo?.notes || [];

  const handleCopyMacCmd = async () => {
    try {
      await navigator.clipboard.writeText('sudo xattr -cr /Applications/Geenjutsu.app');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownload = () => {
    UpdateService.openDownload(updateData.downloadUrl);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Atualização Disponível"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} size="sm">
            Lembrar mais tarde
          </Button>
          <Button
            variant="primary"
            onClick={handleDownload}
            size="sm"
            icon="ri-download-cloud-2-line"
          >
            Baixar Atualização
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Hero Card */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-red-500/8 border border-red-500/15">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center text-red-500 flex-shrink-0">
            <i className="ri-sparkling-fill text-xl" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[var(--foreground)] tracking-tight">
              Uma nova versão do Geenjutsu está pronta
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="font-mono text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--muted-bg)]">
                v{updateData.currentVersion}
              </span>
              <i className="ri-arrow-right-line text-[var(--muted)] text-[11px]" />
              <span className="font-mono font-semibold text-red-500 px-1.5 py-0.5 rounded bg-red-500/10">
                v{updateData.latestVersion}
              </span>
            </div>
          </div>
        </div>

        {/* Change notes */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-[var(--muted)] tracking-wider uppercase">
            Melhorias desta versão
          </span>
          <div className="p-3 rounded-xl bg-[var(--muted-bg)]/40 border border-[var(--border)] text-xs text-[var(--foreground)] space-y-1.5">
            {notes.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-[var(--foreground)]">
                {notes.map((note, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="leading-relaxed text-[var(--muted)]">
                Melhorias contínuas de estabilidade, correções de bugs e otimizações gerais de performance implementadas.
              </p>
            )}
          </div>
        </div>

        {/* macOS Gatekeeper note */}
        {isMac && (
          <div className="p-3 rounded-xl bg-[var(--muted-bg)]/50 border border-[var(--border)] flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
              <i className="ri-apple-fill text-sm" />
              <span>Dica de instalação no macOS</span>
            </div>
            <div className="text-[11px] text-[var(--muted)] leading-relaxed">
              Caso apareça o aviso do Gatekeeper após atualizar, execute no Terminal:
            </div>
            <div className="flex items-center justify-between gap-2 p-1.5 px-2 rounded-lg bg-[var(--card)] border border-[var(--border)] font-mono text-[11px] text-[var(--foreground)]">
              <code className="truncate">sudo xattr -cr /Applications/Geenjutsu.app</code>
              <button
                type="button"
                onClick={handleCopyMacCmd}
                title="Copiar comando"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--muted-bg)] hover:bg-[var(--border)] text-xs transition-colors cursor-pointer flex-shrink-0"
              >
                <i className={copied ? 'ri-check-line text-emerald-500' : 'ri-file-copy-line'} />
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
