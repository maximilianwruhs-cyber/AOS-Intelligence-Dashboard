// Frontend script for Benchmark Wizard Webview

(function() {
const vscode = acquireVsCodeApi();

// DOM Elements
const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
const suiteSelect = document.getElementById('test-suite') as HTMLSelectElement;
const routingSelect = document.getElementById('hardware-routing') as HTMLSelectElement;

// Types
interface WizardState {
    suite: string;
    routing: string;
    isRunning: boolean;
}

// --- STATE MANAGEMENT: Restore previous state ---
const previousState = vscode.getState() as WizardState | undefined;
if (previousState) {
    suiteSelect.value = previousState.suite;
    routingSelect.value = previousState.routing;
    if (previousState.isRunning) {
        runBtn.disabled = true;
        runBtn.textContent = "Benchmark running...";
    }
}

// Save form state to VS Code state
function saveState() {
    vscode.setState({
        suite: suiteSelect.value,
        routing: routingSelect.value,
        isRunning: runBtn.disabled,
    });
}

suiteSelect.addEventListener('change', saveState);
routingSelect.addEventListener('change', saveState);

// Run Button
runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = "Benchmark running...";
    saveState();

    // Send payload IPC
    vscode.postMessage({
        command: 'startBenchmark',
        suite: suiteSelect.value,
        routing: routingSelect.value
    });
});

// Listener for IPC from Extension Host
window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'updateProgress':
            if (message.progress >= 100 || message.progress <= 0) {
                runBtn.disabled = false;
                runBtn.textContent = "Run Benchmark Suite";
            }
            saveState();
            break;
    }
});
})(); // end IIFE
