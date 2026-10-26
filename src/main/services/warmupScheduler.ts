import { DataStore } from './dataStore';
import { WarmupEngine } from './warmupEngine';
import { CamoufoxManager } from './camoufoxManager';

export class WarmupScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static isListeningToStatus: boolean = false;

  /**
   * Starts background check loop
   */
  static start(): void {
    if (this.timer) return;

    // Attach listener to profile status changes so that when a profile closes,
    // we can evaluate if it had an overdue warmup waiting
    if (!this.isListeningToStatus) {
      this.isListeningToStatus = true;
      CamoufoxManager.on('status_changed', (data: { profileId: string; status: string }) => {
        if (data && data.status === 'idle') {
          // Give 25 seconds for locks to fully release and simulate a brief natural gap after closing
          setTimeout(() => {
            this.checkProfileDueAfterClose(data.profileId).catch((err) => {
              console.error('[WarmupScheduler] Erro ao verificar perfil pós-fechamento:', err);
            });
          }, 25000);
        }
      });
    }

    // Check every 60 seconds
    this.timer = setInterval(() => {
      this.checkDueWarmups().catch((err) => {
        console.error('[WarmupScheduler] Erro ao verificar rotina de aquecimento:', err);
      });
    }, 60000);

    console.log('[WarmupScheduler] Monitor de aquecimento inteligente em modo fila (1 perfil por vez) iniciado.');
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Specifically triggers warmup for a profile that was waiting for the browser to close
   */
  private static async checkProfileDueAfterClose(profileId: string): Promise<void> {
    const data = DataStore.read();
    const profile = (data.profiles || []).find((p) => p.id === profileId);
    if (!profile || !profile.warmupConfig?.enabled) return;

    // Must still be idle (user didn't re-open it)
    if (CamoufoxManager.isProfileRunning(profileId)) return;

    // Warmup must not already be running or queued for this profile
    if (WarmupEngine.isWarmupRunning(profileId) || WarmupEngine.isQueued(profileId)) return;

    const now = Date.now();
    if (!profile.nextWarmupAt || now >= profile.nextWarmupAt) {
      console.log(`[WarmupScheduler] Navegador do perfil "${profile.name}" foi fechado. Adicionando aquecimento pendente à fila...`);
      await this.runWarmupForProfile(profile);
    }
  }

  /**
   * Evaluates all profiles with warmupConfig enabled and queues due profiles
   */
  private static async checkDueWarmups(): Promise<void> {
    const data = DataStore.read();
    const profiles = data.profiles || [];
    const now = Date.now();
    let hasDataChanges = false;

    for (const profile of profiles) {
      const config = profile.warmupConfig;
      if (!config || !config.enabled) continue;

      // 1. If warmup is already running or queued for this profile, skip
      if (WarmupEngine.isWarmupRunning(profile.id) || WarmupEngine.isQueued(profile.id)) {
        continue;
      }

      // 2. CRITICAL RULE: If browser is currently open/running by the user, DO NOT run warmup!
      // Wait until the user finishes their work and closes the browser.
      if (CamoufoxManager.isProfileRunning(profile.id)) {
        continue;
      }

      // 3. Initialize nextWarmupAt if missing (randomized 21h to 27h window)
      if (!profile.nextWarmupAt) {
        if (profile.lastWarmupAt) {
          profile.nextWarmupAt = WarmupEngine.calculateNextWarmupTimestamp(profile.lastWarmupAt);
        } else {
          // Fresh profile or newly enabled warmup: schedule after a gentle initial jitter (3 to 10 minutes)
          profile.nextWarmupAt = now + Math.floor((3 + Math.random() * 7) * 60 * 1000);
        }
        hasDataChanges = true;
      }

      // 4. Check if due time has been reached
      if (now >= profile.nextWarmupAt) {
        console.log(`[WarmupScheduler] Perfil "${profile.name}" (${profile.id}) atingiu horário de aquecimento. Encaminhando para modo fila...`);
        await this.runWarmupForProfile(profile);
      }
    }

    if (hasDataChanges) {
      DataStore.write({ profiles });
    }
  }

  /**
   * Helper to execute warmup with humanized parameters
   */
  private static async runWarmupForProfile(profile: any): Promise<void> {
    const config = profile.warmupConfig || {};
    const siteMin = config.siteCountMin || 14;
    const siteMax = config.siteCountMax || 24;
    const chosenSiteCount = Math.floor(Math.random() * (siteMax - siteMin + 1)) + siteMin;

    await WarmupEngine.startWarmup(
      profile.id,
      {
        siteCountMin: Math.max(5, chosenSiteCount - 3),
        siteCountMax: chosenSiteCount,
        timePerSiteMin: config.timePerSiteMin || 30,
        timePerSiteMax: config.timePerSiteMax || 80,
      },
      'auto'
    );
  }
}
