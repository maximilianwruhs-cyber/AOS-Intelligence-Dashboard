import * as vscode from 'vscode';
import { getNonce } from '../utils/nonce';
import { AOS_BASE_URL, LEADERBOARD_TIMEOUT_MS } from '../config/constants';
import { httpGet } from '../utils/httpGet';

export class LeaderboardPanel {
    public static currentPanel: LeaderboardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _disposed = false;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);

        this._handleWebviewMessages();
        this._fetchLeaderboard();

        // Re-fetch when panel becomes visible again
        this._panel.onDidChangeViewState(() => {
            if (this._panel.visible) {
                this._fetchLeaderboard();
            }
        }, null, this._disposables);
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
            const response = await httpGet(`${AOS_BASE_URL}/v1/leaderboard`, LEADERBOARD_TIMEOUT_MS);

            if (response.ok) {
                const result: any = await response.json();
                const entries = result.data || result || [];
                console.log(`[AOS Leaderboard] Loaded ${entries.length} entries from gateway.`);

                if (entries.length === 0) {
                    this._panel.webview.postMessage({
                        command: 'showEmpty',
                        message: 'No benchmark data yet. Run a benchmark to populate the leaderboard.'
                    });
                } else {
                    this._panel.webview.postMessage({ command: 'loadData', data: entries });
                }
            } else {
                const errText = 'Error';
                console.warn(`[AOS Leaderboard] Gateway returned HTTP ${response.status}`);
                this._panel.webview.postMessage({
                    command: 'showError',
                    message: `Gateway returned HTTP ${response.status}. Start the gateway with ⚡ Start Gateway.`
                });
            }
        } catch (err: any) {
            console.warn(`[AOS Leaderboard] Fetch failed: ${err.message}`);
            this._panel.webview.postMessage({
                command: 'showError',
                message: 'Could not reach AOS Gateway on localhost:8000. Start it first.'
            });
        }
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
        if (this._disposed) return;
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
                    .leaderboard-container { max-width: 1100px; margin: 0 auto; }
                    h1 { margin-bottom: 6px; font-size: 1.4em; }
                    .subtitle { font-size: 0.85em; opacity: 0.7; margin-bottom: 20px; }

                    .toolbar {
                        display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
                    }
                    .toolbar .stats { font-size: 0.85em; opacity: 0.7; }
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
                        z-index: 2;
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
                    tr.model-row { cursor: pointer; }
                    tr.model-row:hover td {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    tr.model-row.expanded td {
                        border-bottom: none;
                    }

                    .rank { font-weight: bold; opacity: 0.6; width: 30px; text-align: center; }
                    .model-name { font-weight: 600; }
                    .runs-col { opacity: 0.7; font-size: 0.85em; text-align: center; }

                    /* Quality color classes */
                    .quality-good { color: var(--vscode-terminal-ansiGreen); font-weight: 600; }
                    .quality-ok { color: var(--vscode-terminal-ansiYellow); font-weight: 600; }
                    .quality-low { color: var(--vscode-terminal-ansiRed); font-weight: 600; }

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
                    .badge-c { background: #a78bfa; color: #000; }
                    .badge-d { background: var(--vscode-terminal-ansiRed); color: #fff; }

                    /* Suite detail row */
                    tr.suite-detail { display: none; }
                    tr.suite-detail.visible { display: table-row; }
                    tr.suite-detail td {
                        padding: 4px 12px 12px 12px;
                        border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.08));
                    }

                    .suite-grid {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .suite-chip {
                        display: flex;
                        flex-direction: column;
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.12));
                        border-radius: 6px;
                        padding: 6px 12px;
                        min-width: 100px;
                    }
                    .suite-name {
                        font-size: 0.75em;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        opacity: 0.6;
                        margin-bottom: 2px;
                    }
                    .suite-quality {
                        font-size: 1.2em;
                        font-weight: 700;
                    }
                    .suite-meta {
                        font-size: 0.75em;
                        opacity: 0.5;
                        margin-top: 2px;
                    }

                    .empty-state {
                        text-align: center; padding: 40px;
                        opacity: 0.5; font-style: italic;
                    }
                    .error-state {
                        text-align: center; padding: 30px;
                        background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
                        border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
                        color: var(--vscode-inputValidation-errorForeground, #fff);
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="leaderboard-container">
                    <h1>📊 AOS Model Leaderboard</h1>
                    <p class="subtitle">Ranked by Intelligence per Watt (z = quality / joules × price). Click a row to expand suite breakdown.</p>

                    <div class="toolbar">
                        <span class="stats" id="stats-display"></span>
                        <button id="btn-refresh">🔃 Refresh</button>
                    </div>

                    <div id="status-area"></div>

                    <table id="leaderboard-table">
                        <thead>
                            <tr>
                                <th data-key="rank">#</th>
                                <th data-key="model_id">Model <span class="sort-indicator">⇅</span></th>
                                <th data-key="z_score" class="active">z-Score <span class="sort-indicator">▼</span></th>
                                <th data-key="quality_score">Quality <span class="sort-indicator">⇅</span></th>
                                <th data-key="tokens_per_second">tok/s <span class="sort-indicator">⇅</span></th>
                                <th data-key="joules_per_request">J/run <span class="sort-indicator">⇅</span></th>
                                <th data-key="total_runs">Runs <span class="sort-indicator">⇅</span></th>
                                <th data-key="efficiency_class">Class <span class="sort-indicator">⇅</span></th>
                            </tr>
                        </thead>
                        <tbody id="leaderboard-body">
                            <tr><td colspan="8" class="empty-state">Loading leaderboard data…</td></tr>
                        </tbody>
                    </table>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
