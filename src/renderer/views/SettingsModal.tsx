import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { AppIcon, BrandTextLogo } from '../components/ui/BrandLogo';
import { useProfiles } from '../context/ProfileContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { Locale, ThemeMode, CloseAction, CamoufoxStatus } from '../../types';
import { openExternalLink, SUPPORT_PROJECT_URL } from '../utils/externalLinks';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isSecurityEnabled,
    setIsSecurityModalOpen,
    closeAction,
    setCloseAction,
    updateData,
    setIsUpdateModalOpen,
    checkForUpdates,
    setIsCamoufoxInstallModalOpen,
  } = useProfiles();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);
  const [camoufoxStatus, setCamoufoxStatus] = useState<CamoufoxStatus | null>(null);
  const [isCheckingMotor, setIsCheckingMotor] = useState(false);
  const [motorFeedback, setMotorFeedback] = useState<string | null>(null);

  const checkMotorStatus = React.useCallback(async () => {
    if (!window.geenjutsuApi?.checkCamoufoxStatus) return;
    setIsCheckingMotor(true);
    try {
      const status = await window.geenjutsuApi.checkCamoufoxStatus();
      setCamoufoxStatus(status);
      if (status?.installed) {
        setMotorFeedback('OK');
      } else {
        setMotorFeedback('Ausente');
      }
      setTimeout(() => setMotorFeedback(null), 2500);
    } catch {
      setMotorFeedback('Erro');
      setTimeout(() => setMotorFeedback(null), 2500);
    } finally {
      setIsCheckingMotor(false);
    }
  }, []);

  React.useEffect(() => {
    if (isSettingsModalOpen) {
      checkMotorStatus();
    }
  }, [isSettingsModalOpen, checkMotorStatus]);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setCheckFeedback(null);
    try {
      const res = await checkForUpdates(true);
      if (res.hasUpdate) {
        setIsUpdateModalOpen(true);
      } else {
        setCheckFeedback('Versão mais recente');
        setTimeout(() => setCheckFeedback(null), 3500);
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const toggleBtn = (isActive: boolean) =>
    clsx(
      'flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all duration-150 cursor-pointer',
      isActive
        ? 'border-red-500/60 bg-red-500/8 text-red-500'
        : 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]/50'
    );

  return (
    <Modal
      isOpen={isSettingsModalOpen}
      onClose={() => setIsSettingsModalOpen(false)}
      title={t.settings.title}
      maxWidth="md"
      footer={
        <Button variant="secondary" size="sm" onClick={() => setIsSettingsModalOpen(false)}>
          {t.actions.close}
        </Button>
      }
    >
      <div className="space-y-5">
        {/* App Branding Card */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)]">
          <div className="flex items-center gap-3.5 min-w-0">
            <AppIcon sizeClass="h-10 w-auto max-w-[64px]" className="flex-shrink-0" />
            <div className="flex flex-col justify-center min-w-0">
              <BrandTextLogo heightClass="h-4" className="mb-1" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--muted)] font-mono leading-none">
                  v{updateData?.currentVersion || '1.0.1'}
                </span>
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={isCheckingUpdate}
                  className="text-[10px] text-red-500 hover:text-red-400 font-medium transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  title="Verificar atualizações no GitHub"
                >
                  <i
                    className={clsx(
                      isCheckingUpdate
                        ? 'ri-loader-4-line ri-spin'
                        : updateData?.hasUpdate
                        ? 'ri-sparkling-fill'
                        : 'ri-refresh-line',
                      'text-xs'
                    )}
                  />
                  <span>
                    {isCheckingUpdate
                      ? 'Verificando...'
                      : checkFeedback
                      ? checkFeedback
                      : updateData?.hasUpdate
                      ? 'Nova versão!'
                      : 'Verificar update'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openExternalLink('https://instagram.com/celiomaxi')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--muted-bg)] hover:bg-[var(--border)] border border-[var(--border)] text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer group flex-shrink-0"
          >
            <i className="ri-instagram-line text-xs group-hover:text-pink-500 transition-colors" />
            <span>Feito por <strong className="font-semibold text-[var(--foreground)]">@celiomaxi</strong></span>
          </button>
        </div>

        {/* Support the Project Card */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
              <i className="ri-cup-line text-base leading-none" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {t.settings.supportProject}
              </span>
              <span className="text-[11px] text-[var(--muted)] truncate">
                {t.settings.supportDesc}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openExternalLink(SUPPORT_PROJECT_URL)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-[11px] font-semibold text-amber-600 dark:text-amber-400 transition-colors cursor-pointer group flex-shrink-0"
          >
            <i className="ri-cup-line text-xs group-hover:scale-110 transition-transform" />
            <span>{t.settings.supportBtn}</span>
          </button>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.settings.language}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'pt', label: 'Português (BR)', flag: '🇧🇷' },
              { id: 'en', label: 'English (US)', flag: '🇺🇸' },
            ].map(lang => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLocale(lang.id as Locale)}
                className={toggleBtn(locale === lang.id)}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.settings.theme}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'dark', label: t.settings.dark, icon: 'ri-moon-line' },
              { id: 'light', label: t.settings.light, icon: 'ri-sun-line' },
              { id: 'system', label: t.settings.system, icon: 'ri-computer-line' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id as ThemeMode)}
                className={toggleBtn(theme === item.id)}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Close Action */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.settings.closeAction}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'ask', label: t.settings.closeActionAsk, icon: 'ri-question-line' },
              { id: 'background', label: t.settings.closeActionBackground, icon: 'ri-stack-line' },
              { id: 'quit', label: t.settings.closeActionQuit, icon: 'ri-shut-down-line' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCloseAction(item.id as CloseAction)}
                className={toggleBtn(closeAction === item.id)}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Anti-Detect Browser Engine */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              Motor Anti-Detect
            </label>
            {isCheckingMotor ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <i className="ri-loader-4-line animate-spin text-[10px]" />
                Verificando...
              </span>
            ) : camoufoxStatus?.installed ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Motor OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Não instalado
              </span>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)]">
            <div className="flex items-center gap-2.5">
              <i
                className={clsx(
                  camoufoxStatus?.installed
                    ? 'ri-shield-check-fill text-emerald-500'
                    : 'ri-alert-fill text-amber-500',
                  'text-base'
                )}
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--foreground)]">
                    Motor Anti-Detect
                  </span>
                  {camoufoxStatus?.installed ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 leading-none">
                      OK
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 leading-none">
                      Pendente
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--muted)]">
                  {isCheckingMotor
                    ? 'Verificando integridade no computador...'
                    : camoufoxStatus?.installed
                    ? `${camoufoxStatus.version ? `${camoufoxStatus.version} • ` : ''}Pronto e operacional no computador`
                    : 'Não instalado no computador • Download necessário para abrir perfis'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={checkMotorStatus}
                disabled={isCheckingMotor}
                title="Verificar se o motor está OK no computador"
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                <i className={clsx(isCheckingMotor ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line', 'text-xs mr-1')} />
                <span>{motorFeedback || 'Verificar'}</span>
              </Button>

              <Button
                type="button"
                variant={camoufoxStatus?.installed ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setIsCamoufoxInstallModalOpen(true);
                }}
              >
                <i className={clsx(camoufoxStatus?.installed ? 'ri-refresh-line' : 'ri-download-cloud-line', 'text-xs mr-1')} />
                <span>{camoufoxStatus?.installed ? 'Reinstalar' : 'Instalar Motor'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.settings.security}
          </label>
          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)]">
            <div className="flex items-center gap-2.5">
              <i
                className={clsx(
                  isSecurityEnabled
                    ? 'ri-shield-check-line text-emerald-500'
                    : 'ri-lock-line text-[var(--muted)]',
                  'text-base'
                )}
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {t.settings.appLock}
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  {isSecurityEnabled ? t.settings.appLockEnabled : t.settings.appLockDisabled}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsSettingsModalOpen(false);
                setIsSecurityModalOpen(true);
              }}
            >
              <i className="ri-settings-4-line text-xs mr-1" />
              <span>{t.actions.configure}</span>
            </Button>
          </div>
        </div>

        {/* Version */}
        <div className="pt-1 border-t border-[var(--border)]/60 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>{t.settings.version}</span>
          <span className="font-mono text-[var(--foreground)] opacity-60">v{updateData?.currentVersion || '1.0.1'}</span>
        </div>
      </div>
    </Modal>
  );
};
