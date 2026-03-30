// Leaderboard Frontend — Rich sortable table with per-suite breakdown

(function() {
const vscode = acquireVsCodeApi();

interface SuiteBreakdown {
    avg_quality: number;
    best_z: number;
    runs: number;
    avg_tps: number;
}

interface LeaderboardEntry {
    model_id: string;
    z_score: number;
    joules_per_request: number;
    quality_score: number;
    tokens_per_second: number;
    efficiency_class: string;
    total_runs: number;
    suites_tested: string[];
    suite_breakdown: Record<string, SuiteBreakdown>;
}

interface LeaderboardState {
    data?: LeaderboardEntry[];
    sortKey?: string;
    sortAsc?: boolean;
    expandedModel?: string;
}

let currentData: LeaderboardEntry[] = [];
let sortKey: keyof LeaderboardEntry = 'z_score';
let sortAsc = false;
let expandedModel: string | null = null;

const tbody = document.getElementById('leaderboard-body') as HTMLTableSectionElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;

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
            sortAsc = key === 'model_id';
        }

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
    statusArea.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Loading…</td></tr>';
    vscode.postMessage({ command: 'refresh' });
});

// ─── IPC from Extension Host ─────────────────────────────────────────────────
window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'loadData':
            statusArea.innerHTML = '';
            currentData = message.data as LeaderboardEntry[];
            renderTable();
            vscode.setState({ data: currentData, sortKey, sortAsc } as LeaderboardState);
            break;
        case 'showError':
            currentData = [];
            tbody.innerHTML = '';
            statusArea.innerHTML = `<div class="error-state">⚠️ ${escapeHtml(message.message)}</div>`;
            break;
        case 'showEmpty':
            currentData = [];
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(message.message)}</td></tr>`;
            statusArea.innerHTML = '';
            break;
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

    let html = '';
    sorted.forEach((entry, i) => {
        const badgeClass = getBadgeClass(entry.efficiency_class);
        const isExpanded = expandedModel === entry.model_id;
        const qualityPct = (entry.quality_score * 100).toFixed(0);
        const qualityColor = entry.quality_score >= 0.8 ? 'good' : entry.quality_score >= 0.5 ? 'ok' : 'low';

        html += `<tr class="model-row ${isExpanded ? 'expanded' : ''}" data-model="${escapeHtml(entry.model_id)}">
            <td class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
            <td class="model-name">${escapeHtml(entry.model_id)}</td>
            <td><strong>${entry.z_score.toFixed(4)}</strong></td>
            <td class="quality-${qualityColor}">${qualityPct}%</td>
            <td>${entry.tokens_per_second.toFixed(0)}</td>
            <td>${entry.joules_per_request.toFixed(1)}</td>
            <td class="runs-col">${entry.total_runs}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(entry.efficiency_class)}</span></td>
        </tr>`;

        // Suite breakdown row (expandable)
        if (entry.suite_breakdown && Object.keys(entry.suite_breakdown).length > 0) {
            html += `<tr class="suite-detail ${isExpanded ? 'visible' : ''}" data-model="${escapeHtml(entry.model_id)}">
                <td></td>
                <td colspan="7">
                    <div class="suite-grid">
                        ${Object.entries(entry.suite_breakdown).map(([suite, b]) => {
                            const sq = (b.avg_quality * 100).toFixed(0);
                            const sqColor = b.avg_quality >= 0.8 ? '#4ade80' : b.avg_quality >= 0.5 ? '#fbbf24' : b.avg_quality > 0 ? '#f87171' : '#6b7280';
                            return `<div class="suite-chip">
                                <span class="suite-name">${escapeHtml(suite)}</span>
                                <span class="suite-quality" style="color:${sqColor}">${sq}%</span>
                                <span class="suite-meta">${b.runs} run${b.runs !== 1 ? 's' : ''}${b.avg_tps > 0 ? ' · ' + b.avg_tps.toFixed(0) + ' tok/s' : ''}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </td>
            </tr>`;
        }
    });

    tbody.innerHTML = html;

    // Click handler to expand/collapse suite details
    document.querySelectorAll('.model-row').forEach(row => {
        row.addEventListener('click', () => {
            const modelId = (row as HTMLElement).dataset.model!;
            expandedModel = expandedModel === modelId ? null : modelId;
            renderTable();
        });
    });
}

function getBadgeClass(cls: string): string {
    switch (cls) {
        case 'A+': return 'badge-a-plus';
        case 'A': return 'badge-a';
        case 'B': return 'badge-b';
        case 'C': return 'badge-c';
        default: return 'badge-d';
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
