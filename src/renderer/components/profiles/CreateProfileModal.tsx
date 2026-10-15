import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { ProfileCreateInput } from '../../types';
import { parseProxyString, buildProxyString, getCountryFlag } from '../../utils/proxyParser';
import { generateProfileFingerprint } from '../../utils/fingerprintGenerator';
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
    }
  }, [isCreateModalOpen, selectedFolderId, folders]);

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
        fingerprint,
      });
    }

    createBulkProfiles(inputs);
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setQuantity(1);
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

        {/* OS */}
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
  );
};
