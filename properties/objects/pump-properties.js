const PUMP_DEFAULT_PROPS = {
    inputMode: 'Basic',
    elevation: 0,
    designFlow: 100,
    designHead: 40,
    designEfficiency: 75,
    curveData: [
        { flow: 0, head: 55, eff: 0, npshr: 1 },
        { flow: 50, head: 50, eff: 60, npshr: 1.5 },
        { flow: 100, head: 40, eff: 75, npshr: 2 },
        { flow: 150, head: 20, eff: 50, npshr: 4 }
    ]
};
