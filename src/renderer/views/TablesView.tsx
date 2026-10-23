import React from 'react';
import { useTables } from '../context/TableContext';
import { TablesTable } from '../components/tables/TablesTable';
import { TableDetailView } from '../components/tables/TableDetailView';
import { CreateTableModal } from '../components/tables/modals/CreateTableModal';
import { AddColumnModal } from '../components/tables/modals/AddColumnModal';
import { DuplicateTableModal } from '../components/tables/modals/DuplicateTableModal';
import { ProfilePickerModal } from '../components/tables/modals/ProfilePickerModal';

export const TablesView: React.FC = () => {
  const { activeTable } = useTables();

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-card">
      {activeTable ? <TableDetailView /> : <TablesTable />}

      {/* Tables Modals */}
      <CreateTableModal />
      <AddColumnModal />
      <DuplicateTableModal />
      <ProfilePickerModal />
    </div>
  );
};
