const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(canvasManager.includes('tank-live-params'), 'Tank canvas markup should include a live parameter panel');
assert(canvasManager.includes('function buildTankLiveParameterRows(nodeId, node)'), 'Canvas manager should build live tank parameter rows');
assert(canvasManager.includes('function updateTankLiveParameterPanel(el, nodeId, node, visualStatus)'), 'Tank status refresh should update the live tank panel');
assert(canvasManager.includes('updateTankLiveParameterPanel(el, nodeId, node, tankVisualStatus)'), 'Tank visual update should refresh live tank parameters');

['Boundary', 'Surface Press.', 'Surface Elev.', 'Outlet Elev.', 'Inventory', 'Level', 'Level %', 'Volume', 'Dynamic', 'Sim Time', 'Last Step', 'Flow', 'Pipe Inlet', 'SRC Feed', 'Dyn SRC', 'Outlet Flow', 'Net Flow', 'Dyn Net', 'Level Rate', 'Dyn Rate', 'Trend', 'Dyn Trend'].forEach(label => {
    assert(canvasManager.includes(`label: '${label}'`), `Live tank panel should include ${label}`);
});

assert(canvasManager.includes('tank base elevation + current liquid level'), 'Tank live panel should explain liquid surface elevation');
assert(canvasManager.includes('solid hydraulic path starts'), 'Tank live panel should identify outlet nozzle as hydraulic path start');
assert(canvasManager.includes('Tank inventory balance = inlet flow - outlet flow'), 'Tank live panel should explain net-flow balance');
assert(canvasManager.includes('Dynamic inventory balance used by realtime/step simulation'), 'Tank live panel should explain dynamic net-flow balance');
assert(canvasManager.includes('Projected level rate = net flow divided by tank cross-sectional area'), 'Tank live panel should explain level-rate balance');
assert(canvasManager.includes('Simulate > Step Dynamic Inventory'), 'Tank live panel should explain dynamic inventory stepping');
assert(canvasManager.includes("getTankLiveDisplayUnit('volume')"), 'Tank live panel should use quantity registry volume unit');
assert(canvasManager.includes("getTankLiveDisplayUnit('flow')"), 'Tank live panel should use quantity registry flow unit');
assert(canvasManager.includes("getTankLiveDisplayUnit('levelRate'"), 'Tank live panel should use quantity registry level-rate unit');
assert(canvasManager.includes("getTankLiveDisplayUnit('pressureAbs')"), 'Tank live panel should use absolute pressure display units');
assert(canvasManager.includes("getTankLiveDisplayUnit('head')"), 'Tank live panel should use head/elevation display units');

assert(styles.includes('.tank-live-params'), 'Tank live panel should be styled');
assert(styles.includes('.tank-live-params-advisory'), 'Tank live panel should expose advisory styling for inventory trend warnings');
assert(styles.includes('.tank-live-param-row'), 'Tank live rows should use compact row styling');
assert(styles.includes('.tank-live-param-section'), 'Tank live panel section headers should be styled');
assert(styles.includes('grid-template-columns: 82px minmax(34px, 1fr) auto'), 'Tank live panel should reserve enough label width for clear labels');

console.log(JSON.stringify({
    passed: true,
    tankLivePanel: true,
    boundaryInventoryFlowSplit: true,
    unitRegistryAware: true,
    npshRelevantLabels: true
}, null, 2));
