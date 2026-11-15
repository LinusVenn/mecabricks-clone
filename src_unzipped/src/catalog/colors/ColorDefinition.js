/**
 * ColorDefinition – Einzelne Farbdefinition (Phase E.3)
 *
 * Kapselt alle Eigenschaften einer Farbe:
 *  - LDraw-kompatible ID
 *  - Anzeigename (Englisch und Deutsch)
 *  - CSS-Hex-Wert und numerischer Hex-Wert
 *  - Three.js-Materialeigenschaften (Rauheit, Metalness, Transparenz)
 *  - Zugehörige Farbfamilie (z. B. 'red', 'blue', 'transparent')
 *
 * Unveränderlich (immutable) nach der Erstellung – alle Eigenschaften
 * sind nur über Getter zugänglich.
 */

// ─── Standardmaterial-Eigenschaften ──────────────────────────────────────────

/**
 * Standardwerte für das Plastik-Material.
 * Wird verwendet, wenn keine spezifischen Materialeigenschaften angegeben werden.
 * @type {{ type: string, roughness: number, metalness: number, transparent: boolean, opacity: number }}
 */
const DEFAULT_MATERIAL = Object.freeze({
    type:        'plastic',
    roughness:   0.65,
    metalness:   0.0,
    transparent: false,
    opacity:     1.0,
});

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Konvertiert einen CSS-Hex-String (z. B. '#C91A09') in eine Ganzzahl
 * (z. B. 0xC91A09). Unterstützt sowohl sechsstellige als auch dreistellige
 * Kurzschreibweisen. Gibt 0 zurück, wenn der String ungültig ist.
 *
 * @param {string} hex - CSS-Hex-String mit oder ohne führendes '#'
 * @returns {number} Numerischer Farbwert
 */
