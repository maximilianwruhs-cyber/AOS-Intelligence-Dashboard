import * as vscode from 'vscode';
import { SidebarProvider } from './providers/SidebarProvider';
import { TelemetryService } from './services/TelemetryService';
import { BenchmarkWizardPanel } from './panels/BenchmarkWizardPanel';
import { LeaderboardPanel } from './panels/LeaderboardPanel';
import { AOS_BASE_URL, AOS_WS_URL } from './config/constants';
import * as path from 'path';
import * as fs from 'fs';

let gatewayTerminal: vscode.Terminal | undefined;

function findAosRoot(): string {
    // 1. Check workspace folders
    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
        for (const f of folders) {
            const candidate = path.join(f.uri.fsPath, 'src', 'aos', 'gateway', 'app.py');
            if (fs.existsSync(candidate)) { return f.uri.fsPath; }
        }
    }
    // 2. Fallback to known path
    const fallback = path.join(
        process.env.HOME || '/home/maximilian-wruhs',
        'Dokumente', 'Playground', 'AOS'
    );
    return fallback;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('⚡ AOS Intelligence Dashboard activated.');

    const telemetryService = new TelemetryService(AOS_WS_URL);
    context.subscriptions.push(telemetryService);

    // ─── 1. Native Status Bar Item (always visible) ─────────────────────────
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(pulse) AOS: Initializing…';
    statusBarItem.tooltip = 'AOS Intelligence Dashboard';
    statusBarItem.command = 'workbench.view.extension.aos-explorer';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // ─── 2. Sidebar Webview Provider ────────────────────────────────────────
    const sidebarProvider = new SidebarProvider(context.extensionUri, AOS_BASE_URL, telemetryService);
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

            // Auto-refresh sidebar after gateway boots
            setTimeout(() => sidebarProvider.refresh(), 3000);

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
        })
    );
}

export function deactivate() {}
