/**
 * Smoke-Test für Phase-H-Exportdateien.
 * Ausführen mit: node scripts/verify_phase_h.mjs
 */

import { DownloadHelper }       from '../src/export/utils/DownloadHelper.js';
import { FileNameHelper }       from '../src/export/utils/FileNameHelper.js';
import { ExportLogger }         from '../src/export/utils/ExportLogger.js';
import { CoordinateConverter }  from '../src/export/CoordinateConverter.js';
import { ExportSnapshotBuilder } from '../src/export/ExportSnapshotBuilder.js';
import { ExportValidator }      from '../src/export/ExportValidator.js';

let passed = 0;
let failed = 0;

function assert(cond, label) {
    if (cond) {
        console.log(`  ✓  ${label}`);
        passed++;
    } else {
        console.error(`  ✗  FAIL: ${label}`);
        failed++;
    }
}

// ─── DownloadHelper ───────────────────────────────────────────────────────────
console.log('\n── DownloadHelper ──────────────────────────────────────────');
assert(typeof DownloadHelper.downloadBlob     === 'function', 'downloadBlob is function');
assert(typeof DownloadHelper.downloadText     === 'function', 'downloadText is function');
assert(typeof DownloadHelper.downloadBinary   === 'function', 'downloadBinary is function');
assert(typeof DownloadHelper.downloadJSON     === 'function', 'downloadJSON is function');
assert(typeof DownloadHelper.sanitizeFilename === 'function', 'sanitizeFilename is function');
// DownloadHelper.sanitizeFilename keeps ! and () — they are valid filename chars.
// Only replaces path separators / \ and Windows-reserved chars : < > " | ? *
assert(DownloadHelper.sanitizeFilename('hello world!') === 'hello world!', 'sanitize: ! retained (valid char)');
assert(DownloadHelper.sanitizeFilename('  ')           === 'export',       'sanitize: blank→fallback');
assert(DownloadHelper.sanitizeFilename('My File (v2)') === 'My File (v2)', 'sanitize: parens retained (valid chars)');
assert(DownloadHelper.sanitizeFilename('a/b\\c')       === 'a_b_c',        'sanitize: slashes→_');
assert(DownloadHelper.sanitizeFilename('a:b*c')        === 'a_b_c',        'sanitize: Win-reserved chars→_');

// ─── FileNameHelper ───────────────────────────────────────────────────────────
console.log('\n── FileNameHelper ──────────────────────────────────────────');
assert(FileNameHelper.forLDraw('My Model')        === 'my_model.ldr',                           'forLDraw single');
assert(FileNameHelper.forLDraw('My Model', true)  === 'my_model.mpd',                           'forLDraw multi');
assert(FileNameHelper.forGLTF('My Model')         === 'my_model.glb',                           'forGLTF binary');
assert(FileNameHelper.forGLTF('My Model', false)  === 'my_model.gltf',                          'forGLTF text');
assert(FileNameHelper.forCSV('My Model')          === 'stueckliste_my_model.csv',               'forCSV');
assert(FileNameHelper.forJSON('My Model')         === 'stueckliste_my_model.json',              'forJSON');
assert(FileNameHelper.forPDF('My Model')          === 'stueckliste_my_model_druckansicht.html', 'forPDF');
assert(FileNameHelper.sanitize('A B+C')           === 'a_bc',                                   'sanitize lowercase');

// ─── ExportLogger ─────────────────────────────────────────────────────────────
console.log('\n── ExportLogger ────────────────────────────────────────────');
const log = new ExportLogger({ silent: true });
log.info('Starte Export', { format: 'ldraw' });
log.warn('Kein LDraw-Name', { id: 'abc' });
log.error('Keine ID', {});

assert(log.getAll().length    === 3,     'getAll returns 3 entries');
assert(log.getErrors().length === 1,     'getErrors returns 1');
assert(log.getWarnings().length === 1,   'getWarnings returns 1');
assert(log.hasErrors()        === true,  'hasErrors true');
const cnt = log.getCount();
assert(cnt.info === 1 && cnt.warning === 1 && cnt.error === 1, 'getCount correct');
const rep = log.toReport();
assert(rep.hasErrors    === true,  'report.hasErrors');
assert(rep.hasWarnings  === true,  'report.hasWarnings');
assert(rep.errors.length   === 1,  'report.errors list');
assert(rep.warnings.length === 1,  'report.warnings list');
assert(rep.infos.length    === 1,  'report.infos list');
log.clear();
assert(log.getAll().length === 0,  'clear resets log');

