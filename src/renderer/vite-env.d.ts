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
    launchProfile: (profile: any) => Promise<{ success: boolean; error?: string }>;
    stopProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
    getRunningProfiles: () => Promise<string[]>;
    injectCookies: (profileId: string, cookies: any[]) => Promise<{ success: boolean; count: number; error?: string }>;
    getProfileHardware: (profileId: string, os?: string, fingerprint?: any) => Promise<any>;
    saveProfileHardware: (profileId: string, hardwareConfig: any) => Promise<boolean>;
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
    onProfileStatusChange: (callback: (data: { profileId: string; status: 'idle' | 'running' | 'launching' }) => void) => () => void;
    onCookiesUpdated: (callback: (data: { profileId: string; cookies: any[] }) => void) => () => void;
    onWarmupProgress: (callback: (data: any) => void) => () => void;
    onWarmupFinished: (callback: (data: any) => void) => () => void;
    onAutomationStateChange: (callback: (data: any) => void) => () => void;
    onAutomationLog: (callback: (data: any) => void) => () => void;
    onAutomationFinished: (callback: (data: any) => void) => () => void;
  };
}
