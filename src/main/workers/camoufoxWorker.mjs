import http from 'http';
import net from 'net';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { SocksClient } from 'socks';
import AdmZip from 'adm-zip';
import { Camoufox } from 'camoufox-js';
import { launchOptions } from 'camoufox-js/dist/utils.js';
import { generateFingerprint } from 'camoufox-js/dist/fingerprints.js';
import { sampleWebGL } from 'camoufox-js/dist/webgl/sample.js';
import { INSTALL_DIR, OS_NAME } from 'camoufox-js/dist/pkgman.js';

// 1. Parse configuration from CLI arguments or configuration file
const isHardwareGenOnly = process.argv[2] === '--generate-hardware';

let config = {};
if (!isHardwareGenOnly) {
  let configStr = '';
  if (process.argv[2] === '--config-file') {
    const configPath = process.argv[3];
    try {
      configStr = fs.readFileSync(configPath, 'utf-8');
      try {
        fs.unlinkSync(configPath);
      } catch {}
    } catch (e) {
      console.error('[CamoufoxWorker] Erro ao ler arquivo de configuração:', e);
      process.exit(1);
    }
  } else {
    configStr = process.argv[2];
  }

  if (!configStr) {
    console.error('[CamoufoxWorker] Erro: Argumentos de configuração não fornecidos.');
    process.exit(1);
  }

  try {
    config = JSON.parse(configStr);
  } catch (e) {
    console.error('[CamoufoxWorker] Erro ao analisar JSON de configuração:', e);
    process.exit(1);
  }
}

const {
  profileId,
  profileDir,
  initialUrl = 'https://google.com',
  osTarget = 'windows',
  proxyConfig,
  cookies = [],
  headless = false,
  fingerprint,
  isWarmupOnly = false,
  warmupData,
  economyMode = false,
} = config;

process.on('uncaughtException', (err) => {
  console.error('[CamoufoxWorker] Erro não capturado (mantendo processo ativo):', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CamoufoxWorker] Rejeição de Promise não tratada:', reason);
});

/**
 * Creates a local HTTP CONNECT forwarder for SOCKS5/SOCKS4/HTTP/HTTPS proxy upstream
 */
