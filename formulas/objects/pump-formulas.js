function getPumpHead(q) {
    return -0.0017 * Math.pow(q, 2) + 0.005 * q + 45;
}

function getPumpEfficiency(q) {
    if (q <= 0) return 0;
    return Math.max(0, -0.012 * Math.pow(q - 85, 2) + 80);
}

function getPumpNPSHr(q) {
    return 1.0 * Math.exp(0.013 * q);
}
