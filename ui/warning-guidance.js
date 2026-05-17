const WARNING_ACTION_PATTERNS = [
    {
        test: /flow, downstream pressure, and pump curve are all fixed|over-specified/i,
        action: 'Choose one independent downstream constraint. Use either fixed flow or fixed outlet pressure, or keep both only when intentionally reviewing residual head.'
    },
    {
        test: /above required system head|over-pressured/i,
        action: 'Reduce the fixed source flow, lower the outlet pressure target, adjust the pump curve/head, or switch SNK to Flow Demand if flow is the design basis.'
    },
    {
        test: /below required system head|will not be met/i,
        action: 'Increase available pump head, reduce losses/elevation requirement, reduce flow, or lower the downstream pressure target.'
    },
    {
        test: /no hydraulic path exists|solid hydraulic pipe|not a hydraulic path|connect upstream|connect.*downstream|hydraulic network is incomplete|not connected/i,
        action: 'Create a solid hydraulic route: source/tank outlet to pump suction, then pump discharge to sink through pipe or hydraulic components.'
    },
    {
        test: /npsha|npsh margin|cavitation/i,
        action: 'Review source liquid level/pressure, pump suction elevation, suction losses, vapor pressure, and the NPSHr basis.'
    },
    {
        test: /outside por|outside configured aor|operating point|outside curve|runout|no intersection/i,
        action: 'Review the pump curve, design flow/head, downstream boundary, and BEP/POR/AOR limits.'
    },
    {
        test: /high point|below vapor pressure|vapor margin|vapor pressure/i,
        action: 'Check vapor pressure, pipe high point elevation, suction pressure profile, and available static head.'
    },
    {
        test: /transitional pipe flow|friction factor/i,
        action: 'Review pipe diameter, flow, viscosity, and roughness; transitional friction factor is approximate.'
    },
    {
        test: /efficiency is zero|invalid at operating point/i,
        action: 'Enter or review pump efficiency/curve data at the operating point.'
    },
    {
        test: /pressure residual|boundary pressure residual/i,
        action: 'Check boundary mode, outlet pressure/elevation, flow demand, and discharge losses.'
    },
    {
        test: /outlet nozzle elevation is above current liquid level|draw vapor|current liquid level/i,
        action: 'Lower the outlet nozzle, raise liquid level, or use the correct minimum operating level for NPSH.'
    }
];

function getWarningActionRecommendation(warning) {
    const text = String(warning || '').trim();
    if (!text) return '';
    const match = WARNING_ACTION_PATTERNS.find(pattern => pattern.test.test(text));
    return match
        ? match.action
        : 'Open the object properties, review the calculation trace, and verify the related input basis.';
}

function formatWarningForUser(warning, options = {}) {
    const text = String(warning || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const action = getWarningActionRecommendation(text);
    if (options.actionOnly) return action;
    if (options.messageOnly) return text;
    return `${text} Action: ${action}`;
}

function formatWarningListForUser(warnings = [], options = {}) {
    return (warnings || [])
        .filter(Boolean)
        .map(warning => formatWarningForUser(warning, options))
        .filter(Boolean);
}
