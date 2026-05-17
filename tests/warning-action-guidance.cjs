const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const warningGuidanceSource = fs.readFileSync(path.join(projectRoot, 'ui/warning-guidance.js'), 'utf8');
const canvasManagerSource = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const sidebarPropertiesSource = fs.readFileSync(path.join(projectRoot, 'ui/sidebar-properties.js'), 'utf8');
const buildSource = fs.readFileSync(path.join(projectRoot, 'tools/build-production-assets.mjs'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const context = {};
vm.createContext(context);
vm.runInContext(warningGuidanceSource, context);

const overSpecified = 'Flow, downstream pressure, and pump curve are all fixed. Calculation will report residual head.';
const npsh = 'NPSH margin is below required margin.';
const pathWarning = 'SRC-100 is attached to TK-101, but no hydraulic path exists from the equipment outlet to the pump suction.';

assert(
    context.getWarningActionRecommendation(overSpecified).includes('Choose one independent downstream constraint'),
    'Over-specified warning should recommend choosing one downstream constraint'
);
assert(
    context.formatWarningForUser(overSpecified).includes('Action:'),
    'Formatted warning should include an explicit Action section'
);
assert(
    context.formatWarningForUser(npsh).includes('source liquid level/pressure'),
    'NPSH warning should recommend reviewing source pressure/elevation and suction losses'
);
assert(
    context.formatWarningForUser(pathWarning).includes('solid hydraulic route'),
    'Missing hydraulic path warning should recommend creating a solid hydraulic route'
);
assert(
    context.formatWarningListForUser([overSpecified, npsh]).length === 2,
    'Warning list formatter should preserve warning count'
);

assert(
    buildSource.includes("'ui/warning-guidance.js'"),
    'Production bundle should include warning guidance helper before UI consumers'
);
assert(
    canvasManagerSource.includes('getWarningDisplayText') && canvasManagerSource.includes('formatWarningForUser'),
    'Canvas warning panel should use actionable warning display text'
);
assert(
    sidebarPropertiesSource.includes('formatWarningListForUser'),
    'Pump property/task warning readouts should use actionable warning display text'
);

console.log(JSON.stringify({
    passed: true,
    overSpecifiedAction: context.getWarningActionRecommendation(overSpecified),
    npshAction: context.getWarningActionRecommendation(npsh),
    pathAction: context.getWarningActionRecommendation(pathWarning)
}, null, 2));
