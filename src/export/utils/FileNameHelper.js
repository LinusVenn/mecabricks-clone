/**
 * FileNameHelper – Erstellt Dateinamen für Exporte (Phase H)
 *
 * Generiert format-spezifische Dateinamen anhand des Projektnamens.
 * Alle Methoden sind statisch und zustandslos.
 *
 * Namenskonvention:
 *  - LDraw:  `projektname.ldr` / `projektname.mpd`
 *  - GLTF:   `projektname.glb` / `projektname.gltf`
 *  - CSV:    `stueckliste_projektname.csv`
 *  - JSON:   `stueckliste_projektname.json`
 *  - PDF:    `stueckliste_projektname_druckansicht.html`
 *
 * @module FileNameHelper
 */

/** Maximale Länge des bereinigten Projektnamens (Zeichen). */
const MAX_NAME_LENGTH = 64;

export class FileNameHelper {

    // -------------------------------------------------------------------------
    // Format-spezifische Namensgeneratoren
    // -------------------------------------------------------------------------

    /**
     * Erstellt einen Dateinamen für LDraw-Exporte.
     *
     * Einteilige Modelle erhalten die Endung `.ldr`,
     * mehrteilige Modelle (Multi-Part Document) die Endung `.mpd`.
     *
     * @param {string}  projectName              - Rohname des Projekts.
     * @param {boolean} [isMultipart=false]      - `true` → `.mpd`, sonst `.ldr`.
     * @returns {string} Fertiger Dateiname.
     */
    static forLDraw(projectName, isMultipart = false) {
        const base = FileNameHelper.sanitize(projectName);
        const ext  = isMultipart ? 'mpd' : 'ldr';
        return `${base}.${ext}`;
    }

    /**
     * Erstellt einen Dateinamen für GLTF-Exporte.
     *
     * Binäre Exporte erhalten die Endung `.glb` (GL Transmission Format Binary),
     * Text-Exporte die Endung `.gltf`.
     *
     * @param {string}  projectName         - Rohname des Projekts.
     * @param {boolean} [binary=true]       - `true` → `.glb`, sonst `.gltf`.
     * @returns {string} Fertiger Dateiname.
     */
    static forGLTF(projectName, binary = true) {
        const base = FileNameHelper.sanitize(projectName);
        const ext  = binary ? 'glb' : 'gltf';
        return `${base}.${ext}`;
    }

    /**
     * Erstellt einen Dateinamen für CSV-Stücklisten-Exporte.
     *
     * Erhält das Präfix `stueckliste_` zur sofortigen Erkennbarkeit.
     *
     * @param {string} projectName - Rohname des Projekts.
     * @returns {string} Fertiger Dateiname.
     */
    static forCSV(projectName) {
        const base = FileNameHelper.sanitize(projectName);
        return `stueckliste_${base}.csv`;
    }

    /**
     * Erstellt einen Dateinamen für JSON-Stücklisten-Exporte.
     *
     * Erhält das Präfix `stueckliste_` zur sofortigen Erkennbarkeit.
     *
     * @param {string} projectName - Rohname des Projekts.
     * @returns {string} Fertiger Dateiname.
     */
    static forJSON(projectName) {
        const base = FileNameHelper.sanitize(projectName);
        return `stueckliste_${base}.json`;
    }

    /**
     * Erstellt einen Dateinamen für die Druck-/PDF-Ansicht.
     *
     * Da der PDF-Export über `window.print()` realisiert wird, wird eine
     * HTML-Datei erzeugt. Das Suffix `_druckansicht` macht den Zweck deutlich.
     *
     * @param {string} projectName - Rohname des Projekts.
     * @returns {string} Fertiger Dateiname.
     */
    static forPDF(projectName) {
        const base = FileNameHelper.sanitize(projectName);
        return `stueckliste_${base}_druckansicht.html`;
    }

    // -------------------------------------------------------------------------
    // Hilfsmethoden
    // -------------------------------------------------------------------------

    /**
     * Bereinigt einen Projektnamen für den sicheren Einsatz in Dateinamen.
     *
     * Transformation:
     *  1. Leerzeichen → Unterstriche
     *  2. Sonderzeichen (alles außer `a-z`, `0-9`, `-`, `_`, `.`) entfernen
     *  3. Alles in Kleinbuchstaben
     *  4. Auf {@link MAX_NAME_LENGTH} Zeichen kürzen
     *  5. Fallback auf `'export'`, wenn das Ergebnis leer ist
     *
     * @param {string} name - Rohname des Projekts.
     * @returns {string}    - Bereinigter, dateinamensicherer String.
     */
    static sanitize(name) {
        if (typeof name !== 'string' || name.trim().length === 0) {
            return 'export';
        }

        const sanitized = name
            .trim()
            // Leerzeichen → Unterstrich
            .replace(/\s+/g, '_')
            // Alles außer erlaubten Zeichen entfernen
            .replace(/[^a-zA-Z0-9_\-.]/g, '')
            // Kleinbuchstaben
            .toLowerCase()
            // Maximale Länge einhalten
            .slice(0, MAX_NAME_LENGTH);

        return sanitized.length > 0 ? sanitized : 'export';
    }
}
