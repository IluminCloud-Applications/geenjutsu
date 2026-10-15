import React from 'react';
import { ProfileTable } from '../components/profiles/ProfileTable';
import { CreateProfileModal } from '../components/profiles/CreateProfileModal';
import { EditProfileModal } from '../components/profiles/EditProfileModal';
import { ImportProfileModal } from '../components/profiles/ImportProfileModal';

export const ProfilesView: React.FC = () => {
  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-card">
      <ProfileTable />
      <CreateProfileModal />
      <EditProfileModal />
      <ImportProfileModal />
    </div>
  );
};
