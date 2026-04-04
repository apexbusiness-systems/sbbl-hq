# RLS Matrix

| Table Domain | Read | Write |
|---|---|---|
| profiles | public if `profile_public=true`; owner read | owner update |
| products/media/games | public when published | operators/admin via server routes |
| orders/invoices/entitlements | owner only | owner + server-verified payment finalization |
| player submissions/headshots | owner + admins | owner submit, admin resolve |
| review/ops | admins/operators only | admins/operators only |

All non-public tables have RLS enabled in migration and require role-scoped access patterns.
