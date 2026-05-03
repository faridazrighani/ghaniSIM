function calculateFrictionFactor(reynolds, roughness, diameter) {
    if (reynolds < 2000) return 64 / reynolds;
    const relRoughness = (roughness / 1000) / (diameter / 1000);
    const term1 = relRoughness / 3.7;
    const term2 = 5.74 / Math.pow(reynolds, 0.9);
    return 0.25 / Math.pow(Math.log10(term1 + term2), 2);
}

function calculatePipeHeadLoss(flowRateM3H, pipeProps) {
    if (flowRateM3H <= 0 || !pipeProps.segments || pipeProps.segments.length === 0) return 0;
    const qM3S = flowRateM3H / 3600;
    const kinVisc = globalModel["FLUID"].props.viscosity * 1e-6;

    let totalMajorLoss = 0;
    let refVelocity = 0;

    for (let i = 0; i < pipeProps.segments.length; i++) {
        const seg = pipeProps.segments[i];
        const dM = seg.diameter;
        if (dM <= 0) continue;
        const area = Math.PI * Math.pow(dM, 2) / 4;
        const velocity = qM3S / area;

        if (i === 0) refVelocity = velocity;

        const reynolds = (velocity * dM) / kinVisc;
        const f = calculateFrictionFactor(reynolds, seg.roughness * 1000, dM * 1000);
        const majorLoss = f * (seg.length / dM) * (Math.pow(velocity, 2) / (2 * GRAVITY));
        totalMajorLoss += majorLoss;
    }

    const minorLoss = (pipeProps.minorLoss || 0) * (Math.pow(refVelocity, 2) / (2 * GRAVITY));
    return totalMajorLoss + minorLoss;
}
