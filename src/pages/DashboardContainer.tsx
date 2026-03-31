import { useAuth } from '@/contexts/AuthContext';
import { AppRole, hasRole } from '@/lib/auth/roles';
import { FanDashboard } from './dashboards/FanDashboard';
import { PlayerDashboard } from './dashboards/PlayerDashboard';
import { CoachDashboard } from './dashboards/CoachDashboard';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { SuperAdminDashboard } from './dashboards/SuperAdminDashboard';
import { Navigate } from 'react-router-dom';

export const DashboardContainer = () => {
  const { user, roles } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Ensure type-safety for roles array. Default to 'fan' if empty.
  const appRoles = (roles.length > 0 ? roles : ['fan']) as AppRole[];

  let Content = <FanDashboard />;

  // Determine highest dashboard to show (top-down evaluation)
  if (hasRole(appRoles, 'super_admin')) {
    Content = <SuperAdminDashboard />;
  } else if (hasRole(appRoles, 'league_admin')) {
    Content = <AdminDashboard />;
  } else if (hasRole(appRoles, 'coach')) {
    Content = <CoachDashboard />;
  } else if (hasRole(appRoles, 'player')) {
    Content = <PlayerDashboard />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 md:py-12 max-w-6xl">
        {Content}
      </div>
    </div>
  );
};
export default DashboardContainer;
