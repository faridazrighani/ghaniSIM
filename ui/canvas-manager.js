function isInstrumentType(type) {
    return INSTRUMENT_TYPES.includes(type);
}

const VISUAL_OBJECT_BASE_SIZES = {
    tank: { width: 82, height: 62 },
    separator: { width: 76, height: 44 },
    verticalVessel: { width: 44, height: 72 }
};

function isVisualResizableType(type) {
    return !!VISUAL_OBJECT_BASE_SIZES[type];
}

function getVisualScale(props = {}) {
    const rawScale = parseFloat(props.visualScale);
    if (!Number.isFinite(rawScale)) return 1;
    return Math.max(0.45, Math.min(2.5, rawScale / 100));
}

function applyObjectVisuals(nodeId) {
    const node = globalModel[nodeId];
    const el = getObjectElement(nodeId);
    if (!node || !el) return;

    el.classList.add(`object-type-${node.type}`);
    el.dataset.type = node.type;

    if (!isVisualResizableType(node.type)) return;

    const base = VISUAL_OBJECT_BASE_SIZES[node.type];
    const scale = getVisualScale(node.props);
    el.style.setProperty('--visual-width', `${base.width * scale}px`);
    el.style.setProperty('--visual-height', `${base.height * scale}px`);
}

function setAppMode(mode) {
    appMode = mode;

    const btnSelect = document.getElementById('btn-mode-select');
    const btnConnect = document.getElementById('btn-mode-connect');
    const canvas = document.getElementById('canvas');

    if (btnSelect && btnConnect) {
        btnSelect.classList.toggle('active', mode === 'SELECT');
        btnConnect.classList.toggle('active', mode === 'CONNECT');
    }

    if (canvas) {
        canvas.classList.toggle('connect-mode', mode === 'CONNECT');
    }

    if (mode !== 'CONNECT' && pendingConnectionStart) cancelPendingConnection();
}

function activateConnectTool(routeStyle = 'Straight') {
    nextPipeRouteStyle = routeStyle;
    setAppMode('CONNECT');
}
function getToolbarItem(type) {
    const groups = window.TOOLBAR_GROUPS || [];
    for (const group of groups) {
        const item = group.items.find(entry => entry.type === type);
        if (item) return item;
    }
    return null;
}

function getObjectPrefix(type) {
    if (type === 'pump') return 'P-';
    if (type === 'tank') return 'TK-';
    if (type === 'valve') return 'V-';
    if (type === 'checkValve') return 'CV-';
    if (type === 'separator' || type === 'verticalVessel') return 'VES-';
    if (type === 'heatExchanger') return 'E-';
    if (type === 'mixer') return 'M-';
    if (type === 'source') return 'SRC-';
    if (type === 'sink') return 'SNK-';
    if (type === 'junction') return 'J-';
    if (isInstrumentType(type)) return 'I-';
    return 'OBJ-';
}

function getObjectIconPath(type) {
    const catalogItem = getToolbarItem(type);
    return catalogItem?.icon || 'toolbar/icons/pump.svg';
}

function getObjectPortsHtml(type) {
    if (isInstrumentType(type)) return '';

    if (type === 'tank') {
        return `
            <div class="port inlet" style="top: 50%; left: 6%; transform: translate(-50%, -50%);"></div>
            <div class="port outlet" style="top: 50%; right: 6%; transform: translate(50%, -50%); background: #ff0;"></div>
        `;
    }

    if (type === 'separator') {
        return `
            <div class="port inlet" style="top: 50%; left: 0; transform: translate(-50%, -50%);"></div>
            <div class="port outlet" style="top: 50%; right: 0; transform: translate(50%, -50%); background: #ff0;"></div>
        `;
    }

    if (type === 'verticalVessel') {
        return `
            <div class="port inlet" style="top: 28%; left: 0; transform: translate(-50%, -50%);"></div>
            <div class="port outlet" style="top: 58%; right: 0; transform: translate(50%, -50%); background: #ff0;"></div>
        `;
    }

    if (type === 'mixer') {
        return `
            <div class="port inlet" style="top: 25%; left: -6px;"></div>
            <div class="port inlet" style="top: 75%; left: -6px;"></div>
            <div class="port outlet" style="top: 50%; right: -6px;"></div>
        `;
    }

    if (type === 'source') {
        return `<div class="port outlet" style="top: 50%; right: -5px; transform: translateY(-50%);"></div>`;
    }

    if (type === 'sink') {
        return `<div class="port inlet" style="top: 50%; left: -5px; transform: translateY(-50%);"></div>`;
    }

    if (type === 'junction') {
        return `
            <div class="port inlet" style="top: 50%; left: -5px; transform: translateY(-50%);"></div>
            <div class="port outlet" style="top: 50%; right: -5px; transform: translateY(-50%);"></div>
            <div class="port top"></div>
            <div class="port bottom"></div>
        `;
    }

    return `
        <div class="port inlet" style="top: 50%; left: -5px; transform: translateY(-50%);"></div>
        <div class="port outlet" style="top: 50%; right: -5px; transform: translateY(-50%);"></div>
    `;
}

