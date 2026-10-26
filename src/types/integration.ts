export type IntegrationId = 'proxy-seller' | 'sms-activate' | '2captcha' | 'webhooks';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'idle';

export interface IntegrationConfig {
  serviceId: string;
  apiKey: string;
  status: IntegrationStatus;
  cachedBalance?: number;
  cachedData?: any;
  settings?: Record<string, any>;
  lastSyncAt?: number;
  updatedAt: number;
}

export interface ProxySellerBalance {
  summ: number;
  currency?: string;
}

export interface ProxySellerPackage {
  remainingTrafficGb: number;
  totalTrafficGb?: number;
  expirationDate?: string;
  activeProxies?: number;
}

export interface ProxySellerResidentItem {
  id: number;
  title: string;
  login: string;
  password: string;
  whitelist?: string;
  rotation: string | number;
  geo?: {
    country: string;
    region?: string;
    city?: string;
    isp?: string;
  };
  export?: {
    ports: number;
    ext: string;
  };
}

export interface ProxySellerIspItem {
  id: string;
  ip: string;
  portHttp?: number;
  portSocks5?: number;
  login?: string;
  password?: string;
  country: string;
  expiredAt?: string;
  status?: string;
}

export interface ProxySellerGenerateEndpointInput {
  country: string;
  rotation: number; // -1 for sticky, 0 for request, 600 for 10min, etc.
  protocol?: 'http' | 'socks5';
  title?: string;
}

export interface ProxySellerOrderInput {
  countryId?: string;
  periodId?: string;
  quantity?: number;
  protocol?: 'HTTP' | 'SOCKS5';
  tarifId?: number; // for residential GB package
}
