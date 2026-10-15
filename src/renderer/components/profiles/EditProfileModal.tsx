import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { parseProxyString, buildProxyString, getCountryFlag, detectCountryFromHost } from '../../utils/proxyParser';
import {
  generateProfileFingerprint,
  getTimezoneAndLanguageForCountry,
  getUserLocalTimezoneAndLanguage,
} from '../../utils/fingerprintGenerator';

export const EditProfileModal: React.FC = () => {
  const { editingProfile, setEditingProfile, updateProfile, folders, proxies } = useProfiles();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState('default');
  const [proxyType, setProxyType] = useState<'direct' | 'http' | 'socks5'>('direct');
  const [selectedProxyId, setSelectedProxyId] = useState<string>('manual');
  const [proxyFullString, setProxyFullString] = useState('');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showProxyError, setShowProxyError] = useState(false);

  useEffect(() => {
    if (editingProfile) {
      setName(editingProfile.name);
      setFolderId(editingProfile.folderId);
      setNotes(editingProfile.notes);
      setTags(editingProfile.tags || []);

      if (editingProfile.proxy && editingProfile.proxy.type !== 'direct') {
        setProxyType(editingProfile.proxy.type);
        const host = editingProfile.proxy.host || '';
        const port = editingProfile.proxy.port || '';
        const user = editingProfile.proxy.username || '';
        const pass = editingProfile.proxy.password || '';

        if (editingProfile.proxy.proxyId) {
          setSelectedProxyId(editingProfile.proxy.proxyId);
          const saved = proxies.find(p => p.id === editingProfile.proxy?.proxyId);
          if (saved) {
            setProxyType(saved.type);
            setProxyHost(saved.host);
            setProxyPort(saved.port);
            setProxyUser(saved.username || '');
            setProxyPass(saved.password || '');
            setProxyFullString(buildProxyString(saved.host, saved.port, saved.username, saved.password));
          } else if (host && port) {
            setProxyHost(host);
            setProxyPort(port);
            setProxyUser(user);
            setProxyPass(pass);
            setProxyFullString(buildProxyString(host, port, user, pass));
          }
        } else if (host && port) {
          setProxyHost(host);
          setProxyPort(port);
          setProxyUser(user);
          setProxyPass(pass);
          setProxyFullString(buildProxyString(host, port, user, pass));
          const matched = proxies.find(
            p =>
              p.host === host &&
              String(p.port) === String(port) &&
              (!user || p.username === user)
          );
          setSelectedProxyId(matched ? matched.id : 'manual');
        } else if (editingProfile.proxy.ipDisplay) {
          const parsed = parseProxyString(editingProfile.proxy.ipDisplay);
          if (parsed) {
            if (parsed.type) setProxyType(parsed.type);
            setProxyHost(parsed.host);
            setProxyPort(parsed.port);
            setProxyUser(parsed.username || '');
            setProxyPass(parsed.password || '');
            setProxyFullString(editingProfile.proxy.ipDisplay);
            const matched = proxies.find(
              p =>
                p.host === parsed.host &&
                String(p.port) === String(parsed.port) &&
                (!parsed.username || p.username === parsed.username)
            );
            setSelectedProxyId(matched ? matched.id : 'manual');
          } else {
            setProxyFullString(editingProfile.proxy.ipDisplay);
            setSelectedProxyId('manual');
          }
        }
      } else {
        setProxyType('direct');
        setSelectedProxyId('manual');
        setProxyFullString('');
        setProxyHost('');
        setProxyPort('');
        setProxyUser('');
        setProxyPass('');
      }
    }
  }, [editingProfile, proxies]);

  if (!editingProfile) return null;

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

  const handleSave = () => {
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

    let finalFingerprint = editingProfile.fingerprint;
    if (!finalFingerprint) {
      finalFingerprint = generateProfileFingerprint(editingProfile.os || 'windows', proxyConfig);
    } else if (proxyConfig && (proxyConfig.host || proxyConfig.ipDisplay)) {
      const host = proxyConfig.host || (proxyConfig.ipDisplay ? proxyConfig.ipDisplay.split(':')[0] : '');
      const detectedCountry = proxyConfig.countryCode || detectCountryFromHost(host).countryCode;
      const geoInfo = getTimezoneAndLanguageForCountry(detectedCountry);
      finalFingerprint = {
        ...finalFingerprint,
        timezone: geoInfo.timezone,
        language: geoInfo.language,
      };
    } else if (!proxyConfig) {
      const local = getUserLocalTimezoneAndLanguage();
      finalFingerprint = {
        ...finalFingerprint,
        timezone: local.timezone,
        language: local.language,
      };
    }

    updateProfile({
      id: editingProfile.id,
      name: name.trim(),
      folderId,
      notes: notes.trim(),
      tags,
      proxy: proxyConfig,
      fingerprint: finalFingerprint,
    });

    setEditingProfile(null);
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
      isOpen={!!editingProfile}
      onClose={() => setEditingProfile(null)}
      title={t.createModal.editTitle}
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => setEditingProfile(null)}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || !isProxyConfigured}
          >
            {t.actions.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label={t.createModal.profileName}
          id="edit-profile-name"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <Select
          label={t.createModal.folder}
          value={folderId}
          onChange={setFolderId}
          options={folderOptions}
        />

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
          <label className="text-[12.5px] font-medium text-[var(--muted-fg)] select-none">
            {t.createModal.tags}
          </label>
          <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] min-h-[38px] transition-colors focus-within:border-red-500/60 focus-within:ring-2 focus-within:ring-red-500/10">
            {tags.map(tag => (
              <Badge key={tag} label={tag} onRemove={() => handleRemoveTag(tag)} />
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleKeyDownTag}
              placeholder={t.createModal.addTagPlaceholder}
              className="flex-1 bg-transparent text-[12.5px] text-[var(--foreground)] focus:outline-none min-w-[90px] placeholder:text-[var(--muted)]"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-[12.5px] font-medium text-[var(--muted-fg)] select-none">
            {t.createModal.notes}
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-[var(--muted-bg)] text-[var(--foreground)] text-[12.5px] rounded-lg border border-[var(--border)] px-3 py-2 transition-all duration-150 focus:outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10 hover:border-[var(--muted)]/50 placeholder:text-[var(--muted)] resize-none"
          />
        </div>
      </div>
    </Modal>
  );
};

