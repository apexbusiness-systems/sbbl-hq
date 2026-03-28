import { motion } from 'framer-motion';
import { Download, Smartphone, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/use-install-prompt';

export const AppDownloadPill = () => {
  const { isVisible, canPrompt, isIOS, promptInstall, dismiss } = useInstallPrompt();

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[360px] z-[60]"
    >
      <div className="panel-glass border border-primary/30 backdrop-blur-xl px-4 py-3 rounded-xl shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">Download SBBL HQ App</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {canPrompt
                ? 'Install on this device for a full-screen Apple-grade experience with faster launch and offline caching.'
                : isIOS
                  ? 'On iOS: tap Share, then Add to Home Screen.'
                  : 'Open in Chrome/Edge on Android and use Add to Home screen.'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => void promptInstall()}
                disabled={!canPrompt}
                className="gold-bg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider rounded-md inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" /> Install App
              </button>
              <button onClick={dismiss} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Not now
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
