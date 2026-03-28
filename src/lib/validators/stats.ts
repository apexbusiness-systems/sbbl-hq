import { z } from 'zod';

export const statLineSchema = z.object({
  playerId: z.string().uuid(),
  pts: z.number().int().nonnegative(),
  reb: z.number().int().nonnegative(),
  ast: z.number().int().nonnegative(),
  stl: z.number().int().nonnegative(),
  blk: z.number().int().nonnegative(),
  fls: z.number().int().nonnegative(),
  min: z.number().nonnegative().max(60),
});

export const finalizeStatsPayloadSchema = z.object({
  gameId: z.string().uuid(),
  rows: z.array(statLineSchema).min(1),
  overrideReason: z.string().min(8).optional(),
});

export function parseFinalizeStatsPayload(payload: unknown) {
  return finalizeStatsPayloadSchema.parse(payload);
}
