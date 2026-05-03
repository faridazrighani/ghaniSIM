function isSidebarEditActive() {
    const active = document.activeElement;
    return !!(active && active.closest && active.closest('#propTableBody') && active.matches('input, select, textarea'));
}

function setSidebarReadout(key, value, unit = '') {
    const el = document.querySelector(`td.prop-value[data-key="${key}"]`);
    if (!el) return;
    if (value === null || value === undefined || value === '') {
        el.textContent = '-';
        return;
    }
    const displayValue = (typeof value === 'number' && !Number.isInteger(value)) ? value.toFixed(3) : value;
    el.textContent = displayValue + (unit ? ' ' + unit : '');
}

function formatReadoutValue(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(3);
    return value;
}

function clearSelection() {
    document.querySelectorAll('.pfd-object').forEach(el => el.classList.remove('selected'));
    currentSelectedNode = null;
    document.getElementById('propTableHeader').textContent = 'Select an Object';
    document.getElementById('propTableBody').innerHTML = `
        <tr>
            <td colspan="2" style="text-align: center; color: #888; padding: 20px;">
                Click on an equipment or stream on the canvas to view its properties here.
            </td>
        </tr>
    `;
    document.getElementById('editorHint').style.display = 'none';
}

function renderSidebar(nodeId) {
    const node = globalModel[nodeId];
    if (!node) {
        clearSelection();
        return;
    }

    document.getElementById('propTableHeader').textContent = node.name || nodeId;
    
    const tbody = document.getElementById('propTableBody');
    tbody.innerHTML = ''; // clear
    
    // Helper to add rows
    const addRow = (label, value, key, isReadOnly = false, unit = '', inputType = null, options = []) => {
        const tr = document.createElement('tr');
        
        const tdLabel = document.createElement('td');
        tdLabel.className = 'prop-label';
        tdLabel.textContent = label;
        
        const tdVal = document.createElement('td');
        tdVal.className = 'prop-value';
        
        if (isReadOnly) {
            if (key) tdVal.dataset.key = key;
            const displayValue = formatReadoutValue(value);
            tdVal.textContent = displayValue + (unit && displayValue !== '-' ? ' ' + unit : '');
        } else {
            let inp;
            if (inputType === 'select') {
                inp = document.createElement('select');
                inp.className = 'prop-input-field';
                inp.style.padding = '2px';
                options.forEach(opt => {
                    const optEl = document.createElement('option');
                    optEl.value = opt;
                    optEl.textContent = opt;
                    if (opt === value) optEl.selected = true;
                    inp.appendChild(optEl);
                });
            } else {
                inp = document.createElement('input');
                inp.type = typeof value === 'number' ? 'number' : 'text';
                inp.className = 'prop-input-field';
                inp.value = value;
            }
            inp.dataset.key = key;
            inp.dataset.node = nodeId;
            
            // On input change, update model and resimulate
            inp.addEventListener(inputType === 'select' ? 'change' : 'input', (e) => {
                const k = e.target.dataset.key;
                const n = e.target.dataset.node;
                const v = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                globalModel[n].props[k] = v;

                if (isVisualResizableType(globalModel[n].type) && k === 'visualScale') {
                    applyObjectVisuals(n);
                    drawConnections();
                    return;
                }
                 
                // Auto-calculate for Advanced Fluid Properties
                if (n === 'FLUID' && globalModel[n].props.inputMode === 'Advanced') {
                    if (k === 'sg') {
                        globalModel[n].props.density = v * 998.2;
                        if (globalModel[n].props.dynViscosity && globalModel[n].props.density > 0) {
                            globalModel[n].props.viscosity = globalModel[n].props.dynViscosity / (globalModel[n].props.density / 1000);
                        }
                        const rDensity = document.querySelector('td.prop-value[data-key="density"]');
                        if(rDensity) rDensity.textContent = globalModel[n].props.density.toFixed(2) + ' kg/m3';
                        const rVisc = document.querySelector('td.prop-value[data-key="viscosity"]');
                        if(rVisc) rVisc.textContent = globalModel[n].props.viscosity.toFixed(3) + ' cSt';
                    } else if (k === 'dynViscosity') {
                        if (globalModel[n].props.density > 0) {
                            globalModel[n].props.viscosity = v / (globalModel[n].props.density / 1000);
                        }
                        const rVisc = document.querySelector('td.prop-value[data-key="viscosity"]');
                        if(rVisc) rVisc.textContent = globalModel[n].props.viscosity.toFixed(3) + ' cSt';
                    } else if (k === 'density' || k === 'bulkModulus') {
                        // Re-trigger extended calc if primary inputs change
                        recalcExtendedFluidProps(globalModel[n]);
                        const rVol = document.querySelector('td.prop-value[data-key="specVolume"]');
                        if(rVol) rVol.textContent = globalModel[n].props.specVolume.toFixed(6) + ' m3/kg';
                        const rWt = document.querySelector('td.prop-value[data-key="specWeight"]');
                        if(rWt) rWt.textContent = globalModel[n].props.specWeight.toFixed(2) + ' N/m3';
                        const rSnd = document.querySelector('td.prop-value[data-key="speedOfSound"]');
                        if(rSnd) rSnd.textContent = globalModel[n].props.speedOfSound.toFixed(2) + ' m/s';
                    }
                }
                
                // Auto-calculate geometry for Tank
                if (globalModel[n].type === 'tank') {
                    if (k === 'liquidLevel' || k === 'diameter') {
                        const L = globalModel[n].props.liquidLevel || 0;
                        const D = globalModel[n].props.diameter || 0;
                        globalModel[n].props.volume = calculateTankLiquidVolume(D, L);
                        const rVol = document.querySelector(`td.prop-value[data-key="volume"]`);
                        if (rVol) rVol.textContent = globalModel[n].props.volume.toFixed(3) + ' m3';
                    }
                }
                
                // Auto-calculate for Pipe Material
                if (globalModel[n].type === 'pipe' && k === 'material') {
                    let r = 0.045; // default Commercial Steel
                    if (v === 'PVC / Plastic') r = 0.0015;
                    else if (v === 'Stainless Steel') r = 0.015;
                    else if (v === 'Galvanized Iron') r = 0.15;
                    else if (v === 'Cast Iron') r = 0.26;
                    else if (v === 'Concrete') r = 1.5;
                    
                    globalModel[n].props.roughness = r;
                    renderSidebar(n); // re-render to show updated roughness
                    return; // renderSidebar calls updateSimulation
                }

                if (globalModel[n].type === 'pipe' && k === 'routeStyle') {
                    drawConnections();
                    return;
                }
                
                updateSimulation(); // Recalculate
            });
            
            tdVal.appendChild(inp);
            if (unit) {
                tdVal.appendChild(document.createTextNode(' ' + unit));
            }
        }
        
        tr.appendChild(tdLabel);
        tr.appendChild(tdVal);
        tbody.appendChild(tr);
    };

    // Render based on type
    if (node.type === 'fluid') {
        const modeTr = document.createElement('tr');
        modeTr.innerHTML = `
            <td class="prop-label">Input Mode</td>
            <td class="prop-value">
                <select class="prop-input-field" style="padding:2px;" id="fluidInputMode">
                    <option value="Basic" ${node.props.inputMode === 'Basic' ? 'selected' : ''}>Basic</option>
                    <option value="Advanced" ${node.props.inputMode === 'Advanced' ? 'selected' : ''}>Advanced</option>
                </select>
            </td>
        `;
        tbody.appendChild(modeTr);
        
        document.getElementById('fluidInputMode').addEventListener('change', (e) => {
            node.props.inputMode = e.target.value;
            renderSidebar(nodeId);
        });

        const fluidTr = document.createElement('tr');
        fluidTr.innerHTML = `
            <td class="prop-label">Fluid Name</td>
            <td class="prop-value">
                <select class="prop-input-field" style="padding:2px;" id="fluidNameSelect">
                    <option value="Custom" ${node.props.fluidName === 'Custom' ? 'selected' : ''}>Custom Fluid</option>
                    <option value="Water" ${node.props.fluidName === 'Water' ? 'selected' : ''}>Water (Auto)</option>
                    <option value="Methanol" ${node.props.fluidName === 'Methanol' ? 'selected' : ''}>Methanol (Auto)</option>
                    <option value="Palm Oil" ${node.props.fluidName === 'Palm Oil' ? 'selected' : ''}>Palm Oil (Auto)</option>
                    <option value="Crude Oil" ${node.props.fluidName === 'Crude Oil' ? 'selected' : ''}>Crude Oil (Auto)</option>
                </select>
            </td>
        `;
        tbody.appendChild(fluidTr);
        
        document.getElementById('fluidNameSelect').addEventListener('change', (e) => {
            node.props.fluidName = e.target.value;
            if (e.target.value === 'Water') {
                updateWaterProperties();
                updateSimulation();
            } else if (e.target.value === 'Methanol') {
                updateMethanolProperties();
                updateSimulation();
            } else if (e.target.value === 'Palm Oil') {
                updatePalmOilProperties();
                updateSimulation();
            } else if (e.target.value === 'Crude Oil') {
                updateCrudeOilProperties();
                updateSimulation();
            }
            renderSidebar(nodeId);
        });

        const tempRow = document.createElement('tr');
        tempRow.innerHTML = `
            <td class="prop-label">Temperature</td>
            <td class="prop-value">
                <input type="number" class="prop-input-field" value="${node.props.temp}" id="fluidTempInput" style="width: 70%;"> deg C
            </td>
        `;
        tbody.appendChild(tempRow);
        
        document.getElementById('fluidTempInput').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            node.props.temp = val;
            if (node.props.fluidName === 'Water' || node.props.fluidName === 'Methanol' || node.props.fluidName === 'Palm Oil' || node.props.fluidName === 'Crude Oil') {
                if (node.props.fluidName === 'Water') updateWaterProperties();
                if (node.props.fluidName === 'Methanol') updateMethanolProperties();
                if (node.props.fluidName === 'Palm Oil') updatePalmOilProperties();
                if (node.props.fluidName === 'Crude Oil') updateCrudeOilProperties();
                
                // Real-time update DOM to avoid losing focus
                const ids = ['density', 'sg', 'dynViscosity', 'viscosity', 'vaporPressure', 'specVolume', 'specWeight', 'speedOfSound'];
                ids.forEach(k => {
                    const el = document.querySelector('td.prop-value[data-key="'+k+'"]');
                    if(el) {
                        let unit = '';
                        if(k==='density') unit = ' kg/m3';
                        else if(k==='dynViscosity') unit = ' cP';
                        else if(k==='viscosity') unit = ' cSt';
                        else if(k==='vaporPressure') unit = ' bar a';
                        else if(k==='specVolume') unit = ' m3/kg';
                        else if(k==='specWeight') unit = ' N/m3';
                        else if(k==='speedOfSound') unit = ' m/s';
                        
                        el.textContent = (k==='specVolume'?node.props[k].toFixed(6):node.props[k].toFixed(3)) + unit;
                    }
                });
            }
            updateSimulation();
        });
        
        const isAuto = node.props.fluidName === 'Water' || node.props.fluidName === 'Methanol' || node.props.fluidName === 'Palm Oil' || node.props.fluidName === 'Crude Oil';
        
        if (node.props.inputMode === 'Basic') {
            addRow('Density', node.props.density, 'density', isAuto, 'kg/m3');
            addRow('Kinematic Visc.', node.props.viscosity, 'viscosity', isAuto, 'cSt');
            addRow('Vapor Pressure', node.props.vaporPressure, 'vaporPressure', isAuto, 'bar a');
        } else {
            const advHeader = document.createElement('tr');
            advHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Advanced Properties</td>';
            tbody.appendChild(advHeader);
            
            addRow('Spec. Gravity', node.props.sg, 'sg', isAuto, '');
            addRow('Density', node.props.density, 'density', true, 'kg/m3');
            addRow('Dynamic Visc.', node.props.dynViscosity, 'dynViscosity', isAuto, 'cP');
            addRow('Kinematic Visc.', node.props.viscosity, 'viscosity', true, 'cSt');
            addRow('Vapor Pressure', node.props.vaporPressure, 'vaporPressure', isAuto, 'bar a');
            addRow('Specific Heat', node.props.specificHeat, 'specificHeat', isAuto, 'kJ/kg.K');
            addRow('Bulk Modulus', node.props.bulkModulus, 'bulkModulus', isAuto, 'GPa');
            
            const extHeader = document.createElement('tr');
            extHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Extended Properties</td>';
            tbody.appendChild(extHeader);
            
            addRow('Spec. Volume', node.props.specVolume, 'specVolume', true, 'm3/kg');
            addRow('Spec. Weight', node.props.specWeight, 'specWeight', true, 'N/m3');
            addRow('Speed of Sound', node.props.speedOfSound, 'speedOfSound', true, 'm/s');
        }
    } else if (node.type === 'pump') {
        const modeTr = document.createElement('tr');
        modeTr.innerHTML = `
            <td class="prop-label">Input Mode</td>
            <td class="prop-value">
                <select class="prop-input-field" style="padding:2px;" id="pumpInputMode" data-node="${nodeId}">
                    <option value="Basic" ${node.props.inputMode === 'Basic' ? 'selected' : ''}>Basic</option>
                    <option value="Advanced" ${node.props.inputMode === 'Advanced' ? 'selected' : ''}>Advanced</option>
                </select>
            </td>
        `;
        tbody.appendChild(modeTr);
        
        document.getElementById('pumpInputMode').addEventListener('change', (e) => {
            node.props.inputMode = e.target.value;
            renderSidebar(nodeId);
            updateSimulation();
        });
        
        addRow('Elevation', node.props.elevation, 'elevation', false, 'm', 'number');

        if (node.props.inputMode === 'Basic') {
            addRow('Design Flow', node.props.designFlow, 'designFlow', false, 'm3/h', 'number');
            addRow('Design Head', node.props.designHead, 'designHead', false, 'm', 'number');
            addRow('Design Eff.', node.props.designEfficiency, 'designEfficiency', false, '%', 'number');
        } else {
            // Advanced curve table
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.style.padding = '0';
            
            let curveHtml = `
                <div style="padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-weight: bold; color: #1c4568;">Curve Data</span>
                        <button class="btn-add-segment" data-node="${nodeId}">Add point</button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="segment-table" id="pumpCurveTable">
                            <thead>
                                <tr>
                                    <th>Flow</th>
                                    <th>Head</th>
                                    <th>Eff %</th>
                                    <th>NPSHr</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            node.props.curveData.forEach((pt, i) => {
                curveHtml += `
                    <tr>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="flow" value="${pt.flow}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="head" value="${pt.head}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="eff" value="${pt.eff}"></td>
                        <td><input type="number" class="segment-input" data-idx="${i}" data-field="npshr" value="${pt.npshr}"></td>
                        <td><button class="btn-remove-segment" data-idx="${i}" data-node="${nodeId}">X</button></td>
                    </tr>
                `;
            });
            
            curveHtml += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            td.innerHTML = curveHtml;
            tr.appendChild(td);
            tbody.appendChild(tr);
            
            td.querySelectorAll('.segment-input').forEach(inp => {
                inp.addEventListener('input', (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    const field = e.target.dataset.field;
                    node.props.curveData[idx][field] = parseFloat(e.target.value) || 0;
                    updateSimulation({ renderSidebarAfter: false });
                });
            });
            
            td.querySelector('.btn-add-segment').addEventListener('click', () => {
                const last = node.props.curveData[node.props.curveData.length - 1];
                node.props.curveData.push({
                    flow: last ? last.flow + 50 : 50,
                    head: last ? Math.max(0, last.head - 10) : 40,
                    eff: 75,
                    npshr: 2
                });
                renderSidebar(nodeId);
                updateSimulation();
            });
            
            td.querySelectorAll('.btn-remove-segment').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    node.props.curveData.splice(idx, 1);
                    renderSidebar(nodeId);
                    updateSimulation();
                });
            });
        }
        
        // Add a separator for results
        const resHeader = document.createElement('tr');
        resHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Operating Results</td>';
        tbody.appendChild(resHeader);
        
        addRow('Flow Rate (Q)', node.results.flow, 'result-flow', true, 'm3/h');
        addRow('Total Head', node.results.head, 'result-head', true, 'm');
        addRow('Efficiency', node.results.efficiency, 'result-efficiency', true, '%');
        addRow('Hyd. Power', node.results.power, 'result-power', true, 'kW');
        addRow('NPSH Avail.', node.results.npsha, 'result-npsha', true, 'm');
        addRow('NPSH Req.', node.results.npshr, 'result-npshr', true, 'm');
    } else if (node.type === 'pipe') {
        if (node.props.routeStyle === undefined) node.props.routeStyle = 'Straight';
        addRow('Pipe Routing', node.props.routeStyle, 'routeStyle', false, '', 'select', ['Straight', 'Elbow']);

        // Minor loss
        if (node.props.minorLoss === undefined) node.props.minorLoss = 0;
        addRow('Fittings (K)', node.props.minorLoss, 'minorLoss', false, '', 'number');

        const disconnectTr = document.createElement('tr');
        disconnectTr.innerHTML = `
            <td colspan="2" style="padding: 8px 12px;">
                <button class="btn-disconnect-pipe" data-pipe-id="${nodeId}">Disconnect pipe</button>
            </td>
        `;
        tbody.appendChild(disconnectTr);
        disconnectTr.querySelector('.btn-disconnect-pipe').addEventListener('click', () => {
            disconnectPipe(nodeId);
        });
        
        // Segments table
        const segTr = document.createElement('tr');
        const segTd = document.createElement('td');
        segTd.colSpan = 2;
        segTd.style.padding = '0';
        let segHtml = `
            <div style="padding: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-weight: bold; color: #1c4568;">Segments</span>
                    <button class="btn-add-segment" data-node="${nodeId}">Add Segment</button>
                </div>
                <div style="overflow-x: auto;">
                    <table class="segment-table" id="pipeSegmentTable">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Len(m)</th>
                                <th>Dia(m)</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        node.props.segments.forEach((seg, i) => {
            segHtml += `
                <tr>
                    <td><input type="text" class="segment-input" data-idx="${i}" data-field="name" value="${seg.name}"></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="length" value="${seg.length}"></td>
                    <td><input type="number" class="segment-input" data-idx="${i}" data-field="diameter" value="${seg.diameter}" step="0.01"></td>
                    <td><button class="btn-remove-segment" data-idx="${i}" data-node="${nodeId}">X</button></td>
                </tr>
            `;
        });
        
        segHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        segTd.innerHTML = segHtml;
        segTr.appendChild(segTd);
        tbody.appendChild(segTr);
        
        segTd.querySelectorAll('.segment-input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const field = e.target.dataset.field;
                const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                node.props.segments[idx][field] = val;
                updateSimulation({ renderSidebarAfter: false });
            });
        });
        
        segTd.querySelector('.btn-add-segment').addEventListener('click', () => {
            node.props.segments.push({
                name: "New Seg",
                pipeSize: "Custom diameter",
                diameter: 0.1,
                length: 10,
                roughness: 0.000045
            });
            renderSidebar(nodeId);
            updateSimulation();
        });
        
        segTd.querySelectorAll('.btn-remove-segment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                node.props.segments.splice(idx, 1);
                renderSidebar(nodeId);
                updateSimulation();
            });
        });

    } else {
        if (typeof renderObjectProperties === 'function') {
            renderObjectProperties(node.type, nodeId, node, addRow, tbody);
        } else {
            addRow('Notes', 'No custom properties defined for this object type.', '', true);
        }
    }
}

