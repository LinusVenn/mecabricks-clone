/**
 * PartMetadataResolver – löst Bauteil-Metadaten auf (Phase E.1)
 *
 * Versucht zu einer gegebenen LDraw-Teilenummer folgende Informationen zu ermitteln:
 *  - Kategorie
 *  - Abmessungen (Width, Depth, Height)
 *  - Beschreibung
 *  - Tags
 *
 * Metadaten können über den Konstruktor, addMetadata() oder fromJSON() geladen werden.
 * Teilenummern werden intern normalisiert (lowercase, kein ".dat"-Suffix).
 */

// ─── Klasse ────────────────────────────────────────────────────────────────────

export class PartMetadataResolver {

    /**
     * Erstellt einen neuen PartMetadataResolver.
     *
     * @param {Map<string, object>|object|null} metadataSource
     *   Optionale Metadatenquelle. Erlaubte Typen:
     *    - `Map<string, object>`: direkt nutzbar
     *    - Plain Object `{ "3001": { category: "bricks", ... } }`: wird iteriert
     *    - Objekt mit `{ metadata: [...] }`: wird per _loadSource verarbeitet
     *    - `null`/`undefined`: leerer Resolver
     */
    constructor(metadataSource = null) {
        /**
         * Interne Map: normalisierte Teilenummer → Metadaten-Objekt.
         * @type {Map<string, {category?: string, width?: number|null, depth?: number|null, height?: number|null, description?: string, tags?: string[]}>}
         */
        this._metadata = new Map();

        // Quelle laden, falls vorhanden
        if (metadataSource) {
            this._loadSource(metadataSource);
        }
    }

    // ─── Öffentliche Methoden ────────────────────────────────────────────────────

    /**
     * Löst Metadaten für eine LDraw-Teilenummer auf.
     *
     * @param {string} ldrawPartNumber  LDraw-Teilenummer (wird normalisiert)
     * @returns {{ category?: string, width?: number|null, depth?: number|null, height?: number|null, description?: string, tags?: string[] } | null}
     *   Bekannte Metadaten oder `null` wenn keine Daten vorhanden sind.
     */
    resolve(ldrawPartNumber) {
        const key = this._normalizePartNumber(ldrawPartNumber);
        const meta = this._metadata.get(key);
        // Flache Kopie zurückgeben, um interne Daten zu schützen
        return meta ? { ...meta } : null;
    }

    /**
     * Löst Metadaten für eine Liste von LDraw-Teilenummern auf.
     * Für unbekannte Nummern wird kein Eintrag in der Ergebnismap erstellt.
     *
     * @param {string[]} ldrawPartNumbers  Array von Teilenummern
     * @returns {Map<string, object>}       Map: normalisierte Teilenummer → Metadaten
     */
    resolveAll(ldrawPartNumbers) {
        const result = new Map();

        if (!Array.isArray(ldrawPartNumbers)) {
            console.warn('PartMetadataResolver.resolveAll: Erwartet ein Array von Teilenummern.');
            return result;
        }

        for (const num of ldrawPartNumbers) {
            const key  = this._normalizePartNumber(num);
            const meta = this._metadata.get(key);
            if (meta) {
                result.set(key, { ...meta });
            }
        }

        return result;
    }

    /**
     * Registriert Metadaten für eine Teilenummer manuell.
     * Vorhandene Metadaten werden vollständig überschrieben.
     *
     * @param {string} ldrawPartNumber  LDraw-Teilenummer (wird normalisiert)
     * @param {{ category?: string, width?: number|null, depth?: number|null, height?: number|null, description?: string, tags?: string[] }} metadata
     */
    addMetadata(ldrawPartNumber, metadata) {
        if (!ldrawPartNumber || typeof ldrawPartNumber !== 'string') {
            throw new Error('PartMetadataResolver.addMetadata: "ldrawPartNumber" muss ein nicht-leerer String sein.');
        }
        if (!metadata || typeof metadata !== 'object') {
            throw new Error('PartMetadataResolver.addMetadata: "metadata" muss ein Objekt sein.');
        }

        const key = this._normalizePartNumber(ldrawPartNumber);
        this._metadata.set(key, { ...metadata });
    }

