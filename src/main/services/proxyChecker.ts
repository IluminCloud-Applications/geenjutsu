import http from 'http';
import https from 'https';
import tls from 'tls';
import { SocksClient } from 'socks';

export interface ProxyCheckInput {
  type?: 'http' | 'socks5' | 'socks4' | 'direct';
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

export interface ProxyCheckResult {
  success: boolean;
  ip?: string;
  isProxy: boolean;
  proxyType?: string; // 'Residencial', 'Datacenter', 'Proxy/VPN', 'Business'
  operator?: string;
  provider?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  ping?: number;
  message?: string;
  error?: string;
}

export const COUNTRY_NAMES_PT: Record<string, string> = {
  BR: 'Brasil',
  US: 'Estados Unidos',
  PT: 'Portugal',
  ES: 'Espanha',
  FR: 'França',
  DE: 'Alemanha',
  GB: 'Reino Unido',
  UK: 'Reino Unido',
  IT: 'Itália',
  CA: 'Canadá',
  AR: 'Argentina',
  MX: 'México',
  CL: 'Chile',
  CO: 'Colômbia',
  PE: 'Peru',
  UY: 'Uruguai',
  PY: 'Paraguai',
  JP: 'Japão',
  CN: 'China',
  AU: 'Austrália',
  NZ: 'Nova Zelândia',
  RU: 'Rússia',
  NL: 'Holanda',
  BE: 'Bélgica',
  CH: 'Suíça',
  AT: 'Áustria',
  SE: 'Suécia',
  NO: 'Noruega',
  DK: 'Dinamarca',
  FI: 'Finlândia',
  IE: 'Irlanda',
  PL: 'Polônia',
  CZ: 'República Tcheca',
  UA: 'Ucrânia',
  TR: 'Turquia',
  IN: 'Índia',
  ZA: 'África do Sul',
  KR: 'Coreia do Sul',
  SG: 'Singapura',
  HK: 'Hong Kong',
  IL: 'Israel',
  AE: 'Emirados Árabes',
  SA: 'Arábia Saudita',
  EG: 'Egito',
  MA: 'Marrocos',
  GR: 'Grécia',
  RO: 'Romênia',
  HU: 'Hungria',
  BG: 'Bulgária',
  HR: 'Croácia',
};

export class ProxyChecker {
  /**
   * Realiza teste de conexão e validação de reputação antifraude.
   */
  public static async testProxy(input: ProxyCheckInput): Promise<ProxyCheckResult> {
    const isDirect = !input.host || input.type === 'direct';
    const host = input.host?.trim() || '';
    const port = isDirect ? 0 : parseInt(String(input.port), 10);

    if (!isDirect && (!host || isNaN(port) || port <= 0 || port > 65535)) {
      return {
        success: false,
        isProxy: false,
        message: 'Host ou porta inválidos.',
        error: 'Host ou porta inválidos.',
      };
    }

    const type = (input.type || 'socks5').toLowerCase() as 'http' | 'socks5' | 'socks4' | 'direct';
    const timeoutMs = input.timeoutMs || 10000;
    const username = input.username?.trim();
    const password = input.password?.trim();

    const startTime = Date.now();

    try {
      // 1. Obtém o IP real de saída através do proxy ou direto
      const exitIp = isDirect
        ? await this.getExitIpDirect(timeoutMs)
        : await this.getExitIpThroughProxy({ host, port, type, username, password, timeoutMs });

      if (!exitIp) {
        return {
          success: false,
          isProxy: false,
          message: 'Não foi possível determinar o IP de saída.',
          error: 'Resposta vazia do serviço de IP.',
        };
      }

      const ping = Math.max(1, Date.now() - startTime);

      // 2. Consulta bases antifraude públicas (proxycheck.io + fallback ip-api)
      const rep = await this.queryReputation(exitIp, timeoutMs);

      const countryCode = (rep.countryCode || '').toUpperCase();
      const country = COUNTRY_NAMES_PT[countryCode] || rep.country || 'Desconhecido';

      const isProxy = rep.isProxy;
      const message = isProxy
        ? `Proxy/VPN Detectado! (Operador: ${rep.operator || rep.proxyType || 'Desconhecido'})`
        : !isDirect
        ? 'IP Limpo (Proxy residencial sem detecção pública)'
        : 'IP Limpo (Conexão direta)';

      return {
        success: true,
        ip: exitIp,
        isProxy,
        proxyType: rep.proxyType || (isProxy ? 'Proxy/VPN' : 'Residencial'),
        operator: rep.operator,
        provider: rep.provider,
        city: rep.city,
        region: rep.region,
        country,
        countryCode,
        ping,
        message,
      };
    } catch (err: any) {
      return {
        success: false,
        isProxy: false,
        message: 'Falha ao conectar através do proxy.',
        error: err?.message || 'Falha de conexão com o proxy',
      };
    }
  }

