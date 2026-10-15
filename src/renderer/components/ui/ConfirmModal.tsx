import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useI18n } from '../../context/I18nContext';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  danger = false,
}) => {
  const { t } = useI18n();

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 pt-1">
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
            danger
              ? 'bg-red-500/8 text-red-500'
              : 'bg-[var(--accent-subtle)] text-[var(--accent)]'
          }`}
        >
          <i className={`${danger ? 'ri-delete-bin-line' : 'ri-question-line'} text-xl leading-none`} />
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[var(--foreground)] tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Modal>
  );
};
