export interface AutomationItem {
  id: string;
  name: string;
  description?: string;
  code: string;
  tags: string[];
  createdAt: number;
  updatedAt?: number;
  lastRunAt?: number;
  lastRunStatus?: 'success' | 'failed' | 'stopped' | 'running' | 'idle';
  lastRunError?: string;
  lastRunProfileId?: string;
  lastRunProfileName?: string;
  lastRunDurationMs?: number;
}

export interface AutomationCreateInput {
  name: string;
  description?: string;
  code: string;
  tags?: string[];
}

export interface AutomationUpdateInput {
  id: string;
  name?: string;
  description?: string;
  code?: string;
  tags?: string[];
  lastRunAt?: number;
  lastRunStatus?: 'success' | 'failed' | 'stopped' | 'running' | 'idle';
  lastRunError?: string;
  lastRunProfileId?: string;
  lastRunProfileName?: string;
  lastRunDurationMs?: number;
}

export interface AutomationRunLog {
  timestamp: number;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface AutomationRunState {
  automationId: string;
  profileId: string;
  profileName: string;
  status: 'launching_browser' | 'running' | 'success' | 'failed' | 'stopped';
  startedAt: number;
  durationMs: number;
  logs: AutomationRunLog[];
  error?: string;
}
