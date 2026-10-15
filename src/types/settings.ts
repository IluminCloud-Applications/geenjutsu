export type CloseAction = 'ask' | 'quit' | 'background';

export interface AppSettings {
  closeAction?: CloseAction;
  onboardingCompleted?: boolean;
}
