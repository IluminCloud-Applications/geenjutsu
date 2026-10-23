import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useTables } from '../../context/TableContext';
import { useI18n } from '../../context/I18nContext';
import { Dropdown } from '../ui/Dropdown';

export const TableSidebar: React.FC = () => {
  const {
    tables,
    activeTable,
    openTable,
    closeTable,
    deleteTable,
    duplicateTable,
    setTargetDuplicateTable,
    setIsDuplicateModalOpen,
  } = useTables();
  const { t } = useI18n();

  const [activeMenuTableId, setActiveMenuTableId] = useState<string | null>(null);

  const navItemClass = (isActive: boolean) =>
    clsx(
      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-100 cursor-pointer group',
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
      {/* 1. System Navigation: Todas as Tabelas */}
      <div className="space-y-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => closeTable()}
          className={navItemClass(!activeTable)}
        >
          <div className="flex items-center gap-2.5 truncate">
            <i className={clsx(iconClass(!activeTable), 'ri-table-line')} />
            <span className="truncate">{t.tablesPage.allTables || 'Todas as Tabelas'}</span>
          </div>
          <span className={badgeClass(!activeTable)}>{tables.length}</span>
        </button>
      </div>

      {/* Divider */}
      <div className="my-2.5 px-1 flex-shrink-0">
        <div className="border-t border-[var(--border)]/60" />
      </div>

      {/* Section Header */}
      <div className="px-2.5 pb-1.5 flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] font-semibold text-[var(--muted)] tracking-wider uppercase">
          {t.tablesPage.title || 'Tabelas'}
        </span>
        <span className="text-[10px] font-mono text-[var(--muted)]">
          {tables.length}
        </span>
      </div>

      {/* Scrollable list of custom tables */}
      <div
        className="flex-1 overflow-y-auto space-y-0.5 -mx-0 pr-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tables.length > 0 ? (
          tables.map(tbl => {
            const isActive = activeTable?.id === tbl.id;
            return (
              <div
                key={tbl.id}
                onClick={() => openTable(tbl.id)}
                className={navItemClass(isActive)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 text-white shadow-2xs"
                    style={{ backgroundColor: tbl.color || '#EF4444' }}
                  >
                    <i className={tbl.icon || 'ri-table-line'} />
                  </div>
                  <span className="truncate">{tbl.name}</span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className={badgeClass(isActive)}>
                    {tbl.rowCount}
                  </span>

                  {/* Dropdown Options */}
                  <div onClick={e => e.stopPropagation()}>
                    <Dropdown
                      align="right"
                      trigger={
                        <button
                          type="button"
                          className="w-4 h-4 rounded flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <i className="ri-more-2-fill text-[11px]" />
                        </button>
                      }
                      items={[
                        {
                          label: t.tablesPage.openTable || 'Abrir Tabela',
                          icon: 'ri-external-link-line',
                          onClick: () => openTable(tbl.id),
                        },
                        {
                          label: t.tablesPage.duplicateWithData || 'Duplicar com Dados',
                          icon: 'ri-file-copy-line',
                          onClick: () => duplicateTable(tbl.id, true),
                        },
                        {
                          label: t.tablesPage.duplicateWithoutData || 'Duplicar sem Dados',
                          icon: 'ri-file-copy-2-line',
                          onClick: () => duplicateTable(tbl.id, false),
                        },
                        {
                          label: 'Personalizar Cópia...',
                          icon: 'ri-settings-4-line',
                          onClick: () => {
                            setTargetDuplicateTable(tbl);
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
                              await deleteTable(tbl.id);
                            }
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-2.5 py-6 text-center">
            <span className="text-[11px] text-[var(--muted)]">
              {t.tablesPage.emptyTitle || 'Nenhuma tabela criada'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
