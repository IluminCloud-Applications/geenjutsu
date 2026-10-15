import { contextBridge, ipcRenderer } from 'electron';

const geenjutsuApi = {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  minimizeToTray: () => ipcRenderer.send('window:minimize-to-tray'),
  quitApp: () => ipcRenderer.send('app:quit'),
  getCloseAction: () => ipcRenderer.invoke('settings:get-close-action'),
  setCloseAction: (action: string) => ipcRenderer.invoke('settings:set-close-action', action),
  getOnboardingCompleted: () => ipcRenderer.invoke('settings:get-onboarding-completed'),
  setOnboardingCompleted: (completed: boolean) => ipcRenderer.invoke('settings:set-onboarding-completed', completed),

  // External link and App Info
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // Browser Profile Operations (Camoufox Anti-Detect Engine)
  launchProfile: (profile: any) => ipcRenderer.invoke('profiles:launch', profile),
  stopProfile: (id: string) => ipcRenderer.invoke('profiles:stop', id),
  getRunningProfiles: () => ipcRenderer.invoke('profiles:get-running'),
  injectCookies: (profileId: string, cookies: any[]) =>
    ipcRenderer.invoke('profiles:inject-cookies', { profileId, cookies }),
  getProfileHardware: (profileId: string, os?: string, fingerprint?: any) =>
    ipcRenderer.invoke('profiles:get-hardware', { profileId, os, fingerprint }),
  saveProfileHardware: (profileId: string, hardwareConfig: any) =>
    ipcRenderer.invoke('profiles:save-hardware', { profileId, hardwareConfig }),

  // Data Store persistence hooks
  getProfiles: () => ipcRenderer.invoke('profiles:get-all'),
  saveProfiles: (profiles: any[]) => ipcRenderer.invoke('profiles:save-all', profiles),
  getFolders: () => ipcRenderer.invoke('folders:get-all'),
  saveFolders: (folders: any[]) => ipcRenderer.invoke('folders:save-all', folders),
  getProxies: () => ipcRenderer.invoke('proxies:get-all'),
  saveProxies: (proxies: any[]) => ipcRenderer.invoke('proxies:save-all', proxies),
  testProxy: (proxyConfig: { type?: string; host: string; port: string | number; username?: string; password?: string }) =>
    ipcRenderer.invoke('proxies:test', proxyConfig),
  lookupIp: (ip: string) => ipcRenderer.invoke('proxies:lookup-ip', ip),
  getAutomations: () => ipcRenderer.invoke('automations:get-all'),
  saveAutomations: (automations: any[]) => ipcRenderer.invoke('automations:save-all', automations),
  runAutomation: (automationId: string, profileId: string, customCode?: string) =>
    ipcRenderer.invoke('automations:run', { automationId, profileId, customCode }),
  stopAutomation: (automationId: string) =>
    ipcRenderer.invoke('automations:stop', automationId),
  getAutomationState: (automationId: string) =>
    ipcRenderer.invoke('automations:get-state', automationId),

  // Humanized Warmup Operations
  startWarmup: (profileId: string, options?: any) =>
    ipcRenderer.invoke('warmup:start', { profileId, options }),
  stopWarmup: (profileId: string) => ipcRenderer.invoke('warmup:stop', profileId),
  getWarmupStatus: (profileId: string) => ipcRenderer.invoke('warmup:get-status', profileId),
  getRunningWarmups: () => ipcRenderer.invoke('warmup:get-running'),
  saveWarmupConfig: (profileId: string, config: any) =>
    ipcRenderer.invoke('warmup:save-config', { profileId, config }),

  // Event Listeners from Main Process
  onProfileStatusChange: (callback: (data: { profileId: string; status: 'idle' | 'running' | 'launching' }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('profile:status-changed', handler);
    return () => {
      ipcRenderer.removeListener('profile:status-changed', handler);
    };
  },

  onCookiesUpdated: (callback: (data: { profileId: string; cookies: any[] }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('profile:cookies-updated', handler);
    return () => {
      ipcRenderer.removeListener('profile:cookies-updated', handler);
    };
  },

  onWarmupProgress: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('profile:warmup-progress', handler);
    return () => {
      ipcRenderer.removeListener('profile:warmup-progress', handler);
    };
  },

  onWarmupFinished: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('profile:warmup-finished', handler);
    return () => {
      ipcRenderer.removeListener('profile:warmup-finished', handler);
    };
  },

  onAutomationStateChange: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('automation:state-changed', handler);
    return () => {
      ipcRenderer.removeListener('automation:state-changed', handler);
    };
  },

  onAutomationLog: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('automation:log', handler);
    return () => {
      ipcRenderer.removeListener('automation:log', handler);
    };
  },

  onAutomationFinished: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('automation:finished', handler);
    return () => {
      ipcRenderer.removeListener('automation:finished', handler);
    };
  },

  onRequestClose: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('app:request-close', handler);
    return () => {
      ipcRenderer.removeListener('app:request-close', handler);
    };
  },
};


contextBridge.exposeInMainWorld('geenjutsuApi', geenjutsuApi);

export type GeenjutsuApi = typeof geenjutsuApi;
