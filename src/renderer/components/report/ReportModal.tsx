import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { openExternalLink } from '../../utils/externalLinks';

const TARGET_EMAIL = 'celioswipe@gmail.com';

export type ReportType = 'bug' | 'feature';
export type EmailProvider = 'gmail' | 'outlook' | 'apple' | 'mailto';

export const ReportModal: React.FC = () => {
  const { isReportModalOpen, setIsReportModalOpen } = useProfiles();
  const { t } = useI18n();

  const [reportType, setReportType] = useState<ReportType>('bug');
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('gmail');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = description.trim().length;
  const minChars = 100;
  const isMinLengthMet = charCount >= minChars;
  const charsRemaining = Math.max(0, minChars - charCount);

  // Builds formatted email subject and content
  const buildEmailContent = () => {
    const subject =
      reportType === 'bug'
        ? '[Geenjutsu] Relato de Problema'
        : '[Geenjutsu] Sugestão de Melhoria';

    const bodyLines = [
      `Tipo: ${reportType === 'bug' ? 'Problema (Bug)' : 'Melhoria (Feature)'}`,
      `Data: ${new Date().toLocaleString()}`,
      '',
      '--- DESCRIÇÃO ---',
      description.trim(),
      '',
      '------------------',
      'Enviado através do Geenjutsu App',
    ];

    const body = bodyLines.join('\n');
    return { subject, body };
  };

  // Dispatches to browser (Gmail, Outlook) or system mailto (Apple Mail, Default)
  const handleSend = (provider: EmailProvider = emailProvider) => {
    if (!isMinLengthMet || isSubmitting) return;

    setIsSubmitting(true);
    const { subject, body } = buildEmailContent();
    let targetUrl = '';

    if (provider === 'gmail') {
      targetUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        TARGET_EMAIL
      )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else if (provider === 'outlook') {
      targetUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(
        TARGET_EMAIL
      )}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      // Apple Mail / Default mailto
      targetUrl = `mailto:${TARGET_EMAIL}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
    }

    openExternalLink(targetUrl);
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  // Copies entire formatted message to clipboard as fallback
  const handleCopyReport = async () => {
    const { subject, body } = buildEmailContent();
    const fullText = `Para: ${TARGET_EMAIL}\nAssunto: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2200);
    } catch (err) {
      console.warn('Copy report failed:', err);
    }
  };

  // Cleanup when closing modal
  const handleClose = () => {
    setDescription('');
    setReportType('bug');
    setEmailProvider('gmail');
    setIsSubmitting(false);
    setIsSubmitted(false);
    setCopyToast(false);
    setIsReportModalOpen(false);
  };

  const toggleBtn = (isActive: boolean) =>
    clsx(
      'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-[12.5px] font-medium transition-all duration-150 cursor-pointer h-9 select-none flex-1',
      isActive
        ? 'border-red-500/60 bg-red-500/8 text-red-500 font-semibold shadow-2xs'
        : 'border-[var(--border)] bg-[var(--muted-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-hover)]'
    );

  const getProviderIcon = (provider: EmailProvider) => {
    switch (provider) {
      case 'gmail':
        return 'ri-google-fill';
      case 'outlook':
        return 'ri-microsoft-fill';
      case 'apple':
        return 'ri-apple-fill';
      default:
        return 'ri-mail-send-line';
    }
  };

  const getSubmitLabel = () => {
    switch (emailProvider) {
      case 'gmail':
        return t.reportModal.submitGmail;
      case 'outlook':
        return t.reportModal.submitOutlook;
      case 'apple':
        return t.reportModal.submitApple;
      default:
        return t.reportModal.submitMailto;
    }
  };

  return (
    <Modal
      isOpen={isReportModalOpen}
      onClose={handleClose}
      title={isSubmitted ? undefined : t.reportModal.title}
      maxWidth="md"
      footer={
        isSubmitted ? (
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyReport}
              title={t.reportModal.copyMessage}
            >
              <i className="ri-file-copy-line text-xs mr-1" />
              <span>{copyToast ? t.reportModal.copiedSuccess : t.reportModal.copyMessage}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleClose}>
              {t.reportModal.close}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              {t.actions.cancel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSend(emailProvider)}
              disabled={!isMinLengthMet || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-xs mr-1.5" />
                  <span>{t.reportModal.submitting}</span>
                </>
              ) : (
                <>
                  <i className={clsx(getProviderIcon(emailProvider), 'text-xs mr-1.5')} />
                  <span>{getSubmitLabel()}</span>
                </>
              )}
            </Button>
          </div>
        )
      }
    >
      {isSubmitted ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in-scale select-none">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 text-2xl shadow-xs">
            <i className={getProviderIcon(emailProvider)} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-[var(--foreground)] tracking-tight">
              {t.reportModal.successTitle}
            </h4>
            <p className="text-xs text-[var(--muted)] max-w-sm leading-relaxed">
              {t.reportModal.successDesc}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); handleSend(emailProvider); }} className="space-y-4">
          {/* Option Selector: Problema vs Melhoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.reportModal.typeLabel}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportType('bug')}
                className={toggleBtn(reportType === 'bug')}
              >
                <i
                  className={clsx(
                    'ri-bug-line text-sm',
                    reportType === 'bug' ? 'text-red-500' : 'text-[var(--muted)]'
                  )}
                />
                <span>{t.reportModal.bug}</span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('feature')}
                className={toggleBtn(reportType === 'feature')}
              >
                <i
                  className={clsx(
                    'ri-sparkling-line text-sm',
                    reportType === 'feature' ? 'text-red-500' : 'text-[var(--muted)]'
                  )}
                />
                <span>{t.reportModal.feature}</span>
              </button>
            </div>
          </div>

          {/* Description Textarea with Minimum 100 Chars */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between select-none">
              <label htmlFor="report-description" className="text-xs font-medium text-[var(--muted-fg)]">
                {t.reportModal.descriptionLabel}
              </label>

              {copyToast && (
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1 animate-fade-in-scale">
                  <i className="ri-checkbox-circle-fill text-xs" />
                  <span>{t.reportModal.copiedSuccess}</span>
                </span>
              )}
            </div>

            <textarea
              id="report-description"
              ref={textareaRef}
              autoFocus
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.reportModal.descriptionPlaceholder}
              className={clsx(
                'w-full bg-[var(--muted-bg)] text-[var(--foreground)] text-[12.5px] font-medium rounded-lg border px-3 py-2.5 transition-all duration-150',
                'focus:outline-none placeholder:text-[var(--muted)] placeholder:font-normal resize-none',
                'border-[var(--border)] focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10 hover:border-[var(--border-hover)]'
              )}
            />

            {/* Character counter & requirement indicator */}
            <div className="flex items-center justify-between text-[11px] select-none pt-0.5">
              <span
                className={clsx(
                  'flex items-center gap-1 font-mono transition-colors duration-150',
                  isMinLengthMet ? 'text-emerald-500 font-medium' : 'text-[var(--muted)]'
                )}
              >
                {isMinLengthMet ? (
                  <>
                    <i className="ri-checkbox-circle-fill text-xs" />
                    <span>{t.reportModal.minCharsReached(charCount)}</span>
                  </>
                ) : (
                  <>
                    <i className="ri-information-line text-xs" />
                    <span>{t.reportModal.minCharsNotice(charsRemaining)}</span>
                  </>
                )}
              </span>

              <span className="font-mono text-[var(--muted)] opacity-70">
                {charCount} / {minChars}
              </span>
            </div>
          </div>

          {/* Email Provider Selector: Gmail, Outlook, Apple + Discreet mailto fallback */}
          <div className="space-y-2 pt-0.5">
            <label className="text-xs font-medium text-[var(--muted-fg)] select-none">
              {t.reportModal.providerLabel}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEmailProvider('gmail')}
                className={toggleBtn(emailProvider === 'gmail')}
              >
                <i
                  className={clsx(
                    'ri-google-fill text-sm',
                    emailProvider === 'gmail' ? 'text-red-500' : 'text-[var(--muted)]'
                  )}
                />
                <span>{t.reportModal.gmail}</span>
              </button>

              <button
                type="button"
                onClick={() => setEmailProvider('outlook')}
                className={toggleBtn(emailProvider === 'outlook')}
              >
                <i
                  className={clsx(
                    'ri-microsoft-fill text-sm',
                    emailProvider === 'outlook' ? 'text-red-500' : 'text-[var(--muted)]'
                  )}
                />
                <span>{t.reportModal.outlook}</span>
              </button>

              <button
                type="button"
                onClick={() => setEmailProvider('apple')}
                className={toggleBtn(emailProvider === 'apple')}
              >
                <i
                  className={clsx(
                    'ri-apple-fill text-sm',
                    emailProvider === 'apple' ? 'text-red-500' : 'text-[var(--muted)]'
                  )}
                />
                <span>{t.reportModal.apple}</span>
              </button>
            </div>

            {/* Discreet fallback for standard mailto */}
            <div className="flex items-center justify-between text-[11px] pt-1 px-0.5 select-none text-[var(--muted)]">
              <span>{t.reportModal.fallbackNotice}</span>
              <button
                type="button"
                onClick={() => handleSend('mailto')}
                disabled={!isMinLengthMet || isSubmitting}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.reportModal.fallbackMailto}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
