import React from 'react';
import { useI18n } from '../context/I18nContext';
import { RecommendedAppCard } from '../components/referral/RecommendedAppCard';
import { RECOMMENDED_APPS } from '../components/referral/referralData';
import { openExternalLink, SUPPORT_PROJECT_URL } from '../utils/externalLinks';

export const ReferralView: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--card)] select-none">
      <div className="max-w-6xl mx-auto p-6 sm:p-8 lg:p-10 space-y-6">
        {/* Support the Project Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] dark:bg-amber-500/[0.03]">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
              <i className="ri-cup-line text-lg leading-none" />
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm font-bold text-[var(--foreground)] tracking-tight">
                {t.referralPage.supportTitle}
              </h3>
              <p className="text-xs text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
                {t.referralPage.supportDesc}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openExternalLink(SUPPORT_PROJECT_URL)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-all shadow-sm hover:shadow hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex-shrink-0 whitespace-nowrap self-start sm:self-auto"
          >
            <i className="ri-cup-line text-sm" />
            <span>{t.referralPage.supportBtn}</span>
          </button>
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/8 border border-red-500/20 flex items-center justify-center text-red-500">
              <i className="ri-apps-2-line text-base leading-none" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--foreground)] tracking-tight">
                {t.referralPage.recommendedSectionTitle}
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                {t.referralPage.recommendedSectionSubtitle}
              </p>
            </div>
          </div>

          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]">
            {RECOMMENDED_APPS.length} {t.referralPage.toolsCount || 'ferramentas'}
          </span>
        </div>

        {/* Grid of Recommended Apps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
          {RECOMMENDED_APPS.map(app => (
            <RecommendedAppCard key={app.id} app={app} />
          ))}
        </div>
      </div>
    </div>
  );
};

