import { ShoppingBag, Image as ImageIcon, Calendar, QrCode } from 'lucide-react';

export const AdminDashboard = () => {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Admin Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="panel p-5 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer">
          <ShoppingBag className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold text-sm">Store Inventory</h3>
            <p className="text-xs text-muted-foreground mt-1">Upload and manage shop items</p>
          </div>
        </div>

        <div className="panel p-5 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer">
          <ImageIcon className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold text-sm">Media Management</h3>
            <p className="text-xs text-muted-foreground mt-1">Edit files, images, and videos</p>
          </div>
        </div>

        <div className="panel p-5 flex flex-col gap-3 hover:border-primary/50 transition-colors cursor-pointer">
          <Calendar className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold text-sm">Event Manager</h3>
            <p className="text-xs text-muted-foreground mt-1">Manage league schedules and events</p>
          </div>
        </div>

        <div className="panel p-5 flex flex-col gap-3 border-primary/20 bg-primary/5 hover:border-primary/50 transition-colors cursor-pointer">
          <QrCode className="w-6 h-6 text-primary" />
          <div>
            <h3 className="font-display font-bold text-sm">QR Scanner</h3>
            <p className="text-xs text-muted-foreground mt-1">Verify BALLRUNS check-ins</p>
          </div>
        </div>
      </div>
    </div>
  );
};
