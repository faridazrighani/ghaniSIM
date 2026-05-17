import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "C:/Users/Zfaryana/Downloads/Pump case 6 converted from HYSYS XML.hysys";
const outputDir = "C:/Users/Zfaryana/Desktop/Hysys/outputs/pump_case_6_npsh_excel";
const outputPath = path.join(outputDir, "Untirta_Ghani_NPSH_Calculation_Workbook_Pump_case_6_2026-05-16.xlsx");

const scenario = JSON.parse(await fs.readFile(inputPath, "utf8"));
const model = scenario.model;
const fluid = model.FLUID.props;
const src = model["SRC-100"].props;
const pump = model["P-100"].props;
const snk = model["SNK-100"].props;
const pipe1 = model["PIPE-1"].props;
const pipe2 = model["PIPE-2"].props;

const theme = {
  navy: "#0F3D5E",
  blue: "#DCEEFF",
  paleBlue: "#F2F8FF",
  orange: "#F57C00",
  green: "#16A34A",
  red: "#DC2626",
  gray: "#E5E7EB",
  text: "#0B2F4A",
  white: "#FFFFFF",
  yellow: "#FFF7CC",
};

function q(sheetName) {
  return `'${sheetName}'`;
}

function colName(n) {
  let name = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function cell(row, col) {
  return `${colName(col)}${row}`;
}

function values(sheet, address, data) {
  sheet.getRange(address).values = data;
}

function formulas(sheet, address, data) {
  sheet.getRange(address).formulas = data;
}

function styleTitle(sheet, address, title, subtitle = "") {
  const range = sheet.getRange(address);
  range.merge();
  range.values = [[title]];
  range.format.fill = theme.navy;
  range.format.font = { color: theme.white, bold: true, size: 15 };
  range.format.rowHeightPx = 34;
  if (subtitle) {
    const [start, end] = address.split(":");
    const row = Number(start.match(/\d+/)[0]) + 1;
    const startCol = start.match(/[A-Z]+/)[0];
    const endCol = end.match(/[A-Z]+/)[0];
    const sub = sheet.getRange(`${startCol}${row}:${endCol}${row}`);
    sub.merge();
    sub.values = [[subtitle]];
    sub.format.fill = theme.blue;
    sub.format.font = { color: theme.text, italic: true, size: 10 };
    sub.format.rowHeightPx = 26;
  }
}

function styleHeader(range) {
  range.format.fill = theme.navy;
  range.format.font = { color: theme.white, bold: true };
  range.format.borders = { style: "thin", color: "#B7C9DA" };
}

function styleSubHeader(range) {
  range.format.fill = theme.blue;
  range.format.font = { color: theme.text, bold: true };
  range.format.borders = { style: "thin", color: "#B7C9DA" };
}

function styleBody(range) {
  range.format.fill = theme.paleBlue;
  range.format.font = { color: theme.text, size: 10 };
  range.format.borders = { style: "thin", color: "#C9D8E6" };
}

function setWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRange(`${colName(index + 1)}:${colName(index + 1)}`).format.columnWidthPx = width;
  });
}

