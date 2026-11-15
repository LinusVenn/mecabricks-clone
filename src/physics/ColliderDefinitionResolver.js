/**
 * ColliderDefinitionResolver – Bestimmt den Collider-Typ für ein Bauteil (Phase G.2)
 *
 * Bildet Bauteil-Typen auf Collider-Definitionen ab:
 *  - geometry: 'brick'/'plate'/'tile'          → Box
 *  - geometry: 'brick_round'/'tile_round'       → Cylinder
 *  - geometry: 'technic'                        → Box (vereinfacht)
 *  - geometry: 'window'/'door'                  → Box
 *  - geometry: 'slope'                          → Box (vereinfacht, gut genug zum Stapeln)
 *  - unbekannt/LDraw                            → Box (Fallback aus Abmessungen)
 *
 * @module ColliderDefinitionResolver
 *
 * @example
 * const def = ColliderDefinitionResolver.resolve(partDef);
 * // → { shape: 'box', params: { halfX: 0.004, halfY: 0.0048, halfZ: 0.004 } }
 */

// ---------------------------------------------------------------------------
// Maßstab
// ---------------------------------------------------------------------------

/**
 * Umrechnungsfaktor von LEGO-Stud auf Meter.
 *
 * Reale LEGO-Maße:
 *  - 1 Stud = 8 mm = 0.008 m
 *
 * @type {number}
 */
const STUD_TO_METER = 0.008;

/**
 * Standard-Steinhöhe in Stud-Einheiten (1 Stud = 9.6 mm, hier vereinfacht auf 1.2).
 *
 * @type {number}
 */
const STANDARD_BRICK_HEIGHT_STUDS = 1.2;

/**
 * Standard-Plattenhöhe in Stud-Einheiten.
 *
 * @type {number}
 */
const STANDARD_PLATE_HEIGHT_STUDS = 0.4;

// ---------------------------------------------------------------------------
// Typ-Zuordnungstabelle
// ---------------------------------------------------------------------------

/**
 * Ordnet Geometrie-Bezeichner einem Collider-Formtyp zu.
 * Schlüssel werden lowercase verglichen.
 *
 * @type {Map<string, string>}
 */
const COLLIDER_TYPE_MAP = new Map([
    // Standardsteine
    ['brick',           'box'],
    ['plate',           'box'],
    ['tile',            'box'],
    ['flat',            'box'],

    // Runde Bauteile
    ['brick_round',     'cylinder'],
    ['tile_round',      'cylinder'],
    ['round',           'cylinder'],
    ['cone',            'cylinder'],
    ['dish',            'cylinder'],
    ['dome',            'sphere'],

    // Technic-Bauteile
    ['technic',         'box'],
    ['technic_pin',     'cylinder'],
    ['technic_axle',    'capsule'],
    ['technic_beam',    'box'],

    // Architektur-Elemente
    ['window',          'box'],
    ['door',            'box'],
    ['panel',           'box'],

    // Schrägsteine (vereinfacht)
    ['slope',           'box'],
    ['slope_curved',    'box'],
    ['wedge',           'box'],

    // Fahrzeugelemente
    ['wheel',           'cylinder'],
    ['tire',            'cylinder'],
    ['axle',            'capsule'],

    // Mischformen
    ['arch',            'box'],
    ['bracket',         'box'],
    ['hinge',           'box'],
    ['clip',            'box'],
    ['bar',             'capsule'],
    ['pin',             'cylinder'],

    // Fallback (explizit)
    ['unknown',         'box'],
]);

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ColliderDefinition
 * @property {'box'|'cylinder'|'capsule'|'sphere'} shape  - Collider-Form.
 * @property {BoxParams|CylinderParams|CapsuleParams|SphereParams} params - Form-Parameter.
 */

/**
 * @typedef {object} BoxParams
 * @property {number} halfX - Halbe Ausdehnung entlang X in Metern.
 * @property {number} halfY - Halbe Ausdehnung entlang Y in Metern.
 * @property {number} halfZ - Halbe Ausdehnung entlang Z in Metern.
 */

/**
 * @typedef {object} CylinderParams
 * @property {number} halfHeight - Halbe Höhe in Metern.
 * @property {number} radius     - Radius in Metern.
 */

/**
 * @typedef {object} CapsuleParams
 * @property {number} halfHeight - Halbe Höhe des zylindrischen Segments in Metern.
 * @property {number} radius     - Radius in Metern.
 */

/**
 * @typedef {object} SphereParams
 * @property {number} radius - Radius in Metern.
 */

