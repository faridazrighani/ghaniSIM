const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const menuBar = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');
const contextMenu = fs.readFileSync(path.join(projectRoot, 'ui/context-menu.js'), 'utf8');
const taskWindow = fs.readFileSync(path.join(projectRoot, 'ui/task-window.js'), 'utf8');
const canvasManager = fs.readFileSync(path.join(projectRoot, 'ui/canvas-manager.js'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(indexHtml.includes('id="taskWindow" role="dialog"'), 'Task Window should expose dialog role');
assert(indexHtml.includes('tabindex="-1"'), 'Task Window should be programmatically focusable');

assert(menuBar.includes('function initMenuBar()'), 'Menu bar initializer should exist');
assert(menuBar.includes('upgradeMenuKeyboardAccessibility'), 'Menu bar should upgrade keyboard accessibility');
assert(menuBar.includes("trigger.setAttribute('role', 'button')"), 'Top menu text triggers should get button role');
assert(menuBar.includes("trigger.setAttribute('tabindex', '0')"), 'Top menu text triggers should be keyboard-focusable');
assert(menuBar.includes("trigger.setAttribute('aria-haspopup', 'menu')"), 'Top menu triggers should announce menu popups');
assert(menuBar.includes("content.setAttribute('role', 'menu')"), 'Dropdown content should expose menu role');
assert(menuBar.includes("button.setAttribute('role', 'menuitem')"), 'Dropdown buttons should expose menuitem role');
assert(menuBar.includes("event.key === 'ArrowDown'"), 'Dropdown keyboard navigation should support ArrowDown');
assert(menuBar.includes("event.key === 'ArrowUp'"), 'Dropdown keyboard navigation should support ArrowUp');
assert(menuBar.includes("event.key === 'ArrowRight'"), 'Dropdown submenu keyboard navigation should support ArrowRight');
assert(menuBar.includes("event.key === 'ArrowLeft'"), 'Dropdown submenu keyboard navigation should support ArrowLeft');
assert(menuBar.includes("event.key === 'Escape'"), 'Dropdown keyboard navigation should support Escape close');

assert(contextMenu.includes("menu.setAttribute('role', 'menu')"), 'Canvas context menu should expose menu role');
assert(contextMenu.includes("menu.setAttribute('aria-hidden', 'true')"), 'Canvas context menu should expose hidden state');
assert(contextMenu.includes("btn.setAttribute('role', 'menuitem')"), 'Canvas context menu buttons should expose menuitem role');
assert(contextMenu.includes('function handleContextMenuKeydown'), 'Canvas context menu should handle keyboard navigation');
assert(contextMenu.includes("e.key === 'ArrowDown'"), 'Canvas context menu should support ArrowDown');
assert(contextMenu.includes("e.key === 'ArrowUp'"), 'Canvas context menu should support ArrowUp');
assert(contextMenu.includes("e.key === 'Home'"), 'Canvas context menu should support Home');
assert(contextMenu.includes("e.key === 'End'"), 'Canvas context menu should support End');
assert(contextMenu.includes("e.key === 'Escape'"), 'Canvas context menu should support Escape');
assert(contextMenu.includes('focusContextMenuButton(menu, 0)'), 'Canvas context menu should move focus into opened menu');

assert(indexHtml.includes('id="toolbarObjectMenuButton"'), 'Legacy mobile object menu button markup may remain for compatibility');
assert(styles.includes('Locked UX: the ribbon must not show the large Objects button'), 'Objects ribbon button should be hidden by locked UX rule');
assert(styles.includes('.toolbar-object-menu-container {\n        order: 8;\n        display: none !important;'), 'Objects ribbon button should remain hidden on mobile/tablet widths');
assert(indexHtml.includes('id="toolbarObjectMenu" role="menu"'), 'Legacy mobile object menu markup may remain dormant');
assert(indexHtml.includes('aria-controls="toolbarObjectMenu"'), 'Legacy mobile object menu button should keep its relationship if re-enabled intentionally');
assert(canvasManager.includes('function renderToolbarObjectMenu()'), 'Mobile object menu should be rendered from the toolbar catalog');
assert(canvasManager.includes("itemButton.setAttribute('role', 'menuitem')"), 'Mobile object menu items should expose menuitem role');
assert(canvasManager.includes("button.setAttribute('aria-expanded'"), 'Mobile object menu should update expanded state');
assert(canvasManager.includes("event.key === 'ArrowDown'") && canvasManager.includes("event.key === 'ArrowUp'"), 'Mobile object menu should support arrow navigation');
assert(canvasManager.includes("event.key === 'Home'") && canvasManager.includes("event.key === 'End'"), 'Mobile object menu should support Home/End navigation');
assert(canvasManager.includes("closeToolbarObjectMenu({ focusButton: true })"), 'Mobile object menu Escape should return focus to the menu button');

assert(styles.includes('.menu-item:focus-visible'), 'Top menu keyboard focus should be visible');
assert(styles.includes('.context-menu button:focus-visible'), 'Context menu keyboard focus should be visible');
assert(styles.includes('.toolbar-object-menu-item:focus-visible'), 'Mobile object menu focus should be visible');

assert(taskWindow.includes('taskWindow.focus({ preventScroll: true })'), 'Task Window should receive focus when opened');
assert(taskWindow.includes("taskWindow.setAttribute('aria-expanded', 'false')"), 'Task Window should update expanded state on close');
assert(taskWindow.includes("closeTaskWindow({ focusReturn: true })"), 'Task Window user close/Escape should return focus to the recovery control');
assert(taskWindow.includes('focusTaskWindowLauncher(focusLauncherKind, focusLauncherNodeId)'), 'Task Window close should focus the launcher when one is created');
assert(taskWindow.includes('focusObjectTaskDockEntry(activeObjectTask.kind, activeObjectTask.nodeId)'), 'Task Window minimize should focus the dock restore button when requested');

assert(canvasManager.includes("const item = document.createElement('button')"), 'Warning items should be native keyboard-activatable buttons');
assert(canvasManager.includes("item.type = 'button'"), 'Warning item buttons should not submit forms');

console.log(JSON.stringify({
    passed: true,
    menuKeyboardNavigation: true,
    contextMenuKeyboardNavigation: true,
    objectPaletteKeyboardNavigation: true,
    objectMenuHidden: true,
    taskWindowFocus: true,
    warningButtons: true
}, null, 2));
