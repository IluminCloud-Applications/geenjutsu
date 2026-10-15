export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  notes?: string[];
  downloadUrls?: {
    win?: string;
    mac?: string;
    linux?: string;
    page?: string;
  };
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateInfo?: UpdateInfo;
  downloadUrl: string;
}

const GITHUB_API_URL = 'https://api.github.com/repos/IluminCloud-Applications/geenjutsu/releases/latest';
const GITHUB_RELEASES_PAGE = 'https://github.com/IluminCloud-Applications/geenjutsu/releases/latest';
const RAW_VERSION_URL = 'https://raw.githubusercontent.com/IluminCloud-Applications/geenjutsu/main/public/version.json';

export class UpdateService {
  private static cachedResult: UpdateCheckResult | null = null;

  static async getLocalVersion(): Promise<string> {
    try {
      if (window.geenjutsuApi?.getAppVersion) {
        return await window.geenjutsuApi.getAppVersion();
      }
    } catch {
      // fallback
    }
    return '1.0.0';
  }

  static getPlatform(): 'win' | 'mac' | 'linux' {
    if (typeof navigator === 'undefined') return 'win';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac') || ua.includes('darwin')) return 'mac';
    if (ua.includes('linux')) return 'linux';
    return 'win';
  }

  static compareSemver(v1: string, v2: string): number {
    const parse = (s: string) =>
      s
        .replace(/^v/i, '')
        .split('.')
        .map(x => parseInt(x, 10) || 0);

    const p1 = parse(v1);
    const p2 = parse(v2);

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  private static parseGitHubRelease(data: any): UpdateInfo {
    const version = (data.tag_name || '').replace(/^v/i, '').trim();
    const tag = `v${version}`;
    const page = data.html_url || GITHUB_RELEASES_PAGE;

    const downloadUrls: Record<string, string> = {
      win: `https://github.com/IluminCloud-Applications/geenjutsu/releases/download/${tag}/Geenjutsu-Setup-${version}-x64.exe`,
      mac: `https://github.com/IluminCloud-Applications/geenjutsu/releases/download/${tag}/Geenjutsu-${version}-arm64.dmg`,
      linux: `https://github.com/IluminCloud-Applications/geenjutsu/releases/download/${tag}/geenjutsu_${version}_amd64.deb`,
      page,
    };

    if (Array.isArray(data.assets)) {
      for (const asset of data.assets) {
        const name = (asset.name || '').toLowerCase();
        const dl = asset.browser_download_url;
        if (!dl) continue;
        if (name.endsWith('.exe')) downloadUrls.win = dl;
        else if (name.endsWith('.dmg')) downloadUrls.mac = dl;
        else if (name.endsWith('.deb')) downloadUrls.linux = dl;
      }
    }

    const notes: string[] = [];
    if (data.body && typeof data.body === 'string') {
      const lines = data.body
        .split('\n')
        .map((l: string) => l.replace(/^[-*#]+\s*/, '').trim())
        .filter((l: string) => l.length > 0 && !l.toLowerCase().includes('full changelog') && !l.startsWith('http'));
      if (lines.length > 0) {
        notes.push(...lines);
      }
    }

    return {
      version,
      releaseDate: data.published_at ? data.published_at.split('T')[0] : undefined,
      notes: notes.length > 0 ? notes : undefined,
      downloadUrls,
    };
  }

  static async checkForUpdates(force = false): Promise<UpdateCheckResult> {
    if (!force && this.cachedResult) {
      return this.cachedResult;
    }

    const currentVersion = await this.getLocalVersion();
    const platform = this.getPlatform();
    let updateInfo: UpdateInfo | null = null;

    // 1. Tenta API do GitHub Releases
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(GITHUB_API_URL, {
        headers: { Accept: 'application/vnd.github.v3+json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.tag_name) {
          updateInfo = this.parseGitHubRelease(data);
        }
      }
    } catch {
      // Ignora erro de rede/timeout
    }

    // 2. Fallback para version.json
    if (!updateInfo) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${RAW_VERSION_URL}?t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const rawData = await res.json();
          if (rawData?.version) {
            updateInfo = {
              version: rawData.version,
              releaseDate: rawData.releaseDate,
              notes: rawData.notes,
              downloadUrls: rawData.downloadUrls || { page: GITHUB_RELEASES_PAGE },
            };
          }
        }
      } catch {
        // Ignora erro de rede/timeout
      }
    }

    const latestVersion = updateInfo?.version || currentVersion;
    const hasUpdate = this.compareSemver(latestVersion, currentVersion) > 0;
    const downloadUrl =
      updateInfo?.downloadUrls?.[platform] ||
      updateInfo?.downloadUrls?.page ||
      GITHUB_RELEASES_PAGE;

    this.cachedResult = {
      hasUpdate,
      currentVersion,
      latestVersion,
      updateInfo: updateInfo || undefined,
      downloadUrl,
    };

    return this.cachedResult;
  }

  static openDownload(url?: string): void {
    const targetUrl = url || this.cachedResult?.downloadUrl || GITHUB_RELEASES_PAGE;
    if (window.geenjutsuApi?.openExternal) {
      window.geenjutsuApi.openExternal(targetUrl);
    } else {
      window.open(targetUrl, '_blank');
    }
  }
}
