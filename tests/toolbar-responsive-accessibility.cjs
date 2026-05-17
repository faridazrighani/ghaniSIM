const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(indexHtml.includes('id="toolbarPalette" role="toolbar"'), 'Object palette should expose toolbar role');
assert(indexHtml.includes('aria-label="Object toolbar"'), 'Object palette should have an accessible label');
assert(indexHtml.includes('id="toolbarPalette" role="toolbar" aria-label="Object toolbar" tabindex="0"'), 'Object palette should be keyboard-focusable for horizontal scrolling');

assert(styles.includes('.toolbar-tool:hover,\n.toolbar-tool:focus-visible'), 'Toolbar tools should have a visible keyboard focus state');
assert(styles.includes('overscroll-behavior-x: contain'), 'Toolbar palette should contain horizontal touch scroll overscroll');
assert(styles.includes('@media (max-width: 900px)'), 'Responsive toolbar behavior should include tablet/mobile breakpoint');
assert(styles.includes('overflow-x: hidden;') && styles.includes('overflow-x: auto;'), 'Ribbon should avoid page-wide scroll while palette scrolls internally');
assert(styles.includes('scroll-snap-type: x proximity'), 'Toolbar palette should use gentle snap points on small screens');
assert(styles.includes('-webkit-overflow-scrolling: touch'), 'Toolbar palette should support smooth iOS scrolling');
assert(styles.includes('mask-image: linear-gradient') && styles.includes('-webkit-mask-image'), 'Toolbar palette should expose a subtle horizontal scroll affordance');
assert(styles.includes('scroll-snap-align: start'), 'Toolbar groups should align when the palette is horizontally scrolled');
assert(styles.includes('width: 44px') && styles.includes('min-height: 44px'), 'Mobile toolbar tools should keep compact readable touch targets');
assert(styles.includes('flex: 1 0 100%;') && styles.includes('max-width: 100%;'), 'Mobile toolbar palette should occupy a full-width scroll row');
assert(!styles.includes('@media (max-width: 420px) {\n    .toolbar-palette {\n        display: none;'), 'Very small mobile widths should keep the object palette visible');

assert(indexHtml.includes('@media (max-width:900px)') && indexHtml.includes('.toolbar-palette{flex:1 1 auto'), 'Critical CSS should include tablet/mobile palette scroll behavior');
assert(indexHtml.includes('@media (max-width:640px)') && indexHtml.includes('.toolbar-palette{order:20;display:flex;min-height:50px;flex:1 0 100%'), 'Critical CSS should include full-width mobile object palette scroll behavior');
assert(indexHtml.includes('@media (max-width:640px)') && indexHtml.includes('.toolbar-tool{width:44px;min-height:44px'), 'Critical CSS should include compact mobile toolbar touch target sizing');

console.log(JSON.stringify({
    passed: true,
    toolbarRole: true,
    internalPaletteScroll: true,
    mobileTouchTargets: true,
    mobilePaletteVisible: true,
    scrollAffordance: true
}, null, 2));
