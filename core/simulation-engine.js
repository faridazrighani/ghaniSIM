const LEVEL_CONTROLLER_TREND_HISTORY_LIMIT = 80;
const DYNAMIC_INVENTORY_DEFAULT_STEP_SECONDS = 60;
const DYNAMIC_INVENTORY_DEFAULT_REALTIME_INTERVAL_MS = 60000;
const DYNAMIC_INVENTORY_STEP_OPTIONS = [5, 60, 300, 600];
const DYNAMIC_INVENTORY_REALTIME_INTERVAL_OPTIONS = [5000, 30000, 60000];
let levelControllerTrendSampleIndex = 0;
let suppressLevelControllerTrendRecording = false;

function toFiniteTrendNumber(value) {
    const numeric = parseFloat(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeLevelControllerTrendSample(sample, fallbackIndex = 1) {
    if (!sample || typeof sample !== 'object') return null;
    const level = toFiniteTrendNumber(sample.level);
    if (level === null) return null;
    const index = toFiniteTrendNumber(sample.index);
    const timestamp = toFiniteTrendNumber(sample.timestamp);
    const trendText = typeof sample.trend === 'string' && sample.trend.length <= 40
        ? sample.trend
        : '-';
    const targetId = typeof sample.targetId === 'string'
        ? sample.targetId.slice(0, 80)
        : '';

    return {
        index: index === null ? fallbackIndex : index,
        timestamp: timestamp === null ? null : timestamp,
        targetId,
        level,
        setPointLevel: toFiniteTrendNumber(sample.setPointLevel),
        levelPercent: toFiniteTrendNumber(sample.levelPercent),
        hll: toFiniteTrendNumber(sample.hll),
        nll: toFiniteTrendNumber(sample.nll),
        lll: toFiniteTrendNumber(sample.lll),
        netFlow: toFiniteTrendNumber(sample.netFlow),
        levelRate: toFiniteTrendNumber(sample.levelRate),
        simulationTimeSeconds: toFiniteTrendNumber(sample.simulationTimeSeconds),
        trend: trendText
    };
}

function sanitizeLevelControllerTrendHistory(history = []) {
    if (!Array.isArray(history)) return [];
    const sanitized = [];
    history.slice(-LEVEL_CONTROLLER_TREND_HISTORY_LIMIT).forEach(sample => {
        const item = sanitizeLevelControllerTrendSample(sample, sanitized.length + 1);
        if (item) sanitized.push(item);
    });
    return sanitized;
}

function syncLevelControllerTrendSampleIndex(history = []) {
    const maxIndex = history.reduce((max, sample) => {
        const index = toFiniteTrendNumber(sample?.index);
        return index === null ? max : Math.max(max, index);
    }, 0);
    if (maxIndex > levelControllerTrendSampleIndex) {
        levelControllerTrendSampleIndex = maxIndex;
    }
}

function normalizeLevelControllerTrendView(view = {}, historyLength = 0) {
    const hasHistory = historyLength > 0;
    const rawIndex = toFiniteTrendNumber(view?.sampleIndex);
    const sampleIndex = hasHistory
        ? Math.min(Math.max(Math.round(rawIndex === null ? historyLength : rawIndex), 1), historyLength)
        : 0;
    return {
        mode: hasHistory && view?.mode === 'rewind' ? 'rewind' : 'live',
        sampleIndex
    };
}

function normalizeAllLevelControllerTrendHistoriesForSave(model = (typeof globalModel !== 'undefined' ? globalModel : {})) {
    Object.keys(model || {}).forEach(nodeId => {
        const instrument = model[nodeId];
        if (!instrument || instrument.type !== 'levelController') return;
        if (!instrument.results) instrument.results = {};
        const history = sanitizeLevelControllerTrendHistory(instrument.results.levelTrendHistory);
        instrument.results.levelTrendHistory = history;
        instrument.results.levelTrendView = normalizeLevelControllerTrendView(
            instrument.results.levelTrendView,
            history.length
        );
        syncLevelControllerTrendSampleIndex(history);
    });
    return model;
}

function restoreLevelControllerTrendState(model = (typeof globalModel !== 'undefined' ? globalModel : {})) {
    return normalizeAllLevelControllerTrendHistoriesForSave(model);
}

function recordLevelControllerTrendSample(instrument, values = {}) {
    if (!instrument || instrument.type !== 'levelController') return;
    if (suppressLevelControllerTrendRecording) return;
    if (!instrument.results) instrument.results = {};

    const targetId = values.targetId || instrument.props?.attachedTo || '';
    const level = toFiniteTrendNumber(values.level);
    if (!targetId || level === null) {
        instrument.results.levelTrendStatus = 'Waiting for tank/vessel level attachment';
        return;
    }

    const history = sanitizeLevelControllerTrendHistory(instrument.results.levelTrendHistory)
        .slice(-LEVEL_CONTROLLER_TREND_HISTORY_LIMIT + 1);
    syncLevelControllerTrendSampleIndex(history);
    const sampleIndex = ++levelControllerTrendSampleIndex;
    history.push({
        index: sampleIndex,
        timestamp: typeof Date !== 'undefined' && Date.now ? Date.now() : sampleIndex,
        targetId,
        level,
        setPointLevel: toFiniteTrendNumber(values.setPointLevel),
        levelPercent: toFiniteTrendNumber(values.levelPercent),
        hll: toFiniteTrendNumber(values.hll),
        nll: toFiniteTrendNumber(values.nll),
        lll: toFiniteTrendNumber(values.lll),
        netFlow: toFiniteTrendNumber(values.netFlow),
        levelRate: toFiniteTrendNumber(values.levelRate),
        simulationTimeSeconds: toFiniteTrendNumber(values.simulationTimeSeconds),
        trend: values.levelTrend || '-'
    });

    instrument.results.levelTrendHistory = history;
    const trendView = normalizeLevelControllerTrendView(instrument.results.levelTrendView, history.length);
    if (trendView.mode === 'live') trendView.sampleIndex = history.length;
    instrument.results.levelTrendView = trendView;
    instrument.results.levelTrendStatus = `${values.levelTrend || '-'} level; ${history.length} sample${history.length === 1 ? '' : 's'}`;
}

function updatePumpResultReadouts(pump) {
    const statusClass = typeof getPumpEvaluationStatusClass === 'function'
        ? getPumpEvaluationStatusClass(pump.results.cavitationStatus || pump.results.status)
        : 'neutral';
    setSidebarReadout('result-flow', pump.results.flow, 'm3/h');
    setSidebarReadout('result-head', pump.results.head, 'm');
    setSidebarReadout('result-efficiency', pump.results.efficiency, '%');
    setSidebarReadout('result-power', pump.results.power, 'kW');
    setSidebarReadout('result-suction-pressure', pump.results.suctionPressure, 'bar a');
    setSidebarReadout('result-discharge-pressure', pump.results.dischargePressure, 'bar a');
    setSidebarReadout('result-suction-loss', pump.results.suctionLoss, 'm');
    setSidebarReadout('result-suction-velocity-head', pump.results.suctionVelocityHead, 'm');
    setSidebarReadout('result-vapor-pressure-head', pump.results.vaporPressureHead, 'm');
    setSidebarReadout('result-npsha', pump.results.npsha, 'm');
    setSidebarReadout('result-npshr', pump.results.npshr, 'm');
    setSidebarReadout('result-npshr-source', pump.results.npshrSource || '-', '');
    setSidebarReadout('result-npsh-margin', pump.results.npshMargin, 'm');
    setSidebarReadout('result-npsh-ratio', pump.results.npshRatio, '');
    setSidebarReadout('result-required-npsha', pump.results.requiredNpsha, 'm');
    setSidebarReadout('result-npsh-excess', pump.results.npshExcess, 'm');
    setSidebarReadout('result-npsh-margin-basis', pump.results.npshMarginBasis || '-', '');
    setSidebarReadout('result-cavitation-status', pump.results.cavitationStatus || '-', '');
    setSidebarReadout('result-dominant-loss', pump.results.dominantSuctionLoss || '-', '');
    setSidebarReadout('result-engineering-notes', (pump.results.engineeringNotes || []).join(' | ') || '-', '');
    document.querySelectorAll('.pump-notes[data-key="result-engineering-notes"]').forEach(wrapper => {
        const notes = (pump.results.engineeringNotes || []).filter(Boolean);
        if (notes.length === 0) {
            wrapper.innerHTML = '<span class="pump-notes-empty">-</span>';
            return;
        }

        const list = document.createElement('ul');
        notes.forEach(note => {
            const item = document.createElement('li');
            item.textContent = note;
            list.appendChild(item);
        });
        wrapper.replaceChildren(list);
    });
    if (typeof updatePumpSuctionLossBreakdownReadout === 'function') {
        updatePumpSuctionLossBreakdownReadout(pump);
    }
    if (typeof updatePumpCalculationTraceReadout === 'function') {
        updatePumpCalculationTraceReadout(pump);
    }
    setSidebarReadout('result-bep-percent', pump.results.bepPercent, '% BEP');
    setSidebarReadout('result-operating-region', pump.results.operatingRegion, '');
    setSidebarReadout('result-status', pump.results.status, '');
    setSidebarReadout('result-warnings', (pump.results.warnings || []).join(' | ') || 'OK', '');
    setSidebarReadout('result-solve-mode', pump.results.solveMode || '-', '');
    setSidebarReadout('result-flow-basis', pump.results.flowBasis || '-', '');
    setSidebarReadout('result-fixed-flow', pump.results.fixedFlow, 'm3/h');
    setSidebarReadout('result-required-system-head', pump.results.requiredSystemHead, 'm');
    setSidebarReadout('result-pump-head-at-flow', pump.results.pumpHeadAtFlow, 'm');
    setSidebarReadout('result-head-residual', pump.results.headResidual, 'm');
    setSidebarReadout('result-pressure-residual', pump.results.pressureResidual, 'bar');
    setSidebarReadout('result-downstream-boundary', pump.results.downstreamBoundary || '-', '');
    setSidebarReadout('result-curve-source', pump.results.curveSource || '-', '');
    setSidebarReadout('result-model-basis', pump.results.modelBasis || '-', '');
    setSidebarReadout('result-model-warnings', (pump.results.modelWarnings || []).join(' | ') || 'None', '');
    document.querySelectorAll('[data-key="result-cavitation-status"]').forEach(el => {
        el.classList.remove(
            'pump-eval-status-safe',
            'pump-eval-status-warning',
            'pump-eval-status-risk',
            'pump-eval-status-incomplete',
            'pump-eval-status-neutral'
        );
        el.classList.add('pump-eval-status', `pump-eval-status-${statusClass}`);
    });
}

function buildPumpChartSeries(curve = [], xConverter = value => value, yConverter = value => value) {
    if (!Array.isArray(curve)) return [];
    return curve
        .map(point => {
            const rawX = Array.isArray(point) ? point[0] : point?.x;
            const rawY = Array.isArray(point) ? point[1] : point?.y;
            const x = parseFloat(xConverter(rawX));
            const y = rawY === null || rawY === undefined ? null : parseFloat(yConverter(rawY));
            return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
        })
        .filter(Boolean);
}

function calculatePumpChartAxisBounds(seriesList = []) {
    const points = seriesList.flatMap(series => Array.isArray(series) ? series : []);
    const xValues = points.map(point => point.x).filter(Number.isFinite);
    const yValues = points.map(point => point.y).filter(Number.isFinite);
    if (!xValues.length || !yValues.length) {
        return {
            x: { min: 0, max: 10 },
            y: { min: 0, max: 10 }
        };
    }

    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const xSpan = Math.max(maxX, 1);
    const ySpan = Math.max(maxY - Math.min(0, minY), Math.abs(maxY), 1);
    const xPadding = xSpan * 0.06;
    const yPadding = ySpan * 0.08;

    return {
        x: {
            min: 0,
            max: maxX + xPadding
        },
        y: {
            min: minY >= 0 ? 0 : minY - yPadding,
            max: maxY + yPadding
        }
    };
}

function updatePumpChart(pumpId) {
    const pump = globalModel[pumpId];
    if (!pumpChartInstance || !pump || pump.type !== 'pump' || !pump.results) return;

    const flowUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('flow') : 'm3/h';
    const headUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('head') : 'm';
    const toFlow = value => typeof convertToDisplay === 'function' ? convertToDisplay(value, 'flow') : value;
    const toHead = value => value === null || value === undefined
        ? value
        : (typeof convertToDisplay === 'function' ? convertToDisplay(value, 'head') : value);

    const pumpHeadSeries = buildPumpChartSeries(pump.results.pumpCurve, toFlow, toHead);
    const systemCurveSeries = buildPumpChartSeries(pump.results.sysCurve, toFlow, toHead);
    const axisBounds = calculatePumpChartAxisBounds([pumpHeadSeries, systemCurveSeries]);

    pumpChartInstance.data.labels = [];
    pumpChartInstance.data.datasets[0].data = pumpHeadSeries;
    pumpChartInstance.data.datasets[1].data = systemCurveSeries;
    if (pumpChartInstance.options?.scales?.x?.title) {
        pumpChartInstance.options.scales.x.title.text = `Flow Rate (${flowUnit})`;
    }
    if (pumpChartInstance.options?.scales?.y?.title) {
        pumpChartInstance.options.scales.y.title.text = `Head (${headUnit})`;
    }
    if (pumpChartInstance.options?.scales?.x) {
        pumpChartInstance.options.scales.x.type = 'linear';
        pumpChartInstance.options.scales.x.min = axisBounds.x.min;
        pumpChartInstance.options.scales.x.max = axisBounds.x.max;
    }
    if (pumpChartInstance.options?.scales?.y) {
        pumpChartInstance.options.scales.y.min = axisBounds.y.min;
        pumpChartInstance.options.scales.y.max = axisBounds.y.max;
    }
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
    pump.results.requiredNpsha = null;
    pump.results.npshExcess = null;
    pump.results.npshMarginBasis = '-';
    pump.results.npshMarginBasisRegion = '-';
    pump.results.bepPercent = null;
    pump.results.operatingRegion = '-';
    pump.results.status = status;
    pump.results.warnings = warnings;
    pump.results.suctionPressure = null;
    pump.results.dischargePressure = null;
    pump.results.suctionLoss = null;
    pump.results.dischargeLoss = null;
    pump.results.suctionVelocityHead = null;
    pump.results.vaporPressureHead = null;
    pump.results.vaporPressureBasis = null;
    pump.results.vaporPressureLive = null;
    pump.results.npshrSource = '-';
    pump.results.cavitationStatus = status;
    pump.results.dominantSuctionLoss = '-';
    pump.results.engineeringNotes = [];
    pump.results.npshEvaluation = null;
    pump.results.solveMode = '-';
    pump.results.flowBasis = '-';
    pump.results.fixedFlow = null;
    pump.results.requiredSystemHead = null;
    pump.results.pumpHeadAtFlow = null;
    pump.results.headResidual = null;
    pump.results.pressureResidual = null;
    pump.results.downstreamBoundary = '-';
}

function getIncompleteHydraulicNetworkWarnings(hydraulicContext, downstreamLabel = 'active downstream SNK') {
    const warnings = [];
    if (hydraulicContext?.networkWarnings?.length) {
        warnings.push(...hydraulicContext.networkWarnings);
    }
    if (!hydraulicContext?.suctionBoundary && !hydraulicContext?.suctionPath?.isUnsupported) {
        const hasSemanticSourceWarning = warnings.some(warning => String(warning).includes('but no hydraulic path exists'));
        if (!hasSemanticSourceWarning) {
            warnings.push('Connect an upstream SRC to the pump or upstream equipment before solving flow.');
        }
    }
    if (!hydraulicContext?.dischargeBoundary && !hydraulicContext?.dischargePath?.isUnsupported) {
        warnings.push(`Connect an ${downstreamLabel} before solving flow.`);
    }
    return warnings.length ? warnings : ['Hydraulic network is incomplete.'];
}

function updatePumpPerformanceMetadata(pump, performanceModel) {
    if (!pump || !pump.results || !performanceModel) return;
    pump.results.curveSource = performanceModel.source || '-';
    pump.results.modelBasis = performanceModel.modelBasis || '-';
    pump.results.modelWarnings = performanceModel.warnings || [];
}

function refreshPumpUiReadouts(pumpId, pump) {
    if (currentSelectedNode === pumpId || activeChartPumpId === pumpId) {
        updatePumpChart(pumpId);
    }

    if (currentSelectedNode === pumpId) {
        updatePumpResultReadouts(pump);
    }
}

function applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, density, performanceModel, additionalWarnings = [], solveInfo = {}) {
    updatePumpPerformanceMetadata(pump, performanceModel);
    const eff = performanceModel.getEfficiency(opFlow);
    const hydraulicPower = (opFlow * opHead * density * GRAVITY) / 3.6e6;
    const power = eff > 0 ? hydraulicPower / (eff / 100) : null;
    const npshr = performanceModel.getNpshr(opFlow);
    const operatingRegion = classifyPumpOperatingRegion(opFlow, pump.props);
    const npshEvaluation = typeof applyPumpNpshrSourceQualityToEvaluation === 'function'
        ? applyPumpNpshrSourceQualityToEvaluation(
            evaluateNpshMargin(hydraulicSnapshot.npsha, npshr, pump.props, operatingRegion.status),
            performanceModel,
            pump.props
        )
        : evaluateNpshMargin(hydraulicSnapshot.npsha, npshr, pump.props, operatingRegion.status);
    const detailedNpshEvaluation = typeof buildPumpNpshEvaluationResult === 'function'
        ? buildPumpNpshEvaluationResult(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, performanceModel)
        : null;
    const warnings = [...new Set([
        ...additionalWarnings,
        ...((hydraulicContext?.networkWarnings || []).filter(Boolean))
    ])];

    if (operatingRegion.status === 'AOR') {
        warnings.push('Operating point is outside POR; review reliability/efficiency.');
    } else if (operatingRegion.status === 'Outside AOR') {
        warnings.push('Operating point is outside configured AOR.');
    } else if (operatingRegion.status === 'Unknown') {
        warnings.push(operatingRegion.message);
    }

    if (npshEvaluation.status !== 'Safe') {
        warnings.push(npshEvaluation.message);
    }

    if (eff <= 0) {
        warnings.push('Pump efficiency is zero or invalid at operating point.');
    }

    applyHydraulicPathResults(hydraulicContext, hydraulicSnapshot, opFlow);
    [...(hydraulicContext.suctionPath?.steps || []), ...(hydraulicContext.dischargePath?.steps || [])].forEach(step => {
        const pipeWarnings = globalModel[step.pipeId]?.results?.warnings || [];
        pipeWarnings.forEach(warning => {
            if (warning && !warnings.includes(warning)) warnings.push(warning);
        });
    });
    pump.results.flow = opFlow.toFixed(2);
    pump.results.head = opHead.toFixed(2);
    pump.results.power = power === null ? null : power.toFixed(2);
    pump.results.npsha = hydraulicSnapshot.npsha.toFixed(2);
    pump.results.npshr = npshr.toFixed(2);
    pump.results.npshrSource = typeof getPumpNpshrSourceLabel === 'function'
        ? getPumpNpshrSourceLabel(performanceModel)
        : performanceModel.source || '-';
    pump.results.npshMargin = npshEvaluation.margin === null ? null : npshEvaluation.margin.toFixed(2);
    pump.results.npshRatio = npshEvaluation.ratio === null ? null : npshEvaluation.ratio.toFixed(2);
    pump.results.requiredNpsha = npshEvaluation.requiredNpsha === null ? null : npshEvaluation.requiredNpsha.toFixed(2);
    pump.results.npshExcess = npshEvaluation.npshExcess === null ? null : npshEvaluation.npshExcess.toFixed(2);
    pump.results.npshMarginBasis = npshEvaluation.criteria?.basis || '-';
    pump.results.npshMarginBasisRegion = npshEvaluation.criteria?.regionBasis || '-';
    pump.results.cavitationStatus = npshEvaluation.status;
    pump.results.bepPercent = operatingRegion.percent === null ? null : operatingRegion.percent.toFixed(1);
    pump.results.operatingRegion = operatingRegion.status;
    pump.results.status = warnings.length ? 'Warning' : (solveInfo.statusWhenOk || 'OK');
    pump.results.warnings = warnings;
    pump.results.efficiency = eff.toFixed(2);
    pump.results.suctionPressure = hydraulicSnapshot.suctionPressureBar.toFixed(3);
    pump.results.dischargePressure = hydraulicSnapshot.dischargePressureBar.toFixed(3);
    pump.results.suctionLoss = hydraulicSnapshot.suctionLoss.toFixed(2);
    pump.results.dischargeLoss = hydraulicSnapshot.dischargeLoss.toFixed(2);
    pump.results.suctionVelocityHead = hydraulicSnapshot.suctionVelocityHead?.toFixed(3) ?? null;
    pump.results.vaporPressureHead = hydraulicSnapshot.vaporPressureHead?.toFixed(3) ?? null;
    const basisVaporPressure = parseFloat(globalModel.FLUID?.props?.vaporPressure);
    const liveVaporPressure = parseFloat(detailedNpshEvaluation?.calculationTrace?.basis?.vaporPressureBarA);
    pump.results.vaporPressureBasis = Number.isFinite(basisVaporPressure)
        ? basisVaporPressure.toFixed(6)
        : null;
    pump.results.vaporPressureLive = Number.isFinite(liveVaporPressure)
        ? liveVaporPressure.toFixed(6)
        : (Number.isFinite(hydraulicContext.vaporPressurePa)
            ? (hydraulicContext.vaporPressurePa / 100000).toFixed(6)
            : null);
    pump.results.dominantSuctionLoss = detailedNpshEvaluation?.dominantLoss || '-';
    pump.results.engineeringNotes = detailedNpshEvaluation?.notes || [];
    pump.results.npshEvaluation = detailedNpshEvaluation;
    pump.results.solveMode = solveInfo.solveMode || 'Pump/system intersection';
    pump.results.flowBasis = solveInfo.flowBasis || 'Pump/system intersection';
    pump.results.fixedFlow = solveInfo.fixedFlow === undefined || solveInfo.fixedFlow === null
        ? null
        : Number(solveInfo.fixedFlow.toFixed(3));
    const requiredHead = solveInfo.requiredSystemHead ?? hydraulicSnapshot.systemHead;
    pump.results.requiredSystemHead = Number.isFinite(requiredHead) ? requiredHead.toFixed(2) : null;
    pump.results.pumpHeadAtFlow = Number.isFinite(opHead) ? opHead.toFixed(2) : null;
    const headResidual = solveInfo.headResidual ?? (Number.isFinite(requiredHead) ? opHead - requiredHead : null);
    pump.results.headResidual = Number.isFinite(headResidual) ? headResidual.toFixed(2) : null;
    const pressureResidual = solveInfo.pressureResidual ?? (Number.isFinite(headResidual) ? pressureHeadToBar(headResidual, density) : null);
    pump.results.pressureResidual = Number.isFinite(pressureResidual) ? pressureResidual.toFixed(3) : null;
    pump.results.downstreamBoundary = solveInfo.downstreamBoundary || hydraulicContext.dischargePath?.boundaryId || '-';
}

function getInstrumentLink(instrumentId) {
    const instrument = globalModel[instrumentId];
    const attachedTo = instrument && instrument.props ? instrument.props.attachedTo : null;
    const explicitLink = instrumentLinks.find(link => link.instrumentId === instrumentId);
    if (explicitLink) return explicitLink;
    if (!attachedTo) return null;

    const target = globalModel[attachedTo];
    if (instrument?.type === 'levelController' && target && target.type !== 'pipe') {
        return {
            instrumentId,
            targetId: attachedTo,
            targetType: target.type,
            measuredVariable: 'level',
            linkType: typeof INSTRUMENT_LINK_LEVEL_MEASUREMENT !== 'undefined' ? INSTRUMENT_LINK_LEVEL_MEASUREMENT : 'level-measurement',
            visualStyle: 'instrument-dashed'
        };
    }

    return { instrumentId, pipeId: attachedTo, location: 0.5 };
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

    const quantityByKey = {
        pressure: 'pressureAbs',
        temperature: 'temperature',
        flow: 'flow'
    };
    const unitByKey = {
        pressure: 'bar a',
        temperature: 'deg C',
        flow: 'm3/h'
    };
    const getDigits = (key, unit) => {
        if (key === 'temperature') return 1;
        if (key === 'flow' && unit === 'm3/s') return 4;
        return 2;
    };

    const setValue = (key, value) => {
        const quantity = quantityByKey[key];
        const displayValue = quantity && typeof convertToDisplay === 'function'
            ? convertToDisplay(value, quantity)
            : value;
        const displayUnit = quantity && typeof getDisplayUnit === 'function'
            ? getDisplayUnit(quantity)
            : unitByKey[key];
        const cell = objectEl.querySelector(`[data-readout-key="${key}"]`);
        if (cell) cell.textContent = formatCanvasReadoutValue(displayValue, getDigits(key, displayUnit));
        const unitCell = objectEl.querySelector(`[data-readout-unit="${key}"]`);
        if (unitCell) unitCell.textContent = displayUnit || '';
    };

    const props = instrument.props || {};
    setValue('pressure', props.measuredPressure);
    setValue('temperature', props.measuredTemperature);
    setValue('flow', props.measuredFlow);
    objectEl.classList.toggle('is-attached', !!props.attachedTo);
}

function updateInstrumentReadout(instrumentId) {
    const instrument = globalModel[instrumentId];
    if (!instrument || !isInstrumentType(instrument.type)) return;

    if (!instrument.props) instrument.props = {};
    const link = getInstrumentLink(instrumentId);
    const attachmentId = link ? (link.pipeId || link.targetId || '') : '';
    const readout = calculatePipeInstrumentMeasurement(instrument, attachmentId, globalModel, connections, link ? link.location : 0.5);

    instrument.props.attachedTo = attachmentId;
    instrument.props.attachedTargetType = link?.targetType || (link?.pipeId ? 'pipe' : '');
    instrument.props.measuredVariable = link?.measuredVariable || (link?.pipeId ? 'pipe-snapshot' : instrument.props.measuredVariable || '');
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
        if (instrument.type === 'levelController') {
            const values = readout.values || {};
            instrument.props.measuredLevel = values.level ?? null;
            instrument.props.measuredLevelPercent = values.levelPercent ?? readout.percent ?? null;
            instrument.props.setPointLevel = values.setPointLevel ?? null;
            instrument.props.controllerError = values.controllerError ?? null;
            instrument.props.controllerOutput = values.controllerOutput ?? null;
            instrument.props.tankNetFlow = values.netFlow ?? null;
            instrument.props.tankLevelTrend = values.levelTrend ?? null;
            instrument.props.tankLevelRate = values.levelRate ?? null;
            instrument.props.requiredOutletFlow = values.requiredOutletFlow ?? null;
            values.simulationTimeSeconds = typeof getDynamicInventorySettings === 'function'
                ? getDynamicInventorySettings().dynamicSimulationTimeSeconds
                : null;
            recordLevelControllerTrendSample(instrument, values);
        }
    }

    if (typeof buildInstrumentCalculationTrace === 'function') {
        if (!instrument.results) instrument.results = {};
        instrument.results.calculationTrace = buildInstrumentCalculationTrace(instrumentId, globalModel, connections);
    }

    updateLineMonitorCanvasReadout(instrumentId);

    if (currentSelectedNode === instrumentId) {
        setSidebarReadout('instrument-attached-to', attachmentId || '-');
        if (instrument.type === 'lineMonitor') {
            setSidebarReadout('instrument-pressure', instrument.props.measuredPressure, 'bar a');
            setSidebarReadout('instrument-flow', instrument.props.measuredFlow, 'm3/h');
            setSidebarReadout('instrument-temperature', instrument.props.measuredTemperature, 'deg C');
        } else if (instrument.type === 'levelController') {
            setSidebarReadout('instrument-measured-level', instrument.props.measuredLevel, 'm');
            setSidebarReadout('instrument-measured', readout.value, readout.unit);
            setSidebarReadout('instrument-setpoint-level', instrument.props.setPointLevel, 'm');
            setSidebarReadout('instrument-signal', instrument.props.controllerOutput ?? readout.percent, '%');
            setSidebarReadout('instrument-controller-error', instrument.props.controllerError, '%');
            setSidebarReadout('instrument-tank-net-flow', instrument.props.tankNetFlow, 'm3/h');
            setSidebarReadout('instrument-tank-level-trend', instrument.props.tankLevelTrend, '');
            setSidebarReadout('instrument-tank-level-rate', instrument.props.tankLevelRate, 'm/h');
            setSidebarReadout('instrument-required-outlet-flow', instrument.props.requiredOutletFlow, 'm3/h');
        } else {
            setSidebarReadout('instrument-measured', readout.value, readout.unit);
            setSidebarReadout('instrument-signal', readout.percent, readout.percent === null ? '' : '%');
        }
    }

    if (typeof updateInstrumentCalculationTraceReadout === 'function') {
        updateInstrumentCalculationTraceReadout(instrumentId);
    }
    if (instrument.type === 'levelController' && typeof updateLevelControllerTrendChart === 'function') {
        updateLevelControllerTrendChart(instrumentId);
    }
    if (instrument.type === 'levelController' && typeof updateObjectOperatingStatusVisual === 'function') {
        updateObjectOperatingStatusVisual(instrumentId);
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

function getSolvedPipeFlow(pipe) {
    if (!pipe || !pipe.results || !pipe.results.pressureCalculated) return null;
    const flow = parseFloat(pipe.results.flow);
    return Number.isFinite(flow) ? flow : null;
}

function getTankPipeConnections(tankId) {
    return (connections || [])
        .map(getOrientedHydraulicConnection)
        .filter(conn => conn.to === tankId || conn.from === tankId);
}

function getTankSourceFeedLinks(tankId) {
    if (typeof sourceLinks === 'undefined' || !Array.isArray(sourceLinks)) return [];
    return sourceLinks.filter(link => link.targetId === tankId && globalModel[link.sourceId]?.type === 'source');
}

function getSourceDynamicContributionMode(source) {
    const continuous = typeof SOURCE_DYNAMIC_CONTRIBUTION_CONTINUOUS !== 'undefined'
        ? SOURCE_DYNAMIC_CONTRIBUTION_CONTINUOUS
        : 'Continuous Feed to Tank';
    const initialOnly = typeof SOURCE_DYNAMIC_CONTRIBUTION_INITIAL_ONLY !== 'undefined'
        ? SOURCE_DYNAMIC_CONTRIBUTION_INITIAL_ONLY
        : 'Initial Inventory Only';
    const inactive = typeof SOURCE_DYNAMIC_CONTRIBUTION_INACTIVE !== 'undefined'
        ? SOURCE_DYNAMIC_CONTRIBUTION_INACTIVE
        : 'Inactive';
    const options = typeof SOURCE_DYNAMIC_CONTRIBUTION_OPTIONS !== 'undefined'
        ? SOURCE_DYNAMIC_CONTRIBUTION_OPTIONS
        : [continuous, initialOnly, inactive];
    const mode = source?.props?.dynamicContributionMode;
    return options.includes(mode) ? mode : continuous;
}

function getSourceDynamicContributionFlow(source, steadyFlow) {
    const flow = parseFloat(steadyFlow);
    if (!Number.isFinite(flow)) return null;
    return getSourceDynamicContributionMode(source) === (typeof SOURCE_DYNAMIC_CONTRIBUTION_CONTINUOUS !== 'undefined'
        ? SOURCE_DYNAMIC_CONTRIBUTION_CONTINUOUS
        : 'Continuous Feed to Tank')
        ? Number(flow.toFixed(3))
        : 0;
}

function getTankSourceFeedFlowBreakdown(tankId) {
    return getTankSourceFeedLinks(tankId).reduce((sum, link) => {
        const source = globalModel[link.sourceId];
        if (typeof normalizeSourceProps === 'function') normalizeSourceProps(source);
        const flow = parseFloat(source?.props?.flow);
        const dynamicContributionMode = getSourceDynamicContributionMode(source);
        sum.push({
            sourceId: link.sourceId,
            sourceType: source?.props?.sourceType || '-',
            flow: Number.isFinite(flow) ? Number(flow.toFixed(3)) : null,
            dynamicContributionMode,
            dynamicFlow: getSourceDynamicContributionFlow(source, flow)
        });
        return sum;
    }, []);
}

function getTankSourceFeedFlowTotal(sourceFeedFlows) {
    return (sourceFeedFlows || []).reduce((sum, row) => (
        sum + (Number.isFinite(row?.flow) ? row.flow : 0)
    ), 0);
}

function getTankDynamicSourceFeedFlowTotal(sourceFeedFlows) {
    return (sourceFeedFlows || []).reduce((sum, row) => (
        sum + (Number.isFinite(row?.dynamicFlow) ? row.dynamicFlow : 0)
    ), 0);
}

function averageFiniteValues(values) {
    const valid = (values || []).filter(value => Number.isFinite(value));
    if (valid.length === 0) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getTankLevelTrend(netFlow, hasFlow, flowTolerance) {
    if (!hasFlow || !Number.isFinite(netFlow)) return 'No flow';
    if (Math.abs(netFlow) <= flowTolerance) return 'Balanced';
    return netFlow > 0 ? 'Rising' : 'Falling';
}

function formatSignedTankFlow(flow) {
    if (!Number.isFinite(flow)) return '-';
    const sign = flow > 0 ? '+' : '';
    return `${sign}${flow.toFixed(3)}`;
}

function getTankLevelRate(netFlow, tank) {
    const diameter = parseFloat(tank?.props?.diameter);
    const tankArea = Number.isFinite(diameter) && diameter > 0
        ? (Math.PI / 4) * Math.pow(diameter, 2)
        : null;
    if (!Number.isFinite(netFlow) || !Number.isFinite(tankArea) || tankArea <= 0) return null;
    return netFlow / tankArea;
}

function getDynamicInventorySettings() {
    const settings = typeof ensureSimulationSettings === 'function'
        ? ensureSimulationSettings()
        : null;
    const props = settings?.props || {};
    const stepSeconds = parseFloat(props.dynamicStepSeconds);
    const realtimeIntervalMs = parseFloat(props.dynamicRealtimeIntervalMs);
    const simulationTimeSeconds = parseFloat(props.dynamicSimulationTimeSeconds);
    props.dynamicStepSeconds = DYNAMIC_INVENTORY_STEP_OPTIONS.includes(stepSeconds)
        ? stepSeconds
        : DYNAMIC_INVENTORY_DEFAULT_STEP_SECONDS;
    props.dynamicRealtimeIntervalMs = DYNAMIC_INVENTORY_REALTIME_INTERVAL_OPTIONS.includes(realtimeIntervalMs)
        ? realtimeIntervalMs
        : DYNAMIC_INVENTORY_DEFAULT_REALTIME_INTERVAL_MS;
    props.dynamicSimulationTimeSeconds = Number.isFinite(simulationTimeSeconds) && simulationTimeSeconds >= 0
        ? simulationTimeSeconds
        : 0;
    if (props.dynamicInventoryEnabled === undefined) props.dynamicInventoryEnabled = false;
    if (!props.lastDynamicStepStatus) props.lastDynamicStepStatus = 'Not started';
    return props;
}

function setDynamicInventoryStepSeconds(stepSeconds) {
    const settings = getDynamicInventorySettings();
    const parsed = parseInt(stepSeconds, 10);
    if (!DYNAMIC_INVENTORY_STEP_OPTIONS.includes(parsed)) return settings.dynamicStepSeconds;
    settings.dynamicStepSeconds = parsed;
    return settings.dynamicStepSeconds;
}

function setDynamicInventoryRealtimeIntervalMs(intervalMs) {
    const settings = getDynamicInventorySettings();
    const parsed = parseInt(intervalMs, 10);
    if (!DYNAMIC_INVENTORY_REALTIME_INTERVAL_OPTIONS.includes(parsed)) return settings.dynamicRealtimeIntervalMs;
    settings.dynamicRealtimeIntervalMs = parsed;
    return settings.dynamicRealtimeIntervalMs;
}

function formatDynamicInventoryDuration(seconds) {
    const totalSeconds = Math.max(0, Math.round(parseFloat(seconds) || 0));
    if (totalSeconds === 0) return '0 s';
    if (totalSeconds % 3600 === 0) return `${totalSeconds / 3600} h`;
    if (totalSeconds % 60 === 0) return `${totalSeconds / 60} min`;
    return `${totalSeconds} s`;
}

function formatDynamicInventoryClock(seconds) {
    const totalSeconds = Math.max(0, Math.round(parseFloat(seconds) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return [hours, minutes, secs].map(value => String(value).padStart(2, '0')).join(':');
}

function roundDynamicInventoryValue(value, digits = 3) {
    const numeric = parseFloat(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : null;
}

function getDynamicInventoryTankArea(tank) {
    const diameter = parseFloat(tank?.props?.diameter);
    return Number.isFinite(diameter) && diameter > 0
        ? (Math.PI / 4) * Math.pow(diameter, 2)
        : null;
}

function getTankDynamicLimitWarnings(tankId, oldLevel, newLevel, unclampedLevel, tankHeight, tank = {}) {
    const warnings = [];
    const hll = parseFloat(tank.props?.hll);
    const lll = parseFloat(tank.props?.lll);
    if (Number.isFinite(tankHeight) && tankHeight > 0 && unclampedLevel > tankHeight) {
        warnings.push(`${tankId} reached tank height; dynamic inventory step was clamped to prevent overflow.`);
    }
    if (unclampedLevel < 0) {
        warnings.push(`${tankId} reached empty level; dynamic inventory step was clamped at 0 m.`);
    }
    if (Number.isFinite(hll) && oldLevel < hll && newLevel >= hll) {
        warnings.push(`${tankId} crossed HLL during dynamic inventory step.`);
    }
    if (Number.isFinite(lll) && oldLevel > lll && newLevel <= lll) {
        warnings.push(`${tankId} crossed LLL during dynamic inventory step.`);
    }
    return warnings;
}

function applyTankDynamicInventoryStep(tankId, stepSeconds = DYNAMIC_INVENTORY_DEFAULT_STEP_SECONDS, options = {}) {
    const tank = typeof globalModel !== 'undefined' ? globalModel[tankId] : null;
    if (!tank || tank.type !== 'tank') return null;
    if (typeof normalizeTankProps === 'function') normalizeTankProps(tank);
    if (typeof ensureNodeResults === 'function') ensureNodeResults(tank);

    const dynamicNetFlow = parseFloat(tank.results?.dynamicNetFlow);
    const steadyNetFlow = parseFloat(tank.results?.netFlow);
    const netFlow = Number.isFinite(dynamicNetFlow) ? dynamicNetFlow : steadyNetFlow;
    const netFlowBasis = Number.isFinite(dynamicNetFlow) ? 'Dynamic Net Flow' : 'Steady Net Flow';
    const tankArea = getDynamicInventoryTankArea(tank);
    const oldLevel = parseFloat(tank.props?.liquidLevel);
    const tankHeight = parseFloat(tank.props?.tankHeight);
    const dtSeconds = parseFloat(stepSeconds);
    const dtHours = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds / 3600 : null;

    if (!Number.isFinite(netFlow) || !Number.isFinite(tankArea) || tankArea <= 0 || !Number.isFinite(oldLevel) || !dtHours) {
        const skipped = {
            tankId,
            status: 'Skipped',
            message: `${tankId} has no valid net flow, tank area, current level, or timestep for dynamic inventory.`,
            netFlow: Number.isFinite(netFlow) ? roundDynamicInventoryValue(netFlow, 3) : null,
            netFlowBasis,
            stepSeconds: Number.isFinite(dtSeconds) ? dtSeconds : stepSeconds
        };
        tank.results.dynamicInventory = skipped;
        return skipped;
    }

    const requestedDeltaVolume = netFlow * dtHours;
    const requestedDeltaLevel = requestedDeltaVolume / tankArea;
    const unclampedLevel = oldLevel + requestedDeltaLevel;
    const hasHeightLimit = Number.isFinite(tankHeight) && tankHeight > 0;
    const newLevel = hasHeightLimit
        ? Math.min(Math.max(unclampedLevel, 0), tankHeight)
        : Math.max(unclampedLevel, 0);
    const actualDeltaLevel = newLevel - oldLevel;
    const oldVolume = typeof calculateTankLiquidVolume === 'function'
        ? calculateTankLiquidVolume(parseFloat(tank.props?.diameter), oldLevel)
        : tankArea * oldLevel;
    const newVolume = typeof calculateTankLiquidVolume === 'function'
        ? calculateTankLiquidVolume(parseFloat(tank.props?.diameter), newLevel)
        : tankArea * newLevel;
    const actualDeltaVolume = newVolume - oldVolume;
    const warnings = getTankDynamicLimitWarnings(tankId, oldLevel, newLevel, unclampedLevel, tankHeight, tank);
    const levelTolerance = 1e-9;
    const status = Math.abs(actualDeltaLevel) <= levelTolerance
        ? 'Balanced'
        : (actualDeltaLevel > 0 ? 'Rising' : 'Falling');
    const simulationTimeSeconds = parseFloat(options.simulationTimeSeconds);

    tank.props.liquidLevel = roundDynamicInventoryValue(newLevel, 3);
    if (typeof refreshTankInventoryCalculations === 'function') {
        refreshTankInventoryCalculations(tank.props);
    }

    const summary = {
        tankId,
        status,
        stepSeconds: dtSeconds,
        dtHours: roundDynamicInventoryValue(dtHours, 6),
        netFlow: roundDynamicInventoryValue(netFlow, 3),
        netFlowBasis,
        tankArea: roundDynamicInventoryValue(tankArea, 3),
        previousLevel: roundDynamicInventoryValue(oldLevel, 3),
        newLevel: roundDynamicInventoryValue(tank.props.liquidLevel, 3),
        requestedDeltaLevel: roundDynamicInventoryValue(requestedDeltaLevel, 6),
        actualDeltaLevel: roundDynamicInventoryValue(actualDeltaLevel, 6),
        previousVolume: roundDynamicInventoryValue(oldVolume, 3),
        newVolume: roundDynamicInventoryValue(newVolume, 3),
        requestedDeltaVolume: roundDynamicInventoryValue(requestedDeltaVolume, 3),
        actualDeltaVolume: roundDynamicInventoryValue(actualDeltaVolume, 3),
        fillPercent: roundDynamicInventoryValue(tank.props.fillPercent, 3),
        simulationTimeSeconds: Number.isFinite(simulationTimeSeconds) ? simulationTimeSeconds : null,
        warnings
    };
    tank.results.dynamicInventory = summary;
    return summary;
}

function runSuppressedTrendSolveForDynamicStep() {
    if (typeof updateSimulation !== 'function') return;
    const previousTrendSuppression = suppressLevelControllerTrendRecording;
    suppressLevelControllerTrendRecording = true;
    try {
        updateSimulation({ renderSidebarAfter: false });
    } finally {
        suppressLevelControllerTrendRecording = previousTrendSuppression;
    }
}

function stepDynamicTankInventory(options = {}) {
    const settings = getDynamicInventorySettings();
    const stepSeconds = options.stepSeconds === undefined
        ? settings.dynamicStepSeconds
        : setDynamicInventoryStepSeconds(options.stepSeconds);

    if (options.preSolve !== false) {
        runSuppressedTrendSolveForDynamicStep();
    }

    const tankIds = Object.keys(globalModel || {}).filter(nodeId => globalModel[nodeId]?.type === 'tank');
    const nextSimulationTime = settings.dynamicSimulationTimeSeconds + stepSeconds;
    const tankSummaries = tankIds
        .map(tankId => applyTankDynamicInventoryStep(tankId, stepSeconds, {
            simulationTimeSeconds: nextSimulationTime
        }))
        .filter(Boolean);
    const changedTanks = tankSummaries.filter(item => item.status !== 'Skipped' && Math.abs(item.actualDeltaLevel || 0) > 1e-9);
    const warnings = tankSummaries.flatMap(item => item.warnings || []);

    if (changedTanks.length > 0) {
        settings.dynamicSimulationTimeSeconds = nextSimulationTime;
        settings.dynamicInventoryEnabled = true;
        settings.lastDynamicStepStatus = `${changedTanks.length} tank${changedTanks.length === 1 ? '' : 's'} updated at t=${formatDynamicInventoryClock(settings.dynamicSimulationTimeSeconds)}`;
    } else {
        settings.lastDynamicStepStatus = 'No tank level changed; check net flow and tank geometry.';
    }

    if (typeof updateSimulation === 'function') {
        updateSimulation({ renderSidebarAfter: options.renderSidebarAfter !== false });
    }

    return {
        ok: changedTanks.length > 0,
        stepSeconds,
        simulationTimeSeconds: settings.dynamicSimulationTimeSeconds,
        tankSummaries,
        changedTanks,
        warnings,
        status: settings.lastDynamicStepStatus
    };
}

function getTankInventoryAdvisory(netFlow, levelTrend, levelRate = null, flowLabel = 'Net Flow') {
    if (!Number.isFinite(netFlow) || !['Rising', 'Falling'].includes(levelTrend)) return '';
    const direction = levelTrend === 'Rising' ? 'rise' : 'fall';
    const rateText = Number.isFinite(levelRate) ? `; level rate = ${formatSignedTankFlow(levelRate)} m/h` : '';
    return `Tank inventory advisory: ${flowLabel} = ${formatSignedTankFlow(netFlow)} m3/h${rateText}; level will ${direction}. Use Simulate > Step Dynamic Inventory to integrate the tank level and volume over time.`;
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
    const sourceFeedLinks = getTankSourceFeedLinks(tankId);
    const sidePressures = [];
    const sideStagnationPressures = [];
    let inletPressure = null;
    let outletPressure = null;
    let pipeInletFlow = 0;
    let pipeOutletFlow = 0;
    let solvedPipeCount = 0;

    tankConnections.forEach(conn => {
        const pipe = globalModel[conn.pipeId];
        const staticPressure = getPipePressureForNodeSide(pipe, conn, tankId);
        const stagnationPressure = getPipeStagnationPressureForNodeSide(pipe, conn, tankId);
        const pipeFlow = getSolvedPipeFlow(pipe);

        if (Number.isFinite(staticPressure)) {
            sidePressures.push(staticPressure);
            if (conn.to === tankId && inletPressure === null) inletPressure = staticPressure;
            if (conn.from === tankId && outletPressure === null) outletPressure = staticPressure;
        }
        if (Number.isFinite(stagnationPressure)) {
            sideStagnationPressures.push(stagnationPressure);
        }
        if (Number.isFinite(pipeFlow)) {
            solvedPipeCount += 1;
            if (conn.to === tankId) pipeInletFlow += pipeFlow;
            if (conn.from === tankId) pipeOutletFlow += pipeFlow;
        }
    });

    const sourceFeedFlows = getTankSourceFeedFlowBreakdown(tankId);
    const sourceFeedFlow = getTankSourceFeedFlowTotal(sourceFeedFlows);
    const dynamicSourceFeedFlow = getTankDynamicSourceFeedFlowTotal(sourceFeedFlows);
    const inletFlow = pipeInletFlow + sourceFeedFlow;
    const outletFlow = pipeOutletFlow;
    const hasFlow = inletFlow > 0 || outletFlow > 0;
    const netFlow = hasFlow ? inletFlow - outletFlow : null;
    const flowTolerance = Math.max(0.01, Math.max(inletFlow, outletFlow) * 0.02);
    const levelTrend = getTankLevelTrend(netFlow, hasFlow, flowTolerance);
    const levelRate = getTankLevelRate(netFlow, tank);
    const dynamicInletFlow = pipeInletFlow + dynamicSourceFeedFlow;
    const hasDynamicFlow = dynamicInletFlow > 0 || outletFlow > 0;
    const dynamicNetFlow = hasDynamicFlow ? dynamicInletFlow - outletFlow : null;
    const dynamicFlowTolerance = Math.max(0.01, Math.max(dynamicInletFlow, outletFlow) * 0.02);
    const dynamicLevelTrend = getTankLevelTrend(dynamicNetFlow, hasDynamicFlow, dynamicFlowTolerance);
    const dynamicLevelRate = getTankLevelRate(dynamicNetFlow, tank);

    let hydraulicStatus = 'No hydraulic connection';
    if (tankConnections.length === 0 && sourceFeedLinks.length > 0) {
        hydraulicStatus = 'Source attached, no pipe solved';
    } else if (tankConnections.length > 0 && solvedPipeCount === 0) {
        hydraulicStatus = 'Network incomplete';
    } else if (solvedPipeCount > 0) {
        hydraulicStatus = 'Pass-through solved';
    }

    const safety = typeof evaluateTankPressureSafety === 'function'
        ? evaluateTankPressureSafety(tank.props, fluid?.props || {})
        : { status: '-', warnings: [], suggestedPressure: 0, suggestedBasis: 'Not available' };
    const warnings = [...safety.warnings];
    const dynamicInventory = tank.results.dynamicInventory || null;
    if (dynamicInventory?.warnings?.length) {
        dynamicInventory.warnings.forEach(warning => {
            if (warning && !warnings.includes(warning)) warnings.push(warning);
        });
    }
    const advisories = [];
    const operatingPressureAbsolute = typeof getNodeAbsolutePressureBar === 'function'
        ? getNodeAbsolutePressureBar(tank)
        : parseFloat(tank.props.pressure);
    const operatingPressureGauge = typeof getNodeGaugePressureBar === 'function'
        ? getNodeGaugePressureBar(tank)
        : parseFloat(tank.props.pressure);

    if (tankConnections.length > 0 && sidePressures.length === 0) {
        warnings.push('Connected pipe pressure is not solved; connect upstream SRC and downstream SNK to calculate flow.');
    }
    const inventoryAdvisory = getTankInventoryAdvisory(dynamicNetFlow, dynamicLevelTrend, dynamicLevelRate, 'Dynamic Net Flow');
    if (inventoryAdvisory) {
        advisories.push(inventoryAdvisory);
    }

    tank.results.connectedPipes = tankConnections.map(conn => conn.pipeId);
    tank.results.connectedSources = sourceFeedLinks.map(link => link.sourceId);
    tank.results.sourceFeedFlows = sourceFeedFlows;
    tank.results.calculatedPressure = averageFiniteValues(sidePressures);
    tank.results.inletPressure = inletPressure;
    tank.results.outletPressure = outletPressure;
    tank.results.stagnationPressure = averageFiniteValues(sideStagnationPressures);
    tank.results.pipeInletFlow = hasFlow ? Number(pipeInletFlow.toFixed(3)) : null;
    tank.results.pipeOutletFlow = hasFlow ? Number(pipeOutletFlow.toFixed(3)) : null;
    tank.results.inletFlow = hasFlow ? Number(inletFlow.toFixed(3)) : null;
    tank.results.outletFlow = hasFlow ? Number(outletFlow.toFixed(3)) : null;
    tank.results.netFlow = Number.isFinite(netFlow) ? Number(netFlow.toFixed(3)) : null;
    tank.results.levelTrend = levelTrend;
    tank.results.levelRate = Number.isFinite(levelRate) ? Number(levelRate.toFixed(3)) : null;
    tank.results.sourceFeedFlow = sourceFeedLinks.length > 0 ? Number(sourceFeedFlow.toFixed(3)) : null;
    tank.results.dynamicSourceFeedFlow = sourceFeedLinks.length > 0 ? Number(dynamicSourceFeedFlow.toFixed(3)) : null;
    tank.results.dynamicInletFlow = hasDynamicFlow ? Number(dynamicInletFlow.toFixed(3)) : null;
    tank.results.dynamicNetFlow = Number.isFinite(dynamicNetFlow) ? Number(dynamicNetFlow.toFixed(3)) : null;
    tank.results.dynamicLevelTrend = dynamicLevelTrend;
    tank.results.dynamicLevelRate = Number.isFinite(dynamicLevelRate) ? Number(dynamicLevelRate.toFixed(3)) : null;
    tank.results.operatingPressureAbsolute = Number.isFinite(operatingPressureAbsolute) ? Number(operatingPressureAbsolute.toFixed(3)) : null;
    tank.results.operatingPressureGauge = Number.isFinite(operatingPressureGauge) ? Number(operatingPressureGauge.toFixed(3)) : null;
    tank.results.operatingPressureGaugeMbar = Number.isFinite(operatingPressureGauge) ? Number((operatingPressureGauge * 1000).toFixed(3)) : null;
    tank.results.hydraulicStatus = hydraulicStatus;
    tank.results.pressureBasis = sidePressures.length > 0
        ? 'Calculated from solved connected pipe pressure'
        : 'Operating Pressure input is informational in pass-through mode';
    tank.results.vaporPressure = Number.isFinite(vaporPressure) ? Number(vaporPressure.toFixed(4)) : null;
    tank.results.liquidVolume = Number.isFinite(parseFloat(tank.props.liquidVolume)) ? Number(parseFloat(tank.props.liquidVolume).toFixed(3)) : safety.liquidVolume;
    tank.results.totalCapacity = Number.isFinite(parseFloat(tank.props.totalCapacity)) ? Number(parseFloat(tank.props.totalCapacity).toFixed(3)) : safety.totalCapacity;
    tank.results.fillPercent = Number.isFinite(parseFloat(tank.props.fillPercent)) ? Number(parseFloat(tank.props.fillPercent).toFixed(3)) : safety.fillPercent;
    tank.results.tankDesignPressure = safety.tankDesignPressure;
    tank.results.designVacuum = safety.designVacuum;
    tank.results.pressureVentSet = safety.pressureVentSet;
    tank.results.vacuumVentSet = safety.vacuumVentSet;
    tank.results.ventingBasis = safety.ventingBasis;
    tank.results.ventingStatus = safety.status;
    tank.results.geometryStatus = safety.geometryStatus;
    tank.results.emergencyVentProvided = tank.props.emergencyVentProvided;
    tank.results.status = warnings.length ? 'Review' : (advisories.length ? 'Advisory' : hydraulicStatus);
    tank.results.warnings = warnings;
    tank.results.advisories = advisories;
    tank.results.calculationTrace = typeof buildTankCalculationTrace === 'function'
        ? buildTankCalculationTrace(tank, fluid?.props || {}, tank.results)
        : null;

    if (currentSelectedNode === tankId) {
        setSidebarReadout('tank-connected-pipes', tank.results.connectedPipes.join(', ') || '-', '');
        setSidebarReadout('tank-connected-sources', tank.results.connectedSources.join(', ') || '-', '');
        setSidebarReadout('tank-pressure-basis', tank.results.pressureBasis, '');
        setSidebarReadout('tank-calculated-pressure', tank.results.calculatedPressure === null ? null : Number(tank.results.calculatedPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-inlet-pressure', tank.results.inletPressure === null ? null : Number(tank.results.inletPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-outlet-pressure', tank.results.outletPressure === null ? null : Number(tank.results.outletPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-stagnation-pressure', tank.results.stagnationPressure === null ? null : Number(tank.results.stagnationPressure.toFixed(3)), 'bar a');
        setSidebarReadout('tank-pipe-inlet-flow', tank.results.pipeInletFlow, 'm3/h');
        setSidebarReadout('tank-pipe-outlet-flow', tank.results.pipeOutletFlow, 'm3/h');
        setSidebarReadout('tank-inlet-flow', tank.results.inletFlow, 'm3/h');
        setSidebarReadout('tank-outlet-flow', tank.results.outletFlow, 'm3/h');
        setSidebarReadout('tank-net-flow', tank.results.netFlow, 'm3/h');
        setSidebarReadout('tank-level-trend', tank.results.levelTrend, '');
        setSidebarReadout('tank-level-rate', tank.results.levelRate, 'm/h');
        setSidebarReadout('tank-source-feed-flow', tank.results.sourceFeedFlow, 'm3/h');
        setSidebarReadout('tank-dynamic-source-feed-flow', tank.results.dynamicSourceFeedFlow, 'm3/h');
        setSidebarReadout('tank-dynamic-net-flow', tank.results.dynamicNetFlow, 'm3/h');
        setSidebarReadout('tank-dynamic-level-trend', tank.results.dynamicLevelTrend, '');
        setSidebarReadout('tank-dynamic-level-rate', tank.results.dynamicLevelRate, 'm/h');
        if (typeof setTankSourceFeedFlowBreakdownReadout === 'function') {
            setTankSourceFeedFlowBreakdownReadout(tank.results.sourceFeedFlows);
        }
        setSidebarReadout('tank-operating-abs-pressure', tank.results.operatingPressureAbsolute, 'bar a');
        setSidebarReadout('tank-hydraulic-status', tank.results.hydraulicStatus, '');
        setSidebarReadout('tank-vapor-pressure', tank.results.vaporPressure, 'bar a');
        setSidebarReadout('tank-liquid-volume', tank.results.liquidVolume, 'm3');
        setSidebarReadout('tank-total-capacity', tank.results.totalCapacity, 'm3');
        setSidebarReadout('tank-fill-percent', tank.results.fillPercent, '%');
        setSidebarReadout('tank-design-pressure', tank.results.tankDesignPressure, 'mbar g');
        setSidebarReadout('tank-design-vacuum', tank.results.designVacuum, 'mbar vacuum');
        setSidebarReadout('tank-pressure-vent-set', tank.results.pressureVentSet, 'mbar g');
        setSidebarReadout('tank-vacuum-vent-set', tank.results.vacuumVentSet, 'mbar vacuum');
        setSidebarReadout('tank-venting-basis', tank.results.ventingBasis, '');
        setSidebarReadout('tank-venting-status', tank.results.ventingStatus, '');
        setSidebarReadout('tank-geometry-status', tank.results.geometryStatus, '');
        setSidebarReadout('tank-status', tank.results.status, '');
        setSidebarReadout('tank-warnings', tank.results.warnings.join(' | ') || 'OK', '');
        setSidebarReadout('tank-advisories', tank.results.advisories.join(' | ') || '-', '');
    }
    if (typeof updateTankCalculationTraceReadout === 'function') {
        updateTankCalculationTraceReadout(tank);
    }
}

function updateAllTankReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'tank') {
            updateTankPressureReadout(nodeId);
        }
    });
}

function updateHeatExchangerReadout(exchangerId) {
    const exchanger = globalModel[exchangerId];
    if (!exchanger || exchanger.type !== 'heatExchanger') return;
    ensureNodeResults(exchanger);

    const trace = typeof buildHeatExchangerCalculationTrace === 'function'
        ? buildHeatExchangerCalculationTrace(exchangerId, globalModel, connections)
        : null;
    exchanger.results.calculationTrace = trace;
    if (trace?.hydraulic) {
        exchanger.results.pressureDrop = trace.hydraulic.pressureDropBar;
        exchanger.results.pressureDropHead = trace.hydraulic.pressureDropHead;
        exchanger.results.flow = trace.hydraulic.flow;
        exchanger.results.massFlow = trace.hydraulic.massFlowKgH;
        exchanger.results.npshLossContribution = trace.hydraulic.npshLossContribution;
    }
    if (trace?.thermal) {
        exchanger.results.duty = trace.thermal.dutyInput;
        exchanger.results.inletTemp = trace.thermal.inletTemp;
        exchanger.results.outletTemp = trace.thermal.outletTemp;
        exchanger.results.deltaTemp = trace.thermal.deltaTemp;
        exchanger.results.specificHeat = trace.thermal.specificHeat;
        exchanger.results.calculatedDuty = trace.thermal.calculatedDuty;
        exchanger.results.dutyResidual = trace.thermal.dutyResidual;
    }
    if (trace?.fluid) {
        exchanger.results.density = trace.fluid.density;
        exchanger.results.vaporPressure = trace.fluid.vaporPressure;
    }
    exchanger.results.status = trace?.status || '-';
    exchanger.results.warnings = trace?.warnings || [];

    if (currentSelectedNode === exchangerId) {
        setSidebarReadout('hx-duty-input', exchanger.results.duty, 'kW');
        setSidebarReadout('hx-pressure-drop', exchanger.results.pressureDrop, 'bar');
        setSidebarReadout('hx-pressure-drop-head', exchanger.results.pressureDropHead, 'm');
        setSidebarReadout('hx-inlet-temp', exchanger.results.inletTemp, 'deg C');
        setSidebarReadout('hx-outlet-temp', exchanger.results.outletTemp, 'deg C');
        setSidebarReadout('hx-delta-temp', exchanger.results.deltaTemp, 'deg C');
        setSidebarReadout('hx-flow', exchanger.results.flow, 'm3/h');
        setSidebarReadout('hx-mass-flow', exchanger.results.massFlow, 'kg/h');
        setSidebarReadout('hx-calculated-duty', exchanger.results.calculatedDuty, 'kW');
        setSidebarReadout('hx-duty-residual', exchanger.results.dutyResidual, 'kW');
        setSidebarReadout('hx-density', exchanger.results.density, 'kg/m3');
        setSidebarReadout('hx-specific-heat', exchanger.results.specificHeat, 'kJ/kg.K');
        setSidebarReadout('hx-vapor-pressure', exchanger.results.vaporPressure, 'bar a');
        setSidebarReadout('hx-npsh-loss-contribution', exchanger.results.npshLossContribution, 'm');
    }

    if (typeof updateHeatExchangerCalculationTraceReadout === 'function') {
        updateHeatExchangerCalculationTraceReadout(exchangerId);
    }
}

function updateAllHeatExchangerReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (globalModel[nodeId]?.type === 'heatExchanger') {
            updateHeatExchangerReadout(nodeId);
        }
    });
}

function updateValveReadout(valveId) {
    const valve = globalModel[valveId];
    if (!valve || !['valve', 'checkValve'].includes(valve.type)) return;
    ensureNodeResults(valve);

    const trace = typeof buildValveCalculationTrace === 'function'
        ? buildValveCalculationTrace(valveId, globalModel, connections)
        : null;
    valve.results.calculationTrace = trace;
    if (trace?.hydraulic) {
        valve.results.flow = trace.hydraulic.flow;
        valve.results.density = trace.hydraulic.density;
        valve.results.specificGravity = trace.hydraulic.specificGravity;
        valve.results.diameter = trace.hydraulic.diameter;
        valve.results.velocityHead = trace.hydraulic.velocityHead;
        valve.results.headLoss = trace.hydraulic.headLoss;
        valve.results.pressureDrop = trace.hydraulic.pressureDropBar;
        valve.results.npshLossContribution = trace.hydraulic.npshLossContribution;
        valve.results.effectiveCv = trace.hydraulic.effectiveCv;
        valve.results.effectiveK = trace.hydraulic.effectiveK;
        valve.results.crackingHead = valve.type === 'checkValve' ? trace.hydraulic.crackingHead : null;
    }
    valve.results.status = trace?.status || valve.results.status || '-';
    valve.results.warnings = trace?.warnings || valve.results.warnings || [];

    if (currentSelectedNode === valveId) {
        setSidebarReadout('valve-flow', valve.results.flow, 'm3/h');
        setSidebarReadout('valve-density', valve.results.density, 'kg/m3');
        setSidebarReadout('valve-specific-gravity', valve.results.specificGravity, '');
        setSidebarReadout('valve-diameter', valve.results.diameter, 'm');
        setSidebarReadout('valve-velocity-head', valve.results.velocityHead, 'm');
        setSidebarReadout('valve-head-loss', valve.results.headLoss, 'm');
        setSidebarReadout('valve-pressure-drop', valve.results.pressureDrop, 'bar');
        setSidebarReadout('valve-npsh-loss-contribution', valve.results.npshLossContribution, 'm');
        setSidebarReadout('valve-effective-cv', valve.results.effectiveCv, '');
        setSidebarReadout('valve-effective-k', valve.results.effectiveK, '');
        setSidebarReadout('valve-cracking-head', valve.results.crackingHead, valve.type === 'checkValve' ? 'm' : '');
    }

    if (typeof updateValveCalculationTraceReadout === 'function') {
        updateValveCalculationTraceReadout(valveId);
    }
}

function updateAllValveReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (['valve', 'checkValve'].includes(globalModel[nodeId]?.type)) {
            updateValveReadout(nodeId);
        }
    });
}

