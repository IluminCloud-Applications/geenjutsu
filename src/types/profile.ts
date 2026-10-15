export interface ProxyConfig {
  type: 'direct' | 'http' | 'socks5';
  name?: string;
  proxyId?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  ipDisplay?: string;
  countryCode?: string;
  country?: string;
}

export interface FingerprintConfig {
  userAgent: string;
  canvas: 'noise' | 'off' | 'block';
  webgl: 'noise' | 'off';
  audio: 'noise' | 'off';
  webRTC: 'altered' | 'real' | 'disabled';
  resolution: string;
  timezone: string;
  language: string;
}

export interface CookieItem {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
  [key: string]: any;
}

export interface WarmupConfig {
  enabled: boolean;
  scheduleMode: 'daily' | 'interval';
  siteCountMin: number;
  siteCountMax: number;
  timePerSiteMin: number;
  timePerSiteMax: number;
  headless?: boolean;
}

export interface WarmupProgress {
  profileId: string;
  isRunning: boolean;
  currentSite?: string;
  currentIndex?: number;
  totalSites?: number;
  remainingSeconds?: number;
  progressPercent?: number;
}

export interface Profile {
  id: string;
  name: string;
  folderId: string;
  platform: 'facebook' | 'chrome' | 'tiktok' | 'google' | 'amazon' | 'general';
  os: 'mac' | 'windows' | 'linux';
  browser: string;
  notes: string;
  proxy?: ProxyConfig;
  tags: string[];
  status: 'idle' | 'running' | 'launching';
  actionLabel?: 'Start' | 'Launch';
  isTrash?: boolean;
  isPinned?: boolean;
  pinnedAt?: number;
  createdAt: number;
  updatedAt: number;
  lastLaunchedAt?: number;
  fingerprint?: FingerprintConfig;
  hardwareConfig?: any;
  cookies?: CookieItem[];
  warmupConfig?: WarmupConfig;
  lastWarmupAt?: number;
  nextWarmupAt?: number;
  totalWarmupSites?: number;
}

export type ProfileCreateInput = Omit<Profile, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isTrash' | 'isPinned' | 'pinnedAt'>;
export type ProfileUpdateInput = Partial<Profile> & { id: string };

export interface PrivacyConfig {
  blurName: boolean;
  blurProxy: boolean;
  blurNotes: boolean;
}

