/**
 * Integrationstests – Transformationssystem (Phase 8.9)
 */
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GroupTransformManager } from '../src/editor/GroupTransformManager.js';


function makeBrick(id, x = 0, y = 0, z = 0) {
    return {
        id,
        type: 'brick_2x4',
        group: {
            // THREE.Vector3 liefert .clone(), .sub(), .add(), .applyAxisAngle()
            position: new THREE.Vector3(x, y, z),
            rotation: { y: 0, x: 0, z: 0, clone() { return { y: this.y, x: this.x, z: this.z }; }, copy(r) { this.y = r.y; this.x = r.x; this.z = r.z; } },
            updateMatrixWorld: mock.fn()
        }
    };
}

function makeGTMDeps() {
    const bricks = [];
    return {
        camera:   {},
        renderer: {
            domElement: {
                addEventListener: () => {}, removeEventListener: () => {},
                style: { touchAction: '' }
            }
        },
        scene: { add: mock.fn(), remove: mock.fn() },
        sceneManager: { controls: { enabled: true } },
        collisionManager: { checkCollision: mock.fn(() => false) },
        library: {
            _bricks: bricks,
            getAll() { return [...this._bricks]; }
        },
        bricks,
    };
}


describe('GroupTransformManager – Transformations-Integration', () => {

    let manager, deps;

    beforeEach(() => {
        deps = makeGTMDeps();
        manager = new GroupTransformManager(
            deps.camera,
            deps.renderer,
            deps.scene,
            deps.sceneManager,
            deps.collisionManager,
            deps.library
        );
    });

    it('attach mit Bausteinen setzt _selectedBricks', () => {
        const b = makeBrick('b1');
        deps.bricks.push(b);
        manager.attach([b]);
        assert.strictEqual(manager._selectedBricks.length, 1);
        assert.strictEqual(manager._active, true);
    });

    it('attach mit leerem Array ruft detach auf', () => {
        const b = makeBrick('b1');
        manager._selectedBricks = [b];
        manager._active = true;
        manager.attach([]);
        assert.strictEqual(manager._selectedBricks.length, 0);
        assert.strictEqual(manager._active, false);
    });

    it('detach leert _selectedBricks und setzt _active false', () => {
        manager._selectedBricks = [makeBrick('b1')];
        manager._active = true;
        manager.detach();
        assert.strictEqual(manager._selectedBricks.length, 0);
        assert.strictEqual(manager._active, false);
    });

    it('_computeCenter gibt (0,0,0) zurück wenn keine Bausteine', () => {
        manager._selectedBricks = [];
        const c = manager._computeCenter();
        assert.strictEqual(c.x, 0);
        assert.strictEqual(c.y, 0);
        assert.strictEqual(c.z, 0);
    });

    it('_computeCenter berechnet Mittelpunkt korrekt', () => {
        const b1 = makeBrick('b1', 0, 0, 0);
        const b2 = makeBrick('b2', 4, 0, 0);
        manager._selectedBricks = [b1, b2];
        const c = manager._computeCenter();
        assert.strictEqual(c.x, 2);
    });

    it('rotateSelection gibt false zurück wenn kein Stein ausgewählt', () => {
        manager._selectedBricks = [];
        assert.strictEqual(manager.rotateSelection(), false);
    });

    it('rotateSelection gibt true zurück ohne Kollision', () => {
        const b = makeBrick('b1', 1, 0, 0);
        manager._selectedBricks = [b];
        deps.library._bricks.push(b);
        assert.strictEqual(manager.rotateSelection(), true);
    });

    it('rotateSelection ruft historyManager.saveState() auf', () => {
        const b = makeBrick('b1', 1, 0, 0);
        manager._selectedBricks = [b];
        deps.library._bricks.push(b);
        const hm = { saveState: mock.fn() };
        manager.historyManager = hm;
        manager.rotateSelection();
        assert.strictEqual(hm.saveState.mock.callCount(), 1);
    });

    it('rotateSelection gibt false zurück und stellt Zustand wieder her bei Kollision', () => {
        const b = makeBrick('b1', 1, 0, 0);
        const b2 = makeBrick('b2', 5, 0, 0);
        deps.library._bricks.push(b, b2);
        manager._selectedBricks = [b];
        deps.collisionManager.checkCollision = mock.fn(() => true);
        const origY = b.group.rotation.y;
        assert.strictEqual(manager.rotateSelection(), false);
        assert.strictEqual(b.group.rotation.y, origY);
    });

    it('dispose wirft keinen Fehler', () => {
        assert.doesNotThrow(() => manager.dispose());
    });
});
