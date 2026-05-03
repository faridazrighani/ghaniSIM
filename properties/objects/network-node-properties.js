const SOURCE_SCHEMA = {
    pressure: { label: 'Boundary Pressure', unit: 'bar a', type: 'number', default: 1.013 },
    temp: { label: 'Temperature', unit: 'deg C', type: 'number', default: 60 },
    flow: { label: 'Flow Rate', unit: 'm3/h', type: 'number', default: 100 }
};

const SINK_SCHEMA = {
    pressure: { label: 'Outlet Pressure', unit: 'bar a', type: 'number', default: 1.013 }
};

const JUNCTION_SCHEMA = {
    pressure: { label: 'Node Pressure', unit: 'bar a', type: 'number', default: 1.013, readonly: true }
};
