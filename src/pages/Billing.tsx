import { invoices, leagues } from '@/data/mock';
import { LeagueBadge } from '@/components/ui/LeagueBadge';
import { CreditCard, FileText, Download, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const statusIcon = (s: string) => {
  if (s === 'paid') return <CheckCircle className="w-3.5 h-3.5 text-success" />;
  if (s === 'pending') return <Clock className="w-3.5 h-3.5 text-warning" />;
  return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
};

const BillingPage = () => {
  return (
    <div className="min-h-screen">
      <div className="container py-8 md:py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold">Billing & Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Invoices, payments, and account summary</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Paid</p>
            <p className="stat-numeral text-2xl text-success mt-1">₱{invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0).toLocaleString()}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
            <p className="stat-numeral text-2xl text-warning mt-1">₱{invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0).toLocaleString()}</p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Reward Credits</p>
            <p className="stat-numeral text-2xl text-primary mt-1">2,450 pts</p>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="panel p-4 mb-8">
          <h3 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" /> Payment Methods
          </h3>
          <div className="flex items-center gap-3 p-3 bg-secondary rounded-sm">
            <div className="w-10 h-7 bg-muted rounded-sm flex items-center justify-center text-[10px] font-bold text-muted-foreground">VISA</div>
            <div className="flex-1">
              <p className="text-sm font-medium">•••• •••• •••• 4829</p>
              <p className="text-[10px] text-muted-foreground">Expires 08/28</p>
            </div>
            <span className="text-[10px] text-success font-semibold uppercase">Default</span>
          </div>
          <button className="mt-3 text-xs text-primary font-semibold">+ Add Payment Method</button>
        </div>

        {/* Invoices */}
        <div className="panel">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="font-display font-bold text-sm">Transaction History</span>
          </div>
          <div className="divide-y divide-border">
            {invoices.map(inv => (
              <div key={inv.id} className="p-4 flex items-center gap-4">
                {statusIcon(inv.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{inv.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{inv.date}</span>
                    {inv.leagueId && <LeagueBadge leagueId={inv.leagueId} />}
                  </div>
                </div>
                <div className="text-right">
                  <p className="stat-numeral text-sm">{inv.amount > 100 ? `₱${inv.amount.toLocaleString()}` : `$${inv.amount.toFixed(2)}`}</p>
                  <p className={`text-[10px] capitalize ${inv.status === 'paid' ? 'text-success' : inv.status === 'pending' ? 'text-warning' : 'text-destructive'}`}>{inv.status}</p>
                </div>
                <button className="p-1.5 text-muted-foreground hover:text-foreground"><Download className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
