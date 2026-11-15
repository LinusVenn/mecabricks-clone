/**
 * ConnectionPoint – Definiert einen einzelnen Verbindungspunkt (Phase F.2)
 *
 * Kapselt Position (lokal zum Bauteil), Ausrichtung, Typ und Eigenschaften
 * eines Verbindungspunktes.
 *
 * Lokales Koordinatensystem des Bauteils:
 *  - Ursprung: Unterkante Mitte (Basis des Bauteils)
 *  - X-Achse:  Breite  (1 Einheit = 1 Noppenpitch ≈ 8 mm real)
 *  - Z-Achse:  Tiefe   (1 Einheit = 1 Noppenpitch ≈ 8 mm real)
 *  - Y-Achse:  Höhe    (1 Einheit = BRICK_HEIGHT oder PLATE_HEIGHT)
 *
 * Richtungsvektoren sollten normalisiert übergeben werden.  Die Klasse
 * normalisiert bei Bedarf, falls der übergebene Vektor eine Länge ≠ 1 hat.
 */

import { CONNECTION_TYPES, isValidConnectionType } from './ConnectionTypes.js';

// ---------------------------------------------------------------------------
// Interne Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Normalisiert einen 3D-Vektor in-place und gibt ihn zurück.
 * Bei Nullvektor wird (0,1,0) (aufwärts) als Fallback verwendet.
 *
 * @param {{x:number,y:number,z:number}} v
 * @returns {{x:number,y:number,z:number}}
 */
function normalizeVec3(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 1e-9) return { x: 0, y: 1, z: 0 };   // Fallback: aufwärts
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Rotiert einen 3D-Vektor anhand von Euler-Winkeln (XYZ-Reihenfolge, Bogen).
 *
 * Vereinfachte Euler-Rotation – ausreichend für achsenparallele Ausrichtungen.
 * Für komplexe Rotationen sollte später auf Quaternionen umgestellt werden.
 *
 * @param {{x:number,y:number,z:number}} v
 * @param {{x:number,y:number,z:number}} rotation  Euler-Winkel in Bogenmaß
 * @returns {{x:number,y:number,z:number}}
 */
function rotateVec3(v, rotation) {
    const { x: rx, y: ry, z: rz } = rotation;

    // Rotation um X
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    let y1 = v.y * cosX - v.z * sinX;
    let z1 = v.y * sinX + v.z * cosX;

    // Rotation um Y
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    let x2 = v.x * cosY + z1 * sinY;
    let z2 = -v.x * sinY + z1 * cosY;

    // Rotation um Z
    const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
    let x3 = x2 * cosZ - y1 * sinZ;
    let y3 = x2 * sinZ + y1 * cosZ;

    return { x: x3, y: y3, z: z2 };
}

// ---------------------------------------------------------------------------
// Kompatibilitäts-Hilfstabelle (wird einmalig aufgebaut)
// ---------------------------------------------------------------------------

/**
 * Definiert, welche Typ-Paare miteinander kompatibel sind.
 * Jedes Paar [A, B] bedeutet: A passt in B und B passt in A.
 *
 * @type {Array<[string, string]>}
 */
const _COMPAT_PAIRS = [
    [CONNECTION_TYPES.STUD,        CONNECTION_TYPES.ANTI_STUD],
    [CONNECTION_TYPES.TECHNIC_HOLE, CONNECTION_TYPES.PIN_HOLE],   // Pins in Technic-Löcher
    [CONNECTION_TYPES.AXLE_HOLE,   CONNECTION_TYPES.TECHNIC_HOLE],
    [CONNECTION_TYPES.CLIP,        CONNECTION_TYPES.BAR],
    [CONNECTION_TYPES.HINGE_MALE,  CONNECTION_TYPES.HINGE_FEMALE],
    [CONNECTION_TYPES.BALL,        CONNECTION_TYPES.BALL_SOCKET],
];

