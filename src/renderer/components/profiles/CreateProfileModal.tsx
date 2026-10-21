import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { ProfileCreateInput, AndroidDeviceSpec } from '../../types';
import { parseProxyString, buildProxyString, getCountryFlag } from '../../utils/proxyParser';
import { generateProfileFingerprint } from '../../utils/fingerprintGenerator';
import { DeviceCatalogService } from '../../../shared/deviceCatalog';
import { AndroidSetupModal } from './AndroidSetupModal';
import { clsx } from 'clsx';

export const CreateProfileModal: React.FC = () => {
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    createProfile,
    createBulkProfiles,
    folders,
    selectedFolderId,
    proxies,
  } = useProfiles();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [folderId, setFolderId] = useState<string>(() => {
    if (
      selectedFolderId &&
      selectedFolderId !== 'all' &&
      selectedFolderId !== 'running' &&
      selectedFolderId !== 'trash' &&
      selectedFolderId !== 'unassigned' &&
      !selectedFolderId.startsWith('platform:') &&
      !selectedFolderId.startsWith('tag:')
    ) {
      const exists = folders.some(f => f.id === selectedFolderId);
      if (exists) return selectedFolderId;
    }
    return '';
  });

  React.useEffect(() => {
    if (isCreateModalOpen) {
      if (
        selectedFolderId &&
        selectedFolderId !== 'all' &&
        selectedFolderId !== 'running' &&
        selectedFolderId !== 'trash' &&
        selectedFolderId !== 'unassigned' &&
        !selectedFolderId.startsWith('platform:') &&
        !selectedFolderId.startsWith('tag:')
      ) {
        const exists = folders.some(f => f.id === selectedFolderId);
        if (exists) {
          setFolderId(selectedFolderId);
          return;
        }
      }
      setFolderId('');
      setRuntime('browser');
      setIsAndroidTooltipOpen(false);
      setSelectedAndroidDevice(DeviceCatalogService.getRandom(undefined, '12'));

      // Check android requirements
      if (window.geenjutsuApi?.checkAndroidDependencies) {
        window.geenjutsuApi.checkAndroidDependencies().then(res => {
          setIsAndroidReady(res.allOk);
        }).catch(() => {
          setIsAndroidReady(false);
        });
      }
    }
  }, [isCreateModalOpen, selectedFolderId, folders]);

  const [runtime, setRuntime] = useState<'browser' | 'android'>('browser');
  const [isAndroidReady, setIsAndroidReady] = useState(false);
  const [isAndroidSetupModalOpen, setIsAndroidSetupModalOpen] = useState(false);
  const [isAndroidTooltipOpen, setIsAndroidTooltipOpen] = useState(false);
  const tooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [selectedAndroidDevice, setSelectedAndroidDevice] = useState<AndroidDeviceSpec>(() => DeviceCatalogService.getRandom(undefined, '12'));

  const handleMouseEnterAndroid = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    if (!isAndroidReady) {
      setIsAndroidTooltipOpen(true);
    }
  };

  const handleMouseLeaveAndroid = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setIsAndroidTooltipOpen(false);
    }, 200);
  };

  React.useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const [platform, setPlatform] = useState<'facebook' | 'chrome' | 'tiktok' | 'google' | 'amazon' | 'general'>('facebook');
  const [os, setOs] = useState<'mac' | 'windows' | 'linux'>('windows');

  // Proxy state - Defaults to 'direct' (sem proxy)
  const [proxyType, setProxyType] = useState<'direct' | 'http' | 'socks5'>('direct');
  const [selectedProxyId, setSelectedProxyId] = useState<string>('manual');
  const [proxyFullString, setProxyFullString] = useState('');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [showProxyError, setShowProxyError] = useState(false);

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Handle selecting a saved proxy from dropdown
  const handleSelectSavedProxy = (val: string) => {
    setSelectedProxyId(val);
    if (val === 'manual') return;

    const saved = proxies.find(p => p.id === val);
    if (saved) {
      setProxyType(saved.type);
      setProxyHost(saved.host);
      setProxyPort(saved.port);
      setProxyUser(saved.username || '');
      setProxyPass(saved.password || '');
      setProxyFullString(buildProxyString(saved.host, saved.port, saved.username, saved.password));
    }
  };

  // When quick string changes, parse and update individual fields
  const handleQuickStringChange = (val: string) => {
    setProxyFullString(val);
    setSelectedProxyId('manual');
    const parsed = parseProxyString(val);
    if (parsed) {
      if (parsed.type) setProxyType(parsed.type);
      setProxyHost(parsed.host);
      setProxyPort(parsed.port);
      setProxyUser(parsed.username || '');
      setProxyPass(parsed.password || '');
    }
  };

  // When individual fields change, update quick string
  const handleIndividualFieldChange = (
    newHost: string,
    newPort: string,
    newUser: string,
    newPass: string
  ) => {
    setProxyHost(newHost);
    setProxyPort(newPort);
    setProxyUser(newUser);
    setProxyPass(newPass);
    setProxyFullString(buildProxyString(newHost, newPort, newUser, newPass));
    setSelectedProxyId('manual');
  };

  const handleAddTag = (tag: string) => {
    const cleaned = tag.trim();
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDownTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
      setTagInput('');
    }
  };

  const isProxyConfigured =
    proxyType === 'direct' ||
    (proxyHost.trim().length > 0 && proxyPort.trim().length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (proxyType !== 'direct' && (!proxyHost.trim() || !proxyPort.trim())) {
      setShowProxyError(true);
      return;
    }

    const savedProxy = selectedProxyId !== 'manual' ? proxies.find(p => p.id === selectedProxyId) : null;
    const proxyConfig =
      proxyType !== 'direct' && (proxyHost.trim() || proxyFullString.trim())
        ? {
            type: proxyType,
            name: savedProxy?.name || undefined,
            proxyId: savedProxy?.id || (selectedProxyId !== 'manual' ? selectedProxyId : undefined),
            countryCode: savedProxy?.countryCode || undefined,
            country: savedProxy?.country || undefined,
            host: proxyHost.trim() || savedProxy?.host || undefined,
            port: proxyPort.trim() || savedProxy?.port || undefined,
            username: proxyUser.trim() || savedProxy?.username || undefined,
            password: proxyPass.trim() || savedProxy?.password || undefined,
            ipDisplay: proxyHost.trim() ? `${proxyHost.trim()}:${proxyPort.trim()}` : proxyFullString.trim(),
          }
        : undefined;

    const osLabels: Record<string, string> = { mac: 'macOS', windows: 'Windows', linux: 'Linux' };
    const browserLabel = `Camoufox 135 (${osLabels[os] || 'Windows'})`;

    const count = Math.max(1, Math.min(100, quantity));
    const inputs: ProfileCreateInput[] = [];

    for (let i = 0; i < count; i++) {
      const profileName = i === 0 ? name.trim() : `${name.trim()} #${i + 1}`;

      if (runtime === 'android') {
        const dev = selectedAndroidDevice;
        inputs.push({
          name: profileName,
          folderId: folderId || '',
          platform,
          os: 'android',
          browser: `${dev.brand} ${dev.name} (Android ${dev.androidVersion})`,
          notes: '',
          tags,
          proxy: proxyConfig,
          runtime: 'android',
          device: dev,
          androidVersion: dev.androidVersion,
          width: dev.width,
          height: dev.height,
          dpi: dev.dpi,
        });
      } else {
        const fingerprint = generateProfileFingerprint(os, proxyConfig);
        inputs.push({
          name: profileName,
          folderId: folderId || '',
          platform,
          os,
          browser: browserLabel,
          notes: '',
          tags,
          proxy: proxyConfig,
          runtime: 'browser',
          fingerprint,
        });
      }
    }

    createBulkProfiles(inputs);
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setQuantity(1);
    setRuntime('browser');
    setIsAndroidTooltipOpen(false);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setSelectedProxyId('manual');
    setProxyFullString('');
    setProxyHost('');
    setProxyPort('');
    setProxyUser('');
    setProxyPass('');
    setShowProxyError(false);
    setTagInput('');
    setTags([]);
    setOs('windows');
    setProxyType('direct');
    setFolderId(() => {
      const exists = folders.some(f => f.id === selectedFolderId);
      return exists ? selectedFolderId : '';
    });
    setIsCreateModalOpen(false);
  };

  const folderOptions = [
    {
      value: '',
      label: t.folders.unassigned,
      icon: 'ri-folder-line',
    },
    ...folders.map(f => ({
      value: f.id,
      label: f.name,
      icon: f.icon,
    })),
  ];

  const savedProxyOptions = [
    {
      value: 'manual',
      label: t.proxiesPage.manualProxy,
      icon: 'ri-edit-line',
    },
    ...proxies.map(p => ({
      value: p.id,
      label: p.name || `${p.host}:${p.port}`,
      icon: getCountryFlag(p.countryCode),
      description: `${p.host}:${p.port}${p.username ? ` · ${p.username}` : ''}${p.country ? ` (${p.country})` : ''}`,
      badge: p.type === 'http' ? 'HTTPS' : p.type.toUpperCase(),
    })),
  ];

  const toggleBtn = (isActive: boolean) =>
    clsx(
      'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-[12.5px] font-medium transition-all duration-150 cursor-pointer h-9',
      isActive
        ? 'border-red-500/60 bg-red-500/8 text-red-500'
        : 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-hover)]'
    );

  return (
    <>
      <Modal
      isOpen={isCreateModalOpen}
      onClose={handleClose}
      title={t.createModal.title}
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || !isProxyConfigured}
          >
            {t.createModal.createBulk ? t.createModal.createBulk(quantity) : t.actions.create}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Runtime Engine Tabs: Navegador vs Android */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center p-0.5 bg-[var(--muted-bg)] rounded-lg border border-[var(--border)] gap-0.5">
            <button
              type="button"
              onClick={() => setRuntime('browser')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                runtime === 'browser'
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs border border-[var(--border)]'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              )}
            >
              <i className="ri-global-line text-sm text-red-500" />
              <span>Navegador</span>
            </button>

            <div
              className="relative"
              onMouseEnter={handleMouseEnterAndroid}
              onMouseLeave={handleMouseLeaveAndroid}
            >
              <button
                type="button"
                onClick={() => {
                  if (isAndroidReady) {
                    setRuntime('android');
                  } else {
                    setIsAndroidTooltipOpen(false);
                    setIsAndroidSetupModalOpen(true);
                  }
                }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                  !isAndroidReady
                    ? 'opacity-65 text-[var(--muted)] hover:text-[var(--foreground)]'
                    : 'cursor-pointer',
                  runtime === 'android'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs border border-[var(--border)]'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                )}
                title={!isAndroidReady ? 'Requer dependências do Android. Clique para configurar.' : undefined}
              >
                <i className="ri-android-fill text-sm text-emerald-500" />
                <span>Android</span>
                {!isAndroidReady && (
                  <i className="ri-lock-line text-[11px] text-amber-500/80 ml-0.5" />
                )}
              </button>

              {/* Tooltip on hover when disabled */}
              {!isAndroidReady && isAndroidTooltipOpen && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-full pt-1.5 z-50 flex flex-col items-center pointer-events-auto animate-in fade-in duration-150"
                  onMouseEnter={handleMouseEnterAndroid}
                  onMouseLeave={handleMouseLeaveAndroid}
                >
                  <div className="w-2.5 h-2.5 bg-[var(--card)] border-t border-l border-[var(--border)] rotate-45 -mb-1.5 z-10 shadow-xs" />
                  <div className="w-56 p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl text-center space-y-1.5">
                    <p className="text-[11px] text-[var(--foreground)] font-medium leading-tight">
                      Requer dependências do emulador Android instaladas.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsAndroidTooltipOpen(false);
                        setIsAndroidSetupModalOpen(true);
                      }}
                      className="text-[11px] text-red-500 hover:text-red-600 hover:underline font-semibold cursor-pointer block w-full py-0.5 transition-colors"
                    >
                      Clique aqui para instalar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Discrete requirements button */}
          <button
            type="button"
            onClick={() => setIsAndroidSetupModalOpen(true)}
            className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Diagnóstico e Dependências do Android"
          >
            <i className={clsx(isAndroidReady ? 'ri-checkbox-circle-fill text-emerald-500' : 'ri-tools-line text-amber-500')} />
            <span>{isAndroidReady ? 'Android Ativo' : 'Instalar Requisitos'}</span>
          </button>
        </div>

        {/* Profile Name & Quantity */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8">
            <Input
              label={t.createModal.profileName}
              id="profile-name"
              autoFocus
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.createModal.namePlaceholder}
            />
          </div>
          <div className="sm:col-span-4 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.createModal.quantity}
            </label>
            <div className="flex items-center h-9 bg-[var(--muted-bg)] rounded-lg border border-[var(--border)] p-0.5 hover:border-[var(--border-hover)] transition-colors focus-within:border-red-500/60 focus-within:ring-2 focus-within:ring-red-500/10">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-8 h-full flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              >
                <i className="ri-subtract-line text-xs leading-none" />
              </button>
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setQuantity(1);
                    return;
                  }
                  const val = parseInt(raw, 10);
                  if (!isNaN(val)) {
                    setQuantity(Math.min(100, Math.max(1, val)));
                  }
                }}
                onBlur={() => {
                  if (!quantity || quantity < 1) {
                    setQuantity(1);
                  }
                }}
                className="flex-1 w-full bg-transparent text-center text-[12.5px] font-semibold text-[var(--foreground)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity(q => Math.min(100, q + 1))}
                disabled={quantity >= 100}
                className="w-8 h-full flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
              >
                <i className="ri-add-line text-xs leading-none" />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk preview badge when quantity > 1 */}
        {quantity > 1 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/15 text-[11.5px] text-[var(--muted-fg)]">
            <i className="ri-stack-line text-red-500 text-sm flex-shrink-0" />
            <div className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-[var(--foreground)] mr-1">
                {t.createModal.bulkPreview}
              </span>
              <span className="text-[var(--muted)]">
                {name.trim() || 'Perfil'}, {name.trim() || 'Perfil'} #2
                {quantity >= 3 ? `, ${name.trim() || 'Perfil'} #3` : ''}
                {quantity > 3 ? ` ... (+${quantity - 3})` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Folder */}
        <Select
          label={t.createModal.folder}
          value={folderId}
          onChange={setFolderId}
          options={folderOptions}
        />

        {/* Platform Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.createModal.platform}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'facebook', label: 'Facebook', icon: 'ri-facebook-fill' },
              { id: 'google', label: 'Google', icon: 'ri-google-fill' },
              { id: 'tiktok', label: 'TikTok', icon: 'ri-tiktok-fill' },
              { id: 'general', label: t.createModal.general, icon: 'ri-global-line' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id as any)}
                className={toggleBtn(platform === p.id)}
              >
                <i className={p.icon} />
                <span className="hidden sm:inline">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* OS or Android Hardware Card */}
        {runtime === 'browser' ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.createModal.os}
            </label>
            <div className="flex items-center gap-2">
              {[
                { id: 'mac', label: 'macOS', icon: 'ri-apple-fill' },
                { id: 'windows', label: 'Windows', icon: 'ri-windows-fill' },
                { id: 'linux', label: 'Linux', icon: 'ri-ubuntu-fill' },
              ].map(osOption => (
                <button
                  key={osOption.id}
                  type="button"
                  onClick={() => setOs(osOption.id as any)}
                  className={clsx(toggleBtn(os === osOption.id), 'flex-1')}
                >
                  <i className={osOption.icon} />
                  <span>{osOption.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
                Aparelho Android Real (Fingerprint)
              </label>
              <button
                type="button"
                onClick={() => setSelectedAndroidDevice(DeviceCatalogService.getRandom(undefined, '12'))}
                className="text-[11px] text-red-500 hover:text-red-400 font-medium flex items-center gap-1 cursor-pointer"
                title="Sortear outro modelo de smartphone real"
              >
                <i className="ri-refresh-line" />
                <span>Sortear Outro</span>
              </button>
            </div>
            <div className="p-3 bg-[var(--muted-bg)]/60 rounded-xl border border-[var(--border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-emerald-500 text-base flex-shrink-0">
                  <i className="ri-smartphone-line" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-[var(--foreground)] truncate">
                      {selectedAndroidDevice.brand} {selectedAndroidDevice.name}
                    </span>
                    <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-[var(--card)] text-[var(--muted-fg)] border border-[var(--border)]">
                      Android {selectedAndroidDevice.androidVersion}
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono text-[var(--muted)] truncate block mt-0.5">
                    {selectedAndroidDevice.model} · {selectedAndroidDevice.resolution} · {selectedAndroidDevice.dpi}dpi
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Proxy Setup */}
        <div className="space-y-2.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.createModal.proxyMode}
          </label>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { id: 'direct', label: t.createModal.direct },
              { id: 'http', label: 'HTTPS' },
              { id: 'socks5', label: 'SOCKS5', badge: 'Recomendado' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setProxyType(item.id as any);
                  if (item.id === 'direct') setShowProxyError(false);
                }}
                className={clsx(
                  toggleBtn(proxyType === item.id),
                  'justify-center relative'
                )}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="absolute -top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-semibold leading-none tracking-tight whitespace-nowrap bg-red-500 text-white shadow-sm pointer-events-none">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {proxyType !== 'direct' && (
            <div className="space-y-2.5 pt-1">
              {/* Saved Proxies Dropdown */}
              {proxies.length > 0 && (
                <Select
                  label={t.proxiesPage.selectSavedProxy}
                  value={selectedProxyId}
                  onChange={handleSelectSavedProxy}
                  options={savedProxyOptions}
                />
              )}

              {/* Quick URL / String Input */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[var(--muted-fg)]">
                    {t.proxiesPage.quickString}
                  </span>
                  <span
                    title={t.proxiesPage.quickStringTooltip}
                    className="inline-flex items-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-help transition-colors"
                  >
                    <i className="ri-information-line text-xs" />
                  </span>
                </div>
                <Input
                  placeholder="19.28.148.292:8080:usuario:senha"
                  value={proxyFullString}
                  onChange={e => handleQuickStringChange(e.target.value)}
                  icon="ri-link"
                />
              </div>

              {/* Separated fields (Host, Port, User, Password) */}
              <div className="p-3 rounded-xl bg-[var(--muted-bg)]/60 border border-[var(--border)] space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--foreground)]">
                  <i className="ri-layout-grid-line text-xs text-[var(--muted)]" />
                  <span>{t.proxiesPage.separateFields}</span>
                </div>

                {/* Row 1: Host/IP e Porta */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      label={`${t.proxiesPage.host} *`}
                      value={proxyHost}
                      onChange={e => {
                        handleIndividualFieldChange(e.target.value, proxyPort, proxyUser, proxyPass);
                        if (showProxyError) setShowProxyError(false);
                      }}
                      placeholder="19.28.148.292"
                      required
                      error={showProxyError && !proxyHost.trim() ? 'Informe o host ou IP' : undefined}
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      label={`${t.proxiesPage.port} *`}
                      value={proxyPort}
                      onChange={e => {
                        handleIndividualFieldChange(proxyHost, e.target.value, proxyUser, proxyPass);
                        if (showProxyError) setShowProxyError(false);
                      }}
                      placeholder="8080"
                      required
                      error={showProxyError && !proxyPort.trim() ? 'Obrigatório' : undefined}
                    />
                  </div>
                </div>

                {/* Row 2: Usuário e Senha */}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label={t.proxiesPage.username}
                    value={proxyUser}
                    onChange={e =>
                      handleIndividualFieldChange(proxyHost, proxyPort, e.target.value, proxyPass)
                    }
                    placeholder="user (opcional)"
                  />
                  <Input
                    label={t.proxiesPage.password}
                    type="password"
                    value={proxyPass}
                    onChange={e =>
                      handleIndividualFieldChange(proxyHost, proxyPort, proxyUser, e.target.value)
                    }
                    placeholder="senha (opcional)"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
            {t.createModal.tags}
          </label>
          <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] min-h-[38px] transition-colors focus-within:border-red-500/60 focus-within:ring-2 focus-within:ring-red-500/10">
            {tags.map(tag => (
              <Badge key={tag} label={tag} onRemove={() => handleRemoveTag(tag)} />
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleKeyDownTag}
              placeholder={tags.length === 0 ? t.createModal.tagsPlaceholder : t.createModal.addTagPlaceholder}
              className="flex-1 bg-transparent text-[12.5px] text-[var(--foreground)] focus:outline-none min-w-[90px] placeholder:text-[var(--muted)]"
            />
          </div>
        </div>
      </form>
    </Modal>

    <AndroidSetupModal
      isOpen={isAndroidSetupModalOpen}
      onClose={() => setIsAndroidSetupModalOpen(false)}
      onStatusChanged={(allOk) => setIsAndroidReady(allOk)}
    />
  </>
  );
};
