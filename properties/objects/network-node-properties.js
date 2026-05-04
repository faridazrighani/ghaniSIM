const SOURCE_SCHEMA = {
    pressure: { label: 'Boundary Pressure', unit: 'bar a', type: 'number', default: 1.013 },
    temperatureMode: {
        label: 'Temperature Mode',
        type: 'select',
        default: 'Use Fluid Basis',
        options: ['Use Fluid Basis', 'Custom']
    },
    temp: { label: 'Temperature', unit: 'deg C', type: 'number', default: 25 },
    flowInputMode: {
        label: 'Flow Input Mode',
        type: 'select',
        default: 'Mass Flow',
        options: ['Volumetric Flow', 'Mass Flow']
    },
    flow: { label: 'Volumetric Flow', unit: 'm3/h', type: 'number', default: 9.5 },
    massFlow: { label: 'Mass Flow', unit: 'kg/h', type: 'number', default: 9500 }
};

const SINK_SCHEMA = {
    pressure: { label: 'Outlet Pressure', unit: 'bar a', type: 'number', default: 1.013 }
};

const JUNCTION_SCHEMA = {
    pressure: { label: 'Node Pressure', unit: 'bar a', type: 'number', default: 1.013, readonly: true }
};
