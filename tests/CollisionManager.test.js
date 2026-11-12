import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionManager } from '../src/editor/CollisionManager.js';

describe('CollisionManager', () => {

    let cm;

    beforeEach(() => { cm = new CollisionManager(); });

    // ── getBounds ──────────────────────────────────────────────────────────

    describe('getBounds', () => {

        it('gibt null zurück für unbekannten Typ', () => {
            assert.strictEqual(cm.getBounds('brick_99x99', { x:0, y:0, z:0 }, 0), null);
        });

        it('brick_2x4 ohne Rotation hat width=4, depth=2', () => {
            const b = cm.getBounds('brick_2x4', { x:0, y:0, z:0 }, 0);
            assert.ok(b !== null);
            assert.ok(Math.abs((b.maxX - b.minX) - 4) < 1e-9, `width sollte 4 sein`);
            assert.ok(Math.abs((b.maxZ - b.minZ) - 2) < 1e-9, `depth sollte 2 sein`);
        });

        it('brick_2x4 mit 90°-Rotation tauscht width und depth', () => {
            const b = cm.getBounds('brick_2x4', { x:0, y:0, z:0 }, Math.PI / 2);
            assert.ok(Math.abs((b.maxX - b.minX) - 2) < 1e-9, `width nach Rotation sollte 2 sein`);
            assert.ok(Math.abs((b.maxZ - b.minZ) - 4) < 1e-9, `depth nach Rotation sollte 4 sein`);
        });

        it('y-Achse hat immer Höhe 1.2', () => {
            const b = cm.getBounds('brick_2x4', { x:0, y:0, z:0 }, 0);
            assert.ok(Math.abs((b.maxY - b.minY) - 1.2) < 1e-9);
        });

        it('Position wird korrekt auf Bounds übertragen', () => {
            const b = cm.getBounds('brick_2x2', { x:4, y:0, z:6 }, 0);
            assert.ok(Math.abs((b.minX + b.maxX) / 2 - 4) < 1e-9, 'Mittelpunkt x');
            assert.ok(Math.abs((b.minZ + b.maxZ) / 2 - 6) < 1e-9, 'Mittelpunkt z');
        });

    });

    // ── hasVolumeOverlap ───────────────────────────────────────────────────

    describe('hasVolumeOverlap', () => {

        const box = (cx, cy, cz, w, h, d) => ({
            minX: cx - w/2, maxX: cx + w/2,
            minY: cy,       maxY: cy + h,
            minZ: cz - d/2, maxZ: cz + d/2,
        });

        it('identische Boxen überlappen', () => {
            const b = box(0, 0, 0, 2, 1.2, 2);
            assert.ok(cm.hasVolumeOverlap(b, b));
        });

        it('klar getrennte Boxen überlappen nicht', () => {
            const a = box(0, 0, 0, 2, 1.2, 2);
            const b = box(10, 0, 0, 2, 1.2, 2);
            assert.ok(!cm.hasVolumeOverlap(a, b));
        });

        it('Boxen die sich berühren überlappen dank Epsilon nicht', () => {
            const a = box(0, 0, 0, 2, 1.2, 2);
            const b = box(2, 0, 0, 2, 1.2, 2); // berühren sich genau
            assert.ok(!cm.hasVolumeOverlap(a, b));
        });

        it('Boxen die sich minimal überschneiden überlappen', () => {
            const a = box(0,    0, 0, 2, 1.2, 2);
            const b = box(1.99, 0, 0, 2, 1.2, 2);
            assert.ok(cm.hasVolumeOverlap(a, b));
        });

        it('vertikal gestapelte Boxen überlappen nicht', () => {
            const a = box(0, 0,   0, 2, 1.2, 2);
            const b = box(0, 1.2, 0, 2, 1.2, 2);
            assert.ok(!cm.hasVolumeOverlap(a, b));
        });

    });

    // ── checkCollision ─────────────────────────────────────────────────────

    describe('checkCollision', () => {

        it('gibt false zurück bei leerer Brick-Liste', () => {
            assert.ok(!cm.checkCollision('brick_2x4', { x:0, y:0, z:0 }, 0, []));
        });

        it('gibt true zurück bei unbekanntem Typ', () => {
            assert.ok(cm.checkCollision('brick_99x99', { x:0, y:0, z:0 }, 0, []));
        });

        it('erkennt Kollision mit einem platzierten Baustein', () => {
            const existingBrick = {
                group: {
                    position:   { x:0, y:0, z:0 },
                    rotation:   { y: 0 },
                    updateMatrixWorld: () => {}
                },
                type:   'brick_2x4',
                width:  2, depth: 4, height: 1.2
            };
            assert.ok(cm.checkCollision('brick_2x4', { x:0, y:0, z:0 }, 0, [existingBrick]));
        });

        it('gibt false zurück wenn Kandidat weit entfernt ist', () => {
            const existingBrick = {
                group: {
                    position:   { x:0, y:0, z:0 },
                    rotation:   { y: 0 },
                    updateMatrixWorld: () => {}
                },
                type:   'brick_2x4',
                width:  2, depth: 4, height: 1.2
            };
            assert.ok(!cm.checkCollision('brick_2x4', { x:20, y:0, z:20 }, 0, [existingBrick]));
        });

    });

});
