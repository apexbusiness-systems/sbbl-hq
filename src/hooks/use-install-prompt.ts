import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'sbblhq.installPrompt.dismissedAt';
const DISMISS_WINDOW_MS = 1000 * 60 * 60 * 24;

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const lastDismissedAt = Number(localStorage.getItem(DISMISS_KEY) || '0');
    if (Date.now() - lastDismissedAt < DISMISS_WINDOW_MS) {
      setIsVisible(false);
    }

    const mq = window.matchMedia('(display-mode: standalone)');
    if (mq.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone) {
      setIsInstalled(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), []);
  const canPrompt = !!deferredPrompt;

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  return {
    isVisible: isVisible && !isInstalled,
    isIOS,
    canPrompt,
    promptInstall,
    dismiss,
  };
}
