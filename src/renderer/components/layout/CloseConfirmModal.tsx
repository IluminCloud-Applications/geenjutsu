import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';

export const CloseConfirmModal: React.FC = () => {
  const {
    isCloseConfirmModalOpen,
    setIsCloseConfirmModalOpen,
    confirmCloseApp,
  } = useProfiles();
  const { t } = useI18n();

  const [selectedAction, setSelectedAction] = useState<'background' | 'quit'>('background');
  const [remember, setRemember] = useState<boolean>(false);

  // Reset local state whenever modal opens
  useEffect(() => {
    if (isCloseConfirmModalOpen) {
      setSelectedAction('background');
      setRemember(false);
    }
  }, [isCloseConfirmModalOpen]);

  const handleClose = () => {
    setIsCloseConfirmModalOpen(false);
  };

  const handleConfirm = () => {
    confirmCloseApp(selectedAction, remember);
  };

  return (
    <Modal
      isOpen={isCloseConfirmModalOpen}
      onClose={handleClose}
      title={t.closeModal.title}
      maxWidth="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t.closeModal.cancel}
          </Button>
          <Button
            variant={selectedAction === 'quit' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
          >
            <i className={selectedAction === 'quit' ? 'ri-shut-down-line mr-1' : 'ri-check-line mr-1'} />
            {t.closeModal.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted-fg)] leading-relaxed">
          {t.closeModal.question}
        </p>

        {/* Option Cards */}
        <div className="space-y-2.5">
          {/* Option: Background */}
          <div
            onClick={() => setSelectedAction('background')}
            className={clsx(
              'flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left',
              selectedAction === 'background'
                ? 'border-red-500/60 bg-red-500/8 text-[var(--foreground)]'
                : 'border-[var(--border)] bg-[var(--sidebar-primary)] hover:border-[var(--muted)]/40 hover:bg-[var(--muted-bg)]/40'
            )}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={clsx(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                  selectedAction === 'background'
                    ? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
                    : 'bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)]'
                )}
              >
                <i className="ri-stack-line text-base leading-none" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {t.closeModal.backgroundTitle}
                </span>
                <span className="text-[11px] text-[var(--muted)] leading-tight mt-0.5">
                  {t.closeModal.backgroundDesc}
                </span>
              </div>
            </div>

            <div
              className={clsx(
                'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ml-3',
                selectedAction === 'background'
                  ? 'bg-red-500 text-white'
                  : 'border border-[var(--border)] bg-[var(--card)]'
              )}
            >
              {selectedAction === 'background' && (
                <i className="ri-check-line text-[10px] leading-none" />
              )}
            </div>
          </div>

          {/* Option: Quit */}
          <div
            onClick={() => setSelectedAction('quit')}
            className={clsx(
              'flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left',
              selectedAction === 'quit'
                ? 'border-red-500/60 bg-red-500/8 text-[var(--foreground)]'
                : 'border-[var(--border)] bg-[var(--sidebar-primary)] hover:border-[var(--muted)]/40 hover:bg-[var(--muted-bg)]/40'
            )}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={clsx(
                  'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                  selectedAction === 'quit'
                    ? 'bg-red-500 text-white shadow-sm shadow-red-500/20'
                    : 'bg-[var(--muted-bg)] text-[var(--muted-fg)] border border-[var(--border)]'
                )}
              >
                <i className="ri-shut-down-line text-base leading-none" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {t.closeModal.quitTitle}
                </span>
                <span className="text-[11px] text-[var(--muted)] leading-tight mt-0.5">
                  {t.closeModal.quitDesc}
                </span>
              </div>
            </div>

            <div
              className={clsx(
                'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ml-3',
                selectedAction === 'quit'
                  ? 'bg-red-500 text-white'
                  : 'border border-[var(--border)] bg-[var(--card)]'
              )}
            >
              {selectedAction === 'quit' && (
                <i className="ri-check-line text-[10px] leading-none" />
              )}
            </div>
          </div>
        </div>

        {/* Remember choice checkbox */}
        <div className="pt-2 border-t border-[var(--border)]/60">
          <label className="flex items-start gap-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[var(--border)] text-red-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-red-600"
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[var(--foreground)] group-hover:text-red-500 transition-colors">
                {t.closeModal.rememberChoice}
              </span>
              <span className="text-[11px] text-[var(--muted)]">
                {t.closeModal.rememberHint}
              </span>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
};
