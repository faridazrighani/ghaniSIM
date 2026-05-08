const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const defaultGhani3File = path.join(os.homedir(), 'Downloads', 'ghani3.hysys');
const ghani3File = process.env.GHANI3_FILE || defaultGhani3File;

function loadPlaywright() {
    try {
        return require('playwright');
    } catch (err) {
        const fallback = path.join(
            os.homedir(),
            '.cache',
            'codex-runtimes',
            'codex-primary-runtime',
            'dependencies',
            'node',
            'node_modules',
            'playwright'
        );
        if (fs.existsSync(fallback)) {
            return require(fallback);
        }
        throw err;
    }
}

function findChromeExecutable() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ].filter(Boolean);
    return candidates.find(item => fs.existsSync(item)) || null;
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            server.close(() => resolve(address.port));
        });
    });
}

function fetchStatus(url) {
    return new Promise(resolve => {
        const req = http.get(url, res => {
            res.resume();
            resolve(res.statusCode);
        });
        req.on('error', () => resolve(0));
        req.setTimeout(500, () => {
            req.destroy();
            resolve(0);
        });
    });
}

async function waitForServer(url) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        if (await fetchStatus(url) === 200) return;
        await new Promise(resolve => setTimeout(resolve, 150));
    }
    throw new Error(`Preview server did not become ready at ${url}`);
}

function assertCondition(assertions, name, pass, details = '') {
    assertions.push({ name, pass, details });
}