function createProxyForwarder(upstream) {
  const proto = (upstream.type || 'socks5').toLowerCase();
  const isSocks = proto === 'socks5' || proto === 'socks4';
  const socksType = proto === 'socks4' ? 4 : 5;
  const upstreamPort = parseInt(upstream.port, 10);
  const authHeader = upstream.username
    ? Buffer.from(`${upstream.username}:${upstream.password || ''}`).toString('base64')
    : null;

  const server = http.createServer((clientReq, clientRes) => {
    let targetUrl;
    try {
      targetUrl = new URL(clientReq.url);
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
              clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
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
          clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
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

  server.on('connect', async (req, clientSocket, head) => {
    const [targetHost, targetPortStr] = req.url.split(':');
    const targetPort = parseInt(targetPortStr || '443', 10);

    if (isSocks) {
      try {
        const info = await SocksClient.createConnection({
          proxy: {
            ipaddress: upstream.host,
            port: upstreamPort,
            type: socksType,
            userId: upstream.username || '',
            password: upstream.password || '',
          },
          command: 'connect',
          destination: { host: targetHost, port: targetPort },
        });

        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head && head.length > 0) info.socket.write(head);
        info.socket.pipe(clientSocket);
        clientSocket.pipe(info.socket);

        info.socket.on('error', () => {
          try {
            clientSocket.destroy();
          } catch {}
        });
        clientSocket.on('error', () => {
          try {
            info.socket.destroy();
          } catch {}
        });
      } catch (err) {
        try {
          clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          clientSocket.destroy();
        } catch {}
      }
    } else {
      const connector = proto === 'https' ? tls : net;
      const upstreamSocket = connector.connect({ host: upstream.host, port: upstreamPort }, () => {
        let connectCmd = `CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\n`;
        if (authHeader) connectCmd += `Proxy-Authorization: Basic ${authHeader}\r\n`;
        connectCmd += '\r\n';
        upstreamSocket.write(connectCmd);
      });

      let handshakeDone = false;
      let buffer = '';

      upstreamSocket.on('data', (chunk) => {
        if (!handshakeDone) {
          buffer += chunk.toString('latin1');
          const idx = buffer.indexOf('\r\n\r\n');
          if (idx !== -1) {
            handshakeDone = true;
            const statusLine = buffer.split('\r\n')[0] || '';
            if (statusLine.includes(' 200 ')) {
              clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
              const remainder = Buffer.from(buffer.slice(idx + 4), 'latin1');
              if (remainder.length > 0) clientSocket.write(remainder);
              if (head && head.length > 0) upstreamSocket.write(head);
              upstreamSocket.pipe(clientSocket);
              clientSocket.pipe(upstreamSocket);
            } else {
              try {
                clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
                clientSocket.destroy();
                upstreamSocket.destroy();
              } catch {}
            }
          }
        }
      });

      upstreamSocket.on('error', () => {
        try {
          clientSocket.destroy();
        } catch {}
      });
      clientSocket.on('error', () => {
        try {
          upstreamSocket.destroy();
        } catch {}
      });
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
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

// 2. Humanized Warmup Navigation Logic
let warmupCancelled = false;
const activeAutomations = new Map();

function wrapWithCancellation(obj, scope) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) return obj;

  return new Proxy(obj, {
    get(target, prop, receiver) {
      if (prop === '_rawTarget') return target;

      // Special handling for waitForTimeout: abortable sleep
      if (prop === 'waitForTimeout') {
        return (ms) => {
          if (scope.cancelled) {
            const err = new Error('ERR_AUTOMATION_STOPPED');
            err.name = 'AutomationStopped';
            throw err;
          }
          return new Promise((resolve, reject) => {
            let timer = null;
            const cleanup = () => {
              scope.abortCallbacks.delete(onAbort);
              if (timer) clearTimeout(timer);
            };
            const onAbort = () => {
              cleanup();
              const err = new Error('ERR_AUTOMATION_STOPPED');
              err.name = 'AutomationStopped';
              reject(err);
            };
            scope.abortCallbacks.add(onAbort);
            timer = setTimeout(() => {
              cleanup();
              resolve();
            }, ms);
          });
        };
      }

      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === 'function') {
        return function (...args) {
          if (scope.cancelled) {
            scope.consecutiveThrows = (scope.consecutiveThrows || 0) + 1;
            if (scope.consecutiveThrows > 15) {
              return new Promise(() => {});
            }
            const err = new Error('ERR_AUTOMATION_STOPPED');
            err.name = 'AutomationStopped';
            throw err;
          }

          const unwrappedArgs = args.map(arg => (arg && arg._rawTarget ? arg._rawTarget : arg));
          const result = orig.apply(target, unwrappedArgs);

          if (result && typeof result.then === 'function') {
            return Promise.race([
              result.then(val => wrapWithCancellation(val, scope)),
              new Promise((_, reject) => {
                const onAbort = () => {
                  const err = new Error('ERR_AUTOMATION_STOPPED');
                  err.name = 'AutomationStopped';
                  reject(err);
                };
                scope.abortCallbacks.add(onAbort);
                result.finally(() => scope.abortCallbacks.delete(onAbort));
              }),
            ]);
          }

          if (result && typeof result === 'object') {
            return wrapWithCancellation(result, scope);
          }

          return result;
        };
      }

      if (orig && typeof orig === 'object') {
        return wrapWithCancellation(orig, scope);
      }

      return orig;
    },
  });
}

async function executeHumanWarmup(context, targetPage, warmupOptions, syncCookiesFn) {
  const { sites = [], timePerSiteMin = 30, timePerSiteMax = 90 } = warmupOptions || {};
  console.log(`[CamoufoxWorker] Iniciando aquecimento humanizado com ${sites.length} sites...`);
  warmupCancelled = false;
  let warmedCount = 0;

  for (let i = 0; i < sites.length; i++) {
    if (warmupCancelled) {
      console.log('[CamoufoxWorker] Aquecimento cancelado pelo usuário.');
      break;
    }

    const domain = sites[i].trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!domain) continue;

    const currentSite = domain;
    const currentIndex = i + 1;
    const totalSites = sites.length;

    const siteDurationSec = Math.floor(Math.random() * (timePerSiteMax - timePerSiteMin + 1)) + timePerSiteMin;
    let remainingSec = siteDurationSec;

    if (process.send) {
      process.send({
        type: 'warmup_progress',
        profileId,
        data: {
          currentSite,
          currentIndex,
          totalSites,
          progressPercent: Math.round((i / totalSites) * 100),
          remainingSeconds: remainingSec,
        },
      });
    }

    console.log(`[CamoufoxWorker] [${currentIndex}/${totalSites}] Navegando em ${domain} (~${siteDurationSec}s)...`);

    let navOk = false;
    try {
      await targetPage.goto(`https://${domain}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      navOk = true;
    } catch {
      try {
        await targetPage.goto(`http://${domain}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        navOk = true;
      } catch {
        try {
          await targetPage.goto(`https://www.${domain}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
          navOk = true;
        } catch (e3) {
          console.warn(`[CamoufoxWorker] Falha ao carregar ${domain}:`, e3?.message);
        }
      }
    }

    if (navOk) {
      warmedCount++;

      // 1. Dismiss / Accept Cookie Consent banners to trigger third-party tracking cookies (Meta, Google, etc.)
      await targetPage.evaluate(() => {
        try {
          const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
          const acceptBtn = btns.find((b) => {
            const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
            return (
              txt === 'aceitar' ||
              txt === 'concordar' ||
              txt === 'aceitar todos' ||
              txt === 'entendi' ||
              txt === 'continuar' ||
              txt === 'permitir todos' ||
              txt === 'prosseguir' ||
              txt === 'concordo'
            );
          });
          if (acceptBtn) acceptBtn.click();
        } catch {}
      }).catch(() => {});

      // 2. Perform natural human browsing interactions during siteDurationSec
      const startTime = Date.now();
      let clickedInternal = false;

      while (Date.now() - startTime < siteDurationSec * 1000) {
        if (warmupCancelled) break;

        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        remainingSec = Math.max(0, siteDurationSec - elapsedSec);

        if (process.send && elapsedSec % 4 === 0) {
          process.send({
            type: 'warmup_progress',
            profileId,
            data: {
              currentSite,
              currentIndex,
              totalSites,
              progressPercent: Math.round(((i + elapsedSec / siteDurationSec) / totalSites) * 100),
              remainingSeconds: remainingSec,
            },
          });
        }

        // Random action: smooth scroll down or slight scroll up
        const actionRand = Math.random();
        if (actionRand < 0.65) {
          const scrollDistance = Math.floor(Math.random() * 320) + 160;
          await targetPage.evaluate((d) => {
            window.scrollBy({ top: d, behavior: 'smooth' });
          }, scrollDistance).catch(() => {});
        } else if (actionRand < 0.82) {
          await targetPage.evaluate(() => {
            window.scrollBy({ top: -140, behavior: 'smooth' });
          }).catch(() => {});
        }

        // Natural curved mouse movement
        try {
          const viewport = targetPage.viewportSize() || { width: 1280, height: 720 };
          const rx = Math.floor(Math.random() * (viewport.width - 250)) + 120;
          const ry = Math.floor(Math.random() * (viewport.height - 250)) + 120;
          await targetPage.mouse.move(rx, ry);
        } catch {}

        // Random internal link click (once per site, 45% chance, after 10s of browsing)
        if (!clickedInternal && Date.now() - startTime > 10000 && Math.random() < 0.45) {
          clickedInternal = true;
          try {
            const clicked = await targetPage.evaluate((host) => {
              const links = Array.from(document.querySelectorAll('a[href]'));
              const validLinks = links.filter((a) => {
                const href = a.getAttribute('href') || '';
                return (
                  (href.startsWith('/') || href.includes(host)) &&
                  !href.startsWith('#') &&
                  !href.startsWith('mailto:') &&
                  !href.startsWith('tel:') &&
                  a.offsetParent !== null
                );
              });
              if (validLinks.length > 0) {
                const pick = validLinks[Math.floor(Math.random() * Math.min(validLinks.length, 12))];
                pick.click();
                return true;
              }
              return false;
            }, domain);

            if (clicked) {
              await targetPage.waitForTimeout(3000);
            }
          } catch {}
        }

        // Natural human pause (reading time: 3 to 7s)
        const pauseMs = Math.floor(Math.random() * 4000) + 3000;
        await targetPage.waitForTimeout(Math.min(pauseMs, remainingSec * 1000));
      }

      // Sync cookies after each site visit
      if (typeof syncCookiesFn === 'function') {
        await syncCookiesFn();
      }
    }
  }

  if (process.send) {
    process.send({
      type: 'warmup_finished',
      profileId,
      success: !warmupCancelled,
      warmedCount,
      cancelled: warmupCancelled,
    });
  }

  return { success: !warmupCancelled, warmedCount };
}

function getCamoufoxResourcePaths() {
  const base = INSTALL_DIR ? INSTALL_DIR.toString() : path.join(os.homedir(), '.cache/camoufox');
  if (OS_NAME === 'mac') {
    const resDir = path.join(base, 'Camoufox.app', 'Contents', 'Resources');
    return {
      omniPath: path.join(resDir, 'browser', 'omni.ja'),
      polPath: path.join(resDir, 'distribution', 'policies.json'),
      markerPath: path.join(resDir, 'browser', '.geenjutsu_branded'),
    };
  }
  return {
    omniPath: path.join(base, 'browser', 'omni.ja'),
    polPath: path.join(base, 'distribution', 'policies.json'),
    markerPath: path.join(base, 'browser', '.geenjutsu_branded'),
  };
}

function ensureGeenjutsuBranding() {
  try {
    const { omniPath, polPath, markerPath } = getCamoufoxResourcePaths();
    if (!fs.existsSync(omniPath)) return;

    // 1. Ensure DisplayBookmarksToolbar in policies.json is always
    if (fs.existsSync(polPath)) {
      try {
        let pol = fs.readFileSync(polPath, 'utf-8');
        if (pol.includes('"DisplayBookmarksToolbar": "never"')) {
          pol = pol.replace('"DisplayBookmarksToolbar": "never"', '"DisplayBookmarksToolbar": "always"');
          fs.writeFileSync(polPath, pol, 'utf-8');
        }
      } catch {}
    }

    // 2. Check if omni.ja was already branded
    if (fs.existsSync(markerPath)) return;

    try {
      const zip = new AdmZip(omniPath);
      let changed = false;

      const ftlEntry = zip.getEntry('localization/en-US/branding/brand.ftl');
      if (ftlEntry) {
        let ftl = zip.readAsText(ftlEntry);
        if (ftl.includes('Camoufox')) {
          ftl = ftl.replace(/Camoufox/g, 'Geenjutsu');
          zip.updateFile('localization/en-US/branding/brand.ftl', Buffer.from(ftl, 'utf-8'));
          changed = true;
        }
      }

      const dtdEntry = zip.getEntry('chrome/en-US/locale/branding/brand.dtd');
      if (dtdEntry) {
        let dtd = zip.readAsText(dtdEntry);
        if (dtd.includes('Camoufox')) {
          dtd = dtd.replace(/Camoufox/g, 'Geenjutsu');
          zip.updateFile('chrome/en-US/locale/branding/brand.dtd', Buffer.from(dtd, 'utf-8'));
          changed = true;
        }
      }

      if (changed) {
        zip.writeZip(omniPath);
        fs.writeFileSync(markerPath, '1', 'utf-8');
        console.log('[CamoufoxWorker] Branding Geenjutsu aplicado em omni.ja com sucesso via AdmZip.');
      } else {
        fs.writeFileSync(markerPath, '1', 'utf-8');
      }
    } catch (bErr) {
      console.warn('[CamoufoxWorker] Aviso ao aplicar branding em omni.ja:', bErr?.message);
    }
  } catch {}
}

/**
 * Resolves or initializes a persistent hardware fingerprint for the given profile.
 * Ensures the hardware profile (seeds, WebGL vendor/renderer, CPU concurrency,
 * canvas AA offsets, fonts spacing seed, and screen constraints) is strictly
 * immutable across multiple sessions of the same profile.
 */
async function getOrInitHardwareProfile(profileDir, profileId, osTarget, fingerprint) {
  const hardwarePath = path.join(profileDir, 'fingerprint_hardware.json');

  if (fs.existsSync(hardwarePath)) {
    try {
      const raw = fs.readFileSync(hardwarePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.fingerprint &&
        parsed.config &&
        parsed.webgl_config &&
        parsed.os === osTarget
      ) {
        console.log(
          `[CamoufoxWorker] Hardware persistente carregado para perfil "${profileId}" ` +
          `[GPU: ${parsed.webgl_config[1]} | Cores: ${parsed.config['navigator.hardwareConcurrency'] || 8}]`
        );
        return parsed;
      }
    } catch (err) {
      console.warn(`[CamoufoxWorker] Aviso ao ler hardware persistente, regenerando:`, err?.message);
    }
  }

  const osDbMap = { windows: 'win', macos: 'mac', mac: 'mac', linux: 'lin' };
  const dbOs = osDbMap[osTarget] || 'win';

  let screenCons = undefined;
  if (fingerprint?.resolution) {
    const parts = fingerprint.resolution.split('x').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      screenCons = {
        minWidth: parts[0],
        maxWidth: parts[0],
        minHeight: parts[1],
        maxHeight: parts[1],
      };
    }
  }

  const fp = generateFingerprint(undefined, {
    operatingSystems: [osTarget],
    screen: screenCons,
  });

  const webglSample = await sampleWebGL(dbOs);
  const webglConfig = [webglSample['webGl:vendor'], webglSample['webGl:renderer']];

  const initialOpts = await launchOptions({
    os: osTarget,
    fingerprint: fp,
    webgl_config: webglConfig,
    i_know_what_im_doing: true,
  });

  let camouConfigStr = '';
  for (let i = 1; ; i++) {
    const k = 'CAMOU_CONFIG_' + i;
    if (!initialOpts.env[k]) break;
    camouConfigStr += initialOpts.env[k];
  }
  const savedCamouConfig = JSON.parse(camouConfigStr);

  const persistentHardware = {
    version: 1,
    profileId,
    os: osTarget,
    createdAt: Date.now(),
    fingerprint: fp,
    webgl_config: webglConfig,
    config: savedCamouConfig,
  };

  try {
    fs.mkdirSync(profileDir, { recursive: true });
    fs.writeFileSync(hardwarePath, JSON.stringify(persistentHardware, null, 2), 'utf-8');
    console.log(
      `[CamoufoxWorker] Hardware persistente gerado e salvo com sucesso para perfil "${profileId}" ` +
      `[GPU: ${webglConfig[1]} | Cores: ${savedCamouConfig['navigator.hardwareConcurrency'] || 8}]`
    );
  } catch (err) {
    console.error(`[CamoufoxWorker] Erro ao salvar hardware persistente:`, err?.message);
  }

  return persistentHardware;
}

// 3. Camoufox Engine Execution
async function run() {
  ensureGeenjutsuBranding();
  let proxyForwarder = null;

  // Resolve or initialize persistent unique hardware for this profile
  const hardware = await getOrInitHardwareProfile(profileDir, profileId, osTarget, fingerprint);

  // Per-profile process environment: no remoting/IPC channel, temp files or
  // instance name shared with any other profile.
  const isolatedTmp = path.join(profileDir, '.tmp');
  fs.mkdirSync(isolatedTmp, { recursive: true });
  const isolatedEnv = {
    ...process.env,
    MOZ_NO_REMOTE: '1',
    MOZ_APP_REMOTINGNAME: `geenjutsu-${profileId}`,
    MOZ_CRASHREPORTER_DISABLE: '1',
    TMPDIR: isolatedTmp,
    TMP: isolatedTmp,
    TEMP: isolatedTmp,
  };

  const launchOpts = {
    user_data_dir: profileDir,
    env: isolatedEnv,
    headless: Boolean(headless || isWarmupOnly),
    humanize: true,
    os: osTarget, // 'windows' | 'macos' | 'linux'
    geoip: Boolean(proxyConfig && proxyConfig.host),
    fingerprint: hardware.fingerprint,
    webgl_config: hardware.webgl_config,
    config: { ...hardware.config },
    i_know_what_im_doing: true,
    firefox_user_prefs: {
      'dom.audiochannel.mutedByDefault': true,
      'media.autoplay.default': 5,
      'media.volume_scale': '0.0',
      'browser.startup.homepage_override.mstone': 'ignore',
      'browser.shell.checkDefaultBrowser': false,
      'browser.rights.3.shown': true,
      'datareporting.policy.dataSubmissionPolicyAcceptedVersion': 2,
      'browser.windows.titlemodifier': 'Geenjutsu',
      'browser.windows.titlemodifier.pinned': 'Geenjutsu',
      'browser.windows.titlemodifier.container': 'Geenjutsu',
      'browser.toolbars.bookmarks.visibility': 'always',
    },
  };

  if (fingerprint?.webRTC === 'disabled') {
    launchOpts.block_webrtc = true;
    launchOpts.firefox_user_prefs['media.peerconnection.enabled'] = false;
  }

  if (economyMode) {
    launchOpts.firefox_user_prefs['browser.windows.titlemodifier'] = 'Geenjutsu [Modo Economia]';
    launchOpts.firefox_user_prefs['browser.windows.titlemodifier.pinned'] = 'Geenjutsu [Modo Economia]';
    launchOpts.firefox_user_prefs['browser.windows.titlemodifier.container'] = 'Geenjutsu [Modo Economia]';
    launchOpts.firefox_user_prefs['media.autoplay.default'] = 5;
    launchOpts.firefox_user_prefs['media.autoplay.blocking_policy'] = 2;
    launchOpts.firefox_user_prefs['media.play-stand-alone'] = false;
    launchOpts.firefox_user_prefs['media.videocontrols.lock-video'] = true;
    launchOpts.firefox_user_prefs['browser.display.show_image_placeholders'] = true;
    launchOpts.firefox_user_prefs['media.cache_size'] = 0;
    launchOpts.firefox_user_prefs['media.memory_cache_max_size'] = 0;
  }

  if (fingerprint?.resolution) {
    const parts = fingerprint.resolution.split('x').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      launchOpts.screen = {
        min_width: parts[0],
        max_width: parts[0],
        min_height: parts[1],
        max_height: parts[1],
      };
    }
  }

  if (proxyConfig && proxyConfig.host && proxyConfig.port) {
    proxyForwarder = await createProxyForwarder(proxyConfig);
    launchOpts.proxy = { server: `http://127.0.0.1:${proxyForwarder.port}` };
  }

  const cleanup = () => {
    if (proxyForwarder) {
      try {
        proxyForwarder.close();
      } catch {}
      proxyForwarder = null;
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  let context;
  try {
    context = await Camoufox(launchOpts);
  } catch (err) {
    if (launchOpts.geoip) {
      console.warn('[CamoufoxWorker] GeoIP falhou no proxy, tentando fallback com geoip desativado:', err.message);
      launchOpts.geoip = false;
      context = await Camoufox(launchOpts);
    } else {
      cleanup();
      throw err;
    }
  }

  // Se o Modo Economia estiver ativo, intercepta todas as requisições de rede do contexto
  // bloqueando vídeos, áudios, imagens e mídias pesadas para economizar dados de proxy residencial/4G.
  if (economyMode) {
    console.log(`[CamoufoxWorker] [Modo Economia] Ativado com sucesso para o perfil "${profileId}". Bloqueando imagens, vídeos e mídias para economia de dados.`);
    try {
      await context.route('**/*', async (route) => {
        try {
          const req = route.request();
          const resourceType = req.resourceType();
          const url = req.url().toLowerCase();

          // 1. Sempre permitir serviços essenciais de captcha e verificação para criação de contas
          const isCaptcha =
            url.includes('recaptcha') ||
            url.includes('hcaptcha') ||
            url.includes('turnstile') ||
            url.includes('challenges.cloudflare.com') ||
            url.includes('arkoselabs') ||
            url.includes('funcaptcha') ||
            url.includes('geetest') ||
            url.includes('captcha') ||
            url.includes('challenge') ||
            url.includes('identity/challenge');

          if (isCaptcha) {
            return route.continue().catch(() => {});
          }

          // 2. Bloquear tipos de recursos pesados (vídeos, áudios e imagens)
          if (resourceType === 'media' || resourceType === 'image') {
            return route.abort().catch(() => {});
          }

          // 3. Bloquear por extensão de arquivo pesada caso o recurso venha rotulado como 'fetch', 'xhr' ou 'other'
          const isMediaOrImageExt = /\.(mp4|webm|mkv|avi|mov|flv|wmv|m3u8|ts|mp3|wav|ogg|aac|flac|m4a|png|jpg|jpeg|gif|webp|svg|ico|bmp|avif|tiff)(\?.*)?$/i.test(url);
          if (isMediaOrImageExt) {
            return route.abort().catch(() => {});
          }

          // 4. Bloquear CDNs conhecidas de streaming de vídeo e anúncios multimídia
          const isVideoStreamingHost =
            url.includes('googlevideo.com') ||
            url.includes('video.xx.fbcdn.net') ||
            url.includes('cdninstagram.com/v/') ||
            url.includes('tiktokcdn.com/obj/video') ||
            url.includes('byteoversea.com/obj/video') ||
            url.includes('youtube.com/videoplayback');

          if (isVideoStreamingHost) {
            return route.abort().catch(() => {});
          }

          return route.continue().catch(() => {});
        } catch {
          route.continue().catch(() => {});
        }
      });
    } catch (routeErr) {
      console.warn('[CamoufoxWorker] Aviso ao configurar rotas de economia:', routeErr?.message || routeErr);
    }
  }

  // Inject initial cookies if provided
  if (Array.isArray(cookies) && cookies.length > 0) {
    try {
      await context.addCookies(cookies);
      console.log(`[CamoufoxWorker] ${cookies.length} cookies iniciais aplicados.`);
    } catch (e) {
      console.warn('[CamoufoxWorker] Aviso ao aplicar cookies iniciais:', e?.message || e);
    }
  }

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // Periodic and on-demand cookie synchronization
  let isSavingCookies = false;
  async function syncCookies() {
    if (isSavingCookies) return;
    isSavingCookies = true;
    try {
      const allCookies = await context.cookies();
      const backupPath = path.join(profileDir, 'cookies_backup.json');
      fs.writeFileSync(backupPath, JSON.stringify(allCookies, null, 2), 'utf-8');
      if (process.send) {
        process.send({ type: 'cookies_updated', profileId, cookies: allCookies });
      }
    } catch {} finally {
      isSavingCookies = false;
    }
  }

  page.on('load', () => syncCookies().catch(() => {}));
  context.on('page', (newPage) => {
    newPage.on('load', () => syncCookies().catch(() => {}));
  });

  const cookieTimer = setInterval(() => syncCookies().catch(() => {}), 8000);

  // If this run is solely for background warmup, execute and exit cleanly
  if (isWarmupOnly && warmupData) {
    try {
      await executeHumanWarmup(context, page, warmupData, syncCookies);
    } finally {
      clearInterval(cookieTimer);
      await syncCookies();
      cleanup();
      await context.close().catch(() => {});
      process.exit(0);
    }
    return;
  }

  // Normal interactive mode: Navigate to initial target URL
  if (initialUrl) {
    page.goto(initialUrl).catch((navErr) => {
      console.warn('[CamoufoxWorker] Aviso ao navegar:', navErr?.message);
    });
  }

  // Notify parent Electron process that browser is ready
  if (process.send) {
    process.send({ type: 'ready', profileId });
  }

  // Listen to IPC messages from parent Electron process
  process.on('message', async (msg) => {
    if (!msg || typeof msg !== 'object') return;

    try {
      if (msg.type === 'navigate' && msg.url) {
        const currentPages = context.pages();
        const targetPage = currentPages.length > 0 ? currentPages[0] : await context.newPage();
        await targetPage.goto(msg.url);
        await targetPage.bringToFront().catch(() => {});
      } else if (msg.type === 'inject_cookies' && Array.isArray(msg.cookies)) {
        await context.addCookies(msg.cookies);
        await syncCookies();
        console.log(`[CamoufoxWorker] ${msg.cookies.length} cookies injetados dinamicamente no navegador.`);
        if (process.send) {
          process.send({ type: 'cookies_injected', profileId, count: msg.cookies.length });
        }
      } else if (msg.type === 'start_warmup' && msg.data) {
        // Run warmup in background tab without disturbing user's current tab
        const warmupPage = await context.newPage();
        try {
          await executeHumanWarmup(context, warmupPage, msg.data, syncCookies);
        } finally {
          await warmupPage.close().catch(() => {});
        }
      } else if (msg.type === 'run_automation' && msg.code) {
        const { automationId, code } = msg;
        const autoKey = automationId || 'default';
        console.log(`[CamoufoxWorker] Executando automação "${automationId || 'custom'}" no perfil ${profileId}...`);

        const currentPages = context.pages();
        const targetPage = currentPages.length > 0 ? currentPages[0] : await context.newPage();
        await targetPage.bringToFront().catch(() => {});

        const abortCallbacks = new Set();
        const executionScope = {
          page: targetPage,
          context,
          cancelled: false,
          abortCallbacks,
          consecutiveThrows: 0,
          stop: () => {
            executionScope.cancelled = true;
            for (const cb of abortCallbacks) {
              try { cb(); } catch {}
            }
            abortCallbacks.clear();
            if (targetPage && !targetPage.isClosed()) {
              targetPage.evaluate(() => {
                try { window.stop(); } catch {}
              }).catch(() => {});
            }
          },
        };

        activeAutomations.set(autoKey, executionScope);

        const customConsole = {
          log: (...args) => {
            const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            console.log(`[Automation:${automationId}]`, text);
            if (process.send) {
              process.send({
                type: 'automation_log',
                automationId,
                profileId,
                log: { timestamp: Date.now(), type: 'info', message: text },
              });
            }
          },
          warn: (...args) => {
            const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            console.warn(`[Automation:${automationId}]`, text);
            if (process.send) {
              process.send({
                type: 'automation_log',
                automationId,
                profileId,
                log: { timestamp: Date.now(), type: 'warn', message: text },
              });
            }
          },
          error: (...args) => {
            const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            console.error(`[Automation:${automationId}]`, text);
            if (process.send) {
              process.send({
                type: 'automation_log',
                automationId,
                profileId,
                log: { timestamp: Date.now(), type: 'error', message: text },
              });
            }
          },
        };

        try {
          let cleanCode = (code || '').trim();

          // 1. Strip markdown code fences if wrapped in ```js / ```javascript / ```
          if (cleanCode.startsWith('```')) {
            cleanCode = cleanCode.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
          }

          // 2. Fix LaTeX escapes like \vert{}\vert{} or \vert produced by LLMs for || and |
          cleanCode = cleanCode.replace(/\\vert\{\}\\vert\{\}/g, '||');
          cleanCode = cleanCode.replace(/\\vert\{\}/g, '|');
          cleanCode = cleanCode.replace(/\\vert/g, '|');

          // 3. Fix non-breaking spaces or zero-width spaces
          cleanCode = cleanCode.replace(/\u00A0/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '');

          const wrappedPage = wrapWithCancellation(targetPage, executionScope);
          const wrappedContext = wrapWithCancellation(context, executionScope);

          const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
          const fn = new AsyncFunction('page', 'context', 'console', cleanCode);
          await fn(wrappedPage, wrappedContext, customConsole);

          if (executionScope.cancelled) {
            if (process.send) {
              process.send({
                type: 'automation_finished',
                automationId,
                profileId,
                success: false,
                stopped: true,
                error: 'Interrompido pelo usuário',
              });
            }
          } else {
            if (process.send) {
              process.send({
                type: 'automation_finished',
                automationId,
                profileId,
                success: true,
              });
            }
          }
        } catch (err) {
          const wasCancelled = executionScope.cancelled ||
            err?.name === 'AutomationStopped' ||
            err?.message?.includes('ERR_AUTOMATION_STOPPED') ||
            err?.message?.includes('Target page, context or browser has been closed');

          if (wasCancelled) {
            console.log(`[CamoufoxWorker] Automação ${automationId} interrompida pelo usuário.`);
            if (process.send) {
              process.send({
                type: 'automation_log',
                automationId,
                profileId,
                log: { timestamp: Date.now(), type: 'warn', message: 'Automação interrompida pelo usuário.' },
              });
              process.send({
                type: 'automation_finished',
                automationId,
                profileId,
                success: false,
                stopped: true,
                error: 'Interrompido pelo usuário',
              });
            }
          } else {
            const errMsg = err?.message || String(err);
            console.error(`[CamoufoxWorker] Erro na automação ${automationId}:`, errMsg);
            if (process.send) {
              process.send({
                type: 'automation_log',
                automationId,
                profileId,
                log: { timestamp: Date.now(), type: 'error', message: `Erro: ${errMsg}` },
              });
              process.send({
                type: 'automation_finished',
                automationId,
                profileId,
                success: false,
                error: errMsg,
              });
            }
          }
        } finally {
          activeAutomations.delete(autoKey);
        }
      } else if (msg.type === 'stop_automation') {
        const { automationId } = msg;
        const autoKey = automationId || 'default';
        const active = activeAutomations.get(autoKey);
        if (active) {
          active.stop();
        }
      } else if (msg.type === 'cancel_warmup') {
        warmupCancelled = true;
      } else if (msg.type === 'close') {
        clearInterval(cookieTimer);
        await syncCookies();
        cleanup();
        await context.close().catch(() => {});
        process.exit(0);
      }
    } catch (ipcErr) {
      console.error('[CamoufoxWorker] Erro ao processar mensagem IPC:', ipcErr);
    }
  });

  context.on('close', async () => {
    clearInterval(cookieTimer);
    await syncCookies();
    cleanup();
    if (process.send) {
      process.send({ type: 'closed', profileId });
    }
    process.exit(0);
  });
}

if (isHardwareGenOnly) {
  let hwPayload = {};
  if (process.argv[3] === '--config-file') {
    const configPath = process.argv[4];
    try {
      hwPayload = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      try {
        fs.unlinkSync(configPath);
      } catch {}
    } catch (e) {
      console.error('[CamoufoxWorker] Erro ao ler arquivo de hardware config:', e);
    }
  } else {
    try {
      hwPayload = JSON.parse(process.argv[3] || '{}');
    } catch {}
  }
  const targetProfileDir = hwPayload.profileDir;
  const targetProfileId = hwPayload.profileId;
  const targetOs = hwPayload.osTarget || 'windows';
  const targetFp = hwPayload.fingerprint;

  getOrInitHardwareProfile(targetProfileDir, targetProfileId, targetOs, targetFp)
    .then((hw) => {
      if (process.send) {
        process.send({ type: 'hardware_generated', hardware: hw });
      } else {
        console.log(JSON.stringify(hw));
      }
      setTimeout(() => process.exit(0), 50);
    })
    .catch((err) => {
      console.error('[CamoufoxWorker] Erro ao gerar hardware:', err);
      process.exit(1);
    });
} else {
  run().catch((err) => {
    console.error('[CamoufoxWorker] Erro fatal no worker:', err);
    process.exit(1);
  });
}
