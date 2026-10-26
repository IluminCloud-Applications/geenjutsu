import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import { CamoufoxStatus, CamoufoxInstallProgress } from '../../types/dependency';

export class CamoufoxInstallerService {
  private static activeInstallPromise: Promise<{ success: boolean; error?: string }> | null = null;
  private static activeProgressListeners: Set<(p: CamoufoxInstallProgress) => void> = new Set();
  private static abortController: AbortController | null = null;

  /**
   * Resolves the default cache directory where Camoufox is expected by camoufox-js
   */
  static getInstallDir(): string {
    if (process.env.CAMOUFOX_INSTALL_DIR) {
      return path.resolve(process.env.CAMOUFOX_INSTALL_DIR);
    }
    const home = os.homedir();
    if (process.platform === 'win32') {
      return path.join(home, 'AppData', 'Local', 'camoufox', 'camoufox', 'Cache');
    }
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Caches', 'camoufox');
    }
    const xdg = process.env.XDG_CACHE_HOME;
    return path.join(xdg && path.isAbsolute(xdg) ? xdg : path.join(home, '.cache'), 'camoufox');
  }

  /**
   * Resolves the primary binary path for the current operating system
   */
  static getBinaryPath(): string {
    const base = this.getInstallDir();
    if (process.platform === 'darwin') {
      return path.resolve(base, 'Camoufox.app', 'Contents', 'MacOS', 'camoufox');
    }
    if (process.platform === 'win32') {
      return path.join(base, 'camoufox.exe');
    }
    return path.join(base, 'camoufox-bin');
  }

  /**
   * Checks whether the Camoufox browser binary and required resources are installed
   */
  static async checkStatus(): Promise<CamoufoxStatus> {
    const installDir = this.getInstallDir();
    const binPath = this.getBinaryPath();

    const binExists = fs.existsSync(binPath);
    const versionPath = path.join(installDir, 'version.json');
    const versionExists = fs.existsSync(versionPath);

    let binValid = false;
    if (binExists) {
      try {
        const stats = fs.statSync(binPath);
        binValid = stats.size > 1024 * 50;
        if (binValid && process.platform !== 'win32') {
          try {
            fs.accessSync(binPath, fs.constants.X_OK);
          } catch {
            fs.chmodSync(binPath, 0o755);
          }
        }
      } catch {
        binValid = false;
      }
    }

    let version = '';
    let release = '';
    let isSupportedVersion = true;
    if (versionExists) {
      try {
        const raw = fs.readFileSync(versionPath, 'utf-8');
        const parsed = JSON.parse(raw);
        version = parsed.version || '';
        release = parsed.release || '';
        // camoufox-js requer versão com release >= beta.30 e < beta.32
        if (release && (release === 'beta.40' || release > 'beta.32' || release < 'beta.30')) {
          console.warn(`[CamoufoxInstaller] Versão detectada (${version}-${release}) incompatível com camoufox-js. Forçando atualização para versão estável...`);
          isSupportedVersion = false;
        }
      } catch {
        isSupportedVersion = false;
      }
    }

    const mmdbPath = path.join(installDir, 'GeoLite2-City.mmdb');
    const missingGeoIP = !fs.existsSync(mmdbPath);

    const installed = binExists && binValid && versionExists && isSupportedVersion;
    const isOk = installed;

    return {
      installed,
      isOk,
      version: version ? `v${version}${release ? ` (${release})` : ''}` : undefined,
      release,
      path: binPath,
      installDir,
      missingGeoIP,
    };
  }

  /**
   * Emits install progress to all active listeners
   */
  private static notifyProgress(progress: CamoufoxInstallProgress) {
    for (const listener of this.activeProgressListeners) {
      try {
        listener(progress);
      } catch (err) {
        console.warn('[CamoufoxInstaller] Erro ao notificar listener:', err);
      }
    }
  }

  /**
   * Cancels any active installation
   */
  static cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Resolves the target release asset for the current OS and CPU architecture.
   * Fixado na versão estável 152.0.4-beta.31 (suportada com 100% de estabilidade pelo camoufox-js 0.12.1).
   */
  private static async resolveReleaseAsset(_signal?: AbortSignal): Promise<{
    url: string;
    version: string;
    release: string;
  }> {
    const platform = process.platform;
    const arch = os.arch().toLowerCase();

    // Mapeamento de tags oficiais do Camoufox
    const osTag = platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'lin';
    const archTag = arch === 'arm64' || arch === 'arm' ? 'arm64' : 'x86_64';

    const version = '152.0.4';
    const release = 'beta.31';
    const directUrl = `https://github.com/daijro/camoufox/releases/download/font-bundle-v1/camoufox-${version}-${release}-${osTag}.${archTag}.zip`;

    console.log(`[CamoufoxInstaller] Utilizando versão estável fixada: ${version} (${release}) para ${osTag}.${archTag}`);

    return {
      url: directUrl,
      version,
      release,
    };
  }

  /**
   * Downloads a remote file to disk with streaming progress tracking
   */
  private static async downloadFile(
    url: string,
    destPath: string,
    signal: AbortSignal,
    options: {
      stage: 'downloading_browser' | 'downloading_geoip' | 'downloading_addons';
      startPercent: number;
      endPercent: number;
      descPrefix: string;
    }
  ): Promise<void> {
    const res = await fetch(url, {
      signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Geenjutsu-Browser-Studio/1.0',
      },
    });

    if (!res.ok || !res.body) {
      throw new Error(`Falha no download (${res.status}): ${res.statusText}`);
    }

    const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;
    let lastReportTime = Date.now();
    let bytesSinceLastReport = 0;
    let speedStr = '';

    const fileStream = fs.createWriteStream(destPath);
    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fileStream.write(Buffer.from(value));
      downloadedBytes += value.length;
      bytesSinceLastReport += value.length;

      const now = Date.now();
      const elapsed = now - lastReportTime;
      if (elapsed >= 300) {
        const bytesPerSec = (bytesSinceLastReport / elapsed) * 1000;
        const mbPerSec = bytesPerSec / (1024 * 1024);
        speedStr = `${mbPerSec.toFixed(1)} MB/s`;

        const fraction = totalBytes > 0 ? downloadedBytes / totalBytes : 0.5;
        const currentPercent = Math.min(
          options.endPercent,
          Math.round(options.startPercent + fraction * (options.endPercent - options.startPercent))
        );

        const downloadedMb = (downloadedBytes / (1024 * 1024)).toFixed(1);
        const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '?';

        this.notifyProgress({
          stage: options.stage,
          percent: currentPercent,
          downloadedBytes,
          totalBytes,
          speed: speedStr,
          message: `${options.descPrefix} (${downloadedMb} MB / ${totalMb} MB - ${speedStr})`,
        });

        lastReportTime = now;
        bytesSinceLastReport = 0;
      }
    }

    await new Promise((resolve, reject) => {
      fileStream.end((err: any) => (err ? reject(err) : resolve(null)));
    });
  }

  /**
   * Downloads and installs the Camoufox browser binary, GeoIP database, and default addons
   */
  static async install(
    onProgress?: (progress: CamoufoxInstallProgress) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (onProgress) {
      this.activeProgressListeners.add(onProgress);
    }

    if (this.activeInstallPromise) {
      return this.activeInstallPromise;
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.activeInstallPromise = (async () => {
      const installDir = this.getInstallDir();
      const parentDir = path.dirname(installDir);
      fs.mkdirSync(parentDir, { recursive: true });

      let tempDir = '';
      let stagingDir = '';

      try {
        // Step 1: Check release
        this.notifyProgress({
          stage: 'checking',
          percent: 5,
          message: 'Buscando versão do Camoufox compatível com seu sistema...',
        });

        const { url: downloadUrl, version, release } = await this.resolveReleaseAsset(signal);

        console.log(`[CamoufoxInstaller] Versão selecionada: ${version} (${release})`);
        console.log(`[CamoufoxInstaller] Baixando de: ${downloadUrl}`);

        if (signal.aborted) throw new Error('Instalação cancelada pelo usuário.');

        // Step 2: Download browser zip
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geenjutsu-camoufox-'));
        const tempZipPath = path.join(tempDir, 'camoufox.zip');

        this.notifyProgress({
          stage: 'downloading_browser',
          percent: 10,
          message: 'Iniciando download do navegador Camoufox...',
        });

        await this.downloadFile(downloadUrl, tempZipPath, signal, {
          stage: 'downloading_browser',
          startPercent: 10,
          endPercent: 75,
          descPrefix: 'Baixando navegador Camoufox...',
        });

        if (signal.aborted) throw new Error('Instalação cancelada pelo usuário.');

        // Step 3: Extract zip
        this.notifyProgress({
          stage: 'extracting_browser',
          percent: 78,
          message: 'Extraindo arquivos do navegador...',
        });

        stagingDir = fs.mkdtempSync(path.join(parentDir, 'camoufox.staging-'));
        const zip = new AdmZip(tempZipPath);
        zip.extractAllTo(stagingDir, true);

        // Write version metadata
        fs.writeFileSync(
          path.join(stagingDir, 'version.json'),
          JSON.stringify({ version, release }),
          'utf-8'
        );

        if (signal.aborted) throw new Error('Instalação cancelada pelo usuário.');

        // Step 4: System Permissions (macOS Quarantine & Unix chmod)
        this.notifyProgress({
          stage: 'permissions',
          percent: 85,
          message: 'Configurando permissões do sistema operacional...',
        });

        if (process.platform === 'darwin') {
          try {
            execSync(`chmod -R 755 "${stagingDir}"`, { stdio: 'ignore' });
          } catch {}
          try {
            execSync(`xattr -dr com.apple.quarantine "${stagingDir}"`, { stdio: 'ignore' });
          } catch {}
        } else if (process.platform === 'linux') {
          try {
            execSync(`chmod -R 755 "${stagingDir}"`, { stdio: 'ignore' });
          } catch {}
        }

        // Atomic swap into place
        if (fs.existsSync(installDir)) {
          fs.rmSync(installDir, { recursive: true, force: true });
        }
        fs.renameSync(stagingDir, installDir);

        // If on macOS, re-apply quarantine removal directly on installed app path
        if (process.platform === 'darwin') {
          try {
            execSync(`xattr -dr com.apple.quarantine "${installDir}"`, { stdio: 'ignore' });
            execSync(`chmod -R 755 "${installDir}"`, { stdio: 'ignore' });
          } catch {}
        }

        // Step 5: Download GeoIP database (GeoLite2-City.mmdb)
        const mmdbTarget = path.join(installDir, 'GeoLite2-City.mmdb');
        if (!fs.existsSync(mmdbTarget)) {
          this.notifyProgress({
            stage: 'downloading_geoip',
            percent: 88,
            message: 'Baixando base GeoIP (resolução de proxies)...',
          });

          try {
            const geoIpUrl = 'https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb';
            const tempMmdb = path.join(tempDir, 'GeoLite2-City.mmdb');
            await this.downloadFile(geoIpUrl, tempMmdb, signal, {
              stage: 'downloading_geoip',
              startPercent: 88,
              endPercent: 95,
              descPrefix: 'Baixando base de dados GeoIP...',
            });
            fs.copyFileSync(tempMmdb, mmdbTarget);
          } catch (geoErr) {
            console.warn('[CamoufoxInstaller] Aviso ao baixar GeoIP (não-bloqueante):', geoErr);
          }
        }

        // Step 6: Download Default Addons (uBlock Origin)
        const uboDir = path.join(installDir, 'addons', 'UBO');
        if (!fs.existsSync(uboDir)) {
          this.notifyProgress({
            stage: 'downloading_addons',
            percent: 96,
            message: 'Instalando extensões anti-detect padrão...',
          });

          try {
            fs.mkdirSync(uboDir, { recursive: true });
            const uboXpiUrl = 'https://addons.mozilla.org/firefox/downloads/latest/ublock-origin/latest.xpi';
            const tempXpi = path.join(tempDir, 'ubo.xpi');
            await this.downloadFile(uboXpiUrl, tempXpi, signal, {
              stage: 'downloading_addons',
              startPercent: 96,
              endPercent: 99,
              descPrefix: 'Baixando extensão uBlock Origin...',
            });
            const uboZip = new AdmZip(tempXpi);
            uboZip.extractAllTo(uboDir, true);
          } catch (addErr) {
            console.warn('[CamoufoxInstaller] Aviso ao baixar extensões padrão (não-bloqueante):', addErr);
          }
        }

        // Step 7: Completed
        this.notifyProgress({
          stage: 'completed',
          percent: 100,
          message: 'Navegador Camoufox instalado e pronto para uso!',
        });

        console.log('[CamoufoxInstaller] Instalação do Camoufox concluída com sucesso!');
        return { success: true };
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        console.error('[CamoufoxInstaller] Erro durante instalação:', errorMsg);

        this.notifyProgress({
          stage: 'error',
          percent: 0,
          message: `Falha na instalação: ${errorMsg}`,
          error: errorMsg,
        });

        return { success: false, error: errorMsg };
      } finally {
        // Cleanup staging & temp files
        try {
          if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch {}
        try {
          if (stagingDir && fs.existsSync(stagingDir)) {
            fs.rmSync(stagingDir, { recursive: true, force: true });
          }
        } catch {}

        this.activeInstallPromise = null;
        this.abortController = null;
        this.activeProgressListeners.clear();
      }
    })();

    return this.activeInstallPromise;
  }
}
