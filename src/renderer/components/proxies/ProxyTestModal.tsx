import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { getCountryFlag } from '../../utils/proxyParser';
import { ProxyCheckResult } from '../../types';
import { clsx } from 'clsx';
import { useI18n } from '../../context/I18nContext';
import { useProfiles } from '../../context/ProfileContext';

export interface ProxyTestTarget {
  profileId?: string;
  type?: 'http' | 'socks5' | 'socks4' | 'direct' | string;
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  name?: string;
  profileName?: string;
}

interface ProxyTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ProxyTestTarget | null;
}

export const ProxyTestModal: React.FC<ProxyTestModalProps> = ({
  isOpen,
  onClose,
  target,
}) => {
  const { t } = useI18n();
  const { toggleLaunchProfile, profiles } = useProfiles();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProxyCheckResult | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);

  const targetProfile = target?.profileId ? profiles?.find(p => p.id === target.profileId) : null;
  const isProfileRunning = targetProfile?.status === 'running';

  const runTest = async (tgt: ProxyTestTarget | null) => {
    if (!tgt) return;
    setLoading(true);
    setResult(null);

    const isDirect = !tgt.host || tgt.type === 'direct';

    if (window.geenjutsuApi?.testProxy) {
      try {
        const res = await window.geenjutsuApi.testProxy({
          type: tgt.type,
          host: tgt.host,
          port: tgt.port,
          username: tgt.username,
          password: tgt.password,
        });
        setResult(res);
      } catch (err: any) {
        setResult({
          success: false,
          isProxy: false,
          message: t.proxyTestModal.testFailedMsg,
          error: err?.message || t.proxyTestModal.unexpectedError,
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Fallback simulation if running outside Electron
    await new Promise(r => setTimeout(r, 1200));
    setResult({
      success: true,
      isProxy: false,
      ip: '177.37.184.97',
      proxyType: 'Residencial',
      country: 'Brasil',
      countryCode: 'BR',
      city: 'Horizonte',
      region: 'Ceará',
      provider: 'Brisanet Servicos De Telecomunicacoes S.A',
      operator: 'AS28126',
      ping: 98,
      message: 'IP Limpo (Proxy residencial sem detecção pública)',
    });
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && target) {
      runTest(target);
    } else {
      setResult(null);
      setLoading(false);
    }
  }, [isOpen, target]);

  const handleCopyIp = (ip?: string) => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 1800);
  };

  if (!isOpen || !target) return null;

  const isDirect = !target.host || target.type === 'direct';
  const displayHost = isDirect ? t.proxyTestModal.directConnection : `${target.host}:${target.port || ''}`;
  const displayProto = isDirect ? 'DIRECT' : (target.type?.toUpperCase() || 'SOCKS5');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.proxyTestModal.title}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runTest(target)}
            disabled={loading}
            className="gap-1.5"
          >
            <i className={clsx('ri-refresh-line text-xs', loading && 'animate-spin')} />
            <span>{t.proxyTestModal.testAgain}</span>
          </Button>

          <div className="flex items-center gap-2">
            {target.profileId && (
              <Button
                variant={isProfileRunning ? 'stop' : 'primary'}
                size="sm"
                onClick={() => {
                  toggleLaunchProfile(target.profileId!);
                  onClose();
                }}
                className="gap-1.5"
              >
                <i className={isProfileRunning ? 'ri-stop-fill' : 'ri-window-line'} />
                <span>{isProfileRunning ? t.actions.stopBrowser : t.actions.openBrowser}</span>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t.actions.close}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Target Header Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--muted-bg)] border border-[var(--border)]">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-[var(--sidebar-primary)] border border-[var(--border)] flex items-center justify-center text-sm text-[var(--muted)] flex-shrink-0">
              <i className={isDirect ? 'ri-global-line' : 'ri-shield-keyhole-line'} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                {target.profileName ? `${target.profileName}` : target.name || displayHost}
              </span>
              <span className="text-[11px] font-mono text-[var(--muted-fg)] truncate">
                {displayHost}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--sidebar-primary)] text-[var(--foreground)] border border-[var(--border)]">
              {displayProto}
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
              <div className="w-10 h-10 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              <i className="ri-radar-line text-red-500 text-lg absolute" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                {t.proxyTestModal.connecting}
              </p>
              <p className="text-[11px] text-[var(--muted-fg)]">
                {t.proxyTestModal.testingRoute}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && result && !result.success && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2">
            <div className="flex items-center gap-2 text-rose-500 text-xs font-semibold">
              <i className="ri-close-circle-fill text-sm" />
              <span>{t.proxyTestModal.connectionFailed}</span>
            </div>
            <p className="text-xs text-[var(--foreground)] leading-relaxed">
              {result.error || result.message || t.proxyTestModal.defaultErrorDesc}
            </p>
            <p className="text-[11px] text-[var(--muted-fg)] pt-1 border-t border-rose-500/20">
              {t.proxyTestModal.checkCredentialsHint}
            </p>
          </div>
        )}

        {/* Success Result */}
        {!loading && result && result.success && (
          <div className="space-y-3 animate-fade-in">
            {/* Reputation Banner */}
            <div
              className={clsx(
                'p-3.5 rounded-xl border flex items-start gap-3',
                result.isProxy
                  ? 'border-amber-500/30 bg-amber-500/8 text-amber-500'
                  : 'border-emerald-500/30 bg-emerald-500/8 text-emerald-500'
              )}
            >
              <i
                className={clsx(
                  'text-lg flex-shrink-0 mt-0.5',
                  result.isProxy ? 'ri-error-warning-fill' : 'ri-checkbox-circle-fill'
                )}
              />
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold tracking-tight">
                    {result.isProxy ? t.proxyTestModal.lowTrust : t.proxyTestModal.highTrust}
                  </span>
                  <span
                    className={clsx(
                      'text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold',
                      result.isProxy
                        ? 'border-amber-500/30 bg-amber-500/15'
                        : 'border-emerald-500/30 bg-emerald-500/15'
                    )}
                  >
                    {result.isProxy ? t.proxyTestModal.proxyDetected : t.proxyTestModal.cleanIp}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--foreground)] opacity-90 leading-relaxed pt-0.5">
                  {result.isProxy
                    ? t.proxyTestModal.proxyDetectedDesc
                    : t.proxyTestModal.cleanIpDesc}
                </p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Exit IP */}
              <div className="p-3 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] flex flex-col justify-between gap-1">
                <span className="text-[10px] font-medium text-[var(--muted-fg)] uppercase tracking-wider">
                  {t.proxyTestModal.exitIp}
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--foreground)] truncate">
                    {result.ip || '—'}
                  </span>
                  {result.ip && (
                    <button
                      type="button"
                      onClick={() => handleCopyIp(result.ip)}
                      title={copiedIp ? t.proxyTestModal.copied : t.proxyTestModal.copyIp}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1 rounded hover:bg-[var(--muted-bg)]"
                    >
                      <i className={clsx('text-xs', copiedIp ? 'ri-check-line text-emerald-500' : 'ri-file-copy-line')} />
                    </button>
                  )}
                </div>
              </div>

              {/* Type */}
              <div className="p-3 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] flex flex-col justify-between gap-1">
                <span className="text-[10px] font-medium text-[var(--muted-fg)] uppercase tracking-wider">
                  {t.proxyTestModal.connectionType}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                    {result.proxyType || (result.isProxy ? t.proxyTestModal.datacenter : t.proxyTestModal.residential)}
                  </span>
                </div>
              </div>

              {/* Location */}
              <div className="p-3 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] flex flex-col justify-between gap-1 sm:col-span-2">
                <span className="text-[10px] font-medium text-[var(--muted-fg)] uppercase tracking-wider">
                  {t.proxyTestModal.location}
                </span>
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">{getCountryFlag(result.countryCode)}</span>
                  <span className="text-xs font-medium text-[var(--foreground)] truncate">
                    {[result.city, result.region, result.country].filter(Boolean).join(', ') || t.proxyTestModal.unknown}
                  </span>
                  {result.countryCode && (
                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)] ml-auto flex-shrink-0">
                      {result.countryCode}
                    </span>
                  )}
                </div>
              </div>

              {/* ISP / Provider */}
              <div className="p-3 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] flex flex-col justify-between gap-1">
                <span className="text-[10px] font-medium text-[var(--muted-fg)] uppercase tracking-wider">
                  {t.proxyTestModal.isp}
                </span>
                <span className="text-xs font-medium text-[var(--foreground)] truncate" title={result.provider}>
                  {result.provider || '—'}
                </span>
              </div>

              {/* Ping / Latency */}
              <div className="p-3 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] flex flex-col justify-between gap-1">
                <span className="text-[10px] font-medium text-[var(--muted-fg)] uppercase tracking-wider">
                  {t.proxyTestModal.latency}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[var(--foreground)]">
                    {result.ping ? `${result.ping}ms` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
