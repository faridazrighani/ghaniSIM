// --- Menu Bar Logic & State Management ---

// History State
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 20;
let currentFileHandle = null;
const HYSYS_FILE_TYPES = [{
    description: 'HYSYS Simulator File',
    accept: {'application/json': ['.hysys', '.json']}
}];
let uiToastCounter = 0;
let activeUiConfirmDismiss = null;

function getUiToastRegion() {
    let region = document.getElementById('uiToastRegion');
    if (region) return region;

    region = document.createElement('div');
    region.id = 'uiToastRegion';
    region.className = 'ui-toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'false');
    document.body.appendChild(region);
    return region;
}

function showUiToast(message, options = {}) {
    if (!message || typeof document === 'undefined') return null;

    const region = getUiToastRegion();
    const toast = document.createElement('div');
    const variant = options.variant || 'info';
    const duration = Number.isFinite(options.duration) ? options.duration : 4200;
    const toastId = `ui-toast-${++uiToastCounter}`;

    toast.id = toastId;
    toast.className = `ui-toast ui-toast-${variant}`;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');

    const body = document.createElement('div');
    body.className = 'ui-toast-body';

    if (options.title) {
        const title = document.createElement('strong');
        title.textContent = options.title;
        body.appendChild(title);
    }

    const text = document.createElement('span');
    text.textContent = message;
    body.appendChild(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ui-toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = 'X';

    const dismiss = () => {
        toast.classList.add('ui-toast-exit');
        window.setTimeout(() => toast.remove(), 160);
    };

    close.addEventListener('click', dismiss);
    toast.append(body, close);
    region.appendChild(toast);

    if (duration > 0) {
        window.setTimeout(dismiss, duration);
    }

    return toastId;
}

function showUiConfirm(options = {}) {
    if (typeof document === 'undefined') return Promise.resolve(false);

    if (typeof activeUiConfirmDismiss === 'function') {
        activeUiConfirmDismiss(false);
    }

    const titleText = options.title || 'Confirm action';
    const messageText = options.message || 'Continue with this action?';
    const confirmLabel = options.confirmLabel || 'Continue';
    const cancelLabel = options.cancelLabel || 'Cancel';
    const variant = options.variant || 'danger';
    const confirmId = `ui-confirm-${Date.now()}`;
    const previousFocus = document.activeElement;

    return new Promise(resolve => {
        let settled = false;
        const overlay = document.createElement('div');
        overlay.className = 'ui-confirm-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', `${confirmId}-title`);
        overlay.setAttribute('aria-describedby', `${confirmId}-message`);

        const windowEl = document.createElement('div');
        windowEl.className = 'ui-confirm-window';

        const header = document.createElement('div');
        header.className = 'ui-confirm-header';

        const title = document.createElement('h2');
        title.id = `${confirmId}-title`;
        title.textContent = titleText;

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'ui-confirm-close';
        close.setAttribute('aria-label', 'Cancel confirmation');
        close.textContent = 'X';

        header.append(title, close);

        const body = document.createElement('p');
        body.id = `${confirmId}-message`;
        body.className = 'ui-confirm-message';
        body.textContent = messageText;

        const actions = document.createElement('div');
        actions.className = 'ui-confirm-actions';

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'ui-confirm-btn ui-confirm-cancel';
        cancel.textContent = cancelLabel;

        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = `ui-confirm-btn ui-confirm-primary ui-confirm-${variant}`;
        confirm.textContent = confirmLabel;

        actions.append(cancel, confirm);
        windowEl.append(header, body, actions);
        overlay.appendChild(windowEl);
        document.body.appendChild(overlay);

        const dismiss = value => {
            if (settled) return;
            settled = true;
            if (activeUiConfirmDismiss === dismiss) activeUiConfirmDismiss = null;
            document.removeEventListener('keydown', handleKeydown, true);
            overlay.classList.add('ui-confirm-exit');
            window.setTimeout(() => overlay.remove(), 140);
            if (previousFocus && typeof previousFocus.focus === 'function') {
                window.setTimeout(() => previousFocus.focus(), 0);
            }
            resolve(!!value);
        };

        const getFocusable = () => Array.from(overlay.querySelectorAll('button'));
        const handleKeydown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                dismiss(false);
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = getFocusable();
            if (!focusable.length) return;
            const currentIndex = focusable.indexOf(document.activeElement);
            const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
                : (currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);
            event.preventDefault();
            focusable[nextIndex].focus();
        };

        activeUiConfirmDismiss = dismiss;
        close.addEventListener('click', () => dismiss(false));
        cancel.addEventListener('click', () => dismiss(false));
        confirm.addEventListener('click', () => dismiss(true));
        overlay.addEventListener('click', event => {
            if (event.target === overlay) dismiss(false);
        });
        document.addEventListener('keydown', handleKeydown, true);
        window.setTimeout(() => cancel.focus(), 0);
    });
}

