function toPumpNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPumpNumber(value, fallback, min, max) {
    return Math.min(max, Math.max(min, toPumpNumber(value, fallback)));
}

function normalizePumpProps(props = {}) {
    props.designFlow = clampPumpNumber(props.designFlow, 100, 0.001, 1000000);
    props.designHead = clampPumpNumber(props.designHead, 40, 0.001, 1000000);
    props.designEfficiency = clampPumpNumber(props.designEfficiency, 75, 1, 95);
    props.designNpshr = clampPumpNumber(props.designNpshr, 3, 0.01, 10000);
    props.bepFlow = clampPumpNumber(props.bepFlow, props.designFlow, 0.001, 1000000);
    props.porMinPercent = clampPumpNumber(props.porMinPercent, 70, 1, 200);
    props.porMaxPercent = clampPumpNumber(props.porMaxPercent, 120, 1, 250);
    props.aorMinPercent = clampPumpNumber(props.aorMinPercent, 50, 1, 200);
    props.aorMaxPercent = clampPumpNumber(props.aorMaxPercent, 130, 1, 300);
    props.minNpshMarginRatio = clampPumpNumber(props.minNpshMarginRatio, 1.1, 1, 10);
    props.minNpshMargin = clampPumpNumber(props.minNpshMargin, 0.5, 0, 1000);

    if (props.porMinPercent > props.porMaxPercent) {
        const tmp = props.porMinPercent;
        props.porMinPercent = props.porMaxPercent;
        props.porMaxPercent = tmp;
    }
    if (props.aorMinPercent > props.aorMaxPercent) {
        const tmp = props.aorMinPercent;
        props.aorMinPercent = props.aorMaxPercent;
        props.aorMaxPercent = tmp;
    }

    props.aorMinPercent = Math.min(props.aorMinPercent, props.porMinPercent);
    props.aorMaxPercent = Math.max(props.aorMaxPercent, props.porMaxPercent);
    return props;
}

function interpolatePumpCurvePoint(curveData, q, key) {
    const data = (curveData || [])
        .filter(point => Number.isFinite(toPumpNumber(point.flow, NaN)))
        .map(point => ({
            flow: toPumpNumber(point.flow),
            head: toPumpNumber(point.head),
            eff: toPumpNumber(point.eff),
            npshr: toPumpNumber(point.npshr)
        }))
        .sort((a, b) => a.flow - b.flow);

    if (data.length === 0) return 0;
    if (q <= data[0].flow) return data[0][key];
    if (q >= data[data.length - 1].flow) return data[data.length - 1][key];

    for (let i = 0; i < data.length - 1; i++) {
        if (q >= data[i].flow && q <= data[i + 1].flow) {
            const span = data[i + 1].flow - data[i].flow;
            const ratio = span === 0 ? 0 : (q - data[i].flow) / span;
            return data[i][key] + (data[i + 1][key] - data[i][key]) * ratio;
        }
    }

    return 0;
}

function createPumpPerformanceModel(pump) {
    const props = normalizePumpProps(pump.props || {});

    if (props.inputMode === 'Advanced' && props.curveData && props.curveData.length > 0) {
        const curve = props.curveData
            .map(point => ({ ...point, flow: toPumpNumber(point.flow) }))
            .sort((a, b) => a.flow - b.flow);
        const bestPoint = curve.reduce((best, point) => (
            toPumpNumber(point.eff) > toPumpNumber(best.eff) ? point : best
        ), curve[0]);
        props.bepFlow = clampPumpNumber(props.bepFlow, toPumpNumber(bestPoint.flow, props.designFlow), 0.001, 1000000);

        return {
            source: 'Advanced curve',
            bepFlow: props.bepFlow,
            minFlow: Math.max(0, toPumpNumber(curve[0].flow)),
            maxFlow: Math.max(...curve.map(point => toPumpNumber(point.flow))),
            getHead: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'head')),
            getEfficiency: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'eff')),
            getNpshr: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'npshr'))
        };
    }

    const qBep = props.bepFlow || props.designFlow;
    const hBep = props.designHead;
    const eBep = props.designEfficiency;
    const npshrBep = props.designNpshr;
    const shutoffHead = hBep * 1.25;
    const runoutFlow = qBep * 1.7;
    const headDrop = shutoffHead - hBep;

    return {
        source: 'Basic estimated curve',
        bepFlow: qBep,
        minFlow: 0,
        maxFlow: runoutFlow,
        getHead: q => Math.max(0, shutoffHead - headDrop * Math.pow(q / qBep, 2)),
        getEfficiency: q => {
            const ratio = q / qBep;
            const shape = Math.max(0, 1 - 1.75 * Math.pow(ratio - 1, 2));
            return Math.max(0, eBep * shape);
        },
        getNpshr: q => {
            const ratio = Math.max(0, q / qBep);
            return Math.max(0.01, npshrBep * (0.65 + 0.35 * Math.pow(ratio, 2.2)));
        }
    };
}

