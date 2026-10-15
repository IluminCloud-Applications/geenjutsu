import React, { useState } from 'react';
import { AutomationItem } from '../../types';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { ContextMenu } from '../ui/ContextMenu';
import { ConfirmModal } from '../ui/ConfirmModal';

interface AutomationRowProps {
  automation: AutomationItem;
}

export const AutomationRow: React.FC<AutomationRowProps> = ({ automation }) => {
  const {
    setEditingAutomation,
    setRunningAutomation,
    deleteAutomation,
    duplicateAutomation,
    stopAutomation,
  } = useProfiles();
  const { t } = useI18n();

  const isRunning = automation.lastRunStatus === 'running';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const menuItems: DropdownItem[] = [
    isRunning
      ? {
          label: t.actions.stop || 'Parar',
          icon: 'ri-stop-fill',
          danger: true,
          onClick: () => stopAutomation(automation.id),
        }
      : {
          label: t.automationsPage.runAutomation,
          icon: 'ri-play-fill',
          onClick: () => setRunningAutomation(automation),
        },
    {
      label: t.actions.edit,
      icon: 'ri-edit-line',
      onClick: () => setEditingAutomation(automation),
    },
    {
      label: t.actions.clone,
      icon: 'ri-file-copy-line',
      onClick: () => duplicateAutomation(automation.id),
    },
    {
      label: t.actions.delete,
      icon: 'ri-delete-bin-line',
      onClick: () => setConfirmDelete(true),
      danger: true,
      divider: true,
    },
  ];

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('geenjutsu:close-context-menu'));
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const firstCodeLine = automation.code
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 0 && !l.startsWith('//')) || 'await page.goto(...)';

  return (
    <>
      <tr
        onContextMenu={handleContextMenu}
        className="group border-b border-[var(--table-border)] transition-colors duration-100 hover:bg-[var(--table-row-hover)] cursor-default"
      >
        {/* Name and Description */}
        <td className="py-3 px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
              <i className="ri-terminal-box-line" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[var(--foreground)] truncate">
                {automation.name}
              </div>
              <div className="text-[11px] text-[var(--muted)] truncate">
                {automation.description || firstCodeLine}
              </div>
            </div>
          </div>
        </td>

        {/* Tags */}
        <td className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-1 max-w-[200px]">
            {automation.tags && automation.tags.length > 0 ? (
              automation.tags.slice(0, 3).map(tag => (
                <Badge key={tag} label={`#${tag}`} variant="neutral" className="text-[10px] px-1.5 py-0.2" />
              ))
            ) : (
              <span className="text-[11px] text-[var(--muted)]">-</span>
            )}
            {automation.tags && automation.tags.length > 3 && (
              <span className="text-[10px] text-[var(--muted)] font-mono">
                +{automation.tags.length - 3}
              </span>
            )}
          </div>
        </td>


        {/* Status */}
        <td className="py-3 px-4">
          {automation.lastRunStatus === 'running' ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md animate-pulse">
              <i className="ri-loader-4-line animate-spin text-xs" />
              <span>{t.automationsPage.statusRunning}</span>
            </span>
          ) : automation.lastRunStatus === 'success' ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              <i className="ri-checkbox-circle-line text-xs" />
              <span>{t.automationsPage.statusSuccess}</span>
            </span>
          ) : automation.lastRunStatus === 'stopped' ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              <i className="ri-stop-circle-line text-xs" />
              <span>{t.automationsPage.statusStopped}</span>
            </span>
          ) : automation.lastRunStatus === 'failed' ? (
            <span
              className="inline-flex items-center gap-1 text-[10.5px] font-medium text-red-500 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-md"
              title={automation.lastRunError}
            >
              <i className="ri-error-warning-line text-xs" />
              <span>{t.automationsPage.statusFailed}</span>
            </span>
          ) : (
            <Badge label={t.automationsPage.statusIdle} variant="neutral" />
          )}
        </td>

        {/* Actions */}
        <td className="py-3 px-4 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {/* Quick Run / Stop Button */}
            {isRunning ? (
              <Button
                variant="stop"
                size="sm"
                icon="ri-stop-fill"
                onClick={() => stopAutomation(automation.id)}
                className="min-w-[76px]"
              >
                {t.actions.stop || 'Parar'}
              </Button>
            ) : (
              <Button
                variant="launch"
                size="sm"
                icon="ri-play-fill"
                onClick={() => setRunningAutomation(automation)}
                className="min-w-[76px]"
              >
                {t.automationsPage.runAutomation}
              </Button>
            )}

            {/* Context Dropdown */}
            <Dropdown
              trigger={
                <button
                  type="button"
                  className="w-7 h-7 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] rounded-md hover:bg-[var(--muted-bg)] transition-colors cursor-pointer"
                >
                  <i className="ri-more-2-fill text-sm leading-none" />
                </button>
              }
              items={menuItems}
              align="right"
            />
          </div>
        </td>
      </tr>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={menuItems} onClose={() => setContextMenu(null)} />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteAutomation(automation.id);
          setConfirmDelete(false);
        }}
        title={t.automationsPage.deleteConfirmTitle}
        description={t.automationsPage.deleteConfirmDesc(automation.name)}
        confirmLabel={t.actions.delete}
        danger
      />
    </>
  );
};
