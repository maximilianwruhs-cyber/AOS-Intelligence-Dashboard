// ─── Shared Type Definitions for AOS Telemetry ──────────────────────────────

/** Payload received from the health endpoint */
export interface TelemetryPayload {
    model_id: string;
    joules_per_request: number;
    efficiency_class: string;
    task_complexity: string;
    z_score: number;
    obl_price_at_request: number;
}

/** Request body for the benchmark runner API */
export interface BenchmarkRequest {
    suite: string;       // e.g. "math", "code", "standard", "full"
    model?: string;      // optional — defaults to currently loaded model
}

/** Single row in the model leaderboard */
export interface LeaderboardEntry {
    model_id: string;
    z_score: number;
    joules_per_request: number;
    quality_score: number;
    efficiency_class: string;
    eval_runs?: number;
    total_runs?: number;
}
