const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');

assert(indexHtml.includes('id="toolbarObjectMenuButton"'), 'Mobile object overflow button should exist in the ribbon');
assert(indexHtml.includes('id="toolbarObjectMenu" role="menu"'), 'Grouped object overflow menu should expose menu semantics');
assert(indexHtml.includes('aria-controls="toolbarObjectMenu"'), 'Object overflow button should control the grouped menu');

assert(styles.includes('.toolbar-object-menu-container'), 'Object overflow menu container should be styled');
assert(styles.includes('@media (max-width: 640px)') && styles.includes('.toolbar-object-menu-container {\n        order: 8;\n        display: block;'), 'Object overflow menu should remain available as a mobile fallback');
assert(styles.includes('@media (max-width: 420px)') && styles.includes('.toolbar-palette {\n        display: flex;'), 'Very small screens should keep the object palette visible');
assert(!styles.includes('.toolbar-palette {\n        display: none;'), 'Mobile object palette should not be hidden behind the grouped menu');
assert(styles.includes('flex: 1 0 100%;') && styles.includes('min-width: 100%;'), 'Mobile object palette should get a full-width horizontal scroll row');
assert(styles.includes('overflow-x: auto;') && styles.includes('-webkit-overflow-scrolling: touch'), 'Mobile object palette should prioritize touch horizontal scrolling');
assert(styles.includes('.toolbar-object-menu-grid'), 'Grouped object menu should use a responsive grid');

assert(canvasManager.includes('function renderToolbarObjectMenu()'), 'Grouped object menu should be rendered from the shared toolbar catalog');
assert(canvasManager.includes('function getToolbarObjectMenuItems('), 'Grouped object menu should expose a reusable item list for keyboard navigation');
assert(canvasManager.includes('function focusToolbarObjectMenuItem('), 'Grouped object menu should centralize menu-item focus movement');
assert(canvasManager.includes('addToolbarObjectFromMenu(item)'), 'Grouped object menu items should use the same add-equipment flow');
assert(canvasManager.includes("addEquipment(item.type, null, { placementMode: 'ribbon-click' })"), 'Object overflow clicks should use the existing rightward placement behavior');
assert(canvasManager.includes("button.setAttribute('aria-expanded'"), 'Object overflow button should update aria-expanded');
assert(canvasManager.includes("event.key === 'ArrowDown'") && canvasManager.includes("event.key === 'ArrowUp'"), 'Object overflow menu should support arrow-key navigation');
assert(canvasManager.includes("event.key === 'Home'") && canvasManager.includes("event.key === 'End'"), 'Object overflow menu should support Home/End navigation');
assert(canvasManager.includes("closeToolbarObjectMenu({ focusButton: true })"), 'Object overflow menu should return focus to the button when Escape is pressed inside the menu');

console.log(JSON.stringify({
    passed: true,
    groupedObjectOverflow: true,
    mobilePaletteVisible: true,
    horizontalScrollPrimary: true,
    mobileMenu: true,
    catalogDriven: true,
    accessibleDisclosure: true
}, null, 2));
