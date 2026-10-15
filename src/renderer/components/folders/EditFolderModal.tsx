import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FolderIconPicker } from './FolderIconPicker';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

export const EditFolderModal: React.FC = () => {
  const { editingFolder, setEditingFolder, updateFolder } = useProfiles();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('ri-folder-3-line');

  useEffect(() => {
    if (editingFolder) {
      setName(editingFolder.name || '');
      setDescription(editingFolder.description || '');
      setIcon(editingFolder.icon || 'ri-folder-3-line');
    }
  }, [editingFolder]);

  if (!editingFolder) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    updateFolder({
      id: editingFolder.id,
      name: name.trim(),
      description: description.trim(),
      icon: icon || 'ri-folder-3-line',
    });

    setEditingFolder(null);
  };

  const handleClose = () => {
    setEditingFolder(null);
  };

  return (
    <Modal
      isOpen={!!editingFolder}
      onClose={handleClose}
      title={t.foldersPage.editFolder}
      maxWidth="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {t.actions.save}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Folder Name & Icon Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.foldersPage.folderName}
          </label>
          <div className="flex items-center gap-2">
            <FolderIconPicker value={icon} onChange={setIcon} />
            <Input
              id="edit-folder-name"
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.foldersPage.namePlaceholder}
              className="flex-1"
            />
          </div>
        </div>

        {/* Notes / Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.foldersPage.description}
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t.foldersPage.descriptionPlaceholder}
            className="w-full bg-[var(--muted-bg)] text-[var(--foreground)] text-[12.5px] font-medium rounded-lg border border-[var(--border)] px-3 py-2 transition-all duration-150 focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10 hover:border-[var(--border-hover)] placeholder:text-[var(--muted)] placeholder:font-normal resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};
