const VALVE_SCHEMA = {
    valveType: { label: 'Valve Type', type: 'select', options: ['Globe Valve', 'Ball Valve', 'Gate Valve', 'Butterfly Valve', 'Check Valve'], default: 'Globe Valve' },
    position: { label: 'Position', type: 'select', options: ['Suction', 'Discharge'], default: 'Discharge' },
    cv: { label: 'Cv Value', unit: '', type: 'number', default: 100 },
    opening: { label: '% Opening', unit: '%', type: 'number', default: 100 }
};

const CHECK_VALVE_SCHEMA = {
    crackingPressure: { label: 'Cracking Pressure', unit: 'bar', type: 'number', default: 0.1 },
    cv: { label: 'Cv Value', unit: '', type: 'number', default: 100 }
};
