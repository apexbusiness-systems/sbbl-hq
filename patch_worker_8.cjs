const fs = require('fs');
let worker = fs.readFileSync('/app/src/worker/index.ts', 'utf-8');

const additionalWorkerLogicStore = `
  } else if (kind === 'store') {
     if (action === 'batch_create') {
        const items = body.items; // array of up to 4 items
        for (const item of items) {
           const { error } = await admin.from('products').insert({
              title: item.title,
              price: item.price,
              inventory_qty: item.qty,
              category: item.category,
              is_sold_out: item.qty <= 0,
              sold_out_date: item.qty <= 0 ? new Date().toISOString() : null,
           });
           if (error) return json({ ok: false, error: error.message }, 500);
        }
     } else if (action === 'suspend') {
        const { error } = await admin.from('products').update({ publish_status: 'suspended' }).eq('id', body.id);
        if (error) return json({ ok: false, error: error.message }, 500);
     } else if (action === 'delete') {
        const { error } = await admin.from('products').delete().eq('id', body.id);
        if (error) return json({ ok: false, error: error.message }, 500);
     }
  }
`;

worker = worker.replace("  return json({ ok: true });\n}", additionalWorkerLogicStore + "  return json({ ok: true });\n}");
fs.writeFileSync('/app/src/worker/index.ts', worker);