function hexStringToNumber(hex) {
    if (typeof hex !== 'string') return 0;

    // Führendes '#' entfernen
    const clean = hex.replace(/^#/, '');

    // Kurzschreibweise '#RGB' → '#RRGGBB' expandieren
    const expanded = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;

    const value = parseInt(expanded, 16);
    return Number.isNaN(value) ? 0 : value;
}

/**
 * Normalisiert einen Hex-String auf das Format '#RRGGBB' (Großbuchstaben).
 *
 * @param {string} hex - Eingabe-Hex-String
 * @returns {string} Normalisierter Hex-String
 */
function normalizeHex(hex) {
    if (typeof hex !== 'string') return '#000000';
    const clean = hex.replace(/^#/, '').toUpperCase();
    const expanded = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;
    return `#${expanded}`;
}

// ─── Hauptklasse ──────────────────────────────────────────────────────────────

export class ColorDefinition {

    // ─── Statische Konstante ─────────────────────────────────────────────────

    /**
     * Standardmaterial-Eigenschaften für normale Plastikfarben.
     * Kann als Basis für neue Materialien verwendet werden.
     *
     * @type {{ type: string, roughness: number, metalness: number, transparent: boolean, opacity: number }}
     */
    static get DEFAULT_MATERIAL() {
        return DEFAULT_MATERIAL;
    }

    // ─── Konstruktor ─────────────────────────────────────────────────────────

    /**
     * Erstellt eine neue Farbdefinition.
     *
     * @param {{
     *   id:            number,   // LDraw-Farb-ID (z. B. 4 für Rot)
     *   name:          string,   // Englischer Standardname (z. B. 'Red')
     *   displayName:   string,   // Lokalisierter Anzeigename (z. B. 'Rot')
     *   hex:           string,   // CSS-Hex-Farbe: '#RRGGBB'
     *   family:        string,   // Farbfamilie (z. B. 'red', 'blue', 'transparent')
     *   ldrawColorId?: number,   // Explizite LDraw-ID (Standard: identisch mit id)
     *   material?:     object,   // Überschreibungen für Materialeigenschaften
     * }} definition - Rohdaten der Farbdefinition
     *
     * @throws {TypeError} Wenn id keine Zahl oder hex kein String ist
     * @throws {RangeError} Wenn id negativ ist
     */
    constructor(definition) {
        // ── Pflichtfelder validieren ────────────────────────────────────────
        if (definition == null || typeof definition !== 'object') {
            throw new TypeError('ColorDefinition: definition muss ein Objekt sein.');
        }
        if (typeof definition.id !== 'number' || !Number.isFinite(definition.id)) {
            throw new TypeError(`ColorDefinition: id muss eine endliche Zahl sein (erhalten: ${definition.id}).`);
        }
        if (definition.id < 0) {
            throw new RangeError(`ColorDefinition: id darf nicht negativ sein (erhalten: ${definition.id}).`);
        }
        if (typeof definition.hex !== 'string') {
            throw new TypeError(`ColorDefinition: hex muss ein String sein (erhalten: ${typeof definition.hex}).`);
        }

        // ── Interne (private) Felder befüllen ───────────────────────────────
        // Konvention: _prefixed für private, unveränderliche Instanzfelder
        this._id          = definition.id;
        this._name        = typeof definition.name        === 'string' ? definition.name        : String(definition.id);
        this._displayName = typeof definition.displayName === 'string' ? definition.displayName : this._name;
        this._hex         = normalizeHex(definition.hex);
        this._hexNumber   = hexStringToNumber(definition.hex);
        this._family      = typeof definition.family      === 'string' ? definition.family      : 'unknown';

        // ldrawColorId: Expliziter Wert hat Vorrang, sonst identisch mit id
        this._ldrawColorId = typeof definition.ldrawColorId === 'number'
            ? definition.ldrawColorId
            : this._id;

        // Material: Standardwerte mit übergebenen Werten zusammenführen (merge)
        this._material = Object.freeze(
            Object.assign({}, DEFAULT_MATERIAL, definition.material ?? {})
        );

        // Gesamtes Objekt einfrieren, um Mutationen zu verhindern
        Object.freeze(this);
    }

    // ─── Getter ───────────────────────────────────────────────────────────────

    /**
     * LDraw-Farb-ID (eindeutig innerhalb einer Palette).
     * Beispiel: 4 für Rot, 15 für Weiß.
     * @returns {number}
     */
    get id() {
        return this._id;
    }

    /**
     * Englischer Standardname der Farbe gemäß LDraw-Spezifikation.
     * Beispiel: 'Red', 'Bright Green'
     * @returns {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Lokalisierter Anzeigename (Deutsch).
     * Beispiel: 'Rot', 'Leuchtend Grün'
     * @returns {string}
     */
    get displayName() {
        return this._displayName;
    }

    /**
     * CSS-Hex-Farbwert im Format '#RRGGBB' (normalisiert, Großbuchstaben).
     * Beispiel: '#C91A09'
     * @returns {string}
     */
    get hex() {
        return this._hex;
    }

    /**
     * Hex-Farbwert als Ganzzahl – direkt verwendbar als Three.js-Farbe.
     * Beispiel: 0xC91A09
     * @returns {number}
     */
    get hexNumber() {
        return this._hexNumber;
    }

    /**
     * Farbfamilie – für Gruppierung und Filterung in der UI.
     * Mögliche Werte: 'white', 'gray', 'dark', 'red', 'orange', 'yellow',
     *                 'green', 'blue', 'purple', 'pink', 'brown',
     *                 'transparent', 'metallic'
     * @returns {string}
     */
    get family() {
        return this._family;
    }

    /**
     * Explizite LDraw-Farb-ID.
     * Entspricht in der Regel id, kann aber abweichen (z. B. bei Aliasen).
     * @returns {number}
     */
    get ldrawColorId() {
        return this._ldrawColorId;
    }

    /**
     * Gibt an, ob diese Farbe transparent ist.
     * Leitet sich aus material.transparent ab.
     * @returns {boolean}
     */
    get isTransparent() {
        return this._material.transparent === true;
    }

    /**
     * Gibt an, ob diese Farbe metallisch ist (Metalness ≥ 0.5).
     * Gilt für Chrome-, Perlmutt- und Metallic-Materialien.
     * @returns {boolean}
     */
    get isMetallic() {
        return (this._material.metalness ?? 0) >= 0.5;
    }

    /**
     * Materialeigenschaften für Three.js-Renderer.
     * Eingefriertes Objekt – Änderungen haben keine Auswirkung.
     *
     * @returns {{ type: string, roughness: number, metalness: number, transparent: boolean, opacity: number }}
     */
    get material() {
        return this._material;
    }

    // ─── Serialisierung ───────────────────────────────────────────────────────

    /**
     * Gibt alle Eigenschaften als einfaches, serialisierbares Objekt zurück.
     * Kann direkt in JSON.stringify() verwendet werden.
     *
     * @returns {{
     *   id: number,
     *   name: string,
     *   displayName: string,
     *   hex: string,
     *   family: string,
     *   ldrawColorId: number,
     *   material: object
     * }}
     */
    toData() {
        return {
            id:           this._id,
            name:         this._name,
            displayName:  this._displayName,
            hex:          this._hex,
            family:       this._family,
            ldrawColorId: this._ldrawColorId,
            // Material als normales (nicht eingefrorenes) Objekt zurückgeben
            material: { ...this._material },
        };
    }

    /**
     * Erstellt eine neue ColorDefinition aus einem einfachen Datenobjekt.
     * Umgekehrte Operation zu toData().
     *
     * @param {object} obj - Rohdaten (z. B. aus JSON.parse())
     * @returns {ColorDefinition}
     * @throws {TypeError} Wenn obj kein Objekt ist
     */
    static fromData(obj) {
        return new ColorDefinition(obj);
    }

    // ─── Debug-Hilfe ──────────────────────────────────────────────────────────

    /**
     * Gibt eine lesbare Darstellung für Konsolenausgaben zurück.
     * @returns {string}
     */
    toString() {
        return `ColorDefinition(id=${this._id}, name="${this._name}", hex="${this._hex}", family="${this._family}")`;
    }
}
