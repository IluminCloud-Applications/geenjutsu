/// <reference types="vite/client" />

interface Window {
  geenjutsuApi?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    minimizeToTray: () => void;
    quitApp: () => void;
    getCloseAction: () => Promise<string>;
    setCloseAction: (action: string) => Promise<boolean>;
    getOnboardingCompleted?: () => Promise<boolean>;
    setOnboardingCompleted?: (completed: boolean) => Promise<boolean>;
    onRequestClose: (callback: () => void) => () => void;
    openExternal: (url: string) => Promise<boolean>;
    getAppVersion?: () => Promise<string>;
    launchProfile: (profile: any, options?: { economyMode?: boolean }) => Promise<{ success: boolean; error?: string }>;
    stopProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
    getRunningProfiles: () => Promise<string[]>;
    injectCookies: (profileId: string, cookies: any[]) => Promise<{ success: boolean; count: number; error?: string }>;
    getProfileHardware: (profileId: string, os?: string, fingerprint?: any) => Promise<any>;
    saveProfileHardware: (profileId: string, hardwareConfig: any) => Promise<boolean>;
    getInitialDataSync?: () => {
      profiles: any[];
      folders: any[];
      proxies: any[];
      automations?: any[];
      security?: any;
      settings?: {
        closeAction?: 'ask' | 'quit' | 'background';
        onboardingCompleted?: boolean;
      };
      updatedAt?: number;
    };
    getProfiles: () => Promise<any[]>;
    saveProfiles: (profiles: any[]) => Promise<boolean>;
    getFolders: () => Promise<any[]>;
    saveFolders: (folders: any[]) => Promise<boolean>;
    getProxies: () => Promise<any[]>;
    saveProxies: (proxies: any[]) => Promise<boolean>;
    testProxy?: (proxyConfig: { type?: string; host?: string; port?: string | number; username?: string; password?: string }) => Promise<import('../types').ProxyCheckResult>;
    lookupIp?: (ip: string) => Promise<{ country: string; countryCode: string; city?: string } | null>;
    getAutomations: () => Promise<any[]>;
    saveAutomations: (automations: any[]) => Promise<boolean>;
    runAutomation: (automationId: string, profileId: string, customCode?: string) => Promise<{ success: boolean; error?: string; state?: any }>;
    stopAutomation: (automationId: string) => Promise<boolean>;
    getAutomationState: (automationId: string) => Promise<any>;
    startWarmup: (profileId: string, options?: any) => Promise<{ success: boolean; error?: string }>;
    stopWarmup: (profileId: string) => Promise<boolean>;
    getWarmupStatus: (profileId: string) => Promise<any>;
    saveWarmupConfig: (profileId: string, config: any) => Promise<boolean>;
    getRunningWarmups?: () => Promise<string[]>;

    // Tables API
    getTables?: () => Promise<import('../types').TableSummary[]>;
    getTableById?: (id: string) => Promise<import('../types').CustomTable | null>;
    createTable?: (input: import('../types').CreateTableInput) => Promise<import('../types').CustomTable>;
    updateTable?: (id: string, updates: Partial<import('../types').CustomTable>) => Promise<boolean>;
    deleteTable?: (id: string) => Promise<boolean>;
    duplicateTable?: (tableId: string, includeData: boolean, newName?: string) => Promise<import('../types').CustomTable>;
    addColumn?: (tableId: string, name: string, type: import('../types').TableColumnType, options?: string[]) => Promise<import('../types').TableColumn>;
    updateColumn?: (columnId: string, updates: import('../types').UpdateColumnInput) => Promise<boolean>;
    deleteColumn?: (columnId: string, tableId: string) => Promise<boolean>;
    addRow?: (tableId: string, data?: Record<string, any>) => Promise<import('../types').TableRow>;
    updateRow?: (rowId: string, data: Record<string, any>) => Promise<boolean>;
    deleteRow?: (rowId: string) => Promise<boolean>;
    reorderRows?: (tableId: string, rowIds: string[]) => Promise<boolean>;
    getTableTemplates?: () => Promise<import('../types').TableTemplate[]>;

    onProfileStatusChange: (callback: (data: { profileId: string; status: 'idle' | 'running' | 'launching'; economyMode?: boolean }) => void) => () => void;
    onCookiesUpdated: (callback: (data: { profileId: string; cookies: any[] }) => void) => () => void;
    onWarmupProgress: (callback: (data: any) => void) => () => void;
    onWarmupFinished: (callback: (data: any) => void) => () => void;
    onAutomationStateChange: (callback: (data: any) => void) => () => void;
    onAutomationLog: (callback: (data: any) => void) => () => void;
    onAutomationFinished: (callback: (data: any) => void) => () => void;
    checkAndroidDependencies?: () => Promise<import('../types').SystemDiagnosticResult>;
    installAndroidDependency?: (id: string) => Promise<{ success: boolean; log: string }>;
    openAndroidScreen?: (profileId: string) => Promise<{ success: boolean; error?: string }>;
    openAppInStore?: (profileId: string, packageName?: string) => Promise<{ success: boolean; error?: string }>;
    installAndroidPackage?: (profileId: string) => Promise<{ success: boolean; error?: string; message?: string; canceled?: boolean }>;
    downloadAndInstallAndroidApp?: (data: { profileId: string; downloadUrl: string; appName: string }) => Promise<{ success: boolean; error?: string; message?: string }>;
    onAndroidInstallProgress?: (callback: (data: {
      profileId: string;
      appName: string;
      stage: 'downloading' | 'installing' | 'completed' | 'error';
      progress?: number;
      received?: number;
      total?: number;
      error?: string;
      message?: string;
    }) => void) => () => void;
    onAndroidInstallLog?: (callback: (data: string) => void) => () => void;
  };
}
