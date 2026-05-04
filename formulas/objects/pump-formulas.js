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
