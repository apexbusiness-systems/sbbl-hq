# Super-Admin Ops Console Data Upload Pipeline Flowchart

This document maps out the end-to-end data pipeline originating from the Super-Admin Ops Console.

## 1. Ingestion Points (The "Where" & "Who")
* **Who:** Super Admins (Authentication verified via JWT edge protection and `jose` library using Supabase JWKS).
* **Where:** React Frontend (`src/pages/Ops.tsx`) via specific interactive tabs:
  * **Teams, Players, Schedules, Events, Scores:** Bulk uploaded via CSV files or manually entered via forms.
  * **Scoreboard Parser:** Uploading a scoreboard image (PNG/JPG).
  * **POTG (Player of the Game) Parser:** Uploading a POTG graphic (PNG/JPG).
  * **Store Media:** Uploading product images.

## 2. Processing and Parsing (The "How" & "What")
* **CSV Parsing (`src/lib/parseCsv.ts`):** Client-side parsing reads headers and structures data into objects. Required columns are extracted, validated against the target `leagueId`, and formatted for submission.
* **Image Resizing (`src/lib/imageResize.ts`):**
  * Media files (POTG and Store uploads) are auto-resized using HTML5 Canvas (`resizeImageToFit`).
  * The logic intelligently fits images inside boundaries utilizing `contain` semantics. This resizes all media to fit container cards perfectly *without cropping* text, numbers, or key details, while maintaining exact aspect ratios with padding.
* **AI Image Parsing (OCR & Vision):**
  * `parseScoreboardImage` (`/ops/scores/parse-image`): Sends base64-encoded images to a Claude/Groq vision API which intelligently extracts `homeLabel`, `awayLabel`, `homeScore`, `awayScore`, `gameDate`, `eventName`, and `status`.
  * `parsePotgImage` (`/ops/potg/parse`): Extracts player name, team, points (PTS), rebounds (REB), assists (AST), and game results from a graphic before surfacing them to the Admin for final verification.
* **Idempotency (`src/lib/api/idempotency.ts`):** All mutate requests utilize an `Idempotency-Key` header to safely handle retries and prevent duplicated records/actions.

## 3. Server-Side Routing & Validation
* **API Entry:** Cloudflare Worker edge router (`src/worker/index.ts`).
* **Route Matching:** API requests targeted to `/ops/*` are intercepted.
* **Authorization Check (`handleAccessLookup`/`handleOpsBootstrap`):** Verifies the JWT and strictly checks for the `super_admin` role in `roles`.
* **Handlers:**
  * Imports: `handleImportTeams`, `handleImportPlayers`, `handleImportSchedules`, `handleImportEvents` (defined or mapped via generic loops in the worker).
  * POTG: `handleParsePotgImage`, `handleSubmitPotg`.
  * Scores: `handleScoreGameUpsert`, `handleScoresCsvImport`, `handleScoreboardImageParse`.
  * Store: `handleStoreMedia`.
  * Manual: `handleManualOpsAction` handles granular CRUD mutations.

## 4. Database Interaction (Supabase)
* **Execution:** Once validated, the Worker maps payloads to `admin` Supabase client (`security definer` effectively, via service role key context inside the protected worker).
* **RPC & Bulk Operations:** Batch updates are transacted. If a batch fails, it falls back to row-by-row mapping to isolate constraint violations and save partial successes.
* **Logging:**
  * Import metrics (`total_rows`, `inserted_rows`, `failed_rows`) are recorded into an `import_history` log accessible in the "Import History" tab.
  * Changes are logged to the `audit_logs` table (e.g., `ops_import_teams`, `ops_potg_submit`).

## 5. Distribution and Rendering
* **Storage Distribution:** Uploaded resized images are uploaded to Supabase Storage (`media` bucket), organized via paths like `potg/{leagueId}/{uuid}.jpg` or `store/{uuid}.jpg`.
* **State Invalidation (React Query):** On successful mutation, `queryClient.invalidateQueries` triggers immediate refetching of contextual active data (`ops-bootstrap`, `ops-import-history`, `scores`).
* **Public Rendering:**
  * Display components (like `PotgCard`, `StoreCard`, and generic `Score` grids) pull live, cached data from Supabase / Tanstack React Query.
  * Image cards use CSS matching `object-fit: contain` rendering (or padding matching) the exact resized dimensions, ensuring no data loss.