// ─── CoordinateConverter ──────────────────────────────────────────────────────
console.log('\n── CoordinateConverter ─────────────────────────────────────');
assert(CoordinateConverter.STUD_TO_LDRAW === 20, 'STUD_TO_LDRAW = 20');
assert(Array.isArray(CoordinateConverter.MIRROR_Y) && CoordinateConverter.MIRROR_Y.length === 9, 'MIRROR_Y is 9-element array');

const ld = CoordinateConverter.positionToLDraw({ x: 1, y: 2, z: 3 });
assert(ld.x === 20 && ld.y === -40 && ld.z === 60, 'positionToLDraw: x*20, -y*20, z*20');
const back = CoordinateConverter.positionFromLDraw(ld);
assert(Math.abs(back.x - 1) < 1e-10 && Math.abs(back.y - 2) < 1e-10 && Math.abs(back.z - 3) < 1e-10, 'positionFromLDraw roundtrip');

// Identity from zero Euler
const m = CoordinateConverter.eulerToRotationMatrix({ x: 0, y: 0, z: 0 });
assert(m.length === 9, 'eulerToRotationMatrix returns 9 elements');
assert(Math.abs(m[0] - 1) < 1e-10 && Math.abs(m[4] - 1) < 1e-10 && Math.abs(m[8] - 1) < 1e-10, 'identity diagonal = 1');
assert(Math.abs(m[1]) < 1e-10 && Math.abs(m[2]) < 1e-10 && Math.abs(m[3]) < 1e-10, 'identity off-diagonal = 0');

// LDraw matrix from zero euler: mirror_Y * I * mirror_Y = I
const ml = CoordinateConverter.eulerToLDrawMatrix({ x: 0, y: 0, z: 0 });
assert(Math.abs(ml[0] - 1) < 1e-10, 'ldraw identity m00=1');
assert(Math.abs(ml[4] - 1) < 1e-10, 'ldraw identity m11=1');
assert(Math.abs(ml[8] - 1) < 1e-10, 'ldraw identity m22=1');

// formatLDrawLine
const line = CoordinateConverter.formatLDrawLine(16, { x: 20, y: -40, z: 60 }, ml, '3001.dat');
assert(line.startsWith('1 16 20 -40 60 '), 'formatLDrawLine starts correctly');
assert(line.endsWith('3001.dat'),           'formatLDrawLine ends with partFile');
assert(line.split(' ').length === 15,       'formatLDrawLine has 15 tokens');

// rotationMatrixToLDraw: verify Y-mirror flips the right sign
// Pure Y-rotation by 90°: m01=0,m10=0, but off-Y-axis elements affected
const mYrot = CoordinateConverter.eulerToRotationMatrix({ x: 0, y: Math.PI / 2, z: 0 });
const mYldraw = CoordinateConverter.rotationMatrixToLDraw(mYrot);
// m01 (col1,row0) involves signI=1*signJ=-1 → flipped; m10 (col0,row1) involves signI=-1*signJ=1 → flipped
// m00 and m22 are unaffected (signI=signJ=1 or both -1)
assert(Math.abs(mYldraw[0] - mYrot[0]) < 1e-10, 'mirror: m00 unchanged');
assert(Math.abs(mYldraw[8] - mYrot[8]) < 1e-10, 'mirror: m22 unchanged');
assert(Math.abs(mYldraw[3] + mYrot[3]) < 1e-10, 'mirror: m01 sign-flipped');

// ─── ExportSnapshotBuilder ────────────────────────────────────────────────────
console.log('\n── ExportSnapshotBuilder ───────────────────────────────────');

