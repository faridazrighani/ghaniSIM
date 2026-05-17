const assert = require('node:assert/strict');
const fs = require('node:fs');
const ExcelJS = require('../vendor/exceljs.min.js');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');
const menuJs = fs.readFileSync('toolbar/menu-bar.js', 'utf8');
const buildScript = fs.readFileSync('tools/build-production-assets.mjs', 'utf8');
const exportJs = fs.readFileSync('ui/scenario-excel-export.js', 'utf8');

assert.match(indexHtml, /id="menu-export-excel-trace"/, 'File -> Export menu item is missing.');
assert.match(indexHtml, /Excel Calculation Trace \(\.xlsx\)/, 'Excel export menu label is missing.');
assert.doesNotMatch(indexHtml, /id="btn-export-scenario-report"/, 'Toolbar export button should be removed; use File -> Export instead.');
assert.doesNotMatch(appJs, /btn-export-scenario-report/, 'Removed toolbar export button should not leave bootstrap wiring behind.');
assert.match(menuJs, /menu-export-excel-trace/, 'Menu export handler is missing.');
assert.match(menuJs, /exportScenarioCalculationTraceToExcel/, 'Menu export action is not wired.');
assert.match(buildScript, /ui\/scenario-excel-export\.js/, 'Export module is not included in production bundle.');
assert.ok(fs.statSync('vendor/exceljs.min.js').size > 500000, 'ExcelJS vendor bundle is missing or incomplete.');
assert.match(exportJs, /function showScenarioExportToast/, 'Excel export should use a nonblocking toast helper.');
assert.doesNotMatch(exportJs, /alert\(/, 'Excel export should not use blocking browser alerts.');
assert.match(exportJs, /ui-toast-region/, 'Excel export toast fallback should reuse the nonblocking toast surface.');

const trace = {
  basis: {
    fluidName: 'Water',
    density: 997.047,
    gravity: 9.81,
    vaporPressureBarA: 0.032
  },
  boundary: {
    id: 'SRC-100',
    absolutePressureBar: 1.01325,
    elevation: 0,
    velocityHead: 0
  },
  pump: {
    elevation: 0,
    npshr: 3,
    npshrSource: 'Manual input'
  },
  losses: {
    total: 0.014,
    entries: [
      { objectId: 'PIPE-1', type: 'pipe', majorLoss: 0.01, minorLoss: 0.004, headLoss: 0.014 }
    ]
  },
  path: {
    text: 'SRC-100 -> PIPE-1 -> P-100',
    dominantLoss: 'PIPE-1'
  },
  steps: [
    {
      title: 'NPSHa',
      formula: 'NPSHa = Hp + zSRC - zPump - hLs - Hv',
      substitution: '10.36 + 0 - 0 - 0.014 - 0.33',
      result: 10.02,
      unit: 'm',
      reference: 'NPSH equation'
    }
  ],
  interpretation: {
    status: 'Safe',
    message: 'NPSH margin satisfies configured limits.'
  }
};

const globalModel = {
  SETTINGS: { props: { unitStandard: 'Metric / European Engineering' } },
  FLUID: { props: { fluidName: 'Water', temp: 25, density: 997.047, vaporPressure: 0.032, dynViscosity: 0.89 } },
  'SRC-100': { type: 'source', props: { mode: 'standalone' }, results: { warnings: [] } },
  'P-100': {
    type: 'pump',
    props: { minNpshMargin: 0.5, minNpshMarginRatio: 1.1, elevation: 0 },
    results: {
      flow: 9.528,
      head: 50,
      npsha: 10.022,
      npshr: 3,
      npshMargin: 7.022,
      npshRatio: 3.341,
      cavitationStatus: 'Safe',
      operatingRegion: 'POR',
      dominantSuctionLoss: 'PIPE-1 (0.01 m)',
      solveMode: 'Flow demand',
      pumpCurve: [[0, 62], [5, 59], [9.528, 50], [15, 31], [21.2, 7]],
      sysCurve: [[0, 49.9], [5, 49.9], [9.528, 50], [15, 49.9], [21.2, 49.9]],
      npshEvaluation: { calculationTrace: trace }
    }
  },
  'PIPE-1': {
    type: 'pipe',
    props: {
      headLossAllowancePercent: 0,
      segments: [
        { name: 'PIPE-1-Seg-1', length: 10, diameter: 0.10226, roughness: 0.000045, fittingK: 0.2, fittingQuantity: 1, minorLoss: 1.8 }
      ]
    },
    results: { flow: 9.528, pressureCalculated: true }
  },
  'SNK-100': { type: 'sink', props: { mode: 'flowDemand' }, results: { warnings: [] } }
};

const window = {};
const document = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, addEventListener() {} }),
  head: { appendChild() {} },
  body: { appendChild() {} }
};
const Blob = function Blob() {};
const URL = { createObjectURL: () => 'blob:test', revokeObjectURL() {} };
const connections = [];
function updateSimulation() {}
function drawConnections() {}
function calculatePipeHeadLoss() { return 0.014; }
function calculatePipeHydraulicSegments() { return [{ index: 0, totalLoss: 0.014 }]; }
function normalizePipeProps() {}
function getPipeFittingK(segment) { return Number(segment.fittingK || 0); }
function getPipeAdditionalK(segment) { return Number(segment.minorLoss || 0); }
function buildSourceCalculationTrace() {
  return {
    status: 'Safe',
    readouts: [{ label: 'NPSHa@P', value: 10.02, unit: 'm', key: 'npshaAtPump' }],
    steps: trace.steps,
    warnings: []
  };
}
function buildSinkCalculationTrace() {
  return {
    status: 'Safe',
    readouts: [{ label: 'Required Pressure', value: 1.057, unit: 'bar a', key: 'requiredPressure' }],
    steps: trace.steps,
    warnings: []
  };
}

