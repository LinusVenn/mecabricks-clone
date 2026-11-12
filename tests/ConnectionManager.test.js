import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionManager } from '../src/editor/ConnectionManager.js';

describe('ConnectionManager', () => {

    let cm;

    beforeEach(() => { cm = new ConnectionManager(); });

    // ── createConnection ───────────────────────────────────────────────────

    describe('createConnection', () => {

        it('erstellt eine Verbindung zwischen zwei verschiedenen Steinen', () => {
            const c = cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            assert.ok(c !== null);
            assert.strictEqual(c.sourceBrickId, 'a');
            assert.strictEqual(c.targetBrickId, 'b');
        });

        it('wirft einen Fehler wenn source === target', () => {
            assert.throws(
                () => cm.createConnection('a', 'a', { x:0, y:0, z:0 }),
                { message: /sich selbst/ }
            );
        });

        it('gibt die vorhandene Verbindung zurück wenn Verbindung bereits existiert', () => {
            const first  = cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            const second = cm.createConnection('a', 'b', { x:0, y:1, z:0 });
            // Gleiche source+target+type → vorhandene Verbindung zurückgeben
            assert.strictEqual(first, second);
            assert.strictEqual(cm.connections.length, 1);
        });

        it('erlaubt eine Verbindung in umgekehrter Richtung (b→a nach a→b)', () => {
            // createConnection prüft nur exakte source+target, nicht symmetrisch
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            const reverse = cm.createConnection('b', 'a', { x:0, y:1, z:0 });
            assert.ok(reverse !== null);
            assert.strictEqual(reverse.sourceBrickId, 'b');
            assert.strictEqual(reverse.targetBrickId, 'a');
            assert.strictEqual(cm.connections.length, 2);
        });

        it('hat eine eindeutige UUID-ähnliche ID', () => {
            const c = cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            assert.ok(typeof c.id === 'string' && c.id.length > 0);
        });

        it('speichert die Position der Verbindung', () => {
            const c = cm.createConnection('a', 'b', { x:1, y:2, z:3 });
            assert.strictEqual(c.position.x, 1);
            assert.strictEqual(c.position.y, 2);
            assert.strictEqual(c.position.z, 3);
        });

        it('hat den Typ stud-to-bottom', () => {
            const c = cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            assert.strictEqual(c.type, 'stud-to-bottom');
        });

    });

    // ── getConnections ─────────────────────────────────────────────────────

    // getConnections() nimmt KEINEN Filter-Parameter – es gibt ALLE Verbindungen zurück.
    // Für gezielte Abfragen existiert areConnected().
    describe('getConnections', () => {

        it('gibt leeres Array zurück wenn keine Verbindungen vorhanden sind', () => {
            assert.deepStrictEqual(cm.getConnections(), []);
        });

        it('gibt alle Verbindungen zurück', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            assert.strictEqual(cm.getConnections().length, 1);
        });

        it('gibt mehrere Verbindungen zurück', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            cm.createConnection('b', 'c', { x:0, y:0, z:0 });
            assert.strictEqual(cm.getConnections().length, 2);
        });

        it('gibt eine Kopie zurück (kein direkter Verweis auf intern)', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            const copy = cm.getConnections();
            copy.push({ fake: true });
            assert.strictEqual(cm.getConnections().length, 1);
        });

    });

    // ── areConnected ───────────────────────────────────────────────────────

    describe('areConnected', () => {

        it('gibt false zurück wenn keine Verbindung existiert', () => {
            assert.ok(!cm.areConnected('a', 'b'));
        });

        it('gibt true zurück wenn eine direkte Verbindung existiert', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            assert.ok(cm.areConnected('a', 'b'));
        });

        it('ist symmetrisch (b→a gilt auch wenn a→b gespeichert)', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            assert.ok(cm.areConnected('b', 'a'));
        });

    });

    // ── removeConnections ──────────────────────────────────────────────────

    describe('removeConnections', () => {

        it('entfernt alle Verbindungen eines Steins', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            cm.createConnection('a', 'c', { x:0, y:0, z:0 });
            cm.removeConnections('a');
            assert.strictEqual(cm.connections.length, 0);
        });

        it('lässt Verbindungen anderer Steine unberührt', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            cm.createConnection('c', 'd', { x:0, y:0, z:0 });
            cm.removeConnections('a');
            assert.strictEqual(cm.connections.length, 1);
            assert.strictEqual(cm.connections[0].sourceBrickId, 'c');
        });

        it('entfernt auch Verbindungen wo der Stein target ist', () => {
            cm.createConnection('a', 'b', { x:0, y:0, z:0 });
            cm.removeConnections('b');
            assert.strictEqual(cm.connections.length, 0);
        });

    });

});
