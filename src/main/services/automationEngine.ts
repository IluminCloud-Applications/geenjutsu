import { CamoufoxManager, ProfileProxyConfig } from './camoufoxManager';
import { DataStore } from './dataStore';
import { AutomationRunLog, AutomationRunState } from '../../types/automation';

export type { AutomationRunLog, AutomationRunState };

type EventCallback = (data: any) => void;

function normalizeProxy(proxyInput: any): ProfileProxyConfig | undefined {
  if (!proxyInput || proxyInput.type === 'direct') return undefined;

  let host = proxyInput.host || '';
  let port = proxyInput.port || '';
  let username = proxyInput.username || '';
  let password = proxyInput.password || '';

  if (!host && proxyInput.ipDisplay) {
    const raw = String(proxyInput.ipDisplay).trim().replace(/^[a-z0-9]+:\/\//i, '');
    const parts = raw.split(':');
    if (parts.length >= 2) {
      host = parts[0];
      port = parts[1];
      if (parts[2]) username = parts[2];
      if (parts[3]) password = parts.slice(3).join(':');
    }
  }

  const portNum = parseInt(String(port).trim(), 10);
  if (!host.trim() || isNaN(portNum) || portNum <= 0) return undefined;

  const rawType = (proxyInput.type || 'socks5').toLowerCase();
  const validProto: 'socks5' | 'socks4' | 'http' | 'https' =
    rawType === 'http' || rawType === 'https' || rawType === 'socks4' ? rawType : 'socks5';

  return {
    type: validProto,
    host: host.trim(),
    port: portNum,
    username: username.trim() || undefined,
    password: password.trim() || undefined,
  };
}

function resolvePlatformUrl(platform?: string): string {
  switch (platform) {
    case 'facebook':
      return 'https://www.facebook.com/';
    case 'tiktok':
      return 'https://www.tiktok.com/';
    case 'google':
      return 'https://www.google.com/';
    case 'amazon':
      return 'https://www.amazon.com/';
    default:
      return 'https://www.google.com/';
  }
}

function sanitizeAutomationCode(rawCode: string): string {
  if (!rawCode) return '';
  let cleaned = rawCode.trim();
  // Strip or extract markdown code fences if wrapped in ```js, ```javascript, ```
  const codeBlockMatch = cleaned.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n?```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  // Replace markdown links pasted accidentally into strings (e.g. '[https://url](https://url)' -> 'https://url')
  cleaned = cleaned.replace(/\[\s*([^\]]+)\s*\]\(\s*(https?:\/\/[^\)\s]+)\s*\)/g, '$2');
  cleaned = cleaned.replace(/\\vert\{\}\\vert\{\}/g, '||');
  cleaned = cleaned.replace(/\\vert\{\}/g, '|');
  cleaned = cleaned.replace(/\\vert/g, '|');
  cleaned = cleaned.replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');
  return cleaned;
}

export class AutomationEngine {
  private static activeRuns: Map<string, AutomationRunState> = new Map();
  private static eventListeners: Map<string, Set<EventCallback>> = new Map();
  private static initialized = false;

  static on(event: string, callback: EventCallback): void {
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
   * Initializes listeners to forward Camoufox events
   */
  static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    CamoufoxManager.on('automation_log', (payload: any) => {
      const { automationId, profileId, log } = payload || {};
      const key = `${automationId}:${profileId}`;
      const state = this.activeRuns.get(key) || this.activeRuns.get(automationId);
      if (state) {
        state.logs.push(log);
        state.durationMs = Date.now() - state.startedAt;
        this.emit('log', { automationId, profileId, log });
        this.emit('state', state);
      }
    });

    CamoufoxManager.on('automation_finished', (payload: any) => {
      const { automationId, profileId, success, error, stopped } = payload || {};
      const key = `${automationId}:${profileId}`;
      const state = this.activeRuns.get(key) || this.activeRuns.get(automationId);

      const durationMs = state ? Date.now() - state.startedAt : 0;

      if (state) {
        state.status = stopped ? 'stopped' : success ? 'success' : 'failed';
        state.durationMs = durationMs;
        state.error = error;
        if (success) {
          state.logs.push({
            timestamp: Date.now(),
            type: 'success',
            message: 'Automação concluída com sucesso.',
          });
        }
        this.emit('state', state);
        this.emit('finished', { automationId, profileId, success, error, durationMs, stopped });
        this.activeRuns.delete(key);
        this.activeRuns.delete(automationId);
      }

      // Update automation entity in DataStore
      try {
        const store = DataStore.read();
        const automations = (store.automations || []).map((a: any) => {
          if (a.id === automationId) {
            return {
              ...a,
              lastRunAt: Date.now(),
              lastRunStatus: stopped ? 'stopped' : success ? 'success' : 'failed',
              lastRunError: error || undefined,
              lastRunProfileId: profileId,
              lastRunDurationMs: durationMs,
            };
          }
          return a;
        });
        DataStore.write({ automations });
      } catch (err) {
        console.error('[AutomationEngine] Erro ao salvar estado da automação no DataStore:', err);
      }
    });
  }

  /**
   * Runs an automation against a given profile
   */
  static async runAutomation(
    automationId: string,
    profileId: string,
    customCode?: string
  ): Promise<{ success: boolean; error?: string; state?: AutomationRunState }> {
    this.init();

    const store = DataStore.read();
    const automation = (store.automations || []).find((a: any) => a.id === automationId);
    if (!automation) {
      return { success: false, error: 'Automação não encontrada.' };
    }

    const codeToRun = sanitizeAutomationCode(customCode || automation.code);

    const profile = (store.profiles || []).find((p: any) => p.id === profileId);
    if (!profile) {
      return { success: false, error: 'Perfil não encontrado.' };
    }

    const key = `${automationId}:${profileId}`;
    const startedAt = Date.now();

    const state: AutomationRunState = {
      automationId,
      profileId,
      profileName: profile.name || 'Perfil',
      status: 'running',
      startedAt,
      durationMs: 0,
      logs: [
        {
          timestamp: startedAt,
          type: 'info',
          message: `Iniciando automação "${automation.name}" no perfil "${profile.name}"...`,
        },
      ],
    };

    this.activeRuns.set(key, state);
    this.activeRuns.set(automationId, state);
    this.emit('state', state);

    // Update automation to running status in store
    try {
      const automations = (store.automations || []).map((a: any) => {
        if (a.id === automationId) {
          return {
            ...a,
            lastRunAt: startedAt,
            lastRunStatus: 'running',
            lastRunProfileId: profileId,
            lastRunProfileName: profile.name,
          };
        }
        return a;
      });
      DataStore.write({ automations });
    } catch {}

    const isRunning = CamoufoxManager.isProfileRunning(profileId);

    if (isRunning) {
      state.logs.push({
        timestamp: Date.now(),
        type: 'info',
        message: 'Navegador já está aberto. Enviando script Playwright...',
      });
      this.emit('state', state);

      const dispatched = CamoufoxManager.runAutomationInProfile(profileId, automationId, codeToRun);
      if (!dispatched) {
        state.status = 'failed';
        state.error = 'Falha ao enviar script para o processo do navegador.';
        state.logs.push({
          timestamp: Date.now(),
          type: 'error',
          message: state.error,
        });
        this.emit('state', state);
        return { success: false, error: state.error };
      }
      return { success: true, state };
    }

    // Profile browser is NOT running -> Launch it first
    state.status = 'launching_browser';
    state.logs.push({
      timestamp: Date.now(),
      type: 'info',
      message: 'Iniciando navegador...',
    });
    this.emit('state', state);

    const osMap: Record<string, 'windows' | 'macos' | 'linux'> = {
      mac: 'macos',
      macos: 'macos',
      windows: 'windows',
      linux: 'linux',
    };
    const osTarget = osMap[profile.os] || 'windows';
    const proxy = normalizeProxy(profile.proxy);
    const initialUrl = resolvePlatformUrl(profile.platform);

    const launchRes = await CamoufoxManager.openBrowser({
      profileId: profile.id,
      profileName: profile.name || 'Perfil',
      initialUrl,
      platform: profile.platform || 'general',
      osTarget,
      proxy,
      cookies: profile.cookies || [],
      fingerprint: profile.fingerprint,
      headless: false,
    });

    if (!launchRes.success) {
      state.status = 'failed';
      state.error = launchRes.error || 'Falha ao iniciar navegador.';
      state.logs.push({
        timestamp: Date.now(),
        type: 'error',
        message: `Erro ao iniciar navegador: ${state.error}`,
      });
      this.emit('state', state);
      return { success: false, error: state.error };
    }

    state.status = 'running';
    state.logs.push({
      timestamp: Date.now(),
      type: 'info',
      message: 'Navegador aberto e pronto. Executando código Playwright...',
    });
    this.emit('state', state);

    // Allow browser context to settle
    await new Promise((r) => setTimeout(r, 1200));

    const dispatched = CamoufoxManager.runAutomationInProfile(profileId, automationId, codeToRun);
    if (!dispatched) {
      state.status = 'failed';
      state.error = 'Falha ao despachar script para o navegador recém-aberto.';
      state.logs.push({
        timestamp: Date.now(),
        type: 'error',
        message: state.error,
      });
      this.emit('state', state);
      return { success: false, error: state.error };
    }

    return { success: true, state };
  }

  /**
   * Stops an active automation run
   */
  static stopAutomation(automationId: string): boolean {
    const state = this.activeRuns.get(automationId);
    if (!state) return false;

    state.status = 'stopped';
    state.durationMs = Date.now() - state.startedAt;
    state.error = 'Interrompido pelo usuário';
    const stopLog: AutomationRunLog = {
      timestamp: Date.now(),
      type: 'warn',
      message: 'Automação interrompida pelo usuário.',
    };
    state.logs.push(stopLog);

    this.emit('log', {
      automationId,
      profileId: state.profileId,
      log: stopLog,
    });
    this.emit('state', state);
    this.emit('finished', {
      automationId,
      profileId: state.profileId,
      success: false,
      stopped: true,
      error: 'Interrompido pelo usuário',
      durationMs: state.durationMs,
    });

    CamoufoxManager.stopAutomationInProfile(state.profileId, automationId);

    const key = `${automationId}:${state.profileId}`;
    this.activeRuns.delete(key);
    this.activeRuns.delete(automationId);

    // Update automation entity in DataStore
    try {
      const store = DataStore.read();
      const automations = (store.automations || []).map((a: any) => {
        if (a.id === automationId) {
          return {
            ...a,
            lastRunAt: Date.now(),
            lastRunStatus: 'stopped',
            lastRunError: 'Interrompido pelo usuário',
            lastRunProfileId: state.profileId,
            lastRunDurationMs: state.durationMs,
          };
        }
        return a;
      });
      DataStore.write({ automations });
    } catch (err) {
      console.error('[AutomationEngine] Erro ao salvar parada da automação no DataStore:', err);
    }

    return true;
  }

  /**
   * Retrieves active execution state
   */
  static getRunState(automationId: string): AutomationRunState | undefined {
    return this.activeRuns.get(automationId);
  }
}
