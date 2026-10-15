export interface OnboardingStep {
  id: string;
  tabKey: string;
  badgeKey: string;
  titleKey: string;
  descKey: string;
  icon: string;
}

export const ONBOARDING_STEPS_CONFIG = [
  {
    id: 'architecture',
    icon: 'ri-stack-line',
  },
  {
    id: 'engine',
    icon: 'ri-cpu-line',
  },
  {
    id: 'warmup',
    icon: 'ri-fire-line',
  },
  {
    id: 'workflow',
    icon: 'ri-dashboard-3-line',
  },
] as const;
