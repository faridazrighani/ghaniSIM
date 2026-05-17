function toPumpNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampPumpNumber(value, fallback, min, max) {
    return Math.min(max, Math.max(min, toPumpNumber(value, fallback)));
}

function isPumpUnset(value) {
    return value === undefined || value === null || value === '';
}

function isPumpFiniteNumber(value) {
    if (isPumpUnset(value)) return false;
    return Number.isFinite(parseFloat(value));
}

function toOptionalPumpNumber(value) {
    return isPumpUnset(value) ? '' : toPumpNumber(value, NaN);
}

function clampOptionalPumpNumber(value, min, max) {
    if (isPumpUnset(value)) return '';
    const parsed = toPumpNumber(value, NaN);
    if (!Number.isFinite(parsed)) return '';
    return Math.min(max, Math.max(min, parsed));
}

const PUMP_SCREENING_DEFAULTS = {
    designFlow: 100,
    designHead: 40,
    designEfficiency: 75,
    designNpshr: 3,
    bepFlow: 100,
    porMinPercent: 70,
    porMaxPercent: 120,
    aorMinPercent: 50,
    aorMaxPercent: 130,
    minNpshMarginRatio: 1.1,
    minNpshMargin: 0.6
};

const PUMP_INPUT_LABELS = {
    designFlow: 'Design Flow',
    designHead: 'Design Head',
    designEfficiency: 'Design Efficiency',
    designNpshr: 'NPSHr @ BEP / Manual NPSHr',
    bepFlow: 'BEP Flow',
    porMinPercent: 'POR Min',
    porMaxPercent: 'POR Max',
    aorMinPercent: 'AOR Min',
    aorMaxPercent: 'AOR Max',
    minNpshMarginRatio: 'Min NPSH Ratio',
    minNpshMargin: 'Min NPSH Margin'
};

function getPumpInputPlaceholder(key) {
    const value = PUMP_SCREENING_DEFAULTS[key];
    return value === undefined ? '' : `example: ${value}`;
}

function applyPumpScreeningDefaults(props = {}) {
    Object.assign(props, PUMP_SCREENING_DEFAULTS);
    props.screeningDefaultsApplied = true;
    if (!props.npshAssessmentMode) {
        props.npshAssessmentMode = typeof PUMP_NPSH_ASSESSMENT_SCREENING !== 'undefined'
            ? PUMP_NPSH_ASSESSMENT_SCREENING
            : 'Screening';
    }
    if (!props.npshMarginBasis) {
        props.npshMarginBasis = typeof PUMP_NPSH_MARGIN_USER_DEFINED !== 'undefined'
            ? PUMP_NPSH_MARGIN_USER_DEFINED
            : 'User Defined';
    }
    return props;
}

function normalizePumpProps(props = {}) {
    const manualMode = typeof PUMP_OPTIMIZATION_MODE_MANUAL !== 'undefined' ? PUMP_OPTIMIZATION_MODE_MANUAL : 'Manual';
    const autoMode = typeof PUMP_OPTIMIZATION_MODE_AUTO !== 'undefined' ? PUMP_OPTIMIZATION_MODE_AUTO : 'Auto';
    const estimatedNpshr = typeof PUMP_NPSHR_SOURCE_ESTIMATED !== 'undefined' ? PUMP_NPSHR_SOURCE_ESTIMATED : 'Estimated';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    const curveNpshr = typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve';
    const assessmentOptions = typeof PUMP_NPSH_ASSESSMENT_OPTIONS !== 'undefined'
        ? PUMP_NPSH_ASSESSMENT_OPTIONS
        : ['Screening', 'ANSI/HI Guided', 'Engineering Validation'];
    const marginBasisOptions = typeof PUMP_NPSH_MARGIN_BASIS_OPTIONS !== 'undefined'
        ? PUMP_NPSH_MARGIN_BASIS_OPTIONS
        : ['User Defined'];
    if (![manualMode, autoMode].includes(props.optimizationMode)) {
        props.optimizationMode = manualMode;
    }
    if (props.inputMode === 'Advanced') {
        props.npshrSourceMode = curveNpshr;
    } else if (![estimatedNpshr, manualNpshr].includes(props.npshrSourceMode)) {
        props.npshrSourceMode = estimatedNpshr;
    }
    if (!assessmentOptions.includes(props.npshAssessmentMode)) {
        props.npshAssessmentMode = assessmentOptions[0] || 'Screening';
    }
    if (!marginBasisOptions.includes(props.npshMarginBasis)) {
        props.npshMarginBasis = marginBasisOptions[0] || 'User Defined';
    }

    props.elevation = toPumpNumber(props.elevation, 0);
    if (props.suctionElevation === undefined || props.suctionElevation === null || props.suctionElevation === '') {
        props.suctionElevation = props.elevation;
    }
    if (props.dischargeElevation === undefined || props.dischargeElevation === null || props.dischargeElevation === '') {
        props.dischargeElevation = props.elevation;
    }
    props.designFlow = clampOptionalPumpNumber(props.designFlow, 0.001, 1000000);
    props.designHead = clampOptionalPumpNumber(props.designHead, 0.001, 1000000);
    props.designEfficiency = clampOptionalPumpNumber(props.designEfficiency, 1, 95);
    props.designNpshr = clampOptionalPumpNumber(props.designNpshr, 0.01, 10000);
    props.bepFlow = clampOptionalPumpNumber(props.bepFlow, 0.001, 1000000);
    props.porMinPercent = clampOptionalPumpNumber(props.porMinPercent, 1, 200);
    props.porMaxPercent = clampOptionalPumpNumber(props.porMaxPercent, 1, 250);
    props.aorMinPercent = clampOptionalPumpNumber(props.aorMinPercent, 1, 200);
    props.aorMaxPercent = clampOptionalPumpNumber(props.aorMaxPercent, 1, 300);
    props.minNpshMarginRatio = clampOptionalPumpNumber(props.minNpshMarginRatio, 1, 10);
    props.minNpshMargin = clampOptionalPumpNumber(props.minNpshMargin, 0, 1000);

    if (isPumpFiniteNumber(props.porMinPercent) && isPumpFiniteNumber(props.porMaxPercent) && props.porMinPercent > props.porMaxPercent) {
        const tmp = props.porMinPercent;
        props.porMinPercent = props.porMaxPercent;
        props.porMaxPercent = tmp;
    }
    if (isPumpFiniteNumber(props.aorMinPercent) && isPumpFiniteNumber(props.aorMaxPercent) && props.aorMinPercent > props.aorMaxPercent) {
        const tmp = props.aorMinPercent;
        props.aorMinPercent = props.aorMaxPercent;
        props.aorMaxPercent = tmp;
    }

    if (isPumpFiniteNumber(props.aorMinPercent) && isPumpFiniteNumber(props.porMinPercent)) {
        props.aorMinPercent = Math.min(props.aorMinPercent, props.porMinPercent);
    }
    if (isPumpFiniteNumber(props.aorMaxPercent) && isPumpFiniteNumber(props.porMaxPercent)) {
        props.aorMaxPercent = Math.max(props.aorMaxPercent, props.porMaxPercent);
    }
    return props;
}

function collectPumpMissingInputs(props, keys) {
    return keys
        .filter(key => !isPumpFiniteNumber(props[key]))
        .map(key => PUMP_INPUT_LABELS[key] || key);
}

function getPumpPerformanceInputAudit(rawProps = {}) {
    const props = { ...rawProps };
    normalizePumpProps(props);
    const missing = [];
    const warnings = [];
    const curveNpshr = typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve';

    if (props.inputMode === 'Advanced' || props.npshrSourceMode === curveNpshr) {
        const curve = getValidPumpCurveData(props.curveData || []);
        if (curve.length < 2) {
            missing.push('Manufacturer/test curve with at least two valid points');
        }
        if (!isPumpFiniteNumber(props.bepFlow) && curve.length < 2) {
            missing.push('BEP Flow');
        }
    } else {
        missing.push(...collectPumpMissingInputs(props, [
            'designFlow',
            'designHead',
            'designEfficiency',
            'designNpshr',
            'bepFlow'
        ]));
    }

    return {
        isReady: missing.length === 0,
        missing: [...new Set(missing)],
        warnings
    };
}

