PS C:\WINDOWS\system32> # In your repo root (C:\Users\sinyo\sbbl-hq\sbbl-hq)
PS C:\WINDOWS\system32> # 1. Discard local mods in OUTER (wrong) directory so git pull works
PS C:\WINDOWS\system32> git checkout -- sbbl-hq-selfhost/docker-compose.yml `
>>                 sbbl-hq-selfhost/volumes/api/kong-entrypoint.sh `
>>                 sbbl-hq-selfhost/volumes/pooler/pooler.exs
fatal: not a git repository (or any of the parent directories): .git
PS C:\WINDOWS\system32>
PS C:\WINDOWS\system32> # 2. Merge PR #534 on GitHub, then:
PS C:\WINDOWS\system32> git pull origin main
fatal: not a git repository (or any of the parent directories): .git
PS C:\WINDOWS\system32>
PS C:\WINDOWS\system32> # 3. Go to CORRECT inner Docker root (two sbbl-hq-selfhost segments)
PS C:\WINDOWS\system32> cd "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 4. Restart Kong only
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose up -d --force-recreate kong
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T10:16:04-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
[+] up 2/2
 ✔ Container supabase-studio Healthy                                                                                1.0s
 ✔ Container supabase-kong   Started                                                                                1.4s

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 5. Validate (wait ~15s for Kong to reload)
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Start-Sleep 15
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> cd ..\scripts
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\scripts> .\validate_cors_preflight.ps1
.\validate_cors_preflight.ps1 : The term '.\validate_cors_preflight.ps1' is not recognized as the name of a cmdlet,
function, script file, or operable program. Check the spelling of the name, or if a path was included, verify that the
path is correct and try again.
At line:1 char:1
+ .\validate_cors_preflight.ps1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (.\validate_cors_preflight.ps1:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\scripts> # Step 1 — go to repo root first
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\scripts> cd "C:\Users\sinyo\sbbl-hq\sbbl-hq"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq> # Step 2 — discard the 3 outer-directory local mods so git pull can proceed
PS C:\Users\sinyo\sbbl-hq\sbbl-hq> git checkout -- sbbl-hq-selfhost/docker-compose.yml sbbl-hq-selfhost/volumes/api/kong-entrypoint.sh sbbl-hq-selfhost/volumes/pooler/pooler.exs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq> # Step 3 — pull main (includes the CORS fix from the merged PR)
PS C:\Users\sinyo\sbbl-hq\sbbl-hq> git pull origin main
remote: Enumerating objects: 53, done.
remote: Counting objects: 100% (53/53), done.
remote: Compressing objects: 100% (21/21), done.
remote: Total 35 (delta 19), reused 23 (delta 11), pack-reused 0 (from 0)
Unpacking objects: 100% (35/35), 16.57 KiB | 68.00 KiB/s, done.
From https://github.com/apexbusiness-systems/sbbl-hq
 * branch            main       -> FETCH_HEAD
   3a99987..2719422  main       -> origin/main
Updating 3a99987..2719422
Fast-forward
 .github/workflows/selfhost-auth-smoke.yml          |  54 +++--
 .../volumes/api/kong-entrypoint.sh                 |  21 +-
 .../sbbl-hq-selfhost/volumes/api/kong.yml          | 253 ++++++++++++++++++++-
 .../sbbl-hq-selfhost/volumes/db/graphql.sql        |  18 ++
 .../sbbl-hq-selfhost/volumes/db/realtime.sql       |  15 ++
 .../sbbl-hq-selfhost/volumes/db/roles.sql          |  35 ++-
 .../sbbl-hq-selfhost/volumes/proxy/caddy/Caddyfile |  14 +-
 sbbl-hq-selfhost/scripts/defcon_cors_patch.py      | 233 +++++++++++++++++++
 .../scripts/validate_cors_preflight.ps1            | 102 +++++++++
 9 files changed, 703 insertions(+), 42 deletions(-)
 create mode 100644 sbbl-hq-selfhost/sbbl-hq-selfhost/volumes/db/graphql.sql
 create mode 100644 sbbl-hq-selfhost/scripts/defcon_cors_patch.py
 create mode 100644 sbbl-hq-selfhost/scripts/validate_cors_preflight.ps1
PS C:\Users\sinyo\sbbl-hq\sbbl-hq>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq> # Step 4 — restart Kong again (now with the fixed kong.yml)
PS C:\Users\sinyo\sbbl-hq\sbbl-hq> cd "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose up -d --force-recreate kong
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T11:05:33-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
[+] up 2/2
 ✔ Container supabase-studio Healthy                                                                                0.9s
 ✔ Container supabase-kong   Started                                                                                1.2s

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Start-Sleep 15
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> $AnonKey = (Get-Content .env | Where-Object { $_ -match '^ANON_KEY=' }) -replace '^ANON_KEY=',''
Get-Content : Cannot find path 'C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost\.env' because it does
not exist.
At line:1 char:13
+ $AnonKey = (Get-Content .env | Where-Object { $_ -match '^ANON_KEY='  ...
+             ~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (C:\Users\sinyo\...q-selfhost\.env:String) [Get-Content], ItemNotFoundEx
   ception
    + FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand

PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> curl.exe -sS -D - -o NUL -X OPTIONS "https://supabase.sbbl-hq.icu/auth/v1/token?grant_type=password" `
>>   -H "Origin: https://sbbl-hq.icu" `
>>   -H "Access-Control-Request-Method: POST" `
>>   -H "Access-Control-Request-Headers: authorization,apikey,content-type,x-supabase-api-version,prefer"
HTTP/1.1 502 Bad Gateway
Date: Wed, 20 May 2026 17:05:57 GMT
Content-Type: text/plain; charset=UTF-8
Content-Length: 15
Connection: keep-alive
Cache-Control: private, max-age=0, no-store, no-cache, must-revalidate, post-check=0, pre-check=0
Expires: Thu, 01 Jan 1970 00:00:01 GMT
Referrer-Policy: same-origin
X-Frame-Options: SAMEORIGIN
Server: cloudflare
CF-RAY: 9fecede08de37d77-YVR
alt-svc: h3=":443"; ma=86400

PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # Run this in PowerShell as Administrator or normal user on the Docker host
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # ONE BLOCK — paste entire thing
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Set-Location "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 1. Check current state
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose ps
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:43-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
NAME                IMAGE                                    COMMAND                  SERVICE    CREATED       STATUS                          PORTS
supabase-db         supabase/postgres:15.8.1.085             "docker-entrypoint.s…"   db         8 hours ago   Restarting (1) 13 seconds ago
supabase-imgproxy   darthsim/imgproxy:v3.30.1                "entrypoint.sh imgpr…"   imgproxy   8 hours ago   Up 2 hours (healthy)            8080/tcp
supabase-kong       kong/kong:3.9.1                          "/home/kong/kong-ent…"   kong       3 hours ago   Restarting (1) 30 seconds ago
supabase-studio     supabase/studio:2026.04.27-sha-5f60601   "docker-entrypoint.s…"   studio     8 hours ago   Up 2 hours (healthy)            3000/tcp
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 2. Force-recreate ONLY Kong
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose up -d --force-recreate kong
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:06:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
[+] up 2/2
 ✔ Container supabase-studio Healthy                                                                                1.6s
 ✔ Container supabase-kong   Started                                                                                2.1s

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 3. Wait for health
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Start-Sleep -Seconds 20
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose ps kong
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:08-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
NAME            IMAGE             COMMAND                  SERVICE   CREATED          STATUS                            PORTS
supabase-kong   kong/kong:3.9.1   "/home/kong/kong-ent…"   kong      23 seconds ago   Up 3 seconds (health: starting)   0.0.0.0:53002->8000/tcp, [::]:53002->8000/tcp, 0.0.0.0:53003->8443/tcp, [::]:53003->8443/tcp
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose logs --tail=50 kong
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:09-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | nginx: [error] init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | 2026/05/20 20:07:03 [warn] 1#0: the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /usr/local/kong/nginx.conf:7
supabase-kong  | nginx: [warn] the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /usr/local/kong/nginx.conf:7
supabase-kong  | 2026/05/20 20:07:03 [error] 1#0: init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | nginx: [error] init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | 2026/05/20 20:07:07 [warn] 1#0: the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /usr/local/kong/nginx.conf:7
supabase-kong  | nginx: [warn] the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /usr/local/kong/nginx.conf:7
supabase-kong  | 2026/05/20 20:07:08 [error] 1#0: init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | nginx: [error] init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 4. CORS preflight test
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> curl.exe -sS -D - -o NUL -X OPTIONS "https://supabase.sbbl-hq.icu/auth/v1/token?grant_type=password" `
>>   -H "Origin: https://sbbl-hq.icu" `
>>   -H "Access-Control-Request-Method: POST" `
>>   -H "Access-Control-Request-Headers: accept,accept-profile,apikey,authorization,content-type,x-client-info,x-supabase-api-version"
HTTP/1.1 502 Bad Gateway
Date: Wed, 20 May 2026 20:07:11 GMT
Content-Type: text/plain; charset=UTF-8
Content-Length: 15
Connection: keep-alive
Cache-Control: private, max-age=0, no-store, no-cache, must-revalidate, post-check=0, pre-check=0
Expires: Thu, 01 Jan 1970 00:00:01 GMT
Referrer-Policy: same-origin
X-Frame-Options: SAMEORIGIN
Server: cloudflare
CF-RAY: 9fedf7574ee92384-YVR
alt-svc: h3=":443"; ma=86400

PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Set-Location "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose ps
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:43-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:44-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
NAME                IMAGE                                    COMMAND                  SERVICE    CREATED          STATUS                          PORTS
supabase-db         supabase/postgres:15.8.1.085             "docker-entrypoint.s…"   db         8 hours ago      Restarting (1) 13 seconds ago
supabase-imgproxy   darthsim/imgproxy:v3.30.1                "entrypoint.sh imgpr…"   imgproxy   8 hours ago      Up 2 hours (healthy)            8080/tcp
supabase-kong       kong/kong:3.9.1                          "/home/kong/kong-ent…"   kong       59 seconds ago   Restarting (1) 1 second ago
supabase-studio     supabase/studio:2026.04.27-sha-5f60601   "docker-entrypoint.s…"   studio     8 hours ago      Up 2 hours (healthy)            3000/tcp
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose logs --tail=30 studio
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:45-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
supabase-studio  | ▲ Next.js 16.2.3
supabase-studio  | - Local:         http://localhost:3000
supabase-studio  | - Network:       http://0.0.0.0:3000
supabase-studio  | ✓ Ready in 0ms
supabase-studio  | ▲ Next.js 16.2.3
supabase-studio  | - Local:         http://localhost:3000
supabase-studio  | - Network:       http://0.0.0.0:3000
supabase-studio  | ✓ Ready in 0ms

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose logs --tail=30 kong
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POOLER_DB_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POOLER_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POOLER_MAX_CLIENT_CONN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"VAULT_ENC_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POOLER_DEFAULT_POOL_SIZE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POOLER_PROXY_PORT_TRANSACTION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"STUDIO_DEFAULT_ORGANIZATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"LOGFLARE_PUBLIC_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"STUDIO_DEFAULT_PROJECT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"LOGFLARE_PRIVATE_ACCESS_TOKEN\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"PG_META_CRYPTO_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"DASHBOARD_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"DASHBOARD_USERNAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"KONG_HTTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"KONG_HTTPS_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"MAILER_URLPATHS_EMAIL_CHANGE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SITE_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"DISABLE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ENABLE_ANONYMOUS_USERS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SMTP_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"MAILER_URLPATHS_INVITE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"MAILER_URLPATHS_CONFIRMATION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"MAILER_URLPATHS_RECOVERY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ENABLE_EMAIL_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SMTP_USER\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SMTP_PASS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ENABLE_PHONE_SIGNUP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ENABLE_PHONE_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"API_EXTERNAL_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ADDITIONAL_REDIRECT_URLS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ENABLE_EMAIL_AUTOCONFIRM\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SMTP_ADMIN_EMAIL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SMTP_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SMTP_SENDER_NAME\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SECRET_KEY_BASE\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"REGION\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"GLOBAL_S3_BUCKET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"STORAGE_TENANT_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_ID\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"S3_PROTOCOL_ACCESS_KEY_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"IMGPROXY_AUTO_WEBP\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SUPABASE_PUBLIC_URL\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"ANON_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"SERVICE_ROLE_KEY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"FUNCTIONS_VERIFY_JWT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"PGRST_DB_SCHEMAS\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_EXPIRY\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"JWT_SECRET\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PASSWORD\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_HOST\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_PORT\" variable is not set. Defaulting to a blank string."
time="2026-05-20T14:07:46-06:00" level=warning msg="The \"POSTGRES_DB\" variable is not set. Defaulting to a blank string."
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | nginx: [error] init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | 2026/05/20 20:07:40 [warn] 1#0: the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /usr/local/kong/nginx.conf:7
supabase-kong  | nginx: [warn] the "user" directive makes sense only if the master process runs with super-user privileges, ignored in /usr/local/kong/nginx.conf:7
supabase-kong  | 2026/05/20 20:07:42 [error] 1#0: init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk
supabase-kong  | nginx: [error] init_by_lua error: /usr/local/share/lua/5.1/kong/init.lua:731: error parsing declarative config file /usr/local/kong/kong.yml:
supabase-kong  | in 'basicauth_credentials':
supabase-kong  |   - in entry 1 of 'basicauth_credentials':
supabase-kong  |     in 'password': length must be at least 1
supabase-kong  |     in 'username': length must be at least 1
supabase-kong  | stack traceback:
supabase-kong  |        [C]: in function 'error'
supabase-kong  |        /usr/local/share/lua/5.1/kong/init.lua:731: in function 'init'
supabase-kong  |        init_by_lua(nginx-kong.conf:44):3: in main chunk

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Set-Location "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # Force-recreate Kong using the .env from the parent directory
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose --env-file "..\\.env" up -d --force-recreate kong
[+] up 2/2
 ✔ Container supabase-studio Healthy                                                                               11.4s
 ✔ Container supabase-kong   Started                                                                               10.3s
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Start-Sleep -Seconds 20
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose --env-file "..\\.env" ps kong
NAME            IMAGE             COMMAND                  SERVICE   CREATED          STATUS                    PORTS
supabase-kong   kong/kong:3.9.1   "/home/kong/kong-ent…"   kong      33 seconds ago   Up 23 seconds (healthy)   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp, 0.0.0.0:8443->8443/tcp, [::]:8443->8443/tcp
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose --env-file "..\\.env" logs --tail=30 kong
supabase-kong  | 2026/05/20 20:10:43 [notice] 1414#0: *10 [lua] globalpatches.lua:75: sleep(): executing a blocking 'sleep' (0.008 seconds), context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:10:43 [notice] 1416#0: *11 [lua] globalpatches.lua:75: sleep(): executing a blocking 'sleep' (0.008 seconds), context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:10:43 [notice] 1411#0: *2 [lua] init.lua:266: purge(): [DB cache] purging (local) cache, context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:10:43 [notice] 1411#0: *2 [lua] init.lua:266: purge(): [DB cache] purging (local) cache, context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:10:43 [notice] 1411#0: *2 [kong] init.lua:590 declarative config loaded from /usr/local/kong/kong.yml, context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:10:43 [notice] 1410#0: *8 [lua] globalpatches.lua:75: sleep(): executing a blocking 'sleep' (0.128 seconds), context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:10:44 [notice] 1411#0: *14 [lua] worker.lua:304: communicate(): worker #4 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1412#0: *19 [lua] worker.lua:304: communicate(): worker #5 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1417#0: *23 [lua] worker.lua:304: communicate(): worker #10 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1415#0: *1940 [lua] worker.lua:304: communicate(): worker #8 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1416#0: *1969 [lua] worker.lua:304: communicate(): worker #9 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1414#0: *2998 [lua] worker.lua:304: communicate(): worker #7 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1409#0: *2923 [lua] worker.lua:304: communicate(): worker #2 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1413#0: *4508 [lua] worker.lua:304: communicate(): worker #6 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1408#0: *4572 [lua] worker.lua:304: communicate(): worker #1 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5791 [lua] broker.lua:263: run(): worker #4 connected to events broker (worker pid: 1411), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5792 [lua] broker.lua:263: run(): worker #5 connected to events broker (worker pid: 1412), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5793 [lua] broker.lua:263: run(): worker #10 connected to events broker (worker pid: 1417), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5794 [lua] broker.lua:263: run(): worker #8 connected to events broker (worker pid: 1415), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5795 [lua] broker.lua:263: run(): worker #9 connected to events broker (worker pid: 1416), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5796 [lua] broker.lua:263: run(): worker #2 connected to events broker (worker pid: 1409), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5797 [lua] broker.lua:263: run(): worker #7 connected to events broker (worker pid: 1414), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5798 [lua] broker.lua:263: run(): worker #6 connected to events broker (worker pid: 1413), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5801 [lua] worker.lua:304: communicate(): worker #0 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *5799 [lua] broker.lua:263: run(): worker #1 connected to events broker (worker pid: 1408), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *6732 [lua] broker.lua:263: run(): worker #0 connected to events broker (worker pid: 1407), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1418#0: *5820 [lua] worker.lua:304: communicate(): worker #11 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *6733 [lua] broker.lua:263: run(): worker #11 connected to events broker (worker pid: 1418), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:10:44 [notice] 1410#0: *7087 [lua] worker.lua:304: communicate(): worker #3 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:10:44 [notice] 1407#0: *7090 [lua] broker.lua:263: run(): worker #3 connected to events broker (worker pid: 1410), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # Creates a symlink .env -> ..\sbbl-hq-selfhost\.env in the active Compose root
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> New-Item -ItemType SymbolicLink `
>>   -Path "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost\.env" `
>>   -Target "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\.env"


    Directory: C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost


Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
-a---l        2026-05-20   2:17 PM              0 .env


PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose --env-file "..\\.env" logs --tail=60 db 2>&1 | Select-String -NotMatch "level=warning"

supabase-db  |
supabase-db  |        You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
supabase-db  |        connections without a password. This is *not* recommended.
supabase-db  |
supabase-db  |        See PostgreSQL documentation about "trust":
supabase-db  |        https://www.postgresql.org/docs/current/auth-trust.html
supabase-db  | Error: Database is uninitialized and superuser password is not specified.
supabase-db  |        You must specify POSTGRES_PASSWORD to a non-empty value for the
supabase-db  |        superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
supabase-db  |
supabase-db  |        You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
supabase-db  |        connections without a password. This is *not* recommended.
supabase-db  |
supabase-db  |        See PostgreSQL documentation about "trust":
supabase-db  |        https://www.postgresql.org/docs/current/auth-trust.html
supabase-db  | Error: Database is uninitialized and superuser password is not specified.
supabase-db  |        You must specify POSTGRES_PASSWORD to a non-empty value for the
supabase-db  |        superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
supabase-db  |
supabase-db  |        You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
supabase-db  |        connections without a password. This is *not* recommended.
supabase-db  |
supabase-db  |        See PostgreSQL documentation about "trust":
supabase-db  |        https://www.postgresql.org/docs/current/auth-trust.html
supabase-db  | Error: Database is uninitialized and superuser password is not specified.
supabase-db  |        You must specify POSTGRES_PASSWORD to a non-empty value for the
supabase-db  |        superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
supabase-db  |
supabase-db  |        You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
supabase-db  |        connections without a password. This is *not* recommended.
supabase-db  |
supabase-db  |        See PostgreSQL documentation about "trust":
supabase-db  |        https://www.postgresql.org/docs/current/auth-trust.html
supabase-db  | Error: Database is uninitialized and superuser password is not specified.
supabase-db  |        You must specify POSTGRES_PASSWORD to a non-empty value for the
supabase-db  |        superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
supabase-db  |
supabase-db  |        You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
supabase-db  |        connections without a password. This is *not* recommended.
supabase-db  |
supabase-db  |        See PostgreSQL documentation about "trust":
supabase-db  |        https://www.postgresql.org/docs/current/auth-trust.html
supabase-db  | Error: Database is uninitialized and superuser password is not specified.
supabase-db  |        You must specify POSTGRES_PASSWORD to a non-empty value for the
supabase-db  |        superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
supabase-db  |
supabase-db  |        You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
supabase-db  |        connections without a password. This is *not* recommended.
supabase-db  |
supabase-db  |        See PostgreSQL documentation about "trust":
supabase-db  |        https://www.postgresql.org/docs/current/auth-trust.html
supabase-db  | Error: Database is uninitialized and superuser password is not specified.
supabase-db  |        You must specify POSTGRES_PASSWORD to a non-empty value for the
supabase-db  |        superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
supabase-db  |
supabase-db  |        You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
supabase-db  |        connections without a password. This is *not* recommended.
supabase-db  |
supabase-db  |        See PostgreSQL documentation about "trust":
supabase-db  |        https://www.postgresql.org/docs/current/auth-trust.html


PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> cd C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # Recreate db with env vars — does NOT wipe the pgdata volume
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose --env-file "..\\.env" up -d --force-recreate db
[+] up 1/1
 ✔ Container supabase-db Started                                                                                   52.0s
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # Wait for Postgres to initialize
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Start-Sleep -Seconds 30
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # Check db health
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose --env-file "..\\.env" ps db
NAME          IMAGE                          COMMAND                  SERVICE   CREATED              STATUS                             PORTS
supabase-db   supabase/postgres:15.8.1.085   "docker-entrypoint.s…"   db        About a minute ago   Up 59 seconds (health: starting)   5432/tcp
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 1. Switch to active compose root
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> cd "C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost"
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 2. Get Git metadata
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Write-Host "=== Git Metadata ==="
=== Git Metadata ===
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> git rev-parse HEAD
27194221924e0ef74aceaf18859c724e5126188b
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> git status -sb
## main...origin/main
 D ../../.claude/skills/omnidev-v2/SKILL.md
 D ../../.claude/skills/sbbl-agent/SKILL.md
?? ../../.claude/settings.local.json
?? ../../.claude/skills/omnidev-apex/
?? ../../.claude/skills/sbbl-agent-v2.0-universal/
?? docker-compose.yml.bak-defcon-20260519-213122
?? ../volumes/db/data/
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 3. Force-recreate the DB and Kong containers
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Write-Host "`n=== Recreating Containers ==="

=== Recreating Containers ===
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose up -d --force-recreate db kong
[+] up 3/3
 ✔ Container supabase-studio Healthy                                                                                9.5s
 ✔ Container supabase-db     Started                                                                               10.8s
 ✔ Container supabase-kong   Started                                                                               11.8s

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 4. Wait for migrations and services to stand up
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Write-Host "`n=== Waiting for Health Check (25 seconds) ==="

=== Waiting for Health Check (25 seconds) ===
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Start-Sleep -Seconds 25
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 5. Check container statuses
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Write-Host "`n=== Container Statuses ==="

=== Container Statuses ===
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose ps
NAME                IMAGE                                    COMMAND                  SERVICE    CREATED          STATUS                    PORTS
supabase-db         supabase/postgres:15.8.1.085             "docker-entrypoint.s…"   db         40 seconds ago   Up 36 seconds (healthy)   5432/tcp
supabase-imgproxy   darthsim/imgproxy:v3.30.1                "entrypoint.sh imgpr…"   imgproxy   9 hours ago      Up 2 hours (healthy)      8080/tcp
supabase-kong       kong/kong:3.9.1                          "/home/kong/kong-ent…"   kong       45 seconds ago   Up 35 seconds (healthy)   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp, 0.0.0.0:8443->8443/tcp, [::]:8443->8443/tcp
supabase-studio     supabase/studio:2026.04.27-sha-5f60601   "docker-entrypoint.s…"   studio     19 minutes ago   Up 19 minutes (healthy)   3000/tcp
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 6. Check docker compose logs for errors (last 30 lines of each)
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Write-Host "`n=== Container Logs (db) ==="

=== Container Logs (db) ===
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose logs --tail=30 db
supabase-db  |
supabase-db  | PostgreSQL Database directory appears to contain a database; Skipping initialization
supabase-db  |
supabase-db  | ::1 2026-05-20 20:29:38.828 UTC [48] postgres@postgres FATAL:  the database system is starting up
supabase-db  | ::1 2026-05-20 20:29:44.047 UTC [55] postgres@postgres FATAL:  the database system is starting up
supabase-db  | ::1 2026-05-20 20:29:49.338 UTC [63] postgres@postgres FATAL:  the database system is starting up

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Write-Host "`n=== Container Logs (kong) ==="

=== Container Logs (kong) ===
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> docker compose logs --tail=30 kong
supabase-kong  | 2026/05/20 20:29:39 [notice] 1431#0: *10 [lua] globalpatches.lua:75: sleep(): executing a blocking 'sleep' (0.004 seconds), context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:29:39 [notice] 1431#0: *10 [lua] globalpatches.lua:75: sleep(): executing a blocking 'sleep' (0.008 seconds), context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:29:39 [notice] 1431#0: *10 [lua] globalpatches.lua:75: sleep(): executing a blocking 'sleep' (0.016 seconds), context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:29:39 [notice] 1426#0: *3 [lua] init.lua:266: purge(): [DB cache] purging (local) cache, context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:29:39 [notice] 1426#0: *3 [lua] init.lua:266: purge(): [DB cache] purging (local) cache, context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:29:39 [notice] 1426#0: *3 [kong] init.lua:590 declarative config loaded from /usr/local/kong/kong.yml, context: init_worker_by_lua*
supabase-kong  | 2026/05/20 20:29:41 [notice] 1426#0: *14 [lua] worker.lua:304: communicate(): worker #4 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1424#0: *656 [lua] worker.lua:304: communicate(): worker #2 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1431#0: *1257 [lua] worker.lua:304: communicate(): worker #9 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1429#0: *1404 [lua] worker.lua:304: communicate(): worker #7 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1428#0: *1532 [lua] worker.lua:304: communicate(): worker #6 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1432#0: *1866 [lua] worker.lua:304: communicate(): worker #10 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1423#0: *2693 [lua] worker.lua:304: communicate(): worker #1 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3638 [lua] broker.lua:263: run(): worker #4 connected to events broker (worker pid: 1426), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3639 [lua] broker.lua:263: run(): worker #2 connected to events broker (worker pid: 1424), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3640 [lua] broker.lua:263: run(): worker #9 connected to events broker (worker pid: 1431), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3641 [lua] broker.lua:263: run(): worker #7 connected to events broker (worker pid: 1429), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3642 [lua] broker.lua:263: run(): worker #6 connected to events broker (worker pid: 1428), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3643 [lua] broker.lua:263: run(): worker #10 connected to events broker (worker pid: 1432), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3644 [lua] broker.lua:263: run(): worker #1 connected to events broker (worker pid: 1423), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *3646 [lua] worker.lua:304: communicate(): worker #0 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *5161 [lua] broker.lua:263: run(): worker #0 connected to events broker (worker pid: 1422), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1425#0: *5010 [lua] worker.lua:304: communicate(): worker #3 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *5162 [lua] broker.lua:263: run(): worker #3 connected to events broker (worker pid: 1425), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1433#0: *5801 [lua] worker.lua:304: communicate(): worker #11 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *5803 [lua] broker.lua:263: run(): worker #11 connected to events broker (worker pid: 1433), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1430#0: *6444 [lua] worker.lua:304: communicate(): worker #8 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *6446 [lua] broker.lua:263: run(): worker #8 connected to events broker (worker pid: 1430), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"
supabase-kong  | 2026/05/20 20:29:41 [notice] 1427#0: *7020 [lua] worker.lua:304: communicate(): worker #5 is ready to accept events from unix:/usr/local/kong/sockets/we, context: ngx.timer
supabase-kong  | 2026/05/20 20:29:41 [notice] 1422#0: *7022 [lua] broker.lua:263: run(): worker #5 connected to events broker (worker pid: 1427), client: unix:, server: kong_worker_events, request: "GET / HTTP/1.1", host: "localhost"

What's next:
    Filter, search, and stream logs from all your Compose services
    in one place with Docker Desktop's Logs view. docker-desktop://dashboard/logs
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> # 7. Perform CORS Preflight Verification
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> Write-Host "`n=== CORS Preflight Check ==="

=== CORS Preflight Check ===
PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost> curl.exe -sS -D - -o NUL -X OPTIONS "https://supabase.sbbl-hq.icu/auth/v1/token?grant_type=password" `
>>   -H "Origin: https://sbbl-hq.icu" `
>>   -H "Access-Control-Request-Method: POST" `
>>   -H "Access-Control-Request-Headers: accept,accept-profile,apikey,authorization,content-type,x-client-info,x-supabase-api-version"
HTTP/1.1 200 OK
Date: Wed, 20 May 2026 20:30:13 GMT
Content-Length: 0
Connection: keep-alive
access-control-allow-credentials: true
access-control-allow-headers: Accept,Accept-Profile,Accept-Version,Authorization,Cache-Control,Content-Length,Content-MD5,Content-Profile,Content-Type,Date,If-Match,If-Modified-Since,If-None-Match,Prefer,Range,X-Requested-With,apikey,x-client-info,x-supabase-api-version,x-upsert
access-control-allow-methods: GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS
access-control-allow-origin: https://sbbl-hq.icu
access-control-max-age: 3600
Server: cloudflare
vary: Origin
x-kong-request-id: 39a8ee0e5d5664677429787081bc9605
x-kong-response-latency: 31
cf-cache-status: DYNAMIC
Nel: {"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}
Report-To: {"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=w6uMD2bLJPa1REOTZ1TcHcqs88j%2FvmfHZmgCN9m%2BUrRk2Sf9KBqM6TuvfVFoX3n6nuiMe8jlxrlCdKoEjkc0JfiEkLn2rsWLf5NamXyRBnVCAaWQUTttZizHzBEMoDOCMpTQ2Mic7w%3D%3D"}]}
CF-RAY: 9fee1911c8255be7-YVR
alt-svc: h3=":443"; ma=86400

PS C:\Users\sinyo\sbbl-hq\sbbl-hq\sbbl-hq-selfhost\sbbl-hq-selfhost>