export type DependencyId = 'wsl' | 'docker' | 'binder' | 'redroid' | 'adb' | 'scrcpy' | 'camoufox';

export type DependencyStatus = 'ok' | 'outdated' | 'missing' | 'checking' | 'installing' | 'error';

export interface DependencyItem {
  id: DependencyId;
  name: string;
  description: string;
  status: DependencyStatus;
  version?: string;
  installedPath?: string;
  error?: string;
  log?: string;
  required: boolean;
  actionLabel?: string;
}

export interface CamoufoxStatus {
  installed: boolean;
  isOk?: boolean;
  version?: string;
  release?: string;
  path?: string;
  installDir: string;
  missingGeoIP?: boolean;
}

export type CamoufoxInstallStage =
  | 'checking'
  | 'downloading_browser'
  | 'extracting_browser'
  | 'permissions'
  | 'downloading_geoip'
  | 'downloading_addons'
  | 'completed'
  | 'error';

export interface CamoufoxInstallProgress {
  stage: CamoufoxInstallStage;
  percent: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: string;
  message: string;
  error?: string;
}

export interface SystemDiagnosticResult {
  os: 'linux' | 'win32' | 'darwin';
  platformName: string;
  kernel: string;
  allOk: boolean;
  isWindows: boolean;
  isLinux: boolean;
  wslInstalled?: boolean;
  items: Record<DependencyId, DependencyItem>;
  lastCheckedAt: number;
}
