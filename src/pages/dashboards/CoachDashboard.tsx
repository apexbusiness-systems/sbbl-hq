
import { Users, Calendar, AlertTriangle, Play, Award } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionStatus } from '@/lib/auth/subscription';

export const CoachDashboard = () => {
  const { playerSubscriptionEndsAt } = useAuth();
  const subStatus = getSubscriptionStatus(playerSubscriptionEndsAt);
  const isExpired = subStatus === 'expired';
  const isGrace = subStatus === 'grace';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-bold">Coach Dashboard</h2>

        {isGrace && (
          <div className="bg-warning/20 border border-warning/50 text-warning px-4 py-2 rounded-sm flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Subscription expiring soon. Renew to keep your coach access.</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className={`panel p-6 flex items-center gap-4 transition-colors ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">My Team</h3>
            <p className="text-xs text-muted-foreground">Manage roster and view player stats</p>
          </div>
        </div>

        <div className={`panel p-6 flex items-center gap-4 transition-colors ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">Team Events</h3>
            <p className="text-xs text-muted-foreground">Schedule practices strictly for your team</p>
          </div>
        </div>

        {/* Premium features included for coach */}
        <div className={`panel p-6 flex items-center gap-4 transition-colors ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Play className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">Highlights</h3>
            <p className="text-xs text-muted-foreground">Save team and player highlights</p>
          </div>
        </div>

        <div className={`panel p-6 flex items-center gap-4 transition-colors ${isExpired ? 'opacity-50 cursor-not-allowed border-dashed' : 'hover:border-primary/50 cursor-pointer'}`}>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">Rankings</h3>
            <p className="text-xs text-muted-foreground">View team rankings & leaderboards</p>
          </div>
        </div>
      </div>
    </div>
  );
};
