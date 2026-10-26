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
  trigger?: 'auto' | 'manual';
}

export interface WarmupQueueItem {
  profileId: string;
  options?: WarmupOptions;
  trigger: 'auto' | 'manual';
  queuedAt: number;
}

export interface WarmupState {
  profileId: string;
  isRunning: boolean;
  isQueued?: boolean;
  queuePosition?: number;
  totalQueued?: number;
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
  private static eventListeners: Map<string, Set<WarmupEventCallback>> = new Map();

  // Strict Single-Concurrency Queue State
  // Exactly 1 profile warming up at any time to prevent RAM and CPU spikes
  private static activeProfileId: string | null = null;
  private static activeWorker: ChildProcess | null = null;
  private static activeConfigPath: string | null = null;
  private static queue: WarmupQueueItem[] = [];
  private static cooldownTimer: NodeJS.Timeout | null = null;

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
   * Checks whether a specific profile or any profile is actively running warmup
   */
  static isWarmupRunning(profileId?: string): boolean {
    if (profileId) {
      return this.activeProfileId === profileId;
    }
    return this.activeProfileId !== null;
  }

  /**
   * Checks whether a profile is in the queue waiting to be warmed up
   */
  static isQueued(profileId: string): boolean {
    return this.queue.some((item) => item.profileId === profileId);
  }

  /**
   * Returns 1-based queue position (0 if not in queue)
   */
  static getQueuePosition(profileId: string): number {
    const idx = this.queue.findIndex((item) => item.profileId === profileId);
    return idx >= 0 ? idx + 1 : 0;
  }

  /**
   * Returns current warmup status for a profile (running, queued, or idle)
   */
  static getStatus(profileId: string): WarmupState {
    if (this.activeProfileId === profileId) {
      return (
        this.activeWarmupStates.get(profileId) || {
          profileId,
          isRunning: true,
          isQueued: false,
          progressPercent: 0,
        }
      );
    }

    const queueIdx = this.queue.findIndex((item) => item.profileId === profileId);
    if (queueIdx !== -1) {
      return {
        profileId,
        isRunning: false,
        isQueued: true,
        queuePosition: queueIdx + 1,
        totalQueued: this.queue.length,
        progressPercent: 0,
      };
    }

    return (
      this.activeWarmupStates.get(profileId) || {
        profileId,
        isRunning: false,
        isQueued: false,
        progressPercent: 0,
      }
    );
  }

  /**
   * Returns list of profile IDs currently undergoing warmup (at most 1)
   */
  static getRunningWarmupIds(): string[] {
    return this.activeProfileId ? [this.activeProfileId] : [];
  }

  /**
   * Returns list of profile IDs currently waiting in queue
   */
  static getQueuedWarmupIds(): string[] {
    return this.queue.map((item) => item.profileId);
  }

  /**
   * Returns payload describing current queue state
   */
  static getQueuePayload(): { queue: Array<{ profileId: string; position: number; queuedAt: number; trigger: string }> } {
    return {
      queue: this.queue.map((item, index) => ({
        profileId: item.profileId,
        position: index + 1,
        queuedAt: item.queuedAt,
        trigger: item.trigger,
      })),
    };
  }

  /**
   * Broadcasts queue updates and updates status for queued profiles
   */
  private static notifyQueueUpdate(): void {
    const payload = this.getQueuePayload();
    this.emit('queue_updated', payload);

    this.queue.forEach((item, index) => {
      const state: WarmupState = {
        profileId: item.profileId,
        isRunning: false,
        isQueued: true,
        queuePosition: index + 1,
        totalQueued: this.queue.length,
        progressPercent: 0,
      };
      this.activeWarmupStates.set(item.profileId, state);
      this.emit('progress', state);
    });
  }

  /**
   * Removes a profile from the warmup queue
   */
  static removeFromQueue(profileId: string): boolean {
    const index = this.queue.findIndex((item) => item.profileId === profileId);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    this.activeWarmupStates.delete(profileId);
    console.log(`[WarmupEngine] Perfil "${profileId}" removido da fila de aquecimento.`);
    this.notifyQueueUpdate();
    this.emit('finished', { profileId, success: false, cancelled: true, dequeued: true });
    return true;
  }

