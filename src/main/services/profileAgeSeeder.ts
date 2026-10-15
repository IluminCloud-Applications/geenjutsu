import fs from 'fs';
import path from 'path';

export interface AgedProfileSeedOptions {
  minDaysAgo?: number;
  maxDaysAgo?: number;
}

/**
 * Pre-seeds a Camoufox/Firefox profile directory so that it appears aged (mature)
 * rather than freshly created.
 *
 * Configures:
 * 1. times.json - Firefox profile creation & first use timestamps in the past
 * 2. compatibility.ini - Previous build compatibility markers
 * 3. prefs.js - Dismisses first-run welcome/tour screens and sets past update timestamps
 * 4. Filesystem atime/mtime - Touches the files with realistic past dates
 */
export function seedAgedProfileDirectory(
  profileDir: string,
  options: AgedProfileSeedOptions = {}
): { createdMs: number; firstUseMs: number } {
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const timesPath = path.join(profileDir, 'times.json');
  if (fs.existsSync(timesPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(timesPath, 'utf-8'));
      if (data.created) {
        return { createdMs: data.created, firstUseMs: data.firstUse || data.created };
      }
    } catch {}
  }

  const minDays = options.minDaysAgo || 45;
  const maxDays = options.maxDaysAgo || 120;
  const daysAgo = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
  const createdMs = Date.now() - (daysAgo * 86400000) - Math.floor(Math.random() * 3600000 * 12);
  const firstUseMs = createdMs + Math.floor(Math.random() * 1800000) + 300000;
  const pastDate = new Date(createdMs);

  // 1. times.json
  const timesData = {
    created: createdMs,
    firstUse: firstUseMs,
  };
  fs.writeFileSync(timesPath, JSON.stringify(timesData, null, 2), 'utf-8');

  // 2. compatibility.ini
  const compatPath = path.join(profileDir, 'compatibility.ini');
  if (!fs.existsSync(compatPath)) {
    const compatContent = [
      '[Compatibility]',
      'LastVersion=135.0_20250101000000/20250101000000',
      'LastOSABI=Linux_x86_64-gcc3',
      'LastPlatformDir=/',
      'LastAppDir=/',
      '',
    ].join('\n');
    fs.writeFileSync(compatPath, compatContent, 'utf-8');
  }

  // 3. prefs.js
  const prefsPath = path.join(profileDir, 'prefs.js');
  if (!fs.existsSync(prefsPath)) {
    const defaultPrefs = [
      '// Mozilla User Preferences (Established Profile)',
      'user_pref("browser.startup.homepage_override.mstone", "ignore");',
      'user_pref("browser.rights.3.shown", true);',
      'user_pref("browser.migration.version", 14);',
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      'user_pref("browser.sessionstore.resume_from_crash", false);',
      'user_pref("datareporting.policy.dataSubmissionPolicyAcceptedVersion", 2);',
      `user_pref("app.update.lastUpdateTime.browser-cleanup-thumbnails", ${Math.floor(firstUseMs / 1000)});`,
      'user_pref("dom.audiochannel.mutedByDefault", true);',
      'user_pref("media.autoplay.default", 5);',
      '',
    ].join('\n');
    fs.writeFileSync(prefsPath, defaultPrefs, 'utf-8');
  }

  // 4. Update file timestamps to the past
  try {
    fs.utimesSync(profileDir, pastDate, pastDate);
    fs.utimesSync(timesPath, pastDate, pastDate);
    if (fs.existsSync(compatPath)) fs.utimesSync(compatPath, pastDate, pastDate);
    if (fs.existsSync(prefsPath)) fs.utimesSync(prefsPath, pastDate, pastDate);
  } catch {}

  return { createdMs, firstUseMs };
}
