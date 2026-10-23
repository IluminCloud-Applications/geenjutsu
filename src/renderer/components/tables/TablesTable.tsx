import React from 'react';
import { useTables } from '../../context/TableContext';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { formatDateTime } from '../../utils/dateFormatter';
import { TableSummary } from '../../../types/table';

export const TablesTable: React.FC = () => {
  const {
    filteredTables,
    openTable,
    deleteTable,
    duplicateTable,
    setTargetDuplicateTable,
    setIsDuplicateModalOpen,
    setIsCreateTableModalOpen,
  } = useTables();
  const { t } = useI18n();

  return (
    <div className="flex-1 w-full overflow-y-auto bg-[var(--card)] select-none pb-12">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-[var(--table-header)] border-b border-[var(--table-border)]">
          <tr>
            <th className="py-2.5 px-5 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[30%]">
              {t.tablesPage.table || 'Tabela'}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[32%]">
              {t.foldersPage.tableDescription || 'Descrição'}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[10%]">
              {t.tablesPage.columns || 'Colunas'}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[10%]">
              {t.tablesPage.rows || 'Linhas'}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[10%] whitespace-nowrap">
              {t.foldersPage.tableCreated || 'Criado em'}
            </th>
            <th className="py-2.5 px-4 w-32 text-right text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase">
              {t.foldersPage.tableActions || 'Ações'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredTables.length > 0 ? (
            filteredTables.map((table: TableSummary) => (
              <tr
                key={table.id}
                onClick={() => openTable(table.id)}
                className="group border-b border-[var(--table-border)] transition-colors duration-100 hover:bg-[var(--table-row-hover)] cursor-pointer"
              >
                {/* Table Name & Icon */}
                <td className="py-3 px-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white shadow-xs flex-shrink-0"
                      style={{ backgroundColor: table.color || '#EF4444' }}
                    >
                      <i className={table.icon || 'ri-table-line'} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--foreground)] truncate group-hover:text-red-500 transition-colors">
                      {table.name}
                    </span>
                  </div>
                </td>

                {/* Description */}
                <td className="py-3 px-4 text-xs text-[var(--muted)] truncate max-w-xs">
                  {table.description || '—'}
                </td>

                {/* Columns Count */}
                <td className="py-3 px-4">
                  <span className="text-xs font-mono font-medium text-[var(--foreground)]">
                    {table.columnCount}
                  </span>
                </td>

                {/* Rows Count */}
                <td className="py-3 px-4">
                  <span className="text-xs font-mono font-medium text-[var(--foreground)]">
                    {table.rowCount}
                  </span>
                </td>

                {/* Created At formatted DD/MM HH:mm */}
                <td className="py-3 px-4 text-xs font-mono text-[var(--muted)] whitespace-nowrap">
                  {formatDateTime(table.createdAt)}
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openTable(table.id)}
                    >
                      <i className="ri-arrow-right-line mr-1 text-xs" />
                      {t.tablesPage.openTable || 'Abrir'}
                    </Button>

                    <Dropdown
                      align="right"
                      trigger={
                        <button
                          type="button"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
                        >
                          <i className="ri-more-2-fill text-sm" />
                        </button>
                      }
                      items={[
                        {
                          label: t.tablesPage.duplicateWithData || 'Duplicar com Dados',
                          icon: 'ri-file-copy-line',
                          onClick: () => duplicateTable(table.id, true),
                        },
                        {
                          label: t.tablesPage.duplicateWithoutData || 'Duplicar sem Dados',
                          icon: 'ri-file-copy-2-line',
                          onClick: () => duplicateTable(table.id, false),
                        },
                        {
                          label: 'Personalizar Cópia...',
                          icon: 'ri-settings-4-line',
                          onClick: () => {
                            setTargetDuplicateTable(table);
                            setIsDuplicateModalOpen(true);
                          },
                        },
                        {
                          label: t.tablesPage.deleteTable || 'Excluir',
                          icon: 'ri-delete-bin-line',
                          danger: true,
                          divider: true,
                          onClick: async () => {
                            if (window.confirm(t.tablesPage.confirmDeleteTable)) {
                              await deleteTable(table.id);
                            }
                          },
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--muted-bg)] flex items-center justify-center">
                    <i className="ri-table-line text-xl text-[var(--muted)]" />
                  </div>
                  <span className="text-[12.5px] text-[var(--muted)] font-medium">
                    {t.tablesPage.emptyTitle || 'Nenhuma tabela criada ainda'}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateTableModalOpen(true)}
                  >
                    <i className="ri-add-line mr-1" />
                    {t.tablesPage.newTable || 'Nova Tabela'}
                  </Button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
