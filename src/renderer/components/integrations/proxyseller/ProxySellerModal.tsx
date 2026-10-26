import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useI18n } from '../../../context/I18nContext';
import { useProfiles } from '../../../context/ProfileContext';
import { openExternalLink } from '../../../utils/externalLinks';
import { Button } from '../../ui/Button';
import { Select, SelectOption } from '../../ui/Select';
import {
  IntegrationConfig,
  ProxySellerBalance,
  ProxySellerPackage,
  ProxySellerResidentItem,
  ProxySellerIspItem,
} from '../../../../types';

interface ProxySellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: IntegrationConfig | null;
  onRefreshIntegration: () => void;
}

const AFFILIATE_SIGNUP_URL = 'https://proxy-seller.com/?partner=02IEM6EL37OSRR';
const AFFILIATE_BALANCE_URL = 'https://proxy-seller.com/personal/balance?partner=02IEM6EL37OSRR';

const RESIDENTIAL_COUNTRIES_OPTIONS: SelectOption[] = [
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'GB', label: '🇬🇧 Reino Unido' },
  { value: 'DE', label: '🇩🇪 Alemanha' },
  { value: 'CA', label: '🇨🇦 Canadá' },
  { value: 'FR', label: '🇫🇷 França' },
  { value: 'ES', label: '🇪🇸 Espanha' },
  { value: 'PT', label: '🇵🇹 Portugal' },
];

const ROTATION_OPTIONS: SelectOption[] = [
  { value: '600', label: 'A cada 10 minutos (Recomendado)' },
  { value: '1800', label: 'A cada 30 minutos' },
  { value: '-1', label: 'Sessão Fixa (Sticky)' },
  { value: '0', label: 'A cada Requisição HTTP' },
];

// Valores reais oficiais confirmados com a API do Proxy Seller
const RESIDENTIAL_GB_PACKAGES = [
  { gb: '1', tarifId: 'pay-as-go', price: 3.5, label: '1 GB', priceLabel: '$3.50 USD' },
  { gb: '3', tarifId: '3-gb', price: 9.0, label: '3 GB', priceLabel: '$9.00 USD' },
  { gb: '10', tarifId: '10-gb', price: 29.0, label: '10 GB', priceLabel: '$29.00 USD' },
  { gb: '25', tarifId: '25-gb', price: 65.0, label: '25 GB', priceLabel: '$65.00 USD' },
];

// Períodos oficiais de ISP
const ISP_PERIOD_OPTIONS: SelectOption[] = [
  { value: '1m', label: '1 Mês' },
  { value: '2m', label: '2 Meses' },
  { value: '3m', label: '3 Meses' },
  { value: '6m', label: '6 Meses' },
];

// Países com suporte a ISP no Proxy Seller (Códigos de 3 letras da API v2)
const ISP_COUNTRIES_OPTIONS: SelectOption[] = [
  { value: 'USA', label: '🇺🇸 Estados Unidos' },
  { value: 'BRA', label: '🇧🇷 Brasil' },
  { value: 'CAN', label: '🇨🇦 Canadá' },
  { value: 'GBR', label: '🇬🇧 Reino Unido' },
  { value: 'DEU', label: '🇩🇪 Alemanha' },
  { value: 'FRA', label: '🇫🇷 França' },
  { value: 'ESP', label: '🇪🇸 Espanha' },
  { value: 'PRT', label: '🇵🇹 Portugal' },
  { value: 'ITA', label: '🇮🇹 Itália' },
  { value: 'NLD', label: '🇳🇱 Holanda' },
  { value: 'JPN', label: '🇯🇵 Japão' },
];

