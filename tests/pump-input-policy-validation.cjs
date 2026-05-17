const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');
const context = { console, Math, Number, parseFloat, JSON };
context.window = context;
vm.createContext(context);

[
    'properties/objects/pump-properties.js',
    'formulas/objects/pump-formulas.js'
].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(projectRoot, file), 'utf8'), context, { filename: file });
});

const result = vm.runInContext(`
(() => {
    const props = {
        ...PUMP_DEFAULT_PROPS,
        curveData: PUMP_DEFAULT_PROPS.curveData.map(point => ({ ...point }))
    };
    const before = getPumpInputAudit(props);
    applyPumpScreeningDefaults(props);
    const after = getPumpInputAudit(props);
    const safe = evaluateNpshMargin(4, 3, props, 'POR');
    const warning = evaluateNpshMargin(3.5, 3, props, 'POR');
    const engineeringProps = {
        ...props,
        npshAssessmentMode: PUMP_NPSH_ASSESSMENT_ENGINEERING,
        npshrSourceMode: PUMP_NPSHR_SOURCE_ESTIMATED
    };
    const engineeringPerformance = createPumpPerformanceModel({ props: engineeringProps });
    const engineeringEstimated = applyPumpNpshrSourceQualityToEvaluation(
        evaluateNpshMargin(4, 3, engineeringProps, 'POR'),
        engineeringPerformance,
        engineeringProps
    );
    const standardCriteria = getEffectivePumpNpshMarginCriteria({
        ...props,
        npshMarginBasis: PUMP_NPSH_MARGIN_GENERAL_PURPOSE
    }, 'AOR');
    return {
        defaultDesignFlow: PUMP_DEFAULT_PROPS.designFlow,
        defaultNpshr: PUMP_DEFAULT_PROPS.designNpshr,
        placeholder: getPumpInputPlaceholder('designFlow'),
        before,
        after,
        safe,
        warning,
        engineeringEstimated,
        standardCriteria
    };
})()
`, context);

assert.equal(result.defaultDesignFlow, '', 'New pump Design Flow should start empty, not as active default data.');
assert.equal(result.defaultNpshr, '', 'New pump NPSHr should start empty, not as active default data.');
assert.equal(result.placeholder, 'example: 100', 'Screening defaults should be exposed as placeholders.');
assert.equal(result.before.isReady, false, 'Blank pump inputs should require user action before evaluation.');
assert.ok(result.before.missing.includes('Design Flow'), 'Input audit should identify missing Design Flow.');
assert.equal(result.after.isReady, true, 'Screening defaults should intentionally make the input set evaluable.');
assert.equal(result.safe.requiredNpsha, 3.6, 'Required NPSHa should use max(NPSHr x ratio, NPSHr + margin).');
assert.equal(result.safe.status, 'Safe', 'NPSHa above conservative required NPSHa should be Safe.');
assert.equal(result.warning.status, 'Warning', 'NPSHa above NPSHr but below required NPSHa should be Warning.');
assert.equal(result.engineeringEstimated.status, 'Warning', 'Engineering Validation should not pass estimated NPSHr as final.');
assert.equal(result.standardCriteria.ratio, 1.1, 'General Purpose AOR ratio should follow the standard preset.');
assert.equal(result.standardCriteria.margin, 1, 'General Purpose AOR margin should follow the standard preset.');

console.log(JSON.stringify({
    passed: true,
    inputPolicy: 'blank-until-user-or-screening-defaults',
    requiredNpsha: result.safe.requiredNpsha,
    standardAor: {
        ratio: result.standardCriteria.ratio,
        margin: result.standardCriteria.margin
    }
}, null, 2));
