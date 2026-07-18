import { z } from 'zod';
import { parseCsv } from '@/lib/parseCsv';
import { classifyRiskLane } from '@/lib/omniport';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  json,
  requireSuperAdminSession,
  requireAdminSession,
  ensureMutation,
  writeImportJob,
  writeIngressFailure,
  type HandlerCtx
} from '../index';

const teamRowSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  league_id: z.string().min(1, "League ID/Code is required"),
  season_id: z.string().uuid("Season ID must be a valid UUID").optional().nullable(),
  division_id: z.string().optional().nullable(),
  wins: z.string().regex(/^\d+$/, "Wins must be a non-negative integer").optional().nullable(),
  losses: z.string().regex(/^\d+$/, "Losses must be a non-negative integer").optional().nullable(),
  pts_for: z.string().regex(/^\d+$/, "Points for must be a non-negative integer").optional().nullable(),
  pts_against: z.string().regex(/^\d+$/, "Points against must be a non-negative integer").optional().nullable(),
});

const playerRowSchema = z.object({
  user_id: z.string().uuid("User ID must be a valid UUID"),
  team_id: z.string().uuid("Team ID must be a valid UUID").optional().nullable(),
  league_id: z.string().uuid("League ID must be a valid UUID").optional().nullable(),
  jersey_number: z.string().regex(/^\d+$/, "Jersey number must be a non-negative integer").optional().nullable(),
  position: z.string().optional().nullable(),
});

const scheduleRowSchema = z.object({
  league_id: z.string().uuid("League ID must be a valid UUID"),
  season_id: z.string().uuid("Season ID must be a valid UUID"),
  starts_at: z.string().refine(val => !isNaN(Date.parse(val)), "Starts at must be a valid ISO date"),
  ends_at: z.string().refine(val => !isNaN(Date.parse(val)), "Ends at must be a valid ISO date").optional().nullable(),
  venue_id: z.string().uuid("Venue ID must be a valid UUID").optional().nullable(),
  court_id: z.string().uuid("Court ID must be a valid UUID").optional().nullable(),
  status: z.string().optional().nullable(),
});

const eventRowSchema = z.object({
  title: z.string().min(1, "Title is required"),
  league_id: z.string().uuid("League ID must be a valid UUID").optional().nullable(),
  season_id: z.string().uuid("Season ID must be a valid UUID").optional().nullable(),
  venue_id: z.string().uuid("Venue ID must be a valid UUID").optional().nullable(),
  starts_at: z.string().refine(val => !isNaN(Date.parse(val)), "Starts at must be a valid ISO date").optional().nullable(),
});

