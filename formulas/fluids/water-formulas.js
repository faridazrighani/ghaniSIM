function updateWaterProperties() {
    const node = globalModel["FLUID"];
    let T = node.props.temp;
    if (T < 0) T = 0;
    if (T > 370) T = 370;

    const num = 999.83952 + 16.945176 * T - 7.9870401e-3 * Math.pow(T, 2) - 46.170461e-6 * Math.pow(T, 3) + 105.56302e-9 * Math.pow(T, 4) - 280.54253e-12 * Math.pow(T, 5);
    const den = 1 + 16.897850e-3 * T;
    node.props.density = num / den;
    node.props.sg = node.props.density / 999.972;

    const p_kPa = 0.61121 * Math.exp((18.678 - T / 234.5) * (T / (257.14 + T)));
    node.props.vaporPressure = p_kPa * 0.01;

    const TK = T + 273.15;
    node.props.dynViscosity = 0.02414 * Math.pow(10, 247.8 / (TK - 140));
    node.props.viscosity = node.props.dynViscosity / (node.props.density / 1000);
    node.props.specificHeat = 4.18;
    node.props.bulkModulus = 2.2;

    recalcExtendedFluidProps(node);
}
