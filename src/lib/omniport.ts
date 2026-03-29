export type IngressSourceType = 'text' | 'voice' | 'webhook' | 'upload' | 'admin_mutation' | 'sync_packet';
export type RiskLane = 'GREEN' | 'RED' | 'BLOCKED';

const MANUAL_APPROVAL_PATTERNS: RegExp[] = [
  /delete|purge/i,
  /finalization[_\s-]?override/i,
  /standings[_\s-]?override/i,
  /roster[_\s-]?merge/i,
  /refund|void|reversal/i,
  /grant[_\s-]?access|role[_\s-]?escalation/i,
  /publish[_\s-]?override/i,
  /moderation[_\s-]?override/i,
  /break[_\s-]?glass|policy[_\s-]?apply/i,
];

const BLOCKED_PATTERNS: RegExp[] = [
  /drop\s+table/i,
  /alter\s+role/i,
  /disable\s+rls/i,
];

export type IngressEnvelope = {
  correlation_id: string;
  source_type: IngressSourceType;
  actor_id: string | null;
  device_id: string | null;
  league_id: string | null;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  risk_lane: RiskLane;
  requires_man_approval: boolean;
  trace_id: string;
  created_at: string;
};

type NormalizeInput = {
  source_type: IngressSourceType;
  actor_id?: string | null;
  device_id?: string | null;
  league_id?: string | null;
  entity_type: string;
  entity_id?: string | null;
  payload?: Record<string, unknown>;
  correlation_id?: string;
  trace_id?: string;
};

function uuidLike() {
  return crypto.randomUUID();
}

function serializeRiskSurface(entityType: string, payload: Record<string, unknown>) {
  return `${entityType} ${JSON.stringify(payload)}`;
}

export function classifyRiskLane(entityType: string, payload: Record<string, unknown>): RiskLane {
  const riskSurface = serializeRiskSurface(entityType, payload);
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(riskSurface))) return 'BLOCKED';
  if (MANUAL_APPROVAL_PATTERNS.some((pattern) => pattern.test(riskSurface))) return 'RED';
  return 'GREEN';
}

export function normalizeIngress(input: NormalizeInput): IngressEnvelope {
  if (!input.source_type || !input.entity_type) {
    throw new Error('invalid_ingress_input');
  }
  const payload = input.payload ?? {};
  const risk_lane = classifyRiskLane(input.entity_type, payload);
  return {
    correlation_id: input.correlation_id ?? uuidLike(),
    source_type: input.source_type,
    actor_id: input.actor_id ?? null,
    device_id: input.device_id ?? null,
    league_id: input.league_id ?? null,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    payload,
    risk_lane,
    requires_man_approval: risk_lane === 'RED',
    trace_id: input.trace_id ?? uuidLike(),
    created_at: new Date().toISOString(),
  };
}
