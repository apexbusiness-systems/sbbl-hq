import { describe, expect, it } from 'vitest';
import { classifyRiskLane, normalizeIngress } from '@/lib/omniport';

describe('omniport ingress normalization', () => {
  it('marks known dangerous operations as BLOCKED', () => {
    const lane = classifyRiskLane('admin_mutation', { sql: 'DROP TABLE users' });
    expect(lane).toBe('BLOCKED');
  });

  it('marks governance-sensitive operations as RED', () => {
    const lane = classifyRiskLane('admin_mutation', { action: 'grant_access role escalation' });
    expect(lane).toBe('RED');
  });

  it('normalizes baseline envelope fields', () => {
    const envelope = normalizeIngress({
      source_type: 'upload',
      entity_type: 'schedule',
      payload: { rows: 2 },
      actor_id: 'user-1',
    });

    expect(envelope.correlation_id).toBeTruthy();
    expect(envelope.trace_id).toBeTruthy();
    expect(envelope.requires_man_approval).toBe(false);
    expect(envelope.risk_lane).toBe('GREEN');
  });
});
