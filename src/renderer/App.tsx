import React from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { PrimarySidebar } from './components/layout/PrimarySidebar';
import { SecondarySidebar } from './components/layout/SecondarySidebar';
import { ProxySidebar } from './components/layout/ProxySidebar';
import { AutomationSidebar } from './components/layout/AutomationSidebar';
import { ProfilesView } from './views/ProfilesView';
import { FoldersView } from './views/FoldersView';
import { ProxiesView } from './views/ProxiesView';
import { AutomationsView } from './views/AutomationsView';
import { ReferralView } from './views/ReferralView';
import { SecurityModal } from './components/security/SecurityModal';
import { LockScreen } from './components/security/LockScreen';
import { SettingsModal } from './views/SettingsModal';
import { ReportModal } from './components/report/ReportModal';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { CloseConfirmModal } from './components/layout/CloseConfirmModal';
import { ProxyTestModal } from './components/proxies/ProxyTestModal';
import { UpdateModal } from './components/updater/UpdateModal';
import { useProfiles } from './context/ProfileContext';

export const App: React.FC = () => {
  const {
    activeTab,
    isAppLocked,
    testingProxyTarget,
    setTestingProxyTarget,
    isUpdateModalOpen,
    setIsUpdateModalOpen,
    updateData,
  } = useProfiles();

  // If app lock is active, show only TitleBar with window controls and LockScreen
  if (isAppLocked) {
    return (
      <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
        <TitleBar isLockScreen />
        <LockScreen />
        <CloseConfirmModal />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden select-none">
      <TitleBar />

      <div className="flex-1 flex overflow-hidden animate-fade-in">
        <PrimarySidebar />
        {activeTab === 'profiles' && <SecondarySidebar />}
        {activeTab === 'proxies' && <ProxySidebar />}
        {activeTab === 'automations' && <AutomationSidebar />}

        <main className="flex-1 h-full flex flex-col overflow-hidden bg-card">
          {activeTab === 'profiles' && <ProfilesView />}
          {activeTab === 'folders' && <FoldersView />}
          {activeTab === 'proxies' && <ProxiesView />}
          {activeTab === 'automations' && <AutomationsView />}
          {activeTab === 'referral' && <ReferralView />}
          {activeTab !== 'profiles' &&
            activeTab !== 'folders' &&
            activeTab !== 'proxies' &&
            activeTab !== 'automations' &&
            activeTab !== 'referral' && (
              <div className="flex-1 h-full flex items-center justify-center text-[var(--muted)] text-xs">
                Em breve
              </div>
            )}
        </main>
      </div>

      {/* Global Modals */}
      <OnboardingModal />
      <SecurityModal />
      <SettingsModal />
      <ReportModal />
      <CloseConfirmModal />
      <ProxyTestModal
        isOpen={!!testingProxyTarget}
        onClose={() => setTestingProxyTarget(null)}
        target={testingProxyTarget}
      />
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateData={updateData}
      />
    </div>
  );
};
