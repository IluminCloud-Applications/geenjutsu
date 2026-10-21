import { exec, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';
import { fileURLToPath } from 'url';
import { app, net as electronNet } from 'electron';
import os from 'os';
import { SocksClient } from 'socks';
import { Profile } from '../../types';
import { DataStore } from './dataStore';
import { GpuSpoofer } from './gpuSpoofer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ProxyForwarder {
  port: number;
  close: () => void;
}

interface RunningContainerInfo {
  profileId: string;
  containerId: string;
  adbPort: number;
  scrcpyProcess?: ChildProcess;
  proxyForwarder?: ProxyForwarder;
  startedAt: number;
}

class RedroidManagerEmitter extends EventEmitter {}

export class RedroidManager {
  private static emitter = new RedroidManagerEmitter();
  private static runningProfiles = new Map<string, RunningContainerInfo>();
  private static baseAdbPort = 55550;
  private static installLocks = new Map<string, Promise<any>>();

  private static async withInstallLock<T>(profileId: string, task: () => Promise<T>): Promise<T> {
    const current = this.installLocks.get(profileId) || Promise.resolve();
    let release: () => void = () => {};
    const next = new Promise<void>((r) => { release = r; });
    this.installLocks.set(profileId, current.then(() => next, () => next));
    try {
      await current;
      return await task();
    } finally {
      release();
    }
  }

  static on(event: 'status_changed', listener: (payload: { profileId: string; status: 'idle' | 'running' | 'launching' }) => void) {
    this.emitter.on(event, listener);
  }

