import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import {
  CustomTable,
  TableColumn,
  TableRow,
  TableSummary,
  CreateTableInput,
  TableTemplate,
  TableColumnType,
} from '../../types/table';

export const TABLE_TEMPLATES: TableTemplate[] = [
  {
    id: 'contingency-fb',
    name: 'Contingência Facebook Ads',
    description: 'Organize BMs, contas de anúncio, perfis de contingência, 2FA e gastos diários.',
    icon: 'ri-facebook-circle-fill',
    color: '#1877F2',
    columns: [
      { name: 'Perfil Geenjutsu', type: 'profile' },
      { name: 'Conta / Ativo (BM)', type: 'text' },
      {
        name: 'Status BM',
        type: 'select',
        options: ['Ativa', 'Restrita', 'Em Análise', 'Aquecendo', 'Desativada'],
      },
      { name: 'Gasto Diário (R$)', type: 'number' },
      { name: 'Chave 2FA / Backup', type: 'text' },
      {
        name: 'Status da Conta',
        type: 'select',
        options: ['Farmando', 'Pronta para Anúncio', 'Anunciando', 'Contingência', 'Bloqueada'],
      },
      { name: 'Criado em', type: 'date' },
      { name: 'Observações', type: 'text' },
    ],
    sampleRows: [
      {
        'Conta / Ativo (BM)': 'BM 01 - Matriz Escala',
        'Status BM': 'Ativa',
        'Gasto Diário (R$)': 2500,
        'Status da Conta': 'Anunciando',
        'Observações': 'Pixel principal compartilhado',
      },
      {
        'Conta / Ativo (BM)': 'BM 02 - Contingência Reserva',
        'Status BM': 'Aquecendo',
        'Gasto Diário (R$)': 500,
        'Status da Conta': 'Contingência',
        'Observações': 'Perfil aquecido há 15 dias',
      },
    ],
  },
  {
    id: 'profile-farm',
    name: 'Esteira de Farm / Aquecimento',
    description: 'Acompanhamento do ciclo de vida, dias de aquecimento e etapas dos perfis.',
    icon: 'ri-fire-fill',
    color: '#F59E0B',
    columns: [
      { name: 'Perfil Geenjutsu', type: 'profile' },
      { name: 'Dia de Aquecimento', type: 'number' },
      {
        name: 'Etapa Atual',
        type: 'select',
        options: ['Criação / Importação', 'Cookies Iniciais', 'Interação Social', '2FA Ativado', 'Pronto para Uso'],
      },
      { name: 'Email / Login', type: 'text' },
      { name: 'Proxy / Região', type: 'text' },
      { name: 'Criado em', type: 'date' },
      { name: 'Anotações', type: 'text' },
    ],
    sampleRows: [
      {
        'Dia de Aquecimento': 7,
        'Etapa Atual': 'Interação Social',
        'Email / Login': 'lead.farm01@outlook.com',
        'Proxy / Região': 'SP / Brasil (Residencial)',
        'Anotações': 'Interagindo com vídeos e curtindo posts',
      },
    ],
  },
  {
    id: 'social-media',
    name: 'Gestão de Redes Sociais',
    description: 'Gerenciamento de contas em diversas plataformas, seguidores e links.',
    icon: 'ri-share-forward-box-fill',
    color: '#EC4899',
    columns: [
      { name: 'Perfil Geenjutsu', type: 'profile' },
      {
        name: 'Plataforma',
        type: 'select',
        options: ['Facebook', 'Instagram', 'TikTok', 'Google / YouTube', 'Twitter / X', 'Pinterest'],
      },
      { name: 'Usuário / @arroba', type: 'text' },
      { name: 'Seguidores / Alcance', type: 'number' },
      {
        name: 'Status da Conta',
        type: 'select',
        options: ['Ativo', 'Em Aquecimento', 'Pausado', 'Verificação Pendente'],
      },
      { name: 'Criado em', type: 'date' },
      { name: 'Link / URL', type: 'text' },
    ],
  },
  {
    id: 'account-creation',
    name: 'Criação de Contas & Cadastros',
    description: 'Planilha para registrar criação de novas contas, senhas provisórias e status.',
    icon: 'ri-user-add-line',
    color: '#10B981',
    columns: [
      { name: 'Perfil Geenjutsu', type: 'profile' },
      { name: 'Plataforma / Serviço', type: 'text' },
      { name: 'Email Utilizado', type: 'text' },
      { name: 'Senha / Credenciais', type: 'password' },
      {
        name: 'Status do Cadastro',
        type: 'select',
        options: ['Pendente SMS', 'Pendente Email', 'Confirmado', 'Finalizado'],
      },
      { name: 'Data da Criação', type: 'text' },
    ],
  },
];

