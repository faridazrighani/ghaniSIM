function updatePalmOilProperties() {
    const node = globalModel["FLUID"];
    let T = node.props.temp;
    if (T < 35) {
        T = 35;
        node.props.temp = 35;
        const tempInp = document.getElementById('fluidTempInput');
        if (tempInp) tempInp.value = 35;
    }
    if (T > 250) T = 250;

    node.props.density = 922.74 - 0.6545 * T;
    node.props.sg = node.props.density / 999.972;
    node.props.vaporPressure = 0.001;
    node.props.dynViscosity = Math.exp(-6.37 + 3150 / (T + 273.15));
    node.props.viscosity = node.props.dynViscosity / (node.props.density / 1000);
    node.props.specificHeat = 2.0;
    node.props.bulkModulus = 1.8;

    recalcExtendedFluidProps(node);
}
