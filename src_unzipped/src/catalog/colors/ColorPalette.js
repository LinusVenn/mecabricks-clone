/**
 * ColorPalette – Sammlung von Farbdefinitionen (Phase E.3)
 *
 * Verwaltet eine geordnete Liste von ColorDefinition-Objekten.
 * Unterstützt schnellen Lookup per ID, Hex-Wert und Familienfilter.
 *
 * Intern werden drei Maps für O(1)-Zugriffe gepflegt:
 *  - _byId:     Map<number, ColorDefinition>
 *  - _byHex:    Map<string, ColorDefinition>  (normalisierter Hex-Key)
 *  - _byFamily: Map<string, ColorDefinition[]>
 */

import { ColorDefinition } from './ColorDefinition.js';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Normalisiert einen Hex-String für konsistente Schlüssel in _byHex.
 * Entfernt '#', konvertiert zu Großbuchstaben, expandiert Kurzschreibweise.
 *
 * @param {string} hex - Eingabe-Hex-String
 * @returns {string} Normalisierter Schlüssel (z. B. 'C91A09')
 */
function normalizeHexKey(hex) {
    if (typeof hex !== 'string') return '';
    const clean = hex.replace(/^#/, '').toUpperCase();
    // Kurzschreibweise '#RGB' → 'RRGGBB' expandieren
    if (clean.length === 3) {
        return clean.split('').map(c => c + c).join('');
    }
    return clean;
}

// ─── Hauptklasse ──────────────────────────────────────────────────────────────

export class ColorPalette {

    // ─── Konstruktor ─────────────────────────────────────────────────────────

    /**
     * Erstellt eine neue Farbpalette.
     *
     * @param {Array<ColorDefinition|object>} colors - Farben als ColorDefinition-Instanzen
     *   oder als Rohdaten-Objekte. Rohdaten werden automatisch in ColorDefinition
     *   konvertiert. Duplikate (gleiche id) werden übersprungen (erster Eintrag
     *   gewinnt) und in der Konsole gewarnt.
     */
    constructor(colors = []) {
        // Geordnete Liste aller Farben
        /** @type {ColorDefinition[]} */
        this._colors = [];

        // Schnellzugriff per ID: id → ColorDefinition
        /** @type {Map<number, ColorDefinition>} */
        this._byId = new Map();

        // Schnellzugriff per Hex-Schlüssel: 'RRGGBB' → ColorDefinition
        // Hinweis: Bei Hex-Kollisionen gewinnt die zuerst eingefügte Farbe.
        /** @type {Map<string, ColorDefinition>} */
        this._byHex = new Map();

        // Schnellzugriff per Familie: family → ColorDefinition[]
        /** @type {Map<string, ColorDefinition[]>} */
        this._byFamily = new Map();

        // Alle übergebenen Farben eintragen
        for (const entry of colors) {
            this._insertColor(entry, /* throwOnDuplicate */ false);
        }
    }

    // ─── Private Hilfsmethoden ────────────────────────────────────────────────

    /**
     * Konvertiert einen Eintrag (Rohdaten oder ColorDefinition) in eine
     * ColorDefinition und trägt sie in alle internen Indices ein.
     *
     * @param {ColorDefinition|object} entry - Farbe oder Rohdaten
     * @param {boolean} throwOnDuplicate - Wirft bei Duplikat-ID statt zu warnen
     * @returns {ColorDefinition} Die eingefügte Farbdefinition
     * @throws {Error} Wenn throwOnDuplicate=true und die ID bereits existiert
     * @private
     */
    _insertColor(entry, throwOnDuplicate) {
        // Sicherstellen, dass wir eine ColorDefinition-Instanz haben
        const colorDef = (entry instanceof ColorDefinition)
            ? entry
            : new ColorDefinition(entry);

        // Duplikat-Prüfung auf ID-Ebene
        if (this._byId.has(colorDef.id)) {
            if (throwOnDuplicate) {
                throw new Error(
                    `ColorPalette: Farb-ID ${colorDef.id} ("${colorDef.name}") existiert bereits.`
                );
            }
            console.warn(
                `ColorPalette: Farb-ID ${colorDef.id} ("${colorDef.name}") ist ein Duplikat und wird übersprungen.`
            );
            return this._byId.get(colorDef.id);
        }

        // In alle Indices eintragen
        this._colors.push(colorDef);
        this._byId.set(colorDef.id, colorDef);

        // Hex-Index: Beim ersten Auftreten eines Hex-Werts eintragen
        const hexKey = normalizeHexKey(colorDef.hex);
        if (hexKey && !this._byHex.has(hexKey)) {
            this._byHex.set(hexKey, colorDef);
        }

        // Familien-Index: Bestehende Liste erweitern oder neue anlegen
        const familyList = this._byFamily.get(colorDef.family);
        if (familyList) {
            familyList.push(colorDef);
        } else {
            this._byFamily.set(colorDef.family, [colorDef]);
        }

        return colorDef;
    }

    /**
     * Entfernt eine Farbe aus allen internen Indices.
     *
     * @param {ColorDefinition} colorDef - Zu entfernende Farbe
     * @private
     */
    _removeFromIndices(colorDef) {
        // Aus der geordneten Liste entfernen
        const idx = this._colors.indexOf(colorDef);
        if (idx !== -1) this._colors.splice(idx, 1);

        // Aus ID-Index entfernen
        this._byId.delete(colorDef.id);

        // Aus Hex-Index entfernen – nur wenn diese Farbe der aktuelle Eintrag ist
        const hexKey = normalizeHexKey(colorDef.hex);
        if (this._byHex.get(hexKey) === colorDef) {
            this._byHex.delete(hexKey);
            // Prüfen, ob eine andere Farbe denselben Hex-Wert hat
            const sameHex = this._colors.find(c => normalizeHexKey(c.hex) === hexKey);
            if (sameHex) this._byHex.set(hexKey, sameHex);
        }

        // Aus Familien-Index entfernen
        const familyList = this._byFamily.get(colorDef.family);
        if (familyList) {
            const fi = familyList.indexOf(colorDef);
            if (fi !== -1) familyList.splice(fi, 1);
            // Leere Familienliste bereinigen
            if (familyList.length === 0) this._byFamily.delete(colorDef.family);
        }
    }

    // ─── Öffentliche API ──────────────────────────────────────────────────────

    /**
     * Gibt alle Farben in Einfügereihenfolge zurück.
     * Die zurückgegebene Liste ist eine flache Kopie (kein direkter Zugriff
     * auf das interne Array).
     *
     * @returns {ColorDefinition[]}
     */
    getAll() {
        return [...this._colors];
    }

    /**
     * Sucht eine Farbe anhand ihrer LDraw-ID.
     *
     * @param {number} id - LDraw-Farb-ID
     * @returns {ColorDefinition|null} Gefundene Farbe oder null
     */
    getById(id) {
        return this._byId.get(id) ?? null;
    }

    /**
     * Sucht eine Farbe anhand ihres Hex-Werts (Groß-/Kleinschreibung egal).
     * Unterstützt sowohl '#RRGGBB' als auch 'RRGGBB'-Format.
     *
     * @param {string} hex - CSS-Hex-Farbe
     * @returns {ColorDefinition|null} Gefundene Farbe oder null
     */
    getByHex(hex) {
        const key = normalizeHexKey(hex);
        return this._byHex.get(key) ?? null;
    }

    /**
     * Gibt alle Farben einer bestimmten Familie zurück.
     * Gibt ein leeres Array zurück, wenn die Familie nicht existiert.
     *
     * @param {string} family - Farbfamilie (z. B. 'red', 'blue', 'transparent')
     * @returns {ColorDefinition[]}
     */
    getByFamily(family) {
        return [...(this._byFamily.get(family) ?? [])];
    }

    /**
     * Sucht eine Farbe anhand ihres Namens (Groß-/Kleinschreibung egal).
     * Durchsucht sowohl den englischen Name als auch den displayName (Deutsch).
     *
     * @param {string} name - Zu suchender Name
     * @returns {ColorDefinition|null} Erste passende Farbe oder null
     */
    getByName(name) {
        if (typeof name !== 'string') return null;
        const needle = name.toLowerCase();
        return this._colors.find(
            c => c.name.toLowerCase() === needle
              || c.displayName.toLowerCase() === needle
        ) ?? null;
    }

    /**
     * Gibt alle eindeutigen Farbfamilien in alphabetischer Reihenfolge zurück.
     *
     * @returns {string[]}
     */
    getFamilies() {
        return [...this._byFamily.keys()].sort();
    }

    /**
     * Prüft, ob eine Farbe mit der angegebenen ID in der Palette vorhanden ist.
     *
     * @param {number} id - LDraw-Farb-ID
     * @returns {boolean}
     */
    hasColor(id) {
        return this._byId.has(id);
    }

    /**
     * Gibt die Gesamtanzahl der Farben in der Palette zurück.
     *
     * @returns {number}
     */
    getCount() {
        return this._colors.length;
    }

    /**
     * Fügt eine neue Farbe zur Palette hinzu.
     * Wirft einen Fehler, wenn die ID bereits vergeben ist.
     *
     * @param {ColorDefinition|object} definition - Neue Farbe oder Rohdaten
     * @returns {ColorDefinition} Die eingefügte Farbdefinition
     * @throws {Error} Wenn die ID bereits existiert
     */
    addColor(definition) {
        return this._insertColor(definition, /* throwOnDuplicate */ true);
    }

    /**
     * Entfernt eine Farbe aus der Palette anhand ihrer ID.
     *
     * @param {number} id - LDraw-Farb-ID der zu entfernenden Farbe
     * @returns {boolean} true wenn die Farbe gefunden und entfernt wurde, sonst false
     */
    removeColor(id) {
        const colorDef = this._byId.get(id);
        if (!colorDef) return false;
        this._removeFromIndices(colorDef);
        return true;
    }

    // ─── Serialisierung ───────────────────────────────────────────────────────

    /**
     * Serialisiert die Palette als einfaches Objekt.
     * Das Ergebnis kann direkt mit JSON.stringify() in JSON umgewandelt werden.
     *
     * @returns {{ colors: object[] }}
     */
    toData() {
        return {
            colors: this._colors.map(c => c.toData()),
        };
    }

    /**
     * Erstellt eine ColorPalette aus einem JSON-String oder -Objekt.
     *
     * Erwartet entweder:
     *  - Einen JSON-String mit dem Format { colors: [...] }
     *  - Ein Objekt mit dem Format { colors: [...] }
     *  - Ein Array von Farbobjekten
     *
     * @param {string|object} json - JSON-Daten
     * @returns {ColorPalette}
     * @throws {SyntaxError} Wenn json ein ungültiger JSON-String ist
     * @throws {TypeError} Wenn das geparste Objekt kein colors-Array enthält
     */
    static fromJSON(json) {
        // JSON-String in Objekt umwandeln
        let data = typeof json === 'string' ? JSON.parse(json) : json;

        // Direktes Array unterstützen
        if (Array.isArray(data)) {
            return new ColorPalette(data);
        }

        // Objekt mit colors-Eigenschaft erwartet
        if (!data || typeof data !== 'object' || !Array.isArray(data.colors)) {
            throw new TypeError(
                'ColorPalette.fromJSON: Erwartet ein Objekt mit "colors"-Array oder ein Array.'
            );
        }

        return new ColorPalette(data.colors);
    }
}
