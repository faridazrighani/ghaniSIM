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

    const attachedLineMonitorReadout = el.classList.contains('object-type-lineMonitor') && el.classList.contains('is-attached')
        ? el.querySelector('.line-monitor-readout')
        : null;
    const target = attachedLineMonitorReadout || el.querySelector('.object-icon') || el;
    const rect = target.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    return {
        x: rect.left - canvasRect.left + rect.width / 2 + canvas.scrollLeft,
        y: rect.top - canvasRect.top + rect.height / 2 + canvas.scrollTop
    };
}

function getObjectAnchorPosition(id, selector) {
    const el = getObjectElement(id);
    if (!el) return null;
    const anchor = el.querySelector(selector);
    if (!anchor) return null;

    const rect = anchor.getBoundingClientRect();
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

function getRoutePointAtLocation(points, location = 0.5) {
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }

    const clampedLocation = Math.max(0, Math.min(1, parseFloat(location)));
    let targetLength = totalLength * (Number.isFinite(clampedLocation) ? clampedLocation : 0.5);
    for (let i = 1; i < points.length; i++) {
        const start = points[i - 1];
        const end = points[i];
        const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
        if (targetLength <= segmentLength || i === points.length - 1) {
            const t = segmentLength === 0 ? 0 : targetLength / segmentLength;
            return {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t
            };
        }
        targetLength -= segmentLength;
    }

    return points[0];
}

function getRouteMidpoint(points) {
    return getRoutePointAtLocation(points, 0.5);
}

function getRoutePointAndAngleAtLocation(points, location = 0.5) {
    let totalLength = 0;
    for (let i = 1; i < points.length; i += 1) {
        totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }

    const clampedLocation = Math.max(0, Math.min(1, parseFloat(location)));
    let targetLength = totalLength * (Number.isFinite(clampedLocation) ? clampedLocation : 0.5);
    for (let i = 1; i < points.length; i += 1) {
        const start = points[i - 1];
        const end = points[i];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segmentLength = Math.hypot(dx, dy);
        if (segmentLength === 0) continue;
        if (targetLength <= segmentLength || i === points.length - 1) {
            const t = targetLength <= 0 ? 0 : targetLength / segmentLength;
            return {
                x: start.x + dx * Math.max(0, Math.min(1, t)),
                y: start.y + dy * Math.max(0, Math.min(1, t)),
                angle: Math.atan2(dy, dx) * 180 / Math.PI
            };
        }
        targetLength -= segmentLength;
    }

    return { ...(points[0] || { x: 0, y: 0 }), angle: 0 };
}

function normalizePipeDeltaLabelAngle(angle) {
    let normalized = Number.isFinite(angle) ? angle : 0;
    while (normalized > 180) normalized -= 360;
    while (normalized < -180) normalized += 360;
    if (normalized > 90) normalized -= 180;
    if (normalized < -90) normalized += 180;
    return normalized;
}

function getPipeDeltaLabelAnchor(points, location = 0.5, offsetPx = 10) {
    const point = getRoutePointAndAngleAtLocation(points, location);
    const angle = normalizePipeDeltaLabelAngle(point.angle);
    const angleRad = angle * Math.PI / 180;
    return {
        x: point.x + Math.sin(angleRad) * offsetPx,
        y: point.y - Math.cos(angleRad) * offsetPx,
        angle
    };
}

