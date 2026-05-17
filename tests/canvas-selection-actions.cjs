const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(!indexHtml.includes('id="canvasSelectionActions"'), 'Canvas should not render selected-object action bar markup');
assert(!indexHtml.includes('id="canvasActionProperties"'), 'Canvas should not render selected-object Properties button');
assert(!indexHtml.includes('id="canvasActionPrimary"'), 'Canvas should not render selected-object primary action button');
assert(!indexHtml.includes('Selected object actions'), 'Canvas should not expose the selected-object action bar label');

assert(styles.includes('.canvas-selection-actions'), 'Legacy selection action selector should remain available for hard hiding');
assert(styles.includes('.canvas-selection-actions {\n    display: none !important;\n}'), 'Legacy selection action bar should be forcibly hidden if old markup exists');

assert(app.includes("initCanvasSelectionActions"), 'App startup should initialize selection action listeners once');
assert(canvasManager.includes('function initCanvasSelectionActions()'), 'Canvas manager should define legacy action bar initialization');
assert(canvasManager.includes('function updateCanvasSelectionActions()'), 'Canvas manager should define legacy action bar refresh');
assert(canvasManager.includes('if (actions) actions.hidden = true;'), 'Canvas manager should keep any legacy selected-object action panel hidden');
assert(canvasManager.includes('function startHydraulicConnectionFromObject(nodeId)'), 'Canvas manager should start pipe connection from selected non-SRC objects');

assert(canvasManager.includes("type: 'source-attach'"), 'Semantic SRC source types should expose dashed tank/vessel attachment action');
assert(canvasManager.includes('startSourceAttachment(nodeId)'), 'SRC attachment action should reuse dashed source attachment workflow');
assert(canvasManager.includes('startHydraulicConnectionFromSource(nodeId)'), 'Hydraulic SRC source types should start a solid hydraulic pipe');
assert(canvasManager.includes("type: 'instrument-level'"), 'LIC/level instruments should expose level attachment action');
assert(canvasManager.includes("startInstrumentAttachment(nodeId, null, { attachMode: 'level' })"), 'LIC level action should use level attachment mode');
assert(canvasManager.includes("startInstrumentAttachment(nodeId, null, { attachMode: 'pipe' })"), 'Non-level instrument action should use pipe tap mode');
assert(canvasManager.includes("label: 'User Task Object Properties'"), 'Right-click context menu should keep object properties discoverable');
assert(canvasManager.includes("label: pendingConnectionStart ? 'Connect here' : 'Connect'"), 'Right-click context menu should keep Connect/Connect here workflow discoverable');

assert(canvasManager.includes("if (typeof updateCanvasSelectionActions === 'function') updateCanvasSelectionActions();"), 'Selection and mode changes should keep the legacy action panel hidden');

console.log(JSON.stringify({
    passed: true,
    selectedObjectActionPanelRemoved: true,
    sourceSemanticVsHydraulicActions: true,
    instrumentLevelAction: true,
    contextMenuWorkflow: true
}, null, 2));
