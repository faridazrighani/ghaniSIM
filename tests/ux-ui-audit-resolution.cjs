const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const audit = fs.readFileSync(path.join(projectRoot, 'docs/ux_ui_audit.md'), 'utf8');
const batch18SmokeScreenshot = path.join(projectRoot, 'docs/ux_ui_fix_batch18_task_window_focus_smoke.png');
const finalSmokeScreenshots = [
    'docs/ux_ui_final_smoke_desktop.png',
    'docs/ux_ui_final_smoke_tablet-landscape.png',
    'docs/ux_ui_final_smoke_mobile.png'
].map(file => path.join(projectRoot, file));
const mandatoryAboutScreenshots = [
    'docs/ux_ui_final_smoke_about_desktop.png',
    'docs/ux_ui_final_smoke_about_tablet-landscape.png',
    'docs/ux_ui_final_smoke_about_mobile.png'
].map(file => path.join(projectRoot, file));

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(audit.includes('Practical fix batches 1-24 applied'), 'Audit executive summary should mention Batch 24 closure');
assert(audit.includes('### Practical Fix Batch 14 Standards'), 'Audit should document Batch 14 standards');
assert(audit.includes('### Practical Fix Batch 15 Standards'), 'Audit should document Batch 15 standards');
assert(audit.includes('### Practical Fix Batch 16 Standards'), 'Audit should document Batch 16 standards');
assert(audit.includes('### Practical Fix Batch 17 Standards'), 'Audit should document Batch 17 standards');
assert(audit.includes('### Practical Fix Batch 18 Standards'), 'Audit should document Batch 18 standards');
assert(audit.includes('### Practical Fix Batch 19 Standards'), 'Audit should document Batch 19 standards');
assert(audit.includes('### Practical Fix Batch 20 Standards'), 'Audit should document Batch 20 standards');
assert(audit.includes('### Practical Fix Batch 21 Standards'), 'Audit should document Batch 21 standards');
assert(audit.includes('### Practical Fix Batch 22 Standards'), 'Audit should document Batch 22 standards');
assert(audit.includes('### Practical Fix Batch 23 Standards'), 'Audit should document Batch 23 standards');
assert(audit.includes('### Practical Fix Batch 24 Standards'), 'Audit should document Batch 24 standards');
assert(audit.includes('tests/ux-ui-audit-resolution.cjs'), 'Audit should list this resolution test');
assert(audit.includes('tests/toolbar-object-overflow.cjs'), 'Audit should list the grouped object overflow test');
assert(audit.includes('first-run-basis-flow.cjs'), 'Audit should list the first-run basis flow regression test');
assert(audit.includes('connection-workflow-discoverability.cjs'), 'Audit should list the connection workflow regression test');
assert(!audit.includes('Status: **Fix now**'), 'Resolved audit should not leave active Fix now status lines');
assert(!audit.includes('Status: **Needs decision**'), 'Resolved audit should not leave active Needs decision status lines');
assert(!audit.includes('Status: **Backlog**'), 'Resolved audit should not leave generic Backlog status lines');
assert(audit.includes('Status: **Resolved in Batch 1**'), 'Audit should map resolved findings to batches');
assert(audit.includes('Status: **Resolved in Batch 4; superseded and locked by Batch 22**'), 'Audit should map pan hint supersession to Batch 22');
assert(audit.includes('Status: **Resolved in Batch 2 and Batch 5; superseded and locked by Batch 19 and Batch 20**'), 'Audit should map connection workflow fixes and Batch 19/20 supersession');
assert(audit.includes('Status: **Resolved in Batch 8, Batch 15, and Batch 21**'), 'Audit should map toolbar mobile usability to Batch 8, Batch 15, and Batch 21');
assert(audit.includes('The original fix order has been executed through the practical fix batches'), 'Suggested fix order should be converted to resolution mapping');
assert(!audit.includes('No application code was changed in this audit pass'), 'Final audit status should not claim no code changed after practical fixes');
assert(audit.includes('Audit complete, with practical UX/UI fixes applied and verified through Batch 24'), 'Final audit status should reflect practical fixes');
assert(audit.includes('Batch 8 to Batch 13 browser smoke checks found no console errors'), 'Browser check summary should reflect post-fix verification');
assert(audit.includes('Batch 18 browser smoke confirmed object Task Window focus return'), 'Browser check summary should include the Batch 18 focus-return smoke test');
assert(audit.includes('Batch 19 static verification and reusable browser smoke confirmed the ribbon no longer renders `Select` or `Connect Pipe`'), 'Browser/static check summary should include the Batch 19 ribbon decision');
assert(audit.includes('Batch 20 static verification and reusable browser smoke confirmed the selected-object canvas action panel no longer renders'), 'Browser/static check summary should include the Batch 20 selected-object action decision');
assert(audit.includes('Batch 21 static verification and reusable browser smoke confirmed the mobile ribbon keeps the object palette visible as a compact horizontally scrollable strip'), 'Browser/static check summary should include the Batch 21 mobile palette decision');
assert(audit.includes('Batch 22 static verification and reusable browser smoke confirmed the `Pan / scroll canvas` pill no longer renders'), 'Browser/static check summary should include the Batch 22 pan hint decision');
assert(audit.includes('Batch 23 static verification and reusable browser smoke confirmed the desktop ribbon thesis identity remains visible without clipped text'), 'Browser/static check summary should include the Batch 23 thesis identity decision');
assert(audit.includes('Batch 24 static verification and reusable browser smoke locked the exact desktop Academic identity wording, order, and four-line structure'), 'Browser/static check summary should include the Batch 24 thesis identity wording lock');
assert(audit.includes('context-menu-first connection workflow is locked in `tests/connection-workflow-discoverability.cjs`'), 'Final status should lock the context-menu-first connection workflow');
assert(audit.includes('selected-object action-panel removal is locked in `tests/canvas-selection-actions.cjs`'), 'Final status should lock removal of the selected-object action panel');
assert(audit.includes('mobile object palette visibility and horizontal scroll are locked in `tests/toolbar-object-overflow.cjs`'), 'Final status should lock mobile object palette visibility');
assert(audit.includes('canvas pan-hint removal is locked in `tests/canvas-pan-affordance.cjs`'), 'Final status should lock canvas pan hint removal');
assert(audit.includes('desktop thesis identity readability is locked in `tests/academic-identity-layout.cjs`'), 'Final status should lock desktop thesis identity readability');
assert(audit.includes('exact desktop thesis identity wording and line breaks are locked in `tests/academic-identity-layout.cjs` and `tools/smoke-first-run-basis-flow.cjs`'), 'Final status should lock exact desktop thesis identity wording and line breaks');
assert(audit.includes('docs/ux_ui_fix_batch18_task_window_focus_smoke.png'), 'Batch 18 browser smoke screenshot should be referenced');
assert(fs.existsSync(batch18SmokeScreenshot), 'Batch 18 browser smoke screenshot should exist on disk');
assert(audit.includes('Final viewport smoke confirmed the thesis startup and first-run basis flow'), 'Audit should record final thesis startup and first-run basis flow smoke evidence');
assert(audit.includes('Help > About dialog is mandatory-visible on browser open'), 'Audit should lock mandatory startup Help > About behavior');
assert(audit.includes('closing About does not minimize the setup shell'), 'Audit should lock that closing mandatory About keeps first-run setup visible');
assert(audit.includes('node tools/smoke-first-run-basis-flow.cjs'), 'Audit should document the reusable final smoke command');
for (const screenshot of mandatoryAboutScreenshots) {
    assert(audit.includes(path.relative(projectRoot, screenshot).replace(/\\/g, '/')), `Audit should reference ${screenshot}`);
    assert(fs.existsSync(screenshot), `Mandatory About smoke screenshot should exist: ${screenshot}`);
}
for (const screenshot of finalSmokeScreenshots) {
    assert(audit.includes(path.relative(projectRoot, screenshot).replace(/\\/g, '/')), `Audit should reference ${screenshot}`);
    assert(fs.existsSync(screenshot), `Final viewport smoke screenshot should exist: ${screenshot}`);
}

console.log(JSON.stringify({
    passed: true,
    auditResolutionMapped: true,
    staleActiveStatusesRemoved: true,
    finalStatusUpdated: true
}, null, 2));
