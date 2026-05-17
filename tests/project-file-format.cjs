const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const menuBar = fs.readFileSync(path.join(root, 'toolbar', 'menu-bar.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs', 'project_file_format.md'), 'utf8');

assert(indexHtml.includes('id="menu-import-legacy-hysys"'), 'File menu should expose Import Legacy .hysys');
assert(menuBar.includes('function fileImportLegacyHysys()'), 'Legacy .hysys import handler should exist');
assert(menuBar.includes('LEGACY_HYSYS_FILE_TYPES'), 'Legacy import should use a dedicated file type');

assert(menuBar.includes("const UNTIRTA_MAGIC = 'UNTIRTA-NPSH-V1\\n';"), '.untirta magic header should be defined');
assert(menuBar.includes("const UNTIRTA_PROJECT_EXTENSION = '.untirta';"), '.untirta should be the official save extension');
assert(menuBar.includes('Ghani-NPSH-${yyyy}${mm}${dd}-${hh}${mi}${ss}${UNTIRTA_PROJECT_EXTENSION}'), 'Save As filename should use Ghani-NPSH-YYYYMMDD-HHMMSS.untirta');
assert(!menuBar.includes('hysys-simulation-${timestamp}.hysys'), 'Old default .hysys filename should not remain');

assert(menuBar.includes('CompressionStream'), '.untirta save path should use browser compression when available');
assert(menuBar.includes('DecompressionStream'), '.untirta open path should support compressed payloads');
assert(menuBar.includes("window.crypto.subtle.digest('SHA-256'"), '.untirta payload should be checksummed with SHA-256');
assert(menuBar.includes('checksum !== header.checksum'), 'Open path should reject checksum mismatches');

assert(menuBar.includes('PROJECT_MAX_FILE_BYTES'), 'Project open/import should enforce a file size limit');
assert(menuBar.includes('PROJECT_MAX_OBJECTS'), 'Project open/import should enforce object limits');
assert(menuBar.includes('PROJECT_UNSAFE_KEYS'), 'Project sanitizer should drop unsafe prototype keys');
assert(menuBar.includes('applySimulationStateAtomic'), 'Project load should be atomic');
assert(menuBar.includes('applySimulationState(previousState)'), 'Atomic load should restore previous state on apply failure');
assert(menuBar.includes('normalizeAllLevelControllerTrendHistoriesForSave(globalModel)'), 'Project save should include normalized LIC trend history');
assert(menuBar.includes('restoreLevelControllerTrendState(globalModel)'), 'Project open should restore LIC trend history');
assert(menuBar.includes('suppressLevelControllerTrendRecording = true'), 'Project open should avoid adding artificial LIC trend samples during load');
assert(!/\beval\s*\(/.test(menuBar), 'Project file handling should not use eval');
assert(!/new\s+Function\s*\(/.test(menuBar), 'Project file handling should not create dynamic functions');

assert(docs.includes('Ghani-NPSH-YYYYMMDD-HHMMSS.untirta'), 'Project file documentation should state the unique filename pattern');
assert(docs.includes('File > Import Legacy .hysys...'), 'Project file documentation should describe legacy import');
assert(docs.includes('Load is atomic'), 'Project file documentation should document atomic load safety');
assert(docs.includes('Level controller trend charts are stored'), 'Project file documentation should describe LIC trend persistence');
assert(docs.includes('Dynamic tank inventory state is also stored'), 'Project file documentation should describe dynamic tank inventory persistence');
assert(docs.includes('selected realtime interval'), 'Project file documentation should describe realtime dynamic interval persistence');

console.log('project-file-format validation passed');
