import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { fork, ChildProcess } from 'child_process';
import { CamoufoxManager } from './camoufoxManager';
import { DataStore } from './dataStore';

export interface WarmupOptions {
  siteCountMin?: number;
  siteCountMax?: number;
  timePerSiteMin?: number;
  timePerSiteMax?: number;
  customSites?: string[];
}

export interface WarmupState {
  profileId: string;
  isRunning: boolean;
  currentSite?: string;
  currentIndex?: number;
  totalSites?: number;
  remainingSeconds?: number;
  progressPercent?: number;
}

type WarmupEventCallback = (data: any) => void;

export class WarmupEngine {
  private static cachedSites: string[] | null = null;
  private static activeWarmupStates: Map<string, WarmupState> = new Map();
  private static headlessWarmupWorkers: Map<string, ChildProcess> = new Map();
  private static eventListeners: Map<string, Set<WarmupEventCallback>> = new Map();

  static on(event: string, callback: WarmupEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  private static emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(data);
        } catch {}
      });
    }
  }

  /**
   * Reads and caches the list of Brazilian websites from sites_br.txt
   */
  static loadSites(): string[] {
    if (this.cachedSites && this.cachedSites.length > 0) {
      return this.cachedSites;
    }

    const appPath = app ? app.getAppPath() : process.cwd();
    const candidates = [
      path.join(appPath, 'public/docs/sites_br.txt'),
      path.resolve(process.cwd(), 'public/docs/sites_br.txt'),
      path.join(appPath, 'docs/sites_br.txt'),
    ];

    let filePath: string | null = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        filePath = c;
        break;
      }
    }

    if (!filePath) {
      console.warn('[WarmupEngine] sites_br.txt não encontrado, usando fallback');
      this.cachedSites = [
        'mercadolivre.com.br',
        'globo.com',
        'uol.com.br',
        'gsuplementos.com.br',
        'hotmart.com',
        'kiwify.com.br',
        'insiderstore.com.br',
        'magazineluiza.com.br',
        'kabum.com.br',
        'shopper.com.br',
      ];
      return this.cachedSites;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'));
      this.cachedSites = lines;
      console.log(`[WarmupEngine] Carregados ${lines.length} domínios para aquecimento.`);
      return this.cachedSites;
    } catch (e) {
      console.error('[WarmupEngine] Erro ao ler sites_br.txt:', e);
      return [];
    }
  }

  /**
   * Shuffles an array and selects N random items
   */
  private static pickRandomSites(allSites: string[], count: number): string[] {
    const shuffled = [...allSites].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Returns current warmup status for a profile
   */
  static getStatus(profileId: string): WarmupState {
    return (
      this.activeWarmupStates.get(profileId) || {
        profileId,
        isRunning: false,
        progressPercent: 0,
      }
    );
  }

  /**
   * Returns list of profile IDs currently undergoing warmup
   */
  static getRunningWarmupIds(): string[] {
    const list: string[] = [];
    for (const [id, state] of this.activeWarmupStates.entries()) {
      if (state.isRunning) {
        list.push(id);
      }
    }
    return list;
  }

  /**
   * Calculates next randomized warmup timestamp between 21 and 27 hours with human hours jitter
   */
  static calculateNextWarmupTimestamp(fromTime: number = Date.now()): number {
    // Random interval between 21 and 27 hours
    const minHours = 21;
    const maxHours = 27;
    const randomHours = minHours + Math.random() * (maxHours - minHours);
    let target = fromTime + randomHours * 60 * 60 * 1000;

    // Human hours check: if lands between 02:00 AM and 06:30 AM local time,
    // delay slightly to morning (07:30 - 09:30 AM) to simulate human diurnal rhythm
    const targetDate = new Date(target);
    const hour = targetDate.getHours();
    if (hour >= 2 && hour < 7) {
      const shiftHours = (7 - hour) + 0.5 + Math.random() * 1.5;
      target += shiftHours * 60 * 60 * 1000;
    }

    return Math.floor(target);
  }

  /**
   * Starts a humanized warmup cycle for a profile
   */
  static async startWarmup(profileId: string, options: WarmupOptions = {}): Promise<{ success: boolean; error?: string }> {
    if (this.activeWarmupStates.get(profileId)?.isRunning) {
      return { success: false, error: 'Aquecimento já está em andamento para este perfil.' };
    }

    // Safety check: if profile is currently open/running in Camoufox, do not run warmup
    if (CamoufoxManager.isProfileRunning(profileId)) {
      return {
        success: false,
        error: 'O perfil está aberto no navegador. Feche o navegador para que o aquecimento seja executado em segundo plano de forma segura.',
      };
    }

    const allSites = this.loadSites();
    if (allSites.length === 0) {
      return { success: false, error: 'Lista de sites vazia.' };
    }

    const minSites = options.siteCountMin || 15;
    const maxSites = options.siteCountMax || 25;
    const chosenCount = Math.floor(Math.random() * (maxSites - minSites + 1)) + minSites;
    const selectedSites = options.customSites && options.customSites.length > 0
      ? options.customSites
      : this.pickRandomSites(allSites, chosenCount);

    const timePerSiteMin = options.timePerSiteMin || 30;
    const timePerSiteMax = options.timePerSiteMax || 90;

    const initialProgress: WarmupState = {
      profileId,
      isRunning: true,
      currentSite: selectedSites[0],
      currentIndex: 1,
      totalSites: selectedSites.length,
      remainingSeconds: timePerSiteMin,
      progressPercent: 0,
    };
    this.activeWarmupStates.set(profileId, initialProgress);
    this.emit('progress', initialProgress);

    // Spawn a headless Camoufox worker exclusively for background warmup
    const storedProfiles = DataStore.read().profiles;
    const profile = storedProfiles.find((p) => p.id === profileId);
    if (!profile) {
      this.activeWarmupStates.delete(profileId);
      return { success: false, error: 'Perfil não encontrado.' };
    }

    const osMap: Record<string, 'windows' | 'macos' | 'linux'> = {
      mac: 'macos',
      macos: 'macos',
      windows: 'windows',
      linux: 'linux',
    };
    const osTarget = osMap[profile.os] || 'windows';
    const profileDir = CamoufoxManager.getProfileDir(profileId);

    let proxyConfig: any = undefined;
    if (profile.proxy && profile.proxy.type !== 'direct' && profile.proxy.host && profile.proxy.port) {
      proxyConfig = {
        type: profile.proxy.type,
        host: profile.proxy.host,
        port: parseInt(String(profile.proxy.port), 10),
        username: profile.proxy.username,
        password: profile.proxy.password,
      };
    }

    const workerPayload = {
      profileId,
      profileDir,
      osTarget,
      proxyConfig,
      cookies: profile.cookies || [],
      fingerprint: profile.fingerprint,
      headless: true,
      isWarmupOnly: true,
      warmupData: {
        sites: selectedSites,
        timePerSiteMin,
        timePerSiteMax,
      },
    };

    const nodeBin = (CamoufoxManager as any).resolveNodeBinary();
    const workerScript = (CamoufoxManager as any).getWorkerPath();

    console.log(`[WarmupEngine] Lançando worker headless exclusivo de aquecimento para ${profile.name}...`);

    const child = fork(workerScript, [JSON.stringify(workerPayload)], {
      execPath: nodeBin,
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });

    this.headlessWarmupWorkers.set(profileId, child);

    child.on('message', (msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'warmup_progress') {
        const state: WarmupState = {
          profileId,
          isRunning: true,
          ...msg.data,
        };
        this.activeWarmupStates.set(profileId, state);
        this.emit('progress', state);
      } else if (msg.type === 'warmup_finished') {
        this.headlessWarmupWorkers.delete(profileId);
        this.activeWarmupStates.delete(profileId);
        this.onFinished(profileId, msg.warmedCount || 0);
        this.emit('finished', { profileId, success: msg.success, warmedCount: msg.warmedCount });
      }
    });

    child.on('error', (err) => {
      console.error(`[WarmupEngine] Erro no worker de aquecimento (${profileId}):`, err);
      this.headlessWarmupWorkers.delete(profileId);
      this.activeWarmupStates.delete(profileId);
      this.emit('finished', { profileId, success: false, error: err.message });
    });

    child.on('exit', () => {
      this.headlessWarmupWorkers.delete(profileId);
      this.activeWarmupStates.delete(profileId);
      this.emit('finished', { profileId, success: true });
    });

    return { success: true };
  }

  /**
   * Stops an ongoing warmup session
   */
  static stopWarmup(profileId: string): void {
    const headlessWorker = this.headlessWarmupWorkers.get(profileId);
    if (headlessWorker) {
      try {
        if (headlessWorker.connected) {
          headlessWorker.send({ type: 'cancel_warmup' });
        }
      } catch {}

      setTimeout(() => {
        try {
          headlessWorker.kill();
        } catch {}
      }, 300);

      this.headlessWarmupWorkers.delete(profileId);
    }

    this.activeWarmupStates.delete(profileId);
    this.emit('finished', { profileId, success: false, cancelled: true });
  }

  /**
   * Persists completion statistics in DataStore
   */
  private static onFinished(profileId: string, count: number): void {
    const data = DataStore.read();
    const nextWarmupAt = this.calculateNextWarmupTimestamp(Date.now());
    const updatedProfiles = data.profiles.map((p) => {
      if (p.id === profileId) {
        return {
          ...p,
          lastWarmupAt: Date.now(),
          nextWarmupAt,
          totalWarmupSites: (p.totalWarmupSites || 0) + count,
        };
      }
      return p;
    });
    DataStore.write({ profiles: updatedProfiles });
  }
}