const scoreRowSchema = z.object({
  home_label: z.string().min(1, "Home label is required"),
  away_label: z.string().min(1, "Away label is required"),
  home_score: z.string().regex(/^\d+$/, "Home score must be a non-negative integer").optional().nullable(),
  away_score: z.string().regex(/^\d+$/, "Away score must be a non-negative integer").optional().nullable(),
  category: z.string().optional().nullable(),
  league_id: z.string().min(1, "League ID/Code is required").optional().nullable(),
  season_id: z.string().uuid("Season ID must be a valid UUID").optional().nullable(),
  status: z.string().optional().nullable(),
  game_date: z.string().optional().nullable(),
  event_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function handleScoresCsvUpload(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireSuperAdminSession(ctx.req, ctx.admin);

  const body = (await ctx.req.json().catch(() => null)) as {
    kind: "teams" | "players" | "schedules" | "events" | "scores";
    csvText?: string;
    rows?: Array<Record<string, string>>;
    format?: string;
  } | null;

  if (!body) return json({ ok: false, error: "body_required" }, 400);
  const { kind, csvText, format } = body;
  let rows = body.rows ?? [];

  if (!kind) return json({ ok: false, error: "kind_required" }, 400);

  if (csvText) {
    rows = parseCsv(csvText);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ ok: false, error: "rows_required" }, 400);
  }

  const isV1 = format === "v1" || rows.some(r => r.schema_version === "v1" || r.format === "v1");
  if (!isV1) {
    return json({ ok: false, error: "unsupported_schema_version" }, 400);
  }

  const riskLane = classifyRiskLane(`csv_upload.${kind}`, { rows });
  if (riskLane === "BLOCKED") {
    await writeIngressFailure(ctx.admin, `${kind}_upload_blocked_sql_injection`, rows, "upload", session.userId);
    return json({ ok: false, error: "blocked_class_payload" }, 403);
  }

  const validationErrors: Array<{ row: number; field?: string; code: string; message: string }> = [];
  const validatedRows: Array<Record<string, string>> = [];

  const rowSchemaMap = {
    teams: teamRowSchema,
    players: playerRowSchema,
    schedules: scheduleRowSchema,
    events: eventRowSchema,
    scores: scoreRowSchema,
  };

  const schema = rowSchemaMap[kind];
  if (!schema) return json({ ok: false, error: "invalid_kind" }, 400);

  rows.forEach((row, index) => {
    if (row.schema_version || row.format) return;
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      parsed.error.errors.forEach(err => {
        validationErrors.push({
          row: index + 1,
          field: String(err.path[0] ?? ""),
          code: err.code,
          message: err.message,
        });
      });
    } else {
      validatedRows.push(parsed.data);
    }
  });

  if (validationErrors.length > 0) {
    return json({ ok: false, errors: validationErrors }, 422);
  }

  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];

  if (kind === "scores") {
    const leagueMap = new Map<string, string>();
    const uniqueCodes = Array.from(new Set(validatedRows.map((r) => r.league_id).filter(Boolean) as string[]));
    if (uniqueCodes.length > 0) {
      const { data: leagues } = await ctx.admin.from("leagues").select("id, code").in("code", uniqueCodes);
      leagues?.forEach((l) => {
        if (l.code) leagueMap.set(l.code.toLowerCase(), l.id);
      });
    }

    try {
      const payload = validatedRows.map((row) => {
        const leagueUuid = row.league_id ? leagueMap.get(row.league_id.toLowerCase()) || null : null;
        return {
          category: row.category || "league",
          league_id: leagueUuid,
          participant1_label: row.home_label || null,
          participant2_label: row.away_label || null,
          home_score: row.home_score != null ? Number(row.home_score) : null,
          away_score: row.away_score != null ? Number(row.away_score) : null,
          status: row.status || "final",
          game_date: row.game_date || null,
          event_name: row.event_name || null,
          notes: row.notes || null,
        };
      });

      const { error } = await ctx.admin.from("games").insert(payload);
      if (error) throw error;
      inserted = validatedRows.length;
    } catch (bulkErr) {
      for (const row of validatedRows) {
        try {
          const leagueUuid = row.league_id ? leagueMap.get(row.league_id.toLowerCase()) || null : null;
          const { error } = await ctx.admin.from("games").insert({
            category: row.category || "league",
            league_id: leagueUuid,
            participant1_label: row.home_label || null,
            participant2_label: row.away_label || null,
            home_score: row.home_score != null ? Number(row.home_score) : null,
            away_score: row.away_score != null ? Number(row.away_score) : null,
            status: row.status || "final",
            game_date: row.game_date || null,
            event_name: row.event_name || null,
            notes: row.notes || null,
          });
          if (error) {
            failed++;
            errors.push(`${row.home_label || "Unknown"} vs ${row.away_label || "Unknown"}: ${error.message}`);
          } else {
            inserted++;
          }
        } catch (e) {
          failed++;
          errors.push(e instanceof Error ? e.message : "unknown");
        }
      }
    }
  } else {
    const leagueMap = new Map<string, string>();
    const uniqueCodes = Array.from(new Set(validatedRows.map((r) => r.league_id).filter(Boolean) as string[]));
    if (uniqueCodes.length > 0) {
      const { data: leagues } = await ctx.admin.from("leagues").select("id, code").in("code", uniqueCodes);
      leagues?.forEach((l) => {
        if (l.code) leagueMap.set(l.code.toLowerCase(), l.id);
      });
    }

    try {
      if (kind === "teams") {
        const payload = validatedRows.map((row) => ({
          league_id: leagueMap.get(row.league_id.toLowerCase()) || row.league_id,
          season_id: row.season_id || null,
          division_id: row.division_id || null,
          name: row.name,
          status: "published",
          record: row.wins != null ? {
            wins: Number(row.wins),
            losses: Number(row.losses ?? 0),
            ptsFor: Number(row.pts_for ?? 0),
            ptsAgainst: Number(row.pts_against ?? 0),
          } : undefined,
        }));
        const { error } = await ctx.admin.from("teams").upsert(payload, { onConflict: "season_id,name" });
        if (error) throw error;
        inserted = validatedRows.length;
      } else if (kind === "players") {
        const payload = validatedRows.map((row) => ({
          user_id: row.user_id,
          team_id: row.team_id || null,
          league_id: row.league_id || null,
          jersey_number: row.jersey_number ? Number(row.jersey_number) : null,
          position: row.position || null,
        }));
        const { error } = await ctx.admin.from("players").upsert(payload, { onConflict: "user_id" });
        if (error) throw error;
        inserted = validatedRows.length;
      } else if (kind === "schedules") {
        const payload = validatedRows.map((row) => ({
          league_id: row.league_id,
          season_id: row.season_id,
          venue_id: row.venue_id || null,
          court_id: row.court_id || null,
          starts_at: row.starts_at,
          ends_at: row.ends_at || null,
          status: row.status || "upcoming",
        }));
        const { error } = await ctx.admin.from("schedule_slots").insert(payload);
        if (error) throw error;
        inserted = validatedRows.length;
      } else if (kind === "events") {
        const payload = validatedRows.map((row) => ({
          league_id: row.league_id || null,
          season_id: row.season_id || null,
          venue_id: row.venue_id || null,
          title: row.title,
          starts_at: row.starts_at || null,
          metadata: row,
        }));
        const { error } = await ctx.admin.from("league_events").insert(payload);
        if (error) throw error;
        inserted = validatedRows.length;
      }
    } catch (bulkErr) {
      for (const row of validatedRows) {
        try {
          if (kind === "teams") {
            const { error } = await ctx.admin.from("teams").insert({
              league_id: leagueMap.get(row.league_id.toLowerCase()) || row.league_id,
              season_id: row.season_id || null,
              division_id: row.division_id || null,
              name: row.name,
              status: "published",
            });
            if (error && !String(error.message).includes("duplicate key")) throw error;
          } else if (kind === "players") {
            const { error } = await ctx.admin.from("players").upsert({
              user_id: row.user_id,
              team_id: row.team_id || null,
              league_id: row.league_id || null,
              jersey_number: row.jersey_number ? Number(row.jersey_number) : null,
              position: row.position || null,
            }, { onConflict: "user_id" });
            if (error) throw error;
          } else if (kind === "schedules") {
            const { error } = await ctx.admin.from("schedule_slots").insert({
              league_id: row.league_id,
              season_id: row.season_id,
              venue_id: row.venue_id || null,
              court_id: row.court_id || null,
              starts_at: row.starts_at,
              ends_at: row.ends_at || null,
              status: row.status || "upcoming",
            });
            if (error) throw error;
          } else if (kind === "events") {
            const { error } = await ctx.admin.from("league_events").insert({
              league_id: row.league_id || null,
              season_id: row.season_id || null,
              venue_id: row.venue_id || null,
              title: row.title,
              starts_at: row.starts_at || null,
              metadata: row,
            });
            if (error) throw error;
          }
          inserted++;
        } catch (e) {
          failed++;
          errors.push(e instanceof Error ? e.message : "unknown");
        }
      }
    }
  }

  const idempotencyKey = ctx.req.headers.get("x-idempotency-key") ?? crypto.randomUUID();
  await writeImportJob(ctx.admin, {
    job_type: kind,
    submitted_by: session.userId,
    total_rows: rows.length,
    inserted_rows: inserted,
    failed_rows: failed,
    payload_summary: { sample: rows[0] ?? null },
    error_summary: errors.slice(0, 5).join("; ") || null,
  });

  await ctx.admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: `csv_upload_${kind}`,
    ref_type: kind,
    ref_id: crypto.randomUUID(),
    payload: { count: rows.length, inserted, failed },
    idempotency_key: idempotencyKey,
  });

  return json({ ok: true, inserted, failed, errors });
}

