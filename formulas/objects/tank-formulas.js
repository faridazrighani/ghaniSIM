function calculateTankLiquidVolume(diameter, liquidLevel) {
    return (Math.PI / 4) * Math.pow(diameter || 0, 2) * (liquidLevel || 0);
}

function toTankNumber(value, fallback = 0) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTankProps(tankOrProps) {
    const props = tankOrProps?.props || tankOrProps || {};
    if (props.pressure === undefined || props.pressure === null || props.pressure === '') props.pressure = 0;
    if (props.designPressure === undefined || props.designPressure === null || props.designPressure === '') props.designPressure = 0;
    if (!props.psvMode) props.psvMode = typeof TANK_PSV_MODE_MANUAL !== 'undefined' ? TANK_PSV_MODE_MANUAL : 'Manual';
    if (props.psvSet === undefined || props.psvSet === null || props.psvSet === '') props.psvSet = 0;
    if (props.vaporPressure === undefined || props.vaporPressure === null || props.vaporPressure === '') props.vaporPressure = 0;

    if (props.psvMode === (typeof TANK_PSV_MODE_SUGGESTED !== 'undefined' ? TANK_PSV_MODE_SUGGESTED : 'Suggested')) {
        props.psvSet = calculateTankSuggestedPsv(props).pressure;
    }

    return props;
}

function calculateTankSuggestedPsv(props = {}) {
    const designPressure = Math.max(0, toTankNumber(props.designPressure));
    const operatingPressure = Math.max(0, toTankNumber(props.pressure));

    if (designPressure > 0) {
        return {
            pressure: Number(designPressure.toFixed(3)),
            basis: 'Design Pressure / MAWP'
        };
    }

    if (operatingPressure > 0) {
        return {
            pressure: Number((operatingPressure * 1.5).toFixed(3)),
            basis: '1.5 x Operating Pressure'
        };
    }

    return {
        pressure: 0,
        basis: 'Not available'
    };
}

function formatTankPressureStatusValue(value, unit = 'bar a') {
    const number = toTankNumber(value, NaN);
    if (!Number.isFinite(number) || number <= 0) return 'Not specified';
    return `${formatReadoutValue(Number(number.toFixed(3)))} ${unit}`;
}

function evaluateTankPressureSafety(props = {}, fluidProps = {}) {
    normalizeTankProps(props);
    const operatingPressure = toTankNumber(props.pressure);
    const designPressure = toTankNumber(props.designPressure);
    const psvSet = toTankNumber(props.psvSet);
    const vaporPressure = toTankNumber(fluidProps.vaporPressure ?? props.vaporPressure);
    const suggested = calculateTankSuggestedPsv(props);
    const warnings = [];

    if (operatingPressure <= 0) {
        warnings.push('Operating pressure is not specified; tank pressure checks are informational only.');
    } else if (vaporPressure > 0 && operatingPressure <= vaporPressure) {
        warnings.push('Operating pressure is at or below fluid vapor pressure; vaporizing risk at tank conditions.');
    }

    if (psvSet <= 0) {
        warnings.push('PSV set pressure is not specified.');
    } else {
        if (operatingPressure > 0 && psvSet <= operatingPressure) {
            warnings.push('PSV set pressure must be above operating pressure.');
        }
        if (designPressure > 0 && psvSet > designPressure) {
            warnings.push('PSV set pressure is above Design Pressure / MAWP.');
        }
    }

    if (
        props.psvMode === (typeof TANK_PSV_MODE_SUGGESTED !== 'undefined' ? TANK_PSV_MODE_SUGGESTED : 'Suggested')
        && designPressure <= 0
        && operatingPressure > 0
    ) {
        warnings.push('PSV value is suggested from operating pressure only; review against design basis.');
    }

    return {
        status: warnings.length ? 'Review' : 'OK',
        warnings,
        suggestedPressure: suggested.pressure,
        suggestedBasis: suggested.basis
    };
}
