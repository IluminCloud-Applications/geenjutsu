import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Profile } from '../../../types';

import instagramLogo from '../../assets/apps/instagram.svg';
import tiktokLogo from '../../assets/apps/tiktok.svg';
import facebookLogo from '../../assets/apps/facebook.svg';
import protonmailLogo from '../../assets/apps/protonmail.svg';
import whatsappLogo from '../../assets/apps/whatsapp.svg';
import xLogo from '../../assets/apps/x.svg';

interface InstallApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
}

interface QuickApp {
  id: string;
  name: string;
  packageName: string;
  logoSrc: string;
}

interface AppInstallStatus {
  stage: 'idle' | 'opening' | 'completed' | 'error';
  message?: string;
  error?: string;
}

const QUICK_APPS: QuickApp[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    packageName: 'com.instagram.android',
    logoSrc: instagramLogo,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    packageName: 'com.zhiliaoapp.musically',
    logoSrc: tiktokLogo,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    packageName: 'com.facebook.katana',
    logoSrc: facebookLogo,
  },
  {
    id: 'protonmail',
    name: 'Proton Mail',
    packageName: 'ch.protonmail.android',
    logoSrc: protonmailLogo,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    packageName: 'com.whatsapp',
    logoSrc: whatsappLogo,
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    packageName: 'com.twitter.android',
    logoSrc: xLogo,
  },
];

export const InstallApkModal: React.FC<InstallApkModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const [statuses, setStatuses] = useState<Record<string, AppInstallStatus>>({});
  const [manualStatus, setManualStatus] = useState<{
    stage: 'idle' | 'installing' | 'completed' | 'error';
    message?: string;
    error?: string;
  }>({ stage: 'idle' });

  if (!profile) return null;

  const handleInstallApp = async (app: QuickApp) => {
    if (!window.geenjutsuApi?.openAppInStore) return;

    setStatuses((prev) => ({
      ...prev,
      [app.id]: { stage: 'opening' },
    }));

    try {
      await window.geenjutsuApi.openAppInStore(profile.id, app.packageName);
      setStatuses((prev) => ({
        ...prev,
        [app.id]: { stage: 'completed', message: 'Aberto na loja' },
      }));
      setTimeout(() => {
        setStatuses((prev) => ({
          ...prev,
          [app.id]: { stage: 'idle' },
        }));
      }, 3500);
    } catch (err: any) {
      setStatuses((prev) => ({
        ...prev,
        [app.id]: { stage: 'error', error: err?.message || 'Falha ao abrir loja' },
      }));
    }
  };

  const handleOpenStoreHome = async () => {
    if (!window.geenjutsuApi?.openAppInStore) return;
    try {
      await window.geenjutsuApi.openAppInStore(profile.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleInstallManual = async () => {
    if (!window.geenjutsuApi?.installAndroidPackage) return;

    setManualStatus({ stage: 'installing' });
    try {
      const res = await window.geenjutsuApi.installAndroidPackage(profile.id);
      if (res.canceled) {
        setManualStatus({ stage: 'idle' });
        return;
      }

      if (res.success) {
        setManualStatus({ stage: 'completed', message: res.message || 'Instalado com sucesso!' });
        setTimeout(() => {
          setManualStatus({ stage: 'idle' });
        }, 4000);
      } else {
        setManualStatus({ stage: 'error', error: res.error || 'Falha na instalação' });
      }
    } catch (err: any) {
      setManualStatus({ stage: 'error', error: err?.message || 'Erro ao processar pacote' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Instalar Aplicativos"
      maxWidth="md"
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Barra superior de atalho para a loja */}
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs text-[var(--muted-text)]">
            Aplicativos oficiais via Aurora Store
          </span>

          <button
            type="button"
            onClick={handleOpenStoreHome}
            className="text-xs text-[var(--muted-text)] hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer transition-colors font-medium"
            title="Abrir Aurora Store para pesquisar qualquer outro aplicativo"
          >
            <i className="ri-search-line text-xs" />
            <span>Buscar outros apps</span>
          </button>
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {QUICK_APPS.map((app) => {
            const status = statuses[app.id] || { stage: 'idle' };
            const isOpening = status.stage === 'opening';
            const isCompleted = status.stage === 'completed';
            const isError = status.stage === 'error';

            return (
              <div
                key={app.id}
                className="group flex flex-col items-center justify-between p-3 rounded-xl hover:bg-[var(--muted-bg)]/40 transition-colors duration-150 text-center select-none"
              >
                {/* Logo SVG Oficial */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden drop-shadow-xs transition-transform duration-150 group-hover:scale-105 select-none shrink-0">
                  <img
                    src={app.logoSrc}
                    alt={app.name}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                </div>

                {/* Nome do app */}
                <span className="text-xs font-medium text-[var(--foreground)] mt-2 mb-2 truncate max-w-full">
                  {app.name}
                </span>

                {/* Botão de Ação */}
                <div className="w-full">
                  {isOpening ? (
                    <div className="w-full py-1 text-[11px] font-medium text-amber-400 flex items-center justify-center gap-1 bg-amber-500/10 rounded-md">
                      <i className="ri-loader-4-line animate-spin text-xs" />
                      <span>Abrindo loja...</span>
                    </div>
                  ) : isCompleted ? (
                    <div className="w-full flex items-center justify-center gap-1 py-1 text-emerald-500 text-[11px] font-medium">
                      <i className="ri-checkbox-circle-fill" />
                      <span>Aberto na Loja</span>
                    </div>
                  ) : isError ? (
                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full py-1 text-[10.5px] h-7"
                      onClick={() => handleInstallApp(app)}
                      title={status.error}
                    >
                      <i className="ri-refresh-line mr-1 text-xs" />
                      Tentar
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full py-1 text-xs font-medium h-7 hover:border-[var(--primary)]/40 flex items-center justify-center gap-1"
                      onClick={() => handleInstallApp(app)}
                    >
                      <i className="ri-external-link-line text-xs text-emerald-500" />
                      <span>Instalar</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Linha Divisória & Opção Manual APK/XAPK */}
        <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <i className="ri-file-zip-line text-sm text-[var(--muted-text)]" />
            <span className="text-xs text-[var(--muted-text)] truncate">
              Arquivo local (.apk ou .xapk)
            </span>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {manualStatus.stage === 'installing' ? (
              <span className="text-xs text-amber-400 flex items-center gap-1.5 font-medium px-2 py-1 bg-amber-500/10 rounded-md">
                <i className="ri-loader-4-line animate-spin text-xs" />
                Instalando...
              </span>
            ) : manualStatus.stage === 'completed' ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium px-2 py-1 bg-emerald-500/10 rounded-md">
                <i className="ri-checkbox-circle-fill text-xs" />
                Instalado
              </span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleInstallManual}
                className="text-xs font-medium h-7 px-3"
              >
                <i className="ri-folder-open-line mr-1 text-xs text-[var(--muted-text)]" />
                Escolher Arquivo
              </Button>
            )}
          </div>
        </div>

        {manualStatus.stage === 'error' && (
          <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-2 flex items-center gap-1.5">
            <i className="ri-error-warning-line text-xs shrink-0" />
            <span className="truncate">{manualStatus.error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
