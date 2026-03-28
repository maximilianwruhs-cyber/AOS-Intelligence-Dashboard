import * as vscode from 'vscode';
import { SidebarProvider } from './providers/SidebarProvider';
import { TelemetryService } from './services/TelemetryService';
import { BenchmarkWizardPanel } from './panels/BenchmarkWizardPanel';
import { LeaderboardPanel } from './panels/LeaderboardPanel';
import { AOS_BASE_URL, AOS_WS_URL } from './config/constants';

export function activate(context: vscode.ExtensionContext) {
    console.log('⚡ AOS Intelligence Dashboard activated.');

    const telemetryService = new TelemetryService(AOS_WS_URL);
    context.subscriptions.push(telemetryService);

    // ─── 1. Native Status Bar Item (always visible) ─────────────────────────
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(pulse) AOS: Initializing…'; // FIX #13: Don't claim connected before WS is actually open
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
