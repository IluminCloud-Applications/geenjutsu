import React from 'react';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { FolderRow } from './FolderRow';
import { Button } from '../ui/Button';

export const FolderTable: React.FC = () => {
  const {
    filteredFolders,
    setIsCreateFolderModalOpen,
    counts,
    setSelectedFolderId,
    setActiveTab,
  } = useProfiles();
  const { t } = useI18n();

  return (
    <div className="flex-1 w-full overflow-y-auto bg-[var(--card)] select-none pb-12">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-[var(--table-header)] border-b border-[var(--table-border)]">
          <tr>
            <th className="py-2.5 px-5 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[30%]">
              {t.foldersPage.tableFolder}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[35%]">
              {t.foldersPage.tableDescription}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[15%]">
              {t.foldersPage.tableProfiles}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[10%]">
              {t.foldersPage.tableCreated}
            </th>
            <th className="py-2.5 px-4 w-32 text-right text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase">
              {t.foldersPage.tableActions}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Unassigned / Sem pasta row */}
          <tr className="border-b border-[var(--table-border)] hover:bg-[var(--table-row-hover)] transition-colors group">
            <td className="py-2.5 px-5">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[var(--muted-bg)] flex items-center justify-center text-[var(--muted)]">
                  <i className="ri-folder-line text-xs" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--foreground)]">{t.foldersPage.unassigned}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)] font-mono">
                    {t.foldersPage.systemFolderBadge || 'Sistema'}
                  </span>
                </div>
              </div>
            </td>
            <td className="py-2.5 px-4 text-xs text-[var(--muted)] truncate max-w-xs">
              {t.foldersPage.unassignedDesc}
            </td>
            <td className="py-2.5 px-4">
              <span className="text-xs font-mono font-medium text-[var(--foreground)]">
                {counts.unassigned}
              </span>
            </td>
            <td className="py-2.5 px-4 text-xs font-mono text-[var(--muted)]">
              —
            </td>
            <td className="py-2.5 px-4 text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFolderId('unassigned');
                  setActiveTab('profiles');
                }}
              >
                <i className="ri-arrow-right-line mr-1 text-xs" />
                {t.actions.viewProfiles}
              </Button>
            </td>
          </tr>

          {filteredFolders.length > 0 ? (
            filteredFolders.map(folder => (
              <FolderRow key={folder.id} folder={folder} />
            ))
          ) : counts.unassigned === 0 ? (
            <tr>
              <td colSpan={5} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--muted-bg)] flex items-center justify-center">
                    <i className="ri-folder-add-line text-xl text-[var(--muted)]" />
                  </div>
                  <span className="text-[12.5px] text-[var(--muted)] font-medium">
                    {t.foldersPage.emptyTitle}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateFolderModalOpen(true)}
                  >
                    <i className="ri-add-line mr-1" />
                    {t.foldersPage.newFolder}
                  </Button>
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};
