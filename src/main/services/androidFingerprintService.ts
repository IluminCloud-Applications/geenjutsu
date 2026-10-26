import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Profile } from '../../types';

const execAsync = promisify(exec);

export class AndroidFingerprintService {
  /**
   * Derives a deterministic 32-bit positive integer seed from the profile ID and Android ID.
   * Ensures identical seeds for the same profile across all sessions,
   * and distinct seeds for different profiles.
   */
  static getProfileSeed(profile: Profile): number {
    const raw = `${profile.id}:${profile.androidId || ''}:${profile.serialNumber || ''}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * Generates the tampermonkey-compatible stealth userscript with profile-deterministic micro-noise.
   * Completely transparent, idempotent, and passes BrowserScan / CreepJS / FingerprintJS anti-tamper checks.
   */
  static generateStealthScript(seed: number): string {
    return `// ==UserScript==
// @name         Geenjutsu Hardware Shield
// @namespace    https://geenjutsu.io/shield
// @version      1.0
// @description  Anti-detect hardware fingerprint shield for Android Redroid
// @run-at       document-end
// @match        *://*/*
// @match        https://*/*
// @match        http://*/*
// @match        https://www.browserscan.net/*
// @match        https://pixelscan.net/*
// @match        https://browserleaks.com/*
// @match        https://creepjs-api.web.app/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  if (window.__GEENJUTSU_SHIELD_ACTIVE__) return;
  window.__GEENJUTSU_SHIELD_ACTIVE__ = true;

  const SEED = ${seed};

  // Mulberry32 parameter mixer
  function mixSeed(s, offset) {
    var t = ((s ^ 0x6D2B79F5) + offset) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  // Native function deception: Function.prototype.toString always returns [native code]
  const hookedFns = new WeakSet();
  const origToString = Function.prototype.toString;
  function makeNative(fn, name) {
    if (name) {
      try {
        Object.defineProperty(fn, 'name', { value: name, configurable: true });
      } catch (e) {}
    }
    hookedFns.add(fn);
    return fn;
  }

  try {
    Function.prototype.toString = new Proxy(origToString, {
      apply(target, thisArg, argArray) {
        if (hookedFns.has(thisArg)) {
          return \`function \${thisArg.name || ''}() { [native code] }\`;
        }
        return Reflect.apply(target, thisArg, argArray);
      }
    });
    hookedFns.add(Function.prototype.toString);
  } catch (e) {}

  const origGetContext = HTMLCanvasElement.prototype.getContext;

  // 1. Canvas 2D & WebGL 3D toDataURL (Idempotent center-patch offscreen isolation)
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = makeNative(function toDataURL(type, encoderOptions) {
    if (this.width > 0 && this.height > 0) {
      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = this.width;
        offscreen.height = this.height;
        const offCtx = origGetContext.call(offscreen, '2d');
        if (offCtx) {
          offCtx.drawImage(this, 0, 0);
          const patchW = Math.min(this.width, 16);
          const patchH = Math.min(this.height, 16);
          const startX = Math.max(0, Math.floor((this.width - patchW) / 2));
          const startY = Math.max(0, Math.floor((this.height - patchH) / 2));
          const imgData = offCtx.getImageData(startX, startY, patchW, patchH);
          const d = imgData.data;
          const step = (SEED % 5) + 2;
          for (let i = 0; i < d.length; i += 4 * step) {
            if (d[i + 3] > 0) {
              const shift = ((SEED + i) % 3) - 1;
              d[i] = Math.max(0, Math.min(255, d[i] + shift));
            }
          }
          offCtx.putImageData(imgData, startX, startY);
          return origToDataURL.call(offscreen, type, encoderOptions);
        }
      } catch (e) {}
    }
    return origToDataURL.apply(this, arguments);
  }, 'toDataURL');

  // 2. Canvas 2D getImageData (Idempotent deterministic sample micro-noise)
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = makeNative(function getImageData(sx, sy, sw, sh) {
    const res = origGetImageData.apply(this, arguments);
    try {
      const d = res.data;
      const step = (SEED % 5) + 2;
      for (let i = 0; i < d.length; i += 4 * step) {
        if (d[i + 3] > 0) {
          const shift = ((SEED + i) % 3) - 1;
          d[i] = Math.max(0, Math.min(255, d[i] + shift));
        }
      }
    } catch (e) {}
    return res;
  }, 'getImageData');

  // 3. WebGL Report Parameters (Aliased Point Size Range with mixed seed variation)
  function protectWebGL(glProto) {
    if (!glProto) return;

    const origGetParameter = glProto.getParameter;
    if (origGetParameter) {
      const pointParamShift = (mixSeed(SEED, 101) % 7) + 1;
      glProto.getParameter = makeNative(function getParameter(pname) {
        // ALIASED_POINT_SIZE_RANGE (0x846D)
        if (pname === 0x846D) {
          const orig = origGetParameter.apply(this, arguments);
          if (orig && orig.length === 2) {
            return new Float32Array([orig[0], orig[1] + pointParamShift]);
          }
        }
        return origGetParameter.apply(this, arguments);
      }, 'getParameter');
    }
  }

  if (typeof WebGLRenderingContext !== 'undefined') {
    protectWebGL(WebGLRenderingContext.prototype);
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    protectWebGL(WebGL2RenderingContext.prototype);
  }
})();
`;
  }

  /**
   * Injects the persistent stealth shield script into the Via Browser SQLite monkey database inside the container.
   */
  static async injectStealthScript(containerId: string, profile: Profile): Promise<boolean> {
    const ts = Date.now();
    const tmpDb = path.join(os.tmpdir(), `geenjutsu_monkey_${profile.id}_${ts}.db`);
    const tmpScript = path.join(os.tmpdir(), `geenjutsu_shield_${profile.id}_${ts}.js`);
    const tmpPy = path.join(os.tmpdir(), `geenjutsu_worker_${profile.id}_${ts}.py`);

    try {
      const seed = this.getProfileSeed(profile);
      const scriptContent = this.generateStealthScript(seed);
      fs.writeFileSync(tmpScript, scriptContent, 'utf-8');

      const scriptId = crypto.createHash('md5').update(`geenjutsu-shield-${profile.id}`).digest('hex');

      // 1. Garante diretório de bancos da Via Browser no container
      await execAsync(`docker exec ${containerId} mkdir -p /data/data/mark.via.gp/databases 2>/dev/null || true`);

      // 2. Copia o banco monkey existente se houver
      await execAsync(`docker cp ${containerId}:/data/data/mark.via.gp/databases/monkey "${tmpDb}" 2>/dev/null`).catch(() => null);

      // 3. Worker Python dedicado gravado em arquivo para evitar problemas de escape de shell
      const pyScript = [
        'import sqlite3, sys',
        'db_path = sys.argv[1]',
        'script_id = sys.argv[2]',
        'script_file = sys.argv[3]',
        'with open(script_file, "r", encoding="utf-8") as f:',
        '    content = f.read()',
        'con = sqlite3.connect(db_path)',
        'cur = con.cursor()',
        'cur.execute("CREATE TABLE IF NOT EXISTS android_metadata (locale TEXT)")',
        'cur.execute("INSERT OR IGNORE INTO android_metadata VALUES (\'en_US\')")',
        'cur.execute("""',
        'CREATE TABLE IF NOT EXISTS scripts (',
        '    _id INTEGER PRIMARY KEY AUTOINCREMENT,',
        '    script_id TEXT NOT NULL UNIQUE,',
        '    name TEXT,',
        '    version TEXT,',
        '    content TEXT NOT NULL,',
        '    matches TEXT,',
        '    exclude_matches TEXT,',
        '    includes TEXT,',
        '    excludes TEXT,',
        '    run_at INTEGER DEFAULT 0,',
        '    requires TEXT,',
        '    resources TEXT,',
        '    enabled INTEGER DEFAULT 0,',
        '    flags INTEGER DEFAULT 0,',
        '    grant INTEGER DEFAULT 0,',
        '    icon_url TEXT,',
        '    homepage_url TEXT,',
        '    support_url TEXT,',
        '    download_url TEXT,',
        '    user_overrides TEXT,',
        '    last_updated_at INTEGER DEFAULT 0,',
        '    created_at INTEGER DEFAULT 0',
        ')',
        '""")',
        'cur.execute("""',
        'CREATE TABLE IF NOT EXISTS variables (',
        '    _id INTEGER PRIMARY KEY AUTOINCREMENT,',
        '    script_id TEXT NOT NULL,',
        '    name TEXT NOT NULL,',
        '    value TEXT',
        ')',
        '""")',
        'matches_json = \'["*:\\\\/\\\\/*\\\\/*","https:\\\\/\\\\/*\\\\/*","http:\\\\/\\\\/*\\\\/*","https:\\\\/\\\\/www.browserscan.net\\\\/*","https:\\\\/\\\\/pixelscan.net\\\\/*","https:\\\\/\\\\/browserleaks.com\\\\/*","https:\\\\/\\\\/creepjs-api.web.app\\\\/*"]\'',
        'cur.execute("DELETE FROM scripts WHERE script_id = ?", (script_id,))',
        'cur.execute("""',
        'INSERT INTO scripts (',
        '    script_id, name, version, content, matches, run_at, enabled, created_at, last_updated_at',
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        '""", (script_id, "Geenjutsu Hardware Shield", "1.0", content, matches_json, 2, 1, 1792880000000, 1792880000000))',
        'con.commit()',
        'con.close()',
        'print("OK")',
      ].join('\n');

      fs.writeFileSync(tmpPy, pyScript, 'utf-8');
      await execAsync(`python3 "${tmpPy}" "${tmpDb}" "${scriptId}" "${tmpScript}"`);

      // 4. Copia o banco atualizado de volta para o container
      await execAsync(`docker cp "${tmpDb}" ${containerId}:/data/data/mark.via.gp/databases/monkey`);

      // 5. Ajusta permissões estritas para o UID do aplicativo Via Browser (10044)
      await execAsync(
        `docker exec ${containerId} sh -c "` +
        `chown -R 10044:10044 /data/data/mark.via.gp/databases 2>/dev/null; ` +
        `chmod 660 /data/data/mark.via.gp/databases/monkey* 2>/dev/null; ` +
        `true"`
      );

      // 6. Se o Via Browser já estiver em execução, encerra para recarregar o novo banco
      await execAsync(`docker exec ${containerId} am force-stop mark.via.gp 2>/dev/null || true`);

      console.log(`[AndroidFingerprintService] Geenjutsu Hardware Shield injetado com sucesso para "${profile.name}" (Seed: 0x${seed.toString(16)})`);
      return true;
    } catch (err: any) {
      console.error(`[AndroidFingerprintService] Falha ao injetar script de stealth no container ${containerId}:`, err?.message || err);
      return false;
    } finally {
      try {
        if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
        if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
        if (fs.existsSync(tmpPy)) fs.unlinkSync(tmpPy);
      } catch {}
    }
  }
}
