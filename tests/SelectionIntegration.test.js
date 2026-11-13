/**
 * Integrationstests – Auswahlsystem (Phase 8.9)
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { TransformManager } from '../src/editor/TransformManager.js';


function makeControls() {
    const handlers = {};
    return {
        object: null,
        attach: mock.fn(o => {}),
        detach: mock.fn(),
        setMode: mock.fn(),
        addEventListener: mock.fn((ev, fn) => { handlers[ev] = fn; }),
        getHelper: mock.fn(() => ({})),
        get handlers() { return handlers; }
    };
}


describe('TransformManager – Auswahl-Integration', () => {

    let manager, collisionManager, library, originalControls;

    beforeEach(() => {
        collisionManager = { checkCollision: mock.fn(() => false) };
        library = { getAll: mock.fn(() => []) };
        const scene    = { add: mock.fn() };
        const camera   = {};
        const renderer = {
            domElement: {
                addEventListener: () => {}, removeEventListener: () => {},
                style: { touchAction: '' },
            },
        };
        manager = new TransformManager(camera, renderer, scene,
            { controls: { enabled: true } }, collisionManager, library);
        originalControls  = manager.controls;
        manager.controls  = makeControls();
    });

    it('attach setzt selectedObject', () => {
        const group = { userData: { brickId: 'b1' }, parent: null };
        manager.attach(group);
        assert.strictEqual(manager.selectedObject, group);
    });

    it('detach setzt selectedObject auf null', () => {
        manager.selectedObject = { userData: { brickId: 'b1' } };
        manager.detach();
        assert.strictEqual(manager.selectedObject, null);
    });

    it('detach setzt lastValidPosition auf null', () => {
        manager.lastValidPosition = { x: 1, y: 0, z: 0 };
        manager.detach();
        assert.strictEqual(manager.lastValidPosition, null);
    });

    it('detach setzt startPosition auf null', () => {
        manager.startPosition = { x: 1, y: 0, z: 0 };
        manager.detach();
        assert.strictEqual(manager.startPosition, null);
    });

    it('snapPosition rastet auf 0.5-Einheiten-Raster ein', () => {
        const pos = { x: 0.3, y: 0.7, z: 1.8 };
        manager.snapPosition(pos);
        assert.strictEqual(pos.x, 0.5);
        assert.strictEqual(pos.y, 0.5);
        assert.strictEqual(pos.z, 2.0);
    });

    it('isPositionValid gibt false zurück wenn kein type in userData', () => {
        const obj = { userData: {}, position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } };
        assert.strictEqual(manager.isPositionValid(obj), false);
    });

    it('isPositionValid gibt true zurück ohne Kollision', () => {
        collisionManager.checkCollision = mock.fn(() => false);
        const obj = {
            userData: { type: 'brick_2x4', brickId: 'b99' },
            position: { x: 0, y: 0, z: 0 },
            rotation: { y: 0 }
        };
        assert.strictEqual(manager.isPositionValid(obj), true);
    });

    it('handleObjectChange tut nichts wenn kein selectedObject', () => {
        manager.selectedObject = null;
        assert.doesNotThrow(() => manager.handleObjectChange());
    });

    it('rotateSelected dreht das Objekt um 90° ohne Kollision', () => {
        const obj = {
            rotation: { y: 0 },
            userData: { type: 'brick_2x4', brickId: 'x1' },
            position: { x: 0, y: 0, z: 0 },
            updateMatrixWorld: mock.fn()
        };
        manager.selectedObject = obj;
        manager.rotateSelected();
        assert.ok(Math.abs(obj.rotation.y - Math.PI / 2) < 1e-9);
    });

    it('rotateSelected macht Drehung rückgängig bei Kollision', () => {
        collisionManager.checkCollision = mock.fn(() => true);
        const obj = {
            rotation: { y: 0 },
            userData: { type: 'brick_2x4', brickId: 'x2' },
            position: { x: 0, y: 0, z: 0 },
            updateMatrixWorld: mock.fn()
        };
        manager.selectedObject = obj;
        manager.rotateSelected();
        assert.strictEqual(obj.rotation.y, 0);
    });
});