function downloadSimulationFile() {
    const json = getSimulationState();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    link.href = url;
    link.download = `hysys-simulation-${timestamp}.hysys`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showUiToast('Simulation file download has started.', {
        title: 'Save As',
        variant: 'success'
    });
}

function openSimulationFileFallback() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.hysys,.json,application/json';
        input.style.display = 'none';

        input.addEventListener('change', async () => {
            try {
                const file = input.files && input.files[0];
                if (!file) return resolve();
                const text = await file.text();
                applySimulationState(text);
                currentFileHandle = null;
                undoStack = [];
                redoStack = [];
                resolve(true);
            } catch (err) {
                reject(err);
            } finally {
                input.remove();
            }
        }, { once: true });

        input.addEventListener('cancel', () => {
            input.remove();
            resolve(false);
        }, { once: true });

        document.body.appendChild(input);
        input.click();
    });
}

function getSimulationState() {
    const data = {
        model: globalModel,
        connections: connections,
        instrumentLinks: instrumentLinks,
        sourceLinks: sourceLinks,
        visuals: {}
    };
    document.querySelectorAll('.pfd-object').forEach(el => {
        if (el.dataset.id === 'FLUID') return;
        data.visuals[el.dataset.id] = {
            left: el.style.left,
            top: el.style.top
        };
    });
    return JSON.stringify(data);
}

function applySimulationState(jsonString) {
    const data = JSON.parse(jsonString);
    if(!data.model || !data.connections) throw new Error("Invalid format");
    const hadSettings = !!data.model.SETTINGS;
    
    Object.keys(globalModel).forEach(k => delete globalModel[k]);
    Object.assign(globalModel, data.model);
    if (typeof ensureSimulationSettings === 'function') {
        ensureSimulationSettings(globalModel);
        if (!hadSettings && globalModel.SETTINGS?.props) {
            globalModel.SETTINGS.props.unitStandard = typeof DEFAULT_UNIT_STANDARD !== 'undefined'
                ? DEFAULT_UNIT_STANDARD
                : 'Metric / European Engineering';
            globalModel.SETTINGS.props.basisConfirmed = true;
            globalModel.SETTINGS.props.basisDirty = false;
            globalModel.SETTINGS.props.migratedFromLegacy = true;
            globalModel.SETTINGS.props.lastConfirmedUnitStandard = globalModel.SETTINGS.props.unitStandard;
            globalModel.SETTINGS.props.lastConfirmedFluid = globalModel.FLUID?.props?.fluidName || '';
            globalModel.SETTINGS.props.lastConfirmedTemperature = globalModel.FLUID?.props?.temp ?? null;
        }
    }
    if (globalModel.FLUID) globalModel.FLUID.name = 'Fluid Basis';
    if (typeof normalizePipeProps === 'function') {
        Object.keys(globalModel).forEach(nodeId => {
            if (globalModel[nodeId]?.type === 'pipe') {
                normalizePipeProps(globalModel[nodeId].props, nodeId);
                globalModel[nodeId].name = globalModel[nodeId].name || nodeId;
            }
        });
    }
    connections.splice(0, connections.length, ...data.connections);
    instrumentLinks.splice(0, instrumentLinks.length, ...(data.instrumentLinks || []));
    sourceLinks.splice(0, sourceLinks.length, ...(data.sourceLinks || []));
    if (typeof syncSourceAttachmentProps === 'function') {
        Object.keys(globalModel).forEach(nodeId => {
            if (globalModel[nodeId]?.type === 'source') {
                syncSourceAttachmentProps(nodeId);
                if (typeof syncSourceTemperatureFromFluidBasis === 'function') {
                    syncSourceTemperatureFromFluidBasis(nodeId);
                }
                if (typeof syncSourceFlowFromInputMode === 'function') {
                    syncSourceFlowFromInputMode(nodeId);
                }
            }
        });
    }
    
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.pfd-object').forEach(el => el.remove());
    
    for (let key in globalModel) {
        if (key === 'FLUID' || key === 'SETTINGS' || globalModel[key].type === 'pipe') continue;
        
        const node = globalModel[key];
        const div = document.createElement('div');
        const type = node.type;
        div.className = getObjectClassName(type);
        div.id = 'obj-' + key.toLowerCase().replace(/-/g, '');
        div.dataset.id = key;
        div.dataset.type = type;
        
        if (data.visuals && data.visuals[key]) {
            div.style.left = data.visuals[key].left;
            div.style.top = data.visuals[key].top;
        } else {
            div.style.left = '300px';
            div.style.top = '300px';
        }
        
        div.innerHTML = getObjectMarkup(type, key, node.desc || getDefaultDescription(type));
        
        canvas.appendChild(div);
        applyObjectVisuals(key);
        makeDraggable(div);
    }
    
    currentSelectedNode = null;
    renderSidebar(null);
    if (typeof clearObjectTaskMinimizedDock === 'function') clearObjectTaskMinimizedDock();
    updateSimulation({ renderSidebarAfter: false });
    drawConnections();
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();
}

