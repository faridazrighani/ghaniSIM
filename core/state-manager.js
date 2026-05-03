// --- Global Data Model ---
let appMode = 'SELECT';
let pendingConnectionStart = null;
let onCanvasMouseMove = null;
let connections = [
    { from: 'TK-100', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1' },
    { from: 'P-100', fromPort: '.port.outlet', to: 'TK-101', toPort: '.port.inlet', pipeId: 'PIPE-2' }
];
let instrumentLinks = [];

const INSTRUMENT_TYPES = ['pressureIndicator', 'flowIndicator', 'temperatureIndicator', 'lineMonitor', 'levelController'];

const globalModel = {
    "FLUID":  { 
        type: "fluid", 
        name: "Fluid & Duty", 
        props: { 
            inputMode: "Basic",
            fluidName: "Palm Oil", 
            temp: 60, 
            density: 883.47,
            sg: 0.8835, 
            viscosity: 24.75,
            dynViscosity: 21.87,
            vaporPressure: 0.001,
            specificHeat: 2.0,
            bulkModulus: 1.8,
            specVolume: 0.001132,
            specWeight: 8666.8,
            speedOfSound: 1427.3
        } 
    },
    "TK-100": { type: "tank", name: "TK-100", desc: "Storage Tank", props: { ...getDefaultProps('tank'), elevation: 5 } },
    "PIPE-1": { type: "pipe", name: "PIPE-1", desc: "Suction Line", props: { minorLoss: 2.5, segments: [{ name: "Suction 12 in", pipeSize: "Custom diameter", diameter: 0.15, length: 20, roughness: 0.000045 }] } },
    "P-100":  { type: "pump", name: "P-100", desc: "Transfer Pump", props: getDefaultProps('pump'), results: { flow: 0, head: 0, power: 0, npsha: 0, npshr: 0 } },
    "PIPE-2": { type: "pipe", name: "PIPE-2", desc: "Discharge Line", props: { minorLoss: 5.0, segments: [{ name: "Discharge 4 in", pipeSize: "Custom diameter", diameter: 0.1, length: 300, roughness: 0.000045 }] } },
    "TK-101": { type: "tank", name: "TK-101", desc: "Processing Tank", props: { ...getDefaultProps('tank'), elevation: 25 } }
};

let currentSelectedNode = null;
let pumpChartInstance = null;
let activeChartPumpId = null;
let nextPipeRouteStyle = 'Straight';

// --- State Modifiers ---

function createDefaultResults(type) {
    if (type !== 'pump') return null;

    return {
        flow: 0,
        head: 0,
        efficiency: 0,
        power: 0,
        npsha: 0,
        npshr: 0,
        suctionPressure: 0,
        dischargePressure: 0,
        sysCurve: [],
        pumpCurve: []
    };
}

function ensureNodeResults(node) {
    if (!node.results) {
        node.results = createDefaultResults(node.type) || {};
    }
    return node.results;
}

function cancelPendingConnection(redraw = true) {
    if (onCanvasMouseMove) {
        document.removeEventListener('pointermove', onCanvasMouseMove);
    }
    pendingConnectionStart = null;
    onCanvasMouseMove = null;
    if (redraw) drawConnections();
}

function attachInstrumentToPipe(instrumentId, pipeId) {
    const instrument = globalModel[instrumentId];
    const pipe = globalModel[pipeId];
    if (!instrument || !pipe || !isInstrumentType(instrument.type) || pipe.type !== 'pipe') return;

    instrumentLinks = instrumentLinks.filter(link => link.instrumentId !== instrumentId);
    instrumentLinks.push({ instrumentId, pipeId, location: 0.5 });
    instrument.props.attachedTo = pipeId;
    cancelPendingConnection(false);
    updateSimulation({ renderSidebarAfter: false });
    selectNode(instrumentId, getObjectElement(instrumentId));
    drawConnections();
}

function detachInstrumentFromPipe(instrumentId) {
    const instrument = globalModel[instrumentId];
    if (!instrument || !isInstrumentType(instrument.type)) return;

    instrumentLinks = instrumentLinks.filter(link => link.instrumentId !== instrumentId);
    if (instrument.props) {
        instrument.props.attachedTo = '';
        instrument.props.measuredValue = null;
        instrument.props.measuredPercent = null;
        instrument.props.measuredPressure = null;
        instrument.props.measuredFlow = null;
        instrument.props.measuredTemperature = null;
        instrument.props.pressureSignal = null;
        instrument.props.flowSignal = null;
        instrument.props.temperatureSignal = null;
    }

    if (currentSelectedNode === instrumentId) {
        renderSidebar(instrumentId);
    }
    drawConnections();
}

function disconnectPipe(pipeId, options = {}) {
    const { recordHistory = true } = options;
    const hadConnection = connections.some(conn => conn.pipeId === pipeId);
    if (!hadConnection && !globalModel[pipeId]) return;

    if (recordHistory) captureState();

    if (pendingConnectionStart) cancelPendingConnection(false);

    instrumentLinks = instrumentLinks.filter(link => {
        if (link.pipeId !== pipeId) return true;
        const instrument = globalModel[link.instrumentId];
        if (instrument && instrument.props) {
            instrument.props.attachedTo = '';
            instrument.props.measuredValue = null;
            instrument.props.measuredPercent = null;
            instrument.props.measuredPressure = null;
            instrument.props.measuredFlow = null;
            instrument.props.measuredTemperature = null;
            instrument.props.pressureSignal = null;
            instrument.props.flowSignal = null;
            instrument.props.temperatureSignal = null;
        }
        return false;
    });

    connections = connections.filter(conn => conn.pipeId !== pipeId);
    delete globalModel[pipeId];

    if (currentSelectedNode === pipeId) {
        clearSelection();
    }

    drawConnections();
    updateSimulation({ renderSidebarAfter: currentSelectedNode !== null });
}

function deleteNode(nodeId) {
    if (nodeId === 'FLUID' || !globalModel[nodeId]) return;
    
    captureState();

    if (globalModel[nodeId].type === 'pipe') {
        disconnectPipe(nodeId, { recordHistory: false });
        return;
    }
    
    if (isInstrumentType(globalModel[nodeId].type)) {
        detachInstrumentFromPipe(nodeId);
    }
    
    const connectedPipes = connections.filter(c => c.from === nodeId || c.to === nodeId).map(c => c.pipeId);
    connectedPipes.forEach(pipeId => disconnectPipe(pipeId, { recordHistory: false }));
    
    delete globalModel[nodeId];
    
    const el = document.getElementById('obj-' + nodeId.toLowerCase().replace(/-/g, ''));
    if (el) el.remove();
    
    if (currentSelectedNode === nodeId) {
        clearSelection();
    }
    
    drawConnections();
    updateSimulation();
}
