import {
  ProxySellerBalance,
  ProxySellerPackage,
  ProxySellerResidentItem,
  ProxySellerIspItem,
} from '../../types/integration';

export class ProxySellerService {
  private static BASE_URL = 'https://proxy-seller.com/personal/api/v2';

  private static formatErrorMessage(errorObj: any): string {
    if (!errorObj) return 'Erro desconhecido na API do Proxy Seller';
    if (typeof errorObj === 'string') return errorObj;

    const msg = errorObj.message || errorObj.error || '';
    if (msg.includes('IP not allowed')) {
      return 'Seu endereço IP não está autorizado no Proxy Seller. Adicione seu IP à lista de permissões (Whitelist) nas configurações da API do Proxy Seller.';
    }
    if (msg.includes('Error api key') || msg.includes('Wrong api key')) {
      return 'Chave de API inválida. Verifique sua chave no painel do Proxy Seller.';
    }
    if (msg.includes('Request limit reached')) {
      return 'Limite de requisições excedido. Aguarde alguns instantes.';
    }
    return msg || 'Falha na comunicação com a API do Proxy Seller';
  }

  static async testConnection(apiKey: string): Promise<{ success: boolean; balance?: number; error?: string }> {
    try {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        return { success: false, error: 'Chave de API não informada' };
      }

      const res = await fetch(`${this.BASE_URL}/${trimmedKey}/balance/get`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });

      const json = await res.json() as any;

      if (json.status === 'success' && json.data) {
        const balance = typeof json.data.summ === 'number' ? json.data.summ : Number(json.data.summ || 0);
        return { success: true, balance };
      }

