import { AdminDashboard } from './AdminDashboard';
import { DollarSign, Tag, UserX, Radio } from 'lucide-react';

export const SuperAdminDashboard = () => {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Super Admin Controls
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="panel p-5 flex flex-col gap-3 border-destructive/20 hover:border-destructive/50 transition-colors cursor-pointer">
            <DollarSign className="w-6 h-6 text-destructive" />
            <div>
              <h3 className="font-display font-bold text-sm">Set Pricing</h3>
              <p className="text-xs text-muted-foreground mt-1">Configure global store & PPV pricing</p>
            </div>
          </div>

          <div className="panel p-5 flex flex-col gap-3 border-destructive/20 hover:border-destructive/50 transition-colors cursor-pointer">
            <Tag className="w-6 h-6 text-destructive" />
            <div>
              <h3 className="font-display font-bold text-sm">Upload SALE Items</h3>
              <p className="text-xs text-muted-foreground mt-1">Manage discounted inventory</p>
            </div>
          </div>

          <div className="panel p-5 flex flex-col gap-3 border-destructive/20 hover:border-destructive/50 transition-colors cursor-pointer">
            <UserX className="w-6 h-6 text-destructive" />
            <div>
              <h3 className="font-display font-bold text-sm">User Moderation</h3>
              <p className="text-xs text-muted-foreground mt-1">Suspend or ban accounts</p>
            </div>
          </div>

          <div className="panel p-5 flex flex-col gap-3 border-destructive/20 hover:border-destructive/50 transition-colors cursor-pointer">
            <Radio className="w-6 h-6 text-destructive" />
            <div>
              <h3 className="font-display font-bold text-sm">Live Streams</h3>
              <p className="text-xs text-muted-foreground mt-1">Start and end active broadcasts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-border/50 opacity-80 hover:opacity-100 transition-opacity">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Inherited Admin Capabilities</h3>
        <AdminDashboard />
      </div>
    </div>
  );
};
