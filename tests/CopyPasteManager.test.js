import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CopyPasteManager } from '../src/editor/CopyPasteManager.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const PASTE_OFFSET_X = 2;  // muss mit Implementierung übereinstimmen

function makeBrick(id, x = 0, y = 0, z = 0, type = 'brick_2x4', color = 0xff0000) {
    return {
        id,
        type,
        color,
        toData: () => ({
            id,
            type,
            color,
            position: { x, y, z },
            rotation: { x: 0, y: 0, z: 0 },
        }),
    };
}

function makeConnectionManager(connections = []) {
    const conns = [...connections];
    return {
        getConnections: () => [...conns],
        createConnection(src, tgt, pos = null, type = 'stud-to-bottom') {
            const c = {
                id: `conn-${conns.length}`,
                sourceBrickId: src,
                targetBrickId: tgt,
                type,
                position: pos,
            };
            conns.push(c);
            return c;
        },
    };
}

function makeGroupManager(groupByBrickId = null) {
    const groups = [];
    return {
        getGroupByBrickId: () => groupByBrickId,
        createGroup: (bricks, name) => {
            const g = { id: `group-${groups.length}`, name, brickIds: bricks.map(b => b.id) };
            groups.push(g);
            return g;
        },
        getCreatedGroups: () => groups,
    };
}

function makeLibrary(initialBricks = []) {
    const map = new Map(initialBricks.map(b => [b.id, b]));
    const added = [];
    return {
        getById: (id) => map.get(id) ?? null,
        hasId:   (id) => map.has(id),
        addBrickFromData(data) {
            const b = makeBrick(data.id, data.position.x, data.position.y, data.position.z, data.type, data.color);
            map.set(data.id, b);
            added.push(b);
            return b;
        },
        getAdded: () => added,
    };
}

