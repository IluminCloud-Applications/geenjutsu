import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Profile,
  Folder,
  TabType,
  ProfileCreateInput,
  ProfileUpdateInput,
  FolderUpdateInput,
  ProxyItem,
  ProxyCreateInput,
  ProxyUpdateInput,
  SecurityConfig,
  PrivacyConfig,
  AutomationItem,
  AutomationCreateInput,
  AutomationUpdateInput,
  AutomationRunState,
  CloseAction,
} from '../../types';
import { parseProxyString, detectCountryFromHost } from '../utils/proxyParser';
import { ProxyTestTarget } from '../components/proxies/ProxyTestModal';
import { UpdateService, UpdateCheckResult } from '../services/updateService';

interface ProfileContextType {
  testingProxyTarget: ProxyTestTarget | null;
  setTestingProxyTarget: (target: ProxyTestTarget | null) => void;
  // Close / Tray Behavior
  closeAction: CloseAction;
  setCloseAction: (action: CloseAction) => void;
  isCloseConfirmModalOpen: boolean;
  setIsCloseConfirmModalOpen: (open: boolean) => void;
  handleCloseApp: () => void;
  confirmCloseApp: (action: 'background' | 'quit', remember: boolean) => void;

  // App Access Security
  isSecurityEnabled: boolean;
  isAppLocked: boolean;
  isSecurityModalOpen: boolean;
  setIsSecurityModalOpen: (open: boolean) => void;
  lockApp: () => void;
  unlockApp: (password: string) => Promise<boolean>;
  verifyPassword: (password: string) => Promise<boolean>;
  completeUnlock: () => void;
  enableSecurity: (password: string) => Promise<boolean>;
  disableSecurity: (currentPassword: string) => Promise<{ success: boolean; error?: string }>;
  changeSecurityPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;

  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedFolderId: string;
  setSelectedFolderId: (folderId: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  folderSearchQuery: string;
  setFolderSearchQuery: (query: string) => void;
  folders: Folder[];
  filteredFolders: Folder[];
  addFolder: (name: string, description?: string, icon?: string) => Folder;
  updateFolder: (input: FolderUpdateInput) => void;
  deleteFolder: (id: string) => void;
  isCreateFolderModalOpen: boolean;
  setIsCreateFolderModalOpen: (open: boolean) => void;
  editingFolder: Folder | null;
  setEditingFolder: (folder: Folder | null) => void;
  // Proxies
  proxies: ProxyItem[];
  filteredProxies: ProxyItem[];
  addProxy: (input: ProxyCreateInput) => ProxyItem;
  updateProxy: (input: ProxyUpdateInput) => void;
  deleteProxy: (id: string) => void;
  testProxyConnection: (id: string) => Promise<{ success: boolean; ping: number }>;
  selectedProxyFilter: string;
  setSelectedProxyFilter: (filter: string) => void;
  proxySearchQuery: string;
  setProxySearchQuery: (query: string) => void;
  isCreateProxyModalOpen: boolean;
  setIsCreateProxyModalOpen: (open: boolean) => void;
  editingProxy: ProxyItem | null;
  setEditingProxy: (proxy: ProxyItem | null) => void;
  proxyProfileCounts: Record<string, number>;
  // Automations
  automations: AutomationItem[];
  filteredAutomations: AutomationItem[];
  selectedAutomationFilter: string;
  setSelectedAutomationFilter: (filter: string) => void;
  automationSearchQuery: string;
  setAutomationSearchQuery: (query: string) => void;
  isCreateAutomationModalOpen: boolean;
  setIsCreateAutomationModalOpen: (open: boolean) => void;
  editingAutomation: AutomationItem | null;
  setEditingAutomation: (automation: AutomationItem | null) => void;
  runningAutomation: AutomationItem | null;
  setRunningAutomation: (automation: AutomationItem | null) => void;
  isAiPromptModalOpen: boolean;
  setIsAiPromptModalOpen: (open: boolean) => void;
  automationRunState: AutomationRunState | null;
  setAutomationRunState: React.Dispatch<React.SetStateAction<AutomationRunState | null>>;
  addAutomation: (input: AutomationCreateInput) => AutomationItem;
  updateAutomation: (input: AutomationUpdateInput) => void;
  deleteAutomation: (id: string) => void;
  duplicateAutomation: (id: string) => void;
  runAutomationOnProfile: (automationId: string, profileId: string, customCode?: string) => Promise<{ success: boolean; error?: string }>;
  stopAutomation: (automationId: string) => Promise<boolean>;
  // Profiles
  profiles: Profile[];
  filteredProfiles: Profile[];
  createProfile: (input: ProfileCreateInput) => Profile;
  createBulkProfiles: (inputs: ProfileCreateInput[]) => Profile[];
  updateProfile: (input: ProfileUpdateInput) => void;
  toggleLaunchProfile: (id: string) => void;
  warmingProfileIds: string[];
  isProfileWarming: (profileId: string) => boolean;
  stopProfileWarmup: (profileId: string) => Promise<boolean>;
  moveToTrash: (id: string) => void;

  restoreFromTrash: (id: string) => void;
  permanentDelete: (id: string) => void;
  cloneProfile: (id: string) => void;
  togglePinProfile: (id: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  editingProfile: Profile | null;
  setEditingProfile: (profile: Profile | null) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  isOnboardingModalOpen: boolean;
  setIsOnboardingModalOpen: (open: boolean) => void;
  completeOnboarding: () => void;
  isReportModalOpen: boolean;
  setIsReportModalOpen: (open: boolean) => void;
  isImportProfileModalOpen: boolean;
  setIsImportProfileModalOpen: (open: boolean) => void;
  importFullProfile: (data: any) => { success: boolean; profile?: Profile; error?: string };
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  privacyConfig: PrivacyConfig;
  setPrivacyConfig: React.Dispatch<React.SetStateAction<PrivacyConfig>>;
  togglePrivacyField: (field: keyof PrivacyConfig) => void;
  toggleAllPrivacy: () => void;
  sessionExemptProfileIds: string[];
  counts: {
    all: number;
    running: number;
    trash: number;
    [key: string]: number;
  };
  // Update System
  updateData: UpdateCheckResult | null;
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: (open: boolean) => void;
  checkForUpdates: (force?: boolean) => Promise<UpdateCheckResult>;
}

const DEFAULT_FOLDERS: Folder[] = [];
const INITIAL_PROFILES: Profile[] = [];
const INITIAL_PROXIES: ProxyItem[] = [];

const INITIAL_AUTOMATIONS: AutomationItem[] = [
  {
    id: 'auto-warmup-news',
    name: 'Aquecimento em Notícias (G1)',
    description: 'Acessa portal de notícias, aceita cookies, escolhe aleatoriamente de 2 a 5 notícias e realiza rolagem humanizada.',
    tags: ['aquecimento', 'notícias', 'cookies'],
    code: `// Automação: Leitura de Notícias & Aquecimento
console.log('Iniciando aquecimento no G1...');
await page.goto('https://g1.globo.com', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// 1. Aceitar consentimento de cookies se houver banner
await page.evaluate(() => {
  try {
    const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const acceptBtn = btns.find((b) => {
      const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
      return (
        txt.includes('aceitar') ||
        txt.includes('concordar') ||
        txt.includes('entendi') ||
        txt.includes('prosseguir') ||
        txt.includes('permitir') ||
        txt.includes('continuar')
      );
    });
    if (acceptBtn) acceptBtn.click();
  } catch {}
});

// 2. Coletar links de matérias jornalísticas
const newsLinks = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const valid = links
    .map((a) => a.getAttribute('href') || '')
    .filter((h) => h.includes('g1.globo.com') && h.includes('.ghtml') && !h.includes('#'));
  return Array.from(new Set(valid));
});

console.log(\`\${newsLinks.length} matérias encontradas na página principal.\`);

// 3. Escolher aleatoriamente entre 2 e 5 notícias para ler
const targetCount = Math.min(newsLinks.length, Math.floor(Math.random() * 4) + 2);
const selectedLinks = newsLinks.sort(() => 0.5 - Math.random()).slice(0, targetCount);
console.log(\`Meta do aquecimento: ler \${targetCount} notícias selecionadas.\`);

for (let i = 0; i < selectedLinks.length; i++) {
  const url = selectedLinks[i];
  console.log(\`[\${i + 1}/\${targetCount}] Abrindo matéria: \${url}\`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Simular leitura com 3 a 5 rolagens suaves
    const scrolls = Math.floor(Math.random() * 3) + 3;
    for (let s = 0; s < scrolls; s++) {
      const distance = Math.floor(Math.random() * 260) + 180;
      await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), distance);
      const readingTime = Math.floor(Math.random() * 2500) + 1500;
      await page.waitForTimeout(readingTime);
    }

    // Leve retorno para cima (releitura natural)
    if (Math.random() < 0.5) {
      await page.evaluate(() => window.scrollBy({ top: -100, behavior: 'smooth' }));
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.warn(\`Erro ao carregar notícia \${i + 1}:\`, e?.message);
  }
}

console.log(\`Aquecimento finalizado com sucesso! \${targetCount} matérias lidas.\`);`,
    createdAt: Date.now() - 86400000,
    lastRunStatus: 'idle',
  },
  {
    id: 'auto-login-variables',
    name: 'Login com Variáveis Dinâmicas',
    description: 'Demonstra o uso de {{email}} e {{senha}} para solicitar inputs antes de rodar sem alterar o código.',
    tags: ['login', 'formulário', 'variáveis'],
    code: `// Automação: Login com Variáveis Dinâmicas
// As variáveis {{email}} e {{senha}} serão solicitadas antes de executar!
const email = "{{email}}";
const senha = "{{senha}}";

console.log(\`Preenchendo credenciais para: \${email}...\`);
await page.goto('https://example.com/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const emailInput = page.locator('input[type="email"], input[name="email"], input[name="user"]').first();
if (await emailInput.count() > 0) {
  await emailInput.fill(email);
}

const passInput = page.locator('input[type="password"], input[name="password"]').first();
if (await passInput.count() > 0) {
  await passInput.fill(senha);
}

console.log('Credenciais preenchidas. Submetendo formulário...');
const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
if (await submitBtn.count() > 0) {
  await submitBtn.click();
}

await page.waitForTimeout(3000);
console.log('Formulário enviado com sucesso!');`,
    createdAt: Date.now() - 86400000 * 2,
    lastRunStatus: 'idle',
  },
  {
    id: 'auto-google-search-var',
    name: 'Pesquisa no Google & Clique Orgânico',
    description: 'Busca pelo termo informado em {{termo_busca}} no Google e clica no primeiro resultado.',
    tags: ['busca', 'google', 'variáveis'],
    code: `// Automação: Pesquisa no Google com Variável Dinâmica
const termo = "{{termo_busca}}";

console.log(\`Acessando o Google para pesquisar por "\${termo}"...\`);
await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const searchInput = page.locator('textarea[name="q"], input[name="q"]').first();
await searchInput.fill(termo);
await page.keyboard.press('Enter');

console.log('Aguardando resultados...');
await page.waitForTimeout(3000);

const firstResult = page.locator('div#search a h3').first();
if (await firstResult.count() > 0) {
  console.log('Clicando no primeiro resultado orgânico...');
  await firstResult.click();
  await page.waitForTimeout(3500);
  console.log('Página acessada com sucesso!');
} else {
  console.log('Resultados visualizados.');
}`,
    createdAt: Date.now() - 86400000 * 3,
    lastRunStatus: 'idle',
  },
];


const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<TabType>('profiles');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [folderSearchQuery, setFolderSearchQuery] = useState<string>('');
  const [selectedProxyFilter, setSelectedProxyFilter] = useState<string>('all');
  const [proxySearchQuery, setProxySearchQuery] = useState<string>('');
  const [selectedAutomationFilter, setSelectedAutomationFilter] = useState<string>('all');
  const [automationSearchQuery, setAutomationSearchQuery] = useState<string>('');
  const [isCreateAutomationModalOpen, setIsCreateAutomationModalOpen] = useState<boolean>(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationItem | null>(null);
  const [runningAutomation, setRunningAutomation] = useState<AutomationItem | null>(null);
  const [isAiPromptModalOpen, setIsAiPromptModalOpen] = useState<boolean>(false);
  const [automationRunState, setAutomationRunState] = useState<AutomationRunState | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('open') === 'create';
  });
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState<boolean>(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [isCreateProxyModalOpen, setIsCreateProxyModalOpen] = useState<boolean>(false);
  const [editingProxy, setEditingProxy] = useState<ProxyItem | null>(null);
  const [testingProxyTarget, setTestingProxyTarget] = useState<ProxyTestTarget | null>(null);
  const [warmingProfileIds, setWarmingProfileIds] = useState<string[]>([]);

  const isProfileWarming = useCallback((profileId: string) => {
    return warmingProfileIds.includes(profileId);
  }, [warmingProfileIds]);

  const stopProfileWarmup = useCallback(async (profileId: string) => {
    if (window.geenjutsuApi?.stopWarmup) {
      await window.geenjutsuApi.stopWarmup(profileId);
      setWarmingProfileIds(prev => prev.filter(id => id !== profileId));
      return true;
    }
    return false;
  }, []);

  // Close & Tray behavior state
  const [closeAction, setCloseActionState] = useState<CloseAction>(() => {
    const saved = localStorage.getItem('geenjutsu_close_action');
    if (saved === 'background' || saved === 'quit' || saved === 'ask') {
      return saved as CloseAction;
    }
    return 'ask';
  });

  const [isCloseConfirmModalOpen, setIsCloseConfirmModalOpen] = useState<boolean>(false);

  const setCloseAction = useCallback((action: CloseAction) => {
    setCloseActionState(action);
    localStorage.setItem('geenjutsu_close_action', action);
    window.geenjutsuApi?.setCloseAction?.(action);
  }, []);

  useEffect(() => {
    if (window.geenjutsuApi?.getCloseAction) {
      window.geenjutsuApi.getCloseAction().then((action) => {
        if (action === 'background' || action === 'quit' || action === 'ask') {
          setCloseActionState(action as CloseAction);
          localStorage.setItem('geenjutsu_close_action', action);
        }
      }).catch(() => {});
    }
  }, []);

  const handleCloseApp = useCallback(() => {
    if (closeAction === 'background') {
      window.geenjutsuApi?.minimizeToTray();
    } else if (closeAction === 'quit') {
      window.geenjutsuApi?.quitApp();
    } else {
      setIsCloseConfirmModalOpen(true);
    }
  }, [closeAction]);

  const confirmCloseApp = useCallback((action: 'background' | 'quit', remember: boolean) => {
    if (remember) {
      setCloseAction(action);
    }
    setIsCloseConfirmModalOpen(false);
    if (action === 'background') {
      window.geenjutsuApi?.minimizeToTray();
    } else {
      window.geenjutsuApi?.quitApp();
    }
  }, [setCloseAction]);

  useEffect(() => {
    if (!window.geenjutsuApi?.onRequestClose) return;
    const unsub = window.geenjutsuApi.onRequestClose(() => {
      if (closeAction === 'background') {
        window.geenjutsuApi?.minimizeToTray();
      } else if (closeAction === 'quit') {
        window.geenjutsuApi?.quitApp();
      } else {
        setIsCloseConfirmModalOpen(true);
      }
    });
    return () => unsub();
  }, [closeAction]);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('open') === 'settings';
  });

  // Onboarding Modal: Shows only once on first launch
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(() => {
    // 1. If marked completed in localStorage, never show
    if (localStorage.getItem('geenjutsu_onboarding_completed') === 'true') {
      return false;
    }
    // 2. If cached profiles already exist, the user is already an active user
    try {
      const savedProfiles = localStorage.getItem('geenjutsu_profiles');
      if (savedProfiles) {
        const parsed = JSON.parse(savedProfiles);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem('geenjutsu_onboarding_completed', 'true');
          return false;
        }
      }
    } catch {
      // ignore
    }
    // Start closed to prevent UI flicker while verifying with persistent disk store
    return false;
  });

  const completeOnboarding = useCallback(() => {
    localStorage.setItem('geenjutsu_onboarding_completed', 'true');
    window.geenjutsuApi?.setOnboardingCompleted?.(true)?.catch?.(() => {});
    setIsOnboardingModalOpen(false);
  }, []);

  // Sync and verify onboarding state against persistent disk storage
  useEffect(() => {
    if (localStorage.getItem('geenjutsu_onboarding_completed') === 'true') {
      window.geenjutsuApi?.setOnboardingCompleted?.(true)?.catch?.(() => {});
      return;
    }

    if (window.geenjutsuApi?.getOnboardingCompleted) {
      window.geenjutsuApi.getOnboardingCompleted().then((completed) => {
        if (completed) {
          localStorage.setItem('geenjutsu_onboarding_completed', 'true');
          setIsOnboardingModalOpen(false);
        } else {
          // Double check if there are profiles on disk before opening modal
          window.geenjutsuApi?.getProfiles().then((diskProfiles) => {
            if (Array.isArray(diskProfiles) && diskProfiles.length > 0) {
              completeOnboarding();
            } else {
              setIsOnboardingModalOpen(true);
            }
          }).catch(() => {
            setIsOnboardingModalOpen(true);
          });
        }
      }).catch(() => {
        if (!localStorage.getItem('geenjutsu_onboarding_completed')) {
          setIsOnboardingModalOpen(true);
        }
      });
    } else {
      if (!localStorage.getItem('geenjutsu_onboarding_completed')) {
        setIsOnboardingModalOpen(true);
      }
    }
  }, [completeOnboarding]);

  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isImportProfileModalOpen, setIsImportProfileModalOpen] = useState<boolean>(false);
  const [updateData, setUpdateData] = useState<UpdateCheckResult | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);

  const checkForUpdates = useCallback(async (force = false) => {
    try {
      const result = await UpdateService.checkForUpdates(force);
      setUpdateData(result);
      return result;
    } catch (err) {
      console.error('Error checking updates:', err);
      return {
        hasUpdate: false,
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        downloadUrl: '',
      };
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await checkForUpdates();
      if (res.hasUpdate) {
        setIsUpdateModalOpen(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);
  const [privacyConfig, setPrivacyConfig] = useState<PrivacyConfig>(() => {
    const saved = localStorage.getItem('geenjutsu_privacy_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          blurName: Boolean(parsed.blurName),
          blurProxy: Boolean(parsed.blurProxy),
          blurNotes: Boolean(parsed.blurNotes),
        };
      } catch {
        // ignore
      }
    }
    const legacy = localStorage.getItem('geenjutsu_privacy_mode');
    if (legacy === 'true') {
      return { blurName: true, blurProxy: true, blurNotes: true };
    }
    return { blurName: false, blurProxy: false, blurNotes: false };
  });

  const [sessionExemptProfileIds, setSessionExemptProfileIds] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem('geenjutsu_privacy_config', JSON.stringify(privacyConfig));
    localStorage.setItem(
      'geenjutsu_privacy_mode',
      String(privacyConfig.blurName || privacyConfig.blurProxy || privacyConfig.blurNotes)
    );
  }, [privacyConfig]);

  const isPrivacyMode = privacyConfig.blurName || privacyConfig.blurProxy || privacyConfig.blurNotes;

  const togglePrivacyField = (field: keyof PrivacyConfig) => {
    setPrivacyConfig(prev => {
      const nextValue = !prev[field];
      if (nextValue) {
        setSessionExemptProfileIds([]);
      }
      return {
        ...prev,
        [field]: nextValue,
      };
    });
  };

  const toggleAllPrivacy = () => {
    setPrivacyConfig(prev => {
      const allSelected = prev.blurName && prev.blurProxy && prev.blurNotes;
      if (allSelected) {
        return { blurName: false, blurProxy: false, blurNotes: false };
      }
      return { blurName: true, blurProxy: true, blurNotes: true };
    });
    setSessionExemptProfileIds([]);
  };

  const togglePrivacyMode = () => {
    toggleAllPrivacy();
  };

  // Load from localStorage or initial
  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('geenjutsu_folders');
    if (!saved) return DEFAULT_FOLDERS;
    try {
      const parsed = JSON.parse(saved);
      return parsed.map((f: Folder) =>
        f.id === 'default' && f.name === 'Default Folder' ? { ...f, name: 'Pasta Padrão' } : f
      );
    } catch {
      return DEFAULT_FOLDERS;
    }
  });

  // Globally unique id; every id maps to its own isolated browser directory
  const generateProfileId = (ts: number = Date.now()): string =>
    `p-${ts}-${Math.random().toString(36).slice(2, 8)}`;

  const repairProfileTimestamps = (list: Profile[]): Profile[] => {
    return list.map(p => {
      if (p.id && typeof p.id === 'string' && p.id.startsWith('p-')) {
        const parts = p.id.replace('p-', '').split('-');
        const realTs = Number(parts[0]);
        if (!isNaN(realTs) && realTs > 1700000000000 && (!p.createdAt || p.createdAt < realTs - 86400000 * 2)) {
          return { ...p, createdAt: realTs, updatedAt: realTs };
        }
      }
      return p;
    });
  };

  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('geenjutsu_profiles');
    const list = saved ? JSON.parse(saved) : INITIAL_PROFILES;
    return repairProfileTimestamps(list);
  });

  const [proxies, setProxies] = useState<ProxyItem[]>(() => {
    const saved = localStorage.getItem('geenjutsu_proxies');
    return saved ? JSON.parse(saved) : INITIAL_PROXIES;
  });

  const [automations, setAutomations] = useState<AutomationItem[]>(() => {
    const saved = localStorage.getItem('geenjutsu_automations');
    return saved ? JSON.parse(saved) : INITIAL_AUTOMATIONS;
  });

  // Initial sync with Electron main process and register listeners
  useEffect(() => {
    if (!window.geenjutsuApi) return;

    window.geenjutsuApi.getProfiles().then((diskProfiles) => {
      if (Array.isArray(diskProfiles) && diskProfiles.length > 0) {
        setProfiles(repairProfileTimestamps(diskProfiles));
        completeOnboarding();
      }
    });
    window.geenjutsuApi.getFolders().then((diskFolders) => {
      if (Array.isArray(diskFolders) && diskFolders.length > 0) {
        setFolders(diskFolders);
      }
    });
    window.geenjutsuApi.getProxies().then((diskProxies) => {
      if (Array.isArray(diskProxies) && diskProxies.length > 0) {
        setProxies(diskProxies);
      }
    });
    window.geenjutsuApi.getAutomations?.().then((diskAutomations) => {
      if (Array.isArray(diskAutomations) && diskAutomations.length > 0) {
        setAutomations(diskAutomations);
      }
    });
    window.geenjutsuApi.getRunningProfiles().then((runningIds) => {
      if (Array.isArray(runningIds) && runningIds.length > 0) {
        setProfiles((prev) =>
          prev.map((p) => (runningIds.includes(p.id) ? { ...p, status: 'running' } : p))
        );
      }
    });

    // Listen to profile status changes (e.g. user closed browser)
    const unsubStatus = window.geenjutsuApi.onProfileStatusChange(({ profileId, status }) => {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, status } : p))
      );
    });

    // Listen to cookies updated from Camoufox
    const unsubCookies = window.geenjutsuApi.onCookiesUpdated(({ profileId, cookies }) => {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, cookies } : p))
      );
    });

    // Listen to automation state changes
    const unsubAutoState = window.geenjutsuApi.onAutomationStateChange?.((state: AutomationRunState) => {
      setAutomationRunState(state);
      setAutomations((prev) =>
        prev.map((a) =>
          a.id === state.automationId
            ? {
                ...a,
                lastRunAt: state.startedAt,
                lastRunStatus: state.status === 'launching_browser' ? 'running' : state.status,
                lastRunError: state.error,
                lastRunProfileId: state.profileId,
                lastRunProfileName: state.profileName,
                lastRunDurationMs: state.durationMs,
              }
            : a
        )
      );
    });

    const unsubAutoLog = window.geenjutsuApi.onAutomationLog?.(({ automationId, log }: any) => {
      setAutomationRunState((prev) => {
        if (!prev || prev.automationId !== automationId) return prev;
        return {
          ...prev,
          logs: [...prev.logs, log],
        };
      });
    });

    const unsubAutoFinished = window.geenjutsuApi.onAutomationFinished?.((data: any) => {
      setAutomations((prev) =>
        prev.map((a) =>
          a.id === data.automationId
            ? {
                ...a,
                lastRunAt: Date.now(),
                lastRunStatus: data.stopped ? 'stopped' : data.success ? 'success' : 'failed',
                lastRunError: data.error,
                lastRunDurationMs: data.durationMs,
              }
            : a
        )
      );
    });

    window.geenjutsuApi?.getRunningWarmups?.().then((runningWarmupIds: string[]) => {
      if (Array.isArray(runningWarmupIds) && runningWarmupIds.length > 0) {
        setWarmingProfileIds(runningWarmupIds);
      }
    }).catch(() => {});

    // Listen to warmup progress & finish
    const unsubWarmupProgress = window.geenjutsuApi?.onWarmupProgress?.((data: any) => {
      if (data && data.profileId && data.isRunning) {
        setWarmingProfileIds(prev => (prev.includes(data.profileId) ? prev : [...prev, data.profileId]));
      }
    });

    const unsubWarmupFinished = window.geenjutsuApi?.onWarmupFinished?.((data: any) => {
      if (data && data.profileId) {
        setWarmingProfileIds(prev => prev.filter(id => id !== data.profileId));
        if (data.warmedCount) {
          setProfiles(prevProfiles =>
            prevProfiles.map(p =>
              p.id === data.profileId
                ? {
                    ...p,
                    lastWarmupAt: Date.now(),
                    totalWarmupSites: (p.totalWarmupSites || 0) + data.warmedCount,
                  }
                : p
            )
          );
        }
      }
    });

    return () => {
      unsubStatus?.();
      unsubCookies?.();
      unsubAutoState?.();
      unsubAutoLog?.();
      unsubAutoFinished?.();
      unsubWarmupProgress?.();
      unsubWarmupFinished?.();
    };
  }, []);


  // Save to localStorage & DataStore
  useEffect(() => {
    localStorage.setItem('geenjutsu_profiles', JSON.stringify(profiles));
    window.geenjutsuApi?.saveProfiles?.(profiles);
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('geenjutsu_folders', JSON.stringify(folders));
    window.geenjutsuApi?.saveFolders?.(folders);
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('geenjutsu_proxies', JSON.stringify(proxies));
    window.geenjutsuApi?.saveProxies?.(proxies);
  }, [proxies]);

  useEffect(() => {
    localStorage.setItem('geenjutsu_automations', JSON.stringify(automations));
    window.geenjutsuApi?.saveAutomations?.(automations);
  }, [automations]);


  // Helper to hash password using SHA-256
  const hashPassword = async (text: string): Promise<string> => {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // App Access Security States
  const [isSecurityEnabled, setIsSecurityEnabled] = useState<boolean>(() => {
    return localStorage.getItem('geenjutsu_security_enabled') === 'true';
  });

  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const enabled = localStorage.getItem('geenjutsu_security_enabled') === 'true';
    const hash = localStorage.getItem('geenjutsu_security_hash');
    return enabled && !!hash;
  });

  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  const lockApp = useCallback(() => {
    if (isSecurityEnabled) {
      setIsAppLocked(true);
    }
  }, [isSecurityEnabled]);

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    const savedHash = localStorage.getItem('geenjutsu_security_hash');
    if (!savedHash) return true;
    const enteredHash = await hashPassword(password);
    return enteredHash === savedHash;
  }, []);

  const completeUnlock = useCallback(() => {
    setIsAppLocked(false);
  }, []);

  const unlockApp = useCallback(async (password: string): Promise<boolean> => {
    const isValid = await verifyPassword(password);
    if (isValid) {
      completeUnlock();
      return true;
    }
    return false;
  }, [verifyPassword, completeUnlock]);

  const enableSecurity = useCallback(async (password: string): Promise<boolean> => {
    const hash = await hashPassword(password);
    localStorage.setItem('geenjutsu_security_hash', hash);
    localStorage.setItem('geenjutsu_security_enabled', 'true');
    setIsSecurityEnabled(true);
    return true;
  }, []);

  const disableSecurity = useCallback(async (currentPassword: string): Promise<{ success: boolean; error?: string }> => {
    const savedHash = localStorage.getItem('geenjutsu_security_hash');
    if (savedHash) {
      const enteredHash = await hashPassword(currentPassword);
      if (enteredHash !== savedHash) {
        return { success: false, error: 'Senha atual incorreta.' };
      }
    }
    localStorage.removeItem('geenjutsu_security_hash');
    localStorage.setItem('geenjutsu_security_enabled', 'false');
    setIsSecurityEnabled(false);
    setIsAppLocked(false);
    return { success: true };
  }, []);

  const changeSecurityPassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const savedHash = localStorage.getItem('geenjutsu_security_hash');
    if (savedHash) {
      const enteredHash = await hashPassword(currentPassword);
      if (enteredHash !== savedHash) {
        return { success: false, error: 'Senha atual incorreta.' };
      }
    }
    const newHash = await hashPassword(newPassword);
    localStorage.setItem('geenjutsu_security_hash', newHash);
    return { success: true };
  }, []);

  const addFolder = (name: string, description?: string, icon?: string): Folder => {
    if (!name.trim()) return {} as Folder;
    const newFolder: Folder = {
      id: 'folder-' + Date.now(),
      name: name.trim(),
      description: description ? description.trim() : undefined,
      icon: icon || 'ri-folder-3-line',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setFolders(prev => [...prev, newFolder]);
    return newFolder;
  };

  const updateFolder = (input: FolderUpdateInput) => {
    setFolders(prev =>
      prev.map(f => {
        if (f.id === input.id) {
          return {
            ...f,
            name: input.name !== undefined ? input.name.trim() : f.name,
            description: input.description !== undefined ? input.description.trim() : f.description,
            icon: input.icon !== undefined ? input.icon : f.icon,
            updatedAt: Date.now(),
          };
        }
        return f;
      })
    );
  };

  const deleteFolder = (id: string) => {
    if (id === 'default') return;
    setProfiles(prev =>
      prev.map(p => (p.folderId === id ? { ...p, folderId: 'default' } : p))
    );
    setFolders(prev => prev.filter(f => f.id !== id));
    if (selectedFolderId === id) {
      setSelectedFolderId('all');
    }
  };

  const addProxy = (input: ProxyCreateInput): ProxyItem => {
    const newProxy: ProxyItem = {
      ...input,
      id: 'prx-' + Date.now(),
      status: 'active',
      tags: input.tags || [],
      ping: Math.floor(Math.random() * 60) + 80,
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
    };
    setProxies(prev => [newProxy, ...prev]);
    return newProxy;
  };

  const updateProxy = (input: ProxyUpdateInput) => {
    setProxies(prev =>
      prev.map(p => (p.id === input.id ? { ...p, ...input, updatedAt: Date.now() } : p))
    );
  };

  const deleteProxy = (id: string) => {
    setProxies(prev => prev.filter(p => p.id !== id));
  };

  const testProxyConnection = async (id: string): Promise<{ success: boolean; ping: number }> => {
    const target = proxies.find(p => p.id === id);
    if (!target) return { success: false, ping: 0 };

    if (window.geenjutsuApi?.testProxy) {
      try {
        const res = await window.geenjutsuApi.testProxy({
          type: target.type,
          host: target.host,
          port: target.port,
          username: target.username,
          password: target.password,
        });
        if (res && res.success) {
          const ping = res.ping || 120;
          setProxies(prev =>
            prev.map(p =>
              p.id === id
                ? {
                    ...p,
                    status: 'active',
                    ping,
                    country: res.country || p.country,
                    countryCode: res.countryCode || p.countryCode,
                    lastCheckedAt: Date.now(),
                  }
                : p
            )
          );
          return { success: true, ping };
        } else {
          setProxies(prev =>
            prev.map(p => p.id === id ? { ...p, status: 'failed', lastCheckedAt: Date.now() } : p)
          );
          return { success: false, ping: 0 };
        }
      } catch {
        setProxies(prev =>
          prev.map(p => p.id === id ? { ...p, status: 'failed', lastCheckedAt: Date.now() } : p)
        );
        return { success: false, ping: 0 };
      }
    }

    // Fallback simulado quando fora do Electron
    await new Promise(r => setTimeout(r, 600));
    const randomPing = Math.floor(Math.random() * 60) + 75;
    setProxies(prev =>
      prev.map(p =>
        p.id === id ? { ...p, status: 'active', ping: randomPing, lastCheckedAt: Date.now() } : p
      )
    );
    return { success: true, ping: randomPing };
  };

  const addAutomation = (input: AutomationCreateInput): AutomationItem => {
    const newItem: AutomationItem = {
      id: 'auto-' + Date.now(),
      name: input.name.trim(),
      description: input.description?.trim(),
      code: input.code,
      tags: Array.isArray(input.tags) ? input.tags : [],
      createdAt: Date.now(),
      lastRunStatus: 'idle',
    };
    setAutomations(prev => [newItem, ...prev]);
    return newItem;
  };

  const updateAutomation = (input: AutomationUpdateInput) => {
    setAutomations(prev =>
      prev.map(a => {
        if (a.id !== input.id) return a;
        return {
          ...a,
          ...input,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const deleteAutomation = (id: string) => {
    setAutomations(prev => prev.filter(a => a.id !== id));
  };

  const duplicateAutomation = (id: string) => {
    const target = automations.find(a => a.id === id);
    if (!target) return;
    const duplicated: AutomationItem = {
      ...target,
      id: 'auto-' + Date.now(),
      name: `${target.name} (Cópia)`,
      createdAt: Date.now(),
      lastRunAt: undefined,
      lastRunStatus: 'idle',
      lastRunError: undefined,
      lastRunDurationMs: undefined,
    };
    setAutomations(prev => [duplicated, ...prev]);
  };

  const runAutomationOnProfile = async (automationId: string, profileId: string, customCode?: string) => {
    if (window.geenjutsuApi?.runAutomation) {
      return await window.geenjutsuApi.runAutomation(automationId, profileId, customCode);
    }
    return { success: false, error: 'API do Geenjutsu indisponível' };
  };

  const stopAutomation = async (automationId: string): Promise<boolean> => {
    if (window.geenjutsuApi?.stopAutomation) {
      const res = await window.geenjutsuApi.stopAutomation(automationId);
      setAutomations(prev =>
        prev.map(a =>
          a.id === automationId
            ? { ...a, lastRunStatus: 'stopped', lastRunError: 'Interrompido pelo usuário' }
            : a
        )
      );
      setAutomationRunState(prev => {
        if (!prev || prev.automationId !== automationId) return prev;
        return {
          ...prev,
          status: 'stopped',
          error: 'Interrompido pelo usuário',
          logs: [
            ...prev.logs,
            { timestamp: Date.now(), type: 'warn', message: 'Automação interrompida pelo usuário.' },
          ],
        };
      });
      return Boolean(res);
    }
    return false;
  };

  const createBulkProfiles = (inputs: ProfileCreateInput[]): Profile[] => {
    if (!inputs || inputs.length === 0) return [];

    // Auto-save proxy if supplied in the first item and not in proxies yet
    const firstInput = inputs[0];
    if (firstInput.proxy && firstInput.proxy.type !== 'direct' && (firstInput.proxy.host || firstInput.proxy.ipDisplay)) {
      const parsed = firstInput.proxy.ipDisplay ? parseProxyString(firstInput.proxy.ipDisplay) : null;
      const host = firstInput.proxy.host || parsed?.host;
      const port = firstInput.proxy.port || parsed?.port || '8080';
      const user = firstInput.proxy.username ?? parsed?.username;
      const pass = firstInput.proxy.password ?? parsed?.password;

      if (host) {
        setProxies(prev => {
          const exists = prev.some(
            px => px.host === host && px.port === port
          );
          if (!exists) {
            const detected = detectCountryFromHost(host);
            const autoProxy: ProxyItem = {
              id: 'prx-' + Date.now(),
              name: '', // Sem nome, para o usuário organizar depois se quiser
              type: firstInput.proxy?.type === 'socks5' ? 'socks5' : 'http',
              host,
              port,
              username: user,
              password: pass,
              country: detected.country || undefined,
              countryCode: detected.countryCode || undefined,
              tags: [firstInput.platform],
              status: 'active',
              ping: Math.floor(Math.random() * 60) + 80,
              createdAt: Date.now(),
              lastCheckedAt: Date.now(),
            };
            return [autoProxy, ...prev];
          }
          return prev;
        });
      }
    }

    const baseTime = Date.now();
    const count = inputs.length;

    const newProfiles: Profile[] = inputs.map((input, idx) => {
      const itemTs = baseTime + (count - 1 - idx);
      const profileId = generateProfileId(baseTime + idx);
      return {
        ...input,
        id: profileId,
        status: 'idle',
        createdAt: (input as any).createdAt || itemTs,
        updatedAt: (input as any).updatedAt || itemTs,
        lastLaunchedAt: (input as any).lastLaunchedAt,
        isTrash: false,
      };
    });

    setProfiles(prev => [...newProfiles, ...prev]);
    completeOnboarding();

    if (privacyConfig.blurName || privacyConfig.blurProxy || privacyConfig.blurNotes) {
      setSessionExemptProfileIds(prev => [...prev, ...newProfiles.map(p => p.id)]);
    }

    return newProfiles;
  };

  const createProfile = (input: ProfileCreateInput): Profile => {
    return createBulkProfiles([input])[0];
  };

  const updateProfile = (input: ProfileUpdateInput) => {
    setProfiles(prev =>
      prev.map(p => (p.id === input.id ? { ...p, ...input, updatedAt: Date.now() } : p))
    );
  };

  const toggleLaunchProfile = async (id: string) => {
    if (isProfileWarming(id)) {
      console.warn('[Geenjutsu] O perfil está em processo de aquecimento de cookies. Não é possível iniciar agora.');
      return;
    }
    const target = profiles.find(p => p.id === id);
    if (!target) return;

    if (target.status === 'running') {
      setProfiles(prev =>
        prev.map(p => (p.id === id ? { ...p, status: 'idle' } : p))
      );
      if (window.geenjutsuApi?.stopProfile) {
        await window.geenjutsuApi.stopProfile(id);
      }
    } else {
      setProfiles(prev =>
        prev.map(p => (p.id === id ? { ...p, status: 'launching' } : p))
      );

      if (window.geenjutsuApi?.launchProfile) {
        try {
          const res = await window.geenjutsuApi.launchProfile(target);
          if (res && !res.success) {
            console.error('[Geenjutsu] Erro ao abrir navegador:', res.error);
            setProfiles(prev =>
              prev.map(p => (p.id === id ? { ...p, status: 'idle' } : p))
            );
            return;
          }
          setProfiles(prev =>
            prev.map(p =>
              p.id === id
                ? { ...p, status: 'running', lastLaunchedAt: Date.now() }
                : p
            )
          );
        } catch (err) {
          console.error('[Geenjutsu] Erro ao lançar perfil:', err);
          setProfiles(prev =>
            prev.map(p => (p.id === id ? { ...p, status: 'idle' } : p))
          );
        }
      } else {
        setProfiles(prev =>
          prev.map(p =>
            p.id === id
              ? { ...p, status: 'running', lastLaunchedAt: Date.now() }
              : p
          )
        );
      }
    }
  };

  const moveToTrash = (id: string) => {
    setProfiles(prev =>
      prev.map(p => (p.id === id ? { ...p, isTrash: true, status: 'idle' } : p))
    );
  };

  const restoreFromTrash = (id: string) => {
    setProfiles(prev => prev.map(p => (p.id === id ? { ...p, isTrash: false } : p)));
  };

  const permanentDelete = (id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
  };

  const cloneProfile = (id: string) => {
    const target = profiles.find(p => p.id === id);
    if (!target) return;
    const cloned: Profile = {
      ...target,
      // A clone keeps settings only: never cookies, hardware or any browser state
      cookies: [],
      hardwareConfig: undefined,
      id: generateProfileId(),
      name: `${target.name} (Copy)`,
      status: 'idle',
      isPinned: false,
      pinnedAt: undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProfiles(prev => [cloned, ...prev]);
    setSessionExemptProfileIds(prev => [...prev, cloned.id]);
  };

  const togglePinProfile = (id: string) => {
    setProfiles(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextPinned = !p.isPinned;
          return {
            ...p,
            isPinned: nextPinned,
            pinnedAt: nextPinned ? Date.now() : undefined,
            updatedAt: Date.now(),
          };
        }
        return p;
      })
    );
  };

  const importFullProfile = (data: any): { success: boolean; profile?: Profile; error?: string } => {
    try {
      const p = data.profile || data;
      if (!p || !p.name || typeof p.name !== 'string') {
        return { success: false, error: 'Formato inválido. O arquivo JSON precisa conter um perfil válido.' };
      }

      // Check folder: if folder name provided, ensure folder exists
      let targetFolderId = 'default';
      const folderName = p.folder?.name || (typeof p.folder === 'string' ? p.folder : null) || (typeof p.folderId === 'string' ? p.folderId : null);
      if (folderName) {
        const existingFolder = folders.find(
          f => f.id === folderName || f.name.toLowerCase() === folderName.toLowerCase()
        );
        if (existingFolder) {
          targetFolderId = existingFolder.id;
        } else {
          // Auto-create folder
          const createdFolder = addFolder(
            p.folder?.name || folderName,
            p.folder?.description || 'Pasta criada automaticamente via importação',
            p.folder?.icon || 'ri-folder-3-line'
          );
          targetFolderId = createdFolder.id;
        }
      }

      // Auto-create proxy if provided and not existing
      if (p.proxy && p.proxy.type !== 'direct' && (p.proxy.host || p.proxy.ipDisplay)) {
        const host = p.proxy.host || (p.proxy.ipDisplay ? p.proxy.ipDisplay.split(':')[0] : '');
        const port = p.proxy.port || (p.proxy.ipDisplay ? p.proxy.ipDisplay.split(':')[1] : '8080');
        if (host) {
          const exists = proxies.some(px => px.host === host && px.port === port);
          if (!exists) {
            const detected = detectCountryFromHost(host);
            addProxy({
              name: p.proxy.name || '',
              type: p.proxy.type || 'http',
              host,
              port,
              username: p.proxy.username,
              password: p.proxy.password,
              country: p.proxy.country || detected.country || undefined,
              countryCode: p.proxy.countryCode || detected.countryCode || undefined,
              tags: p.tags || [p.platform || 'general'],
            });
          }
        }
      }

      const hardwareData =
        p.hardwareConfig ||
        p.hardware ||
        data.hardwareConfig ||
        data.hardware;

      const newProfile = createProfile({
        name: p.name.trim(),
        folderId: targetFolderId,
        platform: p.platform || 'general',
        os: p.os || 'windows',
        browser: p.browser || 'Chrome 131',
        notes: p.notes || '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        proxy: p.proxy,
        fingerprint: p.fingerprint,
        hardwareConfig: hardwareData,
        cookies: Array.isArray(p.cookies) ? p.cookies : [],
      });

      // Save persistent hardware config to disk so Camoufox immediately uses it on first launch
      if (hardwareData && window.geenjutsuApi?.saveProfileHardware) {
        window.geenjutsuApi.saveProfileHardware(newProfile.id, hardwareData).catch(err => {
          console.warn('[ProfileContext] Falha ao salvar hardware config no disco:', err);
        });
      }

      // If cookies exist, also ensure cookies backup is saved immediately to disk
      if (Array.isArray(p.cookies) && p.cookies.length > 0 && window.geenjutsuApi?.injectCookies) {
        window.geenjutsuApi.injectCookies(newProfile.id, p.cookies).catch(err => {
          console.warn('[ProfileContext] Falha ao injetar cookies no disco:', err);
        });
      }

      return { success: true, profile: newProfile };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao importar perfil' };
    }
  };

  // Folder counts
  const counts = {
    all: profiles.filter(p => !p.isTrash).length,
    running: profiles.filter(p => !p.isTrash && p.status === 'running').length,
    trash: profiles.filter(p => p.isTrash).length,
    unassigned: profiles.filter(
      p => !p.isTrash && (!p.folderId || p.folderId === 'unassigned' || p.folderId === 'none' || !folders.some(f => f.id === p.folderId))
    ).length,
    ...folders.reduce((acc, folder) => {
      acc[folder.id] = profiles.filter(p => !p.isTrash && p.folderId === folder.id).length;
      return acc;
    }, {} as Record<string, number>),
  };

  // Filtered profiles for current view
  const filteredProfiles = profiles
    .filter(p => {
      // Trash check
      if (selectedFolderId === 'trash') {
        if (!p.isTrash) return false;
      } else {
        if (p.isTrash) return false;

        // Running filter
        if (selectedFolderId === 'running' && p.status !== 'running') {
          return false;
        }

        // Specific folder, platform, tag or unassigned filter
        if (selectedFolderId.startsWith('platform:')) {
          const targetPlatform = selectedFolderId.replace('platform:', '');
          if (p.platform !== targetPlatform) return false;
        } else if (selectedFolderId.startsWith('tag:')) {
          const targetTag = selectedFolderId.replace('tag:', '');
          if (!p.tags?.includes(targetTag)) return false;
        } else if (selectedFolderId === 'unassigned' || selectedFolderId === 'none') {
          const hasNoFolder = !p.folderId || p.folderId === 'unassigned' || p.folderId === 'none' || !folders.some(f => f.id === p.folderId);
          if (!hasNoFolder) return false;
        } else if (selectedFolderId !== 'all' && selectedFolderId !== 'running') {
          if (p.folderId !== selectedFolderId) return false;
        }
      }

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchNotes = p.notes.toLowerCase().includes(q);
        const matchProxy =
          p.proxy?.ipDisplay?.toLowerCase().includes(q) ||
          p.proxy?.name?.toLowerCase().includes(q) ||
          p.proxy?.host?.toLowerCase().includes(q) ||
          false;
        const matchTags = p.tags.some(tag => tag.toLowerCase().includes(q));
        if (!matchName && !matchNotes && !matchProxy && !matchTags) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // 1. Perfis fixados permanecem no topo (ordenados por pinnedAt desc)
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isPinned && b.isPinned) {
        const pinDiff = (b.pinnedAt || 0) - (a.pinnedAt || 0);
        if (pinDiff !== 0) return pinDiff;
      }
      // 2. Ordem decrescente por horário de criação (createdAt desc)
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  // Filtered folders for folders view
  const filteredFolders = folders.filter(f => {
    if (!folderSearchQuery.trim()) return true;
    const q = folderSearchQuery.toLowerCase().trim();
    const matchName = f.name.toLowerCase().includes(q);
    const matchDesc = f.description ? f.description.toLowerCase().includes(q) : false;
    return matchName || matchDesc;
  });

  // Proxy profile counts
  const proxyProfileCounts = proxies.reduce((acc, px) => {
    acc[px.id] = profiles.filter(
      p => !p.isTrash && p.proxy && p.proxy.type !== 'direct' && (
        p.proxy.ipDisplay?.includes(px.host) || (p.proxy.host && p.proxy.host === px.host)
      )
    ).length;
    return acc;
  }, {} as Record<string, number>);

  // Filtered proxies for proxies view
  const filteredProxies = proxies.filter(px => {
    if (selectedProxyFilter === 'active' && px.status !== 'active') return false;
    if (selectedProxyFilter === 'failed' && px.status !== 'failed') return false;
    if (selectedProxyFilter === 'unused' && (proxyProfileCounts[px.id] || 0) > 0) return false;
    if (selectedProxyFilter.startsWith('country:')) {
      const code = selectedProxyFilter.replace('country:', '');
      if (px.countryCode !== code) return false;
    }
    if (selectedProxyFilter.startsWith('tag:')) {
      const tag = selectedProxyFilter.replace('tag:', '');
      if (!px.tags.includes(tag)) return false;
    }

    if (proxySearchQuery.trim()) {
      const q = proxySearchQuery.toLowerCase().trim();
      const matchName = px.name?.toLowerCase().includes(q) || false;
      const matchHost = px.host.toLowerCase().includes(q);
      const matchPort = px.port.includes(q);
      const matchUser = px.username?.toLowerCase().includes(q) || false;
      const matchCountry = px.country?.toLowerCase().includes(q) || false;
      const matchTags = px.tags.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchHost && !matchPort && !matchUser && !matchCountry && !matchTags) return false;
    }

    return true;
  });

  // Filtered automations for automations view
  const filteredAutomations = automations.filter(auto => {
    if (selectedAutomationFilter === 'success' && auto.lastRunStatus !== 'success') return false;
    if (selectedAutomationFilter === 'failed' && auto.lastRunStatus !== 'failed') return false;
    if (selectedAutomationFilter === 'stopped' && auto.lastRunStatus !== 'stopped') return false;
    if (selectedAutomationFilter === 'never' && (auto.lastRunStatus && auto.lastRunStatus !== 'idle')) return false;
    if (selectedAutomationFilter.startsWith('tag:')) {
      const tag = selectedAutomationFilter.replace('tag:', '');
      if (!auto.tags.includes(tag)) return false;
    }

    if (automationSearchQuery.trim()) {
      const q = automationSearchQuery.toLowerCase().trim();
      const matchName = auto.name.toLowerCase().includes(q);
      const matchDesc = auto.description?.toLowerCase().includes(q) || false;
      const matchCode = auto.code.toLowerCase().includes(q);
      const matchTags = auto.tags.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchCode && !matchTags) return false;
    }

    return true;
  });

  return (
    <ProfileContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedFolderId,
        setSelectedFolderId,
        searchQuery,
        setSearchQuery,
        folderSearchQuery,
        setFolderSearchQuery,
        folders,
        filteredFolders,
        addFolder,
        updateFolder,
        deleteFolder,
        isCreateFolderModalOpen,
        setIsCreateFolderModalOpen,
        editingFolder,
        setEditingFolder,
        // Proxies
        proxies,
        filteredProxies,
        addProxy,
        updateProxy,
        deleteProxy,
        testProxyConnection,
        selectedProxyFilter,
        setSelectedProxyFilter,
        proxySearchQuery,
        setProxySearchQuery,
        isCreateProxyModalOpen,
        setIsCreateProxyModalOpen,
        editingProxy,
        setEditingProxy,
        testingProxyTarget,
        setTestingProxyTarget,
        proxyProfileCounts,
        // Automations
        automations,
        filteredAutomations,
        selectedAutomationFilter,
        setSelectedAutomationFilter,
        automationSearchQuery,
        setAutomationSearchQuery,
        isCreateAutomationModalOpen,
        setIsCreateAutomationModalOpen,
        editingAutomation,
        setEditingAutomation,
        runningAutomation,
        setRunningAutomation,
        isAiPromptModalOpen,
        setIsAiPromptModalOpen,
        automationRunState,
        setAutomationRunState,
        addAutomation,
        updateAutomation,
        deleteAutomation,
        duplicateAutomation,
        runAutomationOnProfile,
        stopAutomation,
        // Profiles

        profiles,
        filteredProfiles,
        createProfile,
        createBulkProfiles,
        updateProfile,
        toggleLaunchProfile,
        warmingProfileIds,
        isProfileWarming,
        stopProfileWarmup,
        moveToTrash,
        restoreFromTrash,
        permanentDelete,
        cloneProfile,
        togglePinProfile,
        isCreateModalOpen,
        setIsCreateModalOpen,
        editingProfile,
        setEditingProfile,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        isOnboardingModalOpen,
        setIsOnboardingModalOpen,
        completeOnboarding,
        isReportModalOpen,
        setIsReportModalOpen,
        isImportProfileModalOpen,
        setIsImportProfileModalOpen,
        importFullProfile,
        isPrivacyMode,
        togglePrivacyMode,
        privacyConfig,
        setPrivacyConfig,
        togglePrivacyField,
        toggleAllPrivacy,
        sessionExemptProfileIds,
        counts,
        // App Access Security
        isSecurityEnabled,
        isAppLocked,
        isSecurityModalOpen,
        setIsSecurityModalOpen,
        lockApp,
        unlockApp,
        verifyPassword,
        completeUnlock,
        enableSecurity,
        disableSecurity,
        changeSecurityPassword,
        // Close & Tray behavior
        closeAction,
        setCloseAction,
        isCloseConfirmModalOpen,
        setIsCloseConfirmModalOpen,
        handleCloseApp,
        confirmCloseApp,
        // Update System
        updateData,
        isUpdateModalOpen,
        setIsUpdateModalOpen,
        checkForUpdates,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfiles = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfiles must be used within ProfileProvider');
  return context;
};
