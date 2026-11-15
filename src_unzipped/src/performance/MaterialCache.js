// =====================================================================
// MaterialCache – Schritt 1 (Phase 8.8)
//
// Gemeinsame Materialien für identische Farben.
//
// SICHERHEITSHINWEIS: Gecachte Materialien sind GETEILT.
// Eine Farbänderung an einem einzelnen Bauteil darf NICHT über
// das gecachte Material erfolgen – das würde alle Bauteile mit
// derselben Farbe betreffen. Stattdessen:
//
//   materialCache.release(oldColor);
//   mesh.material = materialCache.acquire(newColor);
//
// Testbarkeit: Der Konstruktor akzeptiert eine optionale
// `materialFactory(color)` Funktion. Ohne diese Factory wird
// THREE.MeshStandardMaterial verwendet.
// =====================================================================

import * as THREE from 'three';

export class MaterialCache {

    /**
     * @param {((color: number) => object) | null} [materialFactory]
     *   Optionale Factory für die Erzeugung von Materialien.
     *   Standard: new THREE.MeshStandardMaterial({ color })
     */
    constructor(materialFactory = null) {
        this._factory = materialFactory ??
            (color => new THREE.MeshStandardMaterial({ color }));

        /** @type {Map<string, { material: object, refCount: number }>} */
        this._cache = new Map();
    }


    /**
     * Gibt ein gecachtes Material zurück und inkrementiert den
     * Referenzzähler. Bei Cache-Miss wird über die Factory ein neues
     * Material erzeugt.
     * @param {number} color
     * @returns {object}
     */
    acquire(color) {
        const key = String(color);
        let entry = this._cache.get(key);
        if (!entry) {
            const material = this._factory(color);
            entry = { material, refCount: 0 };
            this._cache.set(key, entry);
        }
        entry.refCount++;
        return entry.material;
    }


    /**
     * Gibt eine Referenz zurück. Ist der Zähler danach 0, wird das
     * Material freigegeben.
     * @param {number} color
     */
    release(color) {
        const key   = String(color);
        const entry = this._cache.get(key);
        if (!entry) return;
        entry.refCount--;
        if (entry.refCount <= 0) {
            entry.material.dispose?.();
            this._cache.delete(key);
        }
    }


    /** @param {number} color @returns {boolean} */
    has(color) { return this._cache.has(String(color)); }

    /** @param {number} color @returns {number} */
    getRefCount(color) {
        return this._cache.get(String(color))?.refCount ?? 0;
    }

    get size() { return this._cache.size; }


    /** Gibt alle gecachten Materialien frei. */
    dispose() {
        for (const entry of this._cache.values()) {
            entry.material.dispose?.();
        }
        this._cache.clear();
    }
}