    /**
     * Prüft, ob Metadaten für eine Teilenummer vorhanden sind.
     *
     * @param {string} ldrawPartNumber
     * @returns {boolean}
     */
    hasMetadata(ldrawPartNumber) {
        const key = this._normalizePartNumber(ldrawPartNumber);
        return this._metadata.has(key);
    }

    /**
     * Gibt die Anzahl der gespeicherten Metadaten-Einträge zurück.
     *
     * @returns {number}
     */
    getCount() {
        return this._metadata.size;
    }

    // ─── Statische Fabrikmethoden ────────────────────────────────────────────────

    /**
     * Erstellt einen PartMetadataResolver aus einem JSON-Objekt.
     *
     * Unterstützte Formate:
     *
     * **Format A – Objekt mit "metadata"-Array:**
     * ```json
     * {
     *   "metadata": [
     *     { "ldrawPartNumber": "3001", "category": "bricks", "width": 2, "depth": 4 }
     *   ]
     * }
     * ```
     *
     * **Format B – Plain Object (Teilenummer als Key):**
     * ```json
     * {
     *   "3001": { "category": "bricks", "width": 2, "depth": 4 },
     *   "3020": { "category": "plates", "width": 2, "depth": 4, "height": 1 }
     * }
     * ```
     *
     * @param {object} json
     * @returns {PartMetadataResolver}
     */
    static fromJSON(json) {
        if (!json || typeof json !== 'object') {
            throw new Error('PartMetadataResolver.fromJSON: Ungültiges JSON-Argument.');
        }

        return new PartMetadataResolver(json);
    }

    // ─── Private Hilfsmethoden ───────────────────────────────────────────────────

    /**
     * Lädt Metadaten aus verschiedenen Quellformaten.
     *
     * Unterstützte Typen:
     *  - `Map<string, object>`
     *  - Plain Object mit `{ metadata: [...] }` (Format A)
     *  - Plain Object mit Teilenummern als Keys (Format B)
     *
     * @param {Map<string, object>|object} source
     * @private
     */
    _loadSource(source) {
        // ── Format: Map ──────────────────────────────────────────────────────────
        if (source instanceof Map) {
            for (const [num, meta] of source) {
                if (meta && typeof meta === 'object') {
                    this._metadata.set(this._normalizePartNumber(num), { ...meta });
                }
            }
            return;
        }

        // ── Format: Plain Object ─────────────────────────────────────────────────
        if (source && typeof source === 'object') {

            // Format A: { metadata: [{ ldrawPartNumber, category, ... }] }
            if (Array.isArray(source.metadata)) {
                for (const entry of source.metadata) {
                    if (!entry?.ldrawPartNumber) {
                        console.warn('PartMetadataResolver._loadSource: Eintrag ohne "ldrawPartNumber" übersprungen:', entry);
                        continue;
                    }

                    const key  = this._normalizePartNumber(entry.ldrawPartNumber);
                    const { ldrawPartNumber: _ignored, ...rest } = entry; // Teilenummer nicht in Metadaten speichern
                    this._metadata.set(key, { ...rest });
                }
                return;
            }

            // Format B: { "3001": { category: "bricks", ... }, ... }
            for (const [num, meta] of Object.entries(source)) {
                if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
                    this._metadata.set(this._normalizePartNumber(num), { ...meta });
                }
            }
            return;
        }

        console.warn('PartMetadataResolver._loadSource: Unbekanntes Quellformat, keine Metadaten geladen.');
    }

    /**
     * Normalisiert eine LDraw-Teilenummer für die interne Map-Suche.
     *  - Leerzeichen entfernen
     *  - Kleinbuchstaben
     *  - ".dat"-Suffix entfernen
     *
     * Beispiele:
     *  "3001.dat" → "3001"
     *  " 3001 "   → "3001"
     *  "3001"     → "3001"
     *  "3001S"    → "3001s"
     *
     * @param {string} value
     * @returns {string}
     * @private
     */
    _normalizePartNumber(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\.dat$/i, '');
    }
}