function classifyPumpOperatingRegion(flowRateM3H, props = {}) {
    normalizePumpProps(props);
    const bepFlow = Math.max(toPumpNumber(props.bepFlow, props.designFlow), 0.001);
    const ratio = toPumpNumber(flowRateM3H) / bepFlow;
    const percent = ratio * 100;

    if (percent >= props.porMinPercent && percent <= props.porMaxPercent) {
        return { status: 'POR', ratio, percent, message: 'Within preferred operating region' };
    }
    if (percent >= props.aorMinPercent && percent <= props.aorMaxPercent) {
        return { status: 'AOR', ratio, percent, message: 'Within allowable operating region, outside POR' };
    }
    return { status: 'Outside AOR', ratio, percent, message: 'Outside configured allowable operating region' };
}

function evaluateNpshMargin(npsha, npshr, props = {}) {
    normalizePumpProps(props);
    const available = toPumpNumber(npsha, NaN);
    const required = toPumpNumber(npshr, NaN);
    if (!Number.isFinite(available) || !Number.isFinite(required) || required <= 0) {
        return {
            margin: null,
            ratio: null,
            status: 'Unknown',
            message: 'NPSH margin cannot be evaluated'
        };
    }

    const margin = available - required;
    const ratio = available / required;
    const ok = margin >= props.minNpshMargin && ratio >= props.minNpshMarginRatio;

    return {
        margin,
        ratio,
        status: ok ? 'OK' : 'Low margin',
        message: ok ? 'NPSH margin OK' : 'NPSH margin below configured minimum'
    };
}

function getPumpOptimizationSourceFlow(context) {
    const sourceFlow = toPumpNumber(context?.suctionBoundary?.props?.flow, NaN);
    return Number.isFinite(sourceFlow) && sourceFlow > 0 ? sourceFlow : null;
}

function getPumpOptimizationTargetFlow(pump, context) {
    if (isSinkFlowDemandBoundary(context?.dischargeBoundary)) {
        const demandFlow = toPumpNumber(context.dischargeBoundary.props.demandFlow, NaN);
        if (Number.isFinite(demandFlow) && demandFlow > 0) return demandFlow;
    }

    const sourceFlow = getPumpOptimizationSourceFlow(context);
    if (sourceFlow !== null) return sourceFlow;

    const currentFlow = toPumpNumber(pump?.results?.flow, NaN);
    if (Number.isFinite(currentFlow) && currentFlow > 0) return currentFlow;

    return Math.max(toPumpNumber(pump?.props?.designFlow, 100), 0.001);
}

function calculatePressureBoundaryHeadForOptimization(node, density, flowRateM3H, path, model) {
    if (!node || !node.props) return null;
    const pressure = toPumpNumber(node.props.pressure, 1.013);
    const pressureHead = pressureBarToHead(pressure > 0 ? pressure : 1.013, density);
    let boundaryHead = pressureHead + getNodeHydraulicElevation(node);

    if (node.type === 'sink' && node.props.pressureBasis === 'Static') {
        boundaryHead += getBoundaryPipeVelocityHead(node, flowRateM3H, path, model);
    }

    return boundaryHead;
}

function calculatePumpRequiredHeadAtFlow(context, flowRateM3H, model = globalModel) {
    if (!context || !context.isComplete) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(
        context.suctionBoundary,
        context.density,
        flowRateM3H,
        context.suctionPath,
        model
    );
    const dischargeBoundaryHead = isSinkFlowDemandBoundary(context.dischargeBoundary)
        ? calculatePressureBoundaryHeadForOptimization(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, model)
        : getBoundaryHydraulicHead(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, model);
    const suctionLoss = calculateHydraulicPathLossHead(
        context.suctionPath,
        flowRateM3H,
        model,
        context.density,
        context.pumpId
    );
    const dischargeLoss = calculateHydraulicPathLossHead(
        context.dischargePath,
        flowRateM3H,
        model,
        context.density,
        context.dischargePath.boundaryId
    );

    if ([suctionBoundaryHead, dischargeBoundaryHead, suctionLoss, dischargeLoss].some(value => value === null)) {
        return null;
    }

    const requiredHead = Math.max(0.001, (dischargeBoundaryHead - suctionBoundaryHead) + suctionLoss + dischargeLoss);
    return {
        requiredHead,
        suctionBoundaryHead,
        dischargeBoundaryHead,
        suctionLoss,
        dischargeLoss
    };
}

