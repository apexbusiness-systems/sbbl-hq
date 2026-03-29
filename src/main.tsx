import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

registerSW({ immediate: true });

document.title = "SBBL HQ";

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
