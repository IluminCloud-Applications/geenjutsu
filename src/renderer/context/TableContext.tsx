import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  CustomTable,
  TableColumn,
  TableRow,
  TableSummary,
  TableTemplate,
  CreateTableInput,
  TableColumnType,
} from '../../types/table';

interface ProfilePickerTarget {
  rowId: string;
  columnId: string;
  currentProfileId?: string;
}

interface TableContextType {
  tables: TableSummary[];
  filteredTables: TableSummary[];
  activeTable: CustomTable | null;
  templates: TableTemplate[];
  isLoading: boolean;
  tableSearchQuery: string;
  setTableSearchQuery: (q: string) => void;
  rowSearchQuery: string;
  setRowSearchQuery: (q: string) => void;

  // Modals & Target States
  isCreateTableModalOpen: boolean;
  setIsCreateTableModalOpen: (v: boolean) => void;
  isAddColumnModalOpen: boolean;
  setIsAddColumnModalOpen: (v: boolean) => void;
  isEditColumnModalOpen: boolean;
  setIsEditColumnModalOpen: (v: boolean) => void;
  editingColumn: TableColumn | null;
  setEditingColumn: (c: TableColumn | null) => void;
  isDuplicateModalOpen: boolean;
  setIsDuplicateModalOpen: (v: boolean) => void;
  targetDuplicateTable: TableSummary | null;
  setTargetDuplicateTable: (t: TableSummary | null) => void;
  isEditTableModalOpen: boolean;
  setIsEditTableModalOpen: (v: boolean) => void;
  editingTableSummary: TableSummary | null;
  setEditingTableSummary: (t: TableSummary | null) => void;
  profilePickerTarget: ProfilePickerTarget | null;
  setProfilePickerTarget: (target: ProfilePickerTarget | null) => void;