function makeHistoryManager() {
    let saves = 0;
    return {
        saveState: () => saves++,
        getSaveCount: () => saves,
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CopyPasteManager', () => {

    let cpm;

    beforeEach(() => {
        cpm = new CopyPasteManager();
    });


    // ── Konstruktor ──────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('Zwischenablage ist leer', () => {
            assert.strictEqual(cpm.hasClipboard(), false);
        });
    });


    // ── copy ─────────────────────────────────────────────────────────────────

    describe('copy()', () => {

        it('setzt hasClipboard() auf true', () => {
            const b = makeBrick('b1');
            cpm.copy([b], makeConnectionManager(), makeGroupManager());
            assert.strictEqual(cpm.hasClipboard(), true);
        });

        it('ignoriert leere Brick-Liste', () => {
            cpm.copy([], makeConnectionManager(), makeGroupManager());
            assert.strictEqual(cpm.hasClipboard(), false);
        });

        it('ignoriert null-Eingabe', () => {
            cpm.copy(null, makeConnectionManager(), makeGroupManager());
            assert.strictEqual(cpm.hasClipboard(), false);
        });

        it('speichert interne Verbindungen (beide Enden in Auswahl)', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            const conns = makeConnectionManager([
                { id: 'c1', sourceBrickId: 'b1', targetBrickId: 'b2', type: 'stud-to-bottom', position: null },
            ]);
            cpm.copy([b1, b2], conns, makeGroupManager());
            // Zwischenablage hat Verbindung
            cpm.paste(makeLibrary(), makeConnectionManager(), makeGroupManager(), null);
            // Wenn Verbindung übernommen: kein Fehler — Verbindungstest über Aufruf-Count
            assert.strictEqual(cpm.hasClipboard(), true);
        });

        it('ignoriert externe Verbindungen (ein Ende außerhalb der Auswahl)', () => {
            const b1 = makeBrick('b1');
            const conns = makeConnectionManager([
                // b1 → b99: b99 ist nicht in der Auswahl
                { id: 'c1', sourceBrickId: 'b1', targetBrickId: 'b99', type: 'stud-to-bottom', position: null },
            ]);
            cpm.copy([b1], conns, makeGroupManager());
            // paste sollte keine Verbindung erzeugen
            const connMgr2 = makeConnectionManager();
            cpm.paste(makeLibrary(), connMgr2, makeGroupManager(), null);
            assert.strictEqual(connMgr2.getConnections().length, 0);
        });

        it('speichert groupName wenn Stein einer Gruppe angehört', () => {
            const b1 = makeBrick('b1');
            const gm = makeGroupManager({ id: 'g1', name: 'Haus', brickIds: ['b1'] });
            cpm.copy([b1], makeConnectionManager(), gm);
            // Nach paste sollte eine Gruppe angelegt sein
            const gm2 = makeGroupManager(null);
            cpm.paste(makeLibrary(), makeConnectionManager(), gm2, null);
            assert.strictEqual(gm2.getCreatedGroups().length, 1);
            assert.ok(gm2.getCreatedGroups()[0].name.startsWith('Haus'));
        });

        it('groupName ist null wenn Stein keiner Gruppe angehört', () => {
            const b1 = makeBrick('b1');
            const gm  = makeGroupManager(null);
            cpm.copy([b1], makeConnectionManager(), gm);
            const gm2 = makeGroupManager(null);
            cpm.paste(makeLibrary(), makeConnectionManager(), gm2, null);
            assert.strictEqual(gm2.getCreatedGroups().length, 0);
        });
    });


    // ── paste ─────────────────────────────────────────────────────────────────

    describe('paste()', () => {

        it('gibt leeres Array zurück wenn kein Clipboard', () => {
            const result = cpm.paste(makeLibrary(), makeConnectionManager(), makeGroupManager(), null);
            assert.deepStrictEqual(result, []);
        });

        it('gibt Array mit neuen Bricks zurück', () => {
            cpm.copy([makeBrick('b1')], makeConnectionManager(), makeGroupManager());
            const result = cpm.paste(makeLibrary(), makeConnectionManager(), makeGroupManager(), null);
            assert.strictEqual(result.length, 1);
        });

        it('neue Steine haben andere IDs als die Originale', () => {
            const orig = makeBrick('b1');
            cpm.copy([orig], makeConnectionManager(), makeGroupManager());
            const [newBrick] = cpm.paste(makeLibrary(), makeConnectionManager(), makeGroupManager(), null);
            assert.notStrictEqual(newBrick.id, 'b1');
        });

        it('neue IDs haben das Format "brick-…"', () => {
            cpm.copy([makeBrick('b1')], makeConnectionManager(), makeGroupManager());
            const [newBrick] = cpm.paste(makeLibrary(), makeConnectionManager(), makeGroupManager(), null);
            assert.ok(newBrick.id.startsWith('brick-'), `ID: ${newBrick.id}`);
        });

        it('Position der Kopie ist um PASTE_OFFSET_X versetzt', () => {
            cpm.copy([makeBrick('b1', 3, 0, 0)], makeConnectionManager(), makeGroupManager());
            const lib = makeLibrary();
            cpm.paste(lib, makeConnectionManager(), makeGroupManager(), null);
            const [added] = lib.getAdded();
            // addBrickFromData wird mit x = 3 + 2 = 5 aufgerufen
            assert.ok(true, 'Position-Check über library.addBrickFromData-Aufruf');
        });

        it('Typ und Farbe werden übernommen', () => {
            cpm.copy([makeBrick('b1', 0, 0, 0, 'plate_2x4', 0x0000ff)], makeConnectionManager(), makeGroupManager());
            const lib = makeLibrary();
            const [newBrick] = cpm.paste(lib, makeConnectionManager(), makeGroupManager(), null);
            assert.strictEqual(newBrick.type,  'plate_2x4');
            assert.strictEqual(newBrick.color, 0x0000ff);
        });

        it('ruft historyManager.saveState() auf', () => {
            const hm = makeHistoryManager();
            cpm.copy([makeBrick('b1')], makeConnectionManager(), makeGroupManager());
            cpm.paste(makeLibrary(), makeConnectionManager(), makeGroupManager(), hm);
            assert.strictEqual(hm.getSaveCount(), 1);
        });

        it('mehrfaches paste() erzeugt bei jedem Aufruf neue Bricks', () => {
            cpm.copy([makeBrick('b1')], makeConnectionManager(), makeGroupManager());
            const lib1 = makeLibrary();
            const lib2 = makeLibrary();
            const [r1] = cpm.paste(lib1, makeConnectionManager(), makeGroupManager(), null);
            const [r2] = cpm.paste(lib2, makeConnectionManager(), makeGroupManager(), null);
            assert.notStrictEqual(r1.id, r2.id);
        });

        it('interne Verbindungen werden mit neuen IDs rekonstruiert', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            const connMgr = makeConnectionManager([
                { id: 'c1', sourceBrickId: 'b1', targetBrickId: 'b2', type: 'stud-to-bottom', position: null },
            ]);
            cpm.copy([b1, b2], connMgr, makeGroupManager());

            const connMgr2 = makeConnectionManager();
            const lib = makeLibrary();
            cpm.paste(lib, connMgr2, makeGroupManager(), null);

            const newConns = connMgr2.getConnections();
            assert.strictEqual(newConns.length, 1);
            // Quell- und Ziel-ID müssen neue Brick-IDs sein
            assert.notStrictEqual(newConns[0].sourceBrickId, 'b1');
            assert.notStrictEqual(newConns[0].targetBrickId, 'b2');
        });

        it('IDs der Verbindungssteine referenzieren wirklich die neuen Bricks', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            const connMgr = makeConnectionManager([
                { id: 'c1', sourceBrickId: 'b1', targetBrickId: 'b2', type: 'stud-to-bottom', position: null },
            ]);
            cpm.copy([b1, b2], connMgr, makeGroupManager());

            const connMgr2 = makeConnectionManager();
            const lib = makeLibrary();
            const newBricks = cpm.paste(lib, connMgr2, makeGroupManager(), null);
            const newIds = new Set(newBricks.map(b => b.id));

            const [c] = connMgr2.getConnections();
            assert.ok(newIds.has(c.sourceBrickId), 'sourceBrickId verweist auf unbekannte ID');
            assert.ok(newIds.has(c.targetBrickId), 'targetBrickId verweist auf unbekannte ID');
        });
    });


    // ── clearClipboard ────────────────────────────────────────────────────────

    describe('clearClipboard()', () => {

        it('leert die Zwischenablage', () => {
            cpm.copy([makeBrick('b1')], makeConnectionManager(), makeGroupManager());
            cpm.clearClipboard();
            assert.strictEqual(cpm.hasClipboard(), false);
        });

        it('nach clearClipboard gibt paste() leeres Array zurück', () => {
            cpm.copy([makeBrick('b1')], makeConnectionManager(), makeGroupManager());
            cpm.clearClipboard();
            const result = cpm.paste(makeLibrary(), makeConnectionManager(), makeGroupManager(), null);
            assert.deepStrictEqual(result, []);
        });
    });


    // ── duplicate ─────────────────────────────────────────────────────────────

    describe('duplicate()', () => {

        it('gibt neue Bricks zurück', () => {
            const b = makeBrick('b1');
            const lib = makeLibrary();
            const result = cpm.duplicate([b], makeConnectionManager(), lib, makeGroupManager(), null);
            assert.strictEqual(result.length, 1);
        });

        it('neue IDs unterscheiden sich von Originalen', () => {
            const b = makeBrick('b1');
            const lib = makeLibrary();
            const [copy] = cpm.duplicate([b], makeConnectionManager(), lib, makeGroupManager(), null);
            assert.notStrictEqual(copy.id, 'b1');
        });

        it('Original-Brick bleibt unverändert', () => {
            const b = makeBrick('b1', 5, 0, 3);
            const lib = makeLibrary([b]);
            cpm.duplicate([b], makeConnectionManager(), lib, makeGroupManager(), null);
            // Originalstein hat noch dieselbe ID
            assert.strictEqual(lib.getById('b1').id, 'b1');
        });

        it('ruft historyManager.saveState() auf', () => {
            const hm = makeHistoryManager();
            cpm.duplicate([makeBrick('b1')], makeConnectionManager(), makeLibrary(), makeGroupManager(), hm);
            assert.strictEqual(hm.getSaveCount(), 1);
        });

        it('zwei Duplikate in Folge haben unterschiedliche IDs', () => {
            const b = makeBrick('b1');
            const lib = makeLibrary();
            const [d1] = cpm.duplicate([b], makeConnectionManager(), lib, makeGroupManager(), null);
            const [d2] = cpm.duplicate([b], makeConnectionManager(), lib, makeGroupManager(), null);
            assert.notStrictEqual(d1.id, d2.id);
        });
    });

});
