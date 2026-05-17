const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const elements = {};

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function createMockElement(overrides = {}) {
    const classes = new Set();
    const attributes = {};
    return {
        style: {},
        dataset: {},
        hidden: false,
        textContent: '',
        children: [],
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            toggle(name, force) {
                const shouldAdd = force === undefined ? !classes.has(name) : !!force;
                if (shouldAdd) classes.add(name);
                else classes.delete(name);
                return shouldAdd;
            },
            contains(name) { return classes.has(name); }
        },
        offsetLeft: 0,
        offsetTop: 0,
        offsetWidth: 0,
        offsetHeight: 0,
        clientWidth: 0,
        clientHeight: 0,
        scrollLeft: 0,
        scrollTop: 0,
        addEventListener() {},
        append(...items) {
            this.children.push(...items);
        },
        appendChild(item) {
            this.children.push(item);
            return item;
        },
        setAttribute(name, value) {
            attributes[name] = String(value);
        },
        getAttribute(name) {
            return attributes[name];
        },
        replaceChildren(...items) {
            this.children = [...items];
        },
        setPointerCapture() {},
        releasePointerCapture() {},
        getBoundingClientRect() {
            return {
                left: 0,
                top: 0,
                width: this.clientWidth || this.offsetWidth || 0,
                height: this.clientHeight || this.offsetHeight || 0
            };
        },
        ...overrides
    };
}

const canvas = createMockElement({
    clientWidth: 800,
    clientHeight: 520,
    scrollLeft: 300,
    scrollTop: 180
});
const panel = createMockElement({
    offsetWidth: 292,
    offsetHeight: 64
});
const header = createMockElement();
const toggle = createMockElement();
const list = createMockElement();
const count = createMockElement();
const legend = createMockElement({
    offsetHeight: 98
});

elements.canvas = canvas;
elements.canvasWarningPanel = panel;
elements.canvasWarningHeader = header;
elements.canvasWarningToggle = toggle;
elements.canvasWarningList = list;
elements.canvasWarningCount = count;

const context = {
    console,
    Math,
    Number,
    parseFloat,
    requestAnimationFrame(callback) {
        callback();
        return 1;
    },
    window: {
        getComputedStyle(element) {
            return { display: element === legend && legend.hidden ? 'none' : 'block' };
        },
        addEventListener() {}
    },
    document: {
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector(selector) {
            return selector === '.canvas-status-legend' ? legend : null;
        },
        createElement(tagName = 'div') {
            return createMockElement({
                tagName: String(tagName).toUpperCase(),
                className: '',
            });
        }
    }
};
context.window.window = context.window;
context.window.document = context.document;
context.globalModel = {};

vm.createContext(context);
vm.runInContext(
    fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8'),
    context,
    { filename: 'ui/canvas-manager.js' }
);

const minClamp = vm.runInContext('clampCanvasWarningPanelPosition(10, 10)', context);
assert(minClamp.left === 312, 'Warning panel left clamp should include canvas scrollLeft');
assert(minClamp.top === 192, 'Warning panel top clamp should include canvas scrollTop');

const maxClamp = vm.runInContext('clampCanvasWarningPanelPosition(1200, 1200)', context);
assert(maxClamp.left === 796, 'Warning panel right clamp should use visible canvas viewport');
assert(maxClamp.top === 624, 'Warning panel bottom clamp should use visible canvas viewport');

vm.runInContext('positionCanvasWarningPanelDefault()', context);
assert(panel.style.left === '796px', 'Default warning panel should align to visible right edge');
assert(panel.style.top === '300px', 'Default warning panel should sit below the visible pump-status legend');
assert(panel.dataset.viewportLeft === '496', 'Default warning panel should remember visible viewport left offset');
assert(panel.dataset.viewportTop === '120', 'Default warning panel should remember visible viewport top offset');
const defaultPosition = {
    left: panel.style.left,
    top: panel.style.top
};

panel.dataset.userMoved = 'true';
panel.dataset.viewportLeft = '240';
panel.dataset.viewportTop = '210';
canvas.scrollLeft = 500;
canvas.scrollTop = 420;
vm.runInContext('keepCanvasWarningPanelInViewport()', context);
assert(panel.style.left === '740px', 'User-moved warning panel should preserve viewport X offset after scroll');
assert(panel.style.top === '630px', 'User-moved warning panel should preserve viewport Y offset after scroll');