function isPumpAutoOptimizationEnabled(pump) {
    return false;
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

function getValidPumpCurveData(curveData) {
    return (curveData || [])
        .map(point => ({
            flow: toPumpNumber(point.flow, NaN),
            head: toPumpNumber(point.head, NaN),
            eff: toPumpNumber(point.eff, NaN),
            npshr: toPumpNumber(point.npshr, NaN)
        }))
        .filter(point => (
            Number.isFinite(point.flow)
            && Number.isFinite(point.head)
            && Number.isFinite(point.eff)
            && Number.isFinite(point.npshr)
            && point.flow >= 0
            && point.head >= 0
            && point.eff >= 0
            && point.npshr >= 0
        ))
        .sort((a, b) => a.flow - b.flow);
}

function getAdvancedPumpCurveWarnings(curve, rawCount) {
    const warnings = [];
    if (curve.length !== rawCount) {
        warnings.push('Some pump curve rows are invalid and were ignored.');
    }
    for (let i = 1; i < curve.length; i++) {
        if (curve[i].flow <= curve[i - 1].flow) {
            warnings.push('Pump curve flow points must be strictly increasing for reliable interpolation.');
            break;
        }
    }
    for (let i = 1; i < curve.length; i++) {
        if (curve[i].head > curve[i - 1].head) {
            warnings.push('Pump head curve is not monotonically decreasing; verify manufacturer/test data.');
            break;
        }
    }
    return warnings;
}

const PUMP_NPSH_MARGIN_PRESETS = {
    'General Purpose': {
        por: { ratio: 1.05, margin: 0.6 },
        aor: { ratio: 1.1, margin: 1.0 },
        reference: 'ANSI/HI 9.6.1-2024 general purpose guidance'
    },
    'Petroleum/Hydrocarbon': {
        por: { ratio: 1.1, margin: 1.0 },
        aor: { ratio: 1.1, margin: 1.0 },
        reference: 'ANSI/HI 9.6.1-2024 petroleum/hydrocarbon process guidance'
    },
    'Chemical Process': {
        por: { ratio: 1.1, margin: 0.6 },
        aor: { ratio: 1.2, margin: 1.0 },
        reference: 'ANSI/HI 9.6.1-2024 chemical process conservative guidance'
    },
    'Water/Wastewater': {
        por: { ratio: 1.1, margin: 1.0 },
        aor: { ratio: 1.2, margin: 1.5 },
        reference: 'ANSI/HI 9.6.1-2024 water/wastewater guidance'
    },
    'Building Services': {
        por: { ratio: 1.1, margin: 0.6 },
        aor: { ratio: 1.1, margin: 0.6 },
        reference: 'ANSI/HI 9.6.1-2024 building services guidance'
    },
    'Irrigation': {
        por: { ratio: 1.1, margin: 0.6 },
        aor: { ratio: 1.2, margin: 1.0 },
        reference: 'ANSI/HI 9.6.1-2024 irrigation guidance'
    }
};

function getPumpNpshRegionKey(regionStatus) {
    return regionStatus === 'POR' ? 'por' : 'aor';
}

function getEffectivePumpNpshMarginCriteria(rawProps = {}, regionStatus = 'POR') {
    const props = { ...rawProps };
    normalizePumpProps(props);
    const userDefined = typeof PUMP_NPSH_MARGIN_USER_DEFINED !== 'undefined'
        ? PUMP_NPSH_MARGIN_USER_DEFINED
        : 'User Defined';
    const basis = props.npshMarginBasis || userDefined;

    if (basis === userDefined) {
        const ratio = toOptionalPumpNumber(props.minNpshMarginRatio);
        const margin = toOptionalPumpNumber(props.minNpshMargin);
        const valid = Number.isFinite(ratio) && Number.isFinite(margin);
        return {
            basis,
            regionBasis: 'user',
            ratio,
            margin,
            valid,
            source: 'User configured limit',
            reference: 'User-defined NPSH margin basis',
            warnings: valid ? [] : ['Min NPSH Ratio and Min NPSH Margin are required for user-defined margin basis.']
        };
    }

    const preset = PUMP_NPSH_MARGIN_PRESETS[basis];
    if (!preset) {
        return {
            basis,
            regionBasis: '-',
            ratio: '',
            margin: '',
            valid: false,
            source: 'Unknown standard basis',
            reference: '-',
            warnings: [`NPSH margin basis "${basis}" is not available.`]
        };
    }

    const regionBasis = getPumpNpshRegionKey(regionStatus);
    const selected = preset[regionBasis] || preset.aor || preset.por;
    return {
        basis,
        regionBasis: regionBasis.toUpperCase(),
        ratio: selected.ratio,
        margin: selected.margin,
        valid: true,
        source: 'Standard margin preset',
        reference: preset.reference,
        warnings: []
    };
}

function getPumpInputAudit(rawProps = {}, regionStatus = 'POR') {
    const props = { ...rawProps };
    normalizePumpProps(props);
    const performanceAudit = getPumpPerformanceInputAudit(props);
    const missing = [...performanceAudit.missing];
    const warnings = [...performanceAudit.warnings];
    const criteria = getEffectivePumpNpshMarginCriteria(props, regionStatus);

    missing.push(...collectPumpMissingInputs(props, [
        'porMinPercent',
        'porMaxPercent',
        'aorMinPercent',
        'aorMaxPercent'
    ]));

    if (!criteria.valid) {
        missing.push(...criteria.warnings);
    }

    if (isPumpFiniteNumber(props.porMinPercent)
        && isPumpFiniteNumber(props.porMaxPercent)
        && !(props.porMinPercent <= 100 && props.porMaxPercent >= 100)) {
        warnings.push('POR should include 100% BEP for engineering interpretation.');
    }
    if (isPumpFiniteNumber(props.aorMinPercent)
        && isPumpFiniteNumber(props.porMinPercent)
        && props.aorMinPercent > props.porMinPercent) {
        warnings.push('AOR Min should be less than or equal to POR Min.');
    }
    if (isPumpFiniteNumber(props.aorMaxPercent)
        && isPumpFiniteNumber(props.porMaxPercent)
        && props.aorMaxPercent < props.porMaxPercent) {
        warnings.push('AOR Max should be greater than or equal to POR Max.');
    }

    return {
        isReady: missing.length === 0,
        missing: [...new Set(missing)],
        warnings: [...new Set(warnings)],
        criteria
    };
}

function createIncompletePumpPerformanceModel(props, audit) {
    const maxFlow = Math.max(
        10,
        toPumpNumber(props?.designFlow, NaN) || 0,
        toPumpNumber(props?.bepFlow, NaN) || 0
    );
    return {
        source: 'Incomplete pump data',
        modelBasis: 'Pump datasheet inputs are required before performance and NPSH can be evaluated.',
        warnings: audit?.missing?.length
            ? [`Complete pump inputs: ${audit.missing.join(', ')}.`]
            : ['Complete pump inputs before evaluating pump performance.'],
        isEstimated: true,
        isIncomplete: true,
        missingInputs: audit?.missing || [],
        npshrSourceMode: props?.npshrSourceMode || '-',
        npshrIsEstimated: true,
        bepFlow: toPumpNumber(props?.bepFlow, NaN),
        minFlow: 0,
        maxFlow,
        getHead: () => 0,
        getEfficiency: () => 0,
        getNpshr: () => NaN
    };
}

function createPumpPerformanceModel(pump) {
    const props = normalizePumpProps(pump.props || {});
    const performanceAudit = getPumpPerformanceInputAudit(props);
    if (!performanceAudit.isReady) {
        return createIncompletePumpPerformanceModel(props, performanceAudit);
    }
    const estimatedNpshr = typeof PUMP_NPSHR_SOURCE_ESTIMATED !== 'undefined' ? PUMP_NPSHR_SOURCE_ESTIMATED : 'Estimated';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    const curveNpshr = typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve';

    if (props.inputMode === 'Advanced' && props.curveData && props.curveData.length > 0) {
        const rawCount = props.curveData.length;
        const curve = getValidPumpCurveData(props.curveData);
        if (curve.length >= 2) {
            const bestPoint = curve.reduce((best, point) => (
                toPumpNumber(point.eff) > toPumpNumber(best.eff) ? point : best
            ), curve[0]);
            props.bepFlow = clampPumpNumber(props.bepFlow, toPumpNumber(bestPoint.flow, props.designFlow), 0.001, 1000000);

            return {
                source: 'Advanced manufacturer/test curve',
                modelBasis: 'User-entered pump performance data',
                warnings: getAdvancedPumpCurveWarnings(curve, rawCount),
                isEstimated: false,
                npshrSourceMode: curveNpshr,
                npshrIsEstimated: false,
                bepFlow: props.bepFlow,
                minFlow: Math.max(0, toPumpNumber(curve[0].flow)),
                maxFlow: Math.max(...curve.map(point => toPumpNumber(point.flow))),
                getHead: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'head')),
                getEfficiency: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'eff')),
                getNpshr: q => Math.max(0, interpolatePumpCurvePoint(curve, q, 'npshr'))
            };
        }
    }

    const qBep = props.bepFlow || props.designFlow;
    const hBep = props.designHead;
    const eBep = props.designEfficiency;
    const npshrBep = props.designNpshr;
    const shutoffHead = hBep * 1.25;
    const runoutFlow = qBep * 1.7;
    const headDrop = shutoffHead - hBep;
    const npshrSourceMode = props.npshrSourceMode === manualNpshr ? manualNpshr : estimatedNpshr;
    const npshrWarnings = npshrSourceMode === manualNpshr
        ? ['Manual NPSHr is user supplied; verify it against manufacturer/test data for academic validation.']
        : [
            'Estimated NPSHr is a generic approximation, not manufacturer/test data.',
            'Use Manual NPSHr or Advanced manufacturer/test curve for thesis validation.'
        ];

    return {
        source: 'Basic estimated curve',
        modelBasis: npshrSourceMode === manualNpshr
            ? 'Generic head/efficiency curve with manual NPSHr'
            : 'Generic sizing estimate',
        warnings: [
            'Basic curve is a generic estimate, not an HI/manufacturer certified performance curve.',
            ...npshrWarnings
        ],
        isEstimated: true,
        npshrSourceMode,
        npshrIsEstimated: npshrSourceMode !== manualNpshr,
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
            if (npshrSourceMode === manualNpshr) return Math.max(0.01, npshrBep);
            const ratio = Math.max(0, q / qBep);
            return Math.max(0.01, npshrBep * (0.65 + 0.35 * Math.pow(ratio, 2.2)));
        }
    };
}

