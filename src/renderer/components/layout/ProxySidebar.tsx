import React from 'react';
import { clsx } from 'clsx';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { getCountryFlag } from '../../utils/proxyParser';

export const ProxySidebar: React.FC = () => {
  const {
    proxies,
    selectedProxyFilter,
    setSelectedProxyFilter,
    proxyProfileCounts,
  } = useProfiles();
  const { t } = useI18n();

  // Status counts
  const totalCount = proxies.length;
  const activeCount = proxies.filter(p => p.status === 'active').length;
  const failedCount = proxies.filter(p => p.status === 'failed').length;
  const unusedCount = proxies.filter(p => (proxyProfileCounts[p.id] || 0) === 0).length;

  // Extract unique countries
  const countriesMap = proxies.reduce((acc, p) => {
    if (p.countryCode) {
      if (!acc[p.countryCode]) {
        acc[p.countryCode] = {
          code: p.countryCode,
          name: p.country || p.countryCode,
          count: 0,
        };
      }
      acc[p.countryCode].count += 1;
    }
    return acc;
  }, {} as Record<string, { code: string; name: string; count: number }>);
  const countries = Object.values(countriesMap);

  // Extract unique tags
  const tagsMap = proxies.reduce((acc, p) => {
    p.tags.forEach(tag => {
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
          onClick={() => setSelectedProxyFilter('all')}
          className={navItemClass(selectedProxyFilter === 'all')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i className={clsx(iconClass(selectedProxyFilter === 'all'), 'ri-shield-keyhole-line')} />
            <span className="truncate">{t.proxiesPage.allProxies}</span>
          </div>
          <span className={badgeClass(selectedProxyFilter === 'all')}>{totalCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedProxyFilter('active')}
          className={navItemClass(selectedProxyFilter === 'active')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i
              className={clsx(
                iconClass(selectedProxyFilter === 'active'),
                'ri-checkbox-circle-line',
                selectedProxyFilter === 'active' ? 'text-red-500' : 'text-emerald-500'
              )}
            />
            <span className="truncate">{t.proxiesPage.activeProxies}</span>
          </div>
          <span className={badgeClass(selectedProxyFilter === 'active')}>{activeCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedProxyFilter('failed')}
          className={navItemClass(selectedProxyFilter === 'failed')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i
              className={clsx(
                iconClass(selectedProxyFilter === 'failed'),
                'ri-error-warning-line',
                selectedProxyFilter === 'failed' ? 'text-red-500' : 'text-amber-500'
              )}
            />
            <span className="truncate">{t.proxiesPage.failedProxies}</span>
          </div>
          <span className={badgeClass(selectedProxyFilter === 'failed')}>{failedCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedProxyFilter('unused')}
          className={navItemClass(selectedProxyFilter === 'unused')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i className={clsx(iconClass(selectedProxyFilter === 'unused'), 'ri-subtract-line')} />
            <span className="truncate">{t.proxiesPage.unusedProxies}</span>
          </div>
          <span className={badgeClass(selectedProxyFilter === 'unused')}>{unusedCount}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="my-3 px-1">
        <div className="border-t border-[var(--border)]/60" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 -mx-0 pr-0.5">
        {/* Country / Location Filter */}
        {countries.length > 0 && (
          <div>
            <div className="px-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase">
                {t.proxiesPage.location}
              </span>
            </div>
            <div className="space-y-0.5">
              {countries.map(c => {
                const isSelected = selectedProxyFilter === `country:${c.code}`;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setSelectedProxyFilter(isSelected ? 'all' : `country:${c.code}`)}
                    className={navItemClass(isSelected)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm">{getCountryFlag(c.code)}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <span className={badgeClass(isSelected)}>{c.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags Filter */}
        {uniqueTags.length > 0 && (
          <div>
            <div className="px-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase">
                {t.proxiesPage.tags}
              </span>
            </div>
            <div className="space-y-0.5">
              {uniqueTags.map(([tag, count]) => {
                const isSelected = selectedProxyFilter === `tag:${tag}`;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedProxyFilter(isSelected ? 'all' : `tag:${tag}`)}
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
        )}
      </div>
    </aside>
  );
};
