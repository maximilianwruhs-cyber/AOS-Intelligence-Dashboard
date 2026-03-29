import * as vscode from 'vscode';
import { getNonce } from '../utils/nonce';
import { AOS_BASE_URL } from '../config/constants';
import { BenchmarkRequest } from '../types/telemetry';

export class BenchmarkWizardPanel {
    public static currentPanel: BenchmarkWizardPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _disposed = false; // FIX #11: Guard against double-dispose

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);

        this._handleWebviewMessages();
    }

    private _handleWebviewMessages() {
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'startBenchmark':
                        await this.executeBenchmarkCall(message.suite, message.routing);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    private async executeBenchmarkCall(suite: string, _routing: string) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `AOS: Obolus Suite '${suite}' running...`,
            cancellable: true
        }, async (progress, token) => {
            
            const abortController = new AbortController();
            token.onCancellationRequested(() => {
                abortController.abort();
                vscode.window.showWarningMessage("AOS Benchmark cancelled by user.");
            });

            try {
                const response = await fetch(`${AOS_BASE_URL}/v1/benchmark/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ suite } as BenchmarkRequest),
                    signal: abortController.signal
                });

                if (!response.ok) {
                    const err: any = await response.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${response.status}`);
                }

                const result: any = await response.json();

                this._panel.webview.postMessage({ command: 'updateProgress', progress: 100 });
                vscode.window.showInformationMessage(
                    `AOS Benchmark: ${result.model} | Quality: ${(result.score * 100).toFixed(1)}% | z: ${result.z_score.toFixed(4)} | ${result.total_joules.toFixed(1)}J`
                );

            } catch (error: any) {
                if (error.name === 'AbortError') {
                    this._panel.webview.postMessage({ command: 'updateProgress', progress: 0 }); 
                    return; 
                }
                
                vscode.window.showErrorMessage(`AOS Benchmark: ${error.message}`);
                this._panel.webview.postMessage({ command: 'updateProgress', progress: 0 }); 
            }
        });
    }

    public static render(extensionUri: vscode.Uri) {
        if (BenchmarkWizardPanel.currentPanel) {
            BenchmarkWizardPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'aosBenchmarkWizard',
                'AOS Benchmark Wizard',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [extensionUri],
                    retainContextWhenHidden: false,
                }
            );
            BenchmarkWizardPanel.currentPanel = new BenchmarkWizardPanel(panel, extensionUri);
        }
    }

    public dispose() {
        if (this._disposed) return; // FIX #11: Prevent re-entry from onDidDispose
        this._disposed = true;
        BenchmarkWizardPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'wizard.js'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AOS Benchmark Wizard</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
                    .wizard-container { max-width: 600px; margin: 0 auto; }
                    .form-group { margin-bottom: 20px; }
                    label { display: block; margin-bottom: 5px; font-weight: bold; opacity: 0.9; }
                    select, button { width: 100%; padding: 8px; border-radius: 2px; }
                    select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); }
                    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
                    button:hover { background: var(--vscode-button-hoverBackground); }
                    .progress-bar { height: 10px; background: var(--vscode-widget-border); border-radius: 5px; overflow: hidden; margin-top: 10px; } /* FIX #2: removed display:none — container controls visibility */
                    .progress-fill { height: 100%; background: var(--vscode-terminal-ansiGreen); width: 0%; transition: width 0.3s ease; }
                </style>
            </head>
            <body>
                <div class="wizard-container">
                    <h1>Obolus Benchmark Config</h1>
                    <p>Definieren Sie die Hardware-Souveränität und Obolus-Test-Suites für die GZMO-Kalibrierung (Ubuntu 24.04).</p>

                    <div class="form-group">
                        <label for="test-suite">Obolus Test Suite</label>
                        <select id="test-suite">
                            <option value="standard">Standard (50 tasks — math, code, factual, reasoning)</option>
                            <option value="full">Full (85 tasks — includes hard variants)</option>
                            <option value="math">Math (15 tasks)</option>
                            <option value="code">Code Generation (10 tasks)</option>
                            <option value="factual">Factual (15 tasks)</option>
                            <option value="reasoning">Reasoning (10 tasks)</option>
                            <option value="hard">Hard Only (35 tasks)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="hardware-routing">Hardware Routing Override (GZMO Bypass)</label>
                        <select id="hardware-routing">
                            <option value="auto">GZMO Auto-Select (Standard)</option>
                            <option value="local_egpu">Force Local eGPU (Intel RAPL)</option>
                            <option value="cloud_h100">Force Cloud (OBL Market)</option>
                        </select>
                    </div>

                    <button id="run-btn">Run Benchmark Suite</button>

                    <div id="progress-container" class="form-group" style="display:none;">
                        <label>Fortschritt</label>
                        <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

