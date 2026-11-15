/**
 * ColorManager – Hauptklasse für die Farbverwaltung (Phase E.3)
 *
 * Verwaltet die aktive Farbpalette und ermöglicht:
 *  - Farben nach ID, Name und Hex-Wert suchen
 *  - Standard-LEGO-Farben laden (aus lego-colors.json)
 *  - Farben für die UI bereitstellen (alle Farben, nach Familie gefiltert)
 *  - Zwischen LDraw-Farb-IDs und Hex-Werten konvertieren
 *
 * Singleton-fähig: ColorManager.instance() gibt immer dieselbe Instanz zurück.
 * ColorManager.resetInstance() setzt den Singleton zurück (z. B. für Tests).
 *
 * Verwendung:
 *   const mgr = ColorManager.instance();
 *   mgr.loadFromJSON(legoColorsJson);
 *   const red = mgr.getColorById(4);
 *   const hexNum = mgr.colorIdToHexNumber(4); // 0xC91A09
 */

import { ColorPalette }    from './ColorPalette.js';
import { ColorDefinition } from './ColorDefinition.js';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Konvertiert einen Hex-String (mit oder ohne '#') in eine Ganzzahl.
 *
 * @param {string} hex - Hex-Farbe als String
 * @returns {number} Ganzzahl oder NaN bei ungültiger Eingabe
 */
