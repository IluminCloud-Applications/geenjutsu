export interface ProxyItem {
  id: string;
  name?: string; // Identification name (optional)
  type: 'http' | 'socks5';
  host: string;
  port: string;
  username?: string;
  password?: string;
  country?: string; // e.g. "Estados Unidos", "Brasil"
  countryCode?: string; // e.g. "US", "BR"
  tags: string[];
  status: 'active' | 'failed' | 'unchecked';
  ping?: number; // in ms
  lastCheckedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface ProxyCreateInput {
  name?: string;
  type: 'http' | 'socks5';
  host: string;
  port: string;
  username?: string;
  password?: string;
  country?: string;
  countryCode?: string;
  tags?: string[];
}

export interface ProxyUpdateInput {
  id: string;
  name?: string;
  type?: 'http' | 'socks5';
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  country?: string;
  countryCode?: string;
  tags?: string[];
  status?: 'active' | 'failed' | 'unchecked';
  ping?: number;
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

