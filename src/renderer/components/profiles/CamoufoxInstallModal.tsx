import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { CamoufoxInstallProgress, CamoufoxInstallStage } from '../../../types';

interface CamoufoxInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CamoufoxInstallModal: React.FC<CamoufoxInstallModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [progress, setProgress] = useState<CamoufoxInstallProgress | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setProgress(null);
      setError(null);
      setIsDone(false);
      setIsInstalling(false);
      return;
    }

    // Subscribe to progress events
    let unsub: (() => void) | undefined;
    if (window.geenjutsuApi?.onCamoufoxInstallProgress) {
      unsub = window.geenjutsuApi.onCamoufoxInstallProgress((data) => {
        setProgress(data);
        if (data.stage === 'error') {
          setError(data.error || data.message || 'Erro desconhecido');
          setIsInstalling(false);
        } else if (data.stage === 'completed') {
          setIsDone(true);
          setIsInstalling(false);
          // Wait 1.5s to let the user see the success, then close and trigger callback
          setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
          }, 1400);
        }
      });
    }

    // Start installation
    startInstall();

    return () => {
      if (unsub) unsub();
    };
  }, [isOpen]);

  const startInstall = async () => {
    if (!window.geenjutsuApi?.installCamoufox) return;
    setIsInstalling(true);
    setError(null);
    setIsDone(false);

    try {
      const res = await window.geenjutsuApi.installCamoufox();
      if (!res.success) {
        setError(res.error || 'Falha ao instalar');
        setIsInstalling(false);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro na requisição');
      setIsInstalling(false);
    }
  };

  const handleCancel = () => {
    if (window.geenjutsuApi?.cancelCamoufoxInstall) {
      window.geenjutsuApi.cancelCamoufoxInstall();
    }
    onClose();
  };

  const percent = progress?.percent ?? 0;
  const currentStage: CamoufoxInstallStage = progress?.stage ?? 'checking';

  const getStepStatus = (stepStage: 'browser' | 'permissions' | 'geoip' | 'addons') => {
    if (isDone) return 'completed';
    if (error) return 'error';

    if (stepStage === 'browser') {
      if (currentStage === 'checking' || currentStage === 'downloading_browser') return 'active';
      if (['extracting_browser', 'permissions', 'downloading_geoip', 'downloading_addons', 'completed'].includes(currentStage)) {
        return 'completed';
      }
      return 'pending';
    }

    if (stepStage === 'permissions') {
      if (currentStage === 'extracting_browser' || currentStage === 'permissions') return 'active';
      if (['downloading_geoip', 'downloading_addons', 'completed'].includes(currentStage)) return 'completed';
      return 'pending';
    }

    if (stepStage === 'geoip') {
      if (currentStage === 'downloading_geoip') return 'active';
      if (['downloading_addons', 'completed'].includes(currentStage)) return 'completed';
      return 'pending';
    }

    if (stepStage === 'addons') {
      if (currentStage === 'downloading_addons') return 'active';
      if (currentStage === 'completed') return 'completed';
      return 'pending';
    }

    return 'pending';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isInstalling ? () => {} : onClose}
      title="Motor Anti-Detect"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-[var(--muted)]">
            {isDone ? (
              <span className="text-emerald-500 font-medium flex items-center gap-1.5">
                <i className="ri-checkbox-circle-fill" /> Pronto para iniciar perfis
              </span>
            ) : error ? (
              <span className="text-red-500 font-medium">Ocorreu um erro no download</span>
            ) : (
              <span>Download oficial (~180 MB compactado)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <Button variant="primary" size="sm" onClick={startInstall}>
                <i className="ri-refresh-line mr-1.5" /> Tentar Novamente
              </Button>
            )}
            {!isDone && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancel}
                disabled={isDone}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Header Hero Card */}
        <div className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)]">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 text-2xl flex-shrink-0">
            <i className="ri-shield-flash-line" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-[var(--foreground)] leading-tight mb-1">
              Download Automático do Navegador
            </h4>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              O Geenjutsu utiliza um motor anti-detect integrado de alta performance para isolar WebGL, Canvas, Áudio e cabeçalhos contra detecção. Os binários oficiais são baixados e verificados de forma segura e única no seu computador.
            </p>
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="space-y-2 p-4 rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]/40">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--foreground)] flex items-center gap-1.5 truncate max-w-[320px]">
              {isInstalling && (
                <i className="ri-loader-4-line ri-spin text-red-500 flex-shrink-0" />
              )}
              {isDone && (
                <i className="ri-checkbox-circle-fill text-emerald-500 flex-shrink-0" />
              )}
              <span className="truncate">
                {isDone
                  ? 'Motor Anti-Detect pronto para uso!'
                  : error
                  ? error
                  : progress?.message || 'Iniciando download...'}
              </span>
            </span>
            <span className="font-mono text-xs font-semibold text-[var(--foreground)] flex-shrink-0 ml-2">
              {percent}%
            </span>
          </div>

          {/* Bar track */}
          <div className="w-full h-2.5 rounded-full bg-[var(--border)] overflow-hidden relative">
            <div
              className={clsx(
                'h-full transition-all duration-300 rounded-full',
                isDone
                  ? 'bg-emerald-500'
                  : error
                  ? 'bg-red-500'
                  : 'bg-gradient-to-r from-red-600 to-red-400'
              )}
              style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
            />
          </div>

          {/* Transfer stats */}
          {progress?.speed && !isDone && !error && (
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1 font-mono">
              <span>Velocidade: {progress.speed}</span>
              {progress.totalBytes ? (
                <span>
                  {(progress.downloadedBytes! / (1024 * 1024)).toFixed(1)} /{' '}
                  {(progress.totalBytes / (1024 * 1024)).toFixed(1)} MB
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Checklist Steps */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <StepItem
            label="1. Executáveis do Navegador"
            description="Firefox Camoufox Engine"
            status={getStepStatus('browser')}
          />
          <StepItem
            label="2. Permissões de Sistema"
            description="Gatekeeper & Acesso Executável"
            status={getStepStatus('permissions')}
          />
          <StepItem
            label="3. Base GeoIP de Proxies"
            description="Geolocalização MaxMind MMDB"
            status={getStepStatus('geoip')}
          />
          <StepItem
            label="4. Extensões Anti-Detect"
            description="uBlock Origin & Proteções"
            status={getStepStatus('addons')}
          />
        </div>
      </div>
    </Modal>
  );
};

interface StepItemProps {
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

const StepItem: React.FC<StepItemProps> = ({ label, description, status }) => {
  return (
    <div
      className={clsx(
        'p-2.5 rounded-lg border transition-all duration-150 flex items-center gap-2.5',
        status === 'completed' && 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500',
        status === 'active' && 'border-red-500/30 bg-red-500/5 text-red-500',
        status === 'error' && 'border-red-500/40 bg-red-500/10 text-red-500',
        status === 'pending' && 'border-[var(--border)] bg-[var(--muted-bg)]/20 text-[var(--muted)]'
      )}
    >
      <div className="text-sm flex-shrink-0">
        {status === 'completed' && <i className="ri-checkbox-circle-fill text-emerald-500" />}
        {status === 'active' && <i className="ri-loader-4-line ri-spin text-red-500" />}
        {status === 'error' && <i className="ri-error-warning-fill text-red-500" />}
        {status === 'pending' && <i className="ri-circle-line opacity-40" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[11px] truncate">{label}</div>
        <div className="text-[10px] opacity-75 truncate">{description}</div>
      </div>
    </div>
  );
};
