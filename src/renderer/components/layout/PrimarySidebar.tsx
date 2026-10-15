import React from 'react';
import { clsx } from 'clsx';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { TabType } from '../../types';

export const PrimarySidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsSettingsModalOpen,
    setIsReportModalOpen,
    isSecurityEnabled,
    setIsSecurityModalOpen,
    updateData,
    setIsUpdateModalOpen,
  } = useProfiles();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const mainTabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'profiles', label: t.tabs.profiles, icon: 'ri-global-line' },
    { id: 'folders', label: t.tabs.folders, icon: 'ri-folder-3-line' },
    { id: 'proxies', label: t.tabs.proxies, icon: 'ri-shield-keyhole-line' },
    { id: 'automations', label: t.tabs.automations, icon: 'ri-terminal-box-line' },
    { id: 'referral', label: t.tabs.referral, icon: 'ri-group-line' },
  ];


  return (
    <aside className="w-[74px] h-full flex flex-col items-center justify-between py-3 border-r border-[var(--border)]/60 bg-[var(--sidebar-primary)] select-none flex-shrink-0 z-20">
      {/* Navigation Tabs */}
      <nav className="flex flex-col items-center gap-1 w-full px-2 pt-1">
        {mainTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              className={clsx(
                'w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all duration-150 cursor-pointer group relative',
                isActive
                  ? 'bg-red-500/8 text-red-500'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)]'
              )}
            >
              {/* Active indicator strip */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-red-500 rounded-r-full" />
              )}
              <i
                className={clsx(
                  tab.icon,
                  'text-[18px] leading-none mb-[5px] transition-transform duration-150',
                  isActive ? 'text-red-500' : 'text-[var(--muted)] group-hover:scale-110'
                )}
              />
              <span
                className={clsx(
                  'text-[9.5px] tracking-tight leading-none text-center font-medium',
                  isActive ? 'text-red-500' : 'text-[var(--muted)]'
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Utility Controls */}
      <div className="flex flex-col items-center gap-1 w-full px-2 pb-1 pt-2 border-t border-[var(--border)]/50">
        {/* Update Notification */}
        {updateData?.hasUpdate && (
          <button
            type="button"
            onClick={() => setIsUpdateModalOpen(true)}
            title={`Atualização v${updateData.latestVersion} disponível`}
            className="w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 transition-all cursor-pointer group relative mb-1"
          >
            <span className="relative flex h-2 w-2 mb-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <i className="ri-sparkling-fill text-[16px] leading-none mb-1 text-red-500 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] tracking-tight leading-none text-center font-bold text-red-500">
              Update
            </span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          className="w-full flex items-center justify-center py-2 px-1 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer group"
        >
          <i
            className={clsx(
              theme === 'dark' ? 'ri-sun-line text-amber-400' : 'ri-moon-line text-indigo-400',
              'text-[18px] leading-none transition-transform group-hover:rotate-12'
            )}
          />
        </button>

        {/* Segurança */}
        <button
          type="button"
          onClick={() => setIsSecurityModalOpen(true)}
          title={t.tabs.security}
          className="w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer group relative"
        >
          <i
            className={clsx(
              isSecurityEnabled ? 'ri-lock-line text-emerald-500' : 'ri-lock-line',
              'text-[18px] leading-none mb-[5px] transition-transform group-hover:scale-110'
            )}
          />
          <span
            className={clsx(
              'text-[9.5px] tracking-tight leading-none text-center font-medium',
              isSecurityEnabled ? 'text-emerald-500' : 'text-[var(--muted)]'
            )}
          >
            {t.tabs.security}
          </span>
          {isSecurityEnabled && (
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </button>

        {/* Report / Feedback */}
        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          title={t.tabs.report}
          className="w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer group"
        >
          <i className="ri-feedback-line text-[18px] leading-none mb-[5px] transition-transform group-hover:scale-110" />
          <span className="text-[9.5px] tracking-tight leading-none text-center font-medium">
            {t.tabs.report}
          </span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => setIsSettingsModalOpen(true)}
          title={t.tabs.settings}
          className="w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer group"
        >
          <i className="ri-settings-3-line text-[18px] leading-none mb-[5px] transition-transform group-hover:rotate-90" />
          <span className="text-[9.5px] tracking-tight leading-none text-center font-medium">
            {t.tabs.settings}
          </span>
        </button>
      </div>
    </aside>
  );
};
