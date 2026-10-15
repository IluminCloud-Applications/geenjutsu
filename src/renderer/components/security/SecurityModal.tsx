import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

export const SecurityModal: React.FC = () => {
  const {
    isSecurityModalOpen,
    setIsSecurityModalOpen,
    isSecurityEnabled,
    lockApp,
    enableSecurity,
    disableSecurity,
    changeSecurityPassword,
  } = useProfiles();
  const { t } = useI18n();

  // Mode: Activate Form State
  const [createPassword, setCreatePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  // Mode: Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmNewPass, setShowConfirmNewPass] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState(false);

  // Mode: Disable Security State
  const [isConfirmingDisable, setIsConfirmingDisable] = useState(false);
  const [disablePasswordInput, setDisablePasswordInput] = useState('');
  const [showDisablePass, setShowDisablePass] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  const resetAllForms = () => {
    setCreatePassword('');
    setConfirmPassword('');
    setCreateError(null);
    setCreateSuccess(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setChangeError(null);
    setChangeSuccess(false);
    setIsConfirmingDisable(false);
    setDisablePasswordInput('');
    setDisableError(null);
  };

  const handleClose = () => {
    resetAllForms();
    setIsSecurityModalOpen(false);
  };

  // Handle Enable
  const handleEnableSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (createPassword.length < 4) {
      setCreateError(t.securityModal.passwordLengthError);
      return;
    }
    if (createPassword !== confirmPassword) {
      setCreateError(t.securityModal.passwordMismatchError);
      return;
    }

    await enableSecurity(createPassword);
    setCreateSuccess(true);
    setTimeout(() => {
      resetAllForms();
    }, 1200);
  };

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(false);

    if (!currentPassword) {
      setChangeError(t.securityModal.currentPasswordRequired);
      return;
    }
    if (newPassword.length < 4) {
      setChangeError(t.securityModal.passwordLengthError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangeError(t.securityModal.passwordMismatchError);
      return;
    }

    const result = await changeSecurityPassword(currentPassword, newPassword);
    if (!result.success) {
      setChangeError(t.securityModal.currentPasswordWrong);
    } else {
      setChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setChangeSuccess(false), 3000);
    }
  };

  // Handle Disable
  const handleDisableSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError(null);

    if (!disablePasswordInput) {
      setDisableError(t.securityModal.currentPasswordRequired);
      return;
    }

    const result = await disableSecurity(disablePasswordInput);
    if (!result.success) {
      setDisableError(t.securityModal.currentPasswordWrong);
    } else {
      resetAllForms();
    }
  };

  const handleLockNow = () => {
    handleClose();
    lockApp();
  };

  return (
    <Modal
      isOpen={isSecurityModalOpen}
      onClose={handleClose}
      title={t.securityModal.title}
      maxWidth="md"
      footer={
        <Button variant="secondary" size="sm" onClick={handleClose}>
          {t.actions.close}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Status Card */}
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-primary)]">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                isSecurityEnabled
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]'
              )}
            >
              <i
                className={clsx(
                  isSecurityEnabled ? 'ri-shield-check-fill' : 'ri-shield-line',
                  'text-lg'
                )}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {isSecurityEnabled
                    ? t.securityModal.statusEnabled
                    : t.securityModal.statusDisabled}
                </span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                    isSecurityEnabled
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-[var(--muted-bg)] text-[var(--muted)] border border-[var(--border)]'
                  )}
                >
                  {isSecurityEnabled ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">
                {t.securityModal.statusDesc}
              </p>
            </div>
          </div>

          {isSecurityEnabled && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="ri-lock-line"
              onClick={handleLockNow}
              title={t.securityModal.lockAppNow}
              className="flex-shrink-0 text-[11px] py-1 px-2.5"
            >
              <span>{t.settings.lockAppNow}</span>
            </Button>
          )}
        </div>

        {/* State A: Activate Security Form */}
        {!isSecurityEnabled ? (
          <form
            onSubmit={handleEnableSecurity}
            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3.5"
          >
            <div className="border-b border-[var(--border)]/60 pb-2.5">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {t.securityModal.enableProtection}
              </span>
            </div>

            <div className="space-y-3">
              <Input
                label={t.securityModal.newPassword}
                id="create-security-password"
                type={showCreatePass ? 'text' : 'password'}
                value={createPassword}
                onChange={e => setCreatePassword(e.target.value)}
                placeholder={t.securityModal.newPasswordPlaceholder}
                icon="ri-lock-line"
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowCreatePass(!showCreatePass)}
                    className="cursor-pointer hover:text-[var(--foreground)] transition-colors"
                  >
                    <i className={showCreatePass ? 'ri-eye-off-line' : 'ri-eye-line'} />
                  </button>
                }
                required
              />

              <Input
                label={t.securityModal.confirmPassword}
                id="confirm-security-password"
                type={showConfirmPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={t.securityModal.confirmPasswordPlaceholder}
                icon="ri-lock-line"
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="cursor-pointer hover:text-[var(--foreground)] transition-colors"
                  >
                    <i className={showConfirmPass ? 'ri-eye-off-line' : 'ri-eye-line'} />
                  </button>
                }
                required
              />
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium flex items-center gap-1.5 animate-fade-in-scale">
                <i className="ri-error-warning-fill text-xs flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 font-medium flex items-center gap-1.5 animate-fade-in-scale">
                <i className="ri-checkbox-circle-fill text-xs flex-shrink-0" />
                <span>{t.securityModal.activatedSuccess}</span>
              </div>
            )}

            <div className="pt-1 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon="ri-shield-keyhole-line"
                disabled={!createPassword || !confirmPassword}
              >
                <span>{t.securityModal.activateBtn}</span>
              </Button>
            </div>
          </form>
        ) : (
          /* State B: Change Password or Disable Security */
          <div className="space-y-3.5">
            {/* Change Password Card */}
            <form
              onSubmit={handleChangePassword}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2.5">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {t.securityModal.changePassword}
                </span>

                {changeSuccess && (
                  <span className="text-xs text-emerald-500 font-medium flex items-center gap-1 animate-fade-in-scale">
                    <i className="ri-checkbox-circle-fill text-xs" />
                    <span>{t.securityModal.updatedSuccess}</span>
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  label={t.securityModal.currentPassword}
                  id="change-current-password"
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder={t.securityModal.currentPasswordPlaceholder}
                  icon="ri-key-line"
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="cursor-pointer hover:text-[var(--foreground)] transition-colors"
                    >
                      <i className={showCurrentPass ? 'ri-eye-off-line' : 'ri-eye-line'} />
                    </button>
                  }
                  required
                />

                <div className="space-y-3">
                  <Input
                    label={t.securityModal.newPassword}
                    id="change-new-password"
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t.securityModal.newPasswordPlaceholder}
                    icon="ri-lock-line"
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="cursor-pointer hover:text-[var(--foreground)] transition-colors"
                      >
                        <i className={showNewPass ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </button>
                    }
                    required
                  />

                  <Input
                    label={t.securityModal.confirmPassword}
                    id="change-confirm-password"
                    type={showConfirmNewPass ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder={t.securityModal.confirmPasswordPlaceholder}
                    icon="ri-lock-line"
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowConfirmNewPass(!showConfirmNewPass)}
                        className="cursor-pointer hover:text-[var(--foreground)] transition-colors"
                      >
                        <i className={showConfirmNewPass ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </button>
                    }
                    required
                  />
                </div>
              </div>

              {changeError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium flex items-center gap-1.5 animate-fade-in-scale">
                  <i className="ri-error-warning-fill text-xs flex-shrink-0" />
                  <span>{changeError}</span>
                </div>
              )}

              <div className="pt-1 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!currentPassword || !newPassword || !confirmNewPassword}
                >
                  <span>{t.securityModal.updatePasswordBtn}</span>
                </Button>
              </div>
            </form>

            {/* Disable Protection Card */}
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-[var(--foreground)]">
                    {t.securityModal.disableProtection}
                  </span>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {t.securityModal.disableDesc}
                  </p>
                </div>

                {!isConfirmingDisable && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon="ri-lock-unlock-line"
                    onClick={() => setIsConfirmingDisable(true)}
                  >
                    <span>{t.securityModal.disableBtn}</span>
                  </Button>
                )}
              </div>

              {/* Inline Confirm Form */}
              {isConfirmingDisable && (
                <form
                  onSubmit={handleDisableSecurity}
                  className="pt-2 border-t border-red-500/15 space-y-3 animate-fade-in-scale"
                >
                  <Input
                    label={t.securityModal.disableConfirmPrompt}
                    id="disable-confirm-password"
                    type={showDisablePass ? 'text' : 'password'}
                    value={disablePasswordInput}
                    onChange={e => setDisablePasswordInput(e.target.value)}
                    placeholder={t.securityModal.currentPasswordPlaceholder}
                    icon="ri-key-line"
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowDisablePass(!showDisablePass)}
                        className="cursor-pointer hover:text-[var(--foreground)] transition-colors"
                      >
                        <i className={showDisablePass ? 'ri-eye-off-line' : 'ri-eye-line'} />
                      </button>
                    }
                    autoFocus
                    required
                  />

                  {disableError && (
                    <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 font-medium flex items-center gap-1.5 animate-fade-in-scale">
                      <i className="ri-error-warning-fill text-xs flex-shrink-0" />
                      <span>{disableError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsConfirmingDisable(false);
                        setDisablePasswordInput('');
                        setDisableError(null);
                      }}
                    >
                      {t.actions.cancel}
                    </Button>
                    <Button
                      type="submit"
                      variant="danger"
                      size="sm"
                      disabled={!disablePasswordInput}
                    >
                      <span>{t.securityModal.confirmDisableBtn}</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
