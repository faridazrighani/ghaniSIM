// --- Menu Bar Logic & State Management ---

// History State
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 20;
let currentFileHandle = null;
let currentProjectFileFormat = 'new';
let dynamicInventoryRealtimeTimer = null;
const UNTIRTA_MAGIC = 'UNTIRTA-NPSH-V1\n';
const UNTIRTA_PROJECT_FORMAT = 'untirta-npsh-simulation';
const UNTIRTA_PROJECT_VERSION = 1;
const UNTIRTA_PROJECT_EXTENSION = '.untirta';
const LEGACY_HYSYS_EXTENSION = '.hysys';
const PROJECT_MAX_FILE_BYTES = 12 * 1024 * 1024;
const PROJECT_MAX_HEADER_BYTES = 64 * 1024;
const PROJECT_MAX_OBJECTS = 600;
const PROJECT_MAX_CONNECTIONS = 1200;
const PROJECT_MAX_ARRAY_ITEMS = 6000;
const PROJECT_MAX_STRING_LENGTH = 5000;
const PROJECT_MAX_TOTAL_KEYS = 60000;
const PROJECT_MAX_DEPTH = 36;
const PROJECT_UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const UNTIRTA_SAVE_FILE_TYPES = [{
    description: 'UNTIRTA NPSH Project',
    accept: {'application/octet-stream': [UNTIRTA_PROJECT_EXTENSION]}
}];
const PROJECT_OPEN_FILE_TYPES = [{
    description: 'UNTIRTA NPSH Project or Legacy HYSYS File',
    accept: {
        'application/octet-stream': [UNTIRTA_PROJECT_EXTENSION],
        'application/json': [LEGACY_HYSYS_EXTENSION, '.json']
    }
}];
const LEGACY_HYSYS_FILE_TYPES = [{
    description: 'Legacy HYSYS Simulator File',
    accept: {'application/json': [LEGACY_HYSYS_EXTENSION]}
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

function getProjectTextEncoder() {
    return new TextEncoder();
}

function getProjectTextDecoder() {
    return new TextDecoder();
}

function concatUint8Arrays(chunks) {
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    chunks.forEach(chunk => {
        output.set(chunk, offset);
        offset += chunk.length;
    });
    return output;
}

function getUntirtaMagicBytes() {
    return getProjectTextEncoder().encode(UNTIRTA_MAGIC);
}

function hasUntirtaMagic(bytes) {
    if (!bytes || bytes.length < UNTIRTA_MAGIC.length) return false;
    const magic = getUntirtaMagicBytes();
    for (let i = 0; i < magic.length; i += 1) {
        if (bytes[i] !== magic[i]) return false;
    }
    return true;
}

function formatTwoDigitProjectPart(value) {
    return String(value).padStart(2, '0');
}

function createGhaniProjectFilename(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = formatTwoDigitProjectPart(date.getMonth() + 1);
    const dd = formatTwoDigitProjectPart(date.getDate());
    const hh = formatTwoDigitProjectPart(date.getHours());
    const mi = formatTwoDigitProjectPart(date.getMinutes());
    const ss = formatTwoDigitProjectPart(date.getSeconds());
    return `Ghani-NPSH-${yyyy}${mm}${dd}-${hh}${mi}${ss}${UNTIRTA_PROJECT_EXTENSION}`;
}

async function sha256Hex(bytes) {
    if (!window.crypto?.subtle) {
        throw new Error('Secure project checksum is unavailable in this browser.');
    }
    const hash = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash))
        .map(value => value.toString(16).padStart(2, '0'))
        .join('');
}