/** Map von Typ → Set kompatibler Typen */
const _COMPAT_MAP = new Map();
for (const [a, b] of _COMPAT_PAIRS) {
    if (!_COMPAT_MAP.has(a)) _COMPAT_MAP.set(a, new Set());
    if (!_COMPAT_MAP.has(b)) _COMPAT_MAP.set(b, new Set());
    _COMPAT_MAP.get(a).add(b);
    _COMPAT_MAP.get(b).add(a);
}

// ---------------------------------------------------------------------------
// Klasse ConnectionPoint
// ---------------------------------------------------------------------------

export class ConnectionPoint {
    /**
     * Erstellt einen Verbindungspunkt.
     *
     * @param {{
     *   id:            string,
     *   partId:        string,
     *   type:          string,
     *   localPosition: {x:number, y:number, z:number},
     *   direction:     {x:number, y:number, z:number},
     *   properties?:   object
     * }} def
     *
     * @throws {TypeError}  Falls Pflichtfelder fehlen oder Typen falsch sind.
     * @throws {RangeError} Falls `type` kein gültiger CONNECTION_TYPES-Wert ist.
     */
    constructor(def) {
        // ── Validierung ─────────────────────────────────────────────────────
        if (!def || typeof def !== 'object') {
            throw new TypeError('ConnectionPoint: def muss ein Objekt sein.');
        }

        const { id, partId, type, localPosition, direction, properties = {} } = def;

        if (typeof id !== 'string' || id.trim() === '') {
            throw new TypeError('ConnectionPoint: id muss ein nicht-leerer String sein.');
        }
        if (typeof partId !== 'string' || partId.trim() === '') {
            throw new TypeError('ConnectionPoint: partId muss ein nicht-leerer String sein.');
        }
        if (!isValidConnectionType(type)) {
            throw new RangeError(
                `ConnectionPoint: unbekannter Verbindungstyp "${type}". ` +
                `Erlaubte Typen: ${Object.values(CONNECTION_TYPES).join(', ')}.`
            );
        }
        if (!localPosition || typeof localPosition !== 'object') {
            throw new TypeError('ConnectionPoint: localPosition muss ein {x,y,z}-Objekt sein.');
        }
        if (!direction || typeof direction !== 'object') {
            throw new TypeError('ConnectionPoint: direction muss ein {x,y,z}-Objekt sein.');
        }

        // ── Interne Felder (privat durch Namenskonvention) ───────────────────
        /** @type {string} */
        this._id = id;

        /** @type {string} */
        this._partId = partId;

        /** @type {string} */
        this._type = type;

        /** @type {{x:number,y:number,z:number}} */
        this._localPosition = Object.freeze({
            x: Number(localPosition.x) || 0,
            y: Number(localPosition.y) || 0,
            z: Number(localPosition.z) || 0,
        });

        /** @type {{x:number,y:number,z:number}} – normalisiert */
        this._direction = Object.freeze(
            normalizeVec3({
                x: Number(direction.x) || 0,
                y: Number(direction.y) || 0,
                z: Number(direction.z) || 0,
            })
        );

        /** @type {object} */
        this._properties = Object.freeze({ ...properties });
    }

    // ── Getter ───────────────────────────────────────────────────────────────

    /** Eindeutige ID dieses Verbindungspunktes (innerhalb des Bauteils). */
    get id()            { return this._id; }

    /** ID des Bauteil-Typs (partId) zu dem dieser Punkt gehört. */
    get partId()        { return this._partId; }

    /** Verbindungstyp (einer der CONNECTION_TYPES-Werte). */
    get type()          { return this._type; }

    /** Lokale Position relativ zur Bauteilbasis (Unterkante Mitte). */
    get localPosition() { return this._localPosition; }

    /**
     * Normalisierter Richtungsvektor.
     * Studs zeigen nach oben  (0,+1, 0),
     * Anti-Studs nach unten   (0,−1, 0),
     * Technic-Löcher in Z     (0, 0,±1).
     */
    get direction()     { return this._direction; }

    /** Optionale Metadaten (bauteilspezifisch). */
    get properties()    { return this._properties; }

