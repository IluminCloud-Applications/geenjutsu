import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fork, execSync, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { seedAgedProfileDirectory } from './profileAgeSeeder';
import { ProfileBookmarkSeeder } from './profileBookmarkSeeder';
import { CamoufoxInstallerService } from './camoufoxInstallerService';

export interface ProfileProxyConfig {
  type: 'socks5' | 'socks4' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ProfileFingerprintConfig {
  userAgent?: string;
  canvas?: 'noise' | 'off' | 'block';
  webgl?: 'noise' | 'off';
  audio?: 'noise' | 'off';
  webRTC?: 'altered' | 'real' | 'disabled';
  resolution?: string;
  timezone?: string;
  language?: string;
}

export interface OpenBrowserOptions {
  profileId: string;
  profileName?: string;
  initialUrl?: string;
  platform?: string;
  osTarget?: 'windows' | 'macos' | 'linux';
  proxy?: ProfileProxyConfig;
  cookies?: any[];
  fingerprint?: ProfileFingerprintConfig;
  headless?: boolean;
  economyMode?: boolean;
}

type EventCallback = (data: any) => void;

export class CamoufoxManager {
  private static activeWorkers: Map<string, ChildProcess> = new Map();
  private static eventListeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Registers an event listener
   */
  static on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Emits an event to registered listeners
   */
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
   * Resolves the runtime Node.js binary.
   * In Electron, process.execPath with ELECTRON_RUN_AS_NODE: '1' provides
   * the bundled Node.js runtime with built-in ASAR support without requiring
   * a system Node.js installation on Windows or macOS.
   */
  private static resolveNodeBinary(): string {
    if (process.env.NODE_BINARY && fs.existsSync(process.env.NODE_BINARY)) {
      return process.env.NODE_BINARY;
    }
    return process.execPath;
  }

  /**
   * Resolves the unpacked node_modules path so that workers executed via
   * ELECTRON_RUN_AS_NODE: '1' can reliably resolve all ESM dependencies (camoufox-js, etc.)
   * even when running from a packaged production ASAR environment.
   */
  private static getNodeModulesPath(): string {
    const appPath = app ? app.getAppPath() : process.cwd();
    const unpackedAppPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
    const candidates = [
      path.join(unpackedAppPath, 'node_modules'),
      path.join(appPath, 'node_modules'),
      path.resolve(process.cwd(), 'node_modules'),
      process.env.NODE_PATH,
    ].filter(Boolean);
    return Array.from(new Set(candidates)).join(path.delimiter);
  }

  /**
   * Locates or synchronizes the worker script path
   */
  private static getWorkerPath(): string {
    const appPath = app ? app.getAppPath() : process.cwd();
    const src = path.resolve(process.cwd(), 'src/main/workers/camoufoxWorker.mjs');
    const dest = path.resolve(process.cwd(), 'dist-electron/camoufoxWorker.mjs');

    // Auto-sync src to dist if src is newer or dest is missing
    if (fs.existsSync(src)) {
      try {
        const shouldCopy = !fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs;
        if (shouldCopy) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      } catch {}
    }

    const unpackedAppPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
    const resourcesPath = (process as any).resourcesPath || '';

    const candidates = [
      dest,
      src,
      path.join(unpackedAppPath, 'dist-electron/camoufoxWorker.mjs'),
      path.join(appPath, 'dist-electron/camoufoxWorker.mjs'),
      path.join(resourcesPath, 'app.asar.unpacked', 'dist-electron', 'camoufoxWorker.mjs'),
      path.join(appPath, 'src/main/workers/camoufoxWorker.mjs'),
    ];

    for (const p of candidates) {
      if (p && fs.existsSync(p)) return p;
    }

    return dest;
  }

