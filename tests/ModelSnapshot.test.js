import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { PartLibrary }       from '../src/objects/PartLibrary.js';
import { ConnectionManager } from '../src/editor/ConnectionManager.js';
import { ModelSnapshot }     from '../src/history/ModelSnapshot.js';


// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function makeEnv() {
    const scene             = new THREE.Scene();
    const library           = new PartLibrary(scene);
    const connectionManager = new ConnectionManager();
    return { scene, library, connectionManager };
}


// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ModelSnapshot', () => {

    let library, connectionManager;

    beforeEach(() => {
        ({ library, connectionManager } = makeEnv());
    });


    // ── capture ──────────────────────────────────────────────────────────────

    describe('capture()', () => {

        it('gibt ein Objekt mit bricks- und connections-Array zurück', () => {
            const snap = ModelSnapshot.capture(library, connectionManager);
            assert.ok(Array.isArray(snap.bricks));
            assert.ok(Array.isArray(snap.connections));
        });

        it('bricks ist leer wenn die Library leer ist', () => {
            const snap = ModelSnapshot.capture(library, connectionManager);
            assert.strictEqual(snap.bricks.length, 0);
        });

        it('bricks enthält alle Steine der Library', () => {
            library.addBrick(0, 0, 0, 0xff0000, 'brick_2x4');
            library.addBrick(4, 0, 0, 0x0000ff, 'brick_2x2');
            const snap = ModelSnapshot.capture(library, connectionManager);
            assert.strictEqual(snap.bricks.length, 2);
        });

        it('connections ist leer wenn keine Verbindungen existieren', () => {
            const snap = ModelSnapshot.capture(library, connectionManager);
            assert.strictEqual(snap.connections.length, 0);
        });

        it('connections enthält alle bestehenden Verbindungen', () => {
            const b1 = library.addBrick(0, 0, 0, 0xff0000);
            const b2 = library.addBrick(4, 0, 0, 0x0000ff);
            connectionManager.createConnection(b1.id, b2.id);
            const snap = ModelSnapshot.capture(library, connectionManager);
            assert.strictEqual(snap.connections.length, 1);
        });

        it('speichert Steinposition korrekt', () => {
            library.addBrick(3, 0, 7, 0xff0000);
            const snap = ModelSnapshot.capture(library, connectionManager);
            assert.strictEqual(snap.bricks[0].position.x, 3);
            assert.strictEqual(snap.bricks[0].position.z, 7);
        });

    });


    // ── clone ─────────────────────────────────────────────────────────────────

    describe('clone()', () => {

        it('gibt ein neues Objekt zurück (keine Referenz)', () => {
            const snap  = ModelSnapshot.capture(library, connectionManager);
            const copy  = ModelSnapshot.clone(snap);
            assert.notStrictEqual(copy, snap);
        });

        it('Änderungen am Klon beeinflussen das Original nicht', () => {
            library.addBrick(0, 0, 0, 0xff0000);
            const snap = ModelSnapshot.capture(library, connectionManager);
            const copy = ModelSnapshot.clone(snap);

            copy.bricks.push({ id: 'fake' });

            assert.strictEqual(snap.bricks.length, 1);
        });

        it('Klon ist tief – Unterstrukturen sind unabhängig', () => {
            library.addBrick(0, 0, 0, 0xff0000);
            const snap = ModelSnapshot.capture(library, connectionManager);
            const copy = ModelSnapshot.clone(snap);

            copy.bricks[0].position.x = 999;

            assert.notStrictEqual(snap.bricks[0].position.x, 999);
        });

        it('leerer Snapshot wird korrekt geklont', () => {
            const snap = ModelSnapshot.capture(library, connectionManager);
            const copy = ModelSnapshot.clone(snap);
            assert.deepStrictEqual(copy.bricks, []);
            assert.deepStrictEqual(copy.connections, []);
        });

    });


    // ── restore ───────────────────────────────────────────────────────────────

    describe('restore()', () => {

        it('leert die Library vor der Wiederherstellung', () => {
            library.addBrick(0, 0, 0, 0xff0000); // Vorhandener Stein
            const emptySnap = { bricks: [], connections: [] };

            ModelSnapshot.restore(emptySnap, library, connectionManager);

            assert.strictEqual(library.getCount(), 0);
        });

        it('stellt Steine aus dem Snapshot wieder her', () => {
            const b = library.addBrick(0, 0, 0, 0xff0000, 'brick_2x4');
            const snap = ModelSnapshot.capture(library, connectionManager);

            // Library leeren und dann wiederherstellen
            library.clear();
            assert.strictEqual(library.getCount(), 0);

            ModelSnapshot.restore(snap, library, connectionManager);
            assert.strictEqual(library.getCount(), 1);
        });

        it('wiederhergestellte Steine haben korrekte IDs', () => {
            const b    = library.addBrick(0, 0, 0, 0xff0000);
            const snap = ModelSnapshot.capture(library, connectionManager);

            library.clear();
            ModelSnapshot.restore(snap, library, connectionManager);

            const restored = library.getAll()[0];
            assert.strictEqual(restored.id, b.id);
        });

        it('stellt Verbindungen aus dem Snapshot wieder her', () => {
            const b1 = library.addBrick(0, 0, 0, 0xff0000);
            const b2 = library.addBrick(4, 0, 0, 0x0000ff);
            connectionManager.createConnection(b1.id, b2.id);
            const snap = ModelSnapshot.capture(library, connectionManager);

            library.clear();
            connectionManager.clear();
            ModelSnapshot.restore(snap, library, connectionManager);

            assert.strictEqual(connectionManager.getCount(), 1);
        });

        it('leert den ConnectionManager vor der Wiederherstellung', () => {
            const emptySnap = { bricks: [], connections: [] };

            // Bestehende Verbindung hinzufügen (über getById nicht erreichbar,
            // daher direkter Array-Zugriff)
            connectionManager.connections.push({
                id: 'old-conn',
                sourceBrickId: 'x',
                targetBrickId: 'y',
                type: 'stud-to-bottom',
                position: null
            });

            ModelSnapshot.restore(emptySnap, library, connectionManager);

            assert.strictEqual(connectionManager.getCount(), 0);
        });

        it('Snapshot mehrerer Steine wird vollständig wiederhergestellt', () => {
            library.addBrick(0, 0, 0, 0xff0000, 'brick_2x4');
            library.addBrick(4, 0, 0, 0x00ff00, 'brick_2x2');
            library.addBrick(0, 0, 4, 0x0000ff, 'brick_1x2');
            const snap = ModelSnapshot.capture(library, connectionManager);

            library.clear();
            ModelSnapshot.restore(snap, library, connectionManager);

            assert.strictEqual(library.getCount(), 3);
        });

    });


    // ── Phase-6-Erweiterungen: Gruppen ────────────────────────────────────────

    describe('capture() mit groupManager (Phase 6)', () => {

        it('enthält groups-Array wenn groupManager übergeben wird', () => {
            const gm = { toData: () => [{ id: 'g1', name: 'G', brickIds: [] }] };
            const snap = ModelSnapshot.capture(library, connectionManager, gm);
            assert.ok(Array.isArray(snap.groups));
            assert.strictEqual(snap.groups.length, 1);
        });

        it('groups ist leeres Array wenn kein groupManager übergeben wird', () => {
            const snap = ModelSnapshot.capture(library, connectionManager);
            assert.deepStrictEqual(snap.groups, []);
        });

        it('groups ist leeres Array wenn groupManager null ist', () => {
            const snap = ModelSnapshot.capture(library, connectionManager, null);
            assert.deepStrictEqual(snap.groups, []);
        });

        it('groups enthält korrekten Inhalt aus groupManager.toData()', () => {
            const expected = [
                { id: 'g1', name: 'Haus',  brickIds: ['brick-1', 'brick-2'] },
                { id: 'g2', name: 'Dach',  brickIds: ['brick-3'] },
            ];
            const gm = { toData: () => expected };
            const snap = ModelSnapshot.capture(library, connectionManager, gm);
            assert.deepStrictEqual(snap.groups, expected);
        });

        it('groups-Feld ist unabhängig von bricks und connections', () => {
            library.addBrick(0, 0, 0, 0xff0000);
            const gm = { toData: () => [{ id: 'g1', name: 'G', brickIds: [] }] };
            const snap = ModelSnapshot.capture(library, connectionManager, gm);
            assert.strictEqual(snap.bricks.length, 1);
            assert.strictEqual(snap.groups.length, 1);
        });
    });


    describe('restore() mit groupManager (Phase 6)', () => {

        it('ruft groupManager.clear() vor der Wiederherstellung auf', () => {
            let cleared = false;
            const gm = {
                clear:        () => { cleared = true; },
                loadFromData: () => {},
            };
            const snap = { bricks: [], connections: [], groups: [] };
            ModelSnapshot.restore(snap, library, connectionManager, gm);
            assert.strictEqual(cleared, true);
        });

        it('ruft groupManager.loadFromData() mit den groups-Daten auf', () => {
            let receivedData = null;
            const gm = {
                clear:        () => {},
                loadFromData: (data) => { receivedData = data; },
            };
            const groups = [{ id: 'g1', name: 'G', brickIds: [] }];
            const snap = { bricks: [], connections: [], groups };
            ModelSnapshot.restore(snap, library, connectionManager, gm);
            assert.deepStrictEqual(receivedData, groups);
        });

        it('kein Crash wenn kein groupManager übergeben wird', () => {
            const snap = { bricks: [], connections: [], groups: [{ id: 'g1', name: 'G', brickIds: [] }] };
            assert.doesNotThrow(() => ModelSnapshot.restore(snap, library, connectionManager));
        });

        it('kein Crash wenn groupManager null ist', () => {
            const snap = { bricks: [], connections: [], groups: [] };
            assert.doesNotThrow(() => ModelSnapshot.restore(snap, library, connectionManager, null));
        });

        it('kein Crash wenn snap.groups fehlt', () => {
            let loadCalled = false;
            const gm = { clear: () => {}, loadFromData: () => { loadCalled = true; } };
            const snap = { bricks: [], connections: [] };  // kein groups-Feld
            assert.doesNotThrow(() => ModelSnapshot.restore(snap, library, connectionManager, gm));
            assert.strictEqual(loadCalled, false);
        });

        it('Roundtrip capture→restore stellt Gruppen wieder her', () => {
            library.addBrick(0, 0, 0, 0xff0000);
            const brick = library.getAll()[0];
            const groups = [{ id: 'g1', name: 'Haus', brickIds: [brick.id] }];

            let loadedData = null;
            const gm = {
                toData:       () => groups,
                clear:        () => {},
                loadFromData: (data) => { loadedData = data; },
            };

            const snap = ModelSnapshot.capture(library, connectionManager, gm);
            ModelSnapshot.restore(snap, library, connectionManager, gm);

            assert.deepStrictEqual(loadedData, groups);
        });
    });

});