export class TableStore {
  private static db: DatabaseSync | null = null;

  private static getDatabasePath(): string {
    const userData = app ? app.getPath('userData') : path.join(process.cwd(), '.geenjutsu_data');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return path.join(userData, 'geenjutsu_tables.sqlite');
  }

  private static getDb(): DatabaseSync {
    if (!this.db) {
      const dbPath = this.getDatabasePath();
      this.db = new DatabaseSync(dbPath);
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.initSchema();
    }
    return this.db;
  }

  private static initSchema() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS custom_tables (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        color TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS table_columns (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        position INTEGER NOT NULL,
        options TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (table_id) REFERENCES custom_tables(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS table_rows (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (table_id) REFERENCES custom_tables(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_columns_table_id ON table_columns(table_id, position);
      CREATE INDEX IF NOT EXISTS idx_rows_table_id ON table_rows(table_id, position);
    `);
  }

  static getTemplates(): TableTemplate[] {
    return TABLE_TEMPLATES;
  }

  static getTablesSummary(): TableSummary[] {
    const db = this.getDb();
    const rows = db.prepare(`
      SELECT 
        t.id, 
        t.name, 
        t.description, 
        t.icon, 
        t.color, 
        t.created_at as createdAt, 
        t.updated_at as updatedAt,
        (SELECT COUNT(*) FROM table_columns c WHERE c.table_id = t.id) as columnCount,
        (SELECT COUNT(*) FROM table_rows r WHERE r.table_id = t.id) as rowCount
      FROM custom_tables t
      ORDER BY t.updated_at DESC
    `).all() as any[];

    return rows.map(r => ({
      id: String(r.id),
      name: String(r.name),
      description: r.description ? String(r.description) : undefined,
      icon: r.icon ? String(r.icon) : undefined,
      color: r.color ? String(r.color) : undefined,
      columnCount: Number(r.columnCount) || 0,
      rowCount: Number(r.rowCount) || 0,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }));
  }

  static getTableById(id: string): CustomTable | null {
    const db = this.getDb();
    const tableRow = db.prepare(`
      SELECT id, name, description, icon, color, created_at as createdAt, updated_at as updatedAt
      FROM custom_tables
      WHERE id = ?
    `).get(id) as any;

    if (!tableRow) return null;

    const columnRows = db.prepare(`
      SELECT id, table_id as tableId, name, type, position, options, created_at as createdAt
      FROM table_columns
      WHERE table_id = ?
      ORDER BY position ASC, created_at ASC
    `).all(id) as any[];

    const columns: TableColumn[] = columnRows.map(c => {
      let parsedOptions: string[] | undefined;
      if (c.options) {
        try {
          parsedOptions = JSON.parse(c.options);
        } catch {
          parsedOptions = [];
        }
      }
      return {
        id: String(c.id),
        tableId: String(c.tableId),
        name: String(c.name),
        type: c.type as TableColumnType,
        position: Number(c.position),
        options: parsedOptions,
        createdAt: Number(c.createdAt),
      };
    });

    const rowRows = db.prepare(`
      SELECT id, table_id as tableId, data, position, created_at as createdAt, updated_at as updatedAt
      FROM table_rows
      WHERE table_id = ?
      ORDER BY position ASC, created_at ASC
    `).all(id) as any[];

    const rows: TableRow[] = rowRows.map(r => {
      let parsedData: Record<string, any> = {};
      try {
        parsedData = JSON.parse(r.data || '{}');
      } catch {
        parsedData = {};
      }
      return {
        id: String(r.id),
        tableId: String(r.tableId),
        data: parsedData,
        position: Number(r.position),
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
      };
    });

    return {
      id: String(tableRow.id),
      name: String(tableRow.name),
      description: tableRow.description ? String(tableRow.description) : undefined,
      icon: tableRow.icon ? String(tableRow.icon) : undefined,
      color: tableRow.color ? String(tableRow.color) : undefined,
      columns,
      rows,
      createdAt: Number(tableRow.createdAt),
      updatedAt: Number(tableRow.updatedAt),
    };
  }

  static createTable(input: CreateTableInput): CustomTable {
    const db = this.getDb();
    const tableId = `tbl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    let name = input.name.trim();
    let description = input.description?.trim();
    let icon = input.icon || 'ri-table-line';
    let color = input.color || '#EF4444';

    let initialColumns: { name: string; type: TableColumnType; options?: string[] }[] = [];
    let initialSampleRows: Record<string, any>[] | undefined;

    if (input.templateId) {
      const template = TABLE_TEMPLATES.find(t => t.id === input.templateId);
      if (template) {
        if (!name) name = template.name;
        if (!description) description = template.description;
        icon = template.icon;
        color = template.color;
        initialColumns = template.columns;
        initialSampleRows = template.sampleRows;
      }
    }

    if (!name) {
      name = 'Nova Tabela';
    }

    if (initialColumns.length === 0) {
      initialColumns = [
        { name: 'Nome / Identificador', type: 'text' },
        { name: 'Perfil Geenjutsu', type: 'profile' },
        { name: 'Status', type: 'select', options: ['Pendente', 'Em Andamento', 'Concluído'] },
        { name: 'Criado em', type: 'date' },
        { name: 'Observações', type: 'text' },
      ];
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO custom_tables (id, name, description, icon, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(tableId, name, description || null, icon, color, now, now);

      const colNameToIdMap: Record<string, string> = {};

      initialColumns.forEach((col, idx) => {
        const colId = `col-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;
        colNameToIdMap[col.name] = colId;
        const optionsJson = col.options ? JSON.stringify(col.options) : null;
        db.prepare(`
          INSERT INTO table_columns (id, table_id, name, type, position, options, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(colId, tableId, col.name, col.type, idx, optionsJson, now);
      });

      if (initialSampleRows && initialSampleRows.length > 0) {
        initialSampleRows.forEach((sample, rIdx) => {
          const rowId = `row-${Date.now()}-${rIdx}-${Math.random().toString(36).substring(2, 5)}`;
          const rowData: Record<string, any> = {};
          for (const [colName, val] of Object.entries(sample)) {
            const mappedColId = colNameToIdMap[colName];
            if (mappedColId) {
              rowData[mappedColId] = val;
            }
          }
          db.prepare(`
            INSERT INTO table_rows (id, table_id, data, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(rowId, tableId, JSON.stringify(rowData), rIdx, now, now);
        });
      } else {
        // Create 2 empty rows ready for user input
        for (let rIdx = 0; rIdx < 2; rIdx++) {
          const rowId = `row-${Date.now()}-${rIdx}-${Math.random().toString(36).substring(2, 5)}`;
          db.prepare(`
            INSERT INTO table_rows (id, table_id, data, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(rowId, tableId, JSON.stringify({}), rIdx, now, now);
        }
      }

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const created = this.getTableById(tableId);
    if (!created) {
      throw new Error('Falha ao carregar tabela recém-criada');
    }
    return created;
  }

  static updateTable(id: string, updates: Partial<CustomTable>): boolean {
    const db = this.getDb();
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name.trim());
    }
    if (updates.description !== undefined) {
      sets.push('description = ?');
      values.push(updates.description.trim() || null);
    }
    if (updates.icon !== undefined) {
      sets.push('icon = ?');
      values.push(updates.icon);
    }
    if (updates.color !== undefined) {
      sets.push('color = ?');
      values.push(updates.color);
    }

    if (sets.length === 0) return true;

    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const res = db.prepare(`
      UPDATE custom_tables SET ${sets.join(', ')} WHERE id = ?
    `).run(...values);

    return (res.changes ?? 0) > 0;
  }

  static deleteTable(id: string): boolean {
    const db = this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare('DELETE FROM table_rows WHERE table_id = ?').run(id);
      db.prepare('DELETE FROM table_columns WHERE table_id = ?').run(id);
      const res = db.prepare('DELETE FROM custom_tables WHERE id = ?').run(id);
      db.exec('COMMIT;');
      return (res.changes ?? 0) > 0;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  static duplicateTable(tableId: string, includeData: boolean, newName?: string): CustomTable {
    const db = this.getDb();
    const sourceTable = this.getTableById(tableId);
    if (!sourceTable) {
      throw new Error(`Tabela de origem ${tableId} não encontrada`);
    }

    const newTableId = `tbl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const resolvedName = newName?.trim() || `${sourceTable.name} (Cópia)`;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO custom_tables (id, name, description, icon, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        newTableId,
        resolvedName,
        sourceTable.description || null,
        sourceTable.icon || 'ri-table-line',
        sourceTable.color || '#EF4444',
        now,
        now
      );

      const oldColToNewColMap: Record<string, string> = {};

      sourceTable.columns.forEach((col, idx) => {
        const newColId = `col-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`;
        oldColToNewColMap[col.id] = newColId;
        const optionsJson = col.options ? JSON.stringify(col.options) : null;
        db.prepare(`
          INSERT INTO table_columns (id, table_id, name, type, position, options, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(newColId, newTableId, col.name, col.type, col.position, optionsJson, now);
      });

      if (includeData && sourceTable.rows.length > 0) {
        sourceTable.rows.forEach((row, rIdx) => {
          const newRowId = `row-${Date.now()}-${rIdx}-${Math.random().toString(36).substring(2, 5)}`;
          const newRowData: Record<string, any> = {};

          for (const [oldColId, cellVal] of Object.entries(row.data)) {
            const mappedNewColId = oldColToNewColMap[oldColId];
            if (mappedNewColId) {
              newRowData[mappedNewColId] = cellVal;
            }
          }

          db.prepare(`
            INSERT INTO table_rows (id, table_id, data, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(newRowId, newTableId, JSON.stringify(newRowData), row.position, now, now);
        });
      }

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const cloned = this.getTableById(newTableId);
    if (!cloned) {
      throw new Error('Falha ao carregar tabela duplicada');
    }
    return cloned;
  }

  static addColumn(tableId: string, name: string, type: TableColumnType, options?: string[]): TableColumn {
    const db = this.getDb();
    const posRow = db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as nextPos
      FROM table_columns
      WHERE table_id = ?
    `).get(tableId) as any;

    const nextPosition = Number(posRow?.nextPos) || 0;
    const colId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();
    const optionsJson = options && options.length > 0 ? JSON.stringify(options) : null;

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO table_columns (id, table_id, name, type, position, options, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(colId, tableId, name.trim(), type, nextPosition, optionsJson, now);

      if (type === 'date') {
        const rows = db.prepare('SELECT id, created_at, data FROM table_rows WHERE table_id = ?').all(tableId) as any[];
        const updateStmt = db.prepare('UPDATE table_rows SET data = ? WHERE id = ?');
        for (const r of rows) {
          try {
            const parsed = JSON.parse(r.data || '{}');
            parsed[colId] = Number(r.created_at) || now;
            updateStmt.run(JSON.stringify(parsed), r.id);
          } catch {}
        }
      }

      db.prepare('UPDATE custom_tables SET updated_at = ? WHERE id = ?').run(now, tableId);
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return {
      id: colId,
      tableId,
      name: name.trim(),
      type,
      position: nextPosition,
      options,
      createdAt: now,
    };
  }

  static updateColumn(
    columnId: string,
    updates: { name?: string; type?: TableColumnType; options?: string[]; position?: number }
  ): boolean {
    const db = this.getDb();
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name.trim());
    }
    if (updates.type !== undefined) {
      sets.push('type = ?');
      values.push(updates.type);
    }
    if (updates.options !== undefined) {
      sets.push('options = ?');
      values.push(updates.options ? JSON.stringify(updates.options) : null);
    }
    if (updates.position !== undefined) {
      sets.push('position = ?');
      values.push(updates.position);
    }

    if (sets.length === 0) return true;

    values.push(columnId);

    const res = db.prepare(`UPDATE table_columns SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return (res.changes ?? 0) > 0;
  }

  static deleteColumn(columnId: string, tableId: string): boolean {
    const db = this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare('DELETE FROM table_columns WHERE id = ?').run(columnId);

      // Clean up column key from all rows for this table
      const rows = db.prepare('SELECT id, data FROM table_rows WHERE table_id = ?').all(tableId) as any[];
      const updateStmt = db.prepare('UPDATE table_rows SET data = ?, updated_at = ? WHERE id = ?');
      const now = Date.now();

      for (const r of rows) {
        try {
          const data = JSON.parse(r.data || '{}');
          if (columnId in data) {
            delete data[columnId];
            updateStmt.run(JSON.stringify(data), now, r.id);
          }
        } catch {
          // ignore parsing error
        }
      }

      db.prepare('UPDATE custom_tables SET updated_at = ? WHERE id = ?').run(now, tableId);
      db.exec('COMMIT;');
      return true;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  static addRow(tableId: string, data: Record<string, any> = {}): TableRow {
    const db = this.getDb();
    const posRow = db.prepare(`
      SELECT COALESCE(MAX(position), -1) + 1 as nextPos
      FROM table_rows
      WHERE table_id = ?
    `).get(tableId) as any;

    const nextPosition = Number(posRow?.nextPos) || 0;
    const rowId = `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    // Auto-fill any date columns if not provided
    const dateColumns = db.prepare(`
      SELECT id FROM table_columns WHERE table_id = ? AND type = 'date'
    `).all(tableId) as { id: string }[];

    const rowData: Record<string, any> = { ...data };
    for (const col of dateColumns) {
      if (rowData[col.id] === undefined || rowData[col.id] === null || rowData[col.id] === '') {
        rowData[col.id] = now;
      }
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO table_rows (id, table_id, data, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(rowId, tableId, JSON.stringify(rowData), nextPosition, now, now);

      db.prepare('UPDATE custom_tables SET updated_at = ? WHERE id = ?').run(now, tableId);
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return {
      id: rowId,
      tableId,
      data,
      position: nextPosition,
      createdAt: now,
      updatedAt: now,
    };
  }

  static updateRow(rowId: string, data: Record<string, any>): boolean {
    const db = this.getDb();
    const now = Date.now();
    const res = db.prepare(`
      UPDATE table_rows
      SET data = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(data), now, rowId);

    if ((res.changes ?? 0) > 0) {
      // Also update table updated_at
      const row = db.prepare('SELECT table_id FROM table_rows WHERE id = ?').get(rowId) as any;
      if (row?.table_id) {
        db.prepare('UPDATE custom_tables SET updated_at = ? WHERE id = ?').run(now, row.table_id);
      }
      return true;
    }
    return false;
  }

  static deleteRow(rowId: string): boolean {
    const db = this.getDb();
    const row = db.prepare('SELECT table_id FROM table_rows WHERE id = ?').get(rowId) as any;
    const res = db.prepare('DELETE FROM table_rows WHERE id = ?').run(rowId);
    if ((res.changes ?? 0) > 0 && row?.table_id) {
      db.prepare('UPDATE custom_tables SET updated_at = ? WHERE id = ?').run(Date.now(), row.table_id);
      return true;
    }
    return false;
  }

  static reorderRows(tableId: string, rowIds: string[]): boolean {
    const db = this.getDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      const stmt = db.prepare('UPDATE table_rows SET position = ? WHERE id = ? AND table_id = ?');
      rowIds.forEach((id, index) => {
        stmt.run(index, id, tableId);
      });
      db.prepare('UPDATE custom_tables SET updated_at = ? WHERE id = ?').run(Date.now(), tableId);
      db.exec('COMMIT;');
      return true;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}
