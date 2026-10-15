import React from 'react';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

export const StatusBar: React.FC = () => {
  const { profiles } = useProfiles();
  const { t } = useI18n();

  const totalProfiles = profiles.filter(p => !p.isTrash).length;

  return (
    <footer className="h-7 w-full flex items-center justify-between px-4 border-t border-[var(--border)]/60 bg-[var(--status-bar-bg)] select-none flex-shrink-0 z-20">
      {/* Left */}
      <div className="flex items-center gap-3 text-[10.5px] text-[var(--muted)]">
        <span>{t.status.proxyTraffic}</span>
        <span className="text-[var(--border)] opacity-60">·</span>
        <span className="font-semibold tracking-wider text-red-500/80 dark:text-red-400/80">
          {t.status.lifetime}
        </span>
        <span className="text-[var(--border)] opacity-60">·</span>
        <span>
          {t.status.profilesCount}:{' '}
          <strong className="text-[var(--foreground)] font-semibold">{totalProfiles}</strong>
          {' '}/ {t.status.unlimited}
        </span>
        <span className="text-[var(--border)] opacity-60">·</span>
        <span>{t.status.teamMembers}</span>
      </div>

      {/* Right — connection indicator */}
      <div className="flex items-center gap-1.5 text-[10.5px]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        <span className="text-emerald-500 font-medium">{t.status.agentConnected}</span>
      </div>
    </footer>
  );
};