async function transformProjectBytes(bytes, StreamCtor) {
    const stream = new Blob([bytes]).stream().pipeThrough(new StreamCtor('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function compressProjectBytes(bytes) {
    if (typeof CompressionStream === 'function') {
        try {
            return {
                compression: 'gzip',
                bytes: await transformProjectBytes(bytes, CompressionStream)
            };
        } catch (err) {
            console.warn('Project compression failed; saving uncompressed .untirta payload.', err);
        }
    }
    return {
        compression: 'none',
        bytes
    };
}

async function decompressProjectBytes(bytes, compression) {
    if (compression === 'none') return bytes;
    if (compression !== 'gzip') {
        throw new Error(`Unsupported .untirta compression method: ${compression || 'unknown'}.`);
    }
    if (typeof DecompressionStream !== 'function') {
        throw new Error('This browser cannot open compressed .untirta files. Please use a current Chromium, Edge, or Safari browser.');
    }
    return transformProjectBytes(bytes, DecompressionStream);
}

async function encodeUntirtaProject(jsonString) {
    const encoder = getProjectTextEncoder();
    const jsonBytes = encoder.encode(jsonString);
    if (jsonBytes.length > PROJECT_MAX_FILE_BYTES) {
        throw new Error('Project is too large to save safely.');
    }
    const packed = await compressProjectBytes(jsonBytes);
    const checksum = await sha256Hex(packed.bytes);
    const header = {
        fileFormat: UNTIRTA_PROJECT_FORMAT,
        fileVersion: UNTIRTA_PROJECT_VERSION,
        compression: packed.compression,
        checksum,
        payloadBytes: packed.bytes.length,
        savedAt: new Date().toISOString()
    };
    const headerBytes = encoder.encode(JSON.stringify(header));
    if (headerBytes.length > PROJECT_MAX_HEADER_BYTES) {
        throw new Error('Project header is too large to save safely.');
    }
    const headerLengthBytes = encoder.encode(headerBytes.length.toString(16).padStart(8, '0'));
    const bytes = concatUint8Arrays([
        getUntirtaMagicBytes(),
        headerLengthBytes,
        headerBytes,
        packed.bytes
    ]);
    return new Blob([bytes], { type: 'application/octet-stream' });
}

async function decodeUntirtaProjectBuffer(arrayBuffer) {
    const decoder = getProjectTextDecoder();
    const bytes = new Uint8Array(arrayBuffer);
    const magic = getUntirtaMagicBytes();
    if (!hasUntirtaMagic(bytes)) {
        throw new Error('The selected .untirta file has an invalid project header.');
    }
    const headerLengthStart = magic.length;
    const headerLengthEnd = headerLengthStart + 8;
    if (bytes.length < headerLengthEnd) {
        throw new Error('The selected .untirta file is incomplete.');
    }
    const headerLengthText = decoder.decode(bytes.slice(headerLengthStart, headerLengthEnd));
    if (!/^[0-9a-fA-F]{8}$/.test(headerLengthText)) {
        throw new Error('The selected .untirta file has an invalid header length.');
    }
    const headerLength = parseInt(headerLengthText, 16);
    if (!Number.isFinite(headerLength) || headerLength <= 0 || headerLength > PROJECT_MAX_HEADER_BYTES) {
        throw new Error('The selected .untirta file header is outside the supported size.');
    }
    const headerStart = headerLengthEnd;
    const headerEnd = headerStart + headerLength;
    if (bytes.length < headerEnd) {
        throw new Error('The selected .untirta file is missing its header payload.');
    }
    const header = JSON.parse(decoder.decode(bytes.slice(headerStart, headerEnd)));
    if (header.fileFormat !== UNTIRTA_PROJECT_FORMAT || header.fileVersion !== UNTIRTA_PROJECT_VERSION) {
        throw new Error('The selected .untirta file version is not supported by this application build.');
    }
    const payload = bytes.slice(headerEnd);
    if (!Number.isInteger(header.payloadBytes) || header.payloadBytes !== payload.length) {
        throw new Error('The selected .untirta file payload length does not match its header.');
    }
    const checksum = await sha256Hex(payload);
    if (checksum !== header.checksum) {
        throw new Error('The selected .untirta file checksum failed. The file may be corrupt or modified.');
    }
    const jsonBytes = await decompressProjectBytes(payload, header.compression);
    if (jsonBytes.length > PROJECT_MAX_FILE_BYTES) {
        throw new Error('The selected .untirta file expands beyond the supported project size.');
    }
    return {
        jsonString: decoder.decode(jsonBytes),
        format: 'untirta',
        header
    };
}

function sanitizeProjectValue(value, context, path = 'root') {
    context.depth += 1;
    if (context.depth > PROJECT_MAX_DEPTH) {
        throw new Error(`Project file is too deeply nested near ${path}.`);
    }

    let sanitized;
    if (value === null || typeof value === 'boolean') {
        sanitized = value;
    } else if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error(`Project file contains a non-finite number near ${path}.`);
        sanitized = value;
    } else if (typeof value === 'string') {
        if (value.length > PROJECT_MAX_STRING_LENGTH) {
            throw new Error(`Project file contains an oversized text value near ${path}.`);
        }
        sanitized = value;
    } else if (Array.isArray(value)) {
        if (value.length > PROJECT_MAX_ARRAY_ITEMS) {
            throw new Error(`Project file contains too many array items near ${path}.`);
        }
        sanitized = value
            .map((item, index) => sanitizeProjectValue(item, context, `${path}[${index}]`))
            .filter(item => item !== undefined);
    } else if (value && typeof value === 'object') {
        sanitized = {};
        Object.keys(value).forEach(key => {
            if (PROJECT_UNSAFE_KEYS.has(key)) return;
            context.keys += 1;
            if (context.keys > PROJECT_MAX_TOTAL_KEYS) {
                throw new Error('Project file contains too many fields to load safely.');
            }
            const nextValue = sanitizeProjectValue(value[key], context, `${path}.${key}`);
            if (nextValue !== undefined) sanitized[key] = nextValue;
        });
    } else {
        sanitized = undefined;
    }

    context.depth -= 1;
    return sanitized;
}

function validateProjectDataShape(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid project format: root object is missing.');
    }
    if (!data.model || typeof data.model !== 'object' || Array.isArray(data.model)) {
        throw new Error('Invalid project format: model data is missing.');
    }
    if (!Array.isArray(data.connections)) {
        throw new Error('Invalid project format: connection list is missing.');
    }
    const modelObjectCount = Object.keys(data.model)
        .filter(key => key !== 'FLUID' && key !== 'SETTINGS')
        .length;
    if (modelObjectCount > PROJECT_MAX_OBJECTS) {
        throw new Error(`Project has too many objects (${modelObjectCount}).`);
    }
    if (data.connections.length > PROJECT_MAX_CONNECTIONS) {
        throw new Error(`Project has too many connections (${data.connections.length}).`);
    }
    if (data.instrumentLinks !== undefined && !Array.isArray(data.instrumentLinks)) {
        throw new Error('Invalid project format: instrument links must be a list.');
    }
    if (data.sourceLinks !== undefined && !Array.isArray(data.sourceLinks)) {
        throw new Error('Invalid project format: source links must be a list.');
    }
    if (data.visuals !== undefined && (!data.visuals || typeof data.visuals !== 'object' || Array.isArray(data.visuals))) {
        throw new Error('Invalid project format: visual placement data must be an object.');
    }
    return data;
}

