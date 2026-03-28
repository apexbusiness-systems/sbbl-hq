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
import Home from "./pages/Home";
import Live from "./pages/Live";
import Schedules from "./pages/Schedules";
import Store from "./pages/Store";
import Profiles from "./pages/Profiles";
import Stats from "./pages/Stats";
import Leaderboards from "./pages/Leaderboards";
import Media from "./pages/Media";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import Ops from "./pages/Ops";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
            </main>
          </div>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