function getRouteLength(points = []) {
    let totalLength = 0;
    for (let i = 1; i < points.length; i += 1) {
        totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return totalLength;
}

function escapeSvgText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function formatPipePressureLossDisplay(pressureLossBar) {
    const loss = parseFloat(pressureLossBar);
    if (!Number.isFinite(loss)) return null;
    const displayValueRaw = typeof convertToDisplay === 'function'
        ? convertToDisplay(loss, 'pressureDelta')
        : loss;
    const displayUnit = typeof getDisplayUnit === 'function'
        ? getDisplayUnit('pressureDelta', { pressureBasis: 'delta' })
        : 'bar';
    const displayValue = Math.abs(displayValueRaw) < 1e-9 ? 0 : displayValueRaw;
    const abs = Math.abs(displayValue);
    const digits = displayUnit === 'kPa'
        ? (abs >= 100 ? 0 : 1)
        : (abs >= 10 ? 2 : 3);
    const formatted = displayValue.toFixed(digits).replace(/\.?0+$/, '');
    return `${formatted} ${displayUnit}`;
}

function getPipeDeltaPressureData(pipe) {
    if (!pipe) return null;
    const pressureLoss = parseFloat(pipe.results?.pressureDrop);
    const hasPressureLoss = Number.isFinite(pressureLoss);
    const displayLoss = hasPressureLoss
        ? formatPipePressureLossDisplay(Math.max(0, pressureLoss))
        : '-';
    const inletPressure = parseFloat(pipe.results?.inletPressure);
    const outletPressure = parseFloat(pipe.results?.outletPressure);
    const endpointDelta = Number.isFinite(inletPressure) && Number.isFinite(outletPressure)
        ? inletPressure - outletPressure
        : null;
    return {
        pressureLoss: hasPressureLoss ? pressureLoss : null,
        displayText: `ΔP loss ${displayLoss}`,
        title: [
            pipe.name || 'Pipe',
            hasPressureLoss
                ? `ΔP loss ${Math.max(0, pressureLoss).toFixed(3)} bar`
                : 'ΔP loss not calculated yet',
            Number.isFinite(inletPressure) ? `Pin ${inletPressure.toFixed(3)} bar a` : '',
            Number.isFinite(outletPressure) ? `Pout ${outletPressure.toFixed(3)} bar a` : '',
            Number.isFinite(endpointDelta) ? `Pin-Pout ${endpointDelta.toFixed(3)} bar` : ''
        ].filter(Boolean).join(' | ')
    };
}

function getPipeDeltaLabelWidth(displayText) {
    if (!displayText) return 70;
    return Math.max(70, Math.min(132, displayText.length * 5.4 + 10));
}

function getPipeDeltaPressureLabelSvg(pipeId, routePoints) {
    const pipe = globalModel?.[pipeId];
    const data = getPipeDeltaPressureData(pipe);
    if (!data) return '';
    const anchor = getPipeDeltaLabelAnchor(routePoints, 0.5, 10);
    if (!anchor) return '';

    const labelWidth = getPipeDeltaLabelWidth(data.displayText);
    const labelHeight = 15;
    return `
        <g class="pipe-delta-label" data-pipe-id="${escapeSvgText(pipeId)}" transform="translate(${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}) rotate(${anchor.angle.toFixed(1)})">
            <title>${escapeSvgText(data.title)}</title>
            <rect class="pipe-delta-label-bg" x="${(-labelWidth / 2).toFixed(1)}" y="${(-labelHeight / 2).toFixed(1)}" width="${labelWidth.toFixed(1)}" height="${labelHeight}" rx="3" ry="3"></rect>
            <text class="pipe-delta-label-text" x="0" y="0">${escapeSvgText(data.displayText)}</text>
        </g>
    `;
}

function getRouteLocationFromPoint(points, point) {
    let totalLength = 0;
    let bestDistance = Infinity;
    let bestLength = 0;
    let traversedLength = 0;

    for (let i = 1; i < points.length; i++) {
        const start = points[i - 1];
        const end = points[i];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segmentLength = Math.hypot(dx, dy);
        totalLength += segmentLength;
        if (segmentLength === 0) continue;

        const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / Math.pow(segmentLength, 2)));
        const projected = {
            x: start.x + dx * t,
            y: start.y + dy * t
        };
        const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestLength = traversedLength + segmentLength * t;
        }

        traversedLength += segmentLength;
    }

    return totalLength === 0 ? 0.5 : Math.max(0, Math.min(1, bestLength / totalLength));
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

function getPipeTapPosition(pipeId, location = 0.5) {
    const routePoints = getPipeRoutePoints(pipeId);
    return routePoints ? getRoutePointAtLocation(routePoints, location) : null;
}

function getInstrumentLevelTargetPosition(targetId) {
    return getObjectAnchorPosition(targetId, '.instrument-anchor.level-anchor')
        || getObjectCenterPosition(targetId);
}

function getSourceAttachTargetPosition(link) {
    if (!link) return null;
    return getPortPosition(link.targetId, link.targetPort || '.port.inlet')
        || getPortPosition(link.targetId, '.port.inlet')
        || getObjectCenterPosition(link.targetId);
}

function getPipeLocationFromEvent(pipeId, event) {
    const routePoints = getPipeRoutePoints(pipeId);
    if (!routePoints) return 0.5;
    const point = getCanvasPointFromEvent(event);
    return getRouteLocationFromPoint(routePoints, point);
}