// ---------------------------------------------------------------------------
// Hauptklasse
// ---------------------------------------------------------------------------

/**
 * Bestimmt den Collider-Typ und dessen Parameter für ein Bauteil.
 *
 * Nur statische Methoden; keine Instanz notwendig.
 */
export class ColliderDefinitionResolver {
    /**
     * @private
     * Konstruktor ist blockiert – nur statische Verwendung vorgesehen.
     */
    constructor() {
        throw new Error(
            'ColliderDefinitionResolver: Klasse ist nicht instanziierbar. ' +
            'Bitte statische Methoden verwenden.'
        );
    }

    // -----------------------------------------------------------------------
    // Öffentliche Konstanten
    // -----------------------------------------------------------------------

    /**
     * Umrechnungsfaktor 1 Stud → Meter.
     *
     * @type {number}
     */
    static get STUD_TO_METER() {
        return STUD_TO_METER;
    }

    /**
     * Unveränderliche Kopie der Geometrie→Shape-Zuordnungstabelle.
     *
     * @type {ReadonlyMap<string, string>}
     */
    static get COLLIDER_TYPE_MAP() {
        return COLLIDER_TYPE_MAP;
    }

    // -----------------------------------------------------------------------
    // Hauptmethoden
    // -----------------------------------------------------------------------

    /**
     * Bestimmt die primäre ColliderDefinition für ein Bauteil.
     *
     * Wertet zunächst `partDef.geometry`, dann `partDef.category` aus.
     * Als letzten Fallback wird eine Box aus den Abmessungen erzeugt.
     *
     * @param {object} partDef             - Bauteil-Definition aus dem PartCatalog.
     * @param {string} [partDef.geometry]  - Geometrietyp (z. B. `'brick'`, `'brick_round'`).
     * @param {string} [partDef.category]  - Bauteil-Kategorie.
     * @param {number} [partDef.width]     - Breite in Stud-Einheiten.
     * @param {number} [partDef.depth]     - Tiefe in Stud-Einheiten.
     * @param {number} [partDef.height]    - Höhe in Stud-Einheiten.
     * @returns {ColliderDefinition} Collider-Definition mit Form und Parametern.
     */
    static resolve(partDef) {
        if (!partDef || typeof partDef !== 'object') {
            return ColliderDefinitionResolver._fallbackBox(1, 1.2, 1);
        }

        const geometry = typeof partDef.geometry === 'string'
            ? partDef.geometry.toLowerCase()
            : null;
        const category = typeof partDef.category === 'string'
            ? partDef.category.toLowerCase()
            : null;

        // Shape aus Geometrie-Typ ermitteln
        const shape = (geometry && COLLIDER_TYPE_MAP.get(geometry))
            ?? (category && COLLIDER_TYPE_MAP.get(category))
            ?? 'box';

        const w = typeof partDef.width  === 'number' ? partDef.width  : 1;
        const d = typeof partDef.depth  === 'number' ? partDef.depth  : 1;
        const h = typeof partDef.height === 'number' ? partDef.height : STANDARD_BRICK_HEIGHT_STUDS;

        switch (shape) {
            case 'cylinder':
                return ColliderDefinitionResolver._cylinderDef(w, d, h);

            case 'capsule':
                return ColliderDefinitionResolver._capsuleDef(w, d, h);

            case 'sphere':
                return ColliderDefinitionResolver._sphereDef(w, d, h);

            case 'box':
            default:
                return ColliderDefinitionResolver._boxDef(w, d, h);
        }
    }

    /**
     * Gibt alle Collider-Definitionen für ein Bauteil zurück (für Compound-Collider).
     *
     * Die meisten Bauteile haben nur einen einzelnen Collider.
     * Für zukünftige komplexe Teile (z. B. Technic-Achse mit Pins) können
     * hier mehrere Definitionen zurückgegeben werden.
     *
     * @param {object} partDef - Bauteil-Definition.
     * @returns {ColliderDefinition[]} Array von Collider-Definitionen.
     */
    static resolveMultiple(partDef) {
        const primary = ColliderDefinitionResolver.resolve(partDef);

        // Compound-Collider-Logik für spezielle Typen
        const geometry = typeof partDef?.geometry === 'string'
            ? partDef.geometry.toLowerCase()
            : '';

        // Technic-Pins: Zylinder + kleine Box für Schaft
        if (geometry === 'technic_pin') {
            const w = partDef.width  ?? 1;
            const d = partDef.depth  ?? 1;
            const h = partDef.height ?? STANDARD_BRICK_HEIGHT_STUDS;
            const shaftDef = ColliderDefinitionResolver._capsuleDef(
                Math.min(w, d) * 0.3,
                Math.min(w, d) * 0.3,
                h
            );
            return [primary, shaftDef];
        }

        return [primary];
    }

