import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { BagDrawer } from '@/components/layout/BagDrawer';
import { AppDownloadPill } from '@/components/marketing/AppDownloadPill';
import { StickyMusicPlayer } from '@/components/marketing/StickyMusicPlayer';
import { RequireAdmin, RequireAuth } from '@/components/auth/RouteGuards';

const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const Schedules = lazy(() => import('./pages/Schedules'));
const Store = lazy(() => import('./pages/Store'));
const Profiles = lazy(() => import('./pages/Profiles'));
const Stats = lazy(() => import('./pages/Stats'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const Media = lazy(() => import('./pages/Media'));
const Billing = lazy(() => import('./pages/Billing'));
const Settings = lazy(() => import('./pages/Settings'));
const Ops = lazy(() => import('./pages/Ops'));
const Teams = lazy(() => import('./pages/Teams'));
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="container py-16">
    <div className="panel p-4 text-sm text-muted-foreground">Loading page…</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
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
                    <Route path="/login" element={<Login />} />
                    <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
                    <Route path="/live" element={<Live />} />
                    <Route path="/schedules" element={<Schedules />} />
                    <Route path="/teams" element={<Teams />} />
                    <Route path="/store" element={<Store />} />
                    <Route path="/profiles" element={<Profiles />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/leaderboards" element={<Leaderboards />} />
                    <Route path="/media" element={<Media />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/ops" element={<RequireAdmin><Ops /></RequireAdmin>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