function hexStringToNumber(hex) {
    if (typeof hex !== 'string') return NaN;
    const clean = hex.replace(/^#/, '');
    const expanded = clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean;
    const val = parseInt(expanded, 16);
    return Number.isNaN(val) ? NaN : val;
}

/**
 * Konvertiert eine Ganzzahl in einen CSS-Hex-String (#RRGGBB).
 *
 * @param {number} num - Numerischer Farbwert (z. B. 0xC91A09)
 * @returns {string} CSS-Hex-String
 */
function numberToHexString(num) {
    return `#${(num >>> 0).toString(16).toUpperCase().padStart(6, '0')}`;
}

// ─── Singleton-Verwaltung ────────────────────────────────────────────────────

/**
 * Modulinterne Singleton-Instanz.
 * Zugriff nur über ColorManager.instance() und ColorManager.resetInstance().
 * @type {ColorManager|null}
 */
let _singletonInstance = null;

// ─── Hauptklasse ──────────────────────────────────────────────────────────────

export class ColorManager {

    // ─── Konstruktor ─────────────────────────────────────────────────────────

    /**
     * Erstellt einen neuen ColorManager.
     *
     * @param {{
     *   palette?:       ColorPalette,  // Vorbelegte Palette (optional)
     *   fallbackColor?: number,        // Fallback-Hex-Zahl wenn ID nicht gefunden wird
     * }} [options={}]
     */
    constructor(options = {}) {
        /**
         * Aktive Farbpalette.
         * Kann per loadFromJSON() ersetzt werden.
         * @type {ColorPalette}
         */
        this._palette = (options.palette instanceof ColorPalette)
            ? options.palette
            : new ColorPalette([]);

        /**
         * Fallback-Farbwert als Ganzzahl (z. B. 0x4488FF für ein helles Blau).
         * Wird zurückgegeben, wenn eine Farb-ID nicht in der Palette gefunden wird.
         * @type {number}
         */
        this._fallbackColor = (typeof options.fallbackColor === 'number')
            ? options.fallbackColor
            : 0x4488FF;
    }

    // ─── Singleton ───────────────────────────────────────────────────────────

    /**
     * Gibt die globale Singleton-Instanz zurück.
     * Erstellt eine neue Instanz bei erstem Aufruf (Lazy Initialization).
     *
     * @param {object} [options={}] - Optionen für die erste Erstellung (werden danach ignoriert)
     * @returns {ColorManager}
     */
    static instance(options = {}) {
        if (!_singletonInstance) {
            _singletonInstance = new ColorManager(options);
        }
        return _singletonInstance;
    }

    /**
     * Setzt den Singleton zurück. Nützlich für Unit-Tests oder beim
     * vollständigen Neuladen der Anwendung.
     */
    static resetInstance() {
        _singletonInstance = null;
    }

    // ─── Palettten-Zugriff ────────────────────────────────────────────────────

    /**
     * Gibt die aktive Farbpalette zurück.
     * @returns {ColorPalette}
     */
    getPalette() {
        return this._palette;
    }

    // ─── Farb-Suche ───────────────────────────────────────────────────────────

    /**
     * Sucht eine Farbe anhand ihrer LDraw-ID.
     *
     * @param {number} id - LDraw-Farb-ID (z. B. 4 für Rot)
     * @returns {ColorDefinition|null}
     */
    getColorById(id) {
        return this._palette.getById(id);
    }

    /**
     * Sucht eine Farbe anhand ihres Hex-Werts (Groß-/Kleinschreibung egal).
     *
     * @param {string} hex - CSS-Hex-Farbe (z. B. '#C91A09')
     * @returns {ColorDefinition|null}
     */
    getColorByHex(hex) {
        return this._palette.getByHex(hex);
    }

    /**
     * Sucht eine Farbe anhand ihres Namens.
     * Durchsucht sowohl den englischen als auch den deutschen Namen (Groß-/
     * Kleinschreibung egal).
     *
     * @param {string} name - Zu suchender Name
     * @returns {ColorDefinition|null}
     */
    getColorByName(name) {
        return this._palette.getByName(name);
    }

    /**
     * Gibt alle Farben einer bestimmten Familie zurück.
     *
     * @param {string} family - Farbfamilie (z. B. 'red', 'blue', 'transparent')
     * @returns {ColorDefinition[]}
     */
    getColorsByFamily(family) {
        return this._palette.getByFamily(family);
    }

    /**
     * Gibt alle Farben der aktiven Palette zurück.
     *
     * @returns {ColorDefinition[]}
     */
    getAllColors() {
        return this._palette.getAll();
    }

    /**
     * Gibt alle eindeutigen Farbfamilien in alphabetischer Reihenfolge zurück.
     *
     * @returns {string[]}
     */
    getFamilies() {
        return this._palette.getFamilies();
    }

    // ─── Konvertierungen: ID ↔ Hex ────────────────────────────────────────────

    /**
     * Wandelt eine LDraw-Farb-ID in einen CSS-Hex-String um.
     *
     * @param {number} colorId - LDraw-Farb-ID
     * @returns {string|null} CSS-Hex-String (z. B. '#C91A09') oder null
     */
    colorIdToHex(colorId) {
        const color = this._palette.getById(colorId);
        return color ? color.hex : null;
    }

    /**
     * Wandelt eine LDraw-Farb-ID in einen numerischen Hex-Wert um.
     * Direkt verwendbar als Three.js-Farbe.
     *
     * @param {number} colorId - LDraw-Farb-ID
     * @returns {number|null} Numerischer Hex-Wert (z. B. 0xC91A09) oder null
     */
    colorIdToHexNumber(colorId) {
        const color = this._palette.getById(colorId);
        return color ? color.hexNumber : null;
    }

    /**
     * Sucht die LDraw-Farb-ID für einen gegebenen Hex-String.
     *
     * @param {string} hex - CSS-Hex-String (z. B. '#C91A09')
     * @returns {number|null} LDraw-Farb-ID oder null wenn nicht gefunden
     */
    hexToColorId(hex) {
        const color = this._palette.getByHex(hex);
        return color ? color.id : null;
    }

    /**
     * Sucht die LDraw-Farb-ID für einen numerischen Hex-Wert.
     *
     * @param {number} hexNumber - Numerischer Hex-Wert (z. B. 0xC91A09)
     * @returns {number|null} LDraw-Farb-ID oder null wenn nicht gefunden
     */
    hexNumberToColorId(hexNumber) {
        const hexStr = numberToHexString(hexNumber);
        return this.hexToColorId(hexStr);
    }

    // ─── Standard-Farbe und Fallback ──────────────────────────────────────────

    /**
     * Gibt die Standardfarbe zurück. Bevorzugt Weiß (id=15), sonst die erste
     * Farbe in der Palette. Gibt null zurück, wenn die Palette leer ist.
     *
     * @returns {ColorDefinition|null}
     */
    getDefaultColor() {
        // Bevorzugt Weiß (LDraw-ID 15)
        const white = this._palette.getById(15);
        if (white) return white;
        // Fallback: erste Farbe der Palette
        const all = this._palette.getAll();
        return all.length > 0 ? all[0] : null;
    }

    /**
     * Gibt den Fallback-Farbwert als Ganzzahl zurück.
     * Wird verwendet, wenn eine Farb-ID nicht in der Palette gefunden wird.
     *
     * @returns {number} Fallback-Farbe als Ganzzahl (z. B. 0x4488FF)
     */
    getFallbackHex() {
        return this._fallbackColor;
    }

    // ─── Paletten-Verwaltung ──────────────────────────────────────────────────

    /**
     * Ersetzt die aktive Palette durch Farben aus einem JSON-String oder -Objekt.
     *
     * Erwartet das Format aus lego-colors.json:
     *   { "schemaVersion": 1, "colors": [...] }
     *   oder direkt { "colors": [...] }
     *
     * @param {string|object} json - JSON-Daten
     * @throws {SyntaxError} Wenn json ein ungültiger JSON-String ist
     * @throws {TypeError} Wenn die Datenstruktur unbekannt ist
     */
    loadFromJSON(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;

        // Rohe Array-Übergabe unterstützen
        if (Array.isArray(data)) {
            this._palette = new ColorPalette(data);
            return;
        }

        if (!data || typeof data !== 'object' || !Array.isArray(data.colors)) {
            throw new TypeError(
                'ColorManager.loadFromJSON: Erwartet ein Objekt mit "colors"-Array.'
            );
        }

        this._palette = new ColorPalette(data.colors);
    }

    /**
     * Importiert einzelne Farben in die bestehende Palette.
     * Bereits vorhandene IDs werden übersprungen (kein Überschreiben).
     *
     * @param {Array<ColorDefinition|object>} colors - Zu importierende Farben
     * @returns {{ imported: number, skipped: number }} Import-Statistik
     */
    importColors(colors) {
        if (!Array.isArray(colors)) {
            throw new TypeError('ColorManager.importColors: Erwartet ein Array.');
        }

        let imported = 0;
        let skipped  = 0;

        for (const entry of colors) {
            try {
                // ColorDefinition erstellen (falls nötig)
                const colorDef = (entry instanceof ColorDefinition)
                    ? entry
                    : new ColorDefinition(entry);

                if (this._palette.hasColor(colorDef.id)) {
                    skipped++;
                } else {
                    this._palette.addColor(colorDef);
                    imported++;
                }
            } catch (err) {
                // Ungültige Einträge überspringen und warnen
                console.warn(`ColorManager.importColors: Eintrag übersprungen – ${err.message}`);
                skipped++;
            }
        }

        return { imported, skipped };
    }
}
