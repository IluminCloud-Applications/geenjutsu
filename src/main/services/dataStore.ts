import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface AppSettings {
  closeAction?: 'ask' | 'quit' | 'background';
  onboardingCompleted?: boolean;
}

export interface StorageData {
  profiles: any[];
  folders: any[];
  proxies: any[];
  automations?: any[];
  security?: any;
  settings?: AppSettings;
  updatedAt: number;
}

export class DataStore {
  private static getFilePath(): string {
    const userData = app ? app.getPath('userData') : path.join(process.cwd(), '.geenjutsu_data');
    return path.join(userData, 'geenjutsu_data.json');
  }

  static read(): StorageData {
    const filePath = this.getFilePath();
    if (!fs.existsSync(filePath)) {
      return {
        profiles: [],
        folders: [],
        proxies: [],
        automations: [],
        updatedAt: Date.now(),
      };
    }


    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data: StorageData = JSON.parse(raw);
      if (Array.isArray(data.profiles)) {
        data.profiles = data.profiles.map(p => {
          if (p.id && typeof p.id === 'string' && p.id.startsWith('p-')) {
            const realTs = Number(p.id.replace('p-', ''));
            if (!isNaN(realTs) && realTs > 1700000000000 && (!p.createdAt || p.createdAt < realTs - 86400000 * 2)) {
              p.createdAt = realTs;
              p.updatedAt = realTs;
            }
          }
          return p;
        });
      }
      if (!Array.isArray(data.automations)) {
        data.automations = [];
      }
      if (!data.settings) {
        data.settings = { closeAction: 'ask' };
      }
      return data;
    } catch {
      return {
        profiles: [],
        folders: [],
        proxies: [],
        automations: [],
        settings: { closeAction: 'ask' },
        updatedAt: Date.now(),
      };
    }

  }

  static write(data: Partial<StorageData>): StorageData {
    const current = this.read();
    const updated: StorageData = {
      ...current,
      ...data,
      updatedAt: Date.now(),
    };

    const filePath = this.getFilePath();
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DataStore] Erro ao gravar dados:', e);
    }

    return updated;
  }

  static clear(): void {
    const filePath = this.getFilePath();
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}
