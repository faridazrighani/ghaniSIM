function calculateTankLiquidVolume(diameter, liquidLevel) {
    return (Math.PI / 4) * Math.pow(diameter || 0, 2) * (liquidLevel || 0);
}
