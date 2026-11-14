/**
 * Verifikationsskript – Phase F Verbindungspunkt-System
 * Führt grundlegende Smoke-Tests durch und gibt eine Zusammenfassung aus.
 */

import { CONNECTION_TYPES, CONNECTION_TYPE_LIST, isValidConnectionType, getLegacyType }
    from '../src/connections/ConnectionTypes.js';

import { ConnectionPoint }
    from '../src/connections/ConnectionPoint.js';

import { ConnectionPointManager }
    from '../src/connections/ConnectionPointManager.js';

import { BUILTIN_CONNECTION_POINT_DEFINITIONS, countBuiltinConnectionPoints, countDefinedPartTypes }
    from '../src/connections/ConnectionPointDefinitions.js';

let passed = 0;
let failed = 0;

function check(label, condition) {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.error(`  ✗ FAILED: ${label}`);
        failed++;
    }
}

// ── ConnectionTypes ───────────────────────────────────────────────────────────
console.log('\n=== ConnectionTypes ===');
check('CONNECTION_TYPES is frozen', Object.isFrozen(CONNECTION_TYPES));
check('Has STUD', CONNECTION_TYPES.STUD === 'stud');
check('Has ANTI_STUD', CONNECTION_TYPES.ANTI_STUD === 'anti-stud');
check('Has TECHNIC_HOLE', CONNECTION_TYPES.TECHNIC_HOLE === 'technic-hole');
check('Has STUD_TO_BOTTOM legacy alias', CONNECTION_TYPES.STUD_TO_BOTTOM === 'stud-to-bottom');
check('isValidConnectionType("stud") = true', isValidConnectionType('stud'));
check('isValidConnectionType("stud-to-bottom") = true', isValidConnectionType('stud-to-bottom'));
check('isValidConnectionType("banana") = false', !isValidConnectionType('banana'));
check('isValidConnectionType(null) = false', !isValidConnectionType(null));
const legacy = getLegacyType('stud-to-bottom');
check('getLegacyType("stud-to-bottom") has length 2', legacy.length === 2);
check('getLegacyType("stud-to-bottom")[0] = "stud"', legacy[0] === 'stud');
check('getLegacyType("stud-to-bottom")[1] = "anti-stud"', legacy[1] === 'anti-stud');
check('getLegacyType("unknown") = []', getLegacyType('unknown').length === 0);
check('CONNECTION_TYPE_LIST is array', Array.isArray(CONNECTION_TYPE_LIST));
check('CONNECTION_TYPE_LIST has 13 entries (12 types + 1 legacy alias)', CONNECTION_TYPE_LIST.length === 13);
console.log(`  → Types: ${CONNECTION_TYPE_LIST.join(', ')}`);

// ── ConnectionPoint ───────────────────────────────────────────────────────────
console.log('\n=== ConnectionPoint ===');
const cp = new ConnectionPoint({
    id:            'test_stud_0_0',
    partId:        'brick_2x4',
    type:          'stud',
    localPosition: { x: -1.5, y: 1.2, z: -0.5 },
    direction:     { x: 0, y: 1, z: 0 },
});
check('Constructor runs without error', cp !== null);
check('id getter', cp.id === 'test_stud_0_0');
check('partId getter', cp.partId === 'brick_2x4');
check('type getter', cp.type === 'stud');
check('isStud()', cp.isStud());
check('!isAntiStud()', !cp.isAntiStud());
check('!isTechnic()', !cp.isTechnic());
check('localPosition.y = 1.2', Math.abs(cp.localPosition.y - 1.2) < 1e-9);

const antiStud = new ConnectionPoint({
    id:            'test_anti_0_0',
    partId:        'brick_2x4',
    type:          'anti-stud',
    localPosition: { x: -1.5, y: 0, z: -0.5 },
    direction:     { x: 0, y: -1, z: 0 },
});
check('stud.isCompatibleWith(antiStud)', cp.isCompatibleWith(antiStud));
check('antiStud.isCompatibleWith(stud)', antiStud.isCompatibleWith(cp));
check('stud NOT compatible with stud', !cp.isCompatibleWith(cp));

// worldPosition test
const wpos = cp.worldPosition({ position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0 } });
check('worldPosition.x = 1 + (-1.5) = -0.5', Math.abs(wpos.x - (-0.5)) < 1e-6);
check('worldPosition.y = 2 + 1.2  = 3.2',   Math.abs(wpos.y - 3.2)   < 1e-6);
check('worldPosition.z = 3 + (-0.5) = 2.5', Math.abs(wpos.z - 2.5)   < 1e-6);

// toData / fromData round-trip
const data = cp.toData();
const cp2  = ConnectionPoint.fromData(data);
check('toData/fromData round-trip id',   cp2.id   === cp.id);
check('toData/fromData round-trip type', cp2.type === cp.type);

