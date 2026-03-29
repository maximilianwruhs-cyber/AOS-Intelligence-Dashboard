import * as vscode from 'vscode';
import WebSocket from 'ws';
import { AOS_WS_URL, THROTTLE_RATE_MS, WS_RECONNECT_DELAY_MS } from '../config/constants';

export class TelemetryService implements vscode.Disposable {
    private ws: WebSocket | null = null;
    private _webview: vscode.Webview | null = null;
    private _disposed = false;
    
    private latestPayload: any = null;
    private throttleTimer: NodeJS.Timeout | null = null;
    private _reconnectAttempts = 0;
    private readonly _maxReconnectDelay = 60_000; // Cap at 60s

    constructor(private readonly endpoint: string = AOS_WS_URL) {
        this.connect();
    }

    public attachWebview(webview: vscode.Webview) {
        this._webview = webview;
        this.startThrottledBroadcasting();
    }

    private connect() {
        if (this._disposed) return;

        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }

        console.log(`[AOS] Connecting to telemetry: ${this.endpoint}`);
        this.ws = new WebSocket(this.endpoint);

        this.ws.on('open', () => {
            console.log('[AOS] WebSocket connected.');
            this._reconnectAttempts = 0; // Reset backoff on success
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
            try {
                this.latestPayload = JSON.parse(data.toString());
            } catch (err) {
                console.error('[AOS] Parse error', err);
            }
        });

        this.ws.on('close', () => {
            if (this._disposed) return;
            this._reconnectAttempts++;
            // Exponential backoff: 5s, 10s, 20s, 40s, capped at 60s
            const delay = Math.min(
                WS_RECONNECT_DELAY_MS * Math.pow(2, this._reconnectAttempts - 1),
                this._maxReconnectDelay
            );
            console.log(`[AOS] WS closed. Retry #${this._reconnectAttempts} in ${delay / 1000}s`);
            setTimeout(() => this.connect(), delay);
        });

        this.ws.on('error', (err) => {
            // Silence expected errors (403 when no WS endpoint exists)
            if (this._reconnectAttempts < 2) {
                console.warn(`[AOS] WS error: ${err.message}`);
            }
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
        this._disposed = true;
        if (this.throttleTimer) clearInterval(this.throttleTimer);
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }
    }
}
