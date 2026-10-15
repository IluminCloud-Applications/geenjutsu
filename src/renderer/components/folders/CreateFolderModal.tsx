import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FolderIconPicker } from './FolderIconPicker';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

export const CreateFolderModal: React.FC = () => {
  const { isCreateFolderModalOpen, setIsCreateFolderModalOpen, addFolder } = useProfiles();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('ri-folder-3-line');

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    addFolder(name.trim(), description.trim() || undefined, icon);
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIcon('ri-folder-3-line');
    setIsCreateFolderModalOpen(false);
  };

  return (
    <Modal
      isOpen={isCreateFolderModalOpen}
      onClose={handleClose}
      title={t.foldersPage.newFolder}
      maxWidth="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            {t.foldersPage.createFolder}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Folder Name & Icon Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.foldersPage.folderName}
          </label>
          <div className="flex items-center gap-2">
            <FolderIconPicker value={icon} onChange={setIcon} />
            <Input
              id="new-folder-name"
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
