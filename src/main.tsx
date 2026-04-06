// instrument.ts MUST be the first import — Sentry must initialize before any
// other module runs so it can intercept errors from the very first render.
import "./instrument";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { initNativePlugins } from "@/lib/capacitor";

registerSW({
  onNeedRefresh() {
    if (confirm('New version available. Reload to update?')) {
      window.location.reload();
    }
  },
});

// Initialise Capacitor native plugins (no-ops on web)
initNativePlugins();

document.title = "SBBL HQ";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
