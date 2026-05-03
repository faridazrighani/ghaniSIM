function getPortPosition(id, portSelector) {
    const el = getObjectElement(id);
    if (!el) return null;
    const port = el.querySelector(portSelector);
    if (!port) return null;

    const rect = port.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    return {
        x: rect.left - canvasRect.left + rect.width / 2 + canvas.scrollLeft,
        y: rect.top - canvasRect.top + rect.height / 2 + canvas.scrollTop
    };
}

function getObjectCenterPosition(id) {
    const el = getObjectElement(id);
    if (!el) return null;

    const icon = el.querySelector('.object-icon') || el;
    const rect = icon.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    return {
        x: rect.left - canvasRect.left + rect.width / 2 + canvas.scrollLeft,
        y: rect.top - canvasRect.top + rect.height / 2 + canvas.scrollTop
    };
}

function buildPipeRoutePoints(p1, p2, routeStyle = 'Straight') {
    if (routeStyle !== 'Elbow') return [p1, p2];

    const midX = (p1.x + p2.x) / 2;
    return [
        p1,
        { x: midX, y: p1.y },
        { x: midX, y: p2.y },
        p2
    ];
}

function pointsToPath(points) {
    return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
}

function getRouteMidpoint(points) {
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }

    let halfway = totalLength / 2;
    for (let i = 1; i < points.length; i++) {
        const start = points[i - 1];
        const end = points[i];
        const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
        if (halfway <= segmentLength || i === points.length - 1) {
            const t = segmentLength === 0 ? 0 : halfway / segmentLength;
            return {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t
            };
        }
        halfway -= segmentLength;
    }

    return points[0];
}

function getPipeRoutePoints(pipeId) {
    const conn = connections.find(item => item.pipeId === pipeId);
    if (!conn) return null;

    const p1 = getPortPosition(conn.from, conn.fromPort);
    const p2 = getPortPosition(conn.to, conn.toPort);
    if (!p1 || !p2) return null;

    const routeStyle = globalModel[pipeId]?.props?.routeStyle || 'Straight';
    return buildPipeRoutePoints(p1, p2, routeStyle);
}

function getPipeTapPosition(pipeId) {
    const routePoints = getPipeRoutePoints(pipeId);
    return routePoints ? getRouteMidpoint(routePoints) : null;
}

function drawConnections() {
    const svg = document.getElementById('svg-lines');
    let pathHTML = '';
    
    connections.forEach(conn => {
        const routePoints = getPipeRoutePoints(conn.pipeId);
        if (routePoints) {
            const isSelected = (currentSelectedNode === conn.pipeId);
            const strokeColor = isSelected ? '#ffb703' : 'var(--pipe-color)';
            const strokeWidth = isSelected ? '8' : '4';
            pathHTML += `<path class="pipe-line" data-pipe-id="${conn.pipeId}" d="${pointsToPath(routePoints)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" stroke-linecap="round" style="cursor: pointer; pointer-events: stroke;" />`;
        }
    });

    instrumentLinks.forEach(link => {
        const instrument = globalModel[link.instrumentId];
        const pipe = globalModel[link.pipeId];
        if (!instrument || !pipe) return;

        const p1 = getObjectCenterPosition(link.instrumentId);
        const p2 = getPipeTapPosition(link.pipeId);
        if (!p1 || !p2) return;

        const selected = currentSelectedNode === link.instrumentId;
        const strokeColor = selected ? '#0078d7' : '#627d98';
        pathHTML += `<path class="instrument-tap-line" d="${pointsToPath([p1, p2])}" stroke="${strokeColor}" fill="none" />`;
        pathHTML += `<circle class="instrument-tap-point" cx="${p2.x}" cy="${p2.y}" r="4" fill="#fff" stroke="${strokeColor}" stroke-width="1.5" />`;
    });
    
    if (pendingConnectionStart && Number.isFinite(pendingConnectionStart.currentX)) {
        const p1 = pendingConnectionStart.kind === 'instrument'
            ? getObjectCenterPosition(pendingConnectionStart.id)
            : getPortPosition(pendingConnectionStart.id, pendingConnectionStart.portSelector);
        if (p1) {
            const p2 = { x: pendingConnectionStart.currentX, y: pendingConnectionStart.currentY };
            if (pendingConnectionStart.kind === 'instrument') {
                pathHTML += `<path class="instrument-tap-line pipe-preview-line" d="${pointsToPath([p1, p2])}" stroke="#627d98" fill="none" />`;
            } else {
                const routePoints = buildPipeRoutePoints(p1, p2, pendingConnectionStart.routeStyle || 'Straight');
                pathHTML += `<path class="pipe-preview-line" d="${pointsToPath(routePoints)}" stroke="var(--pipe-color)" stroke-width="4" stroke-dasharray="8,6" fill="none" stroke-linejoin="round" stroke-linecap="round" />`;
            }
        }
    }
    
    svg.innerHTML = pathHTML;
    
    // Attach click listeners to pipes
    svg.querySelectorAll('.pipe-line').forEach(path => {
        path.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            e.stopPropagation();
            if (appMode === 'CONNECT') {
                if (pendingConnectionStart && pendingConnectionStart.kind === 'instrument') {
                    attachInstrumentToPipe(pendingConnectionStart.id, path.dataset.pipeId);
                } else {
                    selectNode(path.dataset.pipeId, null);
                    drawConnections();
                }
            } else {
                selectNode(path.dataset.pipeId, null);
                drawConnections();
            }
        });

        path.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pipeId = path.dataset.pipeId;
            selectNode(pipeId, null);
            drawConnections();
            const routeStyle = globalModel[pipeId]?.props?.routeStyle || 'Straight';
            const nextRouteStyle = routeStyle === 'Elbow' ? 'Straight' : 'Elbow';
            const items = [];

            if (pendingConnectionStart && pendingConnectionStart.kind === 'instrument') {
                items.push({
                    label: 'Connect instrument here',
                    action: () => attachInstrumentToPipe(pendingConnectionStart.id, pipeId)
                });
            }

            items.push(
                {
                    label: nextRouteStyle === 'Elbow' ? 'Use elbow' : 'Use straight',
                    action: () => {
                        if (globalModel[pipeId]) {
                            globalModel[pipeId].props.routeStyle = nextRouteStyle;
                            renderSidebar(pipeId);
                            drawConnections();
                        }
                    }
                },
                { label: 'Disconnect pipe', danger: true, action: () => disconnectPipe(pipeId) }
            );

            showContextMenu(e.clientX, e.clientY, items);
        });
    });
}
