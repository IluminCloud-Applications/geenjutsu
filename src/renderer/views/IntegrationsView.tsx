import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useI18n } from '../context/I18nContext';
import { ProxySellerModal } from '../components/integrations/proxyseller/ProxySellerModal';
import { IntegrationConfig } from '../../types';

export const IntegrationsView: React.FC = () => {
  const { t } = useI18n();
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [proxySellerModalOpen, setProxySellerModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const fetchIntegrations = async () => {
    try {
      if (window.geenjutsuApi?.getIntegrations) {
        const list = await window.geenjutsuApi.getIntegrations();
        setIntegrations(list || []);
      }
    } catch (err) {
      console.error('[IntegrationsView] Error fetching integrations:', err);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const proxySellerConfig = integrations.find(i => i.serviceId === 'proxy-seller') || null;
  const isConfigured = proxySellerConfig?.status === 'connected' && !!proxySellerConfig?.apiKey;

  const page = (t as any).integrationsPage || {};
  const p = page.proxySeller || {};

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--card)] select-none">
      <div className="max-w-6xl mx-auto p-6 sm:p-8 lg:p-10 space-y-6">
        {/* Header bar - matching ReferralView */}
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/8 border border-red-500/20 flex items-center justify-center text-red-500">
              <i className="ri-puzzle-line text-base leading-none" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)] tracking-tight">
                {page.title || 'Integrações'}
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                {page.subtitle || 'Conecte e gerencie serviços integrados ao Geenjutsu'}
              </p>
            </div>
          </div>
        </div>

        {/* Grid: 3 cards per row matching RecommendedAppCard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
          {/* Card: Proxy Seller */}
          <div
            onClick={() => setProxySellerModalOpen(true)}
            className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-red-500/40 hover:bg-[var(--sidebar-secondary)]/70 p-5 transition-all duration-150 cursor-pointer group select-none shadow-xs"
          >
            <div className="space-y-3">
              {/* Top Header: Logo, Title, Status, Action indicator */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Logo with /integrations/proxy-seller.png */}
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    {!imgError ? (
                      <img
                        src="/integrations/proxy-seller.png"
                        alt={p.name || 'Proxy Seller'}
                        onError={() => setImgError(true)}
                        className="w-full h-full object-contain select-none pointer-events-none"
                      />
                    ) : (
                      <i className="ri-shield-flash-line text-2xl text-[var(--foreground)] group-hover:text-red-500 transition-colors" />
                    )}
                  </div>

                  {/* Name, Domain & Status */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[var(--foreground)] tracking-tight truncate group-hover:text-red-500 transition-colors">
                        {p.name || 'Proxy Seller'}
                      </h3>
                      {isConfigured ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-500 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {p.statusConfigured || 'Configurado'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--muted)] flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]/50" />
                          {p.statusNotConfigured || 'Não configurado'}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-[var(--muted)] truncate">
                      {p.domain || 'proxy-seller.com'}
                    </span>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="w-7 h-7 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] group-hover:text-red-500 group-hover:border-red-500/30 transition-colors flex-shrink-0">
                  <i className="ri-settings-4-line text-sm transition-transform duration-150 group-hover:scale-110" />
                </div>
              </div>

              {/* Tagline */}
              <div className="text-[12px] font-semibold text-[var(--foreground)] tracking-tight">
                {p.tagline || 'Proxies Residenciais & ISP de Alta Performance'}
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--muted)] leading-relaxed min-h-[44px]">
                {p.description ||
                  'Adquira e configure proxies residenciais rotativos para criação de contas e proxies ISP estáticos para contingência de BMs.'}
              </p>
            </div>

            {/* Footer action hint */}
            <div className="pt-3 mt-3 border-t border-[var(--border)]/50 flex items-center justify-between text-[11px] text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
              <span className="font-medium">
                {p.configureBtn || 'Configurar Proxy Seller'}
              </span>
              <i className="ri-arrow-right-line text-xs transition-transform duration-150 group-hover:translate-x-1 group-hover:text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Proxy Seller Modal */}
      <ProxySellerModal
        isOpen={proxySellerModalOpen}
        onClose={() => setProxySellerModalOpen(false)}
        integration={proxySellerConfig}
        onRefreshIntegration={fetchIntegrations}
      />
    </div>
  );
};
