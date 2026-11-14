/**
 * Tests für PerformanceManager (Phase 8.8)
 *
 * Abdeckung:
 *  - beginFrame()               – performanceMonitor.update + visibilityOptimizer.update
 *  - beginFrame() shadow dirty  – shadowMap.needsUpdate = true, _sceneDirty → false
 *  - beginFrame() shadow clean  – shadowMap.needsUpdate = false
 *  - beginFrame() ohne shadow   – shadowMap unverändert
 *  - endFrame()                 – Smoke-Test
 *  - markSceneDirty()           – setzt _sceneDirty = true
 *  - enableShadowOptimization() / disableShadowOptimization() / isShadowOptimizationEnabled()
 *  - enableInstancing() / disableInstancing()
 *  - enableMonitor() / disableMonitor()
 *  - getMetrics()
 *  - onBrickAdded()             – markSceneDirty + instanceManager.addBrick (wenn enabled)
 *  - onBrickRemoved()           – markSceneDirty + instanceManager.onBrickRemoved
 *  - onBrickTransformed()       – markSceneDirty + instanceManager.updateBrickMatrix
 *  - onSceneStructureChanged()  – markSceneDirty + instanceManager.rebuild (wenn enabled)
 *  - dispose()                  – delegiert an alle Teilsysteme
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceManager } from '../src/performance/PerformanceManager.js';


// ─── Minimale Stubs für den Konstruktor ──────────────────────────────────────
// VisibilityOptimizer ruft im Konstruktor new THREE.Frustum() auf → THREE muss
// importierbar sein. Da 'three' in den package.json-Abhängigkeiten steht, ist
// dies in der Node.js-Testumgebung gewährleistet.

function makeMinimalDeps() {
    return {
        scene:    {},
        camera:   {},
        renderer: {
            info: {
                render: { calls: 0, triangles: 0 },
                memory: { geometries: 0, textures: 0 }
            },
            shadowMap: { needsUpdate: false, autoUpdate: true }
        },
        library: {}
    };
}

function makeShadowManager() {
    return {};
}


/**
 * Ersetzt die Teilsysteme des PerformanceManagers nach der Konstruktion
 * durch Mock-Spies. So können wir das Verhalten isoliert testen.
 */
function mockSubsystems(pm) {
    let instanceEnabled = false;

    pm.performanceMonitor = {
        update:          mock.fn(),
        getMetrics:      mock.fn(() => ({ fps: 60, drawCalls: 0, triangles: 0 })),
        recordLoadTime:  mock.fn(),
        setEnabled:      mock.fn(),
        reset:           mock.fn()
    };

    pm.instanceManager = {
        get enabled()  { return instanceEnabled; },
        set enabled(v) { instanceEnabled = v; },
        enable:              mock.fn(() => { instanceEnabled = true; }),
        disable:             mock.fn(() => { instanceEnabled = false; }),
        rebuild:             mock.fn(),
        addBrick:            mock.fn(),
        onBrickRemoved:      mock.fn(),
        updateBrickMatrix:   mock.fn(),
        deactivateAll:       mock.fn(),
        activateBrick:       mock.fn(),
        dispose:             mock.fn()
    };

    pm.visibilityOptimizer = {
        update:  mock.fn(),
        enable:  mock.fn(),
        disable: mock.fn()
    };

    pm.modelLoadingManager = {
        loadChunked: mock.fn(async (_data, callbacks) => {
            callbacks?.onComplete?.();
            return Promise.resolve();
        })
    };

    pm.geometryCache = { dispose: mock.fn() };
    pm.materialCache = { dispose: mock.fn() };
}


// ─── Hilfsfunktion: frischen PerformanceManager aufbauen ─────────────────────

function makeManager(extraOpts = {}) {
    const deps = { ...makeMinimalDeps(), ...extraOpts };
    const pm   = new PerformanceManager(deps);
    mockSubsystems(pm);
    return pm;
}


