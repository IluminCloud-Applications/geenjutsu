import React, { useState, useRef, useEffect } from 'react';
import { useProfiles } from '../../../context/ProfileContext';
import { useTables } from '../../../context/TableContext';
import { Button } from '../../ui/Button';

interface ProfileCellProps {
  value: string | null | undefined; // profileId
  rowId: string;
  columnId: string;
  onChange: (profileId: string | null) => void;
}

export const ProfileCell: React.FC<ProfileCellProps> = ({
  value,
  rowId,
  columnId,
  onChange,
}) => {
  const { profiles, toggleLaunchProfile } = useProfiles();
  const { setProfilePickerTarget } = useTables();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const profile = profiles.find(p => p.id === value);
  const isRunning = profile?.status === 'running';
  const isLaunching = profile?.status === 'launching';

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [isMenuOpen]);

  // If no profile is attached to this cell
  if (!value) {
    return (
      <div className="w-full flex items-center min-h-[32px] px-1">
        <button
          type="button"
          onClick={() =>
            setProfilePickerTarget({
              rowId,
              columnId,
              currentProfileId: undefined,
            })
          }
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] border border-dashed border-[var(--border)] transition-colors cursor-pointer group"
        >
          <i className="ri-user-add-line text-xs text-[var(--muted)] group-hover:text-red-500 transition-colors" />
          <span>Vincular Perfil</span>
        </button>
      </div>
    );
  }

  // If profileId exists but profile was deleted in Geenjutsu
  if (!profile) {
    return (
      <div className="w-full flex items-center justify-between min-h-[32px] px-1 text-xs">
        <span className="text-amber-500/80 text-[11px] italic flex items-center gap-1 truncate">
          <i className="ri-error-warning-line" /> Perfil não encontrado
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Desvincular"
          className="text-[var(--muted)] hover:text-red-500 p-1 cursor-pointer"
        >
          <i className="ri-close-line text-xs" />
        </button>
      </div>
    );
  }

  // Profile is bound! Display profile info and Launch/Stop button!
  return (
    <div className="w-full flex items-center justify-between gap-2 min-h-[32px] px-1 group">
      {/* Profile info: dot status + name */}
      <div
        className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
        onClick={() =>
          setProfilePickerTarget({
            rowId,
            columnId,
            currentProfileId: profile.id,
          })
        }
        title={`Perfil: ${profile.name} (clique para trocar)`}
      >
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {isRunning ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </>
          ) : isLaunching ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </>
          ) : (
            <span className="inline-flex rounded-full h-2 w-2 bg-[var(--muted)]/50" />
          )}
        </span>
        <span className="text-xs font-semibold text-[var(--foreground)] truncate max-w-[120px] group-hover:text-red-500 transition-colors">
          {profile.name}
        </span>
      </div>

      {/* Action: Iniciar / Parar Button matching Profiles Table */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant={isRunning ? 'stop' : 'launch'}
          size="sm"
          icon={isRunning ? 'ri-stop-fill' : isLaunching ? 'ri-loader-4-line animate-spin' : 'ri-play-fill'}
          disabled={isLaunching}
          onClick={e => {
            e.stopPropagation();
            toggleLaunchProfile(profile.id);
          }}
          className="h-7 px-2.5 text-[11px] font-semibold"
        >
          {isRunning ? 'Parar' : isLaunching ? 'Abrindo...' : 'Iniciar'}
        </Button>

        {/* More options menu (Trocar / Desvincular) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setIsMenuOpen(prev => !prev);
            }}
            className="w-6 h-7 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--muted-bg)] cursor-pointer transition-colors"
          >
            <i className="ri-more-2-fill text-xs" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-8 z-30 w-40 bg-[var(--sidebar-primary)] border border-[var(--border)] rounded-lg shadow-lg py-1 flex flex-col animate-scale-in">
              {!isRunning && !isLaunching && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    toggleLaunchProfile(profile.id, { economyMode: true });
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                >
                  <i className="ri-leaf-line text-xs" />
                  <span>Modo Economia</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setProfilePickerTarget({
                    rowId,
                    columnId,
                    currentProfileId: profile.id,
                  });
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-[var(--foreground)] hover:bg-[var(--muted-bg)] cursor-pointer"
              >
                <i className="ri-swap-line text-xs text-[var(--muted)]" />
                <span>Trocar Perfil</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onChange(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-red-500 hover:bg-red-500/10 cursor-pointer"
              >
                <i className="ri-link-unlink text-xs" />
                <span>Desvincular</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
