function updateCrudeOilProperties() {
    const node = globalModel["FLUID"];
    let T = node.props.temp;
    if (T < 0) T = 0;
    if (T > 250) T = 250;

    node.props.density = 850 - 0.7 * (T - 15.6);
    node.props.sg = node.props.density / 999.972;

    const rvp_bar = 0.34;
    const t_ref_K = 311.15;
    const t_actual_K = T + 273.15;
    node.props.vaporPressure = rvp_bar * Math.exp(4000 * (1 / t_ref_K - 1 / t_actual_K));

    node.props.dynViscosity = Math.exp(-7.6 + 2902 / (T + 273.15));
    node.props.viscosity = node.props.dynViscosity / (node.props.density / 1000);
    node.props.specificHeat = 2.0;
    node.props.bulkModulus = 1.5;

    recalcExtendedFluidProps(node);
}
