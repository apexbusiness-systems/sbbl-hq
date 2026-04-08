<!-- Version: v1.1.0 | Date: 2026-04-04 | Status: Current -->
# Stream Gating Notes

- PPV entitlement records in `stream_entitlements`.
- Access session lifecycle in `stream_access_sessions`.
- Watermark events in `stream_watermark_events`.
- Upstream stream URL is operationally sensitive and remains in `stream_sources` for admin workflows.
- If source is flagged public, keep soft paywall warning in Ops.
