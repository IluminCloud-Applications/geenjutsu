import React from 'react';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { AutomationRow } from './AutomationRow';
import { Button } from '../ui/Button';

export const AutomationTable: React.FC = () => {
  const { filteredAutomations, setIsCreateAutomationModalOpen, setIsAiPromptModalOpen } = useProfiles();
  const { t } = useI18n();

  return (
    <div className="flex-1 w-full overflow-y-auto bg-[var(--card)] select-none pb-12">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-[var(--table-header)] border-b border-[var(--table-border)]">
          <tr>
            <th className="py-2.5 px-5 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[58%]">
              {t.automationsPage.tableAutomation}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[24%]">
              {t.automationsPage.tableTags}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[14%]">
              {t.automationsPage.tableStatus}
            </th>
            <th className="py-2.5 px-4 w-32 text-right text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase">
              {t.table.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredAutomations.length > 0 ? (
            filteredAutomations.map(auto => (
              <AutomationRow key={auto.id} automation={auto} />
            ))
          ) : (
            <tr>
              <td colSpan={4} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--muted-bg)] flex items-center justify-center">
                    <i className="ri-terminal-box-line text-2xl text-[var(--muted)]" />
                  </div>
                  <span className="text-[13px] text-[var(--muted)] font-medium">
                    {t.automationsPage.emptyTitle}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsCreateAutomationModalOpen(true)}
                    >
                      <i className="ri-add-line mr-1" />
                      {t.automationsPage.newAutomation}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsAiPromptModalOpen(true)}
                      className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                    >
                      <i className="ri-sparkling-2-line mr-1 text-xs" />
                      {t.automationsPage.aiPromptButton}
                    </Button>
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
