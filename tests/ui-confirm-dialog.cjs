const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const menuBarSource = fs.readFileSync(path.join(projectRoot, 'toolbar/menu-bar.js'), 'utf8');
const styles = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

assert(menuBarSource.includes('function showUiConfirm'), 'Menu bar should expose an internal confirmation dialog helper');
assert(menuBarSource.includes('activeUiConfirmDismiss'), 'Confirm helper should dismiss an existing confirm before opening another');
assert(menuBarSource.includes("overlay.setAttribute('role', 'dialog')"), 'Confirm dialog should expose dialog role');
assert(menuBarSource.includes("overlay.setAttribute('aria-modal', 'true')"), 'Confirm dialog should be modal to assistive tech');
assert(menuBarSource.includes("overlay.setAttribute('aria-labelledby'"), 'Confirm dialog should label itself');
assert(menuBarSource.includes("overlay.setAttribute('aria-describedby'"), 'Confirm dialog should describe the confirmation message');
assert(menuBarSource.includes("event.key === 'Escape'"), 'Confirm dialog should cancel with Escape');
assert(menuBarSource.includes("event.key !== 'Tab'"), 'Confirm dialog should trap Tab focus');
assert(menuBarSource.includes('previousFocus.focus'), 'Confirm dialog should restore previous focus after dismissal');
assert(menuBarSource.includes('async function clearSimulationCanvas()'), 'Clear Canvas should wait for async app confirmation');
assert(menuBarSource.includes('await showUiConfirm'), 'Clear Canvas should use the app confirmation dialog');
assert(menuBarSource.includes('if (!confirmed) return false;'), 'Clear Canvas cancel should report false to callers');
assert(menuBarSource.includes('return true;'), 'Clear Canvas confirm should report success to callers');
assert(menuBarSource.includes('const cleared = await clearSimulationCanvas()'), 'New/Close should await Clear Canvas before resetting file state');
assert(menuBarSource.includes('if (!cleared) return false;'), 'New/Close should preserve file state when Clear Canvas is cancelled');
assert(menuBarSource.includes('currentFileHandle = null;'), 'New/Close should clear file handle only after confirmed reset');
assert(menuBarSource.includes("menuNew.addEventListener('click', async"), 'New menu action should await close confirmation');
assert(menuBarSource.includes("menuClose.addEventListener('click', async"), 'Close menu action should await close confirmation');
assert(menuBarSource.includes("menuClearFile.addEventListener('click', async"), 'File Clear Canvas action should await confirmation');
assert(menuBarSource.includes("menuClear.addEventListener('click', async"), 'Edit Clear Canvas action should await confirmation');
assert(menuBarSource.includes("confirmLabel: 'Clear Canvas'"), 'Clear Canvas confirm action should be explicit');
assert(menuBarSource.includes("cancelLabel: 'Keep Model'"), 'Clear Canvas cancel action should be the safe default');
assert(!/(^|[^\w])confirm\(/.test(menuBarSource), 'Menu actions should not use blocking browser confirm()');

assert(styles.includes('.ui-confirm-modal'), 'Confirm modal should be styled');
assert(styles.includes('.ui-confirm-window'), 'Confirm window should be styled');
assert(styles.includes('.ui-confirm-actions'), 'Confirm actions should be styled');
assert(styles.includes('.ui-confirm-danger'), 'Danger confirmation style should exist');
assert(styles.includes('.ui-confirm-exit'), 'Confirm dialog should have an exit transition');
assert(styles.includes('@media (max-width: 640px)') && styles.includes('.ui-confirm-actions') && styles.includes('column-reverse'), 'Confirm dialog should adapt to mobile bottom-sheet layout');

console.log(JSON.stringify({
    passed: true,
    internalConfirmDialog: true,
    noBrowserConfirm: true,
    accessibleDialog: true,
    mobileLayout: true
}, null, 2));