function getPumpOptimizationAllowedNpshr(npsha, props) {
    const available = toPumpNumber(npsha, NaN);
    if (!Number.isFinite(available)) return null;
    const ratioLimit = available / Math.max(toPumpNumber(props.minNpshMarginRatio, 1.1), 1);
    const marginLimit = available - Math.max(toPumpNumber(props.minNpshMargin, 0.5), 0);
    return Math.min(ratioLimit, marginLimit);
}

function optimizePumpBasicParameters(pumpId, model = globalModel, connectionList = connections) {
    const pump = model[pumpId];
    const fluid = model.FLUID;
    if (!pump || pump.type !== 'pump' || !fluid?.props) {
        return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before running optimization.'] };
    }

    normalizePumpProps(pump.props);
    const density = Math.max(toPumpNumber(fluid.props.density, 1000), 1);
    const vaporPressurePa = toPumpNumber(fluid.props.vaporPressure, 0) * 100000;
    const context = createPumpHydraulicContext(pumpId, model, connectionList, density, vaporPressurePa);
    const warnings = [];

    if (!context.isComplete) {
        return {
            ok: false,
            status: 'Incomplete network',
            warnings: typeof getIncompleteHydraulicNetworkWarnings === 'function'
                ? getIncompleteHydraulicNetworkWarnings(context)
                : ['Connect upstream SRC and downstream SNK before optimization.']
        };
    }

    const targetFlow = getPumpOptimizationTargetFlow(pump, context);
    const sizing = calculatePumpRequiredHeadAtFlow(context, targetFlow, model);
    if (!sizing || !Number.isFinite(sizing.requiredHead) || sizing.requiredHead <= 0) {
        return {
            ok: false,
            status: 'No valid system head',
            warnings: ['Unable to calculate required head at target flow. Check pipe size, fittings, and boundary pressure.']
        };
    }

    const snapshot = isSinkFlowDemandBoundary(context.dischargeBoundary)
        ? calculatePumpFlowDemandSnapshot(context, targetFlow, sizing.requiredHead)
        : calculatePumpHydraulicSnapshot(context, targetFlow, sizing.requiredHead);
    if (!snapshot) {
        return {
            ok: false,
            status: 'Incomplete snapshot',
            warnings: ['Unable to calculate NPSH at optimized operating point.']
        };
    }

    const allowedNpshr = getPumpOptimizationAllowedNpshr(snapshot.npsha, pump.props);
    let optimizedNpshr = Math.min(
        toPumpNumber(pump.props.designNpshr, 3),
        Number.isFinite(allowedNpshr) ? allowedNpshr * 0.9 : 3
    );
    if (!Number.isFinite(optimizedNpshr) || optimizedNpshr <= 0) {
        optimizedNpshr = 0.1;
        warnings.push('NPSHa is very low; choose a low-NPSHr pump and review suction pressure/losses.');
    } else if (allowedNpshr !== null && allowedNpshr < toPumpNumber(pump.props.designNpshr, 3)) {
        warnings.push('NPSHr reduced to stay below available NPSH margin.');
    }

    if (isSinkFlowDemandBoundary(context.dischargeBoundary)) {
        warnings.push('Flow Demand mode sizes head against the sink pressure field or atmospheric fallback.');
    } else {
        const sourceFlow = getPumpOptimizationSourceFlow(context);
        if (sourceFlow !== null) {
            warnings.push('Target flow taken from upstream SRC flow input.');
        }
    }

    pump.props.inputMode = 'Basic';
    pump.props.designFlow = Number(targetFlow.toFixed(3));
    pump.props.bepFlow = Number(targetFlow.toFixed(3));
    pump.props.designHead = Number(sizing.requiredHead.toFixed(3));
    pump.props.designEfficiency = Math.max(toPumpNumber(pump.props.designEfficiency, 80), 80);
    pump.props.designNpshr = Number(Math.max(0.01, optimizedNpshr).toFixed(3));
    pump.props.porMinPercent = 70;
    pump.props.porMaxPercent = 120;
    pump.props.aorMinPercent = 50;
    pump.props.aorMaxPercent = 130;
    normalizePumpProps(pump.props);

    return {
        ok: true,
        status: warnings.length ? 'Optimized with notes' : 'Optimized',
        targetFlow: pump.props.designFlow,
        requiredHead: pump.props.designHead,
        npsha: Number(snapshot.npsha.toFixed(3)),
        maxAllowedNpshr: allowedNpshr === null ? null : Number(allowedNpshr.toFixed(3)),
        selectedNpshr: pump.props.designNpshr,
        warnings
    };
}
