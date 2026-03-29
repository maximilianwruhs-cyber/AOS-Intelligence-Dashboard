import * as vscode from 'vscode';
import { getNonce } from '../utils/nonce';
import { HTTP_TIMEOUT_MS } from '../config/constants';

/**
 * SidebarProvider — AOS Intelligence Dashboard
 *
 * Renders a Webview in the Activity Bar sidebar showing:
 * - Gateway health status
 * - Active model + energy metrics
 * - Quick action buttons
 * - Recent evaluation results
 *
 * Communication:
 * - Extension → Webview: postMessage({ type, data })
 * - Webview → Extension: postMessage({ type, value })
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _aosBaseUrl: string
    ) {}

    /**
     * Force refresh: re-fetch data and push to webview.
     */
    public refresh() {
        if (this._view) {
            this._fetchAndPush();
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // IPC: Listen for messages from the Webview frontend
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'startGateway':
                    vscode.commands.executeCommand('aos.startGateway');
                    break;
                case 'refresh':
                    this._fetchAndPush();
                    break;
                case 'runBenchmark':
                    vscode.commands.executeCommand('aos.openBenchmarkWizard');
                    break;
                case 'openLeaderboard':
                    vscode.commands.executeCommand('aos.openLeaderboard');
                    break;
                case 'switchModel':
                    this._showModelPicker();
                    break;
                case 'onError':
                    if (data.value) {
                        vscode.window.showErrorMessage(data.value);
                    }
                    break;
            }
        });

        // Initial data fetch
        this._fetchAndPush();
    }

    /**
     * Fetch telemetry from AOS Gateway and push to webview.
     */
    private async _fetchAndPush() {
        try {
            const response = await fetch(`${this._aosBaseUrl}/health`, {
                signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
            });

            if (response.ok) {
                const health = await response.json() as Record<string, unknown>;
                this._view?.webview.postMessage({
                    type: 'update',
                    data: { status: 'online', ...health }
                });
            } else {
                this._view?.webview.postMessage({
                    type: 'update',
                    data: { status: 'error', message: `HTTP ${response.status}` }
                });
            }
        } catch {
            this._view?.webview.postMessage({
                type: 'update',
                data: { status: 'offline' }
            });
        }
    }

    /**
     * Show VS Code quick pick to switch active model.
     */
    private async _showModelPicker() {
        try {
            const response = await fetch(`${this._aosBaseUrl}/v1/models`, {
                signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
            });
            if (!response.ok) {
                vscode.window.showErrorMessage('Could not fetch model list from AOS.');
                return;
            }
            const result = await response.json() as { data?: Array<{ id: string }> };
            const models = result.data?.map((m) => m.id) || [];

            const selected = await vscode.window.showQuickPick(models, {
                placeHolder: 'Select a model to switch to…'
            });

            if (selected) {
                // FIX #5: Actually send the switch request to the backend
                try {
                    const switchResponse = await fetch(`${this._aosBaseUrl}/v1/models/switch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model_id: selected }),
                        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
                    });
                    if (switchResponse.ok) {
                        vscode.window.showInformationMessage(`AOS: Switched to ${selected}.`);
                        this._fetchAndPush(); // Refresh dashboard with new model data
                    } else {
                        vscode.window.showWarningMessage(`AOS: Model switch failed (HTTP ${switchResponse.status}).`);
                    }
                } catch {
                    vscode.window.showWarningMessage(`AOS: Model switch request failed — is the endpoint implemented?`);
                }
            }
        } catch {
            vscode.window.showErrorMessage('AOS Gateway not reachable.');
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'sidebar.js')
        );

        const nonce = getNonce();

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src 'nonce-${nonce}';
    ">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AOS Intelligence</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            padding: 12px;
        }

        h2 {
            font-size: 1.1em;
            margin-bottom: 12px;
            color: var(--vscode-sideBarTitle-foreground);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .status-badge {
            display: inline-block;
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--vscode-terminal-ansiGreen);
        }
        .status-badge.offline { background: var(--vscode-terminal-ansiRed); }
        .status-badge.error { background: var(--vscode-terminal-ansiYellow); }

        .metric-card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
            padding: 10px 12px;
            border-radius: 6px;
            margin-bottom: 8px;
            transition: border-color 0.2s ease;
        }
        .metric-card:hover {
            border-color: var(--vscode-focusBorder);
        }

        .metric-title {
            font-size: 0.8em;
            opacity: 0.7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .metric-value {
            font-size: 1.3em;
            font-weight: bold;
            color: var(--vscode-terminal-ansiGreen);
        }
        .metric-value.warn { color: var(--vscode-terminal-ansiYellow); }
        .metric-value.error { color: var(--vscode-terminal-ansiRed); }

        .divider {
            border: none;
            border-top: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
            margin: 14px 0;
        }

        .btn {
            display: block;
            width: 100%;
            padding: 8px 12px;
            margin-bottom: 6px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 0.9em;
            text-align: left;
            transition: background 0.15s ease;
        }
        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        #offline-banner {
            display: none;
            background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
            color: var(--vscode-inputValidation-errorForeground, #fff);
            padding: 8px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 0.85em;
        }
    </style>
</head>
<body>
    <div id="offline-banner">
        ⚠️ AOS Gateway is not reachable on localhost:8000
    </div>

    <h2><span class="status-badge" id="status-dot"></span> AOS Intelligence</h2>

    <div class="metric-card">
        <div class="metric-title">Active Model</div>
        <div class="metric-value" id="model-display">—</div>
    </div>

    <div class="metric-card">
        <div class="metric-title">Energy</div>
        <div class="metric-value" id="energy-display">— J/req</div>
    </div>

    <div class="metric-card">
        <div class="metric-title">z-Score (Intelligence/Watt)</div>
        <div class="metric-value" id="zscore-display">—</div>
    </div>

    <div class="metric-card">
        <div class="metric-title">$OBL Price</div>
        <div class="metric-value warn" id="obl-display">— ct/kWh</div>
    </div>

    <hr class="divider">

    <button class="btn" id="btn-start-gw" style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; font-weight: 700;">⚡ Start Gateway</button>
    <button class="btn" id="btn-benchmark">▶ Run Benchmark</button>
    <button class="btn btn-secondary" id="btn-switch">🔄 Switch Model</button>
    <button class="btn btn-secondary" id="btn-leaderboard">📈 Open Leaderboard</button>
    <button class="btn btn-secondary" id="btn-refresh">🔃 Refresh</button>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
