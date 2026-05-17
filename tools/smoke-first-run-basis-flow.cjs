const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Module = require('node:module');

const projectRoot = path.resolve(__dirname, '..');
const defaultUrl = process.env.SMOKE_URL || 'http://127.0.0.1:4173/';
const targetUrl = new URL(process.argv.find(arg => arg.startsWith('http')) || defaultUrl);
const port = Number(targetUrl.port || 4173);
const screenshotDir = path.join(projectRoot, 'docs');

const viewports = [
    { name: 'desktop', width: 1366, height: 900 },
    { name: 'tablet-large-1366', width: 1366, height: 1024 },
    { name: 'tablet-ipad-1180', width: 1180, height: 820 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'tablet-portrait', width: 820, height: 1180 },
    { name: 'mobile', width: 390, height: 844 }
];

const expectedDesktopAcademicIdentity = [
    'Sultan Ageng Tirtayasa University \u2013 Mechanical Engineering',
    'Modeling & Simulation of a Pumping System for Evaluating Cavitation',
    'Potential in Centrifugal Pumps Based on NPSH Analysis for Various Fluids.',
    'Bachelor\u2019s Thesis - Farid Azrighani et al.'
];
const longAcademicIdentityViewports = new Set(['desktop', 'tablet-large-1366', 'tablet-ipad-1180', 'tablet-landscape']);

function addBundledPlaywrightToNodePath() {
    if (process.env.NODE_PATH) {
        Module._initPaths();
        return;
    }
    const pnpmRoot = path.join(
        os.homedir(),
        '.cache',
        'codex-runtimes',
        'codex-primary-runtime',
        'dependencies',
        'node',
        'node_modules',
        '.pnpm'
    );
    if (!fs.existsSync(pnpmRoot)) return;
    const match = fs.readdirSync(pnpmRoot)
        .find(entry => entry.startsWith('playwright-core@') && fs.existsSync(path.join(pnpmRoot, entry, 'node_modules')));
    if (!match) return;
    process.env.NODE_PATH = path.join(pnpmRoot, match, 'node_modules');
    Module._initPaths();
}

function loadPlaywright() {
    addBundledPlaywrightToNodePath();
    try {
        return require('playwright-core');
    } catch (error) {
        throw new Error(`Unable to load playwright-core. Set NODE_PATH to a Playwright installation before running this smoke tool. ${error.message}`);
    }
}

function findChromeExecutable() {
    const candidates = [
        process.env.CHROME_PATH,
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ].filter(Boolean);
    return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function requestUrl(url, timeoutMs = 1200) {
    return new Promise(resolve => {
        const req = http.get(url, res => {
            res.resume();
            resolve(res.statusCode && res.statusCode < 500);
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(false);
        });
        req.on('error', () => resolve(false));
    });
}

async function waitForServer(url, timeoutMs = 7000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await requestUrl(url)) return true;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
}

