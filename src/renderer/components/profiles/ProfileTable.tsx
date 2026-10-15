import React from 'react';
import { useProfiles } from '../../context/ProfileContext';
import { useI18n } from '../../context/I18nContext';
import { ProfileRow } from './ProfileRow';
import { Button } from '../ui/Button';

export const ProfileTable: React.FC = () => {
  const { filteredProfiles, setIsCreateModalOpen } = useProfiles();
  const { t } = useI18n();

  return (
    <div className="flex-1 w-full overflow-auto bg-[var(--card)] select-none pb-12">
      <table className="w-full text-left border-collapse min-w-full">
        <thead className="sticky top-0 z-20 bg-[var(--table-header)] border-b border-[var(--table-border)]">
          <tr>
            <th className="py-2.5 px-3 sm:px-5 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase min-w-[140px]">
              {t.table.profileName}
            </th>
            <th className="hidden xl:table-cell py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-1/4">
              {t.table.notes}
            </th>
            <th className="hidden lg:table-cell py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-1/5">
              {t.table.proxy}
            </th>
            <th className="hidden md:table-cell py-2.5 px-4 text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase w-[15%]">
              {t.table.tags}
            </th>
            <th className="sticky right-0 z-20 bg-[var(--table-header)] py-2.5 px-3 sm:px-4 w-36 min-w-[124px] text-right text-[10.5px] font-semibold text-[var(--muted)] tracking-wider uppercase shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.06)]">
              {t.table.actions || 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map(profile => (
              <ProfileRow key={profile.id} profile={profile} />
            ))
          ) : (
            <tr>
              <td colSpan={5} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--muted-bg)] flex items-center justify-center">
                    <i className="ri-folder-open-line text-xl text-[var(--muted)]" />
                  </div>
                  <span className="text-[12.5px] text-[var(--muted)] font-medium">
                    {t.table.emptyProfiles}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <i className="ri-add-line mr-1" />
                    {t.actions.create}
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