  /**
   * Returns the dedicated persistent profile directory
   */
  static getProfileDir(profileId: string): string {
    // Each profile owns exactly one directory; ids that could escape or alias
    // another profile's directory are rejected.
    if (typeof profileId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(profileId)) {
      throw new Error(`ID de perfil inválido: "${profileId}"`);
    }
    const baseDir = path.join(app.getPath('userData'), 'camoufox_profiles');
    const profileDir = path.join(baseDir, profileId);
    if (path.dirname(profileDir) !== baseDir) {
      throw new Error(`Diretório de perfil inválido: "${profileId}"`);
    }
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    // Ownership marker: guarantees the directory is never reused by another id.
    const ownerPath = path.join(profileDir, '.geenjutsu_profile_id');
    try {
      if (fs.existsSync(ownerPath)) {
        const owner = fs.readFileSync(ownerPath, 'utf-8').trim();
        if (owner && owner !== profileId) {
          throw new Error(`Diretório pertence a outro perfil (${owner}).`);
        }
      } else {
        fs.writeFileSync(ownerPath, profileId, 'utf-8');
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Diretório pertence')) throw err;
    }
    return profileDir;
  }

  /**
   * Cookies queued by an import; consumed (and deleted) on the next launch.
   */
  private static getPendingCookiesPath(profileId: string): string {
    return path.join(this.getProfileDir(profileId), 'cookies_import_pending.json');
  }

  /**
   * Returns path to cookie backup file for a profile
   */
  private static getCookiesBackupPath(profileId: string): string {
    return path.join(this.getProfileDir(profileId), 'cookies_backup.json');
  }

  /**
   * Returns path to persistent hardware fingerprint configuration file for a profile
   */
  static getHardwareConfigPath(profileId: string): string {
    return path.join(this.getProfileDir(profileId), 'fingerprint_hardware.json');
  }

  /**
   * Reads or generates the persistent hardware configuration for a profile
   */
  static async getOrCreateHardwareProfile(
    profileId: string,
    osTarget: 'windows' | 'macos' | 'linux' = 'windows',
    fingerprint?: ProfileFingerprintConfig
  ): Promise<any | null> {
    const profileDir = this.getProfileDir(profileId);
    const hardwarePath = this.getHardwareConfigPath(profileId);

    // If file already exists, read directly
    if (fs.existsSync(hardwarePath)) {
      try {
        const raw = fs.readFileSync(hardwarePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.fingerprint && parsed.config && parsed.webgl_config) {
          return parsed;
        }
      } catch (err) {
        console.warn(`[CamoufoxManager] Erro ao ler hardware existente:`, err);
      }
    }

    // Otherwise, spawn worker in --generate-hardware mode to generate it safely
    const nodeBin = this.resolveNodeBinary();
    const workerScript = this.getWorkerPath();
    const payload = { profileDir, profileId, osTarget, fingerprint };

    return new Promise((resolve) => {
      let resolved = false;

      const configPath = path.join(
        profileDir,
        `.hw-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
      );

      try {
        fs.writeFileSync(configPath, JSON.stringify(payload), 'utf-8');
      } catch (err) {
        console.warn(`[CamoufoxManager] Erro ao gravar hw config temporário:`, err);
      }

      const cleanupConfig = () => {
        try {
          if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
          }
        } catch {}
      };

      let child: any;
      try {
        child = fork(workerScript, ['--generate-hardware', '--config-file', configPath], {
          execPath: nodeBin,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_PATH: this.getNodeModulesPath(),
          },
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        });
      } catch (err) {
        cleanupConfig();
        console.error(`[CamoufoxManager] Erro ao spawnar worker de hardware:`, err);
        return resolve(null);
      }

      child.on('message', (msg: any) => {
        if (msg && msg.type === 'hardware_generated') {
          cleanupConfig();
          if (!resolved) {
            resolved = true;
            resolve(msg.hardware);
          }
        }
      });

      child.on('exit', () => {
        cleanupConfig();
        if (!resolved) {
          resolved = true;
          if (fs.existsSync(hardwarePath)) {
            try {
              const raw = fs.readFileSync(hardwarePath, 'utf-8');
              resolve(JSON.parse(raw));
              return;
            } catch {}
          }
          resolve(null);
        }
      });

      child.on('error', (err: any) => {
        cleanupConfig();
        console.error(`[CamoufoxManager] Erro ao gerar hardware via worker:`, err);
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 7000);
    });
  }

  /**
   * Saves hardware profile to disk for a specific profile (used on import)
   */
  static saveHardwareConfig(profileId: string, hardwareConfig: any): boolean {
    if (!profileId || !hardwareConfig || typeof hardwareConfig !== 'object') {
      return false;
    }
    try {
      const profileDir = this.getProfileDir(profileId);
      const hardwarePath = this.getHardwareConfigPath(profileId);
      const dataToSave = {
        ...hardwareConfig,
        profileId,
      };
      fs.writeFileSync(hardwarePath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      console.log(`[CamoufoxManager] Hardware persistente salvo com sucesso para o perfil "${profileId}".`);
      return true;
    } catch (err) {
      console.error(`[CamoufoxManager] Erro ao salvar hardware config:`, err);
      return false;
    }
  }

  /**
   * Opens the Camoufox Anti-Detect browser for a given profile
   */
  static async openBrowser(options: OpenBrowserOptions): Promise<{ success: boolean; error?: string }> {
    const {
      profileId,
      profileName = 'Perfil',
      initialUrl = 'https://google.com',
      platform = 'general',
      osTarget = 'windows',
      proxy,
      cookies: providedCookies,
      fingerprint,
      headless = false,
      economyMode = false,
    } = options;

    // 0. Ensure Camoufox engine is installed
    const camoufoxStatus = await CamoufoxInstallerService.checkStatus();
    if (!camoufoxStatus.installed) {
      console.log(`[CamoufoxManager] Camoufox não instalado. Disparando instalação automática para o perfil "${profileName}"...`);
      const installRes = await CamoufoxInstallerService.install();
      if (!installRes.success) {
        return {
          success: false,
          error: `O navegador Camoufox Anti-Detect precisa ser instalado: ${installRes.error || 'Erro no download'}`,
        };
      }
    }

    // 1. If already open, bring to front or navigate
    const existingWorker = this.activeWorkers.get(profileId);
    if (existingWorker && existingWorker.connected) {
      console.log(`[CamoufoxManager] Perfil "${profileName}" (${profileId}) já está em execução.`);
      existingWorker.send({ type: 'navigate', url: initialUrl });
      return { success: true };
    }

    const profileDir = this.getProfileDir(profileId);

    // 2. Pre-seed profile directory so it appears aged (mature)
    seedAgedProfileDirectory(profileDir);

    // 3. Seed platform bookmarks & ensure bookmarks toolbar is visible
    ProfileBookmarkSeeder.seedBookmarks(profileDir, platform);

    // 4. Cookies persist natively in the profile's own browser store (like Chrome).
    // Nothing is replayed on launch except cookies from an explicit import,
    // queued in a pending file that is consumed once.
    let cookiesToInject: any[] = [];
    const pendingPath = this.getPendingCookiesPath(profileId);
    if (fs.existsSync(pendingPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
        if (Array.isArray(parsed)) cookiesToInject = parsed;
      } catch {}
      try {
        fs.unlinkSync(pendingPath);
      } catch {}
    }

    const workerPayload = {
      profileId,
      profileDir,
      initialUrl,
      platform,
      osTarget,
      proxyConfig: proxy,
      cookies: cookiesToInject,
      fingerprint,
      headless,
      economyMode,
    };

    const nodeBin = this.resolveNodeBinary();
    const workerScript = this.getWorkerPath();

    console.log(`[CamoufoxManager] Lançando perfil "${profileName}" (${profileId})...`, {
      nodeBin,
      workerScript,
      osTarget,
      hasProxy: Boolean(proxy),
      economyMode,
    });

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      let isResolved = false;

      const configPath = path.join(
        profileDir,
        `.worker-config-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
      );

      try {
        fs.writeFileSync(configPath, JSON.stringify(workerPayload), 'utf-8');
      } catch (err: any) {
        console.error(`[CamoufoxManager] Erro ao salvar worker-config para ${profileName}:`, err);
        return resolve({ success: false, error: err?.message || 'Falha ao salvar configuração temporária.' });
      }

      const cleanupConfig = () => {
        try {
          if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
          }
        } catch {}
      };

      let child: any;
      try {
        child = fork(workerScript, ['--config-file', configPath], {
          execPath: nodeBin,
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_PATH: this.getNodeModulesPath(),
          },
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        });
      } catch (err: any) {
        cleanupConfig();
        console.error(`[CamoufoxManager] Erro ao lançar worker para ${profileName}:`, err);
        return resolve({ success: false, error: err?.message || 'Falha ao lançar processo do navegador.' });
      }

      this.activeWorkers.set(profileId, child);
      this.emit('status_changed', { profileId, status: 'launching', economyMode });

      child.on('message', (msg: any) => {
        if (!msg || typeof msg !== 'object') return;

        if (msg.type === 'ready') {
          cleanupConfig();
          console.log(`[CamoufoxManager] Perfil "${profileName}" pronto e ativo! (Modo Economia: ${Boolean(economyMode)})`);
          this.emit('status_changed', { profileId, status: 'running', economyMode });
          if (!isResolved) {
            isResolved = true;
            resolve({ success: true });
          }
        } else if (msg.type === 'cookies_updated' && Array.isArray(msg.cookies)) {
          this.emit('cookies_updated', { profileId, cookies: msg.cookies });
        } else if (msg.type === 'automation_log') {
          this.emit('automation_log', msg);
        } else if (msg.type === 'automation_finished') {
          this.emit('automation_finished', msg);
        } else if (msg.type === 'closed') {
          cleanupConfig();
          this.activeWorkers.delete(profileId);
          this.emit('status_changed', { profileId, status: 'idle', economyMode: false });
        }
      });

      child.on('error', (err: any) => {
        cleanupConfig();
        console.error(`[CamoufoxManager] Erro no worker do perfil ${profileId}:`, err);
        this.activeWorkers.delete(profileId);
        this.emit('status_changed', { profileId, status: 'idle', economyMode: false });
        if (!isResolved) {
          isResolved = true;
          resolve({ success: false, error: err.message });
        }
      });

      child.on('exit', (code: number | null) => {
        cleanupConfig();
        console.log(`[CamoufoxManager] Worker do perfil ${profileId} finalizado (código: ${code})`);
        this.activeWorkers.delete(profileId);
        this.emit('status_changed', { profileId, status: 'idle', economyMode: false });
        if (!isResolved) {
          isResolved = true;
          if (code === 0) resolve({ success: true });
          else resolve({ success: false, error: `Processo finalizou com código ${code}` });
        }
      });

      // Safety timeout
      setTimeout(() => {
        cleanupConfig();
        if (!isResolved) {
          isResolved = true;
          resolve({ success: true });
        }
      }, 7000);
    });
  }