// Minimal stub library with two parts: one Brick, one PartInstance
const stubLibrary = {
    getAllData() {
        return [
            // Brick (no source field)
            { id: 'b1', type: 'custom_cube', color: 0xFF0000,
              position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
            // PartInstance
            { id: 'p1', type: '3001', color: 0x0000FF, source: 'ldraw',
              colorId: 4, ldrawPartNumber: '3001.dat', variantId: 'v1',
              position: { x: 1, y: 2, z: 3 }, rotation: { x: 0.1, y: 0.2, z: 0.3 } },
        ];
    }
};

const stubCatalog = {
    getPartById(id) {
        if (id === '3001') return { name: 'Brick 2x4', category: 'Brick', width: 2, depth: 4, height: 1, geometry: 'standard' };
        return null;
    }
};

const builder = new ExportSnapshotBuilder({
    library: stubLibrary,
    partCatalog: stubCatalog,
    projectName: 'Testprojekt',
});

const snap = builder.build();

assert(snap.metadata.projectName === 'Testprojekt', 'metadata.projectName');
assert(snap.metadata.formatVersion === 1,            'metadata.formatVersion');
assert(typeof snap.metadata.exportedAt === 'string', 'metadata.exportedAt is string');
assert(snap.metadata.partCount === 2,                'metadata.partCount');
assert(snap.metadata.hasLDrawParts === true,         'metadata.hasLDrawParts');
assert(snap.metadata.hasLocalParts === true,         'metadata.hasLocalParts');

assert(snap.parts.length === 2, 'parts array has 2 entries');

const brick = snap.parts.find(p => p.id === 'b1');
assert(brick !== undefined,          'brick found');
assert(brick.source === 'local',     'brick.source = local');
assert(brick.ldrawPartNumber === null,'brick.ldrawPartNumber = null');
assert(brick.colorId === null,       'brick.colorId = null');
assert(brick.variantId === null,     'brick.variantId = null');
assert(brick.partId === 'custom_cube','brick.partId from type');
assert(brick.name === null,          'brick.name = null (not in catalog)');

const part = snap.parts.find(p => p.id === 'p1');
assert(part !== undefined,               'partInstance found');
assert(part.source === 'ldraw',          'part.source = ldraw');
assert(part.ldrawPartNumber === '3001.dat', 'part.ldrawPartNumber');
assert(part.colorId === 4,              'part.colorId');
assert(part.variantId === 'v1',         'part.variantId');
assert(part.name === 'Brick 2x4',       'part.name from catalog');
assert(part.category === 'Brick',       'part.category from catalog');
assert(part.width === 2,                'part.width from catalog');
assert(part.position.x === 1 && part.position.y === 2 && part.position.z === 3, 'part.position');

assert(Array.isArray(snap.assemblies),           'assemblies is array');
assert(Array.isArray(snap.groups),               'groups is array');
assert(Array.isArray(snap.connections),          'connections is array');
assert(Array.isArray(snap.mechanicalConnections),'mechanicalConnections is array');

// With assemblyManager
const stubAssemblyManager = {
    getAll() {
        return [
            { id: 'g1', name: 'Hauptgruppe', brickIds: new Set(['b1', 'p1']) },
        ];
    },
    getAllAssemblies() {
        return [
            { groupId: 'g1', mechanicalConnectionIds: ['mc1'] },
        ];
    },
};

const builder2 = new ExportSnapshotBuilder({
    library: stubLibrary,
    partCatalog: stubCatalog,
    assemblyManager: stubAssemblyManager,
    projectName: 'Testprojekt2',
});
const snap2 = builder2.build();
assert(snap2.groups.length === 1,                     'groups array has 1 entry');
assert(snap2.groups[0].name === 'Hauptgruppe',        'group.name');
assert(snap2.groups[0].partIds.includes('b1'),        'group contains b1');
assert(snap2.assemblies.length === 1,                 'assemblies has 1 entry');
assert(snap2.assemblies[0].mechanicalConnectionIds.includes('mc1'), 'assembly has mc1');
const brickInGroup = snap2.parts.find(p => p.id === 'b1');
assert(brickInGroup.groupIds.includes('g1'),          'brick.groupIds includes g1');
assert(brickInGroup.assemblyIds.includes('g1'),       'brick.assemblyIds includes g1');

// ─── ExportValidator ─────────────────────────────────────────────────────────
console.log('\n── ExportValidator ─────────────────────────────────────────');
const v = new ExportValidator();

// Null snapshot → valid
const r0 = v.validate(null, 'ldraw');
assert(r0.valid === true && r0.canExport === true, 'null snapshot → valid');

// Missing partId → error
const r1 = v.validate({
    parts: [{
        id: 'x1', partId: '', source: 'ldraw',
        position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 },
        colorId: 4, ldrawPartNumber: '3001.dat',
    }]
}, 'ldraw');
assert(r1.valid === false, 'missing partId → error');
assert(r1.findings.some(f => f.code === 'MISSING_PART_ID' && f.level === 'error'), 'MISSING_PART_ID code');

