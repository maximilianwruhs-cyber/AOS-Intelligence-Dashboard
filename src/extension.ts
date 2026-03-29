import * as vscode from 'vscode';
import { SidebarProvider } from './providers/SidebarProvider';
import { BenchmarkWizardPanel } from './panels/BenchmarkWizardPanel';
import { LeaderboardPanel } from './panels/LeaderboardPanel';
import { AOS_BASE_URL } from './config/constants';
import * as path from 'path';
import * as fs from 'fs';

let gatewayTerminal: vscode.Terminal | undefined;
let healthInterval: NodeJS.Timeout | undefined;

function findAosRoot(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        for (const f of folders) {
            const candidate = path.join(f.uri.fsPath, 'src', 'aos', 'gateway', 'app.py');
            if (fs.existsSync(candidate)) { return f.uri.fsPath; }
        }
    }
    const fallback = path.join(
        process.env.HOME || '/home/maximilian-wruhs',
        'Dokumente', 'Playground', 'AOS'
    );
    return fallback;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('⚡ AOS Intelligence Dashboard activated.');

    // ─── 1. Native Status Bar Item ──────────────────────────────────────────
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(pulse) AOS: Offline';
    statusBarItem.tooltip = 'AOS Intelligence Dashboard — Click to open sidebar';
    statusBarItem.command = 'workbench.view.extension.aos-explorer';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Periodic status bar health check
    async function updateStatusBar() {
        try {
            const resp = await fetch(`${AOS_BASE_URL}/health`, {
                signal: AbortSignal.timeout(3000)
            });
            if (resp.ok) {
                const data: any = await resp.json();
                const model = data.current_model || 'unknown';
                const short = model.length > 20 ? model.slice(0, 20) + '…' : model;
                statusBarItem.text = `$(check) AOS: ${short}`;
                statusBarItem.backgroundColor = undefined;
            } else {
                statusBarItem.text = '$(warning) AOS: Error';
                statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            }
        } catch {
            statusBarItem.text = '$(circle-slash) AOS: Offline';
            statusBarItem.backgroundColor = undefined;
        }
    }

    updateStatusBar();
    healthInterval = setInterval(updateStatusBar, 10000); // every 10s

    // ─── 2. Sidebar Webview Provider ────────────────────────────────────────
    const sidebarProvider = new SidebarProvider(context.extensionUri, AOS_BASE_URL);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'aos.sidebarView',
            sidebarProvider
        )
    );

    // ─── 3. Commands ────────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aos.startGateway', () => {
            if (gatewayTerminal) {
                gatewayTerminal.show();
                vscode.window.showInformationMessage('AOS: Gateway terminal is already open.');
                return;
            }
            const aosRoot = findAosRoot();
            const venvPython = path.join(aosRoot, '.venv', 'bin', 'python');
            const cmd = fs.existsSync(venvPython)
                ? `cd "${aosRoot}" && source .venv/bin/activate && python -m uvicorn aos.gateway.app:app --host 0.0.0.0 --port 8000`
                : `cd "${aosRoot}" && python -m uvicorn aos.gateway.app:app --host 0.0.0.0 --port 8000`;

            gatewayTerminal = vscode.window.createTerminal({ name: 'AOS Gateway' });
            gatewayTerminal.sendText(cmd);
            gatewayTerminal.show(false);

            // Auto-refresh sidebar after gateway boots (5s for model detection)
            setTimeout(() => {
                sidebarProvider.refresh();
                updateStatusBar();
            }, 5000);

            vscode.window.onDidCloseTerminal(t => {
                if (t === gatewayTerminal) { gatewayTerminal = undefined; }
            });

            vscode.window.showInformationMessage('AOS: Starting Gateway on port 8000...');
        }),
        vscode.commands.registerCommand('aos.openBenchmarkWizard', () => {
            BenchmarkWizardPanel.render(context.extensionUri);
        }),
        vscode.commands.registerCommand('aos.openLeaderboard', () => {
            LeaderboardPanel.render(context.extensionUri);
        }),
        vscode.commands.registerCommand('aos.refreshDashboard', () => {
            sidebarProvider.refresh();
            updateStatusBar();
        })
    );
}

export function deactivate() {
    if (healthInterval) { clearInterval(healthInterval); }
}
