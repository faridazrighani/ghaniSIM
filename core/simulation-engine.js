function updatePumpResultReadouts(pump) {
    setSidebarReadout('result-flow', pump.results.flow, 'm3/h');
    setSidebarReadout('result-head', pump.results.head, 'm');
    setSidebarReadout('result-efficiency', pump.results.efficiency, '%');
    setSidebarReadout('result-power', pump.results.power, 'kW');
    setSidebarReadout('result-npsha', pump.results.npsha, 'm');
    setSidebarReadout('result-npshr', pump.results.npshr, 'm');
}

function updatePumpChart(pumpId) {
    const pump = globalModel[pumpId];
    if (!pumpChartInstance || !pump || pump.type !== 'pump' || !pump.results) return;

    pumpChartInstance.data.labels = pump.results.sysCurve.map(d => d[0]);
    pumpChartInstance.data.datasets[0].data = pump.results.pumpCurve.map(d => d[1]);
    pumpChartInstance.data.datasets[1].data = pump.results.sysCurve.map(d => d[1]);
    pumpChartInstance.update('none');
}

function getInstrumentLink(instrumentId) {
    const instrument = globalModel[instrumentId];
    const attachedTo = instrument && instrument.props ? instrument.props.attachedTo : null;
    return instrumentLinks.find(link => link.instrumentId === instrumentId)
        || (attachedTo ? { instrumentId, pipeId: attachedTo, location: 0.5 } : null);
}

function formatCanvasReadoutValue(value, digits = 2) {
    if (value === null || value === undefined || value === '') return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toFixed(digits);
}

function updateLineMonitorCanvasReadout(instrumentId) {
    const instrument = globalModel[instrumentId];
    if (!instrument || instrument.type !== 'lineMonitor' || typeof getObjectElement !== 'function') return;

    const objectEl = getObjectElement(instrumentId);
    if (!objectEl) return;

    const setValue = (key, value, digits) => {
        const cell = objectEl.querySelector(`[data-readout-key="${key}"]`);
        if (cell) cell.textContent = formatCanvasReadoutValue(value, digits);
    };

    const props = instrument.props || {};
    setValue('pressure', props.measuredPressure, 2);
    setValue('temperature', props.measuredTemperature, 1);
    setValue('flow', props.measuredFlow, 2);
    objectEl.classList.toggle('is-attached', !!props.attachedTo);
}

function updateInstrumentReadout(instrumentId) {
    const instrument = globalModel[instrumentId];
    if (!instrument || !isInstrumentType(instrument.type)) return;

    if (!instrument.props) instrument.props = {};
    const link = getInstrumentLink(instrumentId);
    const pipeId = link ? link.pipeId : '';
    const readout = calculatePipeInstrumentMeasurement(instrument, pipeId, globalModel, connections, link ? link.location : 0.5);

    instrument.props.attachedTo = pipeId;
    if (instrument.type === 'lineMonitor') {
        const values = readout.values || {};
        const percents = readout.percents || {};
        instrument.props.measuredPressure = values.pressure ?? null;
        instrument.props.measuredFlow = values.flow ?? null;
        instrument.props.measuredTemperature = values.temperature ?? null;
        instrument.props.pressureSignal = percents.pressure ?? null;
        instrument.props.flowSignal = percents.flow ?? null;
        instrument.props.temperatureSignal = percents.temperature ?? null;
    } else {
        instrument.props.measuredValue = readout.value;
        instrument.props.measuredUnit = readout.unit;
        instrument.props.measuredPercent = readout.percent;
    }

    updateLineMonitorCanvasReadout(instrumentId);

    if (currentSelectedNode === instrumentId) {
        setSidebarReadout('instrument-attached-to', pipeId || '-');
        if (instrument.type === 'lineMonitor') {
            setSidebarReadout('instrument-pressure', instrument.props.measuredPressure, 'bar');
            setSidebarReadout('instrument-flow', instrument.props.measuredFlow, 'm3/h');
            setSidebarReadout('instrument-temperature', instrument.props.measuredTemperature, 'deg C');
        } else {
            setSidebarReadout('instrument-measured', readout.value, readout.unit);
            setSidebarReadout('instrument-signal', readout.percent, readout.percent === null ? '' : '%');
        }
    }
}

function updateAllInstrumentReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (isInstrumentType(globalModel[nodeId].type)) {
            updateInstrumentReadout(nodeId);
        }
    });
}

