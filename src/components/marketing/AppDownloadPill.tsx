import { motion } from 'framer-motion';
import { Download, Smartphone, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useInstallPrompt } from '@/hooks/use-install-prompt';

export const AppDownloadPill = () => {
  const { isVisible, canPrompt, isIOS, promptInstall, dismiss } = useInstallPrompt();
  const { pathname } = useLocation();

  // Ops Console is a work surface — floating promos covered form fields on
  // mobile (2026-07-20 visual audit). Operators don't need the install pitch.
  if (pathname.startsWith('/ops')) return null;
  if (!isVisible) return null;

  const helperText = canPrompt
    ? 'Install for faster launch and offline support.'
    : isIOS
      ? 'iOS: Share → Add to Home Screen.'
      : 'Use Chrome/Edge on Android to install.';

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed bottom-4 left-4 z-40 max-w-[110px] sm:max-w-[220px]"
    >
      <div className="panel-glass border border-primary/30 backdrop-blur-xl rounded-full shadow-xl px-2.5 py-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1 hidden sm:block">
            <p className="text-[10px] uppercase tracking-[0.14em] text-primary font-semibold leading-none">Get App</p>
            <p className="text-[10px] text-muted-foreground mt-1 truncate" title={helperText}>{helperText}</p>
          </div>
          <button
            type="button"
            onClick={() => void promptInstall()}
            disabled={!canPrompt}
            className="w-7 h-7 rounded-full gold-bg inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Install app"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="w-6 h-6 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss app install prompt"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
