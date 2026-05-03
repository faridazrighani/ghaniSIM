function calculateValveOpeningFraction(openingPercent) {
    return Math.max(0, Math.min(1, (openingPercent || 0) / 100));
}
