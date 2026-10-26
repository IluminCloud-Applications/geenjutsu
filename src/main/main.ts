import { app, BrowserWindow, Menu, session, shell, ipcMain, nativeImage, NativeImage, Tray, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CamoufoxManager, ProfileProxyConfig } from './services/camoufoxManager';
import { CamoufoxInstallerService } from './services/camoufoxInstallerService';
import { RedroidManager } from './services/redroidManager';
import { DependencyService } from './services/dependencyService';
import { DataStore } from './services/dataStore';
import { WarmupEngine } from './services/warmupEngine';
import { WarmupScheduler } from './services/warmupScheduler';
import { AutomationEngine } from './services/automationEngine';
import { ProxyChecker } from './services/proxyChecker';
import { TableStore } from './services/tableStore';
import { IntegrationStore } from './services/integrationStore';
import { ProxySellerService } from './services/proxySellerService';


process.env.NODE_NO_WARNINGS = '1';
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-logging');

// Evita que resets normais de conexões TCP de proxy (ECONNRESET/EPIPE) abram pop-ups de erro no Electron
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.code === 'ETIMEDOUT') {
    return;
  }
  console.error('[Main] Uncaught Exception:', err);
});

app.setName('Geenjutsu');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.geenjutsu.app');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function getPreloadPath(): string {
  const possiblePaths = [
    path.join(__dirname, 'preload.cjs'),
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, 'preload.mjs'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, 'preload.cjs');
}

function getAppIconPath(): string {
  const isWin = process.platform === 'win32';
  const preferredExts = isWin ? ['.ico', '.png'] : ['.png', '.ico'];

  const baseDirs = [
    path.join(__dirname, '../public'),
    path.join(__dirname, '../dist'),
    path.join(app.getAppPath(), 'public'),
    path.join(app.getAppPath(), 'dist'),
    path.join(process.resourcesPath || '', 'public'),
    path.join(process.resourcesPath || '', 'icon'),
    path.join(process.resourcesPath || ''),
    process.cwd(),
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'dist'),
  ];

  for (const ext of preferredExts) {
    for (const dir of baseDirs) {
      const candidates = [
        path.join(dir, `icon/icon_app${ext}`),
        path.join(dir, `icon_app${ext}`),
        path.join(dir, `icon/icon${ext}`),
        path.join(dir, `icon${ext}`),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          return c;
        }
      }
    }
  }

  return path.join(__dirname, '../public/icon/icon_app.png');
}

function getTrayIcon(): NativeImage {
  const iconPath = getAppIconPath();
  const img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (img.isEmpty()) {
    return img;
  }
  if (process.platform === 'win32') {
    return img.resize({ width: 16, height: 16 });
  } else if (process.platform === 'darwin') {
    const resized = img.resize({ width: 18, height: 18 });
    resized.setTemplateImage(true);
    return resized;
  } else {
    return img.resize({ width: 22, height: 22 });
  }
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

async function quitApplication(): Promise<void> {
  if (isQuitting) return;
  isQuitting = true;
  WarmupScheduler.stop();
  WarmupEngine.stopAll();

  try {
    console.log('[Main] Encerrando navegadores Camoufox...');
    await CamoufoxManager.closeAllBrowsers();
  } catch (err) {
    console.warn('[Main] Erro ao fechar navegadores:', err);
  }

  try {
    console.log('[Main] Encerrando emuladores Android (containers Redroid, scrcpy e ADB)...');
    await RedroidManager.closeAll();
  } catch (err) {
    console.warn('[Main] Erro ao fechar emuladores Android:', err);
  }

  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy();
      tray = null;
    } catch {}
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
    mainWindow = null;
  }
  app.quit();
}

function setupTray(): void {
  if (tray) return;

  try {
    const trayImg = getTrayIcon();
    tray = new Tray(!trayImg.isEmpty() ? trayImg : getAppIconPath());
    tray.setToolTip('Geenjutsu');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Geenjutsu',
        click: () => {
          showMainWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'Fechar completamente',
        click: () => {
          quitApplication();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      showMainWindow();
    });

    tray.on('double-click', () => {
      showMainWindow();
    });
  } catch (err) {
    console.warn('[Main] Falha ao configurar Tray:', err);
  }
}

