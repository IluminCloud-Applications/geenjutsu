export type DependencyId = 'wsl' | 'docker' | 'binder' | 'redroid' | 'adb' | 'scrcpy';

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
