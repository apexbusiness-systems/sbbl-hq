import type { FutureConfig } from 'react-router-dom';

// Centralize v7 opt-in flags for test routers so every spec shares the same routing semantics.
export const ROUTER_FUTURE: FutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};
