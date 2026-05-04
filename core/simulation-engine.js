function updatePumpResultReadouts(pump) {
    setSidebarReadout('result-flow', pump.results.flow, 'm3/h');
    setSidebarReadout('result-head', pump.results.head, 'm');
    setSidebarReadout('result-efficiency', pump.results.efficiency, '%');
    setSidebarReadout('result-power', pump.results.power, 'kW');
    setSidebarReadout('result-npsha', pump.results.npsha, 'm');
    setSidebarReadout('result-npshr', pump.results.npshr, 'm');
    setSidebarReadout('result-npsh-margin', pump.results.npshMargin, 'm');
    setSidebarReadout('result-npsh-ratio', pump.results.npshRatio, '');
    setSidebarReadout('result-bep-percent', pump.results.bepPercent, '% BEP');
    setSidebarReadout('result-operating-region', pump.results.operatingRegion, '');
    setSidebarReadout('result-status', pump.results.status, '');
    setSidebarReadout('result-warnings', (pump.results.warnings || []).join(' | ') || 'OK', '');
}

function updatePumpChart(pumpId) {
    const pump = globalModel[pumpId];
    if (!pumpChartInstance || !pump || pump.type !== 'pump' || !pump.results) return;

    pumpChartInstance.data.labels = pump.results.sysCurve.map(d => d[0]);
    pumpChartInstance.data.datasets[0].data = pump.results.pumpCurve.map(d => d[1]);
    pumpChartInstance.data.datasets[1].data = pump.results.sysCurve.map(d => d[1]);
    pumpChartInstance.update('none');
}

function resetPumpCalculatedResults(pump, status, warnings = []) {
    pump.results.flow = null;
    pump.results.head = null;
    pump.results.efficiency = null;
    pump.results.power = null;
    pump.results.npsha = null;
    pump.results.npshr = null;
    pump.results.npshMargin = null;
    pump.results.npshRatio = null;
    pump.results.bepPercent = null;
    pump.results.operatingRegion = '-';
    pump.results.status = status;
    pump.results.warnings = warnings;
    pump.results.suctionPressure = null;
    pump.results.dischargePressure = null;
    pump.results.suctionLoss = null;
    pump.results.dischargeLoss = null;
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

    if (typeof syncAllSourceTemperaturesFromFluidBasis === 'function') {
        syncAllSourceTemperaturesFromFluidBasis();
    }

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

        const performanceModel = createPumpPerformanceModel(pump);
        const getPumpHead = performanceModel.getHead;
        const getPumpEfficiency = performanceModel.getEfficiency;
        const getPumpNPSHr = performanceModel.getNpshr;
        
        const calcSysHead = (q) => {
            const systemHead = calculatePumpSystemHead(hydraulicContext, q);
            return systemHead === null ? null : systemHead;
        };
        
        const STEP = 5;
        const MAX_FLOW = Math.ceil(Math.max(STEP, performanceModel.maxFlow) / STEP) * STEP;
        let opFlow = null, opHead = null;
        let previousPoint = null;
        let firstDiff = null;
        let lastDiff = null;
        
        for (let q = 0; q <= MAX_FLOW; q += STEP) {
            const pHead = getPumpHead(q);
            const sHead = calcSysHead(q);
            
            pump.results.sysCurve.push([q, sHead]);
            pump.results.pumpCurve.push([q, pHead]);
            
            if (opFlow === null && sHead !== null) {
                const diff = pHead - sHead;
                if (firstDiff === null) firstDiff = diff;
                lastDiff = diff;

                if (Math.abs(diff) < 1e-9) {
                    opFlow = q;
                    opHead = pHead;
                } else if (previousPoint && previousPoint.diff >= 0 && diff <= 0) {
                    const denominator = previousPoint.diff - diff;
                    const ratio = denominator === 0 ? 0 : previousPoint.diff / denominator;
                    opFlow = previousPoint.q + (q - previousPoint.q) * ratio;
                    opHead = getPumpHead(opFlow);
                }

                previousPoint = { q, pHead, sHead, diff };
            }
        }

        if (opFlow !== null && hydraulicContext.isComplete) {
            const eff = getPumpEfficiency(opFlow);
            const hydraulicPower = (opFlow * opHead * density * GRAVITY) / 3.6e6;
            const power = eff > 0 ? hydraulicPower / (eff / 100) : null;
            const hydraulicSnapshot = calculatePumpHydraulicSnapshot(hydraulicContext, opFlow, opHead);
            if (!hydraulicSnapshot) {
                resetPumpCalculatedResults(pump, 'Incomplete calculation', ['Unable to calculate hydraulic snapshot at operating point.']);
                return;
            }
            const npshr = getPumpNPSHr(opFlow);
            const npshEvaluation = evaluateNpshMargin(hydraulicSnapshot.npsha, npshr, pump.props);
            const operatingRegion = classifyPumpOperatingRegion(opFlow, pump.props);
            const warnings = [];

            if (operatingRegion.status === 'AOR') {
                warnings.push('Operating point is outside POR; review reliability/efficiency.');
            } else if (operatingRegion.status === 'Outside AOR') {
                warnings.push('Operating point is outside configured AOR.');
            }

            if (npshEvaluation.status !== 'OK') {
                warnings.push(npshEvaluation.message);
            }

            if (eff <= 0) {
                warnings.push('Pump efficiency is zero or invalid at operating point.');
            }

            applyHydraulicPathResults(hydraulicContext, hydraulicSnapshot, opFlow);
            pump.results.flow = opFlow.toFixed(2);
            pump.results.head = opHead.toFixed(2);
            pump.results.power = power === null ? null : power.toFixed(2);
            pump.results.npsha = hydraulicSnapshot.npsha.toFixed(2);
            pump.results.npshr = npshr.toFixed(2);
            pump.results.npshMargin = npshEvaluation.margin === null ? null : npshEvaluation.margin.toFixed(2);
            pump.results.npshRatio = npshEvaluation.ratio === null ? null : npshEvaluation.ratio.toFixed(2);
            pump.results.bepPercent = operatingRegion.percent.toFixed(1);
            pump.results.operatingRegion = operatingRegion.status;
            pump.results.status = warnings.length ? 'Warning' : 'OK';
            pump.results.warnings = warnings;
            pump.results.efficiency = eff.toFixed(2);
            pump.results.suctionPressure = hydraulicSnapshot.suctionPressureBar.toFixed(3);
            pump.results.dischargePressure = hydraulicSnapshot.dischargePressureBar.toFixed(3);
            pump.results.suctionLoss = hydraulicSnapshot.suctionLoss.toFixed(2);
            pump.results.dischargeLoss = hydraulicSnapshot.dischargeLoss.toFixed(2);
        } else {
            const warnings = [];
            if (!hydraulicContext.isComplete) {
                warnings.push('Hydraulic network is incomplete from suction boundary to discharge boundary.');
                resetPumpCalculatedResults(pump, 'Incomplete network', warnings);
            } else if (firstDiff !== null && firstDiff < 0) {
                warnings.push('Pump shutoff head is below system static head; no operating point.');
                resetPumpCalculatedResults(pump, 'No intersection', warnings);
            } else if (lastDiff !== null && lastDiff > 0) {
                warnings.push('No pump/system intersection within pump curve range; likely runout/outside curve.');
                resetPumpCalculatedResults(pump, 'Outside curve', warnings);
            } else {
                warnings.push('No stable pump/system operating point found.');
                resetPumpCalculatedResults(pump, 'No operating point', warnings);
            }
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