async function ensurePreviewServer() {
    if (await requestUrl(targetUrl)) return null;
    const serverPath = path.join(projectRoot, 'server.mjs');
    const child = spawn(process.execPath, [serverPath, String(port)], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', chunk => process.stdout.write(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    const ready = await waitForServer(targetUrl);
    if (!ready) {
        child.kill();
        throw new Error(`Preview server did not become ready at ${targetUrl.href}`);
    }
    return child;
}

async function readBasisFlowState(page) {
    return page.evaluate(() => {
        const visible = (el) => {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            return !el.hidden && style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
        };
        const canvas = document.querySelector('#canvas');
        const ribbon = document.querySelector('.ribbon');
        const task = document.querySelector('#taskWindow');
        const about = document.querySelector('#aboutModal');
        const basisPill = document.querySelector('#basisStatusPill');
        const compact = document.querySelector('#basisCompactStatus');
        const openSetupButton = document.querySelector('[data-fluid-action="open-full-basis"]');
        const applyButton = document.querySelector('[data-fluid-action="confirm-basis"]');
        const objectMenu = document.querySelector('#toolbarObjectMenuButton');
        const toolbarPalette = document.querySelector('#toolbarPalette');
        const academicIdentity = document.querySelector('.academic-identity');
        const selectButton = document.querySelector('#btn-mode-select');
        const connectButton = document.querySelector('#btn-mode-connect');
        const solveButton = document.querySelector('#btn-solve');
        const tabletLandscapeNotice = document.querySelector('#tabletLandscapeNotice');
        const selectionActions = document.querySelector('#canvasSelectionActions');
        const panHint = document.querySelector('#canvasPanHint');
        const toolbarTools = toolbarPalette ? Array.from(toolbarPalette.querySelectorAll('.toolbar-tool')) : [];
        const academicTextNodes = academicIdentity
            ? Array.from(academicIdentity.querySelectorAll('.academic-university, .academic-thesis-line, .academic-author')).filter(visible)
            : [];
        const isTextClipped = (el) => !!el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
        const readText = (el) => el.textContent.trim().replace(/\s+/g, ' ');
        const ribbonRect = ribbon?.getBoundingClientRect();
        const solveRect = solveButton?.getBoundingClientRect();
        const academicRect = academicIdentity?.getBoundingClientRect();
        return {
            pfdObjects: canvas ? canvas.querySelectorAll('.pfd-object').length : -1,
            pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
            canvasOverflowX: canvas ? canvas.scrollWidth - canvas.clientWidth : null,
            taskWindowVisible: visible(task),
            taskKind: task?.dataset?.kind || '',
            aboutVisible: visible(about),
            openSetupVisible: visible(openSetupButton),
            applyButtonVisible: visible(applyButton),
            basisPillVisible: visible(basisPill),
            compactStatusVisible: visible(compact),
            objectMenuVisible: visible(objectMenu),
            academicIdentityVisible: visible(academicIdentity),
            academicIdentityWidth: academicIdentity ? Math.round(academicIdentity.getBoundingClientRect().width) : 0,
            academicIdentityInViewport: academicRect ? academicRect.left >= -1 && academicRect.right <= window.innerWidth + 1 : false,
            academicIdentityText: academicTextNodes.map(readText),
            academicIdentityTextClipped: academicTextNodes.some(isTextClipped),
            toolbarPaletteVisible: visible(toolbarPalette),
            toolbarPaletteClientWidth: toolbarPalette ? toolbarPalette.clientWidth : 0,
            toolbarPaletteScrollWidth: toolbarPalette ? toolbarPalette.scrollWidth : 0,
            toolbarToolCount: toolbarTools.length,
            visibleToolbarTools: toolbarTools.filter(visible).map((tool) => tool.textContent.trim().replace(/\s+/g, ' ')),
            ribbonSelectExists: !!selectButton,
            ribbonConnectExists: !!connectButton,
            ribbonSelectVisible: visible(selectButton),
            ribbonConnectVisible: visible(connectButton),
            solveButtonVisible: visible(solveButton),
            solveButtonRightInset: ribbonRect && solveRect ? Math.round(ribbonRect.right - solveRect.right) : null,
            tabletLandscapeNoticeVisible: visible(tabletLandscapeNotice),
            selectionActionsExists: !!selectionActions,
            selectionActionsVisible: visible(selectionActions),
            canvasPanHintExists: !!panHint,
            canvasPanHintVisible: visible(panHint),
            basisPillText: basisPill ? basisPill.textContent.trim().replace(/\s+/g, ' ') : '',
            compactText: compact ? compact.textContent.trim().replace(/\s+/g, ' ') : ''
        };
    });
}

function validateResult(row) {
    const states = [row.initial, row.afterAboutClose, row.fullSetup, row.afterApply];
    if (row.errors.length) throw new Error(`${row.viewport}: console errors: ${row.errors.join(' | ')}`);
    for (const state of states) {
        if (state.pageOverflowX > 1 || state.bodyOverflowX > 1) {
            throw new Error(`${row.viewport}: page horizontal overflow detected`);
        }
        if (state.pfdObjects !== 0) throw new Error(`${row.viewport}: startup canvas should stay clean`);
        if (state.ribbonSelectExists || state.ribbonConnectExists || state.ribbonSelectVisible || state.ribbonConnectVisible) {
            throw new Error(`${row.viewport}: Select and Connect Pipe must not render in the ribbon`);
        }
        if (state.selectionActionsExists || state.selectionActionsVisible) {
            throw new Error(`${row.viewport}: Selected-object action panel must not render on the canvas`);
        }
        if (state.canvasPanHintExists || state.canvasPanHintVisible) {
            throw new Error(`${row.viewport}: Pan / scroll canvas hint must not render on the canvas`);
        }
    }
    if (!row.initial.taskWindowVisible || row.initial.taskKind !== 'fluid' || !row.initial.openSetupVisible) {
        throw new Error(`${row.viewport}: first-run Fluid Basis shell should be visible with Open Setup`);
    }
    if (!row.initial.aboutVisible) {
        throw new Error(`${row.viewport}: Help > About should be mandatory-visible on browser open`);
    }
    if (row.afterAboutClose.aboutVisible) {
        throw new Error(`${row.viewport}: About should close before the setup workflow continues`);
    }
    if (!row.fullSetup.taskWindowVisible || row.fullSetup.taskKind !== 'fluid' || !row.fullSetup.applyButtonVisible) {
        throw new Error(`${row.viewport}: full Fluid Basis setup should show Apply Basis / Start Modeling`);
    }
    if (row.viewport === 'mobile') {
        if (!row.afterApply.toolbarPaletteVisible) {
            throw new Error(`${row.viewport}: mobile object palette should remain visible`);
        }
        if (row.afterApply.toolbarToolCount < 8) {
            throw new Error(`${row.viewport}: mobile object palette should expose object tools directly`);
        }
        if (row.afterApply.toolbarPaletteScrollWidth <= row.afterApply.toolbarPaletteClientWidth + 8) {
            throw new Error(`${row.viewport}: mobile object palette should use horizontal scroll`);
        }
    }
    if (longAcademicIdentityViewports.has(row.viewport)) {
        if (!row.afterApply.academicIdentityVisible) {
            throw new Error(`${row.viewport}: thesis identity should remain visible in the long ribbon`);
        }
        if (!row.afterApply.academicIdentityInViewport) {
            throw new Error(`${row.viewport}: long thesis identity should be visible within the viewport`);
        }
        if (row.afterApply.academicIdentityTextClipped) {
            throw new Error(`${row.viewport}: thesis identity text should not be clipped in the long ribbon`);
        }
        if (JSON.stringify(row.afterApply.academicIdentityText) !== JSON.stringify(expectedDesktopAcademicIdentity)) {
            throw new Error(`${row.viewport}: thesis identity text must stay locked to the approved four-line desktop/tablet wording`);
        }
    }
    if (row.viewport === 'desktop') {
        if (!row.afterApply.solveButtonVisible || row.afterApply.solveButtonRightInset < 0 || row.afterApply.solveButtonRightInset > 18) {
            throw new Error(`${row.viewport}: Solve button should stay aligned to the right edge of the desktop ribbon`);
        }
    }
    if (row.viewport === 'tablet-portrait' && !row.initial.tabletLandscapeNoticeVisible) {
        throw new Error(`${row.viewport}: tablet portrait should show the landscape orientation notice`);
    }
    if (row.afterApply.taskWindowVisible) throw new Error(`${row.viewport}: Apply should hide the Fluid Basis setup window`);
    if (row.afterApply.basisPillVisible) throw new Error(`${row.viewport}: Apply should hide the ribbon setup pill`);
    if (!row.afterApply.compactStatusVisible && row.viewport !== 'mobile') {
        throw new Error(`${row.viewport}: confirmed compact basis status should remain visible on larger viewports`);
    }
}

async function main() {
    const serverProcess = await ensurePreviewServer();
    const { chromium } = loadPlaywright();
    const chromePath = findChromeExecutable();
    const browser = await chromium.launch({
        headless: true,
        ...(chromePath ? { executablePath: chromePath } : {})
    });
    const results = [];
    try {
        for (const viewport of viewports) {
            const errors = [];
            const page = await browser.newPage({
                viewport: { width: viewport.width, height: viewport.height },
                deviceScaleFactor: 1
            });
            page.on('console', msg => {
                if (msg.type() === 'error') errors.push(msg.text());
            });
            page.on('pageerror', err => errors.push(err.message));
            await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForSelector('#aboutModal:not([hidden])', { timeout: 5000 });

            const initial = await readBasisFlowState(page);
            const aboutScreenshotPath = path.join(screenshotDir, `ux_ui_final_smoke_about_${viewport.name}.png`);
            await page.screenshot({ path: aboutScreenshotPath, fullPage: true });
            await page.locator('#closeAbout').click();
            await page.waitForTimeout(120);
            const afterAboutClose = await readBasisFlowState(page);
            await page.locator('[data-fluid-action="open-full-basis"]').click();
            await page.waitForTimeout(250);
            const fullSetup = await readBasisFlowState(page);
            await page.locator('[data-fluid-action="confirm-basis"]').click();
            await page.waitForTimeout(250);
            const afterApply = await readBasisFlowState(page);
            const screenshotPath = path.join(screenshotDir, `ux_ui_final_smoke_${viewport.name}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            results.push({ viewport: viewport.name, initial, afterAboutClose, fullSetup, afterApply, aboutScreenshot: aboutScreenshotPath, screenshot: screenshotPath, errors });
            await page.close();
        }
    } finally {
        await browser.close();
        if (serverProcess) serverProcess.kill();
    }
    results.forEach(validateResult);
    console.log(JSON.stringify({
        passed: true,
        url: targetUrl.href,
        viewports: results.map(row => ({
            viewport: row.viewport,
            aboutScreenshot: path.relative(projectRoot, row.aboutScreenshot).replace(/\\/g, '/'),
            screenshot: path.relative(projectRoot, row.screenshot).replace(/\\/g, '/'),
            mandatoryAboutVisible: row.initial.aboutVisible,
            ribbonModeButtonsHidden: !row.initial.ribbonSelectExists && !row.initial.ribbonConnectExists,
            selectionActionPanelRemoved: !row.initial.selectionActionsExists,
            canvasPanHintRemoved: !row.initial.canvasPanHintExists,
            longAcademicIdentityUnclipped: longAcademicIdentityViewports.has(row.viewport) ? !row.afterApply.academicIdentityTextClipped : undefined,
            longAcademicIdentityLocked: longAcademicIdentityViewports.has(row.viewport) ? JSON.stringify(row.afterApply.academicIdentityText) === JSON.stringify(expectedDesktopAcademicIdentity) : undefined,
            longAcademicIdentityInViewport: longAcademicIdentityViewports.has(row.viewport) ? row.afterApply.academicIdentityInViewport : undefined,
            tabletLandscapeNoticeVisible: row.viewport === 'tablet-portrait' ? row.initial.tabletLandscapeNoticeVisible : undefined,
            desktopAcademicIdentityUnclipped: row.viewport === 'desktop' ? !row.afterApply.academicIdentityTextClipped : undefined,
            desktopAcademicIdentityLocked: row.viewport === 'desktop' ? JSON.stringify(row.afterApply.academicIdentityText) === JSON.stringify(expectedDesktopAcademicIdentity) : undefined,
            desktopSolveRightAligned: row.viewport === 'desktop' ? row.afterApply.solveButtonVisible && row.afterApply.solveButtonRightInset >= 0 && row.afterApply.solveButtonRightInset <= 18 : undefined,
            mobileObjectPaletteVisible: row.viewport === 'mobile' ? row.afterApply.toolbarPaletteVisible : undefined,
            mobileObjectPaletteScrollable: row.viewport === 'mobile' ? row.afterApply.toolbarPaletteScrollWidth > row.afterApply.toolbarPaletteClientWidth + 8 : undefined,
            pageOverflowX: row.afterApply.pageOverflowX,
            canvasObjects: row.afterApply.pfdObjects
        }))
    }, null, 2));
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
