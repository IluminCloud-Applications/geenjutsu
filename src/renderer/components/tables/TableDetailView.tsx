import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTables } from '../../context/TableContext';
import { useI18n } from '../../context/I18nContext';
import { TableColumn, TableColumnType } from '../../../types/table';
import { TextCell } from './cells/TextCell';
import { NumberCell } from './cells/NumberCell';
import { SelectCell } from './cells/SelectCell';
import { ProfileCell } from './cells/ProfileCell';
import { PasswordCell } from './cells/PasswordCell';
import { DateCell } from './cells/DateCell';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';

const DEFAULT_WIDTHS: Record<TableColumnType, number> = {
  text: 200,
  number: 140,
  select: 170,
  profile: 210,
  password: 160,
  date: 160,
};

export const TableDetailView: React.FC = () => {
  const {
    activeTable,
    closeTable,
    addRow,
    updateCell,
    deleteRow,
    deleteColumn,
    setIsAddColumnModalOpen,
    setTargetDuplicateTable,
    setIsDuplicateModalOpen,
    deleteTable,
    updateTableInfo,
    rowSearchQuery,
  } = useTables();
  const { t } = useI18n();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  // Column width cache in localStorage
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const cached = localStorage.getItem(`geenjutsu:col-widths:${activeTable?.id}`);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!activeTable) return;
    try {
      const cached = localStorage.getItem(`geenjutsu:col-widths:${activeTable.id}`);
      if (cached) {
        setColumnWidths(JSON.parse(cached));
      } else {
        setColumnWidths({});
      }
    } catch {
      setColumnWidths({});
    }
  }, [activeTable?.id]);

  const getColumnWidth = useCallback(
    (col: TableColumn) => {
      return columnWidths[col.id] || DEFAULT_WIDTHS[col.type] || 180;
    },
    [columnWidths]
  );

  const resizingColRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const handleStartResize = (colId: string, colType: TableColumnType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currentWidth = columnWidths[colId] || DEFAULT_WIDTHS[colType] || 180;
    resizingColRef.current = {
      colId,
      startX: e.clientX,
      startWidth: currentWidth,
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const delta = moveEvent.clientX - resizingColRef.current.startX;
      const nextWidth = Math.max(80, Math.min(800, resizingColRef.current.startWidth + delta));
      setColumnWidths(prev => ({
        ...prev,
        [resizingColRef.current!.colId]: nextWidth,
      }));
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (resizingColRef.current && activeTable) {
        setColumnWidths(latest => {
          try {
            localStorage.setItem(
              `geenjutsu:col-widths:${activeTable.id}`,
              JSON.stringify(latest)
            );
          } catch (err) {
            console.error('Failed to cache column widths', err);
          }
          return latest;
        });
      }
      resizingColRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!activeTable) return null;

  const handleTitleCommit = () => {
    setEditingTitle(false);
    if (titleDraft.trim() && titleDraft.trim() !== activeTable.name) {
      updateTableInfo(activeTable.id, { name: titleDraft.trim() });
    }
  };

  const handleAddRow = async () => {
    await addRow();
  };

  // Filter rows by text in any column
  const displayedRows = useMemo(() => {
    if (!rowSearchQuery.trim()) return activeTable.rows;
    const q = rowSearchQuery.toLowerCase().trim();
    return activeTable.rows.filter(row => {
      return Object.values(row.data || {}).some(val =>
        String(val || '').toLowerCase().includes(q)
      );
    });
  }, [activeTable.rows, rowSearchQuery]);

  const getColumnTypeIcon = (type: TableColumnType) => {
    switch (type) {
      case 'text':
        return 'ri-text';
      case 'number':
        return 'ri-hashtag';
      case 'select':
        return 'ri-list-check';
      case 'profile':
        return 'ri-global-line';
      case 'password':
        return 'ri-lock-password-line';
      case 'date':
        return 'ri-calendar-line';
      default:
        return 'ri-layout-column-line';
    }
  };

  const getColumnTypeBadge = (type: TableColumnType) => {
    switch (type) {
      case 'text':
        return 'Texto';
      case 'number':
        return 'Número';
      case 'select':
        return 'Seleção';
      case 'profile':
        return 'Perfil';
      case 'password':
        return 'Senha';
      case 'date':
        return 'Data';
      default:
        return type;
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--card)] select-none overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-11 px-4 flex items-center justify-between border-b border-[var(--border)]/60 bg-[var(--sidebar-primary)]/20 gap-4 flex-shrink-0">
        {/* Left: Back button + Table icon & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={closeTable}
            title={t.tablesPage.backToTables}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer flex-shrink-0"
          >
            <i className="ri-arrow-left-line text-sm" />
          </button>

          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs shadow-xs flex-shrink-0"
            style={{ backgroundColor: activeTable.color || '#EF4444' }}
          >
            <i className={activeTable.icon || 'ri-table-line'} />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            {editingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={handleTitleCommit}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleTitleCommit();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                autoFocus
                className="h-6 px-1.5 text-xs font-bold bg-[var(--card)] text-[var(--foreground)] rounded border border-red-500/70 focus:outline-none"
              />
            ) : (
              <div
                onClick={() => {
                  setTitleDraft(activeTable.name);
                  setEditingTitle(true);
                }}
                className="group/title flex items-center gap-1.5 cursor-pointer min-w-0"
                title="Clique para renomear a tabela"
              >
                <h2 className="text-xs font-bold text-[var(--foreground)] truncate group-hover:text-red-500 transition-colors">
                  {activeTable.name}
                </h2>
                <i className="ri-edit-line text-[11px] text-[var(--muted)] opacity-0 group-hover/title:opacity-100 transition-opacity" />
              </div>
            )}

            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]/40 flex-shrink-0">
              {activeTable.rows.length} {t.tablesPage.rows}
            </span>
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Add Row Button */}
          <Button
            variant="primary"
            size="sm"
            icon="ri-add-line"
            onClick={handleAddRow}
            className="font-semibold shadow-xs text-xs h-7 px-2.5"
          >
            {t.tablesPage.addRow}
          </Button>

          {/* Add Column Button */}
          <Button
            variant="secondary"
            size="sm"
            icon="ri-layout-column-line"
            onClick={() => setIsAddColumnModalOpen(true)}
            className="text-xs h-7 px-2.5"
          >
            {t.tablesPage.addColumn}
          </Button>

          {/* More Actions Dropdown */}
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] border border-[var(--border)] transition-colors cursor-pointer"
              >
                <i className="ri-more-2-fill text-sm" />
              </button>
            }
            items={[
              {
                label: t.tablesPage.duplicateModalTitle,
                icon: 'ri-file-copy-line',
                onClick: () => {
                  setTargetDuplicateTable({
                    id: activeTable.id,
                    name: activeTable.name,
                    description: activeTable.description,
                    icon: activeTable.icon,
                    color: activeTable.color,
                    columnCount: activeTable.columns.length,
                    rowCount: activeTable.rows.length,
                    createdAt: activeTable.createdAt,
                    updatedAt: activeTable.updatedAt,
                  });
                  setIsDuplicateModalOpen(true);
                },
              },
              {
                label: t.tablesPage.deleteTable,
                icon: 'ri-delete-bin-line',
                danger: true,
                divider: true,
                onClick: async () => {
                  if (window.confirm(t.tablesPage.confirmDeleteTable)) {
                    await deleteTable(activeTable.id);
                  }
                },
              },
            ]}
          />
        </div>
      </div>

      {/* Spreadsheet Main Canvas */}
      <div className="flex-1 overflow-auto bg-[var(--card)]">
        <table
          className="min-w-full border-separate border-spacing-0 text-left"
          style={{ tableLayout: 'fixed' }}
        >
          {/* Columns Header */}
          <thead className="sticky top-0 z-20 bg-[var(--table-header)] shadow-sm">
            <tr>
              {/* Row Index / Delete header cell */}
              <th
                style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
                className="w-12 min-w-[48px] py-2 px-2 text-center text-[10.5px] font-mono text-[var(--muted)] uppercase border-b border-r border-[var(--table-border)] bg-[var(--table-header)] overflow-hidden"
              >
                #
              </th>

              {/* Dynamic Columns Headers */}
              {activeTable.columns.map(col => {
                const colW = getColumnWidth(col);
                return (
                  <th
                    key={col.id}
                    style={{
                      width: `${colW}px`,
                      minWidth: `${colW}px`,
                      maxWidth: `${colW}px`,
                    }}
                    className="relative py-2 px-3 border-b border-r border-[var(--table-border)] bg-[var(--table-header)] group select-none overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-1.5 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <i
                          className={`${getColumnTypeIcon(
                            col.type
                          )} text-xs text-[var(--muted)] flex-shrink-0`}
                        />
                        <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                          {col.name}
                        </span>
                        <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]/40 flex-shrink-0">
                          {getColumnTypeBadge(col.type)}
                        </span>
                      </div>

                      {/* Column Menu (Excluir coluna) */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Dropdown
                          align="right"
                          trigger={
                            <button
                              type="button"
                              className="w-5 h-5 flex items-center justify-center rounded text-[var(--muted)] hover:text-red-500 hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
                            >
                              <i className="ri-more-2-fill text-xs" />
                            </button>
                          }
                          items={[
                            {
                              label: t.tablesPage.deleteColumn,
                              icon: 'ri-delete-bin-line',
                              danger: true,
                              onClick: () => {
                                if (
                                  window.confirm(
                                    `Tem certeza que deseja excluir a coluna "${col.name}"? Os dados dela serão apagados de todas as linhas.`
                                  )
                                ) {
                                  deleteColumn(col.id);
                                }
                              },
                            },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Column Resizer Handle */}
                    <div
                      onMouseDown={e => handleStartResize(col.id, col.type, e)}
                      className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-red-500 active:bg-red-600 transition-colors z-20 group-hover:bg-[var(--border)]/70"
                      title="Arraste para redimensionar"
                    />
                  </th>
                );
              })}

              {/* Add column quick header button */}
              <th
                style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                className="w-24 min-w-[100px] py-1 px-2 border-b border-[var(--table-border)] bg-[var(--table-header)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setIsAddColumnModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-md text-[11px] font-medium text-[var(--muted)] hover:text-red-500 hover:bg-[var(--muted-bg)] border border-dashed border-[var(--border)] transition-colors cursor-pointer"
                >
                  <i className="ri-add-line text-xs" />
                  <span>Coluna</span>
                </button>
              </th>
            </tr>
          </thead>

          {/* Table Rows */}
          <tbody>
            {displayedRows.length > 0 ? (
              displayedRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className="group hover:bg-[var(--table-row-hover)] transition-colors"
                >
                  {/* Row index + delete button */}
                  <td
                    style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
                    className="w-12 min-w-[48px] py-1 px-1 text-center border-b border-r border-[var(--table-border)] bg-[var(--sidebar-primary)]/20 overflow-hidden"
                  >
                    <div className="relative flex items-center justify-center w-full h-8">
                      <span className="text-[11px] font-mono text-[var(--muted)] group-hover:hidden">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        title={t.tablesPage.deleteRow}
                        className="hidden group-hover:flex w-6 h-6 items-center justify-center rounded text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 cursor-pointer transition-colors"
                      >
                        <i className="ri-delete-bin-line text-xs" />
                      </button>
                    </div>
                  </td>

                  {/* Row Cells */}
                  {activeTable.columns.map(col => {
                    const cellVal = row.data?.[col.id];
                    const colW = getColumnWidth(col);

                    return (
                      <td
                        key={col.id}
                        style={{
                          width: `${colW}px`,
                          minWidth: `${colW}px`,
                          maxWidth: `${colW}px`,
                        }}
                        className="py-1 px-1 border-b border-r border-[var(--table-border)] align-middle overflow-hidden"
                      >
                        {col.type === 'text' && (
                          <TextCell
                            value={cellVal}
                            onChange={val => updateCell(row.id, col.id, val)}
                          />
                        )}
                        {col.type === 'number' && (
                          <NumberCell
                            value={cellVal}
                            onChange={val => updateCell(row.id, col.id, val)}
                          />
                        )}
                        {col.type === 'select' && (
                          <SelectCell
                            value={cellVal}
                            column={col}
                            allRows={activeTable.rows}
                            onChange={val => updateCell(row.id, col.id, val)}
                          />
                        )}
                        {col.type === 'profile' && (
                          <ProfileCell
                            value={cellVal}
                            rowId={row.id}
                            columnId={col.id}
                            onChange={val => updateCell(row.id, col.id, val)}
                          />
                        )}
                        {col.type === 'password' && (
                          <PasswordCell
                            value={cellVal}
                            onChange={val => updateCell(row.id, col.id, val)}
                          />
                        )}
                        {col.type === 'date' && (
                          <DateCell
                            value={cellVal}
                            onChange={val => updateCell(row.id, col.id, val)}
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* Empty cell below add-column header */}
                  <td
                    style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                    className="w-24 min-w-[100px] border-b border-[var(--table-border)] overflow-hidden"
                  />
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={activeTable.columns.length + 2}
                  className="py-12 text-center text-xs text-[var(--muted)]"
                >
                  {rowSearchQuery
                    ? 'Nenhuma linha corresponde aos termos buscados.'
                    : 'Nenhuma linha na tabela. Clique em "+ Nova Linha" para começar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Bottom Quick Add Row bar */}
        <div className="p-3 border-t border-[var(--border)]/40 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--muted)] hover:text-red-500 hover:bg-[var(--muted-bg)] border border-dashed border-[var(--border)] hover:border-red-500/40 transition-colors cursor-pointer"
          >
            <i className="ri-add-line text-sm" />
            <span>Adicionar nova linha</span>
          </button>
        </div>
      </div>
    </div>
  );
};
