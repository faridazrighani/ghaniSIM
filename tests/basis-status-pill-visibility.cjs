const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const classSet = new Set();
const compactClassSet = new Set();
const elements = {
    basisStatusPill: {
        hidden: false,
        title: '',
        attributes: {},
        tabIndex: 0,
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        classList: {
            toggle(name, enabled) {
                if (enabled) classSet.add(name);
                else classSet.delete(name);
            }
        }
    },
    basisStatusFluid: { textContent: '' },
    basisStatusUnits: { textContent: '' },
    basisCompactStatus: {
        hidden: true,
        title: '',
        attributes: {},
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        classList: {
            toggle(name, enabled) {
                if (enabled) compactClassSet.add(name);
                else compactClassSet.delete(name);
            }
        }
    },
    basisCompactFluid: { textContent: '' },
    basisCompactUnits: { textContent: '' }
};

const context = {
    console,
    Math,
    Number,
    parseFloat,
    JSON,
    document: {
        getElementById(id) {
            return elements[id] || null;
        }
    },
    globalModel: {
        FLUID: {
            type: 'fluid',
            name: 'Fluid Basis',
            props: { fluidName: 'Water', temp: 25 }
        }
    }
};
context.window = context;
vm.createContext(context);

['formulas/constants.js', 'core/unit-system.js'].forEach(file => {
    vm.runInContext(
        fs.readFileSync(path.join(projectRoot, file), 'utf8'),
        context,
        { filename: file }
    );
});

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

vm.runInContext('updateBasisStatusPill()', context);
assert(elements.basisStatusPill.hidden === false, 'Basis status pill should be visible on first startup before confirmation');
assert(elements.basisStatusPill.attributes['aria-hidden'] === 'false', 'Startup pill should not be aria-hidden');
assert(elements.basisStatusPill.tabIndex === 0, 'Startup pill should be focusable');
assert(classSet.has('basis-status-unconfirmed'), 'Startup pill should show unconfirmed class');
assert(elements.basisCompactStatus.hidden === true, 'Compact basis status should stay hidden before Apply');
assert(elements.basisCompactStatus.attributes['aria-hidden'] === 'true', 'Compact basis status should be aria-hidden before Apply');

vm.runInContext('confirmBasisSetup()', context);
assert(elements.basisStatusPill.hidden === true, 'Basis status pill should hide after Apply Basis / Start Modeling');
assert(elements.basisStatusPill.attributes['aria-hidden'] === 'true', 'Confirmed clean pill should be aria-hidden');
assert(elements.basisStatusPill.tabIndex === -1, 'Confirmed clean pill should not be focusable');
assert(classSet.has('basis-status-confirmed-clean'), 'Confirmed clean class should be set after apply');
assert(elements.basisCompactStatus.hidden === false, 'Compact basis status should appear after Apply');
assert(elements.basisCompactStatus.attributes['aria-hidden'] === 'false', 'Compact basis status should be exposed after Apply');
assert(compactClassSet.has('basis-compact-status-active'), 'Compact basis status should mark active clean basis');
assert(elements.basisCompactFluid.textContent.includes('Water'), 'Compact basis status should include active fluid');
assert(elements.basisCompactUnits.textContent === 'Metric / European Engineering', 'Compact basis status should include active unit standard');

vm.runInContext(`markBasisDirty('Unit standard changed after confirmation.')`, context);
assert(elements.basisStatusPill.hidden === false, 'Basis status pill should reappear when confirmed basis becomes dirty');
assert(elements.basisStatusPill.attributes['aria-hidden'] === 'false', 'Dirty pill should not be aria-hidden');
assert(elements.basisStatusPill.tabIndex === 0, 'Dirty pill should be focusable');
assert(classSet.has('basis-status-dirty'), 'Dirty class should be set when basis needs reconfirmation');
assert(elements.basisCompactStatus.hidden === true, 'Compact basis status should hide when basis needs reconfirmation');

console.log('basis-status-pill-visibility: ok');