// Error handling
let threw = false;
try { new ConnectionPoint({ id: '', partId: 'x', type: 'stud', localPosition: {x:0,y:0,z:0}, direction: {x:0,y:1,z:0} }); }
catch(e) { threw = true; }
check('Empty id throws TypeError', threw);

threw = false;
try { new ConnectionPoint({ id: 'x', partId: 'x', type: 'banana', localPosition: {x:0,y:0,z:0}, direction: {x:0,y:1,z:0} }); }
catch(e) { threw = true; }
check('Invalid type throws RangeError', threw);

// ── ConnectionPointManager ────────────────────────────────────────────────────
console.log('\n=== ConnectionPointManager ===');
ConnectionPointManager.resetInstance();
const mgr = ConnectionPointManager.instance();
check('instance() returns object', mgr instanceof ConnectionPointManager);
check('instance() is singleton', mgr === ConnectionPointManager.instance());

// Load builtins
const loaded = mgr.loadBuiltinDefinitions(BUILTIN_CONNECTION_POINT_DEFINITIONS);
check('loadBuiltinDefinitions returns >0', loaded > 0);
console.log(`  → Loaded ${loaded} connection points across ${mgr.getStats().defined} part types`);

const stats = mgr.getStats();
check('getStats().defined >= 50', stats.defined >= 50);
check('getStats().total > 100', stats.total > 100);

check('hasPoints("brick_2x4")', mgr.hasPoints('brick_2x4'));
check('!hasPoints("nonexistent")', !mgr.hasPoints('nonexistent'));

const b24pts = mgr.getPointsForPart('brick_2x4');
check('brick_2x4 has 16 points (8 studs + 8 anti-studs)', b24pts.length === 16);
const b24Studs     = b24pts.filter(p => p.isStud());
const b24AntiStuds = b24pts.filter(p => p.isAntiStud());
check('brick_2x4 has exactly 8 studs',      b24Studs.length     === 8);
check('brick_2x4 has exactly 8 anti-studs', b24AntiStuds.length === 8);

const beam5pts = mgr.getPointsForPart('technic_beam_5');
check('technic_beam_5 has 5 technic holes', beam5pts.length === 5);
check('technic_beam_5[0].isTechnic()', beam5pts[0].isTechnic());

const tile22pts = mgr.getPointsForPart('tile_2x2');
check('tile_2x2 has 4 anti-studs (no studs)', tile22pts.length === 4);
check('tile_2x2 has NO studs', tile22pts.filter(p => p.isStud()).length === 0);

// getPointById
const byId = mgr.getPointById('brick_2x4', 'brick_2x4_stud_0_0');
check('getPointById finds brick_2x4_stud_0_0', byId !== null);
check('getPointById returns null for unknown', mgr.getPointById('brick_2x4', 'nope') === null);

// worldPoints
const wpts = mgr.getWorldPoints('brick_1x1', { position: {x:0,y:0,z:0} });
check('getWorldPoints brick_1x1 returns 2 entries', wpts.length === 2);
check('getWorldPoints result has .point and .worldPos', 'point' in wpts[0] && 'worldPos' in wpts[0]);

// ── ConnectionPointDefinitions ────────────────────────────────────────────────
console.log('\n=== ConnectionPointDefinitions ===');
const partCount  = countDefinedPartTypes();
const pointCount = countBuiltinConnectionPoints();
console.log(`  → ${partCount} part types defined`);
console.log(`  → ${pointCount} total connection points`);
check('50 part types defined', partCount === 50);
check('Total points > 200', pointCount > 200);

// Spot-checks on specific parts
const slope22 = BUILTIN_CONNECTION_POINT_DEFINITIONS.slope_2x2;
check('slope_2x2 has 4 anti-studs', slope22.length === 4);
check('slope_2x2 has no studs', slope22.every(p => p.type === 'anti-stud'));

const slopeInv = BUILTIN_CONNECTION_POINT_DEFINITIONS.slope_2x2_inverted;
check('slope_2x2_inverted has 4 studs', slopeInv.length === 4);
check('slope_2x2_inverted all type=stud', slopeInv.every(p => p.type === 'stud'));

const beam13 = BUILTIN_CONNECTION_POINT_DEFINITIONS.technic_beam_13;
check('technic_beam_13 has 13 holes', beam13.length === 13);

// Coordinate check: brick_2x4 stud at (i=0,j=0) should be x=-1.5, z=-0.5
const b24def = BUILTIN_CONNECTION_POINT_DEFINITIONS.brick_2x4;
const firstStud = b24def.find(p => p.id === 'brick_2x4_stud_0_0');
check('brick_2x4_stud_0_0 exists', !!firstStud);
check('brick_2x4_stud_0_0 x=-1.5', Math.abs(firstStud.localPosition.x - (-1.5)) < 1e-9);
check('brick_2x4_stud_0_0 y=1.2',  Math.abs(firstStud.localPosition.y - 1.2)    < 1e-9);
check('brick_2x4_stud_0_0 z=-0.5', Math.abs(firstStud.localPosition.z - (-0.5)) < 1e-9);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