    // ── Typ-Abfragen ─────────────────────────────────────────────────────────

    /** `true` wenn es sich um einen klassischen Stud (Noppe oben) handelt. */
    isStud() {
        return this._type === CONNECTION_TYPES.STUD;
    }

    /** `true` wenn es sich um einen Anti-Stud (Buchse unten) handelt. */
    isAntiStud() {
        return this._type === CONNECTION_TYPES.ANTI_STUD;
    }

    /**
     * `true` wenn der Punkt ein Technic-Loch-Typ ist
     * (TECHNIC_HOLE, AXLE_HOLE oder PIN_HOLE).
     */
    isTechnic() {
        return (
            this._type === CONNECTION_TYPES.TECHNIC_HOLE ||
            this._type === CONNECTION_TYPES.AXLE_HOLE    ||
            this._type === CONNECTION_TYPES.PIN_HOLE
        );
    }

    // ── Raumtransformation ───────────────────────────────────────────────────

    /**
     * Berechnet die Weltposition dieses Verbindungspunktes anhand des
     * aktuellen Transforms des Bauteils.
     *
     * Rotationen werden als Euler-Winkel (XYZ) in Bogenmaß erwartet.
     * Wenn keine Rotation angegeben, wird (0,0,0) verwendet.
     *
     * @param {{
     *   position: {x:number, y:number, z:number},
     *   rotation?: {x:number, y:number, z:number}
     * }} partTransform  Aktueller Transform der Bauteilinstanz in Weltkoord.
     *
     * @returns {{x:number, y:number, z:number}}  Weltposition des Punktes.
     */
    worldPosition(partTransform) {
        const { position, rotation = { x: 0, y: 0, z: 0 } } = partTransform;

        // Lokale Position um die Bauteil-Rotation drehen
        const rotated = rotateVec3(this._localPosition, rotation);

        return {
            x: position.x + rotated.x,
            y: position.y + rotated.y,
            z: position.z + rotated.z,
        };
    }

    // ── Kompatibilitätsprüfung ───────────────────────────────────────────────

    /**
     * Schnelle Typkompatibilitätsprüfung ohne Berücksichtigung von
     * Ausrichtung oder Abstand (diese Prüfungen sind Aufgabe des
     * PlacementManagers / SnappingSystem).
     *
     * Zwei Punkte sind kompatibel, wenn ihre Typen ein gültiges Paar
     * bilden (z. B. stud ↔ anti-stud).
     *
     * @param {ConnectionPoint} otherPoint
     * @returns {boolean}
     */
    isCompatibleWith(otherPoint) {
        if (!(otherPoint instanceof ConnectionPoint)) return false;

        const compatSet = _COMPAT_MAP.get(this._type);
        if (!compatSet) return false;

        return compatSet.has(otherPoint.type);
    }

    // ── Serialisierung ───────────────────────────────────────────────────────

    /**
     * Serialisiert den Verbindungspunkt in ein reines Datenobjekt.
     * Kann für JSON-Serialisierung verwendet werden.
     *
     * @returns {{
     *   id: string,
     *   partId: string,
     *   type: string,
     *   localPosition: {x:number,y:number,z:number},
     *   direction: {x:number,y:number,z:number},
     *   properties: object
     * }}
     */
    toData() {
        return {
            id:            this._id,
            partId:        this._partId,
            type:          this._type,
            localPosition: { ...this._localPosition },
            direction:     { ...this._direction },
            properties:    { ...this._properties },
        };
    }

    /**
     * Erstellt einen ConnectionPoint aus einem serialisierten Datenobjekt.
     *
     * @param {object} data  Objekt wie es von {@link toData} zurückgegeben wird.
     * @returns {ConnectionPoint}
     */
    static fromData(data) {
        return new ConnectionPoint(data);
    }

    // ── Debugging ────────────────────────────────────────────────────────────

    toString() {
        const { x, y, z } = this._localPosition;
        return `ConnectionPoint(${this._id} | ${this._type} @ [${x},${y},${z}])`;
    }
}