// ═══════════════════════════════════════════════════════════════════════════════
// beginFrame()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – beginFrame()', () => {

    it('ruft performanceMonitor.update() mit nowMs auf', () => {
        const pm = makeManager();
        pm.beginFrame(1234);

        assert.strictEqual(pm.performanceMonitor.update.mock.calls.length, 1);
        assert.strictEqual(pm.performanceMonitor.update.mock.calls[0].arguments[0], 1234);
    });

    it('ruft visibilityOptimizer.update() auf', () => {
        const pm = makeManager();
        pm.beginFrame(0);

        assert.strictEqual(pm.visibilityOptimizer.update.mock.calls.length, 1);
    });

    it('setzt shadowMap.needsUpdate = true wenn dirty + shadow-Optimierung aktiv', () => {
        const renderer      = makeMinimalDeps().renderer;
        const shadowManager = makeShadowManager();
        const pm = new PerformanceManager({ ...makeMinimalDeps(), renderer, shadowManager });
        mockSubsystems(pm);
        pm._renderer = renderer; // sicherstellen

        pm.enableShadowOptimization();
        pm._sceneDirty = true;

        pm.beginFrame(0);

        assert.strictEqual(renderer.shadowMap.needsUpdate, true,
            'shadowMap.needsUpdate muss true sein wenn Szene dirty');
    });

    it('setzt shadowMap.needsUpdate = false wenn clean + shadow-Optimierung aktiv', () => {
        const renderer      = makeMinimalDeps().renderer;
        const shadowManager = makeShadowManager();
        const pm = new PerformanceManager({ ...makeMinimalDeps(), renderer, shadowManager });
        mockSubsystems(pm);
        pm._renderer = renderer;

        pm.enableShadowOptimization();
        pm._sceneDirty = false; // direkt auf clean setzen

        pm.beginFrame(0);

        assert.strictEqual(renderer.shadowMap.needsUpdate, false,
            'shadowMap.needsUpdate muss false sein wenn Szene clean');
    });

    it('setzt _sceneDirty = false nach Dirty-Frame', () => {
        const renderer      = makeMinimalDeps().renderer;
        const shadowManager = makeShadowManager();
        const pm = new PerformanceManager({ ...makeMinimalDeps(), renderer, shadowManager });
        mockSubsystems(pm);
        pm._renderer = renderer;

        pm.enableShadowOptimization();
        pm._sceneDirty = true;
        pm.beginFrame(0);

        assert.strictEqual(pm._sceneDirty, false,
            '_sceneDirty muss nach beginFrame() zurückgesetzt werden');
    });

    it('verändert shadowMap NICHT wenn shadow-Optimierung deaktiviert', () => {
        const renderer      = makeMinimalDeps().renderer;
        const pm            = makeManager({ renderer });
        pm._renderer        = renderer;
        renderer.shadowMap.needsUpdate = false;

        // Shadow-Optimierung NICHT aktiviert
        pm._sceneDirty = true;
        pm.beginFrame(0);

        // Wert darf sich nicht geändert haben (kein shadowManager → kein Update)
        assert.strictEqual(renderer.shadowMap.needsUpdate, false);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// endFrame()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – endFrame()', () => {

    it('wirft nicht (Smoke-Test)', () => {
        const pm = makeManager();
        assert.doesNotThrow(() => pm.endFrame());
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// markSceneDirty()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – markSceneDirty()', () => {

    it('setzt _sceneDirty = true', () => {
        const pm = makeManager();
        pm._sceneDirty = false;  // explizit auf false

        pm.markSceneDirty();

        assert.strictEqual(pm._sceneDirty, true);
    });

    it('doppelter Aufruf wirft nicht', () => {
        const pm = makeManager();
        pm.markSceneDirty();
        assert.doesNotThrow(() => pm.markSceneDirty());
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Shadow-Optimierung
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – Schattenoptimierung', () => {

    it('isShadowOptimizationEnabled() gibt false zurück initial', () => {
        const pm = makeManager();
        assert.strictEqual(pm.isShadowOptimizationEnabled(), false);
    });

    it('enableShadowOptimization() aktiviert die Optimierung', () => {
        const pm = makeManager();
        pm.enableShadowOptimization();
        assert.strictEqual(pm.isShadowOptimizationEnabled(), true);
    });

    it('disableShadowOptimization() deaktiviert die Optimierung', () => {
        const pm = makeManager();
        pm.enableShadowOptimization();
        pm.disableShadowOptimization();
        assert.strictEqual(pm.isShadowOptimizationEnabled(), false);
    });

    it('disableShadowOptimization() setzt shadowMap.needsUpdate = true', () => {
        const renderer = makeMinimalDeps().renderer;
        renderer.shadowMap.needsUpdate = false;
        const pm = makeManager({ renderer });
        pm._renderer = renderer;

        pm.enableShadowOptimization();
        pm.disableShadowOptimization();

        assert.strictEqual(renderer.shadowMap.needsUpdate, true,
            'shadowMap muss nach Deaktivierung aktualisiert werden');
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Instancing
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – Instancing', () => {

    it('enableInstancing() delegiert an instanceManager.enable()', () => {
        const pm = makeManager();
        pm.enableInstancing();

        assert.strictEqual(pm.instanceManager.enable.mock.calls.length, 1);
    });

    it('enableInstancing() markiert die Szene als dirty', () => {
        const pm = makeManager();
        pm._sceneDirty = false;

        pm.enableInstancing();

        assert.strictEqual(pm._sceneDirty, true);
    });

    it('disableInstancing() delegiert an instanceManager.disable()', () => {
        const pm = makeManager();
        pm.disableInstancing();

        assert.strictEqual(pm.instanceManager.disable.mock.calls.length, 1);
    });

    it('disableInstancing() markiert die Szene als dirty', () => {
        const pm = makeManager();
        pm._sceneDirty = false;

        pm.disableInstancing();

        assert.strictEqual(pm._sceneDirty, true);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Monitor
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – Monitor', () => {

    it('enableMonitor() ruft performanceMonitor.setEnabled(true) auf', () => {
        const pm = makeManager();
        pm.enableMonitor();

        assert.strictEqual(pm.performanceMonitor.setEnabled.mock.calls.length, 1);
        assert.strictEqual(pm.performanceMonitor.setEnabled.mock.calls[0].arguments[0], true);
    });

    it('disableMonitor() ruft performanceMonitor.setEnabled(false) auf', () => {
        const pm = makeManager();
        pm.disableMonitor();

        assert.strictEqual(pm.performanceMonitor.setEnabled.mock.calls.length, 1);
        assert.strictEqual(pm.performanceMonitor.setEnabled.mock.calls[0].arguments[0], false);
    });

    it('getMetrics() delegiert an performanceMonitor.getMetrics()', () => {
        const pm = makeManager();
        const metrics = pm.getMetrics();

        assert.strictEqual(pm.performanceMonitor.getMetrics.mock.calls.length, 1);
        assert.ok('fps' in metrics);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// Brick-Events
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – Brick-Events', () => {

    it('onBrickAdded() markiert Szene als dirty', () => {
        const pm = makeManager();
        pm._sceneDirty = false;

        pm.onBrickAdded({ id: 'b1' });

        assert.strictEqual(pm._sceneDirty, true);
    });

    it('onBrickAdded() ruft instanceManager.addBrick() auf wenn Instancing aktiv', () => {
        const pm = makeManager();
        pm.instanceManager.enabled = true;

        const brick = { id: 'b1' };
        pm.onBrickAdded(brick);

        assert.strictEqual(pm.instanceManager.addBrick.mock.calls.length, 1);
        assert.strictEqual(pm.instanceManager.addBrick.mock.calls[0].arguments[0], brick);
    });

    it('onBrickAdded() ruft instanceManager.addBrick() NICHT auf wenn Instancing deaktiviert', () => {
        const pm = makeManager();
        pm.instanceManager.enabled = false;

        pm.onBrickAdded({ id: 'b1' });

        assert.strictEqual(pm.instanceManager.addBrick.mock.calls.length, 0);
    });

    it('onBrickRemoved() markiert Szene als dirty', () => {
        const pm = makeManager();
        pm._sceneDirty = false;

        pm.onBrickRemoved('b1');

        assert.strictEqual(pm._sceneDirty, true);
    });

    it('onBrickRemoved() ruft instanceManager.onBrickRemoved() auf', () => {
        const pm = makeManager();
        pm.onBrickRemoved('b1');

        assert.strictEqual(pm.instanceManager.onBrickRemoved.mock.calls.length, 1);
        assert.strictEqual(pm.instanceManager.onBrickRemoved.mock.calls[0].arguments[0], 'b1');
    });

    it('onBrickTransformed() markiert Szene als dirty', () => {
        const pm = makeManager();
        pm._sceneDirty = false;

        pm.onBrickTransformed('b1');

        assert.strictEqual(pm._sceneDirty, true);
    });

    it('onBrickTransformed() ruft instanceManager.updateBrickMatrix() auf', () => {
        const pm = makeManager();
        pm.onBrickTransformed('b1');

        assert.strictEqual(pm.instanceManager.updateBrickMatrix.mock.calls.length, 1);
        assert.strictEqual(pm.instanceManager.updateBrickMatrix.mock.calls[0].arguments[0], 'b1');
    });

    it('onSceneStructureChanged() markiert Szene als dirty', () => {
        const pm = makeManager();
        pm._sceneDirty = false;

        pm.onSceneStructureChanged();

        assert.strictEqual(pm._sceneDirty, true);
    });

    it('onSceneStructureChanged() ruft instanceManager.rebuild() auf wenn Instancing aktiv', () => {
        const pm = makeManager();
        pm.instanceManager.enabled = true;

        pm.onSceneStructureChanged();

        assert.strictEqual(pm.instanceManager.rebuild.mock.calls.length, 1);
    });

    it('onSceneStructureChanged() ruft instanceManager.rebuild() NICHT auf wenn deaktiviert', () => {
        const pm = makeManager();
        pm.instanceManager.enabled = false;

        pm.onSceneStructureChanged();

        assert.strictEqual(pm.instanceManager.rebuild.mock.calls.length, 0);
    });
});


// ═══════════════════════════════════════════════════════════════════════════════
// dispose()
// ═══════════════════════════════════════════════════════════════════════════════

describe('PerformanceManager – dispose()', () => {

    it('ruft instanceManager.dispose() auf', () => {
        const pm = makeManager();
        pm.dispose();
        assert.strictEqual(pm.instanceManager.dispose.mock.calls.length, 1);
    });

    it('ruft visibilityOptimizer.disable() auf', () => {
        const pm = makeManager();
        pm.dispose();
        assert.strictEqual(pm.visibilityOptimizer.disable.mock.calls.length, 1);
    });

    it('ruft geometryCache.dispose() auf', () => {
        const pm = makeManager();
        pm.dispose();
        assert.strictEqual(pm.geometryCache.dispose.mock.calls.length, 1);
    });

    it('ruft materialCache.dispose() auf', () => {
        const pm = makeManager();
        pm.dispose();
        assert.strictEqual(pm.materialCache.dispose.mock.calls.length, 1);
    });

    it('ruft performanceMonitor.reset() auf', () => {
        const pm = makeManager();
        pm.dispose();
        assert.strictEqual(pm.performanceMonitor.reset.mock.calls.length, 1);
    });

    it('doppeltes dispose() wirft nicht', () => {
        const pm = makeManager();
        pm.dispose();
        assert.doesNotThrow(() => pm.dispose());
    });
});
