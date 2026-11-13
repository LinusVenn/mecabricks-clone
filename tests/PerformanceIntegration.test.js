/**
 * Integrationstests – Performance-Subsysteme (Phase 8.9)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GeometryCache }       from '../src/performance/GeometryCache.js';
import { MaterialCache }       from '../src/performance/MaterialCache.js';
import { PerformanceMonitor }  from '../src/performance/PerformanceMonitor.js';
import { VisibilityOptimizer } from '../src/performance/VisibilityOptimizer.js';
import { ModelLoadingManager } from '../src/performance/ModelLoadingManager.js';


// requestAnimationFrame-Polyfill für Node.js-Testumgebung
if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
    globalThis.cancelAnimationFrame  = (id) => clearTimeout(id);
}


// ------------------------------------------------------------------
// GeometryCache + MaterialCache zusammen
// ------------------------------------------------------------------

describe('GeometryCache + MaterialCache – Integration', () => {

    it('Geometrie und Material lassen sich unabhängig cachen', () => {
        const gc = new GeometryCache();
        const mc = new MaterialCache();

        const geo = gc.acquire('brick_2x4', () => new THREE.BoxGeometry(4, 1.2, 2));
        const mat = mc.acquire(0xff0000);

        assert.ok(geo instanceof THREE.BufferGeometry);
        assert.ok(mat instanceof THREE.MeshStandardMaterial);

        gc.release('brick_2x4');
        mc.release(0xff0000);
    });

    it('Geometrie und Material werden beim dispose freigegeben', () => {
        const gc = new GeometryCache();
        const mc = new MaterialCache();

        gc.acquire('g1', () => new THREE.BoxGeometry(1, 1, 1));
        mc.acquire(0x00ff00);

        gc.dispose();
        mc.dispose();

        assert.strictEqual(gc.size, 0);
        assert.strictEqual(mc.size, 0);
    });

    it('gemeinsame Geometrie ist identisch (=== Vergleich)', () => {
        const gc = new GeometryCache();
        const g1 = gc.acquire('shared', () => new THREE.BoxGeometry(1, 1, 1));
        const g2 = gc.acquire('shared', () => new THREE.BoxGeometry(9, 9, 9));
        assert.strictEqual(g1, g2);
        gc.dispose();
    });

    it('gemeinsames Material ist identisch (=== Vergleich)', () => {
        const mc = new MaterialCache();
        const m1 = mc.acquire(0xff0000);
        const m2 = mc.acquire(0xff0000);
        assert.strictEqual(m1, m2);
        mc.dispose();
    });
});


// ------------------------------------------------------------------
// PerformanceMonitor
// ------------------------------------------------------------------

describe('PerformanceMonitor – Integration', () => {

    it('update() sammelt drawCalls aus renderer.info', () => {
        const renderer = {
            info: {
                render: { calls: 77, triangles: 1000 },
                memory: { geometries: 5, textures: 3 },
                programs: []
            }
        };
        const m = new PerformanceMonitor(renderer);
        m.update(100);
        assert.strictEqual(m.getMetrics().drawCalls, 77);
        assert.strictEqual(m.getMetrics().triangles, 1000);
    });

    it('recordLoadTime und getMetrics geben korrekte Ladezeit', () => {
        const m = new PerformanceMonitor(null);
        m.recordLoadTime(2500);
        assert.strictEqual(m.getMetrics().loadTime, 2500);
    });

    it('FPS steigt nach vielen schnellen Frames über 0', () => {
        const m = new PerformanceMonitor(null);
        for (let i = 1; i <= 20; i++) m.update(i * 16);
        assert.ok(m.getMetrics().fps > 0);
    });
});


// ------------------------------------------------------------------
// VisibilityOptimizer
// ------------------------------------------------------------------

describe('VisibilityOptimizer – Integration', () => {

    it('deaktivierter Optimizer ändert keine Sichtbarkeit', () => {
        const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        cam.position.set(0, 10, 20);
        cam.updateMatrixWorld();

        const group = new THREE.Group();
        group.position.set(0, 0, -500);
        group.visible = true;
        group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));

        const brick   = { id: 'b1', group };
        const library = { getAll: () => [brick] };

        const opt = new VisibilityOptimizer(cam, library);
        opt.update();   // disabled → no-op
        assert.strictEqual(group.visible, true);
    });

    it('enable() → disable() macht alle Änderungen rückgängig', () => {
        const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        cam.position.set(0, 0, 5);
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();

        const group = new THREE.Group();
        group.position.set(0, 0, -500);
        group.visible = true;
        group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
        group.updateMatrixWorld(true);

        const brick   = { id: 'far', group };
        const library = { getAll: () => [brick] };

        const opt = new VisibilityOptimizer(cam, library);
        opt.enable();
        opt.update();
        opt.disable();

        assert.strictEqual(group.visible, true);
    });
});


// ------------------------------------------------------------------
// ModelLoadingManager
// ------------------------------------------------------------------

describe('ModelLoadingManager – Integration', () => {

    it('lädt alle Bausteine und gibt totalLoaded zurück', async () => {
        const loaded  = [];
        const library = { addBrickFromData: (d) => loaded.push(d) };

        // API: mgr.onComplete = fn; await mgr.load(data);
        const mgr  = new ModelLoadingManager(library, { chunkSize: 5, chunkDelay: 0 });
        const data = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}` }));

        const result = await new Promise(resolve => {
            mgr.onComplete = n => resolve(n);
            mgr.load(data);
        });

        assert.strictEqual(result, 12);
        assert.strictEqual(loaded.length, 12);
    });

    it('abort() stoppt das Laden', async () => {
        const library = { addBrickFromData: () => {} };
        const mgr     = new ModelLoadingManager(library, { chunkSize: 2, chunkDelay: 0 });
        const data    = Array.from({ length: 10 }, (_, i) => ({ id: `b${i}` }));

        mgr.load(data);
        mgr.abort();

        assert.strictEqual(mgr.isLoading, false);
    });

    it('onProgress wird während des Ladens aufgerufen', async () => {
        const library    = { addBrickFromData: () => {} };
        const mgr        = new ModelLoadingManager(library, { chunkSize: 3, chunkDelay: 0 });
        const data       = Array.from({ length: 9 }, (_, i) => ({ id: `b${i}` }));
        const progresses = [];

        await new Promise(resolve => {
            mgr.onProgress = p => progresses.push(p);
            mgr.onComplete = () => resolve();
            mgr.load(data);
        });

        assert.ok(progresses.length > 0, 'onProgress sollte mindestens einmal aufgerufen werden');
        assert.ok(progresses.every(p => p >= 0 && p <= 1), 'progress muss zwischen 0 und 1 liegen');
    });
});
