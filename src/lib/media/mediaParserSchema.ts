import { z } from 'zod';

/**
 * Shared parser schema for media intelligence.
 * Used by both frontend (review panel) and worker (structured parse output).
 *
 * "Unknown is better than wrong" — fields default to null when the parser
 * is uncertain. `needsReview` flags publications where human review is needed.
 * `fieldConfidence` gives per-field confidence scores for the review panel.
 */

export const mediaParserOutputSchema = z.object({
  /** Parsed title guess */
  title: z.string().nullable(),
  /** Parsed subtitle guess */
  subtitle: z.string().nullable(),
  /** League code parsed from image, null if unknown */
  leagueCode: z.string().nullable(),
  /** Surface type (store, potg, event, media_feed, score, generic) */
  surface: z.enum(['store', 'potg', 'event', 'media_feed', 'score', 'generic']).nullable(),
  /** Media type (image, video, etc.) */
  type: z.string().default('image'),
  /** Overall parser confidence 0-1, null if not parsed */
  confidence: z.number().min(0).max(1).nullable(),
  /** Fields the parser was uncertain about */
  uncertainFields: z.array(z.string()).default([]),
  /** Whether this publication needs manual review */
  needsReview: z.boolean().default(false),
  /** Per-field confidence scores */
  fieldConfidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  /** Raw parser output for debugging */
  rawParserOutput: z.record(z.string(), z.unknown()).nullable().default(null),
});

export type MediaParserOutput = z.infer<typeof mediaParserOutputSchema>;

/**
 * Confidence thresholds
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Below this = low confidence, needsReview = true */
  LOW: 0.5,
  /** Below this = medium confidence, show warning bar */
  MEDIUM: 0.7,
  /** At or above this = high confidence, auto-approve OK */
  HIGH: 0.9,
} as const;

/**
 * Determine if a parser output needs manual review.
 * Returns true if overall confidence < 0.5 OR any field confidence < 0.5.
 */
export function shouldFlagForReview(output: MediaParserOutput): boolean {
  if (output.confidence !== null && output.confidence < CONFIDENCE_THRESHOLDS.LOW) {
    return true;
  }
  // Check per-field confidence
  const lowFields = Object.entries(output.fieldConfidence).filter(
    ([, score]) => score < CONFIDENCE_THRESHOLDS.LOW,
  );
  return lowFields.length > 0;
}

/**
 * Identify which fields have low or medium confidence.
 */
export function getUncertainFields(output: MediaParserOutput): string[] {
  const fields: string[] = [];
  for (const [field, score] of Object.entries(output.fieldConfidence)) {
    if (score < CONFIDENCE_THRESHOLDS.MEDIUM) {
      fields.push(field);
    }
  }
  return fields;
}