      const firstErr = json.errors?.[0];
      return { success: false, error: this.formatErrorMessage(firstErr) };
    } catch (err: any) {
      console.error('[ProxySellerService] testConnection error:', err);
      return { success: false, error: err.name === 'TimeoutError' ? 'Tempo de conexão esgotado (Timeout)' : (err.message || 'Falha ao conectar com Proxy Seller') };
    }
  }

  static async getBalance(apiKey: string): Promise<{ success: boolean; data?: ProxySellerBalance; error?: string }> {
    try {
      const trimmedKey = apiKey.trim();
      const res = await fetch(`${this.BASE_URL}/${trimmedKey}/balance/get`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      const json = await res.json() as any;
      if (json.status === 'success' && json.data) {
        return {
          success: true,
          data: {
            summ: Number(json.data.summ || 0),
            currency: json.data.currency || 'USD',
          },
        };
      }

      return { success: false, error: this.formatErrorMessage(json.errors?.[0]) };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao buscar saldo' };
    }
  }

  static async getResidentialInfo(apiKey: string): Promise<{
    success: boolean;
    package?: ProxySellerPackage;
    lists?: ProxySellerResidentItem[];
    error?: string;
  }> {
    try {
      const trimmedKey = apiKey.trim();
      // 1. Tentar buscar informações do pacote
      let pkg: ProxySellerPackage | undefined = undefined;
      try {
        const pkgRes = await fetch(`${this.BASE_URL}/${trimmedKey}/residential-proxy/get-package-information`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        const pkgJson = await pkgRes.json() as any;
        if (pkgJson.status === 'success' && pkgJson.data) {
          pkg = {
            remainingTrafficGb: Number(pkgJson.data.remaining_traffic_gb ?? pkgJson.data.traffic_left ?? 0),
            totalTrafficGb: Number(pkgJson.data.total_traffic_gb ?? pkgJson.data.traffic_limit ?? 0),
            expirationDate: pkgJson.data.expiration_date || pkgJson.data.expired_at,
            activeProxies: pkgJson.data.active_proxies || 0,
          };
        }
      } catch (e) {
        console.warn('[ProxySellerService] Falha ao obter get-package-information, tentando endpoint alternativo:', e);
      }

      // 2. Buscar listas ativas de endpoints residenciais
      let lists: ProxySellerResidentItem[] = [];
      const listRes = await fetch(`${this.BASE_URL}/${trimmedKey}/resident/lists`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      const listJson = await listRes.json() as any;
      if (listJson.status === 'success' && listJson.data?.items) {
        lists = listJson.data.items.map((item: any) => ({
          id: item.id,
          title: item.title,
          login: item.login,
          password: item.password,
          whitelist: item.whitelist,
          rotation: item.rotation,
          geo: item.geo,
          export: item.export,
        }));
      }

      return {
        success: true,
        package: pkg || { remainingTrafficGb: 0, totalTrafficGb: 0 },
        lists,
      };
    } catch (err: any) {
      console.error('[ProxySellerService] getResidentialInfo error:', err);
      return { success: false, error: err.message || 'Erro ao obter dados de proxies residenciais' };
    }
  }

  static async updateRotation(
    apiKey: string,
    listId: number,
    rotationSeconds: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const trimmedKey = apiKey.trim();
      const res = await fetch(`${this.BASE_URL}/${trimmedKey}/resident/list/rotation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          id: listId,
          rotation: rotationSeconds,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const json = await res.json() as any;
      if (json.status === 'success') {
        return { success: true, data: json.data };
      }
      return { success: false, error: this.formatErrorMessage(json.errors?.[0]) };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao atualizar rotação do proxy residencial' };
    }
  }

  static async getIspProxies(apiKey: string): Promise<{
    success: boolean;
    items?: ProxySellerIspItem[];
    error?: string;
  }> {
    try {
      const trimmedKey = apiKey.trim();
      let items: ProxySellerIspItem[] = [];
      const seenIps = new Set<string>();

      const parseProxyItem = (it: any): ProxySellerIspItem => {
        // Na API do Proxy Seller o campo é 'port_socks' (ex: 50101) e 'port_http' (ex: 50100)
        const socksPort = Number(it.port_socks || it.port_socks5 || it.portSocks || it.portSocks5 || 50101);
        const httpPort = Number(it.port_http || it.portHttp || 50100);
        const countryCode = (it.country_alpha3 || it.country_code || it.country || 'USA').toUpperCase();

        return {
          id: String(it.id || it.ip),
          ip: it.ip,
          portHttp: httpPort,
          portSocks5: socksPort,
          login: it.login,
          password: it.password,
          country: countryCode,
          expiredAt: it.date_end || it.expired_at || it.expiredAt,
          status: it.status || it.status_type || 'active',
        };
      };

      // 1. Busca proxies ISP
      try {
        const resIsp = await fetch(`${this.BASE_URL}/${trimmedKey}/proxy/list/isp`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        const jsonIsp = await resIsp.json() as any;
        if (jsonIsp.status === 'success' && Array.isArray(jsonIsp.data?.items)) {
          for (const it of jsonIsp.data.items) {
            if (it.ip && !seenIps.has(it.ip)) {
              seenIps.add(it.ip);
              items.push(parseProxyItem(it));
            }
          }
        }
      } catch (e) {
        console.warn('[ProxySellerService] Erro ao buscar lista ISP:', e);
      }

      // 2. Busca proxies IPv4 dedicados (para garantir que nenhum proxy ativo fique de fora)
      try {
        const resIpv4 = await fetch(`${this.BASE_URL}/${trimmedKey}/proxy/list/ipv4`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        const jsonIpv4 = await resIpv4.json() as any;
        if (jsonIpv4.status === 'success' && Array.isArray(jsonIpv4.data?.items)) {
          for (const it of jsonIpv4.data.items) {
            if (it.ip && !seenIps.has(it.ip)) {
              seenIps.add(it.ip);
              items.push(parseProxyItem(it));
            }
          }
        }
      } catch (e) {
        console.warn('[ProxySellerService] Erro ao buscar lista IPv4:', e);
      }

      return { success: true, items };
    } catch (err: any) {
      console.error('[ProxySellerService] getIspProxies error:', err);
      return { success: false, error: err.message || 'Erro ao buscar proxies ISP/IPv4' };
    }
  }

  static async checkCardSubscription(apiKey: string): Promise<{
    success: boolean;
    hasCard: boolean;
    error?: string;
  }> {
    try {
      const trimmedKey = apiKey.trim();
      const res = await fetch(`${this.BASE_URL}/${trimmedKey}/order/calc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sectionCode: 'isp',
          countryId: 'USA',
          periodId: '1m',
          quantity: 1,
          paymentId: 'paddle_subscription',
          customTargetName: 'All sites',
        }),
        signal: AbortSignal.timeout(10000),
      });

      const json = await res.json() as any;
      if (json.status === 'success') {
        return { success: true, hasCard: true };
      }

      const firstErr = json.errors?.[0]?.message || '';
      if (firstErr.toLowerCase().includes('not subscribed')) {
        return { success: true, hasCard: false };
      }

      return { success: false, hasCard: false, error: this.formatErrorMessage(json.errors?.[0]) };
    } catch (err: any) {
      return { success: false, hasCard: false, error: err.message || 'Erro ao verificar cartão' };
    }
  }

  static async buyProxy(
    apiKey: string,
    params: {
      sectionCode?: string;
      countryId?: string | number;
      periodId?: string;
      quantity?: number;
      protocol?: string;
      tarifId?: string | number;
      paymentId?: string;
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const trimmedKey = apiKey.trim();
      const sectionCode = params.sectionCode || (params.tarifId ? 'resident' : 'isp');
      const bodyPayload: any = {
        paymentId: params.paymentId || 'balance', // 'balance' ou 'paddle_subscription'
        customTargetName: 'All sites',
        ...params,
        sectionCode,
      };

      const res = await fetch(`${this.BASE_URL}/${trimmedKey}/order/make`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(15000),
      });

      const json = await res.json() as any;
      if (json.status === 'success') {
        return { success: true, data: json.data };
      }
      return { success: false, error: this.formatErrorMessage(json.errors?.[0]) };
    } catch (err: any) {
      return { success: false, error: err.message || 'Falha ao efetuar compra de proxy' };
    }
  }

  static async calculateOrder(
    apiKey: string,
    params: { sectionCode?: string; countryId: string; periodId: string; quantity?: number; paymentId?: string }
  ): Promise<{
    success: boolean;
    data?: {
      price: number;
      total: number;
      currency: string;
      discount?: number;
      balance?: number;
      warning?: string;
    };
    error?: string;
  }> {
    try {
      const trimmedKey = apiKey.trim();
      const res = await fetch(`${this.BASE_URL}/${trimmedKey}/order/calc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sectionCode: params.sectionCode || 'isp',
          countryId: params.countryId,
          periodId: params.periodId,
          quantity: params.quantity || 1,
          paymentId: params.paymentId || 'balance',
          customTargetName: 'All sites',
        }),
        signal: AbortSignal.timeout(10000),
      });

      const json = await res.json() as any;
      if (json.status === 'success' && json.data) {
        return {
          success: true,
          data: {
            price: Number(json.data.price || 0),
            total: Number(json.data.total || 0),
            currency: json.data.currency || 'USD',
            discount: Number(json.data.discount || 0),
            balance: Number(json.data.balance || 0),
            warning: json.data.warning || '',
          },
        };
      }
      return { success: false, error: this.formatErrorMessage(json.errors?.[0]) };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao calcular valor do pedido' };
    }
  }

  static async getReferenceList(apiKey: string, type: string = 'isp'): Promise<{
    success: boolean;
    countries?: Array<{ id: string | number; name: string; code?: string }>;
    periods?: Array<{ id: string; name: string }>;
    tarifs?: Array<{ id: number; name: string; trafficGb?: number; price?: number }>;
    error?: string;
  }> {
    try {
      const trimmedKey = apiKey.trim();
      const res = await fetch(`${this.BASE_URL}/${trimmedKey}/reference/list/${type}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json() as any;
      if (json.status === 'success' && json.data) {
        const item = Array.isArray(json.data.items) ? json.data.items[0] : json.data;
        const countries = Array.isArray(item?.country)
          ? item.country.map((c: any) => ({
              id: c.id,
              name: c.name,
              code: c.alpha2 || c.alpha3 || c.name,
            }))
          : [];
        const periods = Array.isArray(item?.period)
          ? item.period.map((p: any) => ({
              id: String(p.id),
              name: p.name,
            }))
          : [];
        const tarifs = Array.isArray(item?.tarifs || item?.tarif)
          ? (item.tarifs || item.tarif).map((t: any) => ({
              id: t.id,
              name: t.name || `${t.traffic} GB`,
              trafficGb: t.traffic,
              price: t.price,
            }))
          : [];

        return { success: true, countries, periods, tarifs };
      }
      return { success: false, error: this.formatErrorMessage(json.errors?.[0]) };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao carregar catálogo do Proxy Seller' };
    }
  }
}