export async function handleImportRoute(
  ctx: HandlerCtx,
  kind: "teams" | "players" | "schedules" | "events",
) {
  await ensureMutation(ctx.req, ctx);
  const session = await requireAdminSession(ctx.req, ctx.admin);
  const body = (await ctx.req.json().catch(() => null)) as {
    rows?: Array<Record<string, string>>;
  } | null;
  const rawRows = body?.rows ?? [];
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return json({ ok: false, error: "rows_required" }, 400);
  }

  const rows = rawRows.map((r): Record<string, string> => ({
    ...r,
    league_id: r.league_id ?? r.leagueId,
    season_id: r.season_id ?? r.seasonId,
    division_id: r.division_id ?? r.divisionId ?? r.division,
    user_id: r.user_id ?? r.userId,
    team_id: r.team_id ?? r.teamId,
    jersey_number: r.jersey_number ?? r.jerseyNumber,
    starts_at: r.starts_at ?? r.startsAt,
    ends_at: r.ends_at ?? r.endsAt,
    venue_id: r.venue_id ?? r.venueId,
    court_id: r.court_id ?? r.courtId,
  }));

  let insertedRows = 0;
  let failedRows = 0;
  const errors: string[] = [];

  let bulkSuccess = false;

  try {
    if (kind === "teams") {
      const payload = rows.map((row) => ({
        league_id: row.league_id,
        season_id: row.season_id,
        division_id: row.division_id || null,
        name: row.name,
        status: row.status || "published",
        record: row.wins != null ? {
          wins: Number(row.wins),
          losses: Number(row.losses ?? 0),
          ptsFor: Number(row.pts_for ?? 0),
          ptsAgainst: Number(row.pts_against ?? 0),
        } : undefined,
      }));
      const { error } = await ctx.admin
        .from("teams")
        .upsert(payload, { onConflict: "season_id,name" });
      if (error) throw error;
    } else if (kind === "players") {
      const payload = rows.map((row) => ({
        user_id: row.user_id,
        team_id: row.team_id || null,
        league_id: row.league_id || null,
        jersey_number: row.jersey_number ? Number(row.jersey_number) : null,
        position: row.position || null,
      }));
      const { error } = await ctx.admin
        .from("players")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    } else if (kind === "schedules") {
      const payload = rows.map((row) => ({
        league_id: row.league_id,
        season_id: row.season_id,
        venue_id: row.venue_id || null,
        court_id: row.court_id || null,
        starts_at: row.starts_at,
        ends_at: row.ends_at || null,
        status: row.status || "upcoming",
      }));
      const { error } = await ctx.admin.from("schedule_slots").insert(payload);
      if (error) throw error;
    } else if (kind === "events") {
      const payload = rows.map((row) => ({
        league_id: row.league_id || null,
        season_id: row.season_id || null,
        venue_id: row.venue_id || null,
        title: row.title,
        starts_at: row.starts_at || null,
        metadata: row,
      }));
      const { error } = await ctx.admin.from("league_events").insert(payload);
      if (error) throw error;
    }

    bulkSuccess = true;
  } catch (bulkError) {
    // Fallback
  }

  if (bulkSuccess) {
    insertedRows = rows.length;
    await Promise.allSettled(
      rows.map((row) =>
        ctx.admin.rpc("enqueue_local_domain_event", {
          p_event_type: `${kind}_imported`,
          p_entity_type: kind,
          p_entity_id: null,
          p_league_id: row.league_id || null,
          p_payload: row,
          p_trace_id: crypto.randomUUID(),
          p_available_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) {
            console.warn(`[import] enqueue_local_domain_event warning (${kind}):`, error.message);
          }
        }),
      ),
    );
  } else {
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      try {
        if (kind === "teams") {
          const payload = batch.map((row) => ({
            league_id: row.league_id,
            season_id: row.season_id,
            division_id: row.division_id || null,
            name: row.name,
            status: "published",
          }));
          const { error } = await ctx.admin.from("teams").upsert(payload, {
            onConflict: "season_id,name",
          });
          if (error) throw error;
        } else if (kind === "players") {
          const payload = batch.map((row) => ({
            user_id: row.user_id,
            team_id: row.team_id || null,
            league_id: row.league_id || null,
            jersey_number: row.jersey_number ? Number(row.jersey_number) : null,
            position: row.position || null,
          }));
          const { error } = await ctx.admin
            .from("players")
            .upsert(payload, { onConflict: "user_id" });
          if (error) throw error;
        } else if (kind === "schedules") {
          const payload = batch.map((row) => ({
            league_id: row.league_id,
            season_id: row.season_id,
            venue_id: row.venue_id || null,
            court_id: row.court_id || null,
            starts_at: row.starts_at,
            ends_at: row.ends_at || null,
            status: row.status || "upcoming",
          }));
          const { error } = await ctx.admin
            .from("schedule_slots")
            .insert(payload);
          if (error) throw error;
        } else if (kind === "events") {
          const payload = batch.map((row) => ({
            league_id: row.league_id || null,
            season_id: row.season_id || null,
            venue_id: row.venue_id || null,
            title: row.title,
            starts_at: row.starts_at || null,
            metadata: row,
          }));
          const { error } = await ctx.admin
            .from("league_events")
            .insert(payload);
          if (error) throw error;
        }

        await Promise.all(
          batch.map((row) =>
            ctx.admin.rpc("enqueue_local_domain_event", {
              p_event_type: `${kind}_imported`,
              p_entity_type: kind,
              p_entity_id: null,
              p_league_id: row.league_id || null,
              p_payload: row,
              p_trace_id: crypto.randomUUID(),
              p_available_at: new Date().toISOString(),
            }),
          ),
        );
        insertedRows += batch.length;
      } catch (batchError) {
        for (const row of batch) {
          try {
            if (kind === "teams") {
              const { error } = await ctx.admin.from("teams").insert({
                league_id: row.league_id,
                season_id: row.season_id,
                division_id: row.division_id || null,
                name: row.name,
                status: "published",
              });
              if (error && !String(error.message).includes("duplicate key"))
                throw error;
            } else if (kind === "players") {
              const { error } = await ctx.admin.from("players").upsert(
                {
                  user_id: row.user_id,
                  team_id: row.team_id || null,
                  league_id: row.league_id || null,
                  jersey_number: row.jersey_number
                    ? Number(row.jersey_number)
                    : null,
                  position: row.position || null,
                },
                { onConflict: "user_id" },
              );
              if (error) throw error;
            } else if (kind === "schedules") {
              const { error } = await ctx.admin.from("schedule_slots").insert({
                league_id: row.league_id,
                season_id: row.season_id,
                venue_id: row.venue_id || null,
                court_id: row.court_id || null,
                starts_at: row.starts_at,
                ends_at: row.ends_at || null,
                status: row.status || "upcoming",
              });
              if (error) throw error;
            } else if (kind === "events") {
              const { error } = await ctx.admin.from("league_events").insert({
                league_id: row.league_id || null,
                season_id: row.season_id || null,
                venue_id: row.venue_id || null,
                title: row.title,
                starts_at: row.starts_at || null,
                metadata: row,
              });
              if (error) throw error;
            }

            await ctx.admin.rpc("enqueue_local_domain_event", {
              p_event_type: `${kind}_imported`,
              p_entity_type: kind,
              p_entity_id: null,
              p_league_id: row.league_id || null,
              p_payload: row,
              p_trace_id: crypto.randomUUID(),
              p_available_at: new Date().toISOString(),
            });
            insertedRows += 1;
          } catch (error) {
            failedRows += 1;
            errors.push(
              error instanceof Error ? error.message : "import_failed",
            );
            await writeIngressFailure(
              ctx.admin,
              `${kind}_import_failed`,
              row,
              "admin_mutation",
              session.userId,
            );
          }
        }
      }
    }
  }

  const job = await writeImportJob(ctx.admin, {
    job_type: kind,
    submitted_by: session.userId,
    total_rows: rows.length,
    inserted_rows: insertedRows,
    failed_rows: failedRows,
    payload_summary: { sample: rows[0] ?? null },
    error_summary: errors.slice(0, 5).join("; ") || null,
  });

  const idempotencyKey = ctx.req.headers.get("x-idempotency-key") ?? crypto.randomUUID();
  await ctx.admin.from("audit_logs").insert({
    actor_id: session.userId,
    action: `import_${kind}`,
    ref_type: "import_jobs",
    ref_id: job.id,
    payload: { total_rows: rows.length, inserted_rows: insertedRows, failed_rows: failedRows },
    idempotency_key: idempotencyKey,
  });

  return json({ ok: true, summary: job });
}

