
/**
 * Verwaltet und erzeugt Pfade innerhalb einer entpackten
 * offiziellen LDraw-Bibliothek.
 *
 * Erwartete Verzeichnisstruktur:
 *
 * public/
 *   ldraw/
 *     LDConfig.ldr
 *     parts/
 *       3001.dat
 *       3020.dat
 *       3069.dat
 *       s/
 *         ...
 *     p/
 *       ...
 */
export class LDrawPathResolver {

    constructor(baseUrl = '/ldraw/') {
        this.setBaseUrl(baseUrl);
    }

    /**
     * Setzt das Basisverzeichnis der LDraw-Bibliothek.
     *
     * Unterstützt:
     * - Root-relative Pfade: /ldraw/
     * - Relative Pfade: ldraw/
     * - Absolute URLs: https://example.com/ldraw/
     */
    setBaseUrl(baseUrl) {

        if (
            typeof baseUrl !== 'string' ||
            !baseUrl.trim()
        ) {
            throw new TypeError(
                'LDrawPathResolver: baseUrl muss ein nicht-leerer String sein.'
            );
        }

        const normalized = baseUrl
            .trim()
            .replace(/\\/g, '/')
            .replace(/\/+$/, '');

        if (!normalized) {
            throw new Error(
                'LDrawPathResolver: Ungültiges Basisverzeichnis.'
            );
        }

        this.baseUrl = `${normalized}/`;
    }

    /**
     * Gibt das Basisverzeichnis zurück.
     */
    getLibraryRoot() {
        return this.baseUrl;
    }

    /**
     * Erzeugt einen vollständigen Pfad zu einer Bibliotheksdatei.
     *
     * Beispiel:
     * resolveLibraryFile('parts/3001.dat')
     * -> /ldraw/parts/3001.dat
     */
    resolveLibraryFile(fileName) {

        const safeName = this.#sanitize(fileName);

        return `${this.baseUrl}${safeName}`;
    }

    /**
     * Erzeugt den Pfad zu einer LDraw-Teiledatei.
     *
     * Beispiel:
     * resolvePartFile('3001')
     * -> /ldraw/parts/3001.dat
     */
    resolvePartFile(partNumber) {

        const fileName = this.#normalizePartFileName(partNumber);

        return this.resolveLibraryFile(
            `parts/${fileName}`
        );
    }

    /**
     * Erzeugt den Pfad zur offiziellen Farbtabelle.
     */
    resolveConfigFile() {

        return this.resolveLibraryFile('LDConfig.ldr');
    }

    /**
     * Erzeugt einen Pfad zu einem Unterteil.
     *
     * Beispiel:
     * resolveSubPartFile('3001s01')
     * -> /ldraw/parts/s/3001s01.dat
     */
    resolveSubPartFile(partNumber) {

        const fileName = this.#normalizePartFileName(partNumber);

        return this.resolveLibraryFile(
            `parts/s/${fileName}`
        );
    }

    /**
     * Erzeugt einen Pfad zu einem LDraw-Primitiv.
     *
     * Beispiel:
     * resolvePrimitiveFile('stud.dat')
     * -> /ldraw/p/stud.dat
     */
    resolvePrimitiveFile(fileName) {

        const normalized = this.#normalizePartFileName(fileName);

        return this.resolveLibraryFile(
            `p/${normalized}`
        );
    }

    // ------------------------------------------------------------
    // PRIVATE HILFSMETHODEN
    // ------------------------------------------------------------

    /**
     * Normalisiert eine Teilenummer und ergänzt .dat.
     */
    #normalizePartFileName(partNumber) {

        if (
            typeof partNumber !== 'string' &&
            typeof partNumber !== 'number'
        ) {
            throw new TypeError(
                'LDraw-Teilenummer muss ein String oder eine Zahl sein.'
            );
        }

        const value = String(partNumber)
            .trim()
            .toLowerCase();

        if (!value) {
            throw new Error(
                'LDraw-Teilenummer darf nicht leer sein.'
            );
        }

        if (
            value.includes('/') ||
            value.includes('\\') ||
            value.includes('..')
        ) {
            throw new Error(
                `Ungültige LDraw-Teilenummer: ${value}`
            );
        }

        const fileName = /\.dat$/i.test(value)
            ? value
            : `${value}.dat`;

        if (!/^[a-z0-9_-]+\.dat$/i.test(fileName)) {
            throw new Error(
                `Ungültiger LDraw-Dateiname: ${fileName}`
            );
        }

        return fileName;
    }

    /**
     * Validiert einen relativen Bibliothekspfad.
     *
     * Verhindert unter anderem:
     * - Directory Traversal
     * - Leere Pfadsegmente
     * - Absolute Pfade innerhalb der Bibliothek
     */
    #sanitize(fileName) {

        if (
            typeof fileName !== 'string' ||
            !fileName.trim()
        ) {
            throw new TypeError(
                'LDraw-Dateiname muss ein nicht-leerer String sein.'
            );
        }

        const normalized = fileName
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');

        const segments = normalized.split('/');

        if (
            segments.some(segment =>
                !segment ||
                segment === '.' ||
                segment === '..'
            )
        ) {
            throw new Error(
                `Ungültiger LDraw-Dateipfad: ${fileName}`
            );
        }

        return segments.join('/');
    }
}