function createWindow(): void {
  const preloadPath = getPreloadPath();
  const iconPath = getAppIconPath();
  const appIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

  mainWindow = new BrowserWindow({
    title: 'Geenjutsu',
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#13141a',
    show: false,
    frame: false,
    icon: !appIcon.isEmpty() ? appIcon : iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!appIcon.isEmpty()) {
    try {
      mainWindow.setIcon(appIcon);
    } catch (err) {
      console.warn('[Main] Falha ao definir mainWindow icon:', err);
    }
  }

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    const data = DataStore.read();
    const closeAction = data.settings?.closeAction || 'ask';

    if (closeAction === 'background') {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    if (closeAction === 'quit') {
      event.preventDefault();
      quitApplication();
      return;
    }

    // Default: 'ask'
    event.preventDefault();
    if (!mainWindow?.isVisible()) {
      mainWindow?.show();
    }
    mainWindow?.focus();
    mainWindow?.webContents.send('app:request-close');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function normalizeProxy(proxyInput: any): ProfileProxyConfig | undefined {
  if (!proxyInput || proxyInput.type === 'direct') return undefined;

  let host = proxyInput.host || '';
  let port = proxyInput.port || '';
  let username = proxyInput.username || '';
  let password = proxyInput.password || '';

  if (!host && proxyInput.ipDisplay) {
    const raw = String(proxyInput.ipDisplay).trim().replace(/^[a-z0-9]+:\/\//i, '');
    const parts = raw.split(':');
    if (parts.length >= 2) {
      host = parts[0];
      port = parts[1];
      if (parts[2]) username = parts[2];
      if (parts[3]) password = parts.slice(3).join(':');
    }
  }

  const portNum = parseInt(String(port).trim(), 10);
  if (!host.trim() || isNaN(portNum) || portNum <= 0) return undefined;

  const rawType = (proxyInput.type || 'socks5').toLowerCase();
  const validProto: 'socks5' | 'socks4' | 'http' | 'https' =
    rawType === 'http' || rawType === 'https' || rawType === 'socks4' ? rawType : 'socks5';

  return {
    type: validProto,
    host: host.trim(),
    port: portNum,
    username: username.trim() || undefined,
    password: password.trim() || undefined,
  };
}

function resolvePlatformUrl(platform?: string): string {
  switch (platform) {
    case 'facebook':
      return 'https://www.facebook.com/';
    case 'tiktok':
      return 'https://www.tiktok.com/';
    case 'google':
      return 'https://www.google.com/';
    case 'amazon':
      return 'https://www.amazon.com/';
    default:
      return 'https://www.google.com/';
  }
}

app.whenReady().then(() => {
  // Set macOS dock icon
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = getAppIconPath();
    if (fs.existsSync(iconPath)) {
      try {
        const dockImg = nativeImage.createFromPath(iconPath);
        app.dock.setIcon(!dockImg.isEmpty() ? dockImg : iconPath);
      } catch (err) {
        console.warn('[Main] Falha ao definir dock icon:', err);
      }
    }
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    callback({ cancel: false, responseHeaders });
  });

  // Setup CamoufoxManager & RedroidManager event broadcasting to renderer
  const broadcastProfileStatus = (payload: any) => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('profile:status-changed', payload);
      }
    }
  };

  CamoufoxManager.on('status_changed', broadcastProfileStatus);
  RedroidManager.on('status_changed', broadcastProfileStatus);

  DependencyService.on('log', (log) => {
    mainWindow?.webContents.send('android:install-log', log);
  });

  CamoufoxManager.on('cookies_updated', (payload) => {
    mainWindow?.webContents.send('profile:cookies-updated', payload);
  });

  // Setup WarmupEngine event broadcasting to renderer
  WarmupEngine.on('progress', (data) => {
    mainWindow?.webContents.send('profile:warmup-progress', data);
  });

  WarmupEngine.on('finished', (data) => {
    mainWindow?.webContents.send('profile:warmup-finished', data);
  });

  WarmupEngine.on('queue_updated', (data) => {
    mainWindow?.webContents.send('profile:warmup-queue-changed', data);
  });

  // Setup AutomationEngine event broadcasting to renderer
  AutomationEngine.on('state', (state) => {
    mainWindow?.webContents.send('automation:state-changed', state);
  });

  AutomationEngine.on('log', (payload) => {
    mainWindow?.webContents.send('automation:log', payload);
  });

  AutomationEngine.on('finished', (data) => {
    mainWindow?.webContents.send('automation:finished', data);
  });


  // Window Controls IPC
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.on('window:minimize-to-tray', () => {
    mainWindow?.hide();
  });

  ipcMain.on('app:quit', () => {
    quitApplication();
  });

  ipcMain.handle('settings:get-close-action', () => {
    const data = DataStore.read();
    return data.settings?.closeAction || 'ask';
  });

  ipcMain.handle('settings:set-close-action', (_, action: 'ask' | 'quit' | 'background') => {
    const data = DataStore.read();
    const settings = { ...data.settings, closeAction: action };
    DataStore.write({ settings });
    return true;
  });

  ipcMain.handle('settings:get-onboarding-completed', () => {
    const data = DataStore.read();
    if (data.settings?.onboardingCompleted) {
      return true;
    }
    const hasExistingData = (Array.isArray(data.profiles) && data.profiles.length > 0) ||
      (Array.isArray(data.automations) && data.automations.length > 0) ||
      (Array.isArray(data.proxies) && data.proxies.length > 0);

    if (hasExistingData) {
      const settings = { ...data.settings, onboardingCompleted: true };
      DataStore.write({ settings });
      return true;
    }
    return false;
  });

  ipcMain.handle('settings:set-onboarding-completed', (_, completed: boolean) => {
    const data = DataStore.read();
    const settings = { ...data.settings, onboardingCompleted: completed };
    DataStore.write({ settings });
    return true;
  });

  ipcMain.handle('app:open-external', async (_, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  // Profile Operations IPC (Camoufox Browser & Redroid Android)
  ipcMain.handle('profiles:launch', async (_, profileData: any, options?: any) => {
    try {
      if (!profileData || !profileData.id) {
        return { success: false, error: 'ID do perfil não informado' };
      }

      // Check if this is an Android Emulator profile
      if (profileData.runtime === 'android') {
        console.log(`[Main] Solicitando lançamento do perfil Android: "${profileData.name}" (ID: ${profileData.id})`);
        const result = await RedroidManager.launchProfile(profileData);
        if (!result.success) {
          console.error(`[Main] Erro ao iniciar perfil Android "${profileData.name}":`, result.error);
        } else {
          console.log(`[Main] Perfil Android "${profileData.name}" lançado com sucesso na porta ADB: ${result.adbPort}`);
        }
        return result;
      }

      if (WarmupEngine.isQueued(profileData.id)) {
        console.log(`[Main] Perfil "${profileData.name}" estava na fila de aquecimento. Removendo da fila para abrir navegador do usuário.`);
        WarmupEngine.removeFromQueue(profileData.id);
      }

      if (WarmupEngine.getStatus(profileData.id)?.isRunning) {
        console.log(`[Main] Perfil "${profileData.name}" está em aquecimento. Interrompendo aquecimento para abrir navegador do usuário...`);
        WarmupEngine.stopWarmup(profileData.id);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      // Check if Camoufox browser engine is installed
      const camoufoxStatus = await CamoufoxInstallerService.checkStatus();
      if (!camoufoxStatus.installed) {
        return {
          success: false,
          error: 'O motor do navegador Camoufox Anti-Detect ainda não está instalado.',
          needsInstall: true,
        };
      }

      const osMap: Record<string, 'windows' | 'macos' | 'linux'> = {
        mac: 'macos',
        macos: 'macos',
        windows: 'windows',
        linux: 'linux',
      };
      const osTarget = osMap[profileData.os] || 'windows';
      const proxy = normalizeProxy(profileData.proxy);
      const initialUrl = resolvePlatformUrl(profileData.platform);
      const economyMode = Boolean(profileData.economyMode || options?.economyMode);

      const res = await CamoufoxManager.openBrowser({
        profileId: profileData.id,
        profileName: profileData.name || 'Perfil',
        initialUrl,
        platform: profileData.platform || 'general',
        osTarget,
        proxy,
        cookies: profileData.cookies || [],
        fingerprint: profileData.fingerprint,
        headless: false,
        economyMode,
      });

      return res;
    } catch (err: any) {
      console.error('[Main] Erro ao lançar perfil:', err);
      return { success: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('profiles:stop', async (_, profileId: string) => {
    try {
      if (!profileId) return { success: false };

      if (RedroidManager.isInstanceRunning(profileId)) {
        return await RedroidManager.stopProfile(profileId);
      }

      await CamoufoxManager.closeBrowser(profileId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  ipcMain.handle('profiles:get-running', async () => {
    const browserIds = CamoufoxManager.getRunningProfileIds();
    const androidIds = await RedroidManager.getRunningProfileIds();
    return Array.from(new Set([...browserIds, ...androidIds]));
  });

  // Camoufox Engine Operations & Auto-Installer
  ipcMain.handle('camoufox:check-status', async () => {
    return await CamoufoxInstallerService.checkStatus();
  });

  ipcMain.handle('camoufox:install', async (event) => {
    return await CamoufoxInstallerService.install((progress) => {
      try {
        event.sender.send('camoufox:install-progress', progress);
      } catch {}
    });
  });

  ipcMain.handle('camoufox:cancel-install', () => {
    CamoufoxInstallerService.cancel();
    return { success: true };
  });

  // Android Specific IPC
  ipcMain.handle('android:check-dependencies', async () => {
    return await DependencyService.checkAll();
  });

  ipcMain.handle('android:install-dependency', async (_, id: any) => {
    return await DependencyService.runAction(id);
  });

  ipcMain.handle('android:open-screen', async (_, profileId: string) => {
    const data = DataStore.read();
    const target = (data.profiles || []).find((p: any) => p.id === profileId);
    if (!target) {
      return { success: false, error: 'Perfil não encontrado' };
    }
    return await RedroidManager.openScreen(target);
  });

  ipcMain.handle('android:install-package', async (_, profileId: string) => {
    try {
      if (!mainWindow) {
        return { success: false, error: 'Janela principal não disponível' };
      }
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Selecione o arquivo APK ou XAPK para instalar',
        buttonLabel: 'Instalar no Android',
        filters: [
          { name: 'Pacotes Android (*.apk, *.xapk)', extensions: ['apk', 'xapk'] },
          { name: 'Todos os arquivos', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      return await RedroidManager.installAppPackage(profileId, filePaths[0]);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao selecionar ou instalar aplicativo' };
    }
  });

  ipcMain.handle('android:download-and-install-package', async (_, { profileId, downloadUrl, appName }: { profileId: string; downloadUrl: string; appName: string }) => {
    try {
      return await RedroidManager.downloadAndInstallApp(profileId, downloadUrl, appName, (progressData) => {
        mainWindow?.webContents.send('android:install-progress', {
          profileId,
          appName,
          ...progressData,
        });
      });
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro durante download ou instalação' };
    }
  });

  ipcMain.handle('android:open-app-store', async (_, { profileId, packageName }: { profileId: string; packageName?: string }) => {
    try {
      return await RedroidManager.openAppInStore(profileId, packageName);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao abrir Aurora Store' };
    }
  });

  ipcMain.handle('profiles:inject-cookies', async (_, { profileId, cookies }: { profileId: string; cookies: any[] }) => {
    try {
      return await CamoufoxManager.injectCookies(profileId, cookies);
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  });

  ipcMain.handle('profiles:get-hardware', async (_, { profileId, os, fingerprint }: { profileId: string; os?: string; fingerprint?: any }) => {
    try {
      if (!profileId) return null;
      const osMap: Record<string, 'windows' | 'macos' | 'linux'> = {
        mac: 'macos',
        macos: 'macos',
        windows: 'windows',
        linux: 'linux',
      };
      const osTarget = osMap[os || 'windows'] || 'windows';
      return await CamoufoxManager.getOrCreateHardwareProfile(profileId, osTarget, fingerprint);
    } catch (err: any) {
      console.error('[Main] Erro ao obter hardware do perfil:', err);
      return null;
    }
  });

  ipcMain.handle('profiles:save-hardware', async (_, { profileId, hardwareConfig }: { profileId: string; hardwareConfig: any }) => {
    try {
      if (!profileId || !hardwareConfig) return false;
      return CamoufoxManager.saveHardwareConfig(profileId, hardwareConfig);
    } catch (err: any) {
      console.error('[Main] Erro ao salvar hardware do perfil:', err);
      return false;
    }
  });

  // Data Store IPC (Persistence)
  ipcMain.on('store:get-initial-data-sync', (event) => {
    event.returnValue = DataStore.read();
  });

  ipcMain.handle('profiles:get-all', () => {
    return DataStore.read().profiles;
  });

  ipcMain.handle('profiles:save-all', (_, profiles: any[]) => {
    DataStore.write({ profiles });
    return true;
  });

  ipcMain.handle('folders:get-all', () => {
    return DataStore.read().folders;
  });

  ipcMain.handle('folders:save-all', (_, folders: any[]) => {
    DataStore.write({ folders });
    return true;
  });

  ipcMain.handle('proxies:get-all', () => {
    return DataStore.read().proxies;
  });

  ipcMain.handle('proxies:save-all', (_, proxies: any[]) => {
    DataStore.write({ proxies });
    return true;
  });

  ipcMain.handle('proxies:test', async (_, proxyConfig: any) => {
    try {
      return await ProxyChecker.testProxy(proxyConfig);
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao testar proxy' };
    }
  });

  ipcMain.handle('proxies:lookup-ip', async (_, ip: string) => {
    return await ProxyChecker.lookupIp(ip);
  });

  // Automations IPC (Persistence & Execution)
  ipcMain.handle('automations:get-all', () => {
    return DataStore.read().automations || [];
  });

  ipcMain.handle('automations:save-all', (_, automations: any[]) => {
    DataStore.write({ automations });
    return true;
  });

  ipcMain.handle('automations:run', async (_, { automationId, profileId, customCode }: { automationId: string; profileId: string; customCode?: string }) => {
    try {
      return await AutomationEngine.runAutomation(automationId, profileId, customCode);
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  });

  ipcMain.handle('automations:stop', (_, automationId: string) => {
    return AutomationEngine.stopAutomation(automationId);
  });

  ipcMain.handle('automations:get-state', (_, automationId: string) => {
    return AutomationEngine.getRunState(automationId);
  });


  // Humanized Warmup Operations IPC
  ipcMain.handle('warmup:start', async (_, { profileId, options }: { profileId: string; options?: any }) => {
    return await WarmupEngine.startWarmup(profileId, options);
  });

  ipcMain.handle('warmup:stop', (_, profileId: string) => {
    WarmupEngine.stopWarmup(profileId);
    return true;
  });

  ipcMain.handle('warmup:get-status', (_, profileId: string) => {
    return WarmupEngine.getStatus(profileId);
  });

  ipcMain.handle('warmup:get-running', () => {
    return WarmupEngine.getRunningWarmupIds();
  });

  ipcMain.handle('warmup:get-queue', () => {
    return WarmupEngine.getQueuedWarmupIds();
  });

  ipcMain.handle('warmup:save-config', (_, { profileId, config }: { profileId: string; config: any }) => {
    const data = DataStore.read();
    const updatedProfiles = data.profiles.map((p) => {
      if (p.id === profileId) {
        return {
          ...p,
          warmupConfig: config,
        };
      }
      return p;
    });
    DataStore.write({ profiles: updatedProfiles });
    return true;
  });

  // Custom Tables IPC (SQLite Engine)
  ipcMain.handle('tables:get-all', () => {
    try {
      return TableStore.getTablesSummary();
    } catch (err: any) {
      console.error('[Main] Erro ao listar tabelas:', err);
      return [];
    }
  });

  ipcMain.handle('tables:get-by-id', (_, id: string) => {
    try {
      return TableStore.getTableById(id);
    } catch (err: any) {
      console.error('[Main] Erro ao obter tabela por id:', err);
      return null;
    }
  });

  ipcMain.handle('tables:create', (_, input: any) => {
    try {
      return TableStore.createTable(input);
    } catch (err: any) {
      console.error('[Main] Erro ao criar tabela:', err);
      throw err;
    }
  });

  ipcMain.handle('tables:update', (_, { id, updates }: { id: string; updates: any }) => {
    try {
      return TableStore.updateTable(id, updates);
    } catch (err: any) {
      console.error('[Main] Erro ao atualizar tabela:', err);
      return false;
    }
  });

  ipcMain.handle('tables:delete', (_, id: string) => {
    try {
      return TableStore.deleteTable(id);
    } catch (err: any) {
      console.error('[Main] Erro ao excluir tabela:', err);
      return false;
    }
  });

  ipcMain.handle('tables:duplicate', (_, { tableId, includeData, newName }: { tableId: string; includeData: boolean; newName?: string }) => {
    try {
      return TableStore.duplicateTable(tableId, includeData, newName);
    } catch (err: any) {
      console.error('[Main] Erro ao duplicar tabela:', err);
      throw err;
    }
  });

  ipcMain.handle('tables:add-column', (_, { tableId, name, type, options }: { tableId: string; name: string; type: any; options?: string[] }) => {
    try {
      return TableStore.addColumn(tableId, name, type, options);
    } catch (err: any) {
      console.error('[Main] Erro ao adicionar coluna:', err);
      throw err;
    }
  });

  ipcMain.handle('tables:update-column', (_, { columnId, updates }: { columnId: string; updates: any }) => {
    try {
      return TableStore.updateColumn(columnId, updates);
    } catch (err: any) {
      console.error('[Main] Erro ao atualizar coluna:', err);
      return false;
    }
  });

  ipcMain.handle('tables:delete-column', (_, { columnId, tableId }: { columnId: string; tableId: string }) => {
    try {
      return TableStore.deleteColumn(columnId, tableId);
    } catch (err: any) {
      console.error('[Main] Erro ao excluir coluna:', err);
      return false;
    }
  });

  ipcMain.handle('tables:add-row', (_, { tableId, data }: { tableId: string; data?: any }) => {
    try {
      return TableStore.addRow(tableId, data);
    } catch (err: any) {
      console.error('[Main] Erro ao adicionar linha:', err);
      throw err;
    }
  });

  ipcMain.handle('tables:update-row', (_, { rowId, data }: { rowId: string; data: any }) => {
    try {
      return TableStore.updateRow(rowId, data);
    } catch (err: any) {
      console.error('[Main] Erro ao atualizar linha:', err);
      return false;
    }
  });

  ipcMain.handle('tables:delete-row', (_, rowId: string) => {
    try {
      return TableStore.deleteRow(rowId);
    } catch (err: any) {
      console.error('[Main] Erro ao excluir linha:', err);
      return false;
    }
  });

  ipcMain.handle('tables:reorder-rows', (_, { tableId, rowIds }: { tableId: string; rowIds: string[] }) => {
    try {
      return TableStore.reorderRows(tableId, rowIds);
    } catch (err: any) {
      console.error('[Main] Erro ao reordenar linhas:', err);
      return false;
    }
  });

  ipcMain.handle('tables:reorder-columns', (_, { tableId, columnIds }: { tableId: string; columnIds: string[] }) => {
    try {
      return TableStore.reorderColumns(tableId, columnIds);
    } catch (err: any) {
      console.error('[Main] Erro ao reordenar colunas:', err);
      return false;
    }
  });

  ipcMain.handle('tables:get-templates', () => {
    try {
      return TableStore.getTemplates();
    } catch (err: any) {
      console.error('[Main] Erro ao buscar templates de tabelas:', err);
      return [];
    }
  });

  // Integrations & Proxy Seller IPC (SQLite Engine + Remote API v2)
  ipcMain.handle('integrations:get-all', () => {
    try {
      return IntegrationStore.getAllIntegrations();
    } catch (err: any) {
      console.error('[Main] Erro ao obter integrações:', err);
      return [];
    }
  });

  ipcMain.handle('integrations:get-by-id', (_, serviceId: string) => {
    try {
      return IntegrationStore.getIntegration(serviceId);
    } catch (err: any) {
      console.error('[Main] Erro ao obter integração:', err);
      return null;
    }
  });

  ipcMain.handle('integrations:save', (_, { serviceId, apiKey, status, cachedBalance, cachedData, settings }: any) => {
    try {
      return IntegrationStore.saveIntegration(serviceId, apiKey, status, cachedBalance, cachedData, settings);
    } catch (err: any) {
      console.error('[Main] Erro ao salvar integração:', err);
      throw err;
    }
  });

  ipcMain.handle('integrations:delete', (_, serviceId: string) => {
    try {
      return IntegrationStore.deleteIntegration(serviceId);
    } catch (err: any) {
      console.error('[Main] Erro ao excluir integração:', err);
      return false;
    }
  });

  // Proxy Seller Actions
  ipcMain.handle('proxy-seller:test-connection', async (_, apiKey: string) => {
    return ProxySellerService.testConnection(apiKey);
  });

  ipcMain.handle('proxy-seller:get-balance', async (_, apiKey?: string) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    const res = await ProxySellerService.getBalance(key);
    if (res.success && res.data) {
      IntegrationStore.saveIntegration('proxy-seller', key, 'connected', res.data.summ);
    }
    return res;
  });

  ipcMain.handle('proxy-seller:get-residential-info', async (_, apiKey?: string) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    const res = await ProxySellerService.getResidentialInfo(key);
    if (res.success && res.package) {
      IntegrationStore.saveIntegration('proxy-seller', key, 'connected', undefined, {
        package: res.package,
        lists: res.lists,
      });
    }
    return res;
  });

  ipcMain.handle('proxy-seller:update-rotation', async (_, { listId, rotationSeconds, apiKey }: any) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    return ProxySellerService.updateRotation(key, listId, rotationSeconds);
  });

  ipcMain.handle('proxy-seller:get-isp-proxies', async (_, apiKey?: string) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    return ProxySellerService.getIspProxies(key);
  });

  ipcMain.handle('proxy-seller:buy-proxy', async (_, { params, apiKey }: any) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    return ProxySellerService.buyProxy(key, params);
  });

  ipcMain.handle('proxy-seller:get-reference-list', async (_, { type, apiKey }: any) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    return ProxySellerService.getReferenceList(key, type || 'isp');
  });

  ipcMain.handle('proxy-seller:calculate-order', async (_, { params, apiKey }: any) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    return ProxySellerService.calculateOrder(key, params);
  });

  ipcMain.handle('proxy-seller:check-card', async (_, apiKey?: string) => {
    const key = apiKey || IntegrationStore.getIntegration('proxy-seller')?.apiKey;
    if (!key) return { success: false, error: 'Chave do Proxy Seller não encontrada' };
    return ProxySellerService.checkCardSubscription(key);
  });

  // Start automatic warmup scheduler (daily 24h & active interval)
  WarmupScheduler.start();

  setupTray();
  createWindow();

  app.on('activate', () => {
    if (mainWindow) {
      showMainWindow();
    } else {
      createWindow();
    }
  });
});

app.on('before-quit', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    quitApplication();
  }
});

app.on('window-all-closed', () => {
  if (isQuitting || process.platform !== 'darwin') {
    quitApplication();
  }
});
