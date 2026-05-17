const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const smokeTool = fs.readFileSync(path.join(projectRoot, 'tools/smoke-first-run-basis-flow.cjs'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(indexHtml.includes('aria-label="Thesis identity"'), 'Ribbon should keep the thesis identity landmark');
assert(indexHtml.includes('title="Sultan Ageng Tirtayasa University - Mechanical Engineering"'), 'University ribbon text should retain full title in tooltip');
assert(indexHtml.includes('Sultan Ageng Tirtayasa University &ndash; Mechanical Engineering'), 'Ribbon university copy should preserve the original university text');
assert(indexHtml.includes('Modeling &amp; Simulation of a Pumping System for Evaluating Cavitation'), 'Ribbon thesis copy should keep the requested first title line');
assert(indexHtml.includes('Potential in Centrifugal Pumps Based on NPSH Analysis for Various Fluids.'), 'Ribbon thesis copy should keep the requested second title line');
assert(indexHtml.includes('Bachelor&rsquo;s Thesis - Farid Azrighani et al.'), 'Ribbon author line should preserve the requested author text');
const academicSectionStart = indexHtml.indexOf('<section class="academic-identity"');
const academicSectionEnd = indexHtml.indexOf('</section>', academicSectionStart);
const academicSectionHtml = indexHtml.slice(academicSectionStart, academicSectionEnd);
assert(!academicSectionHtml.includes('Pumping Simulation for NPSH Analysis'), 'Desktop thesis copy should not be replaced with the compact small-screen title');
const approvedRibbonLines = [
    'Sultan Ageng Tirtayasa University &ndash; Mechanical Engineering',
    'Modeling &amp; Simulation of a Pumping System for Evaluating Cavitation',
    'Potential in Centrifugal Pumps Based on NPSH Analysis for Various Fluids.',
    'Bachelor&rsquo;s Thesis - Farid Azrighani et al.'
];
assert(academicSectionStart >= 0 && academicSectionEnd > academicSectionStart, 'Desktop thesis identity section should exist');
assert((academicSectionHtml.match(/class="academic-thesis-line"/g) || []).length === 2, 'Desktop thesis title should remain exactly two visible title lines');
const visibleRibbonLines = [
    academicSectionHtml.match(/<div class="academic-university"[^>]*>([^<]+)<\/div>/)?.[1],
    ...Array.from(academicSectionHtml.matchAll(/<span class="academic-thesis-line">([^<]+)<\/span>/g), match => match[1]),
    academicSectionHtml.match(/<div class="academic-author">([^<]+)<\/div>/)?.[1]
];
assert(JSON.stringify(visibleRibbonLines) === JSON.stringify(approvedRibbonLines), 'Desktop thesis identity visible lines should stay exactly locked');

const compactSectionStart = indexHtml.indexOf('<section class="academic-compact-identity"');
const compactSectionEnd = indexHtml.indexOf('</section>', compactSectionStart);
const compactSectionHtml = indexHtml.slice(compactSectionStart, compactSectionEnd);
const solveButtonStart = indexHtml.indexOf('id="btn-solve"');
const compactRibbonLines = [
    'UNTIRTA &ndash; Mechanical Engineering',
    'Pumping Simulation for NPSH Analysis',
    'Cavitation Potential in Centrifugal Pumps',
    'Bachelor&rsquo;s Thesis - Farid Azrighani et al.'
];
assert(compactSectionStart > solveButtonStart, 'Compact thesis identity should sit to the right of the Solve button in ribbon order');
assert(!compactSectionHtml.includes('academic-logo') && !compactSectionHtml.includes('<img'), 'Compact thesis identity should not use a logo');
const visibleCompactLines = Array.from(compactSectionHtml.matchAll(/<span>([^<]+)<\/span>/g), match => match[1]);
assert(JSON.stringify(visibleCompactLines) === JSON.stringify(compactRibbonLines), 'Compact thesis identity should keep the approved four-line wording');

assert(styles.includes('flex: 1 1 clamp(520px, 46vw, 760px);'), 'Desktop thesis identity should receive proportional ribbon width');
assert(styles.includes('min-width: 500px;') && styles.includes('max-width: 760px;'), 'Desktop thesis identity should have stable readable width bounds');
assert(styles.includes('min-height: 68px;'), 'Desktop thesis identity should reserve enough vertical room for the restored title');
assert(styles.includes('line-height: 1.22;') && styles.includes('line-height: 1.18;'), 'Desktop thesis identity text should use generous line-height to avoid glyph clipping');
assert(styles.includes('justify-content: flex-start;'), 'Thesis identity should align its content from the logo instead of compressing text to the right edge');
assert(styles.includes('.academic-copy') && styles.includes('flex: 1 1 auto;'), 'Academic copy should be allowed to use the available identity width');
assert(styles.includes('.academic-compact-identity') && styles.includes('display: none;'), 'Compact thesis identity should be hidden by default');
assert(styles.includes('@media (max-width: 820px)') && styles.includes('.academic-compact-identity'), 'Compact thesis identity should appear on compact tablet/mobile ribbon widths');
assert(styles.includes('max-width: min(440px, calc(100% - 136px));'), 'Compact thesis identity should fit beside Solve without overflowing compact ribbons');
assert(styles.includes('font-size: clamp(10px, 1.4vw, 11px);'), 'Compact thesis identity should use larger proportional tablet text');
assert(styles.includes('font-size: clamp(9px, 2.45vw, 9.8px);'), 'Compact thesis identity should use proportional phone text before the narrowest breakpoint');
assert(styles.includes('@media (max-width: 420px)') && styles.includes('max-width: calc(100% - 124px);') && styles.includes('font-size: 9.2px;'), 'Compact thesis identity should stay beside Solve on iPhone-width ribbons');
assert(styles.includes('.ribbon-btn {\n        min-width: 48px;\n        padding: 5px 4px;'), 'iPhone ribbon buttons should be compact enough to keep thesis identity on the first row');
assert(styles.includes('@media (min-width: 1024px) and (max-width: 1366px) and (orientation: landscape)'), 'Tablet/iPad 1024-1366 landscape should keep long thesis identity');
assert(styles.includes('@media (max-width: 1179px)'), 'General tablet scaling should remain below 1180px');
assert(styles.includes('@media (min-width: 1024px) and (max-width: 1179px) and (orientation: landscape)'), '1024px tablet landscape should override general scaling back to the long thesis identity');
assert(styles.includes('.tablet-landscape-notice'), 'Tablet portrait should expose a safe landscape-orientation notice');
assert(indexHtml.includes('id="tabletLandscapeNotice"'), 'Tablet landscape notice should exist in the document');

assert(indexHtml.includes('.academic-identity{flex:1 1 clamp(520px,46vw,760px);'), 'Critical CSS should reserve desktop thesis identity width before async CSS loads');
assert(indexHtml.includes('min-height:68px;'), 'Critical CSS should reserve desktop thesis identity height before async CSS loads');
assert(indexHtml.includes('.academic-copy{min-width:0;flex:1 1 auto;max-width:100%;'), 'Critical CSS should let thesis identity copy use available width');
assert(indexHtml.includes('.academic-compact-identity{display:none;'), 'Critical CSS should define compact thesis identity before async CSS loads');
assert(indexHtml.includes('@media (max-width:820px)') && indexHtml.includes('.academic-compact-identity{order:10;'), 'Critical CSS should show compact thesis identity on small ribbons');
assert(indexHtml.includes('font-size:clamp(10px,1.4vw,11px)'), 'Critical CSS should include larger proportional compact identity text');
assert(indexHtml.includes('.ribbon-btn{min-width:48px;padding:5px 4px}'), 'Critical CSS should compact iPhone ribbon buttons before async CSS loads');
assert(indexHtml.includes('max-width:calc(100% - 124px)') && indexHtml.includes('font-size:9.2px'), 'Critical CSS should keep iPhone compact thesis identity beside Solve');
assert(indexHtml.includes('@media (min-width:1024px) and (max-width:1366px) and (orientation:landscape)'), 'Critical CSS should keep the long thesis identity at 1024px, 1180px, and 1366px tablet landscape');
assert(indexHtml.includes('@media (max-width:1179px)'), 'Critical CSS compact breakpoint should start below 1180px');

assert(smokeTool.includes('thesis identity text should not be clipped in the long ribbon'), 'Browser smoke should fail if desktop/tablet long thesis identity text clips again');
assert(smokeTool.includes('approved four-line desktop/tablet wording'), 'Browser smoke should fail if long desktop/tablet thesis identity wording changes');
assert(smokeTool.includes("'tablet-landscape'"), 'Browser smoke should include 1024x768 tablet in the long thesis identity lock');
assert(smokeTool.includes('tablet portrait should show the landscape orientation notice'), 'Browser smoke should fail if tablet portrait does not show landscape guidance');
assert(smokeTool.includes('desktopAcademicIdentityUnclipped'), 'Browser smoke output should report thesis identity clipping status');
assert(smokeTool.includes('desktopAcademicIdentityLocked'), 'Browser smoke output should report thesis identity lock status');
assert(smokeTool.includes('longAcademicIdentityLocked'), 'Browser smoke output should report long thesis identity lock status');
assert(smokeTool.includes('longAcademicIdentityInViewport'), 'Browser smoke output should report long thesis identity viewport visibility');
assert(smokeTool.includes('compactAcademicIdentityUnclipped'), 'Browser smoke output should report compact thesis identity clipping status');
assert(smokeTool.includes('compactAcademicIdentityLocked'), 'Browser smoke output should report compact thesis identity lock status');
assert(smokeTool.includes('compactAcademicIdentitySameRowAsSolve'), 'Browser smoke should fail if compact thesis identity falls below Solve again');
assert(smokeTool.includes("'iphone-se'"), 'Browser smoke should include the 375x667 iPhone viewport lock');

console.log(JSON.stringify({
    passed: true,
    desktopThesisIdentityWidth: true,
    originalThesisTitlePreserved: true,
    compactIdentityRightOfSolve: true,
    approvedFourLineOrderLocked: true,
    smokeLocked: true
}, null, 2));
