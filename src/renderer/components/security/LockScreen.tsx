import React, { useState, useRef, useEffect } from 'react';
import { SharinganLogo } from '../ui/SharinganLogo';
import { BrandTextLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { clsx } from 'clsx';

export const LockScreen: React.FC = () => {
  const { verifyPassword, completeUnlock } = useProfiles();
  const { t } = useI18n();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus password input immediately on render
    inputRef.current?.focus();
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isVerifying || isUnlocking) return;

    setError(null);
    setIsVerifying(true);

    const isValid = await verifyPassword(password);

    if (!isValid) {
      setIsVerifying(false);
      setError(t.lockScreen.wrongPassword);
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 450);
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    // Password is valid: trigger spinning and smooth unlock animation
    setIsVerifying(false);
    setIsUnlocking(true);

    // Give time for the Sharingan spin and fade transition to play out
    setTimeout(() => {
      completeUnlock();
    }, 650);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 bg-[var(--background)] select-none">
      {/* Centered Lock Card */}
      <div
        className={clsx(
          'w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 sm:p-8 flex flex-col items-center text-center shadow-xl space-y-6 transition-all',
          isShaking && 'animate-shake',
          isUnlocking && 'animate-unlock-fade pointer-events-none'
        )}
      >
        {/* Brand Sharingan Icon & Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <SharinganLogo size={52} glow={true} spinning={isUnlocking} />
          </div>
          <BrandTextLogo heightClass="h-5" className="mt-1" />
        </div>

        {/* Status prompt */}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--foreground)] tracking-tight">
            {isUnlocking ? 'Acesso Autorizado' : t.lockScreen.title}
          </h2>
          <p className="text-xs text-[var(--muted)] max-w-xs">
            {isUnlocking ? 'Desbloqueando Geenjutsu...' : t.lockScreen.prompt}
          </p>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="w-full space-y-4">
          <div className="space-y-1.5 text-left">
            <div className="relative flex items-center w-full">
              <div className="absolute left-3 text-[var(--muted)] pointer-events-none flex items-center">
                <i className={clsx(isUnlocking ? 'ri-lock-unlock-line text-emerald-500' : 'ri-lock-2-line', 'text-sm transition-colors')} />
              </div>

              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                disabled={isUnlocking}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t.lockScreen.placeholder}
                className={clsx(
                  'w-full h-10 bg-[var(--muted-bg)] text-[var(--foreground)] text-[13px] font-medium rounded-lg border pl-9 pr-9 transition-all duration-150',
                  error
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-[var(--border)] focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10 hover:border-[var(--border-hover)]',
                  'placeholder:text-[var(--muted)] placeholder:font-normal focus:outline-none',
                  isUnlocking && 'opacity-60 cursor-not-allowed'
                )}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isUnlocking}
                className="absolute right-3 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex items-center"
              >
                <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
              </button>
            </div>

            {error && (
              <div className="text-[11px] text-red-500 font-medium flex items-center gap-1 pt-0.5 animate-fade-in-scale">
                <i className="ri-error-warning-fill text-xs" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!password || isVerifying || isUnlocking}
            className={clsx(
              'w-full justify-center h-10 text-[13px] transition-all duration-200',
              isUnlocking && 'bg-emerald-600 hover:bg-emerald-600 shadow-emerald-600/30'
            )}
          >
            {isUnlocking ? (
              <span className="flex items-center gap-2 animate-fade-in-scale">
                <i className="ri-checkbox-circle-line text-sm" />
                <span>Acessando...</span>
              </span>
            ) : isVerifying ? (
              <span className="flex items-center gap-2">
                <i className="ri-loader-4-line animate-spin text-sm" />
                <span>Verificando...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <i className="ri-key-line text-sm" />
                <span>{t.lockScreen.unlockBtn}</span>
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
