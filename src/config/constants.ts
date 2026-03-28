// ─── AOS Gateway Configuration ──────────────────────────────────────────────
// Central source of truth for all backend URLs and timing constants.

/** Base URL for the AOS FastAPI REST Gateway */
export const AOS_BASE_URL = 'http://127.0.0.1:8000';

/** WebSocket endpoint for live telemetry streaming */
export const AOS_WS_URL = 'ws://127.0.0.1:8000/ws/telemetry';

/** Timeout for REST health checks and API calls (ms) */
export const HTTP_TIMEOUT_MS = 3000;

/** Timeout for leaderboard fetch (ms) */
export const LEADERBOARD_TIMEOUT_MS = 5000;

/** Telemetry throttle rate — max UI updates per second (ms) */
export const THROTTLE_RATE_MS = 100; // 10Hz

/** WebSocket reconnect delay after disconnect (ms) */
export const WS_RECONNECT_DELAY_MS = 5000;
