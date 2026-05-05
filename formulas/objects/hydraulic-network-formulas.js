const HYDRAULIC_PASS_THROUGH_TYPES = [
    'valve',
    'checkValve',
    'junction',
    'mixer',
    'heatExchanger',
    'separator',
    'verticalVessel'
];

function toHydraulicNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getHydraulicGravity() {
    return typeof GRAVITY === 'number' ? GRAVITY : 9.81;
}

function pressureBarToHead(pressureBar, density) {
    const rho = Math.max(toHydraulicNumber(density, 1000), 1);
    return toHydraulicNumber(pressureBar) * 100000 / (rho * getHydraulicGravity());
}

function pressureHeadToBar(pressureHead, density) {
    const rho = Math.max(toHydraulicNumber(density, 1000), 1);
    return toHydraulicNumber(pressureHead) * rho * getHydraulicGravity() / 100000;
}

function isSinkPressureBoundary(node) {
    return !!(node && node.type === 'sink' && node.props?.active !== 'Inactive' && node.props?.boundaryMode !== 'Flow Demand');
}

function isSinkFlowDemandBoundary(node) {
    return !!(node && node.type === 'sink' && node.props?.active !== 'Inactive' && node.props?.boundaryMode === 'Flow Demand');
}

function getPipeVelocityHead(pipeId, flowRateM3H, model, segmentSelector = 'outlet') {
    const pipe = model[pipeId];
    if (!pipe || pipe.type !== 'pipe' || !pipe.props || typeof calculatePipeHydraulicSegments !== 'function') return 0;

    const segments = calculatePipeHydraulicSegments(flowRateM3H, pipe.props);
    if (!segments.length) return 0;

    let segment = segments[segments.length - 1];
    if (segmentSelector === 'inlet') segment = segments[0];
    if (segmentSelector === 'average') {
        const average = segments.reduce((sum, item) => sum + Math.pow(item.velocity, 2) / (2 * getHydraulicGravity()), 0) / segments.length;
        return Number.isFinite(average) ? average : 0;
    }

    const velocityHead = Math.pow(segment.velocity, 2) / (2 * getHydraulicGravity());
    return Number.isFinite(velocityHead) ? velocityHead : 0;
}

function getBoundaryPipeVelocityHead(node, flowRateM3H, path, model) {
    if (!node || !path || !Array.isArray(path.steps) || path.steps.length === 0) return 0;
    const terminalStep = path.steps[path.steps.length - 1];
    if (!terminalStep || (terminalStep.to !== node.name && model[terminalStep.to] !== node)) return 0;
    return getPipeVelocityHead(terminalStep.pipeId, flowRateM3H, model, 'outlet');
}

function isHydraulicPassThroughNode(node) {
    return !!(node && HYDRAULIC_PASS_THROUGH_TYPES.includes(node.type));
}

function isHydraulicBoundaryNode(node, direction) {
    if (!node) return false;
    if (node.type === 'tank') return true;
    if (direction === 'upstream') return node.type === 'source';
    if (direction === 'downstream') return node.type === 'sink' && node.props?.active !== 'Inactive';
    return node.type === 'source' || node.type === 'sink';
}

function getNodeHydraulicElevation(node) {
    if (!node || !node.props) return 0;
    if (node.type === 'tank') {
        return toHydraulicNumber(node.props.elevation) + toHydraulicNumber(node.props.liquidLevel);
    }
    return toHydraulicNumber(node.props.elevation);
}

function getBoundaryHydraulicHead(node, density, flowRateM3H = 0, path = null, model = globalModel) {
    if (!node || !node.props) return null;
    if (isSinkFlowDemandBoundary(node)) return null;

    const pressureHead = pressureBarToHead(node.props.pressure, density);
    let boundaryHead = pressureHead + getNodeHydraulicElevation(node);

    if (node.type === 'sink' && node.props.pressureBasis === 'Static') {
        boundaryHead += getBoundaryPipeVelocityHead(node, flowRateM3H, path, model);
    }

    return boundaryHead;
}

