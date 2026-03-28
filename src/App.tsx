import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { Header } from "@/components/layout/Header";
import { BagDrawer } from "@/components/layout/BagDrawer";
import { AppDownloadPill } from "@/components/marketing/AppDownloadPill";
import { StickyMusicPlayer } from "@/components/marketing/StickyMusicPlayer";

const Home = lazy(() => import("./pages/Home"));
const Live = lazy(() => import("./pages/Live"));
const Schedules = lazy(() => import("./pages/Schedules"));
const Store = lazy(() => import("./pages/Store"));
const Profiles = lazy(() => import("./pages/Profiles"));
const Stats = lazy(() => import("./pages/Stats"));
const Leaderboards = lazy(() => import("./pages/Leaderboards"));
const Media = lazy(() => import("./pages/Media"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const Ops = lazy(() => import("./pages/Ops"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="container py-16">
    <div className="panel p-4 text-sm text-muted-foreground">Loading page…</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Header />
            <BagDrawer />
            <AppDownloadPill />
            <StickyMusicPlayer />
            <main>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/live" element={<Live />} />
                  <Route path="/schedules" element={<Schedules />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/profiles" element={<Profiles />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/leaderboards" element={<Leaderboards />} />
                  <Route path="/media" element={<Media />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/ops" element={<Ops />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
