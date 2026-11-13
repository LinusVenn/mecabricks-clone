import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GroupManager } from '../src/editor/GroupManager.js';

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Minimales Brick-Objekt mit einer ID */
function makeBrick(id) {
    return { id };
}

/** Minimaler Library-Stub mit hasId-Check */
function makeLibrary(ids = []) {
    const set = new Set(ids);
    return {
        hasId: (id) => set.has(id),
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GroupManager', () => {

    let gm;

    beforeEach(() => {
        gm = new GroupManager();
    });


    // ── Konstruktor ──────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('startet ohne Gruppen', () => {
            assert.strictEqual(gm.getCount(), 0);
        });

        it('getAllGroups() gibt leeres Array zurück', () => {
            assert.deepStrictEqual(gm.getAllGroups(), []);
        });
    });


    // ── createGroup ──────────────────────────────────────────────────────────

    describe('createGroup()', () => {

        it('gibt ein Objekt mit id, name, brickIds zurück', () => {
            const b = makeBrick('b1');
            const g = gm.createGroup([b]);
            assert.ok(typeof g.id === 'string');
            assert.ok(typeof g.name === 'string');
            assert.ok(Array.isArray(g.brickIds));
        });

        it('ID hat das Format "group-…"', () => {
            const g = gm.createGroup([makeBrick('b1')]);
            assert.ok(g.id.startsWith('group-'), `ID: ${g.id}`);
        });

        it('zwei Gruppen erhalten unterschiedliche IDs', () => {
            const g1 = gm.createGroup([makeBrick('b1')]);
            const g2 = gm.createGroup([makeBrick('b2')]);
            assert.notStrictEqual(g1.id, g2.id);
        });

        it('verwendet Standardname "Gruppe"', () => {
            const g = gm.createGroup([makeBrick('b1')]);
            assert.strictEqual(g.name, 'Gruppe');
        });

        it('übernimmt benutzerdefinierten Namen', () => {
            const g = gm.createGroup([makeBrick('b1')], 'Mein Haus');
            assert.strictEqual(g.name, 'Mein Haus');
        });

        it('brickIds enthält alle übergebenen IDs', () => {
            const bricks = [makeBrick('b1'), makeBrick('b2'), makeBrick('b3')];
            const g = gm.createGroup(bricks);
            assert.deepStrictEqual(g.brickIds.sort(), ['b1', 'b2', 'b3'].sort());
        });

        it('getCount() steigt nach createGroup()', () => {
            gm.createGroup([makeBrick('b1')]);
            assert.strictEqual(gm.getCount(), 1);
        });

        it('brickIds ist ein echtes Array (keine Set-Referenz)', () => {
            const b = makeBrick('b1');
            const g = gm.createGroup([b]);
            assert.ok(Array.isArray(g.brickIds));
        });

        it('wirft bei leerer Brick-Liste', () => {
            assert.throws(() => gm.createGroup([]), /mindestens ein Stein/i);
        });

        it('wirft bei null', () => {
            assert.throws(() => gm.createGroup(null));
        });
    });


    // ── deleteGroup ──────────────────────────────────────────────────────────

    describe('deleteGroup()', () => {

        it('gibt true zurück bei bekannter ID', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            assert.strictEqual(gm.deleteGroup(id), true);
        });

        it('gibt false zurück bei unbekannter ID', () => {
            assert.strictEqual(gm.deleteGroup('group-unbekannt'), false);
        });

        it('entfernt die Gruppe', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            gm.deleteGroup(id);
            assert.strictEqual(gm.getGroup(id), null);
        });

        it('reduziert getCount() um 1', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            gm.deleteGroup(id);
            assert.strictEqual(gm.getCount(), 0);
        });
    });


    // ── getGroup ─────────────────────────────────────────────────────────────

    describe('getGroup()', () => {

        it('gibt Gruppe zurück wenn sie existiert', () => {
            const { id } = gm.createGroup([makeBrick('b1')], 'Test');
            const g = gm.getGroup(id);
            assert.ok(g !== null);
            assert.strictEqual(g.name, 'Test');
        });

        it('gibt null zurück für unbekannte ID', () => {
            assert.strictEqual(gm.getGroup('group-unbekannt'), null);
        });

        it('brickIds ist Array (Kopie)', () => {
            const { id } = gm.createGroup([makeBrick('b1'), makeBrick('b2')]);
            const g = gm.getGroup(id);
            assert.ok(Array.isArray(g.brickIds));
            assert.strictEqual(g.brickIds.length, 2);
        });

        it('getGroup-Ergebnis ist eine Kopie — Mutationen haben keinen Effekt', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            const g = gm.getGroup(id);
            g.brickIds.push('injiziert');
            assert.strictEqual(gm.getGroup(id).brickIds.length, 1);
        });
    });


    // ── getGroupByBrickId ─────────────────────────────────────────────────────

    describe('getGroupByBrickId()', () => {

        it('findet Gruppe anhand einer BrickId', () => {
            const { id } = gm.createGroup([makeBrick('b1'), makeBrick('b2')], 'G');
            const g = gm.getGroupByBrickId('b1');
            assert.strictEqual(g?.id, id);
        });

        it('gibt null zurück wenn keine Gruppe den Stein enthält', () => {
            gm.createGroup([makeBrick('b1')]);
            assert.strictEqual(gm.getGroupByBrickId('b99'), null);
        });

        it('gibt null zurück wenn keine Gruppen existieren', () => {
            assert.strictEqual(gm.getGroupByBrickId('b1'), null);
        });
    });


    // ── getAllGroups ──────────────────────────────────────────────────────────

    describe('getAllGroups()', () => {

        it('gibt alle Gruppen zurück', () => {
            gm.createGroup([makeBrick('b1')], 'G1');
            gm.createGroup([makeBrick('b2')], 'G2');
            const all = gm.getAllGroups();
            assert.strictEqual(all.length, 2);
        });

        it('jede Gruppe hat id, name, brickIds', () => {
            gm.createGroup([makeBrick('b1')], 'Test');
            const [g] = gm.getAllGroups();
            assert.ok(g.id);
            assert.strictEqual(g.name, 'Test');
            assert.ok(Array.isArray(g.brickIds));
        });
    });


    // ── addBrickToGroup ───────────────────────────────────────────────────────

    describe('addBrickToGroup()', () => {

        it('gibt true zurück und fügt den Stein hinzu', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            const ok = gm.addBrickToGroup(id, 'b2');
            assert.strictEqual(ok, true);
            assert.ok(gm.getGroup(id).brickIds.includes('b2'));
        });

        it('gibt false zurück für unbekannte Gruppe', () => {
            assert.strictEqual(gm.addBrickToGroup('group-x', 'b1'), false);
        });

        it('Doppeltes Hinzufügen erhöht Mitgliederzahl nicht', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            gm.addBrickToGroup(id, 'b1');
            assert.strictEqual(gm.getGroup(id).brickIds.length, 1);
        });
    });


    // ── removeBrickFromGroup ──────────────────────────────────────────────────

    describe('removeBrickFromGroup()', () => {

        it('gibt true zurück und entfernt den Stein', () => {
            const { id } = gm.createGroup([makeBrick('b1'), makeBrick('b2')]);
            const ok = gm.removeBrickFromGroup(id, 'b1');
            assert.strictEqual(ok, true);
            assert.ok(!gm.getGroup(id).brickIds.includes('b1'));
        });

        it('gibt false zurück für unbekannte Gruppe', () => {
            assert.strictEqual(gm.removeBrickFromGroup('group-x', 'b1'), false);
        });

        it('Gruppe wird automatisch gelöscht wenn leer', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            gm.removeBrickFromGroup(id, 'b1');
            assert.strictEqual(gm.getGroup(id), null);
            assert.strictEqual(gm.getCount(), 0);
        });
    });


    // ── ungroup ───────────────────────────────────────────────────────────────

    describe('ungroup()', () => {

        it('gibt die brickIds zurück', () => {
            const { id } = gm.createGroup([makeBrick('b1'), makeBrick('b2')]);
            const ids = gm.ungroup(id);
            assert.ok(Array.isArray(ids));
            assert.deepStrictEqual(ids.sort(), ['b1', 'b2'].sort());
        });

        it('entfernt die Gruppe', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            gm.ungroup(id);
            assert.strictEqual(gm.getGroup(id), null);
        });

        it('gibt null zurück für unbekannte ID', () => {
            assert.strictEqual(gm.ungroup('group-x'), null);
        });
    });


    // ── renameGroup ───────────────────────────────────────────────────────────

    describe('renameGroup()', () => {

        it('aktualisiert den Namen, gibt true zurück', () => {
            const { id } = gm.createGroup([makeBrick('b1')], 'Alt');
            const ok = gm.renameGroup(id, 'Neu');
            assert.strictEqual(ok, true);
            assert.strictEqual(gm.getGroup(id).name, 'Neu');
        });

        it('gibt false zurück für unbekannte ID', () => {
            assert.strictEqual(gm.renameGroup('group-x', 'Test'), false);
        });

        it('gibt false zurück für leeren Namen', () => {
            const { id } = gm.createGroup([makeBrick('b1')]);
            assert.strictEqual(gm.renameGroup(id, ''), false);
        });
    });


    // ── isMemberOfGroup ───────────────────────────────────────────────────────

    describe('isMemberOfGroup()', () => {

        it('gibt true zurück wenn BrickId in einer Gruppe ist', () => {
            gm.createGroup([makeBrick('b1'), makeBrick('b2')]);
            assert.strictEqual(gm.isMemberOfGroup('b1'), true);
            assert.strictEqual(gm.isMemberOfGroup('b2'), true);
        });

        it('gibt false zurück wenn BrickId in keiner Gruppe ist', () => {
            gm.createGroup([makeBrick('b1')]);
            assert.strictEqual(gm.isMemberOfGroup('b99'), false);
        });

        it('gibt false zurück wenn keine Gruppen existieren', () => {
            assert.strictEqual(gm.isMemberOfGroup('b1'), false);
        });
    });


    // ── toData / loadFromData ─────────────────────────────────────────────────

    describe('Serialisierung', () => {

        it('toData() gibt leeres Array zurück wenn keine Gruppen', () => {
            assert.deepStrictEqual(gm.toData(), []);
        });

        it('toData() enthält id, name, brickIds (Array)', () => {
            gm.createGroup([makeBrick('b1'), makeBrick('b2')], 'Haus');
            const [d] = gm.toData();
            assert.ok(typeof d.id === 'string');
            assert.strictEqual(d.name, 'Haus');
            assert.ok(Array.isArray(d.brickIds));
            assert.deepStrictEqual(d.brickIds.sort(), ['b1', 'b2'].sort());
        });

        it('toData() ist JSON-serialisierbar', () => {
            gm.createGroup([makeBrick('b1')], 'Test');
            assert.doesNotThrow(() => JSON.stringify(gm.toData()));
        });

        it('loadFromData() stellt Gruppen aus Daten wieder her', () => {
            const lib = makeLibrary(['b1', 'b2']);
            gm.loadFromData([
                { id: 'group-1', name: 'G1', brickIds: ['b1', 'b2'] },
            ], lib);
            assert.strictEqual(gm.getCount(), 1);
            const g = gm.getGroupByBrickId('b1');
            assert.strictEqual(g?.name, 'G1');
        });

        it('loadFromData() ignoriert Gruppen mit ungültigen BrickIds', () => {
            const lib = makeLibrary(['b1']);
            gm.loadFromData([
                { id: 'group-x', name: 'G', brickIds: ['unbekannt'] },
            ], lib);
            assert.strictEqual(gm.getCount(), 0);
        });

        it('loadFromData() filtert ungültige BrickIds heraus (behält gültige)', () => {
            const lib = makeLibrary(['b1']);
            gm.loadFromData([
                { id: 'group-1', name: 'G', brickIds: ['b1', 'unbekannt'] },
            ], lib);
            const g = gm.getGroupByBrickId('b1');
            assert.strictEqual(g?.brickIds.length, 1);
        });

        it('loadFromData() löscht bestehende Gruppen zuerst', () => {
            gm.createGroup([makeBrick('b1')], 'Alt');
            const lib = makeLibrary(['b2']);
            gm.loadFromData([
                { id: 'group-2', name: 'Neu', brickIds: ['b2'] },
            ], lib);
            assert.strictEqual(gm.getCount(), 1);
            assert.strictEqual(gm.getGroupByBrickId('b1'), null);
        });

        it('loadFromData() verkraftet kein Array (kein Crash)', () => {
            assert.doesNotThrow(() => gm.loadFromData(null, makeLibrary()));
            assert.strictEqual(gm.getCount(), 0);
        });

        it('loadFromData() überspringt Einträge ohne id/name/brickIds', () => {
            const lib = makeLibrary(['b1']);
            gm.loadFromData([
                { id: 'g1', brickIds: ['b1'] },   // name fehlt
                { name: 'G', brickIds: ['b1'] },   // id fehlt
                { id: 'g2', name: 'G2' },          // brickIds fehlt
            ], lib);
            assert.strictEqual(gm.getCount(), 0);
        });

        it('Roundtrip: toData → loadFromData stellt alle Gruppen wieder her', () => {
            gm.createGroup([makeBrick('b1'), makeBrick('b2')], 'Haus');
            gm.createGroup([makeBrick('b3')], 'Dach');
            const data = gm.toData();

            const gm2   = new GroupManager();
            const lib   = makeLibrary(['b1', 'b2', 'b3']);
            gm2.loadFromData(data, lib);

            assert.strictEqual(gm2.getCount(), 2);
            assert.ok(gm2.getGroupByBrickId('b1') !== null);
            assert.ok(gm2.getGroupByBrickId('b3') !== null);
        });
    });


    // ── clear / getCount ──────────────────────────────────────────────────────

    describe('clear() und getCount()', () => {

        it('clear() entfernt alle Gruppen', () => {
            gm.createGroup([makeBrick('b1')]);
            gm.createGroup([makeBrick('b2')]);
            gm.clear();
            assert.strictEqual(gm.getCount(), 0);
        });

        it('getCount() zählt exakt', () => {
            assert.strictEqual(gm.getCount(), 0);
            gm.createGroup([makeBrick('b1')]);
            assert.strictEqual(gm.getCount(), 1);
            gm.createGroup([makeBrick('b2')]);
            assert.strictEqual(gm.getCount(), 2);
        });
    });

});
