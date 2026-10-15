import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AppIcon, BrandTextLogo } from '../ui/BrandLogo';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { ONBOARDING_STEPS_CONFIG } from './onboardingData';

export const OnboardingModal: React.FC = () => {
  const { isOnboardingModalOpen, completeOnboarding } = useProfiles();
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Keyboard navigation
  useEffect(() => {
    if (!isOnboardingModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setCurrentStep(prev => (prev < 3 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        if (currentStep === 3) {
          completeOnboarding();
        } else {
          setCurrentStep(prev => Math.min(prev + 1, 3));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOnboardingModalOpen, currentStep, completeOnboarding]);

  if (!isOnboardingModalOpen) return null;

  const ob = t.onboardingModal;

  const stepTabs = [
    { id: 0, label: ob.tabArchitecture, icon: ONBOARDING_STEPS_CONFIG[0].icon },
    { id: 1, label: ob.tabEngine, icon: ONBOARDING_STEPS_CONFIG[1].icon },
    { id: 2, label: ob.tabWarmup, icon: ONBOARDING_STEPS_CONFIG[2].icon },
    { id: 3, label: ob.tabWorkflow, icon: ONBOARDING_STEPS_CONFIG[3].icon },
  ];

  return (
    <Modal
      isOpen={isOnboardingModalOpen}
      onClose={completeOnboarding}
      maxWidth="2xl"
      className="max-w-3xl"
    >
      <div className="flex flex-col space-y-6 -m-1">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border)]/70 pb-4">
          <div className="flex items-center gap-3">
            <AppIcon sizeClass="h-7 w-auto" className="flex-shrink-0" />
            <div className="flex flex-col items-start justify-center min-w-0 text-left">
              <BrandTextLogo heightClass="h-3.5" className="self-start object-left mb-0.5" />
              <span className="text-[10px] font-mono text-[var(--muted)] tracking-wider uppercase text-left leading-none">
                {ob.welcomeBadge}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--muted)]">
              {ob.stepCounter(currentStep + 1, 4)}
            </span>
            <button
              type="button"
              onClick={completeOnboarding}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2.5 py-1 rounded-lg hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
            >
              {ob.skip}
            </button>
          </div>
        </div>

        {/* Stepper Tabs Navigation */}
        <div className="grid grid-cols-4 gap-2">
          {stepTabs.map(tab => {
            const isActive = currentStep === tab.id;
            const isCompleted = currentStep > tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCurrentStep(tab.id)}
                className={clsx(
                  'flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'border-red-500/50 bg-red-500/10 text-red-500 shadow-sm'
                    : isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500 hover:border-emerald-500/50'
                    : 'border-[var(--border)] bg-[var(--muted-bg)]/60 text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]/40'
                )}
              >
                <i
                  className={clsx(
                    isCompleted ? 'ri-check-line text-xs font-bold' : tab.icon,
                    'text-xs'
                  )}
                />
                <span className="truncate hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Slide Content Area */}
        <div className="min-h-[340px] flex flex-col justify-between">
          {/* STEP 0: Architecture & Benchmarks */}
          {currentStep === 0 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                  {ob.step1Badge}
                </span>
                <h2 className="text-lg font-bold text-[var(--foreground)] tracking-tight mt-2">
                  {ob.step1Title}
                </h2>
                <p className="text-xs text-[var(--muted)] leading-relaxed mt-1 max-w-2xl">
                  {ob.step1Desc}
                </p>
              </div>

              {/* 3 Pillars Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex flex-col justify-between space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <i className="ri-shield-keyhole-line text-base" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)]">
                      {ob.step1Card1Title}
                    </h4>
                    <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                      {ob.step1Card1Desc}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex flex-col justify-between space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                    <i className="ri-stack-line text-base" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)]">
                      {ob.step1Card2Title}
                    </h4>
                    <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                      {ob.step1Card2Desc}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex flex-col justify-between space-y-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <i className="ri-speed-up-line text-base" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)]">
                      {ob.step1Card3Title}
                    </h4>
                    <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                      {ob.step1Card3Desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Security Comparison Banner: Cloud Breaches vs 100% Local */}
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.03] space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0">
                    <i className="ri-shield-check-fill text-xs" />
                  </div>
                  <h5 className="text-xs font-bold text-[var(--foreground)] tracking-tight">
                    {ob.step1SecurityHeader}
                  </h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.04] text-[var(--muted)] space-y-1">
                    <div className="flex items-center gap-1.5 text-red-500 font-semibold text-[11px]">
                      <i className="ri-close-circle-fill text-xs" />
                      <span>{ob.step1CloudTitle}</span>
                    </div>
                    <p className="leading-relaxed">
                      {ob.step1CloudDesc}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] text-[var(--foreground)] space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-500 font-semibold text-[11px]">
                      <i className="ri-checkbox-circle-fill text-xs" />
                      <span>{ob.step1LocalTitle}</span>
                    </div>
                    <p className="text-[var(--muted)] leading-relaxed">
                      {ob.step1LocalDesc}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: C++ Native Engine vs JavaScript Injections */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                  {ob.step2Badge}
                </span>
                <h2 className="text-lg font-bold text-[var(--foreground)] tracking-tight mt-1.5">
                  {ob.step2Title}
                </h2>
                <p className="text-xs text-[var(--muted)] leading-relaxed mt-1 max-w-2xl">
                  {ob.step2Desc}
                </p>
              </div>

              {/* Side-by-side Architectural Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Legacy JS Injection Approach */}
                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]/60">
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      {ob.step2LegacyHeader}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]">
                      {ob.step2LegacyBadge}
                    </span>
                  </div>

                  <ul className="space-y-2 text-[11px] text-[var(--muted)]">
                    <li className="flex items-start gap-2">
                      <i className="ri-close-circle-line text-red-500/70 text-xs mt-0.5 flex-shrink-0" />
                      <span>{ob.step2LegacyItem1}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-close-circle-line text-red-500/70 text-xs mt-0.5 flex-shrink-0" />
                      <span>{ob.step2LegacyItem2}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-close-circle-line text-red-500/70 text-xs mt-0.5 flex-shrink-0" />
                      <span>{ob.step2LegacyItem3}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-close-circle-line text-red-500/70 text-xs mt-0.5 flex-shrink-0" />
                      <span>{ob.step2LegacyItem4}</span>
                    </li>
                  </ul>
                </div>

                {/* Geenjutsu Native C++ Approach */}
                <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/[0.03] dark:bg-red-500/[0.04] space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-red-500/20">
                    <div className="flex items-center gap-1.5">
                      <i className="ri-cpu-line text-red-500 text-xs" />
                      <span className="text-xs font-bold text-[var(--foreground)]">
                        {ob.step2GeenjutsuHeader}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                      {ob.step2GeenjutsuBadge}
                    </span>
                  </div>

                  <ul className="space-y-2 text-[11px] text-[var(--foreground)]">
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-line text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
                      <span>{ob.step2GeenjutsuItem1}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-line text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
                      <span>{ob.step2GeenjutsuItem2}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-line text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
                      <span>{ob.step2GeenjutsuItem3}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-line text-emerald-500 text-xs mt-0.5 flex-shrink-0" />
                      <span className="font-medium">{ob.step2GeenjutsuItem4}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-emerald-600 dark:text-emerald-400">
                <i className="ri-shield-check-line text-sm flex-shrink-0" />
                <span>Zero protótipos modificados no DOM. Aprovado em testes de telemetria avançada (CreepJS, Pixelscan e BrowserLeaks).</span>
              </div>
            </div>
          )}

          {/* STEP 2: Automatic Cookie Warming */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                  {ob.step3Badge}
                </span>
                <h2 className="text-lg font-bold text-[var(--foreground)] tracking-tight mt-1.5">
                  {ob.step3Title}
                </h2>
                <p className="text-xs text-[var(--muted)] leading-relaxed mt-1 max-w-2xl">
                  {ob.step3Desc}
                </p>
              </div>

              {/* 3 Pipeline Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                      <i className="ri-route-line text-base" />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--muted)]">01 / 03</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[var(--foreground)]">
                    {ob.step3Card1Title}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    {ob.step3Card1Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                      <i className="ri-pie-chart-2-line text-base" />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--muted)]">02 / 03</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[var(--foreground)]">
                    {ob.step3Card2Title}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    {ob.step3Card2Desc}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                      <i className="ri-time-line text-base" />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--muted)]">03 / 03</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[var(--foreground)]">
                    {ob.step3Card3Title}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                    {ob.step3Card3Desc}
                  </p>
                </div>
              </div>

              {/* Status Simulation Bar */}
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--muted-bg)]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    Motor Playwright Integrado
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    • Navegação autônoma em background
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]">
                  Disponível no menu de cada perfil
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Complete Workflow Ready */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                  {ob.step4Badge}
                </span>
                <h2 className="text-lg font-bold text-[var(--foreground)] tracking-tight mt-1.5">
                  {ob.step4Title}
                </h2>
                <p className="text-xs text-[var(--muted)] leading-relaxed mt-1 max-w-2xl">
                  {ob.step4Desc}
                </p>
              </div>

              {/* 4 Feature Pillars Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 flex-shrink-0 mt-0.5">
                    <i className="ri-broadcast-line text-base" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)]">
                      {ob.step4Card1Title}
                    </h4>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                      {ob.step4Card1Desc}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 flex-shrink-0 mt-0.5">
                    <i className="ri-code-s-slash-line text-base" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)]">
                      {ob.step4Card2Title}
                    </h4>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                      {ob.step4Card2Desc}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0 mt-0.5">
                    <i className="ri-arrow-left-right-line text-base" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)]">
                      {ob.step4Card3Title}
                    </h4>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                      {ob.step4Card3Desc}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)] flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 flex-shrink-0 mt-0.5">
                    <i className="ri-lock-password-line text-base" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--foreground)]">
                      {ob.step4Card4Title}
                    </h4>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                      {ob.step4Card4Desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ready banner */}
              <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <i className="ri-check-double-line text-red-500 text-sm" />
                  <span className="text-[11px] font-medium text-[var(--foreground)]">
                    Arquitetura 100% pronta para operações de contingência em escala.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-red-500 font-semibold uppercase">
                  Zero Telemetria
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]/70">
          <div>
            {currentStep > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCurrentStep(prev => prev - 1)}
              >
                <i className="ri-arrow-left-line text-xs mr-1" />
                <span>{ob.back}</span>
              </Button>
            ) : (
              <div className="w-16" />
            )}
          </div>

          {/* Stepper Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map(stepIdx => (
              <button
                key={stepIdx}
                type="button"
                onClick={() => setCurrentStep(stepIdx)}
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
                  currentStep === stepIdx
                    ? 'w-6 bg-red-500'
                    : 'w-1.5 bg-[var(--border)] hover:bg-[var(--muted)]'
                )}
                aria-label={`Ir para passo ${stepIdx + 1}`}
              />
            ))}
          </div>

          <div>
            {currentStep < 3 ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setCurrentStep(prev => prev + 1)}
              >
                <span>{ob.next}</span>
                <i className="ri-arrow-right-line text-xs ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={completeOnboarding}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold shadow-md shadow-red-600/20"
              >
                <i className="ri-rocket-line text-xs mr-1.5" />
                <span>{ob.start}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
