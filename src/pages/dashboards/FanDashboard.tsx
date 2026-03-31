import { useAuth } from '@/contexts/AuthContext';
import { Ticket, Video } from 'lucide-react';

export const FanDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Fan Dashboard</h2>
      <p className="text-muted-foreground">Welcome back, {user?.email}!</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="panel p-6 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Ticket className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">My Tickets</h3>
            <p className="text-xs text-muted-foreground">View your upcoming event tickets</p>
          </div>
        </div>

        <div className="panel p-6 flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">My Streams</h3>
            <p className="text-xs text-muted-foreground">Access purchased PPV streams</p>
          </div>
        </div>
      </div>
    </div>
  );
};
