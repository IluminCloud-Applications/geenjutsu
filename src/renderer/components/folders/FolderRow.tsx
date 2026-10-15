import React, { useState } from 'react';
import { Folder } from '../../types';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { ContextMenu } from '../ui/ContextMenu';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FolderIconPicker } from './FolderIconPicker';

interface FolderRowProps {
  folder: Folder;
}

export const FolderRow: React.FC<FolderRowProps> = ({ folder }) => {
  const {
    counts,
    setSelectedFolderId,
    setActiveTab,
    setEditingFolder,
    deleteFolder,
    updateFolder,
  } = useProfiles();
  const { t } = useI18n();

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descValue, setDescValue] = useState(folder.description || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const profileCount = counts[folder.id] || 0;
  const isDefaultSystem = folder.id === 'default' || folder.isSystem;

  const handleSaveDescription = () => {
    updateFolder({
      id: folder.id,
      description: descValue.trim(),
    });
    setIsEditingDescription(false);
  };

  const handleViewProfiles = () => {
    setSelectedFolderId(folder.id);
    setActiveTab('profiles');
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) return t.table.today;
    return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const menuItems: DropdownItem[] = [
    {
      label: t.actions.edit,
      icon: 'ri-edit-line',
      onClick: () => setEditingFolder(folder),
    },
    {
      label: t.foldersPage.viewProfiles,
      icon: 'ri-global-line',
      onClick: handleViewProfiles,
    },
    ...(!isDefaultSystem
      ? [
          {
            label: t.actions.delete,
            icon: 'ri-delete-bin-line',
            onClick: () => setConfirmDelete(true),
            danger: true,
            divider: true,
          },
        ]
      : []),
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
        {/* Folder Name & Icon */}
        <td className="py-3 px-5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Clickable Icon / Emoji Picker */}
            <FolderIconPicker
              value={folder.icon}
              onChange={newIcon => updateFolder({ id: folder.id, icon: newIcon })}
            />

            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-semibold text-[var(--foreground)] tracking-tight truncate">
                  {folder.name}
                </span>
                {isDefaultSystem && (
                  <Badge
                    label={t.foldersPage.systemFolderBadge}
                    variant="neutral"
                    className="text-[9.5px] px-1.5 py-0"
                  />
                )}
              </div>
              <span className="text-[10px] text-[var(--muted)] opacity-75">
                ID: {folder.id}
              </span>
            </div>
          </div>
        </td>

        {/* Notes / Description */}
        <td className="py-3 px-4 text-[12px] text-[var(--muted)] max-w-[280px]">
          {isEditingDescription ? (
            <input
              autoFocus
              type="text"
              value={descValue}
              onChange={e => setDescValue(e.target.value)}
              onBlur={handleSaveDescription}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveDescription();
                if (e.key === 'Escape') {
                  setDescValue(folder.description || '');
                  setIsEditingDescription(false);
                }
              }}
              placeholder={t.foldersPage.descriptionPlaceholder}
              className="w-full bg-[var(--muted-bg)] border border-[var(--border)] rounded-md px-2 py-1 text-[12px] text-[var(--foreground)] focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/10 placeholder:text-[var(--muted)]"
            />
          ) : (
            <span
              onClick={() => setIsEditingDescription(true)}
              className="cursor-text hover:text-[var(--foreground)] transition-colors inline-block w-full truncate"
              title={folder.description || t.foldersPage.clickToEditDescription}
            >
              {folder.description || (
                <span className="opacity-30 group-hover:opacity-60 transition-opacity">
                  + {t.foldersPage.description}
                </span>
              )}
            </span>
          )}
        </td>

        {/* Linked Profiles Badge */}
        <td className="py-3 px-4 whitespace-nowrap">
          <button
            type="button"
            onClick={handleViewProfiles}
            title={t.foldersPage.viewProfiles}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--muted-bg)] hover:bg-[var(--border)] border border-[var(--border)] text-[11px] font-semibold text-[var(--foreground)] transition-colors cursor-pointer group/badge"
          >
            <i className="ri-user-line text-[11px] text-[var(--muted)] group-hover/badge:text-red-500 transition-colors" />
            <span>
              {profileCount} {profileCount === 1 ? t.foldersPage.singleProfile : t.foldersPage.pluralProfiles}
            </span>
            <i className="ri-arrow-right-s-line text-[12px] text-[var(--muted)] opacity-0 group-hover/badge:opacity-100 transition-opacity -ml-0.5" />
          </button>
        </td>

        {/* Created Date */}
        <td className="py-3 px-4 text-[12px] text-[var(--muted)] whitespace-nowrap">
          {formatDate(folder.createdAt)}
        </td>

        {/* Actions */}
        <td className="py-3 px-4 text-right whitespace-nowrap">
          <div className="inline-flex items-center justify-end gap-1.5 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewProfiles}
              className="text-[11px] h-7 px-2"
            >
              <i className="ri-folder-open-line text-xs mr-1 text-[var(--muted)]" />
              <span>{t.foldersPage.viewProfiles}</span>
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

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={menuItems} onClose={() => setContextMenu(null)} />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteFolder(folder.id)}
        title={t.foldersPage.deleteConfirmTitle}
        description={t.foldersPage.deleteConfirmDesc(folder.name)}
        confirmLabel={t.actions.delete}
        danger={true}
      />
    </>
  );
};
