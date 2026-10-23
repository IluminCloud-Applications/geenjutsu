import React, { useState, useMemo } from 'react';
import { useProfiles } from '../../../context/ProfileContext';
import { useTables } from '../../../context/TableContext';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { formatDateTime } from '../../../utils/dateFormatter';

export const ProfilePickerModal: React.FC = () => {
  const { profiles, folders } = useProfiles();
  const { profilePickerTarget, setProfilePickerTarget, updateCell } = useTables();
  const [search, setSearch] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');

  const isOpen = profilePickerTarget !== null;

  const handleClose = () => {
    setProfilePickerTarget(null);
    setSearch('');
    setSelectedFolderFilter('all');
  };

  const folderOptions = useMemo(() => [
    { value: 'all', label: 'Todas as Pastas', icon: 'ri-folder-line' },
    { value: 'unassigned', label: 'Sem Pasta', icon: 'ri-folder-line' },
    ...folders.map(f => ({
      value: f.id,
      label: f.name,
      icon: f.icon || 'ri-folder-line',
    })),
  ], [folders]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      // Exclude trashed profiles
      if (p.isTrash) return false;

      if (selectedFolderFilter !== 'all') {
        if (selectedFolderFilter === 'unassigned') {
          if (p.folderId) return false;
        } else if (p.folderId !== selectedFolderFilter) {
          return false;
        }
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesNotes = p.notes && p.notes.toLowerCase().includes(q);
        const matchesTags = p.tags && p.tags.some(t => t.toLowerCase().includes(q));
        if (!matchesName && !matchesNotes && !matchesTags) return false;
      }

      return true;
    });
  }, [profiles, search, selectedFolderFilter]);

  const selectProfile = (profileId: string) => {
    if (profilePickerTarget) {
      updateCell(profilePickerTarget.rowId, profilePickerTarget.columnId, profileId);
    }
    handleClose();
  };

  const handleUnlink = () => {
    if (profilePickerTarget) {
      updateCell(profilePickerTarget.rowId, profilePickerTarget.columnId, null);
    }
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Vincular Perfil Geenjutsu"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {profilePickerTarget?.currentProfileId && (
              <Button variant="danger" size="sm" onClick={handleUnlink}>
                <i className="ri-link-unlink mr-1.5" />
                Desvincular Atual
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Search & Folder Filters */}
        <div className="flex items-center gap-2.5">
          <div className="flex-1">
            <Input
              icon="ri-search-line"
              placeholder="Buscar por nome ou tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="w-48 flex-shrink-0">
            <Select
              value={selectedFolderFilter}
              onChange={setSelectedFolderFilter}
              options={folderOptions}
            />
          </div>
        </div>

        {/* Profiles Table View */}
        <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)]">
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--table-header)] border-b border-[var(--table-border)]">
                <tr>
                  <th className="py-2 px-3 text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[34%]">
                    Perfil
                  </th>
                  <th className="py-2 px-3 text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[22%]">
                    Pasta
                  </th>
                  <th className="py-2 px-3 text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[20%]">
                    Tags
                  </th>
                  <th className="py-2 px-3 text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[14%] whitespace-nowrap">
                    Criado em
                  </th>
                  <th className="py-2 px-3 text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[10%] text-right">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--table-border)]">
                {filteredProfiles.length > 0 ? (
                  filteredProfiles.map(p => {
                    const isCurrent = profilePickerTarget?.currentProfileId === p.id;
                    const isRunning = p.status === 'running';
                    const isLaunching = p.status === 'launching';
                    const folder = folders.find(f => f.id === p.folderId);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => selectProfile(p.id)}
                        className={`group transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-red-500/10 hover:bg-red-500/15'
                            : 'hover:bg-[var(--table-row-hover)]'
                        }`}
                      >
                        {/* Profile Name + Status */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                isRunning
                                  ? 'bg-emerald-500 ring-2 ring-emerald-500/30'
                                  : isLaunching
                                  ? 'bg-blue-500 animate-pulse'
                                  : 'bg-[var(--muted)]/40'
                              }`}
                            />
                            <span className="text-xs font-semibold text-[var(--foreground)] truncate group-hover:text-red-500 transition-colors">
                              {p.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[9.5px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.2 rounded font-mono flex-shrink-0">
                                Atual
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Folder */}
                        <td className="py-2 px-3 text-xs text-[var(--muted)]">
                          <div className="flex items-center gap-1.5 truncate">
                            <i className={folder?.icon || 'ri-folder-line'} />
                            <span className="truncate">{folder ? folder.name : 'Sem pasta'}</span>
                          </div>
                        </td>

                        {/* Tags */}
                        <td className="py-2 px-3">
                          {p.tags && p.tags.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {p.tags.slice(0, 2).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)] font-medium truncate max-w-[90px]"
                                >
                                  {tag}
                                </span>
                              ))}
                              {p.tags.length > 2 && (
                                <span className="text-[9.5px] text-[var(--muted)] font-mono">
                                  +{p.tags.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--muted)]/50">—</span>
                          )}
                        </td>

                        {/* Created At (DD/MM HH:mm) */}
                        <td className="py-2 px-3 text-[11px] font-mono text-[var(--muted)] whitespace-nowrap">
                          {formatDateTime(p.createdAt)}
                        </td>

                        {/* Action */}
                        <td className="py-2 px-3 text-right">
                          <Button
                            variant={isCurrent ? 'primary' : 'ghost'}
                            size="sm"
                            className="text-[11px] py-1 px-2.5 h-6 font-medium"
                          >
                            {isCurrent ? 'Selecionado' : 'Selecionar'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <i className="ri-user-search-line text-2xl text-[var(--muted)]" />
                        <span className="text-xs text-[var(--muted)]">
                          Nenhum perfil encontrado com os filtros atuais
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