function traceHydraulicPath(startNodeId, direction, model, connectionList) {
    const reverseSearch = direction === 'upstream';
    const traversed = [];
    const visitedNodes = new Set([startNodeId]);
    const visitedPipes = new Set();
    let currentId = startNodeId;
    let boundaryId = null;

    for (let stepCount = 0; stepCount < 80; stepCount++) {
        const candidates = (connectionList || []).filter(conn => (
            reverseSearch ? conn.to === currentId : conn.from === currentId
        ));
        const conn = candidates.find(item => !visitedPipes.has(item.pipeId));
        if (!conn) break;

        traversed.push({
            pipeId: conn.pipeId,
            from: conn.from,
            to: conn.to
        });
        visitedPipes.add(conn.pipeId);

        const nextId = reverseSearch ? conn.from : conn.to;
        const nextNode = model[nextId];
        if (!nextNode) break;

        if (isHydraulicBoundaryNode(nextNode, direction)) {
            boundaryId = nextId;
            break;
        }

        if (!isHydraulicPassThroughNode(nextNode) || visitedNodes.has(nextId)) {
            break;
        }

        visitedNodes.add(nextId);
        currentId = nextId;
    }

    return {
        direction,
        boundaryId,
        steps: reverseSearch ? traversed.reverse() : traversed,
        isComplete: !!boundaryId
    };
}

function getFluidSpecificGravity(model) {
    const fluid = model.FLUID;
    if (fluid && fluid.props && Number.isFinite(parseFloat(fluid.props.sg))) {
        return Math.max(parseFloat(fluid.props.sg), 0.001);
    }
    const density = fluid && fluid.props ? toHydraulicNumber(fluid.props.density, 1000) : 1000;
    return Math.max(density / 999.972, 0.001);
}

function calculateCvPressureDropBar(flowRateM3H, cv, specificGravity) {
    const flow = Math.max(toHydraulicNumber(flowRateM3H), 0);
    const effectiveCv = Math.max(toHydraulicNumber(cv), 0.001);
    if (flow <= 0) return 0;

    const flowGpm = flow * 4.402867;
    const dpPsi = Math.max(toHydraulicNumber(specificGravity, 1), 0.001) * Math.pow(flowGpm / effectiveCv, 2);
    return dpPsi * 0.0689476;
}

function calculateHydraulicEquipmentLossHead(node, flowRateM3H, density, model) {
    if (!node || !node.props || flowRateM3H <= 0) return 0;

    if (node.type === 'valve') {
        const opening = Math.max(0, Math.min(100, toHydraulicNumber(node.props.opening, 100)));
        if (opening <= 0) return 1000000;
        const cv = toHydraulicNumber(node.props.cv, 100) * (opening / 100);
        const dpBar = calculateCvPressureDropBar(flowRateM3H, cv, getFluidSpecificGravity(model));
        return pressureBarToHead(dpBar, density);
    }

    if (node.type === 'checkValve') {
        const cvDropBar = calculateCvPressureDropBar(flowRateM3H, node.props.cv || 100, getFluidSpecificGravity(model));
        const crackingDropBar = Math.max(toHydraulicNumber(node.props.crackingPressure), 0);
        return pressureBarToHead(cvDropBar + crackingDropBar, density);
    }

    if (node.type === 'heatExchanger' || node.type === 'separator' || node.type === 'verticalVessel') {
        const dpBar = Math.max(toHydraulicNumber(node.props.pressureDrop), 0);
        return pressureBarToHead(dpBar, density);
    }

    return 0;
}

function calculateHydraulicPipeLossHead(pipeId, flowRateM3H, model) {
    const pipe = model[pipeId];
    if (!pipe || pipe.type !== 'pipe' || !pipe.props || typeof calculatePipeHeadLoss !== 'function') {
        return 0;
    }
    return calculatePipeHeadLoss(flowRateM3H, pipe.props);
}

function calculateHydraulicPathLossHead(path, flowRateM3H, model, density, terminalNodeId) {
    if (!path || !path.isComplete) return null;

    return path.steps.reduce((sum, step) => {
        const pipeLoss = calculateHydraulicPipeLossHead(step.pipeId, flowRateM3H, model);
        const nodeLoss = step.to === terminalNodeId
            ? 0
            : calculateHydraulicEquipmentLossHead(model[step.to], flowRateM3H, density, model);
        return sum + pipeLoss + nodeLoss;
    }, 0);
}

function createPumpHydraulicContext(pumpId, model, connectionList, density, vaporPressurePa) {
    const suctionPath = traceHydraulicPath(pumpId, 'upstream', model, connectionList);
    const dischargePath = traceHydraulicPath(pumpId, 'downstream', model, connectionList);
    const suctionBoundary = suctionPath.boundaryId ? model[suctionPath.boundaryId] : null;
    const dischargeBoundary = dischargePath.boundaryId ? model[dischargePath.boundaryId] : null;

    return {
        pumpId,
        pump: model[pumpId],
        density,
        vaporPressurePa,
        suctionPath,
        dischargePath,
        suctionBoundary,
        dischargeBoundary,
        isComplete: !!(suctionBoundary && dischargeBoundary)
    };
}