  // Actions
  loadTables: () => Promise<void>;
  openTable: (id: string) => Promise<void>;
  closeTable: () => void;
  createTable: (input: CreateTableInput) => Promise<CustomTable>;
  updateTableInfo: (id: string, updates: Partial<CustomTable>) => Promise<boolean>;
  deleteTable: (id: string) => Promise<boolean>;
  duplicateTable: (tableId: string, includeData: boolean, newName?: string) => Promise<CustomTable>;
  addColumn: (name: string, type: TableColumnType, options?: string[]) => Promise<TableColumn | null>;
  updateColumn: (columnId: string, updates: { name?: string; type?: TableColumnType; options?: string[]; position?: number }) => Promise<boolean>;
  deleteColumn: (columnId: string) => Promise<boolean>;
  addRow: (data?: Record<string, any>) => Promise<TableRow | null>;
  updateCell: (rowId: string, columnId: string, value: any) => Promise<boolean>;
  deleteRow: (rowId: string) => Promise<boolean>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [activeTable, setActiveTable] = useState<CustomTable | null>(null);
  const [templates, setTemplates] = useState<TableTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [rowSearchQuery, setRowSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState<boolean>(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState<boolean>(false);
  const [isEditColumnModalOpen, setIsEditColumnModalOpen] = useState<boolean>(false);
  const [editingColumn, setEditingColumn] = useState<TableColumn | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);
  const [targetDuplicateTable, setTargetDuplicateTable] = useState<TableSummary | null>(null);
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState<boolean>(false);
  const [editingTableSummary, setEditingTableSummary] = useState<TableSummary | null>(null);
  const [profilePickerTarget, setProfilePickerTarget] = useState<ProfilePickerTarget | null>(null);

  const loadTables = useCallback(async () => {
    try {
      if (window.geenjutsuApi?.getTables) {
        const list = await window.geenjutsuApi.getTables();
        setTables(list || []);
      }
      if (window.geenjutsuApi?.getTableTemplates) {
        const tmpls = await window.geenjutsuApi.getTableTemplates();
        setTemplates(tmpls || []);
      }
    } catch (err) {
      console.error('[TableContext] Erro ao carregar tabelas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const openTable = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      if (window.geenjutsuApi?.getTableById) {
        const fullTable = await window.geenjutsuApi.getTableById(id);
        setActiveTable(fullTable);
      }
    } catch (err) {
      console.error('[TableContext] Erro ao abrir tabela:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeTable = useCallback(() => {
    setActiveTable(null);
    setRowSearchQuery('');
    loadTables();
  }, [loadTables]);

  const createTable = useCallback(async (input: CreateTableInput): Promise<CustomTable> => {
    if (!window.geenjutsuApi?.createTable) {
      throw new Error('API do Geenjutsu indisponível');
    }
    const created = await window.geenjutsuApi.createTable(input);
    await loadTables();
    setActiveTable(created);
    return created;
  }, [loadTables]);

  const updateTableInfo = useCallback(async (id: string, updates: Partial<CustomTable>): Promise<boolean> => {
    if (!window.geenjutsuApi?.updateTable) return false;
    const ok = await window.geenjutsuApi.updateTable(id, updates);
    if (ok) {
      if (activeTable && activeTable.id === id) {
        setActiveTable(prev => prev ? { ...prev, ...updates, updatedAt: Date.now() } : null);
      }
      setTables(prev =>
        prev.map(t => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t))
      );
    }
    return ok;
  }, [activeTable]);

  const deleteTable = useCallback(async (id: string): Promise<boolean> => {
    if (!window.geenjutsuApi?.deleteTable) return false;
    const ok = await window.geenjutsuApi.deleteTable(id);
    if (ok) {
      if (activeTable && activeTable.id === id) {
        setActiveTable(null);
      }
      setTables(prev => prev.filter(t => t.id !== id));
    }
    return ok;
  }, [activeTable]);

  const duplicateTable = useCallback(async (
    tableId: string,
    includeData: boolean,
    newName?: string
  ): Promise<CustomTable> => {
    if (!window.geenjutsuApi?.duplicateTable) {
      throw new Error('API do Geenjutsu indisponível');
    }
    const cloned = await window.geenjutsuApi.duplicateTable(tableId, includeData, newName);
    await loadTables();
    setActiveTable(cloned);
    return cloned;
  }, [loadTables]);

  const addColumn = useCallback(async (
    name: string,
    type: TableColumnType,
    options?: string[]
  ): Promise<TableColumn | null> => {
    if (!activeTable || !window.geenjutsuApi?.addColumn) return null;
    const newCol = await window.geenjutsuApi.addColumn(activeTable.id, name, type, options);
    if (newCol) {
      const now = Date.now();
      setActiveTable(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: [...prev.columns, newCol],
          rows: newCol.type === 'date'
            ? prev.rows.map(r => ({
                ...r,
                data: { ...r.data, [newCol.id]: r.createdAt || now },
              }))
            : prev.rows,
          updatedAt: Date.now(),
        };
      });
      setTables(prev =>
        prev.map(t => (t.id === activeTable.id ? { ...t, columnCount: t.columnCount + 1, updatedAt: Date.now() } : t))
      );
    }
    return newCol;
  }, [activeTable]);

