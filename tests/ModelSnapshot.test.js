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

});