vm.runInContext('updateCanvasWarningPanel()', context);
assert(panel.hidden === true, 'Warning panel should stay hidden when there are no active warnings');
assert(count.textContent === '0', 'Warning count should be zero when the panel is hidden');

vm.runInContext(`
globalModel['P-100'] = {
    type: 'pump',
    name: 'P-100',
    results: {
        status: 'Warning',
        cavitationStatus: 'Warning',
        warnings: ['NPSH margin is below the selected basis.'],
        npsha: '3.5',
        npshr: '3.0',
        npshMargin: '0.5'
    }
};
updateCanvasWarningPanel();
`, context);
assert(panel.hidden === false, 'Warning panel should appear when active warnings exist');
assert(count.textContent === '1', 'Warning count should match active warnings');
assert(list.children.length === 1, 'Warning list should render one active warning item');
assert(list.children[0].dataset.fullDetail.includes('NPSH margin is below'), 'Warning item should retain full detail for tooltip/task context');
assert(list.children[0].title.includes('NPSH margin is below'), 'Warning item should expose full detail as a tooltip');
assert(vm.runInContext("summarizeWarningDetail('This is a very long warning detail that should be shortened before it dominates the canvas warning panel and blocks the modeling workflow for ordinary users.')", context).endsWith('...'), 'Long warning details should be summarized on the canvas panel');

vm.runInContext('collapseCanvasWarningPanelForModeling()', context);
assert(panel.classList.contains('canvas-warning-collapsed'), 'Warning panel should collapse when modeling starts');
assert(list.hidden === true, 'Warning list should be hidden while warning panel is collapsed');
assert(toggle.textContent === '+', 'Collapsed warning panel toggle should show expand action');

vm.runInContext('setCanvasWarningPanelCollapsed(false)', context);
assert(!panel.classList.contains('canvas-warning-collapsed'), 'Warning panel should expand on request');
assert(list.hidden === false, 'Warning list should be visible after expanding');
assert(toggle.getAttribute('aria-expanded') === 'true', 'Expanded warning panel toggle should update ARIA state');

const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const canvasManagerSource = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
assert(styles.includes('width: min(292px, calc(100% - 24px))'), 'Warning panel should use compact responsive width');
assert(styles.includes('min-width: min(220px, calc(100% - 24px))'), 'Warning panel should keep a readable minimum width');
assert(styles.includes('box-sizing: border-box'), 'Warning panel should include border-box sizing');
assert(styles.includes('top: 126px;'), 'CSS should provide the first-paint warning panel position without JavaScript measurement');
assert(styles.includes('.canvas-warning-collapsed'), 'Warning panel should have a collapsed state to avoid blocking modeling');
assert(!canvasManagerSource.includes('requestAnimationFrame(positionCanvasWarningPanelDefault)'), 'Warning panel startup should not force a layout measurement after DOM hydration');
assert(!canvasManagerSource.includes('initCanvasWarningPanelWindow();\n    positionCanvasWarningPanelDefault();'), 'Warning panel content updates should not force geometry reads during startup');
assert(canvasManagerSource.includes('function summarizeWarningDetail(detail)'), 'Warning panel should summarize long details on canvas');
assert(canvasManagerSource.includes('item.dataset.fullDetail = summary.fullDetail'), 'Warning panel should preserve full detail on each warning item');
assert(canvasManagerSource.includes('requestUserTaskObjectProperties(nodeId)'), 'Clicking a warning should open the object task window for full context');
assert(canvasManagerSource.includes('collapseCanvasWarningPanelForModeling();\n    captureState();'), 'Adding equipment should collapse warnings before modeling placement');
assert(indexHtml.includes('id="canvasWarningPanel" aria-label="Equipment warnings" aria-live="polite" hidden'), 'Warning panel should be hidden on initial render until warnings exist');
assert(indexHtml.includes('id="canvasWarningToggle"'), 'Warning panel should expose a collapse/expand control');

console.log(JSON.stringify({
    passed: true,
    minClamp,
    maxClamp,
    defaultPosition,
    preservedViewportOffset: {
        left: panel.dataset.viewportLeft,
        top: panel.dataset.viewportTop
    },
    warningVisibility: {
        hiddenWhenEmpty: true,
        countWhenWarning: count.textContent
    }
}, null, 2));