function getObjectClassName(type) {
    return `${isInstrumentType(type) ? 'pfd-object instrument pfd-instrument' : 'pfd-object equipment'} object-type-${type}`;
}

function getLineMonitorReadoutMarkup() {
    return `
        <div class="line-monitor-readout" aria-label="PTF pipeline readout">
            <table>
                <tbody>
                    <tr>
                        <th scope="row">P</th>
                        <td data-readout-key="pressure">-</td>
                        <td>bar</td>
                    </tr>
                    <tr>
                        <th scope="row">T</th>
                        <td data-readout-key="temperature">-</td>
                        <td>deg C</td>
                    </tr>
                    <tr>
                        <th scope="row">F</th>
                        <td data-readout-key="flow">-</td>
                        <td>m3/h</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function getDefaultDescription(type) {
    const catalogItem = getToolbarItem(type);
    if (catalogItem) return catalogItem.label;
    const words = type.replace(/([A-Z])/g, ' $1').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function getObjectMarkup(type, nodeId, desc) {
    return `
        <div class="object-icon">
            <img class="pfd-icon-img" src="${getObjectIconPath(type)}" alt="">
            ${getObjectPortsHtml(type)}
        </div>
        <div class="object-name">${nodeId}<br><span class="object-desc">${desc}</span></div>
        ${type === 'lineMonitor' ? getLineMonitorReadoutMarkup() : ''}
    `;
}

function renderToolbarPalette() {
    const palette = document.getElementById('toolbarPalette');
    if (!palette || !window.TOOLBAR_GROUPS) return;

    palette.innerHTML = '';

    window.TOOLBAR_GROUPS.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'toolbar-group';

        const title = document.createElement('div');
        title.className = 'toolbar-group-title';
        title.textContent = group.label;
        groupEl.appendChild(title);

        const tools = document.createElement('div');
        tools.className = 'toolbar-tools';

        group.items.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toolbar-tool';
            btn.title = item.label;

            btn.innerHTML = `
                <img class="toolbar-tool-icon" src="${item.icon}" alt="">
                <span>${item.label}</span>
            `;

            btn.addEventListener('click', () => {
                if (item.action === 'connect') {
                    activateConnectTool(item.routeStyle || 'Straight');
                } else {
                    addEquipment(item.type);
                }
            });

            tools.appendChild(btn);
        });

        groupEl.appendChild(tools);
        palette.appendChild(groupEl);
    });
}
function selectNode(nodeId, element) {
    // Clear previous selection
    document.querySelectorAll('.pfd-object').forEach(el => el.classList.remove('selected'));
    // Set new selection
    if (element) element.classList.add('selected');
    currentSelectedNode = nodeId;
    renderSidebar(nodeId);
    
    // Show editor hint if it's the pump
    document.getElementById('editorHint').style.display = (globalModel[nodeId]?.type === 'pump') ? 'block' : 'none';
}

function getObjectElement(id) {
    return document.getElementById('obj-' + id.toLowerCase().replace(/-/g, ''));
}

function getClientPoint(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0];
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0];
    return e;
}

function getCanvasPointFromEvent(e) {
    const point = getClientPoint(e);
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    return {
        x: point.clientX - canvasRect.left + canvas.scrollLeft,
        y: point.clientY - canvasRect.top + canvas.scrollTop
    };
}

function isCanvasBackgroundTarget(target) {
    return !!(target && (
        target.id === 'canvas'
        || target.id === 'svg-lines'
        || target.classList?.contains('pfd-lines')
    ));
}

function makeDraggable(obj) {
    const getDefaultConnectPort = (isStart) => {
        if (isStart) {
            return obj.querySelector('.port.outlet') || obj.querySelector('.port.inlet');
        }
        return obj.querySelector('.port.inlet') || obj.querySelector('.port.outlet');
    };

    obj.addEventListener('dragstart', (e) => e.preventDefault());

    obj.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (appMode === 'CONNECT' || e.target.closest('.port')) return;

        const canvas = document.getElementById('canvas');
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseFloat(obj.style.left) || 0;
        const startTop = parseFloat(obj.style.top) || 0;
        const pointerId = e.pointerId;
        let hasMoved = false;
        let capturedHistory = false;

        selectNode(obj.dataset.id, obj);
        hideContextMenu();
        obj.setPointerCapture?.(pointerId);
        e.preventDefault();

        const moveObject = (ev) => {
            if (ev.pointerId !== pointerId) return;

            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!hasMoved && Math.hypot(dx, dy) < 2) return;

            if (!capturedHistory) {
                captureState();
                capturedHistory = true;
            }

            hasMoved = true;
            obj.style.left = `${Math.max(0, startLeft + dx)}px`;
            obj.style.top = `${Math.max(0, startTop + dy)}px`;
            drawConnections();
            ev.preventDefault();
        };

        const stopDrag = (ev) => {
            if (ev.pointerId !== pointerId) return;
            document.removeEventListener('pointermove', moveObject);
            document.removeEventListener('pointerup', stopDrag);
            document.removeEventListener('pointercancel', stopDrag);
            obj.releasePointerCapture?.(pointerId);

            if (capturedHistory) {
                updateSimulation({ renderSidebarAfter: false });
                if (canvas) {
                    canvas.scrollLeft = Math.max(0, canvas.scrollLeft);
                    canvas.scrollTop = Math.max(0, canvas.scrollTop);
                }
            }
        };

        document.addEventListener('pointermove', moveObject);
        document.addEventListener('pointerup', stopDrag);
        document.addEventListener('pointercancel', stopDrag);
    });

    // Selection
    obj.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (appMode !== 'CONNECT') {
            selectNode(obj.dataset.id, obj);
        }
    });
    
    // Double click for Pump chart
    if (obj.dataset.id.startsWith('P-')) {
        obj.addEventListener('dblclick', () => {
            if (appMode !== 'CONNECT') {
                activeChartPumpId = obj.dataset.id;
                document.getElementById('fullEditor').style.display = 'flex';
                selectNode(obj.dataset.id, obj);
                updateSimulation();
                updatePumpChart(activeChartPumpId);
                if (pumpChartInstance) pumpChartInstance.resize();
            }
        });
    }
    
    // Port Connection Logic
    const ports = obj.querySelectorAll('.port');
    ports.forEach(port => {
        port.addEventListener('mousedown', (e) => {
            if (appMode === 'CONNECT') e.stopPropagation();
        });
        port.addEventListener('click', (e) => {
            if (appMode === 'CONNECT') {
                e.stopPropagation();
                if (pendingConnectionStart && pendingConnectionStart.kind === 'instrument') {
                    return;
                }
                 
                const nodeId = obj.dataset.id;
                let portClass = '.' + Array.from(port.classList).join('.');
                 
                if (!pendingConnectionStart) {
                    // start
                    const point = getCanvasPointFromEvent(e);
                    pendingConnectionStart = { 
                        kind: 'pipe',
                        id: nodeId, 
                        portSelector: portClass, 
                        routeStyle: nextPipeRouteStyle,
                        currentX: point.x, 
                        currentY: point.y 
                    };
                    
                    onCanvasMouseMove = (ev) => {
                        const currentPoint = getCanvasPointFromEvent(ev);
                        pendingConnectionStart.currentX = currentPoint.x;
                        pendingConnectionStart.currentY = currentPoint.y;
                        drawConnections();
                    };
                    document.addEventListener('pointermove', onCanvasMouseMove);
                    drawConnections();
                } else {
                    // complete
                    if (pendingConnectionStart.id !== nodeId) {
                        document.removeEventListener('pointermove', onCanvasMouseMove);
                        onCanvasMouseMove = null;
                        
                        let pipeNum = 1;
                        while (globalModel['PIPE-' + pipeNum]) pipeNum++;
                        const pipeId = 'PIPE-' + pipeNum;
                        const fromType = globalModel[pendingConnectionStart.id]?.type;
                        const toType = globalModel[nodeId]?.type;
                        const pipeProps = getDefaultProps('pipe');
                        pipeProps.routeStyle = pendingConnectionStart.routeStyle || 'Straight';
                        if (((fromType === 'valve' && toType === 'pump') || (fromType === 'pump' && toType === 'valve')) && pipeProps.routeStyle === 'Straight') {
                            pipeProps.routeStyle = 'Elbow';
                        }
                        
                        globalModel[pipeId] = { type: "pipe", name: pipeId, desc: "Pipe Line", props: pipeProps };
                        
                        connections.push({
                            from: pendingConnectionStart.id,
                            fromPort: pendingConnectionStart.portSelector,
                            to: nodeId,
                            toPort: portClass,
                            pipeId: pipeId
                        });
                        
                        pendingConnectionStart = null;
                        selectNode(pipeId, null);
                        drawConnections();
                        updateSimulation();
                    }
                }
            }
        });
    });

    obj.addEventListener('click', (e) => {
        if (appMode !== 'CONNECT' || e.target.classList.contains('port')) return;
        const nodeId = obj.dataset.id;
        const node = globalModel[nodeId];
        if (node && isInstrumentType(node.type)) {
            e.stopPropagation();
            startInstrumentAttachment(nodeId, e);
            return;
        }

        const defaultPort = getDefaultConnectPort(!pendingConnectionStart);
        if (!defaultPort) return;
        e.stopPropagation();
        defaultPort.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            clientX: e.clientX,
            clientY: e.clientY
        }));
    });

    obj.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nodeId = obj.dataset.id;
        const node = globalModel[nodeId];

        if (node && isInstrumentType(node.type)) {
            const items = [
                {
                    label: 'Connect to pipeline',
                    action: () => {
                        setAppMode('CONNECT');
                        startInstrumentAttachment(nodeId, e);
                    }
                }
            ];

            if (node.props && node.props.attachedTo) {
                items.push({
                    label: 'Disconnect from pipeline',
                    danger: true,
                    action: () => detachInstrumentFromPipe(nodeId)
                });
            }

            items.push({
                label: 'Delete Instrument',
                danger: true,
                action: () => deleteNode(nodeId)
            });

            showContextMenu(e.clientX, e.clientY, items);
            return;
        }

        const defaultPort = getDefaultConnectPort(!pendingConnectionStart);
        if (!defaultPort) return;

        showContextMenu(e.clientX, e.clientY, [
            {
                label: pendingConnectionStart ? 'Connect here' : 'Connect',
                action: () => {
                    setAppMode('CONNECT');
                    defaultPort.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        clientX: e.clientX,
                        clientY: e.clientY
                    }));
                }
            },
            {
                label: 'Delete Object',
                danger: true,
                action: () => deleteNode(nodeId)
            }
        ]);
    });
}

function startInstrumentAttachment(instrumentId, e = null) {
    const instrument = globalModel[instrumentId];
    if (!instrument || !isInstrumentType(instrument.type)) return;

    const startPoint = getObjectCenterPosition(instrumentId);
    if (!startPoint) return;

    if (pendingConnectionStart) cancelPendingConnection(false);

    const currentPoint = e ? getCanvasPointFromEvent(e) : startPoint;
    pendingConnectionStart = {
        kind: 'instrument',
        id: instrumentId,
        currentX: currentPoint.x,
        currentY: currentPoint.y
    };

    onCanvasMouseMove = (ev) => {
        const point = getCanvasPointFromEvent(ev);
        pendingConnectionStart.currentX = point.x;
        pendingConnectionStart.currentY = point.y;
        drawConnections();
    };

    document.addEventListener('pointermove', onCanvasMouseMove);
    drawConnections();
}

function addEquipment(type) {
    captureState();

    const prefix = getObjectPrefix(type);
    
    let num = 100;
    while (globalModel[prefix + num] || document.getElementById('obj-' + (prefix + num).toLowerCase())) {
        num++;
    }
    const newId = prefix + num;

    const isInst = isInstrumentType(type);

    const objDiv = document.createElement('div');
    objDiv.className = getObjectClassName(type);
    objDiv.id = 'obj-' + newId.toLowerCase().replace(/-/g, '');
    objDiv.dataset.id = newId;
    objDiv.dataset.type = type;

    // Drop it near the center of the canvas
    const canvas = document.getElementById('canvas');
    const scrollLeft = canvas.scrollLeft;
    const scrollTop = canvas.scrollTop;
    const rect = canvas.getBoundingClientRect();
    
    objDiv.style.left = (scrollLeft + rect.width / 2 - 40) + 'px';
    objDiv.style.top = (scrollTop + rect.height / 2 - 40) + 'px';

    canvas.appendChild(objDiv);
    
    // Initialize model
    const props = getDefaultProps(type);
    
    const defaultDesc = getDefaultDescription(type);

    const node = {
        type: type,
        name: newId,
        desc: defaultDesc,
        props: props
    };
    const defaultResults = createDefaultResults(type);
    if (defaultResults) node.results = defaultResults;
    globalModel[newId] = node;

    objDiv.innerHTML = getObjectMarkup(type, newId, defaultDesc);

    applyObjectVisuals(newId);
    makeDraggable(objDiv);
    selectNode(newId, objDiv);
    setAppMode('SELECT');
}

function initDraggableObjects() {
    document.querySelectorAll('.pfd-object').forEach(makeDraggable);
}
