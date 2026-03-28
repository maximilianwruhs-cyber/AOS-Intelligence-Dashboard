import * as vscode from 'vscode';
import { getNonce } from '../utils/nonce';
import { AOS_BASE_URL, LEADERBOARD_TIMEOUT_MS } from '../config/constants';
import { LeaderboardEntry } from '../types/telemetry';

export class LeaderboardPanel {
    public static currentPanel: LeaderboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _disposed = false; // FIX #11: Guard against double-dispose

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);

        this._handleWebviewMessages();
        this._fetchLeaderboard();
    }

    private _handleWebviewMessages() {
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'refresh':
                        this._fetchLeaderboard();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async _fetchLeaderboard() {
        try {
            const response = await fetch(`${AOS_BASE_URL}/v1/leaderboard`, {
                signal: AbortSignal.timeout(LEADERBOARD_TIMEOUT_MS)
            });

            if (response.ok) {
                const result: any = await response.json();
                const entries: LeaderboardEntry[] = result.data || result || [];
                this._panel.webview.postMessage({ command: 'loadData', data: entries });
            } else {
                // Fallback: show demo data when backend is not available
                this._sendDemoData();
            }
        } catch {
            this._sendDemoData();
        }
    }

    private _sendDemoData() {
        const demoData: LeaderboardEntry[] = [
            { model_id: 'llama-3.1-8b-instruct', z_score: 0.847, joules_per_request: 42.3, quality_score: 0.91, efficiency_class: 'A+' },
            { model_id: 'qwen2.5-7b-instruct', z_score: 0.812, joules_per_request: 38.7, quality_score: 0.88, efficiency_class: 'A+' },
            { model_id: 'mistral-7b-instruct-v0.3', z_score: 0.734, joules_per_request: 51.2, quality_score: 0.82, efficiency_class: 'A' },
            { model_id: 'phi-3-mini-4k', z_score: 0.698, joules_per_request: 28.1, quality_score: 0.74, efficiency_class: 'A' },
            { model_id: 'gemma-2-9b-it', z_score: 0.651, joules_per_request: 67.4, quality_score: 0.86, efficiency_class: 'B' },
            { model_id: 'codellama-13b', z_score: 0.589, joules_per_request: 89.6, quality_score: 0.79, efficiency_class: 'B' },
        ];
        this._panel.webview.postMessage({ command: 'loadData', data: demoData });
    }

    public static render(extensionUri: vscode.Uri) {
        if (LeaderboardPanel.currentPanel) {
            LeaderboardPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'aosLeaderboard',
                'AOS Model Leaderboard',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [extensionUri],
                    retainContextWhenHidden: false,
                }
            );
            LeaderboardPanel.currentPanel = new LeaderboardPanel(panel, extensionUri);
        }
    }

    public dispose() {
        if (this._disposed) return; // FIX #11: Prevent re-entry from onDidDispose
        this._disposed = true;
        LeaderboardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'leaderboard.js'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AOS Model Leaderboard</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                    }
                    .leaderboard-container { max-width: 900px; margin: 0 auto; }
                    h1 { margin-bottom: 6px; }
                    .subtitle { font-size: 0.85em; opacity: 0.7; margin-bottom: 20px; }

                    .toolbar {
                        display: flex; justify-content: flex-end; margin-bottom: 12px;
                    }
                    .toolbar button {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: none; border-radius: 4px; padding: 6px 14px;
                        cursor: pointer; font-family: var(--vscode-font-family);
                    }
                    .toolbar button:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.9em;
                    }
                    th {
                        text-align: left;
                        padding: 10px 12px;
                        background: var(--vscode-editor-background);
                        border-bottom: 2px solid var(--vscode-widget-border, rgba(255,255,255,0.15));
                        cursor: pointer;
                        user-select: none;
                        white-space: nowrap;
                        position: sticky;
                        top: 0;
                    }
                    th:hover {
                        color: var(--vscode-textLink-foreground);
                    }
                    th .sort-indicator { margin-left: 4px; opacity: 0.5; }
                    th.active .sort-indicator { opacity: 1; }

                    td {
                        padding: 8px 12px;
                        border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
                    }
                    tr:hover td {
                        background-color: var(--vscode-list-hoverBackground);
                    }

                    .rank { font-weight: bold; opacity: 0.6; width: 30px; }
                    .model-name { font-weight: 600; }
                    .badge {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 10px;
                        font-size: 0.8em;
                        font-weight: bold;
                    }
                    .badge-a-plus { background: var(--vscode-terminal-ansiGreen); color: #000; }
                    .badge-a { background: var(--vscode-terminal-ansiYellow); color: #000; }
                    .badge-b { background: var(--vscode-terminal-ansiBlue); color: #fff; }
                    .badge-c { background: var(--vscode-terminal-ansiRed); color: #fff; }

                    .empty-state {
                        text-align: center; padding: 40px;
                        opacity: 0.5; font-style: italic;
                    }
                </style>
            </head>
            <body>
                <div class="leaderboard-container">
                    <h1>📊 AOS Model Leaderboard</h1>
                    <p class="subtitle">Ranked by Intelligence per Watt — sorted in-memory for zero-latency interaction.</p>

                    <div class="toolbar">
                        <button id="btn-refresh">🔃 Refresh</button>
                    </div>

                    <table id="leaderboard-table">
                        <thead>
                            <tr>
                                <th data-key="rank">#</th>
                                <th data-key="model_id">Model <span class="sort-indicator">⇅</span></th>
                                <th data-key="z_score" class="active">z-Score <span class="sort-indicator">▼</span></th>
                                <th data-key="joules_per_request">J/req <span class="sort-indicator">⇅</span></th>
                                <th data-key="quality_score">Quality <span class="sort-indicator">⇅</span></th>
                                <th data-key="efficiency_class">Class <span class="sort-indicator">⇅</span></th>
                            </tr>
                        </thead>
                        <tbody id="leaderboard-body">
                            <tr><td colspan="6" class="empty-state">Loading leaderboard data…</td></tr>
                        </tbody>
                    </table>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

