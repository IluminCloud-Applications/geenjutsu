import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { ProxyItem } from '../../types';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { ContextMenu } from '../ui/ContextMenu';
import { ConfirmModal } from '../ui/ConfirmModal';
import { getCountryFlag } from '../../utils/proxyParser';
import { ProxyTestTarget } from './ProxyTestModal';

interface ProxyRowProps {
  proxy: ProxyItem;
}

export const ProxyRow: React.FC<ProxyRowProps> = ({ proxy }) => {
  const {
    setEditingProxy,
    deleteProxy,
    testProxyConnection,
    proxyProfileCounts,
    setSearchQuery,
    setActiveTab,
    privacyConfig,
    setTestingProxyTarget,
  } = useProfiles();
  const { t } = useI18n();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const shouldBlurProxy = privacyConfig.blurProxy;
  const profileCount = proxyProfileCounts[proxy.id] || 0;

  const handleTest = async () => {
    setTesting(true);
    await testProxyConnection(proxy.id);
    setTesting(false);
  };

  const handleTestProxy = () => {
    const target: ProxyTestTarget = {
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      name: proxy.name || `${proxy.host}:${proxy.port}`,
    };
    setTestingProxyTarget(target);
  };

  const handleViewProfiles = () => {
    // Filter profiles by this proxy host
    setSearchQuery(proxy.host);
    setActiveTab('profiles');
  };

  const menuItems: DropdownItem[] = [
    {
      label: t.actions.edit,
      icon: 'ri-edit-line',
      onClick: () => setEditingProxy(proxy),
    },
    {
      label: t.actions.testProxy || 'Testar Proxy',
      icon: 'ri-radar-line',
      onClick: handleTestProxy,
    },
    {
      label: t.proxiesPage.testConnection,
      icon: 'ri-wifi-line',
      onClick: handleTest,
    },
    ...(profileCount > 0
      ? [
          {
            label: t.proxiesPage.viewProfiles,
            icon: 'ri-global-line',
            onClick: handleViewProfiles,
          },
        ]
      : []),
    {
      label: t.actions.delete,
      icon: 'ri-delete-bin-line',
      onClick: () => setConfirmDelete(true),
      danger: true,
      divider: true,
    },
  ];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('geenjutsu:close-context-menu'));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <tr
        onContextMenu={handleContextMenu}
        className="group border-b border-[var(--table-border)] transition-colors duration-100 hover:bg-[var(--table-row-hover)] cursor-default"
      >
        {/* Proxy Name, Flag & Host:Port */}
        <td className="py-3 px-5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Country Flag */}
            <div className="w-8 h-8 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-base shadow-xs">
              {getCountryFlag(proxy.countryCode)}
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    'text-[12.5px] font-semibold text-[var(--foreground)] tracking-tight truncate transition-all duration-200',
                    shouldBlurProxy && 'filter blur-[5px] select-none'
                  )}
                >
                  {proxy.name || `${proxy.host}:${proxy.port}`}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)] uppercase">
                  {proxy.type === 'http' ? 'HTTPS' : proxy.type.toUpperCase()}
                </span>
              </div>
              <div
                className={clsx(
                  'flex items-center gap-1.5 text-[11px] font-mono text-[var(--muted)] transition-all duration-200',
                  shouldBlurProxy && 'filter blur-[5px] select-none'
                )}
              >
                <span>{proxy.host}:{proxy.port}</span>
                {proxy.country && (
                  <>
                    <span className="text-[var(--border)]">·</span>
                    <span className="font-sans text-[10.5px] opacity-75">{proxy.country}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Authentication */}
        <td className="py-3 px-4 text-[12px] whitespace-nowrap">
          {proxy.username ? (
            <div
              className={clsx(
                'flex items-center gap-1.5 font-mono text-xs transition-all duration-200',
                shouldBlurProxy && 'filter blur-[5px] select-none'
              )}
            >
              <i className="ri-user-shared-line text-xs text-[var(--muted)]" />
              <span className="text-[var(--foreground)] font-medium">{proxy.username}</span>
              <span className="text-[var(--muted)]">:</span>
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? (proxy.password || '—') : '••••••'}
              </span>
            </div>
          ) : (
            <span className="text-[11.5px] text-[var(--muted)] opacity-40">
              {t.proxiesPage.noAuth}
            </span>
          )}
        </td>

        {/* Tags */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {proxy.tags && proxy.tags.length > 0 ? (
              proxy.tags.map(tag => <Badge key={tag} label={tag} />)
            ) : (
              <span className="text-[12px] text-[var(--muted)] opacity-25">—</span>
            )}
          </div>
        </td>

        {/* Linked Profiles */}
        <td className="py-3 px-4 whitespace-nowrap">
          {profileCount > 0 ? (
            <button
              type="button"
              onClick={handleViewProfiles}
              title={t.proxiesPage.viewProfiles}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--muted-bg)] hover:bg-[var(--border)] border border-[var(--border)] text-[11px] font-semibold text-[var(--foreground)] transition-colors cursor-pointer group/badge"
            >
              <i className="ri-user-line text-[11px] text-[var(--muted)] group-hover/badge:text-red-500 transition-colors" />
              <span>
                {profileCount} {profileCount === 1 ? 'perfil' : 'perfis'}
              </span>
              <i className="ri-arrow-right-s-line text-[12px] text-[var(--muted)] opacity-0 group-hover/badge:opacity-100 transition-opacity -ml-0.5" />
            </button>
          ) : (
            <span className="text-[11px] text-[var(--muted)] opacity-50 px-2 py-0.5 rounded-md bg-[var(--muted-bg)]/50">
              {t.proxiesPage.unused}
            </span>
          )}
        </td>

        {/* Ping / Status */}
        <td className="py-3 px-4 whitespace-nowrap">
          <div className="inline-flex items-center gap-2">
            <span
              className={clsx(
                'w-2 h-2 rounded-full',
                proxy.status === 'active'
                  ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                  : 'bg-amber-500'
              )}
            />
            <span className="text-xs font-mono font-medium text-[var(--foreground)]">
              {proxy.ping ? `${proxy.ping}ms` : '—'}
            </span>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              title={t.proxiesPage.testConnection}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer ml-0.5"
            >
              <i
                className={clsx(
                  testing ? 'ri-loader-4-line animate-spin text-red-500' : 'ri-refresh-line',
                  'text-xs'
                )}
              />
            </button>
          </div>
        </td>

        {/* Actions */}
        <td className="py-3 px-4 text-right whitespace-nowrap">
          <div className="inline-flex items-center justify-end gap-1.5 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setEditingProxy(proxy)}
              className="text-[11px] h-7 px-2"
            >
              <i className="ri-edit-line text-xs mr-1 text-[var(--muted)]" />
              <span>{t.actions.edit}</span>
            </Button>

            <Dropdown
              trigger={
                <button
                  type="button"
                  className="w-7 h-7 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] rounded-md hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
                >
                  <i className="ri-more-2-fill text-sm leading-none" />
                </button>
              }
              items={menuItems}
              align="right"
            />
          </div>
        </td>
      </tr>

      {/* Context Menu on Right Click */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteProxy(proxy.id)}
        title={t.proxiesPage.deleteConfirmTitle}
        description={t.proxiesPage.deleteConfirmDesc(proxy.name || `${proxy.host}:${proxy.port}`)}
        confirmLabel={t.actions.delete}
        danger={true}
      />
    </>
  );
};
