const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const contextMenu = fs.readFileSync(path.join(projectRoot, 'ui/context-menu.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(!indexHtml.includes('id="btn-mode-select"'), 'Select mode button should not be rendered in the ribbon');
assert(!indexHtml.includes('id="btn-mode-connect"'), 'Connect Pipe button should not be rendered in the ribbon');
assert(!indexHtml.includes('<span class="ribbon-label">Select</span>'), 'Select label should not be visible in the ribbon');
assert(!indexHtml.includes('<span class="ribbon-label">Connect Pipe</span>'), 'Connect Pipe label should not be visible in the ribbon');
assert(!indexHtml.includes('id="canvasSelectionActions"'), 'Selected-object canvas action bar should not be rendered');
assert(!indexHtml.includes('id="canvasActionProperties"'), 'Selected-object Properties button should not be rendered');
assert(!indexHtml.includes('id="canvasActionPrimary"'), 'Selected-object primary action button should not be rendered');
assert(indexHtml.includes('id="canvasConnectHint"'), 'Canvas should include a visible connect-mode hint region');

assert(canvasManager.includes('connectHint.hidden = mode !== \'CONNECT\''), 'setAppMode should show/hide the connect-mode hint');
assert(canvasManager.includes('function getToolbarLivePanelFootprintWidth(type)'), 'Ribbon placement should account for live panel footprint width');
assert(canvasManager.includes('RIBBON_CLICK_ROW_STEP_PX'), 'Ribbon placement should wrap to a new row instead of crowding far-right targets');
assert(canvasManager.includes('getRibbonInitialCenter(type, canvas, rect)'), 'Ribbon placement should start modeling from a readable left-to-right location');
assert(canvasManager.includes("label: 'Start Pipe'"), 'Context actions should still expose Start Pipe where applicable');
assert(canvasManager.includes("label: pendingConnectionStart ? 'Connect here' : 'Connect'"), 'Right-click context menu should expose Connect/Connect here workflow');

assert(styles.includes('.canvas-connect-hint'), 'Connect-mode hint should be styled');
assert(styles.includes('.pfd-canvas.connect-mode .source-live-params'), 'Live panels should de-emphasize during connection mode');
assert(styles.includes('body.context-menu-open .source-live-params'), 'Live panels should de-emphasize while context menu is open');

assert(contextMenu.includes("document.body.classList.add('context-menu-open')"), 'Context menu should mark body while open');
assert(contextMenu.includes("document.body.classList.remove('context-menu-open')"), 'Context menu should clear body state when hidden');

console.log(JSON.stringify({
    passed: true,
    ribbonModeButtonsHidden: true,
    selectedObjectActionPanelRemoved: true,
    contextMenuConnectWorkflow: true,
    connectHint: true,
    livePanelCrowdingReduced: true,
    placementFootprintAware: true
}, null, 2));
