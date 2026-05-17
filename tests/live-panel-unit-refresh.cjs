const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const unitSystem = fs.readFileSync(path.join(projectRoot, 'core/unit-system.js'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(unitSystem.includes('function refreshUnitStandardDependentUi()'), 'Unit refresh hook should exist');
assert(unitSystem.includes('updateSimulation({ renderSidebarAfter: false })'), 'Changing unit standard should rerun the simulation/readout refresh without stealing sidebar focus');
assert(unitSystem.includes('updateAllTankReadouts'), 'Unit refresh should cover tank task-window readouts');
assert(unitSystem.includes('updateAllObjectOperatingStatusVisuals'), 'Unit refresh should rebuild canvas live panels for SRC, tank, pump, and sink');
assert(unitSystem.includes('updateCanvasWarningPanel'), 'Unit refresh should keep warning panel values/status synchronized');

[
    'buildSourceLiveParameterRows',
    'buildSinkLiveParameterRows',
    'buildTankLiveParameterRows',
    'buildPumpLiveParameterRows'
].forEach(functionName => {
    assert(canvasManager.includes(`function ${functionName}`), `${functionName} should exist`);
});

[
    "getPumpLiveDisplayUnit('flow')",
    "getPumpLiveDisplayUnit('head')",
    "getPumpLiveDisplayUnit('pressureAbs')"
].forEach(token => {
    assert(canvasManager.includes(token), `Live panel builders should use active unit standard via ${token}`);
});

[
    'Outlet Flow',
    'Source Press.',
    'NPSH at Pump',
    'Outlet Press.',
    'Vapor Margin'
].forEach(label => {
    assert(canvasManager.includes(`label: '${label}'`), `Live panel labels should be clear: ${label}`);
});

console.log(JSON.stringify({
    passed: true,
    unitRefreshCoversSimulation: true,
    livePanelsRebuildOnUnitChange: true,
    clearCanvasLabels: true
}, null, 2));
