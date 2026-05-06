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

function getIncompleteHydraulicNetworkWarnings(hydraulicContext, downstreamLabel = 'active downstream SNK') {
    const warnings = [];
    if (!hydraulicContext?.suctionBoundary) {
        warnings.push('Connect an upstream SRC to the pump or upstream equipment before solving flow.');
    }
    if (!hydraulicContext?.dischargeBoundary) {
        warnings.push(`Connect an ${downstreamLabel} before solving flow.`);
    }
    return warnings.length ? warnings : ['Hydraulic network is incomplete.'];
}

function refreshPumpUiReadouts(pumpId, pump) {
    if (currentSelectedNode === pumpId || activeChartPumpId === pumpId) {
        updatePumpChart(pumpId);
    }

    if (currentSelectedNode === pumpId) {
        updatePumpResultReadouts(pump);
    }
}

function applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, density, performanceModel, additionalWarnings = []) {
    const eff = performanceModel.getEfficiency(opFlow);
    const hydraulicPower = (opFlow * opHead * density * GRAVITY) / 3.6e6;
    const power = eff > 0 ? hydraulicPower / (eff / 100) : null;
    const npshr = performanceModel.getNpshr(opFlow);
    const npshEvaluation = evaluateNpshMargin(hydraulicSnapshot.npsha, npshr, pump.props);
    const operatingRegion = classifyPumpOperatingRegion(opFlow, pump.props);
    const warnings = [...additionalWarnings];

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

function getOrientedHydraulicConnection(conn) {
    return typeof orientHydraulicConnection === 'function'
        ? orientHydraulicConnection(conn, globalModel)
        : conn;
}

function getSinkPipeConnection(sinkId) {
    return (connections || [])
        .map(getOrientedHydraulicConnection)
        .find(conn => conn.to === sinkId || conn.from === sinkId) || null;
}

function getSinkPipeConnections(sinkId) {
    return (connections || [])
        .map(getOrientedHydraulicConnection)
        .filter(conn => conn.to === sinkId || conn.from === sinkId);
}

function getPipePressureForNodeSide(pipe, conn, nodeId) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    if (conn.to === nodeId && pipe.results.outletPressure !== null && pipe.results.outletPressure !== undefined) {
        return parseFloat(pipe.results.outletPressure);
    }
    if (conn.from === nodeId && pipe.results.inletPressure !== null && pipe.results.inletPressure !== undefined) {
        return parseFloat(pipe.results.inletPressure);
    }
    return pipe.results.pressure === null || pipe.results.pressure === undefined ? null : parseFloat(pipe.results.pressure);
}

function getPipeStagnationPressureForNodeSide(pipe, conn, nodeId) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    if (conn.to === nodeId && pipe.results.outletStagnationPressure !== null && pipe.results.outletStagnationPressure !== undefined) {
        return parseFloat(pipe.results.outletStagnationPressure);
    }
    if (conn.from === nodeId && pipe.results.inletStagnationPressure !== null && pipe.results.inletStagnationPressure !== undefined) {
        return parseFloat(pipe.results.inletStagnationPressure);
    }
    return null;
}

function getPipeHydraulicHeadForNodeSide(pipe, conn, nodeId) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    if (conn.to === nodeId && pipe.results.outletHydraulicHead !== null && pipe.results.outletHydraulicHead !== undefined) {
        return parseFloat(pipe.results.outletHydraulicHead);
    }
    if (conn.from === nodeId && pipe.results.inletHydraulicHead !== null && pipe.results.inletHydraulicHead !== undefined) {
        return parseFloat(pipe.results.inletHydraulicHead);
    }
    return pipe.results.hydraulicHead === null || pipe.results.hydraulicHead === undefined ? null : parseFloat(pipe.results.hydraulicHead);
}

function getTankPipeConnections(tankId) {
    return (connections || [])
        .map(getOrientedHydraulicConnection)
        .filter(conn => conn.to === tankId || conn.from === tankId);
}

