// =====================================================================
// MeasurementManager.js – Phase K.6 (Messwerkzeuge)
//
// Erweitert den bestehenden MeasurementManager (src/precision/MeasurementManager)
// um:
//   • measureDistance(pointA, pointB)
//   • measureAngle(vectorA, vectorB)
//   • measureBoundingBox(object)
//   • measureObjectDistance(objectA, objectB)
//   • clearMeasurements()
//   • getResults()                    – gecachte Ergebnisliste
//
// Alle Messungen sind nicht-destruktiv (verändern das Modell nicht).
// Ergebnisse werden in einem internen Cache gehalten und können
// nach Modelländerungen als "veraltet" markiert werden.
// =====================================================================


/** Abstands-Einheit in Modelleinheiten (Standard: LDraw-Stud = 1 Einheit). */
const UNIT_LABEL = 'Einheiten';


export class MeasurementManager {

    /**
     * @param {{
     *   precisionMeasurementManager: import('../precision/MeasurementManager.js').MeasurementManager
     *   library:                     import('../objects/PartLibrary.js').PartLibrary
     * }} options
     */
    constructor({ precisionMeasurementManager, library }) {
        if (!precisionMeasurementManager)
            throw new Error('MeasurementManager: precisionMeasurementManager is required.');

        this._base    = precisionMeasurementManager;
        this._lib     = library;

        /** @type {MeasurementResult[]} */
        this._results = [];

        this._stale   = false;
    }


    // ─────────────────────────────────────────────────────────────────
    // Messmethoden
    // ─────────────────────────────────────────────────────────────────

    /**
     * Misst den Abstand zwischen zwei Punkten.
     *
     * @param {{ x: number, y: number, z: number }} pointA
     * @param {{ x: number, y: number, z: number }} pointB
     * @param {{ draw?: boolean, label?: string }} [options]
     * @returns {MeasurementResult}
     */
    measureDistance(pointA, pointB, options = {}) {
        _validatePoint(pointA, 'pointA');
        _validatePoint(pointB, 'pointB');

        const result = this._base.measurePoints(pointA, pointB, options.draw ?? false);

        const entry = {
            id:       crypto.randomUUID(),
            type:     'distance',
            label:    options.label ?? 'Abstand',
            value:    result.distance,
            unit:     UNIT_LABEL,
            stale:    false,
            details:  result,
            timestamp: Date.now(),
        };

        this._results.push(entry);
        this._stale = false;
        return entry;
    }

    /**
     * Misst den Winkel zwischen zwei Richtungsvektoren.
     *
     * @param {{ x, y, z }} vectorA
     * @param {{ x, y, z }} vectorB
     * @param {{ label?: string }} [options]
     * @returns {MeasurementResult}
     */
    measureAngle(vectorA, vectorB, options = {}) {
        _validatePoint(vectorA, 'vectorA');
        _validatePoint(vectorB, 'vectorB');

        const dot  = vectorA.x * vectorB.x + vectorA.y * vectorB.y + vectorA.z * vectorB.z;
        const magA = Math.sqrt(vectorA.x ** 2 + vectorA.y ** 2 + vectorA.z ** 2);
        const magB = Math.sqrt(vectorB.x ** 2 + vectorB.y ** 2 + vectorB.z ** 2);

        if (magA === 0 || magB === 0) {
            throw new Error('MeasurementManager.measureAngle: vectors must not be zero-length.');
        }

        const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
        const radians  = Math.acos(cosAngle);
        const degrees  = radians * (180 / Math.PI);

        const entry = {
            id:        crypto.randomUUID(),
            type:      'angle',
            label:     options.label ?? 'Winkel',
            value:     degrees,
            unit:      '°',
            stale:     false,
            details:   { vectorA, vectorB, radians, degrees },
            timestamp: Date.now(),
        };

        this._results.push(entry);
        return entry;
    }

    /**
     * Misst die Bounding Box eines Bauteils.
     *
     * @param {object} brick
     * @param {{ label?: string }} [options]
     * @returns {MeasurementResult}
     */
    measureBoundingBox(brick, options = {}) {
        if (!brick) throw new Error('MeasurementManager.measureBoundingBox: brick is required.');

        const dims = this._base.getDimensions?.(brick);

        if (!dims) {
            throw new Error('MeasurementManager.measureBoundingBox: could not determine dimensions.');
        }

        const entry = {
            id:        crypto.randomUUID(),
            type:      'bounding-box',
            label:     options.label ?? `Abmessungen: ${brick.id ?? 'Bauteil'}`,
            value:     Math.max(dims.width, dims.height, dims.depth),
            unit:      UNIT_LABEL,
            stale:     false,
            details:   dims,
            timestamp: Date.now(),
        };

        this._results.push(entry);
        return entry;
    }

    /**
     * Misst den Abstand zwischen zwei Bauteilen (Oberfläche zu Oberfläche).
     *
     * @param {object} brickA
     * @param {object} brickB
     * @param {{ draw?: boolean, label?: string }} [options]
     * @returns {MeasurementResult}
     */
    measureObjectDistance(brickA, brickB, options = {}) {
        if (!brickA) throw new Error('MeasurementManager.measureObjectDistance: brickA required.');
        if (!brickB) throw new Error('MeasurementManager.measureObjectDistance: brickB required.');

        const result = this._base.measureObjects?.(brickA, brickB, options.draw ?? false);

        if (!result) {
            throw new Error('MeasurementManager.measureObjectDistance: underlying manager did not return a result.');
        }

        const entry = {
            id:        crypto.randomUUID(),
            type:      'object-distance',
            label:     options.label ?? `Abstand: ${brickA.id ?? 'A'} ↔ ${brickB.id ?? 'B'}`,
            value:     result.distance,
            unit:      UNIT_LABEL,
            stale:     false,
            details:   result,
            timestamp: Date.now(),
        };

        this._results.push(entry);
        return entry;
    }


    // ─────────────────────────────────────────────────────────────────
    // Ergebnisverwaltung
    // ─────────────────────────────────────────────────────────────────

    /**
     * Gibt alle gespeicherten Messergebnisse zurück.
     * @returns {MeasurementResult[]}
     */
    getResults() {
        return [...this._results];
    }

    /**
     * Gibt an, ob Messergebnisse veraltet sind
     * (Modell wurde nach der Messung verändert).
     * @returns {boolean}
     */
    get hasStaleResults() {
        return this._stale;
    }

    /**
     * Markiert alle Messergebnisse als veraltet.
     * Sollte nach relevanten Modelländerungen aufgerufen werden.
     */
    markStale() {
        this._stale = true;
        this._results.forEach(r => { r.stale = true; });
    }

    /**
     * Löscht alle Messergebnisse und Visual-Overlays.
     */
    clearMeasurements() {
        this._base.clear?.();
        this._results = [];
        this._stale   = false;
    }
}


// ─────────────────────────────────────────────────────────────────────
// Types (JSDoc)
// ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   id:        string
 *   type:      'distance'|'angle'|'bounding-box'|'object-distance'
 *   label:     string
 *   value:     number
 *   unit:      string
 *   stale:     boolean
 *   details:   object
 *   timestamp: number
 * }} MeasurementResult
 */


// ─────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────

function _validatePoint(p, name) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.z !== 'number') {
        throw new Error(`MeasurementManager: ${name} must be an {x, y, z} object.`);
    }
}
