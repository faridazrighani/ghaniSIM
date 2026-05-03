const EQUIPMENT_SCHEMAS = {
    tank: TANK_SCHEMA,
    pipe: PIPE_SCHEMA,
    valve: VALVE_SCHEMA,
    checkValve: CHECK_VALVE_SCHEMA,
    separator: SEPARATOR_SCHEMA,
    verticalVessel: VERTICAL_VESSEL_SCHEMA,
    heatExchanger: HEAT_EXCHANGER_SCHEMA,
    mixer: MIXER_SCHEMA,
    pressureIndicator: PRESSURE_INDICATOR_SCHEMA,
    flowIndicator: FLOW_INDICATOR_SCHEMA,
    temperatureIndicator: TEMPERATURE_INDICATOR_SCHEMA,
    lineMonitor: LINE_MONITOR_SCHEMA,
    levelController: LEVEL_CONTROLLER_SCHEMA,
    source: SOURCE_SCHEMA,
    sink: SINK_SCHEMA,
    junction: JUNCTION_SCHEMA
};

function copyDefaultValue(value) {
    if (Array.isArray(value)) return value.map(item => ({ ...item }));
    if (value && typeof value === 'object') return { ...value };
    return value;
}

function getDefaultProps(type) {
    if (type === 'pump') {
        return {
            ...PUMP_DEFAULT_PROPS,
            curveData: PUMP_DEFAULT_PROPS.curveData.map(point => ({ ...point }))
        };
    }

    const props = {};
    if (EQUIPMENT_SCHEMAS[type]) {
        for (let key in EQUIPMENT_SCHEMAS[type]) {
            props[key] = copyDefaultValue(EQUIPMENT_SCHEMAS[type][key].default);
        }
    }

    if (type === 'pipe') {
        props.segments = PIPE_DEFAULT_SEGMENTS.map(segment => ({ ...segment }));
    }

    return props;
}

function renderObjectProperties(type, nodeId, node, addRow, tbody) {
    const schema = EQUIPMENT_SCHEMAS[type];
    if (!schema) {
        addRow('Notes', 'No custom properties defined for this object type.', '', true);
        return;
    }

    Object.keys(schema).forEach(key => {
        const def = schema[key];
        if (!node.props) node.props = {};
        if (node.props[key] === undefined) {
            node.props[key] = copyDefaultValue(def.default);
        }

        addRow(
            def.label || key,
            node.props[key],
            key,
            !!def.readonly,
            def.unit || '',
            def.type === 'select' ? 'select' : def.type,
            def.options || []
        );
    });

    if (typeof isInstrumentType === 'function' && isInstrumentType(type)) {
        const readoutHeader = document.createElement('tr');
        readoutHeader.innerHTML = '<td colspan="2" style="background:#eee; font-weight:bold; padding:4px 8px; text-align:center;">Pipeline Readout</td>';
        tbody.appendChild(readoutHeader);

        addRow('Attached Pipe', node.props.attachedTo || '-', 'instrument-attached-to', true);
        if (type === 'lineMonitor') {
            addRow('Pressure', node.props.measuredPressure, 'instrument-pressure', true, 'bar');
            addRow('Flow', node.props.measuredFlow, 'instrument-flow', true, 'm3/h');
            addRow('Temperature', node.props.measuredTemperature, 'instrument-temperature', true, 'deg C');
        } else {
            addRow('Measured Value', node.props.measuredValue, 'instrument-measured', true, node.props.measuredUnit || '');
            addRow('Signal', node.props.measuredPercent, 'instrument-signal', true, '%');
        }

        const actionTr = document.createElement('tr');
        actionTr.innerHTML = `
            <td colspan="2" style="padding: 8px 12px;">
                <button class="btn-connect-instrument" data-node="${nodeId}">Connect to pipeline</button>
                <button class="btn-disconnect-instrument" data-node="${nodeId}">Disconnect</button>
            </td>
        `;
        tbody.appendChild(actionTr);

        actionTr.querySelector('.btn-connect-instrument').addEventListener('click', () => {
            setAppMode('CONNECT');
            startInstrumentAttachment(nodeId);
        });
        actionTr.querySelector('.btn-disconnect-instrument').addEventListener('click', () => {
            detachInstrumentFromPipe(nodeId);
            updateSimulation({ renderSidebarAfter: false });
        });
    }
}
