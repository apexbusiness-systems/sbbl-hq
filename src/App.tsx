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
import { RequireAdmin, RequireAuth } from '@/components/auth/RouteGuards';
import { StickyMusicPlayer } from '@/components/marketing/StickyMusicPlayer';
import { AppDownloadPill } from '@/components/marketing/AppDownloadPill';

const AppHome = lazy(() => import('./pages/AppHome'));
const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const Schedules = lazy(() => import('./pages/Schedules'));
const Store = lazy(() => import('./pages/Store'));
const Profiles = lazy(() => import('./pages/Profiles'));
const Stats = lazy(() => import('./pages/Stats'));
const Leaderboards = lazy(() => import('./pages/Leaderboards'));
const Media = lazy(() => import('./pages/Media'));
const Teams = lazy(() => import('./pages/Teams'));
const Login = lazy(() => import('./pages/Login'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Billing = lazy(() => import('./pages/Billing'));
const Settings = lazy(() => import('./pages/Settings'));
const Ops = lazy(() => import('./pages/Ops'));
const Support = lazy(() => import('./pages/Support'));
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
              <StickyMusicPlayer />
              <AppDownloadPill />
              <main>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<AppHome />} />
                    <Route path="/league/:leagueId" element={<Home />} />
                    <Route path="/live" element={<Live />} />
                    <Route path="/schedules" element={<Schedules />} />
                    <Route path="/store" element={<Store />} />
                    <Route path="/profiles" element={<Profiles />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/leaderboards" element={<Leaderboards />} />
                    <Route path="/media" element={<Media />} />
                    <Route path="/teams" element={<Teams />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
                    <Route path="/billing" element={<RequireAuth><Billing /></RequireAuth>} />
                    <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                    <Route path="/ops" element={<RequireAdmin><Ops /></RequireAdmin>} />
                    <Route path="/support" element={<Support />} />
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
