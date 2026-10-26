import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { IntegrationConfig } from '../../types/integration';

export class IntegrationStore {
  private static db: DatabaseSync | null = null;

  private static getDatabasePath(): string {
    const userData = app ? app.getPath('userData') : path.join(process.cwd(), '.geenjutsu_data');
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true });
    }
    return path.join(userData, 'geenjutsu_integrations.sqlite');
  }

  private static getDb(): DatabaseSync {
    if (!this.db) {
      const dbPath = this.getDatabasePath();
      this.db = new DatabaseSync(dbPath);
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.initSchema();
    }
    return this.db;
  }

  private static initSchema() {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS integrations (
        service_id TEXT PRIMARY KEY,
        api_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        cached_balance REAL DEFAULT 0,
        cached_data TEXT,
        settings TEXT,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  static getIntegration(serviceId: string): IntegrationConfig | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM integrations WHERE service_id = ?');
    const row = stmt.get(serviceId) as any;
    if (!row) return null;

    let cachedData = null;
    let settings = null;
    try {
      if (row.cached_data) cachedData = JSON.parse(row.cached_data);
    } catch {}
    try {
      if (row.settings) settings = JSON.parse(row.settings);
    } catch {}

    return {
      serviceId: row.service_id,
      apiKey: row.api_key,
      status: row.status,
      cachedBalance: row.cached_balance || 0,
      cachedData,
      settings,
      updatedAt: row.updated_at,
    };
  }

  static getAllIntegrations(): IntegrationConfig[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM integrations');
    const rows = stmt.all() as any[];
    return rows.map(row => {
      let cachedData = null;
      let settings = null;
      try {
        if (row.cached_data) cachedData = JSON.parse(row.cached_data);
      } catch {}
      try {
        if (row.settings) settings = JSON.parse(row.settings);
      } catch {}

      return {
        serviceId: row.service_id,
        apiKey: row.api_key,
        status: row.status,
        cachedBalance: row.cached_balance || 0,
        cachedData,
        settings,
        updatedAt: row.updated_at,
      };
    });
  }

  static saveIntegration(
    serviceId: string,
    apiKey: string,
    status: string = 'connected',
    cachedBalance: number = 0,
    cachedData?: any,
    settings?: any
  ): IntegrationConfig {
    const db = this.getDb();
    const existing = this.getIntegration(serviceId);
    const now = Date.now();

    const mergedSettings = settings !== undefined ? settings : existing?.settings || {};
    const mergedData = cachedData !== undefined ? cachedData : existing?.cachedData || {};
    const finalBalance = cachedBalance !== undefined ? cachedBalance : existing?.cachedBalance || 0;

    const stmt = db.prepare(`
      INSERT INTO integrations (service_id, api_key, status, cached_balance, cached_data, settings, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service_id) DO UPDATE SET
        api_key = excluded.api_key,
        status = excluded.status,
        cached_balance = excluded.cached_balance,
        cached_data = excluded.cached_data,
        settings = excluded.settings,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      serviceId,
      apiKey.trim(),
      status,
      finalBalance,
      JSON.stringify(mergedData),
      JSON.stringify(mergedSettings),
      now
    );

    return {
      serviceId,
      apiKey: apiKey.trim(),
      status: status as any,
      cachedBalance: finalBalance,
      cachedData: mergedData,
      settings: mergedSettings,
      updatedAt: now,
    };
  }

  static deleteIntegration(serviceId: string): boolean {
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM integrations WHERE service_id = ?');
    stmt.run(serviceId);
    return true;
  }
}
