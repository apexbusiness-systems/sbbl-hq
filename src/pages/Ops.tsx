import { useApp } from '@/contexts/AppContext';
import { reviewItems } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { Shield, AlertTriangle, CheckCircle, Eye, Radio, DollarSign, FileWarning, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';

const severityColor = { low: 'text-muted-foreground', medium: 'text-warning', high: 'text-destructive' };

const OpsPage = () => {
  const { isAdmin } = useApp();
  const [items, setItems] = useState(reviewItems);

  if (!isAdmin) return <Navigate to="/" replace />;

  const resolve = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'resolved' as const } : i));

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Operations</h1>
            <p className="text-sm text-muted-foreground mt-1">Admin review queue and system controls</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Review Queue</p>
            <p className="stat-numeral text-2xl text-warning mt-1">{items.filter(i => i.status === 'pending').length}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Resolved</p>
            <p className="stat-numeral text-2xl text-success mt-1">{items.filter(i => i.status === 'resolved').length}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Stream Status</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 rounded-full bg-live animate-pulse" />
              <span className="stat-numeral text-sm text-live">1 Active</span>
            </div>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue (MTD)</p>
            <p className="stat-numeral text-2xl text-primary mt-1">₱24.5K</p>
          </div>
        </div>

        {/* Review Queue */}
        <div className="panel mb-8">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="font-display font-bold text-sm">Review Queue</span>
          </div>
          <div className="divide-y divide-border">
            {items.map(item => (
              <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-2 md:w-40">
                  <span className={`text-xs font-semibold uppercase ${severityColor[item.severity]}`}>{item.severity}</span>
                  <LeagueBadge leagueId={item.leagueId} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'pending' ? (
                    <>
                      <button onClick={() => resolve(item.id)} className="px-3 py-1.5 bg-success/15 text-success text-xs font-semibold rounded-sm hover:bg-success/25 transition-colors">
                        Resolve
                      </button>
                      <button className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-sm">
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-success font-semibold"><CheckCircle className="w-3 h-3" /> Resolved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stream Control */}
        <div className="panel p-4 mb-8">
          <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4 text-live" /> Stream Source Control
          </h3>
          <div className="bg-secondary p-4 rounded-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">SBBL Game G1 — Active Stream</p>
                <p className="text-[10px] text-muted-foreground">External ingest: rtmp://stream.sbblhq.com/live/g1-session</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-live animate-pulse" />
                <span className="text-xs text-live font-semibold">Live</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 bg-destructive/15 text-destructive text-xs font-semibold rounded-sm">End Stream</button>
              <button className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-sm border border-border">Refresh Source</button>
            </div>
          </div>
        </div>

        {/* Payout Summary */}
        <div className="panel p-4">
          <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Payout Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-secondary p-4 rounded-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">PPV Revenue</p>
              <p className="stat-numeral text-xl text-primary mt-1">₱12,350</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">4,940 viewers × $2.50</p>
            </div>
            <div className="bg-secondary p-4 rounded-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Store Revenue</p>
              <p className="stat-numeral text-xl text-primary mt-1">₱8,750</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">47 orders this month</p>
            </div>
            <div className="bg-secondary p-4 rounded-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Registration Fees</p>
              <p className="stat-numeral text-xl text-primary mt-1">₱41,300</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">30 teams registered</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpsPage;