export async function handleScoresCsvImport(ctx: HandlerCtx) {
  await ensureMutation(ctx.req, ctx);
  await requireSuperAdminSession(ctx.req, ctx.admin);

  const body = (await ctx.req.json().catch(() => null)) as { rows?: Array<Record<string, string>> } | null;
  const rows = body?.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return json({ ok: false, error: "rows_required" }, 400);
  }

  let inserted = 0;
  let failed = 0;
  const errors: string[] = [];

  const leagueMap = new Map<string, string>();
  const uniqueCodes = Array.from(new Set(rows.map((r) => r.league_id).filter(Boolean) as string[]));
  if (uniqueCodes.length > 0) {
    const { data: leagues } = await ctx.admin.from("leagues").select("id, code").in("code", uniqueCodes);
    leagues?.forEach((l) => {
      if (l.code) leagueMap.set(l.code.toLowerCase(), l.id);
    });
  }

  let bulkSuccess = false;
  try {
    const payload = rows.map((row) => {
      const leagueUuid = row.league_id ? leagueMap.get(row.league_id.toLowerCase()) || null : null;
      return {
        category: row.category || "league",
        league_id: leagueUuid,
        participant1_label: row.home_label || null,
        participant2_label: row.away_label || null,
        home_score: row.home_score !== "" && row.home_score != null ? Number(row.home_score) : null,
        away_score: row.away_score !== "" && row.away_score != null ? Number(row.away_score) : null,
        status: row.status || "final",
        game_date: row.game_date || null,
        event_name: row.event_name || null,
        notes: row.notes || null,
      };
    });

    const { error } = await ctx.admin.from("games").insert(payload);
    if (error) throw error;
    bulkSuccess = true;
    inserted = rows.length;
  } catch (bulkErr) {
    // Fallback
  }

  if (!bulkSuccess) {
    for (const row of rows) {
      try {
        const leagueUuid = row.league_id ? leagueMap.get(row.league_id.toLowerCase()) || null : null;
        const { error } = await ctx.admin.from("games").insert({
          category: row.category || "league",
          league_id: leagueUuid,
          participant1_label: row.home_label || null,
          participant2_label: row.away_label || null,
          home_score: row.home_score !== "" && row.home_score != null ? Number(row.home_score) : null,
          away_score: row.away_score !== "" && row.away_score != null ? Number(row.away_score) : null,
          status: row.status || "final",
          game_date: row.game_date || null,
          event_name: row.event_name || null,
          notes: row.notes || null,
        });
        if (error) {
          failed++;
          errors.push(`${row.home_label || "Unknown"} vs ${row.away_label || "Unknown"}: ${error.message}`);
        } else {
          inserted++;
        }
      } catch (e) {
        failed++;
        errors.push(e instanceof Error ? e.message : "unknown");
      }
    }
  }

  return json({ ok: true, inserted, failed, errors });
}
