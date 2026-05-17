const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const simulationEngine = fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8');
const objectProperties = fs.readFileSync(path.join(projectRoot, 'properties/object-properties.js'), 'utf8');
const unitSystem = fs.readFileSync(path.join(projectRoot, 'core/unit-system.js'), 'utf8');
const menuBar = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const projectDocs = fs.readFileSync(path.join(projectRoot, 'docs/project_file_format.md'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertClose(label, actual, expected, tolerance = 1e-9) {
    const delta = Math.abs(actual - expected);
    if (!Number.isFinite(actual) || delta > tolerance) {
        throw new Error(`${label}: expected ${expected}, got ${actual} (delta ${delta})`);
    }
}

assert(simulationEngine.includes('function recordLevelControllerTrendSample'), 'Simulation engine should record LIC level trend samples');
assert(simulationEngine.includes('instrument.results.levelTrendHistory'), 'LIC trend history should be stored on instrument results');
assert(simulationEngine.includes('function sanitizeLevelControllerTrendHistory'), 'LIC trend history should be sanitized before save/load reuse');
assert(simulationEngine.includes('suppressLevelControllerTrendRecording'), 'Project load should be able to suppress artificial trend samples');
assert(objectProperties.includes('Liquid Level Trend'), 'LIC properties should render a liquid level trend chart section');
assert(objectProperties.includes('data-lic-trend-chart'), 'LIC chart canvas should be addressable for live updates');
assert(objectProperties.includes('data-lic-trend-rewind-slider'), 'LIC chart should expose a rewind slider');
assert(objectProperties.includes('function setLevelControllerTrendView'), 'LIC chart should support live/rewind playback mode');
assert(objectProperties.includes("label: 'PV Level'"), 'LIC trend chart should plot PV level');
assert(objectProperties.includes("label: 'SP Level'"), 'LIC trend chart should plot SP level');
assert(objectProperties.includes("label: 'HLL'") && objectProperties.includes("label: 'LLL'"), 'LIC trend chart should plot alarm limits');
assert(objectProperties.includes('Saved Sample (Rewind)'), 'LIC chart x-axis should identify rewind playback');
assert(objectProperties.includes('loadChartJsOnDemand'), 'LIC trend chart should use the existing lazy Chart.js loader');
assert(unitSystem.includes('updateAllLevelControllerTrendCharts'), 'Unit changes should refresh LIC trend charts');
assert(menuBar.includes('normalizeAllLevelControllerTrendHistoriesForSave(globalModel)'), 'Project save should normalize persisted LIC trend history');
assert(menuBar.includes('restoreLevelControllerTrendState(globalModel)'), 'Project load should restore persisted LIC trend history');
assert(menuBar.includes('suppressLevelControllerTrendRecording = true'), 'Project load should suppress artificial trend sampling during initial solve');
assert(projectDocs.includes('Level controller trend charts are stored'), 'Project file documentation should describe LIC trend persistence');
assert(styles.includes('.lic-trend-chart-panel'), 'LIC trend chart should be styled');
assert(styles.includes('.lic-trend-metrics'), 'LIC trend summary metrics should be styled');
assert(styles.includes('.lic-trend-rewind-controls'), 'LIC trend rewind controls should be styled');

const context = { console, Math, Number, parseFloat, JSON, Date };
context.window = context;
vm.createContext(context);

vm.runInContext(`
var connections = [];
var instrumentLinks = [{
    instrumentId: 'LIC-100',
    targetId: 'TK-100',
    targetType: 'tank',
    measuredVariable: 'level',
    linkType: 'level-measurement'
}];
var currentSelectedNode = null;
var activeChartPumpId = null;
var pumpChartInstance = null;
function setSidebarReadout() {}
function updatePumpChart() {}
function renderSidebar() {}
function updateAllObjectOperatingStatusVisuals() {}
function updateInstrumentCalculationTraceReadout() {}
function isInstrumentType(type) {
    return ['pressureIndicator', 'flowIndicator', 'temperatureIndicator', 'lineMonitor', 'levelController'].includes(type);
}
var globalModel = {
    SETTINGS: {
        type: 'settings',
        name: 'Simulation Settings',
        props: {
            unitStandard: 'Metric / European Engineering',
            basisConfirmed: true,
            basisDirty: false,
            lastConfirmedUnitStandard: 'Metric / European Engineering'
        }
    },
    FLUID: { type: 'fluid', props: { density: 997, temp: 25 } },
    'TK-100': {
        type: 'tank',
        name: 'TK-100',
        props: { elevation: 0, liquidLevel: 3, hll: 5, nll: 3, lll: 1.5, tankHeight: 6, diameter: 5 },
        results: { inletFlow: 100, outletFlow: 90, netFlow: 10, levelTrend: 'Rising', levelRate: 0.509 }
    },
    'LIC-100': {
        type: 'levelController',
        name: 'LIC-100',
        props: { setPoint: 55, outputMode: 'Auto', attachedTo: 'TK-100' },
        results: {}
    }
};
`, context, { filename: 'lic-trend-prelude.js' });

[
    'formulas/constants.js',
    'core/unit-system.js',
    'formulas/objects/instrument-formulas.js',
    'core/simulation-engine.js'
].forEach(file => {
    vm.runInContext(
        fs.readFileSync(path.join(projectRoot, file), 'utf8'),
        context,
        { filename: file }
    );
});

vm.runInContext(`updateInstrumentReadout('LIC-100')`, context);
vm.runInContext(`
globalModel['TK-100'].props.liquidLevel = 3.5;
globalModel['TK-100'].results.netFlow = -5;
globalModel['TK-100'].results.levelTrend = 'Falling';
globalModel['TK-100'].results.levelRate = -0.255;
updateInstrumentReadout('LIC-100');
`, context);

const history = vm.runInContext(`globalModel['LIC-100'].results.levelTrendHistory`, context);
assert(history.length === 2, 'LIC trend history should retain live samples');
assertClose('first PV level', history[0].level, 3, 0.001);
assertClose('second PV level', history[1].level, 3.5, 0.001);
assertClose('set point level', history[1].setPointLevel, 3.425, 0.001);
assert(history[1].trend === 'Falling', 'LIC trend history should store the latest level trend');

vm.runInContext(`
globalModel['LIC-100'].results.levelTrendView = { mode: 'rewind', sampleIndex: 1 };
normalizeAllLevelControllerTrendHistoriesForSave(globalModel);
`, context);
const rewindView = vm.runInContext(`globalModel['LIC-100'].results.levelTrendView`, context);
assert(rewindView.mode === 'rewind', 'LIC rewind mode should persist when history exists');
assert(rewindView.sampleIndex === 1, 'LIC rewind sample index should persist inside history range');

vm.runInContext(`
suppressLevelControllerTrendRecording = true;
updateInstrumentReadout('LIC-100');
suppressLevelControllerTrendRecording = false;
`, context);
const suppressedHistory = vm.runInContext(`globalModel['LIC-100'].results.levelTrendHistory`, context);
assert(suppressedHistory.length === 2, 'Suppressed project-load readout should not append artificial LIC trend samples');

console.log(JSON.stringify({
    passed: true,
    samples: history.length,
    latestLevel: history[1].level,
    latestTrend: history[1].trend,
    setPointLevel: history[1].setPointLevel
}, null, 2));
