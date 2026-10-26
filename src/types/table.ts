export type TableColumnType = 'text' | 'number' | 'select' | 'profile' | 'password' | 'date' | '2fa';

export interface TableColumn {
  id: string;
  tableId: string;
  name: string;
  type: TableColumnType;
  position: number;
  options?: string[];
  width?: number;
  createdAt: number;
}

export interface TableRow {
  id: string;
  tableId: string;
  data: Record<string, any>; // columnId -> value
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface CustomTable {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  columns: TableColumn[];
  rows: TableRow[];
  createdAt: number;
  updatedAt: number;
}

export interface TableSummary {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  columnCount: number;
  rowCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTableInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  templateId?: string;
}

export interface UpdateTableInput {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface CreateColumnInput {
  tableId: string;
  name: string;
  type: TableColumnType;
  options?: string[];
}

export interface UpdateColumnInput {
  id?: string;
  name?: string;
  type?: TableColumnType;
  options?: string[];
  position?: number;
}

export interface CreateRowInput {
  tableId: string;
  data?: Record<string, any>;
  position?: number;
}

export interface UpdateRowInput {
  id: string;
  data: Record<string, any>;
}

export interface DuplicateTableOptions {
  tableId: string;
  includeData: boolean;
  newName?: string;
}

export interface TableTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  columns: {
    name: string;
    type: TableColumnType;
    options?: string[];
  }[];
  sampleRows?: Record<string, any>[];
}