function calculatePumpSystemHead(context, flowRateM3H) {
    if (!context || !context.isComplete) return null;

    if (isSinkFlowDemandBoundary(context.dischargeBoundary)) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(context.suctionBoundary, context.density, flowRateM3H, context.suctionPath, globalModel);
    const dischargeBoundaryHead = getBoundaryHydraulicHead(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, globalModel);
    if (suctionBoundaryHead === null || dischargeBoundaryHead === null) return null;

    const suctionLoss = calculateHydraulicPathLossHead(
        context.suctionPath,
        flowRateM3H,
        globalModel,
        context.density,
        context.pumpId
    );
    const dischargeLoss = calculateHydraulicPathLossHead(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId
    );
    if (suctionLoss === null || dischargeLoss === null) return null;

    return (dischargeBoundaryHead - suctionBoundaryHead) + suctionLoss + dischargeLoss;
}

function calculatePumpHydraulicSnapshot(context, flowRateM3H, pumpHead) {
    if (!context || !context.isComplete) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(context.suctionBoundary, context.density, flowRateM3H, context.suctionPath, globalModel);
    const dischargeBoundaryHead = getBoundaryHydraulicHead(context.dischargeBoundary, context.density, flowRateM3H, context.dischargePath, globalModel);
    const suctionLoss = calculateHydraulicPathLossHead(
        context.suctionPath,
        flowRateM3H,
        globalModel,
        context.density,
        context.pumpId
    );
    const dischargeLoss = calculateHydraulicPathLossHead(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId
    );
    if ([suctionBoundaryHead, dischargeBoundaryHead, suctionLoss, dischargeLoss].some(value => value === null)) {
        return null;
    }

    const pumpElevation = getNodeHydraulicElevation(context.pump);
    const suctionHeadAtPump = suctionBoundaryHead - suctionLoss;
    const dischargeHeadAtPump = suctionHeadAtPump + pumpHead;
    const vaporPressureHead = context.vaporPressurePa / (context.density * getHydraulicGravity());

    return {
        suctionBoundaryHead,
        dischargeBoundaryHead,
        suctionLoss,
        dischargeLoss,
        suctionHeadAtPump,
        dischargeHeadAtPump,
        npsha: suctionHeadAtPump - pumpElevation - vaporPressureHead,
        suctionPressureBar: pressureHeadToBar(suctionHeadAtPump - pumpElevation, context.density),
        dischargePressureBar: pressureHeadToBar(dischargeHeadAtPump - pumpElevation, context.density),
        systemHead: (dischargeBoundaryHead - suctionBoundaryHead) + suctionLoss + dischargeLoss
    };
}

function calculatePumpFlowDemandSnapshot(context, flowRateM3H, pumpHead) {
    if (!context || !context.isComplete || !isSinkFlowDemandBoundary(context.dischargeBoundary)) return null;

    const suctionBoundaryHead = getBoundaryHydraulicHead(context.suctionBoundary, context.density, flowRateM3H, context.suctionPath, globalModel);
    const suctionLoss = calculateHydraulicPathLossHead(
        context.suctionPath,
        flowRateM3H,
        globalModel,
        context.density,
        context.pumpId
    );
    const dischargeLoss = calculateHydraulicPathLossHead(
        context.dischargePath,
        flowRateM3H,
        globalModel,
        context.density,
        context.dischargePath.boundaryId
    );
    if ([suctionBoundaryHead, suctionLoss, dischargeLoss].some(value => value === null)) {
        return null;
    }

    const pumpElevation = getNodeHydraulicElevation(context.pump);
    const boundaryElevation = getNodeHydraulicElevation(context.dischargeBoundary);
    const terminalVelocityHead = getBoundaryPipeVelocityHead(context.dischargeBoundary, flowRateM3H, context.dischargePath, globalModel);
    const suctionHeadAtPump = suctionBoundaryHead - suctionLoss;
    const dischargeHeadAtPump = suctionHeadAtPump + pumpHead;
    const dischargeBoundaryHead = dischargeHeadAtPump - dischargeLoss;
    const vaporPressureHead = context.vaporPressurePa / (context.density * getHydraulicGravity());
    const sinkStaticPressureBar = pressureHeadToBar(dischargeBoundaryHead - boundaryElevation - terminalVelocityHead, context.density);
    const sinkStagnationPressureBar = pressureHeadToBar(dischargeBoundaryHead - boundaryElevation, context.density);

    return {
        suctionBoundaryHead,
        dischargeBoundaryHead,
        suctionLoss,
        dischargeLoss,
        suctionHeadAtPump,
        dischargeHeadAtPump,
        terminalVelocityHead,
        sinkStaticPressureBar,
        sinkStagnationPressureBar,
        npsha: suctionHeadAtPump - pumpElevation - vaporPressureHead,
        suctionPressureBar: pressureHeadToBar(suctionHeadAtPump - pumpElevation, context.density),
        dischargePressureBar: pressureHeadToBar(dischargeHeadAtPump - pumpElevation, context.density),
        systemHead: pumpHead
    };
}