function prepareProjectJsonForApply(jsonString) {
    if (typeof jsonString !== 'string' || jsonString.length > PROJECT_MAX_FILE_BYTES) {
        throw new Error('Project file is too large or unreadable.');
    }
    const parsed = JSON.parse(jsonString);
    const sanitized = sanitizeProjectValue(parsed, { keys: 0, depth: 0 });
    validateProjectDataShape(sanitized);
    return JSON.stringify(sanitized);
}

function applySimulationStateAtomic(jsonString) {
    const previousState = getSimulationState();
    const safeJson = prepareProjectJsonForApply(jsonString);
    try {
        applySimulationState(safeJson);
        return true;
    } catch (err) {
        try {
            applySimulationState(previousState);
        } catch (restoreErr) {
            console.error('Failed to restore the previous simulation state after a project load error.', restoreErr);
        }
        throw err;
    }
}

async function decodeLegacyProjectBuffer(arrayBuffer, format = 'legacy-json') {
    if (arrayBuffer.byteLength > PROJECT_MAX_FILE_BYTES) {
        throw new Error('Legacy project file is too large to import safely.');
    }
    return {
        jsonString: getProjectTextDecoder().decode(new Uint8Array(arrayBuffer)),
        format
    };
}

async function decodeProjectFile(file, options = {}) {
    if (!file) throw new Error('No project file was selected.');
    if (file.size > PROJECT_MAX_FILE_BYTES) {
        throw new Error('Project file is too large to open safely.');
    }
    const lowerName = String(file.name || '').toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (options.legacyOnly) {
        if (!lowerName.endsWith(LEGACY_HYSYS_EXTENSION)) {
            throw new Error('Legacy import only accepts .hysys files.');
        }
        return decodeLegacyProjectBuffer(arrayBuffer, 'legacy-hysys');
    }
    if (hasUntirtaMagic(bytes) || lowerName.endsWith(UNTIRTA_PROJECT_EXTENSION)) {
        return decodeUntirtaProjectBuffer(arrayBuffer);
    }
    const legacyFormat = lowerName.endsWith(LEGACY_HYSYS_EXTENSION) ? 'legacy-hysys' : 'legacy-json';
    return decodeLegacyProjectBuffer(arrayBuffer, legacyFormat);
}

