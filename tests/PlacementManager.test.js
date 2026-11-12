import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlacementManager } from '../src/editor/PlacementManager.js';

// Einfacher Renderer-Mock: kein WebGL nötig
function makeRenderer(width = 800, height = 600) {
    return {
        domElement: {
            addEventListener: () => {},
            getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
        },
    };
}

describe('PlacementManager', () => {

    let camera, renderer, scene, library, manager;

    beforeEach(() => {
        camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 1000);
        camera.position.set(0, 10, 10);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();

        renderer = makeRenderer();
        scene = new THREE.Scene();
        library = { addBrick: () => {}, getAll: () => [] };

        // Neue Abhängigkeiten: snapSystem, collisionManager, connectionManager, preview
        const snapSystem = {
            snapPosition: (pos) => pos,
            findSnapPosition: () => null,
        };
        const collisionManager = { checkCollision: () => false };
        const connectionManager = { createConnection: () => null };
        const preview = { setType: () => {}, show: () => {}, hide: () => {}, update: () => {} };

        manager = new PlacementManager(
            camera, renderer, scene, library,
            snapSystem, collisionManager, connectionManager, preview
        );
    });

    // --- setSelectedPart ---

    it('selectedPart ist initial null', () => {
        assert.strictEqual(manager.selectedPart, null);
    });

    it('setSelectedPart setzt das ausgewählte Bauteil', () => {
        manager.setSelectedPart('brick_2x4');
        assert.strictEqual(manager.selectedPart, 'brick_2x4');
    });

    it('setSelectedPart überschreibt den vorherigen Wert', () => {
        manager.setSelectedPart('brick_2x4');
        manager.setSelectedPart('brick_2x2');
        assert.strictEqual(manager.selectedPart, 'brick_2x2');
    });

    // --- placeBrick: Guard-Klausel ---

    it('placeBrick tut nichts wenn kein Bauteil ausgewählt ist', () => {
        let called = false;
        library.addBrick = () => { called = true; };
        manager.placeBrick({ clientX: 400, clientY: 300 });
        assert.ok(!called);
    });

    // --- NDC-Berechnung ---

    // placeBrick() nimmt keine Parameter mehr — NDC wird über getMousePosition(event) geprüft

    it('NDC x-Mitte ergibt 0 (clientX = width/2)', () => {
        manager.getMousePosition({ clientX: 400, clientY: 300 });
        assert.ok(Math.abs(manager.mouse.x - 0) < 0.001, `erwartet 0, erhalten ${manager.mouse.x}`);
    });

    it('NDC x am linken Rand ergibt -1 (clientX = 0)', () => {
        manager.getMousePosition({ clientX: 0, clientY: 300 });
        assert.ok(Math.abs(manager.mouse.x - (-1)) < 0.001, `erwartet -1, erhalten ${manager.mouse.x}`);
    });

    it('NDC x am rechten Rand ergibt +1 (clientX = width)', () => {
        manager.getMousePosition({ clientX: 800, clientY: 300 });
        assert.ok(Math.abs(manager.mouse.x - 1) < 0.001, `erwartet 1, erhalten ${manager.mouse.x}`);
    });

    it('NDC y-Mitte ergibt 0 (clientY = height/2)', () => {
        manager.getMousePosition({ clientX: 400, clientY: 300 });
        assert.ok(Math.abs(manager.mouse.y - 0) < 0.001, `erwartet 0, erhalten ${manager.mouse.y}`);
    });

    it('NDC y am oberen Rand ergibt +1 (clientY = 0)', () => {
        manager.getMousePosition({ clientX: 400, clientY: 0 });
        assert.ok(Math.abs(manager.mouse.y - 1) < 0.001, `erwartet 1, erhalten ${manager.mouse.y}`);
    });

    it('NDC y am unteren Rand ergibt -1 (clientY = height)', () => {
        manager.getMousePosition({ clientX: 400, clientY: 600 });
        assert.ok(Math.abs(manager.mouse.y - (-1)) < 0.001, `erwartet -1, erhalten ${manager.mouse.y}`);
    });

    // --- Raster-Snap-Logik (Math.round(x/2)*2) ---

    const snapCases = [
        [0,    0 ],
        [0.9,  0 ],
        [1.0,  2 ],
        [1.1,  2 ],
        [2.0,  2 ],
        [3.0,  4 ],
        [-0.9, 0 ],
        [-1.1, -2],
    ];

    for (const [input, expected] of snapCases) {
        it(`Snap: x=${input} → ${expected}`, () => {
            // Verwende === statt Object.is, damit -0 == 0 als korrekt gilt
            const result = Math.round(input / 2) * 2;
            assert.ok(result === expected, `Snap(${input}) ergibt ${result}, erwartet ${expected}`);
        });
    }

});
