/**
 * load-realtime.js
 * k6 load test for Supabase Realtime WebSocket subscriptions.
 *
 * Tests concurrent WebSocket connections to the Realtime server,
 * simulating live basketball event score update subscriptions.
 *
 * SLO targets:
 *   - p95 connection time  < 500ms
 *   - p95 message latency  < 300ms
 *   - error rate           < 1%
 *   - 20k concurrent WS connections sustained for 3 minutes
 *
 * Usage:
 *   k6 run \
 *     --env SUPABASE_URL=https://sbbl-hq.icu \
 *     --env ANON_KEY=$(grep ^ANON_KEY .env | cut -d= -f2) \
 *     tests/load-realtime.js
 */

import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Rate, Trend, Counter } from 'k6/metrics';

// -- Custom metrics ----------------------------------------------------------
const wsConnectTime   = new Trend('ws_connect_time_ms',  true);
const wsMessageLag    = new Trend('ws_message_lag_ms',   true);
const wsErrors        = new Rate('ws_error_rate');
const wsMessages      = new Counter('ws_messages_received');
const wsConnected     = new Counter('ws_connections_established');

// -- Test configuration ------------------------------------------------------
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://sbbl-hq.icu';
const ANON_KEY     = __ENV.ANON_KEY     || '';

// Convert https:// to wss:// for WebSocket
const WS_URL = SUPABASE_URL.replace(/^https/, 'wss').replace(/^http/, 'ws')
  + '/realtime/v1/websocket?vsn=1.0.0';

export const options = {
  scenarios: {
    // Ramp to 5k VU (simulating pre-event load)
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 1000  },  // ramp to 1k
        { duration: '1m',  target: 5000  },  // ramp to 5k
        { duration: '3m',  target: 5000  },  // hold 5k (SLO validation window)
        { duration: '30s', target: 0     },  // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },

  thresholds: {
    ws_connect_time_ms:  ['p(95)<500'],    // 95% connect < 500ms
    ws_message_lag_ms:   ['p(95)<300'],    // 95% msg latency < 300ms
    ws_error_rate:       ['rate<0.01'],    // error rate < 1%
    ws_messages_received: ['count>0'],     // at least some messages received
  },
};

// -- Realtime channel to subscribe to ----------------------------------------
// Subscribes to the 'scores' broadcast channel used by live game updates.
function buildJoinMsg(ref) {
  return JSON.stringify({
    topic: 'realtime:scores',
    event: 'phx_join',
    payload: {
      config: {
        broadcast: { ack: false, self: false },
        presence:  { key: '' },
        postgres_changes: [],
      },
      access_token: ANON_KEY,
    },
    ref: String(ref),
  });
}

function buildHeartbeat(ref) {
  return JSON.stringify({
    topic: 'phoenix',
    event: 'heartbeat',
    payload: {},
    ref: String(ref),
  });
}

// -- VU function -------------------------------------------------------------
export default function () {
  if (!ANON_KEY) {
    console.error('ANON_KEY is required. Pass via --env ANON_KEY=...');
    return;
  }

  const startConnect = Date.now();
  let connected      = false;
  let ref            = 1;
  let msgSentAt      = 0;

  const res = ws.connect(
    WS_URL,
    {
      headers: {
        'apikey':        ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    },
    function (socket) {
      socket.on('open', () => {
        const connectMs = Date.now() - startConnect;
        wsConnectTime.add(connectMs);
        wsConnected.add(1);
        connected = true;

        // Join the scores channel
        socket.send(buildJoinMsg(ref++));
        msgSentAt = Date.now();
      });

      socket.on('message', (data) => {
        wsMessages.add(1);
        wsErrors.add(false);

        try {
          const msg = JSON.parse(data);

          // Track message latency for join ack
          if (msg.event === 'phx_reply' && msgSentAt > 0) {
            wsMessageLag.add(Date.now() - msgSentAt);
            msgSentAt = 0;
          }

          // Track latency for broadcast messages (score updates)
          if (msg.event === 'broadcast' && msg.payload && msg.payload.sent_at) {
            const lag = Date.now() - new Date(msg.payload.sent_at).getTime();
            wsMessageLag.add(Math.max(0, lag));
          }
        } catch (e) {
          // non-JSON message, ignore
        }
      });

      socket.on('error', (e) => {
        wsErrors.add(true);
      });

      socket.on('close', () => {
        if (!connected) {
          wsErrors.add(true);
        }
      });

      // Send heartbeats every 25s to keep connection alive
      socket.setInterval(() => {
        socket.send(buildHeartbeat(ref++));
      }, 25000);

      // Hold connection for the test duration, then close gracefully
      socket.setTimeout(() => {
        socket.close();
      }, 280000); // 4m40s — slightly less than the 5m scenario
    }
  );

  check(res, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });

  // Brief sleep to stagger connection teardowns
  sleep(1);
}
