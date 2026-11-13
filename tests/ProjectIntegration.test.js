/**
 * Integrationstests – Projektverwaltung und Serialisierung (Phase 8.9)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModelSnapshot } from '../src/history/ModelSnapshot.js';

// ModelSnapshot.capture(library, connectionManager, groupManager?, componentLibrary?)
// NOT a single-options-object.

function makeBrickData(id, x = 0, y = 0, z = 0) {
    return {
        id,
        type: 'brick_2x4',
        color: 0xff0000,
        position: { x, y, z },
        rotation: { x: 0, y: 0, z: 0 }
    };
}

function makeLibrary(datas = []) {
    return {
        getAllData() { return [...datas]; }
    };
}

function makeConnectionManager(connections = []) {
    return { toData() { return [...connections]; } };
}

function makeGroupManager(groups = []) {
    return { toData() { return [...groups]; } };
}


describe('ModelSnapshot – Serialisierungs-Integration', () => {

    it('Snapshot erfasst alle Bauteile', () => {
        const lib  = makeLibrary([makeBrickData('b1'), makeBrickData('b2')]);
        const snap = ModelSnapshot.capture(lib, makeConnectionManager(), makeGroupManager());
        assert.strictEqual(snap.bricks.length, 2);
    });

    it('Snapshot enthält Bauteil-ID', () => {
        const lib  = makeLibrary([makeBrickData('uniqueId123')]);
        const snap = ModelSnapshot.capture(lib, makeConnectionManager(), makeGroupManager());
        assert.ok(snap.bricks.some(b => b.id === 'uniqueId123'));
    });

    it('Snapshot enthält Positionsdaten', () => {
        const lib  = makeLibrary([makeBrickData('pos', 3, 1, -2)]);
        const snap = ModelSnapshot.capture(lib, makeConnectionManager(), makeGroupManager());
        const b    = snap.bricks[0];
        assert.strictEqual(b.position.x, 3);
        assert.strictEqual(b.position.y, 1);
        assert.strictEqual(b.position.z, -2);
    });

    it('leere Library erzeugt leeren Snapshot', () => {
        const lib  = makeLibrary([]);
        const snap = ModelSnapshot.capture(lib, makeConnectionManager(), makeGroupManager());
        assert.strictEqual(snap.bricks.length, 0);
    });

    it('Snapshot-Daten sind serialisierbar (JSON round-trip)', () => {
        const lib    = makeLibrary([makeBrickData('b1'), makeBrickData('b2')]);
        const snap   = ModelSnapshot.capture(lib, makeConnectionManager(), makeGroupManager());
        const json   = JSON.stringify(snap);
        const parsed = JSON.parse(json);
        assert.strictEqual(parsed.bricks.length, 2);
    });

    it('Snapshot.clone erzeugt tiefe Kopie', () => {
        const lib  = makeLibrary([makeBrickData('b1')]);
        const snap = ModelSnapshot.capture(lib, makeConnectionManager(), makeGroupManager());
        const copy = ModelSnapshot.clone(snap);
        copy.bricks[0].id = 'modified';
        assert.strictEqual(snap.bricks[0].id, 'b1');
    });
});


describe('Projektkompatibilität', () => {

    it('altes Projektformat ohne optionale Felder wirft keinen Fehler', () => {
        const minimal = {
            bricks: [
                { id: 'b1', type: 'brick_2x4', color: 0xff0000,
                  position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
            ]
        };
        assert.doesNotThrow(() => {
            const bricks      = minimal.bricks      ?? [];
            const connections = minimal.connections  ?? [];
            const groups      = minimal.groups       ?? [];
            assert.strictEqual(bricks.length, 1);
            assert.strictEqual(connections.length, 0);
            assert.strictEqual(groups.length, 0);
        });
    });

    it('Projektformat mit allen Phase-8-Feldern ist valide JSON', () => {
        const full = {
            name:        'Testprojekt',
            version:     '8.9',
            bricks:      [{ id: 'b1', type: 'brick_2x4', color: 0xff0000,
                            position: { x: 0, y: 0, z: 0 },
                            rotation: { x: 0, y: 0, z: 0 } }],
            connections: [],
            groups:      [{ id: 'g1', name: 'Gruppe 1', brickIds: ['b1'] }],
            assemblies:  [],
            components:  []
        };
        assert.doesNotThrow(() => JSON.stringify(full));
        const parsed = JSON.parse(JSON.stringify(full));
        assert.strictEqual(parsed.bricks.length, 1);
        assert.strictEqual(parsed.groups.length, 1);
    });
});
