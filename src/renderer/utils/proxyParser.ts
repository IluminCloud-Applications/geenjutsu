export interface ParsedProxy {
  type?: 'http' | 'socks5';
  host: string;
  port: string;
  username?: string;
  password?: string;
}

/**
 * Parses raw proxy strings like:
 * - host:port:user:pass
 * - host;port;user;pass
 * - host:port;user:pass
 * - host:port
 * - host;port
 * - protocol://user:pass@host:port
 * - protocol://host:port
 * - user:pass@host:port
 *
 * Automatically detects protocol (HTTPS vs SOCKS5).
 * If no protocol is specified or for raw formats, defaults to 'socks5'.
 */
export function parseProxyString(raw: string): ParsedProxy | null {
  if (!raw || !raw.trim()) return null;
  let cleanStr = raw.trim();

  let type: 'http' | 'socks5' | undefined;

  // 1. Check protocol prefix (socks5://, socks://, socks4://, https://, http://, etc.)
  const schemeMatch =
    cleanStr.match(/^(socks[45]?h?|https?):\/\//i) ||
    cleanStr.match(/^(socks[45]?h?|https?):/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme.startsWith('socks')) {
      type = 'socks5';
    } else if (scheme.startsWith('http')) {
      type = 'http';
    }
    cleanStr = cleanStr.slice(schemeMatch[0].length).trim();
  }

  // Helper to extract trailing protocol tag (e.g. :socks5, ;socks5, :https, ;https)
  const extractTrailingProtocol = (tokens: string[]): string[] => {
    if (tokens.length >= 3) {
      const last = tokens[tokens.length - 1].toLowerCase().trim();
      if (['socks', 'socks5', 'socks4', 'socks5h'].includes(last)) {
        type = 'socks5';
        return tokens.slice(0, -1);
      }
      if (['http', 'https'].includes(last)) {
        type = 'http';
        return tokens.slice(0, -1);
      }
    }
    return tokens;
  };

  // 2. Check user:pass@host:port or user:pass@host;port
  if (cleanStr.includes('@')) {
    const atIndex = cleanStr.lastIndexOf('@');
    const authPart = cleanStr.slice(0, atIndex);
    const hostPortPart = cleanStr.slice(atIndex + 1);

    const authDelim = authPart.includes(';') && !authPart.includes(':') ? ';' : ':';
    const authParts = authPart.split(authDelim);

    const hostDelim = hostPortPart.includes(';') && !hostPortPart.includes(':') ? ';' : ':';
    let hostParts = hostPortPart.split(hostDelim).map(s => s.trim());
    hostParts = extractTrailingProtocol(hostParts);

    return {
      type: type ?? 'socks5',
      host: hostParts[0] || '',
      port: hostParts[1] || '',
      username: authParts[0]?.trim() || undefined,
      password: authParts.slice(1).join(authDelim).trim() || undefined,
    };
  }

  // 3. Semicolon format (e.g., host;port;user;pass or host:port;user:pass or host;port)
  if (cleanStr.includes(';')) {
    let semiParts = cleanStr.split(';').map(p => p.trim());
    semiParts = extractTrailingProtocol(semiParts);

    // Sub-format: host:port;user:pass
    if (semiParts.length === 2 && semiParts[0].includes(':')) {
      const [h, p] = semiParts[0].split(':').map(s => s.trim());
      const userParts = semiParts[1].split(':').map(s => s.trim());
      return {
        type: type ?? 'socks5',
        host: h || '',
        port: p || '',
        username: userParts[0] || undefined,
        password: userParts.length > 1 ? userParts.slice(1).join(':') : undefined,
      };
    }

    if (semiParts.length >= 2) {
      const host = semiParts[0] || '';
      const port = semiParts[1] || '';
      const username = semiParts[2] || undefined;
      const password = semiParts.length > 3 ? semiParts.slice(3).join(';') : undefined;

      return {
        type: type ?? 'socks5',
        host,
        port,
        username,
        password,
      };
    }
  }

  // 4. Colon format: host:port:user:pass or host:port
  if (cleanStr.includes(':')) {
    let colonParts = cleanStr.split(':').map(p => p.trim());
    colonParts = extractTrailingProtocol(colonParts);

    if (colonParts.length >= 2) {
      const host = colonParts[0] || '';
      const port = colonParts[1] || '';
      const username = colonParts[2] || undefined;
      const password = colonParts.length > 3 ? colonParts.slice(3).join(':') : undefined;

      return {
        type: type ?? 'socks5',
        host,
        port,
        username,
        password,
      };
    }
  }

  return {
    type: type ?? 'socks5',
    host: cleanStr,
    port: '',
  };
}

/**
 * Builds a string in format host:port:user:pass or host:port
 */
export function buildProxyString(
  host: string,
  port: string,
  username?: string,
  password?: string
): string {
  if (!host.trim()) return '';
  let result = port.trim() ? `${host.trim()}:${port.trim()}` : host.trim();
  if (username?.trim()) {
    result += `:${username.trim()}`;
    if (password?.trim()) {
      result += `:${password.trim()}`;
    }
  }
  return result;
}

/**
 * Returns flag emoji for country code (supports all ISO 3166-1 alpha-2 codes)
 */
export function getCountryFlag(code?: string): string {
  if (!code || code.trim().length !== 2) return '🌐';
  const upper = code.trim().toUpperCase();
  if (upper === 'US') return '🇺🇸';
  if (upper === 'BR') return '🇧🇷';
  if (upper === 'UK') return '🇬🇧';
  try {
    const codePoints = [...upper].map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return '🌐';
  }
}

/**
 * Automatically detects country and code from host / IP.
 * Defaults cleanly to Estados Unidos (US) or Brasil (BR) when matched,
 * and supports any international proxy.
 */
export function detectCountryFromHost(host: string): { country: string; countryCode: string } {
  if (!host || !host.trim()) {
    return { country: '', countryCode: '' };
  }
  const clean = host.trim().toLowerCase();

  if (clean.endsWith('.br') || clean.includes('.com.br')) {
    return { country: 'Brasil', countryCode: 'BR' };
  }
  if (clean.endsWith('.de')) return { country: 'Alemanha', countryCode: 'DE' };
  if (clean.endsWith('.uk') || clean.endsWith('.co.uk')) return { country: 'Reino Unido', countryCode: 'GB' };
  if (clean.endsWith('.ca')) return { country: 'Canadá', countryCode: 'CA' };
  if (clean.endsWith('.fr')) return { country: 'França', countryCode: 'FR' };
  if (clean.endsWith('.jp')) return { country: 'Japão', countryCode: 'JP' };
  if (clean.endsWith('.es')) return { country: 'Espanha', countryCode: 'ES' };
  if (clean.endsWith('.pt')) return { country: 'Portugal', countryCode: 'PT' };

  // Check IP ranges for Brazilian, European, etc allocations
  const firstOctet = parseInt(clean.split('.')[0], 10);
  if (!isNaN(firstOctet)) {
    if ([177, 179, 186, 187, 189, 191, 200, 201].includes(firstOctet)) {
      return { country: 'Brasil', countryCode: 'BR' };
    }
    if ([138, 144, 178, 185, 188, 194].includes(firstOctet)) {
      return { country: 'Alemanha', countryCode: 'DE' };
    }
    if ([151, 80, 82].includes(firstOctet)) {
      return { country: 'Reino Unido', countryCode: 'GB' };
    }
  }

  // Without active test or matched TLD/range, return empty
  return { country: '', countryCode: '' };
}
