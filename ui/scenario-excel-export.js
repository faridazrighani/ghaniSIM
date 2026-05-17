// Excel scenario export for the active canvas calculation trace.
// ExcelJS is lazy-loaded on demand to keep initial application loading light.

let scenarioExcelJsLoadPromise = null;

function showScenarioExportToast(message, options = {}) {
    if (!message || typeof document === 'undefined') return null;

    if (typeof showUiToast === 'function') {
        return showUiToast(message, options);
    }

    let region = document.getElementById('uiToastRegion');
    if (!region) {
        region = document.createElement('div');
        region.id = 'uiToastRegion';
        region.className = 'ui-toast-region';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-atomic', 'false');
        document.body.appendChild(region);
    }

    const toast = document.createElement('div');
    const variant = options.variant || 'info';
    const duration = Number.isFinite(options.duration) ? options.duration : 4200;
    toast.className = `ui-toast ui-toast-${variant}`;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');

    const body = document.createElement('div');
    body.className = 'ui-toast-body';

    if (options.title) {
        const title = document.createElement('strong');
        title.textContent = options.title;
        body.appendChild(title);
    }

    const text = document.createElement('span');
    text.textContent = message;
    body.appendChild(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ui-toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = 'X';

    const dismiss = () => {
        toast.classList.add('ui-toast-exit');
        window.setTimeout(() => toast.remove(), 160);
    };

    close.addEventListener('click', dismiss);
    toast.append(body, close);
    region.appendChild(toast);

    if (duration > 0) {
        window.setTimeout(dismiss, duration);
    }

    return toast;
}

function toScenarioExportNumber(value, fallback = null) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function roundScenarioExportNumber(value, digits = 3) {
    const number = toScenarioExportNumber(value, null);
    if (!Number.isFinite(number)) return null;
    return Number(number.toFixed(digits));
}

function scenarioExportText(value, fallback = '-') {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
}

function uniqueScenarioValues(values) {
    return [...new Set((values || []).filter(value => value !== null && value !== undefined && value !== '' && value !== '-'))];
}

function getScenarioLocalDateString(date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sanitizeScenarioFilenamePart(value) {
    return scenarioExportText(value, '')
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'Canvas';
}

function buildScenarioExportFileName(data) {
    const primary = data.primary || {};
    const routeParts = uniqueScenarioValues([
        primary.sourceId,
        primary.pumpId,
        primary.sinkId
    ]).map(sanitizeScenarioFilenamePart);
    const route = routeParts.length ? routeParts.join('_') : 'Canvas';
    return `Untirta_Ghani_Calc_NPSH_Scenario_${route}_${getScenarioLocalDateString()}.xlsx`;
}

function loadScenarioExcelJs() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (scenarioExcelJsLoadPromise) return scenarioExcelJsLoadPromise;

    scenarioExcelJsLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-scenario-exceljs="true"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.ExcelJS), { once: true });
            existing.addEventListener('error', () => reject(new Error('Excel export library failed to load.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = 'vendor/exceljs.min.js';
        script.async = true;
        script.dataset.scenarioExceljs = 'true';
        script.addEventListener('load', () => {
            if (window.ExcelJS) {
                resolve(window.ExcelJS);
            } else {
                reject(new Error('Excel export library loaded but ExcelJS was not available.'));
            }
        }, { once: true });
        script.addEventListener('error', () => reject(new Error('Excel export library failed to load.')), { once: true });
        document.head.appendChild(script);
    });

    return scenarioExcelJsLoadPromise;
}

function getScenarioPumpContext(pumpId) {
    const stored = typeof window !== 'undefined' ? window.hydraulicNetworkState?.pumps?.[pumpId] : null;
    if (stored) return stored;

    const pump = globalModel?.[pumpId];
    const fluid = globalModel?.FLUID;
    if (!pump || !fluid?.props || typeof createPumpHydraulicContext !== 'function') return null;

    const density = Math.max(toScenarioExportNumber(fluid.props.density, 1000), 1);
    const vaporPressurePa = toScenarioExportNumber(fluid.props.vaporPressure, 0) * 100000;
    const context = createPumpHydraulicContext(pumpId, globalModel, connections, density, vaporPressurePa);
    return context ? { suctionPath: context.suctionPath, dischargePath: context.dischargePath, context } : null;
}

function getScenarioPrimaryPumpId() {
    const pumpIds = Object.keys(globalModel || {}).filter(id => globalModel[id]?.type === 'pump');
    return pumpIds.find(id => globalModel[id]?.results?.npshEvaluation?.calculationTrace) || pumpIds[0] || '';
}

function getScenarioTraceForPump(pumpId) {
    const pump = globalModel?.[pumpId];
    if (!pump || pump.type !== 'pump') return null;
    if (pump.results?.npshEvaluation?.calculationTrace) return pump.results.npshEvaluation.calculationTrace;

    if (typeof runPumpNpshEvaluation === 'function') {
        const result = runPumpNpshEvaluation(pumpId, globalModel, connections);
        return result?.calculationTrace || null;
    }
    return null;
}

function getScenarioPathText(path, terminalId = '') {
    const steps = path?.steps || [];
    if (!steps.length) return terminalId || '-';
    return steps.map(step => `${step.from} -> ${step.pipeId} -> ${step.to}`).join(' | ');
}

