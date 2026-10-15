import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { FolderIcon } from '../ui/FolderIcon';
import { BrandTextLogo, AppIcon } from '../ui/BrandLogo';
import { openExternalLink } from '../../utils/externalLinks';
import { clsx } from 'clsx';

export interface TitleBarProps {
  isLockScreen?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({ isLockScreen = false }) => {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    folderSearchQuery,
    setFolderSearchQuery,
    setIsCreateModalOpen,
    setIsCreateFolderModalOpen,
    proxySearchQuery,
    setProxySearchQuery,
    setIsCreateProxyModalOpen,
    automationSearchQuery,
    setAutomationSearchQuery,
    setIsCreateAutomationModalOpen,
    setIsAiPromptModalOpen,
    folders,
    selectedFolderId,
    setSelectedFolderId,
    counts,
    isPrivacyMode,
    privacyConfig,
    togglePrivacyField,
    toggleAllPrivacy,
    setIsImportProfileModalOpen,
    isSecurityEnabled,
    lockApp,
    handleCloseApp,
  } = useProfiles();

  const { t } = useI18n();
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);
  const privacyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) {
        setIsFolderOpen(false);
      }
      if (privacyRef.current && !privacyRef.current.contains(e.target as Node)) {
        setIsPrivacyOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFolderOpen(false);
        setIsPrivacyOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isPlatformFilter = selectedFolderId.startsWith('platform:');
  const isTagFilter = selectedFolderId.startsWith('tag:');
  const platformName = isPlatformFilter
    ? selectedFolderId.replace('platform:', '').charAt(0).toUpperCase() + selectedFolderId.replace('platform:', '').slice(1)
    : '';
  const tagName = isTagFilter ? `#${selectedFolderId.replace('tag:', '')}` : '';

  const selectedFolder = useMemo(() => {
    if (selectedFolderId === 'all') {
      return { id: 'all', name: t.folders.allProfiles, icon: 'ri-apps-2-line' };
    }
    if (selectedFolderId === 'unassigned' || selectedFolderId === 'none') {
      return { id: 'unassigned', name: t.folders.unassigned, icon: 'ri-folder-line' };
    }
    if (selectedFolderId === 'running') {
      return { id: 'running', name: t.folders.runningProfiles, icon: 'ri-play-circle-line' };
    }
    if (selectedFolderId === 'trash') {
      return { id: 'trash', name: t.folders.trashBin, icon: 'ri-delete-bin-line' };
    }
    if (isPlatformFilter) {
      return { id: selectedFolderId, name: platformName, icon: 'ri-global-line' };
    }
    if (isTagFilter) {
      return { id: selectedFolderId, name: tagName, icon: 'ri-hashtag' };
    }
    const found = folders.find(f => f.id === selectedFolderId);
    if (found) return found;
    return { id: 'all', name: t.folders.allProfiles, icon: 'ri-apps-2-line' };
  }, [selectedFolderId, folders, isPlatformFilter, isTagFilter, platformName, tagName, t.folders]);

  const allPrivacySelected = privacyConfig.blurName && privacyConfig.blurProxy && privacyConfig.blurNotes;
  const anyPrivacySelected = privacyConfig.blurName || privacyConfig.blurProxy || privacyConfig.blurNotes;

  if (isLockScreen) {
    return (
      <header className="h-[48px] w-full flex items-center justify-between border-b border-[var(--border)] bg-[var(--sidebar-primary)] select-none z-30 flex-shrink-0 titlebar-drag">
        <div className="flex items-center h-full px-4 gap-2 titlebar-no-drag">
          <AppIcon sizeClass="h-[28px] w-auto max-w-[56px]" />
          <BrandTextLogo heightClass="h-[15px]" />
        </div>

        <div className="flex items-center h-full flex-shrink-0 titlebar-no-drag border-l border-[var(--border)]/40 bg-[var(--card)] z-30">
          <button
            type="button"
            onClick={() => window.geenjutsuApi?.minimize()}
            title="Minimizar"
            className="h-full px-3.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors flex items-center justify-center cursor-pointer"
          >
            <i className="ri-subtract-line text-xs" />
          </button>
          <button
            type="button"
            onClick={() => window.geenjutsuApi?.maximize()}
            title="Maximizar"
            className="h-full px-3.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors flex items-center justify-center cursor-pointer"
          >
            <i className="ri-checkbox-blank-line text-[11px]" />
          </button>
          <button
            type="button"
            onClick={handleCloseApp}
            title="Fechar"
            className="h-full px-4 text-[var(--muted)] hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors flex items-center justify-center cursor-pointer"
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="h-[48px] w-full flex items-center border-b border-[var(--border)] bg-[var(--sidebar-primary)] select-none z-30 flex-shrink-0 titlebar-drag">
      {/* Brand slot */}
      <div className="w-[74px] h-full flex items-center justify-center flex-shrink-0 border-r border-[var(--border)]/50 titlebar-no-drag">
        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          title="Geenjutsu"
          className="h-full w-full flex items-center justify-center p-1.5 cursor-pointer transition-transform duration-150 active:scale-95 group"
        >
          <AppIcon sizeClass="h-[32px] w-auto max-w-[56px]" className="transition-transform duration-200 group-hover:scale-105" />
        </button>
      </div>

      {activeTab === 'profiles' ? (
        <>
          {/* Secondary sidebar header */}
          <div className="w-56 h-full flex items-center justify-between px-3.5 flex-shrink-0 border-r border-[var(--border)]/50 bg-[var(--sidebar-secondary)] titlebar-no-drag">
            <BrandTextLogo heightClass="h-[15px]" />

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
              style={{ boxShadow: '0 2px 6px rgba(220,38,38,0.28)' }}
            >
              <i className="ri-add-line text-xs leading-none" />
              <span>{t.actions.create}</span>
            </button>
          </div>

          {/* Main content header */}
          <div className="flex-1 h-full flex items-center px-4 gap-3 bg-[var(--card)] titlebar-no-drag">
            {/* Search */}
            <div className="relative flex items-center w-36 sm:w-64 flex-shrink min-w-[110px]">
              <i className="ri-search-line absolute left-2.5 text-[var(--muted)] text-xs pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.actions.search}
                className="w-full h-[28px] bg-[var(--sidebar-primary)] text-[var(--foreground)] text-[11.5px] font-medium rounded-[6px] pl-7 pr-6 border border-[var(--border)] transition-all duration-150 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/10 placeholder:text-[var(--muted)] hover:border-[var(--border-hover)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
                >
                  <i className="ri-close-circle-fill text-xs" />
                </button>
              )}
            </div>

            {/* Folder Filter */}
            <div className="relative" ref={folderRef}>
              <button
                type="button"
                onClick={() => setIsFolderOpen(!isFolderOpen)}
                className={clsx(
                  'h-[28px] flex items-center gap-1.5 px-2.5 rounded-[6px] border text-[11.5px] font-medium transition-colors cursor-pointer',
                  isFolderOpen
                    ? 'bg-[var(--sidebar-primary)] border-red-500/50 text-[var(--foreground)]'
                    : 'bg-[var(--sidebar-primary)] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--border-hover)]'
                )}
              >
                <FolderIcon icon={selectedFolder?.icon} className="text-xs text-[var(--muted)]" />
                <span className="truncate max-w-[120px]">{selectedFolder?.name}</span>
                <i className="ri-arrow-down-s-line text-[var(--muted)] ml-1" />
              </button>

              {isFolderOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-52 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                  {/* Option: Todos os Perfis */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderId('all');
                      setIsFolderOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-left transition-colors cursor-pointer',
                      selectedFolderId === 'all'
                        ? 'bg-red-500/10 text-red-500 font-semibold'
                        : 'text-[var(--foreground)] hover:bg-[var(--sidebar-primary)]'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <i className={clsx('ri-apps-2-line text-xs', selectedFolderId === 'all' ? 'text-red-500' : 'text-[var(--muted)]')} />
                      <span className="truncate">{t.folders.allProfiles}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--muted-bg)] text-[var(--muted)]">{counts.all}</span>
                      {selectedFolderId === 'all' && <i className="ri-check-line text-red-500 text-xs" />}
                    </div>
                  </button>

                  {/* Option: Sem pasta */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderId('unassigned');
                      setIsFolderOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-left transition-colors cursor-pointer',
                      selectedFolderId === 'unassigned' || selectedFolderId === 'none'
                        ? 'bg-red-500/10 text-red-500 font-semibold'
                        : 'text-[var(--foreground)] hover:bg-[var(--sidebar-primary)]'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <i className={clsx('ri-folder-line text-xs', (selectedFolderId === 'unassigned' || selectedFolderId === 'none') ? 'text-red-500' : 'text-[var(--muted)]')} />
                      <span className="truncate">{t.folders.unassigned}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--muted-bg)] text-[var(--muted)]">{counts.unassigned}</span>
                      {(selectedFolderId === 'unassigned' || selectedFolderId === 'none') && <i className="ri-check-line text-red-500 text-xs" />}
                    </div>
                  </button>

                  {/* Custom Folders */}
                  {folders.length > 0 && (
                    <>
                      <div className="my-1 border-t border-[var(--border)]/60" />
                      {folders.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setSelectedFolderId(f.id);
                            setIsFolderOpen(false);
                          }}
                          className={clsx(
                            'w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-left transition-colors cursor-pointer',
                            selectedFolderId === f.id
                              ? 'bg-red-500/10 text-red-500 font-semibold'
                              : 'text-[var(--foreground)] hover:bg-[var(--sidebar-primary)]'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderIcon
                              icon={f.icon}
                              className={clsx(
                                'text-xs',
                                selectedFolderId === f.id ? 'text-red-500' : 'text-[var(--muted)]'
                              )}
                            />
                            <span className="truncate">{f.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[var(--muted-bg)] text-[var(--muted)]">{counts[f.id] || 0}</span>
                            {selectedFolderId === f.id && <i className="ri-check-line text-red-500 text-xs" />}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Privacy Mode Dropdown (Blur sensitive data) */}
            <div className="relative" ref={privacyRef}>
              <button
                type="button"
                onClick={() => setIsPrivacyOpen(prev => !prev)}
                title={t.folders.privacyMode}
                className={clsx(
                  'h-[28px] flex items-center gap-1.5 px-2 rounded-[6px] border text-xs transition-colors cursor-pointer flex-shrink-0',
                  isPrivacyMode
                    ? 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20'
                    : 'bg-[var(--sidebar-primary)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-hover)]',
                  isPrivacyOpen && 'border-red-500/50 ring-1 ring-red-500/15'
                )}
              >
                <i className={clsx(isPrivacyMode ? 'ri-eye-off-line' : 'ri-eye-line', 'text-[13px] leading-none')} />
                <i
                  className={clsx(
                    'ri-arrow-down-s-line text-[10px] opacity-60 leading-none transition-transform duration-150',
                    isPrivacyOpen && 'rotate-180'
                  )}
                />
              </button>

              {isPrivacyOpen && (
                <div
                  className="absolute top-[calc(100%+4px)] left-0 w-52 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50 py-1 select-none animate-fade-in-scale"
                >
                  {/* Master option: Ocultar todos os dados */}
                  <button
                    type="button"
                    onClick={toggleAllPrivacy}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] font-semibold text-[var(--foreground)] hover:bg-[var(--sidebar-primary)] transition-colors cursor-pointer"
                  >
                    <span className="truncate">{t.folders.hideAllData}</span>
                    <div
                      className={clsx(
                        'w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors flex-shrink-0',
                        allPrivacySelected
                          ? 'bg-red-600 border-red-600 text-white'
                          : anyPrivacySelected
                          ? 'bg-red-600/15 border-red-500/40 text-red-500'
                          : 'border-[var(--border)] bg-[var(--sidebar-primary)] text-transparent'
                      )}
                    >
                      <i
                        className={clsx(
                          allPrivacySelected
                            ? 'ri-check-line'
                            : anyPrivacySelected
                            ? 'ri-subtract-line'
                            : 'ri-check-line',
                          'text-[10px] font-bold leading-none'
                        )}
                      />
                    </div>
                  </button>

                  <div className="my-1 border-t border-[var(--border)]/60" />

                  {/* Nome do perfil */}
                  <button
                    type="button"
                    onClick={() => togglePrivacyField('blurName')}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-[var(--foreground)] hover:bg-[var(--sidebar-primary)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <i className="ri-user-3-line text-xs text-[var(--muted)]" />
                      <span className="truncate">{t.folders.profileName}</span>
                    </div>
                    <div
                      className={clsx(
                        'w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors flex-shrink-0',
                        privacyConfig.blurName
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-[var(--border)] bg-[var(--sidebar-primary)] text-transparent'
                      )}
                    >
                      <i className="ri-check-line text-[10px] font-bold leading-none" />
                    </div>
                  </button>

                  {/* Proxy */}
                  <button
                    type="button"
                    onClick={() => togglePrivacyField('blurProxy')}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-[var(--foreground)] hover:bg-[var(--sidebar-primary)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <i className="ri-shield-keyhole-line text-xs text-[var(--muted)]" />
                      <span className="truncate">{t.folders.proxy}</span>
                    </div>
                    <div
                      className={clsx(
                        'w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors flex-shrink-0',
                        privacyConfig.blurProxy
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-[var(--border)] bg-[var(--sidebar-primary)] text-transparent'
                      )}
                    >
                      <i className="ri-check-line text-[10px] font-bold leading-none" />
                    </div>
                  </button>

                  {/* Notas */}
                  <button
                    type="button"
                    onClick={() => togglePrivacyField('blurNotes')}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] text-[var(--foreground)] hover:bg-[var(--sidebar-primary)] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <i className="ri-file-text-line text-xs text-[var(--muted)]" />
                      <span className="truncate">{t.folders.notes}</span>
                    </div>
                    <div
                      className={clsx(
                        'w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors flex-shrink-0',
                        privacyConfig.blurNotes
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'border-[var(--border)] bg-[var(--sidebar-primary)] text-transparent'
                      )}
                    >
                      <i className="ri-check-line text-[10px] font-bold leading-none" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Import Profile Button */}
            <button
              type="button"
              onClick={() => setIsImportProfileModalOpen(true)}
              title={t.actions.import}
              className="h-[28px] flex items-center gap-1.5 px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--sidebar-primary)] text-[var(--foreground)] text-[11.5px] font-medium hover:border-[var(--border-hover)] transition-colors cursor-pointer flex-shrink-0"
            >
              <i className="ri-upload-2-line text-xs text-[var(--muted)]" />
              <span>{t.actions.import}</span>
            </button>
          </div>
        </>
      ) : activeTab === 'folders' ? (
        <div className="flex-1 h-full flex items-center justify-between px-4 bg-[var(--card)] titlebar-no-drag">
          <div className="flex items-center gap-4">
            <BrandTextLogo heightClass="h-[15px]" />

            {/* Folder Search */}
            <div className="relative flex items-center w-64">
              <i className="ri-search-line absolute left-2.5 text-[var(--muted)] text-xs pointer-events-none" />
              <input
                type="text"
                value={folderSearchQuery}
                onChange={e => setFolderSearchQuery(e.target.value)}
                placeholder={t.foldersPage.searchPlaceholder}
                className="w-full h-[28px] bg-[var(--sidebar-primary)] text-[var(--foreground)] text-[11.5px] font-medium rounded-[6px] pl-7 pr-6 border border-[var(--border)] transition-all duration-150 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/10 placeholder:text-[var(--muted)] hover:border-[var(--border-hover)]"
              />
              {folderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setFolderSearchQuery('')}
                  className="absolute right-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
                >
                  <i className="ri-close-circle-fill text-xs" />
                </button>
              )}
            </div>
          </div>

          {/* New Folder Button */}
          <button
            type="button"
            onClick={() => setIsCreateFolderModalOpen(true)}
            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
            style={{ boxShadow: '0 2px 6px rgba(220,38,38,0.28)' }}
          >
            <i className="ri-add-line text-xs leading-none" />
            <span>{t.foldersPage.newFolder}</span>
          </button>
        </div>
      ) : activeTab === 'proxies' ? (
        <>
          {/* Secondary sidebar header for proxies */}
          <div className="w-56 h-full flex items-center justify-between px-3.5 flex-shrink-0 border-r border-[var(--border)]/50 bg-[var(--sidebar-secondary)] titlebar-no-drag">
            <BrandTextLogo heightClass="h-[15px]" />

            <button
              type="button"
              onClick={() => setIsCreateProxyModalOpen(true)}
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
              style={{ boxShadow: '0 2px 6px rgba(220,38,38,0.28)' }}
            >
              <i className="ri-add-line text-xs leading-none" />
              <span>{t.actions.create}</span>
            </button>
          </div>

          {/* Main content header for proxies */}
          <div className="flex-1 h-full flex items-center justify-between px-4 bg-[var(--card)] titlebar-no-drag">
            <div className="relative flex items-center w-64">
              <i className="ri-search-line absolute left-2.5 text-[var(--muted)] text-xs pointer-events-none" />
              <input
                type="text"
                value={proxySearchQuery}
                onChange={e => setProxySearchQuery(e.target.value)}
                placeholder={t.proxiesPage.searchPlaceholder}
                className="w-full h-[28px] bg-[var(--sidebar-primary)] text-[var(--foreground)] text-[11.5px] font-medium rounded-[6px] pl-7 pr-6 border border-[var(--border)] transition-all duration-150 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/10 placeholder:text-[var(--muted)] hover:border-[var(--border-hover)]"
              />
              {proxySearchQuery && (
                <button
                  type="button"
                  onClick={() => setProxySearchQuery('')}
                  className="absolute right-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
                >
                  <i className="ri-close-circle-fill text-xs" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsCreateProxyModalOpen(true)}
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer sm:hidden"
              style={{ boxShadow: '0 2px 6px rgba(220,38,38,0.28)' }}
            >
              <i className="ri-add-line text-xs leading-none" />
              <span>{t.proxiesPage.addProxy}</span>
            </button>
          </div>
        </>
      ) : activeTab === 'automations' ? (
        <>
          {/* Secondary sidebar header for automations */}
          <div className="w-56 h-full flex items-center justify-between px-3.5 flex-shrink-0 border-r border-[var(--border)]/50 bg-[var(--sidebar-secondary)] titlebar-no-drag">
            <BrandTextLogo heightClass="h-[15px]" />

            <button
              type="button"
              onClick={() => setIsCreateAutomationModalOpen(true)}
              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer"
              style={{ boxShadow: '0 2px 6px rgba(220,38,38,0.28)' }}
            >
              <i className="ri-add-line text-xs leading-none" />
              <span>{t.actions.create}</span>
            </button>
          </div>

          {/* Main content header for automations */}
          <div className="flex-1 h-full flex items-center justify-between px-4 bg-[var(--card)] titlebar-no-drag">
            <div className="relative flex items-center w-64">
              <i className="ri-search-line absolute left-2.5 text-[var(--muted)] text-xs pointer-events-none" />
              <input
                type="text"
                value={automationSearchQuery}
                onChange={e => setAutomationSearchQuery(e.target.value)}
                placeholder={t.automationsPage.searchPlaceholder}
                className="w-full h-[28px] bg-[var(--sidebar-primary)] text-[var(--foreground)] text-[11.5px] font-medium rounded-[6px] pl-7 pr-6 border border-[var(--border)] transition-all duration-150 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/10 placeholder:text-[var(--muted)] hover:border-[var(--border-hover)]"
              />
              {automationSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAutomationSearchQuery('')}
                  className="absolute right-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
                >
                  <i className="ri-close-circle-fill text-xs" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAiPromptModalOpen(true)}
                title={t.automationsPage.aiPromptTooltip}
                className="inline-flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-red-500/20 transition-all duration-150 cursor-pointer"
              >
                <i className="ri-sparkling-2-line text-xs" />
                <span>{t.automationsPage.aiPromptButton}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreateAutomationModalOpen(true)}
                className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 active:scale-[0.97] text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-150 cursor-pointer sm:hidden"
                style={{ boxShadow: '0 2px 6px rgba(220,38,38,0.28)' }}
              >
                <i className="ri-add-line text-xs leading-none" />
                <span>{t.automationsPage.newAutomation}</span>
              </button>
            </div>
          </div>
        </>
      ) : activeTab === 'referral' ? (
        <div className="flex-1 h-full flex items-center px-4 bg-[var(--card)] titlebar-no-drag">
          <div className="flex items-center gap-3">
            <BrandTextLogo heightClass="h-[15px]" />
            <span className="text-xs text-[var(--muted)]/40">/</span>
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {t.referralPage.title}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 h-full flex items-center px-4 bg-[var(--card)] titlebar-no-drag">
          <BrandTextLogo heightClass="h-[15px]" />
        </div>
      )}

      {/* Window Controls (Bloquear, Minimizar, Maximizar, Fechar) */}
      <div className="flex items-center h-full flex-shrink-0 titlebar-no-drag border-l border-[var(--border)]/40 bg-[var(--card)] z-30">
        {isSecurityEnabled && (
          <button
            type="button"
            onClick={lockApp}
            title={t.securityModal.lockAppNow}
            className="h-full px-3 text-[var(--muted)] hover:text-red-500 hover:bg-[var(--muted-bg)] transition-colors flex items-center justify-center cursor-pointer border-r border-[var(--border)]/40 group"
          >
            <i className="ri-lock-line text-xs transition-transform group-hover:scale-110" />
          </button>
        )}
        <button
          type="button"
          onClick={() => window.geenjutsuApi?.minimize()}
          title="Minimizar"
          className="h-full px-3.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors flex items-center justify-center cursor-pointer"
        >
          <i className="ri-subtract-line text-xs" />
        </button>
        <button
          type="button"
          onClick={() => window.geenjutsuApi?.maximize()}
          title="Maximizar"
          className="h-full px-3.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors flex items-center justify-center cursor-pointer"
        >
          <i className="ri-checkbox-blank-line text-[11px]" />
        </button>
        <button
          type="button"
          onClick={handleCloseApp}
          title="Fechar"
          className="h-full px-4 text-[var(--muted)] hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors flex items-center justify-center cursor-pointer"
        >
          <i className="ri-close-line text-base" />
        </button>
      </div>
    </header>
  );
};
