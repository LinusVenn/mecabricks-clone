
export class LDrawPartIndex {

    // ── Schemaversion-2-Manifest unterstützte Erweiterungen ───────────────────

    /** @type {Set<string>} Relevante Dateierweiterungen (ohne Punkt, Kleinbuchstaben). */
    static RELEVANT_EXTENSIONS = new Set(['dat', 'ldr']);

    constructor(options = {}) {
        this.baseUrl = this.#normalizeBaseUrl(
            options.baseUrl ?? '/ldraw/'
        );

        this.manifestUrl = options.manifestUrl ??
            `${this.baseUrl}parts-index.json`;

        this.fetchImpl = options.fetchImpl ??
            globalThis.fetch?.bind(globalThis);

        this.parts = new Set();
        this.loaded = false;
        this.loadingPromise = null;

        this.manifestAvailable = false;

        /**
         * Duplikate aus dem Manifest (Dateien mit gleichem Basisnamen in
         * unterschiedlichen Unterverzeichnissen).
         * @type {{ partNumber: string, files: string[] }[]}
         */
        this.duplicates = [];
    }

    // ── Statische Fabrikmethode ───────────────────────────────────────────────

    /**
     * Erstellt einen vollständig initialisierten LDrawPartIndex aus einer
     * Dateiliste, ohne einen Netzwerkaufruf durchzuführen.
     *
     * Nützlich für Tests oder Server-Side-Generierung.
     *
     * @param {string[]} files   - Relative Dateipfade, z. B. ["3001.dat", "s/3001s01.dat"]
     * @param {object}  [options]
     * @returns {LDrawPartIndex}
     */
    static buildFromFileList(files, options = {}) {
        const index = new LDrawPartIndex(options);

        const validFiles = Array.isArray(files)
            ? files.filter(f => {
                const ext = String(f).split('.').pop()?.toLowerCase() ?? '';
                return LDrawPartIndex.RELEVANT_EXTENSIONS.has(ext);
            })
            : [];

        for (const file of validFiles) {
            const normalized = index.#normalizePartNumber(file);
            if (normalized) index.parts.add(normalized);
        }

        // Duplikate erkennen
        index.duplicates = LDrawPartIndex.#findDuplicates(validFiles);

        index.loaded = true;
        index.manifestAvailable = true;

        return index;
    }

    // ── Private: Duplikat-Erkennung ───────────────────────────────────────────

    static #findDuplicates(files) {
        const byName = new Map();

        for (const file of files) {
            // Basename ohne Erweiterung, lowercase
            const key = String(file)
                .split('/')
                .pop()
                .toLowerCase()
                .replace(/\.(dat|ldr)$/i, '');

            if (!byName.has(key)) byName.set(key, []);
            byName.get(key).push(file);
        }

        const duplicates = [];
        for (const [partNumber, paths] of byName) {
            if (paths.length > 1) {
                duplicates.push({ partNumber, files: paths });
            }
        }
        return duplicates;
    }

    #normalizeBaseUrl(url) {
        if (typeof url !== 'string' || !url.trim()) {
            throw new Error('Ungültige LDraw-Basis-URL.');
        }

        return url.endsWith('/') ? url : `${url}/`;
    }

    #normalizePartNumber(value) {
        if (typeof value !== 'string' && typeof value !== 'number') {
            return null;
        }

        let normalized = String(value)
            .trim()
            .replace(/\\/g, '/')
            .split('/')
            .pop()
            .toLowerCase();

        // Erweiterungen .dat und .ldr entfernen
        normalized = normalized.replace(/\.(dat|ldr)$/i, '');

        // Gültige LDraw-Teilenummern: Buchstaben, Ziffern, Bindestriche, Unterstriche
        if (!/^[a-z0-9_-]+$/.test(normalized)) {
            return null;
        }

        return normalized;
    }


    // ── Duplikat-Abfrage ──────────────────────────────────────────────────────

    /**
     * Liefert eine Liste aller erkannten Duplikate (Dateien mit gleichem
     * Basisnamen in unterschiedlichen Unterverzeichnissen).
     *
     * @returns {{ partNumber: string, files: string[] }[]}
     */
    getDuplicates() {
        return [...this.duplicates];
    }

    /**
     * Gibt an, ob für eine Teilenummer Duplikate bekannt sind.
     *
     * @param {string} partNumber
     * @returns {boolean}
     */
    hasDuplicates(partNumber) {
        const normalized = this.#normalizePartNumber(partNumber);
        if (!normalized) return false;

        return this.duplicates.some(
            dup => dup.partNumber === normalized
        );
    }

    async initialize(options = {}) {
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        if (this.loaded && !options.force) {
            return this;
        }

        this.loadingPromise = this.#loadManifest();

        try {
            await this.loadingPromise;
            return this;
        } finally {
            this.loadingPromise = null;
        }
    }

    async #loadManifest() {
        if (typeof this.fetchImpl !== 'function') {
            this.loaded = true;
            this.manifestAvailable = false;
            return;
        }

        try {
            const response = await this.fetchImpl(
                this.manifestUrl
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${this.manifestUrl}`
                );
            }

            const data = await response.json();

            // Unterstützt Schemaversion 1 (plain Array oder { parts: [...] })
            // und Schemaversion 2 ({ schemaVersion: 2, parts: [...], duplicates: [...] })
            const entries = Array.isArray(data)
                ? data
                : data.parts;

            if (!Array.isArray(entries)) {
                throw new Error(
                    'Das LDraw-Manifest enthält kein gültiges parts-Array.'
                );
            }

            const nextParts = new Set();

            for (const entry of entries) {
                const value = typeof entry === 'string'
                    ? entry
                    : entry?.file ?? entry?.partNumber ?? entry?.id;

                const normalized = this.#normalizePartNumber(value);

                if (normalized) {
                    nextParts.add(normalized);
                }
            }

            this.parts = nextParts;

            // Duplikate aus Schemaversion 2 übernehmen
            if (Array.isArray(data.duplicates)) {
                this.duplicates = data.duplicates;
            }

            this.manifestAvailable = true;
            this.loaded = true;

        } catch (error) {
            this.parts.clear();
            this.manifestAvailable = false;
            this.loaded = true;

            console.warn(
                'LDraw-Part-Index konnte nicht geladen werden:',
                error
            );
        }
    }

    isLoaded() {
        return this.loaded;
    }

    isManifestAvailable() {
        return this.manifestAvailable;
    }

    getCount() {
        return this.parts.size;
    }

    getAll() {
        return [...this.parts];
    }

    hasIndexedPart(partNumber) {
        const normalized = this.#normalizePartNumber(
            partNumber
        );

        if (!normalized || !this.loaded || !this.manifestAvailable) {
            return null;
        }

        return this.parts.has(normalized);
    }

    async hasPart(partNumber, options = {}) {
        const normalized = this.#normalizePartNumber(
            partNumber
        );

        if (!normalized) {
            return false;
        }

        if (!this.loaded) {
            await this.initialize();
        }

        if (this.manifestAvailable) {
            return this.parts.has(normalized);
        }

        if (options.checkFile === false) {
            return null;
        }

        return this.#checkFile(normalized);
    }

    async #checkFile(partNumber) {
        if (typeof this.fetchImpl !== 'function') {
            return null;
        }

        const url =
            `${this.baseUrl}parts/${partNumber}.dat`;

        try {
            const response = await this.fetchImpl(url, {
                method: 'GET'
            });

            return response.ok;
        } catch {
            return null;
        }
    }

    registerPart(partNumber) {
        const normalized = this.#normalizePartNumber(
            partNumber
        );

        if (!normalized) {
            throw new Error(
                'Ungültige LDraw-Teilenummer.'
            );
        }

        this.parts.add(normalized);
        this.loaded = true;
        this.manifestAvailable = true;

        return normalized;
    }

    unregisterPart(partNumber) {
        const normalized = this.#normalizePartNumber(
            partNumber
        );

        if (!normalized) {
            return false;
        }

        return this.parts.delete(normalized);
    }

    clear() {
        this.parts.clear();
        this.loaded = false;
        this.manifestAvailable = false;
        this.loadingPromise = null;
    }
}
