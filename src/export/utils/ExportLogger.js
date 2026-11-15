/**
 * ExportLogger – Protokolliert Export-Vorgänge (Phase H)
 *
 * Sammelt Meldungen, Warnungen und Fehler während eines Export-Vorgangs.
 * Unterscheidet drei Schweregrade:
 *  - `info`    – Optionale Hinweise, kein Handlungsbedarf
 *  - `warning` – Export möglich, aber Informationen könnten verloren gehen
 *  - `error`   – Export kann nicht korrekt durchgeführt werden
 *
 * Instanzen sind nicht global; jeder Exporter erzeugt seinen eigenen Logger.
 *
 * @module ExportLogger
 */

/**
 * @typedef {Object} LogEntry
 * @property {'info'|'warning'|'error'} level   - Schweregrad der Meldung.
 * @property {string}                   message - Beschreibung des Ereignisses.
 * @property {object|null}              context - Optionale Zusatzdaten.
 * @property {string}                   time    - ISO-8601-Zeitstempel.
 */

/** @type {'info'|'warning'|'error'} */
const LEVEL_INFO    = 'info';
/** @type {'info'|'warning'|'error'} */
const LEVEL_WARNING = 'warning';
/** @type {'info'|'warning'|'error'} */
const LEVEL_ERROR   = 'error';

export class ExportLogger {

    /**
     * Erstellt einen neuen ExportLogger.
     *
     * @param {object}  [options={}]          - Konfigurationsoptionen.
     * @param {boolean} [options.silent=false] - Wenn `true`, wird keine
     *                                          Ausgabe auf der Konsole erzeugt.
     */
    constructor(options = {}) {
        /** @type {boolean} */
        this._silent = options.silent === true;

        /** @type {LogEntry[]} */
        this._entries = [];
    }

    // -------------------------------------------------------------------------
    // Protokollierungsmethoden
    // -------------------------------------------------------------------------

    /**
     * Protokolliert eine Informationsmeldung.
     *
     * @param {string}        message  - Beschreibungstext.
     * @param {object|null}  [context] - Optionale Zusatzdaten (z.B. Bauteil-ID).
     * @returns {void}
     */
    info(message, context = null) {
        this._log(LEVEL_INFO, message, context);
    }

    /**
     * Protokolliert eine Warnung.
     *
     * Warnungen erlauben den Export, weisen aber auf mögliche Informationsverluste hin.
     *
     * @param {string}        message  - Beschreibungstext.
     * @param {object|null}  [context] - Optionale Zusatzdaten.
     * @returns {void}
     */
    warn(message, context = null) {
        this._log(LEVEL_WARNING, message, context);
    }

    /**
     * Protokolliert einen Fehler.
     *
     * Fehler verhindern einen korrekten Export.
     *
     * @param {string}        message  - Beschreibungstext.
     * @param {object|null}  [context] - Optionale Zusatzdaten.
     * @returns {void}
     */
    error(message, context = null) {
        this._log(LEVEL_ERROR, message, context);
    }

    // -------------------------------------------------------------------------
    // Abfragem-Methoden
    // -------------------------------------------------------------------------

    /**
     * Gibt alle protokollierten Einträge zurück.
     *
     * @returns {LogEntry[]} Alle Einträge in chronologischer Reihenfolge.
     */
    getAll() {
        return [...this._entries];
    }

    /**
     * Gibt nur Fehler-Einträge zurück.
     *
     * @returns {LogEntry[]} Alle Einträge mit Level `'error'`.
     */
    getErrors() {
        return this._entries.filter(e => e.level === LEVEL_ERROR);
    }

    /**
     * Gibt nur Warnungs-Einträge zurück.
     *
     * @returns {LogEntry[]} Alle Einträge mit Level `'warning'`.
     */
    getWarnings() {
        return this._entries.filter(e => e.level === LEVEL_WARNING);
    }

    /**
     * Prüft, ob mindestens ein Fehler protokolliert wurde.
     *
     * @returns {boolean} `true`, wenn Fehler vorhanden sind.
     */
    hasErrors() {
        return this._entries.some(e => e.level === LEVEL_ERROR);
    }

    /**
     * Gibt die Anzahl der Einträge pro Schweregrad zurück.
     *
     * @returns {{ info: number, warning: number, error: number }}
     */
    getCount() {
        const counts = { info: 0, warning: 0, error: 0 };
        for (const entry of this._entries) {
            counts[entry.level] = (counts[entry.level] ?? 0) + 1;
        }
        return counts;
    }

    /**
     * Löscht alle protokollierten Einträge.
     *
     * @returns {void}
     */
    clear() {
        this._entries = [];
    }

    /**
     * Erstellt einen strukturierten Bericht aller protokollierten Ereignisse.
     *
     * @returns {{
     *   hasErrors:   boolean,
     *   hasWarnings: boolean,
     *   errors:      string[],
     *   warnings:    string[],
     *   infos:       string[]
     * }}
     */
    toReport() {
        const errors   = this._entries.filter(e => e.level === LEVEL_ERROR)  .map(e => e.message);
        const warnings = this._entries.filter(e => e.level === LEVEL_WARNING).map(e => e.message);
        const infos    = this._entries.filter(e => e.level === LEVEL_INFO)   .map(e => e.message);

        return {
            hasErrors:   errors.length   > 0,
            hasWarnings: warnings.length > 0,
            errors,
            warnings,
            infos,
        };
    }

    // -------------------------------------------------------------------------
    // Interne Hilfsmethoden
    // -------------------------------------------------------------------------

    /**
     * Interne Kernmethode: Erstellt und speichert einen Log-Eintrag.
     *
     * @param {'info'|'warning'|'error'} level   - Schweregrad.
     * @param {string}                   message - Beschreibungstext.
     * @param {object|null}              context - Optionale Zusatzdaten.
     * @returns {void}
     * @private
     */
    _log(level, message, context) {
        /** @type {LogEntry} */
        const entry = {
            level,
            message: String(message),
            context: context ?? null,
            time:    new Date().toISOString(),
        };

        this._entries.push(entry);

        if (!this._silent) {
            this._printToConsole(entry);
        }
    }

    /**
     * Gibt einen Eintrag auf der Konsole aus.
     *
     * @param {LogEntry} entry - Der auszugebende Eintrag.
     * @returns {void}
     * @private
     */
    _printToConsole(entry) {
        const prefix = `[ExportLogger][${entry.level.toUpperCase()}]`;
        const msg    = `${prefix} ${entry.message}`;

        switch (entry.level) {
            case LEVEL_ERROR:
                console.error(msg, entry.context ?? '');
                break;
            case LEVEL_WARNING:
                console.warn(msg, entry.context ?? '');
                break;
            default:
                console.info(msg, entry.context ?? '');
        }
    }
}
