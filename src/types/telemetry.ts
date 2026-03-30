// ─── Shared Type Definitions for AOS Telemetry ──────────────────────────────

/** Payload received from the health endpoint */
export interface TelemetryPayload {
    status: 'online' | 'offline' | 'error';
    current_model?: string;
    active_host?: string;
    backend_reachable?: boolean;
    energy_avg?: number;
    z_score?: number;
    quality?: number;
    price_ct_kwh?: number;
    message?: string;
}

/** Request body for the benchmark runner API */
export interface BenchmarkRequest {
    suite: string;       // e.g. "math", "code", "standard", "full"
    model?: string;      // optional — defaults to currently loaded model
}

/** Per-suite breakdown within a leaderboard entry */
export interface SuiteBreakdown {
    avg_quality: number;
    best_z: number;
    runs: number;
    avg_tps: number;
}

/** Single row in the model leaderboard */
export interface LeaderboardEntry {
    model_id: string;
    z_score: number;
    joules_per_request: number;
    quality_score: number;
    tokens_per_second: number;
    efficiency_class: string;
    total_runs: number;
    suites_tested: string[];
    suite_breakdown: Record<string, SuiteBreakdown>;
}

/** A single benchmark run summary (from /v1/benchmark/results) */
export interface BenchmarkRunSummary {
    model: string;
    suite: string;
    timestamp: string;
    avg_quality: number;
    z_score: number;
    total_joules: number;
    tokens_per_second: number;
    obl_cost: number;
    total_tasks: number;
    scores_by_type: Record<string, { avg_score: number; count: number; total_tokens: number }>;
}
