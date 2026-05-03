function updateMethanolProperties() {
    const node = globalModel["FLUID"];
    let T = node.props.temp;
    if (T < 0) T = 0;
    if (T > 230) T = 230;

    node.props.density = 810.8 - 0.952 * T;
    node.props.sg = node.props.density / 999.972;

    const p_mmHg = Math.pow(10, 8.0724 - 1574.99 / (T + 238.87));
    node.props.vaporPressure = p_mmHg * 0.00133322;

    node.props.dynViscosity = Math.exp(-5.853 + 1561.4 / (T + 273.15));
    node.props.viscosity = node.props.dynViscosity / (node.props.density / 1000);
    node.props.specificHeat = 2.53;
    node.props.bulkModulus = 0.82;

    recalcExtendedFluidProps(node);
}
