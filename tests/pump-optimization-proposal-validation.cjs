const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const scriptFiles = [
    'formulas/constants.js',
    'properties/objects/pump-properties.js',
    'properties/objects/pipe-properties.js',
    'properties/objects/valve-properties.js',
    'formulas/objects/pipe-formulas.js',
    'formulas/objects/valve-formulas.js',
    'formulas/objects/hydraulic-network-formulas.js',
    'formulas/objects/pump-formulas.js'
];

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

vm.runInContext(`
var globalModel = {};
var connections = [];
var sourceLinks = [];
`, context, { filename: 'test-prelude.js' });

scriptFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    vm.runInContext(fs.readFileSync(fullPath, 'utf8'), context, { filename: file });
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertClose(label, actual, expected, tolerance) {
    const delta = Math.abs(actual - expected);
    if (!Number.isFinite(actual) || delta > tolerance) {
        throw new Error(`${label}: expected ${expected}, got ${actual} (delta ${delta})`);
    }
}

function evaluateOptimizationCase(options = {}) {
    return vm.runInContext(`
(() => {
    const options = ${JSON.stringify(options)};
    Object.keys(globalModel).forEach(key => delete globalModel[key]);
    Object.assign(globalModel, {
        FLUID: {
            type: 'fluid',
            name: 'Fluid Basis',
            props: {
                density: 997,
                viscosity: 0.893,
                vaporPressure: 0.0317,
                sg: 0.997
            }
        },
        'SRC-100': {
            type: 'source',
            name: 'SRC-100',
            props: {
                sourceType: 'Standalone Boundary Source',
                boundaryDataSource: 'Manual',
                flowInputMode: options.sourceFlowMode || 'Solve from Network',
                pressureInputBasis: 'Gauge',
                pressure: options.sourcePressure ?? 0.35,
                elevation: options.sourceElevation ?? 3,
                flow: options.sourceFlow ?? 20
            }
        },
        'PIPE-1': {
            type: 'pipe',
            name: 'PIPE-1',
            props: {
                routeStyle: 'Straight',
                elevationProfileMode: 'End Elevations',
                segments: [{
                    name: 'Suction segment',
                    pipeSize: 'Custom diameter',
                    material: 'Commercial steel',
                    diameter: options.suctionDiameter ?? 0.15,
                    length: options.suctionLength ?? 12,
                    roughness: 0.000045,
                    startElevation: options.sourceElevation ?? 3,
                    endElevation: options.pumpElevation ?? 0,
                    fittingType: 'None',
                    fittingQuantity: 0,
                    fittingK: 0,
                    minorLoss: 1
                }]
            }
        },
        'P-100': {
            type: 'pump',
            name: 'P-100',
            props: {
                ...PUMP_DEFAULT_PROPS,
                elevation: options.pumpElevation ?? 0,
                suctionElevation: options.pumpElevation ?? 0,
                dischargeElevation: options.pumpElevation ?? 0,
                npshMarginBasis: options.marginBasis || PUMP_NPSH_MARGIN_USER_DEFINED,
                minNpshMarginRatio: options.minRatio ?? '',
                minNpshMargin: options.minMargin ?? ''
            },
            results: {}
        },
        'PIPE-2': {
            type: 'pipe',
            name: 'PIPE-2',
            props: {
                routeStyle: 'Straight',
                elevationProfileMode: 'End Elevations',
                segments: [{
                    name: 'Discharge segment',
                    pipeSize: 'Custom diameter',
                    material: 'Commercial steel',
                    diameter: options.dischargeDiameter ?? 0.1,
                    length: options.dischargeLength ?? 55,
                    roughness: 0.000045,
                    startElevation: options.pumpElevation ?? 0,
                    endElevation: options.sinkElevation ?? 8,
                    fittingType: 'None',
                    fittingQuantity: 0,
                    fittingK: 0,
                    minorLoss: 3
                }]
            }
        },
        'SNK-100': {
            type: 'sink',
            name: 'SNK-100',
            props: {
                active: 'Active',
                boundaryMode: options.sinkBoundaryMode || 'Flow Demand Boundary',
                pressureInputBasis: 'Gauge',
                pressure: 0,
                pressureBasis: 'Static',
                demandFlow: options.demandFlow ?? 20,
                elevation: options.sinkElevation ?? 8
            }
        }
    });
    connections.splice(0, connections.length);
    if (options.attachSource !== false) {
        connections.push({ from: 'SRC-100', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1' });
    }
    connections.push({ from: 'P-100', fromPort: '.port.outlet', to: 'SNK-100', toPort: '.port.inlet', pipeId: 'PIPE-2' });
    sourceLinks.splice(0, sourceLinks.length);

    const readiness = getPumpOptimizationReadiness('P-100');
    const proposal = buildPumpOptimizationProposal('P-100');
    const applyResult = applyPumpOptimizationProposal('P-100', globalModel, proposal);
    const npsh = applyResult.ok ? runPumpNpshEvaluation('P-100') : null;
    return {
        readiness,
        proposal,
        applyResult,
        npsh,
        props: { ...globalModel['P-100'].props }
    };
})()
`, context);
}