export const ProxySellerModal: React.FC<ProxySellerModalProps> = ({
  isOpen,
  onClose,
  integration,
  onRefreshIntegration,
}) => {
  const { t } = useI18n();
  const { addProxy, proxies } = useProfiles();
  const p = (t as any).integrationsPage?.proxySeller || {};

  const [activeTab, setActiveTab] = useState<'connection' | 'residential' | 'isp'>('connection');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Live account state
  const [balance, setBalance] = useState<ProxySellerBalance | null>(null);
  const [residentialPkg, setResidentialPkg] = useState<ProxySellerPackage | null>(null);
  const [residentLists, setResidentLists] = useState<ProxySellerResidentItem[]>([]);
  const [ispList, setIspList] = useState<ProxySellerIspItem[]>([]);

  // Payment method state (Card vs Balance)
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'paddle_subscription'>(
    (integration?.settings?.paymentMethod as any) || 'balance'
  );
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [cardLoading, setCardLoading] = useState(false);

  // Residential state
  const [selectedCountry, setSelectedCountry] = useState('BR');
  const [rotationSec, setRotationSec] = useState('600');
  const [genLoading, setGenLoading] = useState(false);

  // Buy GB tab state
  const [showBuyGb, setShowBuyGb] = useState(false);
  const [selectedResGb, setSelectedResGb] = useState<string>('1');
  const [buyingResTraffic, setBuyingResTraffic] = useState(false);

  // ISP state
  const [ispBuyCountry, setIspBuyCountry] = useState('USA');
  const [ispBuyPeriod, setIspBuyPeriod] = useState('1m');
  const [buyingIsp, setBuyingIsp] = useState(false);
  const [syncIspLoading, setSyncIspLoading] = useState(false);

  // ISP Live Price Consultation
  const [ispCalcPrice, setIspCalcPrice] = useState<{ total: number; discount: number; price: number } | null>(null);
  const [ispCalcLoading, setIspCalcLoading] = useState(false);

  // Single ISP Add Modal state
  const [ispToAdd, setIspToAdd] = useState<ProxySellerIspItem | null>(null);
  const [ispCustomName, setIspCustomName] = useState('');
  const [isLocallyConnected, setIsLocallyConnected] = useState<boolean | null>(null);

  const isConnected =
    isLocallyConnected !== null
      ? isLocallyConnected
      : integration?.status === 'connected' && !!integration?.apiKey;

  useEffect(() => {
    setIsLocallyConnected(null);
  }, [integration]);

  useEffect(() => {
    if (integration?.apiKey) {
      setApiKey(integration.apiKey);
    }
    if (integration?.settings?.paymentMethod) {
      setPaymentMethod(integration.settings.paymentMethod);
    }
  }, [integration]);

  useEffect(() => {
    if (isOpen && isConnected && integration?.apiKey) {
      loadAccountData(integration.apiKey);
    }
  }, [isOpen, isConnected, integration?.apiKey]);

  // Consulta dinâmica de preço do ISP via API
  useEffect(() => {
    if (!isConnected || !integration?.apiKey || activeTab !== 'isp') return;

    let isMounted = true;
    const fetchIspPrice = async () => {
      setIspCalcLoading(true);
      try {
        if (window.geenjutsuApi?.calculateProxySellerOrder) {
          const res = await window.geenjutsuApi.calculateProxySellerOrder(
            { sectionCode: 'isp', countryId: ispBuyCountry, periodId: ispBuyPeriod, quantity: 1, paymentId: paymentMethod },
            integration.apiKey
          );
          if (isMounted && res.success && res.data) {
            setIspCalcPrice({
              total: res.data.total,
              discount: res.data.discount || 0,
              price: res.data.price,
            });
          }
        }
      } catch (err) {
        console.error('[ProxySellerModal] Error calculating ISP price:', err);
      } finally {
        if (isMounted) setIspCalcLoading(false);
      }
    };

    fetchIspPrice();
    return () => {
      isMounted = false;
    };
  }, [isConnected, integration?.apiKey, activeTab, ispBuyCountry, ispBuyPeriod, paymentMethod]);

  const loadAccountData = async (key: string) => {
    try {
      if (window.geenjutsuApi?.getProxySellerBalance) {
        const balRes = await window.geenjutsuApi.getProxySellerBalance(key);
        if (balRes.success && balRes.data) {
          setBalance(balRes.data);
        }
      }
      if (window.geenjutsuApi?.checkProxySellerCard) {
        setCardLoading(true);
        const cardRes = await window.geenjutsuApi.checkProxySellerCard(key);
        if (cardRes.success) {
          setHasCard(cardRes.hasCard);
          // Se o usuário ainda não tiver preferência salva e possui cartão ativo, ativa cartão como padrão
          if (!integration?.settings?.paymentMethod && cardRes.hasCard) {
            setPaymentMethod('paddle_subscription');
          }
        }
        setCardLoading(false);
      }
      if (window.geenjutsuApi?.getProxySellerResidentialInfo) {
        const resInfo = await window.geenjutsuApi.getProxySellerResidentialInfo(key);
        if (resInfo.success) {
          if (resInfo.package) setResidentialPkg(resInfo.package);
          if (resInfo.lists) setResidentLists(resInfo.lists);
        }
      }
      if (window.geenjutsuApi?.getProxySellerIspProxies) {
        const ispRes = await window.geenjutsuApi.getProxySellerIspProxies(key);
        if (ispRes.success && ispRes.items) {
          setIspList(ispRes.items);
        }
      }
    } catch (err) {
      console.error('[ProxySellerModal] Error loading account data:', err);
    }
  };

  const handleSelectPaymentMethod = async (method: 'balance' | 'paddle_subscription') => {
    setPaymentMethod(method);
    const key = apiKey.trim() || integration?.apiKey;
    if (!key) return;
    try {
      if (window.geenjutsuApi?.saveIntegration) {
        await window.geenjutsuApi.saveIntegration({
          serviceId: 'proxy-seller',
          apiKey: key,
          status: 'connected',
          cachedBalance: balance?.summ || integration?.cachedBalance || 0,
          settings: {
            ...(integration?.settings || {}),
            paymentMethod: method,
          },
        });
        onRefreshIntegration();
      }
    } catch (err) {
      console.error('[ProxySellerModal] Error saving payment method:', err);
    }
  };

  const handleTestAndSave = async () => {
    if (!apiKey.trim()) {
      setErrorMsg('Por favor, informe a chave de API.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (window.geenjutsuApi?.testProxySellerConnection) {
        const testRes = await window.geenjutsuApi.testProxySellerConnection(apiKey.trim());
        if (!testRes.success) {
          setErrorMsg(testRes.error || 'Falha ao validar chave de API.');
          setLoading(false);
          return;
        }

        if (window.geenjutsuApi?.saveIntegration) {
          await window.geenjutsuApi.saveIntegration({
            serviceId: 'proxy-seller',
            apiKey: apiKey.trim(),
            status: 'connected',
            cachedBalance: testRes.balance || 0,
            settings: integration?.settings || { paymentMethod: 'balance' },
          });
          setBalance({ summ: testRes.balance || 0, currency: 'USD' });
        }

        setIsLocallyConnected(true);
        setSuccessMsg('Conexão realizada com sucesso!');
        onRefreshIntegration();
        loadAccountData(apiKey.trim());
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro inesperado ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar a integração do Proxy Seller?')) return;
    try {
      if (window.geenjutsuApi?.deleteIntegration) {
        await window.geenjutsuApi.deleteIntegration('proxy-seller');
      }
      setIsLocallyConnected(false);
      setApiKey('');
      setBalance(null);
      setResidentialPkg(null);
      setResidentLists([]);
      setIspList([]);
      setSuccessMsg('Integração desconectada.');
      onRefreshIntegration();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao desconectar.');
    }
  };

  // Compra direta de tráfego residencial (Saldo ou Cartão Salvo) via API
  const handleConfirmBuyGb = async () => {
    if (!isConnected || !integration?.apiKey) return;
    const selectedPkg = RESIDENTIAL_GB_PACKAGES.find(p => p.gb === selectedResGb);
    if (!selectedPkg) return;

    if (paymentMethod === 'balance' && balance && balance.summ < selectedPkg.price) {
      setErrorMsg(`Saldo insuficiente ($${balance.summ.toFixed(2)} USD). O pacote custa ${selectedPkg.priceLabel}.`);
      return;
    }

    if (paymentMethod === 'paddle_subscription' && hasCard === false) {
      setErrorMsg('Nenhum cartão cadastrado no Proxy Seller. Adicione um cartão na aba Conexão & Saldo ou mude para saldo.');
      return;
    }

    setBuyingResTraffic(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (window.geenjutsuApi?.buyProxySellerProxy) {
        const res = await window.geenjutsuApi.buyProxySellerProxy(
          { sectionCode: 'resident', tarifId: selectedPkg.tarifId, paymentId: paymentMethod },
          integration.apiKey
        );

        if (res.success) {
          const methodLabel = paymentMethod === 'paddle_subscription' ? 'cartão salvo' : 'saldo';
          setSuccessMsg(`+${selectedPkg.label} de tráfego residencial adicionado com ${methodLabel} com sucesso!`);
          setShowBuyGb(false);
          await loadAccountData(integration.apiKey);
        } else {
          setErrorMsg(res.error || 'Falha ao adquirir tráfego. Verifique a forma de pagamento selecionada.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao comprar tráfego.');
    } finally {
      setBuyingResTraffic(false);
    }
  };

  // Geração de endpoint residencial com SOCKS5
  const handleGenerateResidential = async () => {
    if (!isConnected || !integration?.apiKey) {
      setErrorMsg('Conecte sua API Key primeiro.');
      return;
    }

    setGenLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let host = 'res.proxy-seller.com';
      let port = '10000';
      let user = 'user';
      let pass = 'pass';

      const rotNum = Number(rotationSec);

      if (residentLists.length > 0) {
        const primary = residentLists[0];
        user = primary.login;
        pass = primary.password;
        if (primary.export?.ports) {
          port = String(primary.export.ports);
        }
        if (window.geenjutsuApi?.updateProxySellerRotation) {
          await window.geenjutsuApi.updateProxySellerRotation(primary.id, rotNum, integration.apiKey);
        }
      }

      const countryObj = RESIDENTIAL_COUNTRIES_OPTIONS.find(c => c.value === selectedCountry);
      const rotLabel =
        rotNum === -1
          ? 'Sticky'
          : rotNum === 0
          ? 'Per-Request'
          : `${Math.round(rotNum / 60)}min`;

      addProxy({
        name: `Proxy Seller Residencial [${selectedCountry}]`,
        type: 'socks5',
        host,
        port,
        username: user,
        password: pass,
        country: countryObj?.label.replace(/^[^\s]+\s*/, '') || selectedCountry,
        countryCode: selectedCountry,
        tags: ['proxy-seller', 'residencial', selectedCountry.toLowerCase(), `rot-${rotLabel.toLowerCase()}`],
      });

      setSuccessMsg(
        `Proxy residencial (${selectedCountry} - ${rotLabel}) gerado e adicionado à sua lista de proxies!`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao gerar proxy residencial.');
    } finally {
      setGenLoading(false);
    }
  };

  // Compra direta de proxy ISP (1 unidade, SOCKS5 - Saldo ou Cartão)
  const handleBuyIspProxy = async () => {
    if (!isConnected || !integration?.apiKey) return;

    if (paymentMethod === 'paddle_subscription' && hasCard === false) {
      setErrorMsg('Nenhum cartão cadastrado no Proxy Seller. Adicione um cartão na aba Conexão & Saldo ou mude para saldo.');
      return;
    }

    setBuyingIsp(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (window.geenjutsuApi?.buyProxySellerProxy) {
        const res = await window.geenjutsuApi.buyProxySellerProxy(
          {
            sectionCode: 'isp',
            countryId: ispBuyCountry,
            periodId: ispBuyPeriod,
            quantity: 1, // Sempre compra 1 por vez conforme especificado
            protocol: 'SOCKS5',
            paymentId: paymentMethod, // 'paddle_subscription' ou 'balance'
            customTargetName: 'All sites',
          },
          integration.apiKey
        );

        if (res.success) {
          const methodLabel = paymentMethod === 'paddle_subscription' ? 'cartão salvo' : 'saldo';
          setSuccessMsg(`Proxy ISP adquirido com ${methodLabel} com sucesso! Sincronizando...`);
          await loadAccountData(integration.apiKey);
          await handleSyncIspProxies();
        } else {
          setErrorMsg(res.error || 'Falha ao comprar proxy ISP. Verifique se o método de pagamento está ativo.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao efetuar compra de proxy ISP.');
    } finally {
      setBuyingIsp(false);
    }
  };

  // Abre modal de salvar ISP individual
  const handleOpenAddSingleIsp = (item: ProxySellerIspItem) => {
    setIspToAdd(item);
    const countryLabel =
      ISP_COUNTRIES_OPTIONS.find(c => c.value === item.country)?.label.replace(/^[^\s]+\s*/, '') || item.country;
    setIspCustomName(`Proxy Seller ISP [${countryLabel}]`);
  };

  // Salva ISP individual no Geenjutsu
  const handleSaveSingleIsp = () => {
    if (!ispToAdd) return;
    const countryObj = ISP_COUNTRIES_OPTIONS.find(c => c.value === ispToAdd.country);
    const port = String(ispToAdd.portSocks5 || 50101);

    addProxy({
      name: ispCustomName.trim() || `Proxy Seller ISP [${ispToAdd.country}]`,
      type: 'socks5',
      host: ispToAdd.ip,
      port,
      username: ispToAdd.login || '',
      password: ispToAdd.password || '',
      country: countryObj?.label.replace(/^[^\s]+\s*/, '') || ispToAdd.country,
      countryCode: ispToAdd.country,
      tags: ['proxy-seller', 'isp', (ispToAdd.country || 'us').toLowerCase()],
    });

    setSuccessMsg(`Proxy ISP (${ispToAdd.ip}) adicionado aos seus proxies com sucesso!`);
    setIspToAdd(null);
  };

  // Sincronização em lote de todos os ISPs
  const handleSyncIspProxies = async () => {
    if (!isConnected || !integration?.apiKey) return;
    setSyncIspLoading(true);
    setErrorMsg(null);

    try {
      if (window.geenjutsuApi?.getProxySellerIspProxies) {
        const res = await window.geenjutsuApi.getProxySellerIspProxies(integration.apiKey);
        if (res.success && res.items) {
          setIspList(res.items);

          let importedCount = 0;
          for (const item of res.items) {
            const port = String(item.portSocks5 || 50101);
            const exists = proxies.some(px => px.host === item.ip && String(px.port) === port);
            if (!exists) {
              const countryObj = ISP_COUNTRIES_OPTIONS.find(c => c.value === item.country);
              addProxy({
                name: `Proxy Seller ISP [${item.country}]`,
                type: 'socks5',
                host: item.ip,
                port,
                username: item.login || '',
                password: item.password || '',
                country: countryObj?.label.replace(/^[^\s]+\s*/, '') || item.country,
                countryCode: item.country,
                tags: ['proxy-seller', 'isp', (item.country || 'us').toLowerCase()],
              });
              importedCount++;
            }
          }

          setSuccessMsg(
            importedCount > 0
              ? `${importedCount} novos proxies ISP importados com sucesso!`
              : 'Todos os seus proxies ISP ativos já estão cadastrados no Geenjutsu.'
          );
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao sincronizar proxies ISP.');
    } finally {
      setSyncIspLoading(false);
    }
  };

  const selectedPkg = RESIDENTIAL_GB_PACKAGES.find(p => p.gb === selectedResGb);
  const hasEnoughResBalance = balance ? balance.summ >= (selectedPkg?.price || 0) : false;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in select-none">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden animate-scale-up relative">
        {/* Header Compacto */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]/60 bg-[var(--sidebar-secondary)]/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              {!imgError ? (
                <img
                  src="/integrations/proxy-seller.png"
                  alt="Proxy Seller"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain select-none pointer-events-none"
                />
              ) : (
                <i className="ri-shield-flash-line text-xl text-red-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--foreground)] tracking-tight">Proxy Seller</h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Configurado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]/50" />
                    Não configurado
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--muted)] font-mono">proxy-seller.com</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-base" />
          </button>
        </div>

        {/* Affiliate Bar Compacta (oculta após o usuário configurar a API) */}
        {!isConnected && (
          <div className="flex items-center justify-between px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <i className="ri-gift-line text-amber-500 text-sm flex-shrink-0" />
              <span className="text-[11.5px] text-amber-700 dark:text-amber-300 font-medium truncate">
                Não tem conta? Cadastre-se com nosso link para descontos e suporte.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 flex-shrink-0"
              onClick={() => openExternalLink(AFFILIATE_SIGNUP_URL)}
              icon="ri-arrow-right-up-line"
              iconPosition="right"
            >
              Cadastrar
            </Button>
          </div>
        )}

        {/* Tabs de Navegação */}
        <div className="flex items-center gap-1 px-5 border-b border-[var(--border)]/60 bg-[var(--sidebar-secondary)]/20">
          <button
            type="button"
            onClick={() => {
              setActiveTab('connection');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2.5 border-b-2 text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'connection'
                ? 'border-red-500 text-red-500'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            <i className="ri-key-2-line text-sm" />
            <span>Conexão & Saldo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('residential');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2.5 border-b-2 text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'residential'
                ? 'border-red-500 text-red-500'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            <i className="ri-home-wifi-line text-sm" />
            <span>Proxies Residenciais</span>
            {residentialPkg && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-500/10 text-red-500">
                {residentialPkg.remainingTrafficGb.toFixed(1)} GB
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('isp');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-2.5 border-b-2 text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'isp'
                ? 'border-red-500 text-red-500'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            <i className="ri-server-line text-sm" />
            <span>Proxies ISP Dedicados</span>
            {ispList.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500">
                {ispList.length}
              </span>
            )}
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
              <i className="ri-error-warning-line text-sm flex-shrink-0" />
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
              <i className="ri-checkbox-circle-line text-sm flex-shrink-0" />
              <span className="flex-1">{successMsg}</span>
            </div>
          )}

          {/* TAB 1: Conexão & Saldo */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              {/* Saldo da Conta */}
              {isConnected && balance && (
                <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                      <i className="ri-wallet-3-line text-xl" />
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--muted)]">Saldo Disponível</span>
                      <div className="text-xl font-bold text-[var(--foreground)]">
                        ${balance.summ.toFixed(2)}{' '}
                        <span className="text-xs font-normal text-[var(--muted)]">USD</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon="ri-add-circle-line"
                    onClick={() => openExternalLink(AFFILIATE_BALANCE_URL)}
                  >
                    Depositar / Recarregar
                  </Button>
                </div>
              )}

              {/* Seletor de Forma de Pagamento Padrão */}
              {isConnected && (
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
                  <div>
                    <span className="text-xs font-bold text-[var(--foreground)] block">
                      Forma de Pagamento para Compras
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      Escolha como debitar as compras de proxies residenciais e ISP diretamente no app.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Opção 1: Saldo em Conta */}
                    <button
                      type="button"
                      onClick={() => handleSelectPaymentMethod('balance')}
                      className={clsx(
                        'flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative',
                        paymentMethod === 'balance'
                          ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500'
                          : 'border-[var(--border)] bg-[var(--sidebar-secondary)]/30 hover:border-[var(--border-hover)]'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          paymentMethod === 'balance'
                            ? 'bg-red-500 text-white'
                            : 'bg-[var(--muted-bg)] text-[var(--muted)]'
                        )}
                      >
                        <i className="ri-wallet-3-line text-base" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--foreground)]">Saldo em Conta</span>
                          {paymentMethod === 'balance' && (
                            <i className="ri-checkbox-circle-fill text-red-500 text-sm" />
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--muted)] mt-0.5">
                          {balance ? `$${balance.summ.toFixed(2)} USD disponíveis` : 'Carregando saldo...'}
                        </div>
                      </div>
                    </button>

                    {/* Opção 2: Cartão de Crédito Salvo */}
                    <button
                      type="button"
                      onClick={() => handleSelectPaymentMethod('paddle_subscription')}
                      className={clsx(
                        'flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative',
                        paymentMethod === 'paddle_subscription'
                          ? 'border-red-500 bg-red-500/10 ring-1 ring-red-500'
                          : 'border-[var(--border)] bg-[var(--sidebar-secondary)]/30 hover:border-[var(--border-hover)]'
                      )}
                    >
                      <div
                        className={clsx(
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          paymentMethod === 'paddle_subscription'
                            ? 'bg-red-500 text-white'
                            : 'bg-[var(--muted-bg)] text-[var(--muted)]'
                        )}
                      >
                        <i className="ri-bank-card-line text-base" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--foreground)]">Cartão de Crédito Salvo</span>
                          {paymentMethod === 'paddle_subscription' && (
                            <i className="ri-checkbox-circle-fill text-red-500 text-sm" />
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5">
                          {cardLoading ? (
                            <span className="text-[var(--muted)] flex items-center gap-1">
                              <i className="ri-loader-4-line animate-spin text-[10px]" /> Verificando cartão...
                            </span>
                          ) : hasCard === true ? (
                            <span className="text-emerald-500 font-medium flex items-center gap-1">
                              <i className="ri-check-line" /> Ativo via Paddle
                            </span>
                          ) : (
                            <span className="text-amber-500 font-medium">Não configurado</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>

                  {paymentMethod === 'paddle_subscription' && hasCard === false && !cardLoading && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
                      <div className="flex items-center gap-2">
                        <i className="ri-information-line text-sm flex-shrink-0" />
                        <span>Nenhum cartão cadastrado no Proxy Seller. Adicione um cartão no painel para cobrança direta.</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="ri-external-link-line"
                        onClick={() => openExternalLink(AFFILIATE_BALANCE_URL)}
                      >
                        Cadastrar Cartão
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Input da Chave de API */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--foreground)]">Chave de API (API Key)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Cole sua API key do Proxy Seller..."
                      className="w-full h-9 px-3 pr-10 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:border-red-500 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                    >
                      <i className={showKey ? 'ri-eye-off-line' : 'ri-eye-line'} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {isConnected ? (
                    <Button variant="danger" size="sm" icon="ri-logout-box-r-line" onClick={handleDisconnect}>
                      Desconectar
                    </Button>
                  ) : (
                    <div />
                  )}

                  <Button
                    variant="primary"
                    size="sm"
                    icon={loading ? 'ri-loader-4-line animate-spin' : 'ri-check-line'}
                    disabled={loading || !apiKey.trim()}
                    onClick={handleTestAndSave}
                  >
                    {loading ? 'Validando...' : 'Testar e Salvar'}
                  </Button>
                </div>
              </div>

              {/* Accordion de IP Whitelist */}
              <details className="group rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/20 text-xs">
                <summary className="flex items-center justify-between px-3.5 py-2 font-medium text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer select-none">
                  <span className="flex items-center gap-2">
                    <i className="ri-information-line text-blue-500 text-sm" />
                    <span>Dica sobre IP Whitelist da API</span>
                  </span>
                  <i className="ri-arrow-down-s-line text-sm transition-transform duration-200 group-open:rotate-180 text-[var(--muted)]" />
                </summary>
                <div className="px-3.5 pb-2.5 pt-1 text-[11.5px] text-[var(--muted)] leading-relaxed border-t border-[var(--border)]/40 mt-1">
                  Se receber erro de autorização ou 503, verifique no painel do Proxy Seller se o seu IP atual de internet está adicionado na Whitelist de IPs da API.
                </div>
              </details>
            </div>
          )}

          {/* TAB 2: Proxies Residenciais */}
          {activeTab === 'residential' && (
            <div className="space-y-4">
              {/* Accordion Didático */}
              <details className="group rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/20 text-xs">
                <summary className="flex items-center justify-between px-3.5 py-2 font-medium text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer select-none">
                  <span className="flex items-center gap-2">
                    <i className="ri-lightbulb-line text-amber-500 text-sm" />
                    <span>Quando usar Proxies Residenciais?</span>
                  </span>
                  <i className="ri-arrow-down-s-line text-sm transition-transform duration-200 group-open:rotate-180 text-[var(--muted)]" />
                </summary>
                <div className="px-3.5 pb-2.5 pt-1 text-[11.5px] text-[var(--muted)] leading-relaxed border-t border-[var(--border)]/40 mt-1">
                  Ideais para criação e aquecimento de novas contas (Facebook, Google, TikTok, Instagram). Os IPs residenciais usam conexões de pessoas reais, evitando checkpoints imediatos de cadastro.
                </div>
              </details>

              {/* Card de Franquia Restante */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-[var(--muted)] block">Franquia Restante</span>
                    <div className="text-xl font-bold text-red-500">
                      {residentialPkg ? residentialPkg.remainingTrafficGb.toFixed(2) : '0.00'}{' '}
                      <span className="text-xs font-normal text-[var(--muted)]">GB</span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon="ri-add-line"
                    onClick={() => setShowBuyGb(!showBuyGb)}
                  >
                    Comprar mais GBs
                  </Button>
                </div>

                {/* Sub-painel retrátil de compra de GBs */}
                {showBuyGb && (
                  <div className="pt-3 border-t border-[var(--border)]/60 space-y-3 animate-fade-in">
                    <div>
                      <span className="text-xs font-semibold text-[var(--foreground)] block">
                        Escolha o pacote de tráfego residencial
                      </span>
                      <span className="text-[11px] text-[var(--muted)]">
                        {paymentMethod === 'paddle_subscription'
                          ? 'O valor será cobrado diretamente no seu Cartão de Crédito salvo via Paddle.'
                          : 'O valor será deduzido diretamente do seu saldo da conta Proxy Seller.'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {RESIDENTIAL_GB_PACKAGES.map(pkg => {
                        const isSelected = selectedResGb === pkg.gb;
                        return (
                          <button
                            key={pkg.gb}
                            type="button"
                            onClick={() => setSelectedResGb(pkg.gb)}
                            className={clsx(
                              'flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer',
                              isSelected
                                ? 'border-red-500 bg-red-500/10 text-red-500'
                                : 'border-[var(--border)] bg-[var(--muted-bg)]/50 hover:border-[var(--border-hover)] text-[var(--foreground)]'
                            )}
                          >
                            <span className="text-sm font-bold">{pkg.label}</span>
                            <span className="text-[11px] font-mono mt-0.5 opacity-80">{pkg.priceLabel}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11.5px] text-[var(--muted)] flex items-center gap-1.5">
                        <span>Cobrança:</span>
                        {paymentMethod === 'paddle_subscription' ? (
                          <span className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                            <i className="ri-bank-card-line text-red-500" /> Cartão Salvo
                          </span>
                        ) : (
                          <span className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                            <i className="ri-wallet-3-line text-red-500" /> Saldo (${balance?.summ.toFixed(2) || '0.00'})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowBuyGb(false)}>
                          Cancelar
                        </Button>

                        {paymentMethod === 'paddle_subscription' ? (
                          hasCard === false ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="ri-bank-card-line"
                              onClick={() => openExternalLink(AFFILIATE_BALANCE_URL)}
                            >
                              Cadastrar Cartão
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={buyingResTraffic ? 'ri-loader-4-line animate-spin' : 'ri-shopping-cart-2-line'}
                              disabled={buyingResTraffic || !isConnected}
                              onClick={handleConfirmBuyGb}
                            >
                              {buyingResTraffic ? 'Comprando...' : `Confirmar Compra (${selectedPkg?.priceLabel} no Cartão)`}
                            </Button>
                          )
                        ) : hasEnoughResBalance ? (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={buyingResTraffic ? 'ri-loader-4-line animate-spin' : 'ri-shopping-cart-2-line'}
                            disabled={buyingResTraffic || !isConnected}
                            onClick={handleConfirmBuyGb}
                          >
                            {buyingResTraffic ? 'Comprando...' : 'Confirmar Compra com Saldo'}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon="ri-wallet-3-line"
                            onClick={() => openExternalLink(AFFILIATE_BALANCE_URL)}
                          >
                            Depositar Saldo (${((selectedPkg?.price || 0) - (balance?.summ || 0)).toFixed(2)} faltantes)
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Gerador de Endpoint Residencial (SOCKS5 nativo) */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[var(--foreground)] block">
                      Gerar Proxy Residencial (1 Clique)
                    </span>
                    <span className="text-[11px] text-[var(--muted)] font-mono">
                      res.proxy-seller.com:10000 (SOCKS5)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="País"
                    value={selectedCountry}
                    onChange={setSelectedCountry}
                    options={RESIDENTIAL_COUNTRIES_OPTIONS}
                  />

                  <Select
                    label="Rotação"
                    value={rotationSec}
                    onChange={setRotationSec}
                    options={ROTATION_OPTIONS}
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={genLoading ? 'ri-loader-4-line animate-spin' : 'ri-add-line'}
                    disabled={genLoading || !isConnected}
                    onClick={handleGenerateResidential}
                  >
                    {genLoading ? 'Gerando...' : 'Gerar e Adicionar aos Meus Proxies'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Proxies ISP Dedicados */}
          {activeTab === 'isp' && (
            <div className="space-y-4">
              {/* Accordion Didático */}
              <details className="group rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/20 text-xs">
                <summary className="flex items-center justify-between px-3.5 py-2 font-medium text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer select-none">
                  <span className="flex items-center gap-2">
                    <i className="ri-shield-check-line text-emerald-500 text-sm" />
                    <span>Quando usar Proxies ISP Dedicados?</span>
                  </span>
                  <i className="ri-arrow-down-s-line text-sm transition-transform duration-200 group-open:rotate-180 text-[var(--muted)]" />
                </summary>
                <div className="px-3.5 pb-2.5 pt-1 text-[11.5px] text-[var(--muted)] leading-relaxed border-t border-[var(--border)]/40 mt-1">
                  Ideais para gerenciamento diário de perfis farmados, contas de anúncios (BMs) e contingência estável. O IP é fixo e exclusivo, garantindo histórico de rede limpo e sem mudanças de localização.
                </div>
              </details>

              {/* Compra Direta de 1 Proxy ISP (SOCKS5 nativo: 50101 - Saldo ou Cartão) */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar-secondary)]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--foreground)]">
                      Comprar Novo Proxy ISP
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--muted-bg)] border border-[var(--border)] font-mono text-[var(--muted)]">
                      SOCKS5
                    </span>
                  </div>

                  <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5">
                    <span>Cobrança:</span>
                    {paymentMethod === 'paddle_subscription' ? (
                      <span className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                        <i className="ri-bank-card-line text-red-500" /> Cartão Salvo
                      </span>
                    ) : (
                      <span className="font-semibold text-[var(--foreground)] flex items-center gap-1">
                        <i className="ri-wallet-3-line text-red-500" /> Saldo (${balance?.summ.toFixed(2) || '0.00'})
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="País"
                    value={ispBuyCountry}
                    onChange={setIspBuyCountry}
                    options={ISP_COUNTRIES_OPTIONS}
                  />

                  <Select
                    label="Período"
                    value={ispBuyPeriod}
                    onChange={setIspBuyPeriod}
                    options={ISP_PERIOD_OPTIONS}
                  />
                </div>

                {/* Consulta dinâmica de valor do pedido via API */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11.5px] text-[var(--muted)] flex items-center gap-1.5">
                    <span>Valor via API:</span>
                    {ispCalcLoading ? (
                      <i className="ri-loader-4-line animate-spin text-xs text-[var(--muted)]" />
                    ) : ispCalcPrice ? (
                      <span className="font-bold text-[var(--foreground)]">
                        ${ispCalcPrice.total.toFixed(2)} USD
                        {ispCalcPrice.discount > 0 && (
                          <span className="text-emerald-500 font-semibold ml-1 text-[10.5px]">
                            (-{Math.round(ispCalcPrice.discount * 100)}% off)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </div>

                  {paymentMethod === 'paddle_subscription' ? (
                    hasCard === false ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="ri-bank-card-line"
                        onClick={() => openExternalLink(AFFILIATE_BALANCE_URL)}
                      >
                        Cadastrar Cartão
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={buyingIsp ? 'ri-loader-4-line animate-spin' : 'ri-shopping-cart-2-line'}
                        disabled={buyingIsp || !isConnected || ispCalcLoading}
                        onClick={handleBuyIspProxy}
                      >
                        {buyingIsp
                          ? 'Processando compra...'
                          : `Comprar com Cartão${ispCalcPrice ? ` ($${ispCalcPrice.total.toFixed(2)})` : ''}`}
                      </Button>
                    )
                  ) : balance && ispCalcPrice && balance.summ < ispCalcPrice.total ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="ri-wallet-3-line"
                      onClick={() => openExternalLink(AFFILIATE_BALANCE_URL)}
                    >
                      Adicionar Saldo (${(ispCalcPrice.total - balance.summ).toFixed(2)} faltantes)
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={buyingIsp ? 'ri-loader-4-line animate-spin' : 'ri-shopping-cart-2-line'}
                      disabled={buyingIsp || !isConnected || ispCalcLoading}
                      onClick={handleBuyIspProxy}
                    >
                      {buyingIsp
                        ? 'Processando compra...'
                        : `Comprar com Saldo${ispCalcPrice ? ` ($${ispCalcPrice.total.toFixed(2)})` : ''}`}
                    </Button>
                  )}
                </div>
              </div>

              {/* Tabela de Proxies ISP Ativos */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--sidebar-secondary)]/50 border-b border-[var(--border)]">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    Meus Proxies ISP ({ispList.length})
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={syncIspLoading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}
                    disabled={syncIspLoading || !isConnected || ispList.length === 0}
                    onClick={handleSyncIspProxies}
                  >
                    {syncIspLoading ? 'Sincronizando...' : 'Sincronizar Todos'}
                  </Button>
                </div>

                {ispList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--muted)]">
                    Nenhum proxy ISP ativo encontrado. Adquira acima usando seu saldo.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--sidebar-secondary)]/40 text-[var(--muted)] font-medium border-b border-[var(--border)]">
                        <tr>
                          <th className="py-2 px-3">IP</th>
                          <th className="py-2 px-3">Porta (SOCKS5)</th>
                          <th className="py-2 px-3">País</th>
                          <th className="py-2 px-3">Expiração</th>
                          <th className="py-2 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]/60 font-mono">
                        {ispList.map(item => {
                          const port = String(item.portSocks5 || 50101);
                          const isAlreadyAdded = proxies.some(
                            px => px.host === item.ip && String(px.port) === port
                          );

                          return (
                            <tr key={item.id} className="hover:bg-[var(--sidebar-secondary)]/30">
                              <td className="py-2.5 px-3 font-semibold text-[var(--foreground)]">{item.ip}</td>
                              <td className="py-2.5 px-3 text-[var(--muted)]">{port}</td>
                              <td className="py-2.5 px-3 font-sans">
                                {ISP_COUNTRIES_OPTIONS.find(c => c.value === item.country)?.label || item.country}
                              </td>
                              <td className="py-2.5 px-3 text-[var(--muted)]">
                                {item.expiredAt ? new Date(item.expiredAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-sans">
                                {isAlreadyAdded ? (
                                  <span className="text-[11px] text-emerald-500 font-medium">
                                    ✓ No Geenjutsu
                                  </span>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-6 px-2 text-[11px]"
                                    icon="ri-add-line"
                                    onClick={() => handleOpenAddSingleIsp(item)}
                                  >
                                    Adicionar
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de confirmação/nome para adicionar ISP individual */}
        {ispToAdd && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 shadow-xl space-y-3 animate-scale-up">
              <div>
                <h3 className="text-xs font-bold text-[var(--foreground)]">Adicionar Proxy ao Geenjutsu</h3>
                <p className="text-[11px] text-[var(--muted)]">Defina um nome para identificar este proxy.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--muted-fg)]">Nome do Proxy</label>
                <input
                  type="text"
                  value={ispCustomName}
                  onChange={e => setIspCustomName(e.target.value)}
                  placeholder="Ex: Proxy Seller ISP US"
                  className="w-full h-9 px-3 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-[var(--sidebar-secondary)]/50 border border-[var(--border)] text-[11px] font-mono space-y-1">
                <div className="text-[var(--foreground)] truncate">
                  Host:{' '}
                  <span className="text-red-500">
                    {ispToAdd.ip}:{ispToAdd.portSocks5 || 50101}
                  </span>
                </div>
                <div className="text-[var(--muted)]">
                  Tipo: <span className="text-[var(--foreground)] font-sans">SOCKS5</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setIspToAdd(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveSingleIsp}>
                  Salvar nos Proxies
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
