import React from 'react';
import { ProxyTable } from '../components/proxies/ProxyTable';
import { CreateProxyModal } from '../components/proxies/CreateProxyModal';
import { EditProxyModal } from '../components/proxies/EditProxyModal';

export const ProxiesView: React.FC = () => {
  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-card">
      <ProxyTable />
      <CreateProxyModal />
      <EditProxyModal />
    </div>
  );
};
