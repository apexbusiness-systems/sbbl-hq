const fs = require('fs');
let ops = fs.readFileSync('/app/src/pages/Ops.tsx', 'utf-8');

const storeOpsReplacement = `
      {activeTab === 'store' && (
        <div className="panel p-4 max-w-xl space-y-8">
          <div>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Store Media & Product Ops</h2>
            {!isSuperAdmin ? (
              <p className="text-sm text-destructive font-semibold">Super Admin required to manually manage store operations.</p>
            ) : (
              <div className="space-y-6">

                {/* Batch Create Products */}
                <div className="border border-border p-3 rounded-sm">
                  <h3 className="text-sm font-semibold mb-3">Batch Create Products (Max 4)</h3>
                  <div className="space-y-4">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="border border-secondary p-3 rounded-sm space-y-2 relative">
                        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground font-semibold">Item {i+1}</div>
                        <input placeholder="Title" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" placeholder="Price (USD)" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                          <input type="number" placeholder="Inventory Qty" className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm" />
                        </div>
                        <select className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm">
                          <option value="apparel">Apparel</option>
                          <option value="accessories">Accessories</option>
                          <option value="rewards">Rewards</option>
                        </select>
                      </div>
                    ))}
                    <button className="gold-bg px-4 py-2 rounded-sm text-xs w-full">Submit Batch</button>
                  </div>
                </div>

                {/* Manage Products */}
                <div className="border border-border p-3 rounded-sm">
                  <h3 className="text-sm font-semibold mb-2">Manage Products</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border border-warning/20 p-3 rounded-sm bg-warning/5">
                      <h4 className="text-[10px] font-semibold text-warning mb-2 uppercase tracking-widest">Suspend</h4>
                      <input placeholder="Product ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-1.5 text-xs mb-2" />
                      <button className="bg-warning hover:bg-warning/90 text-warning-foreground px-3 py-1.5 rounded-sm text-[10px] w-full text-black">Suspend</button>
                    </div>
                    <div className="border border-destructive/20 p-3 rounded-sm bg-destructive/5">
                      <h4 className="text-[10px] font-semibold text-destructive mb-2 uppercase tracking-widest">Delete</h4>
                      <input placeholder="Product ID" className="w-full bg-secondary border border-border rounded-sm px-3 py-1.5 text-xs mb-2" />
                      <button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-sm text-[10px] w-full">Delete</button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
`;

ops = ops.replace(/\{activeTab === 'store' && \([\s\S]*?(?=\{activeTab === 'potg')/, storeOpsReplacement);
fs.writeFileSync('/app/src/pages/Ops.tsx', ops);
