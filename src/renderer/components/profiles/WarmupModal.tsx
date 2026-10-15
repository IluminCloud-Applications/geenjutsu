import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Profile, WarmupConfig, WarmupProgress } from '../../../types';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

interface WarmupModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
}

export const WarmupModal: React.FC<WarmupModalProps> = ({ isOpen, onClose, profile }) => {
  const { updateProfile, toggleLaunchProfile } = useProfiles();
  const { t } = useI18n();

  // Manual Warmup State
  const [siteCount, setSiteCount] = useState<number>(20);
  const TIME_PER_SITE_MIN = 30;
  const TIME_PER_SITE_MAX = 75;

  // Automatic Routine State
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false);

  // Active Progress State
  const [progress, setProgress] = useState<WarmupProgress | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.warmupConfig) {
        setAutoEnabled(Boolean(profile.warmupConfig.enabled));
        if (profile.warmupConfig.siteCountMax) {
          setSiteCount(profile.warmupConfig.siteCountMax);
        }
      } else {
        setAutoEnabled(false);
      }

      // Check if warmup is currently running for this profile
      if (window.geenjutsuApi?.getWarmupStatus) {
        window.geenjutsuApi.getWarmupStatus(profile.id).then((st) => {
          if (st && st.isRunning) {
            setProgress(st);
          } else {
            setProgress(null);
          }
        });
      }
    }
  }, [profile, isOpen]);

  // Listen to warmup progress & finish IPC events
  useEffect(() => {
    if (!window.geenjutsuApi || !isOpen || !profile) return;

    const unsubProgress = window.geenjutsuApi.onWarmupProgress((data: any) => {
      if (data && data.profileId === profile.id) {
        setProgress(data);
      }
    });

    const unsubFinished = window.geenjutsuApi.onWarmupFinished((data: any) => {
      if (data && data.profileId === profile.id) {
        setProgress(null);
        if (data.warmedCount) {
          updateProfile({
            id: profile.id,
            lastWarmupAt: Date.now(),
            totalWarmupSites: (profile.totalWarmupSites || 0) + data.warmedCount,
          });
        }
      }
    });

    return () => {
      unsubProgress?.();
      unsubFinished?.();
    };
  }, [profile, isOpen, updateProfile]);

  if (!profile) return null;

  const isRunning = Boolean(progress && progress.isRunning);

  const handleStartManualWarmup = async () => {
    if (!window.geenjutsuApi?.startWarmup) return;

    setProgress({
      profileId: profile.id,
      isRunning: true,
      currentSite: t.warmupModal.starting,
      currentIndex: 1,
      totalSites: siteCount,
      remainingSeconds: TIME_PER_SITE_MIN,
      progressPercent: 0,
    });

    await window.geenjutsuApi.startWarmup(profile.id, {
      siteCountMin: Math.max(5, siteCount - 5),
      siteCountMax: siteCount,
      timePerSiteMin: TIME_PER_SITE_MIN,
      timePerSiteMax: TIME_PER_SITE_MAX,
    });
  };

  const handleStopWarmup = async () => {
    if (!window.geenjutsuApi?.stopWarmup) return;
    await window.geenjutsuApi.stopWarmup(profile.id);
    setProgress(null);
  };

  const handleStopAndOpenBrowser = async () => {
    if (window.geenjutsuApi?.stopWarmup) {
      await window.geenjutsuApi.stopWarmup(profile.id);
    }
    setProgress(null);
    onClose();
    // Launch profile right after stopping warmup
    setTimeout(() => {
      toggleLaunchProfile(profile.id);
    }, 350);
  };

  // Instant toggle save for 21-27h automatic humanized routine
  const handleToggleAuto = async (enabled: boolean) => {
    setAutoEnabled(enabled);

    const config: WarmupConfig = {
      enabled,
      scheduleMode: 'daily',
      siteCountMin: 15,
      siteCountMax: 25,
      timePerSiteMin: 30,
      timePerSiteMax: 90,
      headless: true,
    };

    updateProfile({
      id: profile.id,
      warmupConfig: config,
    });

    if (window.geenjutsuApi?.saveWarmupConfig) {
      await window.geenjutsuApi.saveWarmupConfig(profile.id, config);
    }
  };

  const formatLastWarmup = () => {
    if (!profile.lastWarmupAt) return t.warmupModal.never;
    const diffHours = Math.floor((Date.now() - profile.lastWarmupAt) / (1000 * 60 * 60));
    if (diffHours < 1) return t.warmupModal.today;
    if (diffHours < 24) return t.warmupModal.todayHours(diffHours);
    const diffDays = Math.floor(diffHours / 24);
    return t.warmupModal.daysAgo(diffDays);
  };

  const formatNextWarmup = () => {
    if (!profile.warmupConfig?.enabled) return null;
    if (profile.status === 'running') return t.warmupModal.waitingClose;
    if (!profile.nextWarmupAt) return t.warmupModal.soon;
    const now = Date.now();
    const diffMs = profile.nextWarmupAt - now;
    if (diffMs <= 0) return t.warmupModal.anyMoment;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours < 1) return t.warmupModal.inMinutes(diffMins);
    return t.warmupModal.inHoursMinutes(diffHours, diffMins);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.warmupModal.title}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-[var(--muted)]">
            {isRunning ? t.warmupModal.runningBackground : t.warmupModal.generatesCookies}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t.actions.close}
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* Profile Header & Stats */}
        <div className="p-3 rounded-xl bg-[var(--sidebar-primary)] border border-[var(--border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center flex-shrink-0 text-base">
              <i className="ri-fire-fill" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                {profile.name}
              </span>
              <span className="text-[10px] text-[var(--muted)] truncate">
                {profile.proxy && profile.proxy.type !== 'direct' ? (
                  <>Proxy: {profile.proxy.host || profile.proxy.ipDisplay}</>
                ) : (
                  <>{t.warmupModal.directConnection}</>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right flex-shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-[9.5px] uppercase tracking-wider text-[var(--muted)]">{t.warmupModal.lastWarmup}</span>
              <span className="text-xs font-semibold text-[var(--foreground)] whitespace-nowrap">
                {formatLastWarmup()}
              </span>
            </div>
            <div className="h-6 w-px bg-[var(--border)]" />
            <div className="flex flex-col items-end">
              <span className="text-[9.5px] uppercase tracking-wider text-[var(--muted)]">{t.warmupModal.visited}</span>
              <span className="text-xs font-semibold text-red-500 whitespace-nowrap">
                {profile.totalWarmupSites || 0}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 1: INICIAR AQUECIMENTO AGORA (MANUAL) */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-play-circle-line text-sm text-[var(--foreground)]" />
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {t.warmupModal.startWarmupSection}
              </span>
            </div>
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {t.warmupModal.inProgress}
              </span>
            )}
          </div>

          {/* If Warmup is Running: Live Progress Display */}
          {isRunning && progress ? (
            <div className="p-3 rounded-lg bg-[var(--muted-bg)]/80 border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <i className="ri-loader-4-line text-red-500 animate-spin text-sm flex-shrink-0" />
                  <span className="font-semibold text-[var(--foreground)] truncate">
                    {progress.currentSite || t.warmupModal.navigating}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[var(--muted)] flex-shrink-0 ml-2">
                  {progress.currentIndex || 1}/{progress.totalSites || siteCount}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-red-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress.progressPercent || 5}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10.5px] text-[var(--muted)] pt-0.5">
                <span>
                  {t.warmupModal.timeRemaining} <strong className="text-[var(--foreground)] font-mono">{progress.remainingSeconds || 0}s</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStopWarmup}
                    className="text-red-500 hover:text-red-400 font-medium text-[10.5px] cursor-pointer transition-colors"
                  >
                    {t.warmupModal.interrupt}
                  </button>
                  <span className="text-[var(--border)]">•</span>
                  <button
                    type="button"
                    onClick={handleStopAndOpenBrowser}
                    className="text-emerald-500 hover:text-emerald-400 font-semibold text-[10.5px] cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <i className="ri-play-circle-line" />
                    {t.warmupModal.interruptAndOpen}
                  </button>
                </div>
              </div>
            </div>
          ) : profile.status === 'running' ? (
            /* Notice when browser is already open */
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                <i className="ri-shield-check-line text-amber-500 text-base flex-shrink-0 mt-0.5" />
                <div className="flex flex-col text-[11px] leading-relaxed text-[var(--foreground)]">
                  <span className="font-semibold text-amber-500">{t.warmupModal.browserOpenTitle}</span>
                  <span className="text-[var(--muted-fg)] mt-0.5">
                    {t.warmupModal.browserOpenDesc}
                  </span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled
                className="w-full gap-2 opacity-60 cursor-not-allowed"
              >
                <i className="ri-lock-line text-sm" />
                <span>{t.warmupModal.waitingBrowserClose}</span>
              </Button>
            </div>
          ) : (
            /* Configure and Start */
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-[var(--muted-fg)]">
                    {t.warmupModal.siteCountLabel}
                  </label>
                  <span className="text-xs font-mono font-semibold text-[var(--foreground)]">
                    {siteCount} {t.warmupModal.sites}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={35}
                  value={siteCount}
                  onChange={(e) => setSiteCount(Number(e.target.value))}
                  className="w-full accent-red-600 cursor-pointer h-1.5 rounded-lg bg-[var(--border)]"
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleStartManualWarmup}
                className="w-full gap-2"
              >
                <i className="ri-fire-line text-sm" />
                <span>{t.warmupModal.startWarmupBtn}</span>
              </Button>
            </div>
          )}
        </div>

        {/* SECTION 2: ROTINA DIÁRIA AUTOMÁTICA */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-sm text-[var(--foreground)]">
                <i className="ri-calendar-check-line" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[var(--foreground)] leading-tight">
                  {t.warmupModal.smartWarmupTitle}
                </span>
                <span className="text-[10px] text-[var(--muted)] leading-tight truncate">
                  {autoEnabled ? (
                    <>
                      {t.warmupModal.autoWarmupNext} <span className="text-[var(--foreground)] font-medium">{formatNextWarmup()}</span>
                    </>
                  ) : (
                    <>{t.warmupModal.autoWarmupDaily}</>
                  )}
                </span>
              </div>
            </div>

            {/* Instant Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer select-none flex-shrink-0">
              <input
                type="checkbox"
                checked={autoEnabled}
                onChange={(e) => handleToggleAuto(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-red-600" />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
};