function averageFiniteValues(values) {
    const valid = (values || []).filter(value => Number.isFinite(value));
    if (valid.length === 0) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function updateTankPressureReadout(tankId) {
    const tank = globalModel[tankId];
    if (!tank || tank.type !== 'tank') return;
    if (typeof normalizeTankProps === 'function') normalizeTankProps(tank);
    ensureNodeResults(tank);

    const fluid = globalModel.FLUID;
    const vaporPressure = parseFloat(fluid?.props?.vaporPressure);
    if (Number.isFinite(vaporPressure)) {
        tank.props.vaporPressure = vaporPressure;
    }

    const tankConnections = getTankPipeConnections(tankId);
    const sidePressures = [];
    const sideStagnationPressures = [];
    let inletPressure = null;
    let outletPressure = null;

    tankConnections.forEach(conn => {
        const pipe = globalModel[conn.pipeId];
        const staticPressure = getPipePressureForNodeSide(pipe, conn, tankId);
        const stagnationPressure = getPipeStagnationPressureForNodeSide(pipe, conn, tankId);

        if (Number.isFinite(staticPressure)) {
            sidePressures.push(staticPressure);
            if (conn.to === tankId && inletPressure === null) inletPressure = staticPressure;
            if (conn.from === tankId && outletPressure === null) outletPressure = staticPressure;
        }
        if (Number.isFinite(stagnationPressure)) {
            sideStagnationPressures.push(stagnationPressure);
        }
    });

    const safety = typeof evaluateTankPressureSafety === 'function'
        ? evaluateTankPressureSafety(tank.props, fluid?.props || {})
        : { status: '-', warnings: [], suggestedPressure: 0, suggestedBasis: 'Not available' };
    const warnings = [...safety.warnings];

    if (tankConnections.length > 0 && sidePressures.length === 0) {
        warnings.push('Connected pipe pressure is not solved; connect upstream SRC and downstream SNK to calculate flow.');
    }

    tank.results.connectedPipes = tankConnections.map(conn => conn.pipeId);
    tank.results.calculatedPressure = averageFiniteValues(sidePressures);
    tank.results.inletPressure = inletPressure;
    tank.results.outletPressure = outletPressure;
    tank.results.stagnationPressure = averageFiniteValues(sideStagnationPressures);
    tank.results.vaporPressure = Number.isFinite(vaporPressure) ? Number(vaporPressure.toFixed(4)) : null;
    tank.results.suggestedPsv = safety.suggestedPressure;
    tank.results.psvBasis = safety.suggestedBasis;
    tank.results.status = warnings.length ? 'Review' : 'OK';
    tank.results.warnings = warnings;

    if (currentSelectedNode === tankId) {
        setSidebarReadout('tank-connected-pipes', tank.results.connectedPipes.join(', ') || '-', '');
        setSidebarReadout('tank-calculated-pressure', tank.results.calculatedPressure === null ? null : Number(tank.results.calculatedPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-inlet-pressure', tank.results.inletPressure === null ? null : Number(tank.results.inletPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-outlet-pressure', tank.results.outletPressure === null ? null : Number(tank.results.outletPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-stagnation-pressure', tank.results.stagnationPressure === null ? null : Number(tank.results.stagnationPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-vapor-pressure', tank.results.vaporPressure, 'bar a');
        setSidebarReadout('tank-suggested-psv', tank.results.suggestedPsv, 'bar a');
        setSidebarReadout('tank-psv-basis', tank.results.psvBasis, '');
        setSidebarReadout('psvSet', tank.props.psvSet, 'bar a');
        setSidebarReadout('tank-status', tank.results.status, '');
        setSidebarReadout('tank-warnings', warnings.join(' | ') || 'OK', '');
    }
}

function updateAllTankReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'tank') {
            updateTankPressureReadout(nodeId);
        }
    });
}