// Modal Chart Init
function initializeChart() {
    const ctx = document.getElementById('pumpChart').getContext('2d');
    Chart.defaults.font.family = "'Segoe UI', sans-serif";
    
    pumpChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Pump Head', data: [], borderColor: '#1c4568', borderWidth: 2, tension: 0.4 },
                { label: 'System Curve', data: [], borderColor: '#e63946', borderWidth: 2, borderDash: [5, 5], tension: 0.4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Flow Rate (m3/h)' }, grid: { color: '#f0f0f0'} },
                y: { title: { display: true, text: 'Head (m)' }, min: 0, grid: { color: '#f0f0f0'} }
            }
        }
    });
}

// Modal Drag
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('fullEditor');
    const header = document.getElementById('editorHeader');
    if(modal && header) {
        const closePumpEditor = () => {
            activeChartPumpId = null;
            modal.style.display = 'none';
        };

        let m1 = 0, m2 = 0, m3 = 0, m4 = 0;
        header.onpointerdown = (e) => {
            if (e.target.closest('.modal-close')) return;

            e.preventDefault();
            if (header.setPointerCapture && e.pointerId !== undefined) {
                header.setPointerCapture(e.pointerId);
            }
            m3 = e.clientX; m4 = e.clientY;
            const closeModalDrag = () => {
                document.removeEventListener('pointerup', closeModalDrag);
                document.removeEventListener('pointercancel', closeModalDrag);
                document.removeEventListener('pointermove', moveModal);
            };
            const moveModal = (e) => {
                e.preventDefault();
                m1 = m3 - e.clientX; m2 = m4 - e.clientY;
                m3 = e.clientX; m4 = e.clientY;
                modal.style.top = (modal.offsetTop - m2) + "px";
                modal.style.left = (modal.offsetLeft - m1) + "px";
            };
            document.addEventListener('pointerup', closeModalDrag);
            document.addEventListener('pointercancel', closeModalDrag);
            document.addEventListener('pointermove', moveModal);
        };

        const closeBtn = document.getElementById('closeEditor');
        if(closeBtn) {
            closeBtn.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
            });

            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePumpEditor();
            });
        }
    }
});
