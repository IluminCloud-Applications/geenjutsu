import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { ContextMenu } from '../ui/ContextMenu';
import { Badge } from '../ui/Badge';
import { ConfirmModal } from '../ui/ConfirmModal';
import { getCountryFlag } from '../../utils/proxyParser';
import { ProfileTagCell } from './ProfileTagCell';
import { ExportProfileModal } from './ExportProfileModal';
import { ImportCookiesModal } from './ImportCookiesModal';
import { WarmupModal } from './WarmupModal';
import { formatCreatedDate, formatLastOpenedDate } from '../../utils/dateFormatter';

interface ProfileRowProps {
  profile: any;
}

export const ProfileRow: React.FC<ProfileRowProps> = ({ profile }) => {
  const {
    toggleLaunchProfile,
    setEditingProfile,
    updateProfile,
    moveToTrash,
    restoreFromTrash,
    permanentDelete,
    togglePinProfile,
    privacyConfig,
    sessionExemptProfileIds,
    proxies,
    profiles,
    isProfileWarming,
    setTestingProxyTarget,
  } = useProfiles();
  const { t } = useI18n();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [noteValue, setNoteValue] = useState(profile.notes || '');

  const isExempt = sessionExemptProfileIds.includes(profile.id);
  const shouldBlurName = privacyConfig.blurName && !isExempt;
  const shouldBlurProxy = privacyConfig.blurProxy && !isExempt;
  const shouldBlurNotes = privacyConfig.blurNotes && !isExempt;

  const [confirmTrash, setConfirmTrash] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportCookiesModalOpen, setIsImportCookiesModalOpen] = useState(false);
  const [isWarmupModalOpen, setIsWarmupModalOpen] = useState(false);
  
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isRunning = profile.status === 'running';
  const isLaunching = profile.status === 'launching';
  const isWarming = isProfileWarming(profile.id);

  // Periodic ticker to update relative time (e.g. Há 5 min)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveNotes = () => {
    // update profile logic omitted for brevity in UI design phase
    setIsEditingNotes(false);
  };

  const getPlatformIcon = () => {
    const platformMap: Record<string, string> = {
      facebook: 'ri-facebook-circle-fill',
      chrome:   'ri-google-fill',
      tiktok:   'ri-tiktok-fill',
      google:   'ri-google-fill',
      amazon:   'ri-amazon-fill',
      general:  'ri-global-line',
    };
    return platformMap[profile.platform] ?? 'ri-global-line';
  };

  const renderOsBadges = () => {
    const isApple   = profile.os === 'mac';
    const isWindows = profile.os === 'windows' || profile.browser.includes('Windows');
    const isLinux   = profile.os === 'linux';
    return (
      <div className="flex items-center gap-1 text-[var(--muted)]">
        {isApple   && <i className="ri-apple-fill text-[11px]" title="macOS" />}
        {isWindows && <i className="ri-windows-fill text-[11px]" title="Windows" />}
        {isLinux   && <i className="ri-ubuntu-fill text-[11px]" title="Linux" />}
      </div>
    );
  };

  const matchedProxy = React.useMemo(() => {
    if (!profile.proxy || profile.proxy.type === 'direct') return null;

    // 1. Match estrito por ID quando o perfil estiver vinculado a um proxy salvo
    if (profile.proxy.proxyId) {
      const byId = proxies.find(p => p.id === profile.proxy?.proxyId);
      if (byId) return byId;
    }

    // 2. Se não houver proxyId, match estrito por host + porta + usuário (nunca apenas por host)
    const host = profile.proxy.host || (profile.proxy.ipDisplay ? profile.proxy.ipDisplay.split(':')[0] : '');
    const port = profile.proxy.port || (profile.proxy.ipDisplay ? profile.proxy.ipDisplay.split(':')[1] : '');
    const user = profile.proxy.username;

    if (host && port) {
      return (
        proxies.find(
          p =>
            p.host === host &&
            String(p.port) === String(port) &&
            (!user || p.username === user)
        ) || null
      );
    }

    return null;
  }, [profile.proxy, proxies]);

  const proxyDisplayName = profile.proxy?.name || matchedProxy?.name;
  const proxyHostDisplay =
    profile.proxy?.ipDisplay ||
    (profile.proxy?.host ? `${profile.proxy.host}:${profile.proxy.port || ''}` : matchedProxy ? `${matchedProxy.host}:${matchedProxy.port}` : '');
  const proxyCountryCode = profile.proxy?.countryCode || matchedProxy?.countryCode;
  const proxyProtocol = profile.proxy?.type
    ? profile.proxy.type === 'http' ? 'HTTPS' : profile.proxy.type.toUpperCase()
    : matchedProxy?.type
    ? matchedProxy.type === 'http' ? 'HTTPS' : matchedProxy.type.toUpperCase()
    : null;

  const hasProxy = !!(
    profile.proxy &&
    profile.proxy.type !== 'direct' &&
    (profile.proxy.host || matchedProxy?.host || profile.proxy.ipDisplay)
  );

  const handleTestProxy = () => {
    // Busca estritamente o proxy salvo selecionado pelo ID, ou o matchedProxy exato
    const savedProxy = (profile.proxy?.proxyId ? proxies.find(p => p.id === profile.proxy?.proxyId) : null) || matchedProxy;

    // Prioriza sempre as configurações reais do perfil
    const host = profile.proxy?.host || savedProxy?.host || (profile.proxy?.ipDisplay ? profile.proxy.ipDisplay.split(':')[0] : '') || '';
    const port = profile.proxy?.port || savedProxy?.port || (profile.proxy?.ipDisplay ? profile.proxy.ipDisplay.split(':')[1] : '') || '';
    const username = profile.proxy?.username ?? savedProxy?.username;
    const password = profile.proxy?.password ?? savedProxy?.password;
    const type = profile.proxy?.type || savedProxy?.type || (host ? 'socks5' : 'direct');
    const name = profile.proxy?.name || savedProxy?.name || (host ? `${host}:${port}` : t.proxyTestModal.directConnection);

    setTestingProxyTarget({
      profileId: profile.id,
      type: type === 'direct' ? 'direct' : type,
      host: host || undefined,
      port: port || undefined,
      username: username || undefined,
      password: password || undefined,
      name,
      profileName: profile.name,
    });
  };

  const menuItems: DropdownItem[] = profile.isTrash
    ? [
        { label: t.actions.restore, icon: 'ri-restart-line', onClick: () => restoreFromTrash(profile.id) },
        { label: t.actions.permanentDelete, icon: 'ri-delete-bin-7-line', onClick: () => setConfirmDelete(true), danger: true, divider: true },
      ]
    : [
        {
          label: profile.isPinned ? t.actions.unpin : t.actions.pin,
          icon: profile.isPinned ? 'ri-unpin-line' : 'ri-pushpin-line',
          onClick: () => togglePinProfile(profile.id),
        },
        { label: t.actions.edit, icon: 'ri-edit-line', onClick: () => setEditingProfile(profile) },
        {
          label: isWarming ? (t.actions.warming || 'Aquecendo...') : (t.actions.warmup || 'Aquecer'),
          icon: isWarming ? 'ri-fire-fill text-amber-500' : 'ri-fire-line',
          onClick: () => setIsWarmupModalOpen(true),
        },
        {
          label: t.actions.testProxy,
          icon: 'ri-radar-line',
          onClick: handleTestProxy,
        },
        { label: t.actions.importCookies || 'Importar', icon: 'ri-upload-2-line', onClick: () => setIsImportCookiesModalOpen(true) },
        { label: t.actions.export, icon: 'ri-download-2-line', onClick: () => setIsExportModalOpen(true) },
        { label: t.actions.trash, icon: 'ri-delete-bin-line', onClick: () => setConfirmTrash(true), danger: true, divider: true },
      ];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('geenjutsu:close-context-menu'));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const allAppTags = React.useMemo(() => {
    const set = new Set<string>();
    profiles.forEach(p => p.tags?.forEach(t => t && set.add(t.trim())));
    proxies.forEach(pr => pr.tags?.forEach(t => t && set.add(t.trim())));
    return Array.from(set).sort();
  }, [profiles, proxies]);

  return (
    <>
      <tr
        onContextMenu={handleContextMenu}
        className={clsx(
          'group border-b border-[var(--table-border)] transition-colors duration-100',
          'hover:bg-[var(--table-row-hover)] cursor-default',
          isRunning && 'bg-emerald-500/[0.025]',
          profile.isPinned && !isRunning && 'bg-amber-500/[0.015]',
          contextMenu && 'bg-[var(--table-row-hover)]'
        )}
      >
        <td className="py-3 px-3 sm:px-5 min-w-[140px]">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <i className={clsx(getPlatformIcon(), 'text-[var(--muted)] text-[14px] flex-shrink-0')} />
              <span
                className={clsx(
                  'text-[12.5px] font-semibold text-[var(--foreground)] tracking-tight truncate transition-all duration-200',
                  shouldBlurName && 'filter blur-[5px] select-none'
                )}
              >
                {profile.name}
              </span>
              {profile.isPinned && (
                <span
                  title={t.actions.pinnedToTop}
                  onClick={e => {
                    e.stopPropagation();
                    togglePinProfile(profile.id);
                  }}
                  className="inline-flex items-center justify-center text-amber-500 flex-shrink-0 cursor-pointer hover:text-amber-600 transition-colors"
                >
                  <i className="ri-pushpin-fill text-[11.5px] -rotate-45" />
                </span>
              )}
              {isWarming ? (
                <span
                  title={t.actions.warmingTooltip || 'Aquecendo'}
                  onClick={e => {
                    e.stopPropagation();
                    setIsWarmupModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center text-amber-500 flex-shrink-0 cursor-pointer animate-pulse"
                >
                  <i className="ri-fire-fill text-[12px]" />
                </span>
              ) : profile.warmupConfig?.enabled ? (
                <span
                  title={t.actions.warmup || 'Aquecer'}
                  onClick={e => {
                    e.stopPropagation();
                    setIsWarmupModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center text-red-500 hover:text-red-400 flex-shrink-0 cursor-pointer transition-colors"
                >
                  <i className="ri-fire-fill text-[12px]" />
                </span>
              ) : null}
              {renderOsBadges()}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] opacity-75 mt-0.5 ml-6 flex-wrap">
              <span>{t.table.created}: {formatCreatedDate(profile.createdAt)}</span>
              <span className="w-0.5 h-0.5 rounded-full bg-[var(--muted)]" />
              <span>{t.table.lastOpened}: {formatLastOpenedDate(profile.lastLaunchedAt, isRunning)}</span>

              {/* Compact Proxy badge when Proxy column is hidden on smaller screens (< lg) */}
              {(proxyHostDisplay || proxyDisplayName) && (
                <span
                  className="lg:hidden inline-flex items-center gap-1 text-[9.5px] font-medium text-[var(--muted-fg)] bg-[var(--muted-bg)] px-1.5 py-0.2 rounded border border-[var(--border)]/70 flex-shrink-0"
                  title={proxyHostDisplay}
                >
                  {proxyCountryCode ? getCountryFlag(proxyCountryCode) : <i className="ri-shield-keyhole-line text-[10px]" />}
                  <span className={clsx('truncate max-w-[100px]', shouldBlurProxy && 'filter blur-[4px] select-none')}>
                    {proxyDisplayName || proxyHostDisplay}
                  </span>
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="hidden xl:table-cell py-3 px-4 text-[12px] text-[var(--muted)] max-w-[200px]">
          {isEditingNotes ? (
            <input
              autoFocus
              type="text"
              value={noteValue}
              onChange={e => setNoteValue(e.target.value)}
              onBlur={handleSaveNotes}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveNotes();
                if (e.key === 'Escape') setIsEditingNotes(false);
              }}
              className="w-full bg-[var(--muted-bg)] border border-[var(--border)] rounded-md px-2 py-1 text-[12px] text-[var(--foreground)] focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10"
            />
          ) : (
            <span
              onClick={() => {
                if (!shouldBlurNotes) setIsEditingNotes(true);
              }}
              className={clsx(
                'cursor-text hover:text-[var(--foreground)] transition-colors inline-block w-full truncate',
                shouldBlurNotes && 'filter blur-[5px] select-none pointer-events-none'
              )}
              title={shouldBlurNotes ? undefined : (profile.notes || t.table.clickToEdit)}
            >
              {profile.notes || <span className="opacity-25">—</span>}
            </span>
          )}
        </td>

        <td className="hidden lg:table-cell py-3 px-4 whitespace-nowrap">
          {proxyHostDisplay || proxyDisplayName ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-sm shadow-2xs">
                {proxyCountryCode ? (
                  getCountryFlag(proxyCountryCode)
                ) : (
                  <i className="ri-shield-keyhole-line text-xs text-[var(--muted)]" />
                )}
              </div>

              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={clsx(
                      'text-[12px] font-semibold text-[var(--foreground)] tracking-tight truncate max-w-[150px] transition-all duration-200',
                      shouldBlurProxy && 'filter blur-[5px] select-none'
                    )}
                  >
                    {proxyDisplayName || proxyHostDisplay}
                  </span>
                  {proxyProtocol && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)] uppercase leading-tight flex-shrink-0">
                      {proxyProtocol}
                    </span>
                  )}
                </div>

                {proxyDisplayName && proxyHostDisplay && (
                  <span
                    className={clsx(
                      'text-[10.5px] font-mono text-[var(--muted)] truncate max-w-[150px] transition-all duration-200',
                      shouldBlurProxy && 'filter blur-[5px] select-none'
                    )}
                  >
                    {proxyHostDisplay}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-[var(--muted)] opacity-25">—</span>
          )}
        </td>

        <td className="hidden md:table-cell py-3 px-4">
          <ProfileTagCell
            profileId={profile.id}
            tags={profile.tags || []}
            onUpdateTags={newTags => updateProfile({ id: profile.id, tags: newTags })}
            allAppTags={allAppTags}
          />
        </td>

        <td className="sticky right-0 z-10 bg-[var(--card)] group-hover:bg-[var(--table-row-hover)] py-3 px-3 sm:px-4 text-right whitespace-nowrap w-36 min-w-[124px] transition-colors shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)]">
          <div className="inline-flex items-center justify-end gap-1.5 w-full">
            {profile.isTrash ? (
              <Button variant="secondary" size="sm" onClick={() => restoreFromTrash(profile.id)}>
                {t.actions.restore}
              </Button>
            ) : isWarming ? (
              <Button
                variant="secondary"
                size="sm"
                icon="ri-fire-fill text-amber-500 animate-pulse"
                onClick={() => setIsWarmupModalOpen(true)}
                title={t.actions.warmingTooltip || 'Perfil em processo de aquecimento. Clique para ver ou interromper.'}
                className="min-w-[96px] border-amber-500/35 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:border-amber-500/50 font-semibold cursor-pointer"
              >
                {t.actions.warming || 'Aquecendo'}
              </Button>
            ) : isLaunching ? (
              <Button
                variant="launch"
                size="sm"
                icon="ri-loader-4-line animate-spin"
                disabled
                className="min-w-[84px] opacity-90"
              >
                {t.actions.launching || 'Abrindo...'}
              </Button>
            ) : (
              <Button
                variant={isRunning ? 'stop' : 'launch'}
                size="sm"
                icon={isRunning ? 'ri-stop-fill' : 'ri-play-fill'}
                onClick={() => toggleLaunchProfile(profile.id)}
                className="min-w-[76px]"
              >
                {isRunning ? t.actions.stop : t.actions.start}
              </Button>
            )}

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

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={menuItems} onClose={() => setContextMenu(null)} />
      )}

      {confirmTrash && (
        <ConfirmModal
          isOpen={confirmTrash}
          onClose={() => setConfirmTrash(false)}
          onConfirm={() => moveToTrash(profile.id)}
          title={t.profileModals.trashTitle}
          description={t.profileModals.trashDescription(profile.name)}
          confirmLabel={t.profileModals.trashConfirm}
          danger={false}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => permanentDelete(profile.id)}
          title={t.profileModals.deleteTitle}
          description={t.profileModals.deleteDescription(profile.name)}
          confirmLabel={t.profileModals.deleteConfirm}
          danger={true}
        />
      )}

      {isExportModalOpen && (
        <ExportProfileModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          profile={profile}
        />
      )}

      {isImportCookiesModalOpen && (
        <ImportCookiesModal
          isOpen={isImportCookiesModalOpen}
          onClose={() => setIsImportCookiesModalOpen(false)}
          profile={profile}
        />
      )}

      {isWarmupModalOpen && (
        <WarmupModal
          isOpen={isWarmupModalOpen}
          onClose={() => setIsWarmupModalOpen(false)}
          profile={profile}
        />
      )}
    </>
  );
};
