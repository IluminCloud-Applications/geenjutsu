import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { parseProxyString, buildProxyString, getCountryFlag } from '../../utils/proxyParser';
import { clsx } from 'clsx';

export const EditProxyModal: React.FC = () => {
  const { editingProxy, setEditingProxy, updateProxy } = useProfiles();
  const { t } = useI18n();

  const [name, setName] = useState('');
  const [type, setType] = useState<'http' | 'socks5'>('http');
  const [fullString, setFullString] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; ping?: number; error?: string } | null>(null);

  useEffect(() => {
    if (editingProxy) {
      setName(editingProxy.name || '');
      setType(editingProxy.type || 'http');
      setHost(editingProxy.host || '');
      setPort(editingProxy.port || '');
      setUsername(editingProxy.username || '');
      setPassword(editingProxy.password || '');
      setCountry(editingProxy.country || '');
      setCountryCode(editingProxy.countryCode || '');
      setTags(editingProxy.tags || []);
      setFullString(
        buildProxyString(
          editingProxy.host || '',
          editingProxy.port || '',
          editingProxy.username,
          editingProxy.password
        )
      );
      setTestResult(null);
    }
  }, [editingProxy]);

  if (!editingProxy) return null;

  const handleFullStringChange = (val: string) => {
    setFullString(val);
    setTestResult(null);
    const parsed = parseProxyString(val);
    if (parsed) {
      if (parsed.type) setType(parsed.type);
      setHost(parsed.host);
      setPort(parsed.port);
      setUsername(parsed.username || '');
      setPassword(parsed.password || '');
    }
  };

  const handleIndividualFieldChange = (
    newHost: string,
    newPort: string,
    newUser: string,
    newPass: string
  ) => {
    setHost(newHost);
    setPort(newPort);
    setUsername(newUser);
    setPassword(newPass);
    setFullString(buildProxyString(newHost, newPort, newUser, newPass));
    setTestResult(null);
  };

  const handleAddTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
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

  const handleTest = async () => {
    if (!host.trim() || !port.trim()) return;
    setTesting(true);
    setTestResult(null);

    try {
      if (window.geenjutsuApi?.testProxy) {
        const res = await window.geenjutsuApi.testProxy({
          type,
          host: host.trim(),
          port: port.trim(),
          username: username.trim() || undefined,
          password: password.trim() || undefined,
        });

        if (res && res.success) {
          setTestResult({ success: true, ping: res.ping || 100 });
          if (res.country) setCountry(res.country);
          if (res.countryCode) setCountryCode(res.countryCode);
        } else {
          setTestResult({
            success: false,
            error: res?.error || res?.message || 'Falha na conexão',
          });
        }
      } else {
        setTestResult({ success: true, ping: 100 });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Falha ao testar conexão',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!host.trim() || !port.trim()) return;

    updateProxy({
      id: editingProxy.id,
      name: name.trim() || undefined,
      type,
      host: host.trim(),
      port: port.trim(),
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      country: country || undefined,
      countryCode: countryCode || undefined,
      tags,
    });

    handleClose();
  };

  const handleClose = () => {
    setEditingProxy(null);
  };

  const toggleBtn = (isActive: boolean) =>
    clsx(
      'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border text-xs font-medium transition-all duration-150 cursor-pointer h-8',
      isActive
        ? 'border-red-500/60 bg-red-500/8 text-red-500'
        : 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-hover)]'
    );

  return (
    <Modal
      isOpen={!!editingProxy}
      onClose={handleClose}
      title={t.proxiesPage.editProxy}
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t.actions.cancel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!host.trim() || !port.trim()}
          >
            {t.actions.save}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Name & Protocol */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t.proxiesPage.proxyName}
            id="edit-proxy-name"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t.proxiesPage.namePlaceholder}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.proxiesPage.protocol}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setType('http')}
                className={toggleBtn(type === 'http')}
              >
                HTTPS
              </button>
              <button
                type="button"
                onClick={() => setType('socks5')}
                className={toggleBtn(type === 'socks5')}
              >
                SOCKS5
              </button>
            </div>
          </div>
        </div>

        {/* Quick String & Test */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.proxiesPage.quickString}
            </label>
            <span
              title={t.proxiesPage.quickStringTooltip}
              className="inline-flex items-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-help transition-colors"
            >
              <i className="ri-information-line text-xs" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="edit-full-proxy-string"
              value={fullString}
              onChange={e => handleFullStringChange(e.target.value)}
              placeholder="19.28.148.292:8080:usuario:senha"
              icon="ri-link"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleTest}
              disabled={!host.trim() || !port.trim() || testing}
              className="flex-shrink-0 h-9"
            >
              {testing ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-xs mr-1" />
                  <span>{t.proxiesPage.testing}</span>
                </>
              ) : (
                <>
                  <i className="ri-wifi-line text-xs mr-1" />
                  <span>{t.proxiesPage.testProxy}</span>
                </>
              )}
            </Button>
          </div>
          {testResult && (
            <div
              className={clsx(
                'flex items-center gap-1.5 text-xs font-medium pt-0.5',
                testResult.success ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              <i
                className={clsx(
                  testResult.success
                    ? 'ri-checkbox-circle-fill text-xs'
                    : 'ri-close-circle-fill text-xs'
                )}
              />
              <span>
                {testResult.success
                  ? `${t.proxiesPage.testSuccess} (${testResult.ping}ms)`
                  : testResult.error || 'Falha na conexão'}
              </span>
            </div>
          )}
        </div>

        {/* Separated fields */}
        <div className="p-3 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
            <i className="ri-layout-grid-line text-xs text-[var(--muted)]" />
            <span>{t.proxiesPage.separateFields}</span>
          </div>

          {/* Row 1: Host e Porta */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <Input
                label={t.proxiesPage.host}
                value={host}
                onChange={e =>
                  handleIndividualFieldChange(e.target.value, port, username, password)
                }
                placeholder="19.28.148.292"
                required
              />
            </div>
            <div className="col-span-1">
              <Input
                label={t.proxiesPage.port}
                value={port}
                onChange={e =>
                  handleIndividualFieldChange(host, e.target.value, username, password)
                }
                placeholder="8080"
                required
              />
            </div>
          </div>

          {/* Row 2: Usuário e Senha */}
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label={t.proxiesPage.username}
              value={username}
              onChange={e =>
                handleIndividualFieldChange(host, port, e.target.value, password)
              }
              placeholder="user (opcional)"
            />
            <Input
              label={t.proxiesPage.password}
              type="password"
              value={password}
              onChange={e =>
                handleIndividualFieldChange(host, port, username, e.target.value)
              }
              placeholder="pass (opcional)"
            />
          </div>
        </div>

        {/* Location & Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.proxiesPage.location}
            </label>
            <div className="h-9 px-3 rounded-lg bg-[var(--sidebar-primary)] border border-[var(--border)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                {countryCode ? (
                  <span className="text-sm">{getCountryFlag(countryCode)}</span>
                ) : (
                  <i className="ri-map-pin-line text-xs text-[var(--muted)]" />
                )}
                <span
                  className={clsx(
                    'font-medium truncate',
                    country ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                  )}
                >
                  {country || 'Sem localização'}
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)] flex-shrink-0">
                {countryCode || '—'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.proxiesPage.tags}
            </label>
            <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] min-h-[36px] transition-colors focus-within:border-red-500/60 focus-within:ring-2 focus-within:ring-red-500/10">
              {tags.map(tag => (
                <Badge key={tag} label={tag} onRemove={() => handleRemoveTag(tag)} />
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleKeyDownTag}
                placeholder={tags.length === 0 ? t.createModal.tagsPlaceholder : t.createModal.addTagPlaceholder}
                className="flex-1 bg-transparent text-[12px] text-[var(--foreground)] focus:outline-none min-w-[80px] placeholder:text-[var(--muted)]"
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
