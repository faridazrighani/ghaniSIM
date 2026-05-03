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
                resolve();
            } catch (err) {
                reject(err);
            } finally {
                input.remove();
            }
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
        visuals: {}
    };
    document.querySelectorAll('.pfd-object').forEach(el => {
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
    
    Object.keys(globalModel).forEach(k => delete globalModel[k]);
    Object.assign(globalModel, data.model);
    connections.splice(0, connections.length, ...data.connections);
    instrumentLinks.splice(0, instrumentLinks.length, ...(data.instrumentLinks || []));
    
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.pfd-object').forEach(el => {
        if(el.id !== 'obj-fluid') el.remove();
    });
    
    for (let key in globalModel) {
        if (key === 'FLUID' || globalModel[key].type === 'pipe') continue;
        
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
    
    if (data.visuals && data.visuals['FLUID']) {
        const fluidDiv = document.getElementById('obj-fluid');
        if (fluidDiv) {
            fluidDiv.style.left = data.visuals['FLUID'].left;
            fluidDiv.style.top = data.visuals['FLUID'].top;
        }
    }

    currentSelectedNode = null;
    renderSidebar(null);
    drawConnections();
    updateSimulation();
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

function clearSimulationCanvas() {
    if(!confirm("Are you sure you want to clear the canvas? Unsaved changes will be lost.")) return;
    captureState();
    
    Object.keys(globalModel).forEach(k => delete globalModel[k]);
    globalModel["FLUID"] = { 
        type: "fluid", 
        name: "Fluid & Duty", 
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
            speedOfSound: 1482
        } 
    };
    connections.splice(0, connections.length);
    instrumentLinks.splice(0, instrumentLinks.length);
    
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.pfd-object').forEach(el => {
        if(el.id !== 'obj-fluid') el.remove();
    });
    const fluidDiv = document.getElementById('obj-fluid');
    if (fluidDiv) {
        fluidDiv.style.left = '40px';
        fluidDiv.style.top = '40px';
    }

    currentSelectedNode = null;
    renderSidebar(null);
    drawConnections();
    updateSimulation();
}

async function fileClose() {
    clearSimulationCanvas();
    currentFileHandle = null;
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
        alert('File saved successfully!');
    } catch (err) {
        console.error(err);
        alert('Failed to save file.');
    }
}

async function fileOpen() {
    if (!window.showOpenFilePicker) {
        try {
            await openSimulationFileFallback();
        } catch (err) {
            console.error(err);
            alert('Failed to open file.');
        }
        return;
    }

    try {
        const [handle] = await window.showOpenFilePicker({
            types: HYSYS_FILE_TYPES
        });
        currentFileHandle = handle;
        const file = await handle.getFile();
        const text = await file.text();
        
        applySimulationState(text);
        
        undoStack = [];
        redoStack = [];
    } catch (err) {
        console.error(err);
        alert('Failed to open file.');
    }
}

// Menu Initialization
function initMenuBar() {
    const positionDropdown = (container, dropdown) => {
        const rect = container.getBoundingClientRect();
        dropdown.style.left = `${Math.max(6, Math.min(rect.left, window.innerWidth - dropdown.offsetWidth - 6))}px`;
        dropdown.style.top = `${Math.min(rect.bottom + 2, window.innerHeight - 8)}px`;
    };

    // File Menu Logic
    const menuFile = document.getElementById('menu-file');
    const fileDropdown = document.getElementById('file-dropdown-container');
    
    if (menuFile && fileDropdown) {
        const fileDropdownContent = document.getElementById('dropdown-file');
        menuFile.addEventListener('click', (e) => {
            e.stopPropagation();
            editDropdown?.classList.remove('show');
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
            menuNew.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileClose();
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

        const menuClearFile = document.getElementById('menu-clear-file');
        if(menuClearFile) {
            menuClearFile.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                clearSimulationCanvas();
            });
        }
        
        const menuClose = document.getElementById('menu-close');
        if(menuClose) {
            menuClose.addEventListener('click', (e) => {
                e.preventDefault();
                fileDropdown.classList.remove('show');
                fileClose();
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
            menuClear.addEventListener('click', (e) => {
                e.preventDefault();
                editDropdown.classList.remove('show');
                clearSimulationCanvas();
            });
        }
    }
}
