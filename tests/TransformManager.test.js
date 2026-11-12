import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { TransformManager } from '../src/editor/TransformManager.js';

// Minimal-Mock für TransformControls (wird per Property-Replacement eingesetzt)
function makeMockControls() {
    const handlers = {};
    return {
        object:           null,
        _mode:            null,
        attach:           mock.fn(obj  => { mockControls.object = obj; }),
        detach:           mock.fn(()   => { mockControls.object = null; }),
        setMode:          mock.fn(mode => { mockControls._mode  = mode; }),
        addEventListener: mock.fn((ev, fn) => { handlers[ev] = fn; }),
        getHelper:        mock.fn(() => ({ isObject3D: true })),
        trigger: (event, payload) => { if (handlers[event]) handlers[event](payload); },
    };
}

let mockControls;

describe('TransformManager', () => {

    let manager, sceneManager, collisionManager, library, originalControls;

    beforeEach(() => {
        mockControls = makeMockControls();

        sceneManager = { controls: { enabled: true } };

        collisionManager = {
            checkCollision: mock.fn(() => false)  // kein Kollisionskonflikt
        };

        library = {
            getAll: mock.fn(() => [])
        };

        const scene    = { add: mock.fn() };
        const camera   = {};
        const renderer = {
            domElement: {
                addEventListener:    () => {},
                removeEventListener: () => {},
                style: { touchAction: '' },
            },
        };

        manager = new TransformManager(
            camera, renderer, scene, sceneManager,
            collisionManager, library
        );

        // Originalreferenz speichern (hat dragging-changed-Handler registriert)
        // und dann durch Mock ersetzen für isolierte Tests
        originalControls = manager.controls;
        manager.controls = mockControls;
    });

    it('attach setzt selectedObject auf die Gruppe mit brickId', () => {
        const group = { userData: { brickId: 1 }, parent: null };
        manager.attach(group);
        assert.strictEqual(manager.selectedObject, group);
        assert.strictEqual(mockControls.attach.mock.callCount(), 1);
    });

    it('attach traversiert zur übergeordneten Gruppe', () => {
        const group = { userData: { brickId: 1 }, parent: null };
        const mesh  = { userData: {},              parent: group  };
        manager.attach(mesh);
        assert.strictEqual(manager.selectedObject, group);
    });

    it('attach tut nichts wenn kein brickId in der Hierarchie', () => {
        const orphan = { userData: {}, parent: null };
        manager.attach(orphan);
        assert.strictEqual(manager.selectedObject, null);
    });

    it('attach tut nichts bei null', () => {
        manager.attach(null);
        assert.strictEqual(manager.selectedObject, null);
    });

    it('detach setzt selectedObject auf null', () => {
        manager.selectedObject = { userData: { brickId: 1 } };
        manager.detach();
        assert.strictEqual(manager.selectedObject, null);
        assert.strictEqual(mockControls.detach.mock.callCount(), 1);
    });

    it('setMode setzt den Modus', () => {
        manager.setMode('rotate');
        assert.strictEqual(mockControls.setMode.mock.callCount(), 1);
        assert.strictEqual(mockControls.setMode.mock.calls[0].arguments[0], 'rotate');
    });

    describe('rotateSelected', () => {

        it('tut nichts wenn kein selectedObject', () => {
            manager.selectedObject = null;
            assert.doesNotThrow(() => manager.rotateSelected());
        });

        it('dreht das Objekt um 90° wenn keine Kollision', () => {
            const obj = {
                rotation: { y: 0 },
                userData: { type: 'brick_2x4', brickId: 1 },
                position: { x: 0, y: 0, z: 0 },
                updateMatrixWorld: mock.fn()
            };
            manager.selectedObject = obj;
            collisionManager.checkCollision = mock.fn(() => false);
            manager.rotateSelected();
            assert.ok(Math.abs(obj.rotation.y - Math.PI / 2) < 1e-9);
        });

        it('macht die Drehung rückgängig bei Kollision', () => {
            const obj = {
                rotation: { y: 0 },
                userData: { type: 'brick_2x4', brickId: 1 },
                position: { x: 0, y: 0, z: 0 },
                updateMatrixWorld: mock.fn()
            };
            manager.selectedObject = obj;
            collisionManager.checkCollision = mock.fn(() => true);
            manager.rotateSelected();
            assert.ok(obj.rotation.y === 0);
        });

    });

    describe('snapPosition', () => {

        it('rastet x auf MOVE_STEP ein', () => {
            const pos = { x: 0.3, y: 0, z: 0 };
            manager.snapPosition(pos);
            assert.ok(pos.x === 0 || pos.x === 0.5);
        });

        it('gibt das übergebene Positions-Objekt zurück', () => {
            const pos = { x: 1.3, y: 0, z: 2.3 };
            const result = manager.snapPosition(pos);
            assert.strictEqual(result, pos);
        });

    });

    describe('Kamerasteuerung während Drag', () => {

        it('deaktiviert OrbitControls beim Ziehen', () => {
            // Der Handler wurde auf dem Original-controls registriert → dispatchEvent auslösen
            originalControls.dispatchEvent({ type: 'dragging-changed', value: true });
            assert.strictEqual(sceneManager.controls.enabled, false);
        });

        it('aktiviert OrbitControls nach dem Ziehen', () => {
            originalControls.dispatchEvent({ type: 'dragging-changed', value: true  });
            originalControls.dispatchEvent({ type: 'dragging-changed', value: false });
            assert.strictEqual(sceneManager.controls.enabled, true);
        });

    });

});
