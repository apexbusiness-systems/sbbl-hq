import { z } from 'zod';

export const GameEventTypeSchema = z.enum([
  'score',
  'foul',
  'shot',
  'steal',
  'block',
  'rebound',
  'moment_marker',
  'command',
  'clip_request'
]);

export type GameEventType = z.infer<typeof GameEventTypeSchema>;

export const GameEventSourceSchema = z.enum([
  'operator',
  'scoreboard',
  'cv',
  'sim_command'
]);

export type GameEventSource = z.infer<typeof GameEventSourceSchema>;

export const GameEventPayloadSchema = z.record(z.any());

export const GameEventSchema = z.object({
  id: z.string().uuid().optional(),
  game_id: z.string().uuid(),
  event_ts: z.string().datetime(),
  video_alignment_ms: z.number().int().default(0),
  event_type: GameEventTypeSchema,
  payload: GameEventPayloadSchema,
  source: GameEventSourceSchema,
  confidence: z.number().min(0).max(1).default(1.0),
  created_at: z.string().datetime().optional()
});

export type GameEvent = z.infer<typeof GameEventSchema>;

export const PlayerConsentReceiptSchema = z.object({
  id: z.string().uuid().optional(),
  player_id: z.string().uuid(),
  purpose: z.string(),
  consent_given_at: z.string().datetime(),
  revocable: z.boolean().default(true),
  revoked_at: z.string().datetime().optional(),
  retention_days: z.number().int().default(365)
});

export type PlayerConsentReceipt = z.infer<typeof PlayerConsentReceiptSchema>;