function resetHydraulicPipeResults(model) {
    Object.keys(model).forEach(nodeId => {
        const node = model[nodeId];
        if (!node || node.type !== 'pipe') return;
        node.results = {
            flow: 0,
            pressure: null,
            inletPressure: null,
            outletPressure: null,
            hydraulicHead: null,
            pressureCalculated: false
        };
    });

    window.hydraulicNetworkState = {
        pipes: {},
        pumps: {}
    };
}

function setPipeHydraulicResult(model, step, flowRateM3H, inletHead, outletHead, density) {
    const pipe = model[step.pipeId];
    if (!pipe || pipe.type !== 'pipe') return;

    const fromElevation = getNodeHydraulicElevation(model[step.from]);
    const toElevation = getNodeHydraulicElevation(model[step.to]);
    const midHead = (inletHead + outletHead) / 2;
    const midElevation = (fromElevation + toElevation) / 2;
    const inletVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'inlet');
    const outletVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'outlet');
    const averageVelocityHead = getPipeVelocityHead(step.pipeId, flowRateM3H, model, 'average');

    const result = {
        flow: Number(flowRateM3H.toFixed(3)),
        pressure: Number(pressureHeadToBar(midHead - midElevation - averageVelocityHead, density).toFixed(3)),
        inletPressure: Number(pressureHeadToBar(inletHead - fromElevation - inletVelocityHead, density).toFixed(3)),
        outletPressure: Number(pressureHeadToBar(outletHead - toElevation - outletVelocityHead, density).toFixed(3)),
        inletStagnationPressure: Number(pressureHeadToBar(inletHead - fromElevation, density).toFixed(3)),
        outletStagnationPressure: Number(pressureHeadToBar(outletHead - toElevation, density).toFixed(3)),
        velocityHead: Number(averageVelocityHead.toFixed(3)),
        inletHydraulicHead: Number(inletHead.toFixed(3)),
        outletHydraulicHead: Number(outletHead.toFixed(3)),
        hydraulicHead: Number(midHead.toFixed(3)),
        pressureCalculated: true
    };

    pipe.results = result;
    if (window.hydraulicNetworkState) {
        window.hydraulicNetworkState.pipes[step.pipeId] = result;
    }
}

function applyHydraulicPathResults(context, snapshot, flowRateM3H) {
    if (!context || !snapshot) return;

    let currentHead = snapshot.suctionBoundaryHead;
    context.suctionPath.steps.forEach(step => {
        const pipeLoss = calculateHydraulicPipeLossHead(step.pipeId, flowRateM3H, globalModel);
        const outletHead = currentHead - pipeLoss;
        setPipeHydraulicResult(globalModel, step, flowRateM3H, currentHead, outletHead, context.density);
        currentHead = outletHead;
        if (step.to !== context.pumpId) {
            currentHead -= calculateHydraulicEquipmentLossHead(globalModel[step.to], flowRateM3H, context.density, globalModel);
        }
    });

    currentHead = snapshot.dischargeHeadAtPump;
    context.dischargePath.steps.forEach(step => {
        const pipeLoss = calculateHydraulicPipeLossHead(step.pipeId, flowRateM3H, globalModel);
        const outletHead = currentHead - pipeLoss;
        setPipeHydraulicResult(globalModel, step, flowRateM3H, currentHead, outletHead, context.density);
        currentHead = outletHead;
        if (step.to !== context.dischargePath.boundaryId) {
            currentHead -= calculateHydraulicEquipmentLossHead(globalModel[step.to], flowRateM3H, context.density, globalModel);
        }
    });

    if (window.hydraulicNetworkState) {
        window.hydraulicNetworkState.pumps[context.pumpId] = {
            suctionPath: context.suctionPath,
            dischargePath: context.dischargePath,
            snapshot
        };
    }
}
