import React from 'react';
import { FolderTable } from '../components/folders/FolderTable';
import { CreateFolderModal } from '../components/folders/CreateFolderModal';
import { EditFolderModal } from '../components/folders/EditFolderModal';

export const FoldersView: React.FC = () => {
  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-card">
      <FolderTable />
      <CreateFolderModal />
      <EditFolderModal />
    </div>
  );
};
