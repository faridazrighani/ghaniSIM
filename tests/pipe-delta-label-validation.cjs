const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const elementMap = {};
const svg = {
    _html: '',
    set innerHTML(value) {
        this._html = value;
    },
    get innerHTML() {
        return this._html;
    },
    querySelectorAll() {
        return [];
    }
};
const canvas = {
    scrollLeft: 0,
    scrollTop: 0,
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 800, height: 480 };
    }
};

function createPort(left, top) {
    return {
        getBoundingClientRect() {
            return { left, top, width: 12, height: 12 };
        }
    };
}

function createObjectElement(portMap) {
    return {
        classList: { contains: () => false },
        querySelector(selector) {
            return portMap[selector] || null;
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, width: 40, height: 40 };
        }
    };
}

elementMap['SRC-100'] = createObjectElement({
    '.port.outlet': createPort(20, 40)
});
elementMap['P-100'] = createObjectElement({
    '.port.inlet': createPort(220, 40),
    '.port.outlet': createPort(280, 40)
});
elementMap['SNK-100'] = createObjectElement({
    '.port.inlet': createPort(480, 40)
});
elementMap.canvas = canvas;
elementMap['svg-lines'] = svg;

const context = {
    console,
    Math,
    Number,
    parseFloat,
    globalModel: {},
    connections: [],
    instrumentLinks: [],
    sourceLinks: [],
    pendingConnectionStart: null,
    currentSelectedNode: null,
    appMode: 'SELECT',
    document: {
        getElementById(id) {
            return elementMap[id] || null;
        },
        querySelectorAll() {
            return [];
        }
    },
    getObjectElement(id) {
        return elementMap[id] || null;
    }
};
context.window = context;
vm.createContext(context);

[
    'formulas/constants.js',
    'core/unit-system.js',
    'ui/connections-renderer.js'
].forEach(file => {
    vm.runInContext(
        fs.readFileSync(path.join(projectRoot, file), 'utf8'),
        context,
        { filename: file }
    );
});

vm.runInContext(`
globalModel['PIPE-1'] = {
    type: 'pipe',
    name: 'PIPE-1',
    props: { routeStyle: 'Straight' },
    results: {
        pressureCalculated: true,
        inletPressure: 4.25,
        outletPressure: 3.75,
        pressureDrop: 0.5,
        staticPressureDelta: 0.5
    }
};
connections.splice(0, connections.length, {
    from: 'SRC-100',
    fromPort: '.port.outlet',
    to: 'P-100',
    toPort: '.port.inlet',
    pipeId: 'PIPE-1'
});
drawConnections();
`, context);

assert(svg.innerHTML.includes('class="pipe-delta-label"'), 'Solved pipe should render a delta pressure label');
assert(svg.innerHTML.includes('rotate(0.0)'), 'Horizontal pipe label should render with a zero-degree rotation');
assert(svg.innerHTML.includes('ΔP loss 0.5 bar'), 'Metric label should show compact pressure loss in bar');
assert(svg.innerHTML.includes('ΔP loss 0.500 bar'), 'Delta label title should include pressure loss basis');
assert(svg.innerHTML.includes('Pin 4.250 bar a'), 'Delta label title should include inlet pressure');
assert(svg.innerHTML.includes('Pout 3.750 bar a'), 'Delta label title should include outlet pressure');
assert(svg.innerHTML.includes('Pin-Pout 0.500 bar'), 'Delta label title should preserve endpoint static pressure audit');

vm.runInContext(`
setUnitStandard('US Customary', { markDirty: false });
drawConnections();
`, context);
assert(svg.innerHTML.includes('ΔP loss 7.252 psi'), 'US unit profile should show pressure loss in psi');

vm.runInContext(`
globalModel['PIPE-1'].results.pressureCalculated = false;
delete globalModel['PIPE-1'].results.pressureDrop;
delete globalModel['PIPE-1'].results.inletPressure;
delete globalModel['PIPE-1'].results.outletPressure;
drawConnections();
`, context);
assert(svg.innerHTML.includes('class="pipe-delta-label"'), 'Unsolved pipe should still render a delta pressure label placeholder');
assert(svg.innerHTML.includes('P loss -'), 'Unsolved pipe should show a delta pressure placeholder until simulation results arrive');
assert(svg.innerHTML.includes('loss not calculated yet'), 'Unsolved pipe title should explain that calculation is pending');

vm.runInContext(`
globalModel['PIPE-1'].results.pressureCalculated = true;
globalModel['PIPE-1'].results.inletPressure = 4.25;
globalModel['PIPE-1'].results.outletPressure = 3.75;
globalModel['PIPE-1'].results.pressureDrop = 0.5;
drawConnections();
var diagonalLabel = getPipeDeltaPressureLabelSvg('PIPE-1', [{ x: 0, y: 0 }, { x: 100, y: 50 }]);
var reverseDiagonalLabel = getPipeDeltaPressureLabelSvg('PIPE-1', [{ x: 100, y: 50 }, { x: 0, y: 0 }]);
var shortPipeLabel = getPipeDeltaPressureLabelSvg('PIPE-1', [{ x: 0, y: 0 }, { x: 24, y: 0 }]);
`, context);
assert(context.diagonalLabel.includes('rotate(26.6)'), 'Diagonal pipe label should rotate parallel to the pipe segment');
assert(context.reverseDiagonalLabel.includes('rotate(26.6)'), 'Reverse diagonal pipe label should normalize rotation so text is not upside down');
assert(context.diagonalLabel.includes('height="15"'), 'Pipe delta label background should be compact vertically');
assert(context.shortPipeLabel.includes('class="pipe-delta-label"'), 'Short pipes should still render a delta pressure label');

const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const hydraulicNetwork = fs.readFileSync(path.join(projectRoot, 'formulas/objects/hydraulic-network-formulas.js'), 'utf8');
const simulationEngine = fs.readFileSync(path.join(projectRoot, 'core/simulation-engine.js'), 'utf8');

assert(styles.includes('.pipe-delta-label'), 'CSS should include pipe delta label styling');
assert(styles.includes('pointer-events: none'), 'Pipe delta labels should not block pipe selection');
assert(styles.includes('font-size: 9px'), 'Pipe delta label text should be compact');
assert(hydraulicNetwork.includes('pressureDrop = Number(Math.max(0, pressureHeadToBar(inletHead - outletHead, density)).toFixed(3))'), 'Pipe results should expose pressureDrop from hydraulic head loss converted to pressure');
assert(hydraulicNetwork.includes('staticPressureDelta: Number((inletPressure - outletPressure).toFixed(3))'), 'Pipe results should preserve endpoint static pressure difference for audit');
assert(simulationEngine.includes("if (typeof drawConnections === 'function')"), 'Simulation update should refresh pipe labels after solving');

console.log(JSON.stringify({
    passed: true,
    labelRendered: true,
    metricDisplay: 'ΔP loss 0.5 bar',
    usDisplay: 'ΔP loss 7.252 psi',
    diagonalRotation: true,
    unsolvedPlaceholder: true
}, null, 2));
