const PUMP_OPTIMIZATION_MODE_MANUAL = 'Manual';
const PUMP_OPTIMIZATION_MODE_AUTO = 'Auto';
const PUMP_NPSHR_SOURCE_ESTIMATED = 'Estimated';
const PUMP_NPSHR_SOURCE_MANUAL = 'Manual';
const PUMP_NPSHR_SOURCE_CURVE = 'Manufacturer/Test Curve';
const PUMP_NPSHR_SOURCE_OPTIONS = [PUMP_NPSHR_SOURCE_MANUAL, PUMP_NPSHR_SOURCE_ESTIMATED];
const PUMP_NPSH_ASSESSMENT_SCREENING = 'Screening';
const PUMP_NPSH_ASSESSMENT_ANSI_HI = 'ANSI/HI Guided';
const PUMP_NPSH_ASSESSMENT_ENGINEERING = 'Engineering Validation';
const PUMP_NPSH_ASSESSMENT_OPTIONS = [
    PUMP_NPSH_ASSESSMENT_SCREENING,
    PUMP_NPSH_ASSESSMENT_ANSI_HI,
    PUMP_NPSH_ASSESSMENT_ENGINEERING
];
const PUMP_NPSH_MARGIN_USER_DEFINED = 'User Defined';
const PUMP_NPSH_MARGIN_GENERAL_PURPOSE = 'General Purpose';
const PUMP_NPSH_MARGIN_PETROLEUM = 'Petroleum/Hydrocarbon';
const PUMP_NPSH_MARGIN_CHEMICAL = 'Chemical Process';
const PUMP_NPSH_MARGIN_WATER_WASTEWATER = 'Water/Wastewater';
const PUMP_NPSH_MARGIN_BUILDING = 'Building Services';
const PUMP_NPSH_MARGIN_IRRIGATION = 'Irrigation';
const PUMP_NPSH_MARGIN_BASIS_OPTIONS = [
    PUMP_NPSH_MARGIN_USER_DEFINED,
    PUMP_NPSH_MARGIN_GENERAL_PURPOSE,
    PUMP_NPSH_MARGIN_PETROLEUM,
    PUMP_NPSH_MARGIN_CHEMICAL,
    PUMP_NPSH_MARGIN_WATER_WASTEWATER,
    PUMP_NPSH_MARGIN_BUILDING,
    PUMP_NPSH_MARGIN_IRRIGATION
];

const PUMP_DEFAULT_PROPS = {
    inputMode: 'Basic',
    optimizationMode: PUMP_OPTIMIZATION_MODE_MANUAL,
    npshrSourceMode: PUMP_NPSHR_SOURCE_ESTIMATED,
    npshAssessmentMode: PUMP_NPSH_ASSESSMENT_SCREENING,
    npshMarginBasis: PUMP_NPSH_MARGIN_USER_DEFINED,
    screeningDefaultsApplied: false,
    elevation: 0,
    suctionElevation: 0,
    dischargeElevation: 0,
    designFlow: '',
    designHead: '',
    designEfficiency: '',
    designNpshr: '',
    bepFlow: '',
    porMinPercent: '',
    porMaxPercent: '',
    aorMinPercent: '',
    aorMaxPercent: '',
    minNpshMarginRatio: '',
    minNpshMargin: '',
    curveData: [
        { flow: 0, head: 55, eff: 0, npshr: 1 },
        { flow: 50, head: 50, eff: 60, npshr: 1.5 },
        { flow: 100, head: 40, eff: 75, npshr: 2 },
        { flow: 150, head: 20, eff: 50, npshr: 4 }
    ]
};