function updateSeparatorReadout(vesselId) {
    const vessel = globalModel[vesselId];
    if (!vessel || !['separator', 'verticalVessel'].includes(vessel.type)) return;
    ensureNodeResults(vessel);

    const trace = typeof buildSeparatorCalculationTrace === 'function'
        ? buildSeparatorCalculationTrace(vesselId, globalModel, connections)
        : null;
    vessel.results.calculationTrace = trace;
    if (trace?.boundary) {
        vessel.results.operatingPressureAbsolute = trace.boundary.pressureAbsBar;
        vessel.results.pressureDrop = trace.boundary.pressureDropBar;
        vessel.results.pressureDropHead = trace.boundary.pressureDropHead;
        vessel.results.baseElevation = trace.boundary.baseElevation;
        vessel.results.liquidSurfaceElevation = trace.boundary.liquidSurfaceElevation;
        vessel.results.inletNozzleElevation = trace.boundary.inletNozzleElevation;
        vessel.results.outletNozzleElevation = trace.boundary.outletNozzleElevation;
        vessel.results.outletSubmergence = trace.boundary.outletSubmergence;
        vessel.results.flow = trace.boundary.flow;
        vessel.results.holdupFlow = trace.boundary.holdupFlow;
        vessel.results.holdupVolume = trace.boundary.holdupVolume;
    }
    if (trace?.flowBalance) {
        vessel.results.connectedPipes = trace.flowBalance.connectedPipes || [];
        vessel.results.connectedSources = trace.flowBalance.connectedSources || [];
        vessel.results.sourceFeedFlows = trace.flowBalance.sourceFeedFlows || [];
        vessel.results.hydraulicInletFlow = trace.flowBalance.hydraulicInletFlow;
        vessel.results.hydraulicOutletFlow = trace.flowBalance.hydraulicOutletFlow;
        vessel.results.sourceFeedFlow = trace.flowBalance.sourceFeedFlow;
        vessel.results.inletFlow = trace.flowBalance.inletFlow;
        vessel.results.outletFlow = trace.flowBalance.outletFlow;
        vessel.results.netFlow = trace.flowBalance.netFlow;
        vessel.results.levelTrend = trace.flowBalance.levelTrend;
    }
    vessel.results.status = trace?.status || '-';
    vessel.results.warnings = trace?.warnings || [];

    if (currentSelectedNode === vesselId) {
        setSidebarReadout('vessel-absolute-pressure', vessel.results.operatingPressureAbsolute, 'bar a');
        setSidebarReadout('vessel-pressure-drop', vessel.results.pressureDrop, 'bar');
        setSidebarReadout('vessel-pressure-drop-head', vessel.results.pressureDropHead, 'm');
        setSidebarReadout('vessel-base-elevation', vessel.results.baseElevation, 'm');
        setSidebarReadout('vessel-liquid-surface-elevation', vessel.results.liquidSurfaceElevation, 'm');
        setSidebarReadout('vessel-inlet-nozzle-elevation', vessel.results.inletNozzleElevation, 'm');
        setSidebarReadout('vessel-outlet-nozzle-elevation', vessel.results.outletNozzleElevation, 'm');
        setSidebarReadout('vessel-outlet-submergence', vessel.results.outletSubmergence, 'm');
        setSidebarReadout('vessel-flow', vessel.results.flow, 'm3/h');
        setSidebarReadout('vessel-hydraulic-inlet-flow', vessel.results.hydraulicInletFlow, 'm3/h');
        setSidebarReadout('vessel-hydraulic-outlet-flow', vessel.results.hydraulicOutletFlow, 'm3/h');
        setSidebarReadout('vessel-source-feed-flow', vessel.results.sourceFeedFlow, 'm3/h');
        setSidebarReadout('vessel-inlet-flow', vessel.results.inletFlow, 'm3/h');
        setSidebarReadout('vessel-outlet-flow', vessel.results.outletFlow, 'm3/h');
        setSidebarReadout('vessel-net-flow', vessel.results.netFlow, 'm3/h');
        setSidebarReadout('vessel-level-trend', vessel.results.levelTrend, '');
        setSidebarReadout('vessel-holdup-volume', vessel.results.holdupVolume, 'm3');
    }
    if (typeof updateSeparatorCalculationTraceReadout === 'function') {
        updateSeparatorCalculationTraceReadout(vesselId);
    }
}