eval(exportJs);

assert.equal(typeof window.exportScenarioCalculationTraceToExcel, 'function', 'Export function is not exposed on window.');

const data = collectScenarioExportData();
const filename = buildScenarioExportFileName(data);
assert.match(filename, /^Untirta_Ghani_Calc_NPSH_Scenario_SRC-100_P-100_SNK-100_\d{4}-\d{2}-\d{2}\.xlsx$/);

const workbook = buildScenarioExcelWorkbook(ExcelJS, data);
[
  'Scenario Summary',
  'Pump Performance Curve',
  'Live Formula Model',
  'Route Trace',
  'Pump NPSH Trace',
  'Pipe Segments',
  'SRC Trace',
  'SNK Trace',
  'Warnings Guidance',
  'References'
].forEach(sheetName => assert.ok(workbook.getWorksheet(sheetName), `${sheetName} sheet is missing.`));

const performanceCurve = workbook.getWorksheet('Pump Performance Curve');
assert.equal(performanceCurve.getCell('B35').value, 'Flow (m3/h)');
assert.equal(performanceCurve.getCell('C35').value, 'Pump Head (m)');
assert.equal(performanceCurve.getCell('D35').value, 'System Curve (m)');
assert.equal(performanceCurve.getCell('E35').value, 'Operating Point (m)');
assert.equal(performanceCurve.getCell('B38').value, 9.528);
assert.equal(performanceCurve.getCell('E38').value, 50);

const live = workbook.getWorksheet('Live Formula Model');
assert.equal(live.getCell('C16').value.formula, 'C5*100000/(C6*C7)');
assert.equal(live.getCell('C17').value.formula, 'C8*100000/(C6*C7)');
assert.equal(live.getCell('C18').value.formula, 'C16+C9+C10-C11-C12-C17');
assert.equal(live.getCell('C21').value.formula, 'MAX(C13*C15,C13+C14)');
assert.equal(live.getCell('C22').value.formula, 'C18-C21');
assert.equal(live.getCell('C23').value.formula, 'IF(C18<=C13,"Cavitation Risk",IF(C22<0,"Warning","Safe"))');

const pipe = workbook.getWorksheet('Pipe Segments');
assert.equal(pipe.getCell('L5').value.formula, 'IF(K5>0,K5,I5*J5)');
assert.equal(pipe.getCell('U5').value.formula, '(R5+S5)*(1+T5/100)');

const pumpTrace = workbook.getWorksheet('Pump NPSH Trace');
assert.equal(pumpTrace.getCell('C10').value, 'Safe');

workbook.xlsx.writeBuffer().then(buffer => {
  assert.ok(buffer.byteLength > 10000, 'Generated workbook buffer is unexpectedly small.');
  console.log('Scenario Excel export validation passed.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
