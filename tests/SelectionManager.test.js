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
            // button: 0 ist Linksklick (Phase-6-Check)
            manager.handleClick({ button: 0, clientX: 400, clientY: 300 });
            assert.strictEqual(manager.selectedObject, null);
            assert.strictEqual(cb.mock.callCount(), 1);
            assert.strictEqual(cb.mock.calls[0].arguments[0], null);
        });

        it('berechnet NDC-x = 0 bei Klick auf Mitte', () => {
            manager.handleClick({ button: 0, clientX: 400, clientY: 300 });
            assert.ok(Math.abs(manager.mouse.x - 0) < 0.01);
        });

        it('berechnet NDC-y = 0 bei Klick auf Mitte', () => {
            manager.handleClick({ button: 0, clientX: 400, clientY: 300 });
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
            manager.handleClick({ button: 0, clientX: 400, clientY: 300 });

            assert.strictEqual(manager.selectedObject, group);
            assert.strictEqual(cb.mock.calls[0].arguments[0], group);
        });

        it('button !== 0 wird ignoriert', () => {
            const cb = mock.fn();
            manager.onSelectionChanged = cb;
            manager.handleClick({ button: 2, clientX: 400, clientY: 300 });
            assert.strictEqual(cb.mock.callCount(), 0);
        });

    });


    // ── Phase-6-Erweiterungen ─────────────────────────────────────────────────

    describe('Phase 6 – onCtrlClick / onEmptyClick', () => {

        it('onCtrlClick ist initial null', () => {
            assert.strictEqual(manager.onCtrlClick, null);
        });

        it('onEmptyClick ist initial null', () => {
            assert.strictEqual(manager.onEmptyClick, null);
        });

        it('Strg+Klick auf Stein ruft onCtrlClick mit brickId auf', () => {
            // Raycaster-Stub der einen Stein trifft
            const group = new THREE.Group();
            group.userData.brickId = 'brick-ctrl';
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
            group.add(mesh);

            manager.raycaster.intersectObjects = () => [{ object: mesh }];

            let capturedId = null;
            manager.onCtrlClick = (id) => { capturedId = id; };

            manager.handleClick({ button: 0, clientX: 400, clientY: 300, ctrlKey: true, metaKey: false });
            assert.strictEqual(capturedId, 'brick-ctrl');
        });

        it('Strg+Klick auf Stein ruft NICHT selectObject auf', () => {
            const group = new THREE.Group();
            group.userData.brickId = 'brick-ctrl';
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
            group.add(mesh);

            manager.raycaster.intersectObjects = () => [{ object: mesh }];
            manager.onCtrlClick = () => {};

            const cb = mock.fn();
            manager.onSelectionChanged = cb;

            manager.handleClick({ button: 0, clientX: 400, clientY: 300, ctrlKey: true, metaKey: false });
            assert.strictEqual(cb.mock.callCount(), 0);
        });

        it('Normaler Klick auf Stein ruft onEmptyClick auf (um MultiSelection zu löschen)', () => {
            const group = new THREE.Group();
            group.userData.brickId = 'brick-1';
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
            group.add(mesh);

            manager.raycaster.intersectObjects = () => [{ object: mesh }];

            let emptyCalled = false;
            manager.onEmptyClick = () => { emptyCalled = true; };

            manager.handleClick({ button: 0, clientX: 400, clientY: 300, ctrlKey: false, metaKey: false });
            assert.strictEqual(emptyCalled, true);
        });

        it('Klick auf leere Stelle ruft onEmptyClick auf', () => {
            manager.raycaster.intersectObjects = () => [];
            let emptyCalled = false;
            manager.onEmptyClick = () => { emptyCalled = true; };
            manager.handleClick({ button: 0, clientX: 400, clientY: 300, ctrlKey: false, metaKey: false });
            assert.strictEqual(emptyCalled, true);
        });

        it('Strg+Klick auf leere Stelle ruft onEmptyClick NICHT auf', () => {
            manager.raycaster.intersectObjects = () => [];
            let emptyCalled = false;
            manager.onEmptyClick = () => { emptyCalled = true; };
            manager.handleClick({ button: 0, clientX: 400, clientY: 300, ctrlKey: true, metaKey: false });
            assert.strictEqual(emptyCalled, false);
        });

        it('Strg+Klick auf leere Stelle löscht Einzelauswahl nicht', () => {
            // Setze vorab eine Einzelauswahl
            const group = new THREE.Group();
            group.userData.brickId = 'existing';
            manager.selectedObject = group;

            manager.raycaster.intersectObjects = () => [];
            manager.handleClick({ button: 0, clientX: 400, clientY: 300, ctrlKey: true, metaKey: false });

            // selectedObject soll unverändert bleiben
            assert.strictEqual(manager.selectedObject, group);
        });

        it('Highlight-Objekte (userData.isHighlight) werden beim Raycast ignoriert', () => {
            // Mesh mit isHighlight-Flag soll nicht als Treffer gelten
            const highlight = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
            highlight.userData.isHighlight = true;

            manager.raycaster.intersectObjects = () => [{ object: highlight }];

            const cb = mock.fn();
            manager.onSelectionChanged = cb;
            manager.handleClick({ button: 0, clientX: 400, clientY: 300, ctrlKey: false, metaKey: false });

            // Kein Stein gefunden → clearSelection → null
            assert.strictEqual(cb.mock.calls[0].arguments[0], null);
        });

    });

});