function classifyPumpOperatingRegion(flowRateM3H, props = {}) {
    normalizePumpProps(props);
    if (!isPumpFiniteNumber(props.bepFlow)) {
        return {
            status: 'Unknown',
            ratio: null,
            percent: null,
            message: 'BEP Flow is required before POR/AOR can be evaluated.'
        };
    }
    if (!['porMinPercent', 'porMaxPercent', 'aorMinPercent', 'aorMaxPercent'].every(key => isPumpFiniteNumber(props[key]))) {
        return {
            status: 'Unknown',
            ratio: null,
            percent: null,
            message: 'POR and AOR limits are required before operating region can be evaluated.'
        };
    }
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

function evaluateNpshMargin(npsha, npshr, props = {}, operatingRegionStatus = 'POR') {
    normalizePumpProps(props);
    const available = toPumpNumber(npsha, NaN);
    const required = toPumpNumber(npshr, NaN);
    const criteria = getEffectivePumpNpshMarginCriteria(props, operatingRegionStatus);
    if (!Number.isFinite(available) || !Number.isFinite(required) || required <= 0) {
        return {
            margin: null,
            ratio: null,
            requiredNpsha: null,
            npshExcess: null,
            criteria,
            status: 'Unknown',
            message: 'NPSH margin cannot be evaluated'
        };
    }

    const margin = available - required;
    const ratio = available / required;
    const requiredByRatio = criteria.valid ? required * criteria.ratio : null;
    const requiredByMargin = criteria.valid ? required + criteria.margin : null;
    const requiredNpsha = criteria.valid ? Math.max(requiredByRatio, requiredByMargin) : null;
    const npshExcess = criteria.valid ? available - requiredNpsha : null;
    const isCavitationRisk = available <= required;
    let status = 'Safe';
    let message = 'NPSH margin satisfies the selected engineering basis.';
    if (isCavitationRisk) {
        status = 'Cavitation Risk';
        message = 'NPSHa is at or below NPSHr; cavitation risk is high.';
    } else if (!criteria.valid) {
        status = 'Input Required';
        message = criteria.warnings.join(' ') || 'NPSH margin criteria are incomplete.';
    } else if (npshExcess < 0) {
        status = 'Warning';
        message = 'NPSHa is above NPSHr but below the selected NPSH margin basis.';
    }

    return {
        margin,
        ratio,
        requiredByRatio,
        requiredByMargin,
        requiredNpsha,
        npshExcess,
        criteria,
        status,
        message
    };
}

function applyPumpNpshrSourceQualityToEvaluation(evaluation, performanceModel, props = {}) {
    if (!evaluation || evaluation.status !== 'Safe') return evaluation;
    const engineeringMode = typeof PUMP_NPSH_ASSESSMENT_ENGINEERING !== 'undefined'
        ? PUMP_NPSH_ASSESSMENT_ENGINEERING
        : 'Engineering Validation';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    if (props.npshAssessmentMode !== engineeringMode) return evaluation;

    if (performanceModel?.npshrIsEstimated) {
        return {
            ...evaluation,
            status: 'Warning',
            message: 'Engineering Validation requires manual datasheet or manufacturer/test curve NPSHr; estimated NPSHr remains preliminary.'
        };
    }
    if (performanceModel?.npshrSourceMode === manualNpshr) {
        return {
            ...evaluation,
            status: 'Warning',
            message: 'Engineering Validation uses manual NPSHr; verify the value against manufacturer/test data.'
        };
    }
    return evaluation;
}

function getPumpNpshrSourceLabel(performanceModel) {
    if (!performanceModel) return '-';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    const curveNpshr = typeof PUMP_NPSHR_SOURCE_CURVE !== 'undefined' ? PUMP_NPSHR_SOURCE_CURVE : 'Manufacturer/Test Curve';
    if (performanceModel.npshrSourceMode === manualNpshr) return 'Manual input';
    if (performanceModel.npshrSourceMode === curveNpshr) return 'Manufacturer/test curve';
    return 'Estimated basic curve';
}

function getFormattedLossLabel(entry) {
    if (!entry) return '-';
    const value = Number.isFinite(entry.headLoss) ? entry.headLoss.toFixed(2) : '-';
    return `${entry.label || entry.id || 'Component'} (${value} m)`;
}

function roundPumpTraceNumber(value, digits = 3) {
    const number = toPumpNumber(value, NaN);
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function formatPumpTraceNumber(value, digits = 3) {
    const number = toPumpNumber(value, NaN);
    return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function getPumpNpshTracePathSequence(context) {
    const sequence = [];
    const add = (item) => {
        if (!item || sequence[sequence.length - 1] === item) return;
        sequence.push(item);
    };

    add(context?.suctionPath?.boundaryId);
    (context?.suctionPath?.steps || []).forEach(step => {
        add(step.from);
        add(step.pipeId);
        add(step.to);
    });
    add(context?.pumpId);

    return sequence;
}

function sumPumpTraceLoss(entries, key) {
    return (entries || []).reduce((sum, entry) => {
        const value = toPumpNumber(entry?.[key], NaN);
        return Number.isFinite(value) ? sum + value : sum;
    }, 0);
}

function buildPumpNpshCalculationTrace(pump, hydraulicContext, hydraulicSnapshot, flowRateM3H, pumpHead, performanceModel, npshr, npshEvaluation) {
    const fluid = typeof globalModel !== 'undefined' ? globalModel.FLUID : null;
    const boundary = hydraulicContext?.suctionBoundary || null;
    const sourceBoundary = boundary?.type === 'source' && typeof resolveSourceBoundaryData === 'function'
        ? resolveSourceBoundaryData(boundary, globalModel)
        : null;
    const pressureSourceNode = sourceBoundary?.isInherited && sourceBoundary.attachedEquipment
        ? sourceBoundary.attachedEquipment
        : boundary;
    const density = Math.max(toPumpNumber(hydraulicContext?.density, fluid?.props?.density || 1000), 1);
    const gravity = typeof GRAVITY === 'number' ? GRAVITY : 9.81;
    const vaporPressureBarA = toPumpNumber(hydraulicContext?.vaporPressurePa, 0) / 100000;
    const pressureInputBasis = typeof getNodePressureInputBasis === 'function'
        ? getNodePressureInputBasis(pressureSourceNode)
        : (pressureSourceNode?.props?.pressureInputBasis || 'Absolute');
    const pressureInputUnit = typeof getPressureInputUnit === 'function'
        ? getPressureInputUnit(pressureInputBasis)
        : (pressureInputBasis === 'Gauge' ? 'bar g' : 'bar a');
    const boundaryPressureInput = toPumpNumber(pressureSourceNode?.props?.pressure, 0);
    const boundaryPressureAbs = sourceBoundary
        ? sourceBoundary.pressureAbsBar
        : (typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(boundary)
            : boundaryPressureInput);
    const pressureHead = typeof pressureBarToHead === 'function'
        ? pressureBarToHead(boundaryPressureAbs, density)
        : boundaryPressureAbs * 100000 / (density * gravity);
    const boundaryElevation = sourceBoundary
        ? sourceBoundary.elevation
        : (typeof getNodeHydraulicElevation === 'function'
            ? getNodeHydraulicElevation(boundary)
            : toPumpNumber(boundary?.props?.elevation, 0));
    const pumpElevation = toPumpNumber(hydraulicSnapshot?.pumpElevation, toPumpNumber(pump?.props?.elevation, 0));
    const lossEntries = hydraulicSnapshot?.suctionLossBreakdown?.entries || [];
    const majorLoss = sumPumpTraceLoss(lossEntries, 'majorLoss');
    const minorLoss = sumPumpTraceLoss(lossEntries, 'minorLoss');
    const totalLoss = toPumpNumber(hydraulicSnapshot?.suctionLoss, majorLoss + minorLoss);
    const vaporPressureHead = toPumpNumber(hydraulicSnapshot?.vaporPressureHead, NaN);
    const sourceVelocityHead = toPumpNumber(hydraulicSnapshot?.sourceVelocityHead, 0);
    const npsha = toPumpNumber(hydraulicSnapshot?.npsha, NaN);
    const margin = npshEvaluation?.margin ?? (Number.isFinite(npsha) && Number.isFinite(npshr) ? npsha - npshr : null);
    const ratio = npshEvaluation?.ratio ?? (Number.isFinite(npsha) && Number.isFinite(npshr) && npshr > 0 ? npsha / npshr : null);
    const operatingRegion = classifyPumpOperatingRegion(flowRateM3H, pump?.props || {});
    const criteria = npshEvaluation?.criteria || getEffectivePumpNpshMarginCriteria(pump?.props || {}, operatingRegion.status);
    const requiredByRatio = npshEvaluation?.requiredByRatio ?? (criteria.valid && Number.isFinite(npshr) ? npshr * criteria.ratio : null);
    const requiredByMargin = npshEvaluation?.requiredByMargin ?? (criteria.valid && Number.isFinite(npshr) ? npshr + criteria.margin : null);
    const requiredNpsha = npshEvaluation?.requiredNpsha ?? (criteria.valid && Number.isFinite(requiredByRatio) && Number.isFinite(requiredByMargin)
        ? Math.max(requiredByRatio, requiredByMargin)
        : null);
    const npshExcess = npshEvaluation?.npshExcess ?? (Number.isFinite(npsha) && Number.isFinite(requiredNpsha) ? npsha - requiredNpsha : null);
    const npshrSource = getPumpNpshrSourceLabel(performanceModel);
    const pathSequence = getPumpNpshTracePathSequence(hydraulicContext);
    const atm = typeof ATM_PRESSURE_BAR === 'number' ? ATM_PRESSURE_BAR : 1.01325;
    const pressureFormula = pressureInputBasis === 'Gauge'
        ? 'Pabs = Pgauge + Patm'
        : 'Pabs = Pabs input';
    const pressureSubstitution = pressureInputBasis === 'Gauge'
        ? `${formatPumpTraceNumber(boundaryPressureInput)} + ${formatPumpTraceNumber(atm)} = ${formatPumpTraceNumber(boundaryPressureAbs)} bar a`
        : `${formatPumpTraceNumber(boundaryPressureInput)} = ${formatPumpTraceNumber(boundaryPressureAbs)} bar a`;
    const sourceType = sourceBoundary?.sourceType || boundary?.props?.sourceType || boundary?.type || '-';
    const pressureEnergyBasis = sourceBoundary?.pressureEnergyBasis || boundary?.props?.pressureEnergyBasis || '-';
    const usesStaticTieInVelocity = sourceType === 'External Header / Pipe Tie-in'
        && pressureEnergyBasis === 'Static Pressure'
        && Math.abs(sourceVelocityHead) > 1e-9;
    const velocityHeadReference = usesStaticTieInVelocity
        ? 'External header static pressure basis adds inlet velocity head once to form total hydraulic head'
        : 'Reservoir surface velocity is neglected, or total/stagnation pressure already includes velocity head';
    const velocityHeadFormula = usesStaticTieInVelocity ? 'Hvel = v^2 / (2g)' : 'Hvel = 0';
    const velocityHeadSubstitution = usesStaticTieInVelocity
        ? `Inlet pipe velocity head = ${formatPumpTraceNumber(sourceVelocityHead)} m`
        : `${formatPumpTraceNumber(sourceVelocityHead)} m`;

    const limitations = [
        'Hydraulic trace follows one supported series suction path per pump; branched networks require a nodal solver.'
    ];
    if (performanceModel?.npshrIsEstimated) {
        limitations.unshift('Estimated NPSHr is for preliminary screening; manufacturer/test curve data is preferred for thesis validation.');
    } else if (performanceModel?.npshrSourceMode === (typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual')) {
        limitations.unshift('Manual NPSHr should be verified against manufacturer/test data.');
    } else {
        limitations.unshift('NPSHr is read from the pump curve data at the evaluated flow.');
    }

    return {
        basis: {
            fluidName: fluid?.props?.fluidName || fluid?.name || '-',
            temperature: roundPumpTraceNumber(hydraulicContext?.fluidProps?.temp ?? boundary?.props?.temp ?? fluid?.props?.temp, 3),
            density: roundPumpTraceNumber(density, 3),
            viscosity: roundPumpTraceNumber(hydraulicContext?.fluidProps?.viscosity ?? fluid?.props?.viscosity, 3),
            vaporPressureBarA: roundPumpTraceNumber(vaporPressureBarA, 6),
            gravity: roundPumpTraceNumber(gravity, 3)
        },
        boundary: {
            id: hydraulicContext?.suctionPath?.boundaryId || '-',
            name: boundary?.name || hydraulicContext?.suctionPath?.boundaryId || '-',
            type: boundary?.type || '-',
            pressureInput: roundPumpTraceNumber(boundaryPressureInput, 3),
            pressureInputBasis,
            pressureInputUnit,
            absolutePressureBar: roundPumpTraceNumber(boundaryPressureAbs, 3),
            pressureHead: roundPumpTraceNumber(pressureHead, 3),
            velocityHead: roundPumpTraceNumber(sourceVelocityHead, 3),
            totalHead: roundPumpTraceNumber(pressureHead + boundaryElevation + sourceVelocityHead, 3),
            elevation: roundPumpTraceNumber(boundaryElevation, 3),
            boundaryDataSource: sourceBoundary?.boundaryDataSource || 'Manual',
            attachedEquipment: sourceBoundary?.attachedEquipmentId || '-',
            flow: roundPumpTraceNumber(flowRateM3H, 3)
        },
        pump: {
            id: hydraulicContext?.pumpId || pump?.name || '-',
            name: pump?.name || hydraulicContext?.pumpId || '-',
            elevation: roundPumpTraceNumber(pumpElevation, 3),
            flow: roundPumpTraceNumber(flowRateM3H, 3),
            head: roundPumpTraceNumber(pumpHead, 3),
            npshrSource,
            bepFlow: roundPumpTraceNumber(pump?.props?.bepFlow, 3),
            operatingPercentBep: roundPumpTraceNumber(operatingRegion.percent, 3),
            operatingRegion: operatingRegion.status
        },
        dependencyChain: [
            'Fluid properties -> density, viscosity, vapor pressure',
            'Suction boundary -> absolute pressure head and static elevation',
            'Suction path -> pipe, fitting, valve, equipment loss',
            'Pump datasheet -> BEP, POR/AOR, NPSHr source',
            'NPSHa calculation -> suction energy above vapor pressure',
            'NPSH standard basis -> required NPSHa by ratio and absolute margin',
            'Final status -> cavitation risk, warning, or safe screening result'
        ],
        path: {
            sequence: pathSequence,
            text: pathSequence.join(' -> '),
            dominantLoss: hydraulicSnapshot?.suctionLossBreakdown?.dominant
                ? getFormattedLossLabel(hydraulicSnapshot.suctionLossBreakdown.dominant)
                : '-'
        },
        losses: {
            major: roundPumpTraceNumber(majorLoss, 3),
            minor: roundPumpTraceNumber(minorLoss, 3),
            total: roundPumpTraceNumber(totalLoss, 3),
            entries: lossEntries
        },
        steps: [
            {
                title: 'Source Absolute Pressure',
                reference: 'Pressure basis conversion',
                formula: pressureFormula,
                substitution: pressureSubstitution,
                result: roundPumpTraceNumber(boundaryPressureAbs, 3),
                unit: 'bar a'
            },
            {
                title: 'Pressure Head',
                reference: 'Pressure head term in Bernoulli energy balance',
                formula: 'Hp = Pabs x 100000 / (rho x g)',
                substitution: `${formatPumpTraceNumber(boundaryPressureAbs)} x 100000 / (${formatPumpTraceNumber(density)} x ${formatPumpTraceNumber(gravity)}) = ${formatPumpTraceNumber(pressureHead)} m`,
                result: roundPumpTraceNumber(pressureHead, 3),
                unit: 'm'
            },
            {
                title: 'Elevation Head',
                reference: 'Static elevation term',
                formula: 'Hz = z_source - z_pump',
                substitution: `${formatPumpTraceNumber(boundaryElevation)} - ${formatPumpTraceNumber(pumpElevation)} = ${formatPumpTraceNumber(boundaryElevation - pumpElevation)} m`,
                result: roundPumpTraceNumber(boundaryElevation - pumpElevation, 3),
                unit: 'm'
            },
            {
                title: 'Source Velocity Head',
                reference: velocityHeadReference,
                formula: velocityHeadFormula,
                substitution: velocityHeadSubstitution,
                result: roundPumpTraceNumber(sourceVelocityHead, 3),
                unit: 'm'
            },
            {
                title: 'Suction Loss',
                reference: 'Darcy-Weisbach major loss plus minor loss coefficient K',
                formula: 'HL = pipe major + fitting/valve minor',
                substitution: `${formatPumpTraceNumber(majorLoss)} + ${formatPumpTraceNumber(minorLoss)} = ${formatPumpTraceNumber(totalLoss)} m`,
                result: roundPumpTraceNumber(totalLoss, 3),
                unit: 'm'
            },
            {
                title: 'Vapor Pressure Head',
                reference: 'Fluid vapor pressure term in NPSH available',
                formula: 'Hv = Pv x 100000 / (rho x g)',
                substitution: `${formatPumpTraceNumber(vaporPressureBarA, 6)} x 100000 / (${formatPumpTraceNumber(density)} x ${formatPumpTraceNumber(gravity)}) = ${formatPumpTraceNumber(vaporPressureHead)} m`,
                result: roundPumpTraceNumber(vaporPressureHead, 3),
                unit: 'm'
            },
            {
                title: 'NPSHa',
                reference: 'NPSH available definition from suction energy balance',
                formula: 'NPSHa = Hp + z_source + Hvel - z_pump - HL - Hv',
                substitution: `${formatPumpTraceNumber(pressureHead)} + ${formatPumpTraceNumber(boundaryElevation)} + ${formatPumpTraceNumber(sourceVelocityHead)} - ${formatPumpTraceNumber(pumpElevation)} - ${formatPumpTraceNumber(totalLoss)} - ${formatPumpTraceNumber(vaporPressureHead)} = ${formatPumpTraceNumber(npsha)} m`,
                result: roundPumpTraceNumber(npsha, 3),
                unit: 'm'
            },
            {
                title: 'NPSHr',
                reference: npshrSource,
                formula: 'NPSHr = pump required NPSH at operating flow',
                substitution: `${formatPumpTraceNumber(flowRateM3H)} m3/h -> ${formatPumpTraceNumber(npshr)} m`,
                result: roundPumpTraceNumber(npshr, 3),
                unit: 'm'
            },
            {
                title: 'Operating Region',
                reference: 'POR/AOR configured as percent of BEP flow',
                formula: 'Flow %BEP = Q / Q_BEP x 100',
                substitution: `${formatPumpTraceNumber(flowRateM3H)} / ${formatPumpTraceNumber(pump?.props?.bepFlow)} x 100 = ${formatPumpTraceNumber(operatingRegion.percent)} % BEP`,
                result: roundPumpTraceNumber(operatingRegion.percent, 3),
                unit: '% BEP'
            },
            {
                title: 'Required NPSHa',
                reference: criteria.reference,
                formula: 'Required NPSHa = max(NPSHr x margin ratio, NPSHr + absolute margin)',
                substitution: `max(${formatPumpTraceNumber(npshr)} x ${formatPumpTraceNumber(criteria.ratio)}, ${formatPumpTraceNumber(npshr)} + ${formatPumpTraceNumber(criteria.margin)}) = ${formatPumpTraceNumber(requiredNpsha)} m`,
                result: roundPumpTraceNumber(requiredNpsha, 3),
                unit: 'm'
            },
            {
                title: 'Margin and Ratio',
                reference: 'NPSH margin and ratio diagnostics',
                formula: 'Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr; Excess = NPSHa - Required NPSHa',
                substitution: `${formatPumpTraceNumber(npsha)} - ${formatPumpTraceNumber(npshr)} = ${formatPumpTraceNumber(margin)} m; ${formatPumpTraceNumber(npsha)} / ${formatPumpTraceNumber(npshr)} = ${formatPumpTraceNumber(ratio)}; ${formatPumpTraceNumber(npsha)} - ${formatPumpTraceNumber(requiredNpsha)} = ${formatPumpTraceNumber(npshExcess)} m`,
                result: roundPumpTraceNumber(npshExcess, 3),
                unit: 'm'
            }
        ],
        interpretation: {
            status: npshEvaluation?.status || 'Unknown',
            margin: roundPumpTraceNumber(margin, 3),
            ratio: roundPumpTraceNumber(ratio, 3),
            requiredNpsha: roundPumpTraceNumber(requiredNpsha, 3),
            npshExcess: roundPumpTraceNumber(npshExcess, 3),
            marginBasis: criteria.basis,
            marginRegionBasis: criteria.regionBasis,
            marginRatioLimit: roundPumpTraceNumber(criteria.ratio, 3),
            absoluteMarginLimit: roundPumpTraceNumber(criteria.margin, 3),
            message: npshEvaluation?.message || '-'
        },
        references: [
            'Bernoulli energy balance',
            'Darcy-Weisbach pipe friction',
            'Minor loss coefficient K for fittings and valves',
            'ANSI/HI 9.6.1-2024 NPSH margin guidance',
            'NPSH available versus required NPSH'
        ],
        limitations
    };
}

function buildPumpNpshDiagnosis(pump, hydraulicContext, hydraulicSnapshot, npshEvaluation, performanceModel, requiredNpsh = NaN) {
    const notes = [];
    const dominantEntry = hydraulicSnapshot?.suctionLossBreakdown?.dominant || null;
    const status = npshEvaluation?.status || 'Unknown';
    const suctionLoss = toPumpNumber(hydraulicSnapshot?.suctionLoss, NaN);
    const vaporHead = toPumpNumber(hydraulicSnapshot?.vaporPressureHead, NaN);
    const npsha = toPumpNumber(hydraulicSnapshot?.npsha, NaN);
    const npshr = toPumpNumber(requiredNpsh, NaN);

    if (status === 'Cavitation Risk') {
        notes.push('NPSHa is not greater than NPSHr.');
    } else if (status === 'Warning') {
        notes.push('NPSH is positive but below the selected standard margin basis.');
    } else if (status === 'Input Required') {
        notes.push('Complete pump datasheet and NPSH margin inputs before final evaluation.');
    } else if (status === 'Safe') {
        notes.push('NPSH margin satisfies the selected margin basis.');
    }

    if (dominantEntry && dominantEntry.headLoss > 0) {
        notes.push(`Dominant suction loss: ${getFormattedLossLabel(dominantEntry)}.`);
    }
    if (Number.isFinite(suctionLoss) && suctionLoss > Math.max(0.5, Math.abs(npsha) * 0.2)) {
        notes.push('Review suction pipe, valve, and fitting losses.');
    }
    if (Number.isFinite(vaporHead) && Number.isFinite(npsha) && vaporHead > Math.max(0.5, Math.abs(npsha) * 0.25)) {
        notes.push('Fluid vapor pressure has a significant effect on available NPSH.');
    }
    if (performanceModel?.npshrIsEstimated) {
        notes.push('NPSHr is estimated; use manufacturer/test curve data for thesis validation.');
    } else if (performanceModel?.npshrSourceMode === (typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual')) {
        notes.push('NPSHr uses manual user input; verify it against manufacturer/test data.');
    }
    if (hydraulicContext?.networkWarnings?.length) {
        notes.push(...hydraulicContext.networkWarnings);
    }
    if (Number.isFinite(npsha) && Number.isFinite(npshr) && npsha > npshr) {
        const requiredNpsha = npshEvaluation?.requiredNpsha;
        if (Number.isFinite(requiredNpsha)) {
            notes.push(`Required NPSHa by selected basis: ${requiredNpsha.toFixed(2)} m.`);
        }
        notes.push('Maintain margin above NPSHr according to the selected reliability basis.');
    }

    return {
        status,
        dominantLoss: dominantEntry ? getFormattedLossLabel(dominantEntry) : '-',
        notes
    };
}

function buildPumpNpshOperatingEnvelope(pump, hydraulicContext, performanceModel, snapshotMode = 'system') {
    const props = pump?.props || {};
    const audit = getPumpInputAudit(props);
    if (!audit.isReady || !hydraulicContext?.isComplete || !performanceModel || performanceModel.isIncomplete) {
        return {
            status: 'Not evaluated',
            points: [],
            worstCase: null,
            warnings: audit.missing?.length
                ? [`Envelope scan requires complete inputs: ${audit.missing.join(', ')}.`]
                : ['Envelope scan requires a complete hydraulic network and pump data.']
        };
    }

    const bepFlow = toPumpNumber(props.bepFlow, NaN);
    const aorMinFlow = bepFlow * toPumpNumber(props.aorMinPercent, NaN) / 100;
    const aorMaxFlow = bepFlow * toPumpNumber(props.aorMaxPercent, NaN) / 100;
    if (![aorMinFlow, aorMaxFlow].every(Number.isFinite) || aorMaxFlow <= 0 || aorMaxFlow < aorMinFlow) {
        return {
            status: 'Not evaluated',
            points: [],
            worstCase: null,
            warnings: ['Envelope scan requires valid AOR Min/Max and BEP Flow.']
        };
    }

    const minFlow = Math.max(performanceModel.minFlow || 0, aorMinFlow, 0.001);
    const maxFlow = Math.min(performanceModel.maxFlow || aorMaxFlow, aorMaxFlow);
    if (maxFlow < minFlow) {
        return {
            status: 'Outside curve',
            points: [],
            worstCase: null,
            warnings: ['Configured AOR is outside the available pump curve range.']
        };
    }

    const pointCount = 11;
    const step = pointCount <= 1 ? 0 : (maxFlow - minFlow) / (pointCount - 1);
    const points = [];

    for (let i = 0; i < pointCount; i += 1) {
        const flow = i === pointCount - 1 ? maxFlow : minFlow + step * i;
        const pumpHead = performanceModel.getHead(flow);
        const snapshot = snapshotMode === 'flow-demand' && typeof calculatePumpFlowDemandSnapshot === 'function'
            ? calculatePumpFlowDemandSnapshot(hydraulicContext, flow, pumpHead)
            : calculatePumpHydraulicSnapshot(hydraulicContext, flow, pumpHead);
        if (!snapshot) continue;
        const region = classifyPumpOperatingRegion(flow, props);
        const npshr = performanceModel.getNpshr(flow);
        const evalResult = applyPumpNpshrSourceQualityToEvaluation(
            evaluateNpshMargin(snapshot.npsha, npshr, props, region.status),
            performanceModel,
            props
        );
        points.push({
            flow: roundPumpTraceNumber(flow, 3),
            percentBep: roundPumpTraceNumber(region.percent, 3),
            region: region.status,
            npsha: roundPumpTraceNumber(snapshot.npsha, 3),
            npshr: roundPumpTraceNumber(npshr, 3),
            requiredNpsha: roundPumpTraceNumber(evalResult.requiredNpsha, 3),
            npshExcess: roundPumpTraceNumber(evalResult.npshExcess, 3),
            status: evalResult.status
        });
    }

    const worstCase = points.reduce((worst, point) => {
        if (!Number.isFinite(point.npshExcess)) return worst;
        if (!worst || point.npshExcess < worst.npshExcess) return point;
        return worst;
    }, null);

    return {
        status: worstCase ? worstCase.status : 'Not evaluated',
        points,
        worstCase,
        warnings: worstCase ? [] : ['Envelope scan did not produce valid points.']
    };
}

function buildPumpNpshEvaluationResult(pump, hydraulicContext, hydraulicSnapshot, flowRateM3H, pumpHead, performanceModel) {
    if (!pump || !hydraulicContext || !hydraulicSnapshot || !performanceModel) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: ['NPSH evaluation could not be built from the current hydraulic result.']
        };
    }

    const npshr = performanceModel.getNpshr(flowRateM3H);
    const operatingRegion = classifyPumpOperatingRegion(flowRateM3H, pump.props);
    const npshEvaluation = applyPumpNpshrSourceQualityToEvaluation(
        evaluateNpshMargin(hydraulicSnapshot.npsha, npshr, pump.props, operatingRegion.status),
        performanceModel,
        pump.props
    );
    const diagnosis = buildPumpNpshDiagnosis(pump, hydraulicContext, hydraulicSnapshot, npshEvaluation, performanceModel, npshr);
    const notes = [...diagnosis.notes];
    const calculationTrace = buildPumpNpshCalculationTrace(
        pump,
        hydraulicContext,
        hydraulicSnapshot,
        flowRateM3H,
        pumpHead,
        performanceModel,
        npshr,
        npshEvaluation
    );
    const envelope = buildPumpNpshOperatingEnvelope(
        pump,
        hydraulicContext,
        performanceModel,
        hydraulicContext?.dischargeBoundary && typeof isSinkFlowDemandBoundary === 'function' && isSinkFlowDemandBoundary(hydraulicContext.dischargeBoundary)
            ? 'flow-demand'
            : 'system'
    );
    if (envelope.worstCase && Number.isFinite(envelope.worstCase.npshExcess)) {
        notes.push(`Worst-case AOR excess NPSH: ${envelope.worstCase.npshExcess.toFixed(2)} m at ${envelope.worstCase.flow.toFixed(2)} m3/h.`);
    }

    return {
        ok: npshEvaluation.status === 'Safe',
        status: npshEvaluation.status,
        flow: Number(toPumpNumber(flowRateM3H).toFixed(3)),
        pumpHead: Number(toPumpNumber(pumpHead).toFixed(3)),
        npsha: Number(toPumpNumber(hydraulicSnapshot.npsha).toFixed(3)),
        npshr: Number(toPumpNumber(npshr).toFixed(3)),
        npshMargin: npshEvaluation.margin === null ? null : Number(npshEvaluation.margin.toFixed(3)),
        npshRatio: npshEvaluation.ratio === null ? null : Number(npshEvaluation.ratio.toFixed(3)),
        requiredNpsha: npshEvaluation.requiredNpsha === null ? null : Number(npshEvaluation.requiredNpsha.toFixed(3)),
        npshExcess: npshEvaluation.npshExcess === null ? null : Number(npshEvaluation.npshExcess.toFixed(3)),
        marginCriteria: npshEvaluation.criteria,
        operatingRegion: operatingRegion.status,
        operatingPercentBep: operatingRegion.percent === null ? null : Number(operatingRegion.percent.toFixed(3)),
        npshrSource: getPumpNpshrSourceLabel(performanceModel),
        suctionPressureAbs: Number(toPumpNumber(hydraulicSnapshot.suctionPressureBar).toFixed(3)),
        suctionLoss: Number(toPumpNumber(hydraulicSnapshot.suctionLoss).toFixed(3)),
        vaporPressureHead: Number(toPumpNumber(hydraulicSnapshot.vaporPressureHead).toFixed(3)),
        suctionVelocityHead: Number(toPumpNumber(hydraulicSnapshot.suctionVelocityHead).toFixed(3)),
        dominantLoss: diagnosis.dominantLoss,
        warnings: [
            ...(npshEvaluation.status === 'Safe' ? [] : [npshEvaluation.message]),
            ...(envelope.warnings || [])
        ],
        notes,
        envelope,
        suctionLossBreakdown: hydraulicSnapshot.suctionLossBreakdown?.entries || [],
        calculationTrace
    };
}

function runPumpNpshEvaluation(pumpId, model = globalModel, connectionList = connections) {
    const pump = model[pumpId];
    const fluid = model.FLUID;
    if (!pump || pump.type !== 'pump' || !fluid?.props) {
        return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before running NPSH evaluation.'] };
    }

    normalizePumpProps(pump.props);
    const density = Math.max(toPumpNumber(fluid.props.density, 1000), 1);
    const vaporPressurePa = toPumpNumber(fluid.props.vaporPressure, 0) * 100000;
    const context = createPumpHydraulicContext(pumpId, model, connectionList, density, vaporPressurePa);
    const inputAudit = getPumpInputAudit(pump.props);

    if (!context.isComplete) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: typeof getIncompleteHydraulicNetworkWarnings === 'function'
                ? getIncompleteHydraulicNetworkWarnings(context)
                : ['Connect upstream SRC and downstream SNK before running NPSH evaluation.']
        };
    }

    const performanceModel = createPumpPerformanceModel(pump);
    if (performanceModel.isIncomplete || inputAudit.missing.length) {
        return {
            ok: false,
            status: 'Input Required',
            warnings: [
                ...(performanceModel.warnings || []),
                ...(inputAudit.missing.length ? [`Complete pump inputs: ${inputAudit.missing.join(', ')}.`] : [])
            ]
        };
    }
    const flowRequest = typeof getPumpFixedFlowRequest === 'function' ? getPumpFixedFlowRequest(context) : null;
    const sinkDemandFlow = typeof isSinkFlowDemandBoundary === 'function' && isSinkFlowDemandBoundary(context.dischargeBoundary)
        ? toPumpNumber(context.dischargeBoundary?.props?.demandFlow, NaN)
        : NaN;
    const solvedFlow = toPumpNumber(pump.results?.flow, NaN);
    const targetFlow = Number.isFinite(flowRequest?.flow) && flowRequest.flow > 0
        ? flowRequest.flow
        : (Number.isFinite(sinkDemandFlow) && sinkDemandFlow > 0
            ? sinkDemandFlow
            : (Number.isFinite(solvedFlow) && solvedFlow > 0
                ? solvedFlow
                : toPumpNumber(pump.props.designFlow, NaN)));
    if (!Number.isFinite(targetFlow) || targetFlow <= 0) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: ['Flow must be greater than zero before NPSH can be evaluated.']
        };
    }

    const pumpHead = performanceModel.getHead(targetFlow);
    const useFlowDemandSnapshot = flowRequest?.source === 'sink-flow-demand'
        || (typeof isSinkFlowDemandBoundary === 'function' && isSinkFlowDemandBoundary(context.dischargeBoundary));
    const snapshot = useFlowDemandSnapshot
        ? calculatePumpFlowDemandSnapshot(context, targetFlow, pumpHead)
        : calculatePumpHydraulicSnapshot(context, targetFlow, pumpHead);
    if (!snapshot) {
        return {
            ok: false,
            status: 'Incomplete',
            warnings: ['Unable to calculate suction hydraulic snapshot for NPSH evaluation.']
        };
    }

    return buildPumpNpshEvaluationResult(pump, context, snapshot, targetFlow, pumpHead, performanceModel);
}

