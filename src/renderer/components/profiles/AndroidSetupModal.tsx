import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SystemDiagnosticResult, DependencyId, DependencyItem } from '../../../types';

interface AndroidSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: (allOk: boolean) => void;
}

export const AndroidSetupModal: React.FC<AndroidSetupModalProps> = ({
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [diagnostic, setDiagnostic] = useState<SystemDiagnosticResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [installingId, setInstallingId] = useState<DependencyId | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const fetchDiagnostic = async () => {
    if (!window.geenjutsuApi?.checkAndroidDependencies) return;
    setIsChecking(true);
    try {
      const res = await window.geenjutsuApi.checkAndroidDependencies();
      setDiagnostic(res);
      if (onStatusChanged) {
        onStatusChanged(res.allOk);
      }
    } catch (e) {
      console.error('[AndroidSetupModal] Erro ao checar dependências:', e);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostic();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!window.geenjutsuApi?.onAndroidInstallLog) return;
    const unsub = window.geenjutsuApi.onAndroidInstallLog((logLine: string) => {
      setTerminalLogs(prev => [...prev.slice(-150), logLine]);
      setShowLogs(true);
    });
    return unsub;
  }, []);

  const handleAction = async (id: DependencyId): Promise<boolean> => {
    if (!window.geenjutsuApi?.installAndroidDependency || installingId !== null) return false;
    setInstallingId(id);
    setShowLogs(true);
    let success = false;

    // Auto-poll diagnostic during installation to catch completion immediately
    const pollTimer = setInterval(async () => {
      try {
        if (window.geenjutsuApi?.checkAndroidDependencies) {
          const res = await window.geenjutsuApi.checkAndroidDependencies();
          setDiagnostic(res);
          if (onStatusChanged) onStatusChanged(res.allOk);
        }
      } catch {}
    }, 2000);

    try {
      const res = await window.geenjutsuApi.installAndroidDependency(id);
      success = Boolean(res?.success);
    } catch (e: any) {
      setTerminalLogs(prev => [...prev, `[ERRO] ${e?.message || String(e)}`]);
      success = false;
    } finally {
      clearInterval(pollTimer);
      setInstallingId(null);
      await fetchDiagnostic();
    }
    return success;
  };

  const handleInstallAll = async () => {
    if (!window.geenjutsuApi?.checkAndroidDependencies || installingId !== null) return;
    setShowLogs(true);
    setTerminalLogs(prev => [...prev, '--- Iniciando instalação sequencial de dependências ---']);

    // Busca o diagnóstico mais recente
    let currentDiag = await window.geenjutsuApi.checkAndroidDependencies();
    setDiagnostic(currentDiag);

    for (const key of dependencyKeys) {
      const item = currentDiag.items ? currentDiag.items[key] : null;
      if (!item || item.status === 'ok' || !item.actionLabel) {
        continue;
      }

      // Pré-requisito: para baixar a imagem Android (redroid), o Docker precisa estar ativo
      if (key === 'redroid') {
        const isDockerReady = currentDiag.items?.docker?.status === 'ok';
        if (!isDockerReady) {
          setTerminalLogs(prev => [
            ...prev,
            '[AVISO] O Docker precisa estar instalado e em execução antes de baixar a imagem Android.',
            '[AVISO] Inicie o Docker e execute novamente para concluir o download da imagem.'
          ]);
          continue;
        }
      }

      setTerminalLogs(prev => [...prev, `[ETAPA] Configurando: ${item.name}...`]);
      const success = await handleAction(key);

      // Re-busca o diagnóstico para ter o status real atualizado após a ação
      currentDiag = await window.geenjutsuApi.checkAndroidDependencies();
      setDiagnostic(currentDiag);
      if (onStatusChanged) onStatusChanged(currentDiag.allOk);

      // No Windows, se o WSL2 acabou de ser instalado, avisa que o reboot é necessário antes do Docker
      if (key === 'wsl' && success) {
        setTerminalLogs(prev => [
          ...prev,
          '[IMPORTANTE] O WSL2 foi instalado. É necessário reiniciar o computador para o Windows concluir a ativação.'
        ]);
        break;
      }
    }

    setTerminalLogs(prev => [...prev, '--- Processo de instalação concluído ---']);
    await fetchDiagnostic();
  };

  const isAllOk = diagnostic?.allOk ?? false;
  const isWindows = diagnostic?.isWindows ?? false;
  const isLinux = diagnostic?.isLinux ?? false;

  const renderStatusBadge = (item: DependencyItem) => {
    if (item.status === 'ok') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <i className="ri-checkbox-circle-fill text-xs" />
          <span>{item.version || 'Pronto'}</span>
        </span>
      );
    }
    if (item.status === 'outdated') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
          <i className="ri-alert-fill text-xs" />
          <span>Ajuste Necessário</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
        <i className="ri-close-circle-fill text-xs" />
        <span>Não Instalado</span>
      </span>
    );
  };

  // Ordem lógica estrita de dependências:
  // 1. WSL2 (base do Docker no Windows)
  // 2. Docker Engine (runtime de containers)
  // 3. Binder (módulo de IPC)
  // 4. ADB (ferramenta de conexão)
  // 5. scrcpy (espelhamento de tela)
  // 6. Imagem Android (baixada por último após o Docker estar garantidamente pronto)
  const dependencyKeys: DependencyId[] = isWindows
    ? ['wsl', 'docker', 'binder', 'adb', 'scrcpy', 'redroid']
    : ['docker', 'binder', 'adb', 'scrcpy', 'redroid'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Requisitos do Emulador Android"
      maxWidth="xl"
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={isChecking ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}
              disabled={isChecking || installingId !== null}
              onClick={fetchDiagnostic}
            >
              {isChecking ? 'Verificando...' : 'Verificar Novamente'}
            </Button>

            {!isAllOk && (
              <Button
                variant="primary"
                size="sm"
                icon={installingId !== null ? 'ri-loader-4-line animate-spin' : 'ri-download-cloud-line'}
                disabled={isChecking || installingId !== null}
                onClick={handleInstallAll}
                className="text-xs"
              >
                {installingId !== null ? 'Instalando...' : 'Instalar Todas Pendentes'}
              </Button>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            {isAllOk ? 'Pronto' : 'Fechar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs select-none">
        {/* Environment Alert */}
        {isWindows ? (
          <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/20 text-[var(--foreground)] space-y-1">
            <div className="flex items-center gap-2 font-semibold text-blue-400">
              <i className="ri-windows-fill text-base" />
              <span>Ambiente Windows (Requer WSL2)</span>
            </div>
            <p className="text-[11.5px] text-[var(--muted-fg)] leading-relaxed">
              O emulador Android roda containers nativos através do <strong>WSL2</strong> (Subsistema do Windows para Linux).
              Caso ainda não tenha o WSL2 ativo, basta clicar em <strong>Instalar WSL2</strong> abaixo.
            </p>
          </div>
        ) : isLinux ? (
          <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-[var(--foreground)] space-y-1">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <i className="ri-ubuntu-fill text-base" />
              <span>Ambiente Linux Nativo Detectado</span>
            </div>
            <p className="text-[11.5px] text-[var(--muted-fg)] leading-relaxed">
              Desempenho máximo: o Redroid tem acesso direto aos módulos do kernel e aceleração sem camadas de virtualização.
            </p>
          </div>
        ) : null}

        {/* Success Banner if All OK */}
        {isAllOk && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-emerald-400">
            <i className="ri-checkbox-circle-fill text-lg flex-shrink-0" />
            <div className="text-[12px] font-semibold">
              Todas as dependências estão configuradas! O modo Android está liberado.
            </div>
          </div>
        )}

        {/* List of Dependencies */}
        <div className="space-y-2">
          {dependencyKeys.map(depKey => {
            const item = diagnostic?.items ? diagnostic.items[depKey] : null;
            if (!item) return null;
            const isItemBusy = installingId === depKey;

            return (
              <div
                key={depKey}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--muted-bg)]/50 border border-[var(--border)] hover:border-[var(--border-hover)] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-sm flex-shrink-0 text-[var(--foreground)]">
                    {depKey === 'wsl' && <i className="ri-windows-line text-blue-400" />}
                    {depKey === 'docker' && <i className="ri-instance-line text-sky-400" />}
                    {depKey === 'binder' && <i className="ri-cpu-line text-amber-400" />}
                    {depKey === 'redroid' && <i className="ri-android-line text-emerald-400" />}
                    {depKey === 'adb' && <i className="ri-terminal-box-line text-slate-300" />}
                    {depKey === 'scrcpy' && <i className="ri-mac-line text-purple-400" />}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[var(--foreground)] truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--muted)] truncate">
                      {item.description}
                    </span>
                    {item.error && (
                      <span className="text-[10px] text-red-400 mt-0.5">
                        {item.error}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {renderStatusBadge(item)}

                  {item.status !== 'ok' && item.actionLabel && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isItemBusy || installingId !== null}
                      onClick={() => handleAction(depKey)}
                      icon={isItemBusy ? 'ri-loader-4-line animate-spin' : 'ri-tools-line'}
                      className="text-xs px-2.5 py-1"
                    >
                      {isItemBusy ? 'Configurando...' : item.actionLabel}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Terminal Execution Logs */}
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)]">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-[var(--muted-fg)] hover:text-[var(--foreground)] bg-[var(--muted-bg)]/40 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <i className="ri-terminal-line text-[var(--foreground)]" />
              <span>Log de Instalação</span>
              {terminalLogs.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--card)] text-[var(--muted)] border border-[var(--border)]">
                  {terminalLogs.length} linhas
                </span>
              )}
            </div>
            <i className={clsx('ri-arrow-down-s-line text-sm transition-transform', showLogs && 'rotate-180')} />
          </button>

          {showLogs && (
            <div className="p-3 max-h-36 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1 bg-black/60">
              {terminalLogs.length === 0 ? (
                <span className="text-slate-500 italic">Nenhum comando executado até o momento.</span>
              ) : (
                terminalLogs.map((log, i) => (
                  <div key={i} className="leading-tight whitespace-pre-wrap">
                    {log}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