function updateSinkReadout(sinkId) {
    const sink = globalModel[sinkId];
    if (!sink || sink.type !== 'sink') return;
    if (typeof normalizeSinkProps === 'function') normalizeSinkProps(sink);
    ensureNodeResults(sink);

    const fluid = globalModel.FLUID;
    const density = Math.max(parseFloat(fluid?.props?.density) || 1000, 1);
    const temperature = parseFloat(fluid?.props?.temp);
    const vaporPressure = parseFloat(fluid?.props?.vaporPressure);
    const sinkConnections = getSinkPipeConnections(sinkId);
    const conn = sinkConnections[0] || null;
    const pipe = conn ? globalModel[conn.pipeId] : null;
    const flow = pipe && pipe.results && pipe.results.pressureCalculated ? parseFloat(pipe.results.flow) : null;
    const staticPressure = getPipePressureForNodeSide(pipe, conn || {}, sinkId);
    const stagnationPressure = getPipeStagnationPressureForNodeSide(pipe, conn || {}, sinkId);
    const calculatedPressure = sink.props.pressureBasis === 'Stagnation'
        ? stagnationPressure
        : staticPressure;
    const boundaryPressure = parseFloat(sink.props.pressure);
    const selectedPressure = Number.isFinite(calculatedPressure) ? calculatedPressure : boundaryPressure;
    const elevation = parseFloat(sink.props.elevation) || 0;
    const hydraulicHead = getPipeHydraulicHeadForNodeSide(pipe, conn || {}, sinkId)
        ?? (Number.isFinite(selectedPressure) ? pressureBarToHead(selectedPressure, density) + elevation : null);
    const pressureResidual = sink.props.boundaryMode === SINK_BOUNDARY_MODE_PRESSURE
        && Number.isFinite(calculatedPressure)
        && Number.isFinite(boundaryPressure)
            ? calculatedPressure - boundaryPressure
            : null;
    const warnings = [];

    if (sink.props.active === SINK_INACTIVE) {
        warnings.push('Sink is inactive and is not used as a hydraulic boundary.');
    }
    if (sinkConnections.length === 0) {
        warnings.push('Sink is not connected to a pipeline.');
    }
    if (conn && (!pipe || !pipe.results || !pipe.results.pressureCalculated)) {
        warnings.push('Connected pipe has no solved hydraulic result.');
    }
    if (sink.props.pressureBasis === 'Static' && sinkConnections.length > 1) {
        warnings.push('Static pressure boundary should connect to one pipe only; use Stagnation for reservoir/header style boundaries.');
    }
    if (sink.props.boundaryMode === SINK_BOUNDARY_MODE_FLOW && (parseFloat(sink.props.demandFlow) || 0) <= 0) {
        warnings.push('Flow Demand must be greater than zero.');
    }
    if (sink.props.boundaryMode === SINK_BOUNDARY_MODE_PRESSURE && Number.isFinite(pressureResidual) && Math.abs(pressureResidual) > 0.02) {
        warnings.push('Boundary pressure residual exceeds 0.02 bar; check convergence or boundary basis.');
    }
    if (sink.props.boundaryMode === SINK_BOUNDARY_MODE_PRESSURE && Number.isFinite(boundaryPressure) && boundaryPressure <= 0) {
        warnings.push('Outlet Pressure is absolute pressure; use 1.013 bar a for atmospheric discharge.');
    }
    if (Number.isFinite(selectedPressure) && Number.isFinite(vaporPressure) && selectedPressure <= vaporPressure) {
        warnings.push('Calculated outlet pressure is at or below fluid vapor pressure.');
    }

    sink.results.attachedPipe = conn ? conn.pipeId : '';
    sink.results.boundaryPressure = Number.isFinite(boundaryPressure) ? Number(boundaryPressure.toFixed(3)) : null;
    sink.results.calculatedPressure = Number.isFinite(calculatedPressure) ? Number(calculatedPressure.toFixed(3)) : null;
    sink.results.staticPressure = Number.isFinite(staticPressure) ? Number(staticPressure.toFixed(3)) : null;
    sink.results.stagnationPressure = Number.isFinite(stagnationPressure) ? Number(stagnationPressure.toFixed(3)) : null;
    sink.results.pressureResidual = Number.isFinite(pressureResidual) ? Number(pressureResidual.toFixed(4)) : null;
    sink.results.flow = Number.isFinite(flow) ? Number(flow.toFixed(3)) : null;
    sink.results.massFlow = Number.isFinite(flow) ? Number((flow * density).toFixed(3)) : null;
    sink.results.temperature = Number.isFinite(temperature) ? Number(temperature.toFixed(3)) : null;
    sink.results.hydraulicHead = Number.isFinite(hydraulicHead) ? Number(hydraulicHead.toFixed(3)) : null;
    sink.results.pressureBasis = sink.props.pressureBasis;
    sink.results.boundaryMode = sink.props.boundaryMode;
    sink.results.status = warnings.length ? 'Warning' : 'OK';
    sink.results.warnings = warnings;

    if (currentSelectedNode === sinkId) {
        setSidebarReadout('sink-attached-pipe', sink.results.attachedPipe || '-');
        setSidebarReadout('sink-boundary-pressure', sink.results.boundaryPressure, 'bar a');
        setSidebarReadout('sink-calculated-pressure', sink.results.calculatedPressure, 'bar a');
        setSidebarReadout('sink-static-pressure', sink.results.staticPressure, 'bar a');
        setSidebarReadout('sink-stagnation-pressure', sink.results.stagnationPressure, 'bar a');
        setSidebarReadout('sink-pressure-residual', sink.results.pressureResidual, 'bar');
        setSidebarReadout('sink-flow', sink.results.flow, 'm3/h');
        setSidebarReadout('sink-mass-flow', sink.results.massFlow, 'kg/h');
        setSidebarReadout('sink-temperature', sink.results.temperature, 'deg C');
        setSidebarReadout('sink-hydraulic-head', sink.results.hydraulicHead, 'm');
        setSidebarReadout('sink-status', sink.results.status, '');
        setSidebarReadout('sink-warnings', warnings.join(' | ') || 'OK', '');
    }
}

function updateAllSinkReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'sink') {
            updateSinkReadout(nodeId);
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
    if (typeof normalizeAllSinkProps === 'function') {
        normalizeAllSinkProps();
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
        
        const calcSysHead = (q) => {
            const systemHead = calculatePumpSystemHead(hydraulicContext, q);
            return systemHead === null ? null : systemHead;
        };
        
        const STEP = 5;
        const flowDemand = isSinkFlowDemandBoundary(hydraulicContext.dischargeBoundary)
            ? Math.max(0, parseFloat(hydraulicContext.dischargeBoundary.props.demandFlow) || 0)
            : null;
        const MAX_FLOW = Math.ceil(Math.max(STEP, performanceModel.maxFlow, flowDemand || 0) / STEP) * STEP;

        if (flowDemand !== null) {
            const demandHead = getPumpHead(flowDemand);
            for (let q = 0; q <= MAX_FLOW; q += STEP) {
                pump.results.pumpCurve.push([q, getPumpHead(q)]);
                pump.results.sysCurve.push([q, Math.abs(q - flowDemand) <= STEP / 2 ? demandHead : null]);
            }

            if (!hydraulicContext.isComplete) {
                resetPumpCalculatedResults(pump, 'Incomplete network', getIncompleteHydraulicNetworkWarnings(hydraulicContext, 'active downstream flow-demand SNK'));
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            if (flowDemand <= 0) {
                resetPumpCalculatedResults(pump, 'Invalid flow demand', ['Flow Demand must be greater than zero.']);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            if (flowDemand < performanceModel.minFlow || flowDemand > performanceModel.maxFlow) {
                resetPumpCalculatedResults(pump, 'Outside curve', ['Flow Demand is outside the pump curve range; required pressure is not reliable.']);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            const hydraulicSnapshot = calculatePumpFlowDemandSnapshot(hydraulicContext, flowDemand, demandHead);
            if (!hydraulicSnapshot) {
                resetPumpCalculatedResults(pump, 'Incomplete calculation', ['Unable to calculate flow-demand hydraulic snapshot.']);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            const demandWarnings = [];
            const selectedPressure = hydraulicContext.dischargeBoundary.props.pressureBasis === 'Stagnation'
                ? hydraulicSnapshot.sinkStagnationPressureBar
                : hydraulicSnapshot.sinkStaticPressureBar;
            if (selectedPressure <= 0) {
                demandWarnings.push('Calculated outlet pressure is at or below 0 bar a for this flow demand.');
            }

            applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, flowDemand, demandHead, density, performanceModel, demandWarnings);
            refreshPumpUiReadouts(pumpId, pump);
            return;
        }

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
            const hydraulicSnapshot = calculatePumpHydraulicSnapshot(hydraulicContext, opFlow, opHead);
            if (!hydraulicSnapshot) {
                resetPumpCalculatedResults(pump, 'Incomplete calculation', ['Unable to calculate hydraulic snapshot at operating point.']);
                return;
            }
            applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, density, performanceModel);
        } else {
            const warnings = [];
            if (!hydraulicContext.isComplete) {
                resetPumpCalculatedResults(pump, 'Incomplete network', getIncompleteHydraulicNetworkWarnings(hydraulicContext));
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
        
        refreshPumpUiReadouts(pumpId, pump);
    });

    updateAllInstrumentReadouts();
    updateAllTankReadouts();
    updateAllSinkReadouts();

    if (renderSidebarAfter && currentSelectedNode && !isSidebarEditActive()) {
        renderSidebar(currentSelectedNode);
    }
}