function captureState() {
    undoStack.push(getSimulationState());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
}

function undoAction() {
    if (undoStack.length === 0) return;
    redoStack.push(getSimulationState());
    applySimulationState(undoStack.pop());
}

function redoAction() {
    if (redoStack.length === 0) return;
    undoStack.push(getSimulationState());
    applySimulationState(redoStack.pop());
}

async function clearSimulationCanvas() {
    const confirmed = await showUiConfirm({
        title: 'Clear Canvas',
        message: 'Clear all equipment, pipes, connections, and unsaved changes from the canvas?',
        confirmLabel: 'Clear Canvas',
        cancelLabel: 'Keep Model',
        variant: 'danger'
    });
    if (!confirmed) return false;

    captureState();
    
    Object.keys(globalModel).forEach(k => delete globalModel[k]);
    if (typeof createDefaultSimulationSettings === 'function') {
        globalModel.SETTINGS = createDefaultSimulationSettings();
    }
    globalModel["FLUID"] = { 
        type: "fluid", 
        name: "Fluid Basis", 
        props: { 
            inputMode: "Basic",
            fluidName: "Water", 
            temp: 25, 
            density: 997,
            sg: 0.997, 
            viscosity: 0.89,
            dynViscosity: 0.89,
            vaporPressure: 0.0317,
            specificHeat: 4.18,
            bulkModulus: 2.2,
            specVolume: 0.001,
            specWeight: 9780,
            vaporPressureHead: 0.3241119893830319,
            speedOfSound: 1482
        } 
    };
    if (typeof updateWaterProperties === 'function') updateWaterProperties();
    connections.splice(0, connections.length);
    instrumentLinks.splice(0, instrumentLinks.length);
    sourceLinks.splice(0, sourceLinks.length);
    
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.pfd-object').forEach(el => el.remove());

    currentSelectedNode = null;
    renderSidebar(null);
    if (typeof clearObjectTaskMinimizedDock === 'function') clearObjectTaskMinimizedDock();
    drawConnections();
    updateSimulation();
    if (typeof updateBasisStatusPill === 'function') updateBasisStatusPill();
    return true;
}

async function fileClose() {
    const cleared = await clearSimulationCanvas();
    if (!cleared) return false;
    currentFileHandle = null;
    return true;
}

async function fileSaveAs() {
    if (!window.showSaveFilePicker) {
        downloadSimulationFile();
        return;
    }

    try {
        const handle = await window.showSaveFilePicker({
            types: HYSYS_FILE_TYPES
        });
        currentFileHandle = handle;
        await fileSave();
    } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error(err);
    }
}

async function fileSave() {
    if (!currentFileHandle) {
        return fileSaveAs();
    }

    try {
        const json = getSimulationState();
        
        const writable = await currentFileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        showUiToast('File saved successfully.', {
            title: 'Save',
            variant: 'success'
        });
    } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error(err);
        showUiToast('Failed to save file. Please check browser file permissions and try again.', {
            title: 'Save failed',
            variant: 'error',
            duration: 6200
        });
    }
}

async function fileOpen() {
    try {
        const loaded = await openSimulationFileFallback();
        if (loaded) {
            showUiToast('Simulation file loaded successfully.', {
                title: 'Open',
                variant: 'success'
            });
        }
    } catch (err) {
        console.error(err);
        showUiToast('Failed to open file. Please choose a valid .hysys or .json file saved by this app.', {
            title: 'Open failed',
            variant: 'error',
            duration: 7200
        });
    }
}

