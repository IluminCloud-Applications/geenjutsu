import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { clsx } from 'clsx';
import { Profile } from '../../types';
import { extractVariables, substituteVariables } from '../../utils/automationVariables';

export const RunAutomationModal: React.FC = () => {
  const {
    runningAutomation,
    setRunningAutomation,
    profiles,
    runAutomationOnProfile,
    stopAutomation,
    automationRunState,
    setAutomationRunState,
  } = useProfiles();
  const { t } = useI18n();

  const [search, setSearch] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleCopyLogs = async () => {
    if (!automationRunState) return;

    const logLines = (automationRunState.logs || []).map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `[${time}] [${log.type.toUpperCase()}] ${log.message}`;
    });

    if (
      automationRunState.error &&
      !automationRunState.logs.some(l => l.message?.includes(automationRunState.error!))
    ) {
      logLines.push(`[ERRO]: ${automationRunState.error}`);
    }

    const textToCopy = logLines.length > 0
      ? logLines.join('\n')
      : (automationRunState.error || 'Nenhum log registrado.');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar logs:', err);
    }
  };

  // Extract variables from the automation code
  const variables = useMemo(
    () => extractVariables(runningAutomation?.code || ''),
    [runningAutomation?.code]
  );

  useEffect(() => {
    if (runningAutomation) {
      if (
        automationRunState &&
        automationRunState.automationId === runningAutomation.id &&
        automationRunState.status !== 'running' &&
        automationRunState.status !== 'launching_browser'
      ) {
        setAutomationRunState(null);
      }
      const vars = extractVariables(runningAutomation.code);
      const initVals: Record<string, string> = {};
      vars.forEach(v => {
        initVals[v] = '';
      });
      setVariableValues(initVals);
    }
  }, [runningAutomation?.id]);

  const hasEmptyVariables = variables.some(v => !variableValues[v]?.trim());

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (automationRunState?.logs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [automationRunState?.logs]);

  useEffect(() => {
    if (automationRunState) {
      if (
        automationRunState.status === 'success' ||
        automationRunState.status === 'failed' ||
        automationRunState.status === 'stopped'
      ) {
        setIsExecuting(false);
      } else {
        setIsExecuting(true);
      }
    }
  }, [automationRunState?.status]);

  if (!runningAutomation) return null;

  // Active profiles first
  const nonTrashProfiles = profiles.filter(p => !p.isTrash);
  const activeProfiles = nonTrashProfiles.filter(p => p.status === 'running');
  const inactiveProfiles = nonTrashProfiles.filter(p => p.status !== 'running');

  const filterBySearch = (list: Profile[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(p => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchProxy = p.proxy?.host?.toLowerCase().includes(q) || false;
      const matchTags = (p.tags || []).some(t => t.toLowerCase().includes(q));
      return matchName || matchProxy || matchTags;
    });
  };

  const filteredActive = filterBySearch(activeProfiles);
  const filteredInactive = filterBySearch(inactiveProfiles);

  const handleStartRun = async (profileId: string) => {
    if (hasEmptyVariables) return;

    const finalCode = variables.length > 0
      ? substituteVariables(runningAutomation.code, variableValues)
      : runningAutomation.code;

    setSelectedProfileId(profileId);
    setIsExecuting(true);
    setAutomationRunState({
      automationId: runningAutomation.id,
      profileId,
      profileName: profiles.find(p => p.id === profileId)?.name || 'Perfil',
      status: 'launching_browser',
      startedAt: Date.now(),
      durationMs: 0,
      logs: [
        {
          timestamp: Date.now(),
          type: 'info',
          message: `Iniciando automação "${runningAutomation.name}"...`,
        },
      ],
    });

    const res = await runAutomationOnProfile(runningAutomation.id, profileId, finalCode);
    if (!res.success) {
      setIsExecuting(false);
      setAutomationRunState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'failed',
          error: res.error || 'Falha ao iniciar automação.',
          logs: [
            ...prev.logs,
            {
              timestamp: Date.now(),
              type: 'error',
              message: res.error || 'Falha ao iniciar automação.',
            },
          ],
        };
      });
    }
  };

  const handleClose = () => {
    if (automationRunState?.status !== 'running' && automationRunState?.status !== 'launching_browser') {
      setAutomationRunState(null);
    }
    setRunningAutomation(null);
    setSelectedProfileId(null);
    setIsExecuting(false);
    setSearch('');
    setCopiedLogs(false);
  };

  const isConsoleView = Boolean(automationRunState && automationRunState.automationId === runningAutomation.id);

  return (
    <Modal
      isOpen={Boolean(runningAutomation)}
      onClose={handleClose}
      title={isConsoleView ? t.automationsPage.runningLogsTitle : t.automationsPage.selectBrowser}
      maxWidth={isConsoleView ? 'xl' : 'lg'}
      footer={
        <div className="flex items-center justify-between w-full">
          {isConsoleView ? (
            <div className="flex items-center gap-2">
              {automationRunState?.status === 'running' || automationRunState?.status === 'launching_browser' ? (
                <div className="flex items-center gap-2 text-xs text-amber-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>
                    {automationRunState?.status === 'launching_browser'
                      ? 'Iniciando navegador...'
                      : 'Executando script Playwright...'}
                  </span>
                </div>
              ) : automationRunState?.status === 'success' ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold">
                  <i className="ri-checkbox-circle-fill text-sm" />
                  <span>Concluído com sucesso</span>
                </div>
              ) : automationRunState?.status === 'stopped' ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-500 font-semibold">
                  <i className="ri-stop-circle-fill text-sm" />
                  <span>{t.automationsPage.statusStopped}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                  <i className="ri-error-warning-fill text-sm" />
                  <span>Erro na execução</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-[var(--muted)]">
              {nonTrashProfiles.length} perfis disponíveis
            </span>
          )}

          <div className="flex items-center gap-2">
            {isConsoleView && isExecuting && (
              <Button
                variant="stop"
                size="sm"
                icon="ri-stop-fill"
                onClick={() => stopAutomation(runningAutomation.id)}
              >
                {t.actions.stop || 'Parar'}
              </Button>
            )}
            {isConsoleView && !isExecuting && (
              <>
                {automationRunState?.status === 'failed' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copiedLogs ? 'ri-check-line text-emerald-500' : 'ri-file-copy-line'}
                    onClick={handleCopyLogs}
                  >
                    {copiedLogs ? (t.automationsPage.copiedLogs || 'Copiado!') : (t.automationsPage.copyLogs || 'Copiar logs')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAutomationRunState(null);
                    setSelectedProfileId(null);
                    setIsExecuting(false);
                    setCopiedLogs(false);
                  }}
                >
                  {t.automationsPage.switchProfile || 'Trocar Perfil'}
                </Button>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={handleClose}>
              {t.actions.close}
            </Button>
          </div>
        </div>
      }
    >
      {automationRunState && automationRunState.automationId === runningAutomation.id ? (
        /* Real-time Logs Console View */
        <div className="space-y-3">
          {/* Status Header Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-mono text-xs">
                <i className="ri-terminal-box-line text-base" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--foreground)] truncate max-w-[280px]">
                  {runningAutomation.name}
                </div>
                <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5">
                  <i className="ri-global-line text-[11px]" />
                  <span>{automationRunState.profileName}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-[var(--muted)] block font-medium">Status</span>
              <span
                className={clsx(
                  'text-xs font-semibold font-mono',
                  automationRunState.status === 'success' && 'text-emerald-500',
                  automationRunState.status === 'failed' && 'text-red-500',
                  automationRunState.status === 'stopped' && 'text-amber-500',
                  (automationRunState.status === 'running' || automationRunState.status === 'launching_browser') &&
                    'text-amber-500 animate-pulse'
                )}
              >
                {automationRunState.status === 'launching_browser' && 'Abrindo navegador...'}
                {automationRunState.status === 'running' && 'Executando...'}
                {automationRunState.status === 'success' && t.automationsPage.statusSuccess}
                {automationRunState.status === 'stopped' && t.automationsPage.statusStopped}
                {automationRunState.status === 'failed' && t.automationsPage.statusFailed}
              </span>
            </div>
          </div>

          {/* Terminal Logs Output */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] p-3.5 h-64 overflow-y-auto font-mono text-[11px] space-y-1.5">
            {automationRunState.logs.length === 0 ? (
              <div className="text-[var(--muted)] italic text-center py-10">
                {t.automationsPage.logsEmpty}
              </div>
            ) : (
              automationRunState.logs.map((log, i) => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <div key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-[var(--muted)] opacity-60 text-[10px] flex-shrink-0 select-none">
                      [{time}]
                    </span>
                    <span
                      className={clsx(
                        'break-all',
                        log.type === 'error' && 'text-red-400 font-semibold',
                        log.type === 'warn' && 'text-amber-400',
                        log.type === 'success' && 'text-emerald-400 font-semibold',
                        log.type === 'info' && 'text-[var(--foreground)]'
                      )}
                    >
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      ) : (

        /* Profile Selection View */
        <div className="space-y-4">
          {/* Dynamic Script Variables */}
          {variables.length > 0 && (
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                  <i className="ri-input-cursor-move text-red-500" />
                  <span>Variáveis da Automação ({variables.length})</span>
                </div>
                {hasEmptyVariables ? (
                  <span className="text-[10.5px] text-amber-500 font-medium">
                    Preencha os campos para liberar a execução
                  </span>
                ) : (
                  <span className="text-[10.5px] text-emerald-500 font-medium flex items-center gap-1">
                    <i className="ri-check-line text-xs" />
                    Valores preenchidos
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2.5 w-full">
                {variables.map(varKey => (
                  <Input
                    key={varKey}
                    label={varKey}
                    value={variableValues[varKey] || ''}
                    onChange={e =>
                      setVariableValues(prev => ({ ...prev, [varKey]: e.target.value }))
                    }
                    placeholder={`Valor para {{${varKey}}}...`}
                    className="w-full"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] text-xs pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.automationsPage.searchProfilePlaceholder}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-[var(--border)] bg-[var(--sidebar-primary)] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-red-500/50"
              autoFocus={variables.length === 0}
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-3 pr-0.5">
            {/* Open Profiles First */}
            {filteredActive.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-1 pb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10.5px] font-semibold text-emerald-500 uppercase tracking-wider">
                    {t.automationsPage.openBrowsers} ({filteredActive.length})
                  </span>
                </div>

                <div className="space-y-1">
                  {filteredActive.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleStartRun(p.id)}
                      disabled={isExecuting || hasEmptyVariables}
                      className={clsx(
                        "w-full flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-left group",
                        (isExecuting || hasEmptyVariables) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                          <i className="ri-global-line text-sm" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-[var(--foreground)] truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-[var(--muted)] truncate">
                            {p.proxy?.host ? `Proxy: ${p.proxy.host}` : 'Sem proxy'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasEmptyVariables ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 font-medium">
                            Preencha as variáveis
                          </span>
                        ) : (
                          <>
                            <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 font-medium">
                              Executar na hora
                            </span>
                            <i className="ri-play-fill text-emerald-500 text-sm group-hover:scale-110 transition-transform" />
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Profiles Below */}
            {filteredInactive.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-1 pb-1.5 pt-1">
                  <span className="text-[10.5px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                    {t.automationsPage.closedBrowsers} ({filteredInactive.length})
                  </span>
                </div>

                <div className="space-y-1">
                  {filteredInactive.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleStartRun(p.id)}
                      disabled={isExecuting || hasEmptyVariables}
                      className={clsx(
                        "w-full flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/30 hover:bg-[var(--sidebar-secondary)] transition-all text-left group",
                        (isExecuting || hasEmptyVariables) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-lg bg-[var(--muted-bg)] text-[var(--muted)] flex items-center justify-center flex-shrink-0">
                          <i className="ri-global-line text-sm" />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-[var(--foreground)] truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-[var(--muted)] truncate">
                            {p.proxy?.host ? `Proxy: ${p.proxy.host}` : 'Sem proxy'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasEmptyVariables ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500 font-medium">
                            Preencha as variáveis
                          </span>
                        ) : (
                          <>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--muted-bg)] text-[var(--muted)] font-medium">
                              Abrirá navegador
                            </span>
                            <i className="ri-play-fill text-[var(--muted)] group-hover:text-red-500 text-sm transition-colors" />
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredActive.length === 0 && filteredInactive.length === 0 && (
              <div className="py-8 text-center text-xs text-[var(--muted)]">
                Nenhum perfil encontrado com esse termo.
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