async function applyDecodedProjectFile(file, options = {}) {
    const decoded = await decodeProjectFile(file, options);
    applySimulationStateAtomic(decoded.jsonString);
    currentFileHandle = null;
    currentProjectFileFormat = decoded.format;
    undoStack = [];
    redoStack = [];
    return decoded;
}

async function createUntirtaProjectBlob() {
    return encodeUntirtaProject(getSimulationState());
}

async function downloadSimulationFile() {
    const blob = await createUntirtaProjectBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = createGhaniProjectFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    currentProjectFileFormat = 'untirta';
    showUiToast('Simulation file download has started. UNTIRTA project file is being saved.', {
        title: 'Save As',
        variant: 'success'
    });
}

function openSimulationFileFallback(options = {}) {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = options.legacyOnly
            ? '.hysys,application/json'
            : '.untirta,.hysys,.json,application/json,application/octet-stream';
        input.style.display = 'none';

        input.addEventListener('change', async () => {
            try {
                const file = input.files && input.files[0];
                if (!file) return resolve();
                const decoded = await applyDecodedProjectFile(file, options);
                resolve(decoded);
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
    if (typeof normalizeAllLevelControllerTrendHistoriesForSave === 'function') {
        normalizeAllLevelControllerTrendHistoriesForSave(globalModel);
    }
    const data = {
        projectFile: {
            fileFormat: UNTIRTA_PROJECT_FORMAT,
            fileVersion: UNTIRTA_PROJECT_VERSION,
            preferredExtension: UNTIRTA_PROJECT_EXTENSION,
            sourceFormat: currentProjectFileFormat
        },
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
    if (typeof stopDynamicInventoryRealtime === 'function') {
        stopDynamicInventoryRealtime({ silent: true });
    }
    const data = JSON.parse(jsonString);
    if(!data.model || !data.connections) throw new Error("Invalid format");
    const hadSettings = !!data.model.SETTINGS;
    
    Object.keys(globalModel).forEach(k => delete globalModel[k]);
    Object.assign(globalModel, data.model);
    if (typeof restoreLevelControllerTrendState === 'function') {
        restoreLevelControllerTrendState(globalModel);
    }
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
    const previousTrendSuppression = typeof suppressLevelControllerTrendRecording !== 'undefined'
        ? suppressLevelControllerTrendRecording
        : false;
    if (typeof suppressLevelControllerTrendRecording !== 'undefined') {
        suppressLevelControllerTrendRecording = true;
    }
    try {
        updateSimulation({ renderSidebarAfter: false });
    } finally {
        if (typeof suppressLevelControllerTrendRecording !== 'undefined') {
            suppressLevelControllerTrendRecording = previousTrendSuppression;
        }
    }
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
    if (typeof stopDynamicInventoryRealtime === 'function') {
        stopDynamicInventoryRealtime({ silent: true });
    }

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
    currentProjectFileFormat = 'new';
    return true;
}

async function fileSaveAs() {
    if (!window.showSaveFilePicker) {
        await downloadSimulationFile();
        return;
    }

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: createGhaniProjectFilename(),
            types: UNTIRTA_SAVE_FILE_TYPES,
            excludeAcceptAllOption: false
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
        const blob = await createUntirtaProjectBlob();
        
        const writable = await currentFileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        currentProjectFileFormat = 'untirta';
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
        const loaded = await openSimulationFileFallback({
            types: PROJECT_OPEN_FILE_TYPES
        });
        if (loaded) {
            const isLegacy = loaded.format && loaded.format.startsWith('legacy');
            showUiToast(isLegacy
                ? 'Legacy project imported. Use Save As to write the official .untirta file.'
                : 'Simulation file loaded successfully. UNTIRTA project opened.', {
                title: isLegacy ? 'Legacy import' : 'Open',
                variant: 'success'
            });
        }
    } catch (err) {
        console.error(err);
        showUiToast(err?.message || 'Failed to open file. Please choose a valid .untirta project or legacy .hysys file saved by this app.', {
            title: 'Open failed',
            variant: 'error',
            duration: 7200
        });
    }
}

async function fileImportLegacyHysys() {
    try {
        const loaded = await openSimulationFileFallback({
            legacyOnly: true,
            types: LEGACY_HYSYS_FILE_TYPES
        });
        if (loaded) {
            showUiToast('Legacy .hysys project imported. Use Save As to convert it to .untirta.', {
                title: 'Import Legacy',
                variant: 'success',
                duration: 5600
            });
        }
    } catch (err) {
        console.error(err);
        showUiToast(err?.message || 'Failed to import the legacy .hysys file.', {
            title: 'Import failed',
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

function updateDynamicInventoryMenuLabels() {
    const stepButton = document.getElementById('menu-step-dynamic-inventory');
    const stepSizeButton = document.getElementById('menu-dynamic-step-size');
    const realtimeButton = document.getElementById('menu-toggle-dynamic-realtime');
    const realtimeIntervalButton = document.getElementById('menu-dynamic-realtime-interval');
    const stepSeconds = typeof getDynamicInventorySettings === 'function'
        ? getDynamicInventorySettings().dynamicStepSeconds
        : 60;
    const realtimeIntervalMs = typeof getDynamicInventorySettings === 'function'
        ? getDynamicInventorySettings().dynamicRealtimeIntervalMs
        : 60000;
    const duration = typeof formatDynamicInventoryDuration === 'function'
        ? formatDynamicInventoryDuration(stepSeconds)
        : `${stepSeconds} s`;
    const realtimeDuration = typeof formatDynamicInventoryDuration === 'function'
        ? formatDynamicInventoryDuration(realtimeIntervalMs / 1000)
        : `${realtimeIntervalMs / 1000} s`;
    if (stepButton) stepButton.textContent = `Step Dynamic Inventory (${duration})`;
    if (stepSizeButton) stepSizeButton.textContent = `Dynamic Step Size: ${duration}`;
    if (realtimeButton) {
        realtimeButton.textContent = dynamicInventoryRealtimeTimer
            ? `Stop Realtime Dynamic Inventory (${realtimeDuration})`
            : `Start Realtime Dynamic Inventory (${realtimeDuration})`;
    }
    if (realtimeIntervalButton) realtimeIntervalButton.textContent = `Realtime Interval: ${realtimeDuration}`;
}

function setDynamicInventoryStepFromMenu(stepSeconds) {
    const selectedSeconds = typeof setDynamicInventoryStepSeconds === 'function'
        ? setDynamicInventoryStepSeconds(stepSeconds)
        : stepSeconds;
    updateDynamicInventoryMenuLabels();
    if (typeof showUiToast === 'function') {
        const duration = typeof formatDynamicInventoryDuration === 'function'
            ? formatDynamicInventoryDuration(selectedSeconds)
            : `${selectedSeconds} s`;
        showUiToast(`Dynamic inventory timestep set to ${duration}.`, {
            title: 'Dynamic Step Size',
            variant: 'success',
            duration: 2600
        });
    }
}

function setDynamicInventoryRealtimeIntervalFromMenu(intervalMs) {
    const selectedMs = typeof setDynamicInventoryRealtimeIntervalMs === 'function'
        ? setDynamicInventoryRealtimeIntervalMs(intervalMs)
        : intervalMs;
    const wasRunning = !!dynamicInventoryRealtimeTimer;
    if (wasRunning) stopDynamicInventoryRealtime({ silent: true });
    updateDynamicInventoryMenuLabels();
    if (wasRunning) startDynamicInventoryRealtime({ silent: true });

    if (typeof showUiToast === 'function') {
        const duration = typeof formatDynamicInventoryDuration === 'function'
            ? formatDynamicInventoryDuration(selectedMs / 1000)
            : `${selectedMs / 1000} s`;
        showUiToast(`Realtime dynamic inventory interval set to ${duration}.`, {
            title: 'Realtime Interval',
            variant: 'success',
            duration: 3000
        });
    }
}

function runDynamicInventoryRealtimeTick() {
    if (typeof stepDynamicTankInventory !== 'function') return null;
    return stepDynamicTankInventory({ renderSidebarAfter: true });
}

function startDynamicInventoryRealtime(options = {}) {
    if (dynamicInventoryRealtimeTimer || typeof stepDynamicTankInventory !== 'function') return;
    if (typeof captureState === 'function') captureState();
    const settings = typeof getDynamicInventorySettings === 'function'
        ? getDynamicInventorySettings()
        : { dynamicRealtimeIntervalMs: 60000, dynamicStepSeconds: 60 };
    runDynamicInventoryRealtimeTick();
    dynamicInventoryRealtimeTimer = window.setInterval(runDynamicInventoryRealtimeTick, settings.dynamicRealtimeIntervalMs);
    updateDynamicInventoryMenuLabels();

    if (!options.silent && typeof showUiToast === 'function') {
        const stepDuration = typeof formatDynamicInventoryDuration === 'function'
            ? formatDynamicInventoryDuration(settings.dynamicStepSeconds)
            : `${settings.dynamicStepSeconds} s`;
        const intervalDuration = typeof formatDynamicInventoryDuration === 'function'
            ? formatDynamicInventoryDuration(settings.dynamicRealtimeIntervalMs / 1000)
            : `${settings.dynamicRealtimeIntervalMs / 1000} s`;
        showUiToast(`Realtime dynamic inventory started. Step = ${stepDuration}, interval = ${intervalDuration}.`, {
            title: 'Dynamic Inventory',
            variant: 'success',
            duration: 5200
        });
    }
}

function stopDynamicInventoryRealtime(options = {}) {
    if (!dynamicInventoryRealtimeTimer) {
        updateDynamicInventoryMenuLabels();
        return;
    }
    window.clearInterval(dynamicInventoryRealtimeTimer);
    dynamicInventoryRealtimeTimer = null;
    updateDynamicInventoryMenuLabels();

    if (!options.silent && typeof showUiToast === 'function') {
        showUiToast('Realtime dynamic inventory stopped.', {
            title: 'Dynamic Inventory',
            variant: 'info',
            duration: 3200
        });
    }
}

function toggleDynamicInventoryRealtimeFromMenu() {
    if (dynamicInventoryRealtimeTimer) {
        stopDynamicInventoryRealtime();
    } else {
        startDynamicInventoryRealtime();
    }
}

function stepDynamicInventoryFromMenu() {
    if (typeof stepDynamicTankInventory !== 'function') {
        if (typeof showUiToast === 'function') {
            showUiToast('Dynamic inventory engine is not available. Please reload the application.', {
                title: 'Dynamic Inventory',
                variant: 'error',
                duration: 5200
            });
        }
        return;
    }

    if (typeof captureState === 'function') captureState();
    const result = stepDynamicTankInventory({ renderSidebarAfter: true });
    updateDynamicInventoryMenuLabels();

    if (typeof showUiToast === 'function') {
        const duration = typeof formatDynamicInventoryDuration === 'function'
            ? formatDynamicInventoryDuration(result.stepSeconds)
            : `${result.stepSeconds} s`;
        const clock = typeof formatDynamicInventoryClock === 'function'
            ? formatDynamicInventoryClock(result.simulationTimeSeconds)
            : `${result.simulationTimeSeconds} s`;
        const firstTank = result.changedTanks?.[0];
        const tankText = firstTank
            ? `${firstTank.tankId}: ${firstTank.previousLevel} m -> ${firstTank.newLevel} m, V=${firstTank.newVolume} m3.`
            : 'No tank level changed; check net flow, tank diameter, and tank level.';
        showUiToast(`${duration} step complete at t=${clock}. ${tankText}`, {
            title: result.ok ? 'Dynamic Inventory' : 'Dynamic Inventory Review',
            variant: result.ok ? 'success' : 'info',
            duration: result.ok ? 5200 : 6800
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

        const menuImportLegacy = document.getElementById('menu-import-legacy-hysys');
        if(menuImportLegacy) {
            menuImportLegacy.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileImportLegacyHysys();
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

        const menuStepDynamicInventory = document.getElementById('menu-step-dynamic-inventory');
        if (menuStepDynamicInventory) {
            menuStepDynamicInventory.addEventListener('click', (e) => {
                e.preventDefault();
                simulateDropdown.classList.remove('show');
                stepDynamicInventoryFromMenu();
            });
        }

        const menuToggleDynamicRealtime = document.getElementById('menu-toggle-dynamic-realtime');
        if (menuToggleDynamicRealtime) {
            menuToggleDynamicRealtime.addEventListener('click', (e) => {
                e.preventDefault();
                simulateDropdown.classList.remove('show');
                toggleDynamicInventoryRealtimeFromMenu();
            });
        }

        const menuDynamicStepSize = document.getElementById('menu-dynamic-step-size');
        const dynamicStepSubmenu = menuDynamicStepSize?.closest('.dropdown-submenu');
        if (menuDynamicStepSize && dynamicStepSubmenu) {
            menuDynamicStepSize.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dynamicStepSubmenu.classList.toggle('show-submenu');
                menuDynamicStepSize.setAttribute(
                    'aria-expanded',
                    dynamicStepSubmenu.classList.contains('show-submenu') ? 'true' : 'false'
                );
            });
        }

        document.querySelectorAll('[data-dynamic-step-seconds]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const stepSeconds = parseInt(button.dataset.dynamicStepSeconds, 10);
                setDynamicInventoryStepFromMenu(stepSeconds);
                dynamicStepSubmenu?.classList.remove('show-submenu');
                if (menuDynamicStepSize) menuDynamicStepSize.setAttribute('aria-expanded', 'false');
                simulateDropdown.classList.remove('show');
            });
        });

        const menuDynamicRealtimeInterval = document.getElementById('menu-dynamic-realtime-interval');
        const dynamicRealtimeSubmenu = menuDynamicRealtimeInterval?.closest('.dropdown-submenu');
        if (menuDynamicRealtimeInterval && dynamicRealtimeSubmenu) {
            menuDynamicRealtimeInterval.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dynamicRealtimeSubmenu.classList.toggle('show-submenu');
                menuDynamicRealtimeInterval.setAttribute(
                    'aria-expanded',
                    dynamicRealtimeSubmenu.classList.contains('show-submenu') ? 'true' : 'false'
                );
            });
        }

        document.querySelectorAll('[data-dynamic-realtime-ms]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const intervalMs = parseInt(button.dataset.dynamicRealtimeMs, 10);
                setDynamicInventoryRealtimeIntervalFromMenu(intervalMs);
                dynamicRealtimeSubmenu?.classList.remove('show-submenu');
                if (menuDynamicRealtimeInterval) menuDynamicRealtimeInterval.setAttribute('aria-expanded', 'false');
                simulateDropdown.classList.remove('show');
            });
        });

        updateDynamicInventoryMenuLabels();

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
