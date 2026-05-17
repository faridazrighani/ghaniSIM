const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(projectRoot, 'app.js'), 'utf8');
const taskWindow = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const unitSystem = fs.readFileSync(path.join(projectRoot, 'core/unit-system.js'), 'utf8');
const audit = fs.readFileSync(path.join(projectRoot, 'docs/ux_ui_audit.md'), 'utf8');
const smokeToolPath = path.join(projectRoot, 'tools/smoke-first-run-basis-flow.cjs');
const smokeTool = fs.readFileSync(smokeToolPath, 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const taskWindowStart = indexHtml.indexOf('id="taskWindow"');
const topMenuStart = indexHtml.indexOf('<!-- Top Menu Bar -->');
assert(taskWindowStart >= 0 && topMenuStart > taskWindowStart, 'Initial task window shell should appear before the toolbar/menu markup');

const lcpShellHtml = indexHtml.slice(taskWindowStart, topMenuStart);
assert(lcpShellHtml.includes('Set Fluid Basis and Unit Standard before adding equipment.'), 'First-run shell should tell the user to set Fluid Basis and Unit Standard');
assert(lcpShellHtml.includes('data-fluid-action="open-full-basis"'), 'First-run shell should expose Open Setup action');
assert(!lcpShellHtml.includes('data-fluid-action="confirm-basis"'), 'First-run shell should defer Apply until the full Fluid Basis form is opened');

assert(appJs.includes('const basisConfirmedAtStartup = typeof isBasisConfirmed === \'function\' && isBasisConfirmed();'), 'Startup should check whether the basis has already been confirmed');
assert(appJs.includes('activateInitialFluidBasisPrompt({ setupRequired: true, reason });'), 'Unconfirmed startup should activate the static Fluid Basis shell');
assert(appJs.includes('Thesis application: always present Help > About on browser open before modeling continues.'), 'Startup should document the mandatory thesis About dialog behavior');
assert(appJs.includes('if (typeof openAboutDialog === \'function\')'), 'Help > About should open on browser startup even before basis confirmation');
assert(!appJs.includes('if (basisConfirmedAtStartup && typeof openAboutDialog === \'function\')'), 'About dialog should not be gated behind basis confirmation');

assert(taskWindow.includes('function openFluidBasisFullSetupFromPrompt(event)'), 'Open Setup should have a dedicated handler');
assert(taskWindow.includes('openFluidBasisTaskWindow({ reason: fluidBasisSetupPrompt });'), 'Open Setup should render the full Fluid Basis task window');
assert(taskWindow.includes('button.dataset.fluidAction = \'confirm-basis\';'), 'Full Fluid Basis form should create the confirm-basis action');
assert(taskWindow.includes('button.textContent = \'Apply Basis / Start Modeling\';'), 'Full Fluid Basis form should label the apply action clearly');
assert(taskWindow.includes('if (actionTarget.dataset.fluidAction === \'confirm-basis\')'), 'Task window should handle the apply action');
assert(taskWindow.includes('if (typeof confirmBasisSetup === \'function\') confirmBasisSetup();'), 'Apply should persist the confirmed basis state');
assert(taskWindow.includes('fluidBasisSetupPrompt = null;'), 'Apply should clear the startup setup prompt state');
assert(taskWindow.includes('closeFluidBasisTaskWindow();'), 'Apply should close the Fluid Basis setup window');
assert(taskWindow.includes('document.body.classList.remove(\'fluid-basis-task-open\''), 'Closing should remove the Fluid Basis open state from the body');
assert(taskWindow.includes("target.closest?.('#aboutModal')"), 'Mandatory About interactions should not auto-minimize the startup Fluid Basis task window');

assert(unitSystem.includes('pill.hidden = shouldHidePill;'), 'Confirmed clean basis should hide the ribbon setup pill');
assert(unitSystem.includes('compact.hidden = !shouldHidePill;'), 'Confirmed clean basis should show the compact read-only status');

assert(audit.includes('Final viewport smoke confirmed the thesis startup and first-run basis flow'), 'Audit should record browser verification for the thesis startup and first-run basis flow');
assert(audit.includes('Help > About dialog is mandatory-visible on browser open'), 'Audit should record the mandatory thesis About dialog behavior');
assert(audit.includes('closing About does not minimize the setup shell'), 'Audit should record that closing mandatory About keeps the setup shell visible');
assert(audit.includes('docs/ux_ui_final_smoke_about_desktop.png'), 'Audit should reference the mandatory About desktop screenshot');
assert(audit.includes('Open Setup') && audit.includes('Apply Basis / Start Modeling'), 'Audit should document both first-run basis actions');
assert(audit.includes('node tools/smoke-first-run-basis-flow.cjs'), 'Audit should document how to rerun the final first-run basis browser smoke');
assert(smokeTool.includes('desktop') && smokeTool.includes('tablet-landscape') && smokeTool.includes('mobile'), 'Reusable smoke tool should cover desktop, tablet landscape, and mobile viewports');
assert(smokeTool.includes('Help > About should be mandatory-visible on browser open'), 'Reusable smoke tool should enforce mandatory About visibility');
assert(smokeTool.includes('#closeAbout'), 'Reusable smoke tool should close About before continuing the setup workflow');
assert(smokeTool.includes('ux_ui_final_smoke_about_'), 'Reusable smoke tool should capture mandatory About screenshots');
assert(smokeTool.includes('Select and Connect Pipe must not render in the ribbon'), 'Reusable smoke tool should enforce hidden ribbon mode buttons');
assert(smokeTool.includes('ribbonModeButtonsHidden'), 'Reusable smoke output should report hidden ribbon mode buttons');
assert(smokeTool.includes('Selected-object action panel must not render on the canvas'), 'Reusable smoke tool should enforce hidden selected-object action panel');
assert(smokeTool.includes('selectionActionPanelRemoved'), 'Reusable smoke output should report removed selected-object action panel');
assert(smokeTool.includes('Pan / scroll canvas hint must not render on the canvas'), 'Reusable smoke tool should enforce removed canvas pan hint');
assert(smokeTool.includes('canvasPanHintRemoved'), 'Reusable smoke output should report removed canvas pan hint');
assert(smokeTool.includes('Objects ribbon button must stay hidden'), 'Reusable smoke tool should enforce hidden Objects ribbon button');
assert(smokeTool.includes('objectsRibbonButtonHidden'), 'Reusable smoke output should report hidden Objects ribbon button');
assert(smokeTool.includes('thesis identity should remain visible in the long ribbon'), 'Reusable smoke tool should enforce visible desktop/tablet long thesis identity');
assert(smokeTool.includes('thesis identity text should not be clipped in the long ribbon'), 'Reusable smoke tool should enforce unclipped desktop/tablet long thesis identity text');
assert(smokeTool.includes('desktopAcademicIdentityUnclipped'), 'Reusable smoke output should report desktop thesis identity clipping status');
assert(smokeTool.includes('thesis identity text must stay locked to the approved four-line desktop/tablet wording'), 'Reusable smoke tool should enforce locked desktop/tablet thesis identity wording');
assert(smokeTool.includes('desktopAcademicIdentityLocked'), 'Reusable smoke output should report desktop thesis identity lock status');
assert(smokeTool.includes('longAcademicIdentityLocked'), 'Reusable smoke output should report long desktop/tablet thesis identity lock status');
assert(smokeTool.includes('longAcademicIdentityInViewport'), 'Reusable smoke output should report long desktop/tablet thesis identity viewport visibility');
assert(smokeTool.includes('compact thesis identity should fill the space to the right of Solve'), 'Reusable smoke tool should enforce compact thesis identity beside Solve');
assert(smokeTool.includes('compactAcademicIdentityLocked'), 'Reusable smoke output should report compact thesis identity lock status');
assert(smokeTool.includes("'tablet-compact-768'"), 'Reusable smoke tool should include a 768px compact tablet viewport');
assert(smokeTool.includes('tabletLandscapeNoticeVisible'), 'Reusable smoke output should report tablet portrait landscape notice status');
assert(smokeTool.includes('Solve button should stay aligned to the right edge of the desktop ribbon'), 'Reusable smoke tool should enforce desktop Solve right alignment');
assert(smokeTool.includes('desktopSolveRightAligned'), 'Reusable smoke output should report desktop Solve right alignment');
assert(smokeTool.includes('mobile object palette should remain visible'), 'Reusable smoke tool should enforce visible mobile object palette');
assert(smokeTool.includes('mobile object palette should use horizontal scroll'), 'Reusable smoke tool should enforce mobile object palette horizontal scroll');
assert(smokeTool.includes('mobileObjectPaletteScrollable'), 'Reusable smoke output should report mobile object palette scrollability');
assert(smokeTool.includes('data-fluid-action="open-full-basis"'), 'Reusable smoke tool should exercise Open Setup');
assert(smokeTool.includes('data-fluid-action="confirm-basis"'), 'Reusable smoke tool should exercise Apply Basis / Start Modeling');

console.log(JSON.stringify({
    passed: true,
    firstRunShell: true,
    fullSetupApply: true,
    confirmedBasisHidesSetup: true,
    browserEvidenceRecorded: true,
    reusableSmokeTool: true
}, null, 2));
