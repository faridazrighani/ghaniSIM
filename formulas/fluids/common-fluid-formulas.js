function recalcExtendedFluidProps(fluidNode) {
    const rho = fluidNode.props.density;
    if (rho > 0) {
        fluidNode.props.specVolume = 1 / rho;
        fluidNode.props.specWeight = rho * GRAVITY;
        const K_Pa = (fluidNode.props.bulkModulus || 2.2) * 1e9;
        fluidNode.props.speedOfSound = Math.sqrt(K_Pa / rho);
    }
}
