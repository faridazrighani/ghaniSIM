const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const taskWindowSource = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(indexHtml.includes('id="basisCompactStatus"'), 'Ribbon should include a compact read-only basis status');
assert(indexHtml.includes('aria-label="Active fluid basis and unit standard"'), 'Compact basis status should have a clear accessible label');
assert(styles.includes('.basis-compact-status'), 'Compact basis status should be styled separately from the setup CTA');
assert(styles.includes('.basis-compact-status[hidden]'), 'Compact basis status should be hidden when inactive');

assert(taskWindowSource.includes("taskWindow.classList.toggle('task-window-fluid-help-active', options.kind === 'fluid-help')"), 'Task window should expose a fluid-help active class');
assert(taskWindowSource.includes("openTaskWindow('SRC Boundary Guidance', createSrcHelpContent(), {\n        kind: 'fluid-help'"), 'SRC help should open as fluid-help kind');
assert(taskWindowSource.includes("openTaskWindow('SNK Boundary Guidance', createSnkHelpContent(), {\n        kind: 'fluid-help'"), 'SNK help should open as fluid-help kind');
assert(taskWindowSource.includes("openTaskWindow('Property Source Map', root, { kind: 'fluid-help'"), 'Property Source Map should open as fluid-help kind');
assert(taskWindowSource.includes("openTaskWindow('NPSH Relevance & Academic Notes', createNpshNotesContent(trace), { kind: 'fluid-help'"), 'NPSH notes should open as fluid-help kind');
assert(taskWindowSource.includes('task-window-fluid-help-active'), 'Fluid-help class should be cleared by task-window lifecycle code');

console.log(JSON.stringify({
    passed: true,
    compactBasisStatus: true,
    fluidHelpTaskKind: true
}, null, 2));
