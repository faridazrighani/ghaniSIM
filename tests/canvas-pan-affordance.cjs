const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(!indexHtml.includes('id="canvasPanHint"'), 'Canvas should not render the pan/scroll hint markup');
assert(!indexHtml.includes('Pan / scroll canvas'), 'Canvas should not show the pan/scroll hint text');
assert(styles.includes('.canvas-pan-hint'), 'Legacy pan hint selector should remain available for hard hiding');
assert(styles.includes('.canvas-pan-hint {\n    display: none !important;\n}'), 'Legacy pan hint should be forcibly hidden if stale markup exists');
assert(!styles.includes('.canvas-pan-hint {\n        display: block;'), 'Pan hint should not show on tablet/mobile viewport rules');

console.log(JSON.stringify({
    passed: true,
    canvasPanHintRemoved: true,
    nonBlockingCanvas: true
}, null, 2));
