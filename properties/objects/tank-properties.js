const TANK_SCHEMA = {
    visualScale: { label: 'PFD Size', unit: '%', type: 'number', default: 100 },
    elevation: { label: 'Base Elevation', unit: 'm', type: 'number', default: 5 },
    diameter: { label: 'Tank Diameter', unit: 'm', type: 'number', default: 5 },
    volume: { label: 'Total Volume', unit: 'm3', type: 'number', default: 39.27, readonly: true },
    liquidLevel: { label: 'Current Level', unit: 'm', type: 'number', default: 2 },
    hll: { label: 'High Liquid Level (HLL)', unit: 'm', type: 'number', default: 4.5 },
    nll: { label: 'Normal Liq. Level (NLL)', unit: 'm', type: 'number', default: 2.5 },
    lll: { label: 'Low Liquid Level (LLL)', unit: 'm', type: 'number', default: 0.5 },
    tLevelElev: { label: 'Transmitter Elev.', unit: 'm', type: 'number', default: 0.2 },
    pressure: { label: 'Operating Pressure', unit: 'bar a', type: 'number', default: 1.013 },
    psvSet: { label: 'PSV Set Pressure', unit: 'bar a', type: 'number', default: 1.5 },
    vaporPressure: { label: 'Vapor Pressure', unit: 'bar a', type: 'number', default: 0, readonly: true }
};
