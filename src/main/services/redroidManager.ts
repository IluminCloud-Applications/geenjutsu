import { exec, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';
import { app, net as electronNet } from 'electron';
import os from 'os';
import { SocksClient } from 'socks';
import { Profile } from '../../types';
import { DataStore } from './dataStore';
import { AndroidFingerprintService } from './androidFingerprintService';
import {
  ANDROID_STEALTH_CONFIG,
  generateSamsungMac,
  generateSamsungSerial,
  generateAndroidId,
  generateLuhnImei,
} from '../../shared/androidConfig';

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

  /**
   * Resolve inteligentemente a imagem Android Stealth própria:
   * 1. Imagem no GHCR versão específica tag 1.0 (local ou pull)
   * 2. Imagem no GHCR versão latest
   * 3. Imagem local compilada (geenjutsu/android12-camoufox:latest)
   */
  private static async resolveStealthImage(): Promise<string> {
    const ghcrCheck = await this.execAsync(`docker image inspect ${ANDROID_STEALTH_CONFIG.REMOTE_IMAGE}`);
    if (ghcrCheck.code === 0) {
      return ANDROID_STEALTH_CONFIG.REMOTE_IMAGE;
    }

    const ghcrLatestCheck = await this.execAsync(`docker image inspect ${ANDROID_STEALTH_CONFIG.REMOTE_IMAGE_LATEST}`);
    if (ghcrLatestCheck.code === 0) {
      return ANDROID_STEALTH_CONFIG.REMOTE_IMAGE_LATEST;
    }

    const localCheck = await this.execAsync(`docker image inspect ${ANDROID_STEALTH_CONFIG.LOCAL_IMAGE}`);
    if (localCheck.code === 0) {
      return ANDROID_STEALTH_CONFIG.LOCAL_IMAGE;
    }

    console.log(`[RedroidManager] Baixando imagem Android Stealth do GHCR (${ANDROID_STEALTH_CONFIG.REMOTE_IMAGE})...`);
    const pullResult = await this.execAsync(`docker pull ${ANDROID_STEALTH_CONFIG.REMOTE_IMAGE}`, 300000);
    if (pullResult.code === 0) {
      return ANDROID_STEALTH_CONFIG.REMOTE_IMAGE;
    }

    return ANDROID_STEALTH_CONFIG.LOCAL_IMAGE;
  }

  static async launchProfile(profile: Profile): Promise<{ success: boolean; error?: string; adbPort?: number }> {
    const profileId = profile.id;
    try {
      this.emitter.emit('status_changed', { profileId, status: 'launching' });

      const containerName = `geenjutsu-android-${profileId}`;
      const volumeName = `geenjutsu-android-data-${profileId}`;

      // Calcula ou atribui a porta ADB isolada para este perfil
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

      // Se já existe um container para esse perfil, remove o container existente para recriar
      // com as flags e portas atualizadas (o volume nomeado /data persiste 100% dos apps e dados)
      const inspectCheck = await this.execAsync(`docker inspect ${containerName}`);
      if (inspectCheck.code === 0) {
        await this.execAsync(`docker rm -f ${containerName}`);
      }

      const stealthImage = await this.resolveStealthImage();
      const width = profile.width || ANDROID_STEALTH_CONFIG.DEVICE.width;
      const height = profile.height || ANDROID_STEALTH_CONFIG.DEVICE.height;
      const dpi = profile.dpi || ANDROID_STEALTH_CONFIG.DEVICE.dpi;

      // Garante MAC Address autêntico Samsung exclusivo e determinístico por perfil
      let macAddress = profile.macAddress;
      if (!macAddress) {
        macAddress = generateSamsungMac(profileId);
        profile.macAddress = macAddress;
      }

      // Garante Serial Number oficial Samsung exclusivo por perfil
      let serialNumber = (profile as any).serialNumber || profile.device?.serialNumber;
      if (!serialNumber) {
        serialNumber = generateSamsungSerial(profileId);
        (profile as any).serialNumber = serialNumber;
      }

      // Garante Android ID único por perfil
      let androidId = profile.androidId;
      if (!androidId) {
        androidId = generateAndroidId(profileId);
        profile.androidId = androidId;
      }

      // Garante IMEI único com algoritmo Luhn por perfil
      let imei = (profile as any).imei || profile.device?.imei;
      if (!imei) {
        imei = generateLuhnImei('35407215');
        (profile as any).imei = imei;
      }

      // Sincroniza identificadores gerados no DataStore
      try {
        const storeData = DataStore.read();
        const updated = (storeData.profiles || []).map((p: any) =>
          p.id === profile.id
            ? { ...p, macAddress, serialNumber, androidId, imei }
            : p
        );
        DataStore.write({ profiles: updated });
      } catch {}

      // Configuração de GPU do host (utiliza aceleração nativa via render node do host)
      const gpuArgs = this.getGpuArgs();

      // Configuração de proxy transparente (secnetd) e de sistema
      const proxyBootArgs: string[] = [];
      if (proxyForwarder) {
        proxyBootArgs.push(
          'androidboot.redroid_net_proxy_type=static',
          'androidboot.redroid_net_proxy_host=172.17.0.1',
          `androidboot.redroid_net_proxy_port=${proxyForwarder.port}`,
          `androidboot.proxy_url=http://172.17.0.1:${proxyForwarder.port}`
        );
      } else if (hasProxy && proxyConfig) {
        const host = proxyConfig.host || (proxyConfig.ipDisplay ? proxyConfig.ipDisplay.split(':')[0] : '');
        const port = proxyConfig.port || (proxyConfig.ipDisplay ? proxyConfig.ipDisplay.split(':')[1] : '1080');
        const userPass = proxyConfig.username ? `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password || '')}@` : '';
        const proto = (proxyConfig.type || 'socks5').toLowerCase();
        proxyBootArgs.push(`androidboot.proxy_url=${proto}://${userPass}${host}:${port}`);
      }

      const timezone = this.resolveTimezone(profile);

      // Identidade única injetada no container (recebida pelo device_init early)
      const customBootArgs = [
        `androidboot.custom_serial=${serialNumber}`,
        `androidboot.custom_android_id=${androidId}`,
        `androidboot.custom_imei=${imei}`,
        `androidboot.custom_timezone=${timezone}`,
      ];

      const driFlag = fs.existsSync('/dev/dri') ? '--device /dev/dri:/dev/dri' : '';

      const dockerCmd = [
        'docker run -d',
        `--name ${containerName}`,
        '--privileged',
        this.getDockerBinderFlags(),
        driFlag,
        `-v ${volumeName}:/data`,
        `-p ${adbPort}:5555`,
        `--mac-address ${macAddress}`,
        '--shm-size=1g',
        stealthImage,
        `androidboot.redroid_width=${width}`,
        `androidboot.redroid_height=${height}`,
        `androidboot.redroid_dpi=${dpi}`,
        'androidboot.redroid_fps=60',
        'ro.adb.secure=0',
        ...gpuArgs,
        ...proxyBootArgs,
        ...customBootArgs,
      ].filter(Boolean).join(' ');

      console.log(`[RedroidManager] Iniciando container Android Stealth para "${profile.name}" (Imagem: ${stealthImage})...`);
      const runResult = await this.execAsync(dockerCmd);
      if (runResult.code !== 0) {
        const errMsg = runResult.stderr || runResult.stdout || 'Falha ao iniciar container Android Stealth';
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
      this.emitter.emit('status_changed', { profileId, status: 'launching' });

      // Inicialização assíncrona ultra-rápida (3 a 5 segundos)
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
    const startedAt = Date.now();
    let booted = false;

    // 1. Aguarda sys.boot_completed=1 (com a imagem stealth agora leva apenas de 3 a 5 segundos)
    while (Date.now() - startedAt < 35000) {
      const { stdout: psCheck } = await this.execAsync(
        `docker ps --filter "name=${info.containerId}" --format "{{.ID}}"`,
        3000
      );
      if (!psCheck) {
        console.error(`[RedroidManager] Container ${info.containerId} encerrou inesperadamente.`);
        await this.cleanupFailedLaunch(profile.id, info);
        return;
      }

      const check = await this.execAsync(`docker exec ${info.containerId} getprop sys.boot_completed`, 2000);
      if (check.stdout.trim() === '1') {
        booted = true;
        break;
      }
      await new Promise(r => setTimeout(r, 400));
    }

    if (!booted) {
      console.error(`[RedroidManager] Android timeout no boot para ${profile.name}`);
      await this.cleanupFailedLaunch(profile.id, info);
      return;
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[RedroidManager] Boot do Android Stealth concluído em ${elapsed}s para ${profile.name}!`);

    // 2. Garante adbd ativo e injeta a chave de autenticação ADB do host (evita status offline/unauthorized)
    await this.execAsync(
      `docker exec ${info.containerId} sh -c "` +
      `settings put global adb_enabled 1 2>/dev/null; ` +
      `setprop persist.sys.usb.config adb; ` +
      `setprop sys.usb.config adb; ` +
      `setprop ctl.start adbd; ` +
      `true"`,
      5000
    );

    const hostAdbKey = path.join(os.homedir(), '.android', 'adbkey.pub');
    if (fs.existsSync(hostAdbKey)) {
      try {
        await this.execAsync(`docker exec ${info.containerId} mkdir -p /data/misc/adb`, 3000);
        await this.execAsync(`docker cp "${hostAdbKey}" ${info.containerId}:/data/misc/adb/adb_keys`, 3000);
        await this.execAsync(
          `docker exec ${info.containerId} sh -c "chmod 644 /data/misc/adb/adb_keys 2>/dev/null; chown system:shell /data/misc/adb/adb_keys 2>/dev/null; true"`,
          3000
        );
      } catch {}
    }

    // 3. Conecta ADB via IPv4 127.0.0.1 e aguarda estado estritamente 'device'
    let adbReady = false;
    for (let i = 0; i < 20; i++) {
      await this.execAsync(`adb connect 127.0.0.1:${adbPort}`, 3000);
      const stateCheck = await this.execAsync(`adb -s 127.0.0.1:${adbPort} get-state`, 2000);
      const state = stateCheck.stdout.trim();
      if (state === 'device') {
        adbReady = true;
        break;
      }
      if (state === 'offline' || state === 'unauthorized') {
        await this.execAsync(`adb disconnect 127.0.0.1:${adbPort}`, 1000);
        await this.execAsync(
          `docker exec ${info.containerId} sh -c "settings put global adb_enabled 1 2>/dev/null; setprop ctl.restart adbd; true"`,
          2000
        );
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!adbReady) {
      console.warn(`[RedroidManager] Tentativa final de redefinição de ADB para ${profile.name}...`);
      await this.execAsync(`adb disconnect 127.0.0.1:${adbPort}`, 1000);
      await this.execAsync(`docker exec ${info.containerId} setprop ctl.restart adbd`, 2000);
      await new Promise(r => setTimeout(r, 1000));
      await this.execAsync(`adb connect 127.0.0.1:${adbPort}`, 3000);
    }

    // 4. Fuso horário sincronizado
    const timezone = this.resolveTimezone(profile);
    await this.execAsync(`docker exec ${info.containerId} service call alarm 3 s16 ${timezone}`, 3000);

    // 5. Proxy de sistema sincronizado e proteção contra WebRTC STUN Leak
    const proxyValue = info.proxyForwarder ? `172.17.0.1:${info.proxyForwarder.port}` : ':0';
    await this.execAsync(`docker exec ${info.containerId} settings put global http_proxy ${proxyValue}`, 3000);
    if (info.proxyForwarder) {
      await this.applyWebRtcLeakProtection(info.containerId);
    }

    // 6. Garante android_id sincronizado
    await this.ensurePersistentAndroidId(profile, info.containerId);

    // 6.1 Injeta blindagem anti-detect única e persistente (Canvas, WebGL, WebGL Report, Visitor ID)
    await AndroidFingerprintService.injectStealthScript(info.containerId, profile);

    // 7. Aguarda o DisplayManager ter o display padrão (mDisplayId=0) pronto
    for (let i = 0; i < 20; i++) {
      const dispCheck = await this.execAsync(`adb -s 127.0.0.1:${adbPort} shell dumpsys display`, 2000);
      if (dispCheck.stdout.includes('mDisplayId=0')) break;
      await new Promise(r => setTimeout(r, 300));
    }

    // 8. Garante confirmação final de conectividade ADB antes de abrir scrcpy
    for (let i = 0; i < 5; i++) {
      const finalState = await this.execAsync(`adb -s 127.0.0.1:${adbPort} get-state`, 2000);
      if (finalState.stdout.trim() === 'device') break;
      await this.execAsync(`adb disconnect 127.0.0.1:${adbPort}`, 1000);
      await this.execAsync(`adb connect 127.0.0.1:${adbPort}`, 3000);
      await new Promise(r => setTimeout(r, 500));
    }

    this.emitter.emit('status_changed', { profileId: profile.id, status: 'running' });
    await this.spawnScrcpy(profile, adbPort, info);
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
        return currentId;
      }
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao persistir android_id:', err);
    }
    return '';
  }

  /**
   * Usa a GPU do host via Mesa quando disponível (AMD / Intel), garantindo fluidez e aceleração máxima de 60 FPS.
   * O nome da placa do PC é 100% mascarado (reportando Samsung Xclipse 920 nativo na imagem).
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
    return ['androidboot.redroid_gpu_mode=auto'];
  }

  private static async applyWebRtcLeakProtection(containerId: string): Promise<void> {
    try {
      console.log(`[RedroidManager] Aplicando blindagem contra WebRTC STUN Leak no container ${containerId}...`);

      // 1. Configura diretiva de privacidade anti-leak para Chromium e Android System WebView
      await this.execAsync(
        `docker exec ${containerId} sh -c "` +
        `mkdir -p /data/local/tmp /data/data/com.android.webview 2>/dev/null; ` +
        `echo '--webrtc-ip-handling-policy=disable_non_proxied_udp' > /data/local/tmp/webview-command-line; ` +
        `echo '--webrtc-ip-handling-policy=disable_non_proxied_udp' > /data/local/tmp/chrome-command-line; ` +
        `chmod 666 /data/local/tmp/*-command-line 2>/dev/null; true"`
      );

      // 2. Regra de Firewall Iptables nativa no container: bloqueia tráfego UDP STUN direto
      await this.execAsync(
        `docker exec ${containerId} sh -c "` +
        `iptables -C OUTPUT -p udp --dport 3478 -j REJECT 2>/dev/null || iptables -I OUTPUT -p udp --dport 3478 -j REJECT; ` +
        `iptables -C OUTPUT -p udp --dport 19302 -j REJECT 2>/dev/null || iptables -I OUTPUT -p udp --dport 19302 -j REJECT; ` +
        `iptables -C OUTPUT -p udp --dport 5349 -j REJECT 2>/dev/null || iptables -I OUTPUT -p udp --dport 5349 -j REJECT; ` +
        `true"`
      );
      console.log(`[RedroidManager] WebRTC STUN Leak Protection ativa com sucesso no container ${containerId}.`);
    } catch (err) {
      console.warn('[RedroidManager] Aviso ao aplicar proteção WebRTC leak:', err);
    }
  }

  private static async spawnScrcpy(
    profile: Profile,
    adbPort: number,
    info?: RunningContainerInfo
  ): Promise<{ success: boolean; error?: string }> {
    if (info?.scrcpyProcess && !info.scrcpyProcess.killed) {
      console.log(`[RedroidManager] Display scrcpy já está aberto para "${profile.name}".`);
      return { success: true };
    }

    const isWin = process.platform === 'win32';
    const scrcpyCmd = isWin ? 'where scrcpy' : 'which scrcpy';
    const scrcpyCheck = await this.execAsync(scrcpyCmd);
    if (scrcpyCheck.code !== 0) {
      console.warn('[RedroidManager] scrcpy não encontrado no PATH do sistema.');
      return { success: false, error: 'scrcpy não instalado no sistema. Instale nas dependências do Android.' };
    }

    try {
      console.log(`[RedroidManager] Abrindo display scrcpy para "${profile.name}" (porta: ${adbPort})...`);
      const scrcpyArgs = [
        '-s', `127.0.0.1:${adbPort}`,
        `--window-title=Geenjutsu — ${profile.name}`,
        '--stay-awake',
        '-m', '1920',
        '--max-fps', '60',
      ];

      const scrcpy = spawn('scrcpy', scrcpyArgs, {
        detached: true,
        env: {
          ...process.env,
          ...(isWin
            ? {}
            : {
                DISPLAY: process.env.DISPLAY || ':1',
                WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || 'wayland-1',
                XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.() || 1000}`,
              }),
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

    await this.execAsync(`adb connect 127.0.0.1:${adbPort}`);
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

    await this.execAsync(`adb connect 127.0.0.1:${adbPort}`);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.apk') {
      console.log(`[RedroidManager] Instalando APK em 127.0.0.1:${adbPort}: ${filePath}`);
      let res = await this.execAsync(`adb -s 127.0.0.1:${adbPort} install -r -d -g -i com.android.vending --abi arm64-v8a "${filePath}"`, 180000);
      if (res.stdout.includes('Success')) {
        return { success: true, message: 'APK instalado com sucesso no Android!' };
      }
      console.warn(`[RedroidManager] Tentando instalação padrão do APK...`);
      res = await this.execAsync(`adb -s 127.0.0.1:${adbPort} install -r -d -g -i com.android.vending "${filePath}"`, 180000);
      if (res.stdout.includes('Success')) {
        return { success: true, message: 'APK instalado com sucesso no Android!' };
      }
      return { success: false, error: res.stderr || res.stdout || 'Falha ao instalar APK' };
    }

    if (ext === '.xapk') {
      console.log(`[RedroidManager] Processando XAPK em 127.0.0.1:${adbPort}: ${filePath}`);
      const tmpDir = path.join('/tmp', `geenjutsu-xapk-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      try {
        const unzipRes = await this.execAsync(`unzip -q -o "${filePath}" -d "${tmpDir}"`, 60000);
        if (unzipRes.code !== 0) {
          return { success: false, error: 'Falha ao descompactar pacote XAPK.' };
        }

        const obbDir = path.join(tmpDir, 'Android', 'obb');
        if (fs.existsSync(obbDir)) {
          console.log(`[RedroidManager] Enviando dados OBB para o Android...`);
          await this.execAsync(`adb -s 127.0.0.1:${adbPort} push "${obbDir}/." /sdcard/Android/obb/`, 120000);
        }

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
          let res = await this.execAsync(`adb -s 127.0.0.1:${adbPort} install -r -d -g -i com.android.vending --abi arm64-v8a "${apks[0]}"`, 180000);
          if (res.stdout.includes('Success')) {
            return { success: true, message: 'XAPK instalado com sucesso no Android!' };
          }
          res = await this.execAsync(`adb -s 127.0.0.1:${adbPort} install -r -d -g -i com.android.vending "${apks[0]}"`, 180000);
          if (res.stdout.includes('Success')) {
            return { success: true, message: 'XAPK instalado com sucesso no Android!' };
          }
          return { success: false, error: res.stderr || res.stdout || 'Falha ao instalar APK do pacote XAPK.' };
        }

        const apkArgs = apks.map(a => `"${a}"`).join(' ');
        let res = await this.execAsync(`adb -s 127.0.0.1:${adbPort} install-multiple -r -d -g -i com.android.vending --abi arm64-v8a ${apkArgs}`, 180000);
        if (res.stdout.includes('Success')) {
          return { success: true, message: 'XAPK (Split APKs) instalado com sucesso no Android!' };
        }
        res = await this.execAsync(`adb -s 127.0.0.1:${adbPort} install-multiple -r -d -g -i com.android.vending ${apkArgs}`, 180000);
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
      await this.execAsync(`adb connect 127.0.0.1:${adbPort}`);

      if (packageName) {
        await this.execAsync(`adb -s 127.0.0.1:${adbPort} shell am start -a android.intent.action.VIEW -d "market://details?id=${packageName}"`);
      } else {
        await this.execAsync(`adb -s 127.0.0.1:${adbPort} shell monkey -p com.aurora.store 1`);
      }

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

      server.on('clientError', (_err, socket) => {
        try {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
          socket.destroy();
        } catch {}
      });

      server.on('connect', (clientReq, clientSocket, head) => {
        const parts = (clientReq.url || '').split(':');
        const targetHost = parts[0];
        const targetPort = parseInt(parts[1] || '443', 10);

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

    const runningIds = Array.from(this.runningProfiles.keys());
    await Promise.allSettled(runningIds.map(id => this.stopProfile(id)));

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

    try {
      await this.execAsync('adb disconnect', 4000);
    } catch {}

    console.log('[RedroidManager] Todos os emuladores Android foram finalizados com sucesso.');
  }
}
