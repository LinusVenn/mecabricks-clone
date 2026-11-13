// =====================================================================
// PerformanceMonitor – Schritt 6 (Phase 8.8)
//
// Erfasst Laufzeitkennzahlen:
//   fps, drawCalls, triangles, objects, geometries, textures,
//   materials, loadTime
//
// API:
//   monitor.enable() / disable() / setEnabled(bool)
//   monitor.update(nowMs)   – einmal pro Frame aufrufen
//   monitor.getMetrics()    – liefert aktuellen Snapshot
//   monitor.recordLoadTime(ms)
//   monitor.subscribe(fn)   – gibt unsubscribe-Funktion zurück
//   monitor.reset()
// =====================================================================

export class PerformanceMonitor {

    /**
     * @param {import('three').WebGLRenderer|null} renderer
     * @param {{ sampleWindow?: number }} [options]
     */
    constructor(renderer, { sampleWindow = 60 } = {}) {
        this._renderer     = renderer;
        this._sampleWindow = Math.max(1, sampleWindow);
        this._enabled      = false;

        this._metrics = {
            fps:        0,
            drawCalls:  0,
            triangles:  0,
            objects:    0,
            geometries: 0,
            textures:   0,
            materials:  0,
            loadTime:   0
        };

        this._lastTs     = 0;
        this._frameTimes = [];          // gleitendes Fenster der Frame-Dauer
        this._listeners  = new Set();
    }


    // ------------------------------------------------------------------
    // Aktivierung
    // ------------------------------------------------------------------

    get enabled() { return this._enabled; }

    enable()  { this._enabled = true; }

    disable() { this._enabled = false; }

    setEnabled(v) { v ? this.enable() : this.disable(); }


    // ------------------------------------------------------------------
    // Frame-Update
    // ------------------------------------------------------------------

    /**
     * Einmal pro Frame mit dem aktuellen DOMHighResTimeStamp aufrufen.
     * @param {number} nowMs
     */
    update(nowMs = 0) {
        // Renderer-Metriken immer sammeln (auch wenn disabled)
        const info = this._renderer?.info;
        if (info) {
            const render   = info.render   ?? {};
            const memory   = info.memory   ?? {};
            const programs = info.programs ?? [];
            this._metrics.drawCalls  = render.calls      ?? 0;
            this._metrics.triangles  = render.triangles  ?? 0;
            this._metrics.objects    = render.frame       ?? 0;
            this._metrics.geometries = memory.geometries ?? 0;
            this._metrics.textures   = memory.textures   ?? 0;
            this._metrics.materials  = programs.length;
        }

        // FPS immer berechnen, solange timestamps übergeben werden.
        // Der enabled-Schalter steuert nur, ob Listener benachrichtigt werden.
        if (this._lastTs > 0 && nowMs > this._lastTs) {
            const dt = nowMs - this._lastTs;
            this._frameTimes.push(dt);
            if (this._frameTimes.length > this._sampleWindow) {
                this._frameTimes.shift();
            }
            if (this._frameTimes.length > 0) {
                const avg = this._frameTimes.reduce((a, b) => a + b, 0) /
                            this._frameTimes.length;
                this._metrics.fps = avg > 0 ? Math.round(1000 / avg) : 0;
            }
        }
        this._lastTs = nowMs;

        // Listener nur benachrichtigen wenn Monitor aktiv ist
        if (!this._enabled) return;

        for (const fn of this._listeners) {
            try { fn({ ...this._metrics }); } catch { /* ignore */ }
        }
    }


    // ------------------------------------------------------------------
    // Kennzahlen
    // ------------------------------------------------------------------

    /** @returns {object} – Flacher Snapshot der aktuellen Metriken. */
    getMetrics() {
        return { ...this._metrics };
    }

    /**
     * Speichert die Ladezeit eines Modells in Millisekunden.
     * @param {number} ms
     */
    recordLoadTime(ms) {
        this._metrics.loadTime = ms;
    }


    // ------------------------------------------------------------------
    // Subscribe
    // ------------------------------------------------------------------

    /**
     * Registriert einen Listener, der bei jedem update()-Aufruf
     * (wenn enabled) die aktuellen Metriken empfängt.
     * @param {(metrics: object) => void} fn
     * @returns {() => void} – Funktion zum Abbestellen
     */
    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }


    // ------------------------------------------------------------------
    // Zurücksetzen
    // ------------------------------------------------------------------

    reset() {
        this._frameTimes = [];
        this._lastTs     = 0;
        this._metrics.fps       = 0;
        this._metrics.loadTime  = 0;
    }
}
