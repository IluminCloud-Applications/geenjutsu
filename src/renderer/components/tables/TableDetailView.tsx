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
import { TwoFactorCell } from './cells/TwoFactorCell';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { ContextMenu } from '../ui/ContextMenu';

const DEFAULT_WIDTHS: Record<TableColumnType, number> = {
  text: 200,
  number: 140,
  select: 170,
  profile: 210,
  password: 160,
  date: 160,
  '2fa': 190,
};

export const TableDetailView: React.FC = () => {
  const {
    activeTable,
    closeTable,
    addRow,
    updateCell,
    deleteRow,
    deleteColumn,
    updateColumn,
    reorderColumns,
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

  // Column rename states
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState('');

  // Column right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; column: TableColumn } | null>(null);

  // Column drag and drop reordering states
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [dropEdge, setDropEdge] = useState<'left' | 'right' | null>(null);

  // Column width cache in localStorage
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const cached = localStorage.getItem(`geenjutsu:col-widths:${activeTable?.id}`);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Blurred / Hidden columns cache in localStorage
  const [blurredColumns, setBlurredColumns] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem(`geenjutsu:blurred-cols:${activeTable?.id}`);
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

    try {
      const cachedBlurred = localStorage.getItem(`geenjutsu:blurred-cols:${activeTable.id}`);
      setBlurredColumns(cachedBlurred ? JSON.parse(cachedBlurred) : {});
    } catch {
      setBlurredColumns({});
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
    if (activeTable.columns.length === 0) {
      setIsAddColumnModalOpen(true);
      return;
    }
    await addRow();
  };

  const handleStartRename = (col: TableColumn, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setContextMenu(null);
    setEditingColumnId(col.id);
    setColumnTitleDraft(col.name);
  };

  const handleCommitColumnRename = async (colId: string) => {
    setEditingColumnId(null);
    const trimmed = columnTitleDraft.trim();
    if (!trimmed) return;
    const col = activeTable.columns.find(c => c.id === colId);
    if (col && col.name !== trimmed) {
      await updateColumn(colId, { name: trimmed });
    }
  };

  const handleColumnContextMenu = (col: TableColumn, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('geenjutsu:close-context-menu'));
    setContextMenu({ x: e.clientX, y: e.clientY, column: col });
  };

  const toggleBlurColumn = useCallback(
    (colId: string) => {
      setBlurredColumns(prev => {
        const next = { ...prev };
        if (next[colId]) {
          delete next[colId];
        } else {
          next[colId] = true;
        }
        try {
          if (activeTable) {
            localStorage.setItem(
              `geenjutsu:blurred-cols:${activeTable.id}`,
              JSON.stringify(next)
            );
          }
        } catch (err) {
          console.error('Failed to cache blurred columns', err);
        }
        return next;
      });
    },
    [activeTable]
  );

  const handleDeleteColumn = useCallback(
    (colId: string, colName: string) => {
      if (
        window.confirm(
          `Tem certeza que deseja excluir a coluna "${colName}"? Os dados dela serão apagados de todas as linhas.`
        )
      ) {
        deleteColumn(colId);
        setBlurredColumns(prev => {
          if (!prev[colId]) return prev;
          const next = { ...prev };
          delete next[colId];
          try {
            if (activeTable) {
              localStorage.setItem(
                `geenjutsu:blurred-cols:${activeTable.id}`,
                JSON.stringify(next)
              );
            }
          } catch (err) {
            console.error('Failed to update blurred columns cache', err);
          }
          return next;
        });
      }
    },
    [activeTable, deleteColumn]
  );

  const handleMoveColumn = async (sourceId: string, targetId: string, edge: 'left' | 'right') => {
    const currentCols = [...activeTable.columns];
    const srcIdx = currentCols.findIndex(c => c.id === sourceId);
    const tgtIdx = currentCols.findIndex(c => c.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return;

    const [movedCol] = currentCols.splice(srcIdx, 1);
    let insertIdx = currentCols.findIndex(c => c.id === targetId);
    if (edge === 'right') {
      insertIdx += 1;
    }
    currentCols.splice(insertIdx, 0, movedCol);

    const reorderedIds = currentCols.map(c => c.id);
    await reorderColumns(reorderedIds);
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
      case '2fa':
        return 'ri-shield-keyhole-line';
      default:
        return 'ri-layout-column-line';
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
                const isEditing = editingColumnId === col.id;
                const isDragging = draggedColId === col.id;
                const isDragOver = dragOverColId === col.id && !isDragging;

                return (
                  <th
                    key={col.id}
                    style={{
                      width: `${colW}px`,
                      minWidth: `${colW}px`,
                      maxWidth: `${colW}px`,
                    }}
                    draggable={!isEditing}
                    onDragStart={e => {
                      if (isEditing) {
                        e.preventDefault();
                        return;
                      }
                      e.dataTransfer.setData('text/plain', col.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedColId(col.id);
                    }}
                    onDragOver={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      const rect = e.currentTarget.getBoundingClientRect();
                      const isRight = e.clientX - rect.left > rect.width / 2;
                      setDragOverColId(col.id);
                      setDropEdge(isRight ? 'right' : 'left');
                    }}
                    onDragLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        if (dragOverColId === col.id) {
                          setDragOverColId(null);
                          setDropEdge(null);
                        }
                      }
                    }}
                    onDrop={async e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (draggedColId && draggedColId !== col.id) {
                        await handleMoveColumn(draggedColId, col.id, dropEdge || 'left');
                      }
                      setDraggedColId(null);
                      setDragOverColId(null);
                      setDropEdge(null);
                    }}
                    onDragEnd={() => {
                      setDraggedColId(null);
                      setDragOverColId(null);
                      setDropEdge(null);
                    }}
                    onContextMenu={e => handleColumnContextMenu(col, e)}
                    onDoubleClick={() => handleStartRename(col)}
                    className={`relative py-2 px-3 border-b border-r border-[var(--table-border)] bg-[var(--table-header)] group select-none overflow-hidden transition-colors ${
                      !isEditing ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${isDragging ? 'opacity-30 bg-[var(--muted-bg)]' : ''}`}
                  >
                    {/* Visual Drop Reorder Indicator */}
                    {isDragOver && (
                      <div
                        className={`absolute top-0 bottom-0 w-1 bg-red-500 z-30 pointer-events-none shadow-sm ${
                          dropEdge === 'right' ? 'right-0' : 'left-0'
                        }`}
                      />
                    )}

                    <div className="flex items-center justify-between gap-1.5 min-w-0 pr-1">
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5 min-w-0 flex-1"
                          onClick={e => e.stopPropagation()}
                          onDoubleClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          <i
                            className={`${getColumnTypeIcon(
                              col.type
                            )} text-xs text-[var(--muted)] flex-shrink-0`}
                          />
                          <input
                            type="text"
                            value={columnTitleDraft}
                            onChange={e => setColumnTitleDraft(e.target.value)}
                            onBlur={() => handleCommitColumnRename(col.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCommitColumnRename(col.id);
                              if (e.key === 'Escape') setEditingColumnId(null);
                            }}
                            autoFocus
                            onFocus={e => e.currentTarget.select()}
                            className="h-6 w-full px-1.5 text-xs font-semibold bg-[var(--card)] text-[var(--foreground)] rounded border border-red-500/80 focus:outline-none shadow-xs"
                          />
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-grab"
                          title="Dois cliques para renomear, arraste para mover"
                        >
                          <i
                            className={`${getColumnTypeIcon(
                              col.type
                            )} text-xs text-[var(--muted)] flex-shrink-0`}
                          />
                          <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                            {col.name}
                          </span>
                          {blurredColumns[col.id] && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                toggleBlurColumn(col.id);
                              }}
                              title={`${t.tablesPage.showData} (${t.tablesPage.dataHidden})`}
                              className="p-0.5 rounded text-amber-500/90 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer flex-shrink-0"
                            >
                              <i className="ri-eye-off-line text-xs" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={e => handleStartRename(col, e)}
                            title={t.tablesPage.renameColumn}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--muted)] hover:text-red-500 transition-opacity cursor-pointer flex-shrink-0"
                          >
                            <i className="ri-edit-line text-[11px]" />
                          </button>
                        </div>
                      )}

                      {/* Column Menu */}
                      <div
                        className={`transition-opacity flex-shrink-0 ${
                          blurredColumns[col.id]
                            ? 'opacity-80 hover:opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                      >
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
                              label: t.tablesPage.renameColumn,
                              icon: 'ri-edit-line',
                              onClick: () => handleStartRename(col),
                            },
                            {
                              label: blurredColumns[col.id]
                                ? t.tablesPage.showData
                                : t.tablesPage.hideData,
                              icon: blurredColumns[col.id] ? 'ri-eye-line' : 'ri-eye-off-line',
                              onClick: () => toggleBlurColumn(col.id),
                            },
                            {
                              label: t.tablesPage.deleteColumn,
                              icon: 'ri-delete-bin-line',
                              danger: true,
                              onClick: () => handleDeleteColumn(col.id, col.name),
                            },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Column Resizer Handle */}
                    <div
                      draggable={false}
                      onMouseDown={e => {
                        e.stopPropagation();
                        handleStartResize(col.id, col.type, e);
                      }}
                      onDragStart={e => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-red-500 active:bg-red-600 transition-colors z-20 group-hover:bg-[var(--border)]/70"
                      title="Arraste para redimensionar"
                    />
                  </th>
                );
              })}

              {/* Add column quick header button */}
              <th
                style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}
                className={`relative w-24 min-w-[100px] py-1 px-2 border-b border-[var(--table-border)] bg-[var(--table-header)] overflow-hidden transition-colors ${
                  dragOverColId === '__add_col__' ? 'bg-red-500/10' : ''
                }`}
                onDragOver={e => {
                  if (!draggedColId) return;
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverColId('__add_col__');
                  setDropEdge('right');
                }}
                onDragLeave={e => {
                  if (dragOverColId === '__add_col__') {
                    setDragOverColId(null);
                    setDropEdge(null);
                  }
                }}
                onDrop={async e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedColId && activeTable.columns.length > 0) {
                    const lastCol = activeTable.columns[activeTable.columns.length - 1];
                    await handleMoveColumn(draggedColId, lastCol.id, 'right');
                  }
                  setDraggedColId(null);
                  setDragOverColId(null);
                  setDropEdge(null);
                }}
              >
                {dragOverColId === '__add_col__' && (
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500 z-30 pointer-events-none" />
                )}
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
                    const isColBlurred = Boolean(blurredColumns[col.id]);

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
                        <div
                          className={`w-full h-full transition-all duration-200 ${
                            isColBlurred
                              ? 'filter blur-[5px] select-none pointer-events-none opacity-60'
                              : ''
                          }`}
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
                          {col.type === '2fa' && (
                            <TwoFactorCell
                              value={cellVal}
                              onChange={val => updateCell(row.id, col.id, val)}
                            />
                          )}
                        </div>
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
                  colSpan={Math.max(2, activeTable.columns.length + 2)}
                  className="py-14 text-center text-xs text-[var(--muted)]"
                >
                  {activeTable.columns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-xl bg-[var(--muted-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] mb-1">
                        <i className="ri-layout-column-line text-xl" />
                      </div>
                      <p className="text-xs font-semibold text-[var(--foreground)]">
                        Esta tabela está vazia
                      </p>
                      <p className="text-[11.5px] text-[var(--muted)]">
                        Adicione a primeira coluna para começar a organizar suas linhas.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        icon="ri-add-line"
                        onClick={() => setIsAddColumnModalOpen(true)}
                        className="mt-1 text-xs"
                      >
                        Adicionar Coluna
                      </Button>
                    </div>
                  ) : rowSearchQuery ? (
                    'Nenhuma linha corresponde aos termos buscados.'
                  ) : (
                    'Nenhuma linha na tabela. Clique em "+ Nova Linha" para começar.'
                  )}
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

      {/* Column Right-Click Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t.tablesPage.renameColumn,
              icon: 'ri-edit-line',
              onClick: () => handleStartRename(contextMenu.column),
            },
            {
              label: blurredColumns[contextMenu.column.id]
                ? t.tablesPage.showData
                : t.tablesPage.hideData,
              icon: blurredColumns[contextMenu.column.id] ? 'ri-eye-line' : 'ri-eye-off-line',
              onClick: () => toggleBlurColumn(contextMenu.column.id),
            },
            {
              label: t.tablesPage.deleteColumn,
              icon: 'ri-delete-bin-line',
              danger: true,
              onClick: () =>
                handleDeleteColumn(contextMenu.column.id, contextMenu.column.name),
            },
          ]}
        />
      )}
    </div>
  );
};
