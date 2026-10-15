import React from 'react';
import { clsx } from 'clsx';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

export const AutomationSidebar: React.FC = () => {
  const {
    automations,
    selectedAutomationFilter,
    setSelectedAutomationFilter,
  } = useProfiles();
  const { t } = useI18n();

  // Status counts
  const totalCount = automations.length;
  const successCount = automations.filter(a => a.lastRunStatus === 'success').length;
  const failedCount = automations.filter(a => a.lastRunStatus === 'failed').length;
  const stoppedCount = automations.filter(a => a.lastRunStatus === 'stopped').length;
  const neverCount = automations.filter(a => !a.lastRunStatus || a.lastRunStatus === 'idle').length;

  // Extract unique tags
  const tagsMap = automations.reduce((acc, a) => {
    (a.tags || []).forEach(tag => {
      if (!acc[tag]) acc[tag] = 0;
      acc[tag] += 1;
    });
    return acc;
  }, {} as Record<string, number>);
  const uniqueTags = Object.entries(tagsMap);

  const navItemClass = (isActive: boolean) =>
    clsx(
      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-100 cursor-pointer group',
      isActive
        ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs border border-[var(--border)]/70 font-semibold'
        : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/60'
    );

  const iconClass = (isActive: boolean) =>
    clsx(
      'text-[15px] leading-none flex-shrink-0 transition-colors',
      isActive ? 'text-red-500' : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'
    );

  const badgeClass = (isActive: boolean) =>
    clsx(
      'text-[10.5px] px-1.5 py-0.2 rounded-md font-mono font-medium',
      isActive
        ? 'bg-red-500/10 text-red-500'
        : 'bg-[var(--muted-bg)] text-[var(--muted)] group-hover:text-[var(--foreground)]'
    );

  return (
    <aside className="w-56 h-full flex flex-col py-3 px-2.5 border-r border-[var(--border)]/50 bg-[var(--sidebar-secondary)] select-none flex-shrink-0 z-10">
      {/* System Filters */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setSelectedAutomationFilter('all')}
          className={navItemClass(selectedAutomationFilter === 'all')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i className={clsx(iconClass(selectedAutomationFilter === 'all'), 'ri-terminal-box-line')} />
            <span className="truncate">{t.automationsPage.allAutomations}</span>
          </div>
          <span className={badgeClass(selectedAutomationFilter === 'all')}>{totalCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedAutomationFilter('success')}
          className={navItemClass(selectedAutomationFilter === 'success')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i
              className={clsx(
                iconClass(selectedAutomationFilter === 'success'),
                'ri-checkbox-circle-line',
                selectedAutomationFilter === 'success' ? 'text-red-500' : 'text-emerald-500'
              )}
            />
            <span className="truncate">{t.automationsPage.successAutomations}</span>
          </div>
          <span className={badgeClass(selectedAutomationFilter === 'success')}>{successCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedAutomationFilter('failed')}
          className={navItemClass(selectedAutomationFilter === 'failed')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i
              className={clsx(
                iconClass(selectedAutomationFilter === 'failed'),
                'ri-error-warning-line',
                selectedAutomationFilter === 'failed' ? 'text-red-500' : 'text-red-500'
              )}
            />
            <span className="truncate">{t.automationsPage.failedAutomations}</span>
          </div>
          <span className={badgeClass(selectedAutomationFilter === 'failed')}>{failedCount}</span>
        </button>

        {stoppedCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedAutomationFilter('stopped')}
            className={navItemClass(selectedAutomationFilter === 'stopped')}
          >
            <div className="flex items-center gap-2.5 truncate">
              <i
                className={clsx(
                  iconClass(selectedAutomationFilter === 'stopped'),
                  'ri-stop-circle-line',
                  selectedAutomationFilter === 'stopped' ? 'text-red-500' : 'text-amber-500'
                )}
              />
              <span className="truncate">{t.automationsPage.statusStopped}</span>
            </div>
            <span className={badgeClass(selectedAutomationFilter === 'stopped')}>{stoppedCount}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setSelectedAutomationFilter('never')}
          className={navItemClass(selectedAutomationFilter === 'never')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i className={clsx(iconClass(selectedAutomationFilter === 'never'), 'ri-time-line')} />
            <span className="truncate">{t.automationsPage.neverRun}</span>
          </div>
          <span className={badgeClass(selectedAutomationFilter === 'never')}>{neverCount}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="my-3 px-1">
        <div className="border-t border-[var(--border)]/60" />
      </div>

      {/* Tags Filter */}
      <div className="flex-1 overflow-y-auto space-y-4 -mx-0 pr-0.5">
        {uniqueTags.length > 0 ? (
          <div>
            <div className="px-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase">
                {t.automationsPage.tags}
              </span>
            </div>
            <div className="space-y-0.5">
              {uniqueTags.map(([tag, count]) => {
                const isSelected = selectedAutomationFilter === `tag:${tag}`;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedAutomationFilter(isSelected ? 'all' : `tag:${tag}`)}
                    className={navItemClass(isSelected)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <i className={clsx(iconClass(isSelected), 'ri-hashtag text-xs')} />
                      <span className="truncate">{tag}</span>
                    </div>
                    <span className={badgeClass(isSelected)}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-3 py-4 text-center">
            <span className="text-[11px] text-[var(--muted)]/60">
              Nenhuma tag criada
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
