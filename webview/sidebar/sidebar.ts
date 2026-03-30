/**
 * AOS Sidebar Webview Frontend
 *
 * Runs in the Webview sandbox (browser context).
 * Communicates with the Extension Host via postMessage IPC.
 */

// Acquire the VS Code API handle (can only be called once)
// Type declaration provided by webview/types.d.ts

(function() { // FIX #8: IIFE wrapper for scope isolation
const vscode = acquireVsCodeApi();

// ─── DOM References ──────────────────────────────────────────────────────────
const statusDot = document.getElementById('status-dot')!;
const offlineBanner = document.getElementById('offline-banner')!;
const modelDisplay = document.getElementById('model-display')!;
const energyDisplay = document.getElementById('energy-display')!;
const zscoreDisplay = document.getElementById('zscore-display')!;
const oblDisplay = document.getElementById('obl-display')!;

// ─── Button Handlers ─────────────────────────────────────────────────────────
document.getElementById('btn-start-gw')!.addEventListener('click', () => {
    vscode.postMessage({ type: 'startGateway' });
});

document.getElementById('btn-benchmark')!.addEventListener('click', () => {
    vscode.postMessage({ type: 'runBenchmark' });
});

document.getElementById('btn-switch')!.addEventListener('click', () => {
    vscode.postMessage({ type: 'switchModel' });
});

document.getElementById('btn-leaderboard')!.addEventListener('click', () => {
    vscode.postMessage({ type: 'openLeaderboard' });
});

document.getElementById('btn-refresh')!.addEventListener('click', () => {
    vscode.postMessage({ type: 'refresh' });
});

// ─── Message Handler: Extension Host → Webview ──────────────────────────────
window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
        case 'update': {
            const data = message.data;

            if (data.status === 'online') {
                // Gateway is healthy
                statusDot.className = 'status-badge';
                offlineBanner.style.display = 'none';

                // Model name
                const model = data.current_model || data.model || null;
                modelDisplay.textContent = model ? model : '—';

                // Energy: only show if we have a real numeric value
                if (data.energy_avg != null && data.energy_avg !== 0) {
                    const src = data.energy_source === 'rapl' ? '⚡' : '〰️';
                    energyDisplay.textContent = `${src} ${Number(data.energy_avg).toFixed(1)} J/req`;
                    energyDisplay.className = data.energy_avg > 100
                        ? 'metric-value warn'
                        : 'metric-value';
                } else {
                    energyDisplay.textContent = '— J/req';
                    energyDisplay.className = 'metric-value';
                }

                // Z-Score: only show if we have a real numeric value
                if (data.z_score != null) {
                    zscoreDisplay.textContent = Number(data.z_score).toFixed(3);
                    zscoreDisplay.className = data.z_score < 0.3
                        ? 'metric-value error'
                        : data.z_score < 0.6
                            ? 'metric-value warn'
                            : 'metric-value';
                } else {
                    zscoreDisplay.textContent = '—';
                    zscoreDisplay.className = 'metric-value';
                }

                // Price
                const price = data.price_ct_kwh ?? data.obl_price_at_request ?? null;
                if (price != null) {
                    oblDisplay.textContent = `${Number(price).toFixed(1)} ct/kWh`;
                    oblDisplay.className = 'metric-value warn';
                } else {
                    oblDisplay.textContent = '— ct/kWh';
                    oblDisplay.className = 'metric-value warn';
                }

                // Save state for persistence across reloads
                vscode.setState({ lastUpdate: data, type: 'update' });

            } else if (data.status === 'error') {
                statusDot.className = 'status-badge error';
                offlineBanner.style.display = 'block';
                offlineBanner.textContent = `⚠️ AOS Gateway error: ${data.message || 'Unknown'}`;

            } else {
                // Offline
                statusDot.className = 'status-badge offline';
                offlineBanner.style.display = 'block';
                offlineBanner.textContent = '⚠️ AOS Gateway is not reachable on localhost:8000';
                modelDisplay.textContent = '—';
                energyDisplay.textContent = '— J/req';
                zscoreDisplay.textContent = '—';
                oblDisplay.textContent = '— ct/kWh';
            }
            break;
        }
        case 'telemetryUpdate': {
            const data = message.data;
            
            statusDot.className = 'status-badge';
            offlineBanner.style.display = 'none';

            if (data.model_id) {
                modelDisplay.textContent = data.model_id;
            }
            if (data.joules_per_request !== undefined) {
                energyDisplay.textContent = `${Number(data.joules_per_request).toFixed(1)} J/req`;
                energyDisplay.className = data.joules_per_request > 100 ? 'metric-value warn' : 'metric-value';
            }
            if (data.z_score !== undefined) {
                zscoreDisplay.textContent = Number(data.z_score).toFixed(3);
                zscoreDisplay.className = data.z_score < 0.3 ? 'metric-value error' : data.z_score < 0.6 ? 'metric-value warn' : 'metric-value';
            }
            if (data.obl_price_at_request !== undefined) {
                oblDisplay.textContent = `${Number(data.obl_price_at_request).toFixed(5)} ct/kWh`;
            }
            
            vscode.setState({ lastTelemetry: data, type: 'telemetryUpdate' });
            break;
        }
    }
});

// ─── State Persistence ─────────────────────────────────────────────────────
interface SidebarState { lastTelemetry?: Record<string, unknown>; lastUpdate?: Record<string, unknown>; type?: string; }
const previousState = vscode.getState() as SidebarState | undefined;
if (previousState) {
    if (previousState.lastUpdate) {
        window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'update', data: previousState.lastUpdate }
        }));
    } else if (previousState.lastTelemetry) {
        window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'telemetryUpdate', data: previousState.lastTelemetry }
        }));
    }
}
})(); // end IIFE
