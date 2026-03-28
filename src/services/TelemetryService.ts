import * as vscode from 'vscode';
import WebSocket from 'ws';
import { AOS_WS_URL, THROTTLE_RATE_MS, WS_RECONNECT_DELAY_MS } from '../config/constants';

export class TelemetryService implements vscode.Disposable {
    private ws: WebSocket | null = null;
    private _webview: vscode.Webview | null = null;
    private _disposed = false; // FIX #1: Guard gegen Reconnect nach dispose()
    
    private latestPayload: any = null;
    private throttleTimer: NodeJS.Timeout | null = null;

    constructor(private readonly endpoint: string = AOS_WS_URL) {
        this.connect();
    }

    // Verbindet die Webview mit dem Datenstrom, sobald sie gerendert wurde
    public attachWebview(webview: vscode.Webview) {
        this._webview = webview;
        this.startThrottledBroadcasting();
    }

    private connect() {
        if (this._disposed) return; // FIX #1: No reconnect after dispose

        // FIX #1: Cleanup old WebSocket handle before creating a new one
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }

        console.log(`[AOS] Verbinde mit Telemetrie-Gateway: ${this.endpoint}`);
        this.ws = new WebSocket(this.endpoint);

        this.ws.on('open', () => {
            console.log('[AOS] WebSocket-Verbindung etabliert.');
            vscode.window.showInformationMessage('AOS: Telemetrie-Verbindung hergestellt.');
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
            try {
                this.latestPayload = JSON.parse(data.toString());
            } catch (err) {
                console.error('[AOS] Fehler beim Parsen der Payload', err);
            }
        });

        this.ws.on('close', () => {
            if (this._disposed) return; // FIX #1: No reconnect after dispose
            console.warn('[AOS] WebSocket getrennt. Versuche Reconnect in 5s...');
            setTimeout(() => this.connect(), WS_RECONNECT_DELAY_MS);
        });

        this.ws.on('error', (err) => {
            console.error(`[AOS] WebSocket Fehler: ${err.message}`);
            // FIX #1: Don't call close() here — the 'close' event fires automatically after 'error'
        });
    }

    private startThrottledBroadcasting() {
        if (this.throttleTimer) clearInterval(this.throttleTimer);

        this.throttleTimer = setInterval(() => {
            if (this._webview && this.latestPayload) {
                this._webview.postMessage({
                    type: 'telemetryUpdate',
                    data: this.latestPayload
                });
                this.latestPayload = null; 
            }
        }, THROTTLE_RATE_MS);
    }

    public dispose() {
        this._disposed = true; // FIX #1: Prevent reconnect after dispose
        if (this.throttleTimer) clearInterval(this.throttleTimer);
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }
    }
}
