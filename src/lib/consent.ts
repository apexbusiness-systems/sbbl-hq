export type ConsentState = {
  localMemoryEnabled: boolean;
  cloudSyncEnabled: boolean;
  notificationsEnabled: boolean;
  microphoneEnabled: boolean;
  voicePlaybackEnabled: boolean;
  kidsVoiceEnabled: boolean;
};

const CONSENT_KEY = 'sbbl:consent:v1';

export const DEFAULT_CONSENT: ConsentState = {
  localMemoryEnabled: false,
  cloudSyncEnabled: false,
  notificationsEnabled: false,
  microphoneEnabled: false,
  voicePlaybackEnabled: false,
  kidsVoiceEnabled: false,
};

export function readConsent(): ConsentState {
  if (typeof window === 'undefined') return DEFAULT_CONSENT;
  const raw = window.localStorage.getItem(CONSENT_KEY);
  if (!raw) return DEFAULT_CONSENT;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return { ...DEFAULT_CONSENT, ...parsed };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function writeConsent(next: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
}

export function resetLocalMemory(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CONSENT_KEY);
  window.localStorage.removeItem('sbbl:guest-mode');
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('sbbl:history:') || key.startsWith('sbbl:journal:'))
    .forEach((key) => window.localStorage.removeItem(key));
}
