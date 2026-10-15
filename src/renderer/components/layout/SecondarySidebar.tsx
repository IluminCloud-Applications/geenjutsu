import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { FolderIcon } from '../ui/FolderIcon';

const PLATFORM_INFO: Record<string, { label: string; icon: string }> = {
  facebook: { label: 'Facebook', icon: 'ri-facebook-circle-fill' },
  google:   { label: 'Google',   icon: 'ri-google-fill' },
  tiktok:   { label: 'TikTok',   icon: 'ri-tiktok-fill' },
  chrome:   { label: 'Chrome',   icon: 'ri-chrome-fill' },
  amazon:   { label: 'Amazon',   icon: 'ri-amazon-fill' },
  general:  { label: 'Geral',    icon: 'ri-global-line' },
};

export const SecondarySidebar: React.FC = () => {
  const {
    selectedFolderId,
    setSelectedFolderId,
    folders,
    addFolder,
    profiles,
    counts,
  } = useProfiles();
  const { t } = useI18n();

  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Dynamically calculate platforms present in active profiles
  const availablePlatforms = useMemo(() => {
    const platformCounts: Record<string, number> = {};
    profiles.forEach(p => {
      if (!p.isTrash) {
        platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
      }
    });

    return Object.entries(platformCounts)
      .filter(([_, count]) => count > 0)
      .map(([platform, count]) => {
        const info = PLATFORM_INFO[platform] || {
          label: platform.charAt(0).toUpperCase() + platform.slice(1),
          icon: 'ri-global-line',
        };
        return {
          id: platform,
          label: info.label,
          icon: info.icon,
          count,
        };
      });
  }, [profiles]);

  // Dynamically calculate tags present in active profiles and their counts
  const availableTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    profiles.forEach(p => {
      if (!p.isTrash && p.tags) {
        p.tags.forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) {
            tagCounts[trimmed] = (tagCounts[trimmed] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(tagCounts)
      .filter(([_, count]) => count > 0)
      .map(([tag, count]) => ({
        tag,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [profiles]);

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
  };

  const navItemClass = (isActive: boolean) =>
    clsx(
      'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-100 cursor-pointer group',
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
      'text-[10px] px-1.5 py-0.2 rounded-md font-mono font-medium flex-shrink-0 transition-colors',
      isActive
        ? 'bg-red-500/10 text-red-500'
        : 'bg-[var(--muted-bg)] text-[var(--muted)] group-hover:text-[var(--foreground)]'
    );

  return (
    <aside className="w-56 h-full flex flex-col py-3 px-2.5 border-r border-[var(--border)]/50 bg-[var(--sidebar-secondary)] select-none flex-shrink-0 z-10 overflow-hidden">
      {/* 1. Default (System Folders: Todos os Perfis, Em Execução, Lixeira) */}
      <div className="space-y-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => setSelectedFolderId('all')}
          className={navItemClass(selectedFolderId === 'all')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i className={iconClass(selectedFolderId === 'all') + ' ri-folder-line'} />
            <span className="truncate">{t.folders.allProfiles}</span>
          </div>
          <span className={badgeClass(selectedFolderId === 'all')}>{counts.all}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFolderId('running')}
          className={navItemClass(selectedFolderId === 'running')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i
              className={clsx(
                iconClass(selectedFolderId === 'running'),
                'ri-play-circle-line',
                selectedFolderId === 'running' && 'text-emerald-500'
              )}
            />
            <span className="truncate">{t.folders.runningProfiles}</span>
          </div>
          <span className={badgeClass(selectedFolderId === 'running')}>{counts.running}</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedFolderId('trash')}
          className={navItemClass(selectedFolderId === 'trash')}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i className={clsx(iconClass(selectedFolderId === 'trash'), 'ri-delete-bin-line')} />
            <span className="truncate">{t.folders.trashBin}</span>
          </div>
          <span className={badgeClass(selectedFolderId === 'trash')}>{counts.trash}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="my-2.5 px-1 flex-shrink-0">
        <div className="border-t border-[var(--border)]/60" />
      </div>

      {/* Scrollable container for Plataformas, Pastas, Tags (Hidden scrollbar, smoothly scrollable) */}
      <div
        className="flex-1 overflow-y-auto space-y-3.5 -mx-0 pr-0.5"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* 2. Plataformas (only shown if platforms exist in profile list) */}
        {availablePlatforms.length > 0 && (
          <div>
            <div className="px-2.5 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase">
                {t.folders.platforms}
              </span>
            </div>

            <div className="space-y-0.5">
              {availablePlatforms.map(p => {
                const isSelected = selectedFolderId === `platform:${p.id}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedFolderId(isSelected ? 'all' : `platform:${p.id}`)}
                    className={navItemClass(isSelected)}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <i className={clsx(iconClass(isSelected), p.icon)} />
                      <span className="truncate">{p.label}</span>
                    </div>
                    <span className={badgeClass(isSelected)}>{p.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Pastas (Folders with profile counts) */}
        <div>
          <div className="px-2.5 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase">
              {t.foldersPage.title}
            </span>
          </div>

          <div className="space-y-0.5">
            {/* Sem pasta / Unassigned */}
            <button
              type="button"
              onClick={() => setSelectedFolderId('unassigned')}
              className={navItemClass(selectedFolderId === 'unassigned' || selectedFolderId === 'none')}
            >
              <div className="flex items-center gap-2.5 truncate">
                <i
                  className={clsx(
                    iconClass(selectedFolderId === 'unassigned' || selectedFolderId === 'none'),
                    'ri-folder-line'
                  )}
                />
                <span className="truncate">{t.folders.unassigned}</span>
              </div>
              <span className={badgeClass(selectedFolderId === 'unassigned' || selectedFolderId === 'none')}>
                {counts.unassigned}
              </span>
            </button>

            {folders.map(folder => {
              const isSelected = selectedFolderId === folder.id;
              const count = counts[folder.id] || 0;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={navItemClass(isSelected)}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FolderIcon
                      icon={folder.icon}
                      className={clsx(iconClass(isSelected), isSelected && 'text-red-500')}
                    />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <span className={badgeClass(isSelected)}>{count}</span>
                </button>
              );
            })}

            {/* Inline Add Folder Button / Form */}
            {isAddingFolder ? (
              <form onSubmit={handleCreateFolder} className="mt-1">
                <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 shadow-sm">
                  <i className="ri-folder-add-line text-xs text-[var(--muted)]" />
                  <input
                    autoFocus
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder={t.folders.newFolder}
                    className="w-full bg-transparent text-xs text-[var(--foreground)] focus:outline-none placeholder:text-[var(--muted)]"
                    onBlur={() => {
                      if (!newFolderName.trim()) setIsAddingFolder(false);
                    }}
                  />
                  <button
                    type="submit"
                    className="text-red-500 hover:text-red-400 cursor-pointer flex-shrink-0"
                  >
                    <i className="ri-check-line text-xs" />
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingFolder(true)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 mt-1 rounded-lg text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/60 transition-colors cursor-pointer"
              >
                <i className="ri-add-line text-[14px] leading-none" />
                <span>{t.folders.newFolder}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. Tags (with profile counts and filter on click) */}
        {availableTags.length > 0 && (
          <div>
            <div className="px-2.5 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase">
                Tags
              </span>
            </div>

            <div className="space-y-0.5">
              {availableTags.map(item => {
                const isSelected = selectedFolderId === `tag:${item.tag}`;
                return (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => setSelectedFolderId(isSelected ? 'all' : `tag:${item.tag}`)}
                    className={navItemClass(isSelected)}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <i className={clsx(iconClass(isSelected), 'ri-hashtag text-xs')} />
                      <span className="truncate">{item.tag}</span>
                    </div>
                    <span className={badgeClass(isSelected)}>{item.count}</span>
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