  /**
   * Calculates next randomized warmup timestamp between 21 and 27 hours with human hours jitter
   */
  static calculateNextWarmupTimestamp(fromTime: number = Date.now()): number {
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
   * Requests warmup for a profile.
   * If a profile is already being warmed up, enqueues this profile so only 1 runs at a time,
   * avoiding computer RAM and CPU overload.
   */
  static async startWarmup(
    profileId: string,
    options: WarmupOptions = {},
    trigger: 'auto' | 'manual' = 'manual'
  ): Promise<{ success: boolean; queued?: boolean; queuePosition?: number; error?: string }> {
    if (this.activeProfileId === profileId) {
      return { success: false, error: 'Aquecimento já está em andamento para este perfil.' };
    }

    if (this.isQueued(profileId)) {
      return {
        success: true,
        queued: true,
        queuePosition: this.getQueuePosition(profileId),
      };
    }

    // Safety check: if profile is currently open/running in Camoufox, do not run warmup
    if (CamoufoxManager.isProfileRunning(profileId)) {
      return {
        success: false,
        error:
          'O perfil está aberto no navegador. Feche o navegador para que o aquecimento seja executado em segundo plano de forma segura.',
      };
    }

    const storedProfiles = DataStore.read().profiles;
    const profile = storedProfiles.find((p) => p.id === profileId);
    if (!profile) {
      return { success: false, error: 'Perfil não encontrado.' };
    }

    // If another profile is currently active or in cooldown, enqueue this profile
    if (this.activeProfileId !== null || this.cooldownTimer !== null) {
      this.queue.push({
        profileId,
        options,
        trigger,
        queuedAt: Date.now(),
      });

      const queuePosition = this.queue.length;
      console.log(
        `[WarmupEngine] Fila de Aquecimento: perfil "${profile.name}" (${profileId}) enfileirado na posição #${queuePosition}. Concorrência limitada a 1 profile por vez para preservar CPU e RAM.`
      );

      const queueState: WarmupState = {
        profileId,
        isRunning: false,
        isQueued: true,
        queuePosition,
        totalQueued: this.queue.length,
        progressPercent: 0,
      };
      this.activeWarmupStates.set(profileId, queueState);
      this.emit('progress', queueState);
      this.emit('queue_updated', this.getQueuePayload());

      return { success: true, queued: true, queuePosition };
    }

    // Otherwise, start execution immediately
    return await this.executeWarmup(profileId, options);
  }

  /**
   * Spawns the headless Camoufox worker exclusively for warmup
   */
  private static async executeWarmup(
    profileId: string,
    options: WarmupOptions = {}
  ): Promise<{ success: boolean; error?: string }> {
    this.activeProfileId = profileId;

    const allSites = this.loadSites();
    if (allSites.length === 0) {
      this.activeProfileId = null;
      return { success: false, error: 'Lista de sites vazia.' };
    }

    const minSites = options.siteCountMin || 15;
    const maxSites = options.siteCountMax || 25;
    const chosenCount = Math.floor(Math.random() * (maxSites - minSites + 1)) + minSites;
    const selectedSites =
      options.customSites && options.customSites.length > 0
        ? options.customSites
        : this.pickRandomSites(allSites, chosenCount);

    const timePerSiteMin = options.timePerSiteMin || 30;
    const timePerSiteMax = options.timePerSiteMax || 90;

    const initialProgress: WarmupState = {
      profileId,
      isRunning: true,
      isQueued: false,
      currentSite: selectedSites[0],
      currentIndex: 1,
      totalSites: selectedSites.length,
      remainingSeconds: timePerSiteMin,
      progressPercent: 0,
    };
    this.activeWarmupStates.set(profileId, initialProgress);
    this.emit('progress', initialProgress);

    const storedProfiles = DataStore.read().profiles;
    const profile = storedProfiles.find((p) => p.id === profileId);
    if (!profile) {
      this.activeWarmupStates.delete(profileId);
      this.activeProfileId = null;
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

    const configPath = path.join(
      profileDir,
      `.warmup-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
    );

    try {
      fs.writeFileSync(configPath, JSON.stringify(workerPayload), 'utf-8');
    } catch (err: any) {
      console.error(`[WarmupEngine] Erro ao gravar configuração de aquecimento para ${profile.name}:`, err);
      this.activeWarmupStates.delete(profileId);
      this.activeProfileId = null;
      return { success: false, error: err?.message || 'Falha ao gravar arquivo de configuração temporário.' };
    }

    this.activeConfigPath = configPath;

    console.log(`[WarmupEngine] Lançando worker headless exclusivo de aquecimento para "${profile.name}" (${profileId})...`);

    const nodeModulesPath = (CamoufoxManager as any).getNodeModulesPath
      ? (CamoufoxManager as any).getNodeModulesPath()
      : process.env.NODE_PATH || '';

    let child: ChildProcess;
    try {
      child = fork(workerScript, ['--config-file', configPath], {
        execPath: nodeBin,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          NODE_PATH: nodeModulesPath,
        },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
    } catch (err: any) {
      try {
        if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
      } catch {}
      this.activeConfigPath = null;
      this.activeWarmupStates.delete(profileId);
      this.activeProfileId = null;
      console.error(`[WarmupEngine] Erro ao lançar processo de aquecimento para ${profile.name}:`, err);
      return { success: false, error: err?.message || 'Falha ao iniciar worker de aquecimento.' };
    }

    this.activeWorker = child;

    child.on('message', (msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'warmup_progress') {
        const state: WarmupState = {
          profileId,
          isRunning: true,
          isQueued: false,
          ...msg.data,
        };
        this.activeWarmupStates.set(profileId, state);
        this.emit('progress', state);
      } else if (msg.type === 'warmup_finished') {
        this.handleWorkerFinished(profileId, Boolean(msg.success), msg.warmedCount, configPath);
      }
    });

    child.on('error', (err) => {
      console.error(`[WarmupEngine] Erro no worker de aquecimento (${profileId}):`, err);
      this.handleWorkerFinished(profileId, false, undefined, configPath, err.message);
    });

    child.on('exit', () => {
      this.handleWorkerFinished(profileId, true, undefined, configPath);
    });

    return { success: true };
  }

  /**
   * Cleanly handles completion or termination of a worker and advances the queue
   */
  private static handleWorkerFinished(
    profileId: string,
    success: boolean,
    warmedCount?: number,
    configPath?: string,
    error?: string
  ): void {
    if (this.activeProfileId !== profileId) {
      return;
    }

    const cleanPath = configPath || this.activeConfigPath;
    if (cleanPath) {
      try {
        if (fs.existsSync(cleanPath)) {
          fs.unlinkSync(cleanPath);
        }
      } catch {}
    }

    if (this.activeWorker) {
      try {
        this.activeWorker.removeAllListeners();
      } catch {}
      this.activeWorker = null;
    }

    this.activeConfigPath = null;
    this.activeProfileId = null;
    this.activeWarmupStates.delete(profileId);

    if (typeof warmedCount === 'number' && warmedCount > 0) {
      this.onFinished(profileId, warmedCount);
    }

    console.log(
      `[WarmupEngine] Aquecimento concluído para o perfil "${profileId}". Sucesso: ${success}, Sites aquecidos: ${warmedCount || 0}.`
    );

    this.emit('finished', { profileId, success, warmedCount, error });

    // Process next queued profile after brief cooldown
    this.processNextInQueue();
  }

  /**
   * Advances queue: waits a 5s cooldown to allow CPU/RAM to completely settle, then starts next profile
   */
  private static processNextInQueue(): void {
    if (this.activeProfileId !== null) {
      return;
    }

    if (this.queue.length === 0) {
      this.notifyQueueUpdate();
      return;
    }

    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }

    console.log(
      `[WarmupEngine] Fila: aguardando 5s de resfriamento/liberação de memória RAM e CPU antes do próximo perfil... (${this.queue.length} perfil(is) aguardando)`
    );

    this.cooldownTimer = setTimeout(async () => {
      this.cooldownTimer = null;
      if (this.activeProfileId !== null || this.queue.length === 0) {
        return;
      }

      while (this.queue.length > 0) {
        const nextItem = this.queue.shift()!;
        this.notifyQueueUpdate();

        // 1. Verify profile still exists in DataStore
        const data = DataStore.read();
        const profile = (data.profiles || []).find((p) => p.id === nextItem.profileId);
        if (!profile) {
          console.log(`[WarmupEngine] Fila: perfil "${nextItem.profileId}" não encontrado. Pulando.`);
          this.activeWarmupStates.delete(nextItem.profileId);
          continue;
        }

        // 2. Verify user hasn't opened this profile's browser
        const isBrowserOpen =
          CamoufoxManager.isProfileRunning(nextItem.profileId) ||
          profile.status === 'running' ||
          profile.status === 'launching';

        if (isBrowserOpen) {
          console.log(
            `[WarmupEngine] Fila: perfil "${profile.name}" está com o navegador aberto pelo usuário. Pulando aquecimento para o próximo perfil da fila.`
          );
          profile.nextWarmupAt = Date.now() + 15 * 60 * 1000;
          DataStore.write({ profiles: data.profiles });
          this.activeWarmupStates.delete(nextItem.profileId);
          this.emit('finished', { profileId: nextItem.profileId, success: false, reason: 'browser_open' });
          continue;
        }

        // 3. Start execution of this profile
        console.log(
          `[WarmupEngine] Fila: iniciando aquecimento do próximo perfil "${profile.name}" (${nextItem.profileId})...`
        );
        const result = await this.executeWarmup(nextItem.profileId, nextItem.options);
        if (!result.success) {
          console.error(
            `[WarmupEngine] Fila: falha ao iniciar aquecimento para "${profile.name}":`,
            result.error
          );
          this.activeProfileId = null;
          this.activeWarmupStates.delete(nextItem.profileId);
          this.emit('finished', { profileId: nextItem.profileId, success: false, error: result.error });
          continue;
        }

        // Successfully launched, exit queue loop
        break;
      }
    }, 5000);
  }

  /**
   * Stops an ongoing warmup session or removes a queued profile from the queue
   */
  static stopWarmup(profileId: string): void {
    // If it's queued, remove from queue
    if (this.isQueued(profileId)) {
      this.removeFromQueue(profileId);
      return;
    }

    // If it's the actively running profile
    if (this.activeProfileId === profileId && this.activeWorker) {
      try {
        if (this.activeWorker.connected) {
          this.activeWorker.send({ type: 'cancel_warmup' });
        }
      } catch {}

      const workerToKill = this.activeWorker;
      const configToClean = this.activeConfigPath;

      setTimeout(() => {
        try {
          workerToKill.kill();
        } catch {}
      }, 300);

      this.handleWorkerFinished(
        profileId,
        false,
        undefined,
        configToClean || undefined,
        'Cancelado pelo usuário'
      );
    }
  }

  /**
   * Stops all warmup activities, clears the queue, and shuts down any active worker
   */
  static stopAll(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }

    this.queue = [];

    if (this.activeWorker) {
      try {
        this.activeWorker.kill();
      } catch {}
      this.activeWorker = null;
    }

    if (this.activeConfigPath) {
      try {
        if (fs.existsSync(this.activeConfigPath)) {
          fs.unlinkSync(this.activeConfigPath);
        }
      } catch {}
      this.activeConfigPath = null;
    }

    this.activeProfileId = null;
    this.activeWarmupStates.clear();
  }

  /**
   * Persists completion statistics in DataStore
   */
  private static onFinished(profileId: string, count: number): void {
    const data = DataStore.read();
    const nextWarmupAt = this.calculateNextWarmupTimestamp(Date.now());
    const updatedProfiles = (data.profiles || []).map((p) => {
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
