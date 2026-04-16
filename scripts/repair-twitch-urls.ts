/**
 * scripts/repair-twitch-urls.ts
 *
 * One-time repair script to convert legacy persisted Twitch embed URLs
 * (player.twitch.tv) into canonical raw channel URLs (twitch.tv).
 *
 * This enforces the Canonical Persistence Law: we only ever persist
 * the raw source URL, and provider-specific embed logic happens
 * strictly in the render layer.
 *
 * Run with:
 * DRY_RUN=1 bun run scripts/repair-twitch-urls.ts
 * bun run scripts/repair-twitch-urls.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.dev.vars' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .dev.vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const isDryRun = process.env.DRY_RUN !== '0' && process.env.DRY_RUN !== 'false' && process.env.DRY_RUN !== '';
  console.log(`\n=== Twitch URL Repair Script ===`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE REPAIR'}\n`);

  try {
    const { data: configs, error } = await supabase
      .from('stream_admin_config')
      .select('id, collection_id');

    if (error) throw error;

    let totalAffected = 0;
    const repairs: Array<{ id: string, old: string, new: string }> = [];

    for (const config of configs || []) {
      if (!config.collection_id) continue;

      const url = config.collection_id.trim();
      if (url.toLowerCase().includes('player.twitch.tv')) {
        try {
          const parsed = new URL(url);
          const channel = parsed.searchParams.get('channel');

          if (channel) {
            const newUrl = `https://www.twitch.tv/${channel}`;
            repairs.push({ id: config.id, old: url, new: newUrl });
            totalAffected++;
          } else {
            console.warn(`[WARN] Found player.twitch.tv URL but could not extract channel: ${url}`);
          }
        } catch (e) {
          console.warn(`[WARN] Invalid URL format: ${url}`);
        }
      }
    }

    console.log(`Found ${totalAffected} rows needing repair.`);

    if (repairs.length === 0) {
      console.log('No repair needed. Database is clean.');
      process.exit(0);
    }

    console.log('\n--- Planned Repairs ---');
    repairs.forEach((r, i) => {
      console.log(`\nRow ${i + 1} (ID: ${r.id}):`);
      console.log(`  OLD: ${r.old}`);
      console.log(`  NEW: ${r.new}`);
    });

    if (isDryRun) {
      console.log('\nDry run complete. No data was modified.');
      console.log('Run with DRY_RUN=0 to execute the repair.');
    } else {
      console.log('\nExecuting repair...');

      for (const repair of repairs) {
         const { error: updateError } = await supabase
           .from('stream_admin_config')
           .update({ collection_id: repair.new })
           .eq('id', repair.id);

         if (updateError) {
           console.error(`[ERROR] Failed to update row ${repair.id}:`, updateError.message);
         } else {
           console.log(`[OK] Updated row ${repair.id}`);
           console.log(JSON.stringify({
             event: 'twitch_embed_url_repair_applied',
             row_id: repair.id,
             original: repair.old,
             rewritten: repair.new
           }));
         }
      }

      console.log('\nRepair complete.');
      console.log('Rollback note: To reverse this repair, run an update query replacing the NEW URL with the OLD URL for each row ID logged above.');
    }

  } catch (err) {
    console.error('Script failed:', err);
    process.exit(1);
  }
}

run();
