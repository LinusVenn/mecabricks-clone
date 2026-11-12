import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SelectionManager } from '../src/editor/SelectionManager.js';

describe('SelectionManager', () => {

    let camera, renderer, scene, manager;

    beforeEach(() => {
        camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        renderer = {
            domElement: {
                addEventListener: () => {},
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            }
        };
        scene = new THREE.Scene();
        manager = new SelectionManager(camera, renderer, scene);
    });

    it('selectedObject ist initial null', () => {
        assert.strictEqual(manager.selectedObject, null);
    });

    it('onSelectionChanged ist initial null', () => {
        assert.strictEqual(manager.onSelectionChanged, null);
    });

    // ── selectObject (direkter Aufruf) ─────────────────────────────────────

    describe('selectObject', () => {

        it('setzt selectedObject', () => {
            const group = { userData: { brickId: 42 } };
            manager.selectObject(group);
            assert.strictEqual(manager.selectedObject, group);
        });

        it('ruft onSelectionChanged mit dem Objekt auf', () => {
            const cb = mock.fn();
            manager.onSelectionChanged = cb;
            const group = { userData: { brickId: 42 } };
            manager.selectObject(group);
            assert.strictEqual(cb.mock.callCount(), 1);
            assert.strictEqual(cb.mock.calls[0].arguments[0], group);
        });

        it('ruft onSelectionChanged nicht auf wenn callback null', () => {
            assert.doesNotThrow(() => {
                manager.selectObject({ userData: { brickId: 1 } });
            });
        });

    });

    // ── clearSelection ─────────────────────────────────────────────────────

    describe('clearSelection', () => {

        it('setzt selectedObject auf null', () => {
            manager.selectedObject = { userData: { brickId: 1 } };
            manager.clearSelection();
            assert.strictEqual(manager.selectedObject, null);
        });

        it('ruft onSelectionChanged(null) auf', () => {
            const cb = mock.fn();
            manager.onSelectionChanged = cb;
            manager.clearSelection();
            assert.strictEqual(cb.mock.callCount(), 1);
            assert.strictEqual(cb.mock.calls[0].arguments[0], null);
        });

        it('wirft keinen Fehler wenn onSelectionChanged null ist', () => {
            assert.doesNotThrow(() => manager.clearSelection());
        });

    });

    // ── handleClick ────────────────────────────────────────────────────────

    describe('handleClick', () => {

        it('ruft clearSelection auf wenn kein Treffer', () => {
            const cb = mock.fn();
            manager.onSelectionChanged = cb;
            // Raycaster wird keine Treffer liefern (leere Szene)
            manager.handleClick({ clientX: 400, clientY: 300 });
            assert.strictEqual(manager.selectedObject, null);
            assert.strictEqual(cb.mock.callCount(), 1);
            assert.strictEqual(cb.mock.calls[0].arguments[0], null);
        });

        it('berechnet NDC-x = 0 bei Klick auf Mitte', () => {
            manager.handleClick({ clientX: 400, clientY: 300 });
            assert.ok(Math.abs(manager.mouse.x - 0) < 0.01);
        });

        it('berechnet NDC-y = 0 bei Klick auf Mitte', () => {
            manager.handleClick({ clientX: 400, clientY: 300 });
            assert.ok(Math.abs(manager.mouse.y - 0) < 0.01);
        });

        it('wählt Gruppe mit brickId aus wenn Raycaster trifft', () => {
            // Brick direkt in Szene platzieren und Raycaster simulieren
            const group = new THREE.Group();
            group.userData.brickId = 99;
            const geo = new THREE.BoxGeometry(4, 1.2, 2);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
            scene.add(group);

            // Stub raycaster.intersectObjects um gezielt zu treffen
            manager.raycaster.intersectObjects = () => [{ object: mesh }];

            const cb = mock.fn();
            manager.onSelectionChanged = cb;
            manager.handleClick({ clientX: 400, clientY: 300 });

            assert.strictEqual(manager.selectedObject, group);
            assert.strictEqual(cb.mock.calls[0].arguments[0], group);
        });

    });

});
