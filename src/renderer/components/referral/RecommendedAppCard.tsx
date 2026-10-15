import React, { useState } from 'react';
import { RecommendedApp } from '../../../types';
import { openExternalLink } from '../../utils/externalLinks';
import { useI18n } from '../../context/I18nContext';
import { clsx } from 'clsx';

interface RecommendedAppCardProps {
  app: RecommendedApp;
}

function resolveReferralUrl(url: string): string {
  const isVideo = url.includes('youtube.com') || url.includes('youtu.be');
  if (isVideo) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('src')) {
      parsed.searchParams.set('src', 'geenjutsu');
    }
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return url.includes('src=') ? url : `${url}${separator}src=geenjutsu`;
  }
}

export const RecommendedAppCard: React.FC<RecommendedAppCardProps> = ({ app }) => {
  const { locale, t } = useI18n();
  const [imgError, setImgError] = useState(false);
  const isVideo = app.url.includes('youtube.com') || app.url.includes('youtu.be');
  const targetUrl = resolveReferralUrl(app.url);

  const isEn = locale === 'en';
  const tagline = isEn && app.taglineEn ? app.taglineEn : app.tagline;
  const description = isEn && app.descriptionEn ? app.descriptionEn : app.description;
  const badge = isEn && app.badgeEn ? app.badgeEn : app.badge;
  const ctaText = isVideo
    ? t.referralPage.watchDemo
    : `${t.referralPage.openApp} ${app.name}`;

  return (
    <div
      onClick={() => openExternalLink(targetUrl)}
      className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-red-500/40 hover:bg-[var(--sidebar-secondary)]/70 p-5 transition-all duration-150 cursor-pointer group select-none shadow-xs"
    >
      <div className="space-y-3">
        {/* Top Header: Logo, Title, Badge, External Arrow */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo */}
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              {!imgError ? (
                <img
                  src={app.logo}
                  alt={app.name}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain select-none pointer-events-none"
                />
              ) : (
                <i className={clsx(app.fallbackIcon, 'text-2xl text-[var(--foreground)] group-hover:text-red-500 transition-colors')} />
              )}
            </div>

            {/* Name, Domain & Badge */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-[var(--foreground)] tracking-tight truncate group-hover:text-red-500 transition-colors">
                  {app.name}
                </h3>
                {badge && (
                  <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)] uppercase tracking-wider flex-shrink-0">
                    {badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-[var(--muted)] truncate">
                {app.domain}
              </span>
            </div>
          </div>

          {/* External indicator */}
          <div className="w-7 h-7 rounded-lg bg-[var(--muted-bg)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] group-hover:text-red-500 group-hover:border-red-500/30 transition-colors flex-shrink-0">
            <i
              className={clsx(
                isVideo ? 'ri-play-circle-line' : 'ri-arrow-right-up-line',
                'text-sm transition-transform duration-150 group-hover:scale-110'
              )}
            />
          </div>
        </div>

        {/* Tagline */}
        <div className="text-[12px] font-semibold text-[var(--foreground)] tracking-tight">
          {tagline}
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--muted)] leading-relaxed min-h-[44px]">
          {description}
        </p>
      </div>

      {/* Footer direct link hint */}
      <div className="pt-3 mt-3 border-t border-[var(--border)]/50 flex items-center justify-between text-[11px] text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
        <span className="font-medium">
          {ctaText}
        </span>
        <i
          className={clsx(
            isVideo
              ? 'ri-youtube-line text-xs group-hover:text-red-500'
              : 'ri-arrow-right-line text-xs transition-transform duration-150 group-hover:translate-x-1 group-hover:text-red-500'
          )}
        />
      </div>
    </div>
  );
};
