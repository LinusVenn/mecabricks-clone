import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceMonitor } from '../src/performance/PerformanceMonitor.js';


// =====================================================================
// Minimal-WebGLRenderer-Mock für PerformanceMonitor
// =====================================================================
function makeRenderer(info = {}) {
    return {
        info: {
            render: {
                calls:     info.calls     ?? 0,
                triangles: info.triangles ?? 0,
                frame:     0,
            },
            memory: {
                geometries: info.geometries ?? 0,
                textures:   info.textures   ?? 0,
            },
            programs: []
        }
    };
}


describe('PerformanceMonitor', () => {

    let monitor, renderer;

    beforeEach(() => {
        renderer = makeRenderer({
            calls: 10, triangles: 500, geometries: 4, textures: 2
        });
        monitor = new PerformanceMonitor(renderer);
    });


    // ------------------------------------------------------------------
    // Initialisierung
    // ------------------------------------------------------------------

    it('ist standardmäßig nicht aktiv', () => {
        assert.strictEqual(monitor.enabled, false);
    });

    it('getMetrics gibt ein Objekt zurück', () => {
        assert.ok(typeof monitor.getMetrics() === 'object');
    });

    it('alle Pflichtfelder sind im Metrik-Objekt vorhanden', () => {
        const m = monitor.getMetrics();
        const required = ['fps', 'drawCalls', 'triangles', 'objects',
                          'geometries', 'textures', 'materials', 'loadTime'];
        for (const key of required) {
            assert.ok(key in m, `Fehlender Schlüssel: ${key}`);
        }
    });


    // ------------------------------------------------------------------
    // enable / disable
    // ------------------------------------------------------------------

    it('enable() aktiviert den Monitor', () => {
        monitor.enable();
        assert.strictEqual(monitor.enabled, true);
    });

    it('disable() deaktiviert den Monitor', () => {
        monitor.enable();
        monitor.disable();
        assert.strictEqual(monitor.enabled, false);
    });

    it('setEnabled(true) aktiviert den Monitor', () => {
        monitor.setEnabled(true);
        assert.strictEqual(monitor.enabled, true);
    });

    it('setEnabled(false) deaktiviert den Monitor', () => {
        monitor.setEnabled(true);
        monitor.setEnabled(false);
        assert.strictEqual(monitor.enabled, false);
    });


    // ------------------------------------------------------------------
    // Metriken aus dem Renderer auslesen
    // ------------------------------------------------------------------

    it('drawCalls spiegelt renderer.info.render.calls wider', () => {
        renderer.info.render.calls = 42;
        monitor.update(1000);
        const m = monitor.getMetrics();
        assert.strictEqual(m.drawCalls, 42);
    });

    it('triangles spiegelt renderer.info.render.triangles wider', () => {
        renderer.info.render.triangles = 9999;
        monitor.update(1000);
        assert.strictEqual(monitor.getMetrics().triangles, 9999);
    });

    it('geometries spiegelt renderer.info.memory.geometries wider', () => {
        renderer.info.memory.geometries = 7;
        monitor.update(1000);
        assert.strictEqual(monitor.getMetrics().geometries, 7);
    });

    it('textures spiegelt renderer.info.memory.textures wider', () => {
        renderer.info.memory.textures = 3;
        monitor.update(1000);
        assert.strictEqual(monitor.getMetrics().textures, 3);
    });


    // ------------------------------------------------------------------
    // FPS-Berechnung
    // ------------------------------------------------------------------

    it('fps ist 0 vor dem ersten update-Aufruf', () => {
        assert.strictEqual(monitor.getMetrics().fps, 0);
    });

    it('fps liegt nach mehreren Frames in einem sinnvollen Bereich (>0)', () => {
        // Simuliere 10 Frames à 16 ms → ca. 62 FPS
        let t = 0;
        for (let i = 0; i < 10; i++) {
            t += 16;
            monitor.update(t);
        }
        const { fps } = monitor.getMetrics();
        assert.ok(fps > 0, `fps sollte > 0 sein, war ${fps}`);
    });


    // ------------------------------------------------------------------
    // Ladezeit
    // ------------------------------------------------------------------

    it('recordLoadTime setzt loadTime korrekt', () => {
        monitor.recordLoadTime(1234);
        assert.strictEqual(monitor.getMetrics().loadTime, 1234);
    });

    it('recordLoadTime akzeptiert 0', () => {
        monitor.recordLoadTime(0);
        assert.strictEqual(monitor.getMetrics().loadTime, 0);
    });


    // ------------------------------------------------------------------
    // Kein WebGL-Renderer erforderlich (robuste Initialisierung)
    // ------------------------------------------------------------------

    it('erstellt sich ohne Renderer ohne Fehler', () => {
        assert.doesNotThrow(() => new PerformanceMonitor(null));
    });

    it('getMetrics() funktioniert auch ohne Renderer', () => {
        const m2 = new PerformanceMonitor(null);
        assert.doesNotThrow(() => m2.getMetrics());
    });


    // ------------------------------------------------------------------
    // subscribe / notify
    // ------------------------------------------------------------------

    it('subscribe registriert einen Listener', () => {
        let called = false;
        monitor.subscribe(() => { called = true; });
        monitor.enable();
        monitor.update(1000);
        assert.ok(called);
    });

    it('unsubscribe entfernt den Listener', () => {
        let callCount = 0;
        const unsub = monitor.subscribe(() => { callCount++; });
        unsub();
        monitor.enable();
        monitor.update(1000);
        assert.strictEqual(callCount, 0);
    });


    // ------------------------------------------------------------------
    // reset
    // ------------------------------------------------------------------

    it('reset setzt loadTime auf 0', () => {
        monitor.recordLoadTime(999);
        monitor.reset();
        assert.strictEqual(monitor.getMetrics().loadTime, 0);
    });

});
