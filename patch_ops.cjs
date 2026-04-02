const fs = require('fs');
let ops = fs.readFileSync('/app/src/pages/Ops.tsx', 'utf-8');

// Insert Teams and Players tabs handling
const opsTabsStr = `
      {activeTab === 'teams' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Teams Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage teams.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Team</h3>
                <div className="space-y-2">
                  <input placeholder="Team Name" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <input placeholder="Division" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Team</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Team</h3>
                <div className="flex gap-2">
                  <input placeholder="Team ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'players' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Players Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage players.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Player</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="First Name" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                    <input placeholder="Last Name" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  </div>
                  <input placeholder="Team ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Player</button>
                </div>
              </div>
              <div className="border border-warning/20 p-3 rounded-sm bg-warning/5">
                <h3 className="text-sm font-semibold text-warning mb-2">Suspend Player</h3>
                <div className="flex gap-2">
                  <input placeholder="Player ID to Suspend" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-warning hover:bg-warning/90 text-warning-foreground px-4 py-2 rounded-sm text-xs text-black">Suspend</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Player</h3>
                <div className="flex gap-2">
                  <input placeholder="Player ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
`;

ops = ops.replace("{activeTab === 'store' && (", opsTabsStr + "\n      {activeTab === 'store' && (");

fs.writeFileSync('/app/src/pages/Ops.tsx', ops);
