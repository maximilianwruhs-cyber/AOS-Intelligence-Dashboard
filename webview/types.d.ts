/**
 * Type declarations for the VS Code Webview API.
 * acquireVsCodeApi() is injected by the VS Code runtime into webview scripts.
 */
declare function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};
