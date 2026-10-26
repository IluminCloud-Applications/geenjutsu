import { exec, spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { DependencyId, DependencyItem, SystemDiagnosticResult } from '../../types';
import { ANDROID_STEALTH_CONFIG } from '../../shared/androidConfig';

class DependencyEventEmitter extends EventEmitter {}

export class DependencyService {
  private static emitter = new DependencyEventEmitter();

  static on(event: 'log', listener: (log: string) => void) {
    this.emitter.on(event, listener);
  }

  /**
   * Recarrega o PATH do sistema no Windows a partir do Registro e diretórios conhecidos
   * para que novos binários instalados (adb, scrcpy, docker) sejam detectados sem reiniciar o app.
   */
  private static refreshWindowsPath(): void {
    if (process.platform !== 'win32') return;
    try {
      const regMachine = execSync(
        'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path',
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const regUser = execSync(
        'reg query "HKCU\\Environment" /v Path',
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const mMatch = regMachine.match(/REG_\w+\s+(.*)/);
      const uMatch = regUser.match(/REG_\w+\s+(.*)/);
      const machinePath = mMatch ? mMatch[1].trim() : '';
      const userPath = uMatch ? uMatch[1].trim() : '';

      const localAppData = process.env.LOCALAPPDATA || '';
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const knownDirs = [
        path.join(programFiles, 'scrcpy'),
        path.join(programFiles, 'platform-tools'),
        'C:\\ProgramData\\chocolatey\\bin',
        path.join(localAppData, 'Programs', 'scrcpy'),
        path.join(localAppData, 'Android', 'Sdk', 'platform-tools'),
        path.join(localAppData, 'Microsoft', 'WinGet', 'Packages'),
      ].filter(d => fs.existsSync(d));

      const combined = [userPath, machinePath, ...knownDirs, process.env.PATH || ''].filter(Boolean).join(';');
      const unique = Array.from(new Set(combined.split(';'))).filter(Boolean).join(';');
      process.env.PATH = unique;
    } catch {}
  }

  private static execAsync(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      exec(command, {
        timeout: 45000,
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

  static async checkAll(): Promise<SystemDiagnosticResult> {
    const os = process.platform as 'linux' | 'win32' | 'darwin';
    const isWindows = os === 'win32';
    const isLinux = os === 'linux';

    if (isWindows) {
      this.refreshWindowsPath();
    }

    // 0. WSL Check on Windows
    let wslItem: DependencyItem | null = null;
    let wslInstalled = false;
    if (isWindows) {
      const wslCheck = await this.execAsync('wsl --status');
      wslInstalled = wslCheck.code === 0;
      wslItem = {
        id: 'wsl',
        name: 'Subsistema Windows para Linux (WSL2)',
        description: 'Camada de virtualização necessária para executar containers Linux no Windows.',
        status: wslInstalled ? 'ok' : 'missing',
        version: wslInstalled ? 'WSL2 Ativo' : undefined,
        required: true,
        actionLabel: wslInstalled ? undefined : 'Instalar WSL2',
      };
    }

    // 1. Docker check
    const dockerResult = await this.checkDocker();

    // 2. Binder module check
    const binderResult = await this.checkBinder(os);

    // 3. Redroid image check
    const redroidResult = await this.checkRedroidImage();

    // 4. ADB check
    const adbResult = await this.checkAdb();

    // 5. scrcpy check
    const scrcpyResult = await this.checkScrcpy();

    const items: Record<DependencyId, DependencyItem> = {
      docker: dockerResult,
      binder: binderResult,
      redroid: redroidResult,
      adb: adbResult,
      scrcpy: scrcpyResult,
    } as any;

    if (wslItem) {
      items.wsl = wslItem;
    }

    const allOk = Object.values(items).every(item => item.status === 'ok');

    let kernel = '';
    try {
      const uname = await this.execAsync('uname -r');
      kernel = uname.stdout || 'N/A';
    } catch {
      kernel = 'N/A';
    }

    return {
      os,
      platformName: isLinux ? 'Linux Nativo' : isWindows ? 'Windows' : 'macOS',
      kernel,
      allOk,
      isWindows,
      isLinux,
      wslInstalled,
      items,
      lastCheckedAt: Date.now(),
    };
  }

  private static async checkDocker(): Promise<DependencyItem> {
    const item: DependencyItem = {
      id: 'docker',
      name: 'Docker Engine',
      description: 'Runtime de containers para execução dos aparelhos Android.',
      status: 'missing',
      required: true,
      actionLabel: 'Instalar Docker',
    };

    const versionCheck = await this.execAsync('docker --version');
    if (versionCheck.code !== 0) {
      item.status = 'missing';
      item.error = 'Docker não encontrado no sistema.';
      return item;
    }

    const infoCheck = await this.execAsync("docker info --format '{{.ServerVersion}}'");
    if (infoCheck.code === 0 && infoCheck.stdout) {
      item.status = 'ok';
      item.version = infoCheck.stdout;
      item.actionLabel = undefined;
    } else {
      item.status = 'outdated';
      item.version = versionCheck.stdout;
      item.error = 'Daemon do Docker não está rodando ou requer permissão de usuário.';
      item.actionLabel = 'Iniciar Serviço';
    }

    return item;
  }

  private static async checkBinder(os: string): Promise<DependencyItem> {
    const item: DependencyItem = {
      id: 'binder',
      name: 'Módulo Binder (Kernel IPC)',
      description: 'Módulo de comunicação entre processos do Android (binder_linux / binderfs).',
      status: 'missing',
      required: true,
      actionLabel: 'Carregar Módulo',
    };

    if (os === 'linux') {
      let hasBinderfsNode = false;
      try {
        hasBinderfsNode = fs.existsSync('/dev/binderfs/binder') || (fs.existsSync('/dev/binderfs') && fs.readdirSync('/dev/binderfs').length > 0);
      } catch {}
      const hasBinder = fs.existsSync('/dev/binder');
      const lsmod = await this.execAsync('lsmod | grep -i binder');

      if (hasBinder || hasBinderfsNode || lsmod.stdout.includes('binder')) {
        item.status = 'ok';
        item.version = hasBinder ? '/dev/binder' : '/dev/binderfs';
        item.actionLabel = undefined;
      } else {
        const procFs = await this.execAsync('cat /proc/filesystems | grep -w binder');
        if (procFs.code === 0 && procFs.stdout.includes('binder')) {
          item.status = 'outdated';
          item.version = 'Embutido no Kernel';
          item.error = 'Binder nativo no kernel, necessita apenas montar /dev/binderfs.';
          item.actionLabel = 'Montar BinderFS';
        } else {
          item.status = 'missing';
          item.error = 'Módulo binder_linux ou binderfs não ativo.';
          item.actionLabel = 'Ativar Binder';
        }
      }
    } else if (os === 'win32') {
      const wsl = await this.execAsync('wsl --status');
      if (wsl.code === 0) {
        // Valida se a distribuição do WSL possui os nós do Binder disponíveis
        const wslBinder = await this.execAsync('wsl -e sh -c "ls /dev/binder* /dev/binderfs 2>/dev/null"');
        const hasBinder = wslBinder.code === 0 && (wslBinder.stdout.includes('binder') || wslBinder.stdout.includes('binderfs'));
        if (hasBinder) {
          item.status = 'ok';
          item.version = 'WSL2 Binder OK';
          item.actionLabel = undefined;
        } else {
          item.status = 'outdated';
          item.version = 'Requer Kernel Binder';
          item.error = 'WSL2 ativo. Para o Android funcionar, é necessário habilitar o módulo Binder no kernel do WSL2.';
          item.actionLabel = 'Info Binder';
        }
      } else {
        item.status = 'missing';
        item.error = 'Requer WSL2 instalado no Windows (wsl --install).';
        item.actionLabel = 'Instalar WSL2';
      }
    } else {
      item.status = 'outdated';
      item.version = 'macOS VM Runtime';
      item.error = 'Requer ambiente Linux com binder.';
    }

    return item;
  }

  private static async checkRedroidImage(): Promise<DependencyItem> {
    const item: DependencyItem = {
      id: 'redroid',
      name: 'Imagem Android Stealth Anti-Detect (Galaxy S22 5G)',
      description: 'Imagem nativa blindada anti-detect com hardware Samsung e sensores físicos.',
      status: 'missing',
      required: true,
      actionLabel: 'Baixar Imagem',
    };

    // Executa sem pipes de shell para compatibilidade nativa 100% no cmd/powershell do Windows e Linux
    const inspect = await this.execAsync('docker images --format "{{.Repository}}:{{.Tag}}"');
    if (inspect.code === 0 && inspect.stdout) {
      const tags = inspect.stdout.split('\n').map(t => t.trim()).filter(Boolean);
      const matched = tags.find(tag =>
        tag === ANDROID_STEALTH_CONFIG.REMOTE_IMAGE ||
        tag === ANDROID_STEALTH_CONFIG.REMOTE_IMAGE_LATEST ||
        tag === ANDROID_STEALTH_CONFIG.LOCAL_IMAGE ||
        tag.startsWith('redroid/redroid:')
      );
      if (matched) {
        item.status = 'ok';
        item.version = matched;
        item.actionLabel = undefined;
        return item;
      }
    }

    item.status = 'missing';
    item.error = `Imagem Android Stealth (${ANDROID_STEALTH_CONFIG.REMOTE_IMAGE}) não baixada no Docker local.`;
    item.actionLabel = 'Baixar Imagem';

    return item;
  }

  private static async checkAdb(): Promise<DependencyItem> {
    if (process.platform === 'win32') {
      this.refreshWindowsPath();
    }
    const item: DependencyItem = {
      id: 'adb',
      name: 'Android Debug Bridge (ADB)',
      description: 'Conector de comunicação e controle de comandos com o perfil Android.',
      status: 'missing',
      required: true,
      actionLabel: 'Instalar ADB',
    };

    const check = await this.execAsync('adb version');
    if (check.code === 0 && check.stdout) {
      item.status = 'ok';
      const match = check.stdout.match(/version\s+([0-9\.]+)/i);
      item.version = match ? `v${match[1]}` : 'Instalado';
      item.actionLabel = undefined;
    } else {
      item.status = 'missing';
      item.error = 'Binário do ADB não encontrado no PATH do sistema.';
    }

    return item;
  }

  private static async checkScrcpy(): Promise<DependencyItem> {
    if (process.platform === 'win32') {
      this.refreshWindowsPath();
    }
    const item: DependencyItem = {
      id: 'scrcpy',
      name: 'scrcpy (Display & Controle)',
      description: 'Espelhamento da tela e controle de toque/teclado do celular Android.',
      status: 'missing',
      required: true,
      actionLabel: 'Instalar scrcpy',
    };

    const check = await this.execAsync('scrcpy --version');
    if (check.code === 0 && check.stdout) {
      item.status = 'ok';
      const lines = check.stdout.split('\n');
      item.version = lines[0] || 'Instalado';
      item.actionLabel = undefined;
    } else {
      item.status = 'missing';
      item.error = 'scrcpy não instalado.';
      item.actionLabel = 'Instalar scrcpy';
    }

    return item;
  }

  static async runAction(id: DependencyId): Promise<{ success: boolean; log: string }> {
    let command = '';
    const os = process.platform;

    this.emitter.emit('log', `Iniciando ação para dependência: ${id}...`);

    if (id === 'redroid') {
      const dockerCheck = await this.execAsync("docker info --format '{{.ServerVersion}}'");
      if (dockerCheck.code !== 0 || !dockerCheck.stdout) {
        const errorMsg = 'O serviço do Docker não está ativo. Por favor, instale ou inicie o Docker antes de baixar a imagem Android.';
        this.emitter.emit('log', `[ERRO] ${errorMsg}`);
        return { success: false, log: errorMsg };
      }

      const targetImage = ANDROID_STEALTH_CONFIG.REMOTE_IMAGE;
      this.emitter.emit('log', `Baixando imagem Android Stealth Oficial: ${targetImage}...`);
      this.emitter.emit('log', `$ docker pull ${targetImage}`);

      return new Promise((resolve) => {
        const child = spawn('docker', ['pull', targetImage], {
          env: {
            ...process.env,
            ...(process.platform === 'linux' ? { DOCKER_CONTEXT: 'default' } : {}),
          },
        });
        let fullLog = '';

        child.stdout?.on('data', (data) => {
          const text = data.toString();
          fullLog += text;
          const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
          for (const line of lines) {
            this.emitter.emit('log', line);
          }
        });

        child.stderr?.on('data', (data) => {
          const text = data.toString();
          fullLog += text;
          const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
          for (const line of lines) {
            this.emitter.emit('log', line);
          }
        });

        child.on('close', async (code) => {
          const success = code === 0;
          this.emitter.emit('log', success ? 'Download e verificação da imagem concluídos com sucesso!' : `Processo finalizou com código ${code}.`);
          resolve({
            success,
            log: fullLog,
          });
        });

        child.on('error', (err) => {
          const errMsg = `Erro ao executar docker: ${err.message}`;
          this.emitter.emit('log', errMsg);
          resolve({
            success: false,
            log: errMsg,
          });
        });
      });
    }

    if (id === 'wsl') {
      if (os === 'win32') {
        command = 'powershell -Command "Start-Process wsl -ArgumentList \'--install --no-launch\' -Verb RunAs -Wait"';
      }
    } else if (id === 'binder') {
      if (os === 'linux') {
        // - fstab usa "defaults" (o typo "default" faz o mount falhar no boot e o Binder "some" a cada reinício)
        // - chmod apenas nos nós; nunca no diretório /dev/binderfs (666 remove o bit de execução e bloqueia o acesso)
        command = 'pkexec bash -c "mkdir -p /dev/binderfs && (sed -i \'s#^binder /dev/binderfs binder default,nofail#binder /dev/binderfs binder defaults,nofail#\' /etc/fstab || true) && (grep -q \'binder /dev/binderfs\' /etc/fstab || echo \'binder /dev/binderfs binder defaults,nofail 0 0\' >> /etc/fstab) && (mountpoint -q /dev/binderfs || mount /dev/binderfs 2>/dev/null || mount -t binder binder /dev/binderfs 2>/dev/null || true) && (modprobe binder_linux devices=binder,hwbinder,vndbinder 2>/dev/null || true) && chmod 755 /dev/binderfs 2>/dev/null; ([ -e /dev/binderfs/binder ] && ln -sf /dev/binderfs/binder /dev/binder || true) && ([ -e /dev/binderfs/hwbinder ] && ln -sf /dev/binderfs/hwbinder /dev/hwbinder || true) && ([ -e /dev/binderfs/vndbinder ] && ln -sf /dev/binderfs/vndbinder /dev/vndbinder || true) && chmod 666 /dev/binderfs/binder /dev/binderfs/hwbinder /dev/binderfs/vndbinder /dev/binderfs/binder-control 2>/dev/null || true"';
      } else if (os === 'win32') {
        this.emitter.emit('log', '=== Orientação Binder para WSL2 (Windows) ===');
        this.emitter.emit('log', 'O kernel oficial padrão da Microsoft no WSL2 não compila módulos Android Binder.');
        this.emitter.emit('log', 'Para ativar o Binder no Windows: utilize um kernel WSL2 com suporte a Binder (ex: projeto wsl-redroid no GitHub) inserindo "kernel=C:\\\\caminho\\\\bzImage" no arquivo .wslconfig.');
        return { success: true, log: 'Instruções de kernel WSL2 Binder exibidas no terminal.' };
      }
    } else if (id === 'scrcpy') {
      if (os === 'linux') {
        command = 'pkexec bash -c "apt-get update && apt-get install -y scrcpy"';
      } else if (os === 'win32') {
        command = 'winget install Genymobile.scrcpy --accept-source-agreements --accept-package-agreements --disable-interactivity || choco install scrcpy -y';
      }
    } else if (id === 'adb') {
      if (os === 'linux') {
        command = 'pkexec bash -c "apt-get update && apt-get install -y adb"';
      } else if (os === 'win32') {
        command = 'winget install Google.PlatformTools --accept-source-agreements --accept-package-agreements --disable-interactivity || choco install adb -y';
      }
    } else if (id === 'docker') {
      if (os === 'linux') {
        command = 'pkexec bash -c "(which docker >/dev/null || (apt-get update && apt-get install -y docker.io)) && systemctl enable --now docker && (getent group docker || groupadd docker) && usermod -aG docker $USER && chmod 666 /var/run/docker.sock 2>/dev/null || true"';
      } else if (os === 'win32') {
        command = 'powershell -Command "if (Test-Path \'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe\') { Start-Process \'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe\' } else { winget install Docker.DockerDesktop --accept-source-agreements --accept-package-agreements --disable-interactivity }"';
      }
    }

    if (!command) {
      const msg = `Nenhum script automatizado para ${id} na plataforma ${os}.`;
      this.emitter.emit('log', msg);
      return { success: false, log: msg };
    }

    this.emitter.emit('log', `$ ${command}`);
    const result = await this.execAsync(command);
    if (os === 'win32') {
      this.refreshWindowsPath();
    }
    const combinedLog = result.stdout + (result.stderr ? '\n' + result.stderr : '');
    this.emitter.emit('log', combinedLog || (result.code === 0 ? 'Concluído com sucesso.' : 'Falha na execução.'));

    return {
      success: result.code === 0,
      log: combinedLog,
    };
  }
}