// Invalid position → error
const r2 = v.validate({
    parts: [{
        id: 'x2', partId: '3001', source: 'ldraw',
        position: { x: NaN, y: 0, z: 0 }, rotation: { x:0,y:0,z:0 },
        colorId: 4, ldrawPartNumber: '3001.dat',
    }]
}, 'gltf');
assert(r2.valid === false, 'invalid position → error');
assert(r2.findings.some(f => f.code === 'INVALID_POSITION'), 'INVALID_POSITION code');

// Invalid rotation → warning only
const r3 = v.validate({
    parts: [{
        id: 'x3', partId: '3001', source: 'ldraw',
        position: { x:0,y:0,z:0 }, rotation: { x:NaN,y:0,z:0 },
        colorId: 4, ldrawPartNumber: '3001.dat',
    }]
}, 'csv');
assert(r3.valid === true, 'invalid rotation → warning (still valid)');
assert(r3.canExport === true, 'invalid rotation → canExport true');
assert(r3.findings.some(f => f.code === 'INVALID_ROTATION' && f.level === 'warning'), 'INVALID_ROTATION warning');

// LDraw: missing ldrawPartNumber → warning
const r4 = v.validate({
    parts: [{
        id: 'x4', partId: '3001', source: 'ldraw',
        position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 },
        colorId: 4, ldrawPartNumber: null,
    }]
}, 'ldraw');
assert(r4.valid === true, 'missing ldrawPartNumber → not an error');
assert(r4.canExport === true, 'missing ldrawPartNumber → canExport');
assert(r4.findings.some(f => f.code === 'MISSING_LDRAW_NUMBER' && f.level === 'warning'), 'MISSING_LDRAW_NUMBER warning');
assert(r4.summary.skippedParts === 1, 'skippedParts counts part without LDraw number');
assert(r4.summary.exportableParts === 0, 'exportableParts = 0 when all skipped');

// LDraw: local brick → info
const r5 = v.validate({
    parts: [{
        id: 'x5', partId: 'cube', source: 'local',
        position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 },
        colorId: null, ldrawPartNumber: null,
    }]
}, 'ldraw');
assert(r5.findings.some(f => f.code === 'LOCAL_PART_NO_LDRAW' && f.level === 'info'), 'LOCAL_PART_NO_LDRAW info');

// LDraw: unknown color → warning
const r6 = v.validate({
    parts: [{
        id: 'x6', partId: '3001', source: 'ldraw',
        position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 },
        colorId: null, ldrawPartNumber: '3001.dat',
    }]
}, 'ldraw');
assert(r6.findings.some(f => f.code === 'UNKNOWN_LDRAW_COLOR' && f.level === 'warning'), 'UNKNOWN_LDRAW_COLOR warning');

// CSV: missing name → info
const r7 = v.validate({
    parts: [{
        id: 'x7', partId: '3001', source: 'ldraw',
        position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 },
        colorId: 4, ldrawPartNumber: '3001.dat', name: null,
    }]
}, 'csv');
assert(r7.findings.some(f => f.code === 'MISSING_NAME' && f.level === 'info'), 'MISSING_NAME info (CSV)');

// JSON: missing colorId → info
const r8 = v.validate({
    parts: [{
        id: 'x8', partId: '3001', source: 'ldraw',
        position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 },
        colorId: null, ldrawPartNumber: '3001.dat', name: 'Brick 2x4',
    }]
}, 'json');
assert(r8.findings.some(f => f.code === 'MISSING_COLOR_ID' && f.level === 'info'), 'MISSING_COLOR_ID info (JSON)');

// GLTF: no ldraw-specific checks
const r9 = v.validate({
    parts: [{
        id: 'x9', partId: '3001', source: 'ldraw',
        position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 },
        colorId: null, ldrawPartNumber: null,
    }]
}, 'gltf');
assert(!r9.findings.some(f => f.code === 'MISSING_LDRAW_NUMBER'), 'GLTF: no MISSING_LDRAW_NUMBER check');

// Summary counts
const r10 = v.validate({
    parts: [
        { id: 'a', partId: '3001', source: 'ldraw', position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 }, colorId: 4, ldrawPartNumber: '3001.dat' },
        { id: 'b', partId: '3001', source: 'ldraw', position: { x:0,y:0,z:0 }, rotation: { x:0,y:0,z:0 }, colorId: 4, ldrawPartNumber: null },
    ]
}, 'ldraw');
assert(r10.summary.exportableParts === 1, 'summary.exportableParts = 1');
assert(r10.summary.skippedParts    === 1, 'summary.skippedParts = 1');

// ─── Final summary ────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`  Total: ${passed + failed} checks — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