function setNumericFormats(sheet, ranges) {
  for (const [address, format] of ranges) {
    sheet.getRange(address).format.numberFormat = format;
  }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function segmentRows() {
  const makeRows = (pipeId, role, pipe) => (pipe.segments || []).map((seg) => [
    pipeId,
    seg.name,
    role,
    seg.notes || seg.fittingType || "-",
    safeNumber(src.flow),
    safeNumber(seg.diameter),
    safeNumber(seg.length),
    safeNumber(seg.roughness),
    safeNumber(seg.fittingQuantity),
    safeNumber(seg.fittingK),
    safeNumber(seg.minorLoss),
    safeNumber(pipe.headLossAllowancePercent),
  ]);
  return [
    ...makeRows("PIPE-1", "Suction", pipe1),
    ...makeRows("PIPE-2", "Discharge", pipe2),
  ];
}

const workbook = Workbook.create();

// Sheets are created first so cross-sheet formulas resolve cleanly.
const dashboard = workbook.worksheets.add("Dashboard");
const inputs = workbook.worksheets.add("Inputs");
const pipeSheet = workbook.worksheets.add("Pipe_Segments");
const route = workbook.worksheets.add("Route_NPSH");
const curve = workbook.worksheets.add("Pump_Curve");
const trace = workbook.worksheets.add("Calc_Trace");
const dictionary = workbook.worksheets.add("Formula_Dictionary");
const refs = workbook.worksheets.add("References");

// Inputs
styleTitle(inputs, "A1:F1", "Scenario Inputs - HYSYS XML Converted to GhaniSIM", "Yellow cells are editable assumptions; blue cells are derived or descriptive.");
setWidths(inputs, [230, 140, 90, 270, 170, 170]);
values(inputs, "A4:F4", [["Category", "Parameter", "Value", "Unit", "Source", "Notes"]]);
styleHeader(inputs.getRange("A4:F4"));
const inputRows = [
  ["Constants", "g", 9.80665, "m/s2", "Engineering constant", "Gravity used by application formulas."],
  ["Constants", "Patm", 1.01325, "bar a", "NIST SI conversion", "Standard atmosphere."],
  ["Fluid", "Fluid name", fluid.fluidName, "-", "HYSYS XML / GhaniSIM fluid basis", ""],
  ["Fluid", "Temperature", safeNumber(fluid.temp), "deg C", "HYSYS XML TANKIN", ""],
  ["Fluid", "Density", safeNumber(fluid.density), "kg/m3", fluid.propertyMethod || "GhaniSIM fluid basis", ""],
  ["Fluid", "Kinematic viscosity", safeNumber(fluid.viscosity), "cSt", fluid.propertyMethod || "GhaniSIM fluid basis", "Used as nu x 1E-6 in Reynolds number."],
  ["Fluid", "Dynamic viscosity", safeNumber(fluid.dynViscosity), "mPa.s", fluid.propertyMethod || "GhaniSIM fluid basis", "Reported for reference."],
  ["Fluid", "Vapor pressure", safeNumber(fluid.vaporPressure), "bar a", fluid.propertyMethod || "GhaniSIM fluid basis", ""],
  ["Fluid", "Vapor pressure head", "", "m", "Formula", "Pv head = Pv x 100000 / (rho x g)."],
  ["SRC-100", "Source type", src.sourceType, "-", "Converted from HYSYS TANK/TANKIN", ""],
  ["SRC-100", "Source pressure", safeNumber(src.pressure), "bar a", "HYSYS XML TANKIN pressure", "Absolute pressure basis."],
  ["SRC-100", "Source elevation", safeNumber(src.elevation), "m", "GhaniSIM import assumption", ""],
  ["SRC-100", "Source flow", safeNumber(src.flow), "m3/h", "Mass flow converted with fluid density", ""],
  ["SRC-100", "Source mass flow", safeNumber(src.massFlow), "kg/h", "HYSYS XML TANKIN mass flow", ""],
  ["P-100", "Pump input mode", pump.inputMode, "-", "GhaniSIM pump model", ""],
  ["P-100", "Design flow / BEP flow", safeNumber(pump.designFlow), "m3/h", "Converted operating flow", ""],
  ["P-100", "Design head", safeNumber(pump.designHead), "m", "HYSYS XML DeltaP converted to head", "H = DeltaP / (rho x g)."],
  ["P-100", "Design efficiency", safeNumber(pump.designEfficiency), "%", "HYSYS XML pump efficiency", ""],
  ["P-100", "Manual NPSHr", safeNumber(pump.designNpshr), "m", "HYSYS XML NPSHRequired", ""],
  ["P-100", "Pump suction elevation", safeNumber(pump.suctionElevation), "m", "PIPE-1 end elevation", ""],
  ["P-100", "Pump discharge elevation", safeNumber(pump.dischargeElevation), "m", "Import assumption", ""],
  ["P-100", "Minimum NPSH ratio", safeNumber(pump.minNpshMarginRatio), "-", "ANSI/HI guided setting", ""],
  ["P-100", "Minimum NPSH margin", safeNumber(pump.minNpshMargin), "m", "ANSI/HI guided setting", ""],
  ["SNK-100", "Boundary mode", snk.boundaryMode, "-", "Recommended for imposed flow demonstration", ""],
  ["SNK-100", "Outlet/reference pressure", safeNumber(snk.pressure), "bar a", "Atmospheric reference", ""],
  ["SNK-100", "Sink elevation", safeNumber(snk.elevation), "m", "PIPE-2 end elevation", ""],
  ["SNK-100", "Demand flow", safeNumber(snk.demandFlow), "m3/h", "Source flow copied to sink demand", ""],
];
values(inputs, `A5:F${4 + inputRows.length}`, inputRows);
formulas(inputs, "C13:C13", [[`=C12*100000/(C9*C5)`]]);
styleBody(inputs.getRange(`A5:F${4 + inputRows.length}`));
inputs.getRange("C5:C31").format.fill = theme.yellow;
inputs.getRange("C13").format.fill = theme.blue;
setNumericFormats(inputs, [
  ["C5:C31", "0.000"],
  ["C7:C8", "0.000000"],
  ["C13:C13", "0.000"],
  ["C18:C18", "0.000000"],
]);

// Pipe segments
styleTitle(pipeSheet, "A1:U1", "Pipe Segment Calculation - Darcy-Weisbach and K Losses", "Add_K overrides K_each in the same way as the application logic.");
setWidths(pipeSheet, [95, 115, 90, 330, 90, 90, 90, 95, 70, 80, 80, 80, 100, 95, 105, 95, 90, 95, 95, 85, 95]);
values(pipeSheet, "A4:U4", [[
  "Pipe", "Segment", "Role", "Description / Source", "Q", "ID", "Length", "Roughness",
  "Qty", "K each", "Add K", "Allowance", "K total", "Area", "Velocity", "Reynolds",
  "f Darcy", "V2/2g", "Major hL", "Minor hL", "Total hL",
]]);
styleHeader(pipeSheet.getRange("A4:U4"));
const pipeRows = segmentRows();
const firstPipeRow = 5;
const lastPipeRow = firstPipeRow + pipeRows.length - 1;
values(pipeSheet, `A${firstPipeRow}:L${lastPipeRow}`, pipeRows);
const pipeFormulaRows = [];
for (let r = firstPipeRow; r <= lastPipeRow; r += 1) {
  pipeFormulaRows.push([
    `=IF(K${r}>0,K${r},I${r}*J${r})`,
    `=PI()*F${r}^2/4`,
    `=IF(N${r}=0,0,E${r}/3600/N${r})`,
    `=IF(F${r}=0,0,O${r}*F${r}/(${q("Inputs")}!$C$10*1E-6))`,
    `=IF(P${r}<=0,0,IF(P${r}<=2300,64/P${r},0.25/(LOG10((H${r}/F${r})/3.7+5.74/(P${r}^0.9)))^2))`,
    `=O${r}^2/(2*${q("Inputs")}!$C$5)`,
    `=IF(F${r}=0,0,Q${r}*(G${r}/F${r})*R${r})`,
    `=M${r}*R${r}`,
    `=(S${r}+T${r})*(1+L${r}/100)`,
  ]);
}
formulas(pipeSheet, `M${firstPipeRow}:U${lastPipeRow}`, pipeFormulaRows);
styleBody(pipeSheet.getRange(`A${firstPipeRow}:U${lastPipeRow}`));
setNumericFormats(pipeSheet, [
  [`E${firstPipeRow}:E${lastPipeRow}`, "0.000"],
  [`F${firstPipeRow}:H${lastPipeRow}`, "0.000000"],
  [`I${firstPipeRow}:M${lastPipeRow}`, "0.000"],
  [`N${firstPipeRow}:U${lastPipeRow}`, "0.0000"],
]);
values(pipeSheet, `A${lastPipeRow + 3}:D${lastPipeRow + 5}`, [
  ["Trace note", "K total", "IF(Add_K > 0, Add_K, Qty x K_each)", "This mirrors the latest app rule: Add K is the direct total local-loss coefficient for the segment."],
  ["Trace note", "Major loss", "hL_major = f(L/D)(V2/2g)", "Darcy-Weisbach equation."],
  ["Trace note", "Minor loss", "hL_minor = K_total(V2/2g)", "Minor/fitting loss equation."],
]);
styleSubHeader(pipeSheet.getRange(`A${lastPipeRow + 3}:D${lastPipeRow + 5}`));

// Route and NPSH
styleTitle(route, "A1:F1", "Route, Pump, Sink, and NPSH Evaluation", "Formula cells reference Inputs and Pipe_Segments so the calculation route is auditable.");
setWidths(route, [270, 160, 90, 480, 110, 170]);
values(route, "A4:F4", [["Block", "Result", "Unit", "Equation / Explanation", "Status", "Reference"]]);
styleHeader(route.getRange("A4:F4"));
const routeRows = [
  ["Source pressure head", "", "m", "Hp,src = Psrc x 100000 / (rho x g)", "", "Pressure-to-head conversion"],
  ["Source elevation head", "", "m", "zSRC from source boundary", "", "Boundary condition"],
  ["Pump suction elevation", "", "m", "zPump,suction from pump object", "", "Object property"],
  ["Total suction pipe loss", "", "m", "SUM Total hL where Role = Suction", "", "Pipe_Segments"],
  ["Vapor pressure head", "", "m", "Hvap = Pv x 100000 / (rho x g)", "", "Fluid basis"],
  ["NPSHa", "", "m", "NPSHa = Hp,src + zSRC - zPump,suction - hL,suction - Hvap", "", "NPSH definition"],
  ["NPSHr", "", "m", "Manual NPSHr imported from HYSYS XML", "", "Pump object"],
  ["NPSH margin", "", "m", "Margin = NPSHa - NPSHr", "", "ANSI/HI margin review"],
  ["NPSH ratio", "", "-", "Ratio = NPSHa / NPSHr", "", "ANSI/HI margin review"],
  ["Required NPSHa", "", "m", "MAX(NPSHr x minimum ratio, NPSHr + minimum margin)", "", "Configured acceptance basis"],
  ["NPSH excess above criterion", "", "m", "Excess = NPSHa - Required NPSHa", "", "Configured acceptance basis"],
  ["Pump cavitation status", "", "-", "SAFE when NPSHa > NPSHr and configured margin is satisfied", "", "Application warning logic"],
  ["Pump suction pressure", "", "bar a", "Psuction = (Hp,src + zSRC - zPump,suction - hL,suction) x rho x g / 100000", "", "Suction terminal readout"],
  ["Pump head at operating flow", "", "m", "Basic curve: H = Hshutoff - (Hshutoff - Hbep)(Q/BEP)^2", "", "Pump performance model"],
  ["Discharge pipe loss", "", "m", "SUM Total hL where Role = Discharge", "", "Pipe_Segments"],
  ["System head for atmospheric outlet", "", "m", "Hsys = (Psnk - Psrc)head + (zSNK - zSRC) + hL,suction + hL,discharge", "", "Bernoulli energy balance"],
  ["Free-outlet head residual", "", "m", "Residual = Hpump - Hsys", "", "Boundary residual check"],
  ["Free-outlet pressure residual", "", "bar", "Residual pressure = Residual head x rho x g / 100000", "", "Boundary residual check"],
  ["SNK required pressure at flow demand", "", "bar a", "Preq = Psrc + rho*g/100000*(Hpump - (zSNK-zSRC) - hL,suction - hL,discharge)", "", "Flow Demand Boundary readout"],
  ["SNK boundary status", "", "-", "Flow Demand Boundary solves required pressure; pressure residual applies only to fixed pressure/free outlet mode.", "", "SNK logic"],
];
values(route, `A5:F${4 + routeRows.length}`, routeRows);
const routeFormulaRows = [
  [`=${q("Inputs")}!$C$15*100000/(${q("Inputs")}!$C$9*${q("Inputs")}!$C$5)`, "", ""],
  [`=${q("Inputs")}!$C$16`, "", ""],
  [`=${q("Inputs")}!$C$24`, "", ""],
  [`=SUMIFS(${q("Pipe_Segments")}!$U$${firstPipeRow}:$U$${lastPipeRow},${q("Pipe_Segments")}!$C$${firstPipeRow}:$C$${lastPipeRow},"Suction")`, "", ""],
  [`=${q("Inputs")}!$C$13`, "", ""],
  [`=B5+B6-B7-B8-B9`, "", ""],
  [`=${q("Inputs")}!$C$23`, "", ""],
  [`=B10-B11`, "", ""],
  [`=IF(B11=0,"",B10/B11)`, "", ""],
  [`=MAX(B11*${q("Inputs")}!$C$26,B11+${q("Inputs")}!$C$27)`, "", ""],
  [`=B10-B14`, "", ""],
  [`=IF(B10<=B11,"CAVITATION RISK",IF(B15<0,"WARNING","SAFE"))`, "", ""],
  [`=(B5+B6-B7-B8)*${q("Inputs")}!$C$9*${q("Inputs")}!$C$5/100000`, "", ""],
  [`=MAX(0,${q("Inputs")}!$C$21*1.25-(${q("Inputs")}!$C$21*1.25-${q("Inputs")}!$C$21)*(${q("Inputs")}!$C$17/${q("Inputs")}!$C$20)^2)`, "", ""],
  [`=SUMIFS(${q("Pipe_Segments")}!$U$${firstPipeRow}:$U$${lastPipeRow},${q("Pipe_Segments")}!$C$${firstPipeRow}:$C$${lastPipeRow},"Discharge")`, "", ""],
  [`=(${q("Inputs")}!$C$29-${q("Inputs")}!$C$15)*100000/(${q("Inputs")}!$C$9*${q("Inputs")}!$C$5)+(${q("Inputs")}!$C$30-${q("Inputs")}!$C$16)+B8+B19`, "", ""],
  [`=B18-B20`, "", ""],
  [`=B21*${q("Inputs")}!$C$9*${q("Inputs")}!$C$5/100000`, "", ""],
  [`=${q("Inputs")}!$C$15+${q("Inputs")}!$C$9*${q("Inputs")}!$C$5/100000*(B18-(${q("Inputs")}!$C$30-${q("Inputs")}!$C$16)-B8-B19)`, "", ""],
  [`=IF(${q("Inputs")}!$C$28="Flow Demand Boundary","SAFE - required pressure is a readout",IF(ABS(B22)>0.02,"WARNING","SAFE"))`, "", ""],
];
formulas(route, `B5:B${4 + routeRows.length}`, routeFormulaRows.map((row) => [row[0]]));
formulas(route, `E5:E${4 + routeRows.length}`, routeRows.map((_, index) => {
  const row = 5 + index;
  if (row === 16) return [`=B${row}`];
  if (row === 24) return [`=B${row}`];
  return [""];
}));
styleBody(route.getRange(`A5:F${4 + routeRows.length}`));
route.getRange("E16:E16").conditionalFormats.add("containsText", {
  text: "SAFE",
  format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
});
route.getRange("E16:E16").conditionalFormats.add("containsText", {
  text: "WARNING",
  format: { fill: "#FFEDD5", font: { color: "#C2410C", bold: true } },
});
route.getRange("E16:E16").conditionalFormats.add("containsText", {
  text: "RISK",
  format: { fill: "#FEE2E2", font: { color: "#991B1B", bold: true } },
});
route.getRange("E24:E24").conditionalFormats.add("containsText", {
  text: "SAFE",
  format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
});
setNumericFormats(route, [["B5:B23", "0.000"]]);

// Pump curve
styleTitle(curve, "A1:H1", "Pump Performance Curve and System Curve", "System curve is plotted as static head plus quadratic loss scaling for presentation.");
setWidths(curve, [90, 110, 120, 120, 120, 115, 115, 240]);
values(curve, "A4:H4", [["Flow", "Pump Head", "System Curve", "NPSHr", "NPSHa", "Margin", "Status", "Trace note"]]);
styleHeader(curve.getRange("A4:H4"));
const flowFactors = [0, 0.25, 0.5, 0.75, 1, 1.1, 1.25, 1.5, 1.7];
values(curve, `A5:A${4 + flowFactors.length}`, flowFactors.map((factor) => [safeNumber(pump.bepFlow || pump.designFlow) * factor]));
const curveFormulas = [];
for (let r = 5; r < 5 + flowFactors.length; r += 1) {
  curveFormulas.push([
    `=MAX(0,${q("Inputs")}!$C$21*1.25-(${q("Inputs")}!$C$21*1.25-${q("Inputs")}!$C$21)*(A${r}/${q("Inputs")}!$C$20)^2)`,
    `=${q("Route_NPSH")}!$B$20-(${q("Route_NPSH")}!$B$8+${q("Route_NPSH")}!$B$19)*(1-(A${r}/${q("Inputs")}!$C$17)^2)`,
    `=${q("Inputs")}!$C$23`,
    `=${q("Route_NPSH")}!$B$10`,
    `=E${r}-D${r}`,
    `=IF(E${r}<=D${r},"CAVITATION RISK",IF(F${r}<${q("Inputs")}!$C$27,"WARNING","SAFE"))`,
    "",
  ]);
}
formulas(curve, `B5:H${4 + flowFactors.length}`, curveFormulas);
values(curve, `H5:H${4 + flowFactors.length}`, flowFactors.map(() => ["Quadratic system curve uses operating-point losses for visual demonstration."]));
styleBody(curve.getRange(`A5:H${4 + flowFactors.length}`));
setNumericFormats(curve, [[`A5:F${4 + flowFactors.length}`, "0.000"]]);
const chart = curve.charts.add("line", curve.getRange(`A4:C${4 + flowFactors.length}`), "Auto");
chart.title.text = "Pump Head vs System Curve";
chart.setPosition(curve.getRange("J4:Q22"));
chart.width = 620;
chart.height = 360;

// Dashboard
styleTitle(dashboard, "A1:H1", "Untirta GhaniSIM NPSH Calculation Workbook", "Modeling & Simulation of a Pumping System for Evaluating Cavitation Potential in Centrifugal Pumps Based on NPSH Analysis.");
setWidths(dashboard, [190, 130, 90, 190, 130, 90, 210, 240]);
values(dashboard, "A4:H4", [["KPI", "Value", "Unit", "KPI", "Value", "Unit", "Status / Meaning", "Presenter note"]]);
styleHeader(dashboard.getRange("A4:H4"));
values(dashboard, "A5:H13", [
  ["Flow", "", "m3/h", "Pump Head", "", "m", "", "Operating flow and pump head are formula-driven from input assumptions."],
  ["NPSHa", "", "m", "NPSHr", "", "m", "", "Primary cavitation comparison."],
  ["NPSH Margin", "", "m", "NPSH Ratio", "", "-", "", "Margin and ratio should exceed the selected basis."],
  ["Suction Loss", "", "m", "Discharge Loss", "", "m", "", "Pipe/fitting losses are traceable segment-by-segment."],
  ["Suction Pressure", "", "bar a", "SNK Required Pressure", "", "bar a", "", "Flow Demand Boundary makes outlet pressure a readout."],
  ["Fluid Temperature", "", "deg C", "Vapor Pressure", "", "bar a", "", "Vapor pressure is critical for hot-water NPSH."],
  ["SRC Pressure", "", "bar a", "SNK Mode", "", "-", "", "Boundary choices change the system equation."],
  ["Pump Status", "", "-", "SNK Status", "", "-", "", "Warnings should be interpreted through the trace sheets."],
  ["Workbook source", "Pump case 6 XML", "-", "Prepared for", "Bachelor Thesis", "-", "Mechanical Engineering", "Sultan Ageng Tirtayasa University"],
]);
formulas(dashboard, "B5:B12", [
  [`=${q("Inputs")}!$C$17`],
  [`=${q("Route_NPSH")}!$B$10`],
  [`=${q("Route_NPSH")}!$B$12`],
  [`=${q("Route_NPSH")}!$B$8`],
  [`=${q("Route_NPSH")}!$B$17`],
  [`=${q("Inputs")}!$C$8`],
  [`=${q("Inputs")}!$C$15`],
  [`=${q("Route_NPSH")}!$B$16`],
]);
formulas(dashboard, "E5:E12", [
  [`=${q("Route_NPSH")}!$B$18`],
  [`=${q("Route_NPSH")}!$B$11`],
  [`=${q("Route_NPSH")}!$B$13`],
  [`=${q("Route_NPSH")}!$B$19`],
  [`=${q("Route_NPSH")}!$B$23`],
  [`=${q("Inputs")}!$C$12`],
  [`=${q("Inputs")}!$C$28`],
  [`=${q("Route_NPSH")}!$B$24`],
]);
formulas(dashboard, "G5:G12", [
  [`=IF(${q("Route_NPSH")}!$B$16="SAFE","Cavitation basis satisfied","Review pump warning")`],
  [`=IF(${q("Route_NPSH")}!$B$10>${q("Route_NPSH")}!$B$11,"NPSHa exceeds NPSHr","NPSHa below/equal NPSHr")`],
  [`=IF(${q("Route_NPSH")}!$B$15>=0,"Configured margin satisfied","Configured margin not satisfied")`],
  [""],
  [""],
  [""],
  [""],
  [`=${q("Route_NPSH")}!$B$24`],
]);
values(dashboard, "G8:G11", [
  ["Detailed in Pipe_Segments"],
  ["SNK pressure is calculated at demand flow"],
  ["Hot water requires careful vapor pressure review"],
  ["Absolute pressure basis"],
]);
styleBody(dashboard.getRange("A5:H13"));
dashboard.getRange("A5:H13").format.borders = { style: "thin", color: "#C9D8E6" };
dashboard.getRange("B5:B12").format.fill = theme.yellow;
dashboard.getRange("E5:E12").format.fill = theme.yellow;
dashboard.getRange("G5:G12").conditionalFormats.add("containsText", {
  text: "SAFE",
  format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
});
dashboard.getRange("G5:G12").conditionalFormats.add("containsText", {
  text: "warning",
  format: { fill: "#FFEDD5", font: { color: "#C2410C", bold: true } },
});
setNumericFormats(dashboard, [["B5:B12", "0.000"], ["E5:E12", "0.000"]]);
values(dashboard, "A16:H16", [["Presentation Flow", "Step 1", "Step 2", "Step 3", "Step 4", "Step 5", "Step 6", "Result"]]);
styleHeader(dashboard.getRange("A16:H16"));
values(dashboard, "A17:H17", [[
  "How to explain",
  "Start from Fluid Basis.",
  "Read SRC pressure/elevation/flow.",
  "Trace suction pipe losses.",
  "Compute NPSHa.",
  "Compare against NPSHr.",
  "Check SNK boundary mode.",
  "Conclude safe/warning/risk.",
]]);
styleBody(dashboard.getRange("A17:H17"));

// Calculation trace
styleTitle(trace, "A1:F1", "Calculation Trace / Step-by-Step Report", "This sheet is designed for presentation: equation, substitution route, result, and literature basis.");
setWidths(trace, [220, 360, 360, 120, 90, 330]);
values(trace, "A4:F4", [["Step", "Equation", "Substitution route", "Live result", "Unit", "Reference / basis"]]);
styleHeader(trace.getRange("A4:F4"));
const traceRows = [
  ["1. Fluid basis", "rho, nu, Pv from fluid properties", "Inputs!C9, Inputs!C10, Inputs!C12", "", "-", "IAPWS-based water property correlation; verify for final design."],
  ["2. Source pressure head", "Hp = Psrc x 100000 / (rho x g)", "Route_NPSH!B5", "", "m", "Bernoulli pressure-head term."],
  ["3. Suction pipe loss", "hL,suction = SUM(hmajor + hminor)", "Pipe_Segments rows with Role = Suction", "", "m", "Darcy-Weisbach and local K losses."],
  ["4. Vapor pressure head", "Hvap = Pv x 100000 / (rho x g)", "Route_NPSH!B9", "", "m", "NPSH definition subtracts vapor pressure head."],
  ["5. NPSHa", "NPSHa = Hp,src + zSRC - zPump,suction - hL,suction - Hvap", "Route_NPSH!B10", "", "m", "Available suction head above vapor pressure."],
  ["6. NPSHr", "NPSHr = pump required NPSH", "Inputs!C23", "", "m", "Imported from HYSYS XML NPSHRequired."],
  ["7. Margin", "Margin = NPSHa - NPSHr", "Route_NPSH!B12", "", "m", "Positive margin reduces cavitation risk."],
  ["8. Ratio", "Ratio = NPSHa / NPSHr", "Route_NPSH!B13", "", "-", "Configured minimum ratio check."],
  ["9. Pump head", "H = Hshutoff - (Hshutoff - Hbep)(Q/BEP)^2", "Route_NPSH!B18", "", "m", "GhaniSIM Basic pump performance model."],
  ["10. System head", "Hsys = pressure head difference + elevation difference + route losses", "Route_NPSH!B20", "", "m", "Bernoulli energy equation."],
  ["11. SNK Flow Demand", "Preq = Psrc + rho*g/100000*(Hpump - dz - losses)", "Route_NPSH!B23", "", "bar a", "For Flow Demand Boundary, pressure is calculated as a readout."],
  ["12. Final status", "SAFE / WARNING / CAVITATION RISK", "Route_NPSH!B16 and Route_NPSH!B24", "", "-", "Application warning logic for pump and boundary."],
];
values(trace, `A5:C${4 + traceRows.length}`, traceRows.map((row) => row.slice(0, 3)));
values(trace, `E5:F${4 + traceRows.length}`, traceRows.map((row) => row.slice(4, 6)));
const traceResultFormulas = [
  `=${q("Inputs")}!$C$9`,
  `=${q("Route_NPSH")}!$B$5`,
  `=${q("Route_NPSH")}!$B$8`,
  `=${q("Route_NPSH")}!$B$9`,
  `=${q("Route_NPSH")}!$B$10`,
  `=${q("Route_NPSH")}!$B$11`,
  `=${q("Route_NPSH")}!$B$12`,
  `=${q("Route_NPSH")}!$B$13`,
  `=${q("Route_NPSH")}!$B$18`,
  `=${q("Route_NPSH")}!$B$20`,
  `=${q("Route_NPSH")}!$B$23`,
  `=${q("Route_NPSH")}!$B$16&" / "&${q("Route_NPSH")}!$B$24`,
].map((formula) => [formula]);
formulas(trace, `D5:D${4 + traceRows.length}`, traceResultFormulas);
styleBody(trace.getRange(`A5:F${4 + traceRows.length}`));
setNumericFormats(trace, [[`D5:D${4 + traceRows.length}`, "0.000"]]);

// Formula dictionary
styleTitle(dictionary, "A1:G1", "Formula Dictionary", "Core formulas used by the workbook and by the application calculation route.");
setWidths(dictionary, [190, 250, 430, 260, 150, 220, 300]);
values(dictionary, "A4:G4", [["Topic", "Formula", "Meaning", "Excel implementation", "Unit", "Where used", "Reference"]]);
styleHeader(dictionary.getRange("A4:G4"));
const dictionaryRows = [
  ["Pressure head", "Hp = P x 100000 / (rho x g)", "Converts absolute pressure in bar to liquid head.", "Route_NPSH!B5", "m", "SRC, vapor pressure, pressure residual", "Fluid mechanics / Bernoulli"],
  ["Velocity", "V = Q / A", "Q in m3/s divided by pipe cross-sectional area.", "Pipe_Segments!O:O", "m/s", "Pipe losses", "Darcy-Weisbach basis"],
  ["Reynolds number", "Re = V D / nu", "Flow regime indicator using kinematic viscosity.", "Pipe_Segments!P:P", "-", "Friction factor", "Fluid mechanics"],
  ["Darcy friction factor", "f = 64/Re or turbulent approximation", "Laminar and turbulent friction-factor branch.", "Pipe_Segments!Q:Q", "-", "Major loss", "Moody/Colebrook-style screening"],
  ["Major loss", "hmajor = f(L/D)(V2/2g)", "Distributed pipe-wall friction loss.", "Pipe_Segments!S:S", "m", "Suction/discharge total loss", "Darcy-Weisbach"],
  ["Minor loss", "hminor = K(V2/2g)", "Local loss due to valves, elbows, fittings, entrance/exit.", "Pipe_Segments!T:T", "m", "Fittings", "Crane/Perry-style K coefficient"],
  ["Add K rule", "Ktotal = IF(AddK>0, AddK, Qty x K_each)", "Direct Add_K overrides K_each for the segment.", "Pipe_Segments!M:M", "-", "All pipe segments", "Application logic"],
  ["NPSHa", "NPSHa = Hp,src + zsrc - zpump - hL,suction - Hvap", "Available head above vapor pressure at pump suction.", "Route_NPSH!B10", "m", "Cavitation analysis", "Pump/NPSH literature"],
  ["NPSH margin", "Margin = NPSHa - NPSHr", "Positive margin is required before additional acceptance criteria.", "Route_NPSH!B12", "m", "Pump status", "ANSI/HI margin guidance"],
  ["NPSH ratio", "Ratio = NPSHa / NPSHr", "Ratio check against selected reliability basis.", "Route_NPSH!B13", "-", "Pump status", "ANSI/HI margin guidance"],
  ["Basic pump curve", "H = Hshutoff - (Hshutoff-Hbep)(Q/BEP)^2", "Generic pump head curve used when no manufacturer curve is supplied.", "Route_NPSH!B18", "m", "Pump operating point", "GhaniSIM basic model"],
  ["System head", "Hsys = DeltaPhead + DeltaZ + hL", "Route resistance and boundary pressure/elevation requirement.", "Route_NPSH!B20", "m", "Boundary residual", "Bernoulli energy equation"],
];
values(dictionary, `A5:G${4 + dictionaryRows.length}`, dictionaryRows);
styleBody(dictionary.getRange(`A5:G${4 + dictionaryRows.length}`));

// References
styleTitle(refs, "A1:D1", "References and Academic Basis", "Use these references when explaining the calculation basis to the thesis advisor.");
setWidths(refs, [230, 520, 520, 140]);
values(refs, "A4:D4", [["Topic", "Reference", "How it supports the workbook", "Type"]]);
styleHeader(refs.getRange("A4:D4"));
const refRows = [
  ["Fluid mechanics", "pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf", "Bernoulli equation, pressure head, velocity head, head loss.", "Local PDF"],
  ["Fluid mechanics", "pdf_ref/ref2-introduction-fluid-mechanics.pdf", "Pipe-flow fundamentals, Reynolds number, friction losses.", "Local PDF"],
  ["Pump cavitation", "pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf", "Cavitation mechanism and relation to NPSH.", "Local PDF"],
  ["NPSH margin", "pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf", "NPSH margin and reliability basis.", "Local PDF"],
  ["Atmosphere conversion", "https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors", "1 standard atmosphere = 101325 Pa = 1.01325 bar.", "External"],
  ["Water properties", "https://webbook.nist.gov/chemistry/fluid/", "Independent reference for water thermophysical property checks.", "External"],
  ["Application source", inputPath, "Converted GhaniSIM .hysys scenario used as workbook source.", "Local scenario"],
];
values(refs, `A5:D${4 + refRows.length}`, refRows);
styleBody(refs.getRange(`A5:D${4 + refRows.length}`));

// Sheet-level final styling.
for (const sheet of [dashboard, inputs, pipeSheet, route, curve, trace, dictionary, refs]) {
  sheet.getRange("A:Z").format.font = { name: "Aptos", size: 10, color: theme.text };
}
dashboard.getRange("A1:H2").format.font = { name: "Aptos Display", color: theme.white, bold: true, size: 15 };

// Verification ranges are intentionally compact; full render is done in the calling workflow.
const summaryCheck = await workbook.inspect({
  kind: "table",
  range: "Dashboard!A4:H13",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 8,
});
console.log(summaryCheck.ndjson);
const errorScan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan before export",
});
console.log(errorScan.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`Saved ${outputPath}`);
