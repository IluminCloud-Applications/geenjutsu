import React from 'react';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { ProxyRow } from './ProxyRow';
import { Button } from '../ui/Button';

export const ProxyTable: React.FC = () => {
  const { filteredProxies, setIsCreateProxyModalOpen } = useProfiles();
  const { t } = useI18n();

  return (
    <div className="flex-1 w-full overflow-y-auto bg-[var(--card)] select-none pb-12">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-[var(--table-header)] border-b border-[var(--table-border)]">
          <tr>
            <th className="py-2.5 px-5 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[30%]">
              {t.proxiesPage.tableProxy}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[20%]">
              {t.proxiesPage.tableAuth}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[20%]">
              {t.proxiesPage.tableTags}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[12%]">
              {t.proxiesPage.tableProfiles}
            </th>
            <th className="py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[10%]">
              {t.proxiesPage.tableStatus}
            </th>
            <th className="py-2.5 px-4 w-28 text-right text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase">
              {t.table.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredProxies.length > 0 ? (
            filteredProxies.map(proxy => (
              <ProxyRow key={proxy.id} proxy={proxy} />
            ))
          ) : (
            <tr>
              <td colSpan={6} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--muted-bg)] flex items-center justify-center">
                    <i className="ri-shield-keyhole-line text-xl text-[var(--muted)]" />
                  </div>
                  <span className="text-[12.5px] text-[var(--muted)] font-medium">
                    {t.proxiesPage.emptyTitle}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateProxyModalOpen(true)}
                  >
                    <i className="ri-add-line mr-1" />
                    {t.proxiesPage.addProxy}
                  </Button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
