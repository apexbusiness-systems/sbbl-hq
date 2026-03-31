
import { User, CalendarCheck, CreditCard, AlertTriangle, Play, Award } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { getSubscriptionStatus } from '@/lib/auth/subscription';

export const PlayerDashboard = () => {
  const { playerSubscriptionEndsAt } = useApp();
  const subStatus = getSubscriptionStatus(playerSubscriptionEndsAt);
  const isExpired = subStatus === 'expired';
  const isGrace = subStatus === 'grace';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-bold">Player Dashboard</h2>

        {isGrace && (
          <div className="bg-warning/20 border border-warning/50 text-warning px-4 py-2 rounded-sm flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Subscription expiring soon. Renew to keep your player access.</span>
          </div>
        )}

        {isExpired && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 rounded-sm flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Subscription expired. Please renew for $7/mo.</span>
            <button className="gold-bg text-primary-foreground text-xs font-bold px-3 py-1 ml-2 rounded-sm whitespace-nowrap">Renew Now</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className={`panel p-6 flex flex-col gap-3 transition-colors relative overflow-hidden ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <User className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold">Update Bio</h3>
            <p className="text-xs text-muted-foreground">Manage your player profile and stats</p>
          </div>
        </div>

        <div className={`panel p-6 flex flex-col gap-3 transition-colors relative overflow-hidden ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <CalendarCheck className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold">Event Check-In</h3>
            <p className="text-xs text-muted-foreground">Check into your upcoming games</p>
          </div>
        </div>

        <div className={`panel p-6 flex flex-col gap-3 border-primary/20 bg-primary/5 transition-colors relative overflow-hidden ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-sm uppercase">Paywalled</div>
          <CreditCard className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold">BALLRUNS Check-In</h3>
            <p className="text-xs text-muted-foreground">Access premium practice games</p>
          </div>
        </div>

        {/* New Premium Features */}
        <div className={`panel p-6 flex flex-col gap-3 transition-colors relative overflow-hidden ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <Play className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold">My Highlights</h3>
            <p className="text-xs text-muted-foreground">Save and download your best plays</p>
          </div>
        </div>

        <div className={`panel p-6 flex flex-col gap-3 transition-colors relative overflow-hidden ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <Award className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold">Rankings & Leaderboards</h3>
            <p className="text-xs text-muted-foreground">View your tier ranking across the league</p>
          </div>
        </div>
      </div>
    </div>
  );
};