  /**
   * Obtém IP de saída através do proxy com fallback inteligente de protocolo.
   */
  private static async getExitIpThroughProxy(opts: {
    host: string;
    port: number;
    type: 'http' | 'socks5' | 'socks4' | 'direct';
    username?: string;
    password?: string;
    timeoutMs: number;
  }): Promise<string> {
    const isSocks = opts.type === 'socks5' || opts.type === 'socks4';

    if (isSocks) {
      try {
        return await this.getExitIpViaSocks(opts);
      } catch (firstErr) {
        // Fallback: tentar HTTP CONNECT se socks falhou
        try {
          return await this.getExitIpViaHttp({
            host: opts.host,
            port: opts.port,
            username: opts.username,
            password: opts.password,
            timeoutMs: opts.timeoutMs,
          });
        } catch {
          throw firstErr;
        }
      }
    } else {
      try {
        return await this.getExitIpViaHttp({
          host: opts.host,
          port: opts.port,
          username: opts.username,
          password: opts.password,
          timeoutMs: opts.timeoutMs,
        });
      } catch (firstErr) {
        // Fallback: tentar SOCKS5 se HTTP falhou
        try {
          return await this.getExitIpViaSocks({ ...opts, type: 'socks5' });
        } catch {
          throw firstErr;
        }
      }
    }
  }

