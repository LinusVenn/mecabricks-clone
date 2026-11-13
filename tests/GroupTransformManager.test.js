import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GroupTransformManager } from '../src/editor/GroupTransformManager.js';

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

/** Erstellt eine minimale Brick-Instanz mit gruppe, id und type. */
function makeBrick(id, x = 0, y = 0, z = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    return {
        id,
        type: 'brick_2x4',
        group,
    };
}

/** Erstellt den minimalen Satz an Abhängigkeiten. */
function makeDeps(extraBricks = []) {
    const domElement = {
        addEventListener:    () => {},
        removeEventListener: () => {},
        style:               { touchAction: '' },
        ownerDocument:       { addEventListener: () => {}, removeEventListener: () => {} },
    };
    const camera   = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const renderer = { domElement };
    const scene    = new THREE.Scene();
    const sceneManager     = { controls: { enabled: true } };
    const collisionManager = { checkCollision: mock.fn(() => false) };
    const library = {
        _bricks: [...extraBricks],
        getAll:  mock.fn(function () { return this._bricks; }),
    };

    return { camera, renderer, scene, sceneManager, collisionManager, library };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GroupTransformManager', () => {

    let deps, manager;

    beforeEach(() => {
        deps    = makeDeps();
        manager = new GroupTransformManager(
            deps.camera, deps.renderer, deps.scene,
            deps.sceneManager, deps.collisionManager, deps.library,
        );
    });

    // ── attach / detach ─────────────────────────────────────────────────────

    describe('attach', () => {

        it('setzt _selectedBricks und _active', () => {
            const b1 = makeBrick('b1', 0, 0, 0);
            const b2 = makeBrick('b2', 2, 0, 0);
            manager.attach([b1, b2]);
            assert.strictEqual(manager._selectedBricks.length, 2);
            assert.strictEqual(manager._active, true);
        });

        it('ruft detach wenn leeres Array übergeben wird', () => {
            manager.attach([]);
            assert.strictEqual(manager._active, false);
        });

        it('ruft detach wenn null übergeben wird', () => {
            manager.attach(null);
            assert.strictEqual(manager._active, false);
        });

        it('positioniert den Pivot am Mittelpunkt', () => {
            const b1 = makeBrick('b1', 0, 0, 0);
            const b2 = makeBrick('b2', 4, 0, 0);
            manager.attach([b1, b2]);
            assert.ok(Math.abs(manager._pivot.position.x - 2) < 1e-6);
        });

    });

    describe('detach', () => {

        it('leert _selectedBricks und setzt _active auf false', () => {
            const b1 = makeBrick('b1');
            manager.attach([b1]);
            manager.detach();
            assert.strictEqual(manager._selectedBricks.length, 0);
            assert.strictEqual(manager._active, false);
        });

        it('löscht _originalPositions und _originalRotations', () => {
            const b1 = makeBrick('b1');
            manager.attach([b1]);
            // Simuliere, dass etwas gespeichert wurde
            manager._originalPositions.set('b1', new THREE.Vector3());
            manager._originalRotations.set('b1', 0);
            manager.detach();
            assert.strictEqual(manager._originalPositions.size, 0);
            assert.strictEqual(manager._originalRotations.size, 0);
        });

    });

    // ── setMode ─────────────────────────────────────────────────────────────

    it('setMode delegiert an TransformControls', () => {
        // Nur sicherstellen, dass kein Fehler geworfen wird
        assert.doesNotThrow(() => manager.setMode('rotate'));
        assert.doesNotThrow(() => manager.setMode('translate'));
    });

    // ── rotateSelection ─────────────────────────────────────────────────────

    describe('rotateSelection', () => {

        it('gibt false zurück wenn keine Steine ausgewählt', () => {
            const result = manager.rotateSelection();
            assert.strictEqual(result, false);
        });

        it('dreht und gibt true zurück wenn keine Kollision', () => {
            const b1 = makeBrick('b1', 0, 0, 0);
            const b2 = makeBrick('b2', 1, 0, 0);
            deps.library._bricks = [b1, b2];
            deps.collisionManager.checkCollision = mock.fn(() => false);
            manager.attach([b1, b2]);
            const result = manager.rotateSelection();
            assert.strictEqual(result, true);
        });

        it('stellt Zustände wieder her und gibt false zurück bei Kollision', () => {
            const b1 = makeBrick('b1', 0, 0, 0);
            deps.library._bricks = [b1];
            deps.collisionManager.checkCollision = mock.fn(() => true);
            manager.attach([b1]);
            const origX = b1.group.position.x;
            const origRotY = b1.group.rotation.y;
            const result = manager.rotateSelection();
            assert.strictEqual(result, false);
            // Position muss wiederhergestellt sein
            assert.ok(Math.abs(b1.group.position.x - origX) < 1e-6);
            assert.ok(Math.abs(b1.group.rotation.y - origRotY) < 1e-6);
        });

        it('ruft historyManager.saveState() bei erfolgreicher Drehung auf', () => {
            const b1 = makeBrick('b1', 0, 0, 0);
            deps.library._bricks = [b1];
            deps.collisionManager.checkCollision = mock.fn(() => false);
            manager.attach([b1]);
            const historyManager = { saveState: mock.fn() };
            manager.historyManager = historyManager;
            manager.rotateSelection();
            assert.strictEqual(historyManager.saveState.mock.callCount(), 1);
        });

        it('ruft historyManager.saveState() NICHT bei Kollision auf', () => {
            const b1 = makeBrick('b1', 0, 0, 0);
            deps.library._bricks = [b1];
            deps.collisionManager.checkCollision = mock.fn(() => true);
            manager.attach([b1]);
            const historyManager = { saveState: mock.fn() };
            manager.historyManager = historyManager;
            manager.rotateSelection();
            assert.strictEqual(historyManager.saveState.mock.callCount(), 0);
        });

    });

    // ── _computeCenter ───────────────────────────────────────────────────────

    describe('_computeCenter', () => {

        it('gibt Nullvektor zurück wenn keine Steine ausgewählt', () => {
            const center = manager._computeCenter();
            assert.ok(center.equals(new THREE.Vector3(0, 0, 0)));
        });

        it('gibt korrekte Mitte für zwei Steine zurück', () => {
            const b1 = makeBrick('b1', 0, 0, 0);
            const b2 = makeBrick('b2', 4, 0, 0);
            manager._selectedBricks = [b1, b2];
            const center = manager._computeCenter();
            assert.ok(Math.abs(center.x - 2) < 1e-6);
        });

        it('gibt korrekte Mitte für einen einzelnen Stein zurück', () => {
            const b1 = makeBrick('b1', 3, 5, 7);
            manager._selectedBricks = [b1];
            const center = manager._computeCenter();
            assert.ok(Math.abs(center.x - 3) < 1e-6);
            assert.ok(Math.abs(center.y - 5) < 1e-6);
            assert.ok(Math.abs(center.z - 7) < 1e-6);
        });

    });

    // ── _hasCollision ────────────────────────────────────────────────────────

    describe('_hasCollision', () => {

        it('gibt false zurück wenn checkCollision immer false meldet', () => {
            const b1 = makeBrick('b1');
            deps.library._bricks = [b1];
            deps.collisionManager.checkCollision = mock.fn(() => false);
            manager._selectedBricks = [b1];
            assert.strictEqual(manager._hasCollision(), false);
        });

        it('gibt true zurück wenn checkCollision eine Kollision meldet', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            deps.library._bricks = [b1, b2];
            deps.collisionManager.checkCollision = mock.fn(() => true);
            manager._selectedBricks = [b1];
            assert.strictEqual(manager._hasCollision(), true);
        });

        it('ignoriert Kollisionen innerhalb der Selektion', () => {
            const b1 = makeBrick('b1');
            const b2 = makeBrick('b2');
            // Beide sind in der Selektion → others=[] → keine Kollision möglich
            deps.library._bricks = [b1, b2];
            // Mock: Kollision nur wenn es externe Steine gibt (others.length > 0)
            deps.collisionManager.checkCollision = mock.fn(
                (_type, _pos, _rot, others) => others.length > 0
            );
            manager._selectedBricks = [b1, b2];
            assert.strictEqual(manager._hasCollision(), false);
        });

    });

    // ── dispose ──────────────────────────────────────────────────────────────

    it('dispose wirft keine Ausnahme', () => {
        assert.doesNotThrow(() => manager.dispose());
    });

    it('dispose entfernt den Pivot aus der Szene', () => {
        const pivot = manager._pivot;
        manager.dispose();
        assert.ok(!deps.scene.children.includes(pivot));
    });

});