function openFluidBasis() {
    if (!globalModel.FLUID) return;
    globalModel.FLUID.name = 'Fluid Basis';
    if (typeof setAppMode === 'function') setAppMode('SELECT');
    if (typeof hideContextMenu === 'function') hideContextMenu();
    if (typeof openFluidBasisTaskWindow === 'function') {
        openFluidBasisTaskWindow();
    } else {
        selectNode('FLUID', null);
    }
}

function runHydraulicEvaluationFromMenu() {
    if (typeof runUserRequestedSolve === 'function') {
        runUserRequestedSolve();
    } else {
        if (typeof updateSimulation === 'function') updateSimulation();
        if (typeof drawConnections === 'function') drawConnections();
        if (typeof updateAllObjectOperatingStatusVisuals === 'function') updateAllObjectOperatingStatusVisuals();
    }

    if (typeof showUiToast === 'function') {
        showUiToast('Hydraulic and NPSH evaluation has been refreshed.', {
            title: 'Simulation',
            variant: 'success',
            duration: 3200
        });
    }
}

function refreshCalculationsFromMenu() {
    if (typeof updateSimulation === 'function') updateSimulation({ renderSidebarAfter: false });
    if (typeof drawConnections === 'function') drawConnections();
    if (typeof updateAllObjectOperatingStatusVisuals === 'function') updateAllObjectOperatingStatusVisuals();
    if (typeof updateCanvasWarningPanel === 'function') updateCanvasWarningPanel();

    if (typeof showUiToast === 'function') {
        showUiToast('Calculations, connection labels, and warning status were refreshed.', {
            title: 'Refresh complete',
            variant: 'success',
            duration: 3600
        });
    }
}

function exportScenarioTraceFromMenu() {
    if (typeof exportScenarioCalculationTraceToExcel === 'function') {
        exportScenarioCalculationTraceToExcel();
    } else if (typeof showUiToast === 'function') {
        showUiToast('Excel export module is not available. Please reload the application.', {
            title: 'Export unavailable',
            variant: 'error'
        });
    }
}

function resetCanvasViewFromMenu() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    canvas.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    if (typeof positionCanvasWarningPanelDefault === 'function') {
        window.setTimeout(positionCanvasWarningPanelDefault, 180);
    }
    if (typeof drawConnections === 'function') {
        window.setTimeout(drawConnections, 200);
    }
    if (typeof showUiToast === 'function') {
        showUiToast('Canvas view reset to the upper-left workspace.', {
            title: 'View',
            variant: 'info',
            duration: 3000
        });
    }
}

function showWarningsPanelFromMenu() {
    if (typeof updateCanvasWarningPanel === 'function') updateCanvasWarningPanel();
    const panel = document.getElementById('canvasWarningPanel');
    const count = parseInt(document.getElementById('canvasWarningCount')?.textContent || '0', 10);

    if (!panel || panel.hidden || !Number.isFinite(count) || count <= 0) {
        if (typeof showUiToast === 'function') {
            showUiToast('No active equipment warnings are currently shown.', {
                title: 'Warnings',
                variant: 'info',
                duration: 3200
            });
        }
        return;
    }

    if (typeof setCanvasWarningPanelCollapsed === 'function') {
        setCanvasWarningPanelCollapsed(false);
    }
    if (typeof positionCanvasWarningPanelDefault === 'function' && panel.dataset.userMoved !== 'true') {
        positionCanvasWarningPanelDefault();
    }
    const header = document.getElementById('canvasWarningHeader');
    header?.focus?.({ preventScroll: true });
}

function openAboutDialog() {
    const modal = document.getElementById('aboutModal');
    const closeButton = document.getElementById('closeAbout');
    if (!modal) return;

    modal.hidden = false;
    closeButton?.focus();
}

function closeAboutDialog() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.hidden = true;
}

