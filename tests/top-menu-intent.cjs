const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const menuBar = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

[
    'simulate-dropdown-container',
    'tools-dropdown-container',
    'view-dropdown-container',
    'dropdown-simulate',
    'dropdown-tools',
    'dropdown-view',
    'menu-run-solve',
    'menu-refresh-calculations',
    'menu-tools-fluid-basis',
    'menu-tools-export-excel',
    'menu-view-reset-canvas',
    'menu-view-show-warnings'
].forEach(id => {
    assert(indexHtml.includes(`id="${id}"`), `Expected top menu intent control ${id}`);
});

assert(!indexHtml.includes('<span class="menu-item">Simulate</span>'), 'Simulate should not be a nonfunctional plain menu label');
assert(!indexHtml.includes('<span class="menu-item">Tools</span>'), 'Tools should not be a nonfunctional plain menu label');
assert(!indexHtml.includes('<span class="menu-item">View</span>'), 'View should not be a nonfunctional plain menu label');

assert(menuBar.includes('function runHydraulicEvaluationFromMenu'), 'Simulate menu should have a run evaluation helper');
assert(menuBar.includes('function refreshCalculationsFromMenu'), 'Simulate menu should have a refresh helper');
assert(menuBar.includes('function exportScenarioTraceFromMenu'), 'Tools menu should share the scenario export helper');
assert(menuBar.includes('function resetCanvasViewFromMenu'), 'View menu should expose a canvas reset helper');
assert(menuBar.includes('function showWarningsPanelFromMenu'), 'View menu should expose warning panel helper');
assert(menuBar.includes('menuRunSolve.addEventListener'), 'Run Simulation menu item should be wired');
assert(menuBar.includes('menuRefreshCalculations.addEventListener'), 'Refresh menu item should be wired');
assert(menuBar.includes('menuToolsFluidBasis.addEventListener'), 'Tools Fluid Basis item should be wired');
assert(menuBar.includes('menuToolsExportExcel.addEventListener'), 'Tools export item should be wired');
assert(menuBar.includes('menuViewResetCanvas.addEventListener'), 'View reset item should be wired');
assert(menuBar.includes('menuViewShowWarnings.addEventListener'), 'View warnings item should be wired');
assert(menuBar.includes('runUserRequestedSolve'), 'Simulate menu should use the same solve path as the ribbon button when available');
assert(menuBar.includes('setCanvasWarningPanelCollapsed(false)'), 'View warnings item should expand the warning panel');
assert(menuBar.includes("document.getElementById('canvasWarningHeader')"), 'View warnings item should focus the warning panel header');

console.log(JSON.stringify({
    passed: true,
    simulateMenu: true,
    toolsMenu: true,
    viewMenu: true,
    noDeadTopMenuLabels: true
}, null, 2));
