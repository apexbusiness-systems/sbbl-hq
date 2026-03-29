import { CreditCard, FileText } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { PLAYER_REGISTRATION_PRICE_USD } from '@/lib/auth/subscription';

const BillingPage = () => {
  const { authRole, hasPremiumPlayerAccess, playerSubscriptionEndsAt, renewPlayerTier } = useApp();

  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl">Billing & Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Account billing and player registration</p>
        </div>

        <div className="panel p-4 mb-8">
          <h3 className="font-display text-sm mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" /> Player Registration Tier
          </h3>
          <p className="text-xs text-muted-foreground">
            Player-only tier costs ${PLAYER_REGISTRATION_PRICE_USD.toFixed(2)} / month. Active players get leaderboard/profile inclusion and free livestream access.
          </p>
          <div className="mt-3 p-3 bg-secondary rounded-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {hasPremiumPlayerAccess ? 'Active' : 'Inactive'} player registration
              </p>
              <p className="text-[11px] text-muted-foreground">
                {playerSubscriptionEndsAt ? `Renews / expires on ${new Date(playerSubscriptionEndsAt).toLocaleDateString()}` : 'No active registration window'}
              </p>
            </div>
            {authRole === 'player' && (
              <button onClick={renewPlayerTier} className="gold-bg px-4 py-2 text-xs font-semibold rounded-sm uppercase tracking-wider">
                Pay ${PLAYER_REGISTRATION_PRICE_USD.toFixed(2)} & Renew
              </button>
            )}
          </div>
        </div>

        <div className="panel p-6 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-display text-lg">Transaction History</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Your billing history will appear here once transactions are processed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
