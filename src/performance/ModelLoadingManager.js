// =====================================================================
// ModelLoadingManager – Schritt 5 (Phase 8.8)
//
// Lädt große Modelle in Paketen (Chunks), sodass der Browser zwischen
// den Paketen rendern und auf Eingaben reagieren kann.
//
// Ablauf:
//   1. load(bricks, options?) nimmt ein Array von Bauteil-Datensätzen.
//   2. Die Liste wird in Chunks à chunkSize aufgeteilt.
//   3. Jeder Chunk wird synchron verarbeitet; danach kann das UI atmen.
//   4. Am Ende werden onComplete(count) / onError(err) aufgerufen.
//
// Kompatibilität:
//   Verbindungen, Gruppen und Baugruppen müssen nach dem Laden
//   korrekt wiederhergestellt werden (wird über Callbacks gelöst).
// =====================================================================


export class ModelLoadingManager {

    /**
     * @param {import('../objects/PartLibrary.js').PartLibrary} library
     * @param {{
     *   chunkSize?:  number,
     *   chunkDelay?: number
     * }} [options]
     */
    constructor(library, {
        chunkSize  = 50,
        chunkDelay = 0
    } = {}) {
        this._library    = library;
        this._chunkSize  = Math.max(1, chunkSize);
        this._chunkDelay = Math.max(0, chunkDelay);

        /** @type {boolean} */
        this.isLoading = false;
        /** @type {boolean} */
        this.aborted   = false;
        /** @type {number}  0–1 */
        this.progress  = 0;

        // ── Callbacks ──────────────────────────────────────────────
        /** @type {((progress: number) => void) | null} */
        this.onProgress    = null;
        /** @type {((count: number) => void) | null} */
        this.onComplete    = null;
        /** @type {((error: Error) => void) | null} */
        this.onError       = null;
        /** @type {((loaded: number, total: number) => void) | null} */
        this.onChunkLoaded = null;
    }


    // ------------------------------------------------------------------
    // Öffentliche API
    // ------------------------------------------------------------------

    /**
     * Lädt ein Array von Baustein-Datensätzen chunked in die Library.
     * @param {object[]} bricks
     * @returns {Promise<void>}
     */
    async load(bricks) {
        if (!Array.isArray(bricks)) bricks = [];
        this.isLoading = true;
        this.aborted   = false;
        this.progress  = 0;

        const total  = bricks.length;
        let   loaded = 0;

        try {
            for (let start = 0; start < total; start += this._chunkSize) {
                if (this.aborted) break;

                const chunk = bricks.slice(start, start + this._chunkSize);

                for (const data of chunk) {
                    if (this.aborted) break;
                    try {
                        this._library.addBrickFromData(data);
                    } catch (err) {
                        this.onError?.(err);
                    }
                    loaded++;
                    this.progress = total > 0 ? loaded / total : 1;
                    this.onProgress?.(this.progress);
                }

                this.onChunkLoaded?.(loaded, total);

                // Zwischen Chunks atmen lassen (nur wenn chunkDelay > 0)
                if (this._chunkDelay > 0 && start + this._chunkSize < total) {
                    await new Promise(r => setTimeout(r, this._chunkDelay));
                }
            }

            this.progress = 1;
            this.onProgress?.(1);
            this.onComplete?.(loaded);

        } finally {
            this.isLoading = false;
        }
    }


    /**
     * Bricht einen laufenden Ladevorgang ab.
     * Bereits geladene Bauteile bleiben in der Szene.
     */
    abort() {
        this.aborted = true;
    }
}
