const PIPE_SCHEMA = {
    routeStyle: { label: 'Pipe Routing', type: 'select', options: ['Straight', 'Elbow'], default: 'Straight' },
    minorLoss: { label: 'Fittings (K)', unit: '', type: 'number', default: 0 }
};

const PIPE_DEFAULT_SEGMENTS = [
    { name: "Segment 1", pipeSize: "Custom diameter", diameter: 0.1, length: 10, roughness: 0.000045 }
];
