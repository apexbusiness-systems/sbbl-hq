## 30 Minutes Before Kickoff — Pre-Event Checklist

1. **[Cloudflare Worker Health]**  
   **Action:** Open your browser and go to `https://sbbl-hq.icu/health` (or `https://www.sbbl-hq.icu/health`).  
   **Pass:** The page shows `{"status":"ok"}`.  
   **Fail:** You see any other text or an error page → **Contact tech support immediately**.

2. **[Supabase Database]**  
   **Action:** Open Supabase dashboard → project `ezanilxygnpucwkwpsoc` → Database → SQL Editor. Run:  
   `SELECT count(*) FROM events WHERE status = 'live';`  
   **Pass:** Result is `1` (your event is marked live).  
   **Fail:** Result is `0` → Go to Events admin panel and set this event status to **live**.

3. **[PPV Paywall Test]**  
   **Action:** Open an incognito/private browser window and go to your stream page (`/live`).  
   **Pass:** You see “Purchase to watch” or login prompt.  
   **Fail:** Stream plays without login/payment → **STOP and contact tech support**.

4. **[Stripe Webhook Active]**  
   **Action:** Log into Stripe → Developers → Webhooks. Confirm the endpoint is **Enabled** and last delivery is successful.  
   **Pass:** Green checkmark and last delivery is less than 24 hours old.  
   **Fail:** Red/warning status → Contact tech support.

5. **[Stream Ingestion Test]**  
   **Action:** Start OBS (or your stream software), begin streaming to your RTMP destination. Open admin panel → Stream Monitor.  
   **Pass:** Viewer count shows 0 and stream status shows **receiving**.  
   **Fail:** Status shows **no signal** → Re-check RTMP URL + stream key in OBS.

6. **[One-Device Policy Test]**  
   **Action:** On phone/device #1, log in with a PPV-enabled test account and start watching. On device #2, log in with same account and try to watch.  
   **Pass:** Device #2 shows “already watching on another device”.  
   **Fail:** Both devices can stream simultaneously → Contact tech support.

7. **[Replay Recording Check]**  
   **Action:** In admin panel, confirm **Record to replay** is ON for this event.  
   **Pass:** Toggle is green/on.  
   **Fail:** Toggle is off → Turn it on before kickoff.

**All 7 checks passed? You're good to go. Start the game.**