function updateAllSeparatorReadouts() {
    Object.keys(globalModel).forEach(nodeId => {
        if (['separator', 'verticalVessel'].includes(globalModel[nodeId]?.type)) {
            updateSeparatorReadout(nodeId);
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
    const boundaryMode = typeof getSinkBoundaryModeValue === 'function' ? getSinkBoundaryModeValue(sink) : sink.props.boundaryMode;
    const pressureBasis = typeof getSinkPressureBasis === 'function' ? getSinkPressureBasis(sink) : (sink.props.pressureBasis || 'Static');
    const pressureInputBasis = typeof getSinkPressureInputBasis === 'function' ? getSinkPressureInputBasis(sink) : (sink.props.pressureInputBasis || 'Absolute');
    const calculatedPressure = pressureBasis === 'Stagnation'
        ? stagnationPressure
        : staticPressure;
    const boundaryPressureInput = typeof getSinkPressureInputValue === 'function' ? getSinkPressureInputValue(sink) : parseFloat(sink.props.pressure);
    const boundaryPressure = typeof getSinkBoundaryAbsolutePressureBar === 'function'
        ? getSinkBoundaryAbsolutePressureBar(sink)
        : (typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(sink)
            : boundaryPressureInput);
    const selectedPressure = Number.isFinite(calculatedPressure) ? calculatedPressure : boundaryPressure;
    const elevation = parseFloat(sink.props.elevation) || 0;
    const hydraulicHead = getPipeHydraulicHeadForNodeSide(pipe, conn || {}, sinkId)
        ?? (Number.isFinite(selectedPressure) ? pressureBarToHead(selectedPressure, density) + elevation : null);
    const pressureResidual = typeof isSinkPressureBoundary === 'function'
        && isSinkPressureBoundary(sink)
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
    if (pressureBasis === 'Static' && sinkConnections.length > 1) {
        warnings.push('Static pressure boundary should connect to one pipe only; use Stagnation for reservoir/header style boundaries.');
    }
    if (typeof isSinkFlowDemandBoundary === 'function' && isSinkFlowDemandBoundary(sink) && (parseFloat(sink.props.demandFlow) || 0) <= 0) {
        warnings.push('Flow Demand must be greater than zero.');
    }
    if (typeof isSinkPressureBoundary === 'function' && isSinkPressureBoundary(sink) && Number.isFinite(pressureResidual) && Math.abs(pressureResidual) > 0.02) {
        warnings.push('Boundary pressure residual exceeds 0.02 bar; check convergence or boundary basis.');
    }
    if (
        typeof isSinkFreeOutletBoundary === 'function'
        && !isSinkFreeOutletBoundary(sink)
        && typeof isSinkPressureBoundary === 'function'
        && isSinkPressureBoundary(sink)
        && pressureInputBasis === PRESSURE_INPUT_BASIS_ABSOLUTE
        && Number.isFinite(boundaryPressure)
        && boundaryPressure <= 0
    ) {
        warnings.push('Outlet Pressure is 0 bar a/vacuum absolute; use 0 bar g or 1.01325 bar a for atmospheric discharge.');
    }
    if (Number.isFinite(selectedPressure) && Number.isFinite(vaporPressure) && selectedPressure <= vaporPressure) {
        warnings.push('Calculated outlet pressure is at or below fluid vapor pressure.');
    }

    sink.results.attachedPipe = conn ? conn.pipeId : '';
    sink.results.boundaryPressureInput = Number.isFinite(boundaryPressureInput) ? Number(boundaryPressureInput.toFixed(3)) : null;
    sink.results.boundaryPressure = Number.isFinite(boundaryPressure) ? Number(boundaryPressure.toFixed(3)) : null;
    sink.results.calculatedPressure = Number.isFinite(calculatedPressure) ? Number(calculatedPressure.toFixed(3)) : null;
    sink.results.staticPressure = Number.isFinite(staticPressure) ? Number(staticPressure.toFixed(3)) : null;
    sink.results.stagnationPressure = Number.isFinite(stagnationPressure) ? Number(stagnationPressure.toFixed(3)) : null;
    sink.results.pressureResidual = Number.isFinite(pressureResidual) ? Number(pressureResidual.toFixed(4)) : null;
    sink.results.flow = Number.isFinite(flow) ? Number(flow.toFixed(3)) : null;
    sink.results.massFlow = Number.isFinite(flow) ? Number((flow * density).toFixed(3)) : null;
    sink.results.temperature = Number.isFinite(temperature) ? Number(temperature.toFixed(3)) : null;
    sink.results.hydraulicHead = Number.isFinite(hydraulicHead) ? Number(hydraulicHead.toFixed(3)) : null;
    sink.results.pressureBasis = pressureBasis;
    sink.results.pressureInputBasis = pressureInputBasis;
    sink.results.boundaryMode = boundaryMode;
    sink.results.status = warnings.length ? 'Warning' : 'OK';
    sink.results.warnings = warnings;

    if (typeof updateObjectOperatingStatusVisual === 'function') {
        updateObjectOperatingStatusVisual(sinkId);
    }

    if (currentSelectedNode === sinkId) {
        setSidebarReadout('sink-attached-pipe', sink.results.attachedPipe || '-');
        setSidebarReadout('sink-boundary-pressure', sink.results.boundaryPressure, 'bar a');
        setSidebarReadout('sink-absolute-pressure', sink.results.boundaryPressure, 'bar a');
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

function getPumpFixedFlowRequest(hydraulicContext) {
    if (isSinkFlowDemandBoundary(hydraulicContext.dischargeBoundary)) {
        const demandFlow = Math.max(0, parseFloat(hydraulicContext.dischargeBoundary.props.demandFlow) || 0);
        return { flow: demandFlow, source: 'sink-flow-demand' };
    }

    const sourceFlow = typeof getPumpOptimizationSourceFlow === 'function'
        ? getPumpOptimizationSourceFlow(hydraulicContext)
        : null;
    if (sourceFlow !== null) {
        return { flow: sourceFlow, source: 'source-flow', sourceId: hydraulicContext.suctionPath.boundaryId };
    }

    return null;
}

function getFixedFlowHeadMismatchWarnings(flowRequest, pumpHead, systemHead) {
    if (!flowRequest || flowRequest.source !== 'source-flow') return [];
    if (!Number.isFinite(pumpHead) || !Number.isFinite(systemHead)) {
        return ['Unable to compare pump head against system head at SRC flow.'];
    }

    const residual = pumpHead - systemHead;
    const tolerance = Math.max(0.2, Math.abs(systemHead) * 0.05);
    if (Math.abs(residual) <= tolerance) return [];

    const formattedResidual = Math.abs(residual).toFixed(2);
    if (residual < 0) {
        return [`Pump head is ${formattedResidual} m below required system head at SRC flow; downstream pressure boundary will not be met.`];
    }

    return [`Pump head is ${formattedResidual} m above required system head at SRC flow; downstream pressure boundary will be over-pressured.`];
}

function getOverSpecifiedFlowPressureWarnings(flowRequest, hydraulicContext) {
    if (!flowRequest || flowRequest.source !== 'source-flow') return [];
    if (!isSinkPressureBoundary(hydraulicContext?.dischargeBoundary)) return [];
    return ['Flow, downstream pressure, and pump curve are all fixed. Calculation will report residual head.'];
}

function updateSimulation(options = {}) {
    const { renderSidebarAfter = true } = options;
    const fluid = globalModel['FLUID'];
    if (!fluid) return;

    if (typeof syncAllSourceTemperaturesFromFluidBasis === 'function') {
        syncAllSourceTemperaturesFromFluidBasis();
    }
    const sourceBoundaryChanged = typeof reconcileAllSourceBoundaryConfigurations === 'function'
        ? reconcileAllSourceBoundaryConfigurations({ detachInvalidAttachment: true })
        : false;
    if (typeof normalizeAllSinkProps === 'function') {
        normalizeAllSinkProps();
    }

    const density = fluid.props.density; 
    const vaporPressure = fluid.props.vaporPressure * 100000; // bar to Pa
    
    // Sync vapor pressure to all tanks
    const tanks = Object.keys(globalModel).filter(k => globalModel[k].type === 'tank');
    tanks.forEach(tankId => {
        if (typeof normalizeTankProps === 'function') normalizeTankProps(globalModel[tankId]);
        globalModel[tankId].props.vaporPressure = fluid.props.vaporPressure;
    });

    if (typeof updateAllValveCompatibilityResults === 'function') {
        updateAllValveCompatibilityResults(globalModel, connections, { syncDiameter: true });
    }

    resetHydraulicPipeResults(globalModel);
    
    const pumps = Object.keys(globalModel).filter(k => globalModel[k].type === 'pump');
    
    pumps.forEach(pumpId => {
        const pump = globalModel[pumpId];
        ensureNodeResults(pump);

        const hydraulicContext = createPumpHydraulicContext(pumpId, globalModel, connections, density, vaporPressure);
        
        pump.results.sysCurve = [];
        pump.results.pumpCurve = [];

        const performanceModel = createPumpPerformanceModel(pump);
        updatePumpPerformanceMetadata(pump, performanceModel);
        if (performanceModel.isIncomplete) {
            resetPumpCalculatedResults(pump, 'Input Required', performanceModel.warnings || ['Complete pump inputs before solving.']);
            refreshPumpUiReadouts(pumpId, pump);
            return;
        }
        const pumpInputAudit = typeof getPumpInputAudit === 'function' ? getPumpInputAudit(pump.props) : { isReady: true, missing: [], warnings: [] };
        if (!pumpInputAudit.isReady) {
            resetPumpCalculatedResults(pump, 'Input Required', [
                `Complete pump inputs: ${pumpInputAudit.missing.join(', ')}.`,
                ...(pumpInputAudit.warnings || [])
            ]);
            refreshPumpUiReadouts(pumpId, pump);
            return;
        }
        const getPumpHead = performanceModel.getHead;
        
        const calcSysHead = (q) => {
            const systemHead = calculatePumpSystemHead(hydraulicContext, q);
            return systemHead === null ? null : systemHead;
        };
        
        const STEP = 5;
        const flowRequest = getPumpFixedFlowRequest(hydraulicContext);
        const fixedFlow = flowRequest ? flowRequest.flow : null;
        const MAX_FLOW = Math.ceil(Math.max(STEP, performanceModel.maxFlow, fixedFlow || 0) / STEP) * STEP;

        if (flowRequest !== null) {
            const fixedHead = getPumpHead(fixedFlow);
            const systemHeadAtFixedFlow = calcSysHead(fixedFlow);
            for (let q = 0; q <= MAX_FLOW; q += STEP) {
                pump.results.pumpCurve.push([q, getPumpHead(q)]);
                pump.results.sysCurve.push([
                    q,
                    flowRequest.source === 'sink-flow-demand'
                        ? (Math.abs(q - fixedFlow) <= STEP / 2 ? fixedHead : null)
                        : calcSysHead(q)
                ]);
            }

            if (!hydraulicContext.isComplete) {
                const downstreamLabel = flowRequest.source === 'sink-flow-demand'
                    ? 'active downstream flow-demand SNK'
                    : 'active downstream SNK';
                resetPumpCalculatedResults(pump, 'Incomplete network', getIncompleteHydraulicNetworkWarnings(hydraulicContext, downstreamLabel));
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            if (fixedFlow <= 0) {
                const message = flowRequest.source === 'sink-flow-demand'
                    ? 'Flow Demand must be greater than zero.'
                    : 'SRC flow input must be greater than zero.';
                resetPumpCalculatedResults(pump, 'Invalid flow demand', [message]);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            if (fixedFlow < performanceModel.minFlow || fixedFlow > performanceModel.maxFlow) {
                const message = flowRequest.source === 'sink-flow-demand'
                    ? 'Flow Demand is outside the pump curve range; required pressure is not reliable.'
                    : 'SRC flow is outside the pump curve range; solved pressure is not reliable.';
                resetPumpCalculatedResults(pump, 'Outside curve', [message]);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            const hydraulicSnapshot = flowRequest.source === 'sink-flow-demand'
                ? calculatePumpFlowDemandSnapshot(hydraulicContext, fixedFlow, fixedHead)
                : calculatePumpHydraulicSnapshot(hydraulicContext, fixedFlow, fixedHead);
            if (!hydraulicSnapshot) {
                resetPumpCalculatedResults(pump, 'Incomplete calculation', ['Unable to calculate fixed-flow hydraulic snapshot.']);
                refreshPumpUiReadouts(pumpId, pump);
                return;
            }

            const demandWarnings = [];
            if (flowRequest.source === 'sink-flow-demand') {
                const dischargePressureBasis = typeof getSinkPressureBasis === 'function'
                    ? getSinkPressureBasis(hydraulicContext.dischargeBoundary)
                    : hydraulicContext.dischargeBoundary.props.pressureBasis;
                const selectedPressure = dischargePressureBasis === 'Stagnation'
                    ? hydraulicSnapshot.sinkStagnationPressureBar
                    : hydraulicSnapshot.sinkStaticPressureBar;
                if (selectedPressure <= 0) {
                    demandWarnings.push('Calculated outlet pressure is at or below 0 bar a for this flow demand.');
                }
            } else {
                demandWarnings.push(...getOverSpecifiedFlowPressureWarnings(flowRequest, hydraulicContext));
                demandWarnings.push(...getFixedFlowHeadMismatchWarnings(flowRequest, fixedHead, systemHeadAtFixedFlow));
            }

            const requiredHeadForReadout = flowRequest.source === 'sink-flow-demand'
                ? fixedHead
                : systemHeadAtFixedFlow;
            const headResidual = flowRequest.source === 'sink-flow-demand'
                ? 0
                : (Number.isFinite(systemHeadAtFixedFlow) ? fixedHead - systemHeadAtFixedFlow : null);
            const solveInfo = {
                solveMode: flowRequest.source === 'sink-flow-demand' ? 'Solved at SNK flow demand' : 'Solved at SRC flow',
                flowBasis: flowRequest.source === 'sink-flow-demand'
                    ? `${hydraulicContext.dischargePath.boundaryId} flow demand`
                    : `${flowRequest.sourceId || hydraulicContext.suctionPath.boundaryId} flow input`,
                fixedFlow,
                requiredSystemHead: requiredHeadForReadout,
                headResidual,
                pressureResidual: Number.isFinite(headResidual) ? pressureHeadToBar(headResidual, density) : null,
                downstreamBoundary: hydraulicContext.dischargePath.boundaryId,
                statusWhenOk: flowRequest.source === 'sink-flow-demand' ? 'Solved at SNK flow demand' : 'Solved at SRC flow'
            };

            applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, fixedFlow, fixedHead, hydraulicContext.density, performanceModel, demandWarnings, solveInfo);
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
            applyPumpOperatingPointResults(pump, hydraulicContext, hydraulicSnapshot, opFlow, opHead, hydraulicContext.density, performanceModel, [], {
                solveMode: 'Solved at pump/system intersection',
                flowBasis: 'Pump/system intersection',
                downstreamBoundary: hydraulicContext.dischargePath.boundaryId
            });
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

    updateAllTankReadouts();
    updateAllValveReadouts();
    updateAllHeatExchangerReadouts();
    updateAllSeparatorReadouts();
    updateAllSinkReadouts();
    updateAllInstrumentReadouts();
    if (typeof updateAllObjectOperatingStatusVisuals === 'function') {
        updateAllObjectOperatingStatusVisuals();
    }

    if (typeof updateAllSourceCalculationTraceReadouts === 'function') {
        updateAllSourceCalculationTraceReadouts();
    }
    if (typeof updateAllSinkCalculationTraceReadouts === 'function') {
        updateAllSinkCalculationTraceReadouts();
    }
    if (typeof updateCanvasWarningPanel === 'function') {
        updateCanvasWarningPanel();
    }
    if (typeof drawConnections === 'function') {
        drawConnections();
    }

    if (renderSidebarAfter && currentSelectedNode && !isSidebarEditActive()) {
        renderSidebar(currentSelectedNode);
    }
}