const readyCase = evaluateOptimizationCase();
assert(readyCase.readiness.canRun, `Expected optimization readiness, got ${readyCase.readiness.status}`);
assert(readyCase.proposal.canApply, `Expected applicable proposal, got warnings: ${(readyCase.proposal.warnings || []).join(' | ')}`);
assertClose('target flow follows SNK demand', readyCase.proposal.targetFlow, 20, 0.001);
assert(readyCase.proposal.requiredSystemHead > 0, 'Expected positive required system head');
assert(readyCase.proposal.npshaAtDesign > 0, 'Expected positive NPSHa at design flow');
assert(readyCase.proposal.maxAllowableNpshr > 0, 'Expected positive allowable NPSHr');
assert(readyCase.proposal.proposedProps.npshrSourceMode === 'Manual', 'Expected Manual NPSHr source proposal');
assert(readyCase.proposal.proposedProps.npshAssessmentMode === 'ANSI/HI Guided', 'Expected ANSI/HI guided proposal');
assert(readyCase.proposal.proposedProps.npshMarginBasis === 'General Purpose', 'Expected standard margin basis when user-defined limits are blank');
assert(readyCase.proposal.proposedProps.designFlow === 20, 'Expected design flow to be populated from network demand');
assert(readyCase.proposal.proposedProps.bepFlow === 20, 'Expected BEP flow to align with design flow candidate');
assert(readyCase.proposal.envelope.points.length >= 5, 'Expected AOR envelope scan points');
assert(readyCase.proposal.rows.some(row => row.parameter === 'Design Head'), 'Expected Design Head proposal row');
assert(readyCase.applyResult.ok, `Expected apply to succeed: ${(readyCase.applyResult.warnings || []).join(' | ')}`);
assert(readyCase.props.designHead > 0, 'Expected applied design head');
assert(readyCase.props.designNpshr > 0, 'Expected applied NPSHr');
assert(readyCase.props.porMinPercent === 70 && readyCase.props.aorMaxPercent === 130, 'Expected POR/AOR defaults to be populated');
assert(readyCase.npsh.status === 'Safe', `Expected post-apply NPSH Safe, got ${readyCase.npsh.status}`);

const preservedUserBasis = evaluateOptimizationCase({
    marginBasis: 'User Defined',
    minRatio: 1.2,
    minMargin: 1.5
});
assert(preservedUserBasis.proposal.proposedProps.npshMarginBasis === 'User Defined', 'Expected valid user-defined margin basis to be preserved');
assert(preservedUserBasis.proposal.proposedProps.minNpshMarginRatio === 1.2, 'Expected user-defined ratio to be preserved');
assert(preservedUserBasis.proposal.proposedProps.minNpshMargin === 1.5, 'Expected user-defined margin to be preserved');

const incompleteCase = evaluateOptimizationCase({ attachSource: false });
assert(!incompleteCase.readiness.canRun, 'Expected incomplete network to block optimization readiness');
assert(!incompleteCase.proposal.canApply, 'Expected incomplete network proposal to be non-applicable');
assert(incompleteCase.proposal.status === 'Incomplete network', `Expected incomplete network status, got ${incompleteCase.proposal.status}`);

const summary = {
    passed: true,
    readyCase: {
        status: readyCase.proposal.status,
        designFlow: readyCase.props.designFlow,
        designHead: readyCase.props.designHead,
        designNpshr: readyCase.props.designNpshr,
        npshStatus: readyCase.npsh.status,
        envelopePoints: readyCase.proposal.envelope.points.length
    },
    preservedUserBasis: {
        marginBasis: preservedUserBasis.proposal.proposedProps.npshMarginBasis,
        minRatio: preservedUserBasis.proposal.proposedProps.minNpshMarginRatio,
        minMargin: preservedUserBasis.proposal.proposedProps.minNpshMargin
    },
    incompleteCase: {
        status: incompleteCase.proposal.status,
        warnings: incompleteCase.proposal.warnings
    }
};

console.log(JSON.stringify(summary, null, 2));
