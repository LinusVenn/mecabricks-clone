// =====================================================================
// GeometryCache – Schritt 1 (Phase 8.8)
//
// Identische Bauteilgeometrien werden nur einmal erzeugt und mit einem
// Referenzzähler verwaltet. Solange mindestens ein Bauteil die Geometrie
// nutzt, bleibt sie im Cache; wird der letzte Referent entfernt, wird
// die GPU-Ressource freigegeben.
//
// WICHTIG: Gecachte Geometrien dürfen NICHT nach dem Acquire verändert
// werden, sonst würden alle Teile, die dieselbe Geometrie verwenden,
// ungewollt verändert.
// =====================================================================

export class GeometryCache {

    constructor() {
        /** @type {Map<string, { geometry: import('three').BufferGeometry, refCount: number }>} */
        this._cache = new Map();
    }

    /**
     * Gibt eine gecachte Geometrie zurück und inkrementiert den
     * Referenzzähler. Falls noch keine Geometrie für den Schlüssel
     * existiert, wird factory() aufgerufen, um sie zu erzeugen.
     * @param {string}   key
     * @param {() => import('three').BufferGeometry} factory
     * @returns {import('three').BufferGeometry}
     */
    acquire(key, factory) {
        let entry = this._cache.get(key);
        if (!entry) {
            entry = { geometry: factory(), refCount: 0 };
            this._cache.set(key, entry);
        }
        entry.refCount++;
        return entry.geometry;
    }

    /**
     * Gibt eine Referenz zurück. Ist der Zähler danach 0, wird die
     * Geometrie freigegeben.
     * @param {string} key
     */
    release(key) {
        const entry = this._cache.get(key);
        if (!entry) return;
        entry.refCount--;
        if (entry.refCount <= 0) {
            entry.geometry.dispose();
            this._cache.delete(key);
        }
    }

    /** @param {string} key @returns {boolean} */
    has(key) { return this._cache.has(key); }

    /** @param {string} key @returns {number} */
    getRefCount(key) { return this._cache.get(key)?.refCount ?? 0; }

    /** Anzahl der verschiedenen Geometrien im Cache. */
    get size() { return this._cache.size; }

    /** Gibt alle gecachten Geometrien frei und leert den Cache. */
    dispose() {
        for (const entry of this._cache.values()) {
            entry.geometry.dispose();
        }
        this._cache.clear();
    }
}
