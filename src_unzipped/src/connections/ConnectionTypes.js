/**
 * ConnectionTypes – Verbindungstypen-Enum und Hilfsfunktionen (Phase F)
 *
 * Definiert alle unterstützten mechanischen Verbindungstypen.
 * Ersetzt den bisherigen freien String 'stud-to-bottom'.
 *
 * Konventionen:
 *  - Jeder Typ ist ein lowercased kebab-case-String.
 *  - Kompatibilität wird immer paarweise (STUD ↔ ANTI_STUD) geprüft.
 *  - STUD_TO_BOTTOM ist ein Legacy-Alias und wird auf ['stud','anti-stud']
 *    abgebildet.
 */

// ---------------------------------------------------------------------------
// Enum-Objekt (eingefroren → schreibgeschützt)
// ---------------------------------------------------------------------------

/** @type {Readonly<Record<string, string>>} */
export const CONNECTION_TYPES = Object.freeze({
    /** Klassische Noppe (oben) – der „männliche" Stud */
    STUD:           'stud',

    /** Röhre / Buchse (unten) – der „weibliche" Anti-Stud */
    ANTI_STUD:      'anti-stud',

    /** Rundes Technic-Loch – nimmt Pins und Achsen auf */
    TECHNIC_HOLE:   'technic-hole',

    /** Kreuzloch für Achsen (LEGO Technic cross-axle hole) */
    AXLE_HOLE:      'axle-hole',

    /** Pin-Loch (rund, kein Kreuz, für Stiftverbindungen) */
    PIN_HOLE:       'pin-hole',

    /** Klemme (z. B. Minifiguren-Hände, Barhalter) */
    CLIP:           'clip',

    /** Stab / Bar (z. B. für Klemmen) */
    BAR:            'bar',

    /** Scharnier – männliche Seite */
    HINGE_MALE:     'hinge-male',

    /** Scharnier – weibliche Seite */
    HINGE_FEMALE:   'hinge-female',

    /** Kugelgelenk-Stecker */
    BALL:           'ball',

    /** Kugelgelenk-Buchse */
    BALL_SOCKET:    'ball-socket',

    /** Zahnrad-Eingriff */
    GEAR:           'gear',

    /**
     * Legacy-Alias für den alten freien String 'stud-to-bottom'.
     * Wird durch {@link getLegacyType} auf ['stud', 'anti-stud'] aufgelöst.
     */
    STUD_TO_BOTTOM: 'stud-to-bottom',
});

// ---------------------------------------------------------------------------
// Nachschlage-Set (für O(1)-Validierung)
// ---------------------------------------------------------------------------

/** @type {ReadonlySet<string>} */
const _TYPE_SET = new Set(Object.values(CONNECTION_TYPES));

// ---------------------------------------------------------------------------
// Sortierte Liste aller Typ-Strings
// ---------------------------------------------------------------------------

/**
 * Alphabetisch sortierte Liste aller Verbindungstyp-Werte.
 * @type {readonly string[]}
 */
export const CONNECTION_TYPE_LIST = Object.freeze(
    [..._TYPE_SET].sort()
);

// ---------------------------------------------------------------------------
// Legacy-Mapping
// ---------------------------------------------------------------------------

/**
 * Bildet bekannte Legacy-Strings auf einen oder mehrere moderne Typen ab.
 *
 * @type {Readonly<Record<string, readonly string[]>>}
 */
const _LEGACY_MAP = Object.freeze({
    'stud-to-bottom': Object.freeze([CONNECTION_TYPES.STUD, CONNECTION_TYPES.ANTI_STUD]),
});

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Prüft, ob `type` ein gültiger CONNECTION_TYPES-Wert ist.
 *
 * @param {unknown} type
 * @returns {boolean}
 *
 * @example
 * isValidConnectionType('stud')          // true
 * isValidConnectionType('stud-to-bottom') // true  (legacy alias)
 * isValidConnectionType('banana')         // false
 */
export function isValidConnectionType(type) {
    return typeof type === 'string' && _TYPE_SET.has(type);
}

/**
 * Gibt die modernen Typ(en) zurück, die einem Legacy-String entsprechen.
 *
 * Gibt bei unbekannten Eingaben eine leere Liste zurück, damit Aufrufer
 * sicher iterieren können ohne vorab auf null zu prüfen.
 *
 * @param {string} legacyString
 * @returns {readonly string[]}
 *
 * @example
 * getLegacyType('stud-to-bottom')
 * // → ['stud', 'anti-stud']
 *
 * getLegacyType('unknown')
 * // → []
 */
export function getLegacyType(legacyString) {
    return _LEGACY_MAP[legacyString] ?? Object.freeze([]);
}