  private static getExitIpViaSocks(opts: {
    host: string;
    port: number;
    type: 'socks5' | 'socks4' | 'http' | 'direct';
    username?: string;
    password?: string;
    timeoutMs: number;
  }): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Timeout ao conectar via SOCKS'));
        }
      }, opts.timeoutMs);

      try {
        const info = await SocksClient.createConnection({
          proxy: {
            host: opts.host,
            port: opts.port,
            type: opts.type === 'socks4' ? 4 : 5,
            userId: opts.username || '',
            password: opts.password || '',
          },
          command: 'connect',
          destination: { host: 'api.ipify.org', port: 80 },
          timeout: opts.timeoutMs,
        });

        const req = http.get(
          {
            host: 'api.ipify.org',
            path: '/?format=json',
            createConnection: () => info.socket,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Geenjutsu/1.0',
            },
          },
          (res) => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              try {
                const parsed = JSON.parse(data);
                if (parsed.ip) {
                  resolve(parsed.ip.trim());
                } else {
                  reject(new Error('Resposta inesperada da verificação de IP'));
                }
              } catch {
                reject(new Error('Falha ao processar IP retornado'));
              }
            });
          }
        );

        req.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    });
  }

  private static getExitIpViaHttp(opts: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    timeoutMs: number;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Timeout ao conectar via HTTP'));
        }
      }, opts.timeoutMs);

      const authHeader = opts.username
        ? 'Basic ' + Buffer.from(`${opts.username}:${opts.password || ''}`).toString('base64')
        : undefined;

      const connectReq = http.request({
        host: opts.host,
        port: opts.port,
        method: 'CONNECT',
        path: 'api.ipify.org:80',
        headers: authHeader ? { 'Proxy-Authorization': authHeader } : {},
      });

      connectReq.on('connect', (res, socket) => {
        if (res.statusCode !== 200) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            socket.destroy();
            return reject(new Error(`Túnel HTTP rejeitado com status ${res.statusCode}`));
          }
        }

        const getReq = http.get(
          {
            host: 'api.ipify.org',
            path: '/?format=json',
            createConnection: () => socket,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Geenjutsu/1.0',
            },
          },
          (resGet) => {
            let data = '';
            resGet.on('data', chunk => (data += chunk));
            resGet.on('end', () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              try {
                const parsed = JSON.parse(data);
                if (parsed.ip) {
                  resolve(parsed.ip.trim());
                } else {
                  reject(new Error('Resposta inesperada da verificação de IP'));
                }
              } catch {
                reject(new Error('Falha ao processar IP retornado'));
              }
            });
          }
        );

        getReq.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
      });

      connectReq.on('error', (err) => {
        // Fallback: direct GET through proxy
        if (!settled) {
          const directReq = http.get(
            {
              host: opts.host,
              port: opts.port,
              path: 'http://api.ipify.org/?format=json',
              headers: {
                ...(authHeader ? { 'Proxy-Authorization': authHeader } : {}),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Geenjutsu/1.0',
              },
            },
            (resDirect) => {
              let data = '';
              resDirect.on('data', chunk => (data += chunk));
              resDirect.on('end', () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.ip) {
                    resolve(parsed.ip.trim());
                  } else {
                    reject(new Error('Resposta inesperada'));
                  }
                } catch {
                  reject(err);
                }
              });
            }
          );
          directReq.on('error', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(err);
            }
          });
        }
      });

      connectReq.end();
    });
  }

  private static getExitIpDirect(timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get('http://api.ipify.org/?format=json', { timeout: timeoutMs }, (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.ip?.trim());
          } catch {
            reject(new Error('Falha ao obter IP direto'));
          }
        });
      });
      req.on('error', reject);
    });
  }

  /**
   * Consulta bases antifraude públicas para detectar se o IP é proxy/VPN/datacenter.
   */
  private static async queryReputation(
    ip: string,
    timeoutMs: number
  ): Promise<{
    isProxy: boolean;
    proxyType?: string;
    operator?: string;
    provider?: string;
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
  }> {
    // 1. Primário: proxycheck.io
    try {
      const checkUrl = `https://proxycheck.io/v2/${ip}?vpn=1&asn=1`;
      const data = await this.fetchJson(checkUrl, Math.min(timeoutMs, 5000));
      if (data && data.status === 'ok' && data[ip]) {
        const ipInfo = data[ip];
        const isProxy = ipInfo.proxy === 'yes';
        return {
          isProxy,
          proxyType: isProxy ? (ipInfo.type || 'Proxy/VPN') : (ipInfo.type || 'Residencial'),
          operator: ipInfo.operator?.name || ipInfo.asn || undefined,
          provider: ipInfo.provider || ipInfo.organisation || undefined,
          city: ipInfo.city || undefined,
          region: ipInfo.region || undefined,
          country: ipInfo.country || undefined,
          countryCode: ipInfo.isocode || undefined,
        };
      }
    } catch {
      // Fallback
    }

    // 2. Fallback: ip-api.com
    try {
      const fallbackUrl = `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,isp,org,as,asname,proxy,hosting,query`;
      const data = await this.fetchJson(fallbackUrl, Math.min(timeoutMs, 5000));
      if (data && data.status === 'success') {
        const isProxy = Boolean(data.proxy || data.hosting);
        return {
          isProxy,
          proxyType: data.proxy ? 'Proxy/VPN' : data.hosting ? 'Datacenter' : 'Residencial',
          operator: data.asname || data.as || undefined,
          provider: data.isp || data.org || undefined,
          city: data.city || undefined,
          region: data.regionName || undefined,
          country: data.country || undefined,
          countryCode: data.countryCode || undefined,
        };
      }
    } catch {
      // ignore
    }

    return { isProxy: false };
  }

  private static fetchJson(urlStr: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const isHttps = urlStr.startsWith('https:');
      const client = isHttps ? https : http;

      const req = client.get(urlStr, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error(`Timeout ao consultar ${urlStr}`));
      });
    });
  }

  /**
   * Consulta dados e reputação de um IP público diretamente.
   */
  public static async lookupIp(ip: string, timeoutMs: number = 8000): Promise<ProxyCheckResult> {
    const cleanIp = (ip || '').trim();
    if (!cleanIp) {
      return { success: false, isProxy: false, error: 'IP inválido' };
    }
    try {
      const rep = await this.queryReputation(cleanIp, timeoutMs);
      const countryCode = (rep.countryCode || '').toUpperCase();
      const country = COUNTRY_NAMES_PT[countryCode] || rep.country || 'Desconhecido';
      return {
        success: true,
        ip: cleanIp,
        isProxy: rep.isProxy,
        proxyType: rep.proxyType,
        operator: rep.operator,
        provider: rep.provider,
        city: rep.city,
        region: rep.region,
        country,
        countryCode,
      };
    } catch (err: any) {
      return { success: false, isProxy: false, error: err?.message || 'Falha ao consultar IP' };
    }
  }
}
