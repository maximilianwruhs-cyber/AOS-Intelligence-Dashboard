// Leaderboard Frontend — sortable in-memory table
// Type declaration provided by webview/types.d.ts
(function() {
const vscode = acquireVsCodeApi();

interface LeaderboardEntry {
    model_id: string;
    z_score: number;
    joules_per_request: number;
    quality_score: number;
    efficiency_class: string;
}

interface LeaderboardState {
    data?: LeaderboardEntry[];
    sortKey?: string;
    sortAsc?: boolean;
}

let currentData: LeaderboardEntry[] = [];
let sortKey: keyof LeaderboardEntry = 'z_score';
let sortAsc = false; // descending by default for z_score

const tbody = document.getElementById('leaderboard-body') as HTMLTableSectionElement;

// ─── Sorting via table headers ───────────────────────────────────────────────
document.querySelectorAll('th[data-key]').forEach((th) => {
    th.addEventListener('click', () => {
        const key = (th as HTMLElement).dataset.key as string;
        if (key === 'rank') return;

        const typedKey = key as keyof LeaderboardEntry;
        if (sortKey === typedKey) {
            sortAsc = !sortAsc;
        } else {
            sortKey = typedKey;
            sortAsc = key === 'model_id'; // strings sort A→Z by default
        }

        // Update header indicators
        document.querySelectorAll('th').forEach(h => {
            h.classList.remove('active');
            const indicator = h.querySelector('.sort-indicator');
            if (indicator) indicator.textContent = '⇅';
        });
        th.classList.add('active');
        const indicator = th.querySelector('.sort-indicator');
        if (indicator) indicator.textContent = sortAsc ? '▲' : '▼';

        renderTable();
    });
});

// ─── Refresh button ──────────────────────────────────────────────────────────
document.getElementById('btn-refresh')!.addEventListener('click', () => {
    vscode.postMessage({ command: 'refresh' });
});

// ─── IPC from Extension Host ─────────────────────────────────────────────────
window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command === 'loadData') {
        currentData = message.data as LeaderboardEntry[];
        renderTable();
        vscode.setState({ data: currentData, sortKey, sortAsc } as LeaderboardState);
    }
});

// ─── Render ──────────────────────────────────────────────────────────────────
function renderTable() {
    const sorted = [...currentData].sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (typeof valA === 'string' && typeof valB === 'string') {
            return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc
            ? (valA as number) - (valB as number)
            : (valB as number) - (valA as number);
    });

    tbody.innerHTML = sorted.map((entry, i) => {
        const badgeClass = getBadgeClass(entry.efficiency_class);
        return `<tr>
            <td class="rank">${i + 1}</td>
            <td class="model-name">${escapeHtml(entry.model_id)}</td>
            <td>${entry.z_score.toFixed(3)}</td>
            <td>${entry.joules_per_request.toFixed(1)}</td>
            <td>${entry.quality_score.toFixed(2)}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(entry.efficiency_class)}</span></td>
        </tr>`;
    }).join('');
}

function getBadgeClass(cls: string): string {
    switch (cls) {
        case 'A+': return 'badge-a-plus';
        case 'A': return 'badge-a';
        case 'B': return 'badge-b';
        default: return 'badge-c';
    }
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── State Recovery ──────────────────────────────────────────────────────────
const previousState = vscode.getState() as LeaderboardState | undefined;
if (previousState?.data) {
    currentData = previousState.data;
    if (previousState.sortKey) sortKey = previousState.sortKey as keyof LeaderboardEntry;
    if (previousState.sortAsc !== undefined) sortAsc = previousState.sortAsc;
    renderTable();
}
})();

