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
  launchProfile: (profile: any, options?: any) => ipcRenderer.invoke('profiles:launch', profile, options),
  stopProfile: (id: string) => ipcRenderer.invoke('profiles:stop', id),
  getRunningProfiles: () => ipcRenderer.invoke('profiles:get-running'),
  injectCookies: (profileId: string, cookies: any[]) =>
    ipcRenderer.invoke('profiles:inject-cookies', { profileId, cookies }),
  getProfileHardware: (profileId: string, os?: string, fingerprint?: any) =>
    ipcRenderer.invoke('profiles:get-hardware', { profileId, os, fingerprint }),
  saveProfileHardware: (profileId: string, hardwareConfig: any) =>
    ipcRenderer.invoke('profiles:save-hardware', { profileId, hardwareConfig }),

  // Data Store persistence hooks
  getInitialDataSync: () => ipcRenderer.sendSync('store:get-initial-data-sync'),
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
  getWarmupQueue: () => ipcRenderer.invoke('warmup:get-queue'),
  saveWarmupConfig: (profileId: string, config: any) =>
    ipcRenderer.invoke('warmup:save-config', { profileId, config }),

  // Custom Tables Operations (SQLite Engine)
  getTables: () => ipcRenderer.invoke('tables:get-all'),
  getTableById: (id: string) => ipcRenderer.invoke('tables:get-by-id', id),
  createTable: (input: any) => ipcRenderer.invoke('tables:create', input),
  updateTable: (id: string, updates: any) => ipcRenderer.invoke('tables:update', { id, updates }),
  deleteTable: (id: string) => ipcRenderer.invoke('tables:delete', id),
  duplicateTable: (tableId: string, includeData: boolean, newName?: string) =>
    ipcRenderer.invoke('tables:duplicate', { tableId, includeData, newName }),
  addColumn: (tableId: string, name: string, type: string, options?: string[]) =>
    ipcRenderer.invoke('tables:add-column', { tableId, name, type, options }),
  updateColumn: (columnId: string, updates: any) =>
    ipcRenderer.invoke('tables:update-column', { columnId, updates }),
  deleteColumn: (columnId: string, tableId: string) =>
    ipcRenderer.invoke('tables:delete-column', { columnId, tableId }),
  reorderColumns: (tableId: string, columnIds: string[]) =>
    ipcRenderer.invoke('tables:reorder-columns', { tableId, columnIds }),
  addRow: (tableId: string, data?: Record<string, any>) =>
    ipcRenderer.invoke('tables:add-row', { tableId, data }),
  updateRow: (rowId: string, data: Record<string, any>) =>
    ipcRenderer.invoke('tables:update-row', { rowId, data }),
  deleteRow: (rowId: string) => ipcRenderer.invoke('tables:delete-row', rowId),
  reorderRows: (tableId: string, rowIds: string[]) =>
    ipcRenderer.invoke('tables:reorder-rows', { tableId, rowIds }),
  getTableTemplates: () => ipcRenderer.invoke('tables:get-templates'),

  // Integrations & Proxy Seller API (SQLite Engine)
  getIntegrations: () => ipcRenderer.invoke('integrations:get-all'),
  getIntegration: (serviceId: string) => ipcRenderer.invoke('integrations:get-by-id', serviceId),
  saveIntegration: (payload: { serviceId: string; apiKey: string; status?: string; cachedBalance?: number; cachedData?: any; settings?: any }) =>
    ipcRenderer.invoke('integrations:save', payload),
  deleteIntegration: (serviceId: string) => ipcRenderer.invoke('integrations:delete', serviceId),

  // Proxy Seller Actions
  testProxySellerConnection: (apiKey: string) => ipcRenderer.invoke('proxy-seller:test-connection', apiKey),
  getProxySellerBalance: (apiKey?: string) => ipcRenderer.invoke('proxy-seller:get-balance', apiKey),
  getProxySellerResidentialInfo: (apiKey?: string) => ipcRenderer.invoke('proxy-seller:get-residential-info', apiKey),
  updateProxySellerRotation: (listId: number, rotationSeconds: number, apiKey?: string) =>
    ipcRenderer.invoke('proxy-seller:update-rotation', { listId, rotationSeconds, apiKey }),
  getProxySellerIspProxies: (apiKey?: string) => ipcRenderer.invoke('proxy-seller:get-isp-proxies', apiKey),
  buyProxySellerProxy: (params: any, apiKey?: string) => ipcRenderer.invoke('proxy-seller:buy-proxy', { params, apiKey }),
  getProxySellerReferenceList: (type?: string, apiKey?: string) => ipcRenderer.invoke('proxy-seller:get-reference-list', { type, apiKey }),
  calculateProxySellerOrder: (params: any, apiKey?: string) => ipcRenderer.invoke('proxy-seller:calculate-order', { params, apiKey }),
  checkProxySellerCard: (apiKey?: string) => ipcRenderer.invoke('proxy-seller:check-card', apiKey),

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

  onWarmupQueueChanged: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('profile:warmup-queue-changed', handler);
    return () => {
      ipcRenderer.removeListener('profile:warmup-queue-changed', handler);
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

  // Camoufox Engine Operations & Auto-Installer
  checkCamoufoxStatus: () => ipcRenderer.invoke('camoufox:check-status'),
  installCamoufox: () => ipcRenderer.invoke('camoufox:install'),
  cancelCamoufoxInstall: () => ipcRenderer.invoke('camoufox:cancel-install'),
  onCamoufoxInstallProgress: (callback: (data: {
    stage: 'checking' | 'downloading_browser' | 'extracting_browser' | 'permissions' | 'downloading_geoip' | 'downloading_addons' | 'completed' | 'error';
    percent: number;
    downloadedBytes?: number;
    totalBytes?: number;
    speed?: string;
    message: string;
    error?: string;
  }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('camoufox:install-progress', handler);
    return () => {
      ipcRenderer.removeListener('camoufox:install-progress', handler);
    };
  },

  // Android Mode Operations
  checkAndroidDependencies: () => ipcRenderer.invoke('android:check-dependencies'),
  installAndroidDependency: (id: string) => ipcRenderer.invoke('android:install-dependency', id),
  openAndroidScreen: (profileId: string) => ipcRenderer.invoke('android:open-screen', profileId),
  openAppInStore: (profileId: string, packageName?: string) =>
    ipcRenderer.invoke('android:open-app-store', { profileId, packageName }),
  installAndroidPackage: (profileId: string) => ipcRenderer.invoke('android:install-package', profileId),
  downloadAndInstallAndroidApp: (data: { profileId: string; downloadUrl: string; appName: string }) =>
    ipcRenderer.invoke('android:download-and-install-package', data),
  onAndroidInstallProgress: (callback: (data: {
    profileId: string;
    appName: string;
    stage: 'downloading' | 'installing' | 'completed' | 'error';
    progress?: number;
    received?: number;
    total?: number;
    error?: string;
    message?: string;
  }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('android:install-progress', handler);
    return () => {
      ipcRenderer.removeListener('android:install-progress', handler);
    };
  },
  onAndroidInstallLog: (callback: (data: string) => void) => {
    const handler = (_: any, data: string) => callback(data);
    ipcRenderer.on('android:install-log', handler);
    return () => {
      ipcRenderer.removeListener('android:install-log', handler);
    };
  },
};


contextBridge.exposeInMainWorld('geenjutsuApi', geenjutsuApi);

export type GeenjutsuApi = typeof geenjutsuApi;
