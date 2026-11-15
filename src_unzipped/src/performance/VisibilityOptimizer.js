// =====================================================================
// VisibilityOptimizer – Schritt 3 (Phase 8.8)
//
// Bauteile außerhalb des Kamerasichtfeldes werden pro Frame via
// THREE.Frustum getestet und temporär verborgen, um Render-Arbeit
// zu sparen.
//
// Entwurfsentscheidungen
// ──────────────────────
// • brick.group.visible wird NICHT direkt modifiziert, wenn es bereits
//   false ist (Isolation / Outliner haben Vorrang).
// • _culledBricks speichert, welche Bauteil-IDs DURCH diesen Optimizer
//   versteckt wurden; nur diese werden beim nächsten Frame restauriert.
// • excludedIds (z. B. aktuell ausgewählte Bauteile) werden nie culled.
//
// Anforderungserfüllung
// ─────────────────────
//   ✓ Bauteile außerhalb des Sichtfeldes nicht rendern
//   ✓ Isolation-/Outliner-Sichtbarkeit bleibt unangetastet
//   ✓ Sichtbarkeit ≠ Modellzustand
//   ✓ Ausgewählte Objekte bleiben sichtbar
//   ✓ Einzeln deaktivierbar
// =====================================================================

import * as THREE from 'three';

export class VisibilityOptimizer {

    /**
     * @param {THREE.Camera|null}  camera   – Kamera für Frustum-Tests
     *                                        (darf null sein; dann kein Culling)
     * @param {import('../objects/PartLibrary.js').PartLibrary} library
     * @param {{ margin?: number }} [options]
     */
    constructor(camera, library, { margin = 0 } = {}) {
        this._camera   = camera;
        this._library  = library;
        this._margin   = margin;
        this._enabled  = false;

        /**
         * Bauteile, die NUR durch diesen Optimizer versteckt wurden.
         * Map<brickId, brick> – speichert die Referenz direkt, ohne
         * erneuten Bibliotheks-Lookup.
         * @type {Map<string, object>}
         */
        this._culledBricks = new Map();

        /**
         * Bauteil-IDs, die NICHT gecull't werden dürfen
         * (z. B. aktuell ausgewählte Bauteile).
         * @type {Set<string>}
         */
        this._excludedIds = new Set();

        this._frustum    = new THREE.Frustum();
        this._projMatrix = new THREE.Matrix4();
        this._box        = new THREE.Box3();
    }


    get enabled() { return this._enabled; }

    enable()  { this._enabled = true; }

    disable() {
        if (!this._enabled) return;
        this._restoreAll();
        this._enabled = false;
    }

    setEnabled(v) { v ? this.enable() : this.disable(); }

    /**
     * Setzt die Menge der Bauteil-IDs, die NIE gecull't werden.
     * @param {Set<string>} ids
     */
    setExcludedIds(ids) {
        this._excludedIds = ids instanceof Set ? ids : new Set(ids);
        // Zuvor gecull'te Bauteile in der neuen Ausschlussmenge sofort zeigen.
        for (const id of this._excludedIds) {
            const culled = this._culledBricks.get(id);
            if (culled) {
                this._showBrick(culled);
                this._culledBricks.delete(id);
            }
        }
    }

    /**
     * Gibt an, ob ein Bauteil aktuell durch diesen Optimizer
     * ausgeblendet ist.
     * @param {string} brickId
     * @returns {boolean}
     */
    isCulled(brickId) { return this._culledBricks.has(brickId); }

    /** Anzahl aktuell gecull'ter Bauteile. */
    get culledCount() { return this._culledBricks.size; }


    /**
     * Muss einmal pro Frame VOR dem Rendern aufgerufen werden.
     * @param {THREE.Camera} [camera] – optional; überschreibt die
     *   Constructor-Kamera für diesen Frame.
     */
    update(camera = this._camera) {
        if (!this._enabled || !camera) return;

        camera.updateMatrixWorld();
        this._projMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        this._frustum.setFromProjectionMatrix(this._projMatrix);

        // 1. Zuvor gecull'te Bauteile zurücksetzen
        for (const brick of this._culledBricks.values()) {
            this._showBrick(brick);
        }
        this._culledBricks.clear();

        // 2. Alle sichtbaren Bauteile gegen Frustum testen
        for (const brick of this._library.getAll()) {
            if (!brick.group.visible)          continue; // schon von außen verborgen
            if (this._excludedIds.has(brick.id)) continue; // ausgeschlossen

            this._box.setFromObject(brick.group);
            if (this._box.isEmpty()) continue;

            if (!this._frustum.intersectsBox(this._box)) {
                this._hideBrick(brick);
            }
        }
    }


    // ------------------------------------------------------------------
    // Hilfsmethoden
    // ------------------------------------------------------------------

    _hideBrick(brick) {
        brick.group.visible = false;
        this._culledBricks.set(brick.id, brick);
    }

    _showBrick(brick) {
        brick.group.visible = true;
    }

    _restoreAll() {
        for (const brick of this._culledBricks.values()) {
            this._showBrick(brick);
        }
        this._culledBricks.clear();
    }

    dispose() {
        this.disable();
    }
}
