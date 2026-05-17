const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const simulationEngine = fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8');
const menuBar = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const tankFormulas = fs.readFileSync(path.join(projectRoot, 'formulas/objects/tank-formulas.js'), 'utf8');
const unitSystem = fs.readFileSync(path.join(projectRoot, 'core/unit-system.js'), 'utf8');
const networkNodeProperties = fs.readFileSync(path.join(projectRoot, 'properties/objects/network-node-properties.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertClose(label, actual, expected, tolerance = 1e-6) {
    const delta = Math.abs(actual - expected);
    if (!Number.isFinite(actual) || delta > tolerance) {
        throw new Error(`${label}: expected ${expected}, got ${actual} (delta ${delta})`);
    }
}

assert(simulationEngine.includes('function stepDynamicTankInventory'), 'Dynamic inventory engine should expose a step function');
assert(simulationEngine.includes('requestedDeltaLevel = requestedDeltaVolume / tankArea'), 'Dynamic inventory should calculate dL = dV / A');
assert(simulationEngine.includes('suppressLevelControllerTrendRecording = true'), 'Dynamic pre-solve should suppress artificial LIC trend samples');
assert(simulationEngine.includes('DYNAMIC_INVENTORY_STEP_OPTIONS = [5, 60, 300, 600]'), 'Dynamic inventory should support 5 second, 1 minute, 5 minute, and 10 minute steps');
assert(simulationEngine.includes('function setDynamicInventoryRealtimeIntervalMs'), 'Dynamic inventory should support configurable realtime interval');
assert(simulationEngine.includes('function getSourceDynamicContributionMode'), 'Dynamic inventory should evaluate SRC dynamic contribution mode');
assert(simulationEngine.includes('dynamicNetFlow'), 'Dynamic inventory should expose a dynamic net-flow basis');
assert(networkNodeProperties.includes('Dynamic Contribution Mode'), 'SRC properties should expose Dynamic Contribution Mode');
assert(networkNodeProperties.includes('Initial Inventory Only'), 'SRC properties should support initial-inventory-only mode');
assert(indexHtml.includes('id="menu-step-dynamic-inventory"'), 'Simulate menu should expose Step Dynamic Inventory');
assert(indexHtml.includes('id="menu-toggle-dynamic-realtime"'), 'Simulate menu should expose realtime dynamic inventory');
assert(indexHtml.includes('data-dynamic-step-seconds="5"'), 'Simulate menu should expose a 5 second timestep option');
assert(indexHtml.includes('data-dynamic-step-seconds="300"'), 'Simulate menu should expose a 5 minute timestep option');
assert(indexHtml.includes('data-dynamic-realtime-ms="60000"'), 'Simulate menu should expose a 1 minute realtime interval option');
assert(menuBar.includes('function stepDynamicInventoryFromMenu'), 'Menu should wire Step Dynamic Inventory');
assert(menuBar.includes('function startDynamicInventoryRealtime'), 'Menu should wire realtime dynamic inventory start');
assert(menuBar.includes('setInterval(runDynamicInventoryRealtimeTick'), 'Realtime dynamic inventory should use repeated ticking');
assert(unitSystem.includes('dynamicSimulationTimeSeconds'), 'Dynamic simulation time should be part of saved settings');
assert(unitSystem.includes('dynamicRealtimeIntervalMs'), 'Dynamic realtime interval should be part of saved settings');
assert(tankFormulas.includes('L(t + dt) = L(t) + (Qnet,dyn / A) x dt'), 'Tank trace references should document the dynamic level equation');

const context = {
    console,
    Math,
    Number,
    parseFloat,
    JSON,
    Date
};
context.window = context;
vm.createContext(context);

[
    'formulas/constants.js',
    'core/unit-system.js',
    'formulas/objects/tank-formulas.js',
    'core/simulation-engine.js'
].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(projectRoot, file), 'utf8'), context, { filename: file });
});

