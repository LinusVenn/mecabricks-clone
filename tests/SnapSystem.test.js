import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SnapSystem } from '../src/editor/SnapSystem.js';
import { STUD_PITCH, ROTATION_STEP } from '../src/utils/Constants.js';

describe('SnapSystem', () => {

    let snap;

    beforeEach(() => { snap = new SnapSystem(); });

    // ── snapToGrid ─────────────────────────────────────────────────────────

    describe('snapToGrid', () => {

        it('0 → 0', () => assert.strictEqual(snap.snapToGrid(0), 0));
        it('exakter Wert bleibt unverändert', () => assert.strictEqual(snap.snapToGrid(2), 2));
        it('rundet auf nächsten STUD_PITCH auf', () => {
            const result = snap.snapToGrid(0.6);
            assert.ok(result === 0 || result === 1);
        });
        it('negative Werte werden korrekt gerundet', () => {
            const result = snap.snapToGrid(-1.4);
            assert.ok(result === -1 || result === -2);
        });

    });

    // ── snapPosition ──────────────────────────────────────────────────────

    describe('snapPosition', () => {

        it('gibt ein neues Objekt zurück', () => {
            const pos = { x:1.3, y:0.5, z:2.7 };
            const result = snap.snapPosition(pos);
            assert.ok(result !== pos, 'snapPosition sollte ein neues Objekt liefern');
        });

        it('y-Koordinate bleibt unverändert', () => {
            const result = snap.snapPosition({ x:0, y:3.14, z:0 });
            assert.strictEqual(result.y, 3.14);
        });

        it('x und z werden auf das Raster eingerastet', () => {
            const result = snap.snapPosition({ x:0.4, y:0, z:0.6 });
            assert.ok(result.x === 0 || result.x === 1);
            assert.ok(result.z === 0 || result.z === 1);
        });

    });

    // ── getSnappedRotation ────────────────────────────────────────────────

    describe('getSnappedRotation', () => {

        it('0 bleibt 0', () => {
            assert.ok(Math.abs(snap.getSnappedRotation(0)) < 1e-9);
        });

        it('Math.PI/2 bleibt Math.PI/2', () => {
            assert.ok(Math.abs(snap.getSnappedRotation(Math.PI / 2) - Math.PI / 2) < 1e-9);
        });

        it('kleiner Winkel wird auf 0 gerundet', () => {
            assert.ok(Math.abs(snap.getSnappedRotation(0.1)) < 1e-9);
        });

        it('Winkel nahe 90° wird auf 90° gerundet', () => {
            const result = snap.getSnappedRotation(Math.PI / 2 + 0.1);
            assert.ok(Math.abs(result - Math.PI / 2) < 1e-9);
        });

    });

    // ── getStudOffsets ────────────────────────────────────────────────────

    describe('getStudOffsets', () => {

        it('1×1 liefert genau 1 Stud', () => {
            const studs = snap.getStudOffsets(1, 1);
            assert.strictEqual(studs.length, 1);
            assert.strictEqual(studs[0].x, 0);
            assert.strictEqual(studs[0].z, 0);
        });

        it('2×4 liefert 8 Studs', () => {
            assert.strictEqual(snap.getStudOffsets(2, 4).length, 8);
        });

        it('2×2 liefert 4 Studs', () => {
            assert.strictEqual(snap.getStudOffsets(2, 2).length, 4);
        });

        it('Studs sind symmetrisch um den Ursprung verteilt', () => {
            const studs = snap.getStudOffsets(2, 2);
            const xs = studs.map(s => s.x);
            const zs = studs.map(s => s.z);
            const sumX = xs.reduce((a, b) => a + b, 0);
            const sumZ = zs.reduce((a, b) => a + b, 0);
            assert.ok(Math.abs(sumX) < 1e-9, `Summe x sollte 0 sein, ist ${sumX}`);
            assert.ok(Math.abs(sumZ) < 1e-9, `Summe z sollte 0 sein, ist ${sumZ}`);
        });

        it('liefert width × depth Studs', () => {
            assert.strictEqual(snap.getStudOffsets(3, 5).length, 15);
        });

    });

    // ── findSnapPosition ──────────────────────────────────────────────────

    describe('findSnapPosition', () => {

        it('gibt null zurück für unbekannten Typ', () => {
            assert.strictEqual(
                snap.findSnapPosition('brick_99x99', { x:0, y:0, z:0 }, 0, []),
                null
            );
        });

        it('gibt null zurück wenn keine Steine in der Nähe', () => {
            assert.strictEqual(
                snap.findSnapPosition('brick_2x4', { x:0, y:0, z:0 }, 0, []),
                null
            );
        });

    });

});
