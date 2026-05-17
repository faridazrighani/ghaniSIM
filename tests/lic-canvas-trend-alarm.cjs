const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const simulationEngine = fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(canvasManager.includes('lic-canvas-trend-panel'), 'LIC object markup should include a beside-object trend panel');
assert(canvasManager.includes('function updateLevelControllerCanvasTrendPanel'), 'Canvas manager should update LIC trend panel');
assert(canvasManager.includes('Liquid Level Trend'), 'LIC canvas panel should title the liquid level trend chart');
assert(canvasManager.includes('renderLicCanvasTrendSvg'), 'LIC canvas panel should render a compact trend SVG');
assert(canvasManager.includes('Incr. Vol'), 'LIC canvas panel should show tank increment volume');
assert(canvasManager.includes('fillPercent'), 'LIC canvas panel should show tank level percent');
assert(canvasManager.includes('snapshot.level >= snapshot.hll'), 'LIC alarm should trigger when level touches/exceeds HLL');
assert(canvasManager.includes('snapshot.level <= snapshot.lll'), 'LIC alarm should trigger when level touches/falls below LLL');
assert(canvasManager.includes('AudioContext') && canvasManager.includes('setInterval(playLicLevelAlarmBeep, 1200)'), 'LIC alarm should use repeated beep audio');
assert(canvasManager.includes('licLevelAlarmActiveIds.delete(instrumentId)'), 'LIC alarm should clear when level returns to normal range');
assert(simulationEngine.includes('updateObjectOperatingStatusVisual(instrumentId)'), 'LIC readout updates should refresh the canvas trend panel');

assert(styles.includes('.lic-canvas-trend-panel'), 'LIC canvas trend panel should be styled');
assert(styles.includes('.lic-canvas-trend-metrics'), 'LIC canvas trend metrics should be styled');
assert(styles.includes('.lic-level-alarm-active .object-icon'), 'LIC alarm should visibly flash the object icon');
assert(styles.includes('@keyframes lic-level-alarm-flash'), 'LIC alarm blink animation should exist');

console.log(JSON.stringify({
    passed: true,
    canvasTrendPanel: true,
    repeatedBeep: true,
    visualAlarm: true
}, null, 2));
