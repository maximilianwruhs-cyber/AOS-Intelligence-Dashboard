import * as http from 'http';

/**
 * Reliable HTTP GET using Node.js built-in http module.
 * Works in all Electron / VS Code extension host environments
 * where global `fetch()` may be unavailable or broken.
 */
export function httpGet(url: string, timeoutMs: number = 3000): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = http.get(
            {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                timeout: timeoutMs,
            },
            (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    const status = res.statusCode || 0;
                    resolve({
                        ok: status >= 200 && status < 300,
                        status,
                        json: () => Promise.resolve(JSON.parse(body)),
                    });
                });
            }
        );
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Reliable HTTP POST using Node.js built-in http module.
 */
export function httpPost(
    url: string,
    body: Record<string, unknown>,
    timeoutMs: number = 3000
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const payload = JSON.stringify(body);
        const req = http.request(
            {
                method: 'POST',
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                timeout: timeoutMs,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    const status = res.statusCode || 0;
                    resolve({
                        ok: status >= 200 && status < 300,
                        status,
                        json: () => Promise.resolve(JSON.parse(data)),
                    });
                });
            }
        );
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        });
        req.on('error', (err) => {
            reject(err);
        });
        req.write(payload);
        req.end();
    });
}