function drawConnections() {
    const svg = document.getElementById('svg-lines');
    let pathHTML = `
        <defs>
            <marker id="source-link-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#2f7d32"></path>
            </marker>
        </defs>
    `;
    
    connections.forEach(conn => {
        const routePoints = getPipeRoutePoints(conn.pipeId);
        if (routePoints) {
            const isSelected = (currentSelectedNode === conn.pipeId);
            const strokeColor = isSelected ? '#ffb703' : 'var(--pipe-color)';
            const strokeWidth = isSelected ? '8' : '4';
            pathHTML += `<path class="pipe-line" data-pipe-id="${conn.pipeId}" d="${pointsToPath(routePoints)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" stroke-linecap="round" style="cursor: pointer; pointer-events: stroke;" />`;
            pathHTML += getPipeDeltaPressureLabelSvg(conn.pipeId, routePoints);
        }
    });

    instrumentLinks.forEach(link => {
        const instrument = globalModel[link.instrumentId];
        if (!instrument) return;

        const p1 = getObjectCenterPosition(link.instrumentId);
        const isLevelLink = link.linkType === 'level-measurement' || link.measuredVariable === 'level' || (link.targetId && !link.pipeId);
        const p2 = isLevelLink
            ? getInstrumentLevelTargetPosition(link.targetId)
            : getPipeTapPosition(link.pipeId, link.location);
        if (!p1 || !p2) return;

        const selected = currentSelectedNode === link.instrumentId;
        const strokeColor = selected ? '#0078d7' : (isLevelLink ? '#2563eb' : '#627d98');
        const lineClass = isLevelLink ? 'instrument-tap-line instrument-level-line' : 'instrument-tap-line';
        pathHTML += `<path class="${lineClass}" d="${pointsToPath([p1, p2])}" stroke="${strokeColor}" fill="none" />`;
        pathHTML += `<circle class="instrument-tap-point${isLevelLink ? ' instrument-level-point' : ''}" cx="${p2.x}" cy="${p2.y}" r="4" fill="#fff" stroke="${strokeColor}" stroke-width="1.5" />`;
    });

    sourceLinks.forEach(link => {
        const source = globalModel[link.sourceId];
        const target = globalModel[link.targetId];
        if (!source || !target) return;
        if (typeof isSourceTypeSemanticAttachmentCapable === 'function' && !isSourceTypeSemanticAttachmentCapable(source)) return;

        const p1 = getPortPosition(link.sourceId, '.port.outlet') || getObjectCenterPosition(link.sourceId);
        const p2 = getSourceAttachTargetPosition(link);
        if (!p1 || !p2) return;

        const selected = currentSelectedNode === link.sourceId || currentSelectedNode === link.targetId;
        const strokeColor = selected ? '#2f7d32' : '#5c7f5c';
        pathHTML += `<path class="source-feed-line" d="${pointsToPath([p1, p2])}" stroke="${strokeColor}" marker-end="url(#source-link-arrow)" fill="none" />`;
        pathHTML += `<circle class="source-feed-point" cx="${p2.x}" cy="${p2.y}" r="4" fill="#f7fff7" stroke="${strokeColor}" stroke-width="1.5" />`;
    });
    
    if (pendingConnectionStart && Number.isFinite(pendingConnectionStart.currentX)) {
        const p1 = pendingConnectionStart.kind === 'instrument'
            ? getObjectCenterPosition(pendingConnectionStart.id)
            : pendingConnectionStart.kind === 'source'
                ? (getPortPosition(pendingConnectionStart.id, '.port.outlet') || getObjectCenterPosition(pendingConnectionStart.id))
            : getPortPosition(pendingConnectionStart.id, pendingConnectionStart.portSelector);
        if (p1) {
            const p2 = { x: pendingConnectionStart.currentX, y: pendingConnectionStart.currentY };
            if (pendingConnectionStart.kind === 'instrument') {
                const isLevelPreview = pendingConnectionStart.attachMode === 'level';
                pathHTML += `<path class="instrument-tap-line${isLevelPreview ? ' instrument-level-line' : ''} pipe-preview-line" d="${pointsToPath([p1, p2])}" stroke="${isLevelPreview ? '#2563eb' : '#627d98'}" fill="none" />`;
            } else if (pendingConnectionStart.kind === 'source') {
                pathHTML += `<path class="source-feed-line pipe-preview-line" d="${pointsToPath([p1, p2])}" stroke="#5c7f5c" marker-end="url(#source-link-arrow)" fill="none" />`;
            } else {
                const routePoints = buildPipeRoutePoints(p1, p2, pendingConnectionStart.routeStyle || 'Straight');
                pathHTML += `<path class="pipe-preview-line hydraulic-preview-line" d="${pointsToPath(routePoints)}" stroke="var(--pipe-color)" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round" />`;
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
                    if (pendingConnectionStart.attachMode === 'level') return;
                    attachInstrumentToPipe(pendingConnectionStart.id, path.dataset.pipeId, getPipeLocationFromEvent(path.dataset.pipeId, e));
                } else if (pendingConnectionStart && pendingConnectionStart.kind === 'source') {
                    return;
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
            document.querySelectorAll('.pfd-object').forEach(el => el.classList.remove('selected'));
            currentSelectedNode = pipeId;
            if (typeof updateCanvasSelectionActions === 'function') updateCanvasSelectionActions();
            drawConnections();
            const routeStyle = globalModel[pipeId]?.props?.routeStyle || 'Straight';
            const nextRouteStyle = routeStyle === 'Elbow' ? 'Straight' : 'Elbow';
            const items = [];
            if (typeof addUserTaskObjectPropertiesMenuItem === 'function') {
                addUserTaskObjectPropertiesMenuItem(items, pipeId);
            }

            if (pendingConnectionStart && pendingConnectionStart.kind === 'instrument') {
                const tapLocation = getPipeLocationFromEvent(pipeId, e);
                if (pendingConnectionStart.attachMode !== 'level') {
                    items.push({
                        label: 'Connect instrument here',
                        action: () => attachInstrumentToPipe(pendingConnectionStart.id, pipeId, tapLocation)
                    });
                }
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
