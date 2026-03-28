// Frontend script for Benchmark Wizard Webview
// Type declaration provided by webview/types.d.ts
(function() {
const vscode = acquireVsCodeApi();

// DOM Elements
const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
const suiteSelect = document.getElementById('test-suite') as HTMLSelectElement;
const routingSelect = document.getElementById('hardware-routing') as HTMLSelectElement;
const progressContainer = document.getElementById('progress-container') as HTMLDivElement;
const progressFill = document.getElementById('progress-fill') as HTMLDivElement;

// Types
interface WizardState {
    suite: string;
    routing: string;
    isRunning: boolean;
    progress: number;
}

let currentProgress = 0; // FIX #6: Track progress explicitly instead of parsing from DOM

// --- STATE MANAGEMENT: Restore previous state ---
const previousState = vscode.getState() as WizardState | undefined;
if (previousState) {
    suiteSelect.value = previousState.suite;
    routingSelect.value = previousState.routing;
    if (previousState.isRunning) {
        updateUI_Running(previousState.progress);
    }
}

// Save form state to VS Code state
function saveState() {
    vscode.setState({
        suite: suiteSelect.value,
        routing: routingSelect.value,
        isRunning: runBtn.disabled, // FIX #4: was !runBtn.disabled (inverted)
        progress: currentProgress   // FIX #6: use tracked variable, not DOM parsing
    });
}

suiteSelect.addEventListener('change', saveState);
routingSelect.addEventListener('change', saveState);

// Run Button
runBtn.addEventListener('click', () => {
    updateUI_Running(0);
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
            updateProgress(message.progress);
            break;
    }
});

function updateUI_Running(progress: number) {
    runBtn.disabled = true;
    runBtn.textContent = "Benchmark running...";
    progressContainer.style.display = 'block';
    currentProgress = progress; // FIX #6
    progressFill.style.width = `${progress}%`;
}

function updateProgress(progress: number) {
    currentProgress = progress; // FIX #6
    progressFill.style.width = `${progress}%`;
    if (progress >= 100) {
        runBtn.disabled = false;
        runBtn.textContent = "Run Benchmark Suite";
        currentProgress = 0; // FIX #6
        progressFill.style.width = '0%';
        progressContainer.style.display = 'none'; // FIX #12: Hide progress bar after completion
        saveState(); 
    } else if (progress <= 0) {
        // FIX #12: Also hide on error/cancel (progress reset to 0)
        runBtn.disabled = false;
        runBtn.textContent = "Run Benchmark Suite";
        currentProgress = 0;
        progressFill.style.width = '0%';
        progressContainer.style.display = 'none';
        saveState();
    } else {
        saveState();
    }
}
})(); // end IIFE
