const fs = require('fs');
let ops = fs.readFileSync('/app/src/pages/Ops.tsx', 'utf-8');

const opsTabsStr = `
      {activeTab === 'schedules' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Schedules Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage schedules.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Schedule Entry</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Home Team ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                    <input placeholder="Away Team ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                    <input type="time" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  </div>
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Schedule</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Schedule Entry</h3>
                <div className="flex gap-2">
                  <input placeholder="Schedule ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-sm text-xs">Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="panel p-4 max-w-xl">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Events Manual Ops</h2>
          {!isSuperAdmin ? (
            <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage events.</p>
          ) : (
            <div className="space-y-4">
              <div className="border border-border p-3 rounded-sm">
                <h3 className="text-sm font-semibold mb-2">Create Event</h3>
                <div className="space-y-2">
                  <input placeholder="Event Title" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <input placeholder="Location" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <input type="date" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                  <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Create Event</button>
                </div>
              </div>
              <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                <h3 className="text-sm font-semibold text-destructive mb-2">Delete Event</h3>
                <div className="flex gap-2">
                  <input placeholder="Event ID to Delete" className="flex-1 bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
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