    /**
     * Ermittelt die Halbausdehnungen eines Bauteils in Metern.
     *
     * @param {object} partDef          - Bauteil-Definition.
     * @param {number} [partDef.width]  - Breite in Stud.
     * @param {number} [partDef.depth]  - Tiefe in Stud.
     * @param {number} [partDef.height] - Höhe in Stud.
     * @returns {{ halfX: number, halfY: number, halfZ: number }}
     */
    static getHalfExtentsFromPartDef(partDef) {
        const w = typeof partDef?.width  === 'number' ? partDef.width  : 1;
        const d = typeof partDef?.depth  === 'number' ? partDef.depth  : 1;
        const h = typeof partDef?.height === 'number' ? partDef.height : STANDARD_BRICK_HEIGHT_STUDS;
        return {
            halfX: (w * STUD_TO_METER) / 2,
            halfY: (h * STUD_TO_METER) / 2,
            halfZ: (d * STUD_TO_METER) / 2,
        };
    }

    // -----------------------------------------------------------------------
    // Private Hilfsmethoden
    // -----------------------------------------------------------------------

    /**
     * Erzeugt eine Box-Definition.
     *
     * @private
     * @param {number} wStuds - Breite in Stud.
     * @param {number} dStuds - Tiefe in Stud.
     * @param {number} hStuds - Höhe in Stud.
     * @returns {ColliderDefinition}
     */
    static _boxDef(wStuds, dStuds, hStuds) {
        return {
            shape: 'box',
            params: {
                halfX: (wStuds * STUD_TO_METER) / 2,
                halfY: (hStuds * STUD_TO_METER) / 2,
                halfZ: (dStuds * STUD_TO_METER) / 2,
            },
        };
    }

    /**
     * Erzeugt eine Fallback-Box-Definition mit expliziten Stud-Werten.
     *
     * @private
     * @param {number} w - Breite in Stud.
     * @param {number} h - Höhe in Stud.
     * @param {number} d - Tiefe in Stud.
     * @returns {ColliderDefinition}
     */
    static _fallbackBox(w, h, d) {
        return ColliderDefinitionResolver._boxDef(w, d, h);
    }

    /**
     * Erzeugt eine Zylinder-Definition.
     *
     * Radius = Hälfte der kleineren Grundflächen-Ausdehnung.
     *
     * @private
     * @param {number} wStuds - Breite in Stud.
     * @param {number} dStuds - Tiefe in Stud.
     * @param {number} hStuds - Höhe in Stud.
     * @returns {ColliderDefinition}
     */
    static _cylinderDef(wStuds, dStuds, hStuds) {
        const radius = (Math.min(wStuds, dStuds) * STUD_TO_METER) / 2;
        return {
            shape: 'cylinder',
            params: {
                halfHeight: (hStuds * STUD_TO_METER) / 2,
                radius,
            },
        };
    }

    /**
     * Erzeugt eine Kapsel-Definition.
     *
     * @private
     * @param {number} wStuds - Breite in Stud.
     * @param {number} dStuds - Tiefe in Stud.
     * @param {number} hStuds - Höhe in Stud.
     * @returns {ColliderDefinition}
     */
    static _capsuleDef(wStuds, dStuds, hStuds) {
        const radius = (Math.min(wStuds, dStuds) * STUD_TO_METER) / 2;
        // halfHeight des zylindrischen Schafts = gesamte Hälfte minus Radius
        const halfHeight = Math.max(0, (hStuds * STUD_TO_METER) / 2 - radius);
        return {
            shape: 'capsule',
            params: { halfHeight, radius },
        };
    }

    /**
     * Erzeugt eine Kugel-Definition.
     *
     * @private
     * @param {number} wStuds - Breite in Stud.
     * @param {number} dStuds - Tiefe in Stud.
     * @param {number} hStuds - Höhe in Stud.
     * @returns {ColliderDefinition}
     */
    static _sphereDef(wStuds, dStuds, hStuds) {
        const radius = (Math.min(wStuds, dStuds, hStuds) * STUD_TO_METER) / 2;
        return {
            shape: 'sphere',
            params: { radius },
        };
    }
}
