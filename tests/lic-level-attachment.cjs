const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const connectionsRenderer = fs.readFileSync(path.join(projectRoot, 'ui/connections-renderer.js'), 'utf8');
const stateManager = fs.readFileSync(path.join(projectRoot, 'core/state-manager.js'), 'utf8');
const objectProperties = fs.readFileSync(path.join(projectRoot, 'properties/object-properties.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(canvasManager.includes('instrument-anchor level-anchor'), 'Tank/Vessel markup should include a level instrument anchor');
assert(canvasManager.includes('Attach to tank/vessel level'), 'LIC context menu should expose level attachment');
assert(canvasManager.includes("attachMode === 'level'"), 'Canvas connect mode should distinguish LIC level attachment from pipe tap attachment');
assert(connectionsRenderer.includes('instrument-level-line'), 'LIC-to-tank link should render with a distinct instrument level line');
assert(stateManager.includes('function attachInstrumentToLevelTarget'), 'State manager should support LIC-to-tank attachment');
assert(objectProperties.includes('Apply SP to Tank Level'), 'LIC properties should expose an explicit apply-setpoint level action');
assert(objectProperties.includes('Required Outlet Flow'), 'LIC properties should show required outlet flow for balanced tank level');
assert(styles.includes('.instrument-anchor'), 'Styles should include instrument signal anchors');

const context = {
    console,
    Math,
    Number,
    parseFloat,
    document: {
        removeEventListener() {},
        querySelectorAll() { return []; }
    }
};
context.window = context;
vm.createContext(context);

vm.runInContext(`
function getObjectElement() { return null; }
function drawConnections() {}
function updateSimulation() {}
function selectNode() {}
function renderSidebar() {}
function captureState() {}
function isStorageBoundaryAttachmentTarget(node) { return !!(node && ['tank', 'separator', 'verticalVessel'].includes(node.type)); }
`, context);

[
    'formulas/constants.js',
    'core/unit-system.js',
    'properties/objects/tank-properties.js',
    'properties/objects/pipe-properties.js',
    'properties/objects/pump-properties.js',
    'properties/objects/valve-properties.js',
    'properties/objects/separator-properties.js',
    'properties/objects/heat-exchanger-properties.js',
    'properties/objects/mixer-properties.js',
    'properties/objects/instrument-properties.js',
    'properties/objects/network-node-properties.js',
    'properties/object-properties.js',
    'core/state-manager.js'
].forEach(file => {
    vm.runInContext(
        fs.readFileSync(path.join(projectRoot, file), 'utf8'),
        context,
        { filename: file }
    );
});

vm.runInContext(`
globalModel['I-100'] = {
    type: 'levelController',
    name: 'I-100',
    props: { setPoint: 50, outputMode: 'Auto' }
};
globalModel['TK-100'] = {
    type: 'tank',
    name: 'TK-100',
    props: { elevation: 6, liquidLevel: 3, hll: 5, lll: 1.5 }
};
attachInstrumentToLevelTarget('I-100', 'TK-100');
`, context);

const result = vm.runInContext(`({
    linkCount: instrumentLinks.length,
    linkType: instrumentLinks[0]?.linkType,
    targetId: instrumentLinks[0]?.targetId,
    pipeId: instrumentLinks[0]?.pipeId || '',
    hydraulicConnectionCount: connections.length,
    attachedTo: globalModel['I-100'].props.attachedTo
})`, context);

assert(result.linkCount === 1, 'LIC should create one instrument link');
assert(result.linkType === 'level-measurement', 'LIC link should be a level measurement link');
assert(result.targetId === 'TK-100', 'LIC link should target the tank');
assert(result.pipeId === '', 'LIC level link should not store a pipe id');
assert(result.hydraulicConnectionCount === 0, 'LIC level link should not create a hydraulic connection');
assert(result.attachedTo === 'TK-100', 'LIC props should record attached tank equipment');

console.log('lic-level-attachment: ok');