  private static execAsync(command: string, timeoutMs = 30000): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      exec(command, {
        timeout: timeoutMs,
        env: {
          ...process.env,
          ...(process.platform === 'linux' ? { DOCKER_CONTEXT: 'default' } : {}),
        },
      }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout ? stdout.trim() : '',
          stderr: stderr ? stderr.trim() : '',
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        });
      });
    });
  }

  static isInstanceRunning(profileId: string): boolean {
    return this.runningProfiles.has(profileId);
  }

  static getRunningInstanceIds(): string[] {
    return Array.from(this.runningProfiles.keys());
  }

  static async getRunningProfileIds(): Promise<string[]> {
    const { stdout, code } = await this.execAsync(
      'docker ps --filter "name=geenjutsu-android-" --format "{{.Names}}"'
    );
    if (code !== 0 || !stdout) {
      return Array.from(this.runningProfiles.keys());
    }

    const runningInDocker = stdout
      .split('\n')
      .map(name => name.trim().replace(/^geenjutsu-android-/, ''))
      .filter(Boolean);

    return Array.from(new Set([...runningInDocker, ...this.runningProfiles.keys()]));
  }

  private static getDockerBinderFlags(): string {
    if (process.platform !== 'linux') return '';

    // Se o host possui binderfs (/dev/binderfs), o Redroid com --privileged
    // monta nativamente seu próprio binderfs dentro do container.
    // Injetar os nós via --device quebra o namespace e impede a inicialização do SurfaceFlinger/Zygote (ENXIO).
    if (fs.existsSync('/dev/binderfs')) {
      return '';
    }

    const flags: string[] = [];
    const nodes = ['binder', 'hwbinder', 'vndbinder'];

    for (const node of nodes) {
      const directPath = `/dev/${node}`;
      if (fs.existsSync(directPath)) {
        try {
          const stat = fs.lstatSync(directPath);
          if (!stat.isSymbolicLink() && stat.isCharacterDevice()) {
            flags.push(`--device ${directPath}:/dev/${node}`);
          }
        } catch {}
      }
    }

    return flags.join(' ');
  }

  static async getAvailableRedroidImage(preferredVersion?: string): Promise<string> {
    const { stdout, code } = await this.execAsync(
      'docker images --format "{{.Repository}}:{{.Tag}}" | grep "^redroid/redroid:"'
    );
    if (code === 0 && stdout) {
      const tags = stdout
        .split('\n')
        .map(l => l.trim().replace(/^redroid\/redroid:/, ''))
        .filter(Boolean);

      if (preferredVersion) {
        const major = preferredVersion.split('.')[0];
        const matched = tags.find(t => t.startsWith(`${major}.`));
        if (matched) return matched;
      }

      const stable = tags.find(t => t.includes('12.0.0')) || tags[0];
      if (stable) return stable;
    }
    return '12.0.0-latest';
  }

  static async launchProfile(profile: Profile): Promise<{ success: boolean; error?: string; adbPort?: number }> {
    const profileId = profile.id;
    try {
      this.emitter.emit('status_changed', { profileId, status: 'launching' });

      const containerName = `geenjutsu-android-${profileId}`;
      const volumeName = `geenjutsu-android-data-${profileId}`;

      // Calculate or assign port
      let adbPort = profile.adbPort;
      if (!adbPort || adbPort < 1024) {
        let hash = 0;
        for (let i = 0; i < profileId.length; i++) {
          hash = (hash * 31 + profileId.charCodeAt(i)) % 1000;
        }
        adbPort = this.baseAdbPort + Math.abs(hash);
      }

      // Inicia proxy bridge se configurado no perfil
      let proxyForwarder: ProxyForwarder | undefined;
      const proxyConfig = profile.proxy;
      const hasProxy = proxyConfig && proxyConfig.type !== 'direct' && (proxyConfig.host || proxyConfig.ipDisplay);

      if (hasProxy) {
        try {
          const host = proxyConfig.host || (proxyConfig.ipDisplay ? proxyConfig.ipDisplay.split(':')[0] : '');
          const port = proxyConfig.port || (proxyConfig.ipDisplay ? proxyConfig.ipDisplay.split(':')[1] : '1080');
          proxyForwarder = await this.createLocalProxyBridge({
            type: proxyConfig.type || 'socks5',
            host,
            port,
            username: proxyConfig.username || '',
            password: proxyConfig.password || '',
          });
          console.log(`[RedroidManager] Proxy forwarder iniciado na porta local ${proxyForwarder.port} para upstream ${host}:${port} (${proxyConfig.type})`);
        } catch (err: any) {
          console.error('[RedroidManager] Falha ao iniciar proxy bridge local:', err);
        }
      }

      // Se já existe um container para esse perfil, removemos o container para garantir que
      // todas as propriedades antidetect e parâmetros de proxy atualizados sejam aplicados no docker run.
      // Os dados, apps e contas ficam 100% preservados dentro do volume Docker named.
      const inspectCheck = await this.execAsync(`docker inspect ${containerName}`);
      if (inspectCheck.code === 0) {
        await this.execAsync(`docker rm -f ${containerName}`);
      }

      const width = profile.width || profile.device?.width || 1080;
      const height = profile.height || profile.device?.height || 2400;
      const dpi = profile.dpi || profile.device?.dpi || 420;
      const device = profile.device;

      const brand = device?.brand || 'Samsung';
      const model = device?.model || 'SM-S901B';
      const devName = device?.device || 'r0s';
      const board = device?.board || 'exynos2200';
      let fingerprint = device?.fingerprint || 'samsung/r0sxxx/r0s:12/SP1A.210812.016/S901BXXU1AVA7:user/release-keys';
      const patch = device?.securityPatch || '2023-08-01';

      const redroidTag = await this.getAvailableRedroidImage(profile.androidVersion);
      console.log(`[RedroidManager] Iniciando container Android para "${profile.name}" usando imagem redroid/redroid:${redroidTag}`);

      // Garante coerência entre a versão do Android do container e a fingerprint
      // Evita mismatch fatal detectado por algoritmos antifraude (Instagram/Meta/Play Integrity)
      if (redroidTag.startsWith('12.') && !fingerprint.includes(':12/')) {
        fingerprint = fingerprint.replace(/:\d+\//, ':12/');
      } else if (redroidTag.startsWith('14.') && !fingerprint.includes(':14/')) {
        fingerprint = fingerprint.replace(/:\d+\//, ':14/');
      }

      // Gera um Serial Number de hardware único e determinístico baseado no ID do perfil
      const serialNumber = this.resolveSerialNumber(profile);

      // Garante MAC Address fixo e determinístico
      let macAddress = profile.macAddress;
      if (!macAddress) {
        macAddress = this.generateDeterministicMac(profileId);
        profile.macAddress = macAddress;
        try {
          const storeData = DataStore.read();
          const updated = (storeData.profiles || []).map((p: any) =>
            p.id === profile.id ? { ...p, macAddress } : p
          );
          DataStore.write({ profiles: updated });
        } catch {}
      }

      const proxyArgs = proxyForwarder
        ? [
            'androidboot.redroid_net_proxy_type=static',
            'androidboot.redroid_net_proxy_host=172.17.0.1',
            `androidboot.redroid_net_proxy_port=${proxyForwarder.port}`,
          ]
        : [];

      const gpuArgs = this.getGpuArgs();

      // Prepara e monta as bibliotecas de GPU spoofadas diretamente no boot do container Android.
      // O SurfaceFlinger e o Zygote sobem nativamente com a GPU do celular especificada no catálogo
      // (ex: Mali-G78, Adreno 750), garantindo 60 FPS de aceleração de hardware sem vazamento do PC
      // e sem reinicializações que causavam tela preta e quebra no scrcpy.
      const baseMesaPath = this.getPublicBinaryPath('libGLESv2_mesa.so');
      const baseGles2Path = this.getPublicBinaryPath('libGLESv2.so');
      const gpuVolumeArgs: string[] = [];
      const overridesDir = this.getGpuOverridesDir(profileId);
      const spoofedGpu = GpuSpoofer.prepareProfileGpuOverrides(profile, baseMesaPath, baseGles2Path, overridesDir);
      if (spoofedGpu) {
        if (spoofedGpu.mesaPath && gpuArgs.length > 0) {
          gpuVolumeArgs.push(`-v ${spoofedGpu.mesaPath}:/vendor/lib64/egl/libGLESv2_mesa.so:ro`);
        }
        if (spoofedGpu.gles2Path) {
          gpuVolumeArgs.push(`-v ${spoofedGpu.gles2Path}:/system/lib64/libGLESv2.so:ro`);
        }
        const identity = GpuSpoofer.resolveGpuIdentity(profile.device);
        console.log(`[RedroidManager] GPU Spoofing configurado no boot para "${profile.name}": ${identity.vendor} ${identity.renderer} (${identity.version})`);
      }

      const dockerCmd = [
        'docker run -d',
        `--name ${containerName}`,
        '--privileged',
        this.getDockerBinderFlags(),
        `-v ${volumeName}:/data`,
        ...gpuVolumeArgs,
        `-p ${adbPort}:5555`,
        `--mac-address ${macAddress}`,
        `--shm-size=1g`,
        `redroid/redroid:${redroidTag}`,
        `androidboot.redroid_width=${width}`,
        `androidboot.redroid_height=${height}`,
        `androidboot.redroid_dpi=${dpi}`,
        `androidboot.redroid_fps=60`,
        ...gpuArgs,
        ...proxyArgs,

        // Identificadores de Hardware e Fingerprint Realistas
        `ro.serialno=${serialNumber}`,
        `ro.boot.serialno=${serialNumber}`,
        `androidboot.serialno=${serialNumber}`,
        `ro.product.brand=${brand}`,
        `ro.product.manufacturer=${brand}`,
        `ro.product.model=${model}`,
        `ro.product.name=${devName}`,
        `ro.product.device=${devName}`,
        // Com GPU host, o init do Redroid depende de ro.hardware=redroid para configurar gralloc/hwcomposer no boot.
        // Nesse caso, board/hardware são aplicados somente depois do boot via resetprop.
        ...(gpuArgs.length ? [] : [`ro.product.board=${board}`, `ro.hardware=${board}`, `ro.boot.hardware=${board}`]),
        // Os HALs gráficos do Redroid são hwcomposer.redroid.so / gralloc.redroid.so.
        // Sem estes overrides, o hw_get_module procura por "<board>" e o SurfaceFlinger nunca sobe (boot infinito).
        // Em modo GPU host o Redroid usa gralloc=gbm/hwcomposer=drm: sobrescrever quebra a alocação de buffers (tela preta).
        ...(gpuArgs.length ? [] : ['ro.hardware.hwcomposer=redroid', 'ro.hardware.gralloc=redroid']),

        // Blindagem de Partições (Remove qualquer resquício de redroid em system, vendor, odm, product)
        `ro.product.system.brand=${brand}`,
        `ro.product.system.manufacturer=${brand}`,
        `ro.product.system.model=${model}`,
        `ro.product.system.device=${devName}`,
        `ro.product.system.name=${devName}`,

        `ro.product.vendor.brand=${brand}`,
        `ro.product.vendor.manufacturer=${brand}`,
        `ro.product.vendor.model=${model}`,
        `ro.product.vendor.device=${devName}`,
        `ro.product.vendor.name=${devName}`,

        `ro.product.odm.brand=${brand}`,
        `ro.product.odm.manufacturer=${brand}`,
        `ro.product.odm.model=${model}`,
        `ro.product.odm.device=${devName}`,
        `ro.product.odm.name=${devName}`,

        `ro.product.product.brand=${brand}`,
        `ro.product.product.manufacturer=${brand}`,
        `ro.product.product.model=${model}`,
        `ro.product.product.device=${devName}`,
        `ro.product.product.name=${devName}`,

        `ro.product.system_ext.brand=${brand}`,
        `ro.product.system_ext.manufacturer=${brand}`,
        `ro.product.system_ext.model=${model}`,
        `ro.product.system_ext.device=${devName}`,
        `ro.product.system_ext.name=${devName}`,

        `ro.product.vendor_dlkm.brand=${brand}`,
        `ro.product.vendor_dlkm.manufacturer=${brand}`,
        `ro.product.vendor_dlkm.model=${model}`,
        `ro.product.vendor_dlkm.device=${devName}`,
        `ro.product.vendor_dlkm.name=${devName}`,
        `ro.vendor_dlkm.build.fingerprint=${fingerprint}`,

        // Fingerprints uniformes em todas as partições
        `ro.build.display.id=${fingerprint}`,
        `ro.build.fingerprint=${fingerprint}`,
        `ro.system.build.fingerprint=${fingerprint}`,
        `ro.vendor.build.fingerprint=${fingerprint}`,
        `ro.odm.build.fingerprint=${fingerprint}`,
        `ro.product.build.fingerprint=${fingerprint}`,
        `ro.system_ext.build.fingerprint=${fingerprint}`,

        // Assinatura de build oficial de produção (release-keys em vez de test-keys)
        'ro.build.tags=release-keys',
        'ro.build.type=user',
        `ro.build.flavor=${devName}-user`,
        // O init do Redroid separa argumentos por espaço: a description não pode conter espaços
        `ro.build.description=${devName}-user`,
        `ro.build.product=${devName}`,
        `ro.build.version.security_patch=${patch}`,
        'ro.secure=0',
        'ro.adb.secure=0',
      ].filter(Boolean).join(' ');

      const runResult = await this.execAsync(dockerCmd);
      if (runResult.code !== 0) {
        const errMsg = runResult.stderr || runResult.stdout || 'Falha ao iniciar container Redroid';
        console.error(`[RedroidManager] Erro no docker run para ${profile.name}:`, errMsg);
        if (proxyForwarder) proxyForwarder.close();
        this.emitter.emit('status_changed', { profileId, status: 'idle' });
        return {
          success: false,
          error: errMsg,
        };
      }

      const runningInfo: RunningContainerInfo = {
        profileId,
        containerId: containerName,
        adbPort,
        proxyForwarder,
        startedAt: Date.now(),
      };
      this.runningProfiles.set(profileId, runningInfo);
      // Mantém 'launching' até a conclusão do boot do Android (sys.boot_completed = 1)
      this.emitter.emit('status_changed', { profileId, status: 'launching' });

      // Async boot check and display launcher
      this.connectAdbAndLaunchDisplay(profile, adbPort, runningInfo).catch(err => {
        console.error('[RedroidManager] Erro no boot/scrcpy:', err);
      });

      return { success: true, adbPort };
    } catch (err: any) {
      this.emitter.emit('status_changed', { profileId, status: 'idle' });
      return { success: false, error: err?.message || 'Erro inesperado ao iniciar perfil Android' };
    }
  }

  private static async connectAdbAndLaunchDisplay(
    profile: Profile,
    adbPort: number,
    info: RunningContainerInfo
  ): Promise<void> {
    const BOOT_DEADLINE_MS = 90000;
    const startedAt = Date.now();
    let booted = false;

    // Verifica o boot via docker exec (não depende do ADB, que fica "offline" enquanto o Android sobe)
    while (Date.now() - startedAt < BOOT_DEADLINE_MS) {
      const { stdout: psCheck } = await this.execAsync(
        `docker ps --filter "name=${info.containerId}" --format "{{.ID}}"`,
        5000
      );
      if (!psCheck) {
        console.error(`[RedroidManager] Container ${info.containerId} encerrou inesperadamente.`);
        await this.cleanupFailedLaunch(profile.id, info);
        return;
      }

      const check = await this.execAsync(`docker exec ${info.containerId} getprop sys.boot_completed`, 5000);
      if (check.stdout.trim() === '1') {
        booted = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!booted) {
      console.error(`[RedroidManager] Android não concluiu o boot em ${BOOT_DEADLINE_MS / 1000}s para ${profile.name}.`);
      await this.cleanupFailedLaunch(profile.id, info);
      return;
    }

    console.log(`[RedroidManager] Boot do Android concluído com sucesso para ${profile.name}!`);

    // Aplica blindagem 100% stealth das propriedades de hardware, partições e fingerprints via resetprop
    await this.applyStealthProperties(profile, info.containerId);

    // Oculta binário su pré-instalado (Root check evasion)
    await this.hideSuBinary(info.containerId);

    // Remove rastros de Docker/Redroid e mascara /proc/cpuinfo (CPU do host)
    await this.removeContainerTraces(info.containerId);
    await this.applyCpuInfoMasking(profile, info.containerId);

    // Mascaramento de /proc (cmdline, 1/cmdline, version, cpuinfo)
    const serialNumber = this.resolveSerialNumber(profile);
    await this.applyProcMasking(profile, info.containerId, serialNumber);

    // Conecta ADB (com timeouts curtos para nunca travar a UI)
    for (let i = 0; i < 10; i++) {
      await this.execAsync(`adb connect localhost:${adbPort}`, 5000);
      const state = await this.execAsync(`adb -s localhost:${adbPort} get-state`, 5000);
      if (state.stdout.trim() === 'device') break;
      await new Promise(r => setTimeout(r, 1000));
    }

    // Persiste e sincroniza android_id único e permanente
    await this.ensurePersistentAndroidId(profile, info.containerId);

    // Configura bateria física realista (75-88%, descarregando, temperatura ambiente)
    await this.applyBatterySpoofing(profile, info.containerId);

    // Sempre sincroniza o proxy: aplica o atual ou limpa um proxy antigo persistido no volume
    const proxyValue = info.proxyForwarder ? `172.17.0.1:${info.proxyForwarder.port}` : ':0';
    await this.execAsync(`docker exec ${info.containerId} settings put global http_proxy ${proxyValue}`, 5000);
    if (info.proxyForwarder) {
      console.log(`[RedroidManager] Proxy global ativo no Android via ${proxyValue}`);
      // Proteção contra WebRTC STUN Leak: neutraliza o vazamento do IP real da máquina
      await this.applyWebRtcLeakProtection(info.containerId);
    }

    // Fuso horário coerente com o IP (container sobe em GMT por padrão — incoerência clássica para antifraude)
    const timezone = this.resolveTimezone(profile);
    await this.execAsync(`docker exec ${info.containerId} service call alarm 3 s16 ${timezone}`, 5000);

    // Aguarda o subsistema de exibição (DisplayManager) ter o display padrão (mDisplayId=0) pronto
    for (let i = 0; i < 20; i++) {
      const dispCheck = await this.execAsync(`adb -s localhost:${adbPort} shell dumpsys display`, 3000);
      if (dispCheck.stdout.includes('mDisplayId=0')) break;
      await new Promise(r => setTimeout(r, 500));
    }

    this.emitter.emit('status_changed', { profileId: profile.id, status: 'running' });
    await this.spawnScrcpy(profile, adbPort, info);

    // Instalação silenciosa em background dos APKs essenciais (Aurora Store e Via Browser) na primeira abertura
    this.installInitialApksInBackground(adbPort).catch(err => {
      console.warn('[RedroidManager] Aviso na verificação de APKs em background:', err);
    });
  }

  private static resolveTimezone(profile: Profile): string {
    const byCountry: Record<string, string> = {
      BR: 'America/Sao_Paulo', US: 'America/New_York', PT: 'Europe/Lisbon', ES: 'Europe/Madrid',
      MX: 'America/Mexico_City', AR: 'America/Argentina/Buenos_Aires', CO: 'America/Bogota',
      GB: 'Europe/London', UK: 'Europe/London', DE: 'Europe/Berlin', FR: 'Europe/Paris',
      IT: 'Europe/Rome', CA: 'America/Toronto', JP: 'Asia/Tokyo', IN: 'Asia/Kolkata', AU: 'Australia/Sydney',
    };
    const country = profile.proxy?.type !== 'direct' ? profile.proxy?.countryCode?.toUpperCase() : undefined;
    if (country && byCountry[country]) return byCountry[country];
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
    } catch {
      return 'America/Sao_Paulo';
    }
  }

  private static async cleanupFailedLaunch(profileId: string, info: RunningContainerInfo): Promise<void> {
    try {
      info.proxyForwarder?.close();
    } catch {}
    this.runningProfiles.delete(profileId);
    await this.execAsync(`docker stop -t 3 ${info.containerId}`, 15000);
    this.emitter.emit('status_changed', { profileId, status: 'idle' });
  }

  private static getGpuOverridesDir(profileId: string): string {
    let baseDir = '';
    try {
      if (app && typeof app.getPath === 'function') {
        baseDir = path.join(app.getPath('userData'), 'gpu-overrides', profileId);
      }
    } catch {}
    if (!baseDir) {
      baseDir = path.join(os.homedir(), '.geenjutsu', 'gpu-overrides', profileId);
    }
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  }

  private static getPublicBinaryPath(filename: string): string | null {
    let appPath = '';
    try {
      if (app && typeof app.getAppPath === 'function') {
        appPath = app.getAppPath();
      }
    } catch {}

    const candidates = [
      path.join(process.cwd(), 'public', 'bin', filename),
      path.resolve('public', 'bin', filename),
      path.join(__dirname, '../public/bin', filename),
      path.join(__dirname, '../../public/bin', filename),
      path.join(__dirname, '../../../public/bin', filename),
      appPath ? path.join(appPath, 'public', 'bin', filename) : '',
      process.resourcesPath ? path.join(process.resourcesPath, 'public', 'bin', filename) : '',
      process.resourcesPath ? path.join(process.resourcesPath, 'bin', filename) : '',
    ].filter(Boolean);

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  private static resolveSerialNumber(profile: Profile): string {
    const profileId = profile.id;
    const brand = profile.device?.brand || 'Samsung';
    let serialHash = 0;
    for (let i = 0; i < profileId.length; i++) {
      serialHash = (serialHash * 31 + profileId.charCodeAt(i)) >>> 0;
    }
    const serialHex = serialHash.toString(16).toUpperCase().padStart(8, '0');
    return brand.toLowerCase().includes('samsung')
      ? `R58M${serialHex}`
      : brand.toLowerCase().includes('google')
      ? `1A${serialHex}`
      : brand.toLowerCase().includes('motorola')
      ? `ZY22${serialHex.slice(0, 6)}`
      : `SN${serialHex}`;
  }

  private static generateDeterministicMac(profileId: string): string {
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < profileId.length; i++) {
      hash1 = (hash1 * 31 + profileId.charCodeAt(i)) >>> 0;
      hash2 = (hash2 * 17 + profileId.charCodeAt(i)) >>> 0;
    }
    const b1 = '02';
    const b2 = (hash1 & 0xff).toString(16).padStart(2, '0');
    const b3 = ((hash1 >> 8) & 0xff).toString(16).padStart(2, '0');
    const b4 = ((hash1 >> 16) & 0xff).toString(16).padStart(2, '0');
    const b5 = (hash2 & 0xff).toString(16).padStart(2, '0');
    const b6 = ((hash2 >> 8) & 0xff).toString(16).padStart(2, '0');
    return `${b1}:${b2}:${b3}:${b4}:${b5}:${b6}`.toLowerCase();
  }

  private static async ensurePersistentAndroidId(profile: Profile, containerId: string): Promise<string> {
    try {
      if (profile.androidId) {
        await this.execAsync(`docker exec ${containerId} settings put secure android_id ${profile.androidId}`, 5000);
        return profile.androidId;
      }

      const res = await this.execAsync(`docker exec ${containerId} settings get secure android_id`, 5000);
      const currentId = res.stdout.trim();
      if (currentId && currentId !== 'null' && currentId.length >= 8) {
        profile.androidId = currentId;
        const storeData = DataStore.read();
        const updatedProfiles = (storeData.profiles || []).map((p: Profile) =>
          p.id === profile.id ? { ...p, androidId: currentId } : p
        );
        DataStore.write({ profiles: updatedProfiles });
        console.log(`[RedroidManager] android_id ${currentId} gravado e persistido para o perfil ${profile.name}`);
        return currentId;
      }
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao persistir android_id:', err);
    }
    return '';
  }

  private static async applyBatterySpoofing(profile: Profile, containerId: string): Promise<void> {
    try {
      let hash = 0;
      for (let i = 0; i < profile.id.length; i++) {
        hash = (hash * 13 + profile.id.charCodeAt(i)) >>> 0;
      }
      const batteryLevel = 72 + (hash % 18); // Entre 72% e 89%
      const batteryTemp = 280 + (hash % 25); // 28.0°C a 30.4°C

      // Executa em comando único e atômico definindo USB e Level ANTES de present=1.
      // Se present=1 for executado isoladamente enquanto o nível ainda for 0%,
      // o BatteryService do Android dispara shutdown imediato de bateria zerada desplugada.
      const cmd = `dumpsys battery set usb 1 && dumpsys battery set level ${batteryLevel} && dumpsys battery set temp ${batteryTemp} && dumpsys battery set status 2 && dumpsys battery set present 1`;
      await this.execAsync(`docker exec ${containerId} sh -c "${cmd}"`, 5000);
      console.log(`[RedroidManager] Bateria realista configurada para ${profile.name}: ${batteryLevel}%, USB conectado, ${batteryTemp / 10}°C`);
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao configurar bateria:', err);
    }
  }

  /**
   * Usa a GPU do host via Mesa quando disponível (AMD / Intel), garantindo fluidez e aceleração máxima de 60 FPS.
   * O nome da placa do PC é 100% mascarado pelo applyGpuSpoofing (retornando a Mali ou Adreno do celular cadastrado).
   */
  private static getGpuArgs(): string[] {
    if (process.platform !== 'linux') return [];
    try {
      const drm = '/sys/class/drm';
      if (!fs.existsSync(drm)) return [];
      const nodes = fs.readdirSync(drm).filter(n => /^renderD\d+$/.test(n));
      for (const node of nodes) {
        if (!fs.existsSync(`/dev/dri/${node}`)) continue;
        const vendorPath = path.join(drm, node, 'device', 'vendor');
        if (!fs.existsSync(vendorPath)) continue;
        const vendor = fs.readFileSync(vendorPath, 'utf8').trim().toLowerCase();
        // 0x1002 = AMD, 0x8086 = Intel
        if (vendor === '0x1002' || vendor === '0x8086') {
          return ['androidboot.redroid_gpu_mode=host', `androidboot.redroid_gpu_node=/dev/dri/${node}`];
        }
      }
    } catch {}
    return [];
  }

  private static async removeContainerTraces(containerId: string): Promise<void> {
    try {
      // Rastros clássicos de Docker/Redroid checados por detectores simples de arquivo
      await this.execAsync(
        `docker exec ${containerId} sh -c "rm -f /.dockerenv /vendor/bin/post-fs-data.redroid.sh /vendor/bin/*.redroid.sh /system/bin/*redroid* 2>/dev/null; true"`,
        5000
      );
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao remover rastros do container:', err);
    }
  }

  private static buildFakeCpuInfo(profile: Profile): string {
    const board = profile.device?.board || 'exynos2100';
    const features = 'fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm lrcpc dcpop asimddp';
    // 1x Cortex-X1 + 3x Cortex-A78 + 4x Cortex-A55 (layout big.LITTLE comum em flagships)
    const cores: Array<{ part: string; bogo: string }> = [
      ...Array(4).fill({ part: '0xd05', bogo: '26.00' }),
      ...Array(3).fill({ part: '0xd41', bogo: '26.00' }),
      { part: '0xd44', bogo: '26.00' },
    ];
    const blocks = cores.map((c, i) =>
      `processor\t: ${i}\nBogoMIPS\t: ${c.bogo}\nFeatures\t: ${features}\nCPU implementer\t: 0x41\nCPU architecture: 8\nCPU variant\t: 0x${c.part === '0xd05' ? '0' : '1'}\nCPU part\t: ${c.part}\nCPU revision\t: 0\n`
    );
    return blocks.join('\n') + `\nHardware\t: ${board}\n`;
  }

  private static async applyCpuInfoMasking(profile: Profile, containerId: string): Promise<void> {
    try {
      const tmpFile = path.join(os.tmpdir(), `geenjutsu-cpuinfo-${profile.id}`);
      fs.writeFileSync(tmpFile, this.buildFakeCpuInfo(profile), 'utf8');
      const stealthDir = '/data/system/.antidetect';
      await this.execAsync(`docker exec ${containerId} mkdir -p ${stealthDir}`, 5000);
      await this.execAsync(`docker cp "${tmpFile}" ${containerId}:${stealthDir}/cpuinfo`, 5000);
      try { fs.unlinkSync(tmpFile); } catch {}
      await this.execAsync(`docker exec ${containerId} chmod 644 ${stealthDir}/cpuinfo`, 5000);
      await this.execAsync(`docker exec ${containerId} mount -o bind ${stealthDir}/cpuinfo /proc/cpuinfo`, 5000);
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao mascarar /proc/cpuinfo:', err);
    }
  }

  private static async hideSuBinary(containerId: string): Promise<void> {
    try {
      await this.execAsync(`docker exec ${containerId} sh -c "if [ -f /system/xbin/su ]; then mv /system/xbin/su /system/xbin/.su_backup; fi"`, 5000);
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao ocultar binário su:', err);
    }
  }

  private static async applyProcMasking(profile: Profile, containerId: string, serialNumber: string): Promise<void> {
    try {
      const dev = profile.device;
      const board = dev?.board || 'bluejay';
      const brand = dev?.brand || 'Google';
      const isSamsung = brand.toLowerCase().includes('samsung');

      const fakeKCmdline = `console=null stack_depot_disable=on cgroup_disable=pressure androidboot.hardware=${board} androidboot.serialno=${serialNumber} buildvariant=user`;
      const fakeInitCmdline = '/system/bin/app_process64';
      const fakeVersion = isSamsung
        ? `Linux version 5.10.136-android12-9-24750181 (se-infra@samsung) (Android (8053312) clang 12.0.8) #1 SMP PREEMPT 2022`
        : `Linux version 5.10.157-android12-9-00042-ab8500206 (android-build@google.com) (Android (8053312) clang 12.0.8) #1 SMP PREEMPT 2022`;

      const stealthDir = '/data/system/.antidetect';
      await this.execAsync(`docker exec ${containerId} mkdir -p ${stealthDir}`, 5000);
      await this.execAsync(`docker exec ${containerId} chmod 700 ${stealthDir}`, 5000);

      const escapedKCmdline = fakeKCmdline.replace(/"/g, '\\"');
      const escapedInit = fakeInitCmdline.replace(/"/g, '\\"');
      const escapedVer = fakeVersion.replace(/"/g, '\\"');

      await this.execAsync(`docker exec ${containerId} sh -c "echo -n \\"${escapedKCmdline}\\" > ${stealthDir}/cmdline"`, 5000);
      await this.execAsync(`docker exec ${containerId} sh -c "echo -n \\"${escapedInit}\\" > ${stealthDir}/init_cmdline"`, 5000);
      await this.execAsync(`docker exec ${containerId} sh -c "echo -n \\"${escapedVer}\\" > ${stealthDir}/version"`, 5000);

      await this.execAsync(`docker exec ${containerId} mount -o bind ${stealthDir}/cmdline /proc/cmdline`, 5000);
      await this.execAsync(`docker exec ${containerId} mount -o bind ${stealthDir}/init_cmdline /proc/1/cmdline`, 5000);
      await this.execAsync(`docker exec ${containerId} mount -o bind ${stealthDir}/version /proc/version`, 5000);
      console.log(`[RedroidManager] Mascaramento de /proc e cmdline aplicado com sucesso para ${profile.name}`);
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao aplicar mascaramento de /proc:', err);
    }
  }

  private static async applyWebRtcLeakProtection(containerId: string): Promise<void> {
    try {
      console.log(`[RedroidManager] Aplicando blindagem contra WebRTC STUN Leak no container ${containerId}...`);

      // 1. Configura diretiva de privacidade anti-leak para Chromium e Android System WebView
      // Impede requisições diretas de STUN via UDP fora da rota do proxy
      const webviewFlags = '_ --webrtc-ip-handling-policy=disable_non_proxied_udp --force-webrtc-ip-handling-policy';
      await this.execAsync(
        `docker exec ${containerId} sh -c "echo \\"${webviewFlags}\\" > /data/local/tmp/webview-command-line && chmod 777 /data/local/tmp/webview-command-line"`,
        5000
      );
      await this.execAsync(
        `docker exec ${containerId} sh -c "echo \\"${webviewFlags}\\" > /data/local/tmp/chrome-command-line && chmod 777 /data/local/tmp/chrome-command-line"`,
        5000
      );

      // 2. Blackhole nas rotas diretas dos principais servidores de STUN da internet (Google, Cloudflare, Twilio, Mozilla)
      // Simula o comportamento padrão de CGNAT móvel estrito e impede que pacotes UDP alcancem a internet física
      const stunRanges = [
        '74.125.0.0/16',     // Google STUN (stun.l.google.com)
        '142.250.0.0/15',    // Google STUN
        '172.217.0.0/16',    // Google STUN
        '216.58.192.0/19',   // Google STUN
        '216.239.32.0/19',   // Google STUN
        '162.159.192.0/24',  // Cloudflare STUN (stun.cloudflare.com)
        '162.159.193.0/24',  // Cloudflare STUN
        '162.159.195.0/24',  // Cloudflare STUN
        '54.244.51.0/24',    // Twilio STUN
        '54.171.0.0/16',     // Twilio STUN
        '63.245.208.0/21',   // Mozilla STUN (stun.services.mozilla.com)
      ];

      const routeCommands = stunRanges.map(range => `ip route add blackhole ${range} 2>/dev/null || true`).join(' && ');
      await this.execAsync(`docker exec ${containerId} sh -c "${routeCommands}"`, 5000);

      console.log(`[RedroidManager] Blindagem contra WebRTC Leak ativada com sucesso para ${containerId}`);
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao aplicar proteção contra WebRTC Leak:', err);
    }
  }

  private static async applyStealthProperties(profile: Profile, containerId: string): Promise<void> {
    try {
      const resetpropBinary = this.getPublicBinaryPath('resetprop');
      if (!resetpropBinary) {
        console.warn('[RedroidManager] Binário resetprop não encontrado para blindagem de propriedades.');
        return;
      }

      await this.execAsync(`docker cp "${resetpropBinary}" ${containerId}:/data/local/tmp/resetprop`);
      await this.execAsync(`docker exec ${containerId} chmod +x /data/local/tmp/resetprop`);

      const device = profile.device;
      const brand = device?.brand || 'Samsung';
      const model = device?.model || 'SM-S901B';
      const devName = device?.device || 'r0s';
      const board = device?.board || 'exynos2200';
      let fingerprint = device?.fingerprint || 'samsung/r0sxxx/r0s:12/SP1A.210812.016/S901BXXU1AVA7:user/release-keys';
      const patch = device?.securityPatch || '2023-08-01';
      const androidVer = profile.androidVersion || '12';

      // Extrai buildId e incremental da fingerprint real para evitar qualquer divergência detectável
      let buildId = 'SP1A.210812.016';
      let incremental = '8500206';
      try {
        const parts = fingerprint.split(':');
        if (parts.length >= 2) {
          const middle = parts[1].split('/');
          if (middle.length >= 3) {
            buildId = middle[1];
            incremental = middle[2];
          }
        }
      } catch {}

      // Operadora de celular simulada realista de acordo com o país do proxy
      const country = profile.proxy?.countryCode?.toUpperCase() || 'BR';
      let carrierName = 'Claro';
      let carrierNumeric = '72405';
      if (country === 'US') {
        carrierName = 'T-Mobile';
        carrierNumeric = '310260';
      } else if (country === 'PT') {
        carrierName = 'MEO';
        carrierNumeric = '26806';
      } else if (country === 'GB' || country === 'UK') {
        carrierName = 'EE';
        carrierNumeric = '23430';
      }

      const isSamsung = brand.toLowerCase().includes('samsung');
      const buildUser = 'android-build';
      const buildHost = isSamsung ? 'se-infra' : 'android-build.google.com';

      const spoofLines = [
        `ro.product.brand=${brand}`,
        `ro.product.manufacturer=${brand}`,
        `ro.product.model=${model}`,
        `ro.product.name=${devName}`,
        `ro.product.device=${devName}`,
        `ro.product.board=${board}`,
        `ro.hardware=${board}`,
        `ro.boot.hardware=${board}`,

        // Identificadores de Compilação Uniformes nas Partições
        `ro.build.id=${buildId}`,
        `ro.system.build.id=${buildId}`,
        `ro.vendor.build.id=${buildId}`,
        `ro.odm.build.id=${buildId}`,
        `ro.product.build.id=${buildId}`,
        `ro.system_ext.build.id=${buildId}`,
        `ro.vendor_dlkm.build.id=${buildId}`,

        `ro.build.version.incremental=${incremental}`,
        `ro.system.build.version.incremental=${incremental}`,
        `ro.vendor.build.version.incremental=${incremental}`,
        `ro.odm.build.version.incremental=${incremental}`,
        `ro.product.build.version.incremental=${incremental}`,
        `ro.system_ext.build.version.incremental=${incremental}`,
        `ro.vendor_dlkm.build.version.incremental=${incremental}`,

        // Partições
        `ro.product.system.brand=${brand}`,
        `ro.product.system.manufacturer=${brand}`,
        `ro.product.system.model=${model}`,
        `ro.product.system.name=${devName}`,
        `ro.product.system.device=${devName}`,

        `ro.product.vendor.brand=${brand}`,
        `ro.product.vendor.manufacturer=${brand}`,
        `ro.product.vendor.model=${model}`,
        `ro.product.vendor.name=${devName}`,
        `ro.product.vendor.device=${devName}`,

        `ro.product.odm.brand=${brand}`,
        `ro.product.odm.manufacturer=${brand}`,
        `ro.product.odm.model=${model}`,
        `ro.product.odm.name=${devName}`,
        `ro.product.odm.device=${devName}`,

        `ro.product.product.brand=${brand}`,
        `ro.product.product.manufacturer=${brand}`,
        `ro.product.product.model=${model}`,
        `ro.product.product.name=${devName}`,
        `ro.product.product.device=${devName}`,

        `ro.product.system_ext.brand=${brand}`,
        `ro.product.system_ext.manufacturer=${brand}`,
        `ro.product.system_ext.model=${model}`,
        `ro.product.system_ext.name=${devName}`,
        `ro.product.system_ext.device=${devName}`,

        `ro.product.vendor_dlkm.brand=${brand}`,
        `ro.product.vendor_dlkm.manufacturer=${brand}`,
        `ro.product.vendor_dlkm.model=${model}`,
        `ro.product.vendor_dlkm.name=${devName}`,
        `ro.product.vendor_dlkm.device=${devName}`,

        // Fingerprints uniformes em todas as partições
        `ro.build.display.id=${fingerprint}`,
        `ro.build.fingerprint=${fingerprint}`,
        `ro.system.build.fingerprint=${fingerprint}`,
        `ro.vendor.build.fingerprint=${fingerprint}`,
        `ro.odm.build.fingerprint=${fingerprint}`,
        `ro.product.build.fingerprint=${fingerprint}`,
        `ro.system_ext.build.fingerprint=${fingerprint}`,
        `ro.vendor_dlkm.build.fingerprint=${fingerprint}`,

        // Assinatura oficial de release
        'ro.build.tags=release-keys',
        'ro.build.type=user',
        `ro.build.flavor=${devName}-user`,
        `ro.build.description=${devName}-user ${androidVer} ${patch} release-keys`,
        `ro.build.product=${devName}`,
        `ro.build.version.security_patch=${patch}`,
        `ro.build.user=${buildUser}`,
        `ro.build.host=${buildHost}`,

        'ro.odm.build.tags=release-keys',
        'ro.odm.build.type=user',
        'ro.product.build.tags=release-keys',
        'ro.product.build.type=user',
        'ro.system.build.tags=release-keys',
        'ro.system.build.type=user',
        'ro.system_ext.build.tags=release-keys',
        'ro.system_ext.build.type=user',
        'ro.vendor.build.tags=release-keys',
        'ro.vendor.build.type=user',
        'ro.vendor_dlkm.build.tags=release-keys',
        'ro.vendor_dlkm.build.type=user',

        // Modo de produção seguro (Desliga ro.debuggable e liga ro.secure)
        'ro.debuggable=0',
        'ro.secure=1',
        'ro.adb.secure=1',
        'ro.bootmode=normal',
        'ro.boot.bootmode=normal',
        `ro.bootloader=${board}-0.5-${incremental.slice(0, 8)}`,
        `net.bt.name=${model}`,

        // Telefonia simulada
        'gsm.current.phone-type=1',
        'gsm.network.type=LTE',
        'gsm.sim.state=READY',
        `gsm.operator.alpha=${carrierName}`,
        `gsm.operator.numeric=${carrierNumeric}`,
        `gsm.sim.operator.alpha=${carrierName}`,
        `gsm.sim.operator.numeric=${carrierNumeric}`,
      ];

      const tmpPropFile = path.join('/tmp', `geenjutsu-spoof-${profile.id}.prop`);
      fs.writeFileSync(tmpPropFile, spoofLines.join('\n'), 'utf8');

      await this.execAsync(`docker cp "${tmpPropFile}" ${containerId}:/data/local/tmp/spoof.prop`);
      try { fs.unlinkSync(tmpPropFile); } catch {}

      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -f /data/local/tmp/spoof.prop`);

      // Deleta props do redroid em memória
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.radio.noril`);
      // Com GPU host, gralloc/hwcomposer (gbm/drm) são necessários em todo processo novo: não podem ser removidos.
      if (this.getGpuArgs().length === 0) {
        await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.hardware.gralloc`);
        await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.hardware.hwcomposer`);
      }
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_dpi`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_height`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_width`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_fps`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_net_proxy_host`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_net_proxy_port`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_net_proxy_type`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_gpu_mode`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.boot.redroid_gpu_node`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.hardware.vulkan`);
      await this.execAsync(`docker exec ${containerId} /data/local/tmp/resetprop -d ro.hardware.egl`);

      // Limpeza completa: remove arquivos temporários e o próprio executável resetprop
      await this.execAsync(`docker exec ${containerId} rm -f /data/local/tmp/resetprop /data/local/tmp/spoof.prop`);

      console.log(`[RedroidManager] Fingerprint de hardware blindada via resetprop para ${profile.name}!`);
    } catch (err: any) {
      console.warn('[RedroidManager] Aviso na blindagem de hardware:', err?.message || err);
    }
  }

  private static getPublicApkPath(filename: string): string | null {
    let appPath = '';
    try {
      if (app && typeof app.getAppPath === 'function') {
        appPath = app.getAppPath();
      }
    } catch {}

    const candidates = [
      path.join(process.cwd(), 'public', filename),
      path.resolve('public', filename),
      path.join(__dirname, '../public', filename),
      path.join(__dirname, '../../public', filename),
      appPath ? path.join(appPath, 'public', filename) : '',
      process.resourcesPath ? path.join(process.resourcesPath, 'public', filename) : '',
      process.resourcesPath ? path.join(process.resourcesPath, filename) : '',
    ].filter(Boolean);

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  private static async installInitialApksInBackground(adbPort: number): Promise<void> {
    try {
      // Aguarda o PackageManagerService registrar antes de executar a instalação
      for (let i = 0; i < 25; i++) {
        const pmCheck = await this.execAsync(`adb -s localhost:${adbPort} shell pm path android`, 3000);
        if (pmCheck.stdout.includes('package:')) break;
        await new Promise(r => setTimeout(r, 500));
      }

      const { stdout: pkgList } = await this.execAsync(`adb -s localhost:${adbPort} shell pm list packages`);

      const initialApps = [
        { file: 'via-browser.apk', pkg: 'mark.via.gp', label: 'Via Browser' },
        { file: 'aurora-store.apk', pkg: 'com.aurora.store', label: 'Aurora Store' },
      ];

      for (const app of initialApps) {
        if (!pkgList.includes(app.pkg)) {
          const apkPath = this.getPublicApkPath(app.file);
          if (apkPath) {
            console.log(`[RedroidManager] Instalando ${app.label} silenciosamente em background na porta ${adbPort}...`);
            const res = await this.execAsync(`adb -s localhost:${adbPort} install -r "${apkPath}"`);
            if (res.stdout.includes('Success')) {
              console.log(`[RedroidManager] ${app.label} instalado com sucesso em background!`);
            } else {
              console.warn(`[RedroidManager] Falha silenciosa ao instalar ${app.label}:`, res.stderr || res.stdout);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[RedroidManager] Erro durante verificação de APKs iniciais:', err);
    }
  }

  private static async spawnScrcpy(
    profile: Profile,
    adbPort: number,
    info?: RunningContainerInfo
  ): Promise<{ success: boolean; error?: string }> {
    // Evita abrir múltiplos processos scrcpy concorrentes para o mesmo container
    if (info?.scrcpyProcess && !info.scrcpyProcess.killed) {
      console.log(`[RedroidManager] Display scrcpy já está aberto para "${profile.name}".`);
      return { success: true };
    }

    const scrcpyCheck = await this.execAsync('which scrcpy');
    if (scrcpyCheck.code !== 0) {
      console.warn('[RedroidManager] scrcpy não encontrado no PATH do sistema.');
      return { success: false, error: 'scrcpy não instalado no sistema. Instale nas dependências do Android.' };
    }

    try {
      console.log(`[RedroidManager] Abrindo display scrcpy para "${profile.name}" (porta: ${adbPort})...`);
      const scrcpyArgs = [
        '-s', `localhost:${adbPort}`,
        `--window-title=Geenjutsu — ${profile.name}`,
        '--stay-awake',
        '-m', '1920',
        '--max-fps', '60',
      ];

      const scrcpy = spawn('scrcpy', scrcpyArgs, {
        detached: true,
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY || ':1',
          WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || 'wayland-1',
          XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.() || 1000}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      scrcpy.stdout?.on('data', data => {
        console.log(`[scrcpy ${profile.name}]`, data.toString().trim());
      });

      scrcpy.stderr?.on('data', data => {
        console.warn(`[scrcpy ${profile.name} err]`, data.toString().trim());
      });

      scrcpy.on('error', err => {
        console.error(`[scrcpy ${profile.name}] Erro ao iniciar processo scrcpy:`, err);
      });

      scrcpy.on('exit', (code, signal) => {
        console.log(`[scrcpy ${profile.name}] scrcpy finalizado com código ${code} (${signal || 'normal'})`);
        if (info) {
          info.scrcpyProcess = undefined;
        }
      });

      scrcpy.unref();

      if (info) {
        info.scrcpyProcess = scrcpy;
      }
      return { success: true };
    } catch (err: any) {
      console.error('[RedroidManager] Exceção ao abrir scrcpy:', err);
      return { success: false, error: err?.message || 'Falha ao executar scrcpy' };
    }
  }

  static async openScreen(profile: Profile): Promise<{ success: boolean; error?: string }> {
    let adbPort = profile.adbPort;
    const running = this.runningProfiles.get(profile.id);
    if (running?.adbPort) {
      adbPort = running.adbPort;
    }
    if (!adbPort) {
      adbPort = 55550;
    }

    await this.execAsync(`adb connect localhost:${adbPort}`);
    return await this.spawnScrcpy(profile, adbPort, running);
  }

  static async installAppPackage(profileId: string, filePath: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const running = this.runningProfiles.get(profileId);
    let adbPort = running?.adbPort;
    if (!adbPort) {
      const data = DataStore.read();
      const profile = (data.profiles || []).find((p: any) => p.id === profileId);
      adbPort = profile?.adbPort || 55550;
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Arquivo do pacote não encontrado no caminho especificado.' };
    }

    await this.execAsync(`adb connect localhost:${adbPort}`);

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.apk') {
      console.log(`[RedroidManager] Instalando APK em localhost:${adbPort}: ${filePath}`);
      // 1. Tenta com compatibilidade ARM64 e identidade da Google Play Store
      let res = await this.execAsync(`adb -s localhost:${adbPort} install -r -d -g -i com.android.vending --abi arm64-v8a "${filePath}"`, 180000);
      if (res.stdout.includes('Success')) {
        return { success: true, message: 'APK instalado com sucesso no Android!' };
      }
      // 2. Fallback padrão sem forçar ABI
      console.warn(`[RedroidManager] Falha na 1ª tentativa com --abi arm64-v8a (${res.stderr || res.stdout}). Tentando instalação padrão...`);
      res = await this.execAsync(`adb -s localhost:${adbPort} install -r -d -g -i com.android.vending "${filePath}"`, 180000);
      if (res.stdout.includes('Success')) {
        return { success: true, message: 'APK instalado com sucesso no Android!' };
      }
      return { success: false, error: res.stderr || res.stdout || 'Falha ao instalar APK' };
    }

    if (ext === '.xapk') {
      console.log(`[RedroidManager] Processando XAPK em localhost:${adbPort}: ${filePath}`);
      const tmpDir = path.join('/tmp', `geenjutsu-xapk-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      try {
        const unzipRes = await this.execAsync(`unzip -q -o "${filePath}" -d "${tmpDir}"`, 60000);
        if (unzipRes.code !== 0) {
          return { success: false, error: 'Falha ao descompactar pacote XAPK.' };
        }

        // Check for OBB files
        const obbDir = path.join(tmpDir, 'Android', 'obb');
        if (fs.existsSync(obbDir)) {
          console.log(`[RedroidManager] Enviando dados OBB para o Android...`);
          await this.execAsync(`adb -s localhost:${adbPort} push "${obbDir}/." /sdcard/Android/obb/`, 120000);
        }

        // Find all apk files recursively or in root
        const findFiles = (dir: string): string[] => {
          let results: string[] = [];
          const list = fs.readdirSync(dir);
          for (const file of list) {
            const full = path.join(dir, file);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
              results = results.concat(findFiles(full));
            } else if (file.toLowerCase().endsWith('.apk')) {
              results.push(full);
            }
          }
          return results;
        };

        const apks = findFiles(tmpDir);
        if (apks.length === 0) {
          return { success: false, error: 'Nenhum arquivo APK encontrado dentro do XAPK.' };
        }

        if (apks.length === 1) {
          let res = await this.execAsync(`adb -s localhost:${adbPort} install -r -d -g -i com.android.vending --abi arm64-v8a "${apks[0]}"`, 180000);
          if (res.stdout.includes('Success')) {
            return { success: true, message: 'XAPK instalado com sucesso no Android!' };
          }
          res = await this.execAsync(`adb -s localhost:${adbPort} install -r -d -g -i com.android.vending "${apks[0]}"`, 180000);
          if (res.stdout.includes('Success')) {
            return { success: true, message: 'XAPK instalado com sucesso no Android!' };
          }
          return { success: false, error: res.stderr || res.stdout || 'Falha ao instalar APK do pacote XAPK.' };
        }

        // Multiple split APKs (App Bundle)
        const apkArgs = apks.map(a => `"${a}"`).join(' ');
        let res = await this.execAsync(`adb -s localhost:${adbPort} install-multiple -r -d -g -i com.android.vending --abi arm64-v8a ${apkArgs}`, 180000);
        if (res.stdout.includes('Success')) {
          return { success: true, message: 'XAPK (Split APKs) instalado com sucesso no Android!' };
        }
        res = await this.execAsync(`adb -s localhost:${adbPort} install-multiple -r -d -g -i com.android.vending ${apkArgs}`, 180000);
        if (res.stdout.includes('Success')) {
          return { success: true, message: 'XAPK (Split APKs) instalado com sucesso no Android!' };
        }
        return { success: false, error: res.stderr || res.stdout || 'Falha ao instalar Split APKs.' };
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }

    return { success: false, error: 'Formato não suportado. Selecione um arquivo .apk ou .xapk' };
  }

  static async downloadAndInstallApp(
    profileId: string,
    downloadUrl: string,
    appName: string,
    onProgress?: (data: {
      stage: 'downloading' | 'installing' | 'completed' | 'error';
      progress?: number;
      received?: number;
      total?: number;
      error?: string;
      message?: string;
    }) => void
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    let tempFilePath = '';
    try {
      onProgress?.({ stage: 'downloading', progress: 0 });

      console.log(`[RedroidManager] Baixando APK/XAPK para ${appName}: ${downloadUrl}`);
      const res = await electronNet.fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
      });

      if (!res.ok) {
        throw new Error(`Falha ao conectar no servidor de download (HTTP ${res.status}): ${res.statusText}`);
      }

      let filename = '';
      const disposition = res.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
        if (match && match[1]) {
          try {
            filename = decodeURIComponent(match[1].replace(/\+/g, ' '));
          } catch {
            filename = match[1];
          }
        }
      }

      const isXapk = filename.toLowerCase().endsWith('.xapk') || downloadUrl.toLowerCase().includes('.xapk');
      const ext = isXapk ? '.xapk' : '.apk';
      const safePrefix = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      tempFilePath = path.join(os.tmpdir(), `geenjutsu_${safePrefix}_${Date.now()}${ext}`);

      const totalBytes = Number(res.headers.get('content-length')) || 0;
      let receivedBytes = 0;
      const fileStream = fs.createWriteStream(tempFilePath);

      if (res.body) {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          receivedBytes += value.length;
          fileStream.write(Buffer.from(value));
          if (totalBytes > 0 && onProgress) {
            const progress = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
            onProgress({ stage: 'downloading', progress, received: receivedBytes, total: totalBytes });
          }
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.end((err?: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`[RedroidManager] Download de ${appName} concluído (${receivedBytes} bytes). Instalando no Android...`);
      onProgress?.({ stage: 'installing', progress: 100 });

      // Garante exclusão mútua na etapa de instalação ADB no perfil
      const result = await this.withInstallLock(profileId, async () => {
        return await this.installAppPackage(profileId, tempFilePath);
      });

      if (result.success) {
        onProgress?.({ stage: 'completed', message: result.message || `${appName} instalado com sucesso!` });
      } else {
        onProgress?.({ stage: 'error', error: result.error || 'Falha ao instalar o pacote' });
      }

      return result;
    } catch (err: any) {
      console.error(`[RedroidManager] Erro no download/instalação de ${appName}:`, err);
      const errMsg = err?.message || 'Erro inesperado durante o download ou instalação';
      onProgress?.({ stage: 'error', error: errMsg });
      return { success: false, error: errMsg };
    } finally {
      if (tempFilePath) {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch {}
      }
    }
  }

  static async openAppInStore(profileId: string, packageName?: string): Promise<{ success: boolean; error?: string }> {
    const running = this.runningProfiles.get(profileId);
    let adbPort = running?.adbPort;
    if (!adbPort) {
      const data = DataStore.read();
      const profile = (data.profiles || []).find((p: any) => p.id === profileId);
      adbPort = profile?.adbPort || 55550;
    }

    try {
      await this.execAsync(`adb connect localhost:${adbPort}`);

      if (packageName) {
        // Envia o intent para a Aurora Store abrir diretamente no pacote desejado
        await this.execAsync(`adb -s localhost:${adbPort} shell am start -a android.intent.action.VIEW -d "market://details?id=${packageName}"`);
      } else {
        // Abre a Aurora Store na tela inicial
        await this.execAsync(`adb -s localhost:${adbPort} shell monkey -p com.aurora.store 1`);
      }

      // Garante que o display do Android via scrcpy esteja visível na tela
      const data = DataStore.read();
      const profile = (data.profiles || []).find((p: any) => p.id === profileId);
      if (profile) {
        await this.openScreen(profile);
      }

      return { success: true };
    } catch (err: any) {
      console.error('[RedroidManager] Erro ao abrir Aurora Store:', err);
      return { success: false, error: err?.message || 'Erro ao abrir Aurora Store no Android' };
    }
  }

  static async stopProfile(profileId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const containerName = `geenjutsu-android-${profileId}`;
      const running = this.runningProfiles.get(profileId);

      if (running?.scrcpyProcess) {
        try {
          running.scrcpyProcess.kill();
        } catch {}
      }

      if (running?.proxyForwarder) {
        try {
          running.proxyForwarder.close();
        } catch {}
      }

      this.runningProfiles.delete(profileId);
      this.emitter.emit('status_changed', { profileId, status: 'idle' });

      const stopResult = await this.execAsync(`docker stop ${containerName}`);
      return { success: stopResult.code === 0 };
    } catch (err: any) {
      this.emitter.emit('status_changed', { profileId, status: 'idle' });
      return { success: false, error: err?.message };
    }
  }

  private static createLocalProxyBridge(upstream: {
    type: string;
    host: string;
    port: string | number;
    username?: string;
    password?: string;
  }): Promise<ProxyForwarder> {
    return new Promise((resolve, reject) => {
      const proto = (upstream.type || 'socks5').toLowerCase();
      const isSocks = proto === 'socks5' || proto === 'socks4';
      const socksType = proto === 'socks4' ? 4 : 5;
      const upstreamPort = parseInt(String(upstream.port), 10);
      const authHeader = upstream.username
        ? Buffer.from(`${upstream.username}:${upstream.password || ''}`).toString('base64')
        : null;

      const server = http.createServer((clientReq, clientRes) => {
        let targetUrl: URL;
        try {
          targetUrl = new URL(clientReq.url || '');
        } catch {
          targetUrl = new URL('http://' + (clientReq.headers.host || 'localhost') + clientReq.url);
        }
        const targetHost = targetUrl.hostname;
        const targetPort = parseInt(targetUrl.port || '80', 10);

        if (isSocks) {
          SocksClient.createConnection({
            proxy: {
              ipaddress: upstream.host,
              port: upstreamPort,
              type: socksType,
              userId: upstream.username || '',
              password: upstream.password || '',
            },
            command: 'connect',
            destination: { host: targetHost, port: targetPort },
          })
            .then((info) => {
              const upstreamReq = http.request(
                {
                  host: targetHost,
                  port: targetPort,
                  path: targetUrl.pathname + targetUrl.search,
                  method: clientReq.method,
                  headers: clientReq.headers,
                  createConnection: () => info.socket,
                },
                (upstreamRes) => {
                  clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
                  upstreamRes.pipe(clientRes);
                }
              );
              upstreamReq.on('error', () => {
                try {
                  clientRes.writeHead(502);
                  clientRes.end();
                } catch {}
              });
              clientReq.pipe(upstreamReq);
            })
            .catch((err) => {
              try {
                clientRes.writeHead(502);
                clientRes.end('Proxy Error: ' + err.message);
              } catch {}
            });
        } else {
          const headers = { ...clientReq.headers };
          if (authHeader) headers['proxy-authorization'] = 'Basic ' + authHeader;
          const upstreamReq = http.request(
            {
              host: upstream.host,
              port: upstreamPort,
              path: clientReq.url,
              method: clientReq.method,
              headers,
            },
            (upstreamRes) => {
              clientRes.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
              upstreamRes.pipe(clientRes);
            }
          );
          upstreamReq.on('error', () => {
            try {
              clientRes.writeHead(502);
              clientRes.end();
            } catch {}
          });
          clientReq.pipe(upstreamReq);
        }
      });

      server.on('clientError', (err, socket) => {
        try {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
          socket.destroy();
        } catch {}
      });

      server.on('connect', (clientReq, clientSocket, head) => {
        const parts = (clientReq.url || '').split(':');
        const targetHost = parts[0];
        const targetPort = parseInt(parts[1] || '443', 10);

        // Previne Uncaught Exception (ECONNRESET/EPIPE) se o cliente Android fechar o socket prematuramente
        clientSocket.on('error', () => {
          try { clientSocket.destroy(); } catch {}
        });

        if (isSocks) {
          SocksClient.createConnection({
            proxy: {
              ipaddress: upstream.host,
              port: upstreamPort,
              type: socksType,
              userId: upstream.username || '',
              password: upstream.password || '',
            },
            command: 'connect',
            destination: { host: targetHost, port: targetPort },
          })
            .then((info) => {
              // Previne Uncaught Exception (ECONNRESET/EPIPE) no socket da proxy upstream
              info.socket.on('error', () => {
                try {
                  info.socket.destroy();
                  clientSocket.destroy();
                } catch {}
              });
              clientSocket.on('error', () => {
                try {
                  clientSocket.destroy();
                  info.socket.destroy();
                } catch {}
              });

              clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
              if (head && head.length > 0) info.socket.write(head);
              info.socket.pipe(clientSocket);
              clientSocket.pipe(info.socket);
            })
            .catch(() => {
              try {
                clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
                clientSocket.end();
                clientSocket.destroy();
              } catch {}
            });
        } else {
          const proxySocket = net.connect(upstreamPort, upstream.host, () => {
            proxySocket.on('error', () => {
              try {
                proxySocket.destroy();
                clientSocket.destroy();
              } catch {}
            });
            clientSocket.on('error', () => {
              try {
                clientSocket.destroy();
                proxySocket.destroy();
              } catch {}
            });

            let connectMsg = `CONNECT ${clientReq.url} HTTP/1.1\r\nHost: ${clientReq.url}\r\n`;
            if (authHeader) connectMsg += `Proxy-Authorization: Basic ${authHeader}\r\n`;
            connectMsg += '\r\n';
            proxySocket.write(connectMsg);
            if (head && head.length > 0) proxySocket.write(head);
            proxySocket.pipe(clientSocket);
            clientSocket.pipe(proxySocket);
          });
          proxySocket.on('error', () => {
            try {
              clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
              clientSocket.end();
              clientSocket.destroy();
            } catch {}
          });
        }
      });

      // Escuta apenas na bridge do Docker: não expõe a proxy (com credenciais) para a rede local
      server.listen(0, '172.17.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        resolve({
          port,
          close: () => {
            try {
              server.close();
            } catch {}
          },
        });
      });

      server.on('error', reject);
    });
  }

  static async closeAll(): Promise<void> {
    console.log('[RedroidManager] Encerrando todas as instâncias Android, processos scrcpy e conexões ADB...');

    // 1. Para todos os perfis registrados em memória (mata scrcpy, fecha proxy forwarder, docker stop)
    const runningIds = Array.from(this.runningProfiles.keys());
    await Promise.allSettled(runningIds.map(id => this.stopProfile(id)));

    // 2. Garante parada de qualquer container Docker remanescente do Geenjutsu
    try {
      const { stdout } = await this.execAsync(
        'docker ps -q --filter "name=geenjutsu-android-"',
        5000
      );
      if (stdout && stdout.trim()) {
        const containerIds = stdout.trim().split(/\s+/).join(' ');
        console.log(`[RedroidManager] Parando containers Docker remanescentes: ${containerIds}`);
        await this.execAsync(`docker stop -t 3 ${containerIds}`, 12000);
      }
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao parar containers remanescentes:', err);
    }

    // 3. Desconecta sessões ADB abertas
    try {
      await this.execAsync('adb disconnect', 4000);
    } catch {}

    console.log('[RedroidManager] Todos os emuladores Android foram finalizados com sucesso.');
  }
}