function updateSimulation(options = {}) {
    const { renderSidebarAfter = true } = options;
    const fluid = globalModel['FLUID'];
    if (!fluid) return;

    const density = fluid.props.density; 
    const vaporPressure = fluid.props.vaporPressure * 100000; // bar to Pa
    
    // Sync vapor pressure to all tanks
    const tanks = Object.keys(globalModel).filter(k => globalModel[k].type === 'tank');
    tanks.forEach(tankId => {
        globalModel[tankId].props.vaporPressure = fluid.props.vaporPressure;
    });

    resetHydraulicPipeResults(globalModel);
    
    const pumps = Object.keys(globalModel).filter(k => globalModel[k].type === 'pump');
    
    pumps.forEach(pumpId => {
        const pump = globalModel[pumpId];
        ensureNodeResults(pump);

        const hydraulicContext = createPumpHydraulicContext(pumpId, globalModel, connections, density, vaporPressure);
        
        pump.results.sysCurve = [];
        pump.results.pumpCurve = [];
        
        let getPumpHead, getPumpEfficiency, getPumpNPSHr;
        
        if (pump.props && pump.props.inputMode === 'Advanced' && pump.props.curveData && pump.props.curveData.length > 0) {
            // Helper for linear interpolation
            const interpolate = (q, key) => {
                const data = [...pump.props.curveData].sort((a, b) => a.flow - b.flow);
                if (q <= data[0].flow) return data[0][key];
                if (q >= data[data.length - 1].flow) return data[data.length - 1][key];
                for (let i = 0; i < data.length - 1; i++) {
                    if (q >= data[i].flow && q <= data[i+1].flow) {
                        const t = (q - data[i].flow) / (data[i+1].flow - data[i].flow);
                        return data[i][key] + t * (data[i+1][key] - data[i][key]);
                    }
                }
                return 0;
            };
            getPumpHead = (q) => interpolate(q, 'head');
            getPumpEfficiency = (q) => interpolate(q, 'eff');
            getPumpNPSHr = (q) => interpolate(q, 'npshr');
        } else {
            // Basic Mode
            const qD = pump.props ? (pump.props.designFlow || 100) : 100;
            const hD = pump.props ? (pump.props.designHead || 40) : 40;
            const eD = pump.props ? (pump.props.designEfficiency || 75) : 75;
            
            const A = hD * 1.33; // Approx shutoff
            const B = (A - hD) / Math.pow(qD, 2);
            
            getPumpHead = (q) => A - B * Math.pow(q, 2);
            getPumpEfficiency = (q) => {
                let e = eD - Math.abs(qD - q) * (eD / qD); // simplistic linear peak at qD
                return e > 10 ? e : 10;
            };
            getPumpNPSHr = (q) => {
                return 2 + (q / 100) * 2; // generic NPSHr
            };
        }
        
        const calcSysHead = (q) => {
            const systemHead = calculatePumpSystemHead(hydraulicContext, q);
            return systemHead === null ? 0 : systemHead;
        };
        
        const STEP = 5;
        let maxConfiguredFlow = 150;
        if (pump.props && pump.props.inputMode === 'Advanced' && pump.props.curveData && pump.props.curveData.length > 0) {
            maxConfiguredFlow = Math.max(150, ...pump.props.curveData.map(pt => pt.flow || 0));
        } else if (pump.props) {
            maxConfiguredFlow = Math.max(150, (pump.props.designFlow || 100) * 1.5);
        }
        const MAX_FLOW = Math.ceil(maxConfiguredFlow / STEP) * STEP;
        let opFlow = null, opHead = null;
        
        for (let q = 0; q <= MAX_FLOW; q += STEP) {
            const pHead = getPumpHead(q);
            const sHead = calcSysHead(q);
            
            pump.results.sysCurve.push([q, sHead]);
            pump.results.pumpCurve.push([q, pHead]);
            
            if (opFlow === null && q > 0) {
                const prevP = getPumpHead(q - STEP);
                const prevS = calcSysHead(q - STEP);
                if (prevP >= prevS && pHead <= sHead) {
                    const slopeP = (pHead - prevP) / STEP;
                    const slopeS = (sHead - prevS) / STEP;
                    opFlow = (prevS - prevP + slopeP * (q - STEP) - slopeS * (q - STEP)) / (slopeP - slopeS);
                    opHead = getPumpHead(opFlow);
                }
            }
        }
        
        if (opFlow === null && hydraulicContext.isComplete) {
            const maxDiff = getPumpHead(MAX_FLOW) - calcSysHead(MAX_FLOW);
            if (maxDiff > 0) {
                opFlow = MAX_FLOW;
                opHead = getPumpHead(opFlow);
            }
        }

        if (opFlow !== null && hydraulicContext.isComplete) {
            const eff = getPumpEfficiency(opFlow);
            const power = (opFlow * opHead * density * GRAVITY) / (3.6e6 * (eff/100));
            const hydraulicSnapshot = calculatePumpHydraulicSnapshot(hydraulicContext, opFlow, opHead);
            applyHydraulicPathResults(hydraulicContext, hydraulicSnapshot, opFlow);
            pump.results.flow = opFlow.toFixed(2);
            pump.results.head = opHead.toFixed(2);
            pump.results.power = power.toFixed(2);
            pump.results.npsha = hydraulicSnapshot.npsha.toFixed(2);
            pump.results.npshr = getPumpNPSHr(opFlow).toFixed(2);
            pump.results.efficiency = eff.toFixed(2);
            pump.results.suctionPressure = hydraulicSnapshot.suctionPressureBar.toFixed(3);
            pump.results.dischargePressure = hydraulicSnapshot.dischargePressureBar.toFixed(3);
            pump.results.suctionLoss = hydraulicSnapshot.suctionLoss.toFixed(2);
            pump.results.dischargeLoss = hydraulicSnapshot.dischargeLoss.toFixed(2);
        } else {
            pump.results.flow = 0;
            pump.results.head = 0;
            pump.results.power = 0;
            pump.results.npsha = 0;
            pump.results.npshr = 0;
            pump.results.efficiency = 0;
            pump.results.suctionPressure = 0;
            pump.results.dischargePressure = 0;
            pump.results.suctionLoss = 0;
            pump.results.dischargeLoss = 0;
        }
        
        if (currentSelectedNode === pumpId || activeChartPumpId === pumpId) {
            updatePumpChart(pumpId);
        }

        if (currentSelectedNode === pumpId) {
            updatePumpResultReadouts(pump);
        }
    });

    updateAllInstrumentReadouts();

    if (renderSidebarAfter && currentSelectedNode && !isSidebarEditActive()) {
        renderSidebar(currentSelectedNode);
    }
}
