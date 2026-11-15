// =====================================================================
// EditorErrorHandler – Schritt 8 (Phase 8.9)
//
// Zentrale Fehlerbehandlung für den Editor.
//
// Prinzip
// ───────
// Ein Fehler in einem optionalen System (Panel, Manager, Optimierer)
// soll nicht den gesamten Editor unbrauchbar machen. Der Handler
// fängt Fehler ab, protokolliert sie und benachrichtigt optionale
// Fehler-Callbacks.
//
// API
// ───
//   handler.try(fn, context)               – fn ausführen, Fehler abfangen
//   handler.handleError(error, context)    – Fehler manuell melden
//   handler.initPanel(id, fn)              – Panel sicher initialisieren
//   handler.getErrors()                    – Fehlerprotokoll abfragen
//   handler.getLastError()                 – Letzten Fehler abfragen
//   handler.clearErrors()                  – Protokoll leeren
//   handler.errorCount                     – Anzahl protokollierter Fehler
// =====================================================================


export class EditorErrorHandler {

    /**
     * @param {{
     *   onError?:   (entry: ErrorEntry) => void   – Callback bei jedem Fehler
     *   maxErrors?: number                         – Max. Protokollgröße (Standard: 50)
     *   silent?:    boolean                        – console.error unterdrücken
     * }} [options]
     */
    constructor({
        onError   = null,
        maxErrors = 50,
        silent    = false
    } = {}) {
        this._onError   = onError;
        this._maxErrors = Math.max(1, maxErrors);
        this._silent    = silent;

        /** @type {ErrorEntry[]} */
        this._errors    = [];
    }


    // ------------------------------------------------------------------
    // Kernmethoden
    // ------------------------------------------------------------------

    /**
     * Führt fn aus. Tritt ein Fehler auf, wird er abgefangen und
     * protokolliert. Rückgabe: Ergebnis von fn oder null bei Fehler.
     *
     * @template T
     * @param {() => T} fn
     * @param {string}  [context]
     * @returns {T | null}
     */
    try(fn, context = '') {
        try {
            return fn();
        } catch (error) {
            this.handleError(error, context);
            return null;
        }
    }

    /**
     * Protokolliert einen Fehler und ruft den onError-Callback auf.
     * @param {unknown} error
     * @param {string}  [context]
     */
    handleError(error, context = '') {
        const entry = {
            time:    Date.now(),
            context,
            message: error?.message ?? String(error),
            stack:   error?.stack   ?? ''
        };

        this._errors.push(entry);

        if (this._errors.length > this._maxErrors) {
            this._errors.shift();
        }

        if (!this._silent) {
            console.error(
                `[EditorErrorHandler]${context ? ' ' + context : ''}:`,
                error
            );
        }

        try {
            this._onError?.(entry);
        } catch { /* Fehler im Fehler-Callback ignorieren */ }
    }

    /**
     * Initialisiert ein Panel sicher – Fehler beim Start blockieren
     * nicht den restlichen Editor.
     *
     * @param {string}    id    – Panel-ID (für das Protokoll).
     * @param {() => any} fn    – Initialisierungsfunktion.
     * @returns {any | null}    – Ergebnis von fn oder null.
     */
    initPanel(id, fn) {
        return this.try(fn, `panel:${id}`);
    }

    /**
     * Führt fn asynchron aus und fängt Fehler ab.
     * @param {() => Promise<any>} fn
     * @param {string} [context]
     * @returns {Promise<any | null>}
     */
    async tryAsync(fn, context = '') {
        try {
            return await fn();
        } catch (error) {
            this.handleError(error, context);
            return null;
        }
    }


    // ------------------------------------------------------------------
    // Protokoll-Abfragen
    // ------------------------------------------------------------------

    /** @returns {ErrorEntry[]} Kopie des Fehlerprotokolls. */
    getErrors() {
        return [...this._errors];
    }

    /** @returns {ErrorEntry | null} Letzter Fehler oder null. */
    getLastError() {
        return this._errors[this._errors.length - 1] ?? null;
    }

    /** Leert das Fehlerprotokoll. */
    clearErrors() {
        this._errors = [];
    }

    /** @returns {number} */
    get errorCount() {
        return this._errors.length;
    }
}


/**
 * @typedef {{ time: number, context: string, message: string, stack: string }} ErrorEntry
 */