async function main() {
    if (!fs.existsSync(ghani3File)) {
        throw new Error(`Missing ghani3 fixture: ${ghani3File}. Set GHANI3_FILE to override.`);
    }

    const { chromium } = loadPlaywright();
    const chromePath = findChromeExecutable();
    if (!chromePath) {
        throw new Error('Chrome executable not found. Set CHROME_PATH or install Google Chrome.');
    }

    const port = Number.parseInt(process.env.GHANI3_TEST_PORT || '', 10) || await getFreePort();
    const server = spawn(process.execPath, ['server.mjs', String(port)], {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });

    const serverErrors = [];
    server.stderr.on('data', chunk => serverErrors.push(String(chunk)));

    let browser;
    try {
        await waitForServer(`http://127.0.0.1:${port}/index.html`);
        browser = await chromium.launch({
            headless: true,
            executablePath: chromePath
        });

        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));
        await page.addInitScript(() => {
            window.Chart = class {
                constructor() {
                    this.data = { labels: [], datasets: [{ data: [] }, { data: [] }] };
                }
                update() {}
                destroy() {}
            };
        });

        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (
            typeof applySimulationState === 'function'
            && typeof updateSimulation === 'function'
            && typeof calculatePipeInstrumentMeasurement === 'function'
        ));

        const rawState = fs.readFileSync(ghani3File, 'utf8');
        const result = await page.evaluate(json => {
            const cloneResult = value => JSON.parse(JSON.stringify(value));
            const getInstrumentSnapshots = () => instrumentLinks
                .map(link => {
                    const instrument = globalModel[link.instrumentId];
                    const pipe = globalModel[link.pipeId];
                    const calc = calculatePipeInstrumentMeasurement(
                        instrument,
                        link.pipeId,
                        globalModel,
                        connections,
                        link.location
                    );
                    const interpolatedPressure = pipe.results.inletPressure
                        + (pipe.results.outletPressure - pipe.results.inletPressure) * link.location;
                    return {
                        id: link.instrumentId,
                        pipeId: link.pipeId,
                        location: Number(link.location.toFixed(6)),
                        pressure: calc.values.pressure,
                        flow: calc.values.flow,
                        temperature: calc.values.temperature,
                        inletPressure: pipe.results.inletPressure,
                        outletPressure: pipe.results.outletPressure,
                        interpolatedPressure: Number(interpolatedPressure.toFixed(3))
                    };
                })
                .sort((a, b) => a.id.localeCompare(b.id));

            applySimulationState(json);
            updateSimulation({ renderSidebarAfter: false });

            const initial = {
                sourceFlow: globalModel['SRC-100'].props.flow,
                sourceMassFlow: globalModel['SRC-100'].props.massFlow,
                pumpFlow: Number(globalModel['P-100'].results.flow),
                pumpStatus: globalModel['P-100'].results.status,
                pumpWarnings: globalModel['P-100'].results.warnings,
                pumpSolveMode: globalModel['P-100'].results.solveMode,
                pumpFlowBasis: globalModel['P-100'].results.flowBasis,
                pumpRequiredSystemHead: globalModel['P-100'].results.requiredSystemHead,
                pumpHeadResidual: globalModel['P-100'].results.headResidual,
                pumpPressureResidual: globalModel['P-100'].results.pressureResidual,
                sinkFlow: globalModel['SNK-100'].results.flow,
                sinkPressureResidual: globalModel['SNK-100'].results.pressureResidual,
                tanks: {
                    'TK-100': cloneResult(globalModel['TK-100'].results),
                    'TK-101': cloneResult(globalModel['TK-101'].results)
                },
                instruments: getInstrumentSnapshots(),
                canvasPressureUnit: document.querySelector('.line-monitor-readout td:last-child')?.textContent || ''
            };

            renderSidebar('P-100');
            initial.pumpPropertiesSidebarHidden = document.getElementById('pumpPropertiesSidebar')?.hidden ?? true;
            initial.pumpPropertiesHeader = document.getElementById('pumpPropertiesHeader')?.textContent || '';
            initial.pumpPropertiesText = document.getElementById('pumpPropertiesBody')?.innerText || '';
            initial.pumpPropertiesFlow = document.querySelector('#pumpPropertiesBody [data-key="result-flow"]')?.textContent || '';
            initial.pumpPropertiesRequiredHead = document.querySelector('#pumpPropertiesBody [data-key="result-required-system-head"]')?.textContent || '';
            initial.pumpObjectSidebarText = document.getElementById('propTableBody')?.innerText || '';
            initial.pumpObjectBepFlowInput = document.querySelector('#propTableBody .prop-input-field[data-key="bepFlow"]')?.value || '';

            renderSidebar('I-100');
            initial.sidebarPressureText = document.querySelector('[data-key="instrument-pressure"]')?.textContent || '';
            renderSidebar('TK-100');
            initial.tankSidebarText = document.getElementById('propTableBody')?.innerText || '';
            initial.tankSidebarSources = document.querySelector('[data-key="tank-connected-sources"]')?.textContent || '';
            initial.tankSidebarStatus = document.querySelector('[data-key="tank-hydraulic-status"]')?.textContent || '';
            initial.tankSidebarInletFlow = document.querySelector('[data-key="tank-inlet-flow"]')?.textContent || '';
            initial.tankSidebarOutletFlow = document.querySelector('[data-key="tank-outlet-flow"]')?.textContent || '';
            initial.tankSidebarNetFlow = document.querySelector('[data-key="tank-net-flow"]')?.textContent || '';
            initial.pumpWarningClass = document.getElementById('obj-p100')?.classList.contains('pump-status-warning') || false;
            initial.tankDirectLabels = Array.from(document.querySelectorAll('#propTableBody > tr > td.prop-label'))
                .map(cell => cell.textContent.trim());
            initial.tankAdvancedInventoryOpen = document.querySelector('.tank-advanced-inventory')?.open ?? null;
            initial.tankAdvancedHasDiameter = !!document.querySelector('.tank-advanced-inventory [data-key="diameter"]');
            initial.pumpPropertiesSidebarHiddenAfterTank = document.getElementById('pumpPropertiesSidebar')?.hidden ?? false;

            globalModel['SRC-100'].props.massFlow = 8000;
            syncSourceFlowFromInputMode('SRC-100');
            updateSimulation({ renderSidebarAfter: false });

            const realtime = {
                sourceFlow: globalModel['SRC-100'].props.flow,
                pumpFlow: Number(globalModel['P-100'].results.flow),
                instruments: getInstrumentSnapshots()
            };

            globalModel['SRC-100'].props.massFlow = 1000000;
            syncSourceFlowFromInputMode('SRC-100');
            updateSimulation({ renderSidebarAfter: false });

            const pumpWarningVisual = {
                status: globalModel['P-100'].results.status,
                warnings: globalModel['P-100'].results.warnings,
                hasWarningClass: document.getElementById('obj-p100')?.classList.contains('pump-status-warning') || false,
                operatingStatus: document.getElementById('obj-p100')?.dataset.operatingStatus || ''
            };

            return { initial, realtime, pumpWarningVisual };
        }, rawState);

        const assertions = [];
        const flowTolerance = 0.01;
        const pressureTolerance = 0.001;

        assertCondition(
            assertions,
            'initial pump flow follows SRC flow',
            Math.abs(result.initial.pumpFlow - result.initial.sourceFlow) <= flowTolerance,
            JSON.stringify({ pumpFlow: result.initial.pumpFlow, sourceFlow: result.initial.sourceFlow })
        );
        assertCondition(
            assertions,
            'initial PTF flows follow SRC flow',
            result.initial.instruments.every(item => Math.abs(item.flow - result.initial.sourceFlow) <= flowTolerance),
            JSON.stringify(result.initial.instruments.map(item => ({ id: item.id, flow: item.flow })))
        );
        assertCondition(
            assertions,
            'PTF pressures use pipe tap interpolation',
            result.initial.instruments.every(item => Math.abs(item.pressure - item.interpolatedPressure) <= pressureTolerance),
            JSON.stringify(result.initial.instruments.map(item => ({ id: item.id, pressure: item.pressure, interpolation: item.interpolatedPressure })))
        );
        assertCondition(
            assertions,
            'pressure unit is absolute',
            result.initial.canvasPressureUnit === 'bar a' && result.initial.sidebarPressureText.includes('bar a'),
            JSON.stringify({ canvas: result.initial.canvasPressureUnit, sidebar: result.initial.sidebarPressureText })
        );
        assertCondition(
            assertions,
            'ghani3 pump and sink are solved without warnings',
            result.initial.pumpStatus === 'Solved at SRC flow'
                && result.initial.pumpSolveMode === 'Solved at SRC flow'
                && result.initial.pumpWarnings.length === 0
                && result.initial.pumpWarningClass === false
                && Math.abs(result.initial.sinkPressureResidual) <= 0.02,
            JSON.stringify({
                pumpStatus: result.initial.pumpStatus,
                pumpSolveMode: result.initial.pumpSolveMode,
                pumpWarnings: result.initial.pumpWarnings,
                pumpWarningClass: result.initial.pumpWarningClass,
                sinkResidual: result.initial.sinkPressureResidual
            })
        );
        assertCondition(
            assertions,
            'pump system residual readouts are populated',
            result.initial.pumpFlowBasis === 'SRC-100 flow input'
                && result.initial.pumpRequiredSystemHead !== null
                && result.initial.pumpHeadResidual !== null
                && result.initial.pumpPressureResidual !== null,
            JSON.stringify({
                flowBasis: result.initial.pumpFlowBasis,
                requiredHead: result.initial.pumpRequiredSystemHead,
                headResidual: result.initial.pumpHeadResidual,
                pressureResidual: result.initial.pumpPressureResidual
            })
        );
        assertCondition(
            assertions,
            'pump properties sidebar shows operating results and system residual',
            result.initial.pumpPropertiesSidebarHidden === false
                && result.initial.pumpPropertiesHeader === 'P-100'
                && result.initial.pumpPropertiesText.includes('Operating Results')
                && result.initial.pumpPropertiesText.includes('System Residual')
                && !result.initial.pumpPropertiesText.includes('Pump Operating Limits')
                && result.initial.pumpPropertiesFlow.includes('9.53 m3/h')
                && result.initial.pumpPropertiesRequiredHead.includes('0.16 m')
                && !result.initial.pumpObjectSidebarText.includes('Operating Results')
                && !result.initial.pumpObjectSidebarText.includes('System Residual')
                && result.initial.pumpObjectSidebarText.includes('Pump Operating Limits')
                && result.initial.pumpObjectBepFlowInput !== ''
                && result.initial.pumpPropertiesSidebarHiddenAfterTank === true,
            JSON.stringify({
                hidden: result.initial.pumpPropertiesSidebarHidden,
                header: result.initial.pumpPropertiesHeader,
                flow: result.initial.pumpPropertiesFlow,
                requiredHead: result.initial.pumpPropertiesRequiredHead,
                objectBepFlow: result.initial.pumpObjectBepFlowInput,
                objectHasOperatingResults: result.initial.pumpObjectSidebarText.includes('Operating Results'),
                objectHasLimits: result.initial.pumpObjectSidebarText.includes('Pump Operating Limits'),
                objectHasResidual: result.initial.pumpObjectSidebarText.includes('System Residual'),
                hiddenAfterTank: result.initial.pumpPropertiesSidebarHiddenAfterTank
            })
        );
        assertCondition(
            assertions,
            'tank pass-through readouts are solved and balanced',
            result.initial.tanks['TK-100'].hydraulicStatus === 'Pass-through solved'
                && result.initial.tanks['TK-101'].hydraulicStatus === 'Pass-through solved'
                && result.initial.tanks['TK-100'].connectedSources.includes('SRC-100')
                && Math.abs(result.initial.tanks['TK-100'].inletFlow - result.initial.sourceFlow) <= flowTolerance
                && Math.abs(result.initial.tanks['TK-100'].outletFlow - result.initial.sourceFlow) <= flowTolerance
                && Math.abs(result.initial.tanks['TK-100'].netFlow) <= flowTolerance
                && Math.abs(result.initial.tanks['TK-101'].inletFlow - result.initial.sourceFlow) <= flowTolerance
                && Math.abs(result.initial.tanks['TK-101'].outletFlow - result.initial.sourceFlow) <= flowTolerance
                && Math.abs(result.initial.tanks['TK-101'].netFlow) <= flowTolerance,
            JSON.stringify({
                tk100: {
                    status: result.initial.tanks['TK-100'].hydraulicStatus,
                    sources: result.initial.tanks['TK-100'].connectedSources,
                    inletFlow: result.initial.tanks['TK-100'].inletFlow,
                    outletFlow: result.initial.tanks['TK-100'].outletFlow,
                    netFlow: result.initial.tanks['TK-100'].netFlow
                },
                tk101: {
                    status: result.initial.tanks['TK-101'].hydraulicStatus,
                    inletFlow: result.initial.tanks['TK-101'].inletFlow,
                    outletFlow: result.initial.tanks['TK-101'].outletFlow,
                    netFlow: result.initial.tanks['TK-101'].netFlow
                }
            })
        );
        assertCondition(
            assertions,
            'tank sidebar exposes pass-through hydraulic readouts',
            result.initial.tankSidebarText.includes('Pass-through Hydraulic Readout')
                && result.initial.tankSidebarSources.includes('SRC-100')
                && result.initial.tankSidebarStatus === 'Pass-through solved'
                && result.initial.tankSidebarInletFlow.includes('9.528 m3/h')
                && result.initial.tankSidebarOutletFlow.includes('9.528 m3/h')
                && result.initial.tankSidebarNetFlow.includes('0 m3/h'),
            JSON.stringify({
                textIncludesHeader: result.initial.tankSidebarText.includes('Pass-through Hydraulic Readout'),
                sources: result.initial.tankSidebarSources,
                status: result.initial.tankSidebarStatus,
                inlet: result.initial.tankSidebarInletFlow,
                outlet: result.initial.tankSidebarOutletFlow,
                net: result.initial.tankSidebarNetFlow
            })
        );
        assertCondition(
            assertions,
            'tank inventory inputs are collapsed out of basic rows',
            result.initial.tankDirectLabels.includes('PFD Size')
                && result.initial.tankDirectLabels.includes('Base Elevation')
                && result.initial.tankDirectLabels.includes('Operating Pressure')
                && !result.initial.tankDirectLabels.includes('Tank Diameter')
                && result.initial.tankAdvancedInventoryOpen === false
                && result.initial.tankAdvancedHasDiameter,
            JSON.stringify({
                labels: result.initial.tankDirectLabels,
                advancedOpen: result.initial.tankAdvancedInventoryOpen,
                hasDiameter: result.initial.tankAdvancedHasDiameter
            })
        );
        assertCondition(
            assertions,
            'realtime SRC mass-flow edit propagates to pump and PTF',
            Math.abs(result.realtime.pumpFlow - result.realtime.sourceFlow) <= flowTolerance
                && result.realtime.instruments.every(item => Math.abs(item.flow - result.realtime.sourceFlow) <= flowTolerance),
            JSON.stringify({
                pumpFlow: result.realtime.pumpFlow,
                sourceFlow: result.realtime.sourceFlow,
                instruments: result.realtime.instruments.map(item => ({ id: item.id, flow: item.flow }))
            })
        );
        assertCondition(
            assertions,
            'pump warning status turns pump red on canvas',
            result.pumpWarningVisual.status !== 'OK'
                && result.pumpWarningVisual.warnings.length > 0
                && result.pumpWarningVisual.hasWarningClass
                && result.pumpWarningVisual.operatingStatus === 'warning',
            JSON.stringify(result.pumpWarningVisual)
        );

        const failed = assertions.filter(item => !item.pass);
        const output = {
            ok: failed.length === 0 && jsErrors.length === 0,
            file: ghani3File,
            initial: {
                sourceFlow: Number(result.initial.sourceFlow.toFixed(3)),
                pumpFlow: result.initial.pumpFlow,
                pumpStatus: result.initial.pumpStatus,
                pumpSolveMode: result.initial.pumpSolveMode,
                pumpFlowBasis: result.initial.pumpFlowBasis,
                pumpRequiredSystemHead: result.initial.pumpRequiredSystemHead,
                pumpHeadResidual: result.initial.pumpHeadResidual,
                pumpPressureResidual: result.initial.pumpPressureResidual,
                sinkPressureResidual: result.initial.sinkPressureResidual,
                tanks: {
                    'TK-100': {
                        hydraulicStatus: result.initial.tanks['TK-100'].hydraulicStatus,
                        pressureBasis: result.initial.tanks['TK-100'].pressureBasis,
                        inletFlow: result.initial.tanks['TK-100'].inletFlow,
                        outletFlow: result.initial.tanks['TK-100'].outletFlow,
                        netFlow: result.initial.tanks['TK-100'].netFlow
                    },
                    'TK-101': {
                        hydraulicStatus: result.initial.tanks['TK-101'].hydraulicStatus,
                        pressureBasis: result.initial.tanks['TK-101'].pressureBasis,
                        inletFlow: result.initial.tanks['TK-101'].inletFlow,
                        outletFlow: result.initial.tanks['TK-101'].outletFlow,
                        netFlow: result.initial.tanks['TK-101'].netFlow
                    }
                },
                instruments: result.initial.instruments.map(item => ({
                    id: item.id,
                    pipeId: item.pipeId,
                    pressure: item.pressure,
                    flow: item.flow,
                    temperature: item.temperature
                }))
            },
            realtime: {
                sourceFlow: Number(result.realtime.sourceFlow.toFixed(3)),
                pumpFlow: result.realtime.pumpFlow,
                instruments: result.realtime.instruments.map(item => ({ id: item.id, flow: item.flow }))
            },
            pumpWarningVisual: result.pumpWarningVisual,
            assertions,
            jsErrors,
            serverErrors
        };

        console.log(JSON.stringify(output, null, 2));
        if (!output.ok) process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