function collectScenarioWarnings(pumpContexts = []) {
    const rows = [];
    Object.keys(globalModel || {}).forEach(id => {
        const node = globalModel[id];
        const warnings = node?.results?.warnings || [];
        warnings.forEach(warning => {
            if (warning) rows.push({ objectId: id, type: node.type, warning });
        });
    });

    pumpContexts.forEach(item => {
        const warnings = item.context?.networkWarnings || item.state?.context?.networkWarnings || [];
        warnings.forEach(warning => {
            if (warning) rows.push({ objectId: item.pumpId, type: 'network', warning });
        });
    });

    const seen = new Set();
    return rows.filter(row => {
        const key = `${row.objectId}|${row.type}|${row.warning}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildScenarioPipeRoleMap(pumpContexts = []) {
    const roleMap = {};
    pumpContexts.forEach(item => {
        (item.state?.suctionPath?.steps || item.context?.suctionPath?.steps || []).forEach(step => {
            if (!step.pipeId) return;
            roleMap[step.pipeId] = roleMap[step.pipeId] ? `${roleMap[step.pipeId]}, suction path` : 'suction path';
        });
        (item.state?.dischargePath?.steps || item.context?.dischargePath?.steps || []).forEach(step => {
            if (!step.pipeId) return;
            roleMap[step.pipeId] = roleMap[step.pipeId] ? `${roleMap[step.pipeId]}, discharge path` : 'discharge path';
        });
    });
    return roleMap;
}

function collectScenarioExportData() {
    if (typeof updateSimulation === 'function') updateSimulation({ renderSidebarAfter: false });
    if (typeof drawConnections === 'function') drawConnections();

    const pumpIds = Object.keys(globalModel || {}).filter(id => globalModel[id]?.type === 'pump');
    const sourceIds = Object.keys(globalModel || {}).filter(id => globalModel[id]?.type === 'source');
    const sinkIds = Object.keys(globalModel || {}).filter(id => globalModel[id]?.type === 'sink');
    const pipeIds = Object.keys(globalModel || {}).filter(id => globalModel[id]?.type === 'pipe');
    const pumpContexts = pumpIds.map(pumpId => {
        const state = getScenarioPumpContext(pumpId);
        return {
            pumpId,
            state,
            context: state?.context || null
        };
    });
    const primaryPumpId = getScenarioPrimaryPumpId();
    const primaryPump = globalModel?.[primaryPumpId] || null;
    const primaryState = pumpContexts.find(item => item.pumpId === primaryPumpId)?.state || null;
    const primaryTrace = primaryPumpId ? getScenarioTraceForPump(primaryPumpId) : null;
    const primarySourceId = primaryTrace?.boundary?.id
        || primaryState?.suctionPath?.boundaryId
        || sourceIds[0]
        || '';
    const primarySinkId = primaryPump?.results?.downstreamBoundary
        || primaryState?.dischargePath?.boundaryId
        || sinkIds[0]
        || '';

    return {
        generatedAt: new Date(),
        model: globalModel,
        settings: globalModel.SETTINGS?.props || {},
        fluid: globalModel.FLUID?.props || {},
        pumpIds,
        sourceIds,
        sinkIds,
        pipeIds,
        pumpContexts,
        pipeRoleMap: buildScenarioPipeRoleMap(pumpContexts),
        warnings: collectScenarioWarnings(pumpContexts),
        primary: {
            pumpId: primaryPumpId,
            sourceId: primarySourceId,
            sinkId: primarySinkId,
            pump: primaryPump,
            state: primaryState,
            trace: primaryTrace
        }
    };
}

function scenarioArgb(hex) {
    return `FF${String(hex || '#FFFFFF').replace('#', '').toUpperCase()}`;
}

function scenarioFill(hex) {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: scenarioArgb(hex) } };
}

const SCENARIO_XLSX_COLORS = {
    navy: '#123B5A',
    blue: '#1F5F8B',
    pale: '#EAF4FB',
    input: '#FFF7D6',
    calc: '#F6F8FB',
    safe: '#DDF7E8',
    warning: '#FFF0D5',
    risk: '#FCE0DE',
    border: '#BFD7EA',
    text: '#0B2F4A'
};

function styleScenarioWorksheet(sheet, widths = []) {
    sheet.views = [{ showGridLines: false, state: 'frozen', ySplit: 3 }];
    sheet.properties.defaultRowHeight = 18;
    sheet.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
            left: 0.25,
            right: 0.25,
            top: 0.45,
            bottom: 0.45,
            header: 0.2,
            footer: 0.2
        }
    };
    sheet.getColumn(1).width = 3;
    widths.forEach((width, index) => {
        sheet.getColumn(index + 2).width = width;
    });
    sheet.eachRow(row => {
        row.eachCell(cell => {
            cell.font = { name: 'Aptos', size: 10, color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.text) } };
            cell.alignment = { vertical: 'top', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.border) } },
                left: { style: 'thin', color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.border) } },
                bottom: { style: 'thin', color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.border) } },
                right: { style: 'thin', color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.border) } }
            };
        });
    });
}

function addScenarioTitle(sheet, title, subtitle = '', colCount = 8) {
    sheet.mergeCells(1, 1, 1, colCount);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.fill = scenarioFill(SCENARIO_XLSX_COLORS.navy);
    titleCell.font = { name: 'Aptos Display', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle' };
    sheet.getRow(1).height = 24;

    sheet.mergeCells(2, 1, 2, colCount);
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = subtitle;
    subtitleCell.fill = scenarioFill(SCENARIO_XLSX_COLORS.pale);
    subtitleCell.font = { name: 'Aptos', size: 10, italic: true, color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.text) } };
    subtitleCell.alignment = { wrapText: true, vertical: 'top' };
    sheet.getRow(2).height = 28;
}

function styleScenarioHeaderRow(row) {
    row.eachCell(cell => {
        cell.fill = scenarioFill(SCENARIO_XLSX_COLORS.blue);
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
    });
}

function addScenarioSection(sheet, rowNumber, label, colCount = 8) {
    sheet.mergeCells(rowNumber, 1, rowNumber, colCount);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = label;
    cell.fill = scenarioFill(SCENARIO_XLSX_COLORS.navy);
    cell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
}

function setScenarioStatusStyle(cell, status) {
    const text = scenarioExportText(status, '').toLowerCase();
    if (text.includes('risk') || text.includes('cavitation')) {
        cell.fill = scenarioFill(SCENARIO_XLSX_COLORS.risk);
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
    } else if (text.includes('warning') || text.includes('review') || text.includes('outside')) {
        cell.fill = scenarioFill(SCENARIO_XLSX_COLORS.warning);
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFB45309' } };
    } else if (text.includes('safe') || text.includes('ok') || text.includes('por')) {
        cell.fill = scenarioFill(SCENARIO_XLSX_COLORS.safe);
        cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FF047857' } };
    }
}

function addScenarioKeyValueRows(sheet, startRow, rows) {
    rows.forEach((row, index) => {
        const excelRow = sheet.getRow(startRow + index);
        excelRow.values = [null, row[0], row[1], row[2] || '', row[3] || ''];
        excelRow.getCell(2).fill = scenarioFill(SCENARIO_XLSX_COLORS.calc);
        excelRow.getCell(3).fill = row[4] === 'input' ? scenarioFill(SCENARIO_XLSX_COLORS.input) : scenarioFill(SCENARIO_XLSX_COLORS.calc);
        excelRow.getCell(4).fill = scenarioFill(SCENARIO_XLSX_COLORS.calc);
        excelRow.getCell(5).fill = scenarioFill(SCENARIO_XLSX_COLORS.calc);
    });
}

function addScenarioSummarySheet(workbook, data) {
    const sheet = workbook.addWorksheet('Scenario Summary');
    addScenarioTitle(sheet, 'UNTIRTA GhaniSIM NPSH Scenario Export', 'Canvas scenario summary, hydraulic route, live NPSH output, warnings, and thesis demonstration context.');

    const primaryPump = data.primary.pump || {};
    const pumpResults = primaryPump.results || {};
    const trace = data.primary.trace || {};
    addScenarioSection(sheet, 4, 'Primary Scenario');
    addScenarioKeyValueRows(sheet, 5, [
        ['Generated at', data.generatedAt.toLocaleString(), '', 'Export is generated from the current browser canvas state.'],
        ['Unit standard', data.settings.unitStandard || 'Metric / European Engineering', '', 'Display unit basis used by the application.'],
        ['Fluid basis', `${data.fluid.fluidName || '-'} @ ${roundScenarioExportNumber(data.fluid.temp, 3) ?? '-'} deg C`, '', 'Active fluid used for density, viscosity, and vapor pressure.'],
        ['Route', trace?.path?.text || getScenarioPathText(data.primary.state?.suctionPath, data.primary.pumpId), '', 'Main source-to-pump route.'],
        ['Primary source', data.primary.sourceId || '-', '', 'Upstream boundary for pump suction.'],
        ['Primary pump', data.primary.pumpId || '-', '', 'Pump selected for primary NPSH report.'],
        ['Primary sink', data.primary.sinkId || '-', '', 'Downstream Fluid Out boundary.']
    ]);

    addScenarioSection(sheet, 13, 'Primary Pump NPSH Output');
    const outputRows = [
        ['Flow evaluated', pumpResults.flow, 'm3/h', 'Solved or demanded operating flow.'],
        ['Pump head', pumpResults.head, 'm', 'Head at current operating point.'],
        ['NPSHa', pumpResults.npsha, 'm', 'Available NPSH at pump suction.'],
        ['NPSHr', pumpResults.npshr, 'm', 'Required NPSH from manual input, estimate, or pump curve.'],
        ['NPSH margin', pumpResults.npshMargin, 'm', 'NPSHa - NPSHr.'],
        ['NPSH ratio', pumpResults.npshRatio, '-', 'NPSHa / NPSHr.'],
        ['Required NPSHa', pumpResults.requiredNpsha, 'm', 'max(NPSHr x ratio, NPSHr + absolute margin).'],
        ['NPSH excess', pumpResults.npshExcess, 'm', 'NPSHa - Required NPSHa.'],
        ['Margin basis', pumpResults.npshMarginBasis || '-', '', 'Selected user or ANSI/HI-guided NPSH margin basis.'],
        ['Cavitation status', pumpResults.cavitationStatus || '-', '', 'Risk state from NPSHa versus NPSHr.'],
        ['Pump operating region', pumpResults.operatingRegion || '-', '', 'POR/AOR check.'],
        ['Dominant suction loss', pumpResults.dominantSuctionLoss || '-', '', 'Largest suction loss contributor.'],
        ['Solve mode', pumpResults.solveMode || '-', '', 'How the hydraulic operating point was selected.']
    ];
    addScenarioKeyValueRows(sheet, 14, outputRows);
    setScenarioStatusStyle(sheet.getCell('C23'), pumpResults.cavitationStatus);

    addScenarioSection(sheet, 30, 'All Pump Status Summary');
    const header = sheet.getRow(31);
    header.values = [null, 'Pump', 'Flow (m3/h)', 'Head (m)', 'NPSHa (m)', 'NPSHr (m)', 'Margin (m)', 'Status'];
    styleScenarioHeaderRow(header);
    data.pumpIds.forEach((pumpId, index) => {
        const pump = data.model[pumpId];
        const results = pump?.results || {};
        const row = sheet.getRow(32 + index);
        row.values = [null, pumpId, results.flow, results.head, results.npsha, results.npshr, results.npshMargin, results.cavitationStatus || results.status || '-'];
        setScenarioStatusStyle(row.getCell(8), row.getCell(8).value);
    });

    styleScenarioWorksheet(sheet, [22, 22, 14, 46, 18, 18, 18, 20]);
    sheet.getColumn(3).numFmt = '0.000';
    return sheet;
}

function getScenarioCurvePoint(point) {
    if (Array.isArray(point)) {
        return {
            flow: toScenarioExportNumber(point[0], null),
            head: toScenarioExportNumber(point[1], null)
        };
    }
    return {
        flow: toScenarioExportNumber(point?.x ?? point?.flow, null),
        head: toScenarioExportNumber(point?.y ?? point?.head, null)
    };
}

function setScenarioCurveRowValue(map, flow, key, value) {
    if (!Number.isFinite(flow)) return;
    const mapKey = flow.toFixed(6);
    const row = map.get(mapKey) || { flow };
    if (Number.isFinite(value)) row[key] = value;
    map.set(mapKey, row);
}

function getScenarioPumpCurveRows(data) {
    const pump = data.primary.pump || {};
    const results = pump.results || {};
    const rowsByFlow = new Map();

    (results.pumpCurve || []).forEach(point => {
        const parsed = getScenarioCurvePoint(point);
        setScenarioCurveRowValue(rowsByFlow, parsed.flow, 'pumpHead', parsed.head);
    });

    (results.sysCurve || []).forEach(point => {
        const parsed = getScenarioCurvePoint(point);
        setScenarioCurveRowValue(rowsByFlow, parsed.flow, 'systemHead', parsed.head);
    });

    const operatingFlow = toScenarioExportNumber(results.flow, null);
    const operatingHead = toScenarioExportNumber(results.head, null);
    if (Number.isFinite(operatingFlow)) {
        setScenarioCurveRowValue(rowsByFlow, operatingFlow, 'operatingHead', operatingHead);
        setScenarioCurveRowValue(rowsByFlow, operatingFlow, 'pumpHead', operatingHead);
        const requiredHead = toScenarioExportNumber(results.requiredSystemHead, null);
        setScenarioCurveRowValue(rowsByFlow, operatingFlow, 'systemHead', Number.isFinite(requiredHead) ? requiredHead : operatingHead);
    }

    const performanceModel = typeof createPumpPerformanceModel === 'function'
        ? createPumpPerformanceModel(pump)
        : null;
    const npshrAtOperatingPoint = toScenarioExportNumber(results.npshr, null);
    return [...rowsByFlow.values()]
        .sort((a, b) => a.flow - b.flow)
        .map(row => {
            const npshr = performanceModel?.getNpshr
                ? toScenarioExportNumber(performanceModel.getNpshr(row.flow), null)
                : (Math.abs(row.flow - operatingFlow) < 1e-6 ? npshrAtOperatingPoint : null);
            return {
                ...row,
                npshr
            };
        });
}

function getScenarioCurveAxisBounds(curveRows = []) {
    const xValues = curveRows.map(row => row.flow).filter(Number.isFinite);
    const yValues = curveRows
        .flatMap(row => [row.pumpHead, row.systemHead, row.operatingHead, row.npshr])
        .filter(Number.isFinite);

    if (!xValues.length || !yValues.length) {
        return {
            xMin: 0,
            xMax: 10,
            yMin: 0,
            yMax: 10
        };
    }

    const xMaxRaw = Math.max(...xValues, 1);
    const yMinRaw = Math.min(...yValues, 0);
    const yMaxRaw = Math.max(...yValues, 1);
    const ySpan = Math.max(yMaxRaw - yMinRaw, Math.abs(yMaxRaw), 1);
    return {
        xMin: 0,
        xMax: xMaxRaw + Math.max(xMaxRaw * 0.06, 1),
        yMin: yMinRaw >= 0 ? 0 : yMinRaw - ySpan * 0.08,
        yMax: yMaxRaw + ySpan * 0.1
    };
}

function createScenarioPumpCurveChartImage(data, curveRows) {
    if (typeof document === 'undefined' || !document.createElement || !curveRows.length) return null;
    const canvas = document.createElement('canvas');
    if (!canvas || typeof canvas.getContext !== 'function') return null;

    canvas.width = 1120;
    canvas.height = 620;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const pump = data.primary.pump || {};
    const results = pump.results || {};
    const bounds = getScenarioCurveAxisBounds(curveRows);
    const plot = { left: 92, top: 86, right: 1060, bottom: 520 };
    plot.width = plot.right - plot.left;
    plot.height = plot.bottom - plot.top;
    const xScale = value => plot.left + ((value - bounds.xMin) / (bounds.xMax - bounds.xMin)) * plot.width;
    const yScale = value => plot.bottom - ((value - bounds.yMin) / (bounds.yMax - bounds.yMin)) * plot.height;
    const flowUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('flow') : 'm3/h';
    const headUnit = typeof getDisplayUnit === 'function' ? getDisplayUnit('head') : 'm';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0B2F4A';
    ctx.font = '700 24px Aptos, Arial, sans-serif';
    ctx.fillText(`Pump Performance Curve - ${data.primary.pumpId || 'Pump'}`, 52, 44);
    ctx.font = '14px Aptos, Arial, sans-serif';
    ctx.fillStyle = '#526B7F';
    ctx.fillText(`Operating point: Q = ${scenarioExportText(results.flow, '-')} m3/h, H = ${scenarioExportText(results.head, '-')} m`, 52, 68);

    ctx.strokeStyle = '#D8E5EE';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#526B7F';
    ctx.font = '12px Aptos, Arial, sans-serif';
    for (let i = 0; i <= 5; i += 1) {
        const xValue = bounds.xMin + ((bounds.xMax - bounds.xMin) * i) / 5;
        const x = xScale(xValue);
        ctx.beginPath();
        ctx.moveTo(x, plot.top);
        ctx.lineTo(x, plot.bottom);
        ctx.stroke();
        ctx.fillText(roundScenarioExportNumber(xValue, 1), x - 12, plot.bottom + 22);

        const yValue = bounds.yMin + ((bounds.yMax - bounds.yMin) * i) / 5;
        const y = yScale(yValue);
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.stroke();
        ctx.fillText(roundScenarioExportNumber(yValue, 1), 42, y + 4);
    }

    ctx.strokeStyle = '#6D8494';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.bottom);
    ctx.lineTo(plot.right, plot.bottom);
    ctx.stroke();

    ctx.save();
    ctx.translate(20, plot.top + plot.height / 2 + 60);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#0B2F4A';
    ctx.font = '700 14px Aptos, Arial, sans-serif';
    ctx.fillText(`Head (${headUnit})`, 0, 0);
    ctx.restore();
    ctx.fillText(`Flow Rate (${flowUnit})`, plot.left + plot.width / 2 - 60, 585);

    const drawSeries = (points, color, dashed = false) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash(dashed ? [10, 7] : []);
        let started = false;
        points.forEach(point => {
            if (!Number.isFinite(point.flow) || !Number.isFinite(point.head)) {
                started = false;
                return;
            }
            const x = xScale(point.flow);
            const y = yScale(point.head);
            if (!started) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        });
        if (started) ctx.stroke();
        ctx.restore();

        ctx.fillStyle = color;
        points.forEach(point => {
            if (!Number.isFinite(point.flow) || !Number.isFinite(point.head)) return;
            const x = xScale(point.flow);
            const y = yScale(point.head);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    };

    drawSeries(curveRows.map(row => ({ flow: row.flow, head: row.pumpHead })), '#123B5A', false);
    drawSeries(curveRows.map(row => ({ flow: row.flow, head: row.systemHead })), '#EF3D4A', true);

    const operatingFlow = toScenarioExportNumber(results.flow, null);
    const operatingHead = toScenarioExportNumber(results.head, null);
    if (Number.isFinite(operatingFlow) && Number.isFinite(operatingHead)) {
        const x = xScale(operatingFlow);
        const y = yScale(operatingHead);
        ctx.fillStyle = '#12A56B';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0B2F4A';
        ctx.font = '700 12px Aptos, Arial, sans-serif';
        ctx.fillText('Operating Point', x + 12, y - 10);
    }

    const legendY = 545;
    ctx.font = '700 13px Aptos, Arial, sans-serif';
    ctx.fillStyle = '#123B5A';
    ctx.fillRect(360, legendY - 10, 28, 5);
    ctx.fillText('Pump Head', 396, legendY);
    ctx.strokeStyle = '#EF3D4A';
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(500, legendY - 8);
    ctx.lineTo(528, legendY - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#EF3D4A';
    ctx.fillText('System Curve', 536, legendY);
    ctx.fillStyle = '#12A56B';
    ctx.beginPath();
    ctx.arc(654, legendY - 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0B2F4A';
    ctx.fillText('Operating Point', 668, legendY);

    return canvas.toDataURL('image/png');
}

function addScenarioPumpPerformanceCurveSheet(workbook, data) {
    const sheet = workbook.addWorksheet('Pump Performance Curve');
    addScenarioTitle(
        sheet,
        'Pump Performance Curve',
        'Pump head curve, system curve, operating point, and exported curve data for scenario review.',
        12
    );

    const pump = data.primary.pump || {};
    const results = pump.results || {};
    const curveRows = getScenarioPumpCurveRows(data);

    addScenarioSection(sheet, 4, 'Chart Preview', 12);
    for (let row = 5; row <= 24; row += 1) {
        sheet.getRow(row).height = 23;
    }
    const chartImage = createScenarioPumpCurveChartImage(data, curveRows);
    if (chartImage && typeof workbook.addImage === 'function' && typeof sheet.addImage === 'function') {
        const imageId = workbook.addImage({ base64: chartImage, extension: 'png' });
        sheet.addImage(imageId, {
            tl: { col: 1, row: 4 },
            ext: { width: 900, height: 500 }
        });
    } else {
        sheet.mergeCells('B5:L24');
        const placeholder = sheet.getCell('B5');
        placeholder.value = 'Chart image will be generated during browser export. The curve data table below remains available for audit.';
        placeholder.fill = scenarioFill(SCENARIO_XLSX_COLORS.pale);
        placeholder.font = { name: 'Aptos', size: 12, italic: true, color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.text) } };
        placeholder.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }

    addScenarioSection(sheet, 26, 'Operating Point and Curve Basis', 12);
    addScenarioKeyValueRows(sheet, 27, [
        ['Primary pump', data.primary.pumpId || '-', '', 'Pump object used for the exported performance curve.'],
        ['Flow evaluated', results.flow, 'm3/h', 'Current operating flow.'],
        ['Pump head', results.head, 'm', 'Pump head at current operating point.'],
        ['Required/system head', results.requiredSystemHead ?? results.head, 'm', 'System head readout at the operating point.'],
        ['NPSHa / NPSHr', `${scenarioExportText(results.npsha)} / ${scenarioExportText(results.npshr)}`, 'm', 'NPSH acceptance context at the operating point.'],
        ['Curve source', results.curveSource || results.npshrSource || '-', '', 'Basic estimated curve or manufacturer/test curve source.']
    ]);

    const tableRow = 35;
    sheet.getRow(tableRow).values = [null, 'Flow (m3/h)', 'Pump Head (m)', 'System Curve (m)', 'Operating Point (m)', 'NPSHr (m)', 'Notes'];
    styleScenarioHeaderRow(sheet.getRow(tableRow));
    if (!curveRows.length) {
        sheet.getRow(tableRow + 1).values = [null, '-', '-', '-', '-', '-', 'No curve points are available. Run Solve, then export again.'];
    } else {
        curveRows.forEach((entry, index) => {
            const isOperatingPoint = Number.isFinite(entry.operatingHead);
            const row = sheet.getRow(tableRow + 1 + index);
            row.values = [
                null,
                roundScenarioExportNumber(entry.flow, 6),
                roundScenarioExportNumber(entry.pumpHead, 6),
                roundScenarioExportNumber(entry.systemHead, 6),
                roundScenarioExportNumber(entry.operatingHead, 6),
                roundScenarioExportNumber(entry.npshr, 6),
                isOperatingPoint ? 'Current operating point' : ''
            ];
            if (isOperatingPoint) {
                row.eachCell(cell => {
                    cell.fill = scenarioFill(SCENARIO_XLSX_COLORS.safe);
                    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.text) } };
                });
            }
        });
    }

    sheet.autoFilter = {
        from: { row: tableRow, column: 2 },
        to: { row: tableRow, column: 7 }
    };
    styleScenarioWorksheet(sheet, [20, 18, 18, 20, 16, 44, 12, 12, 12, 12, 12, 12]);
    [2, 3, 4, 5, 6].forEach(columnNumber => {
        sheet.getColumn(columnNumber).numFmt = '0.000';
    });
    return sheet;
}

function addScenarioLiveFormulaSheet(workbook, data) {
    const sheet = workbook.addWorksheet('Live Formula Model');
    addScenarioTitle(sheet, 'Live Excel Formula Model', 'Key NPSH equations exported as editable Excel formulas for the primary pump scenario.');

    const trace = data.primary.trace || {};
    const pump = data.primary.pump || {};
    const pumpResults = pump.results || {};
    const basis = trace.basis || {};
    const boundary = trace.boundary || {};
    const losses = trace.losses || {};
    const pumpTrace = trace.pump || {};
    const density = roundScenarioExportNumber(basis.density ?? data.fluid.density, 6) ?? 1000;
    const gravity = roundScenarioExportNumber(basis.gravity, 6) ?? 9.81;
    const psrc = roundScenarioExportNumber(boundary.absolutePressureBar, 6) ?? 0;
    const pv = roundScenarioExportNumber(basis.vaporPressureBarA ?? data.fluid.vaporPressure, 6) ?? 0;
    const zSource = roundScenarioExportNumber(boundary.elevation, 6) ?? 0;
    const hVelocity = roundScenarioExportNumber(boundary.velocityHead, 6) ?? 0;
    const zPump = roundScenarioExportNumber(pumpTrace.elevation ?? pump.props?.elevation, 6) ?? 0;
    const hLoss = roundScenarioExportNumber(losses.total ?? pumpResults.suctionLoss, 6) ?? 0;
    const npshr = roundScenarioExportNumber(pumpResults.npshr ?? pumpTrace.npshr, 6) ?? 0;
    const interpretation = trace.interpretation || {};
    const minMargin = roundScenarioExportNumber(
        interpretation.absoluteMarginLimit ?? pumpResults.marginCriteria?.margin ?? pump.props?.minNpshMargin,
        6
    ) ?? 0;
    const minRatio = roundScenarioExportNumber(
        interpretation.marginRatioLimit ?? pumpResults.marginCriteria?.ratio ?? pump.props?.minNpshMarginRatio,
        6
    ) ?? 0;

    sheet.getRow(4).values = [null, 'Input / calculation', 'Value', 'Unit', 'Formula / source'];
    styleScenarioHeaderRow(sheet.getRow(4));
    const rows = [
        ['Source pressure abs', psrc, 'bar a', 'From SRC boundary pressure basis'],
        ['Density', density, 'kg/m3', 'Active Fluid Basis'],
        ['Gravity', gravity, 'm/s2', 'Workbook constant / application basis'],
        ['Vapor pressure abs', pv, 'bar a', 'Active Fluid Basis vapor pressure'],
        ['Source elevation zSRC', zSource, 'm', 'SRC boundary elevation or inherited liquid level'],
        ['Source velocity head', hVelocity, 'm', 'External-header static tie-in only; otherwise 0'],
        ['Pump suction elevation', zPump, 'm', 'Pump suction nozzle/datum elevation'],
        ['Suction line loss', hLoss, 'm', 'Sum of suction pipe/equipment losses'],
        ['NPSHr', npshr, 'm', pumpResults.npshrSource || pumpTrace.npshrSource || 'Pump required NPSH'],
        ['Minimum NPSH margin', minMargin, 'm', 'Selected user/standard absolute margin limit'],
        ['Minimum NPSH ratio', minRatio, '-', 'Selected user/standard margin ratio limit'],
        ['Source pressure head', { formula: 'C5*100000/(C6*C7)', result: psrc * 100000 / (density * gravity) }, 'm', 'Hp = Psrc x 100000 / (rho x g)'],
        ['Vapor pressure head', { formula: 'C8*100000/(C6*C7)', result: pv * 100000 / (density * gravity) }, 'm', 'Hv = Pv x 100000 / (rho x g)'],
        ['NPSHa', { formula: 'C16+C9+C10-C11-C12-C17', result: toScenarioExportNumber(pumpResults.npsha, null) }, 'm', 'NPSHa = Hp + zSRC + Hvel - zPump - hLs - Hv'],
        ['NPSH margin', { formula: 'C18-C13', result: toScenarioExportNumber(pumpResults.npshMargin, null) }, 'm', 'Margin = NPSHa - NPSHr'],
        ['NPSH ratio', { formula: 'IF(C13<=0,"",C18/C13)', result: toScenarioExportNumber(pumpResults.npshRatio, null) }, '-', 'Ratio = NPSHa / NPSHr'],
        ['Required NPSHa', { formula: 'MAX(C13*C15,C13+C14)', result: toScenarioExportNumber(pumpResults.requiredNpsha ?? interpretation.requiredNpsha, null) }, 'm', 'Required NPSHa = max(NPSHr x ratio, NPSHr + absolute margin)'],
        ['NPSH excess', { formula: 'C18-C21', result: toScenarioExportNumber(pumpResults.npshExcess ?? interpretation.npshExcess, null) }, 'm', 'Excess = NPSHa - Required NPSHa'],
        ['NPSH status', { formula: 'IF(C18<=C13,"Cavitation Risk",IF(C22<0,"Warning","Safe"))', result: pumpResults.cavitationStatus || '-' }, '', 'Risk if NPSHa <= NPSHr; Warning if required NPSHa is not met']
    ];
    rows.forEach((row, index) => {
        const target = sheet.getRow(5 + index);
        target.values = [null, row[0], row[1], row[2], row[3]];
        target.getCell(3).fill = index < 11 ? scenarioFill(SCENARIO_XLSX_COLORS.input) : scenarioFill(SCENARIO_XLSX_COLORS.calc);
        if (index >= 11) target.getCell(3).font = { name: 'Aptos', size: 10, bold: true, color: { argb: scenarioArgb(SCENARIO_XLSX_COLORS.text) } };
    });
    setScenarioStatusStyle(sheet.getCell('C23'), pumpResults.cavitationStatus);
    sheet.getColumn(3).numFmt = '0.000';
    styleScenarioWorksheet(sheet, [28, 20, 12, 62, 18, 18, 18, 18]);
    return sheet;
}

function addScenarioRouteTraceSheet(workbook, data) {
    const sheet = workbook.addWorksheet('Route Trace');
    addScenarioTitle(sheet, 'Hydraulic Route Trace', 'Solid hydraulic route used by the active pump scenario. Dashed SRC attachments are not counted as hydraulic loss.');
    sheet.getRow(4).values = [null, 'Side', 'From', 'Pipe / object', 'To', 'Pipe flow (m3/h)', 'Pipe loss (m)', 'Notes'];
    styleScenarioHeaderRow(sheet.getRow(4));
    let rowIndex = 5;
    data.pumpContexts.forEach(item => {
        const suctionSteps = item.state?.suctionPath?.steps || item.context?.suctionPath?.steps || [];
        const dischargeSteps = item.state?.dischargePath?.steps || item.context?.dischargePath?.steps || [];
        [
            ['Suction path', suctionSteps],
            ['Discharge path', dischargeSteps]
        ].forEach(([side, steps]) => {
            if (!steps.length) {
                const row = sheet.getRow(rowIndex++);
                row.values = [null, side, '-', '-', '-', '', '', `No ${side.toLowerCase()} route found for ${item.pumpId}.`];
                return;
            }
            steps.forEach(step => {
                const pipe = data.model[step.pipeId];
                const row = sheet.getRow(rowIndex++);
                row.values = [
                    null,
                    side,
                    step.from,
                    step.pipeId,
                    step.to,
                    pipe?.results?.flow ?? '',
                    pipe?.results?.pressureCalculated && typeof calculatePipeHeadLoss === 'function'
                        ? roundScenarioExportNumber(calculatePipeHeadLoss(toScenarioExportNumber(pipe.results.flow, 0), pipe.props, null, step.pipeId), 6)
                        : '',
                    `${item.pumpId}; ${side === 'Suction path' ? 'loss subtracts from NPSHa' : 'loss affects discharge/system head'}`
                ];
            });
        });
    });
    styleScenarioWorksheet(sheet, [18, 18, 18, 20, 18, 18, 18, 58]);
    return sheet;
}

function addScenarioPumpTraceSheet(workbook, data) {
    const sheet = workbook.addWorksheet('Pump NPSH Trace');
    addScenarioTitle(sheet, 'Pump NPSH Calculation Trace', 'Step-by-step NPSHa, NPSHr, margin, and ratio report for the primary pump.');
    const trace = data.primary.trace || {};
    const interpretation = trace.interpretation || {};

    addScenarioSection(sheet, 4, 'Trace Basis');
    addScenarioKeyValueRows(sheet, 5, [
        ['Fluid', trace.basis?.fluidName || data.fluid.fluidName || '-', '', 'Active fluid basis.'],
        ['Density', trace.basis?.density ?? data.fluid.density, 'kg/m3', 'Pressure/head conversion basis.'],
        ['Vapor pressure', trace.basis?.vaporPressureBarA ?? data.fluid.vaporPressure, 'bar a', 'Subtracts from NPSHa.'],
        ['Route', trace.path?.text || '-', '', 'Source to pump suction route.'],
        ['Dominant loss', trace.path?.dominantLoss || '-', '', 'Primary suction loss contributor.'],
        ['Status', interpretation.status || data.primary.pump?.results?.cavitationStatus || '-', '', interpretation.message || '']
    ]);
    setScenarioStatusStyle(sheet.getCell('C10'), interpretation.status);

    addScenarioSection(sheet, 13, 'Equation Steps');
    sheet.getRow(14).values = [null, 'Step', 'Formula', 'Substitution', 'Result', 'Unit', 'Reference', ''];
    styleScenarioHeaderRow(sheet.getRow(14));
    (trace.steps || []).forEach((step, index) => {
        const row = sheet.getRow(15 + index);
        row.values = [null, step.title, step.formula, step.substitution, step.result, step.unit, step.reference, ''];
    });

    const lossStart = 16 + (trace.steps || []).length;
    addScenarioSection(sheet, lossStart, 'Suction Loss Entries');
    sheet.getRow(lossStart + 1).values = [null, 'Object', 'Type', 'Major loss', 'Minor loss', 'Head loss', 'Unit', 'NPSH role'];
    styleScenarioHeaderRow(sheet.getRow(lossStart + 1));
    (trace.losses?.entries || []).forEach((entry, index) => {
        const row = sheet.getRow(lossStart + 2 + index);
        row.values = [
            null,
            entry.objectId || entry.id || '-',
            entry.type || '-',
            entry.majorLoss ?? '',
            entry.minorLoss ?? '',
            entry.headLoss ?? entry.totalLoss ?? '',
            'm',
            'Subtracts from NPSHa when upstream of pump suction'
        ];
    });

    styleScenarioWorksheet(sheet, [24, 32, 48, 60, 16, 12, 48, 12]);
    return sheet;
}

function getScenarioPipeRows(data) {
    const rows = [];
    data.pipeIds.forEach(pipeId => {
        const pipe = data.model[pipeId];
        if (!pipe || pipe.type !== 'pipe') return;
        if (typeof normalizePipeProps === 'function') normalizePipeProps(pipe.props, pipeId);
        const flow = toScenarioExportNumber(pipe.results?.flow, 0) || 0;
        const details = typeof calculatePipeHydraulicSegments === 'function'
            ? calculatePipeHydraulicSegments(flow, pipe.props, null, pipeId)
            : [];
        const detailsByIndex = new Map(details.map(detail => [detail.index, detail]));
        (pipe.props?.segments || []).forEach((segment, index) => {
            const detail = detailsByIndex.get(index) || {};
            const fittingK = typeof getPipeFittingK === 'function' ? getPipeFittingK(segment) : toScenarioExportNumber(segment.fittingK, 0);
            const fittingQuantity = toScenarioExportNumber(segment.fittingQuantity, 0) || 0;
            const additionalK = typeof getPipeAdditionalK === 'function' ? getPipeAdditionalK(segment) : toScenarioExportNumber(segment.minorLoss, 0);
            rows.push({
                pipeId,
                segmentName: segment.name || `${pipeId}-Seg-${index + 1}`,
                role: data.pipeRoleMap[pipeId] || 'not in active pump route',
                flow,
                length: toScenarioExportNumber(segment.length, 0),
                diameterMm: (toScenarioExportNumber(segment.diameter, 0) || 0) * 1000,
                roughnessMm: (toScenarioExportNumber(segment.roughness, 0) || 0) * 1000,
                fittingK,
                fittingQuantity,
                additionalK,
                allowancePercent: toScenarioExportNumber(pipe.props?.headLossAllowancePercent, 0) || 0,
                appTotalLoss: detail.totalLoss ?? '',
                notes: additionalK > 0 ? 'Add_K overrides K_each x Qty in this segment.' : scenarioExportText(segment.fittingType, 'No fitting')
            });
        });
    });
    return rows;
}

function addScenarioPipeSegmentsSheet(workbook, data) {
    const sheet = workbook.addWorksheet('Pipe Segments');
    addScenarioTitle(sheet, 'Pipe Segment Scenario and Loss Calculation', 'All current pipe segments exported with editable Excel loss formulas. Set flow or K values to simulate sensitivity.');
    sheet.getRow(4).values = [
        null, 'Pipe', 'Segment', 'Role', 'Flow_m3h', 'Length_m', 'ID_mm', 'Roughness_mm',
        'K_each', 'Qty', 'Add_K', 'K_total', 'Area_m2', 'Velocity_m_s', 'Reynolds',
        'FrictionFactor', 'VelocityHead_m', 'MajorLoss_m', 'MinorLoss_m', 'Allowance_%',
        'ExcelTotalLoss_m', 'AppTotalLoss_m', 'Notes'
    ];
    styleScenarioHeaderRow(sheet.getRow(4));
    const density = roundScenarioExportNumber(data.fluid.density, 6) ?? 1000;
    const dynamicViscosityCp = roundScenarioExportNumber(data.fluid.dynViscosity ?? data.fluid.viscosity, 6) ?? 1;
    const gravity = 9.81;
    const pipeRows = getScenarioPipeRows(data);

    pipeRows.forEach((entry, index) => {
        const rowNumber = 5 + index;
        const row = sheet.getRow(rowNumber);
        row.values = [
            null,
            entry.pipeId,
            entry.segmentName,
            entry.role,
            entry.flow,
            entry.length,
            entry.diameterMm,
            entry.roughnessMm,
            entry.fittingK,
            entry.fittingQuantity,
            entry.additionalK,
            { formula: `IF(K${rowNumber}>0,K${rowNumber},I${rowNumber}*J${rowNumber})`, result: entry.additionalK > 0 ? entry.additionalK : entry.fittingK * entry.fittingQuantity },
            { formula: `PI()*(G${rowNumber}/1000)^2/4`, result: entry.diameterMm > 0 ? Math.PI * Math.pow(entry.diameterMm / 1000, 2) / 4 : 0 },
            { formula: `IF(M${rowNumber}=0,0,E${rowNumber}/3600/M${rowNumber})`, result: toScenarioExportNumber(entry.flow, 0) / 3600 / (entry.diameterMm > 0 ? Math.PI * Math.pow(entry.diameterMm / 1000, 2) / 4 : 1) },
            { formula: `IF(G${rowNumber}=0,0,${density}*N${rowNumber}*(G${rowNumber}/1000)/(${dynamicViscosityCp}/1000))` },
            { formula: `IF(O${rowNumber}<1,0,IF(O${rowNumber}<2300,64/O${rowNumber},0.25/(LOG10((H${rowNumber}/1000)/(3.7*(G${rowNumber}/1000))+5.74/(O${rowNumber}^0.9)))^2))` },
            { formula: `N${rowNumber}^2/(2*${gravity})` },
            { formula: `IF(G${rowNumber}=0,0,P${rowNumber}*F${rowNumber}/(G${rowNumber}/1000)*Q${rowNumber})` },
            { formula: `L${rowNumber}*Q${rowNumber}` },
            entry.allowancePercent,
            { formula: `(R${rowNumber}+S${rowNumber})*(1+T${rowNumber}/100)` },
            entry.appTotalLoss,
            entry.notes
        ];
    });

    addScenarioSection(sheet, 7 + pipeRows.length, 'Pipe Segment Notes', 8);
    sheet.getRow(8 + pipeRows.length).values = [null, 'Add_K rule', 'When Add_K is greater than zero, K_each is ignored for that segment.', '', '', '', '', ''];
    sheet.getRow(9 + pipeRows.length).values = [null, 'Suction path role', 'Total suction-side head loss subtracts directly from NPSHa.', '', '', '', '', ''];
    sheet.getRow(10 + pipeRows.length).values = [null, 'Discharge path role', 'Discharge losses affect pump head balance and required outlet pressure.', '', '', '', '', ''];

    styleScenarioWorksheet(sheet, [12, 16, 18, 18, 12, 12, 12, 14, 12, 10, 12, 12, 14, 14, 14, 14, 14, 14, 14, 12, 16, 16, 42]);
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 5) row.eachCell(cell => cell.numFmt = typeof cell.value === 'number' || cell.value?.formula ? '0.000' : cell.numFmt);
    });
    return sheet;
}

function addScenarioBoundaryTraceSheet(workbook, data, kind) {
    const isSource = kind === 'source';
    const sheet = workbook.addWorksheet(isSource ? 'SRC Trace' : 'SNK Trace');
    addScenarioTitle(
        sheet,
        isSource ? 'SRC Boundary Trace' : 'SNK Boundary Trace',
        isSource
            ? 'Source boundary data, pressure/elevation head, flow basis, and suction-path dependency.'
            : 'Sink Fluid Out boundary mode, pressure basis, flow demand/readout, residual, and downstream role.'
    );
    const ids = isSource ? data.sourceIds : data.sinkIds;
    let rowIndex = 4;
    ids.forEach(id => {
        const trace = isSource
            ? (typeof buildSourceCalculationTrace === 'function' ? buildSourceCalculationTrace(id, globalModel, connections) : null)
            : (typeof buildSinkCalculationTrace === 'function' ? buildSinkCalculationTrace(id, globalModel, connections) : null);
        addScenarioSection(sheet, rowIndex++, `${id} - ${trace?.status || 'Trace'}`);

        sheet.getRow(rowIndex++).values = [null, 'Readout', 'Value', 'Unit', 'Key', 'Notes', '', ''];
        styleScenarioHeaderRow(sheet.getRow(rowIndex - 1));
        (trace?.readouts || []).forEach(item => {
            const row = sheet.getRow(rowIndex++);
            row.values = [null, item.label, item.value, item.unit, item.key || '', '', '', ''];
        });

        sheet.getRow(rowIndex++).values = [null, 'Step', 'Formula', 'Substitution', 'Result', 'Unit', 'Reference', ''];
        styleScenarioHeaderRow(sheet.getRow(rowIndex - 1));
        (trace?.steps || []).forEach(step => {
            const row = sheet.getRow(rowIndex++);
            row.values = [null, step.title, step.formula, step.substitution, step.result, step.unit, step.reference, ''];
        });

        if ((trace?.warnings || []).length) {
            sheet.getRow(rowIndex++).values = [null, 'Warnings', (trace.warnings || []).join(' | '), '', '', '', '', ''];
        }
        rowIndex += 1;
    });
    if (!ids.length) {
        sheet.getRow(4).values = [null, isSource ? 'No SRC boundary objects found.' : 'No SNK boundary objects found.'];
    }
    styleScenarioWorksheet(sheet, [22, 26, 42, 58, 16, 40, 12, 12]);
    return sheet;
}

function addScenarioWarningsGuidanceSheet(workbook, data) {
    const sheet = workbook.addWorksheet('Warnings Guidance');
    addScenarioTitle(sheet, 'Warnings and No-Cavitation Guidance', 'Operational checklist for removing warnings without hiding the engineering cause.');
    sheet.getRow(4).values = [null, 'Object', 'Type', 'Warning / observation', 'Recommended user action', '', '', ''];
    styleScenarioHeaderRow(sheet.getRow(4));
    const warningRows = data.warnings.length ? data.warnings : [{ objectId: 'System', type: 'status', warning: 'No active warnings were found at export time.' }];
    warningRows.forEach((warning, index) => {
        const row = sheet.getRow(5 + index);
        row.values = [
            null,
            warning.objectId,
            warning.type,
            warning.warning,
            getScenarioWarningRecommendation(warning.warning),
            '',
            '',
            ''
        ];
    });

    const start = 7 + warningRows.length;
    addScenarioSection(sheet, start, 'Safe Operation Checklist');
    const guidance = [
        ['NPSH acceptance', 'Keep NPSHa greater than NPSHr, with margin and ratio above configured limits.'],
        ['Best correction for cavitation risk', 'Increase source pressure/elevation or reduce suction pipe, fitting, and valve losses.'],
        ['NPSHr discipline', 'Do not reduce NPSHr only to clear a warning unless the value is supported by manufacturer/test data.'],
        ['SNK Flow Demand Boundary', 'Use Flow Demand Boundary when the thesis scenario imposes discharge demand; required pressure becomes a readout.'],
        ['Pressure residual warning', 'If using Free Outlet or Outlet Pressure Boundary, align outlet pressure, elevation, and discharge losses so residual is within tolerance.'],
        ['Pipe segment sensitivity', 'Use Pipe Segments sheet to change ID, length, K_each, Qty, or Add_K and observe the formula impact.']
    ];
    guidance.forEach((item, index) => {
        const row = sheet.getRow(start + 1 + index);
        row.values = [null, item[0], item[1], '', '', '', '', ''];
    });
    styleScenarioWorksheet(sheet, [18, 18, 26, 58, 70, 12, 12, 12]);
    return sheet;
}

function getScenarioWarningRecommendation(warning) {
    const text = scenarioExportText(warning, '').toLowerCase();
    if (text.includes('npsha') || text.includes('npsh')) {
        return 'Review source pressure/elevation, pump suction elevation, suction pipe loss, vapor pressure, and NPSHr source.';
    }
    if (text.includes('pressure residual') || text.includes('boundary')) {
        return 'For thesis flow-demand cases, use SNK Flow Demand Boundary; otherwise check outlet pressure, elevation, and discharge losses.';
    }
    if (text.includes('high point') || text.includes('vapor pressure')) {
        return 'Check pipe high point elevation, pressure profile, and vapor pressure margin.';
    }
    if (text.includes('curve') || text.includes('operating')) {
        return 'Check pump curve, BEP/POR/AOR limits, flow demand, and design head.';
    }
    if (text.includes('path') || text.includes('connect')) {
        return 'Check the solid hydraulic route: SRC/tank to pump suction and pump discharge to SNK.';
    }
    return 'Open the object properties, review the calculation trace, and verify the related input basis.';
}

function addScenarioReferencesSheet(workbook) {
    const sheet = workbook.addWorksheet('References');
    addScenarioTitle(sheet, 'References and Formula Basis', 'Formula and literature basis used by the exported calculation report.');
    sheet.getRow(4).values = [null, 'Topic', 'Basis', 'Reference / location', '', '', '', ''];
    styleScenarioHeaderRow(sheet.getRow(4));
    const rows = [
        ['NPSHa definition', 'NPSHa is total available suction head above vapor pressure head.', 'pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf'],
        ['Bernoulli energy equation', 'Pressure head, elevation head, velocity head, pump head, and head loss are balanced along the route.', 'pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf; pdf_ref/ref2-introduction-fluid-mechanics.pdf'],
        ['Centrifugal pump cavitation', 'Cavitation potential is evaluated by comparing NPSHa to NPSHr.', 'pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf'],
        ['Darcy-Weisbach', 'Pipe major loss h_major = f(L/D)(V^2/2g).', 'Pipe Segments sheet formulas'],
        ['Minor loss coefficient K', 'Fittings and Add_K use h_minor = K(V^2/2g).', 'Pipe Segments sheet formulas'],
        ['Standard atmosphere', '1 atmosphere = 101325 Pa = 1.01325 bar.', 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors'],
        ['Water/fluid properties', 'Density, viscosity, and vapor pressure must be verified for final design.', 'https://webbook.nist.gov/chemistry/fluid/'],
        ['Bernoulli open reference', 'Static pressure plus dynamic pressure/head interpretation.', 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/bernoullis-equation/'],
        ['Open NPSH reference', 'NPSH concept, suction pressure, vapor pressure, and cavitation context.', 'https://www.engineeringtoolbox.com/npsh-net-positive-suction-head-d_634.html']
    ];
    rows.forEach((item, index) => {
        sheet.getRow(5 + index).values = [null, item[0], item[1], item[2], '', '', '', ''];
    });
    styleScenarioWorksheet(sheet, [22, 30, 68, 95, 12, 12, 12, 12]);
    return sheet;
}

function buildScenarioExcelWorkbook(ExcelJS, data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GhaniSIM1';
    workbook.lastModifiedBy = 'GhaniSIM1';
    workbook.created = data.generatedAt;
    workbook.modified = new Date();
    workbook.subject = 'NPSH scenario calculation trace';
    workbook.title = 'Untirta GhaniSIM NPSH Calculation Trace';
    workbook.company = 'Sultan Ageng Tirtayasa University - Mechanical Engineering';

    addScenarioSummarySheet(workbook, data);
    addScenarioPumpPerformanceCurveSheet(workbook, data);
    addScenarioLiveFormulaSheet(workbook, data);
    addScenarioRouteTraceSheet(workbook, data);
    addScenarioPumpTraceSheet(workbook, data);
    addScenarioPipeSegmentsSheet(workbook, data);
    addScenarioBoundaryTraceSheet(workbook, data, 'source');
    addScenarioBoundaryTraceSheet(workbook, data, 'sink');
    addScenarioWarningsGuidanceSheet(workbook, data);
    addScenarioReferencesSheet(workbook);

    return workbook;
}

function downloadScenarioWorkbook(buffer, filename) {
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportScenarioCalculationTraceToExcel() {
    try {
        showScenarioExportToast('Preparing Excel calculation trace from the active canvas scenario...', {
            title: 'Export Scenario Report',
            variant: 'info',
            duration: 2400
        });

        const ExcelJS = await loadScenarioExcelJs();
        const data = collectScenarioExportData();
        const workbook = buildScenarioExcelWorkbook(ExcelJS, data);
        const buffer = await workbook.xlsx.writeBuffer();
        const filename = buildScenarioExportFileName(data);
        downloadScenarioWorkbook(buffer, filename);

        showScenarioExportToast(filename, {
            title: 'Excel export started',
            variant: 'success',
            duration: 6200
        });
    } catch (err) {
        console.error(err);
        showScenarioExportToast(err?.message || 'Unable to export the Excel calculation trace.', {
            title: 'Export failed',
            variant: 'error',
            duration: 7200
        });
    }
}

window.exportScenarioCalculationTraceToExcel = exportScenarioCalculationTraceToExcel;
