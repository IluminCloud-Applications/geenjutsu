import React from 'react';
import { AutomationTable } from '../components/automations/AutomationTable';
import { CreateAutomationModal } from '../components/automations/CreateAutomationModal';
import { EditAutomationModal } from '../components/automations/EditAutomationModal';
import { RunAutomationModal } from '../components/automations/RunAutomationModal';
import { AiPromptModal } from '../components/automations/AiPromptModal';

export const AutomationsView: React.FC = () => {
  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-card">
      <AutomationTable />
      <CreateAutomationModal />
      <EditAutomationModal />
      <RunAutomationModal />
      <AiPromptModal />
    </div>
  );
};