  const updateColumn = useCallback(async (
    columnId: string,
    updates: { name?: string; type?: TableColumnType; options?: string[]; position?: number }
  ): Promise<boolean> => {
    if (!activeTable || !window.geenjutsuApi?.updateColumn) return false;
    const ok = await window.geenjutsuApi.updateColumn(columnId, updates);
    if (ok) {
      setActiveTable(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map(c => (c.id === columnId ? { ...c, ...updates } : c)),
          updatedAt: Date.now(),
        };
      });
    }
    return ok;
  }, [activeTable]);

  const deleteColumn = useCallback(async (columnId: string): Promise<boolean> => {
    if (!activeTable || !window.geenjutsuApi?.deleteColumn) return false;
    const ok = await window.geenjutsuApi.deleteColumn(columnId, activeTable.id);
    if (ok) {
      setActiveTable(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.filter(c => c.id !== columnId),
          rows: prev.rows.map(r => {
            const nextData = { ...r.data };
            delete nextData[columnId];
            return { ...r, data: nextData };
          }),
          updatedAt: Date.now(),
        };
      });
      setTables(prev =>
        prev.map(t => (t.id === activeTable.id ? { ...t, columnCount: Math.max(0, t.columnCount - 1), updatedAt: Date.now() } : t))
      );
    }
    return ok;
  }, [activeTable]);

  const addRow = useCallback(async (data: Record<string, any> = {}): Promise<TableRow | null> => {
    if (!activeTable || !window.geenjutsuApi?.addRow) return null;
    const now = Date.now();
    const rowData = { ...data };
    activeTable.columns.forEach(col => {
      if (col.type === 'date' && (rowData[col.id] === undefined || rowData[col.id] === null || rowData[col.id] === '')) {
        rowData[col.id] = now;
      }
    });

    const newRow = await window.geenjutsuApi.addRow(activeTable.id, rowData);
    if (newRow) {
      setActiveTable(prev => {
        if (!prev) return null;
        return {
          ...prev,
          rows: [...prev.rows, newRow],
          updatedAt: Date.now(),
        };
      });
      setTables(prev =>
        prev.map(t => (t.id === activeTable.id ? { ...t, rowCount: t.rowCount + 1, updatedAt: Date.now() } : t))
      );
    }
    return newRow;
  }, [activeTable]);

  const updateCell = useCallback(async (
    rowId: string,
    columnId: string,
    value: any
  ): Promise<boolean> => {
    if (!activeTable || !window.geenjutsuApi?.updateRow) return false;

    const targetRow = activeTable.rows.find(r => r.id === rowId);
    if (!targetRow) return false;

    const nextData = { ...targetRow.data, [columnId]: value };

    // Optimistic UI update
    setActiveTable(prev => {
      if (!prev) return null;
      return {
        ...prev,
        rows: prev.rows.map(r => (r.id === rowId ? { ...r, data: nextData, updatedAt: Date.now() } : r)),
        updatedAt: Date.now(),
      };
    });

    try {
      const ok = await window.geenjutsuApi.updateRow(rowId, nextData);
      return ok;
    } catch (err) {
      console.error('[TableContext] Erro ao atualizar célula:', err);
      return false;
    }
  }, [activeTable]);

  const deleteRow = useCallback(async (rowId: string): Promise<boolean> => {
    if (!activeTable || !window.geenjutsuApi?.deleteRow) return false;
    const ok = await window.geenjutsuApi.deleteRow(rowId);
    if (ok) {
      setActiveTable(prev => {
        if (!prev) return null;
        return {
          ...prev,
          rows: prev.rows.filter(r => r.id !== rowId),
          updatedAt: Date.now(),
        };
      });
      setTables(prev =>
        prev.map(t => (t.id === activeTable.id ? { ...t, rowCount: Math.max(0, t.rowCount - 1), updatedAt: Date.now() } : t))
      );
    }
    return ok;
  }, [activeTable]);

  const filteredTables = useMemo(() => {
    if (!tableSearchQuery.trim()) return tables;
    const q = tableSearchQuery.toLowerCase();
    return tables.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tables, tableSearchQuery]);

  const value = useMemo(
    () => ({
      tables,
      filteredTables,
      activeTable,
      templates,
      isLoading,
      tableSearchQuery,
      setTableSearchQuery,
      rowSearchQuery,
      setRowSearchQuery,

      isCreateTableModalOpen,
      setIsCreateTableModalOpen,
      isAddColumnModalOpen,
      setIsAddColumnModalOpen,
      isEditColumnModalOpen,
      setIsEditColumnModalOpen,
      editingColumn,
      setEditingColumn,
      isDuplicateModalOpen,
      setIsDuplicateModalOpen,
      targetDuplicateTable,
      setTargetDuplicateTable,
      isEditTableModalOpen,
      setIsEditTableModalOpen,
      editingTableSummary,
      setEditingTableSummary,
      profilePickerTarget,
      setProfilePickerTarget,

      loadTables,
      openTable,
      closeTable,
      createTable,
      updateTableInfo,
      deleteTable,
      duplicateTable,
      addColumn,
      updateColumn,
      deleteColumn,
      addRow,
      updateCell,
      deleteRow,
    }),
    [
      tables,
      filteredTables,
      activeTable,
      templates,
      isLoading,
      tableSearchQuery,
      rowSearchQuery,
      isCreateTableModalOpen,
      isAddColumnModalOpen,
      isEditColumnModalOpen,
      editingColumn,
      isDuplicateModalOpen,
      targetDuplicateTable,
      isEditTableModalOpen,
      editingTableSummary,
      profilePickerTarget,
      loadTables,
      openTable,
      closeTable,
      createTable,
      updateTableInfo,
      deleteTable,
      duplicateTable,
      addColumn,
      updateColumn,
      deleteColumn,
      addRow,
      updateCell,
      deleteRow,
    ]
  );

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
};

export const useTables = (): TableContextType => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTables deve ser usado dentro de um TableProvider');
  }
  return context;
};
