import { FingerprintConfig, ProxyConfig } from '../../types';
import { detectCountryFromHost } from './proxyParser';

const COUNTRY_TIMEZONE_MAP: Record<string, { timezone: string; language: string }> = {
  US: { timezone: 'America/New_York', language: 'en-US,en;q=0.9' },
  BR: { timezone: 'America/Sao_Paulo', language: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' },
  DE: { timezone: 'Europe/Berlin', language: 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' },
  GB: { timezone: 'Europe/London', language: 'en-GB,en;q=0.9,en-US;q=0.8' },
  UK: { timezone: 'Europe/London', language: 'en-GB,en;q=0.9,en-US;q=0.8' },
  FR: { timezone: 'Europe/Paris', language: 'fr-FR,fr;q=0.9,en-US;q=0.8' },
  ES: { timezone: 'Europe/Madrid', language: 'es-ES,es;q=0.9,en-US;q=0.8' },
  PT: { timezone: 'Europe/Lisbon', language: 'pt-PT,pt;q=0.9,en-US;q=0.8' },
  CA: { timezone: 'America/Toronto', language: 'en-CA,en;q=0.9,en-US;q=0.8' },
  JP: { timezone: 'Asia/Tokyo', language: 'ja-JP,ja;q=0.9,en-US;q=0.8' },
  IT: { timezone: 'Europe/Rome', language: 'it-IT,it;q=0.9,en-US;q=0.8' },
  NL: { timezone: 'Europe/Amsterdam', language: 'nl-NL,nl;q=0.9,en-US;q=0.8' },
  AU: { timezone: 'Australia/Sydney', language: 'en-AU,en;q=0.9,en-US;q=0.8' },
  RU: { timezone: 'Europe/Moscow', language: 'ru-RU,ru;q=0.9,en-US;q=0.8' },
  IN: { timezone: 'Asia/Kolkata', language: 'en-IN,en;q=0.9,hi;q=0.8' },
  MX: { timezone: 'America/Mexico_City', language: 'es-MX,es;q=0.9,en-US;q=0.8' },
  AR: { timezone: 'America/Argentina/Buenos_Aires', language: 'es-AR,es;q=0.9,en-US;q=0.8' },
  CO: { timezone: 'America/Bogota', language: 'es-CO,es;q=0.9,en-US;q=0.8' },
};

export function getTimezoneAndLanguageForCountry(countryCode?: string): { timezone: string; language: string } {
  if (!countryCode) return { timezone: 'America/New_York', language: 'en-US,en;q=0.9' };
  const upper = countryCode.toUpperCase();
  return COUNTRY_TIMEZONE_MAP[upper] || { timezone: 'America/New_York', language: 'en-US,en;q=0.9' };
}

export function getUserLocalTimezoneAndLanguage(): { timezone: string; language: string } {
  let timezone = 'America/Sao_Paulo';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {}

  const lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'pt-BR';
  const language = `${lang},pt;q=0.9,en-US;q=0.8,en;q=0.7`;
  return { timezone, language };
}

/**
 * Builds realistic Camoufox / Firefox user agents according to target OS
 */
export function getStealthUserAgent(os: 'windows' | 'mac' | 'linux'): string {
  switch (os) {
    case 'mac':
      return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0';
    case 'linux':
      return 'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0';
    case 'windows':
    default:
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
  }
}

/**
 * Generates an aged profile timestamp so profiles do not appear brand new
 */
export function generateAgedTimestamp(
  minDays = 35,
  maxDays = 90
): { createdAt: number; updatedAt: number; lastLaunchedAt: number } {
  const daysAgo = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
  const createdAt = Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 3600000 * 12);
  const updatedAt = createdAt + Math.floor(Math.random() * 86400000 * 10);
  const lastLaunchedAt = Date.now() - (Math.floor(Math.random() * 3) + 1) * 86400000;
  return { createdAt, updatedAt, lastLaunchedAt };
}

/**
 * Generates fingerprint configuration according to OS and proxy setting:
 * - Direct: Uses user's local timezone & language
 * - Proxy: Identifies location/country of proxy and aligns timezone & language to proxy location
 */
export function generateProfileFingerprint(
  os: 'windows' | 'mac' | 'linux',
  proxy?: ProxyConfig
): FingerprintConfig {
  const userAgent = getStealthUserAgent(os);

  let timezone: string;
  let language: string;

  if (proxy && proxy.type !== 'direct' && (proxy.host || proxy.ipDisplay)) {
    const host = proxy.host || (proxy.ipDisplay ? proxy.ipDisplay.split(':')[0] : '');
    const detectedCountry = proxy.countryCode || detectCountryFromHost(host).countryCode || 'US';
    const geoInfo = getTimezoneAndLanguageForCountry(detectedCountry);
    timezone = geoInfo.timezone;
    language = geoInfo.language;
  } else {
    const local = getUserLocalTimezoneAndLanguage();
    timezone = local.timezone;
    language = local.language;
  }

  const resolutionsByOs: Record<string, string[]> = {
    windows: ['1920x1080', '2560x1440', '1920x1080'],
    mac: ['1920x1080', '1440x900', '2560x1440'],
    linux: ['1920x1080', '1920x1080'],
  };
  const osResolutions = resolutionsByOs[os] || ['1920x1080'];
  const resolution = osResolutions[Math.floor(Math.random() * osResolutions.length)];

  return {
    userAgent,
    canvas: 'noise',
    webgl: 'noise',
    audio: 'noise',
    webRTC: 'altered',
    resolution,
    timezone,
    language,
  };
}