// Menu Initialization
function initMenuBar() {
    const positionDropdown = (container, dropdown) => {
        const rect = container.getBoundingClientRect();
        dropdown.style.left = `${Math.max(6, Math.min(rect.left, window.innerWidth - dropdown.offsetWidth - 6))}px`;
        dropdown.style.top = `${Math.min(rect.bottom + 2, window.innerHeight - 8)}px`;
    };

    const getMenuDropdownTrigger = (container) => container?.querySelector(':scope > .menu-item[id]');

    const getVisibleMenuButtons = (content) => Array.from(content?.querySelectorAll('button') || [])
        .filter(button => !button.disabled && button.getClientRects().length > 0);

    const syncMenuDropdownAria = () => {
        document.querySelectorAll('.menu-dropdown').forEach(container => {
            const trigger = getMenuDropdownTrigger(container);
            const content = container.querySelector(':scope > .dropdown-content');
            if (!trigger || !content) return;
            trigger.setAttribute('aria-expanded', container.classList.contains('show') ? 'true' : 'false');
            content.setAttribute('aria-hidden', container.classList.contains('show') ? 'false' : 'true');
            container.querySelectorAll('.dropdown-submenu').forEach(submenu => {
                const submenuTrigger = submenu.querySelector(':scope > .dropdown-submenu-trigger');
                if (submenuTrigger) {
                    submenuTrigger.setAttribute('aria-expanded', submenu.classList.contains('show-submenu') ? 'true' : 'false');
                }
            });
        });
    };

    const closeAllMenuDropdowns = (except = null) => {
        document.querySelectorAll('.menu-dropdown.show').forEach(container => {
            if (container !== except) container.classList.remove('show');
        });
        document.querySelectorAll('.dropdown-submenu.show-submenu').forEach(submenu => {
            if (!except || !except.contains(submenu)) submenu.classList.remove('show-submenu');
        });
        syncMenuDropdownAria();
    };

    const focusVisibleMenuButton = (content, index) => {
        const buttons = getVisibleMenuButtons(content);
        if (!buttons.length) return;
        const normalizedIndex = (index + buttons.length) % buttons.length;
        buttons[normalizedIndex].focus();
    };

    const handleMenuTriggerKeydown = (event, container, content, trigger) => {
        if (!container || !content || !trigger) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            trigger.click();
            if (container.classList.contains('show')) {
                window.setTimeout(() => focusVisibleMenuButton(content, 0), 0);
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!container.classList.contains('show')) trigger.click();
            window.setTimeout(() => focusVisibleMenuButton(content, 0), 0);
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeAllMenuDropdowns();
            trigger.focus();
        }
    };

    const handleDropdownContentKeydown = (event, container, content, trigger) => {
        const buttons = getVisibleMenuButtons(content);
        if (!buttons.length) return;
        const active = document.activeElement;
        const activeIndex = Math.max(0, buttons.indexOf(active));

        if (event.key === 'Escape') {
            event.preventDefault();
            container.classList.remove('show');
            container.querySelectorAll('.dropdown-submenu.show-submenu').forEach(submenu => submenu.classList.remove('show-submenu'));
            syncMenuDropdownAria();
            trigger.focus();
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusVisibleMenuButton(content, activeIndex + 1);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusVisibleMenuButton(content, activeIndex - 1);
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            focusVisibleMenuButton(content, 0);
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            focusVisibleMenuButton(content, buttons.length - 1);
            return;
        }

        if (event.key === 'ArrowRight' && active?.classList?.contains('dropdown-submenu-trigger')) {
            event.preventDefault();
            const submenu = active.closest('.dropdown-submenu');
            const submenuContent = submenu?.querySelector(':scope > .dropdown-submenu-content');
            submenu?.classList.add('show-submenu');
            active.setAttribute('aria-expanded', 'true');
            const submenuButtons = getVisibleMenuButtons(submenuContent);
            if (submenuButtons.length) submenuButtons[0].focus();
            return;
        }

        if (event.key === 'ArrowLeft') {
            const submenuContent = active?.closest?.('.dropdown-submenu-content');
            const submenu = submenuContent?.closest?.('.dropdown-submenu');
            const submenuTrigger = submenu?.querySelector(':scope > .dropdown-submenu-trigger');
            if (submenu && submenuTrigger) {
                event.preventDefault();
                submenu.classList.remove('show-submenu');
                submenuTrigger.setAttribute('aria-expanded', 'false');
                submenuTrigger.focus();
            }
        }
    };

    const upgradeMenuKeyboardAccessibility = () => {
        document.querySelectorAll('.menu-dropdown').forEach(container => {
            const trigger = getMenuDropdownTrigger(container);
            const content = container.querySelector(':scope > .dropdown-content');
            if (!trigger || !content || container.dataset.keyboardInitialized === 'true') return;

            trigger.setAttribute('role', 'button');
            trigger.setAttribute('tabindex', '0');
            trigger.setAttribute('aria-haspopup', 'menu');
            trigger.setAttribute('aria-controls', content.id || '');
            trigger.setAttribute('aria-expanded', container.classList.contains('show') ? 'true' : 'false');
            content.setAttribute('role', 'menu');
            content.setAttribute('aria-hidden', container.classList.contains('show') ? 'false' : 'true');
            content.querySelectorAll('button').forEach(button => button.setAttribute('role', 'menuitem'));

            trigger.addEventListener('click', () => window.setTimeout(syncMenuDropdownAria, 0));
            trigger.addEventListener('keydown', event => handleMenuTriggerKeydown(event, container, content, trigger));
            content.addEventListener('keydown', event => handleDropdownContentKeydown(event, container, content, trigger));
            container.dataset.keyboardInitialized = 'true';
        });

        if (document.body.dataset.menuKeyboardGlobalInitialized !== 'true') {
            document.addEventListener('click', () => window.setTimeout(syncMenuDropdownAria, 0));
            document.addEventListener('keydown', event => {
                if (event.key !== 'Escape') return;
                closeAllMenuDropdowns();
            });
            document.body.dataset.menuKeyboardGlobalInitialized = 'true';
        }

        syncMenuDropdownAria();
    };

    // File Menu Logic
    const menuFile = document.getElementById('menu-file');
    const fileDropdown = document.getElementById('file-dropdown-container');
    const menuSimulate = document.getElementById('menu-simulate');
    const simulateDropdown = document.getElementById('simulate-dropdown-container');
    const menuTools = document.getElementById('menu-tools');
    const toolsDropdown = document.getElementById('tools-dropdown-container');
    const menuView = document.getElementById('menu-view');
    const viewDropdown = document.getElementById('view-dropdown-container');
    
    if (menuFile && fileDropdown) {
        const fileDropdownContent = document.getElementById('dropdown-file');
        menuFile.addEventListener('click', (e) => {
            e.stopPropagation();
            editDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            simulateDropdown?.classList.remove('show');
            toolsDropdown?.classList.remove('show');
            viewDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            fileDropdown.classList.toggle('show');
            if (fileDropdown.classList.contains('show') && fileDropdownContent) {
                positionDropdown(fileDropdown, fileDropdownContent);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!fileDropdown.contains(e.target)) {
                fileDropdown.classList.remove('show');
            }
        });

        const menuNew = document.getElementById('menu-new');
        if(menuNew) {
            menuNew.addEventListener('click', async (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                await fileClose();
            });
        }

        const menuOpen = document.getElementById('menu-open');
        if(menuOpen) {
            menuOpen.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileOpen();
            });
        }

        const menuSave = document.getElementById('menu-save');
        if(menuSave) {
            menuSave.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileSave();
            });
        }

        const menuSaveAs = document.getElementById('menu-save-as');
        if(menuSaveAs) {
            menuSaveAs.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileSaveAs();
            });
        }

        const menuFileExport = document.getElementById('menu-file-export');
        const fileExportSubmenu = menuFileExport?.closest('.dropdown-submenu');
        if (menuFileExport && fileExportSubmenu) {
            menuFileExport.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileExportSubmenu.classList.toggle('show-submenu');
                menuFileExport.setAttribute(
                    'aria-expanded',
                    fileExportSubmenu.classList.contains('show-submenu') ? 'true' : 'false'
                );
            });
        }

        const menuExportExcelTrace = document.getElementById('menu-export-excel-trace');
        if (menuExportExcelTrace) {
            menuExportExcelTrace.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileExportSubmenu?.classList.remove('show-submenu');
                if (menuFileExport) menuFileExport.setAttribute('aria-expanded', 'false');
                exportScenarioTraceFromMenu();
            });
        }

        const menuClearFile = document.getElementById('menu-clear-file');
        if(menuClearFile) {
            menuClearFile.addEventListener('click', async (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                await clearSimulationCanvas();
            });
        }
        
        const menuClose = document.getElementById('menu-close');
        if(menuClose) {
            menuClose.addEventListener('click', async (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                await fileClose();
            });
        }
    }

    // Edit Menu Logic
    const menuEdit = document.getElementById('menu-edit');
    const editDropdown = document.getElementById('edit-dropdown-container');
    
    if (menuEdit && editDropdown) {
        const editDropdownContent = document.getElementById('dropdown-edit');
        menuEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            simulateDropdown?.classList.remove('show');
            toolsDropdown?.classList.remove('show');
            viewDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            editDropdown.classList.toggle('show');
            if (editDropdown.classList.contains('show') && editDropdownContent) {
                positionDropdown(editDropdown, editDropdownContent);
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!editDropdown.contains(e.target)) {
                editDropdown.classList.remove('show');
            }
        });

        const menuUndo = document.getElementById('menu-undo');
        if(menuUndo) {
            menuUndo.addEventListener('click', (e) => {
                e.preventDefault();
                editDropdown.classList.remove('show');
                undoAction();
            });
        }

        const menuRedo = document.getElementById('menu-redo');
        if(menuRedo) {
            menuRedo.addEventListener('click', (e) => {
                e.preventDefault();
                editDropdown.classList.remove('show');
                redoAction();
            });
        }

        const menuClear = document.getElementById('menu-clear');
        if(menuClear) {
            menuClear.addEventListener('click', async (e) => {
                e.preventDefault();
                editDropdown.classList.remove('show');
                await clearSimulationCanvas();
            });
        }
    }

    // Process Menu Logic
    const menuProcess = document.getElementById('menu-process');
    const processDropdown = document.getElementById('process-dropdown-container');

    if (menuProcess && processDropdown) {
        const processDropdownContent = document.getElementById('dropdown-process');
        menuProcess.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            editDropdown?.classList.remove('show');
            simulateDropdown?.classList.remove('show');
            toolsDropdown?.classList.remove('show');
            viewDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            processDropdown.classList.toggle('show');
            if (processDropdown.classList.contains('show') && processDropdownContent) {
                positionDropdown(processDropdown, processDropdownContent);
            }
        });

        document.addEventListener('click', (e) => {
            if (!processDropdown.contains(e.target)) {
                processDropdown.classList.remove('show');
            }
        });

        const menuFluidBasis = document.getElementById('menu-fluid-basis');
        if (menuFluidBasis) {
            menuFluidBasis.addEventListener('click', (e) => {
                e.preventDefault();
                processDropdown.classList.remove('show');
                openFluidBasis();
            });
        }
    }

    // Simulate Menu Logic
    if (menuSimulate && simulateDropdown) {
        const simulateDropdownContent = document.getElementById('dropdown-simulate');
        menuSimulate.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            editDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            toolsDropdown?.classList.remove('show');
            viewDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            simulateDropdown.classList.toggle('show');
            if (simulateDropdown.classList.contains('show') && simulateDropdownContent) {
                positionDropdown(simulateDropdown, simulateDropdownContent);
            }
        });

        document.addEventListener('click', (e) => {
            if (!simulateDropdown.contains(e.target)) {
                simulateDropdown.classList.remove('show');
            }
        });

        const menuRunSolve = document.getElementById('menu-run-solve');
        if (menuRunSolve) {
            menuRunSolve.addEventListener('click', (e) => {
                e.preventDefault();
                simulateDropdown.classList.remove('show');
                runHydraulicEvaluationFromMenu();
            });
        }

        const menuRefreshCalculations = document.getElementById('menu-refresh-calculations');
        if (menuRefreshCalculations) {
            menuRefreshCalculations.addEventListener('click', (e) => {
                e.preventDefault();
                simulateDropdown.classList.remove('show');
                refreshCalculationsFromMenu();
            });
        }
    }

    // Tools Menu Logic
    if (menuTools && toolsDropdown) {
        const toolsDropdownContent = document.getElementById('dropdown-tools');
        menuTools.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            editDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            simulateDropdown?.classList.remove('show');
            viewDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            toolsDropdown.classList.toggle('show');
            if (toolsDropdown.classList.contains('show') && toolsDropdownContent) {
                positionDropdown(toolsDropdown, toolsDropdownContent);
            }
        });

        document.addEventListener('click', (e) => {
            if (!toolsDropdown.contains(e.target)) {
                toolsDropdown.classList.remove('show');
            }
        });

        const menuToolsFluidBasis = document.getElementById('menu-tools-fluid-basis');
        if (menuToolsFluidBasis) {
            menuToolsFluidBasis.addEventListener('click', (e) => {
                e.preventDefault();
                toolsDropdown.classList.remove('show');
                openFluidBasis();
            });
        }

        const menuToolsExportExcel = document.getElementById('menu-tools-export-excel');
        if (menuToolsExportExcel) {
            menuToolsExportExcel.addEventListener('click', (e) => {
                e.preventDefault();
                toolsDropdown.classList.remove('show');
                exportScenarioTraceFromMenu();
            });
        }
    }

    // View Menu Logic
    if (menuView && viewDropdown) {
        const viewDropdownContent = document.getElementById('dropdown-view');
        menuView.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            editDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            simulateDropdown?.classList.remove('show');
            toolsDropdown?.classList.remove('show');
            helpDropdown?.classList.remove('show');
            viewDropdown.classList.toggle('show');
            if (viewDropdown.classList.contains('show') && viewDropdownContent) {
                positionDropdown(viewDropdown, viewDropdownContent);
            }
        });

        document.addEventListener('click', (e) => {
            if (!viewDropdown.contains(e.target)) {
                viewDropdown.classList.remove('show');
            }
        });

        const menuViewResetCanvas = document.getElementById('menu-view-reset-canvas');
        if (menuViewResetCanvas) {
            menuViewResetCanvas.addEventListener('click', (e) => {
                e.preventDefault();
                viewDropdown.classList.remove('show');
                resetCanvasViewFromMenu();
            });
        }

        const menuViewShowWarnings = document.getElementById('menu-view-show-warnings');
        if (menuViewShowWarnings) {
            menuViewShowWarnings.addEventListener('click', (e) => {
                e.preventDefault();
                viewDropdown.classList.remove('show');
                showWarningsPanelFromMenu();
            });
        }
    }

    // Help Menu Logic
    const menuHelp = document.getElementById('menu-help');
    const helpDropdown = document.getElementById('help-dropdown-container');

    if (menuHelp && helpDropdown) {
        const helpDropdownContent = document.getElementById('dropdown-help');
        menuHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown?.classList.remove('show');
            editDropdown?.classList.remove('show');
            processDropdown?.classList.remove('show');
            simulateDropdown?.classList.remove('show');
            toolsDropdown?.classList.remove('show');
            viewDropdown?.classList.remove('show');
            helpDropdown.classList.toggle('show');
            if (helpDropdown.classList.contains('show') && helpDropdownContent) {
                positionDropdown(helpDropdown, helpDropdownContent);
            }
        });

        document.addEventListener('click', (e) => {
            if (!helpDropdown.contains(e.target)) {
                helpDropdown.classList.remove('show');
            }
        });

        const menuAbout = document.getElementById('menu-about');
        if (menuAbout) {
            menuAbout.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                openAboutDialog();
            });
        }

        const menuSrcHelp = document.getElementById('menu-src-help');
        if (menuSrcHelp) {
            menuSrcHelp.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                if (typeof openSrcHelp === 'function') {
                    openSrcHelp();
                }
            });
        }

        const menuSnkHelp = document.getElementById('menu-snk-help');
        if (menuSnkHelp) {
            menuSnkHelp.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                if (typeof openSnkHelp === 'function') {
                    openSnkHelp();
                }
            });
        }

        const menuFluidProperties = document.getElementById('menu-fluid-properties');
        const fluidPropertiesSubmenu = menuFluidProperties?.closest('.dropdown-submenu');
        if (menuFluidProperties && fluidPropertiesSubmenu) {
            menuFluidProperties.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fluidPropertiesSubmenu.classList.toggle('show-submenu');
                menuFluidProperties.setAttribute(
                    'aria-expanded',
                    fluidPropertiesSubmenu.classList.contains('show-submenu') ? 'true' : 'false'
                );
            });
        }

        const menuNpshNotes = document.getElementById('menu-npsh-notes');
        if (menuNpshNotes) {
            menuNpshNotes.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                fluidPropertiesSubmenu?.classList.remove('show-submenu');
                if (menuFluidProperties) menuFluidProperties.setAttribute('aria-expanded', 'false');
                if (typeof openFluidPropertiesHelp === 'function') {
                    openFluidPropertiesHelp('npsh');
                }
            });
        }

        const menuPropertySourceMap = document.getElementById('menu-property-source-map');
        if (menuPropertySourceMap) {
            menuPropertySourceMap.addEventListener('click', (e) => {
                e.preventDefault();
                helpDropdown.classList.remove('show');
                fluidPropertiesSubmenu?.classList.remove('show-submenu');
                if (menuFluidProperties) menuFluidProperties.setAttribute('aria-expanded', 'false');
                if (typeof openFluidPropertiesHelp === 'function') {
                    openFluidPropertiesHelp('source-map');
                }
            });
        }
    }

    const aboutModal = document.getElementById('aboutModal');
    const closeAbout = document.getElementById('closeAbout');

    if (aboutModal) {
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) closeAboutDialog();
        });
    }

    if (closeAbout) {
        closeAbout.addEventListener('click', (e) => {
            e.preventDefault();
            closeAboutDialog();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aboutModal && !aboutModal.hidden) {
            closeAboutDialog();
        }
    });

    upgradeMenuKeyboardAccessibility();
}