  /**
   * Injects cookies into disk backup and into the active worker if running
   */
  static async injectCookies(
    profileId: string,
    cookies: any[]
  ): Promise<{ success: boolean; count: number; error?: string }> {
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return { success: false, count: 0, error: 'Lista de cookies inválida ou vazia.' };
    }

    // 1. If worker is active, inject live; otherwise queue for next launch
    const worker = this.activeWorkers.get(profileId);
    if (!(worker && worker.connected)) {
      try {
        fs.writeFileSync(this.getPendingCookiesPath(profileId), JSON.stringify(cookies, null, 2), 'utf-8');
      } catch (err: any) {
        console.error(`[CamoufoxManager] Erro ao salvar cookies em disco:`, err);
      }
    }

    // 2. If worker is active, send IPC message
    if (worker && worker.connected) {
      worker.send({ type: 'inject_cookies', cookies });
      console.log(`[CamoufoxManager] ${cookies.length} cookies enviados para worker em execução.`);
    }

    this.emit('cookies_updated', { profileId, cookies });
    return { success: true, count: cookies.length };
  }

  /**
   * Closes the browser for a profile
   */
  static async closeBrowser(profileId: string): Promise<void> {
    const worker = this.activeWorkers.get(profileId);
    if (worker) {
      if (worker.connected) {
        worker.send({ type: 'close' });
      } else {
        worker.kill();
      }
      this.activeWorkers.delete(profileId);
      this.emit('status_changed', { profileId, status: 'idle' });
    }
  }

  /**
   * Closes all active browser processes
   */
  static async closeAllBrowsers(): Promise<void> {
    for (const [profileId, worker] of this.activeWorkers.entries()) {
      try {
        if (worker.connected) worker.send({ type: 'close' });
        else worker.kill();
      } catch {}
      this.emit('status_changed', { profileId, status: 'idle' });
    }
    this.activeWorkers.clear();
  }

  /**
   * Checks if a profile is currently active
   */
  static isProfileRunning(profileId: string): boolean {
    const worker = this.activeWorkers.get(profileId);
    return Boolean(worker && worker.connected);
  }

  /**
   * Returns list of currently running profile IDs
   */
  static getRunningProfileIds(): string[] {
    const list: string[] = [];
    for (const [profileId, worker] of this.activeWorkers.entries()) {
      if (worker && worker.connected) {
        list.push(profileId);
      }
    }
    return list;
  }

  /**
   * Sends automation code to active profile worker
   */
  static runAutomationInProfile(profileId: string, automationId: string, code: string): boolean {
    const worker = this.activeWorkers.get(profileId);
    if (worker && worker.connected) {
      worker.send({
        type: 'run_automation',
        automationId,
        code,
      });
      return true;
    }
    return false;
  }

  /**
   * Stops a running automation in an active profile worker
   */
  static stopAutomationInProfile(profileId: string, automationId: string): boolean {
    const worker = this.activeWorkers.get(profileId);
    if (worker && worker.connected) {
      worker.send({
        type: 'stop_automation',
        automationId,
      });
      return true;
    }
    return false;
  }
}

