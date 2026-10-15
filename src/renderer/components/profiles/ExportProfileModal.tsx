import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Profile } from '../../../types';
import { useI18n } from '../../context/I18nContext';
import { clsx } from 'clsx';

interface ExportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
}

export const ExportProfileModal: React.FC<ExportProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const { t } = useI18n();
  const [exportType, setExportType] = useState<'cookies' | 'complete'>('complete');
  const [copied, setCopied] = useState(false);
  const [hardwareConfig, setHardwareConfig] = useState<any | null>(profile?.hardwareConfig || null);
  const [isLoadingHardware, setIsLoadingHardware] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !profile) return;
    let isMounted = true;
    setIsLoadingHardware(true);

    if (window.geenjutsuApi?.getProfileHardware) {
      window.geenjutsuApi
        .getProfileHardware(profile.id, profile.os, profile.fingerprint)
        .then((hw) => {
          if (isMounted && hw) {
            setHardwareConfig(hw);
          }
        })
        .catch((err) => {
          console.warn('[ExportProfileModal] Aviso ao sincronizar hardware:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingHardware(false);
        });
    } else {
      setIsLoadingHardware(false);
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, profile]);

  if (!profile) return null;

  const slug = profile.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');

  const getProfileCookies = () => {
    if (profile.cookies && profile.cookies.length > 0) {
      return profile.cookies;
    }
    // Default platform cookies if not explicitly set
    const domain =
      profile.platform === 'facebook'
        ? '.facebook.com'
        : profile.platform === 'google'
        ? '.google.com'
        : profile.platform === 'tiktok'
        ? '.tiktok.com'
        : '.geenjutsu.pro';

    return [
      {
        name: 'session_id',
        value: 'sess_' + Math.random().toString(36).substring(2, 14),
        domain,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      },
      {
        name: 'auth_token',
        value: 'tok_' + Math.random().toString(36).substring(2, 18),
        domain,
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'lax',
      },
      {
        name: 'device_uid',
        value: 'uid_' + Date.now(),
        domain,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      },
    ];
  };

  const getExportData = () => {
    if (exportType === 'cookies') {
      return getProfileCookies();
    }
    const activeHardware = hardwareConfig || profile.hardwareConfig || undefined;

    return {
      version: '2.0',
      app: 'Geenjutsu',
      exportedAt: Date.now(),
      profile: {
        name: profile.name,
        platform: profile.platform,
        os: profile.os,
        browser: profile.browser,
        notes: profile.notes,
        folder: profile.folderId,
        tags: profile.tags || [],
        proxy: profile.proxy || undefined,
        fingerprint: profile.fingerprint || undefined,
        hardwareConfig: activeHardware,
        cookies: getProfileCookies(),
      },
    };
  };

  const jsonString = JSON.stringify(getExportData(), null, 2);
  const fileName = exportType === 'cookies' ? `${slug}_cookies.json` : `${slug}_geenjutsu.json`;

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.exportModal?.title || 'Exportar Perfil'}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" size="sm" onClick={handleCopy} className="gap-1.5">
            <i className={copied ? 'ri-check-line text-emerald-500' : 'ri-file-copy-line'} />
            <span>{copied ? t.exportModal?.copied || 'Copiado!' : t.exportModal?.copyJson || 'Copiar JSON'}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t.actions.cancel}
            </Button>
            <Button variant="primary" size="sm" onClick={handleDownload} className="gap-1.5">
              <i className="ri-download-2-line" />
              <span>{t.exportModal?.downloadJson || 'Exportar'}</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--muted)]">
          {t.exportModal?.chooseFormat || 'Escolha o formato de exportação'}:
        </p>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Option: Complete Profile */}
          <div
            onClick={() => setExportType('complete')}
            className={clsx(
              'p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none',
              exportType === 'complete'
                ? 'border-red-500/50 bg-red-500/5 ring-1 ring-red-500/10'
                : 'border-[var(--border)] bg-[var(--sidebar-primary)] hover:border-[var(--border-hover)]'
            )}
          >
            <div
              className={clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                exportType === 'complete'
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-[var(--muted-bg)] text-[var(--muted)]'
              )}
            >
              <i className="ri-cpu-line text-base" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {t.exportModal?.completeProfile || 'Configuração completa'}
                </span>
                <div
                  className={clsx(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    exportType === 'complete'
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-[var(--border)] bg-transparent'
                  )}
                >
                  {exportType === 'complete' && <i className="ri-check-line text-[10px] font-bold" />}
                </div>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                {t.exportModal?.completeDesc ||
                  'Exporta todas as configurações do perfil para importar no Geenjutsu'}
              </p>
            </div>
          </div>

          {/* Option: Cookies Only */}
          <div
            onClick={() => setExportType('cookies')}
            className={clsx(
              'p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none',
              exportType === 'cookies'
                ? 'border-red-500/50 bg-red-500/5 ring-1 ring-red-500/10'
                : 'border-[var(--border)] bg-[var(--sidebar-primary)] hover:border-[var(--border-hover)]'
            )}
          >
            <div
              className={clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                exportType === 'cookies'
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-[var(--muted-bg)] text-[var(--muted)]'
              )}
            >
              <i className="ri-shield-keyhole-line text-base" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--foreground)]">
                  {t.exportModal?.cookiesOnly || 'Cookies'}
                </span>
                <div
                  className={clsx(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    exportType === 'cookies'
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-[var(--border)] bg-transparent'
                  )}
                >
                  {exportType === 'cookies' && <i className="ri-check-line text-[10px] font-bold" />}
                </div>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                {t.exportModal?.cookiesDesc ||
                  'Exporta apenas o arquivo JSON com os cookies deste perfil'}
              </p>
            </div>
          </div>
        </div>

        {/* File name hint */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--muted-bg)]/60 border border-[var(--border)] text-[11px] text-[var(--muted)] font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <i className="ri-file-code-line text-xs" />
            <span className="truncate">{fileName}</span>
          </div>
          <span className="text-[10px] font-sans opacity-75 uppercase flex-shrink-0">JSON</span>
        </div>
      </div>
    </Modal>
  );
};