function getPumpOptimizationSourceFlow(context) {
    const flowMode = context?.suctionBoundary?.props?.flowInputMode || 'Mass Flow';
    if (flowMode === 'Solve from Network') return null;
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

    const designFlow = toPumpNumber(pump?.props?.designFlow, NaN);
    return Number.isFinite(designFlow) && designFlow > 0 ? designFlow : null;
}

function calculatePressureBoundaryHeadForOptimization(node, density, flowRateM3H, path, model) {
    if (!node || !node.props) return null;
    const sourceBoundary = node.type === 'source' && typeof resolveSourceBoundaryData === 'function'
        ? resolveSourceBoundaryData(node, model)
        : null;
    const pressure = sourceBoundary
        ? sourceBoundary.pressureAbsBar
        : (typeof getNodeAbsolutePressureBar === 'function'
            ? getNodeAbsolutePressureBar(node)
            : toPumpNumber(node.props.pressure, 1.01325));
    const pressureHead = pressureBarToHead(Number.isFinite(pressure) ? pressure : 1.01325, density);
    let boundaryHead = pressureHead + (sourceBoundary ? sourceBoundary.elevation : getNodeHydraulicElevation(node));

    const sinkPressureBasis = node.type === 'sink' && typeof getSinkPressureBasis === 'function'
        ? getSinkPressureBasis(node)
        : node.props.pressureBasis;
    if (node.type === 'sink' && sinkPressureBasis === 'Static') {
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
    const criteria = getEffectivePumpNpshMarginCriteria(props, 'POR');
    if (!criteria.valid) return null;
    const ratioLimit = available / Math.max(toPumpNumber(criteria.ratio, 1), 1);
    const marginLimit = available - Math.max(toPumpNumber(criteria.margin, 0), 0);
    return Math.min(ratioLimit, marginLimit);
}

function roundPumpProposalNumber(value, digits = 3) {
    const number = toPumpNumber(value, NaN);
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function getPumpOptimizationReadiness(pumpId, model = globalModel, connectionList = connections) {
    const pump = model?.[pumpId];
    const fluid = model?.FLUID;
    if (!pump || pump.type !== 'pump') {
        return { canRun: false, status: 'Invalid pump', warnings: ['Select a pump before running optimization.'] };
    }
    if (!fluid?.props) {
        return { canRun: false, status: 'Missing Fluid Basis', warnings: ['Fluid Basis is required before pump optimization.'] };
    }

    const density = toPumpNumber(fluid.props.density, NaN);
    const vaporPressureBar = toPumpNumber(fluid.props.vaporPressure, NaN);
    if (!Number.isFinite(density) || density <= 0 || !Number.isFinite(vaporPressureBar)) {
        return { canRun: false, status: 'Invalid Fluid Basis', warnings: ['Fluid density and vapor pressure must be valid before pump optimization.'] };
    }

    const context = createPumpHydraulicContext(pumpId, model, connectionList, density, vaporPressureBar * 100000);
    if (!context.isComplete) {
        return {
            canRun: false,
            status: 'Incomplete network',
            warnings: typeof getIncompleteHydraulicNetworkWarnings === 'function'
                ? getIncompleteHydraulicNetworkWarnings(context)
                : ['Complete suction and discharge network before pump optimization.'],
            context
        };
    }

    const targetFlow = getPumpOptimizationTargetFlow(pump, context);
    if (!Number.isFinite(targetFlow) || targetFlow <= 0) {
        return {
            canRun: false,
            status: 'Missing target flow',
            warnings: ['Set SNK Flow Demand, SRC flow input, or an existing solved/design flow before pump optimization.'],
            context
        };
    }

    return {
        canRun: true,
        status: 'Ready',
        warnings: [],
        context,
        targetFlow
    };
}

function getPumpOptimizationFlowBasis(context, pump, targetFlow) {
    if (isSinkFlowDemandBoundary(context?.dischargeBoundary)) {
        return `${context.dischargePath?.boundaryId || 'SNK'} Flow Demand`;
    }
    const sourceFlow = getPumpOptimizationSourceFlow(context);
    if (sourceFlow !== null && Math.abs(sourceFlow - targetFlow) < 1e-9) {
        return `${context.suctionPath?.boundaryId || 'SRC'} flow input`;
    }
    const currentFlow = toPumpNumber(pump?.results?.flow, NaN);
    if (Number.isFinite(currentFlow) && currentFlow > 0 && Math.abs(currentFlow - targetFlow) < 1e-9) {
        return 'Current solved operating flow';
    }
    return 'Design flow input';
}

function choosePumpOptimizationMarginBasis(props = {}) {
    const userDefined = typeof PUMP_NPSH_MARGIN_USER_DEFINED !== 'undefined' ? PUMP_NPSH_MARGIN_USER_DEFINED : 'User Defined';
    const generalPurpose = typeof PUMP_NPSH_MARGIN_GENERAL_PURPOSE !== 'undefined' ? PUMP_NPSH_MARGIN_GENERAL_PURPOSE : 'General Purpose';
    if (props.npshMarginBasis && props.npshMarginBasis !== userDefined) return props.npshMarginBasis;
    const userCriteria = getEffectivePumpNpshMarginCriteria(props, 'POR');
    return userCriteria.valid ? userDefined : generalPurpose;
}

function getPumpOptimizationSnapshot(context, flowRateM3H, pumpHead) {
    if (context?.dischargeBoundary && typeof isSinkFlowDemandBoundary === 'function' && isSinkFlowDemandBoundary(context.dischargeBoundary)) {
        return calculatePumpFlowDemandSnapshot(context, flowRateM3H, pumpHead);
    }
    return calculatePumpHydraulicSnapshot(context, flowRateM3H, pumpHead);
}

function getPumpOptimizationNozzleElevations(pumpId, model, context) {
    const pump = model?.[pumpId];
    const suctionStep = context?.suctionPath?.steps?.[context.suctionPath.steps.length - 1] || null;
    const dischargeStep = context?.dischargePath?.steps?.[0] || null;
    const suctionPipe = suctionStep ? model?.[suctionStep.pipeId] : null;
    const dischargePipe = dischargeStep ? model?.[dischargeStep.pipeId] : null;
    const currentElevation = toPumpNumber(pump?.props?.elevation, 0);
    const suctionElevation = suctionPipe && typeof getPipeEndpointElevation === 'function'
        ? getPipeEndpointElevation(suctionPipe, 'endElevation', pumpId, suctionStep.toPort || '.port.inlet', model)
        : getNodePortHydraulicElevation(pumpId, '.port.inlet', model);
    const dischargeElevation = dischargePipe && typeof getPipeEndpointElevation === 'function'
        ? getPipeEndpointElevation(dischargePipe, 'startElevation', pumpId, dischargeStep.fromPort || '.port.outlet', model)
        : getNodePortHydraulicElevation(pumpId, '.port.outlet', model);

    return {
        elevation: roundPumpProposalNumber(currentElevation, 3),
        suctionElevation: roundPumpProposalNumber(suctionElevation, 3),
        dischargeElevation: roundPumpProposalNumber(dischargeElevation, 3),
        notes: [
            suctionStep ? `Suction nozzle elevation follows ${suctionStep.pipeId} endpoint/pump inlet datum.` : 'Suction nozzle elevation uses current pump inlet datum.',
            dischargeStep ? `Discharge nozzle elevation follows ${dischargeStep.pipeId} endpoint/pump outlet datum.` : 'Discharge nozzle elevation uses current pump outlet datum.'
        ]
    };
}

function buildPumpOptimizationEnvelope(context, proposalProps, designHead) {
    const bepFlow = toPumpNumber(proposalProps.bepFlow, NaN);
    const aorMin = toPumpNumber(proposalProps.aorMinPercent, NaN);
    const aorMax = toPumpNumber(proposalProps.aorMaxPercent, NaN);
    if (![bepFlow, aorMin, aorMax].every(Number.isFinite) || bepFlow <= 0 || aorMax <= 0) {
        return { points: [], worstCase: null, warnings: ['AOR envelope cannot be scanned without valid BEP/AOR limits.'] };
    }

    const minFlow = Math.max(0.001, bepFlow * aorMin / 100);
    const maxFlow = Math.max(minFlow, bepFlow * aorMax / 100);
    const points = [];
    const pointCount = 11;
    const step = pointCount <= 1 ? 0 : (maxFlow - minFlow) / (pointCount - 1);

    for (let i = 0; i < pointCount; i += 1) {
        const flow = i === pointCount - 1 ? maxFlow : minFlow + step * i;
        const headInfo = calculatePumpRequiredHeadAtFlow(context, flow);
        if (!headInfo || !Number.isFinite(headInfo.requiredHead)) continue;
        const snapshot = getPumpOptimizationSnapshot(context, flow, Math.max(0.001, headInfo.requiredHead));
        if (!snapshot || !Number.isFinite(snapshot.npsha)) continue;
        const region = classifyPumpOperatingRegion(flow, proposalProps);
        const criteria = getEffectivePumpNpshMarginCriteria(proposalProps, region.status);
        const allowedNpshr = criteria.valid
            ? Math.min(snapshot.npsha / Math.max(criteria.ratio, 1), snapshot.npsha - Math.max(criteria.margin, 0))
            : null;
        points.push({
            flow: roundPumpProposalNumber(flow, 3),
            percentBep: roundPumpProposalNumber(region.percent, 2),
            region: region.status,
            systemHead: roundPumpProposalNumber(headInfo.requiredHead, 3),
            npsha: roundPumpProposalNumber(snapshot.npsha, 3),
            allowedNpshr: roundPumpProposalNumber(allowedNpshr, 3)
        });
    }

    const worstCase = points.reduce((worst, point) => {
        if (!Number.isFinite(point.allowedNpshr)) return worst;
        if (!worst || point.allowedNpshr < worst.allowedNpshr) return point;
        return worst;
    }, null);

    return {
        points,
        worstCase,
        warnings: worstCase ? [] : ['AOR envelope scan did not produce a valid allowable NPSHr point.']
    };
}

function buildPumpOptimizationRows(currentProps, proposedProps, basis) {
    return [
        { parameter: 'Assessment Mode', current: currentProps.npshAssessmentMode || '-', proposed: proposedProps.npshAssessmentMode, basis: 'Network proposal uses ANSI/HI guided mode unless Engineering Validation was already selected.' },
        { parameter: 'Elevation', current: currentProps.elevation, proposed: proposedProps.elevation, unit: 'm', basis: basis.elevation || 'Current pump datum / connected endpoint elevation.' },
        { parameter: 'Suction Nozzle Elev.', current: currentProps.suctionElevation, proposed: proposedProps.suctionElevation, unit: 'm', basis: 'Pump inlet datum or suction pipe endpoint elevation.' },
        { parameter: 'Discharge Nozzle Elev.', current: currentProps.dischargeElevation, proposed: proposedProps.dischargeElevation, unit: 'm', basis: 'Pump outlet datum or discharge pipe endpoint elevation.' },
        { parameter: 'NPSHr Source', current: currentProps.npshrSourceMode || '-', proposed: proposedProps.npshrSourceMode, basis: 'Manual/vendor datasheet confirmation required; network cannot create manufacturer curve data.' },
        { parameter: 'Design Flow', current: currentProps.designFlow, proposed: proposedProps.designFlow, unit: 'm3/h', basis: basis.flow },
        { parameter: 'Design Head', current: currentProps.designHead, proposed: proposedProps.designHead, unit: 'm', basis: 'Required system head at design flow.' },
        { parameter: 'Design Eff.', current: currentProps.designEfficiency, proposed: proposedProps.designEfficiency, unit: '%', basis: 'Screening estimate; verify from pump curve/vendor.' },
        { parameter: 'NPSHr @ BEP', current: currentProps.designNpshr, proposed: proposedProps.designNpshr, unit: 'm', basis: '95% of worst-case maximum allowable NPSHr from NPSHa margin envelope.' },
        { parameter: 'BEP Flow', current: currentProps.bepFlow, proposed: proposedProps.bepFlow, unit: 'm3/h', basis: 'Design flow placed near BEP candidate.' },
        { parameter: 'POR', current: `${currentProps.porMinPercent || '-'}-${currentProps.porMaxPercent || '-'}`, proposed: `${proposedProps.porMinPercent}-${proposedProps.porMaxPercent}`, unit: '% BEP', basis: 'Preferred operating range candidate.' },
        { parameter: 'AOR', current: `${currentProps.aorMinPercent || '-'}-${currentProps.aorMaxPercent || '-'}`, proposed: `${proposedProps.aorMinPercent}-${proposedProps.aorMaxPercent}`, unit: '% BEP', basis: 'Allowable operating range candidate.' },
        { parameter: 'NPSH Margin Basis', current: currentProps.npshMarginBasis || '-', proposed: proposedProps.npshMarginBasis, basis: 'Selected user/ANSI-HI service basis.' }
    ];
}

function buildPumpOptimizationProposal(pumpId, model = globalModel, connectionList = connections, options = {}) {
    const pump = model?.[pumpId];
    const readiness = getPumpOptimizationReadiness(pumpId, model, connectionList);
    if (!readiness.canRun) {
        return {
            ok: false,
            canApply: false,
            status: readiness.status || 'Cannot Optimize',
            warnings: readiness.warnings || ['Pump optimization cannot run from the current model.'],
            notes: []
        };
    }

    const context = readiness.context;
    const targetFlow = readiness.targetFlow;
    const currentProps = { ...(pump.props || {}) };
    const flowBasis = getPumpOptimizationFlowBasis(context, pump, targetFlow);
    const headInfo = calculatePumpRequiredHeadAtFlow(context, targetFlow, model);
    if (!headInfo || !Number.isFinite(headInfo.requiredHead)) {
        return {
            ok: false,
            canApply: false,
            status: 'Cannot Optimize',
            warnings: ['Unable to calculate required system head from the current suction/discharge network.'],
            notes: []
        };
    }

    const designHead = Math.max(0.001, headInfo.requiredHead * (1 + Math.max(0, toPumpNumber(options.headAllowancePercent, 0)) / 100));
    const snapshot = getPumpOptimizationSnapshot(context, targetFlow, designHead);
    if (!snapshot || !Number.isFinite(snapshot.npsha)) {
        return {
            ok: false,
            canApply: false,
            status: 'Cannot Optimize',
            warnings: ['Unable to calculate NPSHa from the suction network at the target flow.'],
            notes: []
        };
    }

    const userDefined = typeof PUMP_NPSH_MARGIN_USER_DEFINED !== 'undefined' ? PUMP_NPSH_MARGIN_USER_DEFINED : 'User Defined';
    const marginBasis = choosePumpOptimizationMarginBasis(currentProps);
    const assessmentAnsiHi = typeof PUMP_NPSH_ASSESSMENT_ANSI_HI !== 'undefined' ? PUMP_NPSH_ASSESSMENT_ANSI_HI : 'ANSI/HI Guided';
    const assessmentEngineering = typeof PUMP_NPSH_ASSESSMENT_ENGINEERING !== 'undefined' ? PUMP_NPSH_ASSESSMENT_ENGINEERING : 'Engineering Validation';
    const manualNpshr = typeof PUMP_NPSHR_SOURCE_MANUAL !== 'undefined' ? PUMP_NPSHR_SOURCE_MANUAL : 'Manual';
    const nozzleElevations = getPumpOptimizationNozzleElevations(pumpId, model, context);
    const proposedProps = {
        inputMode: 'Basic',
        optimizationMode: currentProps.optimizationMode || (typeof PUMP_OPTIMIZATION_MODE_MANUAL !== 'undefined' ? PUMP_OPTIMIZATION_MODE_MANUAL : 'Manual'),
        npshrSourceMode: manualNpshr,
        npshAssessmentMode: currentProps.npshAssessmentMode === assessmentEngineering ? assessmentEngineering : assessmentAnsiHi,
        npshMarginBasis: marginBasis,
        screeningDefaultsApplied: false,
        elevation: nozzleElevations.elevation ?? 0,
        suctionElevation: nozzleElevations.suctionElevation ?? nozzleElevations.elevation ?? 0,
        dischargeElevation: nozzleElevations.dischargeElevation ?? nozzleElevations.elevation ?? 0,
        designFlow: roundPumpProposalNumber(targetFlow, 3),
        designHead: roundPumpProposalNumber(designHead, 3),
        designEfficiency: isPumpFiniteNumber(currentProps.designEfficiency) ? toPumpNumber(currentProps.designEfficiency) : 75,
        designNpshr: '',
        bepFlow: roundPumpProposalNumber(targetFlow, 3),
        porMinPercent: isPumpFiniteNumber(currentProps.porMinPercent) ? toPumpNumber(currentProps.porMinPercent) : 70,
        porMaxPercent: isPumpFiniteNumber(currentProps.porMaxPercent) ? toPumpNumber(currentProps.porMaxPercent) : 120,
        aorMinPercent: isPumpFiniteNumber(currentProps.aorMinPercent) ? toPumpNumber(currentProps.aorMinPercent) : 50,
        aorMaxPercent: isPumpFiniteNumber(currentProps.aorMaxPercent) ? toPumpNumber(currentProps.aorMaxPercent) : 130,
        minNpshMarginRatio: isPumpFiniteNumber(currentProps.minNpshMarginRatio) ? toPumpNumber(currentProps.minNpshMarginRatio) : PUMP_SCREENING_DEFAULTS.minNpshMarginRatio,
        minNpshMargin: isPumpFiniteNumber(currentProps.minNpshMargin) ? toPumpNumber(currentProps.minNpshMargin) : PUMP_SCREENING_DEFAULTS.minNpshMargin
    };
    normalizePumpProps(proposedProps);

    const criteria = getEffectivePumpNpshMarginCriteria(proposedProps, 'POR');
    const allowableAtDesign = criteria.valid
        ? Math.min(snapshot.npsha / Math.max(criteria.ratio, 1), snapshot.npsha - Math.max(criteria.margin, 0))
        : null;
    const envelope = buildPumpOptimizationEnvelope(context, proposedProps, designHead);
    const allowableWorst = Number.isFinite(envelope.worstCase?.allowedNpshr)
        ? envelope.worstCase.allowedNpshr
        : allowableAtDesign;
    const maxAllowableNpshr = Math.min(
        Number.isFinite(allowableAtDesign) ? allowableAtDesign : Infinity,
        Number.isFinite(allowableWorst) ? allowableWorst : Infinity
    );

    const warnings = [
        ...(criteria.warnings || []),
        ...(envelope.warnings || [])
    ];
    const notes = [
        'Proposal is based on the current suction/discharge network; it cannot create vendor-certified pump NPSHr or efficiency data.',
        'NPSHr Source is proposed as Manual so the final value can be replaced/confirmed from datasheet or manufacturer test curve.',
        ...nozzleElevations.notes
    ];

    if (!Number.isFinite(maxAllowableNpshr) || maxAllowableNpshr <= 0) {
        warnings.push('Current suction network does not provide positive allowable NPSHr under the selected margin basis. Improve suction pressure/elevation or reduce suction losses.');
    } else {
        proposedProps.designNpshr = roundPumpProposalNumber(Math.max(0.01, maxAllowableNpshr * 0.95), 3);
    }

    if (marginBasis === userDefined) {
        notes.push('User-defined NPSH margin basis was preserved because both ratio and absolute margin are available.');
    } else {
        notes.push(`${marginBasis} NPSH margin preset was selected because user-defined limits were incomplete or a standard basis was already chosen.`);
    }

    const basis = {
        flow: flowBasis,
        elevation: 'Current pump datum / connected pipe endpoint elevations'
    };
    const rows = buildPumpOptimizationRows(currentProps, proposedProps, basis);
    const canApply = warnings.length === 0 && Number.isFinite(proposedProps.designNpshr) && proposedProps.designNpshr > 0;

    return {
        ok: canApply,
        canApply,
        status: canApply ? 'Proposal Ready' : 'Review Network',
        message: canApply
            ? 'Pump parameter proposal is ready to apply.'
            : 'Pump optimization found issues that must be reviewed before applying.',
        targetFlow: roundPumpProposalNumber(targetFlow, 3),
        targetFlowBasis: flowBasis,
        requiredSystemHead: roundPumpProposalNumber(headInfo.requiredHead, 3),
        designHead: proposedProps.designHead,
        npshaAtDesign: roundPumpProposalNumber(snapshot.npsha, 3),
        allowableNpshrAtDesign: roundPumpProposalNumber(allowableAtDesign, 3),
        worstCase: envelope.worstCase,
        envelope,
        maxAllowableNpshr: roundPumpProposalNumber(maxAllowableNpshr, 3),
        proposedProps,
        rows,
        warnings: [...new Set(warnings)],
        notes,
        references: [
            'ANSI/HI 9.6.1-2024: NPSHA is system-derived; NPSHR is pump/vendor-derived; use margin ratio and absolute margin.',
            'Fluid Mechanics references: system head is boundary head difference plus suction/discharge losses.',
            'Centrifugal pump cavitation literature: verify NPSHr and efficiency with manufacturer/test curve for final validation.'
        ]
    };
}

function applyPumpOptimizationProposal(pumpId, model = globalModel, proposal = null) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') {
        return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before applying optimization proposal.'] };
    }

    const activeProposal = proposal || pump.results?.pumpOptimizationProposal || buildPumpOptimizationProposal(pumpId, model, typeof connections !== 'undefined' ? connections : []);
    if (!activeProposal?.canApply || !activeProposal.proposedProps) {
        return {
            ok: false,
            status: activeProposal?.status || 'Cannot Apply',
            warnings: activeProposal?.warnings || ['No applicable pump optimization proposal is available.']
        };
    }

    pump.props = {
        ...(pump.props || {}),
        ...activeProposal.proposedProps,
        curveData: Array.isArray(pump.props?.curveData)
            ? pump.props.curveData.map(point => ({ ...point }))
            : (PUMP_DEFAULT_PROPS.curveData || []).map(point => ({ ...point }))
    };
    normalizePumpProps(pump.props);
    if (pump.results) {
        pump.results.pumpOptimizationProposal = {
            ...activeProposal,
            applied: true,
            appliedAt: new Date().toISOString()
        };
    }

    return {
        ok: true,
        status: 'Applied',
        proposal: activeProposal,
        warnings: [
            'Verify proposed Manual NPSHr and Design Efficiency against vendor/manufacturer data before final Engineering Validation.'
        ]
    };
}

function optimizePumpBasicParameters(pumpId, model = globalModel, connectionList = connections) {
    return buildPumpOptimizationProposal(pumpId, model, connectionList);
}