vm.runInContext(`
var updateCalls = 0;
function updateSimulation() { updateCalls += 1; }
var globalModel = {
    SETTINGS: createDefaultSimulationSettings({ basisConfirmed: true }),
    FLUID: { type: 'fluid', props: { vaporPressure: 0.0317, density: 997 } },
    'TK-100': {
        type: 'tank',
        name: 'TK-100',
        props: {
            diameter: 5,
            tankHeight: 6,
            liquidLevel: 3,
            hll: 5,
            nll: 3,
            lll: 1.5,
            elevation: 0,
            pressure: 0,
            pressureInputBasis: 'Gauge'
        },
        results: {
            netFlow: 100.3,
            levelTrend: 'Rising',
            levelRate: 5.109,
            warnings: []
        }
    }
};
normalizeTankProps(globalModel['TK-100']);
`, context, { filename: 'dynamic-tank-prelude.js' });

const firstStep = vm.runInContext(`applyTankDynamicInventoryStep('TK-100', 60, { simulationTimeSeconds: 60 })`, context);
assert(firstStep.status === 'Rising', 'Positive net flow should make tank dynamic step Rising');
assertClose('first dynamic level', firstStep.newLevel, 3.085, 0.001);
assertClose('first dynamic volume', firstStep.newVolume, 60.576, 0.02);
assertClose('first fill percent', firstStep.fillPercent, 51.418, 0.02);

const fiveSecondStep = vm.runInContext(`applyTankDynamicInventoryStep('TK-100', 5, { simulationTimeSeconds: 65 })`, context);
assert(fiveSecondStep.status === 'Rising', '5 second step should be a valid rising dynamic inventory step');

const secondStep = vm.runInContext(`stepDynamicTankInventory({ preSolve: false, stepSeconds: 300, renderSidebarAfter: false })`, context);
assert(secondStep.ok, 'Integrated dynamic step should report an updated tank');
assert(secondStep.stepSeconds === 300, 'Dynamic timestep should honor the selected 5 minute option');
assert(secondStep.simulationTimeSeconds === 300, 'Simulation clock should advance by the dynamic timestep');
assertClose('second dynamic level', secondStep.changedTanks[0].newLevel, 3.518, 0.003);
assert(vm.runInContext(`globalModel.SETTINGS.props.dynamicSimulationTimeSeconds`, context) === 300, 'Dynamic simulation time should persist in settings');
assert(vm.runInContext(`updateCalls`, context) === 1, 'Dynamic step should refresh the simulation after applying level changes');

vm.runInContext(`
globalModel['TK-100'].props.liquidLevel = 3;
normalizeTankProps(globalModel['TK-100']);
globalModel['TK-100'].results.netFlow = 0;
globalModel['TK-100'].results.dynamicNetFlow = -50;
globalModel['TK-100'].results.dynamicLevelTrend = 'Falling';
globalModel['TK-100'].results.dynamicLevelRate = -2.546;
`, context, { filename: 'dynamic-drain-prelude.js' });
const drainStep = vm.runInContext(`applyTankDynamicInventoryStep('TK-100', 60, { simulationTimeSeconds: 360 })`, context);
assert(drainStep.status === 'Falling', 'Negative dynamic net flow should drain tank inventory');
assert(drainStep.netFlowBasis === 'Dynamic Net Flow', 'Dynamic inventory should prefer dynamic net-flow basis when available');
assertClose('dynamic drain level', drainStep.newLevel, 2.958, 0.001);
assertClose('dynamic drain requested volume', drainStep.requestedDeltaVolume, -0.833, 0.001);

console.log(JSON.stringify({
    passed: true,
    firstLevel: firstStep.newLevel,
    secondLevel: secondStep.changedTanks[0].newLevel,
    drainLevel: drainStep.newLevel,
    simulationTimeSeconds: secondStep.simulationTimeSeconds
}, null, 2));
